// World War 1936: peace on the current line (현 점령선 평화, owner request
// 2026-10-31). A war ends with each side keeping what it holds: every
// region whose legal owner is on one side and whose occupier is on the
// other passes, legal ownership and control, to its occupier. No core comes
// with it, so resistance and integration follow as for a conference take.
// Capitals go back, so does the last region a country needs to stay alive;
// Korea, Taiwan (but to its Chinese claimant) and occupation zones keep the
// white peace's rule. No cap: neither the negotiated peace's 12 regions nor
// its 40% of the victory points. These are the line's rules and its worth
// to a side as pure functions: the engine settles and judges an offer with
// them, and the screens show the same split and chance. Integers only;
// regions by id, countries by smallID.
import type { WwLinePeaceSplit } from "@openfront/engine-api/ww1936/EndgameTypes";
import { NEG_PEACE_CONTROLLED_PCT, NegPeaceFacts } from "./NegPeaceRules";
import {
  peaceRegionBlock,
  PeaceSensitivity,
  PeaceTable,
  SensitiveBlock,
} from "./PeaceRules";

// ---- The AI (named thresholds) ----

/**
 * A losing side counts the land it gives up under the line less the
 * nearer it is to its surrender line — it would lose it anyway: at its
 * line this percent less, in proportion before.
 */
export const AI_LINE_RELIEF_PCT = 100;
/**
 * A side leader offering a line on a stalemate asks its own judge (as if
 * the other side offered it) at this roll, the middle of 0..99: it offers
 * only a line it would itself take more often than not (a side clearly
 * winning would not: it takes more by fighting on).
 */
export const AI_LINE_SELF_ROLL = 50;
/** The AI offers a line only when the other side's judge takes it at least this often (percent). */
export const AI_LINE_PROPOSE_MIN_PCT = 25;

/** The world the line reads (the engine's state). */
export interface LinePeaceFacts extends NegPeaceFacts {
  /** Every land region id, ascending. */
  readonly regions: readonly number[];
  /** The regions that always go back to `id`: its capital (an exile's recorded one too). */
  capitals(id: number): readonly number[];
}

/** One region changing hands: [region, its legal owner (the giver), its occupier (the receiver)]. */
export type LineMove = readonly [number, number, number];

const NO_TABLE: PeaceTable = {
  stake: [],
  base: [],
  losers: [],
  parts: [],
  claims: [],
  conquer: [],
  topple: [],
  settled: [],
};

/**
 * Korea and Taiwan under the line (the owner's sensitivity rule, P5's
 * peaceRegionBlock for a take with the receiver the only participant):
 * Korea never changes hands (zone_only); Taiwan goes only to a claimant
 * (`s.claimants`: China), never to the excluded country (claim_only).
 * Every other region: null.
 */
export function linePeaceRegionBlock(
  s: PeaceSensitivity,
  receiver: number,
  region: number,
): SensitiveBlock | null {
  return peaceRegionBlock(
    s,
    { ...NO_TABLE, parts: [{ id: receiver }] },
    receiver,
    receiver,
    "take",
    region,
  );
}

/**
 * The regions a line peace between groups `a` and `b` hands over, in
 * region order: each one legally owned in one group and controlled by a
 * member of the other goes to its controller — not an occupation zone, not
 * Korea or Taiwan (linePeaceRegionBlock), not its owner's capital. A
 * country left holding nothing (none of its regions kept or coming back)
 * keeps its most valuable one (victory points, then base, then the smaller
 * id): no country is erased.
 */
export function linePeaceMoves(
  f: LinePeaceFacts,
  s: PeaceSensitivity,
  a: ReadonlySet<number>,
  b: ReadonlySet<number>,
): LineMove[] {
  const other = (x: number): ReadonlySet<number> | null =>
    a.has(x) ? b : b.has(x) ? a : null;
  const moves: LineMove[] = [];
  for (const r of f.regions) {
    const l = f.legalOwner(r);
    const c = f.controller(r);
    if (l <= 0 || c <= 0 || l === c || other(l)?.has(c) !== true) continue;
    if (f.isZone(r) || linePeaceRegionBlock(s, c, r) !== null) continue;
    if (f.capitals(l).includes(r)) continue;
    moves.push([r, l, c]);
  }
  if (moves.length === 0) return moves;
  // What each giver keeps: a region it holds, or one the other side gives back.
  const moving = new Set(moves.map((m) => m[0]));
  const givers = new Set(moves.map((m) => m[1]));
  const keeps = new Set<number>();
  for (const r of f.regions) {
    const l = f.legalOwner(r);
    if (!givers.has(l) || keeps.has(l) || moving.has(r)) continue;
    const c = f.controller(r);
    if (c === l || other(l)?.has(c) === true) keeps.add(l);
  }
  const stay = new Set<number>();
  for (const l of [...givers].sort((x, y) => x - y)) {
    if (keeps.has(l)) continue;
    let best = 0;
    let bestVp = -1;
    let bestBase = -1;
    for (const [r, g] of moves) {
      if (g !== l) continue;
      const vp = f.vp(r);
      const base = f.base(r);
      if (vp > bestVp || (vp === bestVp && base > bestBase)) {
        best = r;
        bestVp = vp;
        bestBase = base;
      }
    }
    if (best > 0) stay.add(best);
  }
  return stay.size === 0 ? moves : moves.filter((m) => !stay.has(m[0]));
}

/**
 * A region's worth to the side that gets it under the line, points: the
 * conference's base(r) at its control factor (the receiver holds it
 * already), as the negotiated peace values occupied land.
 */
export function lineRegionValue(f: NegPeaceFacts, region: number): number {
  return Math.floor((f.base(region) * NEG_PEACE_CONTROLLED_PCT) / 100);
}

/** The share (‰) of its losses a side `capPm` ‰ of the way to its surrender line does not count. */
export function linePeaceReliefPm(capPm: number): number {
  const c = Math.max(0, Math.min(1000, capPm));
  return Math.floor((c * AI_LINE_RELIEF_PCT) / 100);
}

/**
 * The line's worth to the side `side` names (its members), points: the
 * regions it gets, less those it gives up — counted at (1000 − reliefPm) ‰.
 */
export function linePeaceValue(
  f: NegPeaceFacts,
  moves: readonly LineMove[],
  side: (id: number) => boolean,
  reliefPm: number,
): number {
  let gain = 0;
  let loss = 0;
  for (const [r, giver, receiver] of moves) {
    if (side(receiver)) gain += lineRegionValue(f, r);
    else if (side(giver)) loss += lineRegionValue(f, r);
  }
  const counted = 1000 - Math.max(0, Math.min(1000, reliefPm));
  return gain - Math.floor((loss * counted) / 1000);
}

/** The line seen from the side `side` names: the regions it gets and gives up, and their victory points. */
export function linePeaceSplit(
  f: NegPeaceFacts,
  moves: readonly LineMove[],
  side: (id: number) => boolean,
): WwLinePeaceSplit {
  const out: WwLinePeaceSplit = { gain: [], lose: [], gainVp: 0, loseVp: 0 };
  for (const [r, giver, receiver] of moves) {
    if (side(receiver)) {
      out.gain.push(r);
      out.gainVp += f.vp(r);
    } else if (side(giver)) {
      out.lose.push(r);
      out.loseVp += f.vp(r);
    }
  }
  return out;
}
