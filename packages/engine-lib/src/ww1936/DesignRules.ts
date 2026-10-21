// World War 1936 P6 — the designers' pure rules (P6 spec §5; plan decisions
// 6, 10, 11). The tank numbers, roles, costs, checks, experience and
// conversion are the foundation's; lane E (Task 3) refines the ship and
// plane conversion to P4 and the recommended fits. The engine, the AI and
// the designer screen call the same functions (Review Focus 2).
import {
  DesignDef,
  DesignKind,
  DS_AMPHIBIOUS,
  DS_CARGO,
  DS_CARRIER,
  DS_FLAIL,
  DS_FLAME,
  DS_JET,
  DS_MINE_LAYER,
  DS_MINESWEEP,
  DS_RADAR,
  DS_RECON,
  DS_SKIRTS,
  DS_TD_DEFEND,
  PlaneDesignStats,
  ShipDesignMods,
  SPECIAL_PROJECTS,
  SpecialProject,
  TankDesignStats,
  TankRole,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_TYPES,
  RESOURCE_IDS,
  ResourceId,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NG_HEAVY,
  NG_SPA,
  NG_SPAA,
  NG_TD,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  SHIP_CLASSES,
  SHIP_GENS,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_TECHS } from "./WwTechs";

export interface DesignCtx {
  techs: ReadonlySet<WwTechId>;
  /** Bit i: SPECIAL_PROJECTS[i] done. */
  projects: number;
  /** MIO reliability for this design's family, percentage points (plan decision 11). */
  relPp: number;
  /** MIO cost for this design's family, percent. */
  costPct: number;
}
export interface DesignBlockCtx {
  techs: ReadonlySet<WwTechId>;
  projects: number;
  treatyMember: boolean;
  treatyEscalated: boolean;
}
/** The project bit of SPECIAL_PROJECTS (DesignCtx.projects). */
export const projectBit = (p: SpecialProject) =>
  1 << SPECIAL_PROJECTS.indexOf(p);
const res = (r: Partial<Record<ResourceId, number>>) =>
  RESOURCE_IDS.map((id) => r[id] ?? 0);
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const mul = (v: number, pct: number) =>
  Math.floor((v * (100 + Math.max(-90, pct))) / 100);

