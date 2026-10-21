// World War 1936 P4: fuel (P4 spec §15, plan decision 22): the ledger the
// land war, the navy and the air war write, the settlement on the country
// turn, the capacity, the synthetic refineries' oil and the navy's day of
// fuel at sea.
import {
  fuelCap,
  fuelGain,
  fuelRatioPm,
} from "@openfront/engine-lib/ww1936/FuelRules";
import type { WwNavy } from "../navy/WwNavy";
import { effectiveBuildings } from "./Buildings";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Spec §18.10: one shortage message in this many days. */
const SHORTAGE_MESSAGE_DAYS = 30;

/** Fuel used today, milli, by `kind` (0 land, 1 navy, 2 air): the ledger settleFuel reads. */
export function noteFuelUse(
  ce: CountryEconomy,
  milli: number,
  kind: 0 | 1 | 2,
): void {
  if (!(milli > 0)) return;
  const m = Math.floor(milli);
  ce.fuelLedgerMilli += m;
  ce.fuelLedgerKinds[kind] += m;
}

/** Spec §15.1: the oil the country may use, units (produced − exported + imported). */
function oilAvailable(ce: CountryEconomy): number {
  const t = ce.totals;
  return Math.max(0, t.produced[0] - t.exported[0] + t.imported[0]);
}

/** Spec §15.2: the fuel capacity, milli (oil available yesterday and the working silos). */
export function fuelCapOf(econ: WwEconomy, ce: CountryEconomy): number {
  let silos = 0;
  for (const r of econ.regionsOf(ce.smallID)) {
    silos += effectiveBuildings(econ, r, "fuel_silo");
  }
  return fuelCap(oilAvailable(ce), silos, ce.stats);
}

/**
 * Spec §15.5: a region's synthetic oil, units: each working refinery
 * makes 1 + synthetic_oil_2, at the region's controlPct (occupied 50%).
 * P1's resource sum (refreshTotals) adds it after the infrastructure
 * factor, so it trades like any oil.
 */
export function syntheticOilOf(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
  controlPct: number,
): number {
  const n = effectiveBuildings(econ, region, "synthetic_refinery");
  if (n === 0) return 0;
  const per = 1 + (ce.researched.has("synthetic_oil_2") ? 1 : 0);
  return Math.floor((n * per * controlPct) / 100);
}

/**
 * Spec §15.3: the country turn's settlement (after research): the day's
 * gain fills the stock up to the capacity (the rest is lost), the ledger's
 * need comes off it, and the share it covered is the ratio every
 * shortage effect reads until the next settlement (yesterday's). The
 * ledger empties; its split is what the drawer shows (fuelUseMilli).
 */
export function settleFuel(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): void {
  const gain = fuelGain(oilAvailable(ce), ce.stats);
  const cap = fuelCapOf(econ, ce);
  const stock = Math.min(cap, ce.fuelMilli + gain);
  const need = ce.fuelLedgerMilli;
  const ratio = fuelRatioPm(stock, need);
  ce.fuelMilli = Math.max(0, stock - need);
  ce.fuelRatioPm = ratio;
  ce.fuelGainMilli = gain;
  ce.fuelUseMilli = [...ce.fuelLedgerKinds];
  ce.fuelLedgerMilli = 0;
  ce.fuelLedgerKinds = [0, 0, 0];
  if (ratio < 1000 && day - ce.fuelShortDay >= SHORTAGE_MESSAGE_DAYS) {
    ce.fuelShortDay = day;
    econ.ww.navy.message(ce.smallID, "events_display.ww1936_fuel_shortage", {
      pct: Math.floor(ratio / 10),
    });
  }
}

/**
 * Spec §7.3, §15.3 (pre-flight A13): the navy's fuel of the day — every
 * ship of a fleet that spent a tick at sea since the country's last day
 * (Fleet.seaDay: yesterday or today; a strike force in port never is),
 * fuel a day (no generation factor) × (100 + fuelUsePct) / 100. WwNavy's
 * country day calls it.
 */
export function noteFleetFuel(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  const ce = navy.econ.country(smallID);
  if (ce === null) return;
  let perDay = 0;
  for (const f of navy.fleetsOf(smallID)) {
    if (f.seaDay < 0 || f.seaDay < day - 1) continue;
    for (const id of f.ships) {
      const r = navy.ships.rowOf(id);
      if (r >= 0) perDay += navy.shipStatsOf(r).fuelPerDayMilli;
    }
  }
  if (perDay === 0) return;
  const m = Math.floor((perDay * Math.max(0, 100 + ce.stats.fuelUsePct)) / 100);
  noteFuelUse(ce, m, 1);
}
