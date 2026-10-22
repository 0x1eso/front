// World War 1936 P6 (P6 spec §9, §10): special projects, scientists, the
// atomic bomb, rockets and raids. Tables and formulas are the
// foundation's (plan Task 1 Step 8); lane S fills the …Block bodies
// (Task 6).
import {
  ATOMIC_BOMB_DAYS,
  ATOMIC_MILESTONES_PM,
  FacilityId,
  INTEL_BAND_FLOORS,
  NUKE_MIN_BOMBERS,
  RAID_KINDS,
  RAID_PREP_DAYS,
  RaidKind,
  ROCKET_RANGE_KM,
  ScientistSpec,
  SPECIAL_PROJECTS,
  SpecialProject,
  WW_MAX_RAIDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BuildingId,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";

export interface ProjectDef {
  facility: FacilityId;
  days: number;
  techs: readonly WwTechId[];
  after?: SpecialProject;
  spec: ScientistSpec;
  uraniumDay: number;
}

export const PROJECT_DEFS: Readonly<Record<SpecialProject, ProjectDef>> = {
  sp_atomic: {
    facility: "facility_nuclear",
    days: 1_900,
    techs: ["nuclear_physics"],
    spec: "nuclear",
    uraniumDay: 2,
  },
  sp_flying_bomb: {
    facility: "facility_rocket",
    days: 500,
    techs: ["rocketry_1"],
    spec: "rocket",
    uraniumDay: 0,
  },
  sp_ballistic: {
    facility: "facility_rocket",
    days: 700,
    techs: [],
    after: "sp_flying_bomb",
    spec: "rocket",
    uraniumDay: 0,
  },
  sp_jet_engine: {
    facility: "facility_science",
    days: 650,
    techs: ["fighter_2"],
    spec: "aviation",
    uraniumDay: 0,
  },
  sp_cavity_magnetron: {
    facility: "facility_science",
    days: 450,
    techs: ["radar_1"],
    spec: "electronics",
    uraniumDay: 0,
  },
  sp_proximity_fuze: {
    facility: "facility_science",
    days: 500,
    techs: ["anti_air_2", "electronics_1"],
    spec: "electronics",
    uraniumDay: 0,
  },
};

/** Spec §9.2. */
export function scientistPct(skill: number, matches: boolean): number {
  return 15 * (skill - 1) + (matches ? 25 : 0);
}

/** Spec §9.2: a scientist at work gains a skill level every 365 days, up to 5. */
export const SCIENTIST_SKILL_DAYS = 365;
export const SCIENTIST_MAX_SKILL = 5;

/** The SPECIAL_PROJECTS bit of a project (proj.done, blueprints, halved). */
export function projectBit(p: SpecialProject): number {
  return 1 << SPECIAL_PROJECTS.indexOf(p);
}

/** Spec §9.1: a captured blueprint cuts the project's base days by 20%, once. */
export function projectBaseDays(days: number, blueprint: boolean): number {
  return blueprint ? Math.floor((days * 80) / 100) : days;
}

/**
 * Spec §18.5 and the content's flags (P5 heavy_water and radar_lab, K3
 * nor_heavy_water, K5 quebec_agreement): what a project adds to its speed
 * on top of the scientist and projectSpeedPct, percent.
 */
export interface ProjectBonusInput {
  project: SpecialProject;
  /** The country's P5 flag heavy_water (the French heavy water reached it). */
  heavyWater: boolean;
  /** The country's P5 flag radar_lab. */
  radarLab: boolean;
  /** It controls the Vemork dam's region and the plant stands (level > 0). */
  vemork: boolean;
  /** The K3 flag nor_heavy_water (the country's or the world's). */
  norHeavyWater: boolean;
  /** The world flag quebec_agreement, read for the United States' project (K5). */
  quebec: boolean;
}

export function projectBonusPct(i: ProjectBonusInput): number {
  switch (i.project) {
    case "sp_atomic":
      return (
        (i.heavyWater ? 10 : 0) +
        (i.vemork ? (i.norHeavyWater ? 20 : 10) : 0) +
        (i.quebec ? 15 : 0)
      );
    case "sp_cavity_magnetron":
    case "sp_proximity_fuze":
      return i.radarLab ? 20 : 0;
    default:
      return 0;
  }
}

/** Spec §9.3: a day's progress, milli‰. Skill 4 + match (+70), full input: 1900 days → 894 a day → 1,119 days. */
export function projectDayMilli(
  baseDays: number,
  pct: number,
  inputPm: number,
  hasScientist: boolean,
): number {
  const v = Math.floor(
    (Math.floor((1_000_000 * (100 + pct)) / baseDays) * inputPm) / 100_000,
  );
  return hasScientist ? v : Math.floor(v / 2);
}

export function inputPm(got: number, need: number): number {
  return need <= 0 ? 1000 : Math.min(1000, Math.floor((got * 1000) / need));
}

/** Spec §9.4: one facility's bomb progress a day, milli‰ (8,333 at full uranium). */
export function atomicBombDayMilli(uraniumPm: number): number {
  return Math.floor(
    (Math.floor(1_000_000 / ATOMIC_BOMB_DAYS) * uraniumPm) / 1000,
  );
}

/** The milestone index (0..2) first reached when progress goes from `before` to `after` ‰, or -1. */
export function milestoneCrossed(beforePm: number, afterPm: number): number {
  for (let i = 0; i < 3; i++) {
    if (
      beforePm < ATOMIC_MILESTONES_PM[i] &&
      afterPm >= ATOMIC_MILESTONES_PM[i]
    )
      return i;
  }
  return -1;
}

/** Spec §9.5 interception ‰ by the enemy's air superiority ‰ in that zone. */
export function nukeInterceptPm(enemySupPm: number): number {
  return Math.max(0, Math.min(350, Math.floor((enemySupPm - 300) / 2)));
}

/** Spec §9.5 effect numbers. `nukedBefore`: bombs that hit this country before. */
export interface NukeOutcome {
  destroy: { civ: number; mil: number; dock: number };
  damageMilliPerBuilding: number;
  divisionLossPct: number;
  neighbourLossPct: number;
  portShipHpPct: number;
  warSupportBp: number;
  surrenderCutPp: number;
  alliesWarSupportBp: number;
  tensionPct: number;
  nukedDays: number;
  buildPct: number;
  supplyPct: number;
  resistancePp: number;
}

export function nukeOutcome(
  civ: number,
  mil: number,
  dock: number,
  nukedBefore: number,
): NukeOutcome {
  return {
    destroy: {
      civ: Math.floor(civ / 4),
      mil: Math.floor(mil / 4),
      dock: Math.floor(dock / 4),
    },
    damageMilliPerBuilding: 800,
    divisionLossPct: 60,
    neighbourLossPct: 15,
    portShipHpPct: 50,
    warSupportBp: -1_500,
    surrenderCutPp:
      -Math.min(30, 10 * (nukedBefore + 1)) + Math.min(30, 10 * nukedBefore),
    alliesWarSupportBp: -500,
    tensionPct: 10,
    nukedDays: 365,
    buildPct: -50,
    supplyPct: -50,
    resistancePp: 10,
  };
}

/** Spec §9.7: flying bombs that get through, with the milli remainder carried in state. */
export function rocketHits(
  kind: 0 | 1,
  count: number,
  enemySupPm: number,
  aaLevel: number,
  restMilli: number,
): { hits: number; restMilli: number } {
  if (kind === 1) return { hits: count, restMilli };
  const through =
    1000 - Math.min(600, Math.floor((enemySupPm * 4) / 10) + aaLevel * 40);
  const m = count * through + restMilli;
  return { hits: Math.floor(m / 1000), restMilli: m % 1000 };
}

/** Spec §10 success ‰ (clamped 50..950). */
export function raidSuccessPm(
  kind: 0 | 1 | 2,
  i: {
    expLevel: number;
    aa: number;
    supPm: number;
    enemyDivision: boolean;
    coastalFort: number;
    bombers: number;
  },
): number {
  const v =
    kind === 0
      ? 600 +
        50 * i.expLevel -
        60 * i.aa -
        Math.floor(Math.max(0, i.supPm - 500) / 2) -
        (i.enemyDivision ? 200 : 0)
      : kind === 1
        ? 650 -
          80 * i.coastalFort -
          (i.enemyDivision ? 200 : 0) +
          50 * i.expLevel
        : 550 +
          Math.floor(i.bombers / 10) -
          50 * i.aa -
          Math.floor(Math.max(0, i.supPm - 400) / 2);
  return Math.max(50, Math.min(950, v));
}

export const RAID_TARGETS: Readonly<Record<RaidKind, readonly BuildingId[]>> = {
  raid_para: [
    "facility_nuclear",
    "facility_rocket",
    "facility_science",
    "air_base",
    "radar",
    "dam",
    "coastal_fort",
    "rocket_site",
  ],
  raid_commando: [
    "naval_base",
    "coastal_fort",
    "dock",
    "facility_nuclear",
    "facility_rocket",
    "facility_science",
    "dam",
  ],
  raid_bomb: [
    "facility_nuclear",
    "facility_rocket",
    "facility_science",
    "air_base",
    "radar",
    "dam",
    "coastal_fort",
    "rocket_site",
    "naval_base",
    "dock",
    "mil",
    "civ",
  ],
};

export interface ProjectStartInput {
  project: SpecialProject;
  facilityKind: FacilityId | null;
  facilityBusy: boolean;
  techs: ReadonlySet<WwTechId>;
  /** SPECIAL_PROJECTS bits done. */
  done: number;
  running: boolean;
  nukesOn: boolean;
}

/**
 * Refusal of project_start (plan decision 40, spec §9.3): the atomic
 * project needs the lobby's ww1936Nukes; a project is started once (not
 * done, its techs and its predecessor done); one project runs in one
 * place (a paused one — facility 0 — may start again); the region holds a
 * facility of the project's kind (`facilityKind`, null none) that runs
 * nothing else.
 */
export function projectStartBlock(
  i: ProjectStartInput,
): "no_facility" | "project_locked" | "in_progress" | null {
  const def = PROJECT_DEFS[i.project];
  if (i.project === "sp_atomic" && !i.nukesOn) return "project_locked";
  if ((i.done & projectBit(i.project)) !== 0) return "project_locked";
  if (def.techs.some((t) => !i.techs.has(t))) return "project_locked";
  if (def.after !== undefined && (i.done & projectBit(def.after)) === 0) {
    return "project_locked";
  }
  if (i.running) return "in_progress";
  if (i.facilityKind !== def.facility) return "no_facility";
  if (i.facilityBusy) return "in_progress";
  return null;
}

export interface NukeDropInput {
  stock: number;
  atWar: boolean;
  bombersInZone: number;
  nukesOn: boolean;
  rocket: boolean;
  ballisticDone: boolean;
  rocketKm: number;
  ballisticStock: number;
  /** Pre-flight §0-11: a region on the no-strike list (Korea, Taiwan). */
  noStrike: boolean;
}

/** Spec §9.5: a ballistic rocket carries the bomb this far (its own range). */
export const NUKE_ROCKET_RANGE_KM = ROCKET_RANGE_KM[1];
/** Spec §9.5: the bombers an interception costs. */
export const NUKE_INTERCEPT_BOMBERS = 10;

/**
 * Refusal of nuke_drop (plan decision 40, spec §9.5). A no-strike region
 * is always refused first. Then the lobby key, a bomb in stock, a war with
 * the target region's controller, and the carrier: a ballistic rocket
 * (sp_ballistic done, one in stock, the target's center within 320 km of
 * one of our rocket sites' centers — `rocketKm` < 0: no site) or 10
 * strategic bombers of ours or our side on strategic bombing over the
 * target's land zone.
 */
export function nukeDropBlock(
  i: NukeDropInput,
):
  | "no_strike_region"
  | "no_atomic"
  | "nuke_conditions"
  | "out_of_rocket_range"
  | null {
  // Sensitivity (decision 34): the no-strike line first; lane S keeps it.
  if (i.noStrike) return "no_strike_region";
  if (!i.nukesOn) return "nuke_conditions";
  if (i.stock < 1) return "no_atomic";
  if (!i.atWar) return "nuke_conditions";
  if (i.rocket) {
    if (!i.ballisticDone || i.ballisticStock < 1 || i.rocketKm < 0) {
      return "nuke_conditions";
    }
    return i.rocketKm > NUKE_ROCKET_RANGE_KM ? "out_of_rocket_range" : null;
  }
  return i.bombersInZone >= NUKE_MIN_BOMBERS ? null : "nuke_conditions";
}

export interface RaidInput {
  kind: RaidKind;
  unitOk: boolean;
  targetOk: boolean;
  reachOk: boolean;
  running: number;
  intelClose: boolean;
  facilityTarget: boolean;
  /** Pre-flight §0-11: a region on the no-strike list (Korea, Taiwan). */
  noStrike: boolean;
}

/**
 * Refusal of raid (plan decision 40, spec §10). A no-strike region is
 * always refused first. Then two raids a country at once, the unit (a
 * division mostly of paratroopers, or of marines and mountain troops; a
 * bomber deployment over the target's zone), its reach (the air base,
 * 20 transports and their range; the port, 10 convoys, the sea route at
 * 30% supremacy; 50 bombers over the zone), the target (a building of the
 * kind's list in an enemy's region), and a facility only when our civil
 * intelligence on the target region's controller is at least "close".
 */
export function raidBlock(
  i: RaidInput,
): "no_strike_region" | "raid_conditions" | null {
  if (i.noStrike) return "no_strike_region";
  if (i.running >= WW_MAX_RAIDS) return "raid_conditions";
  if (!i.unitOk || !i.reachOk || !i.targetOk) return "raid_conditions";
  if (i.facilityTarget && !i.intelClose) return "raid_conditions";
  return null;
}

/** Spec §10: what a raid needs (the reach rows of the table). */
export const RAID_MIN_TRANSPORTS = 20;
export const RAID_MIN_CONVOYS = 10;
export const RAID_ROUTE_SUP_PM = 300;
export const RAID_MIN_BOMBERS = 50;
/** Spec §10: a facility is a target only with civil intelligence "close" or better. */
export const RAID_FACILITY_INTEL = INTEL_BAND_FLOORS[2];
/** Spec §10: a facility hit loses 15% of its project, milli‰. */
export const RAID_FACILITY_CUT_MILLI = 150_000;
/** Spec §10: strength lost, ‰ of HP (success, failure); bombers lost on a failed precision raid, percent. */
export const RAID_SUCCESS_LOSS_PM = 200;
export const RAID_FAIL_LOSS_PM = 500;
export const RAID_BOMBER_LOSS_PCT = 10;

/** Spec §10: the target buildings a kind may hit. */
export function raidTargetOk(kind: RaidKind, building: BuildingId): boolean {
  return RAID_TARGETS[kind].includes(building);
}

/** Spec §10, §4.2: the preparation days; a commando general cuts them by 25%. */
export function raidPrepDays(kind: RaidKind, commando: boolean): number {
  const days = RAID_PREP_DAYS[RAID_KINDS.indexOf(kind)];
  return commando ? Math.floor((days * 75) / 100) : days;
}

/** Spec §10: the levels a successful raid takes off its building (a dockyard: buildings). */
export function raidLevelCut(kind: RaidKind): number {
  return kind === "raid_bomb" ? 1 : 2;
}

/** P2 spec §5.4's experience levels 0..3 (recruit … elite) for the raid odds. */
export function raidExpLevel(exp: number): number {
  return exp < 250 ? 0 : exp < 500 ? 1 : exp < 750 ? 2 : 3;
}

/**
 * Spec §9.7: the target check of rocket_strike — never a no-strike region
 * (pre-flight §0-11, first), then the rocket's range between the site's
 * and the target's centers.
 */
export function rocketTargetBlock(i: {
  km: number;
  rangeKm: number;
  noStrike: boolean;
}): "no_strike_region" | "out_of_rocket_range" | "raid_conditions" | null {
  if (i.noStrike) return "no_strike_region";
  return i.km > i.rangeKm ? "out_of_rocket_range" : null;
}
