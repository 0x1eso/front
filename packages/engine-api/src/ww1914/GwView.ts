// Great War 1914: what the screens read (GameUpdateType.GreatWar). Only what
// the seat may know: no competence, health, temperament, strength band or
// source band. Text is looked up in the pack by these ids.
import type {
  GwAlloc,
  GwAskClause,
  GwBack,
  GwBackDirection,
  GwCalendarId,
  GwClause,
  GwGauge,
  GwGiveClause,
  GwInstitution,
  GwLandMove,
  GwMemoir,
  GwOffice,
  GwOpening,
  GwReason,
  GwStage,
  GwStamp,
  GwTermRefusal,
  GwTheatre,
  GwTreatyState,
} from "./GreatWarTypes";
import type { GwActKind } from "./GwActs";
import type { GwTag } from "./GwCountries";
import type { GwDealTerm } from "./GwDeals";
import type {
  GwCardDeptView,
  GwDeptView,
  GwLeverView,
  GwPaperView,
  GwRoomRowView,
  GwTimeView,
  GwTodoView,
} from "./GwDepts";
import type { GwRealmView, GwRuledView } from "./GwFate";
import type { GwOrderBlock } from "./GwOrders";
import type { GwDeskHeadView, GwDiaryView } from "./GwPersona";
import type { GwPlace } from "./GwPlaces";
import type { GwPowerView } from "./GwPowers";
import type { GwPrologueView } from "./GwPrologue";
import type { GwRulerView } from "./GwRuler";
import type { GwClaimsView, GwTableView } from "./GwTable";
import type { GwWorldView } from "./GwWorldView";
import type { GwReplyKind, GwSceneKind, GwStance } from "./SceneDsl";

export interface GwOptionView {
  id: string;
  /** False: greyed, with the pack's `why.<id>`. */
  open: boolean;
  tell: readonly string[];
  /** The screen to open once it is taken. */
  screen?: "fronts" | "budget";
}

export interface GwReplyView extends GwOptionView {
  stance: GwStance;
  kind: GwReplyKind;
}

/** A talk that may open a locked option, asked from the decision (ww172). */
export interface GwAskView {
  topic: string;
  /** The person asked: the button shows the name and nothing else. */
  who: string;
  /** The options it may open, in the card's order. */
  options: readonly string[];
  /** False: the seat can't pay for it now (no audience left). */
  open: boolean;
  /** Why not, when it can't: a block under gw.ui.block. */
  block?: GwOrderBlock;
}

export interface GwCardView {
  uid: number;
  scene: string;
  kind: GwSceneKind;
  variant: string;
  /** role -> person id. */
  cast: Readonly<Record<string, string>>;
  stamp: GwStamp | null;
  options: readonly GwOptionView[];
  /** A talk: the person, the node, the line said, the replies. */
  who: string | null;
  node: string | null;
  says: string | null;
  replies: readonly GwReplyView[];
  /** role -> which of that person's paragraphs (pack `voiceBy`). */
  voice?: Readonly<Record<string, string>>;
  /** A quiet card: the small scenes folded into it, shown by their titles. */
  folded?: readonly string[];
  /** "다시 써 오시오": the directions open now; empty when it can't go back. */
  backTo?: readonly GwBackDirection[];
  /** A paper sent back, come again. */
  back?: GwBack | null;
  /** Who it went back to: the line's {who}. */
  backWho?: string | null;
  /** A talk that takes the screen; `who` is null while nobody speaks. */
  big?: boolean;
  /** A short card with no chrome, laid after a big scene. */
  silent?: boolean;
  /** A prologue scene: its number in the row. */
  past?: number;
  /** A letter: the country it came from. */
  letterFrom?: GwTag;
  /** The place on the map it comes from. */
  place?: GwPlace;
  /** With no place of its own: where the rules put it (theatre, office). */
  near?: GwPlace;
  /** A decision: talks that may open a locked option, asked from here. */
  asks?: readonly GwAskView[];
  /** A talk asked from a decision: that card's uid, to go back to. */
  askFrom?: number;
  /**
   * ww178: a note's card, when the seat reads the other side's diplomatic
   * traffic: what it read of their resolve (gw.ui.decrypt_word.<word>).
   */
  decrypt?: { tag: GwTag; word: number; stamp: GwStamp };
  /** ww193: a department brings it: who, his option, the rival's. */
  dept?: GwCardDeptView;
  /** ww196: a department's answer, question, stall or news; an honours paper. */
  paper?: GwPaperView;
  /** ww196 (P): who hands it in (`persona.bearers.<id>`). */
  bearer?: string;
  /** ww196 (P): a private paper, grouped atop the desk as 사사로운 것. */
  private?: boolean;
}

/** A field of a schedule entry: pick `count` from what it holds. */
export interface GwActFieldView {
  id: string;
  options: readonly string[];
  tones: readonly GwStance[];
  people: readonly string[];
  count: number;
  /** Option id -> what it moves: for after the pick. */
  tells?: Readonly<Record<string, readonly string[]>>;
}

