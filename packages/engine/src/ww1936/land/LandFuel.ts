// World War 1936 P4: the land war's fuel ledger (P4 spec §15.3, plan
// decision 37): every tick, the fuel battalions (motorized, motorized
// artillery, tanks) of each division that walks, retreats, advances or
// stands in a battle (front line or reserve) burn their HOI4 hour × 1.829
// into the owner's ledger. Rail and sea moves burn nothing.
import {
  MOVE_ADVANCE,
  MOVE_RETREAT,
  MOVE_WALK,
  TPL_LOGISTICS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { LOGISTICS_FUEL_PCT } from "@openfront/engine-lib/ww1936/CombatRules";
import { landFuelTickMilli } from "@openfront/engine-lib/ww1936/FuelRules";
import { noteFuelUse } from "../economy/Fuel";
import type { WwLand } from "./WwLand";

/** The division's fuel an hour, read off the template; ww107: its logistics company saves as far as its gear goes. */
function hourOf(land: WwLand, r: number): number {
  const s = land.templateNumbersOf(r);
  if ((s.flags & TPL_LOGISTICS) === 0) return s.fuelHourMilli;
  const saved =
    Math.floor((s.fuelHourMilli * 100) / LOGISTICS_FUEL_PCT) - s.fuelHourMilli;
  const pm = land.companyPm(r, TPL_LOGISTICS);
  return s.fuelHourMilli + Math.floor((saved * (1000 - pm)) / 1000);
}

/** After the land war's movement and battles each tick (not in the preparation minute). */
export function noteLandFuel(land: WwLand, tick: number): void {
  if (land.ww.inPrep(tick)) return;
  const t = land.divisions;
  const byOwner = new Float64Array(land.scenario.countries.length + 1);
  let any = false;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0) continue;
    const m = t.mode[r];
    if (
      t.battle[r] === 0 &&
      m !== MOVE_WALK &&
      m !== MOVE_RETREAT &&
      m !== MOVE_ADVANCE
    ) {
      continue;
    }
    // The fuel battalions read the template only (gen 1 numbers suffice).
    const hour = hourOf(land, r);
    if (hour <= 0) continue;
    const owner = t.owner[r];
    if (owner >= byOwner.length) continue;
    byOwner[owner] += landFuelTickMilli(hour);
    any = true;
  }
  if (!any) return;
  for (let id = 1; id < byOwner.length; id++) {
    if (byOwner[id] <= 0) continue;
    const ce = land.econ.country(id);
    if (ce !== null) noteFuelUse(ce, byOwner[id], 0);
  }
}
