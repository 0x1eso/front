// P6 lane M fills this file (plan Task 4): production licences (spec §7.1).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

/** licence_request, licence_answer, licence_cancel. */
export function issueLicence(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "no_partner";
}

/** Spec §7.1: the licence's extra cost on `key`, percent. */
export function licenceCostPctFor(d: WwDepth, id: number, key: number): number {
  return 0;
}

/** The EQUIP_KEYS indices the country holds a licence for, ascending. */
export function licenceKeys(d: WwDepth, id: number): number[] {
  return [];
}
