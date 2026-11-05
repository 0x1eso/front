// World War 1936 (owner, 2026-11-05): generic equipment is clearly, reliably
// weaker than historical equipment. With the designer off, every generic number
// a country uses (a minor's planes, ships, tanks and gear, a major's leftover
// key or unmapped ship) is cut by one rule against the real entries of its type
// and generation: at most WEAK_MEDIAN_PCT of their median and below the weakest
// of them. Speed and range only follow the weakest, and only where the type's
// score counts them. A generation no entry has takes the nearest one's, and no
// number falls from one generation to the next: an earlier generation takes the
// later one's where that is lower, so new generic gear is never a step back.
//
// The rule reads the catalogue, so it follows new entries by itself, and it
// writes a separate scale: the shared generic numbers stay as they are, since
// catalogue gear is generic x percent, catalogue ships are percents over the
// class's generation-1 base, and a designer-on game uses them unchanged.
import type {
  AirType,
  PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  ShipClass,
  ShipStats,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { PlaneNumbers, planeScore, staticPlaneNumbers } from "../PlaneScore";
import { PLANE_BASE } from "../PlaneStats";
import { GEN_HP_PCT, shipStats } from "../ShipStats";
import { emptyStats } from "../Stats";
import { rowScore, STATIC_KEY_STATS } from "../TemplateStats";
import { histStatsOf } from "./Convert";
import { genOfTechs } from "./ConvertCost";
import { GearStats } from "./ConvertGear";
import { planeStatsOfEntry } from "./ConvertPlane";
import { shipPowerOf, shipStatsOfEntry } from "./ConvertShip";
import { tankStatsOfEntry } from "./ConvertTank";
import { HIST_ALL, HIST_CATALOGUE } from "./index";
import { histStaticEntry } from "./Slots";
import type { HistCountry, PlaneEntry, ShipEntry, TankEntry } from "./Types";

/** A generic number is at most this share of the real median. */
export const WEAK_MEDIAN_PCT = 70;
/** And at most this share of the weakest real entry. */
export const WEAK_BELOW_PCT = 95;

/** The number `generic` may keep against the real values of its group (zeros aside). */
function weakTarget(generic: number, real: readonly number[]): number {
  const pos = real.filter((v) => v > 0).sort((a, b) => a - b);
  if (pos.length === 0) return generic;
  const median = pos[Math.floor((pos.length - 1) / 2)];
  return Math.min(
    generic,
    Math.floor((median * WEAK_MEDIAN_PCT) / 100),
    Math.floor((pos[0] * WEAK_BELOW_PCT) / 100),
  );
}

/** Speed and range: no more than the slowest real entry. */
const slowest = (generic: number, real: readonly number[]): number =>
  Math.min(generic, ...real.filter((v) => v > 0));

/** The scale, per mille, that brings `generic` to `target`. */
const scalePm = (generic: number, target: number): number =>
  generic <= 0 ? 1000 : Math.floor((target * 1000) / generic);

/**
 * A real entry can have nothing in a number (a cruiser without torpedoes, an
 * armoured car without a gun), so the numbers alone don't settle it: the fight
 * numbers come down together until the score is below the weakest entry's.
 */
function pressUnder<K extends string>(
  t: Record<K, number>,
  fight: readonly K[],
  score: () => number,
  weakest: number,
): void {
  if (weakest === Infinity) return; // No entries at all: nothing to be under.
  for (let i = 0; i < 40 && score() >= weakest; i++) {
    for (const k of fight) t[k] = Math.floor((t[k] * 9) / 10);
  }
}

const pm = (v: number, s: number): number => Math.floor((v * s) / 1000);

/** The list of the generation nearest `gen` with any entries, the lower on a tie. */
function nearest<T>(lists: ReadonlyMap<number, T[]>, gen: number): T[] {
  for (let off = 0; off < 8; off++) {
    const low = lists.get(gen - off);
    if (low !== undefined) return low;
    const high = lists.get(gen + off);
    if (high !== undefined) return high;
  }
  return [];
}

function byGen<T>(
  list: readonly T[],
  genOf: (e: T) => number,
): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const e of list) {
    const g = genOf(e);
    const l = out.get(g);
    if (l === undefined) out.set(g, [e]);
    else l.push(e);
  }
  return out;
}

// ---- planes ----

