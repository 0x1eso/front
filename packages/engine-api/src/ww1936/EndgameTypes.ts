// World War 1936 P5 (spec §3–§15, §21): the end of wars and what comes after.
// APPEND ONLY: every list below is a wire, snapshot or content enum.
import type { CountryTag } from "./Countries";
import type { EquipmentType } from "./EconomyTypes";
import type { Condition, Selector } from "./PoliticsDsl";
import type { Ideology, WarGoalType } from "./PoliticsTypes";

export {
  CIVIL_WAR_SLOTS,
  DORMANT_TAGS,
  isDormantTag,
  NAMED_DORMANT_TAGS,
} from "./Countries";

export const COUNTRY_STATES = ["dormant", "active", "gone"] as const;
export type CountryState = (typeof COUNTRY_STATES)[number];
export const CS_DORMANT = 0;
export const CS_ACTIVE = 1;
export const CS_GONE = 2;

export const WAR_KINDS = ["normal", "civil", "independence"] as const;
export type WarKind = (typeof WAR_KINDS)[number];
export const MEMBER_STATES = [
  "active",
  "capitulated",
  "exiled",
  "left",
] as const;
export type MemberState = (typeof MEMBER_STATES)[number];
export const SUBJECT_LEVELS = [
  "integrated",
  "puppet",
  "colony",
  "dominion",
] as const;
export type SubjectLevel = (typeof SUBJECT_LEVELS)[number];
export const OCCUPATION_LAWS = [
  "occ_civil",
  "occ_military",
  "occ_martial",
] as const;
export type OccupationLaw = (typeof OCCUPATION_LAWS)[number];
export const DEMAND_KINDS = [
  "take",
  "take_group",
  "take_for",
  "annex_rest",
  "occupation_zone",
  "puppet",
  "release",
  "liberate",
  "change_government",
  "dismantle",
  "demilitarise",
  "reparations",
  "disarm",
  "take_navy",
] as const;
export type DemandKind = (typeof DEMAND_KINDS)[number];
/** Plan decision 10: spec §21.3 order, then army_garrison. All go to WwEndgame.issue. */
export const ENDGAME_ORDER_KINDS = [
  "peace_submit",
  "peace_pass",
  "occupation_law",
  "integrate_region",
  "lend_lease",
  "lend_lease_cancel",
  "lend_lease_request",
  "volunteers_send",
  "volunteers_recall",
  "air_volunteers",
  "ships_transfer",
  "takeover_pick",
  "army_garrison",
] as const;
export type EndgameOrderKind = (typeof ENDGAME_ORDER_KINDS)[number];
export type LendLeaseItem = EquipmentType | "fuel";

// ---- Constants (spec §2.1, §5–§15; values marked (내 판단) in the spec are final) ----
export const WW_PEACE_ROUND_TICKS = 300;
export const WW_PEACE_MAX_ROUNDS = 4;
export const WW_PEACE_DEMANDS_PER_ROUND = 5;
export const WW_PEACE_POOL_PCT = 130;
export const WW_PEACE_LOG_SIZE = 10;
export const WW_WAR_KEEP_DAYS = 30;
export const WW_TAKEOVER_CARD_TICKS = 300;
export const WW_TAKEOVER_CANDIDATES = 3;
export const WW_EXILE_ESCAPE_PCT = 20;
export const WW_EXILE_LEGIT_START_BP = 5000;
export const WW_EXILE_ZERO_DAYS = 30;
export const WW_EXILE_STOCK_KEEP_PCT = 50;
export const WW_EXILE_MANPOWER_KEEP_PCT = 25;
export const WW_EXILE_PLANES_PCT = 50;
export const WW_EXILE_SHIP_ESCAPE_HP_PCT = 50;
export const WW_OCC_RES_UP_MAX_BP = 15;
export const WW_OCC_RES_DOWN_MAX_BP = 30;
export const WW_OCC_COMP_BASE_BP = 8;
export const WW_OCC_RES_BASE_FIGHTING_BP = 3500;
export const WW_OCC_RES_BASE_BP = 2000;
export const WW_OCC_COMP_CAP_FIGHTING_BP = 8000;
export const WW_OCC_DAMAGE_RES_BP = 2500;
export const WW_UPRISING_RES_BP = 8000;
export const WW_UPRISING_DAYS = 30;
export const WW_UPRISING_COVER_PCT = 50;
export const WW_UPRISING_DIVISIONS = 2;
export const WW_INTEGRATE_COMP_BP = 9000;
export const WW_INTEGRATE_DAYS = 180;
export const WW_OCC_LAW_LOCK_DAYS = 30;
export const WW_OCC_LAW_COST_PP = 25;
export const WW_SUBJECT_START_AUT_BP = 2000;
export const WW_LL_MAX_CONTRACTS = 10;
export const WW_LL_LAND_DAYS = 10;
export const WW_LL_SEA_KM_PER_DAY = 400;
export const WW_LL_TENSION_DEMOCRACY_PCT = 40;
export const WW_LL_TENSION_RECEIVER_PCT = 50;
export const WW_VOLUNTEER_MAX_DIV = 12;
export const WW_VOLUNTEER_MIN_DIV = 10;
export const WW_VOLUNTEER_TENSION_PCT = 25;
export const WW_AIR_VOLUNTEER_MAX = 100;
export const WW_AIR_VOLUNTEER_PCT = 20;
export const WW_CAPTURE_BASE_BP = 500;
export const WW_CAPTURE_ENCIRCLE_BP = 2000;
export const WW_CAPITULATION_STOCK_TO_VICTOR_PCT = 25;
export const WW_DISBANDED_EQUIP_TO_VICTOR_PCT = 50;
export const WW_CORE_SLOTS = 3;
export const WW_REPARATIONS_DAYS = 730;
export const WW_DISARM_DAYS = 1095;
export const WW_DISARM_MAX_DIVISIONS = 12;
export const WW_CIVIL_SHARE_MIN_BP = 3000;
export const WW_CIVIL_SHARE_MAX_BP = 7000;
export const WW_WAKE_DIV_MAX = 8;
export const WW_WAKE_EQUIP_PCT = 50;
export const WW_WAKE_MANPOWER_PCT = 50;
export const WW_WAKE_TECH_LAG_YEARS = 2;
/**
 * Pre-flight §0-8 (owner direction: varied outcomes): per (conference,
 * participant) the history row of HISTORY_PEACE is kept with this chance;
 * otherwise the general AI spends the points. The Korea lines are exempt.
 */
