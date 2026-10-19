import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { ConveneEmergencyExecution } from "@openfront/engine/congress/ConveneEmergencyExecution";
import {
  conveneEmergency,
  finishEmergency,
  onEmergencyVote,
  processEmergencySecond,
  startEmergency,
} from "@openfront/engine/congress/Emergencies";
import { Game, Player } from "@openfront/engine/game/Game";
import { MockInstance, vi } from "vitest";
import { roundTrip } from "../util/Snapshot";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  influence,
  own,
  RED,
  runTicks,
  seatAll,
} from "./util";

// red x 0-29, blue x 30-59, green x 60-89 (3,000 tiles each of 10,000).
async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  seatAll(game);
  return { game, red, blue, green };
}

function messagesOver(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const m of game.executeNextTick()[GameUpdateType.DisplayEvent]) {
      out.push(m.message);
    }
  }
  return out;
}

describe("what can be convened (spec §9.1)", () => {
  test("5% aggression, a nuke score of 3 and 40% of the land; the worst kind per nation", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const now = game.ticks();
    red.congress()!.recordTaken(now, 499);
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([]);
    red.congress()!.recordTaken(now, 1);
    blue.congress()!.recordNuke(now, 3);
    blue.congress()!.recordTaken(now, 600);
    // Unclaimed x 90-99: 4,000 tiles are 40%, and nothing for the ledger.
    for (let x = 90; x < 100; x++) {
      for (let y = 0; y < 100; y++) green.conquer(game.ref(x, y));
    }
    processEmergencySecond(game, c);
    expect(c.available().map((a) => [a.kind, a.target])).toEqual([
      ["aggression", red.smallID()],
      ["nuclear", blue.smallID()],
      ["hegemony", green.smallID()],
    ]);
    expect(c.available()[0].sinceTick).toBe(now);
  });

  test("a human's elimination makes its conqueror's aggression emergency available for 180 s", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    game.conquerPlayer(red, blue);
    expect(c.lastElimination(red.smallID())).toBe(game.ticks());
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([
      { kind: "aggression", target: red.smallID(), sinceTick: game.ticks() },
    ]);
    runTicks(game, 1810);
    expect(c.available()).toEqual([]);
  });

  test("nothing is listed without seats, during an emergency, in a cooldown or after three emergencies", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 600);
    const listed = () => {
      processEmergencySecond(game, c);
      return c.available().length;
    };
    c.setSeats([]);
    expect(listed()).toBe(0);
    seatAll(game);
    expect(listed()).toBe(1);
    c.setGlobalCooldown(game.ticks() + 100);
    expect(listed()).toBe(0);
    c.setGlobalCooldown(0);
    c.setTargetCooldown(red.smallID(), game.ticks() + 100);
    expect(listed()).toBe(0);
    c.setTargetCooldown(red.smallID(), 0);
    for (let i = 0; i < 3; i++) c.countEmergencyStarted();
    expect(listed()).toBe(0);
    expect(c.toData().emergenciesLeft).toBe(0);
    void blue;
  });

  test("nothing is listed while an emergency is running, nor once a winner exists", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 600);
    processEmergencySecond(game, c);
    expect(c.available()).toHaveLength(1);
    startEmergency(game, c, "aggression", red, [blue.smallID()], []);
    expect(c.emergency()).not.toBeNull();
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([]);
    finishEmergency(game, c, true);
    c.setGlobalCooldown(0);
    c.setTargetCooldown(red.smallID(), 0);
    game.setWinner(blue, game.stats().stats());
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([]);
  });

  test("everyone hears once when an emergency becomes available", async () => {
    const { game, red } = await three();
    red.congress()!.recordTaken(game.ticks(), 600);
    const messages = messagesOver(game, 25);
    expect(
      messages.filter(
        (m) => m === "events_display.congress_emergency_available",
      ),
    ).toHaveLength(1);
  });

  describe("an index hovering at its threshold is announced once", () => {
    const AVAILABLE = "events_display.congress_emergency_available";
    // green holds 3,000 of 10,000 tiles; x 90-99 takes it to 40%.
    const grow = (game: Game, green: Player) => {
      for (let x = 90; x < 100; x++) {
        for (let y = 0; y < 100; y++) green.conquer(game.ref(x, y));
      }
    };
    const shrink = (game: Game, green: Player) => {
      for (let y = 0; y < 100; y++) green.relinquish(game.ref(99, y));
    };
    // Announcements made since the last call (processEmergencySecond runs
    // between ticks here, so the tick's updates would miss them).
    const spies = new WeakMap<Game, MockInstance<Game["displayMessage"]>>();
    const seen = new WeakMap<Game, number>();
    const heard = (game: Game) => {
      let spy = spies.get(game);
      if (spy === undefined) {
        spy = vi.spyOn(game, "displayMessage");
        spies.set(game, spy);
      }
      const total = spy.mock.calls.filter(([m]) => m === AVAILABLE).length;
      const before = seen.get(game) ?? 0;
      seen.set(game, total);
      return total - before;
    };
    const watch = (game: Game) => expect(heard(game)).toBe(0);
    const listed = (c: ReturnType<typeof congressOf>) =>
      c.available().map((a) => `${a.kind}:${a.target}`);

    test("dropping off the list and back says nothing new", async () => {
      const { game, green } = await three();
      const c = congressOf(game);
      watch(game);
      grow(game, green);
      processEmergencySecond(game, c);
      expect(listed(c)).toEqual([`hegemony:${green.smallID()}`]);
      expect(heard(game)).toBe(1);
      for (let i = 0; i < 3; i++) {
        shrink(game, green);
        processEmergencySecond(game, c);
        expect(c.available()).toEqual([]);
        for (let y = 0; y < 100; y++) green.conquer(game.ref(99, y));
        processEmergencySecond(game, c);
        expect(listed(c)).toEqual([`hegemony:${green.smallID()}`]);
        expect(heard(game)).toBe(0);
      }
    });

    test("it is news again once the target's cooldown starts, or after an emergency is convened", async () => {
      const { game, red, blue, green } = await three();
      const c = congressOf(game);
      watch(game);
      grow(game, green);
      processEmergencySecond(game, c);
      expect(heard(game)).toBe(1);
      shrink(game, green);
      processEmergencySecond(game, c);
      // A cooldown that has already run out: listed again at once.
      c.setTargetCooldown(green.smallID(), game.ticks());
      for (let y = 0; y < 100; y++) green.conquer(game.ref(99, y));
      processEmergencySecond(game, c);
      expect(heard(game)).toBe(1);

      // Convening against red closes the list; after the vote fails and the
      // global cooldown passes, green's entry is news again.
      red.congress()!.recordTaken(game.ticks(), 600);
      processEmergencySecond(game, c);
      expect(heard(game)).toBe(1);
      giveInfluence(blue, 60);
      expect(conveneEmergency(game, blue, "aggression", red)).toBeNull();
      expect(c.available()).toEqual([]);
      c.closeSession();
      c.setGlobalCooldown(0);
      processEmergencySecond(game, c);
      expect(listed(c)).toContain(`hegemony:${green.smallID()}`);
      expect(heard(game)).toBe(2);
    });

    test("what was announced survives a snapshot: the restored game stays quiet", async () => {
      const { game, green } = await three();
      const c = congressOf(game);
      watch(game);
      grow(game, green);
      processEmergencySecond(game, c);
      expect(heard(game)).toBe(1);
      shrink(game, green);
      processEmergencySecond(game, c);
      expect(c.available()).toEqual([]);
      const { restored } = await roundTrip(game, "plains");
      expect(congressOf(restored).hash()).toBe(c.hash());
      const rc = congressOf(restored);
      const rg = restored.player(GREEN.id);
      watch(restored);
      for (let y = 0; y < 100; y++) rg.conquer(restored.ref(99, y));
      processEmergencySecond(restored, rc);
      expect(listed(rc)).toEqual([`hegemony:${rg.smallID()}`]);
      expect(heard(restored)).toBe(0);
    });
  });
});

