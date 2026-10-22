// World War 1936 P6 (P6 spec §16): landmarks, dams and floods, scorched
// earth, railway guns and floating harbours. Tables, formulas and the
// P6 building check are the foundation's (plan Task 1 Steps 8, 12); lane
// W1 fills the …Block bodies (Task 7).
import {
  DAMS,
  Dam,
  FACILITY_IDS,
  Landmark,
  RAILGUN_HIT_CENTI,
  SCORCH_PP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_TECH,
  BuildingId,
  LEVEL_MAX,
  SLOT_BUILDING_MAX,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const LANDMARK_STATS: Readonly<Record<Landmark, Partial<WwStats>>> = {
  lm_eiffel: { ppMilli: 100 },
  lm_westminster: { stabilityBp: 200 },
  lm_kremlin: { ppMilli: 100 },
  lm_brandenburg: { warSupportBp: 200 },
  lm_colosseum: { stabilityBp: 200 },
  lm_liberty: { warSupportBp: 200 },
  lm_empire_state: { outputPct: 1 },
  lm_golden_gate: { constructionPct: 2 },
  lm_hagia_sophia: { stabilityBp: 200 },
  lm_forbidden_city: { ppMilli: 100 },
  lm_himeji: { stabilityBp: 200 },
  lm_christ_redeemer: { stabilityBp: 200 },
  lm_taj_mahal: { stabilityBp: 200 },
};
export const LANDMARK_FROM: Readonly<Partial<Record<Landmark, string>>> = {
  lm_golden_gate: "1937-05-27",
};
export const LOST_LANDMARK_STABILITY_BP = -200;
export const DAM_FROM: Readonly<Partial<Record<Dam, string>>> = {
  dam_hoover: "1936-03-01",
  dam_grand_coulee: "1942-01-01",
};
export const FLOOD = {
  infraCut: 2,
  infraFloor: 1,
  supplyPct: -50,
  moveCutPct: 30,
} as const;
export const SCORCH = {
  destroyPct: 50,
  infraCut: 2,
  railCut: 2,
  resourcePct: -50,
  resourceDays: 180,
  stabilityBp: -100,
} as const;

/** Spec §16.6: the harbour's hub level in milli after `days` days (5 → 0 over days 61..120). */
export function harborLevelMilli(days: number): number {
  return days < 60
    ? 5_000
    : Math.max(0, 5_000 - Math.floor(((days - 60) * 5_000) / 60));
}

export function railGunHitsCenti(guns: number, railLevel: number): number {
  return railLevel >= 2 ? RAILGUN_HIT_CENTI * guns : 0;
}

export function railGunFortCut(guns: number, railLevel: number): number {
  return railLevel >= 2 ? Math.min(2, guns) : 0;
}

export interface ScorchInput {
  legalOwner: boolean;
  controls: boolean;
  enemyAdjacent: boolean;
  pp: number;
  queued: boolean;
  /** Pre-flight §0-11: a region on the no-strike list (Korea, Taiwan). */
  noStrike: boolean;
}

/**
 * Refusal of scorch (plan decision 40, spec §16.7): the no-strike list
 * first (pre-flight §0-11), then the legal owner who controls the region,
 * an enemy division in it or a neighbour (or an enemy controlling a
 * neighbour), nothing already queued there, and 10 political power.
 */
export function scorchBlock(
  i: ScorchInput,
): "no_strike_region" | "scorch_conditions" | "no_pp" | null {
  if (i.noStrike) return "no_strike_region";
  if (!i.legalOwner || !i.controls || !i.enemyAdjacent || i.queued) {
    return "scorch_conditions";
  }
  return i.pp < SCORCH_PP ? "no_pp" : null;
}

/** Spec §16.6: the highest naval base a floating harbour may go to. */
export const HARBOR_MAX_NAVAL_BASE = 2;
/** Spec §16.6: our side's supremacy in the harbour zone's sea region, ‰. */
export const HARBOR_SUPREMACY_PM = 500;

export interface HarborInput {
  controls: boolean;
  coastal: boolean;
  navalBase: number;
  supremacyPm: number;
  stock: number;
  tech: boolean;
  /** A floating harbour already stands in the region (lane W1; absent: none). */
  deployed?: boolean;
}

/**
 * Refusal of harbor_deploy (plan decision 40, spec §16.6): a coastal region
 * we control with a naval base of 2 or less, our side's supremacy of 50%
 * or more in its harbour zone's sea region, a floating harbour in stock
 * (and its tech), none standing there yet.
 */
export function harborBlock(i: HarborInput): "harbor_conditions" | null {
  return i.controls &&
    i.coastal &&
    i.navalBase <= HARBOR_MAX_NAVAL_BASE &&
    i.supremacyPm >= HARBOR_SUPREMACY_PM &&
    i.stock >= 1 &&
    i.tech &&
    i.deployed !== true
    ? null
    : "harbor_conditions";
}

/** The P6 buildings (spec §9.1, §16.2, §16.4). */
export const DEPTH_BUILDINGS: readonly BuildingId[] = [
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
  "rocket_site",
  "power_plant",
  "dam",
];

export interface DepthBuildInput {
  building: BuildingId;
  count: number;
  /** The region is the country's core. */
  core: boolean;
  /** FACILITY_IDS index + 1 of the facility built or queued in the region, 0 none. */
  facility: number;
  researched: ReadonlySet<WwTechId>;
  /** The region's infrastructure level. */
  infra: number;
  /** The lobby's ww1936Nukes. */
  nukesOn: boolean;
  /** sp_flying_bomb is done (rocket sites). */
  flyingBombDone: boolean;
  /** Built plus queued levels (rocket_site) or plants (power_plant) of the region. */
  levelWithQueue: number;
  /** DAMS index of the region's dam, -1 none; its level now. */
  dam: number;
  damLevel: number;
  /** A dam repair is already queued there. */
  damQueued: boolean;
}

/**
 * Plan Task 1 Step 12: the P6 buildings' rules on top of P1 buildBlockOf
 * (null for any other building). A facility: a core region, one per
 * region, its tech (the nuclear one: infrastructure ≥ 3 and the lobby's
 * nukes on). A rocket site: sp_flying_bomb done, up to level 3. A power
 * plant: a shared slot, up to 3 a region. A dam: only the repair of a
 * destroyed dam (level 0) of the region.
 */
export function depthBuildBlock(i: DepthBuildInput): WwOrderBlock | null {
  const b = i.building;
  const f = FACILITY_IDS.indexOf(b as (typeof FACILITY_IDS)[number]);
  if (f >= 0) {
    if (!i.core) return "not_buildable";
    if (b === "facility_nuclear" && (!i.nukesOn || i.infra < 3)) {
      return "not_buildable";
    }
    const tech = BUILDING_TECH[b];
    if (tech !== undefined && !i.researched.has(tech)) return "no_tech";
    return i.facility !== 0 || i.count > (SLOT_BUILDING_MAX[b] ?? 1)
      ? "no_slots"
      : null;
  }
  if (b === "rocket_site") {
    if (!i.flyingBombDone) return "project_locked";
    return i.levelWithQueue + i.count > (LEVEL_MAX[b] ?? 3)
      ? "infra_max"
      : null;
  }
  if (b === "power_plant") {
    return i.levelWithQueue + i.count > (SLOT_BUILDING_MAX[b] ?? 3)
      ? "no_slots"
      : null;
  }
  if (b === "dam") {
    if (i.dam < 0 || i.dam >= DAMS.length) return "not_buildable";
    return i.damLevel !== 0 || i.damQueued || i.count !== 1
      ? "infra_max"
      : null;
  }
  return null;
}
