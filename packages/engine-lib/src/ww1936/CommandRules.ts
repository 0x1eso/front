// World War 1936 P6 (P6 spec §4): command power, general and admiral
// traits, field marshals, medals. The tables are the foundation's (plan
// Task 1 Step 6); lane D fills traitAssignBlock and ARMY_SPIRIT_STATS
// (Task 2).
import {
  ARMY_SPIRITS,
  ArmySpirit,
  CP_DAY_MILLI,
  CP_FM_UPKEEP_MILLI,
  FM_TRAITS,
  WW_MAX_FIELD_MARSHALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { GeneralTrait } from "@openfront/engine-api/ww1936/LandTypes";
import { TRAIT_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import type { AdmiralTrait } from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** Spec §4.2 table: the 12 new general traits. kind "terrain" ones come from 60 battle days in `terrain`. */
export interface GeneralTraitDef {
  kind: "terrain" | "assign";
  level: number;
  needs?: GeneralTrait;
  cp: number;
  /** P2 terrainDays index (entries 4.. are forest+jungle, urban, marsh). */
  terrainIdx?: number;
}

export const NEW_GENERAL_TRAITS: Readonly<
  Partial<Record<GeneralTrait, GeneralTraitDef>>
> = {
  forest_expert: { kind: "terrain", level: 1, cp: 0, terrainIdx: 4 },
  urban_expert: { kind: "terrain", level: 1, cp: 0, terrainIdx: 5 },
  swamp_expert: { kind: "terrain", level: 1, cp: 0, terrainIdx: 6 },
  infantry_expert: {
    kind: "assign",
    level: 2,
    needs: "infantry_officer",
    cp: 15,
  },
  armor_expert: { kind: "assign", level: 2, needs: "panzer_leader", cp: 20 },
  artillery_officer: { kind: "assign", level: 1, cp: 15 },
  engineer_officer: { kind: "assign", level: 2, cp: 15 },
  trickster: { kind: "assign", level: 3, cp: 20 },
  commando: { kind: "assign", level: 2, cp: 15 },
  guerrilla_fighter: { kind: "assign", level: 2, cp: 15 },
  skirmisher: { kind: "assign", level: 1, cp: 15 },
  ambusher: {
    kind: "assign",
    level: 3,
    needs: "defensive_doctrine",
    cp: 25,
  },
};
export const TERRAIN_TRAIT_DAYS = 60;
export const FM_EXTRA_TRAIT_CP = 20;
export const FM_TRAIT_LEVELS: readonly number[] = [3, 5];
export const ADMIRAL_ASSIGN_CP = 15;
export const ADMIRAL_ASSIGN_LEVEL = 2;

export function traitSlots(level: number): number {
  return TRAIT_SLOTS[Math.max(1, Math.min(5, level))];
}

/** Spec §4.3: field marshals a country may have. */
export function fieldMarshalCap(divisions: number): number {
  return Math.min(WW_MAX_FIELD_MARSHALS, 1 + Math.floor(divisions / 72));
}

/** Spec §4.1: a day's command power, milli (can be negative with upkeep). */
export function cpDayMilli(cpGainPct: number, fieldMarshals: number): number {
  return (
    Math.floor((CP_DAY_MILLI * (100 + cpGainPct)) / 100) -
    CP_FM_UPKEEP_MILLI * fieldMarshals
  );
}

/** Spec §4.3 / plan decision 14: a field marshal's share in bp of a division modifier. */
export function fieldMarshalBp(
  att: number,
  dfn: number,
): { attackBp: number; defenseBp: number } {
  return { attackBp: att * 250, defenseBp: dfn * 250 };
}

export interface FmTraitStats {
  attackBp?: number;
  defenseBp?: number;
  planSpeedPct?: number;
  planMaxBp?: number;
  entrenchSpeedPct?: number;
  supplyUsePct?: number;
  recoveryPct?: number;
  org?: number;
  groupArmies?: number;
}

/** Spec §4.2 FM traits (whole army group). planMaxBp etc. use the P2 stat names. */
export const FM_TRAIT_STATS: Readonly<
  Record<(typeof FM_TRAITS)[number], FmTraitStats>
> = {
  fm_offensive: { attackBp: 500, planSpeedPct: 10 },
  fm_defensive: { defenseBp: 500, entrenchSpeedPct: 25 },
  fm_logistics: { supplyUsePct: -10 },
  fm_thorough: { planMaxBp: 1_000 },
  fm_fast_planner: { planSpeedPct: 20 },
  fm_inspiring: { recoveryPct: 10, org: 3 },
  fm_strategist: { attackBp: 300, defenseBp: 300, groupArmies: 1 },
};

export interface TraitAssignInput {
  admiral: boolean;
  level: number;
  traits: readonly string[];
  slots: number;
  trait: string;
  cpMilli: number;
  isFm: boolean;
  fmTraits: readonly string[];
}

/** Refusal of trait_assign (plan decision 40). D fills (spec §4.2). */
export function traitAssignBlock(
  i: TraitAssignInput,
): "no_cp" | "trait_unavailable" | null {
  return "trait_unavailable";
}

export const MEDAL_STATS = {
  medal_valor: { attackBp: 300 },
  medal_defense: { defenseBp: 300 },
  medal_service: { recoveryPct: 10 },
} as const;

/**
 * Spec §4.2 (plan Task 1 Step 15): the four P6 admiral traits as P4
 * admiral modifiers, percent. torpedoPct: torpedo attack; escortPct: convoy
 * escort; positioningPct: positioning; raidLossPct: convoy-raid losses
 * taken; visibilityPct: the fleet's visibility.
 */
export interface AdmiralTraitStats {
  torpedoPct?: number;
  escortPct?: number;
  positioningPct?: number;
  raidLossPct?: number;
  visibilityPct?: number;
}
export const ADMIRAL_TRAIT_STATS: Readonly<
  Partial<Record<AdmiralTrait, AdmiralTraitStats>>
> = {
  night_fighter: { torpedoPct: 15 },
  convoy_master: { escortPct: 20 },
  fleet_tactician: { positioningPct: 10 },
  blockade_runner: { raidLossPct: -15, visibilityPct: -10 },
};

/** Spec §4.4 officer corps: each army spirit's stats (D fills from the spec table). */
export const ARMY_SPIRIT_STATS: Readonly<Record<ArmySpirit, Partial<WwStats>>> =
  Object.fromEntries(ARMY_SPIRITS.map((s) => [s, {}])) as Record<
    ArmySpirit,
    Partial<WwStats>
  >;
