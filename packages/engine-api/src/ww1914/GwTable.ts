// Great War 1914: the peace table. When the war ends by armistice the map is the
// table: the countries put places on it in turn, the other side says yes, no, or
// offers something else, and what is agreed repaints the map. Rules live in
// engine/ww1914/Table; lists of what each country came for in
// engine-lib/ww1914/TableRows; words in the pack's `table`.
import { z } from "zod";
import { GW_TAGS, GwTag } from "./GwCountries";
import {
  GW_CLIENTS,
  GW_FATE_TERMS,
  GW_FATES,
  GW_SIGN_HOWS,
  GwClient,
  GwFate,
  GwFateMark,
  GwFateTerm,
  GwSignHow,
} from "./GwFate";
import { GwPlace, GwPlaceSchema } from "./GwPlaces";

/** What can stand in for the land. APPEND ONLY (wire). */
export const GW_TABLE_TRADES = [
  "reparations", // the land stays, the holder pays
  "recognition", // the land stays, the holder signs a word of recognition
  "port", // the land stays, the claimant keeps a free port in it
  "guarantee", // the land stays, under a guarantee: no forts, no garrison
] as const;
export type GwTableTrade = (typeof GW_TABLE_TRADES)[number];

/** What one side can answer. APPEND ONLY (wire). */
export const GW_TABLE_WORDS = [
  "yes",
  "no",
  "offer",
  "press",
  "drop",
  // ww199: a partner's word when another of its side asks for a place it
  // holds or painted (step `partner`): 양보한다 / 함께 세운다 / 버틴다.
  "yield",
  "joint",
  "hold",
] as const;
export type GwTableWord = (typeof GW_TABLE_WORDS)[number];

/** Where a claim has got to. `pressed`: it has been insisted on, once. */
export const GW_TABLE_STEPS = [
  "asked",
  "refused",
  "offered",
  "pressed",
  // ww199: waits for a partner's word (`partner`) before the holder's.
  "partner",
] as const;

export const GW_TABLE_ENDS = [
  "open",
  "agreed", // given up by consent
  "imposed", // taken after the holder ran out of refusals
  "traded", // something else in its place
  "refused", // refused to the last
  "dropped", // the claimant let it go
] as const;
export type GwTableEnd = (typeof GW_TABLE_ENDS)[number];

/** What is said at the table: each is a line in the pack. */
export const GW_TABLE_LINES = [
  "open",
  "claim",
  "yes",
  "no",
  "offer",
  "traded",
  "press",
  "drop",
  "impose",
  "over",
  "hold",
  "close",
  // ww205: a whole proposal laid down; the beaten walks out of the room.
  "propose",
  "walk",
  // ww217: a fully beaten country protests a place; it doesn't block.
  "protest",
] as const;
export type GwTableLineKind = (typeof GW_TABLE_LINES)[number];

/**
 * ww205: why the beaten said yes or no to a place of a proposal, in its own
 * words (`gw.bargain.why.<TAG>.<id>`, else `gw.bargain.why.<id>`). Read off
 * the state, never rolled. APPEND ONLY (wire).
 */
export const GW_TABLE_WHYS = [
  // no
  "capital", // 수도라서 절대 안 된다
  "heart", // the heart of the country
  "allies", // its allies still fight
  "army", // its army still stands
  "much", // too much asked already
  "to_ally", // not to that ally
  "again", // insisting changes nothing
  // yes
  "soft", // as military government (or a vassal, a state) it can be borne
  "held", // the claimant's army stands there already
  "beaten", // it lost the war
  "return", // given back
  "tired", // it can't go on
  // ww217: a fully beaten country's protest, when no other reason fits
  "unjust", // 부당하다, 세상에 호소한다
] as const;
export type GwTableWhy = (typeof GW_TABLE_WHYS)[number];

/**
 * ww205: what the claimant does with a refused place before proposing again:
 * insist, step down (annex → occupy → vassal → return), ask for another place
 * in its stead, or let it go. APPEND ONLY (wire).
 */
