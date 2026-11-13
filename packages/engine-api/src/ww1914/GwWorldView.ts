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
  GwOffMethod,
  GwPlan,
  GwResearch,
  GwResult,
  GwSecret,
  GwSide,
  GwSource,
  GwStamp,
  GwTech,
  GwTempo,
  GwTheatre,
  GwThread,
} from "./GreatWarTypes";
import type { GwAgentsView, GwPropView } from "./GwAgents";
import type { GwBudgetView } from "./GwBudget";
import type { GwTag } from "./GwCountries";
import type { GwCraftView } from "./GwCraft";
import type { GwDossierView, GwHouseView } from "./GwHouse";
import type { GwBookView, GwLawView } from "./GwLaw";
import type { GwPlace } from "./GwPlaces";
import type { GwPressView } from "./GwPress";
import type { GwSocietyView } from "./GwSociety";

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
  /**
   * ww197: the paper a department's front course asked for, put first and
   * marked as its own ("참모본부 안"); `course` is GW_FRONT_COURSES.
   */
  marked?: { office: GwOffice; by: string; course: string };
  /**
   * ww173: the great offensive's paper. Each method with whether it is open
   * (text gw.plan_why.<why> if not), and the other fronts a feint can be on.
   */
  offensive?: {
    methods: readonly {
      method: GwOffMethod;
      open: boolean;
      why: string | null;
    }[];
    feints: readonly GwTheatre[];
  };
}

/** ww173: our own great offensive on a front, in words; never another's. */
export interface GwFrontPrepView {
  method: GwOffMethod;
  /** 0 while it is prepared, 1..4 its rounds. */
  round: number;
  /** The month of preparation it is in, from 1. */
  month: number;
  /** Prepared enough: it goes in as this chapter closes. */
  ready: boolean;
}

export interface GwGaugeView {
  gauge: GwGauge;
  value: number;
  /** Text: gw.gauge.<gauge>.<word>. */
  word: number;
  /** Why it moved in the last chapter; text gw.line.<key>. */
  lines: readonly { key: string; delta: number }[];
  /**
   * ww201: where the production step is taking it, -2..2 (GwEcon
   * `gwTrendOf`); word `gwTrendWord(trend, value, max)`, text
   * gw.ui.trend.<word>. Always 0 for morale and order.
   */
  trend: number;
  /** ww201: the largest cause in the trend's direction; gw.line.<why>. */
  why: string | null;
  /** ww201: what the step moved at the chapter's turn (the 지금 line). */
  step: { delta: number; key: string } | null;
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
  /**
   * ww173: our own end's strain in words, 0 holding .. 3 near breaking.
   * Never the enemy's: that comes only by reports.
   */
  strain?: number;
  /** ww173: our own great offensive here, if any. */
  prep?: GwFrontPrepView | null;
  last: {
    result: GwResult;
    by: GwSide | null;
    /** Thousands, ours and theirs. */
    ours: number;
    theirs: number;
    luck: number;
  } | null;
  /**
   * ww173: what the seat's newest report says of the foe's strain here (its
   * word 0..4 and stamp); null: none, or no foe. Never the truth.
   */
  foe?: { tag: GwTag; word: number; stamp: GwStamp } | null;
  /** ww173: the seat reads the foe's codes now. */
  reading?: boolean;
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
  /** What it is about beyond the country: a plot, a file, an ask (ww158). */
  about?: string | null;
}

/**
 * ww179: the seat's own secret service, as its 정보부 tab shows it. Only what
 * the service knows of itself: never another country's service, how near a
 * foe is to changing its codes, or a result whose card hasn't come yet.
 */
export interface GwIntelView {
  /**
   * 0..3 words: breaking others' codes, our own codes, catching spies; null
   * while the service has never been used.
   */
  levels: { read: number; guard: number; hunt: number } | null;
  /** Whom the service works on: in war its foes, in peace the other camp. */
  rivals: readonly GwTag[];
  /**
   * Countries whose codes we read now, with the fronts a read named this
   * chapter: putting the main effort there may tell them.
   */
  reads: readonly { tag: GwTag; named: readonly GwTheatre[] }[];
  /** Our agents abroad, 1..3, as far as results already reported say. */
  nets: readonly { tag: GwTag; size: number }[];
  /** Foreign agents we took, waiting for our word; agents we turned. */
  caught: readonly { tag: GwTag; chapter: number }[];
  turned: readonly GwTag[];
  /** Our operations abroad, newest last; `ok`/`out` null until the card came. */
  ops: readonly {
    act: string;
    tag: GwTag | null;
    ok: boolean | null;
    out: boolean | null;
    chapter: number;
  }[];
  /**
   * ww180: the service's money and men, in GW_SERVICE_BRANCHES order (no ids,
   * so no word of a service's insides leaks by name): each branch's level (0..3), the share the seat gave it (0..3), and where it is heading:
   * -1 falling, 0 holding, 1 rising, 2 rising fast, 3 as far as it goes.
   * `nets`: how many countries it can keep nets in. `broke`: the treasury is
   * empty, so a bigger share buys nothing. `air`: photographs from the air
   * help it see the enemy's preparation.
   */
  fund?: {
    branches: readonly {
      level: number;
      share: number;
      trend: number;
    }[];
    nets: number;
    broke: boolean;
    air: boolean;
  };
}