/** A schedule entry open now (pack `acts.<id>`). */
export interface GwActView {
  id: string;
  kind: GwActKind;
  fields: readonly GwActFieldView[];
  /** Shown after the pick. */
  tell: readonly string[];
  /** ww193: a trip (GwAct `trip`): two of the time, the room shut. */
  trip?: boolean;
}

/** The national aim as the seat sees it (pack `aims.<id>`). */
export interface GwAimsView {
  aim: string | null;
  /** What can be declared now. */
  open: readonly string[];
  /** Declaring now is a change of word, with a price shown afterwards. */
  priced: boolean;
  dropped: readonly string[];
}

/** Terms as the seat can offer them; text under gw.terms.*. */
export interface GwTermsView {
  /** Terms have gone out this chapter: one a chapter. */
  sent: boolean;
  targets: readonly {
    tag: GwTag;
    give: readonly GwGiveClause[];
    ask: readonly GwAskClause[];
  }[];
  log: readonly {
    tag: GwTag;
    give: readonly GwGiveClause[];
    ask: readonly GwAskClause[];
    /** Null until the chapter closes. */
    yes: boolean | null;
    why: GwTermRefusal | null;
  }[];
}

/** A letter of a thread (pack: the scene's text by `variant`). */
export interface GwLetterView {
  with: GwTag;
  out: boolean;
  scene: string | null;
  variant: string | null;
  tone: string | null;
  date: string;
}

/** A promise as the seat remembers it (pack `promises.<key>`). */
export interface GwPromiseView {
  key: string;
  who: string;
  /** YYYY-MM-DD: broken if not kept after this chapter's date. */
  due: string;
  kept: boolean;
  broken: boolean;
  /** ww210: the deadline picked in the lobby (기한); absent: the price's own. */
  term?: GwDealTerm;
}

/** What text can call back to: {mem.<key>} is its date. */
export interface GwMemoryView {
  key: string;
  who: string | null;
  date: string;
}

/** An option or reply taken: the memoir reads these. */
export interface GwChoiceView {
  scene: string;
  pick: string;
  date: string;
  proxy: boolean;
  /** One of the game's big decisions: the notebook lists these. */
  key?: boolean;
  /** Who was in the scene, role -> person: its text names them. */
  cast?: Readonly<Record<string, string>>;
}

export interface GwPersonView {
  id: string;
  office: GwOffice | null;
  trust: number;
  /** Talk scenes open to summon this person now. */
  topics: readonly string[];
  /** Talks open to a private meeting with them now. */
  privateTopics?: readonly string[];
  /** Offices they can be appointed to (public content). */
  fit: readonly GwOffice[];
  /** Person ids they are at odds with (public content). */
  rivals: readonly string[];
  /** ww196: 할 일 markers on the person row (a head's, a petitioner's). */
  todo?: readonly GwTodoView[];
  /** ww196 (P): how often his reports proved wrong, 0 never .. 2 often. */
  misled?: number;
}

export interface GwTheatreView {
  id: GwTheatre;
  line: number;
  progress: number;
  trench: number;
  open: boolean;
  /** The two sides by tag; null where nobody fights yet. */
  attacker: GwTag | null;
  defender: GwTag | null;
}

/** A threat to the government as the seat sees it (text: gw.gov.*). */
export interface GwGovView {
  id: string;
  /** Scenes come so far, out of `steps`. */
  step: number;
  steps: number;
  /** The last of them can lose the game. */
  fatal: boolean;
  /** What is feeding it now: gw.gov.feed.<key>. */
  feeds: readonly string[];
}

/** The whips' count of an election. */
export interface GwPollView {
  id: string;
  seats: number;
  need: number;
  total: number;
  /** Seats past a majority: the party alone, and with friends. */
  own: number;
  margin: number;
  friends: readonly { id: string; seats: number; with: boolean }[];
  /** What moved the seats: gw.gov.swing.<key>. */
  lines: readonly { key: string; seats: number }[];
}

/** A telegram as this seat holds it. */
export interface GwTelegramView {
  uid: number;
  from: GwTag;
  to: GwTag;
  /** "sent" my own, "in" for me, "copy" my listeners took it. */
  box: "sent" | "in" | "copy";
  /** The grade: shown on my own, on the others only as the copy's quality. */
  cipher: number;
  text: string;
  /** YYYY-MM-DD it was sent. */
  date: string;
  /** Sent ones: arrived yet. */
  delivered: boolean;
}

/** A treaty this seat is party to, or the world knows of. */
export interface GwTreatyView {
  uid: number;
  from: GwTag;
  to: GwTag;
  clauses: readonly GwClause[];
  state: GwTreatyState;
  date: string;
  signed: string | null;
  leaked: boolean;
  brokenBy: GwTag | null;
  why: string | null;
  /** A party to it. */
  mine: boolean;
  /** An offer waiting for my answer. */
  answer: boolean;
}

