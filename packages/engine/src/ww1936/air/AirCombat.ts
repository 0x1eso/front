// World War 1936 P4: sorties, air combat, anti-air and air superiority
// (P4 spec §14.2–§14.5). Lane A1 (Task 7). A zone's day: every
// deployment's sorties (weather, fuel, range, base damage and, but for
// superiority and interception, yesterday's superiority), then the air
// battles of every pair of sides at war, the land anti-air, the losses
// taken all at once, and the superiority by side the others read next.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import { DS_RADAR } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BuildingId,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Weather } from "@openfront/engine-api/ww1936/LandTypes";
import {
  aaLossPm,
  agilityFactorPm,
  airLossesMilli,
  airSupPm,
  detectionPm,
  rangeEffPm,
  sortieEffPm,
  WEATHER_SORTIE_PM,
} from "@openfront/engine-lib/ww1936/AirRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { aceMods } from "../depth/Aces";
import { nightMods } from "../depth/AirExtras";
import { designPlaneP4, planesLossBp } from "../depth/Designs";
import {
  damageOf,
  effectiveBuildings,
  effectiveLevel,
} from "../economy/Buildings";
import { noteFuelUse } from "../economy/Fuel";
import { navalPort } from "../navy/Ports";
import { radarPmAt } from "./AirSuperiority";
import {
  carrierWingDeck,
  carrierWingDeckD,
  isCarrierWing,
  takeOffDeck,
} from "./Deploy";
import { oldestFirst } from "./DesignPlanes";
import {
  hasMagnetron,
  RADAR_PATROL_MAGNETRON_PCT,
  RADAR_PATROL_PCT,
  withFuze,
} from "./ProjectEffects";
import { deploymentPlanes, deploymentSide, WwAir, ZoneAirState } from "./WwAir";

/** One group of planes in a duel: its numbers and how many fly, milli planes. */
export interface DuelPlanes {
  stats: PlaneStats;
  milli: number;
  /** The mission's weight on this group as a target (spec §14.3: ×1, ×2, ×3). */
  weight: number;
}

const M_SUP = AIR_MISSIONS.indexOf("air_superiority");
const M_INT = AIR_MISSIONS.indexOf("interception");
const M_CAS = AIR_MISSIONS.indexOf("cas");
const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
const M_PORT = AIR_MISSIONS.indexOf("port_strike");
const M_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const T_NAVAL_BOMBER = AIR_TYPES.indexOf("naval_bomber");
/** Spec §14.3 target weights, in hundredths (so a mix of the two missions stays whole). */
const W_SUP_FIGHTER = 200;
const W_SUP_OTHER = 100;
const W_INT_FIGHTER = 100;
const W_INT_OTHER = 300;
/** The alert's spacing per zone and country, days (spec §18.10). */
const SUP_ALERT_DAYS = 7;

/** A deployment's day in the air (spec §14.2), before the losses. */
export interface AirFlight {
  /** The deployment's id. */
  id: number;
  owner: number;
  /** deploymentSide: the volunteer host's side, else the owner's. */
  side: number;
  /** AIR_TYPES index. */
  type: number;
  /** AIR_MISSIONS index. */
  mission: number;
  base: number;
  /**
   * Planes flying per generation (index gen − 1). P6 (lane E): a record
   * with design planes adds one entry per plane design slot after its
   * generations (index gens + slot − 1), here and in `milli` and `stats`.
   */
  counts: number[];
  /** Sorties per generation, milli planes: counts × eff‰. */
  milli: number[];
  total: number;
  /** planeStats per generation at the owner's stats (P6: a design slot's as the type flies it). */
  stats: PlaneStats[];
}

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const isFighter = (type: number) => {
  const t = AIR_TYPES[type];
  return t === "fighter" || t === "heavy_fighter" || t === "cv_fighter";
};

/**
 * P6 (lane E, spec §5.4.2): the air radar module's naval patrol — a
 * DS_RADAR design's sorties count ×1.3 (×1.5 with the magnetron): the
 * part above its plain sorties, which the flight's total holds once.
 */
function radarPatrolExtra(air: WwAir, f: AirFlight): number {
  const gens = EQUIPMENT_GENS[AIR_TYPES[f.type]];
  if (f.milli.length <= gens) return 0;
  const pct = hasMagnetron(air.ww.depth, f.owner)
    ? RADAR_PATROL_MAGNETRON_PCT
    : RADAR_PATROL_PCT;
  let extra = 0;
  for (let i = gens; i < f.milli.length; i++) {
    if (f.milli[i] <= 0) continue;
    const flags = air.ww.depth.designStatsOf(
      f.owner,
      "plane",
      i - gens + 1,
    )?.flags;
    if (((flags ?? 0) & DS_RADAR) !== 0) {
      extra += Math.floor((f.milli[i] * (pct - 100)) / 100);
    }
  }
  return extra;
}

