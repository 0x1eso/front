// World War 1936 P4 — the starting navies (spec §6.1–§6.4) and the starting
// air split (spec §12.4). The types and resolveRegionName are plan Task 1
// Step 15's (the foundation); lane G (Task 13) fills the tables.
//
// How the rows read (the foundation's NavyStartRun deals them):
// - A country's `ships` are dealt to its `fleets` class by class in table
//   order: the first fleet takes the first `counts[c]` ships of class c, the
//   next fleet the next ones (the generation follows the ship's row).
// - `counts` is BB/BC/CV/CA/CL/DD/SS.
// - Region names are the world1936 scenario's `name` (resolveRegionName).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

export interface StartFleetDef {
  key: string /* ww1936.fleet.<key> */;
  base: string /* port region name */;
  counts: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ] /* BB BC CV CA CL DD SS */;
}
export interface StartShipDef {
  cls: ShipClass;
  gen: number;
  name?: string /* ww1936.ship.<name> */;
}
export interface StartLineDef {
  cls: ShipClass;
  gen: number;
  count: number;
  progressPct: number;
  docks: number;
  names: string[];
  /** Launch port region name (lane G addition; the foundation falls back to the best naval base). */
  port?: string;
}
export interface StartNavyDef {
  tag: CountryTag;
  ships: StartShipDef[];
  fleets: StartFleetDef[];
  lines: StartLineDef[];
  convoys: number;
  /** Data only (pre-flight T13): the start levels come from scenario v4. */
  bases: string[];
}

/** Task 13 (spec §6). Used only when the scenario has `historicalOob` (plan decision 31). */
export const START_NAVY: readonly StartNavyDef[] = [];

/**
 * Spec §12.4 split of the starting fighters / bombers, AIR_TYPES order
 * (fighter, bomber, heavy_fighter, cas, naval_bomber, strat_bomber,
 * transport_plane, cv_fighter, cv_cas, cv_naval_bomber). Task 13.
 */
export const START_PLANES: Readonly<
  Partial<Record<CountryTag, readonly number[]>>
> = {};

/** The START_NAVY row of a country, or undefined. */
export function startNavyOf(tag: CountryTag): StartNavyDef | undefined {
  return START_NAVY.find((d) => d.tag === tag);
}

/**
 * The land region with scenario.json name `name` (the smallest id when two
 * share it); throws when there is none, so a data row naming a region the
 * map lost fails at the start (the data tests check the real map).
 */
export function resolveRegionName(sc: ScenarioIndex, name: string): number {
  for (const r of sc.landRegions) if (r.name === name) return r.id;
  throw new Error(`World War 1936: no region named "${name}"`);
}
