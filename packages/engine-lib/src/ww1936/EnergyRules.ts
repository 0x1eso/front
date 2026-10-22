// World War 1936 P6 (P6 spec §16.2): energy from coal, hydro, power plants
// and dams. Final (plan Task 1 Step 8); lane W1 runs it (Task 7).
//
// Controller ruling (W1 fix round 1, a spec gap): supply also has a
// domestic base — the wood, peat and small local plants the game does not
// draw — for every controlled region with infrastructure, capped at the
// demand; and the shortage curve is softer, (1000 − r) / 25, at most −40%.
// Without it every minor with no coal or hydro started at −50%. The base
// per region is tuned on the real map's day 0 (lane W1 report).
import {
  COAL_PER_REFINERY,
  ENERGY_PER_COAL,
  ENERGY_PER_HYDRO,
  ENERGY_PER_PLANT,
} from "@openfront/engine-api/ww1936/DepthTypes";

/**
 * The domestic base energy of a controlled region with infrastructure ≥ 1.
 * The ruling's 3 met the day-0 targets but left every major 80+ factories
 * of room (Italy never short); 1 keeps day 0 full everywhere and makes
 * Italy, then Japan, the first to run short as they build (lane W1 report).
 */
export const ENERGY_BASE_PER_REGION = 1;
/** The shortage curve: −1% output and construction per this many ‰ short. */
export const ENERGY_PENALTY_STEP_PM = 25;
export const ENERGY_PENALTY_MAX_PCT = 40;

/** The domestic base of `regions` controlled regions with infrastructure, capped at `demand`. */
export function energyBase(demand: number, regions: number): number {
  return Math.max(0, Math.min(demand, ENERGY_BASE_PER_REGION * regions));
}

export function energySupply(
  coal: number,
  hydro: number,
  plants: number,
  dams: number,
  extra: number,
  base = 0,
): number {
  return (
    coal * ENERGY_PER_COAL +
    hydro * ENERGY_PER_HYDRO +
    plants * ENERGY_PER_PLANT +
    dams +
    extra +
    base
  );
}

export function energyRatioPm(demand: number, supply: number): number {
  return demand <= 0
    ? 1000
    : Math.min(1000, Math.floor((supply * 1000) / demand));
}

/** Spec §16.2 (as ruled): output and construction percent the next day (0 or −1..−40). */
export function energyPenaltyPct(ratioPm: number): number {
  if (ratioPm >= 1000) return 0;
  const cut = Math.min(
    ENERGY_PENALTY_MAX_PCT,
    Math.floor((1000 - ratioPm) / ENERGY_PENALTY_STEP_PM),
  );
  return cut === 0 ? 0 : -cut;
}

/** Spec §16.2: coal the energy wants (rounded up), after the refineries' 2 each. */
export function coalWanted(
  demand: number,
  hydro: number,
  plants: number,
  dams: number,
  extra: number,
  refineries: number,
  base = 0,
): number {
  const gap = Math.max(
    0,
    demand - energySupply(0, hydro, plants, dams, extra, base),
  );
  return refineries * COAL_PER_REFINERY + Math.ceil(gap / ENERGY_PER_COAL);
}
