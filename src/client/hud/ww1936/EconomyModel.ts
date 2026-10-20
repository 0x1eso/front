// World War 1936 P1 (spec §13): what the economy screens draw, as plain
// data from the view (WwEconomyView) and the scenario. No Lit here: the
// screens render it and the tests read it. Every judgement that blocks a
// button is the engine's own function from engine-lib (EconomyChecks,
// EconomyRules, WwLaws), fed with the view's copy of the data (plan
// decision 3, pre-flight U8).
import type { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BuildingId,
  DoctrineSchool,
  EconomyLaw,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  EquipmentType,
  LAW_LADDERS,
  LawKind,
  LawValue,
  MAX_INFRA,
  RegionCategory,
  RESOURCE_IDS,
  ResourceId,
  TechBranch,
  TradeLaw,
  WW_MAX_PROJECT_COUNT,
  WW_MAX_TRADE_CIVS,
  WW_TECH_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwCountryDetail,
  WwCountrySummary,
  WwLineData,
  WwOrderBlock,
  WwTechId,
  WwTradeData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addLineBlockOf,
  buildBlockOf,
  BuildCheck,
  countryGraph,
  equipmentTechBlock,
  lawBlockOf,
  openTradeBlockOf,
  payableCivs,
  queuedInRegion,
  regionShares,
  researchBlockOf,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  aheadPct,
  constructionDaysLeft,
  constructionProgress,
  consumerGoodsMilli,
  coveragePermille,
  effAfterSwitch,
  exportCapacity,
  regionSlots,
  researchProgress,
  TradeGraph,
  tradeRouteOk,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT, genTech } from "@openfront/engine-lib/ww1936/Equipment";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  lawConditionMet,
  lawEffects,
} from "@openfront/engine-lib/ww1936/WwLaws";
import {
  techDays,
  TechEffects,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import type { WwEconomyView } from "../../view/WwEconomyView";
import { isCapitulated, today, type WwGame } from "./WorldWarModel";

/** What the economy screens read from the game (a fake in tests). */
export type WwEconGame = WwGame & Pick<GameView, "wwEconomy">;

// ---- Translation keys (spelled out: tests/TranslationSystem.test.ts counts
// each literal, and the Records make the compiler check every id has one) ----

export const BUILDING_KEYS: Readonly<Record<BuildingId, string>> = {
  civ: "ww1936.building.civ",
  mil: "ww1936.building.mil",
  dock: "ww1936.building.dock",
  infra: "ww1936.building.infra",
};

export const RESOURCE_KEYS: Readonly<Record<ResourceId, string>> = {
  oil: "ww1936.res.oil",
  aluminium: "ww1936.res.aluminium",
  rubber: "ww1936.res.rubber",
  tungsten: "ww1936.res.tungsten",
  steel: "ww1936.res.steel",
  chromium: "ww1936.res.chromium",
};

export const EQUIPMENT_KEYS: Readonly<Record<EquipmentType, string>> = {
  infantry_equipment: "ww1936.equip.infantry_equipment",
  support_equipment: "ww1936.equip.support_equipment",
  artillery: "ww1936.equip.artillery",
  anti_tank: "ww1936.equip.anti_tank",
  anti_air: "ww1936.equip.anti_air",
  motorized: "ww1936.equip.motorized",
  light_tank: "ww1936.equip.light_tank",
  medium_tank: "ww1936.equip.medium_tank",
  fighter: "ww1936.equip.fighter",
  bomber: "ww1936.equip.bomber",
};

/** By generation − 1. */
export const GEN_KEYS = [
  "ww1936.gen.1",
  "ww1936.gen.2",
  "ww1936.gen.3",
] as const;

export const REGION_CAT_KEYS: Readonly<Record<RegionCategory, string>> = {
  wasteland: "ww1936.region_cat.wasteland",
  pastoral: "ww1936.region_cat.pastoral",
  rural: "ww1936.region_cat.rural",
  town: "ww1936.region_cat.town",
  large_town: "ww1936.region_cat.large_town",
  city: "ww1936.region_cat.city",
  large_city: "ww1936.region_cat.large_city",
  metropolis: "ww1936.region_cat.metropolis",
  megalopolis: "ww1936.region_cat.megalopolis",
};

export const LAW_KIND_KEYS: Readonly<Record<LawKind, string>> = {
  economy: "ww1936.law_kind.economy",
  trade: "ww1936.law_kind.trade",
  conscription: "ww1936.law_kind.conscription",
};

export const LAW_KEYS: Readonly<Record<LawValue, string>> = {
  civilian: "ww1936.law.economy.civilian",
  early_mobilization: "ww1936.law.economy.early_mobilization",
  partial_mobilization: "ww1936.law.economy.partial_mobilization",
  war_economy: "ww1936.law.economy.war_economy",
  total_mobilization: "ww1936.law.economy.total_mobilization",
  free_trade: "ww1936.law.trade.free_trade",
  export_focus: "ww1936.law.trade.export_focus",
  limited_exports: "ww1936.law.trade.limited_exports",
  closed_economy: "ww1936.law.trade.closed_economy",
  disarmed: "ww1936.law.conscription.disarmed",
  volunteer: "ww1936.law.conscription.volunteer",
  limited: "ww1936.law.conscription.limited",
  extensive: "ww1936.law.conscription.extensive",
  service: "ww1936.law.conscription.service",
  all_adults: "ww1936.law.conscription.all_adults",
  scraping: "ww1936.law.conscription.scraping",
};

/** Why a law step is locked (WwLaws.lawConditionMet), for the steps with a condition. */
export const LAW_NEED_KEYS: Readonly<Partial<Record<LawValue, string>>> = {
  partial_mobilization: "ww1936.econ.law_need.partial_mobilization",
  war_economy: "ww1936.econ.law_need.war_economy",
  total_mobilization: "ww1936.econ.law_need.total_mobilization",
  extensive: "ww1936.econ.law_need.extensive",
  service: "ww1936.econ.law_need.service",
  all_adults: "ww1936.econ.law_need.all_adults",
  scraping: "ww1936.econ.law_need.scraping",
};

export const BRANCH_KEYS: Readonly<Record<TechBranch, string>> = {
  infantry: "ww1936.branch.infantry",
  artillery: "ww1936.branch.artillery",
  armour: "ww1936.branch.armour",
  air: "ww1936.branch.air",
  industry: "ww1936.branch.industry",
  electronics: "ww1936.branch.electronics",
  doctrine: "ww1936.branch.doctrine",
};

export const SCHOOL_KEYS: Readonly<Record<DoctrineSchool, string>> = {
  mobile: "ww1936.school.mobile",
  firepower: "ww1936.school.firepower",
  battleplan: "ww1936.school.battleplan",
  mass: "ww1936.school.mass",
};

export const TECH_KEYS: Readonly<Record<WwTechId, string>> = {
  inf_eq_1: "ww1936.tech.inf_eq_1",
  inf_eq_2: "ww1936.tech.inf_eq_2",
  inf_eq_3: "ww1936.tech.inf_eq_3",
  support_eq_1: "ww1936.tech.support_eq_1",
  support_eq_2: "ww1936.tech.support_eq_2",
  motorized_1: "ww1936.tech.motorized_1",
  artillery_1: "ww1936.tech.artillery_1",
  artillery_2: "ww1936.tech.artillery_2",
  artillery_3: "ww1936.tech.artillery_3",
  anti_tank_1: "ww1936.tech.anti_tank_1",
  anti_tank_2: "ww1936.tech.anti_tank_2",
  anti_air_1: "ww1936.tech.anti_air_1",
  anti_air_2: "ww1936.tech.anti_air_2",
  light_tank_1: "ww1936.tech.light_tank_1",
  light_tank_2: "ww1936.tech.light_tank_2",
  medium_tank_1: "ww1936.tech.medium_tank_1",
  medium_tank_2: "ww1936.tech.medium_tank_2",
  medium_tank_3: "ww1936.tech.medium_tank_3",
  fighter_1: "ww1936.tech.fighter_1",
  fighter_2: "ww1936.tech.fighter_2",
  fighter_3: "ww1936.tech.fighter_3",
  bomber_1: "ww1936.tech.bomber_1",
  bomber_2: "ww1936.tech.bomber_2",
  construction_1: "ww1936.tech.construction_1",
  construction_2: "ww1936.tech.construction_2",
  construction_3: "ww1936.tech.construction_3",
  tools_1: "ww1936.tech.tools_1",
  tools_2: "ww1936.tech.tools_2",
  tools_3: "ww1936.tech.tools_3",
  tools_4: "ww1936.tech.tools_4",
  output_1: "ww1936.tech.output_1",
  output_2: "ww1936.tech.output_2",
  excavation_1: "ww1936.tech.excavation_1",
  excavation_2: "ww1936.tech.excavation_2",
  flexible_line: "ww1936.tech.flexible_line",
  electronics_1: "ww1936.tech.electronics_1",
  computing_1: "ww1936.tech.computing_1",
  computing_2: "ww1936.tech.computing_2",
  mobile_1: "ww1936.tech.mobile_1",
  mobile_2: "ww1936.tech.mobile_2",
  firepower_1: "ww1936.tech.firepower_1",
  firepower_2: "ww1936.tech.firepower_2",
  battleplan_1: "ww1936.tech.battleplan_1",
  battleplan_2: "ww1936.tech.battleplan_2",
  mass_1: "ww1936.tech.mass_1",
  mass_2: "ww1936.tech.mass_2",
};

export type EffectKey = keyof TechEffects | "unlock";

/** A research card's effect line (pre-flight R7.8). */
export const EFFECT_KEYS: Readonly<Record<EffectKey, string>> = {
  constructionPct: "ww1936.effect.constructionPct",
  slotPct: "ww1936.effect.slotPct",
  effCapBp: "ww1936.effect.effCapBp",
  outputPct: "ww1936.effect.outputPct",
  extractionPct: "ww1936.effect.extractionPct",
  retentionBp: "ww1936.effect.retentionBp",
  researchPct: "ww1936.effect.researchPct",
  attackPct: "ww1936.effect.attackPct",
  defensePct: "ww1936.effect.defensePct",
  speedPct: "ww1936.effect.speedPct",
  vehicleBonusPct: "ww1936.effect.vehicleBonusPct",
  gunBonusPct: "ww1936.effect.gunBonusPct",
  recruitablePct: "ww1936.effect.recruitablePct",
  trainPct: "ww1936.effect.trainPct",
  unlock: "ww1936.effect.unlock",
};

/** Why an order is refused (pre-flight X5): shown under a blocked button. */
export const BLOCK_KEYS: Readonly<Record<WwOrderBlock, string>> = {
  dead: "ww1936.econ.block.dead",
  not_controlled: "ww1936.econ.block.not_controlled",
  occupied: "ww1936.econ.block.occupied",
  not_buildable: "ww1936.econ.block.not_buildable",
  no_slots: "ww1936.econ.block.no_slots",
  infra_max: "ww1936.econ.block.infra_max",
  queue_full: "ww1936.econ.block.queue_full",
  bad_index: "ww1936.econ.block.bad_index",
  law_kind: "ww1936.econ.block.law_kind",
  law_same: "ww1936.econ.block.law_same",
  law_condition: "ww1936.econ.block.law_condition",
  law_cooldown: "ww1936.econ.block.law_cooldown",
  no_tech: "ww1936.econ.block.no_tech",
  lines_full: "ww1936.econ.block.lines_full",
  bad_line: "ww1936.econ.block.bad_line",
  no_partner: "ww1936.econ.block.no_partner",
  no_room: "ww1936.econ.block.no_room",
  trades_full: "ww1936.econ.block.trades_full",
  no_civs: "ww1936.econ.block.no_civs",
  researched: "ww1936.econ.block.researched",
  in_progress: "ww1936.econ.block.in_progress",
  prereq: "ww1936.econ.block.prereq",
  doctrine: "ww1936.econ.block.doctrine",
  no_slot: "ww1936.econ.block.no_slot",
  bad_slot: "ww1936.econ.block.bad_slot",
};

// ---- Icons (pre-flight R7.7: emoji, no new image files) ----

export const RESOURCE_ICONS: Readonly<Record<ResourceId, string>> = {
  oil: "🛢️",
  aluminium: "🥫",
  rubber: "🌳",
  tungsten: "🪨",
  steel: "🔩",
  chromium: "💎",
};

export const BUILDING_ICONS: Readonly<Record<BuildingId, string>> = {
  civ: "🏭",
  mil: "🛠️",
  dock: "⚓",
  infra: "🛤️",
};

export const EQUIPMENT_ICONS: Readonly<Record<EquipmentType, string>> = {
  infantry_equipment: "🪖",
  support_equipment: "📡",
  artillery: "💥",
  anti_tank: "🎯",
  anti_air: "🔭",
  motorized: "🚚",
  light_tank: "🚙",
  medium_tank: "🛡️",
  fighter: "✈️",
  bomber: "🛩️",
};

// ---- Names ----

export const resourceName = (r: ResourceId) => translateText(RESOURCE_KEYS[r]);
export const buildingName = (b: BuildingId) => translateText(BUILDING_KEYS[b]);
export const equipmentName = (e: EquipmentType) =>
  translateText(EQUIPMENT_KEYS[e]);
export const genName = (gen: number) => translateText(GEN_KEYS[gen - 1]);
export const techName = (t: WwTechId) => translateText(TECH_KEYS[t]);
export const lawName = (v: LawValue) => translateText(LAW_KEYS[v]);
export const lawKindName = (k: LawKind) => translateText(LAW_KIND_KEYS[k]);
export const branchName = (b: TechBranch) => translateText(BRANCH_KEYS[b]);
export const schoolName = (s: DoctrineSchool) => translateText(SCHOOL_KEYS[s]);
export const blockText = (b: WwOrderBlock) => translateText(BLOCK_KEYS[b]);
export const regionCatName = (c: RegionCategory) =>
  translateText(REGION_CAT_KEYS[c]);

/** "●●●○○": infrastructure out of five. */
export function infraDots(infra: number): string {
  return "●".repeat(infra) + "○".repeat(Math.max(0, MAX_INFRA - infra));
}

/** A count with a real minus sign ("−3"); `plus` adds "+" to a gain. */
export function signedText(n: number, plus = false): string {
  if (n < 0) return `\u2212${-n}`;
  return plus && n > 0 ? `+${n}` : `${n}`;
}

/** "1.5": milli-factories with one decimal (pre-flight R7.6). */
export function milliText(milli: number): string {
  return (milli / 1000).toFixed(1);
}

/** The equipment generation a tech opens, if it opens one. */
export function techUnlock(
  tech: WwTechId,
): { equipment: EquipmentType; gen: number } | null {
  for (const equipment of EQUIPMENT_TYPES) {
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      if (genTech(equipment, gen) === tech) return { equipment, gen };
    }
  }
  return null;
}

