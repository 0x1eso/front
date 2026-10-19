import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { CongressVoteExecution } from "@openfront/engine/congress/CongressVoteExecution";
import {
  availableEconomyKinds,
  economyItem,
  pickSeats,
  pickSecurity,
  projectItem,
  securityCandidates,
} from "@openfront/engine/congress/Sessions";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment, grantLaws, grantTechs } from "../domestic/util";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  enact,
  GREEN,
  item,
  nationInfo,
  own,
  RED,
  runTicks,
  seatAll,
} from "./util";

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
  return { game, red, blue, green };
}

describe("seats", () => {
  test("every alive human and the six nations with the highest score; no bots", async () => {
    const nations = [1, 2, 3, 4, 5, 6, 7].map((i) => nationInfo(`n${i}`));
    const game = await congressGame({}, [
      RED,
      BLUE,
      botInfo("bot"),
      ...nations,
    ]);
    let x = 0;
    const red = own(game, RED.id, x, 0, 5, 100);
    x += 5;
    const blue = own(game, BLUE.id, x, 0, 5, 100);
    x += 5;
    own(game, "bot_id", x, 0, 20, 100);
    x += 20;
    const ns = nations.map((info, i) => {
      const p = own(game, info.id, x, 0, i + 1, 100);
      x += i + 1;
      return p;
    });
    const expected = [red, blue, ...ns.slice(1)]
      .map((p) => p.smallID())
      .sort((a, b) => a - b);
    expect(pickSeats(game)).toEqual(expected);
  });
});

describe("the security card (spec §7.1)", () => {
  test("victim, then aggressor, then war pair, then runaway, in that order", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const now = game.ticks();
    // red 3,000 tiles against 2,000 each: 1.5 times the runner-up.
    for (const t of Array.from(blue.tiles()).slice(0, 1000)) blue.relinquish(t);
    for (const t of Array.from(green.tiles()).slice(0, 1000)) {
      green.relinquish(t);
    }
    blue.congress()!.recordLost(now, 1500); // 1500 / (2000 + 1500) = 42.9%
    red.congress()!.recordTaken(now, 60); // 0.6% of the land
    for (let i = 0; i < 40; i++)
      c.touchPair(red.smallID(), green.smallID(), now);
    const kinds = securityCandidates(game, c).map((s) => s.item.resolution);
    expect(kinds).toEqual([
      "protectorate",
      "sanction",
      "truce",
      "hegemony_check",
    ]);
    expect(securityCandidates(game, c)[0].item).toEqual({
      resolution: "protectorate",
      targets: [blue.smallID()],
      param: null,
      reason: "victim",
      reasonValue: 42.9,
    });
    expect(pickSecurity(game, c, new PseudoRandom(1)).resolution).toBe(
      "protectorate",
    );
  });

  test("an armed aggressor gets an arms embargo instead of sanctions", async () => {
    const { game, red } = await three();
    red.congress()!.recordTaken(game.ticks(), 60);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    const c = congressOf(game);
    expect(securityCandidates(game, c)[0].item).toMatchObject({
      resolution: "arms_embargo",
      targets: [red.smallID()],
      reason: "aggressor",
      reasonValue: 0.6,
    });
  });

  test("the last session's kind is skipped, unless the aggressor took 2% or more", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 60);
    c.rememberAgenda("sanction", null, null);
    const next = pickSecurity(game, c, new PseudoRandom(1));
    expect(next.resolution).not.toBe("sanction");
    expect(next.reason).toBe("global");
    red.congress()!.recordTaken(game.ticks(), 200); // 2.6%
    expect(pickSecurity(game, c, new PseudoRandom(1)).resolution).toBe(
      "sanction",
    );
  });

  test("with nothing on the ledger, a rule for the whole world; non-proliferation once someone has the bomb", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    const pick = () => pickSecurity(game, c, new PseudoRandom(7)).resolution;
    expect(["war_tax", "arms_treaty"]).toContain(pick());
    grantTechs(red, "rocketry", "manhattan_project");
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      seen.add(pickSecurity(game, c, new PseudoRandom(seed)).resolution);
    }
    expect([...seen].sort()).toEqual([
      "arms_treaty",
      "non_proliferation",
      "war_tax",
    ]);
  });
});

