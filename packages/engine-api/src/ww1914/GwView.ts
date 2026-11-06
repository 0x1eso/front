// Great War 1914: what the screens read (GameUpdateType.GreatWar). Only what
// the seat may know: no competence, health, temperament, strength band or
// source band. Text is looked up in the pack by these ids.
import type {
  GwAlloc,
  GwCalendarId,
  GwGauge,
  GwInstitution,
  GwOffice,
  GwOpening,
  GwReason,
  GwStage,
  GwStamp,
  GwTheatre,
} from "./GreatWarTypes";
import type { GwTag } from "./GwCountries";
import type { GwOrderBlock } from "./GwOrders";
import type { GwReplyKind, GwSceneKind, GwStance } from "./SceneDsl";

export interface GwOptionView {
  id: string;
  /** False: greyed, with the pack's `why.<id>`. */
  open: boolean;
  tell: readonly string[];
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
}

export interface GwPersonView {
  id: string;
  office: GwOffice | null;
  trust: number;
  /** Talk scenes open to summon this person now. */
  topics: readonly string[];
}

export interface GwTheatreView {
  id: GwTheatre;
  line: number;
  progress: number;
  trench: number;
  open: boolean;
}

export interface GwSeatView {
  smallID: number;
  tag: GwTag;
  ready: boolean;
  audiences: number;
  desk: readonly GwCardView[];
  people: readonly GwPersonView[];
  gauges: Readonly<Record<GwGauge, number>>;
  inst: Readonly<Partial<Record<GwInstitution, number>>>;
  theatres: readonly GwTheatreView[];
  alloc: GwAlloc;
  log: readonly GwReason[];
  /** Ready is refused while this is set. */
  readyBlock: GwOrderBlock | null;
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
