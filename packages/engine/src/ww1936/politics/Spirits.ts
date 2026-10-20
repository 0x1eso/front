// World War 1936 P3: national spirits (spec §9). STUB: lane P (Task 4)
// writes the bodies; the signatures are final.
import type { SpiritId } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function addSpirit(
  pol: WwPolitics,
  id: number,
  spirit: SpiritId,
  days: number | undefined,
  day: number,
): void {}

export function removeSpirit(
  pol: WwPolitics,
  id: number,
  spirit: SpiritId,
): void {}

export function swapSpirit(
  pol: WwPolitics,
  id: number,
  from: SpiritId,
  to: SpiritId,
  day: number,
): void {}

export function hasRule(
  pol: WwPolitics,
  id: number,
  rule: "no_faction" | "no_justify" | "no_elections" | "free_guarantees",
): boolean {
  return false;
}

/**
 * The value of a numeric spirit rule in force for `id` (the smallest
 * guaranteeGatePct, the largest factionGateMinusPp); null when none
 * (controller ruling R2).
 */
export function ruleValue(
  pol: WwPolitics,
  id: number,
  rule: "guaranteeGatePct" | "factionGateMinusPp",
): number | null {
  return null;
}

/** {dmz} groups in force for `id`; P2 movement and P1 construction read it. */
export function dmzRegions(pol: WwPolitics, id: number): number[] {
  return [];
}