describe("the security card: ties", () => {
  test("two war pairs equally fierce: the one with the lower smallIDs gets the truce", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const now = game.ticks();
    // blue-green started first, red-blue is just as fierce.
    for (let i = 0; i < 40; i++) {
      c.touchPair(blue.smallID(), green.smallID(), now);
    }
    for (let i = 0; i < 40; i++)
      c.touchPair(red.smallID(), blue.smallID(), now);
    expect(securityCandidates(game, c)[0].item).toMatchObject({
      resolution: "truce",
      targets: [red.smallID(), blue.smallID()],
      reason: "war_pair",
    });
  });
});

describe("the economy card (spec §7.2)", () => {
  test("building pact: the structure most started since the last session, never the last one twice", async () => {
    const { game } = await three();
    const c = congressOf(game);
    for (let i = 0; i < 3; i++) c.noteBuilt(UnitType.City);
    c.noteBuilt(UnitType.Port);
    const built = c.takeBuiltCounts();
    expect(availableEconomyKinds(game, c, built)).toContain("building_pact");
    expect(
      economyItem(game, c, "building_pact", built, new PseudoRandom(1)),
    ).toMatchObject({ param: "city", reason: "most_built", reasonValue: 3 });
    c.rememberAgenda(null, "building_pact", "city");
    expect(
      economyItem(game, c, "building_pact", built, new PseudoRandom(1)).param,
    ).toBe("port");
    expect(availableEconomyKinds(game, c, new Map())).not.toContain(
      "building_pact",
    );
  });

  test("trade pact: trains only when someone has a factory", async () => {
    const { game } = await three();
    const c = congressOf(game);
    for (let seed = 0; seed < 10; seed++) {
      expect(
        economyItem(game, c, "trade_pact", new Map(), new PseudoRandom(seed))
          .param,
      ).toBe("tradeShip");
    }
  });

  test("trade pact: a factory still being built doesn't bring trains; a finished one does", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    const factory = red.buildUnit(UnitType.Factory, game.ref(10, 10), {});
    factory.setUnderConstruction(true);
    const params = () => {
      const seen = new Set<string | null>();
      for (let seed = 0; seed < 20; seed++) {
        seen.add(
          economyItem(game, c, "trade_pact", new Map(), new PseudoRandom(seed))
            .param,
        );
      }
      return [...seen].sort();
    };
    expect(params()).toEqual(["tradeShip"]);
    factory.setUnderConstruction(false);
    expect(params()).toEqual(["tradeShip", "train"]);
  });

  test("government resolution: the top aggressor's government, else the most common one", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    grantGovernment(red, "monarchy");
    grantGovernment(blue, "republic");
    grantGovernment(green, "republic");
    expect(
      economyItem(
        game,
        c,
        "government_resolution",
        new Map(),
        new PseudoRandom(1),
      ),
    ).toMatchObject({ param: "republic", reason: "common_government" });
    red.congress()!.recordTaken(game.ticks(), 60);
    expect(
      economyItem(
        game,
        c,
        "government_resolution",
        new Map(),
        new PseudoRandom(1),
      ),
    ).toMatchObject({
      param: "monarchy",
      reason: "aggressor_government",
      reasonValue: red.smallID(),
    });
  });

  test("law review: a military law of the top aggressor; none without one", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 60);
    expect(availableEconomyKinds(game, c, new Map())).not.toContain(
      "law_review",
    );
    grantLaws(red, { doctrine: "B" });
    expect(
      economyItem(game, c, "law_review", new Map(), new PseudoRandom(1)),
    ).toMatchObject({ param: "doctrine:B", reason: "aggressor_law" });
  });
});

describe("the project card (spec §7.3)", () => {
  test("the running victory project nearest to done: world government or world heritage", async () => {
    const { game, red, blue } = await three();
    expect(projectItem(game)).toBeNull();
    red.domestic()!.beginVictoryProject("political", 77, 2400);
    blue.domestic()!.beginVictoryProject("science", 88, 2400);
    blue.domestic()!.shiftVictoryProject(-1400);
    expect(projectItem(game)).toEqual({
      resolution: "world_heritage",
      targets: [blue.smallID()],
      param: "88",
      reason: "project",
      reasonValue: 58,
    });
    // A complete political proclamation waits for ratification first.
    red.domestic()!.shiftVictoryProject(-2400);
    expect(projectItem(game)).toMatchObject({
      resolution: "world_government",
      targets: [red.smallID()],
      param: "77",
    });
  });
});

