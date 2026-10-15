import { Difficulty } from "@openfront/engine-api/game/GameTypes";

// Domestic mode tunables (spec §11). Rates are per second unless noted; the
// engine runs the domestic economy once every DOMESTIC_INTERVAL_TICKS.

export const DOMESTIC_INTERVAL_TICKS = 10;
/** Science and political power are stored as integer milli-points. */
export const MILLI = 1000;

/** Territory output: this many points per second per sqrt(land share %). */
export const TERRITORY_YIELD_PER_SQRT_PCT = 0.5;
/** Research institute / admin office output per level. */
export const BUILDING_YIELD_PER_LEVEL = 1;
/** Research institute / admin office gold upkeep per level. */
export const BUILDING_UPKEEP_PER_LEVEL = 50n;
export const BUILDING_BASE_COST = 100_000;
export const BUILDING_MAX_COST = 1_000_000;
export const BUILDING_CONSTRUCTION_TICKS = 5 * 10;

/** Extra base gold per tick per city level (150 gold/s). */
export const CITY_TAX_PER_LEVEL_PER_TICK = 15;

export const RECRUIT_COST_PER_1000_TROOPS = 50;
/** Troops up to this percent of max troops cost no upkeep. */
export const UPKEEP_FREE_BAND_PCT = 40;
export const UPKEEP_GOLD_PER_1000_EXCESS = 1.5;
export const DESERTION_PCT_PER_SEC = 1;
export const DEMOBILIZE_PCT_PER_SEC = 1;

export const RECRUIT_TARGET_MIN_PCT = 10;
export const RECRUIT_TARGET_MAX_PCT = 100;
export const RECRUIT_TARGET_DEFAULT_PCT = 100;

/** Gold per missing point when paying a research shortfall. */
export const GOLD_PER_POINT = 1000;

export const TECH_COST_BY_ERA = [100, 250, 500, 1000] as const;
export const TECH_SECONDS_BY_ERA = [20, 30, 45, 60] as const;
export const SPACE_PROGRAM_COST = 4000;
export const TECHS_REQUIRED_FROM_PREVIOUS_ERA = 2;

/** Banking: stored gold earns 2% per minute, i.e. gold / 3000 per second. */
export const INTEREST_DIVISOR_PER_SEC = 3000n;
export const INTEREST_CAP_PER_SEC = 1500n;

/** Nations' science / political output by difficulty (like troop multipliers). */
export const NATION_YIELD_MULT: Record<Difficulty, number> = {
  [Difficulty.Easy]: 0.7,
  [Difficulty.Medium]: 0.85,
  [Difficulty.Hard]: 1,
  [Difficulty.Impossible]: 1.15,
};

export const STAT_CAPS = {
  combatLossMinPct: -50,
  reductionMinPct: -60,
  increaseMaxPct: 200,
} as const;