/** A research card's effect lines: each bonus, or the generation it opens. */
export function effectLines(tech: WwTechId): string[] {
  const out: string[] = [];
  const unlock = techUnlock(tech);
  if (unlock !== null) {
    out.push(
      translateText(EFFECT_KEYS.unlock, {
        equipment: equipmentName(unlock.equipment),
        gen: genName(unlock.gen),
      }),
    );
  }
  const effects = WW_TECHS[tech].effects;
  for (const k of Object.keys(effects) as (keyof TechEffects)[]) {
    const v = effects[k] ?? 0;
    // Basis points show as percent.
    const n = k === "effCapBp" || k === "retentionBp" ? v / 100 : v;
    out.push(translateText(EFFECT_KEYS[k], { n }));
  }
  return out;
}

/** Fighters and bombers only fill the stockpile until the air war (P4). */
export function stockOnly(equipment: EquipmentType): boolean {
  return EQUIPMENT[equipment].family === "aircraft";
}

// ---- Who is in the fight (spec §4.4, §7.4) ----

/**
 * Alive and not capitulated: a region's 1936 owner that still fights (so
 * the region is occupied, not annexed), or a country one can trade with.
 */
export function fightingFn(game: WwGame): (smallID: number) => boolean {
  return (id) => {
    if (id <= 0) return false;
    let p: ReturnType<WwGame["playerBySmallID"]>;
    try {
      p = game.playerBySmallID(id);
    } catch {
      return false;
    }
    return p.isPlayer() && p.isAlive() && !isCapitulated(game, id);
  };
}

