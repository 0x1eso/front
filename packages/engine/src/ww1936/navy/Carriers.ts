// World War 1936 P4: carriers, decks and port strikes (P4 spec §9.6,
// §13.4). Stubs with the final signatures (plan Task 1 Step 18); lane N2
// (Task 4) writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CarrierOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import { strikeBlock } from "@openfront/engine-lib/ww1936/NoStrike";
import type { WwNavy } from "./WwNavy";

/**
 * fleet_port_strike / carrier_mix. Stub: "no_fleet" unless the fleet is
 * the sender's; a port strike on a no-strike region (engine-lib NoStrike)
 * is refused; then null.
 */
export function issueCarrierOrder(
  navy: WwNavy,
  smallID: number,
  order: CarrierOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const f = navy.fleets.get(order.fleet);
  if (f === undefined || f.owner !== smallID) return "no_fleet";
  if (order.kind === "fleet_port_strike") {
    return strikeBlock(navy.scenario, order.port);
  }
  return null;
}

/** Spec §9.6: docked carriers' decks from the stock (lane A1 calls it in dailyAirCountry). Stub: nothing. */
export function fillDecks(navy: WwNavy, smallID: number): void {
  void navy;
  void smallID;
}

/** Spec §13.4: the fleet's carriers strike `port` once (dailySeaRegion calls it). Stub: nothing. */
export function carrierPortStrike(
  navy: WwNavy,
  fleet: number,
  port: number,
  tick: number,
): void {
  void navy;
  void fleet;
  void port;
  void tick;
}