/** The tech family of a plane type (a carrier type shares its land type's). */
const planeTechPrefix = (type: string): string =>
  type.startsWith("cv_") ? type.slice(3) : type;

const PLANE_GROUPS = new Map<string, Map<number, PlaneEntry[]>>();

/** The real planes a generic (type, gen) answers to. */
export function realPlanes(type: AirType, gen: number): readonly PlaneEntry[] {
  let g = PLANE_GROUPS.get(type);
  if (g === undefined) {
    const list = HIST_ALL.filter(
      (e): e is PlaneEntry => e.family === "plane" && e.type === type,
    );
    g = byGen(list, (e) => genOfTechs(e.techs, planeTechPrefix(type)));
    PLANE_GROUPS.set(type, g);
  }
  return nearest(g, gen);
}

const realNumbers = (e: PlaneEntry): PlaneNumbers => {
  const s = planeStatsOfEntry(e);
  return {
    airAtk: s.airAttack,
    airDef: s.airDefense,
    agility: s.agility,
    speed: s.speed,
    range: s.range,
    ground: s.ground,
    strat: s.strategic,
    naval: s.naval,
  };
};

const PLANE_FIGHT = [
  "airAtk",
  "airDef",
  "agility",
  "ground",
  "strat",
  "naval",
] as const;

type PlanePm = Record<keyof PlaneNumbers, number>;
const PLANE_PM = new Map<string, PlanePm>();

/** One generation's numbers after the rule, before the look at the next generation. */
function planeTarget(type: AirType, gen: number): PlaneNumbers {
  const generic = staticPlaneNumbers(type, gen);
  const real = realPlanes(type, gen).map(realNumbers);
  const col = (k: keyof PlaneNumbers) => real.map((n) => n[k]);
  const out = { ...generic };
  for (const k of PLANE_FIGHT) out[k] = weakTarget(generic[k], col(k));
  // Only the types whose score counts them; a fighter's reach is no strength.
  if (planeCountsSpeed(type)) out.speed = slowest(generic.speed, col("speed"));
  if (type === "transport_plane") {
    out.range = slowest(generic.range, col("range"));
  }
  pressUnder(
    out,
    PLANE_FIGHT,
    () => planeScore(type, out),
    Math.min(...real.map((n) => planeScore(type, n))),
  );
  return out;
}

function planePm(type: AirType, gen: number): PlanePm {
  const key = `${type}:${gen}`;
  const hit = PLANE_PM.get(key);
  if (hit !== undefined) return hit;
  const gens = EQUIPMENT_GENS[type];
  let next: PlaneNumbers | null = null;
  for (let g = gens; g >= 1; g--) {
    const generic = staticPlaneNumbers(type, g);
    const t: PlaneNumbers = planeTarget(type, g);
    const v = {} as PlanePm;
    for (const k of Object.keys(t) as (keyof PlaneNumbers)[]) {
      if (next !== null) t[k] = Math.min(t[k], next[k]);
      v[k] = scalePm(generic[k], t[k]);
    }
    PLANE_PM.set(`${type}:${g}`, v);
    next = t;
  }
  return PLANE_PM.get(key)!;
}

const planeCountsSpeed = (type: AirType): boolean =>
  ["fighter", "heavy_fighter", "cv_fighter", "cas", "cv_cas"].includes(type) ||
  type === "transport_plane";

/** A static plane's base numbers as generic use has them (PlaneScore's scale). */
export function weakPlaneNumbers(type: AirType, gen: number): PlaneNumbers {
  const n = staticPlaneNumbers(type, gen);
  const s = planePm(type, gen);
  return {
    airAtk: pm(n.airAtk, s.airAtk),
    airDef: pm(n.airDef, s.airDef),
    agility: pm(n.agility, s.agility),
    speed: pm(n.speed, s.speed),
    range: pm(n.range, s.range),
    ground: pm(n.ground, s.ground),
    strat: pm(n.strat, s.strat),
    naval: pm(n.naval, s.naval),
  };
}

/** staticPlaneScore for generic use. */
export function weakStaticPlaneScore(type: AirType, gen: number): number {
  return planeScore(type, weakPlaneNumbers(type, gen));
}

