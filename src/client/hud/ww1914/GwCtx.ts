import type {
  GwAskClause,
  GwBackDirection,
  GwGiveClause,
  GwReason,
  GwResearch,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBudgetPlan } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GreatWarData,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { DictRef } from "./GwDictModel";
import type { GwTab, Shelf } from "./GwModel";

/** A region tapped on the map. */
export interface GwSpot {
  region: number;
  /** A tile of it: who holds it is read from here. */
  tile: number;
  place: GwPlace | null;
  name: string;
}

/** What the screens ask of the map; null with no renderer behind them. */
export interface GwMapApi {
  /** Moves the camera to a place and rings it; `beside`: clear of the reader. */
  fly(place: GwPlace, beside?: boolean): void;
  /** Rings a region; null clears it. */
  ring(region: number | null): void;
  spotOfPlace(place: GwPlace): GwSpot | null;
  holderAt(tile: number): GwTag | null;
}

/** One line of a talk as it stood: the card at that node, what I answered. */
export interface TalkTurn {
  /** The card as it was at this node: its text is looked up when drawn. */
  card: GwCardView;
  /** The reply I gave (its id), null while it is my turn. */
  reply: string | null;
  /** The price I was shown for the reply. */
  tell: readonly string[];
  /** Date.now() when the reply went; a reply the engine refused comes back. */
  sentAt?: number;
}

export interface Transcript {
  uid: number;
  who: string;
  scene: string;
  cast: Readonly<Record<string, string>>;
  turns: TalkTurn[];
  /** The last node's id, so a new node is told from a repeat. */
  node: string | null;
  closed: boolean;
  /** How long the why-log was when it began: lines after are its reasons. */
  logAt: number;
  /** The reasons that came while it ran. */
  reasons: readonly GwReason[];
}

/** What a signed choice left, shown on the desk after the signature. */
export interface GwResultNote {
  chapter: number;
  title: string;
  pick: string;
  /** The option's text after its lead: what follows from it. */
  rest: string;
  tell: readonly string[];
}

/** What the screens may change; the panel owns the instance. */
export interface GwUi {
  tab: GwTab;
  /** The drawer is folded to its tab strip. */
  folded: boolean;
  readerUid: number | null;
  /** An option picked in the reader and waiting for its signature. */
  armed: { uid: number; option: string } | null;
  talkUid: number | null;
  talks: Map<number, Transcript>;
  openPerson: string | null;
  /** The list of private meetings is open on the people tab. */
  privateOpen: boolean;
  /** Date.now() of the last summon sent; a talk that appears soon after opens itself. */
  summoned: number;
  /** A dismissal waiting for its second tap. */
  armedDismiss: string | null;
  /** A repeal waiting for its second tap. */
  armedRepeal: string | null;
  /** The research picked for the paper about to be signed. */
  research: GwResearch | null;
  /** The budget panel is open. */
  budgetOpen: boolean;
  /** The plan being changed there; null shows the draft. */
  budgetPlan: GwBudgetPlan | null;
  /** The name or term whose dictionary card is open. */
  term: DictRef | null;
  /** The list open under a press act. */
  pressPick: "invite" | "leak" | null;
  /** The schedule entry open, and what is picked in it so far. */
  actOpen: string | null;
  actPicks: Record<string, string[]>;
  /** The list of aims is open to change one; the aim waiting for its word. */
  aimOpen: boolean;
  aimArmed: string | null;
  /** The map being painted with the land wanted; null while it isn't. */
  paint: GwPlace[] | null;
  /** The place picked on the map at the seat's turn at the table. */
  tableArmed: GwPlace | null;
  /** A place tapped that this table can't ask for. */
  tableBarred: GwPlace | null;
  /** The list of what could stand in for the land is open. */
  tableOffer: boolean;
  /** Terms being drawn up. */
  termTag: GwTag | null;
  termGive: GwGiveClause[];
  termAsk: GwAskClause[];
  /** "다시 써 오시오" is open in the reader; the direction waiting for its word. */
  backOpen: boolean;
  backArmed: GwBackDirection | null;
  shelf: Shelf;
  /** Choices signed lately, newest last; their results show on the desk. */
  notes: GwResultNote[];
  /** The years were lived on this screen: their picks are kept, the first card opens. */
  pastDue: boolean;
  /** The region tapped on the map: its sheet is open. */
  spot: GwSpot | null;
  /** The front a general is being picked for, and the one picked. */
  postOpen: GwTheatre | null;
  postArmed: string | null;
}

export interface GwCtx {
  data: GreatWarData;
  seat: GwSeatView;
  pack: GwPack | null;
  ui: GwUi;
  map?: GwMapApi | null;
  tick: number;
  send(order: GwOrder): void;
  /** Redraw after a change of ui state. */
  redraw(): void;
  /** Moves the camera to a place; absent with no map. */
  fly?(place: GwPlace): void;
  card(uid: number): GwCardView | undefined;
}
