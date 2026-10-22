// World War 1936 P6 lane U4 (plan Task 13, spec §20.4, §20.8, §20.9): the
// view models of the MIO, market, energy and special project tabs and the
// bomb preview. Pure reads of the views (WwDepthView, WwEconomyView, the
// air and land views); nothing here sends an order.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  ATOMIC_MILESTONES_PM,
  DesignDef,
  ENERGY_PER_COAL,
  ENERGY_PER_HYDRO,
  ENERGY_PER_PLANT,
  FACILITY_IDS,
  FacilityId,
  MARKET_DAYS,
  MIO_FAMILIES,
  MIO_FREE_TRAIT,
  MIO_INVEST_MILLI,
  MIO_TRAITS,
  NUKE_MIN_BOMBERS,
  ROCKET_RANGE_KM,
  SCIENTIST_SPECS,
  SPECIAL_PROJECTS,
  SpecialProject,
  WwDepthDetail,
  WwListingData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EquipmentType,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PARA_RANGE_KM } from "@openfront/engine-api/ww1936/LandTypes";
import { energySupply } from "@openfront/engine-lib/ww1936/EnergyRules";
import {
  marketCivs,
  marketDiscountPct,
} from "@openfront/engine-lib/ww1936/MarketRules";
import {
  mioNextMilli,
  mioPoints,
  mioTraitBlock,
} from "@openfront/engine-lib/ww1936/MioRules";
import { isNoStrike, strikeBlock } from "@openfront/engine-lib/ww1936/NoStrike";
import {
  nukeInterceptPm,
  nukeOutcome,
  PROJECT_DEFS,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import type { WwDepthView } from "../../view/WwDepthView";
import { airCtx, deployedHere, zoneCard } from "./AirModel";
import {
  equipmentName,
  genName,
  resourceRows,
  ResourceRowView,
} from "./EconomyModel";
import { fogModelOf } from "./FogModel";
import { today } from "./WorldWarModel";

// ---- names (keys: lane T's ww1936.mio.*, market.*, energy.*, project_ui.*) ----

// K5's content names (ww1936.mio_family / mio_arch / mio_trait / project / scientist).
export const mioFamilyKey = (family: number) =>
  `ww1936.mio_family.${MIO_FAMILIES[family]}`;
export const mioArchKey = (arch: number) =>
  `ww1936.mio_arch.${["state_arsenal", "private_combine", "design_bureau"][arch]}`;
export const mioTraitKey = (family: number, trait: number) =>
  `ww1936.mio_trait.${MIO_FAMILIES[family]}.${MIO_TRAITS[trait]}`;
export const projectKey = (p: SpecialProject) => `ww1936.project.${p}`;
export const scientistKey = (spec: number) =>
  `ww1936.scientist.${SCIENTIST_SPECS[spec]}`;

export const MIO_ICONS: readonly string[] = [
  "🪖",
  "💣",
  "🛡",
  "✈️",
  "🛩",
  "⚓",
];

/** The funds a size starts at (mioSize's inverse). */
const sizeFloorMilli = (size: number) => 300_000 * size * (size + 1);

// ---- MIO cards (spec §6, §20.8) ----

export interface MioCard {
  family: number;
  id: (typeof MIO_FAMILIES)[number];
  /** -1: no archetype picked yet. */
  arch: number;
  size: number;
  fundsMilli: number;
  /** Funds still missing for the next size, in whole funds ("1,240"); 0 at the top. */
  toNext: number;
  /** 0..1 progress between this size and the next. */
  fill: number;
  points: number;
  maxed: boolean;
  traits: number;
  investReady: boolean;
}

export type TraitState = "owned" | "buyable" | "locked" | "exclusive" | "free";

export interface TraitCell {
  trait: number;
  id: (typeof MIO_TRAITS)[number];
  col: number;
  row: number;
  state: TraitState;
  /** The refusal the engine would give, when not buyable. */
  block: "bad_index" | "prereq" | "no_slot" | null;
}

// ---- market (spec §7, §20.8) ----

export interface ListingRow {
  id: number;
  seller: number;
  key: number;
  type: EquipmentType | null;
  gen: number;
  design: DesignDef | null;
  count: number;
  priceMilli: number;
  own: boolean;
  /** The buyer may not buy: my own listing, or a seller who is not a trade partner. */
  blocked: "own" | "no_partner" | null;
}

export interface ListingFilter {
  mine?: boolean;
  type?: EquipmentType | null;
}

export interface BuyPreview {
  count: number;
  priceMilli: number;
  /** Civilian factories handed over for MARKET_DAYS days ("4 civilian factories × 30 days"). */
  factories: number;
  days: number;
  discountPct: number;
}

export interface DealRow {
  id: number;
  role: "buy" | "sell";
  partner: number;
  key: number;
  type: EquipmentType | null;
  gen: number;
  count: number;
  civs: number;
  paidPm: number;
  deliveredPm: number;
  daysLeft: number;
}

export interface LicenceRow {
  id: number;
  dir: "in" | "out";
  partner: number;
  key: number;
  type: EquipmentType | null;
  gen: number;
  ship: boolean;
}

export interface PendingLicenceRow {
  id: number;
  from: number;
  key: number;
  type: EquipmentType | null;
  gen: number;
  deadlineTick: number;
}

// ---- energy (spec §16) ----

export interface EnergyLine {
  ratioPm: number;
  pct: number;
  coalUnits: number;
  coalPower: number;
  hydroPower: number;
  plantPower: number;
  damPower: number;
  supply: number;
  demand: number;
  /** Below 100: the output and construction cut applies. */
  short: boolean;
}

// ---- projects (spec §9) ----

export interface ProjectCard {
  project: SpecialProject;
  state: "done" | "running" | "available" | "locked";
  facility: FacilityId;
  /** Region of the running project's facility, 0 when not running. */
  region: number;
  progressPm: number;
  daysLeft: number;
  inputPm: number;
  /** "Uranium 1.4/2" while running a uranium project. */
  uranium: { got: number; need: number } | null;
  /** The scientist: title only (spec §9.2, decisions.md). */
  scientist: {
    id: number;
    spec: number;
    skill: number;
    matches: boolean;
  } | null;
  /** Free facilities of the project's kind, regions. */
  facilities: number[];
  /** The three atomic bomb milestones reached (null for other projects). */
  milestones: boolean[] | null;
}

export interface ScientistChip {
  id: number;
  spec: number;
  skill: number;
  project: number;
}

// ---- the bomb ----

export interface StrikeTargetRow {
  region: number;
  /** The no-strike judge (Korea, Taiwan): shown grey, never offered. */
  noStrike: boolean;
}

export interface NukePreview {
  region: number;
  blocked: WwOrderBlock | null;
  factories: number;
  destroyed: number;
  stopped: number;
  divisions: number;
  interceptPm: number;
}

/** The enemy land regions among `regions` as targets: the no-strike judge greys its entries. */
export function strikeTargets(
  scenario: ScenarioIndex,
  regions: readonly number[],
  isEnemyRegion: (region: number) => boolean,
): StrikeTargetRow[] {
  const out: StrikeTargetRow[] = [];
  for (const r of regions) {
    if (!isEnemyRegion(r)) continue;
    out.push({ region: r, noStrike: isNoStrike(scenario, r) });
  }
  return out;
}

/** Only the regions an order would accept. */
export const offered = (rows: readonly StrikeTargetRow[]): number[] =>
  rows.filter((r) => !r.noStrike).map((r) => r.region);

export class DepthIndustryModel {
  constructor(readonly view: GameView) {}

  private depth(): WwDepthView | null {
    return this.view.wwDepth?.() ?? null;
  }

  private me(): number | null {
    return this.view.myPlayer()?.smallID() ?? null;
  }

  private detail(): WwDepthDetail | null {
    const me = this.me();
    const d = this.depth();
    return me === null || d === null ? null : (d.detail(me) ?? null);
  }

  // ---- MIO ----

  mioCards(): MioCard[] {
    const d = this.detail();
    if (d === null) return [];
    return MIO_FAMILIES.map((id, family): MioCard => {
      const arch = d.mio.arch[family] ?? -1;
      const size = d.mio.size[family] ?? 0;
      const fundsMilli = d.mio.fundsMilli[family] ?? 0;
      const next = mioNextMilli(size);
      const floor = sizeFloorMilli(size);
      return {
        family,
        id,
        arch,
        size,
        fundsMilli,
        toNext:
          next === 0 ? 0 : Math.max(0, Math.ceil((next - fundsMilli) / 1000)),
        fill:
          next === 0
            ? 1
            : Math.max(0, Math.min(1, (fundsMilli - floor) / (next - floor))),
        points: d.mio.points[family] ?? 0,
        maxed: next === 0,
        traits: d.mio.traits[family] ?? 0,
        investReady: (d.mio.investReady[family] ?? 0) > 0,
      };
    });
  }

  /** The 3 × 3 grid (columns p, q, s; rows 1..3): owned green, buyable glowing, exclusive crossed. */
  traitGrid(family: number): TraitCell[] {
    const card = this.mioCards()[family];
    if (card === undefined) return [];
    const free = card.arch < 0 ? -1 : MIO_FREE_TRAIT[card.arch];
    const cells: TraitCell[] = [];
    for (let trait = 0; trait < 9; trait++) {
      const owned = (card.traits & (1 << trait)) !== 0;
      const block = owned
        ? "bad_index"
        : card.arch < 0
          ? "prereq"
          : mioTraitBlock(card.traits, trait, card.points);
      // p3 and q3 exclude each other: the engine says "prereq" for both.
      const exclusive =
        !owned &&
        ((trait === 2 && (card.traits & (1 << 5)) !== 0) ||
          (trait === 5 && (card.traits & (1 << 2)) !== 0));
      const state: TraitState = owned
        ? trait === free
          ? "free"
          : "owned"
        : exclusive
          ? "exclusive"
          : block === null
            ? "buyable"
            : "locked";
      cells.push({
        trait,
        id: MIO_TRAITS[trait],
        col: Math.floor(trait / 3),
        row: trait % 3,
        state,
        block,
      });
    }
    return cells;
  }

  /** Points left on a card, from the pure rule (a cross-check of the engine's number). */
  pointsLeft(family: number): number {
    const c = this.mioCards()[family];
    return c === undefined || c.arch < 0
      ? 0
      : mioPoints(c.size, c.traits, c.arch);
  }

  /** [Invest 50] adds this many funds (whole). */
  investAmount(): number {
    return Math.floor(MIO_INVEST_MILLI / 1000);
  }

  // ---- market ----

  private keyRow(key: number): { type: EquipmentType | null; gen: number } {
    const k = EQUIP_KEYS[key];
    return k === undefined ? { type: null, gen: 0 } : { type: k[0], gen: k[1] };
  }

  /** "Light tank II" for a stock key, or the design's own name. */
  keyName(key: number, design: DesignDef | null = null): string {
    if (design !== null) return design.name;
    const { type, gen } = this.keyRow(key);
    return type === null ? "?" : `${equipmentName(type)} ${genName(gen)}`;
  }

  listings(filter: ListingFilter = {}): ListingRow[] {
    const dv = this.depth();
    const me = this.me();
    if (dv === null || me === null) return [];
    const partners = new Set(
      this.view.wwEconomy?.()?.detail(me)?.tradePartners ?? [],
    );
    return dv.marketData.listings
      .map((l: WwListingData): ListingRow => {
        const own = l.seller === me;
        return {
          id: l.id,
          seller: l.seller,
          key: l.key,
          ...this.keyRow(l.key),
          design: l.design,
          count: l.count,
          priceMilli: l.priceMilli,
          own,
          blocked: own ? "own" : partners.has(l.seller) ? null : "no_partner",
        };
      })
      .filter((r) => (filter.mine === true ? r.own : !r.own))
      .filter(
        (r) =>
          filter.type === undefined ||
          filter.type === null ||
          r.type === filter.type,
      )
      .sort((a, b) => a.priceMilli / a.count - b.priceMilli / b.count);
  }

  /** `count` of a listing costs this many civilian factories for 30 days (spec §7.2). */
  buyPreview(listing: ListingRow, count: number): BuyPreview {
    const n = Math.max(1, Math.min(listing.count, Math.floor(count)));
    const unit = listing.priceMilli / Math.max(1, listing.count);
    const priceMilli = Math.floor(unit * n);
    return {
      count: n,
      priceMilli,
      factories: marketCivs(priceMilli),
      days: MARKET_DAYS,
      discountPct: marketDiscountPct(0),
    };
  }

  dealRows(): DealRow[] {
    const dv = this.depth();
    const me = this.me();
    if (dv === null || me === null) return [];
    const day = today(this.view);
    return dv.marketData.deals
      .filter((x) => x.buyer === me || x.seller === me)
      .map(
        (x): DealRow => ({
          id: x.id,
          role: x.buyer === me ? "buy" : "sell",
          partner: x.buyer === me ? x.seller : x.buyer,
          key: x.key,
          ...this.keyRow(x.key),
          count: x.count,
          civs: x.civs,
          paidPm: x.paidPm,
          deliveredPm: x.deliveredPm,
          daysLeft: Math.max(0, x.endDay - day),
        }),
      );
  }

  /** Licences I hold ("in") and licences I granted ("out"); either side may end one. */
  licenceRows(): LicenceRow[] {
    const dv = this.depth();
    const me = this.me();
    if (dv === null || me === null) return [];
    const out: LicenceRow[] = [];
    for (const l of dv.marketData.licences) {
      if (l.to !== me && l.from !== me) continue;
      out.push({
        id: l.id,
        dir: l.to === me ? "in" : "out",
        partner: l.to === me ? l.from : l.to,
        key: l.key,
        ...this.keyRow(l.key),
        ship: l.ship,
      });
    }
    return out;
  }

  /** Requests to me waiting for my answer (a 20-second card each). */
  pendingLicences(): PendingLicenceRow[] {
    const dv = this.depth();
    const me = this.me();
    if (dv === null || me === null) return [];
    return dv.marketData.pendingLicences
      .filter((p) => p.to === me)
      .map((p) => ({
        id: p.id,
        from: p.from,
        deadlineTick: p.deadlineTick,
        key: p.key,
        ...this.keyRow(p.key),
      }));
  }

  /** The embargo list: [by, on] pairs that involve me. */
  embargoRows(): { by: number; on: number; byMe: boolean }[] {
    const dv = this.depth();
    const me = this.me();
    if (dv === null || me === null) return [];
    return dv.marketData.embargoes
      .filter(([a, b]) => a === me || b === me)
      .map(([by, on]) => ({ by, on, byMe: by === me }));
  }

  // ---- energy ----

  /** "⚡ Energy 92% (coal 18×3 + hydro 12 + plants 6 / demand 84)". */
  energyLine(): EnergyLine | null {
    const d = this.detail();
    if (d === null) return null;
    const e = d.energy;
    return {
      ratioPm: e.ratioPm,
      pct: Math.floor(e.ratioPm / 10),
      coalUnits: e.coal,
      coalPower: e.coal * ENERGY_PER_COAL,
      hydroPower: e.hydro * ENERGY_PER_HYDRO,
      plantPower: e.plants * ENERGY_PER_PLANT,
      damPower: e.dams,
      supply: energySupply(e.coal, e.hydro, e.plants, e.dams, 0),
      demand: e.demand,
      short: e.ratioPm < 1000,
    };
  }

  /** The coal and uranium rows of the resources tab. */
  resourceLines(): ResourceRowView[] {
    const me = this.me();
    const detail = me === null ? null : this.view.wwEconomy?.()?.detail(me);
    if (!detail) return [];
    return resourceRows(detail).filter(
      (r) => r.id === "coal" || r.id === "uranium",
    );
  }

  // ---- projects ----

  facilities(): { region: number; kind: FacilityId; busy: boolean }[] {
    const d = this.detail();
    if (d === null) return [];
    const busy = new Set(d.projects.running.map((r) => r.facility));
    return d.projects.facilities.map(([region, f]) => ({
      region,
      kind: FACILITY_IDS[f - 1] ?? "facility_science",
      busy: busy.has(region),
    }));
  }

  scientists(): ScientistChip[] {
    return (this.detail()?.projects.scientists ?? []).map((s) => ({
      id: s.id,
      spec: s.spec,
      skill: s.skill,
      project: s.project,
    }));
  }

  projectCards(): ProjectCard[] {
    const d = this.detail();
    if (d === null) return [];
    const me = this.me();
    const researched = new Set(
      (me === null ? null : this.view.wwEconomy?.()?.detail(me)?.researched) ??
        [],
    );
    const facilities = this.facilities();
    const stage = this.depth()?.summary(d.smallID)?.atomicStage ?? 0;
    return SPECIAL_PROJECTS.map((project, index): ProjectCard => {
      const def = PROJECT_DEFS[project];
      const run = d.projects.running.find((r) => r.project === project);
      const done = (d.projects.done & (1 << index)) !== 0;
      const afterOk =
        def.after === undefined ||
        (d.projects.done & (1 << SPECIAL_PROJECTS.indexOf(def.after))) !== 0;
      const techsOk = def.techs.every((t) => researched.has(t));
      const sci =
        run === undefined || run.scientist < 0
          ? undefined
          : d.projects.scientists.find((s) => s.id === run.scientist);
      return {
        project,
        state: done
          ? "done"
          : run !== undefined
            ? "running"
            : afterOk && techsOk
              ? "available"
              : "locked",
        facility: def.facility,
        region: run?.facility ?? 0,
        progressPm: done ? 1000 : (run?.progressPm ?? 0),
        daysLeft: run?.daysLeft ?? 0,
        inputPm: run?.inputPm ?? 1000,
        uranium:
          run !== undefined && def.uraniumDay > 0
            ? {
                got: Math.round((def.uraniumDay * run.inputPm) / 100) / 10,
                need: def.uraniumDay,
              }
            : null,
        scientist:
          sci === undefined
            ? null
            : {
                id: sci.id,
                spec: sci.spec,
                skill: sci.skill,
                matches: SCIENTIST_SPECS[sci.spec] === def.spec,
              },
        facilities: facilities
          .filter((f) => f.kind === def.facility && !f.busy)
          .map((f) => f.region),
        milestones:
          project === "sp_atomic"
            ? ATOMIC_MILESTONES_PM.map(
                (m, i) => done || (run?.progressPm ?? 0) >= m || stage > i,
              )
            : null,
      };
    });
  }

  // ---- the bomb ----

  private nukesOn(): boolean {
    const cfg = (
      this.view as unknown as {
        config?: () => { gameConfig?: () => { ww1936Nukes?: boolean } };
      }
    ).config?.();
    return cfg?.gameConfig?.().ww1936Nukes !== false;
  }

  /** The enemy land regions of an air zone: the bomb's and raid's candidates, no-strike ones flagged. */
  zoneTargets(sr: number): StrikeTargetRow[] {
    const c = airCtx(this.view);
    if (c === null) return [];
    const s = c.scenario.sr(sr);
    if (s === undefined || s.kind !== "land") return [];
    return strikeTargets(c.scenario, s.members, (r) => {
      const owner = c.economy.controller[r] ?? 0;
      return owner !== 0 && owner !== c.me && c.sides.isEnemy(c.me, owner);
    });
  }

  /** Why [Drop the bomb] is not offered over a zone, null when it is. */
  nukeStartBlock(sr: number): WwOrderBlock | null {
    const c = airCtx(this.view);
    if (c === null || this.detail() === null || !this.nukesOn()) {
      return "nuke_conditions";
    }
    if ((this.depth()?.summary(c.me)?.atomicStock ?? 0) <= 0) {
      return "nuke_conditions";
    }
    const bombers = (["bomber", "strat_bomber"] as AirType[]).reduce(
      (n, t) => n + deployedHere(c.air, c.me, sr, t, null),
      0,
    );
    if (bombers < NUKE_MIN_BOMBERS) return "nuke_conditions";
    return offered(this.zoneTargets(sr)).length === 0
      ? "no_strike_region"
      : null;
  }

  nukePreview(region: number): NukePreview | null {
    const c = airCtx(this.view);
    if (c === null) return null;
    const civ = c.economy.effectiveBuildings("civ", region);
    const mil = c.economy.effectiveBuildings("mil", region);
    const dock = c.economy.effectiveBuildings("dock", region);
    const before = (this.depth()?.worldData.nuked ?? []).filter(
      ([r]) => r === region,
    ).length;
    const o = nukeOutcome(civ, mil, dock, before);
    const destroyed = o.destroy.civ + o.destroy.mil + o.destroy.dock;
    const factories = civ + mil + dock;
    // Enemy divisions there as the fog shows them (U3, spec §8.9): hidden
    // armies count nothing, the others their shown count.
    const fog = fogModelOf(this.view);
    let divisions = 0;
    for (const a of c.land?.armiesAt(region) ?? []) {
      if (a.owner === c.me || !c.sides.isEnemy(c.me, a.owner)) continue;
      const fv = fog.armyView(a.id);
      if (fv.visible) divisions += fv.shown;
    }
    const sr = c.scenario.srOfZoneOrRegion(region);
    return {
      region,
      blocked: strikeBlock(c.scenario, region),
      factories,
      destroyed,
      stopped: Math.max(0, factories - destroyed),
      divisions,
      interceptPm: nukeInterceptPm(
        sr === 0 ? 0 : (zoneCard(c, sr)?.theirs ?? 0),
      ),
    };
  }

  // ---- rockets ----

  /** My rocket launch sites (regions with a site of level 1+). */
  rocketSites(): number[] {
    const c = airCtx(this.view);
    if (c === null) return [];
    return c.scenario.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          (c.economy.controller[r] ?? 0) === c.me &&
          c.economy.rocketSite[r] > 0,
      );
  }

  /** Enemy regions within a site's reach; the no-strike ones come flagged. */
  rocketTargets(site: number, kind: 0 | 1): StrikeTargetRow[] {
    const c = airCtx(this.view);
    if (c === null) return [];
    return strikeTargets(
      c.scenario,
      c.scenario.landRegions.map((r) => r.id),
      (r) => {
        const owner = c.economy.controller[r] ?? 0;
        return (
          owner !== 0 &&
          owner !== c.me &&
          c.sides.isEnemy(c.me, owner) &&
          c.scenario.regionKm(site, r) <= ROCKET_RANGE_KM[kind]
        );
      },
    );
  }

  /**
   * Enemy land regions a para (WW_PARA_RANGE_KM from the division) or commando
   * (coastal) raid may name; the no-strike judge greys Korea and Taiwan.
   */
  raidTargets(
    kind: "raid_para" | "raid_commando",
    from: number,
  ): StrikeTargetRow[] {
    const c = airCtx(this.view);
    if (c === null || from === 0) return [];
    return strikeTargets(
      c.scenario,
      c.scenario.landRegions.map((r) => r.id),
      (r) => {
        const owner = c.economy.controller[r] ?? 0;
        if (owner === 0 || owner === c.me || !c.sides.isEnemy(c.me, owner)) {
          return false;
        }
        return kind === "raid_para"
          ? c.scenario.regionKm(from, r) <= WW_PARA_RANGE_KM
          : c.scenario.region(r)?.coastal === true;
      },
    );
  }

  /** Flying bombs and ballistic rockets in stock. */
  rocketStock(): [number, number] {
    const me = this.me();
    const stock =
      me === null ? null : this.view.wwEconomy?.()?.detail(me)?.stock;
    if (!stock) return [0, 0];
    return [
      stock[equipKey("flying_bomb", 1)] ?? 0,
      stock[equipKey("ballistic_rocket", 1)] ?? 0,
    ];
  }
}

/** The energy line as one sentence, for the tab and the tests. */
export function energyLineText(e: EnergyLine): string {
  return translateText("ww1936.energy.line", {
    pct: e.pct,
    coal: e.coalUnits,
    hydro: e.hydroPower,
    plants: e.plantPower,
    demand: e.demand,
  });
}
