// World War 1936 diplomacy (ww161 Design B; ww162 lane L0, the contract):
// separate peace with any enemy member (D1), collaboration governments
// (D2), the deal table (D3), promised land (D4) and the peacetime
// ultimatum (D5). Only the 1936 mode reads any of it.
// APPEND ONLY: every list below is a wire, snapshot or hash enum.
import type { DealItemWire } from "../Schemas";
import type { CountryTag } from "./Countries";

/** The diplomacy orders, at the end of WwOrderSchema; all go to WwEndgame.issue. */
export const DIPLO_ORDER_KINDS = [
  "deal_offer",
  "deal_reply",
  "collab_create",
  "ultimatum",
] as const;
export type DiploOrderKind = (typeof DIPLO_ORDER_KINDS)[number];

/**
 * A deal's items (DealItemSchema). In `give` the sender gives, in `take` the
 * receiver gives. access: the giver opens its land to the taker; nap: both
 * (either list); guarantee: the giver guarantees the taker; promise: the
 * giver promises region group `group` of enemy `target` at the peace (D4);
 * join_war: the giver declares on `target` and joins war `war` on the
 * taker's side (D4). Resources per day come later (owner call 6).
 */
export const DEAL_ITEM_KINDS = [
  "region",
  "equipment",
  "lend_lease",
  "licence",
  "access",
  "nap",
  "guarantee",
  "promise",
  "join_war",
] as const;
export type DealItemKind = (typeof DEAL_ITEM_KINDS)[number];
/** One deal item as the wire, the state and the views carry it. */
export type DealItem = DealItemWire;

/**
 * Timers, [from, to, untilDay, kind] (DIPLO_COOLDOWN_KINDS index), sorted by
 * from, to, kind. deal_refused: `from` waits before offering `to` again;
 * ultimatum: the pair's ultimatum wait (365 days, 180 after a refusal);
 * ai_*: an AI's own pacing (`to` 0 when it is not per pair).
 * deal_lend_lease (L2, appended): a deal's lend-lease contract ends —
 * [giver, the contract's id, the day after its last day]; no pair.
 */
export const DIPLO_COOLDOWN_KINDS = [
  "deal_refused",
  "ultimatum",
  "ai_deal",
  "ai_separate",
  "ai_promise",
  "ai_ultimatum",
  "deal_lend_lease",
] as const;
export type DiploCooldownKind = (typeof DIPLO_COOLDOWN_KINDS)[number];

// ---- D1 Separate peace (L1) ----
/** The AI target's loyalty term: its leader still holds this % of its own victory points and fights. */
export const WW_SEP_LOYAL_HOLD_PCT = 70;
/** The loyalty term's points (− while loyal, + once the leader is exiled or past half its surrender line). */
export const WW_SEP_LOYAL_PTS = 15;
export const WW_SEP_LEADER_BEATEN_PM = 500;
/** A winning AI side leader checks each enemy minor this often… */
export const WW_SEP_AI_DAYS = 60;
/** …and offers a line peace to one past this far to its surrender line (‰). */
export const WW_SEP_AI_TARGET_PM = 400;
/** "Come home as my subject" goes to an exile under this legitimacy. */
export const WW_SEP_HOME_LEGIT_BP = 3000;

// ---- D2 Collaboration government (L5) ----
export const WW_COLLAB_HOLD_DAYS = 30;
export const WW_COLLAB_MIN_VP_PCT = 25;
export const WW_COLLAB_PP = 75;
/** World tension it adds, percent (scaled like the other acts). */
export const WW_COLLAB_TENSION_PCT = 1;
export const WW_COLLAB_EXILE_LEGIT_LOSS_BP = 1000;
/** The most regions one order names (a wire cap). */
export const WW_COLLAB_MAX_REGIONS = 120;
export const WW_COLLAB_AI_HOLD_PCT = 60;
export const WW_COLLAB_AI_HOLD_DAYS = 60;
export const WW_COLLAB_AI_COVER_PCT = 80;
export const WW_COLLAB_AI_RES_BP = 3000;
/** The named dormant tag a capitulated country's collaborators use (else a civil-war slot). */
export const COLLAB_TAGS: readonly (readonly [CountryTag, CountryTag])[] = [
  ["FRA", "VIC"],
  ["ITA", "RSI"],
  ["CHN", "RNG"],
  ["CSK", "SVK"],
  ["YUG", "HRV"],
];

// ---- D3 Deal table (L2) ----
export const WW_DEAL_MAX_ITEMS = 6;
export const WW_DEAL_PP = 10;
export const WW_DEAL_REFUSAL_DAYS = 30;
/** A human target's card, as the white peace's (WW_WHITE_PEACE_CARD_TICKS). */
export const WW_DEAL_CARD_TICKS = 300;
/** An AI offers one human at most once in this many days (a gift excepted). */
export const WW_DEAL_AI_TO_HUMAN_DAYS = 90;
export const WW_DEAL_MAX_COUNT = 100_000;
export const WW_DEAL_LL_MAX_MONTHS = 24;
/** In peacetime an AI cedes a region to its faction leader from this opinion. */
export const WW_DEAL_CEDE_OPINION = 50;

