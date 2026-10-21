// World War 1936 P4: the air war's state (P4 spec §19.1): deployments, the
// per air zone results the other steps read the next day, the countries'
// tallies; the tick order (spec §2.2-7), the order dispatch, the screens'
// data, the snapshot and the hash. The lanes write the step functions
// (Task 1 Step 18's stubs).
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirDeploySummary,
  AirType,
  AirZoneData,
  CountryAirDetail,
  PlaneStats,
  WW_AIR_BASE_CAPACITY,
  WwAirData,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BUILDING_IDS,
  equipKey,
  EQUIPMENT_GENS,
  WW_DAY_SPLIT,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { z } from "zod";
import type { Game } from "../../game/Game";
import { buildingIndex, losePlanes, returnPlanes } from "../economy/Buildings";
import type { WwEconomy } from "../economy/WwEconomy";
import type { WwLand } from "../land/WwLand";
import { onPlanesLost } from "../navy/EndgameHooks";
import type { WwNavy } from "../navy/WwNavy";
import type { WorldWar } from "../WorldWar";
import { aiAir } from "./AiAir";
import { dailyAirZone } from "./AirCombat";
import { airMissionEffects, airSupplyAt } from "./AirEffects";
import { airMoveFactorFor, airPenaltyFor } from "./AirSuperiority";
import { dailyAirCountry, issueAirOrder } from "./Deploy";
import { paradropBlockFor, stepParadrops } from "./Paradrop";

export interface Deployment {
  id: number;
  owner: number;
  sr: number;
  /** AIR_TYPES index. */
  type: number;
  /** AIR_MISSIONS index. */
  mission: number;
  /** Planes per generation (decision 15). */
  counts: number[];
  /** Target count for this (owner, sr, type, mission) — the same on every record of the group. */
  target: number;
  /** Region of the base; −(ship id) for a carrier (spec §13.4). */
  base: number;
  /** Losses not yet taken, milli (spec §14.3). */
  lossRest: number;
  auto: boolean;
  /**
   * P5 (pre-flight §0-10): the country a volunteer wing flies for (its
   * side fights), 0 for the owner's own. A1/A2 take sides through
   * deploymentSide.
   */
  volunteerFor: number;
}

/** The side a deployment fights for: its volunteer host's, else its owner's (P5 volunteers). */
export function deploymentSide(air: WwAir, d: Deployment): number {
  return air.land.sideOf(d.volunteerFor !== 0 ? d.volunteerFor : d.owner);
}

/**
 * Per zone (srIdx): yesterday's results the other steps read (spec §2.2:
 * read a day late, so state). Maps keyed by side or country, in key order.
 */
export interface ZoneAirState {
  /** side → air superiority ‰. */
  sup: Map<number, number>;
  /** side → the worst enemy superiority over the zone ‰ (A1: the land war's penalty reads it). */
  enemySup: Map<number, number>;
  /** side → the battlefield-support bonus (supPenaltyPp) of the enemy holding that worst superiority (A1, spec §14.6). */
  enemyPp: Map<number, number>;
  /** side → the last day its ww1936_air_superiority alert went out for this zone (spec §18.10: 7 days apart). */
  alertDay: Map<number, number>;
  /** side → CAS pool for today, centi-hits (spec §14.7). */
  cas: Map<number, number>;
  /** side → AIR_TYPES-indexed sorties yesterday (screens, AI). */
  sorties: Map<number, number[]>;
  /** country → results yesterday [shotDown, lost, casHits, bombPoints, navalDamage]. */
  result: Map<number, number[]>;
  /**
   * country → today's naval air, milli-sorties (pre-flight A4): search
   * (naval bombers × 3, the others × 1), anti-submarine (1 a plane), naval
   * strike; and its fighters' superiority sorties (N1's supremacy).
   */
  navalSearch: Map<number, number>;
  navalAsw: Map<number, number>;
  navalStrike: Map<number, number>;
  fightersSup: Map<number, number>;
  /** Pre-flight A19: [region, side, ‰] of the CAS pool's split by frontage, the zone's day. */
  casShare: [number, number, number][];
  /** Pre-flight A19: [region, side, milli] of the air supply, the zone's day. */
  airSupply: [number, number, number][];
  /** The day this zone last ran its daily step (written before dailyAirZone). */
  lastDay: number;
}

