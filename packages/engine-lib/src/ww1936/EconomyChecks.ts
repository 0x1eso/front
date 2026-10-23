// World War 1936 P1: the economy's judgements over plain data (plan
// decision 3). The engine's order functions and the screens' buttons call
// the same ones; whatever needs engine objects (who is alive, embargoes)
// the caller works out first and hands in as a value.
import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { FACILITY_IDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDABLE,
  BUILDING_TECH,
  BuildingId,
  COASTAL_BUILDINGS,
  CountryLaws,
  DOCTRINE_DOMAIN,
  equipKey,
  EquipmentType,
  LAW_LADDERS,
  LawKind,
  LawValue,
  LEVEL_MAX,
  WW_MAX_LINES,
  WW_MAX_QUEUE,
  WW_MAX_TRADES,
  WW_TRADE_UNITS_PER_CIV,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { exportCapacity } from "./EconomyRules";
import {
  equipmentBuildable,
  genTech,
  isDesignType,
  PROJECT_TYPES,
} from "./Equipment";
import { planeGenTechs } from "./PlaneStats";
import { lawBlock, LawCtx } from "./PoliticsRules";
import type { ScenarioIndex } from "./ScenarioIndex";
import { openSchool, WW_TECHS } from "./WwTechs";

// ---- Regions and the country graph (spec §4.4, §7.4) ----

export interface RegionShares {
  /** Someone else holds it and its 1936 owner still fights (spec §4.4). */
  occupied: boolean;
  /** Share of its factories and resources the controller gets. */
  controlPct: number;
  /** Share of its people the controller may draft (spec §6.2). */
  manpowerPct: number;
}

/**
 * Spec §4.4: what a region gives its controller. `ownerFights`: its 1936
 * owner is alive and has not capitulated.
 */
export function regionShares(
  controller: number,
  owner: number,
  core: boolean,
  ownerFights: boolean,
): RegionShares {
  if (controller === owner) {
    return { occupied: false, controlPct: 100, manpowerPct: core ? 100 : 10 };
  }
  const occupied = controller !== 0 && ownerFights;
  return occupied
    ? { occupied, controlPct: 50, manpowerPct: 0 }
    : { occupied, controlPct: 100, manpowerPct: 10 };
}

export interface CountryGraph {
  /** By smallID: the land regions it controls, ascending. */
  regionsByCountry: number[][];
  /** By smallID: countries it shares a land border with, ascending. */
  neighbours: number[][];
}

/**
 * The country graph from region control (plan decision 14), for countries
 * 1..size-1. `controller` is indexed by region id (WwEconomy.controller,
 * WwEconomyView.controller).
 */
export function countryGraph(
  scenario: ScenarioIndex,
  controller: ArrayLike<number>,
  size: number,
): CountryGraph {
  const regionsByCountry = Array.from({ length: size }, (): number[] => []);
  for (const r of scenario.landRegions) {
    const c = controller[r.id];
    if (c <= 0 || c >= size) continue;
    regionsByCountry[c].push(r.id);
  }
  const nb = Array.from({ length: size }, () => new Set<number>());
  for (const [a, b] of scenario.regionPairs()) {
    const ca = controller[a];
    const cb = controller[b];
    if (ca === cb || ca <= 0 || cb <= 0 || ca >= size || cb >= size) continue;
    nb[ca].add(cb);
    nb[cb].add(ca);
  }
  const neighbours = nb.map((s) => [...s].sort((x, y) => x - y));
  return { regionsByCountry, neighbours };
}

// ---- Construction (spec §4.2, §4.3) ----

/** What a queue entry needs: the engine's Project and the screens' WwProjectData. */
export interface QueuedBuild {
  region: number;
  building: BuildingId;
  count: number;
}

/** What a queue still adds to `region`: factories, and each level building (P2 plan decision 10). */
export interface QueuedInRegion {
  factories: number;
  infra: number;
  fort: number;
  rail: number;
  supply_hub: number;
  // P4 level buildings (P4 spec §12.1).
  naval_base: number;
  air_base: number;
  anti_air: number;
  radar: number;
  coastal_fort: number;
  // P6 (plan Task 1 Step 12): the rocket site and dam levels, the power
  // plants (also counted in factories: they hold a shared slot) and the
  // facility queued (FACILITY_IDS index + 1, 0 none; also in factories).
  rocket_site: number;
  dam: number;
  power_plant: number;
  facility: number;
}

/** Factories and the levels of each level building a queue still adds to `region`. */
export function queuedInRegion(
  queue: readonly QueuedBuild[],
  region: number,
): QueuedInRegion {
  const out: QueuedInRegion = {
    factories: 0,
    infra: 0,
    fort: 0,
    rail: 0,
    supply_hub: 0,
    naval_base: 0,
    air_base: 0,
    anti_air: 0,
    radar: 0,
    coastal_fort: 0,
    rocket_site: 0,
    dam: 0,
    power_plant: 0,
    facility: 0,
  };
  for (const q of queue) {
    if (q.region !== region) continue;
    switch (q.building) {
      case "infra":
      case "fort":
      case "rail":
      case "supply_hub":
      case "naval_base":
      case "air_base":
      case "anti_air":
      case "radar":
      case "coastal_fort":
      case "rocket_site":
      case "dam":
        out[q.building] += q.count;
        break;
      case "power_plant":
        out.power_plant += q.count;
        out.factories += q.count;
        break;
      case "facility_nuclear":
      case "facility_rocket":
      case "facility_science":
        // Review L10: FACILITY_IDS index + 1, derived.
        out.facility = FACILITY_IDS.indexOf(q.building) + 1;
        out.factories += q.count;
        break;
      default:
        // Slot buildings: factories, dockyards, refineries, fuel silos.
        out.factories += q.count;
    }
  }
  return out;
}

/** The queued levels of a level building (0 for a slot building). */
export function queuedLevels(q: QueuedInRegion, building: BuildingId): number {
  switch (building) {
    case "infra":
    case "fort":
    case "rail":
    case "supply_hub":
    case "naval_base":
    case "air_base":
    case "anti_air":
    case "radar":
    case "coastal_fort":
    case "rocket_site":
    case "dam":
      return q[building];
    default:
      return 0;
  }
}

export interface BuildCheck {
  building: BuildingId;
  count: number;
  /** The land region exists and the country controls it. */
  controlled: boolean;
  occupied: boolean;
  queueLength: number;
  /**
   * For a level building (infrastructure, fort, railway, supply hub): its
   * level now plus the levels the controller's queue adds; 0 otherwise.
   */
  levelWithQueue: number;
  /** Factories built plus the ones the controller's queue reserves. */
  usedSlots: number;
  /** The region's slots with the country's slot bonus (regionSlots). */
  slots: number;
  /** P4: the region touches the sea (P1 `coastal`: a dockyard). */
  coastal: boolean;
  /** P4: the region has a harbor zone (spec §3.5: a naval base, a coastal fort). */
  harbor: boolean;
  /** P4: the techs a building needs (BUILDING_TECH, radar_2 for a third radar level). */
  researched: ReadonlySet<WwTechId>;
  /**
   * P6 (plan Task 1 Step 12): depthBuildBlock's answer for a P6 building
   * (the caller works it out; WorldRules). Absent: a P6 building is not
   * buildable (a screen without the depth data).
   */
  depthBlock?: WwOrderBlock | null;
  /**
   * Final review B, I1: the region is a no-strike region (Korea, Taiwan;
   * engine-lib isNoStrike), where nothing is built. Absent: not one.
   */
  noStrike?: boolean;
}

/** P6: the buildings whose rules live in WorldRules.depthBuildBlock. */
const DEPTH_BUILDING_SET: ReadonlySet<BuildingId> = new Set([
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
  "rocket_site",
  "power_plant",
  "dam",
]);

/** Spec §4.3 (P4 spec §5.1, §12.1): why the project cannot be queued; null when it can. */
export function buildBlockOf(c: BuildCheck): WwOrderBlock | null {
  if (!BUILDABLE.includes(c.building)) return "not_buildable";
  if (c.noStrike === true) return "no_strike_region";
  if (!c.controlled) return "not_controlled";
  if (c.queueLength >= WW_MAX_QUEUE) return "queue_full";
  if (COASTAL_BUILDINGS.includes(c.building)) {
    if (!(c.building === "dock" ? c.coastal : c.harbor)) return "not_coastal";
  }
  if (DEPTH_BUILDING_SET.has(c.building)) {
    if (c.depthBlock === undefined) return "not_buildable";
    if (c.depthBlock !== null) return c.depthBlock;
  }
  const tech = BUILDING_TECH[c.building];
  if (tech !== undefined && !c.researched.has(tech)) return "no_tech";
  if (
    c.building === "radar" &&
    c.levelWithQueue + c.count > 2 &&
    !c.researched.has("radar_2")
  ) {
    return "no_tech";
  }
  const max = LEVEL_MAX[c.building];
  // Level buildings use no slot and go up in occupied regions too (P2 §11.7).
  if (max !== undefined) {
    return c.levelWithQueue + c.count > max ? "infra_max" : null;
  }
  if (c.occupied) return "occupied";
  return c.usedSlots + c.count > c.slots ? "no_slots" : null;
}

// ---- Laws (spec §5.4; P3 spec §7, plan decision 11) ----

/**
 * Why the law cannot be set on `day`; null when it can. The kind, "same"
 * and the cooldown are P1's; the conditions and the PP cost are P3's
 * lawBlock (PoliticsRules).
 */
export function lawBlockOf(
  laws: CountryLaws,
  cooldownUntil: Readonly<Record<LawKind, number>>,
  kind: LawKind,
  value: LawValue,
  day: number,
  ctx: LawCtx,
): WwOrderBlock | null {
  if (!LAW_LADDERS[kind].includes(value)) return "law_kind";
  if (laws[kind] === value) return "law_same";
  if (day < cooldownUntil[kind]) return "law_cooldown";
  return lawBlock(value, ctx);
}

// ---- Production (spec §8.4) ----

const AIR = new Set<EquipmentType>(AIR_TYPES);

/**
 * P6 (plan decision 5, spec §7.1): what the depth layer says about a
 * line's equipment. The engine builds it from WwDepth, a screen from
 * WwDepthView.
 */
export interface LineDepthCtx {
  /** A design slot (1-based) may be produced: saved, own or licensed, not obsolete. */
  designUsable: (type: EquipmentType, slot: number) => boolean;
  /** EQUIP_KEYS indices the country holds a production licence for. */
  licensed: ReadonlySet<number>;
  /** SPECIAL_PROJECTS bits done. */
  projectsDone: number;
}

/**
 * A generation needs its tech (and has to exist). P4: an aircraft type
 * needs planeGenTechs (a carrier type carrier_aviation too); the convoy is
 * built on naval lines only (equipmentBuildable). P6: a design slot needs
 * a usable design ("bad_line"), a project item its project
 * ("project_locked"), and a licence stands in for the tech.
 */
export function equipmentTechBlock(
  researched: ReadonlySet<WwTechId>,
  type: EquipmentType,
  gen: number,
  depth?: LineDepthCtx,
): WwOrderBlock | null {
  if (equipKey(type, gen) < 0) return "no_tech";
  if (!equipmentBuildable(type)) return "not_buildable";
  if (isDesignType(type)) {
    return depth !== undefined && depth.designUsable(type, gen)
      ? null
      : "bad_line";
  }
  const project = PROJECT_TYPES[type];
  if (project !== undefined) {
    return depth !== undefined && (depth.projectsDone & (1 << project)) !== 0
      ? null
      : "project_locked";
  }
  if (depth?.licensed.has(equipKey(type, gen)) === true) return null;
  if (AIR.has(type)) {
    return planeGenTechs(type as AirType, gen).every((t) => researched.has(t))
      ? null
      : "no_tech";
  }
  return researched.has(genTech(type, gen)) ? null : "no_tech";
}

/** Why a new line cannot be added; null when it can. */
export function addLineBlockOf(
  researched: ReadonlySet<WwTechId>,
  lines: number,
  type: EquipmentType,
  gen: number,
  depth?: LineDepthCtx,
): WwOrderBlock | null {
  if (lines >= WW_MAX_LINES) return "lines_full";
  return equipmentTechBlock(researched, type, gen, depth);
}

// ---- Research (spec §9.1, §9.3) ----

export interface ResearchState {
  researched: ReadonlySet<WwTechId>;
  /** The tech in each slot, null when empty (may be shorter than slotCount). */
  slots: readonly (WwTechId | null)[];
  slotCount: number;
}

/** The first empty slot within the slot count, or -1. */
export function freeResearchSlot(
  slots: readonly (WwTechId | null)[],
  slotCount: number,
): number {
  for (let i = 0; i < slotCount; i++) {
    if ((slots[i] ?? null) === null) return i;
  }
  return -1;
}

/** Why `tech` cannot start now; null when it can. */
export function researchBlockOf(
  s: ResearchState,
  tech: WwTechId,
): WwOrderBlock | null {
  if (s.researched.has(tech)) return "researched";
  if (s.slots.includes(tech)) return "in_progress";
  const def = WW_TECHS[tech];
  // P6 plan decision 25: a retired doctrine tech is never researched again.
  if (def.retired === true) return "no_tech";
  if (def.prereqs.some((p) => !s.researched.has(p))) return "prereq";
  if (def.school !== undefined) {
    // P4 plan decision 23: one school a domain (land, sea, air).
    const running = s.slots.filter((t): t is WwTechId => t !== null);
    const open = openSchool(
      [...s.researched, ...running],
      DOCTRINE_DOMAIN[def.school],
    );
    if (open !== null && open !== def.school) return "doctrine";
  }
  return freeResearchSlot(s.slots, s.slotCount) < 0 ? "no_slot" : null;
}

// ---- Trade (spec §7.4) ----

/** Units a day the seller can still sell: its export share less what it sells (may be negative). */
export function exportRoomOf(
  produced: number,
  exportPct: number,
  soldUnits: number,
): number {
  return exportCapacity(produced, exportPct) - soldUnits;
}

/**
 * P4 Task 15 (HOI4: the trade screen sells what is left, a part factory's
 * worth for a whole factory): the units a deal of `civs` factories moves
 * with `room` left at the seller — every factory 8, the last one what is
 * left (at least 1; 0 when the room is gone).
 */
export function dealUnitsOf(civs: number, room: number): number {
  return Math.max(0, Math.min(civs * WW_TRADE_UNITS_PER_CIV, room));
}

/** The civilian factories a deal moving `units` a day costs: ceil(units / 8). */
export function dealCivsOf(units: number): number {
  return Math.ceil(Math.max(0, units) / WW_TRADE_UNITS_PER_CIV);
}

/** Civilian factories a buyer can pay with: its own, less consumer goods. */
export function payableCivs(civ: number, cgMilli: number): number {
  return Math.max(0, Math.floor((civ * 1000 - cgMilli) / 1000));
}

export interface TradeCheck {
  /** The seller is a living partner the buyer can reach (tradePartnerBlock). */
  partnerOk: boolean;
  /** The buyer's open trades. */
  buyerTrades: number;
  /** A deal with the same seller and resource grows instead of a new one. */
  grows: boolean;
  /** Civilian factories the order adds. */
  civs: number;
  /** exportRoomOf for the seller and the resource (units a day). */
  room: number;
  /** payableCivs of the buyer. */
  payable: number;
  /** Civilian factories the buyer already pays. */
  paidCivs: number;
}

/** Why the deal cannot open (or grow); null when it can. */
export function openTradeBlockOf(c: TradeCheck): WwOrderBlock | null {
  if (!c.partnerOk) return "no_partner";
  if (!c.grows && c.buyerTrades >= WW_MAX_TRADES) return "trades_full";
  // P4 Task 15: every factory but the last needs its 8; the last buys
  // what is left (spec §7.4's "≥ 8k" let no small seller sell at all).
  if (c.room <= 0 || (c.civs - 1) * WW_TRADE_UNITS_PER_CIV >= c.room) {
    return "no_room";
  }
  return c.paidCivs + c.civs > c.payable ? "no_civs" : null;
}
