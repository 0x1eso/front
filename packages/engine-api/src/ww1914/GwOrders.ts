// Great War 1914: the orders a seat sends (intent `gw_order`). This is a wire
// format: variants are APPEND ONLY.
import { zb } from "@openfront/zbin";
import { z } from "zod";
import {
  GW_ASK_CLAUSES,
  GW_BACK_DIRECTIONS,
  GW_GIVE_CLAUSES,
  GW_OFFICES,
  GW_POSTURES,
  GW_RESEARCH,
  GW_SCALES,
  GW_THEATRES,
} from "./GreatWarTypes";

const Id = zb.string({ min: 1, max: 48, regex: /^[a-z][a-z0-9_]*$/ });
const Card = zb.uint({ max: 100_000_000 });

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
  /** A general goes to a front, from the map: spends a schedule slot. */
  z.object({
    kind: z.literal("post"),
    person: Id,
    theatre: z.enum(GW_THEATRES),
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
  "no_front",
] as const;
export type GwOrderBlock = (typeof GW_ORDER_BLOCKS)[number];
