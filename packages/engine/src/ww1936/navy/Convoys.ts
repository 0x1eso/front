// World War 1936 P4: convoy allocation and routes (P4 spec §10.1). Stubs
// with the final signatures (plan Task 1 Step 18, pre-flight A9); lane C
// (Task 5) writes the bodies.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ConvoyUse } from "@openfront/engine-api/ww1936/NavyTypes";
import type { SeaRoute, WwNavy } from "./WwNavy";

/** The country's day: convoys to voyages, supply routes, trades (spec §10.1). Stub: nothing. */
export function allocateConvoys(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  void navy;
  void smallID;
  void day;
}

/** Plan decision 20: the stock less the convoys bound to voyages and allotted to routes. */
export function freeConvoysOf(navy: WwNavy, smallID: number): number {
  const ce = navy.econ.country(smallID);
  if (ce === null) return 0;
  let used = 0;
  for (const v of navy.voyages.values())
    if (v.owner === smallID) used += v.bound;
  for (const r of navy.routes.values()) if (r.owner === smallID) used += r.got;
  return Math.max(0, ce.stock[equipKey("convoy", 1)] - used);
}

/** The sea route of (use, owner, ref) — lane I's invasion routes read it. Stub: none. */
export function routeFor(
  navy: WwNavy,
  use: ConvoyUse,
  owner: number,
  ref: number,
): SeaRoute | null {
  void navy;
  void use;
  void owner;
  void ref;
  return null;
}