/** What the army is made of on the screen (PlayerView). */
export interface ArmyLike {
  troops(): number;
  outgoingAttacks(): readonly { troops: number }[];
  units(...types: UnitType[]): readonly { troops(): number }[];
}

/**
 * The army the engine counts (WwEconomy.armyMen): troops at home, in
 * attacks and on transport ships, each floored.
 */
export function armyMenOf(p: ArmyLike): number {
  let n = Math.floor(p.troops());
  for (const a of p.outgoingAttacks()) n += Math.floor(a.troops);
  for (const u of p.units(UnitType.TransportShip)) n += Math.floor(u.troops());
  return n;
}

/**
 * Days of my longest running war now, -1 at peace — the engine's
 * WwEconomy.warDays from the P0 war list, not the last daily detail.
 */
export function liveWarDays(game: WwGame, me: number): number {
  const data = game.worldWarData();
  if (data === null) return -1;
  let since: number | null = null;
  for (const w of data.wars) {
    if ((w.a === me || w.b === me) && (since === null || w.sinceTick < since)) {
      since = w.sinceTick;
    }
  }
  return since === null ? -1 : today(game) - dayIndex(since, data.prepEndTick);
}

// ---- The top band (spec §13.1) ----

export interface TopBandEconomy {
  civ: number;
  mil: number;
  manpowerText: string;
  shortage: boolean;
}

