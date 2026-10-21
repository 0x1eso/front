// World War 1936 P4: buildings after bomb damage (plan decision 13), and
// the stock bookkeeping the navy and the air war share (planes out on
// deployments and decks, convoys). The foundation writes the bodies.
import { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  BUILDING_IDS,
  BuildingId,
  EQUIPMENT_GENS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { effectiveCount } from "@openfront/engine-lib/ww1936/BuildingDamage";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

const B_COUNT = BUILDING_IDS.length;
const B_INDEX: ReadonlyMap<BuildingId, number> = new Map(
  BUILDING_IDS.map((b, i) => [b, i]),
);

/** BUILDING_IDS index of a building. */
export function buildingIndex(b: BuildingId): number {
  return B_INDEX.get(b)!;
}

/** Bomb damage of a region's building, milli (1,000 = one building stopped). */
export function damageOf(
  econ: WwEconomy,
  region: number,
  b: BuildingId,
): number {
  return econ.damage[region * B_COUNT + buildingIndex(b)] ?? 0;
}

/**
 * Plan decision 13: the buildings that work, count − floor(damage / 1000),
 * never below 0. Every economy, navy and air calculation reads this.
 */
export function effectiveBuildings(
  econ: WwEconomy,
  region: number,
  b: BuildingId,
): number {
  return effectiveCount(
    econ.buildingArray(b)[region] ?? 0,
    econ.damage[region * B_COUNT + buildingIndex(b)] ?? 0,
  );
}

/** A level building's working level (spec §14.8: as many levels lower as buildings are stopped). */
export function effectiveLevel(
  econ: WwEconomy,
  region: number,
  b: BuildingId,
): number {
  return effectiveBuildings(econ, region, b);
}

/**
 * Spec §14.8: adds bomb damage, at most the region's buildings × 1000;
 * returns the milli it added.
 */
export function damageBuilding(
  econ: WwEconomy,
  region: number,
  b: BuildingId,
  milli: number,
): number {
  if (milli <= 0) return 0;
  const i = region * B_COUNT + buildingIndex(b);
  const cap = (econ.buildingArray(b)[region] ?? 0) * 1000;
  const was = econ.damage[i] ?? 0;
  const now = Math.min(cap, was + milli);
  if (now === was) return 0;
  econ.damage[i] = now;
  econ.afterBuildingChange(region, b);
  return now - was;
}

/** Spec §14.8: repairs bomb damage (lane E's stepRepairs); returns the milli it took off. */
export function repairBuilding(
  econ: WwEconomy,
  region: number,
  b: BuildingId,
  milli: number,
): number {
  if (milli <= 0) return 0;
  const i = region * B_COUNT + buildingIndex(b);
  const was = econ.damage[i] ?? 0;
  const now = Math.max(0, was - milli);
  if (now === was) return 0;
  econ.damage[i] = now;
  econ.afterBuildingChange(region, b);
  return was - now;
}

/**
 * Takes up to `n` planes of `type` out of the stock, the newest generation
 * first, onto a deployment or a deck; returns the planes taken per
 * generation (index gen − 1).
 */
export function drawPlanes(
  ce: CountryEconomy,
  type: AirType,
  n: number,
): number[] {
  const gens = EQUIPMENT_GENS[type];
  const out = new Array<number>(gens).fill(0);
  let left = Math.max(0, Math.floor(n));
  for (let g = gens; g >= 1 && left > 0; g--) {
    const k = equipKey(type, g);
    const take = Math.min(left, ce.stock[k]);
    if (take <= 0) continue;
    ce.stock[k] -= take;
    ce.planesDeployed[k] += take;
    out[g - 1] = take;
    left -= take;
  }
  return out;
}

/** Puts planes back into the stock (a recall, a lost base, a docked carrier's surplus). */
export function returnPlanes(
  ce: CountryEconomy,
  type: AirType,
  counts: readonly number[],
): void {
  counts.forEach((c, i) => {
    if (c <= 0) return;
    const k = equipKey(type, i + 1);
    if (k < 0) return;
    const back = Math.min(c, ce.planesDeployed[k]);
    ce.planesDeployed[k] -= back;
    ce.stock[k] += back;
  });
}

/** Planes lost in combat: off the deployed ledger only (the stock never had them). */
export function losePlanes(
  ce: CountryEconomy,
  type: AirType,
  counts: readonly number[],
): void {
  counts.forEach((c, i) => {
    if (c <= 0) return;
    const k = equipKey(type, i + 1);
    if (k < 0) return;
    ce.planesDeployed[k] = Math.max(0, ce.planesDeployed[k] - c);
  });
}

const CONVOY = equipKey("convoy", 1);

/** Convoys sunk: off the stock, never below 0; returns how many went. */
export function loseConvoys(ce: CountryEconomy, n: number): number {
  const lost = Math.max(0, Math.min(Math.floor(n), ce.stock[CONVOY]));
  ce.stock[CONVOY] -= lost;
  return lost;
}

/** Convoys built or given (P3's `convoys` effect). */
export function addConvoys(ce: CountryEconomy, n: number): void {
  if (n > 0) ce.stock[CONVOY] += Math.floor(n);
}

/** The convoys in the stock (plan decision 20: the whole number). */
export function convoysOf(ce: CountryEconomy): number {
  return ce.stock[CONVOY];
}
