import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
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
  LawKind,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  TRADE_LAWS,
  WW_DAY_SPLIT,
  WW_TECH_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwCombatStats,
  WwCountryDetail,
  WwCountrySummary,
  WwEconomyData,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
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
  infEquipmentFor,
  recruitableMen,
  regionSlots,
  researchSlotCount,
  trainCap,
  troopCapOf,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  startArmy,
  startLaws,
  startStock,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
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
import { applyCombatLosses, updateCombatStats } from "./Combat";
import { stepConstruction } from "./Construction";
import { stepManpower, stepRecruit } from "./Manpower";
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
  troopCap: number;
  trainCap: number;
  recruited: number;
  attackPct: number;
  defensePct: number;
  speedPct: number;
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
    troopCap: 0,
    trainCap: 0,
    recruited: 0,
    attackPct: 0,
    defensePct: 0,
    speedPct: 0,
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
  fieldInfUnits = 0;
  fieldInfGenSum = 0;
  /** Combat losses since the last daily step, milli-men (noteCombatLoss). */
  lossMilli = 0;
  /**
   * Men lost in combat since 1936 (spec §6.5): gone from the recruitable
   * pool for good, so the manpower ceiling does not refill as they die.
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
  troopCap: zInt(),
  trainCap: zInt(),
  recruited: zInt(),
  attackPct: zInt(),
  defensePct: zInt(),
  speedPct: zInt(),
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
  fieldInfUnits: zInt(),
  fieldInfGenSum: zInt(),
  lossMilli: zInt(),
  casualties: zInt(),
  stock: z.array(zInt()),
  lines: z.array(LineSchema),
  nextLineId: zInt(),
  queue: z.array(ProjectSchema),
  slots: z.array(
    z.object({ tech: z.enum(WW_TECH_IDS), progress: zInt() }).nullable(),
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
  /** smallID controlling each land region (the owner of its VP tile); 0: nobody. */
  readonly controller: Uint16Array;
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
    this.controller = new Uint16Array(size);
    const owners = scenario.ownerByRegion();
    for (const r of regions) {
      this.civ[r.id] = r.civ;
      this.mil[r.id] = r.mil;
      this.dock[r.id] = r.dock;
      this.infra[r.id] = r.infra;
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

  /** Spec §11: techs, army, stock, manpower, first totals. WorldWar.start calls it once. */
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
      const recruitable = this.recruitableWith(
        ce.smallID,
        ce.law().conscriptionPermille,
      );
      const army = startArmy(ce.tag, recruitable);
      ce.stock = startStock(ce.tag, army, civ, mil);
      ce.fieldInfUnits = infEquipmentFor(army);
      ce.fieldInfGenSum = ce.fieldInfUnits;
      ce.manpower = Math.max(0, recruitable - army);
      p.setTroops(army);
      this.refreshTotals(ce, 0, 0);
      // No line yet: every military factory idles (stepProduction's count).
      ce.totals.idleMil = ce.totals.mil;
      // Every slot exists from the start, so day 0 brings no "new slot".
      ce.slots = new Array<null>(ce.totals.slotCount).fill(null);
      ce.totals.troopCap = troopCapOf(
        this.armyMen(p),
        ce.manpower,
        ce.infStock(),
      );
      updateCombatStats(this, ce, p);
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
    applyCombatLosses(this, ce, p);
    stepRecruit(this, ce, p);
    updateCombatStats(this, ce, p);
    // Its turn every WW_AI_PERIOD_DAYS days, and between turns what fell
    // free (aiEconomyTick decides which).
    if (p.type() === PlayerType.Nation) aiEconomyTick(this, ce, p, day, tick);
    this.dirtyCountries.add(id);
  }

  /** Spec §4.4–§4.5: controllers from VP tiles, foreign projects dropped. */
  private refreshControl(): void {
    let changed = false;
    for (const r of this.scenario.landRegions) {
      const owner = this.mg.owner(this.scenario.vpTile(r));
      const c = owner.isPlayer() ? owner.smallID() : 0;
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
    for (const id of this.regionsOf(ce.smallID)) {
      const r = this.scenario.region(id)!;
      const owner = this.scenario.ownerByRegion()[id] ?? 0;
      if (owner !== lastOwner) {
        lastOwner = owner;
        lastFights = this.ownerFights(owner);
      }
      const sh = regionShares(
        this.controller[id] ?? 0,
        owner,
        r.core,
        lastFights,
      );
      const cp = sh.controlPct;
      civ += Math.floor((this.civ[id] * cp) / 100);
      mil += Math.floor((this.mil[id] * cp) / 100);
      dock += Math.floor((this.dock[id] * cp) / 100);
      recruitable += recruitableMen(
        r.pop,
        sh.manpowerPct,
        law.conscriptionPermille,
        ce.tech.recruitablePct,
      );
      for (let k = 0; k < RESOURCE_COUNT; k++) {
        if (r.res[k] === 0) continue;
        produced[k] += extraction(
          r.res[k],
          this.infra[id],
          cp,
          ce.tech.extractionPct,
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
        imported[tr.res] += tr.civs * WW_TRADE_UNITS_PER_CIV;
      }
      if (tr.seller === ce.smallID) {
        received += tr.civs;
        exported[tr.res] += tr.civs * WW_TRADE_UNITS_PER_CIV;
      }
    }
    t.civ = civ;
    t.mil = mil;
    t.dock = dock;
    // The dead are gone from the pool for good (spec §6.5): those of past
    // days and those not yet counted (applyCombatLosses runs after the
    // manpower step), so the ceiling recruitable − army never refills as
    // men die.
    t.recruitable = Math.max(
      0,
      recruitable - ce.casualties - Math.floor(ce.lossMilli / 1000),
    );
    t.produced = produced;
    t.exported = exported;
    t.imported = imported;
    t.cgMilli = consumerGoodsMilli(civ, mil, law.consumerGoodsPct);
    t.paidCivs = paid;
    t.receivedCivs = received;
    t.freeCivMilli = freeCivMilli(civ, t.cgMilli, paid, received);
    t.trainCap = trainCap(t.recruitable, ce.tech.trainPct);
    t.slotCount = researchSlotCount(ce.major, civ + mil);
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
    const bonus = ce === null ? 0 : ce.tech.recruitablePct;
    let n = 0;
    for (const id of this.regionsOf(smallID)) {
      n += recruitableMen(
        this.scenario.region(id)!.pop,
        this.manpowerPct(id),
        permille,
        bonus,
      );
    }
    return n;
  }

  /**
   * The whole army of `p` in men (P1 spec §6): troops at home, in its
   * running attacks and on its transport ships. Manpower caps and combat
   * losses count this, not p.troops() alone.
   */
  armyMen(p: Player): number {
    let n = Math.floor(p.troops());
    for (const a of p.outgoingAttacks()) n += Math.floor(a.troops());
    for (const u of p.units(UnitType.TransportShip))
      n += Math.floor(u.troops());
    return n;
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
    const owner = this.scenario.ownerByRegion()[region] ?? 0;
    return regionShares(
      this.controller[region] ?? 0,
      owner,
      this.scenario.region(region)?.core ?? true,
      this.ownerFights(owner),
    );
  }

  /** The 1936 owner of a region is alive and has not capitulated. */
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

  addBuilding(region: number, b: BuildingId, n: number): void {
    const arr = this[b];
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

  /** AttackExecution: men lost in combat (plan decision 12). */
  noteCombatLoss(smallID: number, men: number): void {
    const ce = this.country(smallID);
    if (ce !== null && men > 0) ce.lossMilli += Math.floor(men * 1000);
  }

  troopCap(smallID: number): number | null {
    const ce = this.country(smallID);
    return ce === null ? null : ce.totals.troopCap;
  }

  combatStats(smallID: number): WwCombatStats {
    const t = this.country(smallID)?.totals;
    return t === undefined
      ? { attackPct: 0, defensePct: 0, speedPct: 0 }
      : {
          attackPct: t.attackPct,
          defensePct: t.defensePct,
          speedPct: t.speedPct,
        };
  }

  // ---- Screens (spec §14.4) ----

  /** The countries and regions that changed since the last call, or null. */
  takeData(): WwEconomyData | null {
    if (this.dirtyCountries.size === 0 && this.dirtyRegions.size === 0) {
      return null;
    }
    const data: WwEconomyData = { countries: [], details: [], regions: [] };
    for (const id of [...this.dirtyCountries].sort((a, b) => a - b)) {
      const ce = this.country(id);
      const p = this.mg.playerBySmallID(id);
      if (ce === null || !p.isPlayer()) continue;
      data.countries.push(this.summary(ce));
      if (p.type() === PlayerType.Human) data.details.push(this.detail(ce));
    }
    for (const id of [...this.dirtyRegions].sort((a, b) => a - b)) {
      data.regions.push({
        id,
        controller: this.controller[id],
        civ: this.civ[id],
        mil: this.mil[id],
        dock: this.dock[id],
        infra: this.infra[id],
      });
    }
    this.dirtyCountries.clear();
    this.dirtyRegions.clear();
    return data;
  }

  private summary(ce: CountryEconomy): WwCountrySummary {
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
      troopCap: t.troopCap,
      researchedCount: ce.researched.size,
      shortage: ce.lines.some((l) => l.active > 0 && l.fill < 1000),
      combat: this.combatStats(ce.smallID),
      exportRoom: RESOURCE_IDS.map((_, k) =>
        Math.max(0, exportRoomOf(t.produced[k], exportPct, sold[k])),
      ),
      slotPct: ce.tech.slotPct,
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
      fieldInfUnits: ce.fieldInfUnits,
      trainCap: t.trainCap,
      recruited: t.recruited,
      effCapBp: effCapBp(ce.tech),
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
      h = (Math.imul(h, 31) + ce.totals.troopCap) | 0;
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
      h = (Math.imul(h, 31) + ce.fieldInfUnits) | 0;
      h = (Math.imul(h, 31) + ce.casualties) | 0;
    }
    for (const r of this.scenario.landRegions) {
      const id = r.id;
      h =
        (Math.imul(h, 31) +
          this.civ[id] * 7 +
          this.mil[id] * 3 +
          this.dock[id] * 5 +
          this.infra[id] +
          this.controller[id] * 11) |
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
        fieldInfUnits: ce.fieldInfUnits,
        fieldInfGenSum: ce.fieldInfGenSum,
        lossMilli: ce.lossMilli,
        casualties: ce.casualties,
        stock: [...ce.stock],
        lines: ce.lines.map((l) => ({ ...l })),
        nextLineId: ce.nextLineId,
        queue: ce.queue.map((q) => ({ ...q })),
        slots: ce.slots.map((s) =>
          s === null ? null : { tech: s.tech, progress: s.progress },
        ),
        researched: WW_TECH_IDS.filter((id) => ce.researched.has(id)),
        totals: copyTotals(ce.totals),
      })),
      civ: Array.from(this.civ),
      mil: Array.from(this.mil),
      dock: Array.from(this.dock),
      infra: Array.from(this.infra),
      controller: Array.from(this.controller),
      trades: this._trades.map((t) => ({ ...t })),
      nextTradeId: this.nextTradeId,
      lastCommonDay: this.lastCommonDay,
    };
  }

  restoreState(s: WwEconomyState): void {
    for (const c of s.countries) {
      const ce = this.countryList[c.smallID]!;
      ce.laws = { ...c.laws };
      ce.lawCooldownUntil = { ...c.lawCooldownUntil };
      ce.manpower = c.manpower;
      ce.fieldInfUnits = c.fieldInfUnits;
      ce.fieldInfGenSum = c.fieldInfGenSum;
      ce.lossMilli = c.lossMilli;
      ce.casualties = c.casualties;
      ce.stock = [...c.stock];
      ce.lines = c.lines.map((l) => ({ ...l }));
      ce.nextLineId = c.nextLineId;
      ce.queue = c.queue.map((q) => ({ ...q }));
      ce.slots = c.slots.map((x) =>
        x === null ? null : { tech: x.tech, progress: x.progress },
      );
      ce.researched = new Set(c.researched);
      ce.totals = copyTotals(c.totals);
    }
    this.civ.set(s.civ);
    this.mil.set(s.mil);
    this.dock.set(s.dock);
    this.infra.set(s.infra);
    this.controller.set(s.controller);
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