export const GW_BARGAIN_MOVES = [
  "insist",
  "down",
  "trade",
  "drop",
  // ww209 (S2), all read off the state as answerOf is:
  "counter", // take the beaten's own counter-fate for the place (claim `counter`)
  "ransom", // money instead of the place, through the Treaties transfer
  "promise_leave", // the place left to the beaten on a promise to evacuate by a date
  "promise_vote", // a plebiscite by a date decides the place
  "ultimatum", // accept within the round or the advance resumes (18 Feb 1918)
  "favour_neutral", // the place given up for the beaten's neutrality to come
  "favour_trade", // the place given up for trade terms
  "split", // a separate table with the place's breakaway state (the Bread Peace)
  // ww217: over a fully beaten country's protest (it has no veto): the place
  // goes as asked, and the protest's costs build after the signing.
  "push",
] as const;
export type GwBargainMove = (typeof GW_BARGAIN_MOVES)[number];

/** ww205: how the beaten bears the talks, in words: 차분함 / 굳어 감 / 박차고 나갈 듯. */
export const GW_TABLE_MOODS = [
  "calm",
  "tense",
  "breaking",
  // ww217: fully beaten: it protests, it can't refuse or walk out.
  "bowed",
] as const;
export type GwTableMood = (typeof GW_TABLE_MOODS)[number];

const Tag = z.enum(GW_TAGS);
const Trade = z.enum(GW_TABLE_TRADES);

export const GwTableClaimSchema = z.object({
  id: z.number().int(),
  place: GwPlaceSchema,
  by: Tag,
  against: Tag,
  session: z.number().int(),
  state: z.enum(GW_TABLE_ENDS),
  step: z.enum(GW_TABLE_STEPS),
  /** What is on offer in the land's place, and who offers it. */
  offer: Trade.nullable(),
  offerBy: Tag.nullable(),
  /** Offers made on it so far. */
  offers: z.number().int(),
  /** It has been insisted on: that can't be done twice. */
  pressed: z.boolean(),
  /**
   * ww199: what becomes of the place once given (absent: annex, as before).
   * `for`: the ally it goes to, or a joint founder of a state. `client`: the
   * state it goes into. `term`: an occupation's length.
   */
  fate: z.enum(GW_FATES).optional(),
  for: Tag.optional(),
  client: z.enum(GW_CLIENTS).optional(),
  term: z.enum(GW_FATE_TERMS).optional(),
  /** ww199: the partner of the claimant's side whose word it waits for, or took. */
  partner: Tag.optional(),
  /**
   * ww205: part of a whole proposal (a table of one beaten country): the
   * round it was last put in. Absent: the old claim by claim.
   */
  round: z.number().int().optional(),
  /** ww205: why the beaten said its last yes or no. */
  why: z.enum(GW_TABLE_WHYS).optional(),
  /** ww205: times the claimant insisted on it. */
  insisted: z.number().int().optional(),
  // ---- ww209 (S2); absent: none ----
  /** The beaten's own fate for the refused place (`table_counter`, or its AI). */
  counter: z
    .object({ fate: z.enum(GW_FATES), term: z.enum(GW_FATE_TERMS).optional() })
    .optional(),
  /** Its last move (GW_BARGAIN_MOVES) by the claimant. */
  move: z.enum(GW_BARGAIN_MOVES).optional(),
  /** `ransom`: steps of money asked in its place. */
  ransom: z.number().int().optional(),
  /** `promise_*`: the chapter it falls due; broken: trust -2, revanche. */
  due: z.number().int().optional(),
  /** `ultimatum`: the round by which it must be taken. */
  ultimatum: z.number().int().optional(),
  /**
   * ww217: a fully beaten country protested it (its "no" at a table where it
   * has no veto). It blocks nothing; pushed through (`move: "push"`), its
   * costs build after the signing (`s.protests`).
   */
  protest: z.boolean().optional(),
});
export type GwTableClaim = z.infer<typeof GwTableClaimSchema>;

export const GwTableLineSchema = z.object({
  n: z.number().int(),
  word: z.enum(GW_TABLE_LINES),
  who: Tag,
  /** The claim it is about; -1 for none. */
  claim: z.number().int(),
});
export type GwTableLine = z.infer<typeof GwTableLineSchema>;