function emptyZone(): ZoneAirState {
  return {
    sup: new Map(),
    enemySup: new Map(),
    enemyPp: new Map(),
    alertDay: new Map(),
    cas: new Map(),
    sorties: new Map(),
    result: new Map(),
    navalSearch: new Map(),
    navalAsw: new Map(),
    navalStrike: new Map(),
    fightersSup: new Map(),
    casShare: [],
    airSupply: [],
    lastDay: -1,
  };
}

export class CountryAir {
  airXpMilli = 0;
  /** 30-day ring of bomb points taken after AA, by day % 30 (spec §14.8 war support). */
  bombTaken = new Array<number>(30).fill(0);
  /** 30-day ring tallies by day % 30: shot down, lost, bombs given, ships sunk, convoys sunk. */
  tally = Array.from({ length: 5 }, () => new Array<number>(30).fill(0));
  /** Zones (strategic ids) the AI runs for a human (air_auto). */
  autoZones: number[] = [];
  constructor(
    readonly smallID: number,
    readonly tag: CountryTag,
  ) {}
}

// ---- Snapshot schema ----

const zInts = () => z.array(zInt());
const pairs = () => z.array(z.tuple([zInt(), zInt()]));
const DeploymentSchema = z.object({
  id: zInt(),
  owner: zInt(),
  sr: zInt(),
  type: zInt(),
  mission: zInt(),
  counts: zInts(),
  target: zInt(),
  base: zInt(),
  lossRest: zInt(),
  auto: z.boolean(),
  volunteerFor: zInt(),
});
const ZoneSchema = z.object({
  sup: pairs(),
  enemySup: pairs(),
  enemyPp: pairs(),
  alertDay: pairs(),
  cas: pairs(),
  sorties: z.array(z.tuple([zInt(), zInts()])),
  result: z.array(z.tuple([zInt(), zInts()])),
  navalSearch: pairs(),
  navalAsw: pairs(),
  navalStrike: pairs(),
  fightersSup: pairs(),
  casShare: z.array(z.tuple([zInt(), zInt(), zInt()])),
  airSupply: z.array(z.tuple([zInt(), zInt(), zInt()])),
  lastDay: zInt(),
});
const CountryAirSchema = z.object({
  airXpMilli: zInt(),
  bombTaken: zInts(),
  tally: z.array(zInts()),
  autoZones: zInts(),
});
export const WwAirStateSchema = z.object({
  deployments: z.array(DeploymentSchema),
  zones: z.array(ZoneSchema),
  countries: z.array(CountryAirSchema),
  nextDeploymentId: zInt(),
  planesLostTotal: zInt(),
  bombPointsTotal: zInt(),
  lastCommonDay: zInt(),
});
export type WwAirState = z.infer<typeof WwAirStateSchema>;

const mapOf = <V>(e: readonly (readonly [number, V])[]): Map<number, V> =>
  new Map(e.map(([k, v]) => [k, v]));

/**
 * World War 1936 P4 air war (spec §19.1). Lives in WorldWar (plan decision
 * 2); ticks after the navy (spec §2.2-7).
 */
export class WwAir {
  readonly deployments = new Map<number, Deployment>();
  /** srIdx order (decision 19). */
  readonly zoneState: ZoneAirState[];
  nextDeploymentId = 1;
  planesLostTotal = 0;
  bombPointsTotal = 0;
  private lastCommonDay = -1;
  private countryList: (CountryAir | null)[];
  // Derived (DERIVED_FIELDS).
  private deploysBySr = new Map<number, number[]>();
  private deploysByBase = new Map<number, number[]>();
  /** owner × 256 + type × 4 + gen → the stats at that stats version and tech set (pre-flight §0-7). */
  private planeStatsMemo = new Map<
    number,
    { statsVer: number; researched: unknown; stats: PlaneStats }
  >();
  private airDirtyZones = new Set<number>();
  private airDirtyDeployments = new Set<number>();
  private airDirtyCountries = new Set<number>();
  private removedDeploymentIds: number[] = [];

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {
    const sc = ww.scenario;
    this.zoneState = sc.strategicList().map(() => emptyZone());
    this.countryList = [
      null,
      ...sc.countries.map((tag, i) => new CountryAir(i + 1, tag)),
    ];
    this.rebuildDerived();
  }