export function topBandEconomy(s: WwCountrySummary): TopBandEconomy {
  return {
    civ: s.civ,
    mil: s.mil,
    manpowerText: renderTroops(s.manpower),
    shortage: s.shortage,
  };
}

// ---- Construction (spec §4, §13.3 tab 1) ----

export interface ConstructionRow {
  index: number;
  region: number;
  regionName: string;
  building: BuildingId;
  count: number;
  /** Of the building under way, 0..1. */
  progress: number;
  /** Milli construction points a day. */
  perDay: number;
  /** -1 while it gets no factories (EconomyRules.constructionDaysLeft). */
  daysLeft: number;
  civs: number;
}

function regionName(
  scenario: ScenarioIndex,
  id: number,
  korean: boolean,
): string {
  const r = scenario.region(id);
  if (r === undefined) return "";
  return korean ? r.nameKo : r.name;
}

export function constructionRows(
  detail: WwCountryDetail,
  scenario: ScenarioIndex,
  korean = false,
): ConstructionRow[] {
  return detail.queue.map((q, index) => {
    const perDay = constructionProgress(q.assignedMilli, q.speedPct);
    return {
      index,
      region: q.region,
      regionName: regionName(scenario, q.region, korean),
      building: q.building,
      count: q.count,
      progress: q.costMilli > 0 ? q.progressMilli / q.costMilli : 0,
      perDay,
      daysLeft: constructionDaysLeft(
        q.costMilli,
        q.progressMilli,
        q.count,
        perDay,
      ),
      civs: q.assignedMilli / 1000,
    };
  });
}

/** The building-slot bonus of a country's research (construction_n). */
export function slotPctOf(detail: WwCountryDetail | null): number {
  return detail === null ? 0 : techTotals(new Set(detail.researched)).slotPct;
}

/** What the engine's buildBlock checks, from the view (Construction.buildBlock). */
export function buildCheck(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  count: number,
  slotPct: number,
  fighting: (smallID: number) => boolean,
): BuildCheck {
  const r = scenario.region(region);
  const queue = view.detail(me)?.queue ?? [];
  const queued = queuedInRegion(queue, region);
  const controller = r === undefined ? 0 : view.controller[region];
  const owner = r === undefined ? 0 : scenario.ownerByRegion()[region];
  return {
    building,
    count,
    controlled: r !== undefined && controller === me,
    occupied:
      r !== undefined &&
      regionShares(controller, owner, r.core, fighting(owner)).occupied,
    queueLength: queue.length,
    infraWithQueue: (r === undefined ? 0 : view.infra[region]) + queued.infra,
    usedSlots:
      r === undefined
        ? 0
        : view.civ[region] +
          view.mil[region] +
          view.dock[region] +
          queued.factories,
    slots: r === undefined ? 0 : regionSlots(r.cat, slotPct),
  };
}