/** planeStats (country percents and all) cut for generic use. */
export function weakPlaneStats(
  st: PlaneStats,
  type: AirType,
  gen: number,
): PlaneStats {
  const s = planePm(type, gen);
  const airAtk = pm(st.airAtk, s.airAtk);
  const airDef = pm(st.airDef, s.airDef);
  return {
    ...st,
    airAtk,
    airDef,
    agility: pm(st.agility, s.agility),
    speedKmh: pm(st.speedKmh, s.speed),
    rangeKm: pm(st.rangeKm, s.range),
    ground: pm(st.ground, s.ground),
    strat: pm(st.strat, s.strat),
    naval: pm(st.naval, s.naval),
    supWeightMilli: PLANE_BASE[type].fighter
      ? Math.floor((airAtk + airDef) / 3)
      : st.supWeightMilli,
  };
}

// ---- ships ----

const SHIP_GROUPS = new Map<string, Map<number, ShipEntry[]>>();

/** The real ships a generic (class, gen) answers to. */
export function realShips(cls: ShipClass, gen: number): readonly ShipEntry[] {
  let g = SHIP_GROUPS.get(cls);
  if (g === undefined) {
    const list = HIST_ALL.filter(
      (e): e is ShipEntry => e.family === "ship" && e.cls === cls,
    );
    g = byGen(list, (e) => genOfTechs(e.techs, cls));
    SHIP_GROUPS.set(cls, g);
  }
  return nearest(g, gen);
}

const SHIP_FIGHT = [
  "hpMilli",
  "light",
  "lightPierce",
  "heavy",
  "heavyPierce",
  "torpedo",
  "depth",
  "armor",
  "aa",
] as const;
type ShipPm = Record<(typeof SHIP_FIGHT)[number] | "speedCentiKn", number>;
const SHIP_PM = new Map<string, ShipPm>();
const NO_TECHS: ReadonlySet<never> = new Set();

function shipPm(cls: ShipClass, gen: number): ShipPm {
  const key = `${cls}:${gen}`;
  const hit = SHIP_PM.get(key);
  if (hit !== undefined) return hit;
  let next: ShipPm | null = null;
  for (let g = GEN_HP_PCT.length; g >= 1; g--) {
    const generic = shipStats(cls, g, emptyStats(), NO_TECHS);
    const real = realShips(cls, g).map(shipStatsOfEntry);
    const t = {
      speedCentiKn: slowest(
        generic.speedCentiKn,
        real.map((s) => s.speedCentiKn),
      ),
    } as ShipPm;
    for (const k of SHIP_FIGHT) {
      t[k] = weakTarget(
        generic[k],
        real.map((s) => s[k]),
      );
    }
    pressUnder(
      t,
      SHIP_FIGHT,
      () => shipPowerOf({ ...generic, ...t }),
      Math.min(...real.map(shipPowerOf)),
    );
    const v = {} as ShipPm;
    for (const k of Object.keys(t) as (keyof ShipPm)[]) {
      if (next !== null) t[k] = Math.min(t[k], next[k]);
      v[k] = scalePm(generic[k], t[k]);
    }
    SHIP_PM.set(`${cls}:${g}`, v);
    next = t;
  }
  return SHIP_PM.get(key)!;
}

/** shipStats (country percents and techs) cut for generic use. Costs stay. */
export function weakShipStats(
  st: ShipStats,
  cls: ShipClass,
  gen: number,
): ShipStats {
  const s = shipPm(cls, gen);
  const out = { ...st, speedCentiKn: pm(st.speedCentiKn, s.speedCentiKn) };
  for (const k of SHIP_FIGHT) out[k] = pm(st[k], s[k]);
  return out;
}

/** The power of a generic ship with no country stats, on the real ships' scale. */
export function weakShipPower(cls: ShipClass, gen: number): number {
  return shipPowerOf(
    weakShipStats(shipStats(cls, gen, emptyStats(), NO_TECHS), cls, gen),
  );
}

// ---- tanks and gear (the static key rows) ----

const GEAR_ROW = [KS.soft, KS.hard, KS.def, KS.brk, KS.aa] as const;
const TANK_ROW = [
  KS.soft,
  KS.hard,
  KS.def,
  KS.brk,
  KS.pierce,
  KS.armor,
  KS.aa,
] as const;

