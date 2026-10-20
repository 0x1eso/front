// World War 1936 P1: the economy's judgements over plain data (plan
// decision 3). The engine's order functions and the screens' buttons call
// the same ones; whatever needs engine objects (who is alive, embargoes)
// the caller works out first and hands in as a value.
import {
  BUILDABLE,
  BuildingId,
  CountryLaws,
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
import { genTech } from "./Equipment";
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
  /** By smallID: sea zones its regions touch. */
  seaZones: Set<number>[];
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
  const seaZones = Array.from({ length: size }, () => new Set<number>());
  for (const r of scenario.landRegions) {
    const c = controller[r.id];
    if (c <= 0 || c >= size) continue;
    regionsByCountry[c].push(r.id);
    for (const z of scenario.regionSeaZones(r.id)) seaZones[c].add(z);
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
  return { regionsByCountry, neighbours, seaZones };
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
  };
  for (const q of queue) {
    if (q.region !== region) continue;
    switch (q.building) {
      case "infra":
      case "fort":
      case "rail":
      case "supply_hub":
        out[q.building] += q.count;
        break;
      default:
        out.factories += q.count;
    }
  }
  return out;
}

/** The queued levels of a level building (0 for a factory). */
export function queuedLevels(q: QueuedInRegion, building: BuildingId): number {
  switch (building) {
    case "infra":
    case "fort":
    case "rail":
    case "supply_hub":
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
}

/** Spec §4.3: why the project cannot be queued; null when it can. */
export function buildBlockOf(c: BuildCheck): WwOrderBlock | null {
  if (!BUILDABLE.includes(c.building)) return "not_buildable";
  if (!c.controlled) return "not_controlled";
  if (c.queueLength >= WW_MAX_QUEUE) return "queue_full";
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

/** A generation needs its tech (and has to exist). */
export function equipmentTechBlock(
  researched: ReadonlySet<WwTechId>,
  type: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  if (equipKey(type, gen) < 0) return "no_tech";
  return researched.has(genTech(type, gen)) ? null : "no_tech";
}

/** Why a new line cannot be added; null when it can. */
export function addLineBlockOf(
  researched: ReadonlySet<WwTechId>,
  lines: number,
  type: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  if (lines >= WW_MAX_LINES) return "lines_full";
  return equipmentTechBlock(researched, type, gen);
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
  if (def.prereqs.some((p) => !s.researched.has(p))) return "prereq";
  if (def.school !== undefined) {
    const running = s.slots.filter((t): t is WwTechId => t !== null);
    const open = openSchool([...s.researched, ...running]);
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
  /** exportRoomOf for the seller and the resource. */
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
  if (c.civs * WW_TRADE_UNITS_PER_CIV > c.room) return "no_room";
  return c.paidCivs + c.civs > c.payable ? "no_civs" : null;
}
