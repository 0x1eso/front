import {
  GameMapSize,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
  WW_TRANSFER_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
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
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
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
  const pol = byTag(g, "POL").id();
  return (t) =>
    t === WW_PREP_TICKS + 1
      ? [stamped(HUMAN, { type: "declare_war", target: pol })]
      : [];
}

/**
 * P1: a 1936 army wipes Poland out within a hundred ticks, before its gauge
 * can fill. So idle Germany takes the Warsaw region by hand right after its
 * declaration: Poland's AI attacks it, and Poland's gauge fills meanwhile.
 */
function takeWarsaw(g: Game): void {
  if (g.ticks() !== WW_PREP_TICKS + 2) return;
  const ww = g.worldWar()!;
  const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
  const warsaw = ww.scenario.landRegions.find((r) => r.name === "Warsaw")!;
  for (const t of [...pol.tiles()]) {
    if (ww.scenario.regionAt(t) === warsaw.id) deu.conquer(t);
  }
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

function attacksRunning(g: Game): number {
  return g.allPlayers().reduce((n, p) => n + p.outgoingAttacks().length, 0);
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
 * war, the first running attack, every capitulation and every fall (a
 * capitulation, or a country conquered before its gauge filled). Each is the
 * tick a restore must happen at (game.ticks()) for the next tick to bring it.
 */
async function probe(
  humans: WwHuman[],
  until: number,
  hand: (g: Game) => void = () => {},
): Promise<{
  war: number;
  attack: number;
  capitulations: number[];
  falls: number[];
}> {
  const r = await wwRunner({}, humans);
  const ww = r.game.worldWar()!;
  const intents = humans.length > 0 ? declareOnPoland(r.game) : () => [];
  const out = {
    war: -1,
    attack: -1,
    capitulations: [] as number[],
    falls: [] as number[],
  };
  while (r.game.ticks() < until) {
    const before = r.game.ticks();
    step(r, 1, intents(before));
    hand(r.game);
    if (out.war < 0 && ww.data().wars.length > 0) out.war = before;
    if (out.attack < 0 && attacksRunning(r.game) > 0) out.attack = before;
    if (ww.data().capitulated.length > out.capitulations.length) {
      out.capitulations.push(before);
    }
    while (fallen(r.game) > out.falls.length) out.falls.push(before);
  }
  return out;
}

/**
 * Transfers queued ahead of the next one that use up `tiles` of its tick's
 * budget: land of a's going to b and back. a keeps its VP tiles (nobody's
 * points change) and enough land to stay alive.
 */
function queueBacklog(g: Game, a: Player, b: Player, tiles: number): void {
  const ww = g.worldWar()!;
  const vpTiles = new Set(
    ww.scenario.landRegions.map((r) => ww.scenario.vpTile(r)),
  );
  const own = Uint32Array.from([...a.tiles()].filter((t) => !vpTiles.has(t)));
  const moving = own.subarray(0, own.length - 10);
  for (let toB = true; tiles > 0; toB = !toB) {
    const leg = moving.slice(0, Math.min(tiles, moving.length));
    if (toB) ww.queueTransfer(a.smallID(), b.smallID(), leg);
    else ww.queueTransfer(b.smallID(), a.smallID(), leg);
    tiles -= leg.length;
  }
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
    // Germany takes Warsaw by hand (takeWarsaw); Poland's AI attacks it and
    // capitulates when its gauge is full.
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe(HUMANS, 4000, takeWarsaw);
      expect(moments.attack).toBeGreaterThan(0);
      expect(moments.capitulations.length).toBeGreaterThan(0);
    }, 120_000);

    test("while the AI's first attack runs", async () => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      playTo(a, moments.attack + 10, intents, takeWarsaw);
      expect(attacksRunning(a.game)).toBeGreaterThan(0);
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
    // Germany declares on Poland in September 1939 (about tick 10,700),
    // France joins, and Germany and then Poland fall. On this small map
    // they are conquered to the last tile before their 30-day gauges fill.
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe([], 13_000);
      expect(moments.war).toBeGreaterThan(WW_PREP_TICKS);
      expect(moments.falls.length).toBeGreaterThanOrEqual(2);
    }, 120_000);

    const at: [string, () => number][] = [
      ["the calendar's declaration", () => moments.war],
      ["the first fall", () => moments.falls[0]],
      ["the second fall", () => moments.falls[1]],
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
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(a, WW_PREP_TICKS + 1);
    step(a, 1, [stamped(HUMAN, { type: "declare_war", target: pol.id() })]);
    const warsaw = ww.scenario.landRegions.find((r) => r.name === "Warsaw")!;
    deu.conquer(ww.scenario.vpTile(warsaw));
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

  test("restoring around a capitulation that ends an attack and a boat, and mid-transfer after the list restarts", async () => {
    // Germany and Britain (humans) fight Poland: Germany attacks over
    // land, a British boat sails to Poland's coast. Warsaw falls by hand,
    // so Poland capitulates at the next day; transfers queued ahead leave
    // 50 of its tiles for the following tick, and a neighbour's tile lands
    // with Poland meanwhile, so its list restarts.
    const humans: WwHuman[] = [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "GBR" },
    ];
    const a = await wwRunner({}, humans);
    const g = a.game;
    const ww = g.worldWar()!;
    const [deu, pol, gbr, ita, fra] = (
      ["DEU", "POL", "GBR", "ITA", "FRA"] as const
    ).map((tag) => byTag(g, tag));
    stepTo(a, WW_PREP_TICKS + 1);
    step(a, 1, [
      stamped(HUMAN, { type: "declare_war", target: pol.id() }),
      stamped("HUMAN002", { type: "declare_war", target: pol.id() }),
    ]);
    step(a, 1);
    step(a, 1, [
      stamped(HUMAN, {
        type: "attack",
        targetID: pol.id(),
        troops: Math.floor(deu.troops() / 2),
      }),
      stamped("HUMAN002", {
        type: "boat",
        troops: Math.floor(gbr.troops() / 2),
        dst: g.ref(105, 99),
      }),
    ]);
    step(a, 2);
    const warsaw = ww.scenario.landRegions.find((r) => r.name === "Warsaw")!;
    deu.conquer(ww.scenario.vpTile(warsaw));
    // Its gauge one day short of full, so the next check capitulates it.
    ww.setCapitulationGauge(pol.smallID(), WW_CAPITULATION_DAYS - 1);
    stepTo(a, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    const [boat] = gbr.units(UnitType.TransportShip);
    expect(boat.isActive()).toBe(true);
    expect(deu.outgoingAttacks()).toHaveLength(1);
    const left = 50;
    queueBacklog(
      g,
      ita,
      fra,
      WW_TRANSFER_TILES_PER_TICK - pol.numTilesOwned() + left,
    );

    // The capitulation tick runs in both.
    const b = await restore(a, humans);
    lockstep(a, b, 1);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(deu.outgoingAttacks()).toEqual([]);
    expect(boat.isActive()).toBe(false);
    expect(pol.numTilesOwned()).toBe(left);

    // A dying neighbour's tile lands with Poland, in both games.
    const handed = g.ref(125, 60);
    expect(g.owner(handed)).toBe(byTag(g, "SUN"));
    for (const r of [a, b]) byTag(r.game, "POL").conquer(handed);

    // Restored again, from the restored game, mid-transfer.
    const c = await restore(b, humans);
    lockstep(a, c, 50);
    expect(pol.isAlive()).toBe(false);
    expect(g.owner(handed)).toBe(deu);
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
// P1 fix batch (engine): every country starts with its lines and research,
// casualties leave the recruitable pool, the economy hash adds construction
// and research progress, the field infantry and the casualties.
const WW1936_DIGEST = "a75ef095e838e87c";

describe("World War 1936 stays deterministic", () => {
  // An all-AI game on the test map, long enough for the calendar's first
  // war (September 1939, about tick 10,700): a declaration, a join, attacks,
  // capitulation gauges filling, Germany and Poland conquered before theirs
  // are full, then Italy's war. (A capitulation and its transfer are pinned
  // by the restores above, which run tick by tick against a restored copy.)
  test("a test-map game is pinned", async () => {
    const runner = await wwRunner();
    const h = createHash("sha256");
    let gauged = false;
    while (runner.game.ticks() < 13_000) {
      step(runner);
      h.update(`${hash(runner)},`);
      gauged ||= runner.game.worldWar()!.data().gauges.length > 0;
    }
    expect(gauged).toBe(true);
    expect(fallen(runner.game)).toBeGreaterThanOrEqual(2);
    expect(h.digest("hex").slice(0, 16)).toBe(WW1936_DIGEST);
  }, 120_000);
});