export const GwTableStateSchema = z.object({
  /** 0-based: the month of the conference. */
  session: z.number().int(),
  /** Countries in speaking order, and how far round they have got. */
  order: z.array(Tag),
  round: z.number().int(),
  at: z.number().int(),
  /** No step runs before this tick: the table talks at reading speed. */
  next: z.number().int(),
  /** This month's business is over. */
  done: z.boolean(),
  /** The treaty is signed. */
  closed: z.boolean(),
  claims: z.array(GwTableClaimSchema),
  lines: z.array(GwTableLineSchema),
  /** Tag -> steps of reparations it owes. */
  bill: z.partialRecord(Tag, z.number().int()),
  /** Tag -> how far past what the table will bear it has gone. */
  over: z.partialRecord(Tag, z.number().int()),
  /** Tag -> claims it refused to the last. */
  held: z.partialRecord(Tag, z.number().int()),
  /**
   * ww172: a bilateral table for a peace of two: its two chairs, who came
   * out ahead (null: neither) and the first's war score against the second.
   * Absent at the conference.
   */
  pair: z
    .object({
      a: Tag,
      b: Tag,
      winner: Tag.nullable(),
      score: z.number().int(),
      /** ww199: the rest of the winner's side at a capitulation table. */
      with: z.array(Tag).optional(),
    })
    .optional(),
  /**
   * ww199: how each chair's ruler signed (treaty_sign); absent: not yet. A
   * chair that pressed (`press`) got one more round, once: `extra` counts them.
   */
  sign: z.partialRecord(Tag, z.enum(GW_SIGN_HOWS)).optional(),
  extra: z.number().int().optional(),
  /**
   * ww205: a table of one beaten country runs as whole proposals: each
   * victor in turn lays down every place at once, the beaten answers place
   * by place, and they bargain over what was refused for a few rounds.
   * `rounds`: proposals each victor has made. `strain`: how hard the beaten
   * has been pushed. `walked`: it left the room (the war goes on).
   */
  talk: z
    .object({
      rounds: z.partialRecord(Tag, z.number().int()),
      strain: z.partialRecord(Tag, z.number().int()),
      walked: z.array(Tag),
      /**
       * ww217: the beaten capitulated fully (capital lost and little home
       * land left, a certain capitulation, or a forced one): it accepts or
       * protests each place, a protest blocks nothing, and it can't walk
       * out. Absent: a conditional peace, refusals and walk-out as ww205.
       */
      full: z.boolean().optional(),
    })
    .optional(),
});
export type GwTableState = z.infer<typeof GwTableStateSchema>;

/** A claim as the seat sees it; `words` are what it may say to it now. */
export interface GwTableClaimView {
  id: number;
  place: GwPlace;
  by: GwTag;
  against: GwTag;
  session: number;
  state: GwTableEnd;
  step: (typeof GW_TABLE_STEPS)[number];
  offer: GwTableTrade | null;
  offerBy: GwTag | null;
  /** ww199: the fate asked for it (absent: annex). */
  fate?: GwFate;
  for?: GwTag;
  client?: GwClient;
  term?: GwFateTerm;
  partner?: GwTag;
  /** ww205: a proposal's place: its round, the beaten's reason, insistence. */
  round?: number;
  why?: GwTableWhy;
  insisted?: number;
  /** ww209: the beaten's counter, the claimant's last move, its terms. */
  counter?: { fate: GwFate; term?: GwFateTerm };
  move?: GwBargainMove;
  ransom?: number;
  due?: number;
  ultimatum?: number;
  /** ww217: protested by a fully beaten country (blocks nothing). */
  protest?: boolean;
}