describe("convening (spec §9.2)", () => {
  async function available() {
    const s = await three();
    s.red.congress()!.recordTaken(s.game.ticks(), 600);
    processEmergencySecond(s.game, congressOf(s.game));
    return s;
  }

  test("a target that died since the list was made can't be convened against, and nothing is paid", async () => {
    const { game, red, blue } = await available();
    giveInfluence(blue, 60);
    expect(congressOf(game).available()).toHaveLength(1);
    for (const t of Array.from(red.tiles())) red.relinquish(t);
    expect(red.isAlive()).toBe(false);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("unavailable");
    expect(influence(blue)).toBe(60);
    expect(congressOf(game).session()).toBeNull();
  });

  test("a seated non-target with 50 influence opens a 20 s vote with its own yes", async () => {
    const { game, red, blue } = await available();
    const c = congressOf(game);
    giveInfluence(blue, 60);
    expect(conveneEmergency(game, blue, "aggression", red)).toBeNull();
    expect(influence(blue)).toBe(10);
    const s = c.session()!;
    expect(s).toMatchObject({
      kind: "emergency",
      closeTick: game.ticks() + 200,
    });
    expect(s.items[0]).toMatchObject({
      resolution: "emergency",
      targets: [red.smallID()],
      param: "aggression",
      reason: "convened",
      reasonValue: blue.smallID(),
      voters: 1,
    });
    expect(blue.congress()!.ballot(s.id, 0)).toMatchObject({
      option: "A",
      extra: 0,
    });
  });

  test("refusals: unavailable, the target, its ally, sanctioned, unseated, short of influence, outside the window", async () => {
    const { game, red, blue, green } = await available();
    const c = congressOf(game);
    for (const p of [red, blue, green]) giveInfluence(p, 100);
    expect(conveneEmergency(game, blue, "nuclear", red)).toBe("unavailable");
    expect(conveneEmergency(game, red, "aggression", red)).toBe("target");
    green.createAllianceRequest(red)?.accept();
    expect(conveneEmergency(game, green, "aggression", red)).toBe("friendly");
    enact(game, { resolution: "sanction", targets: [blue.smallID()] });
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("sanctioned");
    c.dropTallyResolutions();
    c.setSeats([red.smallID(), green.smallID()]);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("seat");
    seatAll(game);
    blue.congress()!.spend(blue.congress()!.influenceMilli() - 49 * MILLI);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("influence");
    giveInfluence(blue, 10);
    c.scheduleNextSession(game.ticks() + 200);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("window");
    expect(c.session()).toBeNull();
  });

  test("the intent convenes: the emergency leaves the list at once and everyone hears it", async () => {
    const { game, red, blue, green } = await available();
    const c = congressOf(game);
    giveInfluence(blue, 50);
    giveInfluence(green, 50);
    expect(c.available()).toHaveLength(1);
    game.addExecution(
      new ConveneEmergencyExecution(blue, "aggression", red.id()),
    );
    const events = game.executeNextTick()[GameUpdateType.DisplayEvent];
    expect(c.session()?.kind).toBe("emergency");
    expect(c.available()).toEqual([]);
    expect(
      events.find(
        (m) => m.message === "events_display.congress_emergency_convened",
      ),
    ).toMatchObject({
      playerID: null,
      focusPlayerID: red.smallID(),
      params: {
        kind: "aggression",
        name: red.displayName(),
        targetID: blue.smallID(),
      },
    });
    // A second convener finds nothing left to convene.
    expect(conveneEmergency(game, green, "aggression", red)).toBe(
      "unavailable",
    );
    expect(influence(green)).toBe(50);
  });
});

