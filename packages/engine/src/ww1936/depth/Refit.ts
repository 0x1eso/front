// P6 lane E fills this file (plan Task 3): ship refits (spec §5.3.4).
// The foundation's stub: final signatures, neutral answers.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

export function startRefit(
  d: WwDepth,
  id: number,
  ship: number,
  slot: number,
  tick: number,
): WwOrderBlock | null {
  return "not_refittable";
}

export function dailyRefits(d: WwDepth, id: number, day: number): void {}
