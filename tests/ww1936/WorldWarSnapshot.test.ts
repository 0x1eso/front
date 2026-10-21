import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { createHash } from "node:crypto";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import {
  byTag,
  dropPact,
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
  takeRegion,
  wwGameStart,
  WwHuman,
  wwRunner,
} from "./util";

const HUMANS: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];
const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();

/**
 * A new runner from `runner`'s snapshot. The snapshot holds the config and
 * the players; the game start only gives the runtime details (game id).
 */
async function restore(
  runner: GameRunner,
  humans: WwHuman[] = HUMANS,
): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({}, humans),
    runner.snapshot(),
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    () => {},
  );
}

/** Runs both with the same turns; they must stay identical tick by tick. */
function lockstep(
  a: GameRunner,
  b: GameRunner,
  ticks: number,
  intents: (tick: number) => StampedIntent[] = () => [],
): void {
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    const turn = intents(a.game.ticks());
    step(a, 1, turn);
    step(b, 1, turn);
    if (hash(a) !== hash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
    if ((i + 1) % 25 === 0 || i + 1 === ticks) {
      expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
        [],
      );
    }
  }
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

/** Germany (a human) declares war on Poland right after the preparation minute. */
function declareOnPoland(g: Game): (tick: number) => StampedIntent[] {
  // P3 spec §16.2: the 1934 pact would refuse the declaration.
  dropPact(g, "DEU", "POL");
  const pol = byTag(g, "POL").id();
  return (t) =>
    t === WW_PREP_TICKS + 1
      ? [stamped(HUMAN, { type: "declare_war", target: pol })]
      : [];
}

/**
 * Idle Germany takes the Warsaw region (6) right after its declaration, the
 * way a won battle does (P2: Occupation.capture), and Poland's gauge fills.
 */
function takeWarsaw(g: Game): void {
  if (g.ticks() !== WW_PREP_TICKS + 2) return;
  takeRegion(g, 6, "DEU");
}

/** Steps to `tick` with the turns of `intents`, then `hand` after each tick. */
function playTo(
  r: GameRunner,
  tick: number,
  intents: (tick: number) => StampedIntent[],
  hand: (g: Game) => void = () => {},
): void {
  while (r.game.ticks() < tick) {
    step(r, 1, intents(r.game.ticks()));
    hand(r.game);
  }
}

/** Countries out of the game: capitulated, or conquered to the last tile. */
function fallen(g: Game): number {
  const ww = g.worldWar()!;
  return g
    .allPlayers()
    .filter((p) => !p.isAlive() || ww.isCapitulated(p.smallID())).length;
}

/**
 * Plays a game to `until` and returns when things first happened: the first
 * war, every capitulation and every fall (a capitulation, or a country
 * conquered before its gauge filled). Each is the tick a restore must happen
 * at (game.ticks()) for the next tick to bring it.
 */
async function probe(
  humans: WwHuman[],
  until: number,
  hand: (g: Game) => void = () => {},
): Promise<{
  war: number;
  capitulations: number[];
  falls: number[];
}> {
  const r = await wwRunner({}, humans);
  const ww = r.game.worldWar()!;
  const intents = humans.length > 0 ? declareOnPoland(r.game) : () => [];
  const out = {
    war: -1,
    capitulations: [] as number[],
    falls: [] as number[],
  };
  while (r.game.ticks() < until) {
    const before = r.game.ticks();
    step(r, 1, intents(before));
    hand(r.game);
    if (out.war < 0 && ww.data().wars.length > 0) out.war = before;
    if (ww.data().capitulated.length > out.capitulations.length) {
      out.capitulations.push(before);
    }
    while (fallen(r.game) > out.falls.length) out.falls.push(before);
  }
  return out;
}

