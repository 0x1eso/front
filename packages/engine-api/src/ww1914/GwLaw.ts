// Great War 1914: bills and laws (brief ww142, lane L). The words, the state a
// country keeps and what a seat reads. The rows are engine-lib/ww1914/LawRows,
// the running of them engine/ww1914/Laws. Lists are APPEND ONLY.
import { z } from "zod";
import { GW_CONFIDENCE, type GwConfidence } from "./GwDeptWords";
import { GW_LAW_ORIGINS, type GwChamber, type GwLawOrigin } from "./GwHouse";

/**
 * Where a bill stands: drawn up, being argued, on the day of the vote, the law
 * of the land. `idle` is a bill taken back or repealed: it can come again.
 */
export const GW_LAW_STAGES = [
  "idle",
  "draft",
  "persuade",
  "vote",
  "force",
  /** Passed by the house, waiting for the sovereign's signature (RUS, AUH; ww158). */
  "sign",
] as const;
export type GwLawStage = (typeof GW_LAW_STAGES)[number];

/**
 * How a law came to be. `scene`: a decision of the desk had already made it.
 * `repealed`: it was ended, so that decision doesn't make it law again.
 */
export const GW_LAW_HOWS = [
  "none",
  "voted",
  "decreed",
  "scene",
  "repealed",
] as const;
export type GwLawHow = (typeof GW_LAW_HOWS)[number];

/** What the count looks like, in words: the seat never sees a number. */
export const GW_LAW_OUTLOOKS = ["easy", "tight", "short", "blocked"] as const;
export type GwLawOutlook = (typeof GW_LAW_OUTLOOKS)[number];

/** The count paper's word on a faction: 찬성 / 반대 / 흔들림 / 모름. */
export const GW_COUNT_WORDS = ["for", "against", "waver", "unknown"] as const;
export type GwCountWord = (typeof GW_COUNT_WORDS)[number];

const int = z.number().int();

export const GwLawStateSchema = z.object({
  /** A row of GW_LAWS. */
  id: z.string(),
  stage: z.enum(GW_LAW_STAGES),
  /** The chapter it came to this stage. */
  since: int,
  /** What drafting and talks have won or lost it. */
  support: int,
  how: z.enum(GW_LAW_HOWS),
  /** The draft's option: which text of the bill this is. */
  text: z.string().nullable(),
  /** Times the body has turned it down. */
  lost: int,
  /** The aftermath scene has come. */
  after: z.boolean(),
  // ---- The house (ww158); a save from before has the defaults. ----
  /** Who brought it (GwHouse GW_LAW_ORIGINS). */
  origin: z.enum(GW_LAW_ORIGINS).default("seat"),
  /** The faction whose bill it is; null for the seat's own. */
  by: z.string().nullable().default(null),
  /** The minister who drafts and works it; null: the row's cast. */
  sponsor: z.string().nullable().default(null),
  /** Factions with a deal on this bill. */
  deals: z.array(z.string()).default([]),
  /** The whip's last word (GW_WHIP_WORDS index); -1 none yet. */
  whip: int.default(-1),
  /** The Lords put it off until this chapter; -1 not. */
  delayTo: int.default(-1),
  /** Factions of the sponsor's camp, warmed to it (hidden; said after the vote). */
  warm: z.array(z.string()).default([]),
  // ---- The law book (ww203). ----
  /**
   * While a bill of the article moves to replace the law in force, the text
   * in force: it keeps working until the new one passes. Null otherwise.
   */
  kept: z.string().nullable().default(null),
  /** A failed bill locks the article until this chapter; -1 not locked. */
  lockTo: int.default(-1),
  /** The counting department's paper, faction by faction; empty: none yet. */
  paper: z
    .array(
      z.object({
        faction: z.string(),
        word: z.enum(GW_COUNT_WORDS),
        conf: z.enum(GW_CONFIDENCE),
      }),
    )
    .default([]),
  /** The chapter the paper came; -1 none. */
  paperAt: int.default(-1),
  /**
   * A decree that went round a chamber that wasn't sitting (Art. 87, §14):
   * it must face that chamber by this chapter once it sits again, or lapse.
   * -1: nothing owed. -2: owed, the chamber hasn't come back yet.
   */
  faces: int.default(-1),
});
export type GwLawState = z.infer<typeof GwLawStateSchema>;