// ---------------------------------------------------------------- tanks (spec §5.2)
type Weight = "light" | "medium" | "heavy";
interface TankBaseDef {
  tech: WwTechId;
  weight: Weight;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  hardnessPm: number;
  speedCenti: number;
  relPm: number;
  costMilli: number;
  res: number[];
  specials: 1 | 2;
}
const tb = (
  tech: WwTechId,
  weight: Weight,
  s: number,
  h: number,
  d: number,
  b: number,
  a: number,
  hard: number,
  sp: number,
  rel: number,
  cost: number,
  r: Partial<Record<ResourceId, number>>,
  specials: 1 | 2,
): TankBaseDef => ({
  tech,
  weight,
  soft: s * 100,
  hard: h * 100,
  def: d * 100,
  brk: b * 100,
  armor: a * 100,
  hardnessPm: hard * 10,
  speedCenti: Math.round(sp * 100),
  relPm: rel * 10,
  costMilli: Math.round(cost * 1000),
  res: res(r),
  specials,
});
export const TANK_BASE_DEFS: Readonly<Record<string, TankBaseDef>> = {
  light_1: tb(
    "light_tank_1",
    "light",
    4,
    1,
    4,
    18,
    10,
    80,
    8,
    85,
    7.5,
    { steel: 1, oil: 1 },
    1,
  ),
  light_2: tb(
    "light_tank_2",
    "light",
    4,
    1,
    4,
    20,
    14,
    80,
    9,
    85,
    8,
    { steel: 1, oil: 1 },
    2,
  ),
  medium_1: tb(
    "medium_tank_1",
    "medium",
    6,
    4,
    5,
    24,
    32,
    90,
    6,
    80,
    11,
    { steel: 2, oil: 1 },
    2,
  ),
  medium_2: tb(
    "medium_tank_2",
    "medium",
    6,
    4,
    6,
    27,
    40,
    90,
    6.5,
    82,
    12,
    { steel: 2, oil: 1 },
    2,
  ),
  medium_3: tb(
    "medium_tank_3",
    "medium",
    7,
    5,
    7,
    30,
    48,
    92,
    7,
    85,
    13,
    { steel: 2, oil: 1 },
    2,
  ),
  heavy_1: tb(
    "heavy_tank_1",
    "heavy",
    8,
    5,
    9,
    24,
    60,
    95,
    4,
    70,
    16,
    { steel: 3, chromium: 1, oil: 1 },
    2,
  ),
  heavy_2: tb(
    "heavy_tank_2",
    "heavy",
    8,
    5,
    10,
    28,
    80,
    95,
    4.5,
    72,
    18,
    { steel: 3, chromium: 1, oil: 1 },
    2,
  ),
  heavy_3: tb(
    "heavy_tank_3",
    "heavy",
    9,
    6,
    11,
    32,
    100,
    96,
    5,
    75,
    20,
    { steel: 3, chromium: 1, oil: 1 },
    2,
  ),
};
/** Slot kinds of a chassis: gun, turret, suspension, armor, engine, special × (1 or 2). */
export function tankSlots(base: string): string[] {
  const b = TANK_BASE_DEFS[base];
  return [
    "gun",
    "turret",
    "suspension",
    "armor",
    "engine",
    ...(b?.specials === 1 ? ["special"] : ["special", "special"]),
  ];
}
/** "" in a non-special slot means this module (spec §5.2.2 "기본"). */
export function tankDefault(base: string, slot: number): string {
  const w = TANK_BASE_DEFS[base]?.weight;
  return (
    [
      w === "light" ? "auto20" : "gun_cs",
      base === "light_1" ? "turret_1" : "turret_2",
      "bogie",
      base === "light_1" ? "riveted" : "welded",
      "petrol",
    ][slot] ?? ""
  );
}
interface TankModDef {
  slot: string;
  tech?: WwTechId;
  weights?: readonly Weight[];
  bases?: readonly string[];
  add?: {
    soft?: number;
    hard?: number;
    pierce?: number;
    brk?: number;
    def?: number;
    aa?: number;
  };
  pct?: {
    soft?: number;
    hard?: number;
    brk?: number;
    def?: number;
    armor?: number;
    speed?: number;
  };
  relPp?: number;
  fuelPct?: number;
  org?: number;
  costMilli?: number;
  costPct?: number;
  extra?: Partial<Record<ResourceId, number>>;
  flags?: number;
}
const MH: readonly Weight[] = ["medium", "heavy"];
const LM: readonly Weight[] = ["light", "medium"];
const NOT_L1 = [
  "light_2",
  "medium_1",
  "medium_2",
  "medium_3",
  "heavy_1",
  "heavy_2",
  "heavy_3",
];
export const TANK_MODULE_DEFS: Readonly<Record<string, TankModDef>> = {
  mg: {
    slot: "gun",
    add: { soft: 6, hard: 1, pierce: 5, brk: 2 },
    costMilli: 300,
  },
  auto20: {
    slot: "gun",
    add: { soft: 8, hard: 3, pierce: 15, brk: 6 },
    costMilli: 500,
  },
  gun_small: {
    slot: "gun",
    tech: "anti_tank_1",
    add: { soft: 6, hard: 8, pierce: 35, brk: 6 },
    costMilli: 1_000,
  },
  gun_cs: {
    slot: "gun",
    tech: "artillery_1",
    weights: MH,
    add: { soft: 14, hard: 6, pierce: 30, brk: 8 },
    costMilli: 1_500,
  },
  gun_hv: {
    slot: "gun",
    tech: "tank_gun_2",
    bases: NOT_L1,
    add: { soft: 10, hard: 14, pierce: 62, brk: 8 },
    costMilli: 2_500,
    extra: { tungsten: 1 },
  },
  gun_heavy: {
    slot: "gun",
    tech: "tank_gun_3",
    bases: ["medium_2", "medium_3", "heavy_1", "heavy_2", "heavy_3"],
    add: { soft: 12, hard: 20, pierce: 92, brk: 8 },
    costMilli: 4_000,
    extra: { tungsten: 1 },
  },
  flame: {
    slot: "gun",
    tech: "flame_tank",
    add: { soft: 14, pierce: 2, brk: 10 },
    costMilli: 1_200,
    flags: DS_FLAME,
  },
  howitzer: {
    slot: "gun",
    tech: "artillery_2",
    add: { soft: 24, hard: 3, pierce: 15, def: 2 },
    costMilli: 3_000,
  },
  aa_auto: {
    slot: "gun",
    tech: "anti_air_1",
    add: { soft: 3, hard: 3, pierce: 15, aa: 18 },
    costMilli: 1_500,
  },
  turret_none: { slot: "turret", pct: { hard: 15, brk: -30 }, costPct: -15 },
  turret_open: { slot: "turret", pct: { soft: 5, armor: -20 }, costPct: -10 },
  turret_1: { slot: "turret", pct: { brk: -10 } },
  turret_2: { slot: "turret", bases: NOT_L1, costMilli: 300 },
  turret_3: {
    slot: "turret",
    weights: MH,
    pct: { soft: 5, brk: 10 },
    costMilli: 600,
  },
  bogie: { slot: "suspension" },
  christie: {
    slot: "suspension",
    weights: LM,
    pct: { speed: 15 },
    relPp: -5,
    costMilli: 300,
  },
  torsion: {
    slot: "suspension",
    tech: "torsion_bar",
    pct: { speed: 5 },
    relPp: 5,
    costMilli: 500,
  },
  interleaved: {
    slot: "suspension",
    tech: "interleaved_wheels",
    weights: MH,
    pct: { armor: 5, speed: 5 },
    relPp: -10,
    costMilli: 800,
  },
  riveted: { slot: "armor", pct: { armor: -10 }, costMilli: -400 },
  welded: { slot: "armor" },
  cast: {
    slot: "armor",
    tech: "cast_armor",
    pct: { armor: 10 },
    costMilli: 800,
    extra: { chromium: 1 },
  },
  petrol: { slot: "engine" },
  diesel: {
    slot: "engine",
    tech: "diesel_engine",
    relPp: 5,
    fuelPct: -25,
    costMilli: 300,
  },
  radio: {
    slot: "special",
    tech: "tank_radio",
    pct: { brk: 8 },
    org: 2,
    costMilli: 300,
  },
  sloped: {
    slot: "special",
    tech: "sloped_armor",
    pct: { armor: 15 },
    costMilli: 800,
  },
  aux_mg: { slot: "special", add: { soft: 2 }, costMilli: 200 },
  smoke: { slot: "special", pct: { def: 10 }, costMilli: 200 },
  skirts: {
    slot: "special",
    tech: "sloped_armor",
    pct: { speed: -3 },
    costMilli: 300,
    flags: DS_SKIRTS,
  },
  amphibious: {
    slot: "special",
    tech: "amphibious_drive",
    pct: { speed: -10 },
    costMilli: 1_000,
    flags: DS_AMPHIBIOUS,
  },
  flail: {
    slot: "special",
    tech: "engineer_company",
    pct: { speed: -10 },
    costMilli: 500,
    flags: DS_FLAIL,
  },
};
/** Modules with "" replaced by the chassis defaults (specials stay ""). */
export function resolvedModules(def: DesignDef): string[] {
  if (def.kind !== "tank") return [...def.modules];
  return def.modules.map((m, i) => (m === "" ? tankDefault(def.base, i) : m));
}
export function tankRole(def: DesignDef): TankRole {
  const m = resolvedModules(def);
  if (m[0] === "howitzer") return "sp_artillery";
  if (m[0] === "aa_auto") return "sp_anti_air";
  if (
    m[1] === "turret_none" &&
    (m[0] === "gun_small" || m[0] === "gun_hv" || m[0] === "gun_heavy")
  ) {
    return "tank_destroyer";
  }
  return "tank";
}
/** Plan decision 6. */
export function designNeedGroup(def: DesignDef): number {
  const role = tankRole(def);
  if (role === "tank_destroyer") return NG_TD;
  if (role === "sp_artillery") return NG_SPA;
  if (role === "sp_anti_air") return NG_SPAA;
  const w = TANK_BASE_DEFS[def.base].weight;
  return w === "light"
    ? EQUIPMENT_TYPES.indexOf("light_tank")
    : w === "medium"
      ? EQUIPMENT_TYPES.indexOf("medium_tank")
      : NG_HEAVY;
}
export function tankStats(def: DesignDef, ctx: DesignCtx): TankDesignStats {
  const b = TANK_BASE_DEFS[def.base];
  const add = {
    soft: b.soft,
    hard: b.hard,
    pierce: 0,
    brk: b.brk,
    def: b.def,
    aa: 0,
  };
  const pct = {
    soft: 0,
    hard: 0,
    brk: 0,
    def: 0,
    armor: 0,
    speed: 0,
    pierce: 0,
  };
  let rel = b.relPm + ctx.relPp * 10;
  let fuel = 0;
  let org = 0;
  let cost = b.costMilli;
  let costPct = 0;
  let flags = 0;
  const r = [...b.res];
  for (const id of resolvedModules(def)) {
    if (id === "") continue;
    const m = TANK_MODULE_DEFS[id];
    for (const [k, v] of Object.entries(m.add ?? {})) {
      add[k as keyof typeof add] += v * 100;
    }
    for (const [k, v] of Object.entries(m.pct ?? {})) {
      pct[k as keyof typeof pct] += v;
    }
    rel += (m.relPp ?? 0) * 10;
    fuel += m.fuelPct ?? 0;
    org += m.org ?? 0;
    cost += m.costMilli ?? 0;
    costPct += m.costPct ?? 0;
    flags |= m.flags ?? 0;
    for (const [k, v] of Object.entries(m.extra ?? {})) {
      r[RESOURCE_IDS.indexOf(k as ResourceId)] += v;
    }
  }
  const role = tankRole(def);
  if (role === "tank_destroyer") {
    pct.hard += 20;
    pct.pierce += 10;
    flags |= DS_TD_DEFEND;
  }
  const aL = def.armorLevel ?? 0;
  const eL = def.engineLevel ?? 0;
  const armorLvl = 6 * aL;
  const speedLvl = -2 * aL + 4 * eL;
  const costLvl = 3 * aL + 2 * eL;
  const relLvl = -5 * aL - 10 * eL;
  return {
    kind: "tank",
    role,
    group: designNeedGroup(def),
    soft: mul(add.soft, pct.soft),
    hard: mul(add.hard, pct.hard),
    def: mul(add.def, pct.def),
    brk: mul(add.brk, pct.brk),
    pierce: mul(add.pierce, pct.pierce),
    aa: add.aa,
    // P2 reads armour only against pierce: the skirts' +4 count there.
    armor:
      mul(mul(b.armor, pct.armor), armorLvl) +
      ((flags & DS_SKIRTS) !== 0 ? 400 : 0),
    hardnessPm: b.hardnessPm,
    speedCenti: mul(mul(b.speedCenti, pct.speed), speedLvl),
    relPm: clamp(rel + relLvl, 400, 990),
    orgAdd: org,
    fuelPct: fuel + 5 * eL,
    costMilli: mul(mul(mul(cost, costPct), costLvl), ctx.costPct),
    resources: r,
    flags,
    year: WW_TECHS[b.tech].year,
  };
}

