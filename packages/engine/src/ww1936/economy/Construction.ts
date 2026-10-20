// World War 1936 P1: the construction queue (spec §4). The judgements are
// final (engine-lib EconomyChecks, shared with the screens); the order and
// daily-step bodies are STUBS that Task 3 fills, with final signatures.
import {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  buildBlockOf,
  queuedInRegion,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Factories built plus reserved by the controller's queue (spec §4.2). */
export function usedSlots(econ: WwEconomy, region: number): number {
  const built = econ.civ[region] + econ.mil[region] + econ.dock[region];
  const ce = econ.country(econ.controllerOf(region));
  return ce === null
    ? built
    : built + queuedInRegion(ce.queue, region).factories;
}

/** Why `ce` may not queue this project now; null if it may. */
export function buildBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
  building: BuildingId,
  count: number,
): WwOrderBlock | null {
  const exists = econ.scenario.region(region) !== undefined;
  return buildBlockOf({
    building,
    count,
    controlled: exists && econ.controllerOf(region) === ce.smallID,
    occupied: exists && econ.isOccupied(region),
    queueLength: ce.queue.length,
    infraWithQueue: exists
      ? econ.infra[region] + queuedInRegion(ce.queue, region).infra
      : 0,
    usedSlots: exists ? usedSlots(econ, region) : 0,
    slots: econ.regionSlots(region, ce.tech.slotPct),
  });
}

export function queueBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
  building: BuildingId,
  count: number,
): WwOrderBlock | null {
  return null;
}

export function cancelBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  index: number,
): WwOrderBlock | null {
  return null;
}

export function moveBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  index: number,
  to: number,
): WwOrderBlock | null {
  return null;
}

/** One day of construction for `ce` (spec §4.3). */
export function stepConstruction(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {}