/** Each country's gear entry standing in for a key (a generation with none: the one before it). */
function gearOfKey(type: string, gen: number): GearStats[] {
  const out: GearStats[] = [];
  for (const c of Object.keys(HIST_CATALOGUE) as HistCountry[]) {
    for (let g = gen; g >= 1; g--) {
      const e = histStaticEntry(c, type, g);
      if (e === undefined) continue;
      if (
        e.family === "infantry" ||
        e.family === "support" ||
        e.family === "gun"
      ) {
        out.push(histStatsOf(e) as GearStats);
      }
      break;
    }
  }
  return out;
}

/** The real tanks a static tank key answers to. */
export function realTanks(type: string, gen: number): readonly TankEntry[] {
  const role = type === "light_tank" ? "light" : "medium";
  const list = HIST_ALL.filter(
    (e): e is TankEntry => e.family === "tank" && e.role === role,
  );
  return nearest(
    byGen(list, (e) => genOfTechs(e.techs, type)),
    gen,
  );
}

/** One static key's target per field (empty for a key with no real entries). */
function keyTarget(j: number): Map<number, number> {
  const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
  const g = STATIC_KEY_STATS.stats;
  const o = j * KS_FIELDS;
  const row = new Map<number, number>();
  if (type === "light_tank" || type === "medium_tank") {
    const real = realTanks(type, gen).map(tankStatsOfEntry);
    const cols: Record<number, number[]> = {
      [KS.soft]: real.map((s) => s.soft),
      [KS.hard]: real.map((s) => s.hard),
      [KS.def]: real.map((s) => s.def),
      [KS.brk]: real.map((s) => s.brk),
      [KS.pierce]: real.map((s) => s.pierce),
      [KS.armor]: real.map((s) => s.armor),
      [KS.aa]: real.map((s) => s.aa),
    };
    const t: Record<number, number> = {};
    const keys = TANK_ROW.map(String);
    for (const f of TANK_ROW) t[f] = weakTarget(g[o + f], cols[f]);
    const scoreOf = (at: (f: number) => number): number => {
      const one = new Int32Array(KS_FIELDS);
      for (const f of TANK_ROW) one[f] = at(f);
      const { group, year } = STATIC_KEY_STATS;
      return rowScore(one, 0, group[j], year[j]);
    };
    pressUnder(
      t,
      keys,
      () => scoreOf((f) => t[f]),
      Math.min(...real.map((_, i) => scoreOf((f) => cols[f][i]))),
    );
    for (const f of TANK_ROW) row.set(f, t[f]);
    return row;
  }
  const gear = gearOfKey(type, gen);
  if (gear.length === 0) return row;
  // Catalogue gear is the generic row x its percent: the rule on the percent.
  const pct = weakTarget(
    100,
    gear.map((x) => x.statPct),
  );
  for (const f of GEAR_ROW) row.set(f, Math.floor((g[o + f] * pct) / 100));
  const pierce = gear.map((x) => x.pierceCenti).filter((v) => v > 0);
  row.set(
    KS.pierce,
    pierce.length > 0
      ? weakTarget(g[o + KS.pierce], pierce)
      : Math.floor((g[o + KS.pierce] * pct) / 100),
  );
  return row;
}

/** Per static slot: field → the number generic use has. */
let KEY_ROWS: Map<number, number>[] | undefined;

function keyRows(): Map<number, number>[] {
  if (KEY_ROWS !== undefined) return KEY_ROWS;
  const out: Map<number, number>[] = [];
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) out.push(keyTarget(j));
  // Static slots run type by type, the generations rising.
  for (let j = GROUND_STATIC_SLOTS - 2; j >= 0; j--) {
    const [type] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
    if (EQUIP_KEYS[GROUND_EQUIP_KEYS[j + 1]][0] !== type) continue;
    for (const [f, v] of out[j]) {
      out[j].set(f, Math.min(v, out[j + 1].get(f) ?? v));
    }
  }
  KEY_ROWS = out;
  return out;
}

/** Writes the generic use of static slot `j` into a table's row. */
export function weakKeyRow(
  t: {
    stats: Int32Array;
    score: Int32Array;
    group: Int8Array;
    year: Int16Array;
  },
  j: number,
): void {
  const row = keyRows()[j];
  if (row === undefined || row.size === 0) return;
  const o = j * KS_FIELDS;
  for (const [f, v] of row) t.stats[o + f] = v;
  t.score[j] = rowScore(t.stats, j, t.group[j], t.year[j]);
}