export function buildBlock(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  count: number,
  slotPct: number,
  fighting: (smallID: number) => boolean,
): WwOrderBlock | null {
  return buildBlockOf(
    buildCheck(view, scenario, me, region, building, count, slotPct, fighting),
  );
}

export interface BuildCandidate {
  id: number;
  name: string;
  /** Slots (or infrastructure levels) still free after the queue's reservations. */
  free: number;
  slots: number;
  infra: number;
}

/** How many of `building` the region still takes, reservations counted. */
function freeRoom(c: BuildCheck): number {
  return c.building === "infra"
    ? MAX_INFRA - c.infraWithQueue
    : c.slots - c.usedSlots;
}

/**
 * Spec §13.3: the regions I control where `building` can go now — most
 * free slots first, then the best infrastructure, then the region id.
 * Occupied regions take no factories (buildBlockOf: "occupied").
 */
export function buildCandidates(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  building: BuildingId,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  korean = false,
): BuildCandidate[] {
  const out: BuildCandidate[] = [];
  for (const r of scenario.landRegions) {
    if (view.controller[r.id] !== me) continue;
    const c = buildCheck(
      view,
      scenario,
      me,
      r.id,
      building,
      1,
      slotPct,
      fighting,
    );
    if (buildBlockOf(c) !== null) continue;
    out.push({
      id: r.id,
      name: korean ? r.nameKo : r.name,
      free: freeRoom(c),
      slots: building === "infra" ? MAX_INFRA : c.slots,
      infra: view.infra[r.id],
    });
  }
  return out.sort(
    (a, b) => b.free - a.free || b.infra - a.infra || a.id - b.id,
  );
}

/** The most the count stepper offers for a candidate. */
export function maxBuildCount(c: BuildCandidate): number {
  return Math.max(1, Math.min(WW_MAX_PROJECT_COUNT, c.free));
}

// ---- Production (spec §8, §13.3 tab 2) ----

export interface LineRow {
  id: number;
  index: number;
  equipment: EquipmentType;
  gen: number;
  factories: number;
  active: number;
  /** 0..1 */
  eff: number;
  /** 0..1 */
  cap: number;
  /** Units a day. */
  perDay: number;
  /** Resources this line gets less of than it needs. */
  shortage: ResourceId[];
}

/**
 * Per line, the resources it is short of (pre-flight R7.9): the engine's
 * allocation (EconomyRules.allocateResources) run again on the detail —
 * lines in order take what they need from produced − exported + imported.
 */
export function lineShortages(detail: WwCountryDetail): ResourceId[][] {
  const left = RESOURCE_IDS.map((_, r) => {
    const row = detail.resources[r];
    return row === undefined ? 0 : row.produced - row.exported + row.imported;
  });
  return detail.lines.map((l) => {
    const per = EQUIPMENT[l.equipment].resources;
    const short: ResourceId[] = [];
    RESOURCE_IDS.forEach((id, r) => {
      const need = per[r] * l.active;
      if (need === 0) return;
      const give = Math.min(need, Math.max(0, left[r]));
      left[r] -= give;
      if (give < need) short.push(id);
    });
    return short;
  });
}

export function lineRows(detail: WwCountryDetail): LineRow[] {
  const shortages = lineShortages(detail);
  return detail.lines.map((l, index) => ({
    id: l.id,
    index,
    equipment: l.equipment,
    gen: l.gen,
    factories: l.factories,
    active: l.active,
    eff: l.effBp / 10_000,
    cap: detail.effCapBp / 10_000,
    perDay: l.costMilli > 0 ? l.outputMilli / l.costMilli : 0,
    shortage: shortages[index],
  }));
}

/** The efficiency (bp) a line keeps when switched (EconomyRules.effAfterSwitch). */
export function switchPreview(
  line: WwLineData,
  to: EquipmentType,
  toGen: number,
  retentionBp: number,
): number {
  return effAfterSwitch(
    line.effBp,
    line.equipment,
    line.gen,
    to,
    toGen,
    retentionBp,
  );
}

/** The flexible-line bonus of a country's research. */
export function retentionBpOf(detail: WwCountryDetail): number {
  return techTotals(new Set(detail.researched)).retentionBp;
}

export function addLineBlock(
  detail: WwCountryDetail,
  equipment: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  return addLineBlockOf(
    new Set(detail.researched),
    detail.lines.length,
    equipment,
    gen,
  );
}

export function changeLineBlock(
  detail: WwCountryDetail,
  equipment: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  return equipmentTechBlock(new Set(detail.researched), equipment, gen);
}

export interface StockRow {
  equipment: EquipmentType;
  /** Units by generation − 1. */
  gens: number[];
  total: number;
  /** 0..1 against the army; null for a type with no P1 combat role. */
  coverage: number | null;
}

/** Spec §13.3: the stockpile by type and generation, with its coverage. */
/** `men`: the army as the engine counts it (armyMenOf). */
export function stockRows(detail: WwCountryDetail, men: number): StockRow[] {
  return EQUIPMENT_TYPES.map((equipment) => {
    const gens: number[] = [];
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      gens.push(detail.stock[equipKey(equipment, gen)] ?? 0);
    }
    const total = gens.reduce((a, b) => a + b, 0);
    const need = EQUIPMENT[equipment].needPer100k;
    return {
      equipment,
      gens,
      total,
      coverage: need > 0 ? coveragePermille(total, men, need) / 1000 : null,
    };
  });
}