// ---------------------------------------------------------------- ships (spec §5.3)
export const SHIP_CLASS_SLOTS: Readonly<Record<ShipClass, readonly string[]>> =
  {
    dd: ["torpedo", "asw", "secondary", "special"],
    cl: ["main", "secondary", "torpedo", "fire_control", "special"],
    ca: ["main", "secondary", "torpedo", "fire_control", "armor", "engine"],
    bc: ["main", "secondary", "fire_control", "armor", "engine", "special"],
    bb: ["main", "secondary", "fire_control", "armor", "engine", "special"],
    cv: ["hangar", "secondary", "armor", "fire_control", "engine"],
    ss: ["torpedo", "engine", "special"],
  };
interface ShipModDef {
  slot: string;
  classes: readonly ShipClass[];
  tech?: WwTechId;
  project?: SpecialProject;
  gens?: readonly number[];
  /** "main" scales light for a CL, heavy for CA/BC/BB (plan: the CL main battery is light). */
  m: Partial<Omit<ShipDesignMods, "kind" | "flags" | "year" | "costPct">> & {
    mainPct?: number;
  };
  costPct: number;
  flags?: number;
}
const CAP: readonly ShipClass[] = ["cl", "ca", "bc", "bb"];
export const SHIP_MODULE_DEFS: Readonly<Record<string, ShipModDef>> = {
  main_heavy: {
    slot: "main",
    classes: CAP,
    m: { mainPct: 20, piercePct: 10, speedCentiKn: -100 },
    costPct: 10,
  },
  main_light: {
    slot: "main",
    classes: CAP,
    m: { mainPct: -20, speedCentiKn: 100 },
    costPct: -10,
  },
  sec_dp: {
    slot: "secondary",
    classes: ["cl", "ca", "bc", "bb", "cv", "dd"],
    tech: "dual_purpose_guns",
    m: { aaPct: 40, lightPct: 10 },
    costPct: 6,
  },
  sec_aa: {
    slot: "secondary",
    classes: ["dd", "cl", "ca", "bc", "bb", "cv"],
    m: { aaPct: 60, lightPct: -10 },
    costPct: 5,
  },
  sec_light: {
    slot: "secondary",
    classes: ["ca", "bc", "bb"],
    m: { lightPct: 25, aaPct: -20 },
    costPct: 5,
  },
  torp_none: {
    slot: "torpedo",
    classes: ["dd", "cl", "ca"],
    m: { torpedoPct: -100 },
    costPct: -8,
  },
  torp_heavy: {
    slot: "torpedo",
    classes: ["dd", "cl", "ca", "ss"],
    tech: "torpedo_1",
    m: { torpedoPct: 40 },
    costPct: 8,
  },
  asw_sonar: {
    slot: "asw",
    classes: ["dd", "cl"],
    tech: "sonar_1",
    m: { subDetectPct: 30, depthPct: 15 },
    costPct: 6,
  },
  asw_dc_heavy: {
    slot: "asw",
    classes: ["dd"],
    m: { depthPct: 40, torpedoPct: -25 },
    costPct: 4,
  },
  fc_improved: {
    slot: "fire_control",
    classes: CAP,
    tech: "fire_control_1",
    m: { hitPct: 6 },
    costPct: 5,
  },
  radar_surface: {
    slot: "fire_control",
    classes: [...CAP, "cv"],
    tech: "naval_radar_1",
    m: { surfDetectPct: 20, hitPct: 5 },
    costPct: 6,
  },
  radar_adv: {
    slot: "fire_control",
    classes: [...CAP, "cv"],
    tech: "naval_radar_2",
    m: { surfDetectPct: 35, subDetectPct: 10, hitPct: 8 },
    costPct: 9,
  },
  radar_microwave: {
    slot: "fire_control",
    classes: [...CAP, "cv", "dd"],
    project: "sp_cavity_magnetron",
    m: { surfDetectPct: 50, hitPct: 12, aaPct: 10 },
    costPct: 12,
  },
  armor_heavy: {
    slot: "armor",
    classes: CAP,
    m: { armorPct: 15, hpPct: 5, speedCentiKn: -150 },
    costPct: 10,
  },
  armor_light: {
    slot: "armor",
    classes: CAP,
    m: { armorPct: -15, speedCentiKn: 150 },
    costPct: -8,
  },
  armor_deck: {
    slot: "armor",
    classes: ["cv"],
    tech: "armored_deck",
    m: { damageTakenPct: -25, deckPct: -15 },
    costPct: 12,
  },
  engine_fast: {
    slot: "engine",
    classes: ["ca", "bc", "bb", "cv"],
    m: { speedCentiKn: 200, rangePct: -10, fuelPct: 15 },
    costPct: 8,
  },
  engine_long: {
    slot: "engine",
    classes: ["ca", "bc", "bb", "cv", "ss"],
    m: { rangePct: 30, speedCentiKn: -100 },
    costPct: 4,
  },
  hangar_large: {
    slot: "hangar",
    classes: ["cv"],
    m: { deckPct: 25, hpPct: -5 },
    costPct: 10,
  },
  hangar_small: {
    slot: "hangar",
    classes: ["cv"],
    m: { deckPct: -25 },
    costPct: -15,
  },
  mine_layer: {
    slot: "special",
    classes: ["dd", "cl", "ss"],
    tech: "mine_warfare_1",
    m: { torpedoPct: -20 },
    costPct: 4,
    flags: DS_MINE_LAYER,
  },
  minesweep: {
    slot: "special",
    classes: ["dd", "cl"],
    tech: "mine_warfare_1",
    m: {},
    costPct: 3,
    flags: DS_MINESWEEP,
  },
  floatplane: {
    slot: "special",
    classes: CAP,
    m: { surfDetectPct: 15 },
    costPct: 3,
  },
  snorkel: {
    slot: "special",
    classes: ["ss"],
    tech: "snorkel",
    m: { visPct: -25, speedCentiKn: 100 },
    costPct: 8,
  },
  shbb_hull: {
    slot: "special",
    classes: ["bb"],
    gens: [3, 4],
    tech: "super_heavy_battleship",
    m: {
      hpPct: 40,
      heavyPct: 30,
      piercePct: 15,
      armorPct: 25,
      speedCentiKn: -400,
      visPct: 20,
    },
    costPct: 60,
  },
};
export function shipBase(base: string): { cls: ShipClass; gen: number } | null {
  const [c, g] = base.split("_");
  const cls = c as ShipClass;
  const gen = Number(g);
  return SHIP_CLASSES.includes(cls) &&
    Number.isInteger(gen) &&
    gen >= 1 &&
    gen <= SHIP_GENS[cls]
    ? { cls, gen }
    : null;
}
/** The year of a ship class generation: the year of its P4 tech (gen 1 = 1936). */
export function shipYear(cls: ShipClass, gen: number): number {
  return gen === 1
    ? 1936
    : (WW_TECHS[`${cls}_${gen}` as WwTechId]?.year ?? 1936);
}
export function shipDesignMods(def: DesignDef): ShipDesignMods {
  const { cls, gen } = shipBase(def.base)!;
  const o: ShipDesignMods = {
    kind: "ship",
    lightPct: 0,
    heavyPct: 0,
    torpedoPct: 0,
    depthPct: 0,
    aaPct: 0,
    armorPct: 0,
    hpPct: 0,
    piercePct: 0,
    deckPct: 0,
    damageTakenPct: 0,
    surfDetectPct: 0,
    subDetectPct: 0,
    visPct: 0,
    rangePct: 0,
    fuelPct: 0,
    hitPct: 0,
    speedCentiKn: 0,
    costPct: 0,
    flags: 0,
    year: shipYear(cls, gen),
  };
  for (const id of def.modules) {
    if (id === "") continue;
    const m = SHIP_MODULE_DEFS[id];
    for (const [k, v] of Object.entries(m.m)) {
      if (k === "mainPct") {
        if (cls === "cl") o.lightPct += v;
        else o.heavyPct += v;
      } else (o as unknown as Record<string, number>)[k] += v;
    }
    o.costPct += m.costPct;
    o.flags |= m.flags ?? 0;
  }
  return o;
}
/** P4 ShipStats field names (plan decision 1: grep `export interface ShipStats`). */
export interface ShipStatsLike {
  hpMilli: number;
  light: number;
  lightPierce: number;
  heavy: number;
  heavyPierce: number;
  torpedo: number;
  depth: number;
  armor: number;
  aa: number;
  speedCentiKn: number;
  rangeKm: number;
  vis: number;
  surfDetect: number;
  subDetect: number;
  deck: number;
  fuelPerDayMilli: number;
  cost: number;
}
export function applyShipDesign<T extends ShipStatsLike>(
  s: T,
  m: ShipDesignMods | null,
): T {
  if (m === null) return s;
  return {
    ...s,
    hpMilli: mul(s.hpMilli, m.hpPct),
    light: mul(s.light, m.lightPct),
    heavy: mul(s.heavy, m.heavyPct),
    lightPierce: mul(s.lightPierce, m.piercePct),
    heavyPierce: mul(s.heavyPierce, m.piercePct),
    torpedo: mul(s.torpedo, m.torpedoPct),
    depth: mul(s.depth, m.depthPct),
    armor: mul(s.armor, m.armorPct),
    aa: mul(s.aa, m.aaPct),
    speedCentiKn: Math.max(100, s.speedCentiKn + m.speedCentiKn),
    rangeKm: mul(s.rangeKm, m.rangePct),
    vis: mul(s.vis, m.visPct),
    surfDetect: mul(s.surfDetect, m.surfDetectPct),
    subDetect: mul(s.subDetect, m.subDetectPct),
    deck: mul(s.deck, m.deckPct),
    fuelPerDayMilli: mul(s.fuelPerDayMilli, m.fuelPct),
    cost: mul(s.cost, m.costPct),
  };
}

