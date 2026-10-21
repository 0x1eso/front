// World War 1936 P4: fuel (P4 spec §15): gain from oil, capacity, the
// ratio a shortage cuts by, and the land, naval and air factors.
import {
  WW_FUEL_BASE_CAP,
  WW_FUEL_CAP_PER_OIL,
  WW_FUEL_PER_OIL,
  WW_FUEL_SILO_CAP,
  WW_FUEL_START_DAYS,
  WW_FUEL_START_FLOOR_PM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  BattalionId,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** Spec §15.1, milli a day: oil × 24 × (100 + fuelPct) / 100 (Germany 1939, 15 oil → 360,000). */
export function fuelGain(oil: number, stats: WwStats): number {
  return Math.floor(
    (oil * WW_FUEL_PER_OIL * 1000 * (100 + stats.fuelPct)) / 100,
  );
}

/** Spec §15.2, milli: (20,000 + oil × 2,500 + silos × 10,000) × (100 + fuelCapPct) / 100. */
export function fuelCap(oil: number, silos: number, stats: WwStats): number {
  const base =
    WW_FUEL_BASE_CAP + oil * WW_FUEL_CAP_PER_OIL + silos * WW_FUEL_SILO_CAP;
  return Math.floor((base * 1000 * (100 + stats.fuelCapPct)) / 100);
}

/** Spec §15.3: the share of yesterday's need the stock covered, ‰. */
export function fuelRatioPm(stockMilli: number, needMilli: number): number {
  return needMilli <= stockMilli
    ? 1000
    : Math.floor((stockMilli * 1000) / needMilli);
}

/** Spec §15.3: milli per HOI4 hour of one battalion. */
export const LAND_FUEL_PER_HOUR_MILLI: Readonly<
  Partial<Record<BattalionId, number>>
> = {
  motorized: 125,
  mot_artillery: 125,
  light_armor: 250,
  medium_armor: 375,
};

/** A tick (1.829 HOI4 hours) of a division's fuel battalions, milli. */
export function landFuelTickMilli(perHourMilliSum: number): number {
  return Math.floor((perHourMilliSum * WW_ROUND_HOUR_MILLI) / 1000);
}

/** Spec §15.4 speed factors, ‰. */
export function landFuelSpeedPm(r: number): number {
  return 300 + Math.floor((700 * r) / 1000);
}
export function fleetFuelSpeedPm(r: number): number {
  return 500 + Math.floor((500 * r) / 1000);
}

/** Spec §15.4: a division's attack and defense, by its fuel battalions' width share ‰. */
export function fuelCombatBp(r: number, fuelWidthPm: number): number {
  const v = Math.min(5000, Math.floor(((1000 - r) * 5 * fuelWidthPm) / 1000));
  return v <= 0 ? 0 : -v;
}

/**
 * Spec §15.2: the 1936 stock, 90 days of gain within the capacity — and
 * at least half the capacity (Task 15: an importer's own oil is nil).
 */
export function startFuelMilli(gainMilli: number, capMilli: number): number {
  return Math.min(
    capMilli,
    Math.max(
      gainMilli * WW_FUEL_START_DAYS,
      Math.floor((capMilli * WW_FUEL_START_FLOOR_PM) / 1000),
    ),
  );
}