describe("the project card: owners", () => {
  test("a disconnected owner's project stays off the agenda until it is back", async () => {
    const { game, red } = await three();
    red.domestic()!.beginVictoryProject("political", 77, 2400);
    red.markDisconnected(true);
    expect(projectItem(game)).toBeNull();
    red.markDisconnected(false);
    expect(projectItem(game)).toMatchObject({
      resolution: "world_government",
      targets: [red.smallID()],
    });
  });
});

describe("regular sessions on the clock", () => {
  test("the first session opens at 1,800 with two cards; the next one 1,800 ticks later", async () => {
    const { game } = await three();
    runTicks(game, 1800);
    const c = congressOf(game);
    const s = c.session()!;
    expect(s).toMatchObject({
      kind: "regular",
      openTick: 1800,
      closeTick: 2100,
    });
    expect(s.items).toHaveLength(2);
    expect(c.nextSessionTick()).toBe(3600);
    expect(c.seats()).toHaveLength(3);
  });

  test("an aggressor is named, voted on, sanctioned at the tally, and the sanction ends at the next tally", async () => {
    const { game, red, blue } = await three();
    runTicks(game, 1700);
    for (let y = 0; y < 60; y++) red.conquer(game.ref(30, y));
    runTicks(game, 100);
    const c = congressOf(game);
    const s = c.session()!;
    expect(s.items[0]).toMatchObject({
      resolution: "sanction",
      targets: [red.smallID()],
      reason: "aggressor",
    });
    game.addExecution(new CongressVoteExecution(blue, s.id, 0, "A", 0));
    runTicks(game, s.closeTick - game.ticks());
    const updates = game.executeNextTick(); // the tally
    expect(c.isSanctioned(red.smallID())).toBe(true);
    const adopted = updates[GameUpdateType.DisplayEvent].find(
      (u) => u.message === "events_display.congress_adopted_target",
    )!;
    expect(adopted.params).toMatchObject({
      resolution: "sanction",
      option: "A",
      a: 1,
      b: 0,
      name: "red",
    });
    runTicks(game, 3600 + 300 - game.ticks() + 1);
    expect(c.isSanctioned(red.smallID())).toBe(false);
  });

  test("a truce lasts 120 s; world heritage A lasts the project; a tie adopts nothing", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    seatAll(game);
    blue.domestic()!.beginVictoryProject("science", 88, 2400);
    const s = c.openSession(
      "regular",
      [
        item("truce", [red.smallID(), blue.smallID()]),
        item("world_heritage", [blue.smallID()], "88", "project"),
        item("war_tax"),
      ],
      game.ticks(),
    );
    c.castBallot(red, s.id, 0, "A", 0);
    c.castBallot(blue, s.id, 1, "A", 0);
    c.castBallot(red, s.id, 2, "A", 0);
    c.castBallot(green, s.id, 2, "B", 0);
    runTicks(game, s.closeTick - game.ticks() + 1);
    const close = s.closeTick;
    expect(c.active().map((r) => [r.resolution, r.expires])).toEqual([
      ["truce", close + 1200],
      ["world_heritage", "project_end"],
    ]);
  });

  test("results name their subject; protecting a protected project again adds nothing", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    seatAll(game);
    blue.domestic()!.beginVictoryProject("science", 88, 2400);
    enact(game, {
      resolution: "world_heritage",
      targets: [blue.smallID()],
      param: "88",
      expires: "project_end",
    });
    const s = c.openSession(
      "regular",
      [
        item("world_heritage", [blue.smallID()], "88", "project"),
        item("building_pact", [], "city", "most_built"),
        item("war_tax"),
      ],
      game.ticks(),
    );
    c.castBallot(blue, s.id, 0, "A", 0);
    c.castBallot(red, s.id, 1, "A", 0);
    runTicks(game, s.closeTick - game.ticks());
    const events = game.executeNextTick()[GameUpdateType.DisplayEvent];
    expect(c.active().map((r) => [r.resolution, r.option])).toEqual([
      ["world_heritage", "A"],
      ["building_pact", "A"],
    ]);
    const byKey = (key: string) => events.find((u) => u.message === key)!;
    expect(byKey("events_display.congress_adopted_target").params).toEqual({
      resolution: "world_heritage",
      a: 1,
      b: 0,
      option: "A",
      param: "88",
      name: "blue",
    });
    expect(byKey("events_display.congress_adopted").params).toEqual({
      resolution: "building_pact",
      a: 1,
      b: 0,
      option: "A",
      param: "city",
    });
    expect(byKey("events_display.congress_tied").params).toEqual({
      resolution: "war_tax",
      a: 0,
      b: 0,
    });
  });
});
