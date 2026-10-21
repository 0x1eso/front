// World War 1936 P6 (P6 spec §9, §10): special projects, scientists, the
// atomic bomb, rockets and raids. Tables and formulas are the
// foundation's (plan Task 1 Step 8); lane S fills the …Block bodies
// (Task 6).
import {
  ATOMIC_BOMB_DAYS,
  ATOMIC_MILESTONES_PM,
  FacilityId,
  RaidKind,
  ScientistSpec,
  SpecialProject,
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

/** Refusal of project_start (plan decision 40). S fills (spec §9.3). */
export function projectStartBlock(
  i: ProjectStartInput,
): "no_facility" | "project_locked" | "in_progress" | null {
  return "project_locked";
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

/** Refusal of nuke_drop (plan decision 40). S fills (spec §9.5); a no-strike region is always refused. */
export function nukeDropBlock(
  i: NukeDropInput,
): "no_atomic" | "nuke_conditions" | "out_of_rocket_range" | null {
  return "nuke_conditions";
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

/** Refusal of raid (plan decision 40). S fills (spec §10); a no-strike region is always refused. */
export function raidBlock(i: RaidInput): "raid_conditions" | null {
  return "raid_conditions";
}

/** Spec §9.7: the target check of rocket_strike (pre-flight §0-11: never a no-strike region). S fills the range part. */
export function rocketTargetBlock(i: {
  km: number;
  rangeKm: number;
  noStrike: boolean;
}): "out_of_rocket_range" | "raid_conditions" | null {
  return "out_of_rocket_range";
}
