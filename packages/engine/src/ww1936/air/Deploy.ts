// World War 1936 P4: air deployments, bases and refills (P4 spec §13).
// Stubs with the final signatures (plan Task 1 Step 18); lane A1 (Task 7)
// writes the bodies.
import type { AirOrder } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwAir } from "./WwAir";

/**
 * air_deploy / air_recall / air_auto (spec §13.2). Stub: "bad_zone" for a
 * number that is no strategic region, else null (no effect yet).
 */
export function issueAirOrder(
  air: WwAir,
  smallID: number,
  order: AirOrder,
  tick: number,
): WwOrderBlock | null {
  void smallID;
  void tick;
  return air.ww.scenario.sr(order.sr) === undefined ? "bad_zone" : null;
}

/** The country's air day: re-basing, refills, carrier decks (N2's fillDecks). Stub: nothing. */
export function dailyAirCountry(
  air: WwAir,
  smallID: number,
  day: number,
): void {
  void air;
  void smallID;
  void day;
}