describe("the vote and the emergency (spec §9.3-§9.5)", () => {
  async function voted(adopted: "A" | "B", killTarget = false) {
    const s = await three();
    const c = congressOf(s.game);
    const session = c.openSession(
      "emergency",
      [
        {
          resolution: "emergency",
          targets: [s.red.smallID()],
          param: "aggression",
          reason: "convened",
          reasonValue: s.blue.smallID(),
        },
      ],
      s.game.ticks(),
    );
    giveInfluence(s.blue, 50);
    giveInfluence(s.red, 50);
    // Passes 2 : 1, or fails 1 : 2.
    c.castBallot(s.blue, session.id, 0, "A", adopted === "A" ? 1 : 0);
    c.castBallot(s.red, session.id, 0, "B", adopted === "A" ? 0 : 1);
    // The target dies during the vote (a mid-vote conquest).
    if (killTarget)
      for (const t of Array.from(s.red.tiles())) s.red.relinquish(t);
    const [result] = c.closeSession();
    const messages: string[] = [];
    onEmergencyVote(s.game, c, result);
    if (killTarget) {
      for (const m of s.game.executeNextTick()[GameUpdateType.DisplayEvent]) {
        messages.push(m.message);
      }
    }
    return { ...s, c, messages };
  }

  test("a passed vote starts the emergency: goal 15% of the target's land, the yes voters as members", async () => {
    const { game, red, blue, c } = await voted("A");
    expect(c.emergency()).toMatchObject({
      kind: "aggression",
      target: red.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [blue.smallID()],
      opposed: [red.smallID()],
    });
    expect(c.emergenciesStarted()).toBe(1);
  });

  test("a target that dies during the vote gets no 'rejected 2:1' announcement, but the cooldowns still start", async () => {
    const { game, red, c, messages } = await voted("A", true);
    expect(red.isAlive()).toBe(false);
    expect(c.emergency()).toBeNull();
    expect(messages).not.toContain(
      "events_display.congress_emergency_rejected",
    );
    expect(c.targetCooldownUntil(red.smallID())).toBeGreaterThan(0);
    void game;
  });

  test("a failed vote starts the cooldowns instead", async () => {
    const { game, red, c } = await voted("B");
    expect(c.emergency()).toBeNull();
    expect(c.globalCooldownUntil()).toBe(game.ticks() + 3000);
    expect(c.targetCooldownUntil(red.smallID())).toBe(game.ticks() + 6000);
    expect(c.emergenciesStarted()).toBe(0);
  });

  test("late joiners become members; opponents and the target's friends don't", async () => {
    const { game, red, blue, green, c } = await voted("A");
    for (let y = 0; y < 5; y++) green.conquer(game.ref(29, y));
    expect(c.emergency()!.members).toEqual([blue.smallID(), green.smallID()]);
    expect(c.emergency()!.contributions.get(green.smallID())).toBe(5);
    expect(c.emergency()!.progress).toBe(5);
    void blue;
    void red;
  });

  test("an opponent or a friend of the target taking its land neither joins nor counts", async () => {
    const s = await three();
    const c = congressOf(s.game);
    startEmergency(s.game, c, "aggression", s.red, [], [s.blue.smallID()]);
    s.green.createAllianceRequest(s.red)?.accept();
    expect(s.green.isAlliedWith(s.red)).toBe(true);
    for (let y = 0; y < 5; y++) s.blue.conquer(s.game.ref(29, y));
    for (let y = 5; y < 10; y++) s.green.conquer(s.game.ref(29, y));
    expect(c.isEmergencyMember(s.blue.smallID())).toBe(false);
    expect(c.isEmergencyMember(s.green.smallID())).toBe(false);
    expect(c.emergency()).toMatchObject({ members: [], progress: 0 });
    expect(c.emergency()!.contributions.size).toBe(0);
  });

  test("success: rewards by contribution, the hero doubled, the target sanctioned, a truce after for those who took part, cooldowns", async () => {
    const { game, red, blue, green, c } = await voted("A");
    for (const p of [blue, green]) p.domestic()!.addYield(2000, 1000);
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(29, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(28, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(27, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(26, y));
    for (let y = 0; y < 60; y++) green.conquer(game.ref(25, y));
    expect(c.emergency()!.progress).toBe(460);
    const now = game.ticks();
    processEmergencySecond(game, c);
    expect(c.emergency()).toBeNull();
    // blue: 40 left after its +1 vote, then the hero's 60.
    expect(influence(blue)).toBe(100);
    expect(influence(green)).toBe(30);
    expect(blue.domestic()!.scienceMilliAvailable()).toBe(2000 + 2000 * 90);
    expect(green.domestic()!.politicalMilliAvailable()).toBe(1000 + 1000 * 45);
    expect(c.isSanctioned(red.smallID())).toBe(true);
    expect(
      c
        .active()
        .filter((r) => r.resolution === "truce")
        .map((r) => [r.targets, r.expires]),
    ).toEqual([
      [[red.smallID(), blue.smallID()], now + 600],
      [[red.smallID(), green.smallID()], now + 600],
    ]);
    expect(c.globalCooldownUntil()).toBe(now + 3000);
    expect(c.targetCooldownUntil(red.smallID())).toBe(now + 6000);
  });

  test("a yes voter that never took part gets no aftermath truce: nothing shows its vote", async () => {
    const s = await three();
    const c = congressOf(s.game);
    // blue and green voted yes; only blue takes the target's land.
    startEmergency(
      s.game,
      c,
      "aggression",
      s.red,
      [s.blue.smallID(), s.green.smallID()],
      [],
    );
    for (let y = 0; y < 5; y++) s.blue.conquer(s.game.ref(29, y));
    for (const success of [true, false]) {
      if (c.emergency() === null) {
        startEmergency(
          s.game,
          c,
          "aggression",
          s.red,
          [s.blue.smallID(), s.green.smallID()],
          [],
        );
        s.blue.conquer(s.game.ref(29, 10));
      }
      c.dropTallyResolutions();
      c.expireResolutions(s.game.ticks() + 1_000_000);
      finishEmergency(s.game, c, success);
      const truces = c
        .active()
        .filter((r) => r.resolution === "truce")
        .map((r) => r.targets);
      expect(truces).toEqual([[s.red.smallID(), s.blue.smallID()]]);
      const shown = c.toData();
      expect(
        shown.active.some((r) => r.targets.includes(s.green.smallID())),
      ).toBe(false);
      expect(s.green.isTruceWith(s.red)).toBe(false);
      expect(s.blue.isTruceWith(s.red)).toBe(true);
    }
  });

  test("failure: the target survives with 60 influence and 60 s of output", async () => {
    const { game, red, c } = await voted("A");
    red.domestic()!.addYield(1000, 1000);
    finishEmergency(game, c, false);
    // 50 it never spent on its vote, and 60 for holding out.
    expect(influence(red)).toBe(110);
    expect(red.domestic()!.scienceMilliAvailable()).toBe(1000 + 60_000);
    expect(c.emergency()).toBeNull();
  });

  test("hegemony: success empties the target's influence, failure gives it +10% gold until the next result", async () => {
    const s = await three();
    const c = congressOf(s.game);
    giveInfluence(s.red, 80);
    startEmergency(s.game, c, "hegemony", s.red, [s.blue.smallID()], []);
    expect(c.emergency()).toMatchObject({ goalKind: "land", goal: 300 });
    finishEmergency(s.game, c, true);
    expect(influence(s.red)).toBe(0);
    expect(c.active().some((r) => r.resolution === "emergency")).toBe(false);

    startEmergency(s.game, c, "hegemony", s.red, [s.blue.smallID()], []);
    finishEmergency(s.game, c, false);
    expect(
      c.active().filter((r) => r.resolution === "emergency"),
    ).toMatchObject([
      {
        option: "B",
        targets: [s.red.smallID()],
        param: "hegemony",
        expires: "next_tally",
        source: "emergency",
      },
    ]);
  });

  test("the nuclear emergency counts silos destroyed or captured, crediting members", async () => {
    const s = await three();
    const c = congressOf(s.game);
    const silos = [
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 5), {}),
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 50), {}),
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 90), {}),
    ];
    startEmergency(s.game, c, "nuclear", s.red, [s.blue.smallID()], []);
    expect(c.emergency()).toMatchObject({ goalKind: "silos", goal: 2 });
    silos[0].delete(true, s.blue);
    processEmergencySecond(s.game, c);
    expect(c.emergency()!.progress).toBe(1);
    expect(c.emergency()!.contributions.get(s.blue.smallID())).toBe(20);
    s.blue.captureUnit(silos[1]);
    processEmergencySecond(s.game, c);
    expect(c.emergency()).toBeNull();
    expect(
      c
        .active()
        .some((r) => r.resolution === "arms_embargo" && r.option === "A"),
    ).toBe(true);
  });

  test("land goals are fixed at the start: 300 tiles at least, except the nuclear one without silos (spec §9.4)", async () => {
    const game = await congressGame({}, [RED, BLUE]);
    // red holds 1,000 tiles.
    const red = own(game, RED.id, 0, 0, 10, 100);
    const blue = own(game, BLUE.id, 10, 0, 30, 100);
    game.executeNextTick();
    seatAll(game);
    const c = congressOf(game);
    const goal = (kind: "aggression" | "nuclear" | "hegemony") => {
      startEmergency(game, c, kind, red, [blue.smallID()], []);
      const e = c.emergency()!;
      const out = [e.goalKind, e.goal];
      c.setEmergency(null);
      return out;
    };
    expect(goal("aggression")).toEqual(["land", 300]);
    expect(goal("hegemony")).toEqual(["land", 300]);
    expect(goal("nuclear")).toEqual(["land", 100]);
  });

  test("the target dying ends the emergency as a success", async () => {
    const { game, red, c } = await voted("A");
    for (const t of Array.from(red.tiles())) red.relinquish(t);
    processEmergencySecond(game, c);
    expect(c.emergency()).toBeNull();
    expect(c.isSanctioned(red.smallID())).toBe(true);
  });

  test("a member that allies with the target stays a member and nothing breaks", async () => {
    const { game, red, blue, c } = await voted("A");
    blue.createAllianceRequest(red)?.accept();
    expect(blue.canAttackPlayer(red)).toBe(false);
    expect(() => runTicks(game, 30)).not.toThrow();
    expect(c.emergency()!.members).toEqual([blue.smallID()]);
  });

  test("the clock ends it at its deadline", async () => {
    const { game, red, c } = await voted("A");
    runTicks(game, 1510);
    expect(c.emergency()).toBeNull();
    expect(influence(red)).toBeGreaterThanOrEqual(60);
  });
});