describe("World War 1936 snapshots (spec §7.8)", () => {
  // 1: the opening; 300: the preparation minute; 602: a declare_war
  // execution waiting for its first tick; 700: at war, Poland's first
  // attack on its way.
  test.each([1, 300, WW_PREP_TICKS + 2, 700])(
    "restored at tick %i continues exactly",
    async (at) => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      while (a.game.ticks() < at) step(a, 1, intents(a.game.ticks()));
      const b = await restore(a);
      lockstep(a, b, 200, intents);
    },
    120_000,
  );

  describe("restored at the moments of the war Germany declares", () => {
    // Germany takes Warsaw by hand (takeWarsaw); Poland capitulates when its
    // gauge is full. (P2: no tile attacks; the AI's land war is Task 6's.)
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe(HUMANS, 4000, takeWarsaw);
      expect(moments.war).toBeGreaterThan(0);
      expect(moments.capitulations.length).toBeGreaterThan(0);
    }, 120_000);

    test("ten days into the war, Warsaw held", async () => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      playTo(a, moments.war + 75, intents, takeWarsaw);
      expect(a.game.worldWar()!.land.controller[6]).toBe(
        byTag(a.game, "DEU").smallID(),
      );
      const b = await restore(a);
      lockstep(a, b, 200, intents);
    }, 120_000);

    test("the tick before a capitulation", async () => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      playTo(a, moments.capitulations[0], intents, takeWarsaw);
      const b = await restore(a);
      lockstep(a, b, 200, intents);
      expect(a.game.worldWar()!.data().capitulated).toHaveLength(1);
    }, 120_000);
  });

  describe("restored at the moments of the calendar's first war (no humans)", () => {
    // Germany declares on Poland in September 1939 (about tick 10,700) and
    // France joins. (P2: the countries fall once the AI's land war, Task 6,
    // takes regions; the falls' moments come back with it.)
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe([], 11_500);
      expect(moments.war).toBeGreaterThan(WW_PREP_TICKS);
    }, 120_000);

    const at: [string, () => number][] = [
      ["the calendar's declaration", () => moments.war],
      ["ten days into that war", () => moments.war + 75],
    ];
    test.each(at)(
      "the tick before %s",
      async (_name, tick) => {
        const a = await wwRunner();
        stepTo(a, tick());
        const b = await restore(a);
        lockstep(a, b, 200);
      },
      120_000,
    );
  });

  test("restored mid-gauge, the capitulation comes on the same tick", async () => {
    // Germany and Poland both human and idle: only the gauge moves.
    const humans: WwHuman[] = [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "POL" },
    ];
    const a = await wwRunner({}, humans);
    const g = a.game;
    const ww = g.worldWar()!;
    const pol = byTag(g, "POL");
    dropPact(g, "DEU", "POL");
    stepTo(a, WW_PREP_TICKS + 1);
    step(a, 1, [stamped(HUMAN, { type: "declare_war", target: pol.id() })]);
    takeRegion(g, 6, "DEU");
    stepTo(a, dayStartTick(ww.day(g.ticks()) + 12, WW_PREP_TICKS) + 1);
    const days = ww.capitulationGauge(pol.smallID());
    expect(days).toBeGreaterThan(5);
    expect(days).toBeLessThan(WW_CAPITULATION_DAYS);
    const b = await restore(a, humans);
    const wb = b.game.worldWar()!;
    expect(wb.capitulationGauge(pol.smallID())).toBe(days);
    expect(wb.data().gauges).toEqual(ww.data().gauges);
    // Past the day the gauge fills, in lockstep.
    const left = WW_CAPITULATION_DAYS - days;
    const until = dayStartTick(ww.day(g.ticks()) + left + 1, WW_PREP_TICKS);
    lockstep(a, b, until - g.ticks());
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(wb.isCapitulated(pol.smallID())).toBe(true);
    expect(wb.data().capitulated).toEqual(ww.data().capitulated);
  }, 120_000);

  test("restoring mid-transfer continues exactly", async () => {
    const a = await wwRunner({}, HUMANS);
    stepTo(a, WW_PREP_TICKS + 1);
    const g = a.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    // A capitulation whose land is part-way over (on the real map a
    // transfer takes several ticks; the test map needs one, so the first
    // 1,500 tiles are moved by hand between ticks).
    ww.addCapitulation(pol.smallID(), deu.smallID(), g.ticks());
    ww.endWarsOf(pol.smallID());
    const tiles = Uint32Array.from(pol.tiles());
    ww.queueTransfer(pol.smallID(), deu.smallID(), tiles);
    const t = ww.transfers()[0];
    for (; t.next < 1500; t.next++) deu.conquer(tiles[t.next]);
    const b = await restore(a);
    expect(b.game.worldWar()!.transfers()[0].next).toBe(1500);
    lockstep(a, b, 50);
    expect(pol.isAlive()).toBe(false);
    expect(ww.transfers()).toEqual([]);
  }, 120_000);

  test("restoring around a capitulation, and mid-spread after the loser is swept", async () => {
    // Germany and Britain (humans) fight Poland. Warsaw falls (takeRegion)
    // the evening before Poland's gauge fills, so Poland capitulates the
    // next tick: its divisions go, its regions change control at once (P2
    // spec §12.5), and Warsaw's capture spread goes ahead of Krakow's,
    // leaving Krakow part-way for the next tick. A neighbour's tile lands
    // with Poland meanwhile, so the sweep after the transfer takes it too.
    const humans: WwHuman[] = [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "GBR" },
    ];
    const a = await wwRunner({}, humans);
    const g = a.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = (["DEU", "POL", "SUN"] as const).map((tag) =>
      byTag(g, tag),
    );
    dropPact(g, "DEU", "POL");
    stepTo(a, WW_PREP_TICKS + 1);
    step(a, 1, [
      stamped(HUMAN, { type: "declare_war", target: pol.id() }),
      stamped("HUMAN002", { type: "declare_war", target: pol.id() }),
    ]);
    step(a, 3);
    stepTo(a, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    takeRegion(g, 6, "DEU");
    // Its gauge one day short of full, so the next check capitulates it.
    ww.setCapitulationGauge(pol.smallID(), WW_CAPITULATION_DAYS - 1);
    expect(ww.land.fieldMen(pol.smallID())).toBeGreaterThan(0);

    // The capitulation tick runs in both.
    const b = await restore(a, humans);
    lockstep(a, b, 1);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(ww.land.controller[7]).toBe(deu.smallID());
    expect(ww.land.fieldMen(pol.smallID())).toBe(0);
    // Warsaw's 1,499 tiles went first; 501 of Krakow's 1,499 followed.
    expect(pol.numTilesOwned()).toBe(998);
    expect(ww.land.spreads.get(7)!.done).toBe(501);

    // A dying neighbour's tile lands with Poland, in both games.
    const handed = g.ref(125, 60);
    expect(g.owner(handed)).toBe(sun);
    for (const r of [a, b]) byTag(r.game, "POL").conquer(handed);

    // Restored again, from the restored game, mid-spread (the tile orders
    // are rebuilt from the spreads' sources: plan decision 21).
    const c = await restore(b, humans);
    lockstep(a, c, 50);
    expect(pol.isAlive()).toBe(false);
    // P2: the tile goes with its region (Kiev, the Soviet Union's).
    expect(g.owner(handed)).toBe(sun);
    expect(ww.land.spreads.size).toBe(0);
    expect(ww.transfers()).toEqual([]);
  }, 120_000);
});

