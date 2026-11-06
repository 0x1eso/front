// Great War 1914: the orders a seat sends (intent `gw_order`). This is a wire
// format: variants are APPEND ONLY.
import { zb } from "@openfront/zbin";
import { z } from "zod";
import {
  GW_CIPHERS,
  GW_CLAUSE_KINDS,
  GW_OFFICES,
  GW_POSTURES,
  GW_RESEARCH,
  GW_SCALES,
  GW_SIDES,
  GW_TELEGRAM_MAX,
  GW_THEATRES,
  GW_TREATY_CLAUSES_MAX,
} from "./GreatWarTypes";
import { GW_TAGS } from "./GwCountries";

const Id = zb.string({ min: 1, max: 48, regex: /^[a-z][a-z0-9_]*$/ });
const Card = zb.uint({ max: 100_000_000 });

/**
 * A telegram's text: Hangul, which SafeString leaves out, with the usual
 * letters, digits, punctuation and line breaks. No control characters. The
 * server runs it through Censor before anyone else sees it.
 */
export const GwTelegramTextSchema = zb.string({
  min: 1,
  max: GW_TELEGRAM_MAX,
  regex:
    /^[\p{Script=Hangul}\p{Script=Han}a-zA-Z0-9 \n.,!?@#$%&*()\-_+=[\]{}|;:"'/~·…‘’“”《》「」]+$/u,
});

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
  /** A neutral seat goes to war on a side. */
  z.object({ kind: z.literal("enter_war"), side: z.enum(GW_SIDES) }),
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
  "not_host",
  "not_asked",
  "slow_spent",
  "no_seat",
  "too_many",
  "no_authority_cipher",
  "bad_clause",
  "no_treaty",
  "treaty_bars",
  "no_war",
  "at_war",
] as const;
export type GwOrderBlock = (typeof GW_ORDER_BLOCKS)[number];