// ---- Resources and trade (spec §7, §13.3 tab 3) ----

export interface ResourceRowView {
  id: ResourceId;
  produced: number;
  exported: number;
  imported: number;
  used: number;
  balance: number;
}

export function resourceRows(detail: WwCountryDetail): ResourceRowView[] {
  return RESOURCE_IDS.map((id, r) => {
    const row = detail.resources[r] ?? {
      produced: 0,
      exported: 0,
      imported: 0,
      used: 0,
    };
    return {
      id,
      ...row,
      balance: row.produced - row.exported + row.imported - row.used,
    };
  });
}

export interface WarPair {
  a: number;
  b: number;
}

/**
 * The trade graph as the engine builds it (plan decision 14): country
 * neighbours and sea zones from the view's region control
 * (EconomyChecks.countryGraph), wars from the P0 data, factions from the
 * country table. Building it walks the map once the first time (pre-flight
 * D12): the trade tab asks only when it is open.
 */
export function tradeGraph(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  wars: readonly WarPair[],
): TradeGraph {
  const g = countryGraph(
    scenario,
    view.controller,
    scenario.countries.length + 1,
  );
  const key = (a: number, b: number) =>
    Math.min(a, b) * 65_536 + Math.max(a, b);
  const atWar = new Set(wars.map((w) => key(w.a, w.b)));
  const faction = (id: number) => {
    const tag = scenario.tagOfSmallId(id);
    return tag === undefined ? null : COUNTRIES[tag].faction;
  };
  const none = new Set<number>();
  return {
    atWar: (a, b) => atWar.has(key(a, b)),
    sameFaction: (a, b) => {
      const f = faction(a);
      return f !== null && f === faction(b);
    },
    neighbours: (c) => g.neighbours[c] ?? [],
    seaZones: (c) => g.seaZones[c] ?? none,
  };
}

/**
 * A fingerprint of who controls which region: the trade graph only changes
 * with it (and the wars), not with every economy update (FNV-1a).
 */
export function controlFingerprint(controller: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < controller.length; i++) {
    h = Math.imul(h ^ controller[i], 0x01000193);
  }
  return h >>> 0;
}

export interface TradeOffer {
  smallID: number;
  tag: CountryTag;
  /** Units a day still for sale. */
  room: number;
}

/**
 * Spec §13.3: who can sell me `resource` — a route (EconomyRules.tradeRouteOk)
 * and room for at least one factory's worth (8 a day), most room first.
 * Embargoes are not on the screen (pre-flight R7.14): the engine refuses
 * those deals quietly.
 */
export function tradeOffers(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  wars: readonly WarPair[],
  resource: ResourceId,
  canTrade: (smallID: number) => boolean = () => true,
  graph: TradeGraph = tradeGraph(view, scenario, wars),
): TradeOffer[] {
  const r = RESOURCE_IDS.indexOf(resource);
  const out: TradeOffer[] = [];
  scenario.countries.forEach((tag, i) => {
    const id = i + 1;
    if (id === me || !canTrade(id)) return;
    const room = view.summary(id)?.exportRoom[r] ?? 0;
    if (room < WW_TRADE_UNITS_PER_CIV) return;
    if (!tradeRouteOk(graph, me, id)) return;
    out.push({ smallID: id, tag, room });
  });
  return out.sort((a, b) => b.room - a.room || a.smallID - b.smallID);
}

/** Civilian factories my deals pay now (the engine's openTrade sums the deals). */
export function paidCivsOf(detail: WwCountryDetail): number {
  return sumCivs(detail.buying);
}

/** Civilian factories my sales bring in now. */
export function receivedCivsOf(detail: WwCountryDetail): number {
  return sumCivs(detail.selling);
}

function sumCivs(deals: readonly WwTradeData[]): number {
  let n = 0;
  for (const t of deals) n += t.civs;
  return n;
}

/** What the engine's openTrade checks, from the view (Trade.openTrade). */
export function openTradeBlock(
  view: WwEconomyView,
  me: number,
  seller: number,
  resource: ResourceId,
  civs: number,
  partnerOk: boolean,
): WwOrderBlock | null {
  const detail = view.detail(me);
  const mine = view.summary(me);
  if (detail === null || mine === null) return "dead";
  const r = RESOURCE_IDS.indexOf(resource);
  return openTradeBlockOf({
    partnerOk,
    buyerTrades: detail.buying.length,
    grows: detail.buying.some(
      (t) => t.seller === seller && t.resource === resource,
    ),
    civs,
    room: view.summary(seller)?.exportRoom[r] ?? 0,
    payable: payableCivs(mine.civ, detail.consumerGoodsMilli),
    paidCivs: paidCivsOf(detail),
  });
}

/** The most factories the buy stepper offers: the seller's room, my civilian factories, the cap. */
export function maxTradeCivs(
  view: WwEconomyView,
  me: number,
  room: number,
): number {
  const detail = view.detail(me);
  const mine = view.summary(me);
  if (detail === null || mine === null) return 1;
  const payable =
    payableCivs(mine.civ, detail.consumerGoodsMilli) - paidCivsOf(detail);
  return Math.max(
    1,
    Math.min(
      WW_MAX_TRADE_CIVS,
      Math.floor(room / WW_TRADE_UNITS_PER_CIV),
      payable,
    ),
  );
}

