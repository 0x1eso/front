// World War 1936 historical catalogue: how entries sit in the engine's
// design slots and static keys.
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_GENS,
  WW_TECH_IDS,
  type EquipmentType,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { EQUIPMENT, genTech, unitCostMilli } from "../Equipment";
import { WW_TECHS } from "../WwTechs";
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

/**
 * Whether a country's catalogue has any vehicle of a need group (a minor has no
 * catalogue): research can open one, else only the market or a licence can.
 */
export function histHasTankGroup(tag: string, group: number): boolean {
  if (!(tag in HIST_CATALOGUE)) return false;
  return HIST_CATALOGUE[tag as HistCountry].some(
    (e) => e.family === "tank" && tankGroupOf(e.role) === group,
  );
}

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
 * The entries a tech helps to unlock, of one country or all, in catalogue
 * order: what a tech's effect text lists now that the designer's modules and
 * chassis are gates. Gear counts only where it really stands in (histGatesOf).
 */
export function histEntriesGatedBy(
  tech: string,
  country?: HistCountry,
): HistEntry[] {
  const out: HistEntry[] = [];
  for (const c of Object.keys(HIST_CATALOGUE) as HistCountry[]) {
    if (country !== undefined && c !== country) continue;
    for (const e of HIST_CATALOGUE[c]) {
      if ((histGatesOf(e) as readonly string[]).includes(tech)) out.push(e);
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

let gearGates: ReadonlyMap<HistEntry, readonly WwTechId[]> | undefined;

/** Every gear entry standing in for a static key, and the techs of those keys. */
function gearGatesMap(): ReadonlyMap<HistEntry, readonly WwTechId[]> {
  if (gearGates !== undefined) return gearGates;
  const out = new Map<HistEntry, WwTechId[]>();
  for (const c of Object.keys(HIST_CATALOGUE) as HistCountry[]) {
    for (const type of GEAR_TYPES) {
      for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
        const e = histStaticEntry(c, type, g);
        const tech = genTech(type, g);
        if (e === undefined || tech === null) continue;
        out.set(e, [...(out.get(e) ?? []), tech]);
      }
    }
  }
  gearGates = out;
  return out;
}

/**
 * The techs that really open an entry. A tank, plane or ship: its `techs`. A
 * gear entry is only a stand-in for a static key, so its gate is that key's
 * tech, and an entry standing in for nothing has none: no tech ever gives it.
 */
export function histGatesOf(e: HistEntry): readonly WwTechId[] {
  return histKindOf(e) !== null ? e.techs : (gearGatesMap().get(e) ?? []);
}

/** Whether the country really gets this entry from some tech. */
function histInUse(e: HistEntry): boolean {
  return histKindOf(e) !== null || gearGatesMap().has(e);
}

/** A country's entries that can be fielded, in catalogue order. */
export function histUsable(country: HistCountry): readonly HistEntry[] {
  return HIST_CATALOGUE[country].filter(histInUse);
}

/** What a generation tech is to a country (ww82 §9). */
export type TechRelevance = "own" | "pass" | "generic";

/** Gear generations: every country's battalions use them, entry or not. */
const GEAR_GEN = /^(inf_eq|support_eq|artillery|anti_tank|anti_air|motorized)_/;

/** The tank, plane and ship generation techs a major may have no entry for, tank guns too. */
export function isGenerationTech(id: WwTechId): boolean {
  if (id.startsWith("tank_gun_") || id === "transport_plane_2") return true;
  return WW_TECHS[id].role === "gen" && !GEAR_GEN.test(id);
}

const RELEVANCE = new Map<HistCountry, ReadonlyMap<WwTechId, TechRelevance>>();

/** Each generation tech that is not `own` for `country`. */
function relevanceOf(
  country: HistCountry,
): ReadonlyMap<WwTechId, TechRelevance> {
  const m = RELEVANCE.get(country);
  if (m !== undefined) return m;
  const own = new Set<WwTechId>();
  for (const e of histUsable(country))
    histGatesOf(e).forEach((t) => own.add(t));
  // What leads to an entry: the prerequisites of a gate, all the way back.
  const leads = new Set<WwTechId>();
  const walk = (t: WwTechId) => {
    for (const p of WW_TECHS[t].prereqs) {
      if (leads.has(p)) continue;
      leads.add(p);
      walk(p);
    }
  };
  own.forEach(walk);
  const out = new Map<WwTechId, TechRelevance>();
  for (const t of WW_TECH_IDS) {
    if (WW_TECHS[t].retired === true || !isGenerationTech(t) || own.has(t)) {
      continue;
    }
    out.set(t, leads.has(t) ? "pass" : "generic");
  }
  RELEVANCE.set(country, out);
  return out;
}

/**
 * The entries of `country` that need `tech` on the way, its own gates aside:
 * what a pass-through tech's card names.
 */
export function histEntriesBehind(
  tech: WwTechId,
  country: HistCountry,
): HistEntry[] {
  const leadsThere = (t: WwTechId): boolean =>
    WW_TECHS[t].prereqs.some((p) => p === tech || leadsThere(p));
  return histUsable(country).filter((e) => histGatesOf(e).some(leadsThere));
}

/**
 * ww82 §9: `own` when the tech gives `country` a named entry, `pass` when it
 * gives none but leads to one, `generic` when it gives only the generic
 * equipment. Only generation and tank gun techs can be other than `own`: every
 * other tech's effect is real for everyone. A minor has no catalogue, so all
 * of its techs are `own`.
 */
export function techRelevance(tech: WwTechId, country: string): TechRelevance {
  if (!(country in HIST_CATALOGUE)) return "own";
  return relevanceOf(country as HistCountry).get(tech) ?? "own";
}

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
