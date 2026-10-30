// Final review M6: the incremental FogModel answers exactly as the old full
// rebuild (FogModelReference.ts) did — visibility, bands, labels, ghosts,
// last-seen places and every card's question — tick after tick of a real
// game (the engine on the depth test map, a human Germany at war with
// Poland, its armies on auto), with observer switches, the fog switched
// off and on, and ticks where only the navy moves (the army pass skipped,
// the moving armies' last-seen places following the tick); random walks
// over fake views on the same map (armies, battles, controllers, intel,
// factions, air, fleets, spotting, observers and switches at random); and
// the fake fog game's own corner: a hidden army's ghost stands where the
// last rebuild saw it, even when that rebuild was the navy's.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  type GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import { ARMY_BATTLE } from "@openfront/engine-api/ww1936/LandTypes";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { WW_AUTO_DOMAINS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import type { WirePlayer } from "@openfront/shared/WireSchemas";
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { FogModel } from "../../../src/client/hud/ww1936/FogModel";
import { GameView } from "../../../src/client/view/GameView";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { WwLandView } from "../../../src/client/view/WwLandView";
import { WwPoliticsView } from "../../../src/client/view/WwPoliticsView";
import { TestDataMapLoader } from "../../util/ScriptedGame";
import { stubWorker } from "../../util/viewStubs";
import {
  byTag,
  DEEP_MAP,
  HUMAN,
  order,
  step,
  warAfterPrep,
  wwGameStart,
  wwRunnerCapture,
} from "../../ww1936/util";
import { compareFog, type FogCoverage, newCoverage } from "./FogCompare";
import { FAR, fogGame, ID, NEAR } from "./FogFixture";
import { FogModelReference } from "./FogModelReference";
import { army } from "./LandFixture";

const HUMANS = [{ clientID: HUMAN, country: "DEU" as const }];
/** Ticks of war after the declaration. */
const WAR_TICKS = 2400;

/** The update without the land, air, depth and politics parts (and those parts). */
function split(gu: GameUpdateViewData) {
  const later = [
    GameUpdateType.WwLand,
    GameUpdateType.WwAir,
    GameUpdateType.WwDepth,
    GameUpdateType.WwPolitics,
  ] as const;
  const updates = { ...gu.updates } as GameUpdateViewData["updates"];
  const held: Record<number, unknown[]> = {};
  for (const t of later) {
    held[t] = (updates[t] ?? []) as unknown[];
    (updates as Record<number, unknown[]>)[t] = [];
  }
  return { first: { ...gu, updates }, held };
}