  get econ(): WwEconomy {
    return this.ww.economy;
  }
  get land(): WwLand {
    return this.ww.land;
  }
  get navy(): WwNavy {
    return this.ww.navy;
  }

  /** Spec §12.4: nothing deployed at the start (the AI deploys on its first day). */
  start(): void {
    for (const c of this.countries()) this.airDirtyCountries.add(c.smallID);
  }

  // ---- Clock (spec §2.2-7) ----

  tick(ticks: number): void {
    const prep = this.ww.inPrep(ticks);
    if (!prep) {
      const day = this.ww.day(ticks);
      if (day !== this.lastCommonDay) this.lastCommonDay = day;
      const k = ticks - dayStartTick(day, this.ww.prepEndTick());
      if (k >= 0 && k < WW_DAY_SPLIT) {
        // ① air zones: sorties, combat, AA, superiority, then the effects
        for (const s of this.ww.scenario.strategicList()) {
          if (s.idx % WW_DAY_SPLIT !== k) continue;
          this.zoneState[s.idx].lastDay = day;
          // A1/A2 mark the zone (setAirSup, markZone) when it changed.
          dailyAirZone(this, s.id, day); // A1
          airMissionEffects(this, s.id, day); // A2
        }
        // ② countries: re-basing, refills, decks, AI
        for (let id = 1; id < this.countryList.length; id++) {
          if (id % WW_DAY_SPLIT === k) this.dailyCountry(id, day);
        }
      }
      stepParadrops(this, ticks); // ③ A2
    }
  }

  private dailyCountry(id: number, day: number): void {
    const c = this.countryList[id];
    const p = this.mg.playerBySmallID(id);
    if (
      c === null ||
      c === undefined ||
      !p.isPlayer() ||
      !p.isAlive() ||
      this.ww.isCapitulated(id)
    ) {
      return;
    }
    dailyAirCountry(this, id, day); // A1
    if (p.type() !== PlayerType.Human || c.autoZones.length > 0) {
      aiAir(this, id, day);
    }
    this.airDirtyCountries.add(id);
  }

  // ---- Orders (spec §19.3) ----

  /** air_deploy / air_recall / air_auto (A1); null when it took effect. */
  issue(smallID: number, order: WwOrder, tick: number): WwOrderBlock | null {
    const c = this.country(smallID);
    const p = this.mg.playerBySmallID(smallID);
    if (
      c === null ||
      !p.isPlayer() ||
      !p.isAlive() ||
      this.ww.isCapitulated(smallID)
    ) {
      return "dead";
    }
    switch (order.kind) {
      case "air_deploy":
      case "air_recall":
      case "air_auto": {
        const block = issueAirOrder(this, smallID, order, tick);
        if (block === null) this.airDirtyCountries.add(smallID);
        return block;
      }
      default:
        return "bad_index";
    }
  }

  // ---- What the others read ----

  /** A side's air superiority ‰ over a strategic region (its last day). */
  airSup(side: number, sr: number): number {
    const i = this.ww.scenario.srIdxOf(sr);
    return i < 0 ? 0 : (this.zoneState[i].sup.get(side) ?? 0);
  }

  /** Sets a zone's superiority by side (A1, on the zone's day). */
  setAirSup(sr: number, values: ReadonlyMap<number, number>): void {
    const i = this.ww.scenario.srIdxOf(sr);
    if (i < 0) return;
    const m = new Map<number, number>();
    for (const [k, v] of [...values].sort((a, b) => a[0] - b[0])) {
      if (v !== 0) m.set(k, v);
    }
    this.zoneState[i].sup = m;
    this.airDirtyZones.add(i);
  }

  /** A side's CAS pool over a zone today, centi-hits. */
  casPool(sr: number, side: number): number {
    const i = this.ww.scenario.srIdxOf(sr);
    return i < 0 ? 0 : (this.zoneState[i].cas.get(side) ?? 0);
  }

