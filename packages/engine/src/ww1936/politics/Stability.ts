// World War 1936 P3: stability and war support (spec §6.1). STUB: lane P
// (Task 4) writes the body; the signature is final.
import type { WwPolLine } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

/** Spec §6.1: today's stability and war support from the bases and lines. */
export function computeStability(
  pol: WwPolitics,
  id: number,
): { stabBp: number; wsBp: number } {
  const c = pol.country(id)!;
  return { stabBp: c.stabBaseBp, wsBp: c.wsBaseBp };
}

/**
 * Spec §6.1, §21.4-1: today's lines of stability ("stab") or war support
 * ("ws") for the government tab, bp each (controller rulings R2, R4).
 * STUB: lane P (Task 4) writes it.
 */
export function stabilityLines(
  pol: WwPolitics,
  id: number,
  which: "stab" | "ws",
): WwPolLine[] {
  return [];
}
