// Great War 1914 (ww218 §4, §5): army tokens on the map and moving bands.
// A seat's view only: ours exact, allies and foes as the seat believes them.
import type { GwSide, GwTheatre } from "./GreatWarTypes";
import type { GwTag } from "./GwCountries";
import type { GwPlaceGroup } from "./GwPlaces";

/** front: an end of an open front; reserve: at the capital; moving: by rail. */
export const GW_TOKEN_KINDS = [
  "front",
  "reserve",
  "moving",
  "garrison",
] as const;
export type GwTokenKind = (typeof GW_TOKEN_KINDS)[number];

export const GW_TOKEN_RELS = ["own", "ally", "foe"] as const;
export type GwTokenRel = (typeof GW_TOKEN_RELS)[number];

/** What the best of the estimate rests on; text gw.token.seen.<seen>. */
export const GW_TOKEN_SEEN = [
  "own", // our own army: exact
  "ally", // an ally's word
  "contact", // the line in front of us, nothing more
  "report", // a confirmed report on its strength lately
  "air", // photographs from the air
  "codes", // a raid won or its codes read this chapter
  "none", // nothing at all: "?"
] as const;
export type GwTokenSeen = (typeof GW_TOKEN_SEEN)[number];

/** Where a band of ours could be sent from this token, and how long it takes. */
export interface GwTokenMove {
  to: GwTheatre;
  /** Chapters on the way; text by gwEtaWord. */
  eta: number;
  /** False: greyed, text gw.ui.block.<why>. */
  open: boolean;
  why: string | null;
}

export interface GwTokenView {
  kind: GwTokenKind;
  tag: GwTag;
  rel: GwTokenRel;
  /** front: its front; moving: the front it left (null from the reserve); else null. */
  theatre: GwTheatre | null;
  /** front: the end it holds; else null. */
  side: GwSide | null;
  /** Anchor on the map, GW_PLACES `center` units; tokens sharing one fan out. */
  at: readonly [number, number];
  /** Divisions: exact for ours; believed for others; null at sure 0 ("?"). */
  divs: number | null;
  /** The believed range; lo = hi = divs for ours, 0 at sure 0. */
  lo: number;
  hi: number;
  /** 0 nothing .. 3 sure; 3 for ours, 2 for allies. Sure 3 can still be fooled. */
  sure: number;
  seen: GwTokenSeen;
  /** 0..100 how full the divisions are (1 - wear/8); null for foes (grey bar). */
  fill: number | null;
  /** 0..100 (1 - strain/100), our own front tokens only. */
  order: number | null;
  /** moving: the front it goes to. */
  to?: GwTheatre;
  /** moving: chapters left; reserve: chapters until the chief's default. */
  eta?: number;
  /** garrison: the occupied group it holds down. */
  group?: GwPlaceGroup;
  /** Our own front and reserve tokens: where a band could go (order move_band). */
  moves?: readonly GwTokenMove[];
}

/** A move's time in words: 0 within the month, 1 about a month, 2 two, 3 a season. */
export function gwEtaWord(eta: number): number {
  return Math.max(0, Math.min(3, eta - 1));
}