/**
 * The mode-on digest. Regenerate only when a change to this mode's rules
 * (or to the vanilla rules it plays by) is meant to change how a game
 * plays: run `npx vitest tests/ww1936/WorldWarSnapshot.test.ts --run -t
 * pinned` three times, check the received value is the same each time,
 * put it here, and say so in the commit. A refactor that moves it is a bug.
 */
// P2 Task 1 (the land war's foundation, plan decision 22): divisions in
// the start, the land hash, no tile attacks; the lanes' stubs do nothing,
// so the AI's war takes no land yet. The controller re-pins it at every
// lane merge. Re-pinned after lanes C (battles, org recovery,
// entrenchment) and S (supply, training, reinforcement, attrition, army
// XP, generals) merged: same value in four runs. Re-pinned after lane A
// (the AI's land war) merged: same value in four runs.
// P3 Task 1 (politics' foundation, plan decision 23): the politics state
// and hash, the history beats rolled by wwRoll (the P0 calendar's stateful
// roll is gone), legal owners. Re-pinned after the P3 foundation and the
// six content lanes (K1–K6: focuses, events, decisions, persons, beats,
// 79 countries' politics) merged: same value in four runs. Re-pinned
// after lanes F (focuses) and E (events, decisions, beats) merged (T and
// U1 add no engine code): same value in four runs. Re-pinned after lane
// D (diplomacy, factions, treaties, war goals, territory) merged: same
// value in four runs. Re-pinned after lane P (PP, ideology, stability,
// advisors, spirits, laws, effects) merged: same value in four runs.
// Re-pinned after the P2 balance round 1 (w2-bal) merged on top of P3 (U2,
// screens only, changes no engine package): same value in four runs
// (balance round 2 left it). Re-pinned after P3 lane A (the politics AI)
// merged: same value in four runs. P4 foundation and its review fixes
// (navy and air state, start techs, fuel, convoys, the stub clock; P4
// techs out of the AI's research for now) with map v4 and the naval data:
// same value in four runs. The controller re-pins it at every merge that
// changes the engine.
const WW1936_DIGEST = "34154a63f3399d0e";

