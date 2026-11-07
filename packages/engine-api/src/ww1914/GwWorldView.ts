// Great War 1914: what a seat sees of the world, under `seat.world` in the
// view. Only what the seat may know: no band of any kind, no lean, no AI
// character, nothing of a report still unchecked but what it says.
import type {
  GwAlloc,
  GwArmisticeKind,
  GwChainOutcome,
  GwEra,
  GwFactKind,
  GwGauge,
  GwIssue,
  GwMemoir,
  GwNews,
  GwOffice,
  GwPlan,
  GwResult,
  GwSecret,
  GwSide,
  GwSource,
  GwStamp,
  GwTheatre,
  GwThread,
} from "./GreatWarTypes";
import type { GwBudgetView } from "./GwBudget";
import type { GwTag } from "./GwCountries";
import type { GwLawView } from "./GwLaw";
import type { GwPlace } from "./GwPlaces";
import type { GwPressView } from "./GwPress";

/** One of the chief of staff's papers; send it back as an `allocate`. */
export interface GwProposal {
  id: string;
  /** Who signed it. */
  by: string | null;
  main: GwTheatre;
  posture: GwAlloc["posture"];
  scale: GwAlloc["scale"];
  allyShare: number;
  /** False: greyed, with text gw.plan_why.<why>. */
  open: boolean;
  why: string | null;
  /** His word for the odds, 0..4, gw.odds.<n>. His temperament colours it. */
  estimate: number;
  tell: readonly string[];
  /** Painted land still to take on this paper's front. */
  claimed?: readonly GwPlace[];
}

export interface GwGaugeView {
  gauge: GwGauge;
  value: number;
  /** Text: gw.gauge.<gauge>.<word>. */
  word: number;
  /** Why it moved in the last chapter; text gw.line.<key>. */
  lines: readonly { key: string; delta: number }[];
}

export interface GwFrontView {
  id: GwTheatre;
  /** Text: gw.front.<id>.<line>. */
  line: string;
  lineIndex: number;
  lineCount: number;
  /** -2..2 towards the next line. */
  progress: number;
  /** The side a rising line favours. */
  up: GwSide;
  trench: number;
  commander: string | null;
  last: {
    result: GwResult;
    by: GwSide | null;
    /** Thousands, ours and theirs. */
    ours: number;
    theirs: number;
    luck: number;
  } | null;
}

export interface GwReportView {
  uid: number;
  fact: GwFactKind;
  tag: GwTag;
  theatre: GwTheatre | null;
  source: GwSource;
  stamp: GwStamp;
  claim: number;
  chapter: number;
  /** Once checked: whether it held, and what was so. */
  checked: boolean;
  corrected: number | null;
}

export interface GwSourceView {
  id: GwSource;
  right: number;
  wrong: number;
}

export interface GwPersonWorldView {
  id: string;
  /** Fired or resigned people are listed too: status comes from the people list. */
  wins: number;
  losses: number;
  /** 0 not known yet, 1 poor, 2 fair, 3 good: from results only. */
  repute: number;
  letter: boolean;
  ailing: boolean;
  /** Authority a dismissal would cost. */
  dismissPrice: number;
}

export interface GwCountryView {
  tag: GwTag;
  side: GwSide | null;
  out: boolean;
  /** Mobilization as publicly seen: 0, 1, 2. */
  mob: number;
}

/** The war at large: what the papers and the admiralty can tell anyone. */
export interface GwWarView {
  era: GwEra;
  /** Text: gw.regime.<id>; "" for a country with no row. */
  regime: string;
  command: boolean;
  /** 0..3 words: gw.ui.sea.<n>. */
  blockade: number;
  shipping: number;
  uboat: number;
  /** America as the papers read it, 0 cold .. 3 ready: gw.ui.america.<n>. */
  america: number;
  /** What the seat's country has reached: gw.tech.<id>. */
  techs: readonly string[];
  /** The fighting has stopped. */
  armistice: GwArmisticeKind | null;
  votes: readonly {
    issue: GwIssue;
    ayes: number;
    noes: number;
    chapter: number;
  }[];
}

/** The seat's own country, and the world as it can see it. */
export interface GwWorldView {
  war: GwWarView;
  gauges: readonly GwGaugeView[];
  authority: number;
  manpower: number;
  casualties: number;
  unrest: number;
  side: GwSide | null;
  plan: GwPlan | null;
  /** A plan was signed this chapter. */
  signed: boolean;
  proposals: readonly GwProposal[];
  fronts: readonly GwFrontView[];
  /** Generals who can be sent to a front. */
  generals?: readonly string[];
  chain: { topic: string; step: number; hold: number } | null;
  chainEnds: readonly { topic: string; outcome: GwChainOutcome }[];
  reports: readonly GwReportView[];
  sources: readonly GwSourceView[];
  mandates: readonly string[];
  secrets: readonly GwSecret[];
  threads: readonly GwThread[];
  people: readonly GwPersonWorldView[];
  /** Office -> up to two people for it, of different camps where there are. */
  candidates: Readonly<Partial<Record<GwOffice, readonly string[]>>>;
  countries: readonly GwCountryView[];
  news: readonly GwNews[];
  memoir: GwMemoir | null;
  budget: GwBudgetView;
  /** Bills open, moving and in force. */
  laws: readonly GwLawView[];
  /** Null for a country with no bloc row yet. */
  press: GwPressView | null;
}