export interface GwDiploView {
  telegrams: readonly GwTelegramView[];
  treaties: readonly GwTreatyView[];
  /** Telegrams this seat can still send this chapter. */
  wiresLeft: number;
}

export interface GwSeatView {
  smallID: number;
  tag: GwTag;
  ready: boolean;
  audiences: number;
  /** Private meetings left this chapter. */
  privates?: number;
  /** Schedule slots left this chapter, and what is on the schedule. */
  actsLeft?: number;
  acts?: readonly GwActView[];
  /** The 통치 tab: the powers this seat holds now (ww169). */
  powers?: readonly GwPowerView[];
  /** ww193: 사람 › 부서, the audience room, the time pool, the gifts. */
  depts?: readonly GwDeptView[];
  room?: readonly GwRoomRowView[];
  time?: GwTimeView;
  /** ww196: never sent (gifts are gone). */
  levers?: readonly GwLeverView[];
  /** ww196: the 사람 tab badge: 할 일 markers not `idle`, all departments. */
  todo?: number;
  /** ww196 (P): the desk heading and the diary, newest last. */
  head?: GwDeskHeadView;
  diary?: readonly GwDiaryView[];
  /** Null where the country has no list: its three tasks stand. */
  aims?: GwAimsView | null;
  /** The land painted as the war's aim. */
  claims?: GwClaimsView;
  /** The peace table; null before an armistice. */
  table?: GwTableView | null;
  /** ww199: the 통치 tab's rows: land ruled, states founded, vassals; words only. */
  ruled?: readonly GwRuledView[];
  terms?: GwTermsView;
  desk: readonly GwCardView[];
  people: readonly GwPersonView[];
  gauges: Readonly<Record<GwGauge, number>>;
  inst: Readonly<Partial<Record<GwInstitution, number>>>;
  theatres: readonly GwTheatreView[];
  alloc: GwAlloc;
  log: readonly GwReason[];
  /** Ready is refused while this is set. */
  readyBlock: GwOrderBlock | null;
  promises?: readonly GwPromiseView[];
  memory?: readonly GwMemoryView[];
  choices?: readonly GwChoiceView[];
  /** Every body dealt, "<scene>.<variant>": the lobby's recent list. */
  shown?: readonly string[];
  letters?: readonly GwLetterView[];
  gov?: readonly GwGovView[];
  poll?: GwPollView | null;
  world: GwWorldView;
  /** The person at the desk; null where the regime has no row. */
  ruler?: GwRulerView | null;
  /** Null with no prologue. */
  prologue?: GwPrologueView | null;
  diplo: GwDiploView;
}

/** Who sits at the table: everyone may see this much. */
export interface GwRosterView {
  smallID: number;
  tag: GwTag;
  ready: boolean;
  /** The seat's AI is running it. */
  regent: boolean;
  /** The connection is down. */
  away: boolean;
  host: boolean;
}

/** The slow-reading vote this chapter. */
export interface GwSlowView {
  /** smallIDs that asked. */
  asked: readonly number[];
  granted: number;
  max: number;
}

/** What opens to everyone at the end (design §9: the memoirs side by side). */
export interface GwFinaleView {
  memoirs: readonly { smallID: number; tag: GwTag; memoir: GwMemoir }[];
  treaties: readonly GwTreatyView[];
  /** Telegrams somebody else read. */
  intercepted: readonly {
    from: GwTag;
    to: GwTag;
    by: readonly GwTag[];
    text: string;
    date: string;
  }[];
}

/** The whole mode as sent worker -> main thread. Never mutated. */
export interface GreatWarData {
  calendar: GwCalendarId;
  chapter: number;
  chapterCount: number;
  stage: GwStage;
  /** YYYY-MM-DD. */
  date: string;
  /** Tick the chapter closes at; null with no timer. */
  deadlineTick: number | null;
  ended: string | null;
  opening: GwOpening;
  temp: number;
  /**
   * The viewer's own seat and no other: the worker sends a client only what
   * that seat may know. Empty for a spectator or a replay.
   */
  seats: readonly GwSeatView[];
  /** Places not in their 1914 owner's hands: place -> who holds it. */
  held: Readonly<Partial<Record<GwPlace, GwTag>>>;
  /** What changed hands as the last chapter closed. */
  landMoves: readonly GwLandMove[];
  /** Friends at the table, in seat order. One entry alone. */
  roster: readonly GwRosterView[];
  slow: GwSlowView;
  /** Set once the game has closed and there are friends to compare. */
  finale: GwFinaleView | null;
  /**
   * ww199: countries named by their fate (new states, vassals), for every
   * screen: the map's labels and the panels name them with `gwRealmName`.
   * Absent with none.
   */
  realms?: readonly GwRealmView[];
}
