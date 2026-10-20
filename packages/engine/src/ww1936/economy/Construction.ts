// World War 1936 P1: the construction queue (spec §4). The judgements live
// in engine-lib EconomyChecks (shared with the screens); this file runs the
// orders and the daily step.
import { MessageType, PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  BUILDING_COST,
  BuildingId,
  MAX_INFRA,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  buildBlockOf,
  queuedInRegion,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  assignCivs,
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "../../game/Game";
import type { CountryEconomy, Project, WwEconomy } from "./WwEconomy";

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

/** Spec §4.3: a new entry at the back of the queue. */
export function queueBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
  building: BuildingId,
  count: number,
): WwOrderBlock | null {
  const block = buildBlock(econ, ce, region, building, count);
  if (block !== null) return block;
  ce.queue.push({
    region,
    building,
    count,
    progress: 0,
    lastAssigned: 0,
    lastSpeedPct: 0,
  });
  return null;
}

function validIndex(ce: CountryEconomy, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < ce.queue.length;
}

/** Drops an entry; its progress is lost (HOI4). */
export function cancelBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  index: number,
): WwOrderBlock | null {
  if (!validIndex(ce, index)) return "bad_index";
  ce.queue.splice(index, 1);
  return null;
}

/** Moves an entry to position `to` (the others shift). */
export function moveBuild(
  econ: WwEconomy,
  ce: CountryEconomy,
  index: number,
  to: number,
): WwOrderBlock | null {
  if (!validIndex(ce, index) || !validIndex(ce, to)) return "bad_index";
  const [q] = ce.queue.splice(index, 1);
  ce.queue.splice(to, 0, q);
  return null;
}

/**
 * Whether the next building of `q` may appear now. Its own slot was
 * reserved while it waited, so only the built factories count; a region
 * lost and retaken, or occupied meanwhile, drops the entry (spec §4.3).
 */
function canComplete(econ: WwEconomy, ce: CountryEconomy, q: Project): boolean {
  if (econ.controllerOf(q.region) !== ce.smallID) return false;
  if (q.building === "infra") return econ.infra[q.region] < MAX_INFRA;
  if (econ.isOccupied(q.region)) return false;
  const built = econ.civ[q.region] + econ.mil[q.region] + econ.dock[q.region];
  return built + 1 <= econ.regionSlots(q.region, ce.tech.slotPct);
}

/**
 * One day of construction for `ce` (spec §4.3): the free civilian factories
 * go front first, at most 15 to an entry; progress past a building's cost
 * rolls on to the entry's next one and is dropped when the entry ends.
 */
export function stepConstruction(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const law = ce.law();
  const assigned = assignCivs(ce.totals.freeCivMilli, ce.queue.length);
  let built = 0;
  ce.queue.forEach((q, i) => {
    const speed = projectSpeedPct({
      building: q.building,
      infra: econ.infra[q.region],
      tech: ce.tech,
      law,
    });
    q.lastAssigned = assigned[i];
    q.lastSpeedPct = speed;
    if (assigned[i] === 0) return;
    q.progress += constructionProgress(assigned[i], speed);
    const cost = BUILDING_COST[q.building] * 1000;
    while (q.count > 0 && q.progress >= cost) {
      if (!canComplete(econ, ce, q)) {
        q.count = 0;
        break;
      }
      econ.addBuilding(q.region, q.building, 1);
      q.count--;
      q.progress -= cost;
      built++;
    }
  });
  ce.queue = ce.queue.filter((q) => q.count > 0);
  if (built > 0 && p.type() === PlayerType.Human) {
    // Spec §13.6: the owner only, one message a day.
    econ.mg.displayMessage(
      "events_display.ww1936_built",
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      { count: built },
    );
  }
}