describe("FogModel matches the full rebuild (final review M6)", () => {
  it("answers alike every tick of a war on the depth test map", async () => {
    const { runner, updates } = await wwRunnerCapture({}, HUMANS, DEEP_MAP);
    const start = wwGameStart({}, HUMANS);
    const terrain = await loadTerrainMap(
      await loadMapFiles(
        new TestDataMapLoader(DEEP_MAP),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
    );
    const view = new GameView(
      stubWorker(),
      new Config(start.config, false),
      terrain,
      HUMAN,
      "player0",
      null,
      start.gameID,
      start.players as WirePlayer[],
    );
    const next = new FogModel(view);
    const ref = new FogModelReference(view);
    const follow = vi.spyOn(
      FogModel.prototype as unknown as { followMoving: () => void },
      "followMoving",
    );
    const cov = newCoverage();
    let done = 0;
    const drain = (stepNo: number) => {
      for (; done < updates.length; done++) {
        const gu = updates[done];
        if (stepNo % 7 === 3) {
          // The navy and the economy first: the armies' inputs stay, the
          // tick moves on; then the rest.
          const { first, held } = split(gu);
          view.update(first);
          expect(compareFog(view, next, ref, cov)).toBeNull();
          for (const d of held[GameUpdateType.WwLand] as never[]) {
            view.wwLand()!.apply((d as { data: never }).data, gu.tick);
          }
          for (const d of held[GameUpdateType.WwAir] as never[]) {
            view.wwAir()!.apply((d as { data: never }).data);
          }
          for (const d of held[GameUpdateType.WwDepth] as never[]) {
            view.wwDepth()!.apply((d as { data: never }).data);
          }
          for (const d of held[GameUpdateType.WwPolitics] as never[]) {
            view.wwPolitics()!.apply((d as { data: never }).data, gu.tick);
          }
        } else {
          view.update(gu);
        }
        expect(compareFog(view, next, ref, cov)).toBeNull();
      }
    };
    // Every automation on and the armies on auto: Germany fights.
    step(
      runner,
      2,
      WW_AUTO_DOMAINS.map((domain) =>
        order(HUMAN, { kind: "auto_set", domain, on: true }),
      ),
    );
    drain(0);
    warAfterPrep(runner, HUMAN, "POL");
    drain(0);
    const pol = byTag(runner.game, "POL").smallID();
    for (let i = 0; i < WAR_TICKS; i++) {
      step(
        runner,
        1,
        i % 75 === 0 ? [order(HUMAN, { kind: "army_auto_all", on: true })] : [],
      );
      // Another observer for a while (a takeover's), then mine again;
      // the fog forced off for a moment.
      if (i === 900) {
        next.setObserver(pol);
        ref.setObserver(pol);
      }
      if (i === 1100) {
        next.setObserver(0);
        ref.setObserver(0);
      }
      if (i === 1500 || i === 1520) {
        next.forceOff(i === 1500);
        ref.forceOff(i === 1500);
      }
      // Then each country's eyes in turn (a takeover's sightings start over).
      if (i >= 1600 && i % 100 === 0) {
        const o = 1 + ((i / 100) % 7);
        next.setObserver(o);
        ref.setObserver(o);
      }
      drain(i);
    }
    expect(cov.ticks).toBeGreaterThan(WAR_TICKS);
    // The run met what the fog does here: shown and hidden armies,
    // sightings of moving armies, battles and the skipped army pass. (The
    // test map is too small for an army to leave sight — every region
    // nearly touches every other — and its navies are built late: the
    // random walks below and WwClientPerf's WW_PERF_CHECK over a recorded
    // world1936 game cover ghosts and fleets.)
    expect(cov.shown).toBeGreaterThan(0);
    expect(cov.hidden).toBeGreaterThan(0);
    expect(cov.sightings).toBeGreaterThan(0);
    expect(cov.movingSightings).toBeGreaterThan(0);
    expect(cov.battles).toBeGreaterThan(0);
    expect(follow).toHaveBeenCalled();
    follow.mockRestore();
  }, 240_000);

  it("a hidden army's ghost stands where the navy's rebuild last saw it", () => {
    const g = fogGame({
      armies: [
        army(1, "POL", NEAR, {
          divisions: 12,
          move: { from: NEAR, to: FAR, progPm: 0, stepPm: 40 },
        }),
      ],
    });
    // A navy whose version alone moves (the army pass's inputs stay).
    const navy = {
      version: 1,
      fleets: new Map(),
      battles: new Map(),
      seaRegions: new Map(),
    };
    const game = { ...g.game, wwNavy: () => navy };
    const next = new FogModel(game as never);
    const ref = new FogModelReference(game as never);
    const both = () => {
      expect(JSON.stringify(next.armyView(1))).toBe(
        JSON.stringify(ref.armyView(1)),
      );
      expect(JSON.stringify(next.ghosts())).toBe(JSON.stringify(ref.ghosts()));
      expect(next.stamp()).toBe(ref.stamp());
    };
    both();
    expect(next.armyView(1).visible).toBe(true);
    // Three ticks on: only the navy moved; both see the army further on.
    for (let i = 0; i < 3; i++) {
      g.state.ticks += 1;
      navy.version++;
      both();
    }
    // Germany loses sight (the border regions change hands): the ghost.
    g.land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [3, 4].map((id) => ({
          id,
          controller: ID("POL"),
          supplyMilli: 0,
          useMilli: 0,
          encircled: false,
          counts: [],
        })),
        countries: [],
        details: [],
      } as never,
      g.state.ticks,
    );
    both();
    expect(next.ghosts()).toHaveLength(1);
    // Where the last navy rebuild saw it: 3 ticks of 40‰ along the edge,
    // not the region's centre nor where the land rebuild first saw it.
    const ghost = ref.ghosts()[0];
    expect(next.ghosts()[0]).toEqual(ghost);
    const first = g.land.tokenXY(g.land.armies.get(1)!, 700)!;
    expect(ghost.x).not.toBe(first[0]);
  });
});

