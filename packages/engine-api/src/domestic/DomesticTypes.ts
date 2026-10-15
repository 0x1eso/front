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
  /** The running (or just completed) victory project; absent when none. */
  project?: VictoryProjectProgress;
}

/** Domestic victory projects (spec §8): the science and the political one. */
export const VICTORY_PROJECT_KINDS = ["science", "political"] as const;
export type VictoryProjectKind = (typeof VICTORY_PROJECT_KINDS)[number];

/** A running victory project, as stored and as sent to clients. */
export interface VictoryProjectProgress {
  kind: VictoryProjectKind;
  /** The research institute / admin office the project runs in. */
  hostUnitId: number;
  /** 0 once the project is complete. */
  ticksLeft: number;
  totalTicks: number;
  /** Political project only: held back last second because its owner was attacking. */
  paused: boolean;
}

/** How a domestic-mode game was won (WinUpdate.reason). */
export const WIN_REASONS = [
  "conquest",
  "science",
  "political",
  "score",
] as const;
export type WinReason = (typeof WIN_REASONS)[number];
