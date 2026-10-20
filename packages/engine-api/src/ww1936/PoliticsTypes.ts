// World War 1936 P3 — politics and national focus
// (docs/superpowers/specs/2026-10-20-ww1936-p3-politics-design.md).
// zbin and snapshots store these lists by position: append only.
import type { CountryTag, FactionId } from "./Countries";
import { FACTION_IDS } from "./Countries";
import type { EquipmentType } from "./EconomyTypes";
import type { Condition, Effect } from "./PoliticsDsl";

// ---- Ideologies (spec §5.1) ----

export const IDEOLOGIES = [
  "democratic",
  "communist",
  "fascist",
  "neutral",
] as const;
export type Ideology = (typeof IDEOLOGIES)[number];
export const IDEO_DEM = 0;
export const IDEO_COM = 1;
export const IDEO_FAS = 2;
export const IDEO_NEU = 3;
export const POP_TOTAL = 10_000;

// ---- Stats (spec §3, plan decision 10) ----

export const WW_STAT_KEYS = [
  // P1 TechEffects, same order (14)
  "constructionPct",
  "slotPct",
  "effCapBp",
  "outputPct",
  "extractionPct",
  "retentionBp",
  "researchPct",
  "attackPct",
  "defensePct",
  "speedPct",
  "vehicleBonusPct",
  "gunBonusPct",
  "recruitablePct",
  "trainPct",
  // P2 TechEffects (P2 plan decision 11), same order (20)
  "fortConstructionPct",
  "railConstructionPct",
  "railSpeedPct",
  "breakthroughPct",
  "orgPct",
  "recoveryPct",
  "planSpeedPct",
  "planMaxBp",
  "entrenchMax",
  "supplyUsePct",
  "armyXpMilli",
  "generalXpPct",
  "winterPenaltyPct",
  "desertAttackPct",
  "forestDefensePct",
  "mechBreakPct",
  "mechOrg",
  "artillerySoftPct",
  "infTrainCutPct",
  "infOrg",
  // P3 economy
  "civConstructionPct",
  "milConstructionPct",
  "infraConstructionPct",
  "consumerGoodsPp",
  "manpowerGrowthPct",
  "nonCoreManpowerPp",
  "tradeCostPct",
  // P3 research by branch
  "rsInfantryPct",
  "rsArtilleryPct",
  "rsArmorPct",
  "rsAirPct",
  "rsIndustryPct",
  "rsElectronicsPct",
  "rsDoctrinePct",
  "rsNavalPct",
  // P3 politics
  "ppGainPct",
  "ppMilli",
  "stabilityBp",
  "warSupportBp",
  "stabilityWeeklyBp",
  "warSupportWeeklyBp",
  "focusSpeedPct",
  "advisorCostPct",
  "lawCostPct",
  "decisionCostPct",
  "conscriptionCostPct",
  // P3 ideology
  "driftDemBp",
  "driftComBp",
  "driftFasBp",
  "driftNeuBp",
  "coupResistPct",
  // P3 diplomacy
  "justifyCostPct",
  "justifyTimePct",
  "tensionPct",
  "diploCostPct",
  "surrenderPp",
  "enemyJustifyTimePct",
  // reserved for P4 / P6 (values only pile up)
  "dockOutputPct",
  "navyAttackPct",
  "airAttackPct",
  "fuelPct",
  "intelPct",
] as const;
export type WwStatKey = (typeof WW_STAT_KEYS)[number];
export type WwStats = Record<WwStatKey, number>;
/** WW_STAT_KEYS[0..34) are P1+P2 TechEffects in their order. */
export const WW_TECH_STAT_COUNT = 34;
/** The drift stat of each ideology, IDEOLOGIES order. */
export const DRIFT_KEYS: readonly WwStatKey[] = [
  "driftDemBp",
  "driftComBp",
  "driftFasBp",
  "driftNeuBp",
];

// ---- Advisors (spec §8) ----

