// World War 1936 P2: supply v1 formulas (P2 spec §11.1–§11.3). The engine's
// daily supply and the region card call the same functions.
import {
  LandTerrain,
  Weather,
  WW_SUPPLY_RANGE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { TERRAIN } from "./CombatRules";
import { WEATHER } from "./Weather";

export const HUB_CAPITAL = 0;
export const HUB_CITY = 1;
export const HUB_BUILT = 2;
export const HUB_SEA = 3;
/** Victory points that make a city a hub (spec §11.1). */
export const HUB_CITY_VP = 10;

/**
 * Spec §11.1 sea hub, supply milli a day. Task 11 (내 판단): 20, a rail-less
 * city hub's (was 12): with the colony ports (controller ruling 2) a
 * colony's or an island's only port feeds its whole garrison, and 12 left
 * Italy's East African army at a fifth of its supply. P4 replaces it with
 * convoys and blockades.
 */
export const SEA_HUB_MILLI = 20_000;

/** Spec §11.1, supply milli a day. */
export function hubCapacityMilli(kind: number, rail: number): number {
  if (kind === HUB_CAPITAL) return (50 + 5 * rail) * 1000;
  if (kind === HUB_SEA) return SEA_HUB_MILLI;
  return (20 + 4 * rail) * 1000;
}

/**
 * Spec §11.2 road edges: km × terrain% / (ROAD_SUPPLY_BASE + 10 × the
 * arriving region's infrastructure). Task 11 (내 판단): 100 (was 50), the
 * road reach doubled: colonial and desert regions are 400–600 km apart,
 * and with 50 a hub fed no neighbour at all without rail (Eritrea's port
 * gave nothing to Tigray, 181 km of mountains); rail edges unchanged.
 */
export const ROAD_SUPPLY_BASE = 100;

/** Spec §11.2: supply-km of an edge, ×100. Rail when both ends have rail. */
export function supplyEdgeCost(
  km: number,
  railFrom: number,
  railTo: number,
  toLand: LandTerrain,
  toInfra: number,
): number {
  if (railFrom >= 1 && railTo >= 1) {
    return Math.floor((km * 100) / (2 + Math.min(railFrom, railTo)));
  }
  return Math.floor(
    (km * TERRAIN[toLand].supplyPct * 100) / (ROAD_SUPPLY_BASE + 10 * toInfra),
  );
}

/** Spec §11.2: what a hub of `capacityMilli` gives at `costCenti` supply-km ×100. */
export function supplyFrom(capacityMilli: number, costCenti: number): number {
  const range = WW_SUPPLY_RANGE * 100;
  return Math.floor((capacityMilli * Math.max(0, range - costCenti)) / range);
}

/** Spec §11.2: the region's own share. */
export function localSupplyMilli(core: boolean, infra: number): number {
  return (core ? 2 * infra : infra) * 1000;
}

/** Best hub share + local share, × the weather's supply %. */
export function regionSupplyMilli(
  bestHub: number,
  local: number,
  weather: Weather,
): number {
  return Math.floor(((bestHub + local) * WEATHER[weather].supplyPct) / 100);
}

/** Spec §11.3: a division's use after the general, companies, traits and P3's supplyUsePct. */
export function supplyUseMilli(
  baseMilli: number,
  generalLog: number,
  logisticsCompany: boolean,
  logisticsWizard: boolean,
  techPct: number,
): number {
  const cut =
    generalLog * 5 +
    (logisticsCompany ? 20 : 0) +
    (logisticsWizard ? 15 : 0) -
    techPct;
  return Math.floor((baseMilli * Math.max(10, 100 - cut)) / 100);
}

export function supplyRatePm(supplyMilli: number, useMilli: number): number {
  return useMilli <= 0
    ? 1000
    : Math.min(1000, Math.floor((supplyMilli * 1000) / useMilli));
}