describe("World War 1936 stays deterministic", () => {
  // An all-AI game on the test map, long enough for the calendar's first
  // war (September 1939, about tick 10,700): a declaration and a join.
  // (A capitulation and its transfer are pinned by the restores above,
  // which run tick by tick against a restored copy.)
  test("a test-map game is pinned", async () => {
    const runner = await wwRunner();
    const h = createHash("sha256");
    while (runner.game.ticks() < 13_000) {
      step(runner);
      h.update(`${hash(runner)},`);
    }
    expect(h.digest("hex").slice(0, 16)).toBe(WW1936_DIGEST);
  }, 120_000);

  // Plan decision 22, pre-flight U7, restored in Task 11 with the
  // expectation the balanced land war gives: on the test map the calendar
  // war takes Poland (both its regions, so it dies whole before its gauge
  // fills) in the autumn of 1939, and the majors stand into 1940 (France's
  // two regions behind Paris's fort and fifty divisions, the Phoney War of
  // the democracies' liberation-only offensives).
  test("an all-AI test-map war: Poland falls in the autumn of 1939, the majors stand", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = byTag(g, "POL");
    let war = -1;
    let fell = -1;
    while (g.ticks() < 13_000) {
      step(runner);
      if (war < 0 && ww.hasWar(pol.smallID())) war = ww.day(g.ticks());
      if (fell < 0 && (!pol.isAlive() || ww.isCapitulated(pol.smallID()))) {
        fell = ww.day(g.ticks());
      }
    }
    expect(war).toBeGreaterThanOrEqual(dayOfDate("1939-09-01"));
    // The test map's Poland is two regions: it falls within weeks of the
    // war, in the autumn (the real map's 25 to 75 days are land-sim's).
    expect(fell - war).toBeGreaterThanOrEqual(10);
    expect(fell).toBeLessThanOrEqual(dayOfDate("1939-11-30"));
    expect(fallen(g)).toBe(1);
    for (const tag of ["DEU", "FRA", "SUN", "GBR", "ITA"] as const) {
      expect(byTag(g, tag).isAlive()).toBe(true);
      expect(ww.isCapitulated(byTag(g, tag).smallID())).toBe(false);
    }
  }, 120_000);
});