export const ADVISOR_SLOTS = [
  "political",
  "political",
  "political",
  "army_chief",
  "staff",
  "staff",
  "industry",
  "research",
] as const;
export type AdvisorSlot = (typeof ADVISOR_SLOTS)[number];
export const ADVISOR_COST: Readonly<Record<AdvisorSlot, number>> = {
  political: 150,
  army_chief: 100,
  staff: 100,
  industry: 100,
  research: 100,
};
export const TRAIT_BRANCHES = [
  "political",
  "army_chief",
  "staff",
  "theorist",
  "industry",
  "research",
  "leader",
] as const;
export type TraitBranch = (typeof TRAIT_BRANCHES)[number];
/** Which trait branches a slot takes (spec §8.1). */
export const SLOT_BRANCHES: Readonly<
  Record<AdvisorSlot, readonly TraitBranch[]>
> = {
  political: ["political"],
  army_chief: ["army_chief"],
  staff: ["staff", "theorist"],
  industry: ["industry"],
  research: ["research"],
};
export const TRAIT_IDS = [
  // spec §8.3 (26)
  "administrator",
  "orator",
  "security_chief",
  "propagandist",
  "fiscal_hawk",
  "diplomat",
  "hawk",
  "conciliator",
  "labour_organizer",
  "planner",
  "party_ideologue",
  "chief_offense",
  "chief_defense",
  "chief_maneuver",
  "chief_organizer",
  "staff_planner",
  "staff_logistics",
  "staff_training",
  "theorist_land",
  "theorist_armor",
  "ind_construction",
  "ind_production",
  "ind_resources",
  "rs_science",
  "rs_armor",
  "rs_aircraft",
  // leader traits (spec §5.7, §8.3 last line; names by K6)
  "war_leader",
  "peace_negotiator",
  "new_dealer",
  "popular_front",
  "party_boss",
  "generalissimo",
  "reformer",
  "caretaker",
  "strongman",
  "monarch",
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

// ---- Diplomacy (spec §14–§16) ----

export const WAR_GOAL_TYPES = ["conquer", "claim", "topple"] as const;
export type WarGoalType = (typeof WAR_GOAL_TYPES)[number];
export const DIPLO_ASKS = [
  "faction_invite",
  "faction_request",
  "nap",
  "access",
] as const;
export type DiploAsk = (typeof DIPLO_ASKS)[number];
export const TENSION_ACTS = [
  "justified",
  "declare_goal",
  "declare_no_goal",
  "capitulation",
] as const;
export type TensionAct = (typeof TENSION_ACTS)[number];

/** Plan decision 8: the 3 starting factions keep their ids, new ones are f3, f4… */
export type FactionKey = FactionId | `f${number}`;
export function factionKeyOf(idx: number): FactionKey {
  return idx < FACTION_IDS.length ? FACTION_IDS[idx] : `f${idx}`;
}
export function factionIdxOfKey(key: FactionKey): number {
  const i = (FACTION_IDS as readonly string[]).indexOf(key);
  return i >= 0 ? i : Number(key.slice(1));
}

// ---- P4 values (plan decision 20) ----

export const RESERVE_KEYS = [
  "air_base",
  "naval_research",
  "synthetic_refinery",
  "bomb_damage_cut",
  "cas",
  "sub_doctrine",
  "fleet_doctrine",
  "radar",
  "fighter_research",
  "bomber_research",
  "convoy",
  "carriers",
  "naval_air",
  "destroyers",
] as const;
export type ReserveKey = (typeof RESERVE_KEYS)[number];

// ---- Orders (spec §22.3, plan decision 3) ----

export const POL_ORDER_KINDS = [
  "focus_start",
  "focus_queue",
  "focus_cancel",
  "focus_unqueue",
  "advisor_hire",
  "advisor_fire",
  "decision_take",
  "decision_cancel",
  "event_choose",
  "justify",
  "justify_cancel",
  "guarantee",
  "guarantee_end",
  "nap_offer",
  "nap_break",
  "access_ask",
  "access_revoke",
  "faction_create",
  "faction_invite",
  "faction_request",
  "faction_kick",
  "faction_leave",
  "faction_dissolve",
  "improve_relations",
] as const;
export type PolOrderKind = (typeof POL_ORDER_KINDS)[number];

// ---- Constants (spec §26.3) ----

export const WW_PP_CAP = 1500;
export const WW_PP_BASE_MILLI = 2000;
export const WW_FOCUS_QUEUE = 1;
export const WW_MAX_PENDING_EVENTS = 8;
export const WW_EVENT_CHAIN_DEPTH = 16;
export const WW_EVENT_TIMEOUT_TICKS = 200;
export const WW_EVENT_TIMEOUT_LONG_TICKS = 300;
export const WW_TRIGGER_CHECK_DAYS = 5;
export const WW_WAR_GOAL_DAYS = 365;
export const WW_JUSTIFY_DAYS = 100;
export const WW_NAP_BREAK_DAYS = 180;
export const WW_MAX_FACTIONS = 15;
export const WW_HISTORY_EVENT_PCT = 90;
export const WW_BRANCH_DEVIATE_PCT = 10;
export const WW_BRANCH_DEVIATE_POLITICAL_PCT = 5;
export const WW_MAX_RESEARCH_SLOTS = 6;
export const WW_ELECTION_DAYS = 1461;
export const WW_CRISIS_DAYS = 30;
export const WW_CRISIS_COOLDOWN_DAYS = 90;
export const WW_ADVISOR_LOCK_DAYS = 30;
export const WW_MAX_RESEARCH_BONUSES = 5;
export const WW_MAX_OPINIONS = 400;
export const WW_TENSION_START_BP = 400;
export const WW_BEAT_SKIP_ODDS = 10;
export const WW_BEAT_MAX_DELAY_DAYS = 20;
export const WW_BEAT_WINDOW_DEFAULT_DAYS = 30;
export const WW_BEAT_MAX_SKIP_AHEAD = 3;
export const WW_IMPROVE_RELATIONS_DAYS = 180;
export const WW_NEWS_KEEP = 30;
/** Cooldown value of a decision that can be taken once (no cooldownDays). */
export const WW_FOREVER = 1_000_000_000;
/** Spec §4.3 base costs in PP. */
export const WW_COST = {
  guarantee: 25,
  nap: 25,
  access: 10,
  improve: 10,
  factionCreate: 50,
  factionInvite: 25,
  factionRequest: 25,
  napBreak: 50,
  titledGeneral: 25,
} as const;

// ---- Content shapes (spec §9.1, §11.1, §12.1, §13.1, §18.2, §19.9, §19.10) ----

export type FocusId = string;
export type EventId = string;
export type DecisionId = string;
export type SpiritId = string;
export type PersonId = string;
export type FlagId = string;
export type RegionGroupId = string;
export type TemplateUnlockId = string;
export const FOCUS_TREES = ["generic", "DEU", "GBR", "SUN"] as const;
export type FocusTreeId = (typeof FOCUS_TREES)[number];
export const FOCUS_BRANCHES = [
  "politics",
  "diplomacy",
  "industry",
  "research",
  "army",
  "air",
  "navy",
] as const;
export type FocusBranch = (typeof FOCUS_BRANCHES)[number];
export const DECISION_CATEGORIES = [
  "political",
  "economy",
  "military",
  "diplomacy",
  "annexation",
  "national",
] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

export interface AiWeight {
  base: number;
  /** factor in percent, applied (floor) when `if` holds for the chooser. */
  mods?: readonly { if: Condition; factor: number }[];
}

export interface FocusDef {
  id: FocusId;
  tree: FocusTreeId;
  /** Grid cell: column 0..19, row 0..14; unique within a tree. */
  x: number;
  y: number;
  days: 35 | 70 | 105;
  branch: FocusBranch;
  /** White silhouette icon name (resources/images/ww1936/focus/<icon>.svg, Task 7). */
  icon: string;
  /** AND of OR groups: [[a, b], [c]] = (a or b) and c. */
  prereq?: readonly (readonly FocusId[])[];
  exclusive?: readonly FocusId[];
  available?: Condition;
  bypass?: Condition;
  cancelIf?: Condition;
  effects: readonly Effect[];
  ai?: AiWeight;
}

export interface BranchPoint {
  id: string;
  /** A focus id; the generic tree may name "@ideo" (Task 2 expands it). */
  historical: FocusId;
  alternatives: readonly FocusId[];
  political: boolean;
}

export interface OptionDef {
  id: string;
  effects: readonly Effect[];
  ai: AiWeight;
  history?: boolean;
  available?: Condition;
}

export const EVENT_PICTURES = [
  "table",
  "crowd",
  "newspaper",
  "border",
  "factory",
  "document",
  "column",
  "map",
] as const;
export type EventPicture = (typeof EVENT_PICTURES)[number];

export interface EventDef {
  id: EventId;
  kind: "country" | "news";
  /** Who a triggered event is checked for; "any": every country. */
  receivers?: readonly CountryTag[] | "any";
  date?: { on: string; to: readonly CountryTag[] };
  trigger?: Condition;
  mtthDays?: number;
  /** Default "country". */
  once?: "country" | "game" | "never";
  cooldownDays?: number;
  timeoutSec?: 20 | 30;
  historyPct?: number;
  humanDefault?: string;
  aiDelayDays?: readonly [number, number];
  options: readonly OptionDef[];
  picture?: EventPicture;
}

export interface DecisionCost {
  pp?: number;
  manpower?: number;
  armyXp?: number;
  equipment?: readonly [EquipmentType, number];
}
export interface DecisionDef {
  id: DecisionId;
  category: DecisionCategory;
  for: readonly CountryTag[] | "any";
  visible?: Condition;
  available?: Condition;
  /** A targeted decision: one line per country for which `among` holds (who = the candidate, "self" = the decider). */
  target?: { among: Condition };
  cost?: DecisionCost;
  cooldownDays?: number;
  days?: number;
  effects?: readonly Effect[];
  completeEffects?: readonly Effect[];
  failIf?: Condition;
  failEffects?: readonly Effect[];
  ai: AiWeight;
  locked?: boolean;
}

export type SpiritRule =
  | "no_faction"
  | "no_justify"
  | "no_elections"
  | "free_guarantees"
  | { dmz: RegionGroupId }
  | { guaranteeGatePct: number }
  | { factionGateMinusPp: number };
export interface SpiritDef {
  id: SpiritId;
  stats: Partial<WwStats>;
  icon: string;
  hidden?: boolean;
  rules?: readonly SpiritRule[];
}

export interface TraitDef {
  id: TraitId;
  branch: TraitBranch;
  stats: Partial<WwStats>;
  /** Only under this ruling ideology (spec §8.3 planner). */
  ideology?: Ideology;
  /** party_ideologue / orator: drift for the ruling ideology, bp a day. */
  rulingDriftBp?: number;
  /** A titled card exists for it (every advisor trait; not leader traits). */
  generic: boolean;
  /** Only while at war (war_leader). */
  atWarOnly?: boolean;
}

export interface PersonDef {
  id: PersonId;
  /** Translation key: ww1936.person.<id>, or a P0 leader key (plan decision 27). */
  nameKey: string;
  country: CountryTag;
  roles: readonly ("leader" | "advisor")[];
  advisor?: { slot: AdvisorSlot; traits: readonly TraitId[] };
  leaderTraits?: readonly TraitId[];
  ideology?: Ideology;
  from?: string;
  until?: string;
  /** P2 GENERALS id of the same person (plan decision 19). */
  alsoGeneral?: string;
  /**
   * Not a candidate by its dates alone: only once an add_advisor_candidate
   * effect opened it (controller ruling for K3: Tizard, Watson-Watt).
   */
  locked?: boolean;
  /** Where the dates and the exclusion check come from (spec §8.4-4). */
  source: string;
}

export type BeatAct =
  | { kind: "declare" | "join"; target: CountryTag }
  | { kind: "decision"; id: DecisionId; target?: CountryTag }
  | { kind: "event"; id: EventId }
  | { kind: "focus"; id: FocusId }
  | {
      kind: "diplo";
      order: "nap" | "guarantee" | "access" | "join_faction" | "invite";
      target: CountryTag;
    };
export interface HistoryBeat {
  id: string;
  date: string;
  actor: CountryTag;
  act: BeatAct;
  safety?: boolean;
  windowDays?: number;
}

export interface CountryPoliticsDef {
  tag: CountryTag;
  ruling: Ideology;
  /** Percent, sums to 100. */
  popularity: readonly [number, number, number, number];
  stability: number;
  warSupport: number;
  tree: FocusTreeId;
  firstElection?: string;
  spirits?: readonly SpiritId[];
  leaders: Partial<Record<Ideology, PersonId>>;
  /** Ideologies with a country-specific government name key (ww1936.gov.<TAG>.<ideology>). */
  govNames?: readonly Ideology[];
  /**
   * The leader on 1936-01-01 when it is not `leaders[ruling]` (controller
   * ruling R7: Japan's Okada, whose later neutral leader is a title).
   */
  startLeader?: PersonId;
}

export interface RegionGroupDef {
  id: RegionGroupId;
  regions: readonly number[];
  owner1936: CountryTag;
}
export interface ClaimDef {
  tag: CountryTag;
  groups: readonly RegionGroupId[];
}
export interface FactionNameDef {
  id: string;
  /** The creator must be one of these (in order of the table, first match wins). */
  creators: readonly CountryTag[];
}
export interface TemplateUnlockDef {
  id: TemplateUnlockId;
  country: CountryTag | "any";
  /** P2 TemplateDef shape: battalion and support id lists. */
  battalions: readonly string[];
  support: readonly string[];
}

// ---- What the screens read (GameUpdateType.WwPolitics, spec §22.4) ----

export interface WwPolSummary {
  smallID: number;
  ruling: number;
  leader: PersonId;
  pop: number[];
  stabBp: number;
  wsBp: number;
  /** Exact for human countries; 0 for the AI. */
  ppMilli: number;
  /** -1: none. */
  faction: number;
  surrenderPct: number;
  focus: FocusId | null;
}
export interface WwFocusCard {
  /** FocusDef index within the tree. */
  idx: number;
  /** 0 open, 1 done, 2 bypassed, 3 running, 4 needs prereq, 5 blocked by condition, 6 exclusive, 7 queued. */
  state: number;
  /** conditionLeaves() numbers of the failing `available` leaves. */
  failing: number[];
}
export interface WwDecisionCard {
  id: DecisionId;
  target: number;
  /** 0 can take, 1 condition, 2 cost, 3 cooldown, 4 running mission. */
  state: number;
  costPp: number;
  cooldownUntil: number;
  failing: number[];
}
/** One explain line of stability or war support (controller ruling R4). */
export interface WwPolLine {
  /** Translation key of the line. */
  key: string;
  bp: number;
}
export interface WwEventCard {
  uid: number;
  eventId: EventId;
  from: number;
  target: number;
  firedTick: number;
  deadlineTick: number;
  aiOption: string;
  /** Options the receiver can pick now, in option order. */
  open: string[];
}
export interface WwPolDetail {
  smallID: number;
  ppGainMilli: number;
  focus: { id: FocusId; progressMilli: number; daysMilli: number } | null;
  queued: FocusId | null;
  cards: WwFocusCard[];
  advisors: (string | null)[];
  advisorLockUntil: number[];
  candidates: string[];
  spirits: { id: SpiritId; untilDay: number }[];
  decisions: WwDecisionCard[];
  missions: {
    id: DecisionId;
    target: number;
    startDay: number;
    endDay: number;
  }[];
  justification: {
    on: number;
    type: WarGoalType;
    progressDays: number;
    totalDays: number;
    blocked: boolean;
  } | null;
  warGoals: { on: number; type: WarGoalType; untilDay: number }[];
  researchBonuses: { branch: string; pct: number; uses: number }[];
  /** Stats by source for the explain lines: tech, laws, spirits, advisors, government, leader, dynamic. */
  statParts: number[][];
  stats: number[];
  stabBaseBp: number;
  wsBaseBp: number;
  nextElectionDay: number;
  crisisDays: number[];
  pending: WwEventCard[];
  /** Controller ruling R4: the lines of today's stability and war support. */
  stabLines: WwPolLine[];
  wsLines: WwPolLine[];
}
export interface WwFactionData {
  idx: number;
  key: FactionKey;
  name: string;
  nameTag: CountryTag | "";
  leader: number;
  members: number[];
}
export interface WwPolGlobal {
  wtBp: number;
  /** [smallID, bp] of the 10 largest threats. */
  threat: [number, number][];
  factions: WwFactionData[];
  guarantees: [number, number][];
  /** [a, b, sinceDay, startTreaty] (controller ruling R21: a 1936 pact). */
  naps: [number, number, number, boolean][];
  access: [number, number][];
  /** Every running justification: [by, on, daysLeft]. */
  justifying: [number, number, number][];
  nextBeatDay: number;
}
export interface WwPoliticsData {
  countries: WwPolSummary[];
  details: WwPolDetail[];
  global: WwPolGlobal | null;
  regions: { id: number; legalOwner: number }[];
  news: { id: string; params: Record<string, string | number> }[];
  cards: (WwEventCard & { to: number })[];
}