export const WW_PEACE_HISTORY_KEEP_PCT = 75;

// ---- Wars (spec §4.2) ----
/** Plan decision 8: how a pair joins the war records. */
export type WarLink =
  | {
      kind: "declare";
      war?: WarKind;
      goal?: { type: WarGoalType; group?: string };
    }
  | { kind: "into"; warId: number };
export interface WwWarMember {
  id: number;
  state: MemberState;
  joinedDay: number;
  wsMilli: number;
}
export interface WwWarSide {
  leader: number;
  members: WwWarMember[];
}
export interface WwWar {
  id: number;
  kind: WarKind;
  startDay: number;
  /** 0 = attackers (the first declarer), 1 = defenders. */
  sides: [WwWarSide, WwWarSide];
  goal: { type: WarGoalType; group: string } | null;
  ended: { day: number; winner: 0 | 1 | -1 } | null;
}

// ---- Peace demands (spec §6.4, §21.3, plan decision 11) ----
export type PeaceDemand =
  | { kind: "take"; region: number }
  | { kind: "take_group"; group: string }
  | { kind: "take_for"; region: number; beneficiary: number }
  | { kind: "annex_rest"; target: number }
  | { kind: "occupation_zone"; group?: string; region?: number }
  | { kind: "puppet"; target: number }
  | { kind: "release" | "liberate"; tag: CountryTag }
  | { kind: "change_government"; target: number }
  | { kind: "dismantle"; target: number }
  | { kind: "demilitarise"; region: number }
  | { kind: "reparations"; target: number; k: number }
  | { kind: "disarm"; target: number }
  | { kind: "take_navy"; target: number; pct: number };

/** Spec §3.3: what activateCountry gets. */
export interface ActivateOpts {
  regions: readonly number[];
  from?: readonly number[];
  overlord?: { smallID: number; level: SubjectLevel; neutral?: boolean };
  government?: { ideology: Ideology; leader?: string };
  divisions?: number;
  equipFrom?: number;
  techFrom?: number;
  /** Civil war (spec §15.3): every tech of techFrom, no two-year lag. */
  techAll?: boolean;
  /** Faction: the overlord's, none, or a P3 faction index. Default "none". */
  faction?: "overlord" | "none" | number;
  nameKey?: string;
  /** Tag whose translated name fills {country} (civil war names). */
  nameArg?: CountryTag;
  /** 0xRRGGBB (civil war slots). */
  color?: number;
}

// ---- Content (K5 fills, plan decision 30) ----
export type PeaceDefaultDemand =
  | { kind: "take_group" | "occupation_zone" | "demilitarise"; group: string }
  | { kind: "take_for"; group: string; beneficiary: CountryTag }
  | {
      kind:
        | "annex_rest"
        | "puppet"
        | "change_government"
        | "dismantle"
        | "disarm";
      target?: CountryTag;
    }
  | { kind: "release" | "liberate"; tag: CountryTag }
  | { kind: "reparations"; k: number }
  | { kind: "take_navy"; pct: number };
