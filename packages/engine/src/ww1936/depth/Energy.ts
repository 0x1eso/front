// P6 lane W1 fills this file (plan Task 7): coal, energy and power plants (spec §16.2).
// The foundation's stub: final signatures, neutral answers.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

/** The country's energy ratio for tomorrow (mech.energyPm). Stub: stays 1000. */
export function dailyEnergy(d: WwDepth, id: number, day: number): void {}

/** Coal the energy and the refineries want today (taken before the lines). */
export function coalDemand(d: WwDepth, id: number): number {
  return 0;
}

/** The energy effect (spec §18.3). */
export function applyEnergyEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "energy" }>,
  actor: number,
): void {}

/**
 * Review E6: the country's energy demand today (spec §16.2), the energy
 * screen's number. Lane W1 fills it with dailyEnergy's formula.
 */
export function energyDemand(d: WwDepth, id: number): number {
  return 0;
}
