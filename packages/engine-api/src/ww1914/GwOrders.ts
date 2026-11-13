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
  GW_OFF_METHODS,
  GW_OFFICES,
  GW_POSTURES,
  GW_RESEARCH,
  GW_SCALES,
  GW_TELEGRAM_MAX,
  GW_TEMPOS,
  GW_THEATRES,
  GW_TREATY_CLAUSES_MAX,
} from "./GreatWarTypes";
import { GW_TAGS } from "./GwCountries";
import {
  GW_ANSWER_REDOS,
  GW_PETITION_ANSWERS,
  GW_TASK_PUSHES,
} from "./GwDeptWords";
import { GW_CLIENTS, GW_FATE_TERMS, GW_FATES, GW_SIGN_HOWS } from "./GwFate";
import { GW_PRESS_HOWS } from "./GwLaw";
import { GW_SERVICE_BRANCHES, GW_SERVICE_SHARE_MAX } from "./GwSpies";
import { GW_BARGAIN_MOVES, GW_TABLE_TRADES, GW_TABLE_WORDS } from "./GwTable";

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
    /** ww173: the paper by its id, for the great offensive's papers. */
    paper: Id.optional(),
    /** The great offensive's method, months (1 or 3), feint front, quiet. */
    method: z.enum(GW_OFF_METHODS).optional(),
    months: zb.uint({ max: 3 }).optional(),
    feint: z.enum(GW_THEATRES).optional(),
    quiet: z.boolean().optional(),
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
  /**
   * A power from the 통치 tab (ww169). `target`: the picked id (a person, a
   * tag, a theatre, a chamber, an option), null with no list. `picks`: the
   * further fields' option ids in field order. `without`: past the signer, in
   * its beyond form. `sound`: only sound the signer out (spends an audience).
   */
  z.object({
    kind: z.literal("power"),
    id: Id,
    target: zb
      .string({ min: 1, max: 48, regex: /^[A-Za-z][A-Za-z0-9_]*$/ })
      .nullable(),
    picks: z.array(Id).max(6),
    without: z.boolean(),
    sound: z.boolean(),
  }),
  /**
   * Ask a talk from a decision card first (ww172): it comes now, at a summons'
   * price, and the decision waits on the desk for it.
   */
  z.object({ kind: z.literal("ask"), card: Card, topic: Id }),
  /**
   * ww173: the chief's standing word on the fronts: raids ("active"), a tacit
   * truce ("quiet"), or null for his own way.
   */
  z.object({
    kind: z.literal("front_tempo"),
    tempo: z.enum(GW_TEMPOS).nullable(),
  }),
  /** ww180: the share of the service's money and men a branch gets (0..3). */
  z.object({
    kind: z.literal("service"),
    branch: z.enum(GW_SERVICE_BRANCHES),
    share: zb.uint({ max: GW_SERVICE_SHARE_MAX }),
  }),
  /**
   * ww193: work for a department (GwDepts `GwTaskRow`). Free right after its
   * head's briefing this chapter, else a written order at one of the time.
   * `topic`: the picked country or front, null for a row with its own.
   */
  z.object({
    kind: z.literal("task"),
    office: z.enum(GW_OFFICES),
    row: Id,
    topic: zb
      .string({ min: 1, max: 48, regex: /^[A-Za-z][A-Za-z0-9_]*$/ })
      .nullable(),
  }),
  /** ww193: the head comes in and lays all he brings on the desk (1 of time). */
  z.object({ kind: z.literal("brief"), office: z.enum(GW_OFFICES) }),
  /** ww193: 다른 부서에 맡긴다: the paper's work restarts in `office`. */
  z.object({
    kind: z.literal("pass_on"),
    card: Card,
    office: z.enum(GW_OFFICES),
  }),
  /** ww193: 묵혀 둔다: the paper is set aside, nothing taken. */
  z.object({ kind: z.literal("shelve"), card: Card }),
  /** ww193: a gift (GwLeverRow) to someone met this chapter. */
  z.object({ kind: z.literal("gift"), row: Id, person: Id }),
  /** ww193: 돌려보낸다: a head or petitioner leaves the room unheard. */
  z.object({ kind: z.literal("turn_away"), person: Id }),
  /**
   * ww196: work under way: 서두르게 한다 (`hurry`; a stall paper's 돈을 더
   * 쓴다 is `money`), 사람을 붙인다 (`staff`, `person`), 거둔다, 기다린다.
   * ww196 §5: `brief` and `gift` above are refused now (no tray, no gifts).
   */
  z.object({
    kind: z.literal("task_push"),
    office: z.enum(GW_OFFICES),
    how: z.enum(GW_TASK_PUSHES),
    person: Id.nullable(),
  }),
  /**
   * ww196: the verdict on an answer (답신): a `course`, or a `redo` (더
   * 알아봐라 / 다른 안을 가져와라). One of the two.
   */
  z.object({
    kind: z.literal("answer"),
    card: Card,
    course: Id.nullable(),
    redo: z.enum(GW_ANSWER_REDOS).nullable(),
  }),
  /** ww196: the answer to a department's question back (a pick or a person). */
  z.object({ kind: z.literal("dept_reply"), card: Card, pick: Id }),
  /** ww196: 불러서 묻는다: the head of this desk paper comes in (1 of time). */
  z.object({ kind: z.literal("call"), card: Card }),
  /**
   * ww196: the 서훈식 (1 of time): who of the list gets which order; `at` is
   * the entry's place on the list. Those left out get nothing.
   */
  z.object({
    kind: z.literal("honours"),
    card: Card,
    give: z.array(z.object({ at: zb.uint({ max: 15 }), honour: Id })).max(16),
  }),
  /** ww196: a 서훈 상신 answered: 받아들인다 / 다음 명단으로 / 거절. */
  z.object({
    kind: z.literal("petition_answer"),
    card: Card,
    answer: z.enum(GW_PETITION_ANSWERS),
  }),
  /**
   * ww199: a fate painted on a place, or on every place of a group (one of
   * the two). `fate` null clears it. `for`: the ally (`ally`) or a joint
   * founder (`state`); `client`: the state (`state`); `term`: `occupy`.
   * The table reads the painted fate when the seat claims the place.
   */
  z.object({
    kind: z.literal("fate_paint"),
    place: Id.nullable(),
    group: Id.nullable(),
    fate: z.enum(GW_FATES).nullable(),
    for: z.enum(GW_TAGS).nullable(),
    client: z.enum(GW_CLIENTS).nullable(),
    term: z.enum(GW_FATE_TERMS).nullable(),
  }),
  /** ww199: the ruler signs the treaty: 서명한다 / 한 번 더 / 유보를 달고. */
  z.object({ kind: z.literal("treaty_sign"), how: z.enum(GW_SIGN_HOWS) }),
  /**
   * ww199: the crown of a state the seat founded: a candidate id of its
   * GwClientRow, or "regency" (섭정회의에 맡긴다).
   */
  z.object({ kind: z.literal("crown"), client: z.enum(GW_CLIENTS), pick: Id }),
  /**
   * ww205: the seat lays down its whole proposal at a table of one beaten
   * country: every place it painted a fate on, and its own land back.
   */
  z.object({ kind: z.literal("table_propose") }),
  /**
   * ww205: the seat's move on each refused place, then the proposal goes in
   * again. `place`: what is asked in its stead, with `trade`.
   */
  z.object({
    kind: z.literal("table_bargain"),
    moves: z
      .array(
        z.object({
          claim: zb.uint({ max: 10_000 }),
          move: z.enum(GW_BARGAIN_MOVES),
          place: Id.nullable(),
        }),
      )
      .max(64),
  }),
  /**
   * ww205: the beaten seat's yes or no to each place proposed; `walk`: it
   * leaves the room instead, and the war goes on.
   */
  z.object({
    kind: z.literal("table_answer"),
    answers: z
      .array(z.object({ claim: zb.uint({ max: 10_000 }), yes: z.boolean() }))
      .max(64),
    walk: z.boolean(),
  }),
  // ---- ww203: the law book and the agenda ----
  /**
   * 제출 / 다른 안으로 바꾼다: the article's draft goes to the sponsor (the
   * draft card picks the text); the bill joins the agenda (at most 3).
   */
  z.object({ kind: z.literal("bill_submit"), law: Id, sponsor: Id.optional() }),
  /** 표결에 부친다; `confidence`: 신임을 건다 (GBR, FRA). */
  z.object({
    kind: z.literal("bill_vote"),
    law: Id,
    confidence: z.boolean(),
  }),
  /** 돌아간다: the way round (Bundesrat powers, DORA, Art. 87, §14, siege). */
  z.object({ kind: z.literal("bill_round"), law: Id }),
  /** 철회: off the agenda; a faction's own bill can't be. */
  z.object({ kind: z.literal("bill_withdraw"), law: Id }),
  /** 부른다: the faction's leader on this bill (a free call, else 1 of time). */
  z.object({ kind: z.literal("bill_lobby"), law: Id, faction: Id }),
  /** 압박: a file, the ruler's word, a dissolution threat. */
  z.object({
    kind: z.literal("bill_press"),
    law: Id,
    faction: Id,
    how: z.enum(GW_PRESS_HOWS),
  }),
  /** The counting office counts this bill (task type `count`). */
  z.object({ kind: z.literal("bill_count"), law: Id }),
  /**
   * ww204: the summoned leader's price on this bill: `want` 들어준다 (one of
   * the lobby view's `prices`), null 그냥 돌려보낸다. Either ends his talk.
   */
  z.object({
    kind: z.literal("bill_price"),
    law: Id,
    faction: Id,
    want: Id.nullable(),
  }),
  // ---- ww207: the society and the utopias ----
  /** 연다: open a node of the faction's tree, spending its affinity (S2). */
  z.object({ kind: z.literal("node_open"), faction: Id, node: Id }),
  /** 지지한다: seats or a post, support +1 (S1). */
  z.object({ kind: z.literal("faction_promote"), faction: Id }),
  /** 규탄한다: a ban or arrests; support -2, temper +2, its community heats (S1). */
  z.object({ kind: z.literal("faction_condemn"), faction: Id }),
  /** 실현한다: the faction's utopia, every node open and the state met (S2). */
  z.object({ kind: z.literal("utopia_realise"), faction: Id }),
  /** The utopia's card (decision 1B): end here, or play on as the new head. */
  z.object({ kind: z.literal("utopia_choice"), play: z.boolean() }),
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
  // France: a premier falls in the house, not by the President's hand.
  "premier_house",
  // The 통치 tab (ww169).
  "no_power",
  "power_closed",
  "no_target",
  "no_signer",
  "no_beyond",
  "sounded",
  // ww193: departments and the audience room.
  "no_dept",
  "dept_busy",
  "no_task",
  "room_shut",
  "no_gift",
  "gift_given",
  "nothing_ready",
  // ww196
  "no_push",
  "called",
  "no_honour",
  "gone", // ww196: briefings and gifts are gone
  // ww199
  "no_fate", // that fate can't be painted there, or painting is shut
  "no_sign", // nothing to sign, or signed already
  "no_crown", // no such state of the seat's, or its crown is set
  // ww203
  "agenda_full", // three bills on the agenda
  "law_locked", // the article failed lately and is locked
  "recess", // a chamber the bill needs has voted this chapter
  "lords_wait", // the Lords put it off: not before its chapter
  "no_talk", // he won't talk: a broken promise, his creed, a file
  "no_press", // that pressure has nothing to work with
  "counting", // a department counts it already
  // ww207
  "no_faction", // no such faction of the seat's, or it is gone
  "no_node", // no such node in its tree, or it is open
  "no_affinity", // its affinity is short of the node's price
  "node_shut", // the tier before isn't open, or its gate doesn't hold
  "faction_cool", // promoted or condemned lately: not again yet
  "no_utopia", // the utopia isn't ready, or there's nothing to choose
] as const;
export type GwOrderBlock = (typeof GW_ORDER_BLOCKS)[number];