/** A bill nobody has touched yet. */
export function gwLawStart(id: string): GwLawState {
  return {
    id,
    stage: "idle",
    since: -99,
    support: 0,
    how: "none",
    text: null,
    lost: 0,
    after: false,
    origin: "seat",
    by: null,
    sponsor: null,
    deals: [],
    whip: -1,
    delayTo: -1,
    warm: [],
    kept: null,
    lockTo: -1,
    paper: [],
    paperAt: -1,
    faces: -1,
  };
}

/** One line of the country tab: all of it the seat's to know. */
export interface GwLawView {
  id: string;
  /** `open`: no one has taken it up; it can be drafted now. */
  stage: GwLawStage | "open";
  how: GwLawHow;
  text: string | null;
  /** While it is moving: how the count stands today. */
  outlook: GwLawOutlook | null;
  /** The body that can stop it, and the one behind that. */
  body: string | null;
  second: string | null;
  /** The bill can go past them, at the price the card shows. */
  decree: boolean;
  /** Why it can't be taken up now: another bill is moving, or it was just shelved. */
  waits: "busy" | "shelved" | null;
  /** Who can be called about it now. */
  talk: { person: string; topic: string } | null;
  /** In force: what ending it costs. */
  repeal: { tell: readonly string[]; open: boolean } | null;
  /** The house runs it (ww158): a sponsor is picked, the factions argue it. */
  house?: boolean;
}

// ---- The law book, the agenda, lobbying (ww203) ----

/**
 * The book's ten chapters, in the book's order. Text `gw.book.<id>`. A law
 * row names one (`GwLawRow.chapter`); a row without one lists under null.
 */
export const GW_BOOK_CHAPTERS = [
  "war_finance", // 전시 재정
  "conscription", // 징병·동원
  "labour", // 노동
  "food", // 식량·배급
  "censorship", // 검열
  "siege", // 계엄
  "franchise", // 선거권·헌정
  "nations", // 민족·종교
  "war_aims", // 전쟁 목표
  "arms", // 군비
] as const;
export type GwBookChapter = (typeof GW_BOOK_CHAPTERS)[number];

/** How the ruler presses a leader (order `bill_press`). Text gw.lobby.press.<id>. */
export const GW_PRESS_HOWS = [
  "file", // a file on him (S2): he stays away
  "word", // the ruler's own word: court and army factions fall in
  "threat", // a dissolution threat: every faction heats
] as const;
export type GwPressHow = (typeof GW_PRESS_HOWS)[number];

/** What a leader's price is (GwWant `kind`). Text gw.lobby.price.<id>. */
export const GW_PRICE_KINDS = [
  "promise", // a law, an act, a front, kept by a date
  "post", // an office for his man
  "concession", // his amendment replaces the bill's text
  "money", // a budget line for his people, paid now
  "next", // his faction's own bill joins the agenda
] as const;
export type GwPriceKind = (typeof GW_PRICE_KINDS)[number];

/** A count-answer course on the task's bill (effect `bill_topic`). */
export const GW_BILL_ACTS = ["vote", "withdraw", "work", "amend"] as const;
export type GwBillAct = (typeof GW_BILL_ACTS)[number];

/** Why the 제출 button is shut for an article. Text gw.book.why.<id>. */
export const GW_BOOK_WHYS = [
  "full", // three bills on the agenda
  "locked", // a bill of it failed lately
  "shelved", // withdrawn or repealed lately
  "moving", // a bill of it is on the agenda
  "closed", // not open yet (its row's `opens`)
] as const;
export type GwBookWhy = (typeof GW_BOOK_WHYS)[number];

