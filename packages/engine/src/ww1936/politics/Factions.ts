// World War 1936 P3: factions as state (spec §15). STUB: lane D (Task 5)
// writes the bodies; the signatures are final. Any change ends with
// pol.factionsChanged().
import type { PolOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwPolitics } from "./WwPolitics";

export function factionOrder(
  pol: WwPolitics,
  id: number,
  o: PolOrder,
  tick: number,
): WwOrderBlock | null {
  return "faction_rule";
}

export function dailyFactions(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {}

export function joinFaction(
  pol: WwPolitics,
  id: number,
  idx: number,
  tick: number,
): void {}

export function leaveFaction(pol: WwPolitics, id: number, tick: number): void {}

/** The new faction's index, -1 when none was made. */
export function createFaction(
  pol: WwPolitics,
  id: number,
  name: string | undefined,
  day: number,
): number {
  return -1;
}