  /** Spec §14.6 for a battle region and a division side: the worst enemy superiority's penalty (A1). */
  airPenaltyBp(region: number, side: number, divAirAtk: number): number {
    return airPenaltyFor(this, region, side, divAirAtk);
  }

  /** Spec §14.6: movement into `region` (A1). */
  airMoveFactorPm(region: number, side: number): number {
    return airMoveFactorFor(this, region, side);
  }

  /** Spec §14.10: air supply into `region` (A2). */
  airSupplyMilli(region: number, side: number): number {
    return airSupplyAt(this, region, side);
  }

  /** Spec §14.10: the air war's conditions of a paradrop (A2). */
  paradropBlock(
    smallID: number,
    army: number,
    target: number,
  ): WwOrderBlock | null {
    return paradropBlockFor(this, smallID, army, target);
  }

  /** Deployment ids in a zone, ascending. */
  deploymentsIn(sr: number): readonly number[] {
    return this.deploysBySr.get(sr) ?? NO_IDS;
  }

  deploymentsOf(owner: number): Deployment[] {
    return [...this.deployments.values()].filter((d) => d.owner === owner);
  }

  /** Planes based at a region now (capacity check, spec §13.3). */
  baseUse(region: number): number {
    let n = 0;
    for (const id of this.deploysByBase.get(region) ?? NO_IDS) {
      for (const c of this.deployments.get(id)?.counts ?? []) n += c;
    }
    return n;
  }

  /** Spec §13.3: level × 200 less the bomb damage (whole and partial levels). */
  baseCapacity(region: number): number {
    const econ = this.econ;
    const level = econ.buildingArray("air_base")[region] ?? 0;
    const dmg =
      econ.damage[region * BUILDING_IDS.length + buildingIndex("air_base")] ??
      0;
    return Math.max(
      0,
      Math.floor((WW_AIR_BASE_CAPACITY * (level * 1000 - dmg)) / 1000),
    );
  }

  /**
   * planeStats at the owner's stats and techs, kept by (owner, type,
   * generation) while its statsVer and researched set are the same
   * (pre-flight §0-7).
   */
  planeStatsOf(owner: number, type: AirType, gen: number): PlaneStats {
    const ce = this.econ.country(owner);
    const key = owner * 256 + AIR_TYPES.indexOf(type) * 4 + gen;
    const hit = this.planeStatsMemo.get(key);
    if (
      ce !== null &&
      hit !== undefined &&
      hit.statsVer === ce.statsVer &&
      hit.researched === ce.researched
    ) {
      return hit.stats;
    }
    const stats =
      ce === null
        ? planeStats(type, gen, emptyStats(), new Set())
        : planeStats(type, gen, ce.stats, ce.researched);
    if (ce !== null) {
      this.planeStatsMemo.set(key, {
        statsVer: ce.statsVer,
        researched: ce.researched,
        stats,
      });
    }
    return stats;
  }

  /** Adds a deployment record (A1's deploy). Ids only rise: the Map stays in id order. */
  addDeployment(d: Omit<Deployment, "id">): Deployment {
    // Field by field in the snapshot's order, whatever the caller's.
    const full: Deployment = {
      id: this.nextDeploymentId++,
      owner: d.owner,
      sr: d.sr,
      type: d.type,
      mission: d.mission,
      counts: [...d.counts],
      target: d.target,
      base: d.base,
      lossRest: d.lossRest,
      auto: d.auto,
      volunteerFor: d.volunteerFor,
    };
    this.deployments.set(full.id, full);
    this.indexDeployment(full);
    this.markDeployment(full.id);
    return full;
  }

  /** Ends a deployment; its planes go back to the stock when `returnPlanes`, else they are gone with it. */
  removeDeployment(id: number, back: boolean): void {
    const d = this.deployments.get(id);
    if (d === undefined) return;
    const ce = this.econ.country(d.owner);
    if (ce !== null) {
      const type = AIR_TYPES[d.type];
      if (back) {
        returnPlanes(ce, type, d.counts);
      } else {
        d.counts.forEach((c, i) => {
          const k = equipKey(type, i + 1);
          if (k >= 0)
            ce.planesDeployed[k] = Math.max(0, ce.planesDeployed[k] - c);
        });
      }
    }
    this.deployments.delete(id);
    this.unindexDeployment(d);
    this.airDirtyDeployments.delete(id);
    this.removedDeploymentIds.push(id);
    this.airDirtyCountries.add(d.owner);
  }