// ---- Research (spec §9, §13.4) ----

export type ResearchCardState =
  | "done"
  | "running"
  | "available"
  | "prereq"
  | "doctrine";

export interface ResearchCard {
  id: WwTechId;
  year: number;
  /** Base days (WwTechs.techDays). */
  days: number;
  /** Days at today's speed and ahead-of-time penalty (left, when running). */
  etaDays: number;
  /** The ahead-of-time penalty today, percent. */
  ahead: number;
  state: ResearchCardState;
  /** researchBlockOf: why a tap would not start it (no_slot: all slots busy). */
  block: WwOrderBlock | null;
  school: DoctrineSchool | null;
}

/** Research speed bonus: electronics and the trade law (spec §9.2). */
export function researchSpeedPct(detail: WwCountryDetail): number {
  return (
    techTotals(new Set(detail.researched)).researchPct +
    lawEffects(detail.laws).researchPct
  );
}

function cardState(block: WwOrderBlock | null): ResearchCardState {
  switch (block) {
    case "researched":
      return "done";
    case "in_progress":
      return "running";
    case "prereq":
      return "prereq";
    case "doctrine":
      return "doctrine";
    default:
      return "available";
  }
}

function slotTechs(detail: WwCountryDetail): (WwTechId | null)[] {
  return detail.slots.map((s) => s?.tech ?? null);
}

export function researchBlock(
  detail: WwCountryDetail,
  tech: WwTechId,
): WwOrderBlock | null {
  return researchBlockOf(
    {
      researched: new Set(detail.researched),
      slots: slotTechs(detail),
      slotCount: detail.slotCount,
    },
    tech,
  );
}

export function researchCards(
  detail: WwCountryDetail,
  branch: TechBranch,
  day: number,
): ResearchCard[] {
  const state = {
    researched: new Set(detail.researched),
    slots: slotTechs(detail),
    slotCount: detail.slotCount,
  };
  const speed = researchSpeedPct(detail);
  return WW_TECH_IDS.filter((id) => WW_TECHS[id].branch === branch).map(
    (id) => {
      const def = WW_TECHS[id];
      const days = techDays(def.year);
      const ahead = aheadPct(def.year, day);
      const perDay = researchProgress(speed, ahead);
      const slot = detail.slots.find((s) => s?.tech === id) ?? null;
      const left =
        slot === null
          ? days * 1000
          : Math.max(0, slot.totalMilli - slot.progressMilli);
      const block = researchBlockOf(state, id);
      return {
        id,
        year: def.year,
        days,
        etaDays: perDay > 0 ? Math.ceil(left / perDay) : 0,
        ahead,
        state: cardState(block),
        block,
        school: def.school ?? null,
      };
    },
  );
}

export interface SlotRow {
  index: number;
  tech: WwTechId | null;
  /** 0..1 */
  progress: number;
  daysLeft: number;
  ahead: number;
  /** Past the slot count (spec §9.1): paused, its progress kept. */
  paused: boolean;
}

/** The slot row (spec §13.4): each slot's tech, progress, days left and penalty. */
export function researchSlots(detail: WwCountryDetail, day: number): SlotRow[] {
  const speed = researchSpeedPct(detail);
  const n = Math.max(detail.slotCount, detail.slots.length);
  return Array.from({ length: n }, (_, index) => {
    const s = detail.slots[index] ?? null;
    const paused = index >= detail.slotCount;
    if (s === null) {
      return { index, tech: null, progress: 0, daysLeft: 0, ahead: 0, paused };
    }
    const ahead = aheadPct(WW_TECHS[s.tech].year, day);
    const perDay = researchProgress(speed, ahead);
    return {
      index,
      tech: s.tech,
      progress: s.totalMilli > 0 ? s.progressMilli / s.totalMilli : 0,
      daysLeft:
        perDay > 0
          ? Math.ceil(Math.max(0, s.totalMilli - s.progressMilli) / perDay)
          : 0,
      ahead,
      paused,
    };
  }).filter((s) => !s.paused || s.tech !== null);
}

// ---- Laws (spec §5, §13.3 tab 4) ----

export interface LawStep {
  value: LawValue;
  current: boolean;
  /** Its condition holds today (WwLaws.lawConditionMet). */
  allowed: boolean;
  /** Days until the kind may change again; 0 when it may. */
  cooldownDays: number;
  /** lawBlockOf: null when a tap sets it. */
  block: WwOrderBlock | null;
}

/** `warDays`: the live one (liveWarDays), as the engine's lawBlock reads it. */
export function lawLadder(
  detail: WwCountryDetail,
  kind: LawKind,
  day: number,
  warDays = detail.warDays,
): LawStep[] {
  const ctx = { day, warDays };
  const cooldownDays = Math.max(0, detail.lawCooldownUntil[kind] - day);
  return LAW_LADDERS[kind].map((value) => ({
    value,
    current: detail.laws[kind] === value,
    allowed: lawConditionMet(value, ctx),
    cooldownDays,
    block: lawBlockOf(detail.laws, detail.lawCooldownUntil, kind, value, ctx),
  }));
}