// ---- D4 Promised land (L3) ----
export const WW_PROMISE_STRENGTH_PCT = 130;
export const WW_PROMISE_WS_PCT = 40;
export const WW_PROMISE_AI_DAYS = 180;
export const WW_PROMISE_BORDER_VP = 2;

// ---- D5 Ultimatum (L4) ----
export const WW_ULT_MAX_REGIONS = 6;
export const WW_ULT_MAX_VP_PCT = 15;
export const WW_ULT_PP = 50;
export const WW_ULT_TENSION_PCT = 2;
export const WW_ULT_TENSION_MAJOR_PCT = 4;
export const WW_ULT_NEUTRAL_TENSION_PCT = 25;
export const WW_ULT_COOLDOWN_DAYS = 365;
export const WW_ULT_REFUSED_DAYS = 180;
/** A refused ultimatum's ready claim goal lasts this long. */
export const WW_ULT_GOAL_DAYS = 180;
export const WW_ULT_CARD_TICKS = 300;
export const WW_ULT_STABILITY_LOSS_PCT = 10;
export const WW_ULT_WS_GAIN_PCT = 5;
export const WW_ULT_AI_DAYS = 90;
export const WW_ULT_AI_TENSION_PCT = 50;

/**
 * The engine's notices, full keys (the translation check reads them), so the
 * lanes and the screens name the same ones. Params in the comment.
 * WwEndgame.message adds "events_display." itself: pass noticeId(key).
 */
export const DIPLO_NOTICES = {
  /** {target} */
  dealAccepted: "events_display.ww1936_deal_accepted",
  /** {target} {days} */
  dealRefused: "events_display.ww1936_deal_refused",
  /** {target} */
  dealLapsed: "events_display.ww1936_deal_lapsed",
  /** {country} */
  dealGift: "events_display.ww1936_deal_gift",
  /** {country} {target}: my side's leader made a separate peace with a member of mine. */
  separatePeace: "events_display.ww1936_separate_peace",
  /** {country} */
  homeReturned: "events_display.ww1936_home_returned",
  /** {country} {target} */
  collabCreated: "events_display.ww1936_collab_created",
  /** {country} {regions} */
  ultimatumGiven: "events_display.ww1936_ultimatum_given",
  /** {country} {days} */
  ultimatumRefused: "events_display.ww1936_ultimatum_refused",
  /** {country} {target}: a country I guarantee got an ultimatum. */
  ultimatumGuarantor: "events_display.ww1936_ultimatum_guarantor",
  /** {country} {target} */
  promiseLapsed: "events_display.ww1936_promise_lapsed",
  /** {country} {target} */
  promiseKept: "events_display.ww1936_promise_kept",
  /** {target}: my ultimatum stopped meaning anything (war, the land moved, a party gone). L4, appended. */
  ultimatumLapsed: "events_display.ww1936_ultimatum_lapsed",
} as const;

/** A notice's id for WwEndgame.message (the key without "events_display."). */
export function noticeId(key: string): string {
  return key.slice(key.indexOf(".") + 1);
}

// ---- What the screens read (WwEndgameData, GameUpdateType.WwEndgame) ----
/** A pending deal (D3, D4). */
export interface WwDealView {
  id: number;
  from: number;
  to: number;
  give: DealItem[];
  take: DealItem[];
  sentTick: number;
  /** A human target's deadline (an AI target answers on the next tick). */
  deadlineTick: number;
}
/** A pending ultimatum (D5). */
export interface WwUltimatumView {
  id: number;
  from: number;
  to: number;
  regions: number[];
  /** The regions' share of the target's victory points, ‰. */
  vpPm: number;
  sentTick: number;
  deadlineTick: number;
}
/** A kept promise (D4): `from` promised `to` group `group` of `target` in war `war`. */
export interface WwPromiseView {
  id: number;
  war: number;
  from: number;
  to: number;
  target: number;
  group: string;
  regions: number[];
}
/** A collaboration government (D2): `smallID` stands for `origin`, made by `creator`. */
export interface WwCollabView {
  smallID: number;
  creator: number;
  origin: number;
  sinceDay: number;
}
/**
 * The composer's "상대가 받아들일 가능성" bar for a human country's offer to
 * `to` (L2 fills it; optional fields may be appended): the value points the
 * target's AI wants on top of an even deal.
 */
export interface WwDealJudgeRow {
  from: number;
  to: number;
  margin: number;
  /**
   * L2, appended: the target's value points (DiploRules; + good for it) of
   * the items whose worth only the engine knows. access: `from` opens its
   * land to it; accessGive: it opens its land to `from`; nap: a pact;
   * guarantee: `from` guarantees it; guaranteeGive: it guarantees `from`;
   * licence: it licenses `from` (one design, before the tech gap, which
   * the client adds with licencePoints).
   */
  access?: number;
  accessGive?: number;
  nap?: number;
  guarantee?: number;
  guaranteeGive?: number;
  licence?: number;
  /** In peacetime it would cede `from` land that is not its core (its overlord, or its faction leader at opinion ≥ WW_DEAL_CEDE_OPINION). */
  cede?: boolean;
  /** Appended (integration): `from` joining a war on its side, to it (an army: WW_PROMISE_ALLY_PTS, else 0). */
  join?: number;
  /** Appended (integration): the wars of `from` it would join on `from`'s side (its join_war is not a veto there). */
  joinWars?: number[];
}
