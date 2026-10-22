import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BUILDING_COST,
  BUILDING_IDS,
  BuildingId,
  CONSCRIPTION_LAWS,
  CountryLaws,
  ECONOMY_LAWS,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  equipKey,
  LawKind,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  TRADE_LAWS,
  WW_DAY_SPLIT,
  WW_MAX_SLOTS,
  WW_MEN_PER_INF_EQUIPMENT,
  WW_TECH_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwCountryDetail,
  WwCountrySummary,
  WwEconomyData,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayIndex, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  countryGraph,
  exportRoomOf,
  RegionShares,
  regionShares,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  consumerGoodsMilli,
  effCapBp,
  extraction,
  freeCivMilli,
  recruitableMen,
  regionSlots,
  researchSlotCount,
  tradeUnitsBought,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  navalStartTechs,
  REFINERY_START,
  SILO_START,
  splitStartPlanes,
  startArmy,
  startLaws,
  startStock,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import {
  fuelCap,
  fuelGain,
  startFuelMilli,
} from "@openfront/engine-lib/ww1936/FuelRules";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  resolveRegionName,
  START_PLANES,
  startNavyOf,
} from "@openfront/engine-lib/ww1936/StartNavy";
import { techStats } from "@openfront/engine-lib/ww1936/Stats";
import { LawEffects, lawEffects } from "@openfront/engine-lib/ww1936/WwLaws";
import {
  techDays,
  TechTotals,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { z } from "zod";
import type { Game, Player } from "../../game/Game";
import type { WorldWar } from "../WorldWar";
import { aiEconomyTick, aiStartSetup } from "./AiEconomy";
import { addConvoys, buildingIndex, effectiveBuildings } from "./Buildings";
import { stepConstruction } from "./Construction";
import { fuelCapOf, settleFuel, syntheticOilOf } from "./Fuel";
import { stepManpower } from "./Manpower";
import { stepNavalLines } from "./NavalLines";
import { stepProduction } from "./Production";
import { repairCostMilli, stepRepairs } from "./Repairs";
import { stepResearch } from "./ResearchRun";
import { tradeDelivery, tradePartners, validateTrades } from "./Trade";

export interface Line {
  id: number;
  /** EQUIP_KEYS index. */
  key: number;
  /** Factories the player asked for. */
  factories: number;
  /** Factories that worked on the last day (≤ factories). */
  active: number;
  effBp: number;
  progress: number;
  fill: number;
  lastOutput: number;
}

/** P4 plan decision 12: the buildings P4 adds, kept by building id. */
type P4BuildingId =
  | "naval_base"
  | "air_base"
  | "anti_air"
  | "radar"
  | "coastal_fort"
  | "synthetic_refinery"
  | "fuel_silo";

/** P4 spec §5.2: a naval line on dockyards (lane E runs it; the foundation holds it). */
export interface NavalLine {
  id: number;
  /** SHIP_CLASSES index, or SHIP_CLASSES.length for "convoy". */
  cls: number;
  gen: number;
  /** Dockyards asked for (1..15) and the ones that worked on the last day. */
  docks: number;
  activeDocks: number;
  /** Industry milli on the next unit. */
  progress: number;
  /** Units left; 0 = keep going (convoys). */
  left: number;
  /** Launch port region. */
  port: number;
  /** Resource fill ‰ (the allocation's, P1 §7.3 after the P1 lines). */
  fill: number;
  lastOutput: number;
  /**
   * The nameIdx the next launches take, first first (a 1936 line's
   * historical names); empty: the country's next free name.
   */
  names: number[];
}

export interface Project {
  region: number;
  building: BuildingId;
  count: number;
  progress: number;
  lastAssigned: number;
  lastSpeedPct: number;
}

export interface Slot {
  tech: WwTechId;
  progress: number;
  /**
   * P3 spec §10.4: a research bonus taken when the tech started, until it
   * ends; absent when none.
   */
  bonusPct?: number;
}

export interface Trade {
  id: number;
  buyer: number;
  seller: number;
  /** RESOURCE_IDS index. */
  res: number;
  /** Civilian factories the buyer pays: dealCivsOf(units). */
  civs: number;
  /**
   * Units a day the seller gives (P4 Task 15: the last factory may buy
   * fewer than 8, so a small seller can sell at all).
   */
  units: number;
}

/** The last daily step's results; state, because others read them between days. */
export interface Totals {
  civ: number;
  mil: number;
  dock: number;
  idleMil: number;
  recruitable: number;
  produced: number[];
  exported: number[];
  imported: number[];
  used: number[];
  cgMilli: number;
  paidCivs: number;
  receivedCivs: number;
  freeCivMilli: number;
  slotCount: number;
  warDays: number;
}

const zeros = () => new Array<number>(RESOURCE_COUNT).fill(0);
const RUBBER = RESOURCE_IDS.indexOf("rubber");

function emptyTotals(): Totals {
  return {
    civ: 0,
    mil: 0,
    dock: 0,
    idleMil: 0,
    recruitable: 0,
    produced: zeros(),
    exported: zeros(),
    imported: zeros(),
    used: zeros(),
    cgMilli: 0,
    paidCivs: 0,
    receivedCivs: 0,
    freeCivMilli: 0,
    slotCount: 0,
    warDays: -1,
  };
}

/** One country's economy (spec §14.1). */
export class CountryEconomy {
  laws: CountryLaws;
  lawCooldownUntil: Record<LawKind, number> = {
    economy: -1,
    trade: -1,
    conscription: -1,
  };
  manpower = 0;
  /**
   * Men dead in combat since 1936 (spec §6.5; P2: WwLand.noteCasualties):
   * gone from the recruitable pool for good, so the manpower ceiling does
   * not refill as they die.
   */
  casualties = 0;
  stock: number[] = new Array<number>(EQUIP_KEY_COUNT).fill(0);
  lines: Line[] = [];
  nextLineId = 1;
  queue: Project[] = [];
  slots: (Slot | null)[] = [];
  /** In WW_TECH_IDS order; add with addTech. */
  researched = new Set<WwTechId>();
  totals: Totals = emptyTotals();
  /** Derived from researched (rebuilt on restore; equal after it). */
  tech: TechTotals = techTotals(new Set());
  /**
   * P3 (plan decision 9): every modifier. WwPolitics points this at its
   * CountryPol.stats (the same object, state there); alone (P1 pure
   * tests) it is the tech totals. Read it, never ce.tech, for a modifier.
   */
  stats: WwStats = techStats(this.tech);
  /** P3: WwPolitics.recomputeStats; called when a tech is added. */
  onTechChanged: ((id: number) => void) | null = null;
  /** Derived (DERIVED_FIELDS): bumped when `stats` change, for the land war's caches. */
  statsVer = 0;
  // ---- P4 (plan decisions 20, 22; Task 1 Step 19) ----
  /** Fuel milli, its ratio ‰ of yesterday's need, the ledger of today's use. */
  fuelMilli = 0;
  fuelRatioPm = 1000;
  fuelLedgerMilli = 0;
  /** The ledger by kind (land, navy, air), milli; Σ = fuelLedgerMilli (lane E: settleFuel moves it to fuelUseMilli). */
  fuelLedgerKinds: [number, number, number] = [0, 0, 0];
  /** Yesterday's gain and use (land, navy, air), milli: the screens. */
  fuelGainMilli = 0;
  fuelUseMilli: [number, number, number] = [0, 0, 0];
  /** The day of the last shortage message (one in 30 days). */
  fuelShortDay = -1000;
  navalLines: NavalLine[] = [];
  nextNavalLineId = 1;
  /** Dockyards lent to repairs today (spec §5.4). */
  docksLent = 0;
  /** EQUIP_KEYS order: planes out on deployments and carrier decks (drawPlanes / returnPlanes / losses). */
  planesDeployed: number[] = new Array<number>(EQUIP_KEY_COUNT).fill(0);

  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
    readonly major: boolean,
    laws: CountryLaws,
  ) {
    this.laws = { ...laws };
  }

  /**
   * Marks a tech researched. Always through here: the set stays in
   * WW_TECH_IDS order, as a restore builds it, so iterating it never
   * depends on when each tech was finished.
   */
  addTech(id: WwTechId): void {
    if (this.researched.has(id)) return;
    this.researched.add(id);
    this.researched = new Set(
      WW_TECH_IDS.filter((t) => this.researched.has(t)),
    );
    this.tech = techTotals(this.researched);
    if (this.onTechChanged === null) this.stats = techStats(this.tech);
    else this.onTechChanged(this.smallID);
  }

  /** Infantry equipment in stock, every generation. */
  infStock(): number {
    let n = 0;
    EQUIP_KEYS.forEach(([t], i) => {
      if (t === "infantry_equipment") n += this.stock[i];
    });
    return n;
  }

  law(): LawEffects {
    return lawEffects(this.laws);
  }
}