/**
 * Whether setting the law would close deals at the next daily check
 * (Trade.validateTrades): a trade law whose export share falls below what
 * I sell, or an economy law whose consumer goods leave fewer civilian
 * factories than my deals pay. Such a change takes two taps.
 */
export function lawClosesDeals(
  detail: WwCountryDetail,
  summary: WwCountrySummary,
  kind: LawKind,
  value: LawValue,
): boolean {
  if (kind === "trade") {
    const pct = lawEffects({
      ...detail.laws,
      trade: value as TradeLaw,
    }).exportPct;
    return RESOURCE_IDS.some((id, r) => {
      let sold = 0;
      for (const t of detail.selling) {
        if (t.resource === id) sold += t.civs * WW_TRADE_UNITS_PER_CIV;
      }
      return sold > exportCapacity(detail.resources[r]?.produced ?? 0, pct);
    });
  }
  if (kind === "economy") {
    const pct = lawEffects({
      ...detail.laws,
      economy: value as EconomyLaw,
    }).consumerGoodsPct;
    const cg = consumerGoodsMilli(summary.civ, summary.mil, pct);
    return paidCivsOf(detail) > payableCivs(summary.civ, cg);
  }
  return false;
}

/** A locked step's reason: its condition, the wait, or the block. */
export function lawStepReason(step: LawStep): string | null {
  if (step.current || step.block === null) return null;
  if (!step.allowed) {
    const need = LAW_NEED_KEYS[step.value];
    if (need !== undefined) return translateText(need);
  }
  if (step.block === "law_cooldown") {
    return translateText("ww1936.econ.cooldown", { n: step.cooldownDays });
  }
  return blockText(step.block);
}

// ---- The dials (spec §13.2) ----

export interface IndustryDial {
  /** The first queue entry's progress, 0..1. */
  progress: number;
  /** Military factories without a line. */
  idle: number;
  queued: number;
}

export function industryDial(
  detail: WwCountryDetail,
  summary: WwCountrySummary | null,
): IndustryDial {
  const first = detail.queue[0];
  return {
    progress:
      first === undefined || first.costMilli <= 0
        ? 0
        : first.progressMilli / first.costMilli,
    idle: summary === null ? 0 : idleMilOf(summary, detail),
    queued: detail.queue.length,
  };
}

/**
 * Military factories without a line. The engine's daily trim
 * (Production.stepProduction: the lines, top first, take what is left)
 * leaves exactly `mil − the factories the lines ask for`. Counted from the
 * lines it is right at once — in the preparation minute, before the
 * engine's first day, and right after a line order — while the summary's
 * `idleMil` only moves on the country's next day (it is 0 until day 0).
 */
export function idleMilOf(
  summary: WwCountrySummary,
  detail: WwCountryDetail,
): number {
  let asked = 0;
  for (const l of detail.lines) asked += l.factories;
  return Math.max(0, summary.mil - asked);
}

export interface ResearchDialModel {
  /** The furthest slot's progress, 0..1. */
  progress: number;
  /** Empty slots within the slot count. */
  free: number;
  running: number;
}

export function researchDial(detail: WwCountryDetail): ResearchDialModel {
  let progress = 0;
  let free = 0;
  let running = 0;
  for (let i = 0; i < detail.slotCount; i++) {
    const s = detail.slots[i] ?? null;
    if (s === null) {
      free++;
      continue;
    }
    running++;
    if (s.totalMilli > 0) {
      progress = Math.max(progress, s.progressMilli / s.totalMilli);
    }
  }
  return { progress, free, running };
}

// ---- The region card (spec §13.5) ----

export interface RegionCard {
  id: number;
  cat: RegionCategory;
  civ: number;
  mil: number;
  dock: number;
  slots: number;
  infra: number;
  /** Population, people. */
  pop: number;
  /** Deposits (at infrastructure 5), only those it has. */
  res: { id: ResourceId; amount: number }[];
  occupied: boolean;
  /** I control it and can queue there. */
  mine: boolean;
}

export function regionCard(game: WwEconGame, tile: TileRef): RegionCard | null {
  const scenario = game.worldWarScenario();
  const view = game.wwEconomy?.() ?? null;
  if (scenario === null || view === null) return null;
  const id = scenario.regionAt(tile);
  const r = scenario.region(id);
  if (r === undefined) return null;
  const now = view.region(id);
  const owner = scenario.ownerByRegion()[id];
  const me = game.myPlayer()?.smallID() ?? 0;
  return {
    id,
    cat: r.cat,
    civ: now.civ,
    mil: now.mil,
    dock: now.dock,
    slots: regionSlots(r.cat, slotPctOf(view.detail(now.controller))),
    infra: now.infra,
    pop: r.pop * 1000,
    res: RESOURCE_IDS.flatMap((rid, i) =>
      r.res[i] > 0 ? [{ id: rid, amount: r.res[i] }] : [],
    ),
    occupied: regionShares(
      now.controller,
      owner,
      r.core,
      fightingFn(game)(owner),
    ).occupied,
    mine: me !== 0 && now.controller === me && view.detail(me) !== null,
  };
}

/** "25.0M": a region's population. */
export function populationText(people: number): string {
  return renderNumber(people);
}
