// Great War 1914: what the screens read (GameUpdateType.GreatWar). Only what
// the seat may know: no competence, health, temperament, strength band or
// source band. Text is looked up in the pack by these ids.
import type {
  GwAlloc,
  GwAskClause,
  GwBack,
  GwBackDirection,
  GwCalendarId,
  GwGauge,
  GwGiveClause,
  GwInstitution,
  GwOffice,
  GwOpening,
  GwReason,
  GwStage,
  GwStamp,
  GwTermRefusal,
  GwTheatre,
} from "./GreatWarTypes";
import type { GwTag } from "./GwCountries";
import type { GwOrderBlock } from "./GwOrders";
import type { GwRulerView } from "./GwRuler";
import type { GwWorldView } from "./GwWorldView";
import type { GwActKind } from "./GwActs";
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

/** A promise as the seat remembers it (pack `promises.<key>`). */
export interface GwPromiseView {
  key: string;
  who: string;
  /** YYYY-MM-DD: broken if not kept after this chapter's date. */
  due: string;
  kept: boolean;
  broken: boolean;
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
  /** Null where the country has no list: its three tasks stand. */
  aims?: GwAimsView | null;
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
  gov?: readonly GwGovView[];
  poll?: GwPollView | null;
  world: GwWorldView;
  /** The person at the desk; null where the regime has no row. */
  ruler?: GwRulerView | null;
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
  seats: readonly GwSeatView[];
}
