// World War 1936 ww81 (design ww80 C1): the AI's main effort, pure. A
// front's attacks go in on one chosen enemy region instead of along the
// whole border (a broad attack at 1.5:1 took 0 of 4 regions, all divisions
// on one region reached the objective). AiLand gathers the plain numbers
// below from the game and acts on the answer; nothing here reads the game.
import { idHash } from "@openfront/engine-lib/ww1936/Roll";

/** wwRoll purpose of the main sector's seeded choice. */
export const P_AXIS = idHash("ai_axis");
/** Rule 1: a sector stands this many days, unless its effort ends first. */
export const AI_EFFORT_PERIOD_DAYS = 10;
/** Rule 1: a fort of this level or more is left out while anything else is in reach. */
export const AI_EFFORT_FORT_BAR = 4;
/** Rule 1: an enemy capital's value, on top of its victory points. */
export const AI_EFFORT_CAPITAL_VALUE = 10;
/** Rule 2 (내 판단): the second-best sector is in the draw within this share of the best. */
export const AI_EFFORT_CLOSE_PCT = 15;

/** One enemy region the effort could go for. */
export interface EffortRegion {
  region: number;
  vp: number;
  capital: boolean;
  /** Fort level there. */
  fort: number;
  /** Combat width of the region at that fort level. */
  width: number;
  /** The enemy divisions' defence there. */
  defence: number;
  /** What else counts: the divisions it would cut off, the road to deeper objectives. */
  extra: number;
}

/**
 * Value × 1000 ÷ defence (rule 1). The value starts at 1, so that with no
 * victory points anywhere the weakest region still wins; the width stands
 * for the fort level, so that nobody at all behind a fort is not free.
 */
export function effortScore(r: EffortRegion): number {
  const value = 1 + r.vp + (r.capital ? AI_EFFORT_CAPITAL_VALUE : 0) + r.extra;
  return Math.floor((value * 1000) / Math.max(1, r.defence + r.fort * r.width));
}

/**
 * The main sector among `regions`: the best score, the fort-free ones first;
 * ties to the smaller id. `roll` (any non-negative integer, the seeded draw of
 * this period) takes the second best half the time when it is within
 * AI_EFFORT_CLOSE_PCT of the best, so games differ. 0 with no region.
 * `score` is effortScore unless the caller has adjusted it.
 */
export function pickMainSector(
  regions: readonly EffortRegion[],
  roll: number,
  score: (r: EffortRegion) => number = effortScore,
): number {
  const open = regions.filter((r) => r.fort < AI_EFFORT_FORT_BAR);
  const list = (open.length > 0 ? open : regions)
    .map((r) => ({ region: r.region, score: score(r) }))
    .sort((a, b) => b.score - a.score || a.region - b.region);
  if (list.length === 0) return 0;
  const [first, second] = list;
  const close =
    second !== undefined &&
    second.score * 100 >= first.score * (100 - AI_EFFORT_CLOSE_PCT);
  return close && roll % 2 === 1 ? second.region : first.region;
}
