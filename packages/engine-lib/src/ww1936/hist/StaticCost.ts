// ww91 (N1): what a major's static gear key costs to make. The catalogue's
// real price is taken half way: generic + (catalogue - generic) / 2, within
// 75 % to 130 % of the generic cost. Tanks, planes and ships are not here
// (a tank key keeps its table cost; designs price themselves).
import type { EquipmentType } from "@openfront/engine-api/ww1936/EconomyTypes";
import { unitCostMilli } from "../Equipment";
import { histStatsOf } from "./Convert";
import type { GearStats } from "./ConvertGear";
import { histStaticEntry } from "./Slots";
import type { HistCountry, HistEntry } from "./Types";

export const HALF_GAP_MIN_PCT = 75;
export const HALF_GAP_MAX_PCT = 130;
/** A truck's catalogue cost: the generic truck at the reference price (dollars). */
const TRUCK_REF_USD = 2000;

/** The catalogue's own cost of a gear entry standing in for `type`, milli (null: not a gear entry). */
export function catalogueGearCostMilli(
  e: HistEntry,
  type: EquipmentType,
  generic: number,
): number | null {
  if (e.family === "support" && e.spec.kind === "transport") {
    return Math.floor((generic * e.spec.costUsd) / TRUCK_REF_USD);
  }
  if (e.family !== "infantry" && e.family !== "support" && e.family !== "gun") {
    return null;
  }
  void type;
  return (histStatsOf(e) as GearStats).costMilli;
}

/** The halved-gap cost of a catalogue cost against the generic one. */
export function halfGapCostMilli(generic: number, catalogue: number): number {
  const half = generic + Math.trunc((catalogue - generic) / 2);
  return Math.max(
    Math.floor((generic * HALF_GAP_MIN_PCT) / 100),
    Math.min(Math.floor((generic * HALF_GAP_MAX_PCT) / 100), half),
  );
}

/** Milli industry points one unit of static key (type, gen) costs `country`, before MIO and licence; the generic cost for no country or no entry. */
export function staticGearCostMilli(
  country: HistCountry | null,
  type: EquipmentType,
  gen: number,
): number {
  const generic = unitCostMilli(type, gen);
  if (country === null) return generic;
  const e = histStaticEntry(country, type, gen);
  if (e === undefined) return generic;
  const cat = catalogueGearCostMilli(e, type, generic);
  return cat === null ? generic : halfGapCostMilli(generic, cat);
}