/** P6 (spec §21.2, T1b): a sortie rate ‰ × (100 + sortieEffPct)%, at most one sortie a day. */
function effWith(pct: number, pm: number): number {
  return pct === 0
    ? pm
    : Math.min(1000, Math.floor((pm * Math.max(0, 100 + pct)) / 100));
}

/**
 * Spec §13.1: a zone's weather — a land zone's is its center region's (P2
 * weatherOn), a sea zone's its center sea zone's latitude and cell, on
 * plains. Tests pick their days with it.
 */
export function zoneWeather(air: WwAir, sr: number, day: number): Weather {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.members.length === 0) return "clear";
  const at = sc.regionAt(s.center);
  const c = s.members.includes(at) ? at : s.members[0];
  if (s.kind === "land") return air.land.weatherOn(c, day);
  return weatherAt(day, sc.zoneLatC(c), "plains", sc.zoneWcell(c));
}

/** The flights of the zone's last day this tick (A2 reads them right after: the same call). */
const lastFlights = new WeakMap<
  WwAir,
  { tick: number; sr: number; flights: AirFlight[] }
>();

/**
 * The deployments' sorties over `sr` today (spec §14.2), by deployment id:
 * what dailyAirZone flew this tick (before its losses), else computed from
 * the state now. A2's mission effects read it.
 */
export function zoneFlights(air: WwAir, sr: number): readonly AirFlight[] {
  const hit = lastFlights.get(air);
  if (hit !== undefined && hit.sr === sr && hit.tick === air.mg.ticks()) {
    return hit.flights;
  }
  return flightsOf(air, sr, air.ww.day(air.mg.ticks()), false);
}

function flightsOf(
  air: WwAir,
  sr: number,
  day: number,
  burnFuel: boolean,
): AirFlight[] {
  const ids = air.deploymentsIn(sr);
  if (ids.length === 0) return [];
  const sc = air.ww.scenario;
  const z = air.zoneState[sc.srIdxOf(sr)];
  const weatherPm = WEATHER_SORTIE_PM[zoneWeather(air, sr, day)];
  const econ = air.econ;
  const out: AirFlight[] = [];
  for (const id of ids) {
    const d = air.deployments.get(id)!;
    let counts: readonly number[] = d.counts;
    let dcounts: readonly number[] = d.dcounts;
    if (isCarrierWing(d)) {
      const deck = carrierWingDeck(air, d);
      const deckD = deck === null ? null : carrierWingDeckD(air, d);
      // The record mirrors the deck (N2's carrier battles take planes off it).
      if (
        deck !== null &&
        (deck.some((c, i) => c !== d.counts[i]) ||
          d.dcounts.some((c, s) => c !== (deckD?.[s] ?? 0)))
      ) {
        d.counts = [...deck];
        if (deckD !== null) d.dcounts = [...deckD];
        else d.dcounts.fill(0);
        d.target = sum(deck) + (deckD === null ? 0 : sum(deckD));
        air.markDeployment(d.id);
      }
      counts = deck ?? [];
      dcounts = deckD ?? [];
    }
    const designs = sum(dcounts);
    if (sum(counts) + designs === 0) continue;
    const ce = econ.country(d.owner);
    if (ce === null) continue;
    const side = deploymentSide(air, d);
    const type = AIR_TYPES[d.type];
    const km = d.base > 0 ? sc.srKm(d.base, sr) : 0;
    const level =
      d.base > 0 ? (econ.buildingArray("air_base")[d.base] ?? 0) : 0;
    const dmgPm =
      level === 0
        ? 0
        : Math.min(
            1000,
            Math.floor(damageOf(econ, d.base, "air_base") / level),
          );
    const supPm =
      d.mission === M_SUP || d.mission === M_INT
        ? null
        : (z.sup.get(side) ?? 0);
    const stats: PlaneStats[] = [];
    const milli: number[] = [];
    let total = 0;
    let fuel = 0;
    // P6 (spec §21.2, T1b): the owner's sortieEffPct (effWith).
    const effPct = ce.stats.sortieEffPct;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const st = air.planeStatsOf(d.owner, type, g);
      stats.push(st);
      const n = counts[g - 1] ?? 0;
      const eff =
        n === 0
          ? 0
          : effWith(
              effPct,
              sortieEffPm(
                weatherPm,
                ce.fuelRatioPm,
                rangeEffPm(km, st.rangeKm),
                dmgPm,
                supPm,
              ),
            );
      const m = n * eff;
      milli.push(m);
      total += m;
      fuel += Math.floor((m * st.fuelPerSortieMilli) / 1000);
    }
    // P6 (lane E): the design slots, each at its design's numbers (its
    // range, its fuel), after the generations.
    if (designs > 0) {
      for (let s = 1; s <= dcounts.length; s++) {
        const n = dcounts[s - 1];
        const st = n > 0 ? designPlaneP4(air.ww.depth, d.owner, s, type) : null;
        if (st === null) {
          stats.push(stats[0]);
          milli.push(0);
          continue;
        }
        stats.push(st);
        const m =
          n *
          effWith(
            effPct,
            sortieEffPm(
              weatherPm,
              ce.fuelRatioPm,
              rangeEffPm(km, st.rangeKm),
              dmgPm,
              supPm,
            ),
          );
        milli.push(m);
        total += m;
        fuel += Math.floor((m * st.fuelPerSortieMilli) / 1000);
      }
    }
    if (burnFuel && fuel > 0) noteFuelUse(ce, fuel, 2);
    if (total === 0) continue;
    out.push({
      id: d.id,
      owner: d.owner,
      side,
      type: d.type,
      mission: d.mission,
      base: d.base,
      counts: designs > 0 ? [...counts, ...dcounts] : [...counts],
      milli,
      total,
      stats,
    });
  }
  return out;
}

