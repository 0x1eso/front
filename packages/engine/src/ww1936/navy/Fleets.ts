// World War 1936 P4: fleet orders and housekeeping (P4 spec §7.2, §8.3).
// Stubs with the final signatures (plan Task 1 Step 18); lane N1 (Task 3)
// writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { FleetOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwNavy } from "./WwNavy";

/**
 * fleet_mission … fleet_auto (spec §7.2, §19.3). Stub: "no_fleet" unless
 * the fleet is the sender's, then null (no effect yet). A fleet_merge
 * needs both fleets the sender's.
 */
export function issueFleetOrder(
  navy: WwNavy,
  smallID: number,
  order: FleetOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const f = navy.fleets.get(order.fleet);
  if (f === undefined || f.owner !== smallID) return "no_fleet";
  if (order.kind === "fleet_merge") {
    const into = navy.fleets.get(order.into);
    if (into === undefined || into.owner !== smallID) return "no_fleet";
  }
  return null;
}

/** The pending fleet orders into moves, this tick (spec §2.2-6 ③). Stub: nothing. */
export function applyFleetOrders(navy: WwNavy, tick: number): void {
  void navy;
  void tick;
}

/**
 * The country's day (spec §2.2-6 ②): auto return, a lost home port, the
 * AI's new-ships fleets. Stub: nothing.
 */
export function dailyFleetHousekeeping(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  void navy;
  void smallID;
  void day;
}
