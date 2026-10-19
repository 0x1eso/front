import { GameMode, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { ConveneEmergencyExecution } from "@openfront/engine/congress/ConveneEmergencyExecution";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  item,
  own,
  RED,
  seatAll,
} from "./util";

describe("the congress option", () => {
  test.each([
    ["vanilla", {}],
    ["congress without domestic mode", { congress: true }],
    ["domestic mode only", { domesticMode: true }],
    [
      "domestic mode with the congress explicitly off",
      { domesticMode: true, congress: false },
    ],
    [
      "a domestic team game",
      {
        domesticMode: true,
        congress: true,
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
    ],
  ])("off outside domestic FFA: %s", async (_, config) => {
    const game = await setup("plains", config, [RED, BLUE]);
    expect(game.config().congress()).toBe(false);
    expect(game.congress()).toBeNull();
    for (const p of game.allPlayers()) expect(p.congress()).toBeNull();
    const updates = game.executeNextTick();
    expect(updates[GameUpdateType.Congress]).toEqual([]);
    for (const pu of updates[GameUpdateType.Player]) {
      expect("congress" in pu).toBe(false);
    }
  });

  test("on with domestic mode in FFA: a congress and a state for every human and nation, none for bots", async () => {
    const game = await congressGame({}, [RED, BLUE, botInfo("bot")]);
    expect(game.config().congress()).toBe(true);
    expect(game.congress()).not.toBeNull();
    expect(game.player(RED.id).congress()).not.toBeNull();
    expect(game.player("bot_id").congress()).toBeNull();
  });

  test("the clock schedules the first session 3 minutes after it starts", async () => {
    const game = await congressGame();
    game.executeNextTick();
    expect(congressOf(game).nextSessionTick()).toBe(1800);
  });

  test("clients get the congress on its first tick, then only when it changes", async () => {
    const game = await congressGame();
    game.executeNextTick(); // the clock is initialized
    const first = game.executeNextTick()[GameUpdateType.Congress];
    expect(first).toHaveLength(1);
    expect(first[0].data.nextSessionTick).toBe(1800);
    expect(game.executeNextTick()[GameUpdateType.Congress]).toEqual([]);
    congressOf(game).setSeats([game.player(RED.id).smallID()]);
    const next = game.executeNextTick()[GameUpdateType.Congress];
    expect(next).toHaveLength(1);
    expect(next[0].data.seats).toEqual([game.player(RED.id).smallID()]);
  });

  test("players' congress data rides PlayerUpdate and is resent when it changes", async () => {
    const game = await congressGame();
    const red = game.player(RED.id);
    const pu = () =>
      game
        .executeNextTick()
        [GameUpdateType.Player].find((u) => u.id === RED.id);
    expect(pu()!.congress).toEqual({
      influence: 0,
      influencePerSec: 0,
      status: "peaceful",
      ballots: [],
    });
    giveInfluence(red, 42);
    expect(pu()!.congress!.influence).toBe(42);
  });

  test("congress modifiers add to the domestic totals, on the engine and on the client", async () => {
    const game = await congressGame();
    const red = own(game, RED.id, 0, 0, 30, 100);
    const d = red.domestic()!;
    const before = game.config().maxTroops(red);
    d.setCongressModifiers([{ stat: "maxTroops", pct: -15 }]);
    expect(d.pct("maxTroops")).toBe(-15);
    expect(game.config().maxTroops(red)).toBeCloseTo(before * 0.85);
    expect(new DomesticClientView(d.toData()).pct("maxTroops")).toBe(-15);
    const data = d.toData();
    d.setCongressModifiers([{ stat: "maxTroops", pct: -15 }]);
    expect(d.toData()).toBe(data);
    d.setCongressModifiers([]);
    expect(d.toData().congressModifiers).toBeUndefined();
  });

  test("survives a snapshot with a session, ballots, resolutions, an emergency and a war pair", async () => {
    const game = await congressGame({}, [RED, BLUE, GREEN]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 35, 0, 30, 100);
    own(game, GREEN.id, 70, 0, 30, 100);
    blue.buildUnit(UnitType.MissileSilo, game.ref(50, 50), {});
    game.executeNextTick();
    const c = congressOf(game);
    seatAll(game);
    giveInfluence(red, 100);
    const s = c.openSession(
      "regular",
      [
        item("sanction", [blue.smallID()], null, "aggressor"),
        item("research_fund"),
      ],
      game.ticks(),
    );
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBeNull();
    enact(game, {
      resolution: "truce",
      targets: [red.smallID(), blue.smallID()],
      expires: game.ticks() + 1200,
    });
    c.touchPair(red.smallID(), blue.smallID(), game.ticks());
    red.congress()!.recordTaken(game.ticks(), 25);
    red.congress()!.recordHitBy(blue.smallID(), game.ticks());
    c.setEmergency({
      kind: "nuclear",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1800,
      goalKind: "silos",
      goal: 1,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map([[red.smallID(), 3]]),
      goalSilos: blue.units(UnitType.MissileSilo),
      countedSilos: [],
    });
    c.setVerdict(blue.smallID(), { host: 7, ratified: true });
    red.domestic()!.setCongressModifiers([{ stat: "allGold", pct: -20 }]);
    await expectSnapshotRoundTrip(game, "plains", 10);
  });

  // The congress hashes JSON of its data, so the key order callers build
  // objects in must not survive into the state: a restored game reads them
  // back in schema order and has to hash the same.
  test("state built in any key order snapshots and hashes like its restored copy", async () => {
    const game = await congressGame({}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 35, 0, 30, 100);
    game.executeNextTick();
    const c = congressOf(game);
    seatAll(game);
    const s = c.openSession(
      "regular",
      [
        {
          reasonValue: 2.5,
          reason: "aggressor",
          param: null,
          targets: [blue.smallID()],
          resolution: "sanction",
        },
      ],
      game.ticks(),
    );
    expect(Object.keys(s.items[0])).toEqual([
      "resolution",
      "targets",
      "param",
      "reason",
      "reasonValue",
      "voters",
    ]);
    c.setAvailable([
      { sinceTick: game.ticks(), target: blue.smallID(), kind: "aggression" },
    ]);
    red.congress()!.setBallot({
      costMilli: 0,
      extra: 0,
      option: "A",
      item: 0,
      sessionId: s.id,
    });
    red
      .domestic()!
      .setCongressModifiers([{ when: "attacking", pct: 10, stat: "allGold" }]);
    await expectSnapshotRoundTrip(game, "plains", 10);
  });

  test("a crafted convene_emergency without a congress, or naming nobody, does nothing", async () => {
    for (const config of [{}, { domesticMode: true }]) {
      const game = await setup("plains", config, [RED, BLUE]);
      const red = own(game, RED.id, 0, 0, 30, 100);
      own(game, BLUE.id, 35, 0, 30, 100);
      game.addExecution(new ConveneEmergencyExecution(red, "nuclear", BLUE.id));
      const updates = game.executeNextTick();
      expect(game.congress()).toBeNull();
      expect(updates[GameUpdateType.Congress]).toEqual([]);
    }
    const game = await congressGame();
    const red = own(game, RED.id, 0, 0, 30, 100);
    game.executeNextTick();
    giveInfluence(red, 100);
    const before = congressOf(game).toData();
    game.addExecution(
      new ConveneEmergencyExecution(red, "aggression", "nobody_id"),
    );
    game.executeNextTick();
    expect(congressOf(game).toData()).toBe(before);
    expect(red.congress()!.influenceMilli()).toBe(100_000);
  });

  test("the intents carry only what they may", () => {
    const ok = (i: object) => IntentSchema.safeParse(i).success;
    const vote = {
      type: "congress_vote",
      session: 3,
      item: 2,
      option: "A",
      extra: 5,
    };
    expect(ok(vote)).toBe(true);
    expect(ok({ ...vote, extra: 6 })).toBe(false);
    expect(ok({ ...vote, item: 3 })).toBe(false);
    expect(ok({ ...vote, option: "C" })).toBe(false);
    const convene = {
      type: "convene_emergency",
      kind: "nuclear",
      target: "abcdefgh",
    };
    expect(ok(convene)).toBe(true);
    expect(ok({ ...convene, kind: "heritage" })).toBe(false);
  });
});
