import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  PlayerUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import type { EmergencyState } from "@openfront/engine/congress/Congress";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 35, 0, 30, 100);
  const green = own(game, GREEN.id, 70, 0, 30, 100);
  game.executeNextTick(); // the congress clock starts
  return { game, red, blue, green };
}

function aggression(
  game: Game,
  target: Player,
  members: Player[],
): EmergencyState {
  return {
    kind: "aggression",
    target: target.smallID(),
    startTick: game.ticks(),
    endTick: game.ticks() + 1500,
    goalKind: "land",
    goal: 300,
    progress: 0,
    members: members.map((p) => p.smallID()),
    opposed: [],
    contributions: new Map(),
    goalSilos: [],
    countedSilos: [],
  };
}

function playerUpdate(
  updates: ReturnType<Game["executeNextTick"]>,
  player: Player,
): PlayerUpdate | undefined {
  return updates[GameUpdateType.Player].find((u) => u.id === player.id());
}

describe("the emergency stays a secret ballot", () => {
  test("a yes-voter is listed only once it contributes; its own data says it is a member", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setEmergency(aggression(game, blue, [red, green]));
    const updates = game.executeNextTick();
    const sent = updates[GameUpdateType.Congress];
    expect(sent).toHaveLength(1);
    expect(sent[0].data.emergency!.members).toEqual([]);
    expect(c.toData().emergency!.members).toEqual([]);
    // The rules still see both members.
    expect(c.emergency()!.members).toEqual([red.smallID(), green.smallID()]);
    expect(playerUpdate(updates, red)!.congress!.emergencyMember).toBe(true);
    expect(playerUpdate(updates, green)!.congress!.emergencyMember).toBe(true);
    expect(
      playerUpdate(updates, blue)?.congress?.emergencyMember,
    ).toBeUndefined();

    c.updateEmergency((e) => e.contributions.set(green.smallID(), 12));
    const next = game.executeNextTick()[GameUpdateType.Congress];
    expect(next[0].data.emergency!.members).toEqual([green.smallID()]);
    expect(next[0].data.emergency!.hero).toBe(green.smallID());

    // Once the emergency is over the flag goes again (absent, not false).
    c.setEmergency(null);
    const after = game.executeNextTick();
    expect("emergencyMember" in playerUpdate(after, red)!.congress!).toBe(
      false,
    );
  });

  test("setEmergency keeps a copy: later writes to the caller's object change nothing", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    const e = aggression(game, blue, [red]);
    c.setEmergency(e);
    const data = c.toData();
    const hash = c.hash();
    e.members.push(99);
    e.opposed.push(98);
    e.contributions.set(red.smallID(), 50);
    e.progress = 200;
    expect(c.emergency()!.members).toEqual([red.smallID()]);
    expect(c.emergency()!.contributions.size).toBe(0);
    expect(c.emergency()!.progress).toBe(0);
    expect(c.toData()).toBe(data);
    expect(c.hash()).toBe(hash);
  });

  test("the hash still covers members the data leaves out", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setEmergency(aggression(game, blue, [red]));
    const one = c.hash();
    c.setEmergency(aggression(game, blue, [red, green]));
    expect(c.toData().emergency!.members).toEqual([]);
    expect(c.hash()).not.toBe(one);
  });
});

describe("what the congress forgets each second", () => {
  test("world heritage ends with its project; a verdict with its political project", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    red.domestic()!.beginVictoryProject("science", 42, 2400);
    enact(game, {
      resolution: "world_heritage",
      option: "A",
      targets: [red.smallID()],
      param: "42",
      expires: "project_end",
    });
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [red.smallID()],
      param: "42",
    });
    enact(game, { resolution: "sanction", targets: [blue.smallID()] });
    blue.domestic()!.beginVictoryProject("political", 43, 2400);
    c.setVerdict(blue.smallID(), { host: 43, ratified: true });
    // A science project in the verdict's office: not a proclamation.
    green.domestic()!.beginVictoryProject("science", 44, 2400);
    c.setVerdict(green.smallID(), { host: 44, ratified: false });

    runTicks(game, 10);
    const kinds = () => c.active().map((r) => `${r.resolution}:${r.option}`);
    expect(kinds()).toEqual([
      "world_heritage:A",
      "world_heritage:B",
      "sanction:A",
    ]);
    expect(c.verdict(blue.smallID())).toEqual({ host: 43, ratified: true });
    expect(c.verdict(green.smallID())).toBeUndefined();
    expect(c.toData().verdicts).toEqual([
      { owner: blue.smallID(), host: 43, ratified: true },
    ]);

    // The science project ends (complete or failed), and blue's proclamation
    // fails: a new one in the same office would need a new ratification.
    red.domestic()!.clearVictoryProject();
    blue.domestic()!.clearVictoryProject();
    runTicks(game, 10);
    expect(kinds()).toEqual(["sanction:A"]);
    expect(c.verdict(blue.smallID())).toBeUndefined();
    expect(c.toData().verdicts).toEqual([]);
  });

  test("a verdict stays while its proclamation waits complete for ratification", async () => {
    const { game, blue } = await three();
    const c = congressOf(game);
    const d = blue.domestic()!;
    d.beginVictoryProject("political", 43, 600);
    d.advanceVictoryProject(600, false);
    expect(d.victoryProject()!.ticksLeft).toBe(0);
    c.setVerdict(blue.smallID(), { host: 43, ratified: false });
    runTicks(game, 20);
    expect(c.verdict(blue.smallID())).toEqual({ host: 43, ratified: false });
  });
});

describe("building pact counts", () => {
  test("a construction start counts; an upgrade doesn't (spec §7.2)", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    c.takeBuiltCounts();
    const city = red.buildUnit(UnitType.City, game.ref(10, 10), {});
    red.buildUnit(UnitType.Port, game.ref(12, 12), {});
    expect([...c.takeBuiltCounts()]).toEqual([
      ["city", 1],
      ["port", 1],
    ]);
    red.upgradeUnit(city);
    expect(city.level()).toBe(2);
    expect([...c.takeBuiltCounts()]).toEqual([]);
  });
});
