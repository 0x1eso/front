// World War 1936 historical catalogue: how entries sit in the engine's
// design slots and static keys.
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_GENS,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { EQUIPMENT, unitCostMilli } from "../Equipment";
import { tankGroupOf } from "./ConvertTank";
import { HIST_CATALOGUE } from "./index";
import type { HistCountry, HistEntry, TankEntry } from "./Types";

/** The design kind an entry occupies a slot of (gear entries: none, they are static keys). */
export function histKindOf(e: HistEntry): DesignKind | null {
  return e.family === "tank"
    ? "tank"
    : e.family === "plane"
      ? "plane"
      : e.family === "ship"
        ? "ship"
        : null;
}

const OWN: Record<string, readonly HistEntry[]> = {};
/** A country's entries of a design kind in file order: entry i sits in slot i + 1. */
export function histOwn(
  country: HistCountry,
  kind: DesignKind,
): readonly HistEntry[] {
  const k = `${country}:${kind}`;
  let v = OWN[k];
  if (v === undefined) {
    v = HIST_CATALOGUE[country].filter((e) => histKindOf(e) === kind);
    OWN[k] = v;
  }
  return v;
}

/** The slot (1-based) of an own entry, 0 when the entry is not this country's. */
export function histSlotOf(country: HistCountry, id: string): number {
  for (const kind of ["tank", "plane", "ship"] as const) {
    const i = histOwn(country, kind).findIndex((e) => e.id === id);
    if (i >= 0) return i + 1;
  }
  return 0;
}

const STATIC_GROUP: Readonly<Record<string, readonly string[]>> = {
  light_tank: ["light"],
  medium_tank: ["medium"],
};

/** The entry standing in for a static key ("light_tank", gen 1) in a country, if any. */
export function histStaticEntry(
  country: HistCountry,
  type: string,
  gen: number,
): HistEntry | undefined {
  const name = `${type}:${gen}`;
  const list = HIST_CATALOGUE[country];
  const flagged = list.find((e) => e.staticFor === name);
  if (flagged !== undefined) return flagged;
  const tech = (EQUIPMENT as Record<string, { techs: readonly string[] }>)[type]
    ?.techs[gen - 1];
  if (tech === undefined) return undefined;
  const roles = STATIC_GROUP[type];
  return list.find(
    (e) =>
      e.staticFor === undefined &&
      e.techs[0] === tech &&
      (roles === undefined
        ? gearMatches(e, type)
        : e.family === "tank" && roles.includes((e as TankEntry).role)),
  );
}
function gearMatches(e: HistEntry, type: string): boolean {
  if (type === "infantry_equipment") return e.family === "infantry";
  if (type === "support_equipment") return e.family === "support";
  if (type === "artillery" || type === "anti_tank" || type === "anti_air") {
    return e.family === "gun" && e.role === type;
  }
  return false;
}
export { tankGroupOf };

/** The text key of the entry standing in for a static key in a country, null for the generic name. */
export function histStaticName(
  country: HistCountry,
  type: string,
  gen: number,
): string | null {
  const e = histStaticEntry(country, type, gen);
  return e === undefined ? null : `ww1936.hist.${e.id}`;
}

/**
 * The entries a tech helps to unlock (it is one of their techs), of one
 * country or all, in catalogue order: what a tech's effect text lists now
 * that the designer's modules and chassis are gates.
 */
export function histEntriesGatedBy(
  tech: string,
  country?: HistCountry,
): HistEntry[] {
  const out: HistEntry[] = [];
  for (const c of Object.keys(HIST_CATALOGUE) as HistCountry[]) {
    if (country !== undefined && c !== country) continue;
    for (const e of HIST_CATALOGUE[c]) {
      if ((e.techs as readonly string[]).includes(tech)) out.push(e);
    }
  }
  return out;
}

const GEAR_TYPES: readonly EquipmentType[] = [
  "infantry_equipment",
  "support_equipment",
  "artillery",
  "anti_tank",
  "anti_air",
];

/**
 * B8: the milli industry points production really charges for a gear
 * entry: the generic cost of the static key it stands in for (production
 * charges the key's table, not the entry's own figure). Null for an entry
 * no static key maps to.
 */
export function histGearChargeMilli(e: HistEntry): number | null {
  if (e.family !== "infantry" && e.family !== "support" && e.family !== "gun") {
    return null;
  }
  for (const type of GEAR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      if (histStaticEntry(e.country, type, g) === e) {
        return unitCostMilli(type, g);
      }
    }
  }
  return null;
}