/**
 * Spec §14.3: one air battle's losses the attackers inflict on the
 * defenders, milli planes (N2's carrier strikes, A2's paradrops and the
 * zone's air battles call it): KP = Σ air attack × sorties × the agility
 * factor of the attackers' average against the targets' (weighted)
 * average; losses = KP × detection / (the targets' weighted average air
 * defense × 28).
 */
export function airDuelMilli(
  attackers: readonly DuelPlanes[],
  defenders: readonly DuelPlanes[],
  detPm: number,
): number {
  let atk = 0;
  let kp = 0;
  let agiA = 0;
  for (const a of attackers) {
    if (a.milli <= 0) continue;
    atk += a.milli;
    kp += Math.floor((a.milli * a.stats.airAtk) / 1000);
    agiA += a.milli * a.stats.agility;
  }
  if (atk === 0 || kp === 0) return 0;
  let w = 0;
  let def = 0;
  let agiB = 0;
  for (const d of defenders) {
    if (d.milli <= 0 || d.weight <= 0) continue;
    const x = d.milli * d.weight;
    w += x;
    def += x * d.stats.airDef;
    agiB += x * d.stats.agility;
  }
  if (w === 0) return 0;
  const factor = agilityFactorPm(Math.floor(agiA / atk), Math.floor(agiB / w));
  return airLossesMilli(
    Math.floor((kp * factor) / 1000),
    detPm,
    Math.floor(def / w),
  );
}

/**
 * Splits `total` by `weights` with the largest remainders (ties: the
 * earlier entry), never above 2^53 on the way.
 */
function splitByWeight(total: number, weights: readonly number[]): number[] {
  const out = weights.map(() => 0);
  let sumW = 0;
  for (const w of weights) sumW += Math.max(0, w);
  if (total <= 0 || sumW <= 0) return out;
  // Normalise the weights to a million when the product could grow too big.
  let ws = weights.map((w) => Math.max(0, w));
  let wsum = sumW;
  if (total * sumW > Number.MAX_SAFE_INTEGER) {
    ws = ws.map((w) => Math.floor((w * 1_000_000) / sumW));
    wsum = ws.reduce((a, b) => a + b, 0);
    if (wsum <= 0) return out;
  }
  const rems: number[] = [];
  let given = 0;
  ws.forEach((w, i) => {
    out[i] = Math.floor((total * w) / wsum);
    rems.push((total * w) % wsum);
    given += out[i];
  });
  const order = ws
    .map((w, i) => i)
    .filter((i) => ws[i] > 0)
    .sort((a, b) => rems[b] - rems[a] || a - b);
  let left = total - given;
  for (let k = 0; left > 0 && order.length > 0; k++, left--) {
    out[order[k % order.length]]++;
  }
  return out;
}

/** A pending loss on a deployment: milli and who caused how much of it. */
interface PendingLoss {
  milli: number;
  by: Map<number, number>;
}

function addLoss(
  pending: Map<number, PendingLoss>,
  id: number,
  milli: number,
  by: number,
): void {
  if (milli <= 0) return;
  let p = pending.get(id);
  if (p === undefined) pending.set(id, (p = { milli: 0, by: new Map() }));
  p.milli += milli;
  p.by.set(by, (p.by.get(by) ?? 0) + milli);
}

/**
 * P6 (spec §15.2): a record with a living ace fights with its air attack
 * +10% and agility +5% (aceMods); any other record keeps P4's numbers.
 */
function aceStats(air: WwAir, id: number, st: PlaneStats): PlaneStats {
  if ((air.deployments.get(id)?.ace ?? 0) === 0) return st;
  const a = aceMods(air.ww.depth, id);
  if (a.attackPct === 0 && a.agilityPct === 0) return st;
  return {
    ...st,
    airAtk: Math.floor((st.airAtk * (100 + a.attackPct)) / 100),
    agility: Math.floor((st.agility * (100 + a.agilityPct)) / 100),
  };
}

