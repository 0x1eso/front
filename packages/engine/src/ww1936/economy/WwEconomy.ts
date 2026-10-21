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
  tradeUnitsPerCiv,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  startArmy,
  startLaws,
  startStock,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
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
import { stepConstruction } from "./Construction";
import { stepManpower } from "./Manpower";
import { stepProduction } from "./Production";
import { stepResearch } from "./ResearchRun";
import { tradePartners, validateTrades } from "./Trade";

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
  civs: number;
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
    }),
  ),
  nextTradeId: zInt(),
  lastCommonDay: zInt(),
  /** P3 resource effect (spec §10.4): written only when not all 0. */
  resBonus: z.array(zInt()).optional(),
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
  private _trades: Trade[] = [];
  private nextTradeId = 1;
  private lastCommonDay = -1;
  // Derived (DERIVED_FIELDS), rebuilt by rebuildDerived().
  private regionsByCountry: number[][] = [];
  private neighbourLists: number[][] = [];
  private seaZoneSets: Set<number>[] = [];
  private dirtyCountries = new Set<number>();
  private dirtyRegions = new Set<number>();

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
    const owners = scenario.ownerByRegion();
    for (const r of regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
      this.fort[r.id] = scenario.startFort(r.id);
      this.rail[r.id] = scenario.startRail(r.id);
      this.controller[r.id] = owners[r.id];
    }
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
      const recruitable = this.recruitableWith(
        ce.smallID,
        ce.law().conscriptionPermille,
      );
      const army = startArmy(ce.tag, recruitable);
      ce.stock = startStock(ce.tag, army, civ, mil);
      // P2 spec §6.4: the 1936 army's rifles go to the stock; land.start
      // fields the divisions from it and from the whole pool.
      ce.stock[equipKey("infantry_equipment", 1)] += Math.ceil(
        army / WW_MEN_PER_INF_EQUIPMENT,
      );
      ce.manpower = recruitable;
      this.refreshTotals(ce, 0, 0);
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
    stepConstruction(this, ce, p);
    stepResearch(this, ce, p, day);
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
      civ += Math.floor((this.civ[id] * cp) / 100);
      mil += Math.floor((this.mil[id] * cp) / 100);
      dock += Math.floor((this.dock[id] * cp) / 100);
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
          this.infra[id],
          cp,
          ce.stats.extractionPct,
        );
      }
    }
    const exported = zeros();
    const imported = zeros();
    let paid = 0;
    let received = 0;
    for (const tr of this._trades) {
      if (tr.buyer === ce.smallID) {
        paid += tr.civs;
        // P3 spec §3.2 tradeCostPct: the buyer's units per factory.
        imported[tr.res] += tr.civs * tradeUnitsPerCiv(ce.stats);
      }
      if (tr.seller === ce.smallID) {
        received += tr.civs;
        exported[tr.res] += tr.civs * WW_TRADE_UNITS_PER_CIV;
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
    this.dirtyRegions.add(region);
  }

  trades(): readonly Trade[] {
    return this._trades;
  }

  addTrade(buyer: number, seller: number, res: number, civs: number): Trade {
    const tr = { id: this.nextTradeId++, buyer, seller, res, civs };
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

  countrySeaZones(smallID: number): ReadonlySet<number> {
    return this.seaZoneSets[smallID] ?? new Set();
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
      });
    }
    this.dirtyCountries.clear();
    this.dirtyRegions.clear();
    return data;
  }

  private summary(ce: CountryEconomy, fieldMen: number): WwCountrySummary {
    const t = ce.totals;
    const exportPct = ce.law().exportPct;
    // Live (exportRoom: the open deals and the law now, not the last day's
    // totals), so a screen never offers a deal openTrade refuses, the
    // preparation minute's included.
    const sold = zeros();
    for (const tr of this._trades) {
      if (tr.seller === ce.smallID)
        sold[tr.res] += tr.civs * WW_TRADE_UNITS_PER_CIV;
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
      h = (Math.imul(h, 31) + tr.id + tr.civs * 13) | 0;
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
    const g = countryGraph(
      this.scenario,
      this.controller,
      this.countryList.length,
    );
    this.regionsByCountry = g.regionsByCountry;
    this.neighbourLists = g.neighbours;
    this.seaZoneSets = g.seaZones;
    for (const ce of this.countries()) ce.tech = techTotals(ce.researched);
  }
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
