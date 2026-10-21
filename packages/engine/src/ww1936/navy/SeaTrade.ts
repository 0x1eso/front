// World War 1936 P4: sea trade routes (P4 spec §10.2). Stub with the final
// signature (plan Task 1 Step 18); lane C (Task 5) writes the body and
// wires P1's partner rule 3 to it.
import type { SeaRoute, WwNavy } from "./WwNavy";

/** The convoy route of a trade from `seller` to `buyer`; null when none. Stub: none. */
export function tradeRoute(
  navy: WwNavy,
  buyer: number,
  seller: number,
): SeaRoute | null {
  void navy;
  void buyer;
  void seller;
  return null;
}
