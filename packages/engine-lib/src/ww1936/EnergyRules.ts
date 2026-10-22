// World War 1936 P6 (P6 spec §16.2): energy from coal, hydro, power plants
// and dams. Final (plan Task 1 Step 8); lane W1 runs it (Task 7).
import {
  COAL_PER_REFINERY,
  ENERGY_PER_COAL,
  ENERGY_PER_HYDRO,
  ENERGY_PER_PLANT,
} from "@openfront/engine-api/ww1936/DepthTypes";

export function energySupply(
  coal: number,
  hydro: number,
  plants: number,
  dams: number,
  extra: number,
): number {
  return (
    coal * ENERGY_PER_COAL +
    hydro * ENERGY_PER_HYDRO +
    plants * ENERGY_PER_PLANT +
    dams +
    extra
  );
}

export function energyRatioPm(demand: number, supply: number): number {
  return demand <= 0
    ? 1000
    : Math.min(1000, Math.floor((supply * 1000) / demand));
}

/** Spec §16.2: output and construction percent the next day (0 or −1..−50). */
export function energyPenaltyPct(ratioPm: number): number {
  return ratioPm >= 1000 ? 0 : -Math.min(50, Math.floor((1000 - ratioPm) / 20));
}

/** Spec §16.2: coal the energy wants (rounded up), after the refineries' 2 each. */
export function coalWanted(
  demand: number,
  hydro: number,
  plants: number,
  dams: number,
  extra: number,
  refineries: number,
): number {
  const gap = Math.max(0, demand - energySupply(0, hydro, plants, dams, extra));
  return refineries * COAL_PER_REFINERY + Math.ceil(gap / ENERGY_PER_COAL);
}