// ---- Snapshot schema ----

const LineSchema = z.object({
  id: zInt(),
  key: zInt(),
  factories: zInt(),
  active: zInt(),
  effBp: zInt(),
  progress: zInt(),
  fill: zInt(),
  lastOutput: zInt(),
});
const ProjectSchema = z.object({
  region: zInt(),
  building: z.enum(BUILDING_IDS),
  count: zInt(),
  progress: zInt(),
  lastAssigned: zInt(),
  lastSpeedPct: zInt(),
});
const NavalLineSchema = z.object({
  id: zInt(),
  cls: zInt(),
  gen: zInt(),
  docks: zInt(),
  activeDocks: zInt(),
  progress: zInt(),
  left: zInt(),
  port: zInt(),
  fill: zInt(),
  lastOutput: zInt(),
  names: z.array(zInt()),
});
const TotalsSchema = z.object({
  civ: zInt(),
  mil: zInt(),
  dock: zInt(),
  idleMil: zInt(),
  recruitable: zInt(),
  produced: z.array(zInt()),
  exported: z.array(zInt()),
  imported: z.array(zInt()),
  used: z.array(zInt()),
  cgMilli: zInt(),
  paidCivs: zInt(),
  receivedCivs: zInt(),
  freeCivMilli: zInt(),
  slotCount: zInt(),
  warDays: zInt(),
});
const CountrySchema = z.object({
  smallID: zInt(),
  laws: z.object({
    economy: z.enum(ECONOMY_LAWS),
    trade: z.enum(TRADE_LAWS),
    conscription: z.enum(CONSCRIPTION_LAWS),
  }),
  lawCooldownUntil: z.object({
    economy: zInt(),
    trade: zInt(),
    conscription: zInt(),
  }),
  manpower: zInt(),
  casualties: zInt(),
  stock: z.array(zInt()),
  lines: z.array(LineSchema),
  nextLineId: zInt(),
  queue: z.array(ProjectSchema),
  slots: z.array(
    z
      .object({
        tech: z.enum(WW_TECH_IDS),
        progress: zInt(),
        /** P3: written only when the slot has one. */
        bonusPct: zInt().optional(),
      })
      .nullable(),
  ),
  researched: z.array(z.enum(WW_TECH_IDS)),
  totals: TotalsSchema,
  // P4 (Task 1 Step 19).
  fuelMilli: zInt(),
  fuelRatioPm: zInt(),
  fuelLedgerMilli: zInt(),
  fuelLedgerKinds: z.tuple([zInt(), zInt(), zInt()]),
  fuelGainMilli: zInt(),
  fuelUseMilli: z.tuple([zInt(), zInt(), zInt()]),
  fuelShortDay: zInt(),
  navalLines: z.array(NavalLineSchema),
  nextNavalLineId: zInt(),
  docksLent: zInt(),
  planesDeployed: z.array(zInt()),
});
export const WwEconomyStateSchema = z.object({
  countries: z.array(CountrySchema),
  civ: z.array(zInt()),
  mil: z.array(zInt()),
  dock: z.array(zInt()),
  infra: z.array(zInt()),
  /** P2 level buildings (plan decision 10). */
  fort: z.array(zInt()),
  rail: z.array(zInt()),
  hub: z.array(zInt()),
  controller: z.array(zInt()),
  trades: z.array(
    z.object({
      id: zInt(),
      buyer: zInt(),
      seller: zInt(),
      res: zInt(),
      civs: zInt(),
      units: zInt(),
    }),
  ),
  nextTradeId: zInt(),
  lastCommonDay: zInt(),
  /** P3 resource effect (spec §10.4): written only when not all 0. */
  resBonus: z.array(zInt()).optional(),
  // P4 buildings (plan decisions 12, 13): by building id, then the bomb
  // damage and repair progress (region × BUILDING_IDS.length, milli).
  naval_base: z.array(zInt()),
  air_base: z.array(zInt()),
  anti_air: z.array(zInt()),
  radar: z.array(zInt()),
  coastal_fort: z.array(zInt()),
  synthetic_refinery: z.array(zInt()),
  fuel_silo: z.array(zInt()),
  damage: z.array(zInt()),
  repair: z.array(zInt()),
});
export type WwEconomyState = z.infer<typeof WwEconomyStateSchema>;

/**
 * World War 1936 P1 economy (spec §2–§14): per-country industry, research,
 * manpower and trade, and the buildings of every land region. Lives in
 * WorldWar; ticks from WorldWarExecution.
 */