  /**
   * The kill site of every air loss (A1's combat, AA, N2's fleet AA, A2):
   * takes `counts` (per generation) off deployment `id` and the deployed
   * ledger, and names the killer `by` (0: nobody — fuel, crashes) to P5's
   * war score (EndgameHooks.onPlanesLost). A deployment left empty stays
   * (its refill is A1's); returns the planes taken.
   */
  shootDown(id: number, counts: readonly number[], by: number): number {
    const d = this.deployments.get(id);
    if (d === undefined) return 0;
    const took = d.counts.map((c, i) =>
      Math.max(0, Math.min(c, Math.floor(counts[i] ?? 0))),
    );
    const n = took.reduce((a, b) => a + b, 0);
    if (n === 0) return 0;
    took.forEach((c, i) => (d.counts[i] -= c));
    const type = AIR_TYPES[d.type];
    const ce = this.econ.country(d.owner);
    if (ce !== null) losePlanes(ce, type, took);
    onPlanesLost(this, d.owner, by, type, n);
    this.markDeployment(id);
    this.airDirtyCountries.add(d.owner);
    return n;
  }

  /** Moves a deployment to another base (A1's re-basing). */
  setDeploymentBase(d: Deployment, base: number): void {
    if (d.base === base) return;
    this.unindexDeployment(d);
    d.base = base;
    this.indexDeployment(d);
    this.markDeployment(d.id);
  }

  country(smallID: number): CountryAir | null {
    return this.countryList[smallID] ?? null;
  }

  countries(): CountryAir[] {
    return this.countryList.filter((c): c is CountryAir => c !== null);
  }

  markZone(srIdx: number): void {
    this.airDirtyZones.add(srIdx);
  }
  markDeployment(id: number): void {
    if (this.deployments.has(id)) this.airDirtyDeployments.add(id);
  }
  markCountry(id: number): void {
    this.airDirtyCountries.add(id);
  }
  /** A message to the country's human player only; `key` is the full key. */
  message(
    to: number,
    key: string,
    params: Record<string, string | number>,
  ): void {
    this.navy.message(to, key, params);
  }

  // ---- Control, capitulation, annexation (decision 32) ----

  /** A base lost changes nothing today: the owner's next day re-bases (A1). */
  onControlChanged(
    region: number,
    from: number,
    to: number,
    tick: number,
  ): void {
    void tick;
    if (from === to) return;
    for (const id of this.deploysByBase.get(region) ?? NO_IDS) {
      this.markDeployment(id);
    }
  }

  /** Decision 32: a capitulated country's deployments are gone with their planes. */
  onCapitulation(loser: number, victor: number): void {
    void victor;
    for (const d of this.deploymentsOf(loser))
      this.removeDeployment(d.id, false);
    const c = this.country(loser);
    if (c !== null) c.autoZones = [];
  }

  /**
   * Decision 32 (P3 annexation): `from`'s deployments go back to its stock
   * (P3's merge moves the stock to `to`); "disband" too.
   */
  transferUnits(from: number, to: number, mode: "transfer" | "disband"): void {
    void to;
    void mode;
    for (const d of this.deploymentsOf(from)) this.removeDeployment(d.id, true);
    const c = this.country(from);
    if (c !== null) c.autoZones = [];
  }

  // ---- Screens (spec §19.4) ----