/**
 * ww180: the seat's own chain of direction-finding stations at sea, for the
 * 정보부 tab's sea section. Only what we built and heard, never the enemy's.
 */
export interface GwSeaView {
  /** The country fights at sea now: a chain can be ordered. */
  atSea: boolean;
  /** Stations up, 0..3; 0 while none was ordered. */
  stations: number;
  /** 0 listens only, 1 warns the fleet, 2 also steers ships; null with none. */
  use: number | null;
  /** What it heard, newest last; `decoded`: read in their codes as well. */
  log: readonly {
    kind: "uboat" | "sortie";
    tag: GwTag;
    chapter: number;
    used: boolean;
    decoded: boolean;
  }[];
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
  /** YYYY-MM-DD it began, and of the general order; absent until stamped. */
  mobFrom?: string | null;
  mobFull?: string | null;
}

/**
 * ww179: one research track of the seat's own country, as the country tab
 * words it. `step`: 0 just begun, 1 halfway, 2 nearly, 3 ready but the war is
 * not long enough yet. `next` null: nothing more to reach on it; `none`:
 * nothing this country can ever reach on it.
 */
export interface GwResearchTrackView {
  id: GwResearch;
  next: GwTech | null;
  step: number;
  none: boolean;
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
  /** ww179: its research, track by track, and the track it works on now. */
  research?: {
    track: GwResearch;
    /** Research is put in only while the country fights. */
    active: boolean;
    tracks: readonly GwResearchTrackView[];
  };
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
  /** ww173: the standing word on the fronts the seat gave; null: the chief's own way. */
  tempo?: GwTempo | null;
  fronts: readonly GwFrontView[];
  /** Generals who can be sent to a front. */
  generals?: readonly string[];
  chain: { topic: string; step: number; hold: number } | null;
  chainEnds: readonly { topic: string; outcome: GwChainOutcome }[];
  reports: readonly GwReportView[];
  sources: readonly GwSourceView[];
  /** ww179: the 정보부 tab's own service; absent in old views. */
  service?: GwIntelView;
  /** ww180: the chain at sea; absent for a country with no fleet on that front. */
  sea?: GwSeaView;
  /** ww180: the seat's named agents and the pool; absent in old views. */
  agents?: GwAgentsView;
  /** ww180: the seat's propaganda campaigns; absent in old views. */
  prop?: GwPropView;
  mandates: readonly string[];
  secrets: readonly GwSecret[];
  threads: readonly GwThread[];
  people: readonly GwPersonWorldView[];
  /**
   * Vacant office -> up to two people for it, of different camps where there
   * are. A held office has no entry.
   */
  candidates: Readonly<Partial<Record<GwOffice, readonly string[]>>>;
  countries: readonly GwCountryView[];
  news: readonly GwNews[];
  memoir: GwMemoir | null;
  budget: GwBudgetView;
  /** Bills open, moving and in force. */
  laws: readonly GwLawView[];
  /** The country has bills, none open yet: the box shows, saying so (w159). */
  lawsAhead?: true;
  /** ww203: the 법전 and 의사일정; absent for a country with no bills. */
  book?: GwBookView;
  /** Null for a country with no bloc row yet. */
  press: GwPressView | null;
  /** Inventions, the year's project, the footing (ww157). */
  craft?: GwCraftView;
  /** The house and its factions (ww158); absent for a country with no rows. */
  house?: GwHouseView;
  /** The notebook's 서류철 and allies' asks (ww158, S2); absent with none. */
  dossier?: GwDossierView;
  /** ww207: the bottom strip, the axes and communities, the election card; absent with no house. */
  society?: GwSocietyView;
}
