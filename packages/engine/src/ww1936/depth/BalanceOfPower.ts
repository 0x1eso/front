// P6 lane W3 fills this file (plan Task 9): the balance of power (spec §13.2).
// The foundation's stub: final signatures, neutral answers.
import { BOP_DEFS } from "@openfront/engine-lib/ww1936/MechRules";
import type { WwDepth } from "./WwDepth";

/** The country's balance, ‰ (−1000 left … +1000 right). Stub: the start value. */
export function bopValue(d: WwDepth, tag: string): number {
  return BOP_DEFS.find((b) => b.tag === tag)?.startPm ?? 0;
}
