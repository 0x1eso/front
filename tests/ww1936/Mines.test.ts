// World War 1936 P6 (plan Task 8, lane W2): naval mines (spec §15.1) on
// ww1936deep — Britain and Italy, both human, at war; the AI's mines
// (spec §19.7) with Britain or Italy left to the AI.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  FLEET_MISSIONS,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  mineConvoyLossPm,
  mineDamageMilli,
  mineDecay,
  mineInvasionCutPct,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  aiSeaAirDay,
  homeSeaRegions,
  isDepthFleet,
} from "@openfront/engine/ww1936/depth/AiSeaAir";
import {
  enemyMinesMilli,
  minesConvoyLossPm,
  minesInvasionCutPct,
  ownMinesMilli,
  seaRegionDay,
} from "@openfront/engine/ww1936/depth/Mines";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { step, stepTo, takeRegion, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const CENTRAL = DEEP.sr.central;
const BOTH = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANITA", country: "ITA" as const },
];

async function atWar(
  humans: { clientID: string; country: "GBR" | "ITA" }[] = BOTH,
): Promise<GameRunner> {
  const runner = await wwRunner({}, humans, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

/** Ship design slot 1 of `id`: a destroyer with `module` in its special slot. */
function ddDesign(d: WwDepth, id: number, module: string): void {
  const def: DesignDef = {
    kind: "ship",
    base: "dd_1",
    modules: ["", "", "", module],
    name: "Test DD",
  };
  d.country(id)!.des.ship[0] = {
    def: def as never,
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: 0,
  };
  d.markDesign(id, "ship", 1);
}

/** A new fleet in `port`; `designed` of its destroyers built to design slot 1. */
function fleet(
  runner: GameRunner,
  owner: number,
  port: number,
  dds: number,
  designed: number,
  extra: [("cl" | "bb")?, number?] = [],
): number {
  const navy = runner.game.worldWar()!.navy;
  const comp: ["dd" | "cl" | "bb", number, number][] = [["dd", 1, dds]];
  if (extra[0] !== undefined) comp.push([extra[0], 1, extra[1] ?? 1]);
  const id = navy.createFleet(owner, port, comp);
  const t = navy.ships;
  let n = 0;
  for (const sid of navy.fleets.get(id)!.ships) {
    const r = t.rowOf(sid);
    if (SHIP_CLASSES[t.cls[r]] === "dd" && n < designed) {
      t.design[r] = 1;
      n++;
    }
  }
  return id;
}

function mission(
  runner: GameRunner,
  owner: number,
  id: number,
  m: "lay_mines" | "sweep_mines" | "patrol",
): void {
  const navy = runner.game.worldWar()!.navy;
  expect(
    navy.issue(
      owner,
      { kind: "fleet_mission", fleet: id, mission: m, sr: CENTRAL },
      runner.game.ticks(),
    ),
  ).toBeNull();
  const f = navy.fleets.get(id)!;
  expect(f.docked).toBe(0);
}

/** The side's ships at sea in the central waters: [id, hp, vis] by id. */
function shipsAtSea(runner: GameRunner, owner: number): number[][] {
  const navy = runner.game.worldWar()!.navy;
  const t = navy.ships;
  const out: number[][] = [];
  for (const z of navy.scenario.sr(CENTRAL)!.members) {
    for (const fid of navy.fleetsIn(z)) {
      const f = navy.fleets.get(fid)!;
      if (f.docked !== 0 || f.owner !== owner) continue;
      for (const sid of f.ships) {
        const r = t.rowOf(sid);
        out.push([sid, t.hp[r], navy.shipStatsOf(r).vis]);
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** Test helper: the minefields as given (the foundation's index rebuilt). */
function setMines(d: WwDepth, rows: [number, number, number][]): void {
  d.sea.mines = rows;
  d.reindexSparse();
}

function hpOf(runner: GameRunner, ship: number): number {
  const t = runner.game.worldWar()!.navy.ships;
  return t.hp[t.rowOf(ship)];
}

/** The damage split the spec gives: by visibility, the rest to the first ship. */
function split(dmg: number, ships: number[][]): number[] {
  const vis = ships.reduce((a, s) => a + s[2], 0);
  const parts = ships.map((s) => Math.floor((dmg * s[2]) / vis));
  parts[0] += dmg - parts.reduce((a, b) => a + b, 0);
  return parts;
}

describe("World War 1936 P6: mines (spec §15.1)", () => {
  it("mines damage enemy ships and raise convoy losses", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    ddDesign(d, ITA, "mine_layer");
    // Two mine layers lay; a destroyer of the same fleet without the module does not.
    const layers = fleet(runner, ITA, DEEP.region.rome, 3, 2);
    mission(runner, ITA, layers, "lay_mines");
    const victims = fleet(runner, GBR, DEEP.region.malta, 2, 0, ["cl", 1]);
    mission(runner, GBR, victims, "patrol");
    seaRegionDay(d, CENTRAL, day);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(2 * 2_000);
    // A full field: yesterday's 1000 decays, the layers add theirs.
    setMines(d, [[CENTRAL, ww.land.sideOf(ITA), 1_000_000]]);
    const gbr = shipsAtSea(runner, GBR);
    const ita = shipsAtSea(runner, ITA);
    expect(gbr.length).toBe(3);
    seaRegionDay(d, CENTRAL, day + 1);
    const m = 1_000_000 - mineDecay(1_000_000) + 4_000;
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(m);
    expect(enemyMinesMilli(d, CENTRAL, GBR)).toBe(m);
    const total = gbr.reduce((a, s) => a + s[1], 0);
    const dmg = mineDamageMilli(total, m, false);
    expect(dmg).toBeGreaterThan(0);
    const parts = split(dmg, gbr);
    gbr.forEach((s, i) => expect(hpOf(runner, s[0])).toBe(s[1] - parts[i]));
    // The more visible cruiser takes more than a destroyer.
    const cl = gbr.findIndex((s) => s[2] === Math.max(...gbr.map((x) => x[2])));
    expect(parts[cl]).toBeGreaterThan(Math.min(...parts));
    // Italy's own mines spare its ships.
    ita.forEach((s) => expect(hpOf(runner, s[0])).toBe(s[1]));
    // Convoys and landings of Britain's side through the field.
    expect(minesConvoyLossPm(d, CENTRAL, GBR)).toBe(mineConvoyLossPm(m));
    expect(minesConvoyLossPm(d, CENTRAL, ww.land.sideOf(GBR))).toBe(99);
    expect(minesInvasionCutPct(d, CENTRAL, GBR)).toBe(mineInvasionCutPct(m));
    expect(minesInvasionCutPct(d, CENTRAL, GBR)).toBe(9);
    expect(minesConvoyLossPm(d, CENTRAL, ITA)).toBe(0);
    expect(minesInvasionCutPct(d, CENTRAL, ITA)).toBe(0);
    expect(minesConvoyLossPm(d, DEEP.sr.approaches, GBR)).toBe(0);
  });

  it("mine_warfare_2 lays and sweeps half again (research overhaul)", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    ddDesign(d, ITA, "mine_layer");
    mission(
      runner,
      ITA,
      fleet(runner, ITA, DEEP.region.rome, 3, 2),
      "lay_mines",
    );
    ww.economy.country(ITA)!.addTech("mine_warfare_2");
    seaRegionDay(d, CENTRAL, day);
    // 2 layers x 2000 a day, +50%.
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(2 * 3_000);
  });

  it("sweepers halve mine damage and clear enemy mines", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    ddDesign(d, GBR, "minesweep");
    const sweepers = fleet(runner, GBR, DEEP.region.malta, 2, 2);
    mission(runner, GBR, sweepers, "sweep_mines");
    const escorts = fleet(runner, GBR, DEEP.region.malta, 2, 0);
    mission(runner, GBR, escorts, "patrol");
    setMines(d, [[CENTRAL, ww.land.sideOf(ITA), 1_000_000]]);
    const gbr = shipsAtSea(runner, GBR);
    expect(gbr.length).toBe(4);
    seaRegionDay(d, CENTRAL, day);
    // Decay, then two sweeping destroyers clear 3 a day each.
    const m = 1_000_000 - 5_000 - 2 * 3_000;
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(m);
    const total = gbr.reduce((a, s) => a + s[1], 0);
    const half = mineDamageMilli(total, m, true);
    expect(half).toBe(Math.floor(mineDamageMilli(total, m, false) / 2));
    const parts = split(half, gbr);
    gbr.forEach((s, i) => expect(hpOf(runner, s[0])).toBe(s[1] - parts[i]));
    // A sweeper on another mission sweeps nothing (and halves nothing).
    mission(runner, GBR, sweepers, "patrol");
    const before = ownMinesMilli(d, CENTRAL, ITA);
    seaRegionDay(d, CENTRAL, day + 1);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(before - mineDecay(before));
    // A small field is swept clean and leaves the list.
    setMines(d, [[CENTRAL, ww.land.sideOf(ITA), 5_000]]);
    mission(runner, GBR, sweepers, "sweep_mines");
    seaRegionDay(d, CENTRAL, day + 2);
    expect(d.sea.mines).toEqual([]);
  });

  it("mines decay half a percent a day", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    const side = ww.land.sideOf(ITA);
    setMines(d, [[CENTRAL, side, 200_000]]);
    seaRegionDay(d, CENTRAL, day);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(199_000);
    seaRegionDay(d, CENTRAL, day + 1);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(198_005);
    // The game's own sea region day (P4 dailySeaRegion's hook): once a day.
    const perDay = dayStartTick(1, 0) - dayStartTick(0, 0);
    step(runner, perDay);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(198_005 - mineDecay(198_005));
    expect(d.sea.mines).toEqual([[CENTRAL, side, 197_015]]);
    // Below one unit a field does nothing (and would never decay): it goes.
    setMines(d, [[CENTRAL, side, 1_004]]);
    seaRegionDay(d, CENTRAL, day + 2);
    expect(d.sea.mines).toEqual([]);
    // Sorted by (region, side), one entry each.
    setMines(d, [
      [CENTRAL, side, 10_000],
      [DEEP.sr.approaches, side, 10_000],
    ]);
    seaRegionDay(d, CENTRAL, day + 3);
    expect(d.sea.mines.map((x) => x[0])).toEqual([DEEP.sr.approaches, CENTRAL]);
  });
  it("a dissolved faction's mines go to the side holding the region's ports", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    // A faction key no side has any more (dissolved).
    const gone = 100_000 + 77;
    expect(ww.land.sideMembers(gone)).toEqual([]);
    // Italy holds two of the Central Waters' three ports (Rome, Malta).
    takeRegion(runner.game, DEEP.region.malta, "ITA");
    setMines(d, [[CENTRAL, gone, 300_000]]);
    seaRegionDay(d, CENTRAL, day);
    const heir = ww.land.sideOf(ITA);
    expect(d.sea.mines).toEqual([
      [CENTRAL, heir, 300_000 - mineDecay(300_000)],
    ]);
    expect(d.mineAt(CENTRAL, heir)).toBe(0);
    expect(d.mineAt(CENTRAL, gone)).toBe(-1);
  });

  it("a minesweeper of a class that sweeps nothing still halves the damage", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const navy = ww.navy;
    const day = ww.day(runner.game.ticks());
    // A heavy cruiser carrying the sweep gear: no MINE_SWEEP_PER_DAY row.
    d.country(GBR)!.des.ship[1] = {
      def: {
        kind: "ship",
        base: "ca_1",
        modules: ["", "", "", "", "", "minesweep"],
        name: "Test CA",
      } as never,
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(GBR, "ship", 2);
    const ca = navy.createFleet(GBR, DEEP.region.malta, [["ca", 1, 1]]);
    for (const sid of navy.fleets.get(ca)!.ships) {
      navy.ships.design[navy.ships.rowOf(sid)] = 2;
    }
    mission(runner, GBR, ca, "sweep_mines");
    setMines(d, [[CENTRAL, ww.land.sideOf(ITA), 1_000_000]]);
    const gbr = shipsAtSea(runner, GBR);
    seaRegionDay(d, CENTRAL, day);
    // Nothing swept (decay only), but the damage is halved.
    const m = 1_000_000 - mineDecay(1_000_000);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(m);
    const total = gbr.reduce((a, x) => a + x[1], 0);
    const parts = split(mineDamageMilli(total, m, true), gbr);
    gbr.forEach((x, i) => expect(hpOf(runner, x[0])).toBe(x[1] - parts[i]));
  });

  it("every W2 field moves the hashes", async () => {
    const runner = await atWar();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const air = ww.air;
    const a = ww.land.sideOf(ITA);
    const b = ww.land.sideOf(GBR);
    const seen = new Set<number>([d.hash()]);
    const moved = () => {
      const h = d.hash();
      expect(seen.has(h)).toBe(false);
      seen.add(h);
    };
    // Minefields: the amount, the side and the region each count, the
    // list order does not.
    setMines(d, [[CENTRAL, a, 5_000]]);
    moved();
    setMines(d, [[CENTRAL, a, 6_000]]);
    moved();
    setMines(d, [[CENTRAL, b, 6_000]]);
    moved();
    setMines(d, [[DEEP.sr.approaches, b, 6_000]]);
    moved();
    setMines(d, [
      [DEEP.sr.approaches, b, 6_000],
      [CENTRAL, a, 1_000],
    ]);
    moved();
    const two = d.hash();
    setMines(d, [
      [CENTRAL, a, 1_000],
      [DEEP.sr.approaches, b, 6_000],
    ]);
    expect(d.hash()).toBe(two);
    // Recon rows: a row, its sorties, its side.
    d.sea.reconBySide = [[b, DEEP.sr.westLand, 20]];
    moved();
    d.sea.reconBySide = [[b, DEEP.sr.westLand, 21]];
    moved();
    d.sea.reconBySide = [[a, DEEP.sr.westLand, 21]];
    moved();
    // Aces: one, then its record.
    d.sea.aces = [{ id: 9, owner: GBR, deployment: 4, sinceDay: 1, callNo: 5 }];
    moved();
    d.sea.aces = [{ id: 9, owner: GBR, deployment: 5, sinceDay: 1, callNo: 6 }];
    moved();
    // The air war's hash: a deployment's night flag and its ace.
    const counts = [10, 0, 0];
    const dep = air.addDeployment({
      owner: GBR,
      sr: DEEP.sr.westLand,
      type: AIR_TYPES.indexOf("strat_bomber"),
      mission: AIR_MISSIONS.indexOf("strategic_bombing"),
      counts,
      target: 10,
      base: 0,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
    const airSeen = new Set<number>([air.hash()]);
    dep.night = true;
    expect(airSeen.has(air.hash())).toBe(false);
    airSeen.add(air.hash());
    dep.ace = 9;
    expect(airSeen.has(air.hash())).toBe(false);
  });
});

describe("World War 1936 P6: the AI's mines (spec §19.7)", () => {
  it("Britain lays mines in its home waters; Italy sweeps mined home waters, then sails home", async () => {
    // Both left to the AI: the order paths are the players'.
    const runner = await atWar([]);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const navy = ww.navy;
    const day = ww.day(runner.game.ticks());
    ddDesign(d, GBR, "mine_layer");
    const home = homeSeaRegions(d, GBR);
    expect(home.length).toBe(2);
    const mixed = fleet(runner, GBR, DEEP.region.london, 3, 2);
    const layerShips = navy.fleets.get(mixed)!.ships.filter((sid) => {
      const r = navy.ships.rowOf(sid);
      return navy.ships.design[r] === 1;
    });
    aiSeaAirDay(d, GBR, day);
    const minesF = navy
      .fleetsOf(GBR)
      .filter((f) => f.mission === FLEET_MISSIONS.indexOf("lay_mines"));
    expect(minesF.length).toBe(1);
    expect(minesF[0].ships).toEqual(layerShips);
    expect(minesF[0].missionSr).toBe(home[0]);
    expect(isDepthFleet(minesF[0])).toBe(true);
    // The rest of the fleet stays as it was.
    expect(navy.fleets.get(mixed)!.ships.length).toBe(1);
    // A second day changes nothing (one fleet a region; no more layers).
    aiSeaAirDay(d, GBR, day + 1);
    expect(
      navy
        .fleetsOf(GBR)
        .filter((f) => f.mission === FLEET_MISSIONS.indexOf("lay_mines"))
        .length,
    ).toBe(1);
    // Italy (no mining tradition) sweeps British mines off Rome.
    ddDesign(d, ITA, "minesweep");
    const itaHome = homeSeaRegions(d, ITA);
    const sweepers = fleet(runner, ITA, DEEP.region.rome, 2, 2);
    setMines(d, [[itaHome[0], ww.land.sideOf(GBR), 100_000]]);
    aiSeaAirDay(d, ITA, day);
    const f = navy.fleets.get(sweepers)!;
    expect(FLEET_MISSIONS[f.mission]).toBe("sweep_mines");
    expect(f.missionSr).toBe(itaHome[0]);
    // Swept clean: home again.
    setMines(d, []);
    aiSeaAirDay(d, ITA, day + 1);
    expect(FLEET_MISSIONS[navy.fleets.get(sweepers)!.mission]).toBe("hold");
  });
});