// ---------------------------------------------------------------- planes (spec §5.4)
type Size = "small" | "medium" | "large";
interface PlaneBaseDef {
  tech?: WwTechId;
  project?: SpecialProject;
  size: Size;
  agility: number;
  speed: number;
  range: number;
  airDef: number;
  relPm: number;
  costMilli: number;
  res: number[];
}
const pb = (
  tech: WwTechId | null,
  size: Size,
  ag: number,
  sp: number,
  rg: number,
  ad: number,
  rel: number,
  cost: number,
  r: Partial<Record<ResourceId, number>>,
  project?: SpecialProject,
): PlaneBaseDef => ({
  ...(tech ? { tech } : {}),
  ...(project ? { project } : {}),
  size,
  agility: ag,
  speed: sp,
  range: rg,
  airDef: ad * 100,
  relPm: rel * 10,
  costMilli: cost * 1000,
  res: res(r),
});
export const PLANE_BASE_DEFS: Readonly<Record<string, PlaneBaseDef>> = {
  small_1: pb("fighter_1", "small", 50, 450, 650, 10, 80, 16, {
    aluminium: 2,
    rubber: 1,
  }),
  small_2: pb("fighter_2", "small", 55, 530, 780, 13, 82, 20, {
    aluminium: 2,
    rubber: 1,
  }),
  small_3: pb("fighter_3", "small", 60, 610, 910, 16, 85, 24, {
    aluminium: 2,
    rubber: 1,
  }),
  medium_1: pb("bomber_1", "medium", 22, 380, 900, 14, 80, 24, {
    aluminium: 3,
    rubber: 1,
  }),
  medium_2: pb("bomber_2", "medium", 26, 460, 1080, 18, 82, 30, {
    aluminium: 3,
    rubber: 1,
  }),
  medium_3: pb("heavy_fighter_3", "medium", 30, 540, 1260, 22, 85, 36, {
    aluminium: 3,
    rubber: 1,
  }),
  large_1: pb("strat_bomber_1", "large", 10, 350, 1500, 22, 78, 40, {
    aluminium: 4,
    rubber: 2,
  }),
  large_2: pb("strat_bomber_2", "large", 12, 430, 1800, 28, 80, 48, {
    aluminium: 4,
    rubber: 2,
  }),
  large_3: pb("strat_bomber_3", "large", 14, 510, 2100, 34, 82, 56, {
    aluminium: 4,
    rubber: 2,
  }),
  jet_1: pb(
    null,
    "small",
    45,
    820,
    450,
    14,
    65,
    30,
    { aluminium: 3, rubber: 1 },
    "sp_jet_engine",
  ),
};
export function planeSlots(base: string): string[] {
  const s = PLANE_BASE_DEFS[base]?.size;
  return s === "large"
    ? ["weapon", "aux", "aux", "defense", "defense", "special"]
    : s === "medium"
      ? ["weapon", "aux", "aux", "defense", "special"]
      : ["weapon", "aux", "aux", "special"];
}
interface PlaneModDef {
  group: "weapon" | "defense" | "special";
  sizes?: readonly Size[];
  bases?: readonly string[];
  tech?: WwTechId;
  air?: number;
  ground?: number;
  strat?: number;
  naval?: number;
  groundX?: number;
  stratX?: number;
  navalX?: number;
  agility?: number;
  speedPct?: number;
  rangePct?: number;
  airDef?: number;
  relPp?: number;
  detect?: number;
  costMilli?: number;
  costPct?: number;
  flags?: number;
}
const MLG: readonly Size[] = ["medium", "large"];
export const PLANE_MODULE_DEFS: Readonly<Record<string, PlaneModDef>> = {
  w_mg2: { group: "weapon", air: 6, ground: 0.5, costMilli: 500 },
  w_mg4: { group: "weapon", air: 10, ground: 1, costMilli: 1_000 },
  w_hmg: {
    group: "weapon",
    bases: ["small_2", "small_3", "jet_1"],
    air: 13,
    ground: 1.5,
    costMilli: 1_500,
  },
  w_cannon20: {
    group: "weapon",
    tech: "aircraft_cannon_1",
    air: 15,
    ground: 2,
    naval: 0.5,
    agility: -2,
    costMilli: 2_000,
  },
  w_cannon30: {
    group: "weapon",
    tech: "aircraft_cannon_2",
    air: 20,
    ground: 4,
    naval: 1,
    agility: -4,
    costMilli: 3_000,
  },
  w_bombs_s: {
    group: "weapon",
    ground: 6,
    strat: 1,
    naval: 2,
    speedPct: -5,
    costMilli: 1_000,
  },
  w_bombs_m: {
    group: "weapon",
    sizes: MLG,
    ground: 8,
    strat: 5,
    naval: 3,
    speedPct: -8,
    costMilli: 2_000,
  },
  w_bombs_l: {
    group: "weapon",
    sizes: ["large"],
    ground: 6,
    strat: 10,
    naval: 2,
    speedPct: -10,
    costMilli: 4_000,
  },
  w_torpedo: {
    group: "weapon",
    tech: "naval_bomber_1",
    naval: 12,
    speedPct: -8,
    costMilli: 2_000,
  },
  w_rockets: {
    group: "weapon",
    tech: "air_rockets_1",
    ground: 6,
    naval: 5,
    costMilli: 2_000,
  },
  w_cargo: { group: "weapon", sizes: MLG, costMilli: 1_000, flags: DS_CARGO },
  m_def_turret: {
    group: "defense",
    sizes: MLG,
    airDef: 8,
    speedPct: -5,
    costMilli: 1_500,
  },
  m_armor: { group: "defense", airDef: 6, agility: -4, costMilli: 1_000 },
  m_self_sealing: {
    group: "special",
    tech: "self_sealing_tanks",
    airDef: 3,
    relPp: 5,
    costMilli: 500,
  },
  m_drop_tank: {
    group: "special",
    tech: "drop_tanks",
    rangePct: 40,
    agility: -3,
    costMilli: 500,
  },
  m_dive_brakes: {
    group: "special",
    sizes: ["small"],
    groundX: 125,
    navalX: 125,
    speedPct: -5,
    costMilli: 500,
  },
  m_bomb_sight: {
    group: "special",
    sizes: MLG,
    tech: "bomb_sight_1",
    groundX: 110,
    stratX: 120,
    costMilli: 1_000,
  },
  m_radar: {
    group: "special",
    tech: "air_radar_1",
    detect: 20,
    costMilli: 2_000,
    flags: DS_RADAR,
  },
  m_carrier: {
    group: "special",
    sizes: ["small"],
    tech: "carrier_aviation",
    rangePct: -10,
    costMilli: 1_000,
    flags: DS_CARRIER,
  },
  m_engine_boost: { group: "special", speedPct: 8, rangePct: -10, costPct: 10 },
  m_recon_camera: { group: "special", costMilli: 500, flags: DS_RECON },
};
/** Which module groups a plane slot kind takes (spec §5.4.2 after the table). */
export function planeSlotTakes(slot: string, id: string): boolean {
  const g = PLANE_MODULE_DEFS[id]?.group;
  if (slot === "weapon") return g === "weapon";
  if (slot === "aux") return g !== undefined && id !== "w_cargo";
  if (slot === "defense") return g === "defense";
  return g === "special";
}
export function planeType(def: DesignDef): string {
  const size = PLANE_BASE_DEFS[def.base].size;
  const m = new Set(def.modules.filter((x) => x !== ""));
  const bombs = m.has("w_bombs_s") || m.has("w_bombs_m") || m.has("w_bombs_l");
  const cv = m.has("m_carrier");
  if (m.has("w_cargo")) return "transport_plane";
  if (size === "small") {
    if (m.has("w_torpedo")) return cv ? "cv_naval_bomber" : "naval_bomber";
    if (bombs || m.has("w_rockets") || m.has("m_dive_brakes")) {
      return cv ? "cv_cas" : "cas";
    }
    return cv ? "cv_fighter" : "fighter";
  }
  if (m.has("w_torpedo") || (m.has("m_radar") && !bombs)) return "naval_bomber";
  if (bombs) return size === "medium" ? "bomber" : "strat_bomber";
  return size === "medium" ? "heavy_fighter" : "strat_bomber";
}
export function planeStats(def: DesignDef, ctx: DesignCtx): PlaneDesignStats {
  const b = PLANE_BASE_DEFS[def.base];
  let air = 0;
  let ground = 0;
  let strat = 0;
  let naval = 0;
  let gX = 100;
  let sX = 100;
  let nX = 100;
  let agility = b.agility;
  let speedPct = 0;
  let rangePct = 0;
  let airDef = b.airDef;
  let rel = b.relPm + ctx.relPp * 10;
  let detect = 0;
  let cost = b.costMilli;
  let costPct = 0;
  let flags = b.project ? DS_JET : 0;
  for (const id of def.modules) {
    if (id === "") continue;
    const m = PLANE_MODULE_DEFS[id];
    air += Math.round((m.air ?? 0) * 100);
    ground += Math.round((m.ground ?? 0) * 100);
    strat += Math.round((m.strat ?? 0) * 100);
    naval += Math.round((m.naval ?? 0) * 100);
    gX = Math.floor((gX * (m.groundX ?? 100)) / 100);
    sX = Math.floor((sX * (m.stratX ?? 100)) / 100);
    nX = Math.floor((nX * (m.navalX ?? 100)) / 100);
    agility += m.agility ?? 0;
    speedPct += m.speedPct ?? 0;
    rangePct += m.rangePct ?? 0;
    airDef += (m.airDef ?? 0) * 100;
    rel += (m.relPp ?? 0) * 10;
    detect += m.detect ?? 0;
    cost += m.costMilli ?? 0;
    costPct += m.costPct ?? 0;
    flags |= m.flags ?? 0;
  }
  if (
    (flags & DS_RADAR) !== 0 &&
    (ctx.projects & projectBit("sp_cavity_magnetron")) !== 0
  ) {
    detect = Math.floor((detect * 3) / 2);
  }
  return {
    kind: "plane",
    type: planeType(def),
    airAttack: air,
    airDefense: airDef,
    agility: Math.max(1, agility),
    ground: Math.floor((ground * gX) / 100),
    strategic: Math.floor((strat * sX) / 100),
    naval: Math.floor((naval * nX) / 100),
    speed: mul(b.speed, speedPct),
    range: mul(b.range, rangePct),
    detect,
    relPm: clamp(rel, 400, 990),
    costMilli: mul(mul(cost, costPct), ctx.costPct),
    resources: [...b.res],
    fuelPct: (flags & DS_JET) !== 0 ? 60 : 0,
    flags,
    year: b.tech ? WW_TECHS[b.tech].year : 1944,
  };
}

