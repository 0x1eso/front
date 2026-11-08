// Great War 1914: the orders a seat sends (intent `gw_order`). This is a wire
// format: variants are APPEND ONLY.
import { zb } from "@openfront/zbin";
import { z } from "zod";
import {
  GW_ASK_CLAUSES,
  GW_BACK_DIRECTIONS,
  GW_CIPHERS,
  GW_CLAUSE_KINDS,
  GW_GIVE_CLAUSES,
  GW_OFFICES,
  GW_POSTURES,
  GW_RESEARCH,
  GW_SCALES,
  GW_TELEGRAM_MAX,
  GW_THEATRES,
  GW_TREATY_CLAUSES_MAX,
} from "./GreatWarTypes";
import { GW_TAGS } from "./GwCountries";
import { GW_TABLE_TRADES, GW_TABLE_WORDS } from "./GwTable";

const Id = zb.string({ min: 1, max: 48, regex: /^[a-z][a-z0-9_]*$/ });
const Card = zb.uint({ max: 100_000_000 });

/**
 * A telegram's text. SafeString has no Hangul, and a message failing its
 * schema gets the sender kicked, so this refuses only what can't be shown:
 * control, format and unassigned characters, line breaks apart. The composer
 * strips those (gwCleanTelegram), the server runs the rest through Censor.
 */
export const GwTelegramTextSchema = zb.string({
  min: 1,
  max: GW_TELEGRAM_MAX,
  regex: /^(?:\n|\P{C})+$/u,
});

/** What a composer sends: nothing the schema would refuse. */
export function gwCleanTelegram(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(?!\n)\p{C}/gu, "")
    .trim()
    .slice(0, GW_TELEGRAM_MAX);
}

const ClauseSchema = z.object({
  kind: z.enum(GW_CLAUSE_KINDS),
  by: z.enum(GW_TAGS),
  theatre: z.enum(GW_THEATRES).nullable(),
  value: zb.uint({ max: 1000 }),
});

