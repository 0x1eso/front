// World War 1936 P6 (P6 spec §4): command power, general and admiral
// traits, field marshals, medals. The tables are the foundation's (plan
// Task 1 Step 6); lane D (Task 2) fills traitAssignBlock and
// ARMY_SPIRIT_STATS and adds the shared judges the screens and the engine
// both call (spiritPickBlock, promoteFmBlock) and the army group front split.
import {
  ArmySpirit,
  CP_DAY_MILLI,
  CP_FM_UPKEEP_MILLI,
  FM_PROMOTE_CP,
  FM_PROMOTE_PP,
  FM_TRAITS,
  SPIRIT_PICK_XP,
  SPIRIT_SWITCH_XP,
  WW_GROUP_ARMIES,
  WW_MAX_FIELD_MARSHALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { GeneralTrait } from "@openfront/engine-api/ww1936/LandTypes";
import { TRAIT_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import {
  AdmiralTrait,
  WW_ADMIRAL_TRAIT_MAX,
} from "@openfront/engine-api/ww1936/NavyTypes";
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

/** Spec §4.2: the admiral traits bought with command power (P4's six come from data). */
export const ASSIGNABLE_ADMIRAL_TRAITS: readonly AdmiralTrait[] = [
  "night_fighter",
  "convoy_master",
  "fleet_tactician",
  "blockade_runner",
];

/** Spec §4.2: field marshal traits a marshal may hold — one at promotion, one more at levels 3 and 5. */
export function fmTraitAllowance(level: number): number {
  return 1 + FM_TRAIT_LEVELS.filter((l) => level >= l).length;
}

/** Spec §4.2: the command power a trait_assign costs (0: not bought). */
export function traitCost(trait: string, admiral: boolean): number {
  if (admiral) {
    return (ASSIGNABLE_ADMIRAL_TRAITS as readonly string[]).includes(trait)
      ? ADMIRAL_ASSIGN_CP
      : 0;
  }
  if ((FM_TRAITS as readonly string[]).includes(trait)) {
    return FM_EXTRA_TRAIT_CP;
  }
  const def = NEW_GENERAL_TRAITS[trait as GeneralTrait];
  return def?.kind === "assign" ? def.cp : 0;
}

/**
 * Refusal of trait_assign (plan decision 40, spec §4.2). A general's trait:
 * an assigned one of NEW_GENERAL_TRAITS, its level and prerequisite, a free
 * slot (every trait held counts, traitSlots); never a field marshal (his
 * general traits would lead no army). A field marshal's: one more at
 * levels 3 and 5 (fmTraitAllowance). An admiral's: one of the four, level
 * 2, at most WW_ADMIRAL_TRAIT_MAX held. Then the command power.
 */
export function traitAssignBlock(
  i: TraitAssignInput,
): "no_cp" | "trait_unavailable" | null {
  if (i.traits.includes(i.trait) || i.fmTraits.includes(i.trait)) {
    return "trait_unavailable";
  }
  const cp = traitCost(i.trait, i.admiral);
  if (cp === 0) return "trait_unavailable";
  if (i.admiral) {
    if (
      i.level < ADMIRAL_ASSIGN_LEVEL ||
      i.traits.length >= WW_ADMIRAL_TRAIT_MAX
    ) {
      return "trait_unavailable";
    }
  } else if ((FM_TRAITS as readonly string[]).includes(i.trait)) {
    if (!i.isFm || i.fmTraits.length >= fmTraitAllowance(i.level)) {
      return "trait_unavailable";
    }
  } else {
    const def = NEW_GENERAL_TRAITS[i.trait as GeneralTrait]!;
    if (
      i.isFm ||
      i.level < def.level ||
      (def.needs !== undefined && !i.traits.includes(def.needs)) ||
      i.traits.length >= i.slots
    ) {
      return "trait_unavailable";
    }
  }
  return i.cpMilli < cp * 1000 ? "no_cp" : null;
}

/** Spec §4.4: the experience an officer corps pick costs (a switch more). */
export function spiritCost(current: number): number {
  return current >= 0 ? SPIRIT_SWITCH_XP : SPIRIT_PICK_XP;
}

export interface SpiritPickInput {
  /** ARMY_SPIRIT_CATEGORIES index. */
  category: number;
  /** ARMY_SPIRITS index. */
  spirit: number;
  /** The category's pick now, -1 none. */
  current: number;
  lockUntil: number;
  day: number;
  /** Whole experience of the category's domain. */
  xp: number;
}

/** Refusal of army_spirit_pick (spec §4.4): the category's own, not the same, unlocked, the experience. */
export function spiritPickBlock(
  i: SpiritPickInput,
): "bad_index" | "doctrine_locked" | "no_xp" | null {
  if (Math.floor(i.spirit / 3) !== i.category || i.spirit === i.current) {
    return "bad_index";
  }
  if (i.lockUntil > i.day) return "doctrine_locked";
  return i.xp < spiritCost(i.current) ? "no_xp" : null;
}

/** Spec §4.3: a general a field marshal may be made of — level 3, or skills summing to 12, or a K5 marshal row. */
export function fmEligible(
  level: number,
  skillSum: number,
  listed: boolean,
): boolean {
  return listed || level >= 3 || skillSum >= 12;
}

export interface PromoteInput {
  /** Already a field marshal. */
  isFm: boolean;
  /** Serves today (roster dates, purges, advisors). */
  serves: boolean;
  level: number;
  skillSum: number;
  /** A START_FIELD_MARSHALS row names him now. */
  listed: boolean;
  fieldMarshals: number;
  divisions: number;
  cpMilli: number;
  /** Whole political power. */
  pp: number;
}

/** Refusal of promote_fm (spec §4.3): who, the marshal cap, the condition, 30 command power and 25 PP. */
export function promoteFmBlock(
  i: PromoteInput,
):
  | "general_unavailable"
  | "fm_limit"
  | "trait_unavailable"
  | "no_cp"
  | "no_pp"
  | null {
  if (i.isFm || !i.serves) return "general_unavailable";
  if (i.fieldMarshals >= fieldMarshalCap(i.divisions)) return "fm_limit";
  if (!fmEligible(i.level, i.skillSum, i.listed)) return "trait_unavailable";
  if (i.cpMilli < FM_PROMOTE_CP * 1000) return "no_cp";
  return i.pp < FM_PROMOTE_PP ? "no_pp" : null;
}

/** Spec §4.3: the armies an army group may hold (fm_strategist +1). */
export function groupArmyCap(fmTraits: number): number {
  let n = WW_GROUP_ARMIES;
  for (let b = 0; b < FM_TRAITS.length; b++) {
    if ((fmTraits & (1 << b)) !== 0) {
      n += FM_TRAIT_STATS[FM_TRAITS[b]].groupArmies ?? 0;
    }
  }
  return n;
}

/** The non-combat FM_TRAIT_STATS of a trait mask, summed (attack and defence: CombatRules.fmTraitBp). */
export function fmArmyStats(
  fmTraits: number,
): Required<Omit<FmTraitStats, "attackBp" | "defenseBp" | "groupArmies">> {
  const out = {
    planSpeedPct: 0,
    planMaxBp: 0,
    entrenchSpeedPct: 0,
    supplyUsePct: 0,
    recoveryPct: 0,
    org: 0,
  };
  for (let b = 0; b < FM_TRAITS.length; b++) {
    if ((fmTraits & (1 << b)) === 0) continue;
    const s = FM_TRAIT_STATS[FM_TRAITS[b]];
    out.planSpeedPct += s.planSpeedPct ?? 0;
    out.planMaxBp += s.planMaxBp ?? 0;
    out.entrenchSpeedPct += s.entrenchSpeedPct ?? 0;
    out.supplyUsePct += s.supplyUsePct ?? 0;
    out.recoveryPct += s.recoveryPct ?? 0;
    out.org += s.org ?? 0;
  }
  return out;
}

/**
 * Spec §4.3 ag_front (deterministic): the front regions in ascending
 * order, cut from the front into one stretch per army — army i (in the
 * group's army order) gets floor(n × div_i / Σdiv) regions, the remainder
 * one each from the first army on. An army may get an empty stretch.
 */
export function splitFront(
  front: readonly number[],
  divisions: readonly number[],
): number[][] {
  const regions = [...new Set(front)].sort((a, b) => a - b);
  const n = regions.length;
  const k = divisions.length;
  if (k === 0) return [];
  const total = divisions.reduce((a, b) => a + Math.max(0, b), 0);
  const share = divisions.map((x) =>
    total <= 0 ? 0 : Math.floor((n * Math.max(0, x)) / total),
  );
  let rest = n - share.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % k, rest--) share[i]++;
  const out: number[][] = [];
  let at = 0;
  for (const s of share) {
    out.push(regions.slice(at, at + s));
    at += s;
  }
  return out;
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

/**
 * Spec §4.4 officer corps: each army spirit's stats, on the keys the P2–P4
 * readers read (lane D's report lists the approximations). Omitted (no
 * reader): as_political_officers' retreat threshold, as_aggressive_fleet's
 * and as_fleet_preservation's retreat thresholds. "New division
 * experience ±10" is divXpGainPct (P2's training has no hook to add a
 * division's starting experience).
 */
export const ARMY_SPIRIT_STATS: Readonly<Record<ArmySpirit, Partial<WwStats>>> =
  {
    // Land · recruitment and training
    as_conscript: { trainPct: -10, divXpGainPct: -10 },
    as_professional: { divXpGainPct: 10, armyXpMilli: 50 },
    as_reserve: { reinforcePct: 25 },
    // Land · command
    as_mission_command: { planSpeedPct: 10, breakthroughPct: 5 },
    as_central_command: { planMaxBp: 500, defensePct: 3 },
    // (approx) org +5 on every division: the infantry battalions' and the
    // armour and motor divisions' org keys.
    as_political_officers: { infOrg: 5, mechOrg: 5 },
    // Land · formation
    as_combined_arms: { supportCompanyPct: 25 },
    as_mass_formation: { excessWidthCutPct: 50 },
    as_elite_units: { divXpGainPct: 25 },
    // Naval · training
    // (approx) ship org +5: the navy's org key (read when the P4 readers take it).
    as_fleet_drill: { navyXpMilli: 50, navalOrg: 5 },
    // (approx) torpedoes +10%: the submarines' torpedo key, the one P4 reads.
    as_night_training: { subTorpedoPct: 10 },
    as_damage_control: { navalDamageTakenPct: -5, repairPct: 15 },
    // Naval · operations
    as_aggressive_fleet: { navyAttackPct: 5 },
    // (approx) losses when sunk −10%: naval damage taken.
    as_fleet_preservation: { navalDamageTakenPct: -10 },
    as_joint_ops: { invasionPrepPct: -15 },
    // Air · personnel
    as_pilot_school: { airLossCutPct: 10 },
    as_ground_crew: { sortieEffPct: 5 },
    as_air_college: { airXpMilli: 50 },
    // Air · command
    // (approx) the zone's bomber losses: air losses.
    as_escort_first: { airLossCutPct: 10 },
    as_independent_air: { stratBombPct: 10 },
    as_army_cooperation: { casPct: 10 },
  };