// ---------------------------------------------------------------- shared
export function designStats(
  def: DesignDef,
  ctx: DesignCtx,
): TankDesignStats | ShipDesignMods | PlaneDesignStats {
  return def.kind === "tank"
    ? tankStats(def, ctx)
    : def.kind === "ship"
      ? shipDesignMods(def)
      : planeStats(def, ctx);
}
export function slotKinds(def: Pick<DesignDef, "kind" | "base">): string[] {
  return def.kind === "tank"
    ? tankSlots(def.base)
    : def.kind === "plane"
      ? planeSlots(def.base)
      : [...(SHIP_CLASS_SLOTS[shipBase(def.base)?.cls ?? "dd"] ?? [])];
}
/** Spec §5.1 refusals, the order of the checks fixed (the screen shows the first). */
export function designBlock(
  def: DesignDef,
  c: DesignBlockCtx,
): WwOrderBlock | null {
  const has = (t?: WwTechId, p?: SpecialProject) =>
    (t === undefined || c.techs.has(t)) &&
    (p === undefined || (c.projects & projectBit(p)) !== 0);
  if (def.kind === "tank") {
    const b = TANK_BASE_DEFS[def.base];
    if (b === undefined || !has(b.tech)) return "bad_base";
    const slots = tankSlots(def.base);
    if (def.modules.length !== slots.length) return "module_bad_slot";
    const m = resolvedModules(def);
    const specials = m.slice(5).filter((x) => x !== "");
    if (new Set(specials).size !== specials.length) return "module_bad_slot";
    for (let i = 0; i < m.length; i++) {
      if (m[i] === "") {
        if (slots[i] !== "special") return "module_bad_slot";
        continue;
      }
      const d = TANK_MODULE_DEFS[m[i]];
      if (d === undefined || d.slot !== slots[i]) return "module_bad_slot";
      if (d.weights !== undefined && !d.weights.includes(b.weight)) {
        return "module_bad_slot";
      }
      if (d.bases !== undefined && !d.bases.includes(def.base)) {
        return "module_bad_slot";
      }
      if (!has(d.tech)) return "module_locked";
    }
    if (
      m[0] === "howitzer" &&
      m[1] !== "turret_none" &&
      m[1] !== "turret_open"
    ) {
      return "module_bad_slot";
    }
    if (m[0] === "aa_auto" && m[1] !== "turret_open") return "module_bad_slot";
    return null;
  }
  if (def.kind === "ship") {
    const sb = shipBase(def.base);
    if (
      sb === null ||
      (sb.gen > 1 && !has(`${sb.cls}_${sb.gen}` as WwTechId))
    ) {
      return "bad_base";
    }
    const slots = SHIP_CLASS_SLOTS[sb.cls];
    if (def.modules.length !== slots.length) return "module_bad_slot";
    for (let i = 0; i < slots.length; i++) {
      const id = def.modules[i];
      if (id === "") continue;
      const d = SHIP_MODULE_DEFS[id];
      if (
        d === undefined ||
        d.slot !== slots[i] ||
        !d.classes.includes(sb.cls)
      ) {
        return "module_bad_slot";
      }
      if (d.gens !== undefined && !d.gens.includes(sb.gen)) {
        return "module_bad_slot";
      }
      if (!has(d.tech, d.project)) return "module_locked";
    }
    if (c.treatyMember && (sb.cls === "bb" || sb.cls === "bc")) {
      if (def.modules.includes("shbb_hull")) return "treaty_limit";
      if (!c.treatyEscalated && def.modules.includes("main_heavy")) {
        return "treaty_limit";
      }
    }
    return null;
  }
  const b = PLANE_BASE_DEFS[def.base];
  if (b === undefined || !has(b.tech, b.project)) return "bad_base";
  const slots = planeSlots(def.base);
  if (def.modules.length !== slots.length || def.modules[0] === "") {
    return "module_bad_slot";
  }
  for (let i = 0; i < slots.length; i++) {
    const id = def.modules[i];
    if (id === "") continue;
    const d = PLANE_MODULE_DEFS[id];
    if (d === undefined || !planeSlotTakes(slots[i], id)) {
      return "module_bad_slot";
    }
    if (d.sizes !== undefined && !d.sizes.includes(b.size)) {
      return "module_bad_slot";
    }
    if (d.bases !== undefined && !d.bases.includes(def.base)) {
      return "module_bad_slot";
    }
    if (!has(d.tech)) return "module_locked";
  }
  return null;
}
const XP_COST: Readonly<Record<DesignKind, readonly [number, number, number]>> =
  {
    tank: [10, 3, 1],
    ship: [15, 5, 0],
    plane: [10, 3, 0],
  };