export const GwOrderSchema = z.discriminatedUnion("kind", [
  /** The seat is done with this chapter (or takes it back). */
  z.object({
    kind: z.literal("ready"),
    chapter: zb.uint({ max: 1000 }),
    on: z.boolean(),
  }),
  /** A read-only card is closed. */
  z.object({ kind: z.literal("read"), card: Card }),
  /** An option of a decision card. */
  z.object({ kind: z.literal("choose"), card: Card, option: Id }),
  /** A reply in a talk card's current node. */
  z.object({ kind: z.literal("reply"), card: Card, reply: Id }),
  /** Call a person on a talk scene: spends an audience. */
  z.object({ kind: z.literal("summon"), person: Id, topic: Id }),
  z.object({ kind: z.literal("dismiss"), person: Id }),
  z.object({
    kind: z.literal("appoint"),
    person: Id,
    office: z.enum(GW_OFFICES),
  }),
  /** The war effort for the coming chapters (design §4.2). */
  z.object({
    kind: z.literal("allocate"),
    main: z.enum(GW_THEATRES),
    posture: z.enum(GW_POSTURES),
    scale: z.enum(GW_SCALES),
    allyShare: zb.uint({ max: 3 }),
    research: z.enum(GW_RESEARCH),
  }),
  /**
   * The year's budget goes to whoever must pass it. `force`: past them, with
   * authority.
   */
  z.object({
    kind: z.literal("budget"),
    shares: z.array(zb.uint({ max: 100 })).max(8),
    mix: z.array(zb.uint({ max: 300 })).max(8),
    force: z.boolean(),
  }),
  /** A bill from the country tab: taken up, or a law in force ended. */
  z.object({
    kind: z.literal("law"),
    law: Id,
    act: z.enum(["draft", "repeal"]),
    /** Who drafts it, from the cabinet (ww158); absent: the row's own. */
    sponsor: Id.optional(),
  }),
  /** The censor one step tighter, or looser. */
  z.object({ kind: z.literal("press_censor"), up: z.boolean() }),
  /** A paper's editor at the palace: spends an audience. */
  z.object({ kind: z.literal("press_invite"), paper: Id }),
  /** Something about a minister finds its way into the papers. */
  z.object({ kind: z.literal("press_leak"), person: Id }),
  /**
   * The seat starts something from its schedule. `picks` holds the fields'
   * values in field order, `count` of them each: option or person ids.
   */
  z.object({
    kind: z.literal("act"),
    act: Id,
    picks: z.array(Id).max(12),
  }),
  /** "다시 써 오시오": a decision goes back to its author with a direction. */
  z.object({
    kind: z.literal("send_back"),
    card: Card,
    direction: z.enum(GW_BACK_DIRECTIONS),
  }),
  /** The aim of this war or reign is declared, or changed at a price. */
  z.object({ kind: z.literal("aim"), aim: Id }),
  /** Terms go to a country: it answers when the chapter closes. */
  z.object({
    kind: z.literal("terms"),
    tag: zb.string({ min: 3, max: 3, regex: /^[A-Z]{3}$/ }),
    give: z.array(z.enum(GW_GIVE_CLAUSES)).max(5),
    ask: z.array(z.enum(GW_ASK_CLAUSES)).max(7),
  }),
  /** The land the seat wants, as painted: all of it, replacing what stood. */
  z.object({ kind: z.literal("claims"), places: z.array(Id).max(64) }),
  /** The seat's turn at the peace table: a place goes on it. */
  z.object({ kind: z.literal("table_claim"), place: Id }),
  /** The seat's turn at the peace table: nothing this time. */
  z.object({ kind: z.literal("table_pass") }),
  /** The seat's word on a claim. `trade`: what it offers, with `offer`. */
  z.object({
    kind: z.literal("table_word"),
    claim: zb.uint({ max: 10_000 }),
    word: z.enum(GW_TABLE_WORDS),
    trade: z.enum(GW_TABLE_TRADES).nullable(),
  }),
  /** The next thing at the table now, without waiting for it. */
  z.object({ kind: z.literal("table_next") }),
  /** A general goes to a front, from the map: spends a schedule slot. */
  z.object({
    kind: z.literal("post"),
    person: Id,
    theatre: z.enum(GW_THEATRES),
  }),
  /** A ready invention goes into the war now (ww157). */
  z.object({ kind: z.literal("field"), invention: Id }),
  /** The next step of the footing: its big scene comes now. */
  z.object({ kind: z.literal("footing") }),
  /** Asks for more reading time for everyone (the host agrees). */
  z.object({ kind: z.literal("slow") }),
  /** The host's answer to the seats that asked. */
  z.object({ kind: z.literal("slow_answer"), grant: z.boolean() }),
  /** A telegram to another seat: it arrives next chapter. */
  z.object({
    kind: z.literal("telegram"),
    to: z.enum(GW_TAGS),
    cipher: zb.uint({ max: GW_CIPHERS.length - 1 }),
    text: GwTelegramTextSchema,
  }),
  /** A secret treaty put together from clauses, offered to one country. */
  z.object({
    kind: z.literal("treaty_offer"),
    to: z.enum(GW_TAGS),
    clauses: z.array(ClauseSchema).min(1).max(GW_TREATY_CLAUSES_MAX),
  }),
  z.object({
    kind: z.literal("treaty_answer"),
    treaty: Card,
    sign: z.boolean(),
  }),
  z.object({ kind: z.literal("treaty_break"), treaty: Card }),
  /**
   * The host closes this chapter for everyone, as the timer would: what is
   * undecided gets the proxy's stamp. Last, so older orders keep their tags.
   */
  z.object({
    kind: z.literal("close_chapter"),
    chapter: zb.uint({ max: 1000 }),
  }),
]);
export type GwOrder = z.infer<typeof GwOrderSchema>;

export const GwOrderIntentSchema = z.object({
  type: z.literal("gw_order"),
  order: GwOrderSchema,
});

/** Why an order was refused; translated under gw.block. */
export const GW_ORDER_BLOCKS = [
  "ended",
  "stale_chapter",
  "open_cards",
  "no_card",
  "no_option",
  "closed",
  "wrong_kind",
  "no_person",
  "no_audience",
  "no_topic",
  "no_authority",
  "signed",
  "not_proposed",
  "no_meeting",
  "bad_budget",
  "no_law",
  "law_busy",
  "no_private",
  "press_done",
  "press_closed",
  "no_paper",
  "no_act",
  "no_slot",
  "bad_pick",
  "no_back",
  "no_aim",
  "no_terms",
  "terms_sent",
  "prologue",
  "no_claims",
  "table_no",
  "no_front",
  "no_craft",
  "no_footing",
  "not_host",
  "not_asked",
  "slow_spent",
  "no_seat",
  "too_many",
  "no_authority_cipher",
  "bad_clause",
  "no_treaty",
  "at_war",
] as const;
export type GwOrderBlock = (typeof GW_ORDER_BLOCKS)[number];
