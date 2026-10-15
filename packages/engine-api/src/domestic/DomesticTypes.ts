// Domestic mode: the shared vocabulary of the science / political layer.
// Data (costs, effects, unlocks) lives in engine-lib/domestic; this file only
// holds ids and shapes, so schemas and read views can name them.

export const TECH_IDS = [
  // Era 1
  "currency",
  "navigation",
  "fortification",
  "academia",
  "bureaucracy",
  // Era 2
  "railroad",
  "banking",
  "steel_ships",
  "conscription",
  "scientific_method",
  "printing_press",
  // Era 3
  "industrialization",
  "global_trade",
  "rocketry",
  "radar",
  "manhattan_project",
  "computers",
  // Era 4
  "globalization",
  "thermonuclear",
  "mirv",
  "space_program",
] as const;
export type TechId = (typeof TECH_IDS)[number];

export const STAT_KEYS = [
  "goldIncome",
  "cityTax",
  "allGold",
  "trade",
  "tradeShip",
  "train",
  "foreignTrade",
  "alliedTrade",
  "tradeShipSpawn",
  "science",
  "political",
  "instituteOutput",
  "adminOutput",
  "researchTime",
  "lawCost",
  "goldPaymentCost",
  "maxTroops",
  "troopRegen",
  "recruitCost",
  "troopUpkeep",
  "upkeepFreeBand",
  "attackLoss",
  "defenseLoss",
  "attackSpeed",
  "expansionSpeed",
  "buildCost",
  "portCost",
  "siloSamCost",
  "nukeCost",
  "defensePostCost",
  "buildTime",
  "cityBuildTime",
  "defensePost",
  "samRange",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const CONDITIONS = [
  "attacking",
  "notAttacking",
  "troopsAtMostHalf",
] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Book of Laws categories (spec §5.2), in the spec's order. */
export const LAW_IDS = [
  "trade",
  "taxation",
  "construction",
  "learning",
  "service",
  "doctrine",
  "mobilization",
  "nuclear",
  "diplomacy",
  "opinion",
  "religion",
] as const;
export type LawId = (typeof LAW_IDS)[number];

/** A law's two options, as in the spec table (A / B). */
export const LAW_OPTIONS = ["A", "B"] as const;
export type LawOption = (typeof LAW_OPTIONS)[number];

/** Spec §6: tier 0, three tier-1 and three tier-2 governments. */
export const GOVERNMENT_IDS = [
  "chiefdom",
  "monarchy",
  "republic",
  "theocracy",
  "democracy",
  "fascism",
  "communism",
] as const;
export type GovernmentId = (typeof GOVERNMENT_IDS)[number];

/** Effects that aren't a stat percent (the flag table of spec §7.2). */
export const POLICY_FLAGS = [
  "noForeignTrade",
  "noProductionUpkeep",
  "researchSubsidy",
  "feudal",
  "tithe",
] as const;
export type PolicyFlag = (typeof POLICY_FLAGS)[number];

export interface Modifier {
  stat: StatKey;
  /** Percent change: +30 means x1.3, -25 means x0.75. */
  pct: number;
  /** Only applies while the condition holds; always when absent. */
  when?: Condition;
}

/** What rules code (Config, on engine and client) reads of a player's domestic state. */
export interface DomesticView {
  /** Summed, capped modifier percent for `stat`; 0 when nothing applies. */
  pct(stat: StatKey): number;
  hasTech(tech: TechId): boolean;
  /** Troops stop regrowing at this percent of max troops (10..100). */
  recruitTargetPct(): number;
}

export interface ResearchProgress {
  tech: TechId;
  ticksLeft: number;
  totalTicks: number;
}

/** Domestic state as sent worker -> main thread on PlayerUpdate. Never mutated. */
export interface DomesticData {
  /** Whole points available to spend. */
  science: number;
  political: number;
  /** Whole points produced since spawn (never decreases). */
  cumulativeScience: number;
  cumulativePolitical: number;
  /** Points produced in the last processed second. */
  sciencePerSec: number;
  politicalPerSec: number;
  techs: TechId[];
  research: ResearchProgress | null;
  recruitTargetPct: number;
}