  takeData(): WwAirData | null {
    if (
      this.airDirtyZones.size === 0 &&
      this.airDirtyDeployments.size === 0 &&
      this.airDirtyCountries.size === 0 &&
      this.removedDeploymentIds.length === 0
    ) {
      return null;
    }
    const humans = new Set<number>();
    for (const c of this.countries()) {
      const p = this.mg.playerBySmallID(c.smallID);
      if (p.isPlayer() && p.type() === PlayerType.Human) humans.add(c.smallID);
    }
    const data: WwAirData = {
      zones: [],
      deployments: [],
      removedDeployments: [...this.removedDeploymentIds],
      details: [],
    };
    const list = this.ww.scenario.strategicList();
    for (const i of [...this.airDirtyZones].sort((a, b) => a - b)) {
      const z = this.zoneState[i];
      const sides = new Set<number>([...z.sup.keys(), ...z.sorties.keys()]);
      const zone: AirZoneData = {
        sr: list[i].id,
        // Spec §14.6: what the battle card needs for the land war's air cut.
        enemySky: [...z.enemySup]
          .sort((a, b) => a[0] - b[0])
          .map(([side, enemySupPm]) => ({
            side,
            enemySupPm,
            bonusPp: z.enemyPp.get(side) ?? 0,
          })),
        sides: [...sides]
          .sort((a, b) => a - b)
          .map((side) => ({
            side,
            supPm: z.sup.get(side) ?? 0,
            sorties: [...(z.sorties.get(side) ?? [])],
          })),
        result: [...z.result]
          .filter(([id]) => humans.has(id))
          .map(([id, r]) => [
            id,
            {
              shotDown: r[0] ?? 0,
              lost: r[1] ?? 0,
              casHitsCenti: r[2] ?? 0,
              bombPoints: r[3] ?? 0,
              navalDamageMilli: r[4] ?? 0,
            },
          ]),
      };
      data.zones.push(zone);
    }
    for (const id of [...this.airDirtyDeployments].sort((a, b) => a - b)) {
      const d = this.deployments.get(id);
      if (d !== undefined && humans.has(d.owner)) {
        data.deployments.push(this.deploySummary(d));
      }
    }
    for (const id of [...this.airDirtyCountries].sort((a, b) => a - b)) {
      if (humans.has(id)) data.details.push(this.countryDetail(id));
    }
    this.airDirtyZones.clear();
    this.airDirtyDeployments.clear();
    this.airDirtyCountries.clear();
    this.removedDeploymentIds = [];
    if (
      data.zones.length === 0 &&
      data.deployments.length === 0 &&
      data.removedDeployments.length === 0 &&
      data.details.length === 0
    ) {
      return null;
    }
    return data;
  }

  private deploySummary(d: Deployment): AirDeploySummary {
    return {
      id: d.id,
      owner: d.owner,
      sr: d.sr,
      type: AIR_TYPES[d.type],
      mission: AIR_MISSIONS[d.mission],
      counts: [...d.counts],
      target: d.target,
      base: d.base,
    };
  }