/** Why the call is shut on an agenda bill. Text gw.agenda.why.<id>. */
export const GW_CALL_WHYS = [
  "draft", // the draft is still on the desk
  "recess", // a chamber it needs has voted this chapter
  "lords", // the Lords put it off: it waits for `delayTo`
  "no_sitting", // a chamber it needs doesn't sit and nothing goes round
  "sign", // passed; the sovereign has it
] as const;
export type GwCallWhy = (typeof GW_CALL_WHYS)[number];

/** An article of the book: a law row, its bills (texts), the one in force. */
export interface GwArticleView {
  /** The law row. */
  id: string;
  chapter: GwBookChapter | null;
  /** Its bills, the row's draft texts, in order: `law.<id>.draft.<text>`. */
  bills: readonly string[];
  /** The text in force (a law made by a scene: the row's first). Null: none. */
  force: string | null;
  how: GwLawHow;
  /** `open`: nothing of it moves; `shut`: not open yet; else the moving stage. */
  stage: GwLawStage | "open" | "shut";
  /** 제출 (`submit`) or 다른 안으로 바꾼다 (`replace`) now; null with `why`. */
  can: "submit" | "replace" | null;
  why: GwBookWhy | null;
  /** Locked until this chapter after a failed vote. */
  lockTo: number | null;
  /** A house bill: its factions argue it; else the old body count. */
  house: boolean;
  /** In force: what ending it costs (as GwLawView). */
  repeal: { tell: readonly string[]; open: boolean } | null;
}

/** A faction on an agenda bill's lobby list. */
export interface GwLobbyView {
  faction: string;
  /** Its seats in each chamber the bill meets (information, may show). */
  seats: Readonly<Partial<Record<GwChamber, number>>>;
  leader: string | null;
  /** The count paper's word on it, and how sure; `unknown` with no paper. */
  word: GwCountWord;
  conf: GwConfidence | null;
  /** A price was taken from him on this bill. */
  deal: boolean;
  /**
   * Why he won't talk: a promise to him broken and unsettled, the bill against
   * his creed, a file holds him. Null: he talks.
   */
  shut: "broken" | "creed" | "held" | null;
  /** He can be summoned now (`bill_lobby`): his lobby talk exists, he's in. */
  call: boolean;
  /** Ways to press him now (`bill_press`). */
  press: readonly GwPressHow[];
}

/** A bill on the agenda (의사일정). */
export interface GwAgendaView {
  law: string;
  text: string | null;
  /** While it would replace the law in force: that text. */
  replaces: string | null;
  stage: "draft" | "persuade" | "vote" | "sign";
  origin: GwLawOrigin;
  /** The faction whose bill it is. */
  by: string | null;
  sponsor: string | null;
  /** Chapters since it joined the agenda. */
  age: number;
  /** A faction's bill comes to the vote by itself at this chapter. */
  auto: number | null;
  chambers: readonly GwChamber[];
  /** The count paper's overall word and when it came; null: no paper. */
  paper: { word: GwLawOutlook; conf: GwConfidence; chapter: number } | null;
  /** A department is counting it now. */
  counting: boolean;
  /** The office that would count it (`bill_count`); null: none can. */
  counter: string | null;
  /** 표결에 부친다 now; else why not. */
  call: boolean;
  callWhy: GwCallWhy | null;
  /** 신임을 건다 (GBR, FRA): the house row has a fall row. */
  confidence: boolean;
  /** 돌아간다: the way round is open and paid for. */
  round: boolean;
  /** 철회: a faction's own bill can't be withdrawn. */
  withdraw: boolean;
  delayTo: number | null;
  lobby: readonly GwLobbyView[];
}

/** The 법전 and 의사일정 of the 통치 tab's house group. */
export interface GwBookView {
  articles: readonly GwArticleView[];
  agenda: readonly GwAgendaView[];
  /** GW_AGENDA_MAX. */
  max: number;
  /** Free lobby calls left this chapter. */
  calls: number;
}
