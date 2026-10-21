// P6 lane W3 fills this file (plan Task 9): the US congress (spec §13.1).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** The congress refuses the US action now. */
export function congressBlock(
  d: WwDepth,
  id: number,
  action: "declare" | "lend_lease" | "law" | "faction",
  target?: number,
): boolean {
  return false;
}