/** Spec §5.1 cost table: a new design, or a copy (changed modules and levels, at least 5). */
export function designXpCost(
  before: DesignDef | null,
  after: DesignDef,
): number {
  const [base, perMod, perLvl] = XP_COST[after.kind];
  const lv = (d: DesignDef) => [d.armorLevel ?? 0, d.engineLevel ?? 0];
  if (
    before === null ||
    before.base !== after.base ||
    before.kind !== after.kind
  ) {
    const m = resolvedModules(after);
    const nonDefault = m.filter(
      (id, i) =>
        id !== "" &&
        (after.kind !== "tank" || id !== tankDefault(after.base, i)),
    ).length;
    return base + perMod * nonDefault + perLvl * (lv(after)[0] + lv(after)[1]);
  }
  const a = resolvedModules(before);
  const b = resolvedModules(after);
  const changed = b.filter((id, i) => id !== a[i]).length;
  const lvl =
    Math.abs(lv(after)[0] - lv(before)[0]) +
    Math.abs(lv(after)[1] - lv(before)[1]);
  return Math.max(5, perMod * changed + perLvl * lvl);
}
/** Spec §5.5. */
export function convertCost(
  newCostMilli: number,
  oldCostMilli: number,
): number {
  return Math.max(
    Math.floor((newCostMilli * 25) / 100),
    newCostMilli - Math.floor((oldCostMilli * 60) / 100),
  );
}
/** Spec §5.5: retention between two design keys, bp; -1: the P1 rule decides. */
export function designRetentionBp(
  a: DesignDef | null,
  b: DesignDef | null,
): number {
  if (a === null || b === null || a.kind !== b.kind) return -1;
  if (a.base === b.base) return 9_000;
  const roleOf = (d: DesignDef) =>
    d.kind === "tank"
      ? tankRole(d)
      : d.kind === "plane"
        ? planeType(d)
        : d.base.split("_")[0];
  return roleOf(a) === roleOf(b) ? 6_000 : -1;
}
/** Spec §5.6 / §7.1: licence production surcharge, percent. */
export function licenceCostPct(gapYears: number): number {
  return 10 + Math.min(50, 10 * Math.max(0, gapYears));
}
/** Spec §5.2.4: the draw order inside a need group — newest year first, then the smaller key. */
export function drawOrder(
  keys: readonly number[],
  yearOf: (key: number) => number,
): number[] {
  return [...keys].sort((a, b) => yearOf(b) - yearOf(a) || a - b);
}
/** Reliability effect on equipment losses (spec §5.2.2): × (180 − rel%) / 100, as bp. */
export function reliabilityLossBp(relPm: number): number {
  return Math.floor(((1800 - relPm) * 100) / 10);
}

