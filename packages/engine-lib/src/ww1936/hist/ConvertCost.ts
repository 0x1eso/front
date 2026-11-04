// World War 1936 historical catalogue: how a real price becomes an industry
// cost. Owner decision (2026-11-05): production time may break history so the
// game does not drag. A family's TYPICAL item costs what today's generic
// equivalent costs (anchor, in the game's own points, at the family's median
// real price); real price differences stay as ratios, but compressed at the
// extremes: twice the typical price costs about 1.5x, four times about 2.2x,
// so a Tiger or a B-29 is clearly dearer (2-3x a contemporary) and not 10-30x.
import { interp, roundInt, Table } from "./Num";

/** Price over the family's reference price (per mille) to cost multiplier (per mille). Concave, strictly rising. */
export const COST_CURVE: Table = [
  [100, 300],
  [250, 480],
  [500, 690],
  [750, 860],
  [1000, 1000],
  [1500, 1250],
  [2000, 1470],
  [3000, 1850],
  [4000, 2150],
  [6000, 2600],
  [10000, 3200],
];

/**
 * Cost in the game's milli points: `anchorMilli` is the cost of an item at
 * `refPrice` (the family's median real price, same unit as `price`).
 */
export function scaledCost(
  anchorMilli: number,
  price: number,
  refPrice: number,
): number {
  const ratioPm = roundInt((price * 1000) / refPrice);
  return roundInt((anchorMilli * interp(COST_CURVE, ratioPm)) / 1000);
}

/**
 * A soft cap: up to `knee` the value is unchanged, above it only a third
 * counts, so a bigger input still gives a bigger output (no flat tops),
 * up to a hard `max` far above the knee.
 */
export function softCap(v: number, knee: number, max: number): number {
  if (v <= knee) return v;
  return Math.min(max, knee + Math.floor((v - knee) / 3));
}