/** What the seat has to do at the table now. */
export type GwTableDue =
  /** Its turn: a place of `places`, or pass. */
  | { kind: "turn"; left: number; places: readonly GwPlace[] }
  /** A claim waits for its word. */
  | {
      kind: "word";
      claim: number;
      words: readonly GwTableWord[];
      trades: readonly GwTableTrade[];
    }
  /** ww205: lay down the whole proposal: `places` is all it may ask for. */
  | { kind: "propose"; places: readonly GwPlace[] }
  /**
   * ww205: the beaten refused `claims`: a move for each, then propose again.
   * `places`: what could be asked in a refused place's stead. `last`: the
   * answers to come are the last.
   */
  | {
      kind: "bargain";
      claims: readonly number[];
      places: readonly GwPlace[];
      round: number;
      last: boolean;
      /** ww209 (S2): claim id -> the moves open on it; absent: the old four. */
      moves?: Readonly<Record<number, readonly GwBargainMove[]>>;
    }
  /** ww205: the seat is the beaten: yes or no to each of `claims`. */
  | {
      kind: "answer";
      claims: readonly number[];
      walk: boolean;
      /** ww209 (S2): claim id -> fates the beaten may name instead (`table_counter`). */
      counters?: Readonly<Record<number, readonly GwFate[]>>;
      /** ww217: fully beaten: its "no" is a protest (받아들인다 / 항의한다). */
      protest?: boolean;
    }
  | null;

/** What the screens read; the same for every seat but `due` and `role`. */
export interface GwTableView {
  session: number;
  sessions: number;
  closed: boolean;
  done: boolean;
  /** `won`, `lost`, `even`, or `watch` for a seat with no chair. */
  role: "won" | "lost" | "even" | "watch";
  /** The chairs, in speaking order. */
  order: readonly GwTag[];
  /** Those who came to the table beaten; [] when nobody was. */
  losers: readonly GwTag[];
  /** ww172: a bilateral table's two chairs; null or absent at the conference. */
  pair?: readonly GwTag[] | null;
  /** Whose turn it is; null while nobody's. */
  speaker: GwTag | null;
  claims: readonly GwTableClaimView[];
  /** The last things said, oldest first. */
  lines: readonly GwTableLine[];
  bill: Readonly<Partial<Record<GwTag, number>>>;
  over: number;
  held: number;
  due: GwTableDue;
  /**
   * ww199: the seat's ruler is to sign (`sign`: the ways open), or signed
   * (`signed`). Null where there is nothing to sign yet.
   */
  sign?: { ways: readonly GwSignHow[]; signed: GwSignHow | null } | null;
  /** ww199: the fates the seat painted, by place (the turn box's defaults). */
  fates?: Readonly<Partial<Record<GwPlace, GwFateMark>>>;
  /**
   * ww205: a table of whole proposals: the round, how many there may be,
   * whose proposal is on the table, the beaten's mood in words, and who
   * walked out.
   */
  talk?: {
    round: number;
    rounds: number;
    claimant: GwTag | null;
    beaten: GwTag | null;
    mood: GwTableMood;
    walked: readonly GwTag[];
    /** ww217: the beaten capitulated fully: it protests, it has no veto. */
    full?: boolean;
  } | null;
}

/** The seat's painted land (war aims). */
export interface GwClaimsView {
  places: readonly GwPlace[];
  /** Painted land it now holds. */
  held: readonly GwPlace[];
  /** Painting is open: the war is on and the guns haven't stopped. */
  open: boolean;
  /** It has been signed: a change now has a price. */
  priced: boolean;
  /** ww199: the fate painted on each place; absent where none is. */
  fates?: Readonly<Partial<Record<GwPlace, GwFateMark>>>;
  /** ww199: fate painting is open (a war on, or a table not signed). */
  fatesOpen?: boolean;
}

/** The map at the end, for the memoir. */
export const GwMapRecordSchema = z.object({
  painted: z.array(GwPlaceSchema),
  got: z.array(GwPlaceSchema),
  /** Everything out of its 1914 owner's hands at the end. */
  moves: z.array(z.object({ place: GwPlaceSchema, from: Tag, to: Tag })),
  /** What the seat's claims came to, other than land. */
  trades: z.array(
    z.object({
      place: GwPlaceSchema,
      with: Tag,
      trade: Trade,
      mine: z.boolean(),
    }),
  ),
  /** Claims made on the seat that it refused to the last. */
  held: z.number().int(),
  over: z.number().int(),
  /** `won`, `lost`, `even`, `watch`, or null with no table. */
  role: z.enum(["won", "lost", "even", "watch"]).nullable(),
});
export type GwMapRecord = z.infer<typeof GwMapRecordSchema>;