// ---- Random walks over fake views ------------------------------------------

const DEEP = path.join(__dirname, "../../testdata/maps/ww1936deep");
const deepData = ScenarioDataSchema.parse(
  JSON.parse(fs.readFileSync(path.join(DEEP, "scenario.json"), "utf8")),
);
const deep = ScenarioIndex.fromFiles(
  deepData,
  new Uint8Array(fs.readFileSync(path.join(DEEP, "regions.bin"))),
);

/** A small seeded PRNG (mulberry32): the walks are the same every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)];
  return { next, int, pick, chance: (p: number) => next() < p };
}

/**
 * A game of fake views on the depth test map that a walk changes at random:
 * the land (armies on the move or fighting, controllers, battles), the
 * intel rows, the factions, the air (superiority, recon), the navy
 * (fleets, spotting, docks, battles), the tick, the observer, the fog's
 * switches. Each change bumps its view's version, as the real views do.
 */
function walkGame(seed: number) {
  const r = rng(seed);
  const n = deep.countries.length;
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  const regions = deep.landRegions.map((x) => x.id);
  const srs = [...new Set(regions.map((x) => deep.regionSr(x)))].filter(
    (x) => x > 0,
  );
  const zones = deepData.seaZones.map((z) => z.id);
  const land = new WwLandView(deep);
  const pol = new WwPoliticsView(deep);
  const depth = new WwDepthView();
  const state = {
    ticks: 700,
    spectator: false,
    over: false,
    me: 2,
    wars: [] as { a: number; b: number; sinceTick: number }[],
  };
  const sup = new Map<number, number>();
  const air = {
    version: 1,
    zones: new Map<number, { sr: number; sides: unknown[] }>(),
    deployments: new Map<
      number,
      { sr: number; mission: string; counts: number[] }
    >(),
    mySuperiority: (sr: number) => sup.get(sr) ?? 0,
  };
  const navy = {
    version: 1,
    fleets: new Map<number, Record<string, unknown>>(),
    battles: new Map<number, Record<string, unknown>>(),
    seaRegions: new Map<
      number,
      { sr: number; spotted: [number, number[]][] }
    >(),
  };
  const game = {
    ticks: () => state.ticks,
    worldWarScenario: () => deep,
    worldWarData: () => ({
      prepEndTick: 600,
      wars: state.wars,
      capitulated: [],
      gauges: [],
    }),
    wwLand: () => land,
    wwPolitics: () => pol,
    wwDepth: () => depth,
    wwAir: () => air,
    wwNavy: () => navy,
    myPlayer: () =>
      state.me === 0 ? null : { smallID: () => state.me, isAlive: () => true },
    isSpectator: () => state.spectator,
    gameOver: () => state.over,
  };

  const faction = new Map<number, number>();
  const politics = () => {
    pol.apply(
      {
        countries: ids.map((id) => ({
          smallID: id,
          ruling: 0,
          leader: "",
          pop: [0, 0, 0, 0],
          stabBp: 5000,
          wsBp: 5000,
          ppMilli: 0,
          faction: faction.get(id) ?? -1,
          surrenderPct: 80,
          focus: null,
        })),
        details: [],
        global: {
          wtBp: 0,
          threat: [],
          factions: [0, 1, 2].map((idx) => ({
            idx,
            key: "axis",
            name: "",
            nameTag: "",
            leader: 0,
            members: ids.filter((id) => faction.get(id) === idx),
          })),
          guarantees: [],
          naps: [],
          access: [],
          justifying: [],
          nextBeatDay: -1,
        },
        regions: [],
        news: [],
        cards: [],
      } as never,
      state.ticks,
    );
  };
  const intel = () => {
    const rows = ids.map((observer) => ({
      observer,
      row: Array.from({ length: (n + 1) * 4 }, () =>
        r.pick([0, 0, 10, 25, 40, 55, 70, 85, 100]),
      ),
    }));
    depth.apply({
      intel: rows,
      details: ids.map((smallID) => ({
        smallID,
        intel: {
          reconSorties: r.chance(0.3)
            ? undefined
            : srs.filter(() => r.chance(0.3)).map((x) => [x, 0, r.int(40)]),
          radarSr: srs.filter(() => r.chance(0.3)),
        },
      })),
      fx: [],
      news: [],
    } as never);
  };
  const armyIds = Array.from({ length: 28 }, (_, i) => i + 1);
  const randomArmy = (id: number) => {
    const region = r.chance(0.05) ? 0 : r.pick(regions);
    const nbs = region === 0 ? [] : deep.regionNeighbours(region);
    const moving = region !== 0 && r.chance(0.4) && nbs.length > 0;
    return army(id, "DEU", region, {
      owner: r.pick(ids),
      divisions: 1 + r.int(30),
      state: r.chance(0.2) ? ARMY_BATTLE : 0,
      symbol: r.int(4),
      volunteerFor: r.chance(0.1) ? r.pick(ids) : undefined,
      move: moving
        ? {
            from: region,
            to: r.chance(0.05) ? 0 : r.pick(nbs),
            progPm: r.int(900),
            stepPm: 5 + r.int(60),
          }
        : null,
    });
  };
  const landStep = (all: boolean) => {
    const changed = all ? armyIds : armyIds.filter(() => r.chance(0.25));
    const removed = all ? [] : armyIds.filter(() => r.chance(0.02));
    const battles = regions
      .filter(() => r.chance(all ? 0.3 : 0.05))
      .map((region) => ({
        region,
        attacker: r.chance(0.2) ? 100_000 + r.int(3) : r.pick(ids),
        defender: r.pick(ids),
        attLine: r.int(20),
        attReserve: r.int(5),
        defLine: r.int(20),
        defReserve: r.int(5),
      }));
    land.apply(
      {
        armies: changed.filter((id) => !removed.includes(id)).map(randomArmy),
        removedArmies: removed,
        battles: battles as never,
        endedBattles: regions.filter(() => r.chance(0.04)),
        regions: regions
          .filter(() => r.chance(all ? 1 : 0.08))
          .map((id) => ({
            id,
            controller: r.chance(0.5) ? r.pick(ids) : deep.ownerByRegion()[id],
            supplyMilli: 0,
            useMilli: 0,
            encircled: false,
            counts: [],
          })),
        countries: [],
        details: [],
      },
      state.ticks,
    );
  };
  const airStep = () => {
    for (const sr of srs) {
      if (r.chance(0.3)) sup.set(sr, r.pick([0, 300, 599, 600, 900]));
    }
    air.deployments.clear();
    for (let i = 0; i < r.int(5); i++) {
      air.deployments.set(i, {
        sr: r.pick(srs),
        mission: r.pick(["recon", "recon", "cas", "superiority"]),
        counts: [r.int(15), r.int(15)],
      });
    }
    air.zones.clear();
    for (const sr of srs) {
      air.zones.set(sr, {
        sr,
        sides: ids
          .filter(() => r.chance(0.4))
          .map((side) => ({ side, supPm: r.int(1000), sorties: [r.int(30)] })),
      });
    }
    air.version++;
  };
  const navyStep = () => {
    for (let id = 1; id <= 16; id++) {
      if (r.chance(0.3)) {
        navy.fleets.set(id, {
          id,
          owner: r.pick(ids),
          counts: [r.int(6), r.int(4), r.int(3)],
          zone: r.pick(zones),
          docked: r.chance(0.3) ? r.pick(regions) : 0,
        });
      } else if (r.chance(0.05)) navy.fleets.delete(id);
    }
    navy.battles.clear();
    for (const z of zones) {
      if (r.chance(0.2)) {
        navy.battles.set(z, {
          zone: z,
          attacker: r.pick(ids),
          defender: r.pick(ids),
        });
      }
    }
    navy.seaRegions.clear();
    for (const sr of srs) {
      navy.seaRegions.set(sr, {
        sr,
        spotted: [
          [
            r.chance(0.5) ? r.pick(ids) : 100_000 + r.int(3),
            [...navy.fleets.keys()].filter(() => r.chance(0.3)),
          ],
        ],
      });
    }
    navy.version++;
  };
  for (const id of ids) if (r.chance(0.5)) faction.set(id, r.int(3));
  politics();
  intel();
  landStep(true);
  airStep();
  navyStep();
  state.wars = [
    { a: 2, b: 4, sinceTick: 600 },
    { a: 1, b: 2, sinceTick: 600 },
  ];
  return {
    game,
    state,
    r,
    ids,
    step(next: FogModel, ref: FogModelReference) {
      state.ticks += r.pick([0, 1, 1, 1, 2, 4, 8]);
      // Mostly the land moves each tick, as in a war; sometimes the navy
      // alone (the army pass skipped); now and then the rest.
      if (r.chance(0.7)) landStep(false);
      if (r.chance(0.5)) navyStep();
      if (r.chance(0.15)) airStep();
      if (r.chance(0.05)) intel();
      if (r.chance(0.04)) {
        const id = r.pick(ids);
        if (r.chance(0.5)) faction.delete(id);
        else faction.set(id, r.int(3));
        politics();
      }
      if (r.chance(0.01))
        state.wars =
          state.wars.length > 0 ? [] : [{ a: 2, b: 4, sinceTick: 600 }];
      if (r.chance(0.01)) state.spectator = !state.spectator;
      if (r.chance(0.005)) state.over = !state.over;
      if (r.chance(0.01)) state.me = r.chance(0.2) ? 0 : r.pick(ids);
      if (r.chance(0.01)) {
        const o = r.chance(0.5) ? 0 : r.pick(ids);
        next.setObserver(o);
        ref.setObserver(o);
      }
      if (r.chance(0.01)) {
        const off = r.chance(0.5);
        next.forceOff(off);
        ref.forceOff(off);
      }
    },
  };
}

describe("FogModel matches the full rebuild on random walks (final review M6)", () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`walk ${seed}`, () => {
      const w = walkGame(seed);
      const next = new FogModel(w.game as never);
      const ref = new FogModelReference(w.game as never);
      const cov: FogCoverage = newCoverage();
      expect(compareFog(w.game as never, next, ref, cov)).toBeNull();
      for (let i = 0; i < 1500; i++) {
        w.step(next, ref);
        // Some ticks nobody asks (no frame), as on a slow phone.
        if (w.r.chance(0.1)) continue;
        const d = compareFog(w.game as never, next, ref, cov);
        if (d !== null) throw new Error(`walk ${seed} step ${i}: ${d}`);
      }
      expect(cov.shown).toBeGreaterThan(0);
      expect(cov.hidden).toBeGreaterThan(0);
      expect(cov.ghosts).toBeGreaterThan(0);
      expect(cov.movingSightings).toBeGreaterThan(0);
      expect(cov.fleetsShown).toBeGreaterThan(0);
      expect(cov.fleetsHidden).toBeGreaterThan(0);
      expect(cov.bands.every((b) => b > 0)).toBe(true);
    });
  }
});
