// World War 1936 P1: the construction queue (spec §4). The judgements live
// in engine-lib EconomyChecks (shared with the screens); this file runs the
// orders and the daily step.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  FACILITY_IDS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_COST,
  BuildingId,
  LEVEL_MAX,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  buildBlockOf,
  queuedInRegion,
  queuedLevels,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  assignCivs,
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  DEPTH_BUILDINGS,
  depthBuildBlock,
} from "@openfront/engine-lib/ww1936/WorldRules";
import type { Player } from "../../game/Game";
import { regionStatus } from "../depth/World";
import type { WwDepth } from "../depth/WwDepth";
import { navalBuildBlock } from "../navy/EndgameHooks";
import { dmzRegions } from "../politics/Spirits";
import type { CountryEconomy, Project, WwEconomy } from "./WwEconomy";

/**
 * The slot buildings of a region (spec §4.2; P4: the synthetic refineries
 * and fuel silos share the slots; a bombed-out one still holds its slot).
 */
export function slotBuildings(econ: WwEconomy, region: number): number {
  return (
    econ.civ[region] +
    econ.mil[region] +
    econ.dock[region] +
    econ.buildingArray("synthetic_refinery")[region] +
    econ.buildingArray("fuel_silo")[region] +
    // P6 (spec §9.1, §16.2): facilities and power plants share the slots.
    econ.buildingArray("facility_nuclear")[region] +
    econ.buildingArray("facility_rocket")[region] +
    econ.buildingArray("facility_science")[region] +
    econ.buildingArray("power_plant")[region]
  );
}

/** P6 hook (plan Task 1 Step 12): the P6 buildings' rules (WorldRules.depthBuildBlock). */
function depthBlockOf(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
  building: BuildingId,
  count: number,
): WwOrderBlock | null | undefined {
  if (!DEPTH_BUILDINGS.includes(building)) return undefined;
  const depth = econ.ww.depth as WwDepth | undefined;
  if (depth === undefined || econ.scenario.region(region) === undefined) {
    return "not_buildable";
  }
  const q = queuedInRegion(ce.queue, region);
  const dam = econ.scenario.damOf(region);
  const built = FACILITY_IDS.findIndex(
    (f) => econ.buildingArray(f)[region] > 0,
  );
  return depthBuildBlock({
    building,
    count,
    core:
      econ.ww.politics.isCore(region) &&
      econ.ww.politics.legalOwner[region] === ce.smallID,
    facility: built >= 0 ? built + 1 : q.facility,
    researched: ce.researched,
    infra: econ.infra[region],
    nukesOn: depth.nukesOn(),
    flyingBombDone: depth.projectDone(
      ce.smallID,
      SPECIAL_PROJECTS.indexOf("sp_flying_bomb"),
    ),
    levelWithQueue:
      building === "power_plant"
        ? econ.buildingArray("power_plant")[region] + q.power_plant
        : econ.buildingArray(building)[region] + queuedLevels(q, building),
    dam,
    damLevel: dam < 0 ? 0 : (depth.world.damLevel[dam] ?? 0),
    damQueued: q.dam > 0,
  });
}

/** Factories built plus reserved by the controller's queue (spec §4.2). */
export function usedSlots(econ: WwEconomy, region: number): number {
  const built = slotBuildings(econ, region);
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
  // P3 spec §9.2 {dmz}: no fort in a demilitarised region of one's own.
  if (
    building === "fort" &&
    (dmzRegions(econ.ww.politics, ce.smallID).includes(region) ||
      // P5 (spec §6.4): a peace treaty's demilitarised region.
      econ.ww.endgame.isDmz(region, ce.smallID))
  ) {
    return "not_controlled";
  }
  // P5 (pre-flight §0-10): a defeated country's naval restrictions.
  if (building === "dock" || building === "naval_base") {
    const naval = navalBuildBlock(econ, ce, building);
    if (naval !== null) return naval;
  }
  return buildBlockOf({
    building,
    count,
    controlled: exists && econ.controllerOf(region) === ce.smallID,
    occupied: exists && econ.isOccupied(region),
    queueLength: ce.queue.length,
    // Level buildings: the level now and what the queue adds (P2 decision 10).
    levelWithQueue:
      exists && LEVEL_MAX[building] !== undefined
        ? econ.buildingArray(building)[region] +
          queuedLevels(queuedInRegion(ce.queue, region), building)
        : 0,
    usedSlots: exists ? usedSlots(econ, region) : 0,
    slots: econ.regionSlots(region, ce.stats.slotPct),
    // P4 (spec §5.1, §12.1): a dockyard on a coast, a naval base or a
    // coastal fort on a harbor zone, the techs.
    coastal: econ.scenario.region(region)?.coastal ?? false,
    harbor: econ.scenario.harborOf(region) !== 0,
    researched: ce.researched,
    // P6 hook: the P6 buildings' own rules.
    depthBlock: depthBlockOf(econ, ce, region, building, count),
  });
}

/**
 * P3 spec §3.4: the building's own construction stat (fort and rail are
 * P2's tech keys, which projectSpeedPct reads already).
 */
export function buildingSpeedPct(ce: CountryEconomy, b: BuildingId): number {
  switch (b) {
    case "civ":
      return ce.stats.civConstructionPct;
    case "mil":
      return ce.stats.milConstructionPct;
    case "infra":
      return ce.stats.infraConstructionPct;
    default:
      return 0;
  }
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
  // Level buildings go up in occupied regions too (P2 spec §11.7).
  const max = LEVEL_MAX[q.building];
  if (max !== undefined) return econ.buildingArray(q.building)[q.region] < max;
  if (econ.isOccupied(q.region)) return false;
  const built = slotBuildings(econ, q.region);
  return built + 1 <= econ.regionSlots(q.region, ce.stats.slotPct);
}

const FACILITY_SET: ReadonlySet<BuildingId> = new Set(FACILITY_IDS);

/** P6 hook (W1): energy shortage (yesterday's) and the region's status (a nuke: −50%). */
function depthBuildPct(
  econ: WwEconomy,
  ce: CountryEconomy,
  region: number,
): number {
  const depth = econ.ww.depth as WwDepth | undefined;
  if (depth === undefined) return 0;
  return (
    depth.energyOutputPct(ce.smallID) + regionStatus(depth, region).buildPct
  );
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
      // P4 (spec §14.8): bombed infrastructure builds as the lower level.
      infra: econ.infraEff[q.region],
      tech: ce.stats,
      law,
      buildingPct:
        buildingSpeedPct(ce, q.building) + depthBuildPct(econ, ce, q.region),
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
      // P6 hook (W1): a dam's repair is the depth state's level, not a P1 count.
      if (q.building === "dam") econ.ww.depth.onDamRepaired(q.region);
      else econ.addBuilding(q.region, q.building, 1);
      if (FACILITY_SET.has(q.building)) econ.ww.depth.onFacilityBuilt(q.region);
      q.count--;
      q.progress -= cost;
      built++;
    }
  });
  ce.queue = ce.queue.filter((q) => q.count > 0);
  if (built > 0 && econ.ww.isHumanControlled(p.smallID())) {
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