/**
 * P6 (spec §15.3): the share of its losses a night strategic bombing
 * record takes, bp (nightMods: ×0.5, the radar-design night fighters among
 * `shooters` not halved); 10 000 for any other record. `night`: some
 * record over the zone flies by night (nightIn), else nothing is asked.
 */
function nightLossBp(
  air: WwAir,
  night: boolean,
  f: AirFlight,
  shooters?: readonly number[],
): number {
  if (!night || f.mission !== M_BOMB) return 10_000;
  return nightMods(air.ww.depth, f.id, shooters).lossBp;
}

/**
 * Some strategic bombing record over the zone carries the night flag. A
 * night group's records share it (air_night sets them all; AirExtras
 * syncs a record P4 adds), so a zone without one has no night raid.
 */
function nightIn(air: WwAir, flights: readonly AirFlight[]): boolean {
  for (const f of flights) {
    if (f.mission === M_BOMB && air.deployments.get(f.id)?.night === true) {
      return true;
    }
  }
  return false;
}

/** Whether two sides are at war (some member of one with some member of the other). */
function sidesAtWar(air: WwAir, a: number, b: number): boolean {
  if (a === b) return false;
  const land = air.land;
  for (const x of land.sideMembers(a)) {
    for (const y of land.sideMembers(b)) {
      if (land.isEnemy(x, y)) return true;
    }
  }
  return false;
}

/**
 * Spec §14.3: the air battles. For every side A that flies superiority or
 * interception, its kill power goes against the sides at war with it that
 * fly here (split by their weighted sorties), each side's losses spread
 * over its deployments by weight (largest remainders), cut by the
 * victim's airLossCutPct (operational_integrity_2). P6: aces fight better
 * (spec §15.2) and night raids take half (spec §15.3).
 */
function airBattles(
  air: WwAir,
  sr: number,
  flights: readonly AirFlight[],
  sides: readonly number[],
  atWar: (a: number, b: number) => boolean,
  pending: Map<number, PendingLoss>,
  night: boolean,
): void {
  const sc = air.ww.scenario;
  const s = sc.sr(sr)!;
  const land = air.land;
  const econ = air.econ;
  for (const A of sides) {
    const shooters = flights.filter(
      (f) => f.side === A && (f.mission === M_SUP || f.mission === M_INT),
    );
    if (shooters.length === 0) continue;
    const enemies = sides.filter((B) => atWar(A, B));
    if (enemies.length === 0) continue;
    let supMilli = 0;
    let intMilli = 0;
    let detectPct = 0;
    let lead = 0;
    let leadKp = -1;
    const kpOf = new Map<number, number>();
    for (const f of shooters) {
      if (f.mission === M_SUP) supMilli += f.total;
      else intMilli += f.total;
      const ce = econ.country(f.owner);
      if (ce !== null) detectPct = Math.max(detectPct, ce.stats.airDetectPct);
      let kp = 0;
      f.stats.forEach(
        (st, g) =>
          (kp += Math.floor(
            (f.milli[g] * aceStats(air, f.id, st).airAtk) / 1000,
          )),
      );
      kpOf.set(f.owner, (kpOf.get(f.owner) ?? 0) + kp);
    }
    for (const [owner, kp] of [...kpOf].sort((a, b) => a[0] - b[0])) {
      if (kp > leadKp) {
        lead = owner;
        leadKp = kp;
      }
    }
    // Spec §14.3: the target weights; a mix of the two missions mixes them.
    const supPct = Math.floor((supMilli * 100) / (supMilli + intMilli));
    const wFighter =
      (supPct * W_SUP_FIGHTER + (100 - supPct) * W_INT_FIGHTER) / 100;
    const wOther = (supPct * W_SUP_OTHER + (100 - supPct) * W_INT_OTHER) / 100;
    const weightOf = (f: AirFlight) =>
      Math.floor(isFighter(f.type) ? wFighter : wOther);
    let ownLand = false;
    if (s.kind === "land") {
      for (const r of s.members) {
        const c = land.controller[r] ?? 0;
        if (c !== 0 && land.sideOf(c) === A) {
          ownLand = true;
          break;
        }
      }
    }
    const det = detectionPm(radarPmAt(air, A, sr), ownLand, detectPct, 0);
    const attackers: DuelPlanes[] = [];
    for (const f of shooters) {
      f.stats.forEach((stats, g) => {
        if (f.milli[g] > 0)
          attackers.push({
            stats: aceStats(air, f.id, stats),
            milli: f.milli[g],
            weight: 1,
          });
      });
    }
    // The kill power splits over the enemy sides by their weighted sorties.
    const massOf = (B: number) => {
      let m = 0;
      for (const f of flights) {
        if (f.side === B) m += Math.floor((f.total * weightOf(f)) / 100);
      }
      return m;
    };
    const masses = enemies.map(massOf);
    // The night factor's shooters (built once, only for a night raid).
    let shooterIds: number[] | undefined;
    const shooterIdsOf = (): number[] =>
      (shooterIds ??= shooters.map((x) => x.id));
    const allMass = masses.reduce((a, b) => a + b, 0);
    if (allMass === 0) continue;
    enemies.forEach((B, bi) => {
      if (masses[bi] === 0) return;
      const targets = flights.filter((f) => f.side === B);
      const defenders: DuelPlanes[] = [];
      for (const f of targets) {
        const weight = weightOf(f);
        f.stats.forEach((stats, g) => {
          if (f.milli[g] > 0)
            defenders.push({
              stats: aceStats(air, f.id, stats),
              milli: f.milli[g],
              weight,
            });
        });
      }
      let loss = airDuelMilli(attackers, defenders, det);
      if (enemies.length > 1) {
        loss = Math.floor(
          (loss * Math.floor((masses[bi] * 1000) / allMass)) / 1000,
        );
      }
      const parts = splitByWeight(
        loss,
        targets.map((f) => Math.floor((f.total * weightOf(f)) / 100)),
      );
      targets.forEach((f, i) => {
        const cut = econ.country(f.owner)?.stats.airLossCutPct ?? 0;
        const milli = Math.floor((parts[i] * (100 - Math.min(100, cut))) / 100);
        const nightBp =
          night && f.mission === M_BOMB
            ? nightLossBp(air, night, f, shooterIdsOf())
            : 10_000;
        addLoss(pending, f.id, Math.floor((milli * nightBp) / 10_000), lead);
      });
    });
  }
}