export class WwEconomy {
  private countryList: (CountryEconomy | null)[];
  readonly civ: Uint8Array;
  readonly mil: Uint8Array;
  readonly dock: Uint8Array;
  readonly infra: Uint8Array;
  /** P2 level buildings: land fort, railway, supply hub (plan decision 10). */
  readonly fort: Uint8Array;
  readonly rail: Uint8Array;
  readonly hub: Uint8Array;
  /**
   * smallID controlling each land region, 0: nobody — a daily copy of
   * WwLand.controller (P2 plan decision 9; the VP tile's owner by invariant).
   */
  readonly controller: Uint16Array;
  /**
   * P3 spec §10.4 `resource`: deposits added to each land region for good,
   * [region × RESOURCE_COUNT + resource] (state).
   */
  readonly resBonus: Int16Array;
  /** P4 buildings (plan decision 12), by building id: read them with buildingArray(b). */
  private readonly p4Levels: Record<P4BuildingId, Uint8Array>;
  /** P4 bomb damage and repair progress, [region × BUILDING_IDS.length + building], milli (plan decision 13). */
  readonly damage: Int32Array;
  readonly repair: Int32Array;
  /**
   * P4 (pre-flight D): infrastructure less the whole buildings bombed out,
   * by region; P2's supply and movement read it. Rebuilt from infra and
   * damage, so equal after a restore.
   */
  readonly infraEff: Uint8Array;
  /** Derived (DERIVED_FIELDS): bumped when a region's naval base starts or stops working (navalPort). */
  portVer = 0;
  /**
   * Derived (DERIVED_FIELDS): bumped when a railway or naval-base level or
   * its damage changes (afterBuildingChange) and at every rebuildDerived —
   * Task 15's caches of what those levels decide (SeaSupply's side nets)
   * key on it.
   */
  railPortVer = 0;
  /** Derived (DERIVED_FIELDS): bumped at every building change (afterBuildingChange). */
  buildVer = 0;
  /** Derived (DERIVED_FIELDS): bumped when the country graph is rebuilt (rebuildDerived). */
  graphVer = 0;
  private _trades: Trade[] = [];
  private nextTradeId = 1;
  private lastCommonDay = -1;
  // Derived (DERIVED_FIELDS), rebuilt by rebuildDerived().
  private regionsByCountry: number[][] = [];
  private neighbourLists: number[][] = [];
  private dirtyCountries = new Set<number>();
  private dirtyRegions = new Set<number>();
  /** P4 (derived): 1 where the naval base works now (afterBuildingChange's portVer). */
  private portBits = new Uint8Array(0);

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
    readonly scenario: ScenarioIndex,
  ) {
    const regions = scenario.landRegions;
    const size =
      (regions.length === 0 ? 0 : regions[regions.length - 1].id) + 1;
    this.civ = new Uint8Array(size);
    this.mil = new Uint8Array(size);
    this.dock = new Uint8Array(size);
    this.infra = new Uint8Array(size);
    this.fort = new Uint8Array(size);
    this.rail = new Uint8Array(size);
    this.hub = new Uint8Array(size);
    this.controller = new Uint16Array(size);
    this.resBonus = new Int16Array(size * RESOURCE_COUNT);
    this.p4Levels = {
      naval_base: new Uint8Array(size),
      air_base: new Uint8Array(size),
      anti_air: new Uint8Array(size),
      radar: new Uint8Array(size),
      coastal_fort: new Uint8Array(size),
      synthetic_refinery: new Uint8Array(size),
      fuel_silo: new Uint8Array(size),
    };
    this.damage = new Int32Array(size * BUILDING_IDS.length);
    this.repair = new Int32Array(size * BUILDING_IDS.length);
    this.infraEff = new Uint8Array(size);
    const owners = scenario.ownerByRegion();
    for (const r of regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
      this.fort[r.id] = scenario.startFort(r.id);
      this.rail[r.id] = scenario.startRail(r.id);
      this.controller[r.id] = owners[r.id];
      // P4 spec §6.4, §12.1: the v4 start levels (or plan decision 6's formulas).
      this.p4Levels.naval_base[r.id] = scenario.startNavalBase(r.id);
      this.p4Levels.air_base[r.id] = scenario.startAirBase(r.id);
      this.p4Levels.anti_air[r.id] = scenario.startAa(r.id);
      this.p4Levels.coastal_fort[r.id] = scenario.startCoastalFort(r.id);
    }
    // Spec §12.1, §15.2 (the historical order of battle only): Germany's
    // synthetic fuel plants, Japan's fuel silos.
    if (scenario.data.historicalOob === true) {
      for (const [table, b] of [
        [REFINERY_START, "synthetic_refinery"],
        [SILO_START, "fuel_silo"],
      ] as const) {
        for (const [tag, rows] of Object.entries(table)) {
          if (scenario.smallIdOf(tag as CountryTag) === 0) continue;
          for (const [name, n] of rows ?? []) {
            const r = resolveRegionName(scenario, name);
            this.p4Levels[b][r] += n;
            // The screens start from scenario.json: tell them.
            this.dirtyRegions.add(r);
          }
        }
      }
    }
    for (const r of regions) this.infraEff[r.id] = this.infra[r.id];
    this.portBits = new Uint8Array(size);
    this.countryList = [null];
    scenario.countries.forEach((tag, i) => {
      this.countryList.push(
        new CountryEconomy(i + 1, tag, COUNTRIES[tag].major, startLaws(tag)),
      );
    });
    this.rebuildDerived();
  }

  /**
   * Spec §11: techs, stock, manpower, first totals. WorldWar.start calls it
   * once, before land.start fields the 1936 army from the pool and stock.
   */
  start(): void {
    for (const ce of this.countries()) {
      const p = this.mg.playerBySmallID(ce.smallID);
      if (!p.isPlayer()) continue;
      let civ = 0;
      let mil = 0;
      for (const id of this.regionsOf(ce.smallID)) {
        civ += this.civ[id];
        mil += this.mil[id];
      }
      for (const t of startTechs(ce.tag, civ)) ce.addTech(t);
      // P2 spec §4.6: the land techs too, before anyone plans research.
      const dev = this.scenario.devOf(ce.tag, civ);
      for (const t of landStartTechs(ce.tag, ce.major, dev)) ce.addTech(t);
      // P4 spec §4.3, §12.3: the navy and air techs.
      const coastal = this.regionsOf(ce.smallID).some(
        (r) => this.scenario.harborOf(r) !== 0,
      );
      for (const t of navalStartTechs(ce.tag, dev, coastal)) ce.addTech(t);
      const recruitable = this.recruitableWith(
        ce.smallID,
        ce.law().conscriptionPermille,
      );
      const army = startArmy(ce.tag, recruitable);
      ce.stock = startStock(ce.tag, army, civ, mil);
      // P4 (plan decision 31): the historical order of battle splits the
      // fighters and bombers (spec §12.4) and has the hand convoys; else a
      // coast gives (civilian + military) × 5 convoys.
      const historical = this.scenario.data.historicalOob === true;
      if (historical) splitStartPlanes(ce.stock, START_PLANES[ce.tag]);
      const hand = historical ? startNavyOf(ce.tag)?.convoys : undefined;
      addConvoys(ce, hand ?? (coastal ? (civ + mil) * 5 : 0));
      // P2 spec §6.4: the 1936 army's rifles go to the stock; land.start
      // fields the divisions from it and from the whole pool.
      ce.stock[equipKey("infantry_equipment", 1)] += Math.ceil(
        army / WW_MEN_PER_INF_EQUIPMENT,
      );
      ce.manpower = recruitable;
      this.refreshTotals(ce, 0, 0);
      // P4 spec §15.2: 90 days of gain within the capacity (Japan, with
      // its silos, full: the historical order of battle).
      const oil = ce.totals.produced[0];
      const cap = fuelCap(
        oil,
        this.countryBuildings(ce.smallID, "fuel_silo"),
        ce.stats,
      );
      ce.fuelMilli =
        historical && ce.tag === "JPN"
          ? cap
          : startFuelMilli(fuelGain(oil, ce.stats), cap);
      // No line yet: every military factory idles (stepProduction's count).
      ce.totals.idleMil = ce.totals.mil;
      // Every slot exists from the start, so day 0 brings no "new slot".
      ce.slots = new Array<null>(ce.totals.slotCount).fill(null);
      this.dirtyCountries.add(ce.smallID);
    }
    // HOI4's 1936 start: every country, a human one too, opens with its
    // production lines and its research slots filled (the AI's day-0 plan
    // for both); a human changes any of it in the preparation minute.
    for (const ce of this.countries()) {
      if (!this.mg.playerBySmallID(ce.smallID).isPlayer()) continue;
      aiStartSetup(this, ce);
      let lined = 0;
      for (const l of ce.lines) lined += l.factories;
      ce.totals.idleMil = Math.max(0, ce.totals.mil - lined);
    }
  }

  // ---- Clock (spec §2) ----

  tick(ticks: number): void {
    if (this.ww.inPrep(ticks)) return;
    const day = this.ww.day(ticks);
    if (day !== this.lastCommonDay) {
      this.lastCommonDay = day;
      this.refreshControl();
      validateTrades(this, ticks);
    }
    const k = ticks - dayStartTick(day, this.ww.prepEndTick());
    if (k < 0 || k >= WW_DAY_SPLIT) return;
    for (let id = 1; id < this.countryList.length; id++) {
      if (id % WW_DAY_SPLIT === k) this.stepCountry(id, day, ticks);
    }
  }

  private stepCountry(id: number, day: number, tick: number): void {
    const ce = this.countryList[id];
    if (ce === null || ce === undefined) return;
    const p = this.mg.playerBySmallID(id);
    if (!p.isPlayer() || !p.isAlive() || this.ww.isCapitulated(id)) return;
    this.refreshTotals(ce, day, tick);
    stepManpower(this, ce, p);
    stepProduction(this, ce);
    // P4 spec §16.1: naval lines and repairs before construction, fuel after research.
    stepNavalLines(this, ce, day);
    stepRepairs(this, ce, day);
    stepConstruction(this, ce, p);
    stepResearch(this, ce, p, day);
    settleFuel(this, ce, day);
    // Its turn every WW_AI_PERIOD_DAYS days, and between turns what fell
    // free (aiEconomyTick decides which).
    if (p.type() === PlayerType.Nation) aiEconomyTick(this, ce, p, day, tick);
    this.dirtyCountries.add(id);
  }

  /**
   * Spec §4.4–§4.5: the controllers from the land war's (P2 plan decision
   * 9: the same as the VP tiles' owners), foreign projects dropped.
   */
  private refreshControl(): void {
    let changed = false;
    for (const r of this.scenario.landRegions) {
      const c = this.ww.land.controller[r.id];
      if (c === this.controller[r.id]) continue;
      this.controller[r.id] = c;
      changed = true;
      this.dirtyRegions.add(r.id);
      for (const ce of this.countries()) {
        if (ce.smallID === c) continue;
        const kept = ce.queue.filter((q) => q.region !== r.id);
        if (kept.length !== ce.queue.length) {
          ce.queue = kept;
          this.dirtyCountries.add(ce.smallID);
        }
      }
    }
    if (changed) this.rebuildDerived();
  }

  /** Sums of the controlled regions, trades, laws (spec §4.3, §6.2, §7). */
  refreshTotals(ce: CountryEconomy, day: number, tick: number): void {
    const t = ce.totals;
    const law = ce.law();
    let civ = 0;
    let mil = 0;
    let dock = 0;
    let recruitable = 0;
    const produced = zeros();
    // Most regions belong to one owner: ask whether it still fights once.
    let lastOwner = -1;
    let lastFights = false;
    const pol = this.ww.politics;
    for (const id of this.regionsOf(ce.smallID)) {
      const r = this.scenario.region(id)!;
      // P3 spec §17.1: the legal owner, not the 1936 one.
      const owner = pol.legalOwner[id] ?? 0;
      if (owner !== lastOwner) {
        lastOwner = owner;
        lastFights = this.ownerFights(owner);
      }
      const sh = regionShares(
        this.controller[id] ?? 0,
        owner,
        pol.isCore(id),
        lastFights,
      );
      const cp = sh.controlPct;
      // P4 plan decision 13: bombed-out buildings do not work.
      civ += Math.floor((effectiveBuildings(this, id, "civ") * cp) / 100);
      mil += Math.floor((effectiveBuildings(this, id, "mil") * cp) / 100);
      dock += Math.floor((effectiveBuildings(this, id, "dock") * cp) / 100);
      recruitable += recruitableMen(
        r.pop,
        this.withNonCore(sh.manpowerPct, ce),
        law.conscriptionPermille,
        ce.stats.recruitablePct,
      );
      for (let k = 0; k < RESOURCE_COUNT; k++) {
        const deposit = r.res[k] + this.resBonus[id * RESOURCE_COUNT + k];
        if (deposit <= 0) continue;
        produced[k] += extraction(
          deposit,
          this.infraEff[id],
          cp,
          ce.stats.extractionPct,
        );
      }
      // P4 spec §15.5: synthetic oil after the infrastructure factor; P4
      // Task 15 (HOI4: the synthetic refinery's rubber, Buna): as much
      // rubber again — Germany's planes and trucks had none at war.
      const synth = syntheticOilOf(this, ce, id, cp);
      produced[0] += synth;
      produced[RUBBER] += synth;
    }
    const exported = zeros();
    const imported = zeros();
    let paid = 0;
    let received = 0;
    // P4 spec §10.2 (lane C): a sea deal delivers by its convoys.
    const deliver = tradeDelivery(this, ce.smallID);
    for (const tr of this._trades) {
      if (tr.buyer === ce.smallID) {
        paid += tr.civs;
        // P3 spec §3.2 tradeCostPct: the buyer's units per factory.
        imported[tr.res] += deliver(tr, tradeUnitsBought(tr.units, ce.stats));
      }
      if (tr.seller === ce.smallID) {
        received += tr.civs;
        exported[tr.res] += tr.units;
      }
    }
    t.civ = civ;
    t.mil = mil;
    t.dock = dock;
    // The dead are gone from the pool for good (spec §6.5), so the
    // ceiling recruitable − army never refills as men die.
    t.recruitable = Math.max(0, recruitable - ce.casualties);
    t.produced = produced;
    t.exported = exported;
    t.imported = imported;
    // P3 spec §3.3: consumer goods with consumerGoodsPp, 0..50%.
    const cgPct = Math.max(
      0,
      Math.min(50, law.consumerGoodsPct + ce.stats.consumerGoodsPp),
    );
    t.cgMilli = consumerGoodsMilli(civ, mil, cgPct);
    t.paidCivs = paid;
    t.receivedCivs = received;
    t.freeCivMilli = freeCivMilli(civ, t.cgMilli, paid, received);
    // Factories give at most 5 slots; P3's research_slot effect the sixth.
    t.slotCount = Math.min(
      WW_MAX_SLOTS,
      researchSlotCount(ce.major, civ + mil) +
        (pol.country(ce.smallID)?.extraResearchSlots ?? 0),
    );
    t.warDays = this.warDays(ce.smallID, tick);
    void day;
  }

  /**
   * Men the controlled regions give under a conscription law (‰), before
   * the casualties (refreshTotals takes those off; a law change moves
   * manpower by the difference, which they do not change).
   */
  recruitableWith(smallID: number, permille: number): number {
    const ce = this.country(smallID);
    const bonus = ce === null ? 0 : ce.stats.recruitablePct;
    let n = 0;
    for (const id of this.regionsOf(smallID)) {
      const pct = this.manpowerPct(id);
      n += recruitableMen(
        this.scenario.region(id)!.pop,
        ce === null ? pct : this.withNonCore(pct, ce),
        permille,
        bonus,
      );
    }
    return n;
  }

  /** P3 spec §3.2: nonCoreManpowerPp adds to the 10% share of non-core land only. */
  private withNonCore(manpowerPct: number, ce: CountryEconomy): number {
    return manpowerPct === 10
      ? Math.max(0, 10 + ce.stats.nonCoreManpowerPp)
      : manpowerPct;
  }

  /**
   * The whole army of `p` in men (P2 spec §13.2): its field divisions and
   * the men in training. The manpower ceiling counts this.
   */
  armyMen(p: Player): number {
    return this.ww.land.armyMen(p.smallID());
  }

  /** Days of the longest war `smallID` is in now; -1 at peace. */
  warDays(smallID: number, tick: number): number {
    const since = this.ww.earliestWarTick(smallID);
    if (since === null) return -1;
    return this.ww.day(tick) - dayIndex(since, this.ww.prepEndTick());
  }

  // ---- Queries for the lanes ----

  country(smallID: number): CountryEconomy | null {
    return this.countryList[smallID] ?? null;
  }

  countries(): CountryEconomy[] {
    return this.countryList.filter((c): c is CountryEconomy => c !== null);
  }

  day(): number {
    return this.ww.day(this.mg.ticks());
  }

  regionsOf(smallID: number): readonly number[] {
    return this.regionsByCountry[smallID] ?? [];
  }

  controllerOf(region: number): number {
    return this.controller[region] ?? 0;
  }

  /** Spec §4.4: what a land region gives its controller now (regionShares). */
  shares(region: number): RegionShares {
    // P3 spec §17.1: the legal owner and its core (P1's "1936 owner").
    const pol = this.ww.politics;
    const owner = pol.legalOwner[region] ?? 0;
    return regionShares(
      this.controller[region] ?? 0,
      owner,
      pol.isCore(region),
      this.ownerFights(owner),
    );
  }

  /** The legal owner of a region is alive and has not capitulated. */
  private ownerFights(owner: number): boolean {
    const o = this.mg.playerBySmallID(owner);
    return o.isPlayer() && o.isAlive() && !this.ww.isCapitulated(owner);
  }

  /** Spec §4.4: someone else holds it and its 1936 owner still fights. */
  isOccupied(region: number): boolean {
    return this.shares(region).occupied;
  }

  controlPct(region: number): number {
    return this.shares(region).controlPct;
  }

  manpowerPct(region: number): number {
    return this.shares(region).manpowerPct;
  }

  regionSlots(region: number, slotPct: number): number {
    const r = this.scenario.region(region);
    return r === undefined ? 0 : regionSlots(r.cat, slotPct);
  }

  /** The per-region array of a building (P2 plan decision 10). */
  buildingArray(b: BuildingId): Uint8Array {
    switch (b) {
      case "civ":
        return this.civ;
      case "mil":
        return this.mil;
      case "dock":
        return this.dock;
      case "infra":
        return this.infra;
      case "fort":
        return this.fort;
      case "rail":
        return this.rail;
      case "supply_hub":
        return this.hub;
      case "naval_base":
      case "air_base":
      case "anti_air":
      case "radar":
      case "coastal_fort":
      case "synthetic_refinery":
      case "fuel_silo":
        return this.p4Levels[b];
    }
  }

  /** P4: the effective count of a building over the regions a country controls. */
  countryBuildings(smallID: number, b: BuildingId): number {
    let n = 0;
    for (const r of this.regionsOf(smallID))
      n += effectiveBuildings(this, r, b);
    return n;
  }

  /**
   * P4: after a building count or its damage changed in `region` — the
   * screens, the effective infrastructure (P2 supply and movement) and the
   * naval-port version (AiLand's port lists).
   */
  afterBuildingChange(region: number, b: BuildingId): void {
    this.dirtyRegions.add(region);
    this.buildVer++;
    if (b === "rail" || b === "naval_base") this.railPortVer++;
    if (b === "infra") {
      this.infraEff[region] = effectiveBuildings(this, region, "infra");
    }
    if (b === "naval_base") {
      const port = effectiveBuildings(this, region, "naval_base") >= 1;
      if (port !== (this.portBits[region] === 1)) {
        this.portBits[region] = port ? 1 : 0;
        this.portVer++;
      }
    }
  }

  /** A region's deposit of resource `k` (RESOURCE_IDS index) with the P3 bonus. */
  deposit(region: number, k: number): number {
    const r = this.scenario.region(region);
    if (r === undefined) return 0;
    return r.res[k] + this.resBonus[region * RESOURCE_COUNT + k];
  }

  /** A region's P3 deposit bonus, RESOURCE_IDS order; null when it has none. */
  resBonusOf(region: number): number[] | null {
    const at = region * RESOURCE_COUNT;
    let any = false;
    for (let k = 0; k < RESOURCE_COUNT; k++) {
      if (this.resBonus[at + k] !== 0) any = true;
    }
    return any
      ? Array.from(this.resBonus.subarray(at, at + RESOURCE_COUNT))
      : null;
  }

  /** A region's deposits with the P3 bonus, RESOURCE_IDS order. */
  deposits(region: number): readonly number[] {
    const res = this.scenario.region(region)?.res ?? [];
    const bonus = this.resBonusOf(region);
    return bonus === null ? res : res.map((v, k) => v + bonus[k]);
  }

  addBuilding(region: number, b: BuildingId, n: number): void {
    const arr = this.buildingArray(b);
    arr[region] = Math.max(0, arr[region] + n);
    // P4: damage never exceeds the buildings left (Buildings.damageBuilding's cap).
    const i = region * BUILDING_IDS.length + buildingIndex(b);
    if (this.damage[i] > arr[region] * 1000)
      this.damage[i] = arr[region] * 1000;
    this.afterBuildingChange(region, b);
  }

  trades(): readonly Trade[] {
    return this._trades;
  }

  addTrade(
    buyer: number,
    seller: number,
    res: number,
    civs: number,
    units = civs * WW_TRADE_UNITS_PER_CIV,
  ): Trade {
    const tr = { id: this.nextTradeId++, buyer, seller, res, civs, units };
    this._trades.push(tr);
    this.dirtyCountries.add(buyer);
    this.dirtyCountries.add(seller);
    return tr;
  }

  removeTrade(id: number): Trade | null {
    const i = this._trades.findIndex((t) => t.id === id);
    if (i < 0) return null;
    const [tr] = this._trades.splice(i, 1);
    this.dirtyCountries.add(tr.buyer);
    this.dirtyCountries.add(tr.seller);
    return tr;
  }

  /** Countries sharing a land border now (by region control), ascending. */
  countryNeighbours(smallID: number): readonly number[] {
    return this.neighbourLists[smallID] ?? [];
  }

  markCountryDirty(smallID: number): void {
    this.dirtyCountries.add(smallID);
  }

  markRegionDirty(region: number): void {
    this.dirtyRegions.add(region);
  }

  // ---- Screens (spec §14.4) ----

  /** The countries and regions that changed since the last call, or null. */
  takeData(): WwEconomyData | null {
    if (this.dirtyCountries.size === 0 && this.dirtyRegions.size === 0) {
      return null;
    }
    const data: WwEconomyData = { countries: [], details: [], regions: [] };
    // P2: the troop mirror's men, every country in one pass.
    const fieldMen =
      this.dirtyCountries.size === 0 ? [] : this.ww.land.fieldMenByCountry();
    for (const id of [...this.dirtyCountries].sort((a, b) => a - b)) {
      const ce = this.country(id);
      const p = this.mg.playerBySmallID(id);
      if (ce === null || !p.isPlayer()) continue;
      data.countries.push(this.summary(ce, fieldMen[id] ?? 0));
      if (p.type() === PlayerType.Human) data.details.push(this.detail(ce));
    }
    for (const id of [...this.dirtyRegions].sort((a, b) => a - b)) {
      // P3's resource effect: the deposit bonus, only when there is one.
      const res = this.resBonusOf(id);
      const at = id * BUILDING_IDS.length;
      const dmg = this.damage.subarray(at, at + BUILDING_IDS.length);
      const p = this.p4Levels;
      data.regions.push({
        id,
        controller: this.controller[id],
        civ: this.civ[id],
        mil: this.mil[id],
        dock: this.dock[id],
        infra: this.infra[id],
        fort: this.fort[id],
        rail: this.rail[id],
        hub: this.hub[id],
        ...(res === null ? {} : { res }),
        navalBase: p.naval_base[id],
        airBase: p.air_base[id],
        aa: p.anti_air[id],
        radar: p.radar[id],
        coastalFort: p.coastal_fort[id],
        refinery: p.synthetic_refinery[id],
        silo: p.fuel_silo[id],
        damage: dmg.some((v) => v !== 0) ? Array.from(dmg) : [],
        ...this.repairPmOf(id),
      });
    }
    this.dirtyCountries.clear();
    this.dirtyRegions.clear();
    return data;
  }

  /**
   * Lane U (the region card's "repairing N%"): the first damaged building's
   * repair progress, BUILDING_IDS order (stepRepairs mends in that order),
   * ‰ of its next whole building (1,000 of damage at most).
   */
  private repairPmOf(region: number): { repairPm?: number } {
    const n = BUILDING_IDS.length;
    for (let bi = 0; bi < n; bi++) {
      const i = region * n + bi;
      const dmg = this.damage[i];
      if (dmg <= 0) continue;
      const cost = repairCostMilli(BUILDING_IDS[bi], Math.min(1000, dmg));
      return {
        repairPm:
          cost <= 0
            ? 0
            : Math.min(1000, Math.floor((this.repair[i] * 1000) / cost)),
      };
    }
    return {};
  }

  private summary(ce: CountryEconomy, fieldMen: number): WwCountrySummary {
    const t = ce.totals;
    const exportPct = ce.law().exportPct;
    // Live (exportRoom: the open deals and the law now, not the last day's
    // totals), so a screen never offers a deal openTrade refuses, the
    // preparation minute's included.
    const sold = zeros();
    for (const tr of this._trades) {
      if (tr.seller === ce.smallID) sold[tr.res] += tr.units;
    }
    return {
      smallID: ce.smallID,
      civ: t.civ,
      mil: t.mil,
      dock: t.dock,
      idleMil: t.idleMil,
      freeCivMilli: t.freeCivMilli,
      manpower: ce.manpower,
      recruitable: t.recruitable,
      // P2: the men in the field (the troop mirror; replays read it).
      troopCap: fieldMen,
      researchedCount: ce.researched.size,
      shortage: ce.lines.some((l) => l.active > 0 && l.fill < 1000),
      exportRoom: RESOURCE_IDS.map((_, k) =>
        Math.max(0, exportRoomOf(t.produced[k], exportPct, sold[k])),
      ),
      slotPct: ce.stats.slotPct,
      fuelRatioPm: ce.fuelRatioPm,
    };
  }

  private detail(ce: CountryEconomy): WwCountryDetail {
    const t = ce.totals;
    const tradeData = (tr: Trade) => ({
      id: tr.id,
      buyer: tr.buyer,
      seller: tr.seller,
      resource: RESOURCE_IDS[tr.res],
      civs: tr.civs,
      units: tr.units,
    });
    return {
      smallID: ce.smallID,
      laws: { ...ce.laws },
      lawCooldownUntil: { ...ce.lawCooldownUntil },
      queue: ce.queue.map((q) => ({
        region: q.region,
        building: q.building,
        count: q.count,
        progressMilli: q.progress,
        costMilli: BUILDING_COST[q.building] * 1000,
        assignedMilli: q.lastAssigned,
        speedPct: q.lastSpeedPct,
      })),
      lines: ce.lines.map((l) => {
        const [equipment, gen] = EQUIP_KEYS[l.key];
        return {
          id: l.id,
          equipment,
          gen,
          factories: l.factories,
          active: l.active,
          effBp: l.effBp,
          progressMilli: l.progress,
          costMilli: unitCostMilli(equipment, gen),
          fill: l.fill,
          outputMilli: l.lastOutput,
        };
      }),
      slotCount: t.slotCount,
      slots: ce.slots.map((s) =>
        s === null
          ? null
          : {
              tech: s.tech,
              progressMilli: s.progress,
              totalMilli: techDays(WW_TECHS[s.tech].year) * 1000,
            },
      ),
      researched: WW_TECH_IDS.filter((id) => ce.researched.has(id)),
      buying: this._trades
        .filter((tr) => tr.buyer === ce.smallID)
        .map(tradeData),
      selling: this._trades
        .filter((tr) => tr.seller === ce.smallID)
        .map(tradeData),
      stock: [...ce.stock],
      resources: RESOURCE_IDS.map((_, k) => ({
        produced: t.produced[k],
        exported: t.exported[k],
        imported: t.imported[k],
        used: t.used[k],
      })),
      consumerGoodsMilli: t.cgMilli,
      paidCivs: t.paidCivs,
      receivedCivs: t.receivedCivs,
      effCapBp: effCapBp(ce.stats),
      warDays: t.warDays,
      tradePartners: tradePartners(this, ce.smallID),
      fuelMilli: ce.fuelMilli,
      fuelCapMilli: fuelCapOf(this, ce),
      fuelGainMilli: ce.fuelGainMilli,
      fuelUseMilli: [...ce.fuelUseMilli],
      refineries: this.countryBuildings(ce.smallID, "synthetic_refinery"),
    };
  }

  // ---- Snapshot, hash (spec §14.3) ----

  hash(): number {
    let h = 29;
    for (const ce of this.countries()) {
      let stock = 0;
      for (const n of ce.stock) stock = (stock + n) | 0;
      h = (Math.imul(h, 31) + ce.manpower) | 0;
      h = (Math.imul(h, 31) + stock) | 0;
      h = (Math.imul(h, 31) + ce.researched.size * 7 + ce.queue.length) | 0;
      // Laws, so a law desync shows the same tick (not a day later).
      h =
        (Math.imul(h, 31) +
          ECONOMY_LAWS.indexOf(ce.laws.economy) * 64 +
          TRADE_LAWS.indexOf(ce.laws.trade) * 8 +
          CONSCRIPTION_LAWS.indexOf(ce.laws.conscription)) |
        0;
      const cd = ce.lawCooldownUntil;
      h =
        (Math.imul(h, 31) + cd.economy * 5 + cd.trade * 3 + cd.conscription) |
        0;
      for (const l of ce.lines) {
        h = (Math.imul(h, 31) + l.effBp + l.factories) | 0;
        h = (Math.imul(h, 31) + l.progress + l.active * 7) | 0;
      }
      // Progress, so a desync in construction or research shows the same
      // day (not when a building or tech completes).
      for (const q of ce.queue) h = (Math.imul(h, 31) + q.progress) | 0;
      for (const sl of ce.slots) {
        h = (Math.imul(h, 31) + (sl === null ? -1 : sl.progress)) | 0;
      }
      h = (Math.imul(h, 31) + ce.casualties) | 0;
      // P4: fuel and the naval lines.
      h = (Math.imul(h, 31) + ce.fuelMilli) | 0;
      h = (Math.imul(h, 31) + ce.fuelRatioPm * 7 + ce.fuelLedgerMilli) | 0;
      for (const l of ce.navalLines) {
        h = (Math.imul(h, 31) + l.progress + l.activeDocks * 7 + l.left) | 0;
      }
    }
    for (const r of this.scenario.landRegions) {
      const id = r.id;
      let bonus = 0;
      for (let k = 0; k < RESOURCE_COUNT; k++) {
        bonus += this.resBonus[id * RESOURCE_COUNT + k] * (k + 1);
      }
      h =
        (Math.imul(h, 31) +
          this.civ[id] * 7 +
          this.mil[id] * 3 +
          this.dock[id] * 5 +
          this.infra[id] +
          this.controller[id] * 11 +
          this.fort[id] * 13 +
          this.rail[id] * 17 +
          this.hub[id] * 19 +
          bonus * 23) |
        0;
    }
    for (const tr of this._trades) {
      h = (Math.imul(h, 31) + tr.id + tr.civs * 13 + tr.units * 7) | 0;
    }
    // P4: the new buildings and the bomb damage, only where any is.
    for (const r of this.scenario.landRegions) {
      const id = r.id;
      const p = this.p4Levels;
      const v =
        p.naval_base[id] * 3 +
        p.air_base[id] * 5 +
        p.anti_air[id] * 7 +
        p.radar[id] * 11 +
        p.coastal_fort[id] * 13 +
        p.synthetic_refinery[id] * 17 +
        p.fuel_silo[id] * 19;
      if (v !== 0) h = (Math.imul(h, 31) + id + v) | 0;
    }
    for (let i = 0; i < this.damage.length; i++) {
      if (this.damage[i] !== 0 || this.repair[i] !== 0) {
        h = (Math.imul(h, 31) + i + this.damage[i] * 3 + this.repair[i]) | 0;
      }
    }
    return (Math.imul(h, 31) + this._trades.length) | 0;
  }

  snapshot(): WwEconomyState {
    return {
      countries: this.countries().map((ce) => ({
        smallID: ce.smallID,
        laws: {
          economy: ce.laws.economy,
          trade: ce.laws.trade,
          conscription: ce.laws.conscription,
        },
        lawCooldownUntil: {
          economy: ce.lawCooldownUntil.economy,
          trade: ce.lawCooldownUntil.trade,
          conscription: ce.lawCooldownUntil.conscription,
        },
        manpower: ce.manpower,
        casualties: ce.casualties,
        stock: [...ce.stock],
        lines: ce.lines.map((l) => ({ ...l })),
        nextLineId: ce.nextLineId,
        queue: ce.queue.map((q) => ({ ...q })),
        slots: ce.slots.map((s) =>
          s === null
            ? null
            : {
                tech: s.tech,
                progress: s.progress,
                ...(s.bonusPct === undefined ? {} : { bonusPct: s.bonusPct }),
              },
        ),
        researched: WW_TECH_IDS.filter((id) => ce.researched.has(id)),
        totals: copyTotals(ce.totals),
        fuelMilli: ce.fuelMilli,
        fuelRatioPm: ce.fuelRatioPm,
        fuelLedgerMilli: ce.fuelLedgerMilli,
        fuelLedgerKinds: [...ce.fuelLedgerKinds] as [number, number, number],
        fuelGainMilli: ce.fuelGainMilli,
        fuelUseMilli: [...ce.fuelUseMilli] as [number, number, number],
        fuelShortDay: ce.fuelShortDay,
        navalLines: ce.navalLines.map(copyNavalLine),
        nextNavalLineId: ce.nextNavalLineId,
        docksLent: ce.docksLent,
        planesDeployed: [...ce.planesDeployed],
      })),
      civ: Array.from(this.civ),
      mil: Array.from(this.mil),
      dock: Array.from(this.dock),
      infra: Array.from(this.infra),
      fort: Array.from(this.fort),
      rail: Array.from(this.rail),
      hub: Array.from(this.hub),
      controller: Array.from(this.controller),
      trades: this._trades.map((t) => ({ ...t })),
      nextTradeId: this.nextTradeId,
      lastCommonDay: this.lastCommonDay,
      ...(this.resBonus.some((v) => v !== 0)
        ? { resBonus: Array.from(this.resBonus) }
        : {}),
      naval_base: Array.from(this.p4Levels.naval_base),
      air_base: Array.from(this.p4Levels.air_base),
      anti_air: Array.from(this.p4Levels.anti_air),
      radar: Array.from(this.p4Levels.radar),
      coastal_fort: Array.from(this.p4Levels.coastal_fort),
      synthetic_refinery: Array.from(this.p4Levels.synthetic_refinery),
      fuel_silo: Array.from(this.p4Levels.fuel_silo),
      damage: Array.from(this.damage),
      repair: Array.from(this.repair),
    };
  }

  restoreState(s: WwEconomyState): void {
    for (const c of s.countries) {
      const ce = this.countryList[c.smallID]!;
      ce.laws = { ...c.laws };
      ce.lawCooldownUntil = { ...c.lawCooldownUntil };
      ce.manpower = c.manpower;
      ce.casualties = c.casualties;
      ce.stock = [...c.stock];
      ce.lines = c.lines.map((l) => ({ ...l }));
      ce.nextLineId = c.nextLineId;
      ce.queue = c.queue.map((q) => ({ ...q }));
      ce.slots = c.slots.map((x) =>
        x === null
          ? null
          : {
              tech: x.tech,
              progress: x.progress,
              ...(x.bonusPct === undefined ? {} : { bonusPct: x.bonusPct }),
            },
      );
      ce.researched = new Set(c.researched);
      ce.totals = copyTotals(c.totals);
      ce.fuelMilli = c.fuelMilli;
      ce.fuelRatioPm = c.fuelRatioPm;
      ce.fuelLedgerMilli = c.fuelLedgerMilli;
      ce.fuelLedgerKinds = [...c.fuelLedgerKinds] as [number, number, number];
      ce.fuelGainMilli = c.fuelGainMilli;
      ce.fuelUseMilli = [...c.fuelUseMilli] as [number, number, number];
      ce.fuelShortDay = c.fuelShortDay;
      ce.navalLines = c.navalLines.map(copyNavalLine);
      ce.nextNavalLineId = c.nextNavalLineId;
      ce.docksLent = c.docksLent;
      ce.planesDeployed = [...c.planesDeployed];
    }
    this.civ.set(s.civ);
    this.mil.set(s.mil);
    this.dock.set(s.dock);
    this.infra.set(s.infra);
    this.fort.set(s.fort);
    this.rail.set(s.rail);
    this.hub.set(s.hub);
    this.controller.set(s.controller);
    this.resBonus.fill(0);
    if (s.resBonus !== undefined) this.resBonus.set(s.resBonus);
    this.p4Levels.naval_base.set(s.naval_base);
    this.p4Levels.air_base.set(s.air_base);
    this.p4Levels.anti_air.set(s.anti_air);
    this.p4Levels.radar.set(s.radar);
    this.p4Levels.coastal_fort.set(s.coastal_fort);
    this.p4Levels.synthetic_refinery.set(s.synthetic_refinery);
    this.p4Levels.fuel_silo.set(s.fuel_silo);
    this.damage.set(s.damage);
    this.repair.set(s.repair);
    this._trades = s.trades.map((t) => ({ ...t }));
    this.nextTradeId = s.nextTradeId;
    this.lastCommonDay = s.lastCommonDay;
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet: every country and
    // every region (control and buildings) goes out on the next tick.
    for (const ce of this.countries()) this.dirtyCountries.add(ce.smallID);
    for (const r of this.scenario.landRegions) this.dirtyRegions.add(r.id);
  }

  /**
   * Region lists, country graph and sea zones (DERIVED_FIELDS), from the
   * controllers; and the tech sums from researched. The construction, a
   * restore and a day whose controllers changed call it.
   */
  private rebuildDerived(): void {
    this.railPortVer++;
    this.buildVer++;
    this.graphVer++;
    const g = countryGraph(
      this.scenario,
      this.controller,
      this.countryList.length,
    );
    this.regionsByCountry = g.regionsByCountry;
    this.neighbourLists = g.neighbours;
    for (const ce of this.countries()) ce.tech = techTotals(ce.researched);
    // P4: the effective infrastructure and naval-port bits from the levels and the damage.
    for (const r of this.scenario.landRegions) {
      this.infraEff[r.id] = effectiveBuildings(this, r.id, "infra");
      this.portBits[r.id] =
        effectiveBuildings(this, r.id, "naval_base") >= 1 ? 1 : 0;
    }
  }
}

function copyNavalLine(l: NavalLine): NavalLine {
  return { ...l, names: [...l.names] };
}

function copyTotals(t: Totals): Totals {
  return {
    ...t,
    produced: [...t.produced],
    exported: [...t.exported],
    imported: [...t.imported],
    used: [...t.used],
  };
}

export type { Player };