/** The first module of a slot kind the techs allow (base defaults first). */
function firstModule(
  ids: readonly string[],
  ok: (id: string) => boolean,
): string {
  for (const id of ids) if (ok(id)) return id;
  return "";
}

/** Spec §5.2.3: the screen's "recommended fill" and the AI's starting point (lane E refines; K5's AI_DESIGN_PRESETS too). */
export function recommendedTank(
  base: string,
  techs: ReadonlySet<WwTechId>,
  role: TankRole,
): DesignDef {
  const has = (t?: WwTechId) => t === undefined || techs.has(t);
  const w = TANK_BASE_DEFS[base]?.weight ?? "light";
  const pick = (cands: readonly string[], slot: string) =>
    firstModule(cands, (id) => {
      const d = TANK_MODULE_DEFS[id];
      return (
        d !== undefined &&
        d.slot === slot &&
        has(d.tech) &&
        (d.weights === undefined || d.weights.includes(w)) &&
        (d.bases === undefined || d.bases.includes(base))
      );
    });
  const gun =
    role === "sp_artillery"
      ? pick(["howitzer"], "gun")
      : role === "sp_anti_air"
        ? pick(["aa_auto"], "gun")
        : role === "tank_destroyer"
          ? pick(["gun_heavy", "gun_hv", "gun_small"], "gun")
          : base === "light_1"
            ? "auto20"
            : base === "medium_1"
              ? pick(["gun_cs", "gun_small"], "gun")
              : pick(["gun_hv", "gun_cs", "gun_small", "auto20"], "gun");
  const turret =
    role === "sp_artillery" || role === "sp_anti_air"
      ? "turret_open"
      : role === "tank_destroyer"
        ? "turret_none"
        : pick(["turret_3", "turret_2", "turret_1"], "turret");
  const susp =
    role === "sp_artillery" || role === "sp_anti_air"
      ? "bogie"
      : base === "light_1"
        ? "bogie"
        : pick(
            w === "heavy"
              ? ["interleaved", "torsion", "bogie"]
              : w === "light"
                ? ["christie", "bogie"]
                : ["torsion", "bogie"],
            "suspension",
          );
  const armor =
    base === "light_1"
      ? "riveted"
      : w === "heavy" || base === "medium_3"
        ? pick(["cast", "welded"], "armor")
        : "welded";
  // Spec §5.2.3 table: a diesel for medium II, medium III and the tank
  // destroyer when it is researched; a petrol engine elsewhere.
  const engine =
    role === "tank_destroyer" ||
    (role === "tank" && (base === "medium_2" || base === "medium_3"))
      ? pick(["diesel", "petrol"], "engine")
      : "petrol";
  const specialsOf = (): string[] => {
    if (base === "light_1") return [];
    if (role === "sp_artillery") return ["aux_mg"];
    if (role === "sp_anti_air") return [pick(["radio"], "special")];
    if (role === "tank_destroyer")
      return [pick(["sloped"], "special"), "smoke"];
    if (base === "light_2") return [pick(["radio"], "special"), "aux_mg"];
    if (base === "medium_1") return [pick(["radio"], "special"), "smoke"];
    return [pick(["radio"], "special"), pick(["sloped", "smoke"], "special")];
  };
  const slots = tankSlots(base);
  const sp = specialsOf();
  const modules = [gun, turret, susp, armor, engine];
  for (let i = 5; i < slots.length; i++) modules.push(sp[i - 5] ?? "");
  const levels: Readonly<Record<string, readonly [number, number]>> = {
    light_1: [0, 0],
    light_2: [1, 2],
    medium_1: [2, 2],
    medium_2: [3, 3],
    medium_3: [3, 4],
  };
  const [armorLevel, engineLevel] =
    role === "tank_destroyer"
      ? [4, 2]
      : role === "sp_artillery" || role === "sp_anti_air"
        ? [0, 2]
        : (levels[base] ?? [4, 1]);
  return { kind: "tank", base, modules, armorLevel, engineLevel, name: base };
}

/** Lane E fills (spec §5.3): the base fitting of a ship class, every slot "". */
export function recommendedShip(base: string): DesignDef {
  const cls = shipBase(base)?.cls ?? "dd";
  return {
    kind: "ship",
    base,
    modules: SHIP_CLASS_SLOTS[cls].map(() => ""),
    name: base,
  };
}

/** Lane E fills (spec §5.4): the first weapon the techs allow, the rest empty. */
export function recommendedPlane(
  base: string,
  techs: ReadonlySet<WwTechId>,
): DesignDef {
  const slots = planeSlots(base);
  const weapon = firstModule(
    ["w_mg4", "w_mg2"],
    (id) =>
      PLANE_MODULE_DEFS[id].tech === undefined ||
      techs.has(PLANE_MODULE_DEFS[id].tech!),
  );
  return {
    kind: "plane",
    base,
    modules: slots.map((_, i) => (i === 0 ? weapon : "")),
    name: base,
  };
}