export interface PeaceDefaultLine {
  /** Evaluated with self = the conference's loser of this row. */
  by: Selector;
  when?: Condition;
  demands: readonly PeaceDefaultDemand[];
}
export interface PeaceDefaultDef {
  loser: CountryTag;
  when?: Condition;
  lines: readonly PeaceDefaultLine[];
}
export interface CoreDef {
  tag: CountryTag;
  groups: readonly string[];
}
export interface CivilWarSeedDef {
  tag: CountryTag;
  ideology: Ideology;
  group: string;
}
export interface OccupationDefaultDef {
  by: CountryTag;
  of: CountryTag;
  law: OccupationLaw;
  until?: string;
}

// ---- What the screens read (GameUpdateType.WwEndgame, spec §21.4, plan decision 23) ----
export interface WwCountryView {
  smallID: number;
  state: CountryState;
  nameKey: string | null;
  nameArg: CountryTag | null;
  color: number | null;
  flag: string;
}
export interface WwWarSummary {
  id: number;
  kind: WarKind;
  startDay: number;
  sides: {
    leader: number;
    members: { id: number; state: MemberState; sharePm: number }[];
  }[];
  ended: boolean;
}
export interface WwDemandView {
  kind: DemandKind;
  slot: number;
  regions: number[];
  target: number;
  beneficiary: number;
  k: number;
  pct: number;
  cost: number;
}
export interface WwConferenceView {
  id: number;
  losers: number[];
  status: "queued" | "open" | "done";
  round: number;
  roundEndTick: number;
  participants: {
    id: number;
    pts: number;
    sharePm: number;
    order: number;
    human: boolean;
    final: boolean;
  }[];
  stake: { region: number; base: number; settledBy: number; zone: boolean }[];
  /** Human participants only: their submission this round (null: none yet) and the AI default. */
  mine: { id: number; submitted: WwDemandView[] | null; ai: WwDemandView[] }[];
  lastRound: {
    by: number;
    kind: DemandKind;
    regions: number[];
    target: number;
    ok: boolean;
  }[];
  releasable: CountryTag[];
  /**
   * Pre-flight §A W × U1: the inputs of the engine's region price, so a
   * card's preview cost is the engine's: [participant, region] claims,
   * [participant, loser] conquer and topple goals, [region, participant]
   * reservations (control first) of the round.
   */
  claims: [number, number][];
  conquer: [number, number][];
  topple: [number, number][];
  reserved: [number, number][];
}
export interface WwPeaceLogEntry {
  day: number;
  losers: number[];
  lines: { key: string; params: Record<string, string | number> }[];
}
export interface WwOccView {
  region: number;
  controller: number;
  resBp: number;
  targetBp: number;
  compBp: number;
  needDeci: number;
  supDeci: number;
  factoryPct: number;
  law: OccupationLaw;
  uprisingDays: number;
  /**
   * The days compliance has stayed at WW_INTEGRATE_COMP_BP (spec §7.3), so
   * the occupation tab greys "Integrate" as the engine refuses it. Filled
   * by WwEndgame.takeData.
   */
  compHighDays?: number;
}
export interface WwSubjectView {
  subject: number;
  overlord: number;
  level: SubjectLevel;
  autBp: number;
  deltaBp: number;
  neutral: boolean;
}
export interface WwExileView {
  smallID: number;
  host: number;
  legitBp: number;
  deltaBp: number;
  virtualMil: number;
  capital: number;
}
export interface WwZoneView {
  region: number;
  holder: number;
  untilDay: number;
}
export interface WwAidView {
  smallID: number;
  contracts: {
    id: number;
    to: number;
    item: LendLeaseItem;
    gen: number;
    perMonth: number;
    sentMonth: number;
    arrivedMonth: number;
    blocked: string | null;
  }[];
  incoming: {
    from: number;
    item: LendLeaseItem;
    count: number;
    arriveDay: number;
  }[];
  volunteersOut: { army: number; to: number; divisions: number }[];
  volunteersIn: { army: number; from: number; divisions: number }[];
}
export interface WwTakeoverView {
  client: string;
  from: number;
  candidates: number[];
  deadlineTick: number;
}
export interface WwEndgameData {
  countries?: WwCountryView[];
  controllers?: [string, number][];
  wars?: WwWarSummary[];
  conference?: WwConferenceView | null;
  queuedConferences?: number;
  peaceLog?: WwPeaceLogEntry[];
  occupation?: WwOccView[];
  occLaws?: {
    by: number;
    of: number;
    law: OccupationLaw;
    lockUntilDay: number;
  }[];
  coreChanges?: { region: number; holders: number[] }[];
  zones?: WwZoneView[];
  subjects?: WwSubjectView[];
  exiles?: WwExileView[];
  aid?: WwAidView[];
  takeover?: WwTakeoverView[];
  news: { id: string; params: Record<string, string | number> }[];
}
