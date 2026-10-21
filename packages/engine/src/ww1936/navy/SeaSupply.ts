// World War 1936 P4: overseas supply (P4 spec §10.3). Stub with the final
// signature (plan Task 1 Step 18); lane C (Task 5) writes the body.
import {
  HUB_SEA,
  hubCapacityMilli,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import type { WwNavy } from "./WwNavy";

/**
 * The sea-hub capacity of a working port for `side`, milli a day (P2's
 * daily supply asks it for every port of the side; a change re-runs that
 * hub). Stub: P2's HUB_SEA value.
 */
export function seaHubCapacityMilli(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  void navy;
  void region;
  void side;
  return hubCapacityMilli(HUB_SEA, 0);
}
