import {
  GameMapSize,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import {
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
async function restore(runner: GameRunner): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({}, HUMANS),
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

function attacksRunning(g: Game): number {
  return g.allPlayers().reduce((n, p) => n + p.outgoingAttacks().length, 0);
}

/**
 * Plays a game to `until` and returns when things first happened: the first
 * war, the first running attack, and every capitulation. Each is the tick
 * a restore must happen at (game.ticks()) for the next tick to bring it.
 */
async function probe(
  humans: WwHuman[],
  until: number,
): Promise<{ war: number; attack: number; capitulations: number[] }> {
  const r = await wwRunner({}, humans);
  const ww = r.game.worldWar()!;
  const intents = humans.length > 0 ? declareOnPoland(r.game) : () => [];
  const out = { war: -1, attack: -1, capitulations: [] as number[] };
  while (r.game.ticks() < until) {
    const before = r.game.ticks();
    step(r, 1, intents(before));
    if (out.war < 0 && ww.data().wars.length > 0) out.war = before;
    if (out.attack < 0 && attacksRunning(r.game) > 0) out.attack = before;
    if (ww.data().capitulated.length > out.capitulations.length) {
      out.capitulations.push(before);
    }
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
  // execution waiting for its first tick; 700: at war, before the first
  // attack (Poland's AI attacks much later on this map, see below).
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
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe(HUMANS, 4000);
      expect(moments.attack).toBeGreaterThan(0);
      expect(moments.capitulations.length).toBeGreaterThan(0);
    }, 120_000);

    test("while the AI's first attack runs", async () => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      while (a.game.ticks() < moments.attack + 10) {
        step(a, 1, intents(a.game.ticks()));
      }
      expect(attacksRunning(a.game)).toBeGreaterThan(0);
      const b = await restore(a);
      lockstep(a, b, 200, intents);
    }, 120_000);

    test("the tick before a capitulation", async () => {
      const a = await wwRunner({}, HUMANS);
      const intents = declareOnPoland(a.game);
      while (a.game.ticks() < moments.capitulations[0]) {
        step(a, 1, intents(a.game.ticks()));
      }
      const b = await restore(a);
      lockstep(a, b, 200, intents);
      expect(a.game.worldWar()!.data().capitulated).toHaveLength(1);
    }, 120_000);
  });

  describe("restored at the moments of the calendar's first war (no humans)", () => {
    // Germany declares on Poland in September 1939 (about tick 10,700),
    // France joins, and Poland and then Germany capitulate.
    let moments: Awaited<ReturnType<typeof probe>>;
    beforeAll(async () => {
      moments = await probe([], 13_000);
      expect(moments.war).toBeGreaterThan(WW_PREP_TICKS);
      expect(moments.capitulations.length).toBeGreaterThanOrEqual(2);
    }, 120_000);

    const at: [string, () => number][] = [
      ["the calendar's declaration", () => moments.war],
      ["the first capitulation", () => moments.capitulations[0]],
      ["the second capitulation", () => moments.capitulations[1]],
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
    const b = await restore(a);
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
    const c = await restore(b);
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
const WW1936_DIGEST = "ba3764c5bebd81c9";

describe("World War 1936 stays deterministic", () => {
  // An all-AI game on the test map, long enough for the calendar's first
  // war (September 1939, about tick 10,700): a declaration, a join, attacks,
  // two capitulations and their transfers, then Italy's war.
  test("a test-map game is pinned", async () => {
    const runner = await wwRunner();
    const h = createHash("sha256");
    while (runner.game.ticks() < 13_000) {
      step(runner);
      h.update(`${hash(runner)},`);
    }
    expect(runner.game.worldWar()!.data().capitulated.length).toBeGreaterThan(
      0,
    );
    expect(h.digest("hex").slice(0, 16)).toBe(WW1936_DIGEST);
  }, 120_000);
});
