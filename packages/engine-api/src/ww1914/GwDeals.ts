// Great War 1914 (ww209/ww210): bargaining in the lobby, Frostpunk 2's way and
// past it: deadlines on promises, counter-offers, a law for a law, earmarks,
// favours owed both ways, threats, peeling a faction's wing, all remembered in
// the seat's ledger. The words, the ledger's state and what the screen reads.
// The running is engine/ww1914/Deals (S2); the money bills engine/ww1914/
// MoneyBills (S1). See /home/eser/dev/ww209-format.md. Lists are APPEND ONLY.
import { z } from "zod";

/**
 * 기한을 정한다 on a promise price: 이번 회기 안에 / 반년 안에 / 전쟁이 끝나면.
 * Text gw.deal.term.<id>. A short term brings the whole faction (+1 trust
 * when kept); `war_end` only its waverers, and comes due at the armistice.
 */
export const GW_DEAL_TERMS = ["session", "half", "war_end"] as const;
export type GwDealTerm = (typeof GW_DEAL_TERMS)[number];
/** Chapters each term runs; `war_end` has none (-1: due at the armistice). */
export const GW_DEAL_TERM_CHAPTERS: Readonly<Record<GwDealTerm, number>> = {
  session: 3,
  half: 6,
  war_end: -1,
};

/**
 * 내 조건을 내놓는다: what the seat may offer instead of his prices. `post`:
 * an office for his man. `region`: an earmark for his people (pick: the
 * earmark row). `text`: his amendment. `next`: his bill next, a law for a law
 * (표 대 표). `favour`: a favour later, the seat owes him. `against`: the seat's
 * side against a rival's bill (pick: that law). Text gw.deal.counter.<id>.
 */
export const GW_COUNTER_KINDS = [
  "post",
  "region",
  "text",
  "next",
  "favour",
  "against",
] as const;
export type GwCounterKind = (typeof GW_COUNTER_KINDS)[number];

/** His answer to a counter: 받는다 / 거절 / "그것에 더해 …" (one of his added). */
export const GW_COUNTER_ANSWERS = ["take", "refuse", "more"] as const;
export type GwCounterAnswer = (typeof GW_COUNTER_ANSWERS)[number];

/**
 * 위협한다: what the seat says it will do if his faction votes against:
 * 서류 / 해산 / 규탄 / 자리를 뺏는다 / 지역 돈을 끊는다. Text gw.deal.threat.<id>.
 */
export const GW_THREAT_KINDS = [
  "file",
  "dissolve",
  "condemn",
  "post",
  "region",
] as const;
export type GwThreatKind = (typeof GW_THREAT_KINDS)[number];

/**
 * A ledger row's kind (약속과 빚). `owe`: he owes the seat a favour (빚으로
 * 남긴다); `owed`: the seat owes him one (his price "a favour later");
 * `threat`: a threat made; `peel`: his wing met apart; `vote`: a law for a law,
 * the seat's side on his bill or a rival's still to give. Promises with a
 * price stay in `seat.promises` (with their `term`). Text gw.deal.kind.<id>.
 */
export const GW_DEAL_KINDS = ["owe", "owed", "threat", "peel", "vote"] as const;
export type GwDealKind = (typeof GW_DEAL_KINDS)[number];

/**
 * How a ledger row ended. `open`: still standing. `kept` / `broken`: a
 * favour paid or refused, a vote given or not. `called`: a favour called in
 * and honoured; `refused`: he refused when it was called (the favour lost,
 * the next threat on him free). `carried`: a threat carried out; `bluffed`:
 * not carried out (authority, threats void on his bloc). `lapsed`: the bill
 * went, nothing came of it. Text gw.deal.fate.<id>.
 */
export const GW_DEAL_FATES = [
  "open",
  "kept",
  "broken",
  "called",
  "refused",
  "carried",
  "bluffed",
  "lapsed",
] as const;
export type GwDealFate = (typeof GW_DEAL_FATES)[number];

/** Word gets round: this many promises broken within the span... */
export const GW_WORD_BROKEN = 2;
export const GW_WORD_SPAN = 12;
/** ...and a bluff called voids threats on his bloc this long. */
export const GW_BLUFF_VOID = 12;
/** A bluff called costs this much authority. */
export const GW_BLUFF_AUTHORITY = 5;
/** A wing met this many times within the span splits off. */
export const GW_PEEL_SPLIT = 2;
export const GW_PEEL_SPAN = 12;
/** One counter-offer per call. */
export const GW_COUNTERS_PER_CALL = 1;

const int = z.number().int();
const Id = z.string();

/** A row of the seat's ledger (house.deals2). */
export const GwDealSchema = z.object({
  /** Counts up per seat (house.nextDeal). */
  uid: int,
  kind: z.enum(GW_DEAL_KINDS),
  faction: Id,
  /** The man it was made with: the leader, or the wing's man. */
  person: Id.nullable(),
  /** The bill it was made on; null none (a favour called on any bill). */
  law: Id.nullable(),
  /** `threat`: what kind; `vote`: the law it binds the seat on, and its side. */
  threat: z.enum(GW_THREAT_KINDS).optional(),
  side: z.union([z.literal(-1), z.literal(1)]).optional(),
  vote: Id.optional(),
  chapter: int,
  /** The chapter it falls due; -1 none; -2 at the armistice (war_end). */
  due: int,
  fate: z.enum(GW_DEAL_FATES),
  /** The chapter it ended; -1 open. */
  ended: int,
});
export type GwDeal = z.infer<typeof GwDealSchema>;

// ---- What the screen reads ----

/** A summoned leader's counter, once offered: what he said. */
export interface GwCounterView {
  kind: GwCounterKind;
  pick: string | null;
  answer: GwCounterAnswer;
  /** "그것에 더해 …": the price of his he adds (a want id); null none. */
  more: string | null;
}

/** A faction's wing on the lobby list (온건파를 따로 만난다). */
export interface GwWingView {
  person: string;
  /** Its seats in the bill's first chamber (information). */
  seats: number;
  /** Met on this bill: his smaller prices, as the lobby's; null not met. */
  prices: readonly { id: string; kind: string }[] | null;
  /** A price taken from him on this bill: his wing votes for apart. */
  peeled: boolean;
  /** He can be met now (`bill_peel`). */
  call: boolean;
}

/** A row of the notebook's 약속과 빚 box. */
export interface GwDealView {
  uid: number;
  kind: GwDealKind;
  faction: string;
  person: string | null;
  law: string | null;
  threat: GwThreatKind | null;
  chapter: number;
  /** -1 none, -2 at the armistice. */
  due: number;
  fate: GwDealFate;
}
