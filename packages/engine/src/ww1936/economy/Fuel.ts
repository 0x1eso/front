// World War 1936 P4: fuel (P4 spec §15, plan decision 22). The ledger is
// the foundation's; lane E (Task 9) writes the settlement and the capacity.
import { fuelCap } from "@openfront/engine-lib/ww1936/FuelRules";
import type { WwNavy } from "../navy/WwNavy";
import { effectiveBuildings } from "./Buildings";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Fuel used today, milli, by `kind` (0 land, 1 navy, 2 air): the ledger settleFuel reads. */
export function noteFuelUse(
  ce: CountryEconomy,
  milli: number,
  kind: 0 | 1 | 2,
): void {
  void kind;
  if (milli > 0) ce.fuelLedgerMilli += milli;
}

/** Spec §15.2: the fuel capacity, milli (oil available yesterday and the working silos). */
export function fuelCapOf(econ: WwEconomy, ce: CountryEconomy): number {
  const t = ce.totals;
  const oil = Math.max(0, t.produced[0] - t.exported[0] + t.imported[0]);
  let silos = 0;
  for (const r of econ.regionsOf(ce.smallID)) {
    silos += effectiveBuildings(econ, r, "fuel_silo");
  }
  return fuelCap(oil, silos, ce.stats);
}

/**
 * Spec §15.3: the country turn's settlement (after research). Stub: the
 * ledger empties, the ratio stays 1000 and the stock does not move.
 */
export function settleFuel(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): void {
  void econ;
  void day;
  ce.fuelLedgerMilli = 0;
  ce.fuelRatioPm = 1000;
}

/**
 * Spec §15.3 (pre-flight A13): the navy's fuel of the day, the country's
 * fleets at sea (WwNavy's country day calls it). Stub: nothing.
 */
export function noteFleetFuel(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  void navy;
  void smallID;
  void day;
}