  private countryDetail(id: number): CountryAirDetail {
    const c = this.country(id)!;
    const ce = this.econ.country(id)!;
    const bases = new Map<number, number>();
    for (const d of this.deploymentsOf(id)) {
      if (d.base <= 0) continue;
      let n = 0;
      for (const k of d.counts) n += k;
      bases.set(d.base, (bases.get(d.base) ?? 0) + n);
    }
    const sum = (arr: readonly number[], type: AirType) => {
      let n = 0;
      for (let g = 1; g <= EQUIPMENT_GENS[type]; g++)
        n += arr[equipKey(type, g)];
      return n;
    };
    const decks = AIR_TYPES.map(() => 0);
    const t = this.navy.ships;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0 || t.owner[r] !== id) continue;
      const deck = t.deckOf(r);
      ["cv_fighter", "cv_cas", "cv_naval_bomber"].forEach((type, i) => {
        decks[AIR_TYPES.indexOf(type as AirType)] +=
          deck[i * 3] + deck[i * 3 + 1] + deck[i * 3 + 2];
      });
    }
    const deployed = AIR_TYPES.map((type, i) =>
      Math.max(0, sum(ce.planesDeployed, type) - decks[i]),
    );
    const day = this.ww.day(this.mg.ticks());
    const ring = (r: readonly number[]) => {
      let n = 0;
      for (let i = 0; i < 30; i++) n += r[(((day - i) % 30) + 30) % 30] ?? 0;
      return n;
    };
    return {
      smallID: id,
      bases: [...bases]
        .sort((a, b) => a[0] - b[0])
        .map(([region, used]) => ({
          region,
          used,
          cap: this.baseCapacity(region),
          damagePm: (() => {
            const level = this.econ.buildingArray("air_base")[region] ?? 0;
            const dmg =
              this.econ.damage[
                region * BUILDING_IDS.length + buildingIndex("air_base")
              ] ?? 0;
            return level === 0 ? 0 : Math.floor(dmg / level);
          })(),
        })),
      stock: AIR_TYPES.map((type) => sum(ce.stock, type)),
      deployed,
      decks,
      tally30: [
        ring(c.tally[0]),
        ring(c.tally[1]),
        ring(c.tally[2]),
        ring(c.bombTaken),
        ring(c.tally[3]),
        ring(c.tally[4]),
      ],
      bombedRegions: [],
      // Lane U: the zones the AI runs for this human (the zone card's auto).
      autoZones: [...c.autoZones].sort((a, b) => a - b),
    };
  }

  // ---- Snapshot, hash ----

  snapshot(): WwAirState {
    const arr = (m: Map<number, number>) =>
      [...m].map(([k, v]): [number, number] => [k, v]);
    return {
      deployments: [...this.deployments.values()].map((d) => ({
        ...d,
        counts: [...d.counts],
      })),
      zones: this.zoneState.map((z) => ({
        sup: arr(z.sup),
        enemySup: arr(z.enemySup),
        enemyPp: arr(z.enemyPp),
        alertDay: arr(z.alertDay),
        cas: arr(z.cas),
        sorties: [...z.sorties].map(([k, v]): [number, number[]] => [
          k,
          [...v],
        ]),
        result: [...z.result].map(([k, v]): [number, number[]] => [k, [...v]]),
        navalSearch: arr(z.navalSearch),
        navalAsw: arr(z.navalAsw),
        navalStrike: arr(z.navalStrike),
        fightersSup: arr(z.fightersSup),
        casShare: z.casShare.map((x): [number, number, number] => [
          x[0],
          x[1],
          x[2],
        ]),
        airSupply: z.airSupply.map((x): [number, number, number] => [
          x[0],
          x[1],
          x[2],
        ]),
        lastDay: z.lastDay,
      })),
      countries: this.countries().map((c) => ({
        airXpMilli: c.airXpMilli,
        bombTaken: [...c.bombTaken],
        tally: c.tally.map((t) => [...t]),
        autoZones: [...c.autoZones],
      })),
      nextDeploymentId: this.nextDeploymentId,
      planesLostTotal: this.planesLostTotal,
      bombPointsTotal: this.bombPointsTotal,
      lastCommonDay: this.lastCommonDay,
    };
  }

  restoreState(s: WwAirState): void {
    this.deployments.clear();
    for (const d of s.deployments) {
      this.deployments.set(d.id, { ...d, counts: [...d.counts] });
    }
    s.zones.forEach((x, i) => {
      const z = this.zoneState[i];
      if (z === undefined) return;
      z.sup = mapOf(x.sup);
      z.enemySup = mapOf(x.enemySup);
      z.enemyPp = mapOf(x.enemyPp);
      z.alertDay = mapOf(x.alertDay);
      z.cas = mapOf(x.cas);
      z.sorties = new Map(x.sorties.map(([k, v]) => [k, [...v]]));
      z.result = new Map(x.result.map(([k, v]) => [k, [...v]]));
      z.navalSearch = mapOf(x.navalSearch);
      z.navalAsw = mapOf(x.navalAsw);
      z.navalStrike = mapOf(x.navalStrike);
      z.fightersSup = mapOf(x.fightersSup);
      z.casShare = x.casShare.map((y): [number, number, number] => [
        y[0],
        y[1],
        y[2],
      ]);
      z.airSupply = x.airSupply.map((y): [number, number, number] => [
        y[0],
        y[1],
        y[2],
      ]);
      z.lastDay = x.lastDay;
    });
    this.countries().forEach((c, i) => {
      const x = s.countries[i];
      if (x === undefined) return;
      c.airXpMilli = x.airXpMilli;
      c.bombTaken = [...x.bombTaken];
      c.tally = x.tally.map((t) => [...t]);
      c.autoZones = [...x.autoZones];
    });
    this.nextDeploymentId = s.nextDeploymentId;
    this.planesLostTotal = s.planesLostTotal;
    this.bombPointsTotal = s.bombPointsTotal;
    this.lastCommonDay = s.lastCommonDay;
    this.rebuildDerived();
    // A restored game's screens have seen nothing yet.
    this.zoneState.forEach((_, i) => this.airDirtyZones.add(i));
    for (const id of this.deployments.keys()) this.airDirtyDeployments.add(id);
    for (const c of this.countries()) this.airDirtyCountries.add(c.smallID);
  }

  /** The memo and the deployment indexes. The constructor and restoreState call it. */
  rebuildDerived(): void {
    this.planeStatsMemo.clear();
    this.deploysBySr = new Map();
    this.deploysByBase = new Map();
    for (const d of this.deployments.values()) this.indexDeployment(d);
  }

  private indexDeployment(d: Deployment): void {
    insertSorted(this.deploysBySr, d.sr, d.id);
    insertSorted(this.deploysByBase, d.base, d.id);
  }

  private unindexDeployment(d: Deployment): void {
    removeFrom(this.deploysBySr, d.sr, d.id);
    removeFrom(this.deploysByBase, d.base, d.id);
  }

  /**
   * Per country the planes deployed; per zone the superiority by side and
   * the mission effects' state the land war reads later (CAS pool and
   * shares, air supply, the results); per country the 30-day rings; the
   * losses and bomb points so far. Empty state adds nothing.
   */
  hash(): number {
    let h = 43;
    const n = new Array<number>(this.countryList.length).fill(0);
    for (const d of this.deployments.values()) {
      for (const c of d.counts) n[d.owner] += c;
      // Where and what for (P4 review).
      h = (Math.imul(h, 31) + d.id) >>> 0;
      h = (Math.imul(h, 31) + d.sr * 16 + d.mission) >>> 0;
    }
    for (let id = 1; id < n.length; id++) {
      if (n[id] !== 0) h = (Math.imul(h, 31) + id * 7 + n[id]) >>> 0;
    }
    const mix = (x: number, v: number) => (Math.imul(x, 31) + v) | 0;
    this.zoneState.forEach((z, i) => {
      let sum = 0;
      for (const v of z.sup.values()) sum += v;
      if (sum !== 0) h = (Math.imul(h, 31) + i * 11 + sum) >>> 0;
      // Lane A2 review: the effects' state of the zone.
      let fx = 0;
      for (const [k, v] of z.cas) fx = mix(mix(fx, k), v);
      for (const [r, s, m] of z.casShare) fx = mix(mix(mix(fx, r), s), m);
      for (const [r, s, m] of z.airSupply) fx = mix(mix(mix(fx, r), s), m);
      for (const [k, row] of z.result) {
        fx = mix(fx, k);
        for (const v of row) fx = mix(fx, v);
      }
      if (fx !== 0) h = (Math.imul(h, 31) + i * 17 + fx) >>> 0;
      // A1: the battlefield-support bonus and the alerts' days (state).
      for (const [k, v] of z.enemyPp) {
        h = (Math.imul(h, 31) + i * 13 + k + v) >>> 0;
      }
      for (const [k, v] of z.alertDay) {
        h = (Math.imul(h, 31) + i * 17 + k + v) >>> 0;
      }
    });
    for (const c of this.countries()) {
      let r = 0;
      for (const v of c.bombTaken) r = mix(r, v);
      for (const t of c.tally) for (const v of t) r = mix(r, v);
      if (r !== 0) h = (Math.imul(h, 31) + c.smallID * 19 + r) >>> 0;
    }
    h = (Math.imul(h, 31) + this.planesLostTotal) >>> 0;
    return (Math.imul(h, 31) + this.bombPointsTotal) >>> 0;
  }
}

const NO_IDS: readonly number[] = [];

function insertSorted(m: Map<number, number[]>, key: number, id: number): void {
  let l = m.get(key);
  if (l === undefined) m.set(key, (l = []));
  let i = l.length;
  while (i > 0 && l[i - 1] > id) i--;
  l.splice(i, 0, id);
}

function removeFrom(m: Map<number, number[]>, key: number, id: number): void {
  const l = m.get(key);
  if (l === undefined) return;
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  if (l.length === 0) m.delete(key);
}