/** Spec §14.8's industrial weight of a region (× 2, so the halves stay whole). */
function industryWeight2(air: WwAir, r: number): number {
  const e = air.econ;
  const n = (b: BuildingId) => effectiveBuildings(e, r, b);
  return (
    2 *
      (n("civ") + n("mil") + n("dock") + n("synthetic_refinery") + n("infra")) +
    n("naval_base") +
    n("air_base") +
    n("anti_air") +
    n("radar")
  );
}

/**
 * Spec §14.4 (land zones): close air support, strategic bombing and port
 * strike sorties lose the targets' AA ‰ a day: the target region's AA
 * level × 3 (an enemy's region only), plus for CAS the enemy line
 * divisions' air attack / 100, × (100 + the defender's aaPct) / 100.
 * Targets: CAS — the battles in the zone our side fights, by our line
 * divisions; bombing — the enemy regions A2 may bomb, by §14.8's weight;
 * port strike — the enemy's working naval bases in the zone, equally.
 * Ships' AA (naval and port strikes at sea) is A2's.
 */
function landAntiAir(
  air: WwAir,
  sr: number,
  flights: readonly AirFlight[],
  pending: Map<number, PendingLoss>,
  night: boolean,
): void {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "land") return;
  const land = air.land;
  const econ = air.econ;
  const aaPctOf = (c: number) => econ.country(c)?.stats.aaPct ?? 0;
  const enemyOfSide = (side: number, c: number) => {
    if (c === 0) return false;
    for (const m of land.sideMembers(side)) {
      if (land.isEnemy(m, c)) return true;
    }
    return false;
  };
  /** side → mission → [‰, by]. */
  const memo = new Map<string, [number, number]>();
  const rateOf = (side: number, mission: number): [number, number] => {
    const key = `${side}:${mission}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let wSum = 0;
    let pmSum = 0;
    let by = 0;
    let byW = -1;
    const add = (w: number, pm0: number, who: number) => {
      if (w <= 0) return;
      // P6 (spec §9.3, T1b): the defender's proximity fuze, ×1.5 (its
      // guns' and its divisions' anti-air).
      const pm = withFuze(air.ww.depth, who, pm0);
      wSum += w;
      pmSum += w * pm;
      if (w > byW) {
        byW = w;
        by = who;
      }
    };
    if (mission === M_CAS) {
      const t = land.divisions;
      for (const r of s.members) {
        const b = land.battles.get(r);
        if (b === undefined) continue;
        const weAttack = land.sideOf(b.attLead) === side;
        if (!weAttack && land.sideOf(b.defLead) !== side) continue;
        const other = weAttack ? b.defLead : b.attLead;
        if (!enemyOfSide(side, other)) continue;
        let ours = 0;
        for (const id of weAttack ? b.attLine : b.defLine) {
          if (t.rowOf(id) >= 0) ours++;
        }
        let enemyAa = 0;
        for (const id of weAttack ? b.defLine : b.attLine) {
          const row = t.rowOf(id);
          if (row >= 0) enemyAa += land.baseStatsOf(row).airAtk;
        }
        // The region's guns fire on us where we attack (its controller defends).
        const aa = weAttack ? effectiveLevel(econ, r, "anti_air") : 0;
        add(ours, aaLossPm(aa, enemyAa, aaPctOf(other), true), other);
      }
    } else {
      for (const r of s.members) {
        const ctrl = land.controller[r] ?? 0;
        if (!enemyOfSide(side, ctrl)) continue;
        if (mission === M_BOMB) {
          if (sc.region(r) === undefined) continue;
          add(
            industryWeight2(air, r),
            aaLossPm(
              effectiveLevel(econ, r, "anti_air"),
              0,
              aaPctOf(ctrl),
              false,
            ),
            ctrl,
          );
        } else if (navalPort(air.ww, r)) {
          add(
            1,
            aaLossPm(
              effectiveLevel(econ, r, "anti_air"),
              0,
              aaPctOf(ctrl),
              false,
            ),
            ctrl,
          );
        }
      }
    }
    const v: [number, number] = [wSum === 0 ? 0 : Math.floor(pmSum / wSum), by];
    memo.set(key, v);
    return v;
  };
  for (const f of flights) {
    if (f.mission !== M_CAS && f.mission !== M_BOMB && f.mission !== M_PORT) {
      continue;
    }
    const [pm, by] = rateOf(f.side, f.mission);
    if (pm <= 0) continue;
    // P6 (spec §15.3, HOI4): the guns hit night raiders half as often.
    const milli = Math.floor((f.total * pm) / 1000);
    addLoss(
      pending,
      f.id,
      Math.floor((milli * nightLossBp(air, night, f)) / 10_000),
      by,
    );
  }
}

/**
 * The losses all at once (spec §14.3): each deployment's milli join its
 * remainder, whole planes go, the oldest generation first (the stock
 * sends the newest out first, so the oldest are the ones left in the
 * air), through WwAir.shootDown (P5's kill site) — a carrier wing's off
 * its deck too. The killer is the one that caused the most.
 */
function takeLosses(
  air: WwAir,
  pending: Map<number, PendingLoss>,
  day: number,
  shotDown: Map<number, number>,
  lost: Map<number, number>,
): void {
  const ids = [...pending.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const d = air.deployments.get(id);
    const p = pending.get(id)!;
    if (d === undefined) continue;
    // P6 (spec §5.4.2, lane E): design planes' reliability, by count.
    d.lossRest += Math.floor(
      (p.milli * planesLossBp(air.ww.depth, d.owner, d.counts, d.dcounts)) /
        10_000,
    );
    air.markDeployment(id);
    const whole = Math.floor(d.lossRest / 1000);
    if (whole <= 0) continue;
    // The oldest first (P6: the design slots at their year).
    const out = oldestFirst(
      air.ww.depth,
      d.owner,
      AIR_TYPES[d.type],
      d.counts,
      d.dcounts,
      whole,
    );
    const took = out.gens;
    const tookD = out.slots;
    let by = 0;
    let byMilli = -1;
    for (const [who, m] of [...p.by].sort((a, b) => a[0] - b[0])) {
      if (m > byMilli) {
        by = who;
        byMilli = m;
      }
    }
    const n = air.shootDown(
      id,
      tookD === null ? took : [...took, ...tookD],
      by,
    );
    if (n <= 0) continue;
    d.lossRest -= n * 1000;
    if (deploymentPlanes(d) === 0) d.lossRest = 0;
    if (isCarrierWing(d)) takeOffDeck(air, d, took, tookD);
    air.planesLostTotal += n;
    lost.set(d.owner, (lost.get(d.owner) ?? 0) + n);
    if (by > 0) shotDown.set(by, (shotDown.get(by) ?? 0) + n);
    const slot = ((day % 30) + 30) % 30;
    const own = air.country(d.owner);
    if (own !== null) own.tally[1][slot] += n;
    const killer = by > 0 ? air.country(by) : null;
    if (killer !== null) killer.tally[0][slot] += n;
  }
}

/**
 * Spec §18.10 `ww1936_air_superiority`: a side's superiority over the zone
 * crossed 50% (up or down); its countries at war that have the zone as a
 * front (we fly there, an enemy flies there, or — a land zone — our side
 * and an enemy both hold ground in it) are told, at most once in 7 days a
 * side and zone. The days are state (ZoneAirState.alertDay, snapshotted
 * and hashed), so a restored game repeats or skips none.
 */
function superiorityAlerts(
  air: WwAir,
  z: ZoneAirState,
  sr: number,
  day: number,
  before: ReadonlyMap<number, number>,
  after: ReadonlyMap<number, number>,
  flights: readonly AirFlight[],
): void {
  const sc = air.ww.scenario;
  const s = sc.sr(sr)!;
  const land = air.land;
  const sides = new Set<number>([...before.keys(), ...after.keys()]);
  for (const side of [...sides].sort((a, b) => a - b)) {
    const was = before.get(side) ?? 0;
    const now = after.get(side) ?? 0;
    if (was > 500 === now > 500) continue;
    if (z.alertDay.has(side)) continue;
    const told: number[] = [];
    for (const c of land.sideMembers(side)) {
      if (!air.ww.hasWar(c)) continue;
      const front =
        flights.some((f) => f.owner === c || land.isEnemy(c, f.owner)) ||
        (s.kind === "land" &&
          s.members.some((r) => land.isEnemy(c, land.controller[r] ?? 0)) &&
          s.members.some((r) => land.sameSide(c, land.controller[r] ?? 0)));
      if (front) told.push(c);
    }
    if (told.length === 0) continue;
    // Map order is key order (Global Constraints): insert sorted. Day 0 is
    // a day too (sortedMap drops zeros: Task 15).
    z.alertDay = new Map(
      [...z.alertDay, [side, day] as [number, number]].sort(
        (a, b) => a[0] - b[0],
      ),
    );
    for (const c of told) {
      air.message(c, "events_display.ww1936_air_superiority", {
        sr,
        pct: Math.floor(now / 10),
        gained: now > 500 ? 1 : 0,
      });
    }
  }
}

/**
 * Derived (one tick and war version, Task 15's perf pass): the sides with
 * a member at war (past the preparation minute) with a member of side
 * `F`, in sideList order — every zone's day asked it of every side.
 */
const enemySidesMemo = new WeakMap<
  WwAir,
  { stamp: string; m: Map<number, readonly { key: number }[]> }
>();

function enemySidesOf(air: WwAir, F: number): readonly { key: number }[] {
  const land = air.land;
  const stamp = `${air.mg.ticks()}|${air.ww.warVer}|${land.derivedEpoch}`;
  let memo = enemySidesMemo.get(air);
  if (memo === undefined || memo.stamp !== stamp) {
    memo = { stamp, m: new Map() };
    enemySidesMemo.set(air, memo);
  }
  let out = memo.m.get(F);
  if (out === undefined) {
    const members = land.sideMembers(F);
    out = land
      .sideList()
      .filter(
        (S) =>
          S.key !== F &&
          S.members.some((c) => members.some((m) => land.isEnemy(c, m))),
      );
    memo.m.set(F, out);
  }
  return out;
}

function sameNumberMap(
  a: ReadonlyMap<number, number>,
  b: ReadonlyMap<number, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function zoneIsEmpty(z: ZoneAirState): boolean {
  return (
    z.sup.size === 0 &&
    z.enemySup.size === 0 &&
    z.enemyPp.size === 0 &&
    z.sorties.size === 0 &&
    z.result.size === 0 &&
    z.navalSearch.size === 0 &&
    z.navalAsw.size === 0 &&
    z.navalStrike.size === 0 &&
    z.fightersSup.size === 0
  );
}

/**
 * The alerts' days past the spacing are forgotten (the state stays
 * small), first thing on the zone's day — before the emptiness check, so
 * a quiet zone with an old alert is empty (Task 15: it was cleared and
 * sent to the screens again every day until the alert aged out).
 */
function pruneAlerts(z: ZoneAirState, day: number): void {
  if (z.alertDay.size === 0) return;
  for (const [side, last] of [...z.alertDay]) {
    if (day - last >= SUP_ALERT_DAYS) z.alertDay.delete(side);
  }
}

/** Puts a key-ordered copy of `m` (non-zero values only). */
function sortedMap(m: ReadonlyMap<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [k, v] of [...m].sort((a, b) => a[0] - b[0])) {
    if (v !== 0) out.set(k, v);
  }
  return out;
}

/**
 * A zone's day (spec §14.2–§14.5), then A2's effects in the same call:
 * ① sorties and fuel, ② the air battles of the sides at war, ③ land AA,
 * ④ the losses at once, ⑤ superiority by side (setAirSup), the worst enemy
 * superiority by side and the battlefield-support bonus of the enemy that
 * holds it (enemySup, enemyPp: the land war's penalty), the sorties
 * by side and type, each country's naval air and superiority fighters
 * (N1, milli-sorties) and results, ⑥ the 50% alerts.
 */
export function dailyAirZone(air: WwAir, sr: number, day: number): void {
  const sc = air.ww.scenario;
  const idx = sc.srIdxOf(sr);
  if (idx < 0) return;
  const z = air.zoneState[idx];
  pruneAlerts(z, day);
  const flights = flightsOf(air, sr, day, true);
  lastFlights.set(air, { tick: air.mg.ticks(), sr, flights });
  if (flights.length === 0) {
    if (!zoneIsEmpty(z)) {
      const before = z.sup;
      air.setAirSup(sr, new Map());
      z.enemySup = new Map();
      z.enemyPp = new Map();
      z.sorties = new Map();
      z.result = new Map();
      z.navalSearch = new Map();
      z.navalAsw = new Map();
      z.navalStrike = new Map();
      z.fightersSup = new Map();
      superiorityAlerts(air, z, sr, day, before, z.sup, flights);
      air.markZone(idx);
    }
    return;
  }
  const sides = [...new Set(flights.map((f) => f.side))].sort((a, b) => a - b);
  const war = new Map<string, boolean>();
  const atWar = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let v = war.get(key);
    if (v === undefined) war.set(key, (v = sidesAtWar(air, a, b)));
    return v;
  };
  // ②–④
  const pending = new Map<number, PendingLoss>();
  const night = nightIn(air, flights);
  airBattles(air, sr, flights, sides, atWar, pending, night);
  landAntiAir(air, sr, flights, pending, night);
  const shotDown = new Map<number, number>();
  const lost = new Map<number, number>();
  takeLosses(air, pending, day, shotDown, lost);
  // ⑤ superiority (spec §14.5): fighters on superiority at their weight,
  // on interception at half, every other sortie at 0.1 (its weight).
  const score = new Map<number, number>();
  const pp = new Map<number, number>();
  const sorties = new Map<number, number[]>();
  const search = new Map<number, number>();
  const asw = new Map<number, number>();
  const strike = new Map<number, number>();
  const fighters = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => {
    if (v !== 0) m.set(k, (m.get(k) ?? 0) + v);
  };
  for (const f of flights) {
    const ce = air.econ.country(f.owner);
    // P6 (spec §21.2, T1b): interception's share of the superiority,
    // half (P4) + interceptShareBp, at most whole.
    const intBp = Math.min(10_000, 5_000 + (ce?.stats.interceptShareBp ?? 0));
    let sc2 = 0;
    f.stats.forEach((st, g) => {
      const w = Math.floor((f.milli[g] * st.supWeightMilli) / 1000);
      sc2 += f.mission === M_INT ? Math.floor((w * intBp) / 10_000) : w;
    });
    add(score, f.side, sc2);
    // P6 (spec §21.2, T1b): enemyAirPenaltyPp beside P4's supPenaltyPp.
    pp.set(
      f.side,
      Math.max(
        pp.get(f.side) ?? 0,
        (ce?.stats.supPenaltyPp ?? 0) + (ce?.stats.enemyAirPenaltyPp ?? 0),
      ),
    );
    let row = sorties.get(f.side);
    if (row === undefined) sorties.set(f.side, (row = AIR_TYPES.map(() => 0)));
    row[f.type] += f.total;
    if (f.mission === M_PATROL) {
      // P6 (spec §21.2, T1b): navalPatrolPct on the search.
      const pat = ce?.stats.navalPatrolPct ?? 0;
      const s0 =
        (f.type === T_NAVAL_BOMBER ? 3 : 1) *
        (f.total + radarPatrolExtra(air, f));
      add(
        search,
        f.owner,
        pat === 0 ? s0 : Math.floor((s0 * Math.max(0, 100 + pat)) / 100),
      );
      add(asw, f.owner, f.total);
    } else if (f.mission === M_STRIKE) {
      add(strike, f.owner, f.total);
    } else if (f.mission === M_SUP) {
      add(fighters, f.owner, f.total);
    }
  }
  const sup = new Map<number, number>();
  for (const A of sides) {
    let enemies = 0;
    for (const B of sides) if (atWar(A, B)) enemies += score.get(B) ?? 0;
    sup.set(A, airSupPm(score.get(A) ?? 0, enemies));
  }
  // The worst enemy superiority by side, for every side at war with a
  // side flying here (the land war's penalty and movement read it).
  const enemySup = new Map<number, number>();
  const enemyPp = new Map<number, number>();
  for (const F of sides) {
    const v = sup.get(F) ?? 0;
    if (v <= 0) continue;
    for (const S of enemySidesOf(air, F)) {
      const was = enemySup.get(S.key) ?? 0;
      const fp = pp.get(F) ?? 0;
      if (v > was || (v === was && fp > (enemyPp.get(S.key) ?? 0))) {
        enemySup.set(S.key, v);
        enemyPp.set(S.key, fp);
      }
    }
  }
  const before = z.sup;
  air.setAirSup(sr, sup);
  z.enemySup = sortedMap(enemySup);
  z.enemyPp = sortedMap(enemyPp);
  const nextSorties = new Map<number, number[]>();
  for (const [k, row] of [...sorties].sort((a, b) => a[0] - b[0])) {
    nextSorties.set(
      k,
      row.map((m) => Math.floor(m / 1000)),
    );
  }
  z.sorties = nextSorties;
  const result = new Map<number, number[]>();
  const owners = new Set<number>([
    ...flights.map((f) => f.owner),
    ...shotDown.keys(),
    ...lost.keys(),
  ]);
  for (const c of [...owners].sort((a, b) => a - b)) {
    result.set(c, [shotDown.get(c) ?? 0, lost.get(c) ?? 0, 0, 0, 0]);
  }
  z.result = result;
  z.navalSearch = sortedMap(search);
  z.navalAsw = sortedMap(asw);
  z.navalStrike = sortedMap(strike);
  z.fightersSup = sortedMap(fighters);
  if (!sameNumberMap(before, z.sup)) {
    superiorityAlerts(air, z, sr, day, before, z.sup, flights);
  }
  air.markZone(idx);
}
