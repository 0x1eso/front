// World War 1936 P4: what the sorties do (P4 spec §14.7–§14.10), lane A2
// (Task 8). A zone's day, right after A1's sorties, combat and superiority
// in the same call (its zoneFlights are the sorties): the close air
// support pool and its split over the battles by frontage, strategic bombing (Bombing.ts), naval and port
// strikes with the ships' anti-air, air supply into the side's regions.
// Naval patrol has no effect here (N1's spotting and C's escorts read its
// sorties, A1 writes them). Everything the land war reads later in the day
// is state of the zone (pre-flight A19): the CAS pool and shares, the air
// supply, computed on the zone's day.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  PlaneStats,
  WW_AIR_SUPPLY_PER_SORTIE_MILLI,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  casPoolCenti,
  casRoundHits,
} from "@openfront/engine-lib/ww1936/AirRules";
import {
  orgDamageMilli,
  shotDamageMilli,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import type { StrategicRegion } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { planesLossBp } from "../depth/Designs";
import { effectiveLevel } from "../economy/Buildings";
import { applyShipDamage } from "../navy/NavalBattles";
import { zoneFlights } from "./AirCombat";
import { apportion, sideMembersOf, strategicBombing } from "./Bombing";
import { isCarrierWing, takeOffDeck } from "./Deploy";
import { oldestFirst } from "./DesignPlanes";
import { withFuze } from "./ProjectEffects";
import type { Deployment, WwAir, ZoneAirState } from "./WwAir";

/** Spec §14.9: the hit chance of a naval strike (ships at sea) and a port strike (docked), ‰. */
export const WW_NAVAL_STRIKE_HIT_PM = 100;
export const WW_PORT_STRIKE_HIT_PM = 150;
/**
 * Spec §14.4: the strike planes lost to the ships' anti-air a day, milli
 * planes a centi of AA: 0.3 planes a point at sea, 0.5 in port; and 5
 * planes a level of the port's anti-air guns.
 */
const SHIP_AA_LOSS_SEA = 3;
const SHIP_AA_LOSS_PORT = 5;
const PORT_AA_LOSS_MILLI = 5_000;

/** The missions this file's day reads, in AIR_MISSIONS order. */
const EFFECT_MISSIONS: readonly AirMission[] = [
  "cas",
  "strategic_bombing",
  "naval_strike",
  "port_strike",
  "air_supply",
];

/** One generation of a deployment flying today. */
export interface Sortie {
  d: Deployment;
  /** The side it fights for (deploymentSide). */
  side: number;
  /** Generation, 1-based. */
  gen: number;
  /** Planes of that generation × the sortie efficiency ‰: milli-sorties. */
  milli: number;
  stats: PlaneStats;
}

/** What the day's effects did, by country (the zone's result row, the 30-day tallies). */
export interface EffectTally {
  /** CAS pool given, centi-hits. */
  cas: Map<number, number>;
  /** Bomb points given. */
  bomb: Map<number, number>;
  /** Ship HP taken off, milli. */
  naval: Map<number, number>;
  /** Ships sunk. */
  sunk: Map<number, number>;
}

function newTally(): EffectTally {
  return { cas: new Map(), bomb: new Map(), naval: new Map(), sunk: new Map() };
}

function addTo(m: Map<number, number>, k: number, v: number): void {
  if (v !== 0) m.set(k, (m.get(k) ?? 0) + v);
}

/**
 * The zone's day of mission effects (spec §2.2-7, after A1's combat in
 * the same call): CAS, strategic bombing, naval and port strikes, air
 * supply. The day's first zone (srIdx 0) starts the day's slot of the
 * 30-day rings this lane writes.
 */
export function airMissionEffects(air: WwAir, sr: number, day: number): void {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined) return;
  if (s.idx === 0) startRings(air, day);
  const z = air.zoneState[s.idx];
  const groups = new Map<AirMission, Map<number, Sortie[]>>(
    EFFECT_MISSIONS.map((m) => [m, new Map()]),
  );
  // The sorties A1's zone day flew this tick (before its losses).
  for (const f of zoneFlights(air, sr)) {
    const bySide = groups.get(AIR_MISSIONS[f.mission]);
    const d = air.deployments.get(f.id);
    if (bySide === undefined || d === undefined) continue;
    f.milli.forEach((milli, g) => {
      if (milli <= 0) return;
      let l = bySide.get(f.side);
      if (l === undefined) bySide.set(f.side, (l = []));
      l.push({ d, side: f.side, gen: g + 1, milli, stats: f.stats[g] });
    });
  }
  const fx = newTally();
  const tick = air.mg.ticks();
  const cas = closeAirSupport(air, s, groups.get("cas")!, fx);
  strategicBombing(air, sr, day, groups.get("strategic_bombing")!, fx);
  navalStrikes(air, s, groups.get("naval_strike")!, fx, tick);
  portStrikes(air, s, groups.get("port_strike")!, fx, tick);
  const supply = airSupplyDay(air, s, groups.get("air_supply")!, z.airSupply);
  let changed = false;
  if (!sameMap(z.cas, cas.pool)) {
    z.cas = cas.pool;
    changed = true;
  }
  if (!sameTriples(z.casShare, cas.share)) {
    z.casShare = cas.share;
    changed = true;
  }
  if (!sameTriples(z.airSupply, supply)) {
    z.airSupply = supply;
    changed = true;
  }
  if (writeResults(air, z, fx, day)) changed = true;
  if (changed) air.markZone(s.idx);
}

/** The day's slot of the rings this lane writes: bomb points taken, bombs given, ships sunk. */
function startRings(air: WwAir, day: number): void {
  const slot = ((day % 30) + 30) % 30;
  for (const c of air.countries()) {
    if (c.bombTaken[slot] !== 0 || c.tally[2][slot] !== 0) {
      air.markCountry(c.smallID);
    }
    c.bombTaken[slot] = 0;
    c.tally[2][slot] = 0;
    c.tally[3][slot] = 0;
  }
}

// ---- Close air support (spec §14.7) ----

/** Σ combat width of the divisions (ids) still alive. */
function widthOfIds(air: WwAir, ids: readonly number[]): number {
  const land = air.land;
  let w = 0;
  for (const id of ids) {
    const r = land.divisions.rowOf(id);
    if (r >= 0) w += land.widthOf(r);
  }
  return w;
}

/**
 * Spec §14.7: each side's pool = Σ casPoolCenti(sorties, ground attack,
 * casPct) (the doctrine techs feed casPct); its split ‰ over the zone's
 * battles its divisions fight in, by their frontage in the battle's line
 * now (pre-flight A19: P2 keeps no daily frontage; a battle not yet lined
 * up counts its divisions). No-strike regions get no CAS (P6 pre-flight).
 */
function closeAirSupport(
  air: WwAir,
  s: StrategicRegion,
  bySide: ReadonlyMap<number, readonly Sortie[]>,
  fx: EffectTally,
): { pool: Map<number, number>; share: [number, number, number][] } {
  const pool = new Map<number, number>();
  const share: [number, number, number][] = [];
  if (s.kind !== "land" || bySide.size === 0) return { pool, share };
  const land = air.land;
  const sc = air.ww.scenario;
  for (const side of [...bySide.keys()].sort((a, b) => a - b)) {
    let p = 0;
    for (const x of bySide.get(side)!) {
      const pct = air.econ.country(x.d.owner)?.stats.casPct ?? 0;
      const c = casPoolCenti(x.milli, x.stats.ground, pct);
      p += c;
      addTo(fx.cas, x.d.owner, c);
    }
    if (p > 0) pool.set(side, p);
  }
  for (const side of pool.keys()) {
    const fronts: [number, number][] = [];
    for (const r of s.members) {
      const b = land.battles.get(r);
      if (b === undefined || isNoStrike(sc, r)) continue;
      let w = 0;
      if (land.sideOf(b.attLead) === side) {
        w += widthOfIds(air, b.attLine.length > 0 ? b.attLine : b.attackers);
      } else if (land.sideOf(land.controller[r] ?? 0) === side) {
        w += widthOfIds(air, b.defLine.length > 0 ? b.defLine : b.defenders);
      }
      if (w > 0) fronts.push([r, w]);
    }
    const pms = apportion(
      1000,
      fronts.map((f) => f[1]),
    );
    fronts.forEach(([r], i) => {
      if (pms[i] > 0) share.push([r, side, pms[i]]);
    });
  }
  share.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { pool, share };
}

/**
 * Spec §14.7: `side`'s close air support hits a round in the battle of
 * `battleRegion`, centi (the hooks; P2's round cuts them by the target's
 * and the region's anti-air): the round's share (casRoundHits) of the
 * zone's pool split by frontage.
 */
export function casHitsFor(
  air: WwAir,
  battleRegion: number,
  side: number,
): number {
  const sc = air.ww.scenario;
  const i = sc.srIdxOf(sc.regionSr(battleRegion));
  if (i < 0) return 0;
  const z = air.zoneState[i];
  const pool = z.cas.get(side) ?? 0;
  if (pool <= 0) return 0;
  for (const [r, sd, pm] of z.casShare) {
    if (r === battleRegion && sd === side) {
      return casRoundHits(Math.floor((pool * pm) / 1000));
    }
  }
  return 0;
}

// ---- Naval and port strikes (spec §14.9, §14.4) ----

/** Is country `c` at war with a member of `side`? */
function enemyOfSide(air: WwAir, side: number, c: number): boolean {
  if (c === 0) return false;
  const land = air.land;
  return sideMembersOf(land, side).some((m) => land.isEnemy(m, c));
}

/**
 * Spec §14.9: strikes on enemy fleets at sea in the zone — the ones the
 * side has spotted (N1) and the ones in a naval battle there.
 */
function navalStrikes(
  air: WwAir,
  s: StrategicRegion,
  bySide: ReadonlyMap<number, readonly Sortie[]>,
  fx: EffectTally,
  tick: number,
): void {
  if (s.kind !== "sea" || bySide.size === 0) return;
  const navy = air.navy;
  for (const side of [...bySide.keys()].sort((a, b) => a - b)) {
    const fleets = new Set<number>();
    for (const zone of s.members) {
      for (const id of navy.fleetsIn(zone)) {
        const f = navy.fleets.get(id);
        if (f === undefined || f.docked !== 0) continue;
        if (!enemyOfSide(air, side, f.owner)) continue;
        if (navy.spotted(side, id)) fleets.add(id);
      }
      const b = navy.battles.get(zone);
      if (b === undefined) continue;
      for (const id of [...b.fleets[0], ...b.fleets[1]]) {
        const f = navy.fleets.get(id);
        if (f !== undefined && enemyOfSide(air, side, f.owner)) fleets.add(id);
      }
    }
    const ships: number[] = [];
    for (const id of [...fleets].sort((a, b) => a - b)) {
      ships.push(...navy.fleets.get(id)!.ships);
    }
    strike(
      air,
      bySide.get(side)!,
      ships,
      WW_NAVAL_STRIKE_HIT_PM,
      SHIP_AA_LOSS_SEA,
      0,
      fx,
      tick,
    );
  }
}

/**
 * Spec §14.9: the ships docked at the zone's enemy naval bases — a land
 * zone's member ports, a sea zone's ports whose harbor zone is in it;
 * never a no-strike region's (P6 pre-flight).
 */
function portStrikes(
  air: WwAir,
  s: StrategicRegion,
  bySide: ReadonlyMap<number, readonly Sortie[]>,
  fx: EffectTally,
  tick: number,
): void {
  if (bySide.size === 0) return;
  const sc = air.ww.scenario;
  const navy = air.navy;
  const ports =
    s.kind === "land"
      ? s.members.filter((r) => sc.harborOf(r) !== 0)
      : sc.landRegions
          .map((r) => r.id)
          .filter((r) => s.members.includes(sc.harborOf(r)));
  for (const side of [...bySide.keys()].sort((a, b) => a - b)) {
    const ships: number[] = [];
    const portOf = new Map<number, number>();
    let baseAaMilli = 0;
    for (const port of ports) {
      if (isNoStrike(sc, port)) continue;
      let any = false;
      for (const id of navy.fleetsIn(sc.harborOf(port))) {
        const f = navy.fleets.get(id);
        if (f === undefined || f.docked !== port) continue;
        if (!enemyOfSide(air, side, f.owner)) continue;
        ships.push(...f.ships);
        for (const sh of f.ships) portOf.set(sh, port);
        any = true;
      }
      if (any) {
        // P6 (spec §9.3, T1b): the port's holder's proximity fuze.
        baseAaMilli += withFuze(
          air.ww.depth,
          air.land.controller[port] ?? 0,
          effectiveLevel(air.econ, port, "anti_air") * PORT_AA_LOSS_MILLI,
        );
      }
    }
    ships.sort((a, b) => a - b);
    strike(
      air,
      bySide.get(side)!,
      ships,
      WW_PORT_STRIKE_HIT_PM,
      SHIP_AA_LOSS_PORT,
      baseAaMilli,
      fx,
      tick,
      portOf,
    );
  }
}

interface Target {
  id: number;
  owner: number;
  vis: number;
  visPm: number;
  hp: number;
  maxHp: number;
  maxOrg: number;
  aa: number;
}

/**
 * Spec §14.9 for one side on its targets (ship ids ascending): the day's
 * attack = Σ sorties × naval attack × (100 + navalStrikePct) / 100 (each
 * owner's stats), hit × the target's visibility factor × pierce 1000.
 * Half goes to the most visible ships, the lowest HP share first, the
 * overflow on to the next; half by visibility. Then the anti-air's losses
 * (spec §14.4) on the side's strike deployments.
 */
function strike(
  air: WwAir,
  sorties: readonly Sortie[],
  shipIds: readonly number[],
  hitPm: number,
  aaLossPerCenti: number,
  baseAaMilli: number,
  fx: EffectTally,
  tick: number,
  portOf?: ReadonlyMap<number, number>,
): void {
  if (shipIds.length === 0) return;
  const navy = air.navy;
  const t = navy.ships;
  const byOwner = new Map<number, number>();
  let attack = 0;
  for (const x of sorties) {
    const pct = air.econ.country(x.d.owner)?.stats.navalStrikePct ?? 0;
    const c = Math.floor(
      (Math.floor((x.milli * x.stats.naval) / 1000) * Math.max(0, 100 + pct)) /
        100,
    );
    if (c <= 0) continue;
    attack += c;
    byOwner.set(x.d.owner, (byOwner.get(x.d.owner) ?? 0) + c);
  }
  if (attack <= 0) return;
  const targets: Target[] = [];
  for (const id of shipIds) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const st = navy.shipStatsOf(r);
    targets.push({
      id,
      owner: t.owner[r],
      vis: st.vis,
      visPm: visFactorPm(st.vis, false),
      hp: t.hp[r],
      maxHp: st.hpMilli,
      maxOrg: st.orgMilli,
      aa: st.aa,
    });
  }
  if (targets.length === 0) return;
  // The ships' anti-air before the damage (spec §14.4).
  let aaMilli = baseAaMilli;
  const aaByOwner = new Map<number, number>();
  for (const x of targets) {
    // P6 (spec §9.3, T1b): the ship owner's proximity fuze.
    aaMilli += withFuze(air.ww.depth, x.owner, x.aa * aaLossPerCenti);
    aaByOwner.set(x.owner, (aaByOwner.get(x.owner) ?? 0) + x.aa);
  }
  const dmg = new Array<number>(targets.length).fill(0);
  // Half focused: the most visible, the lowest HP share first.
  const order = targets
    .map((_, i) => i)
    .sort((a, b) => {
      const x = targets[a];
      const y = targets[b];
      return y.vis - x.vis || x.hp * y.maxHp - y.hp * x.maxHp || x.id - y.id;
    });
  let left = Math.floor(attack / 2);
  for (const i of order) {
    if (left <= 0) break;
    const x = targets[i];
    const room = x.hp - dmg[i];
    if (room <= 0) continue;
    const full = shotDamageMilli(left, 0, hitPm, x.visPm, 1000, 1000, 1000);
    if (full <= room) {
      dmg[i] += full;
      break;
    }
    dmg[i] += room;
    left -= Math.ceil((room * 100_000) / (hitPm * x.visPm));
  }
  // Half spread by visibility.
  const spread = attack - Math.floor(attack / 2);
  const shares = apportion(
    1000,
    targets.map((x) => x.vis),
  );
  targets.forEach((x, i) => {
    const room = x.hp - dmg[i];
    if (room <= 0 || shares[i] <= 0) return;
    dmg[i] += Math.min(
      room,
      shotDamageMilli(spread, 0, hitPm, x.visPm, 1000, 1000, shares[i]),
    );
  });
  const by = topKey(byOwner);
  let total = 0;
  let sunk = 0;
  targets.forEach((x, i) => {
    if (dmg[i] <= 0) return;
    total += dmg[i];
    const port = portOf?.get(x.id);
    if (port !== undefined)
      air.raidNotes.note(air, x.owner, by, port, 0, 1, dmg[i]);
    applyShipDamage(
      navy,
      x.id,
      dmg[i],
      orgDamageMilli(dmg[i], x.maxOrg, x.maxHp),
      tick,
      by,
    );
    if (t.rowOf(x.id) < 0) sunk++;
  });
  for (const [owner, c] of byOwner) {
    addTo(fx.naval, owner, Math.floor((total * c) / attack));
  }
  addTo(fx.sunk, by, sunk);
  takeLosses(air, sorties, aaMilli, topKey(aaByOwner));
}

/** The key with the largest value (ties: the smaller key); 0 when empty. */
function topKey(m: ReadonlyMap<number, number>): number {
  let best = 0;
  let bestV = -1;
  for (const [k, v] of m) {
    if (v > bestV || (v === bestV && k < best)) {
      best = k;
      bestV = v;
    }
  }
  return best;
}

/**
 * Spec §14.4: `lossMilli` planes lost, split over the sorties'
 * deployments by their sorties (largest remainder), each deployment's
 * remainder kept in lossRest; whole planes go, the oldest generation
 * first, through WwAir.shootDown (P5's kill site), credited to `by`.
 */
function takeLosses(
  air: WwAir,
  sorties: readonly Sortie[],
  lossMilli: number,
  by: number,
): void {
  if (lossMilli <= 0) return;
  const flown = new Map<number, number>();
  for (const x of sorties) {
    flown.set(x.d.id, (flown.get(x.d.id) ?? 0) + x.milli);
  }
  const ids = [...flown.keys()].sort((a, b) => a - b);
  let all = 0;
  for (const id of ids) all += flown.get(id)!;
  const parts = apportion(
    Math.min(lossMilli, all),
    ids.map((id) => flown.get(id)!),
  );
  ids.forEach((id, i) => {
    const d = air.deployments.get(id);
    if (d === undefined || parts[i] <= 0) return;
    // P6 (spec §5.4.2, lane E): design planes' reliability, by count.
    const depth = air.ww.depth;
    d.lossRest += Math.floor(
      (parts[i] * planesLossBp(depth, d.owner, d.counts, d.dcounts)) / 10_000,
    );
    air.markDeployment(id);
    const n = Math.floor(d.lossRest / 1000);
    if (n <= 0) return;
    d.lossRest -= n * 1000;
    // The oldest first (P6: the design slots at their year).
    const out = oldestFirst(
      depth,
      d.owner,
      AIR_TYPES[d.type],
      d.counts,
      d.dcounts,
      n,
    );
    const counts = out.slots === null ? out.gens : [...out.gens, ...out.slots];
    const lost = air.shootDown(id, counts, by);
    air.planesLostTotal += lost;
    // T1b: a carrier wing's losses come off its deck too (the record
    // mirrors the deck: without this the deck kept them, the ledger not).
    if (lost > 0 && isCarrierWing(d)) takeOffDeck(air, d, out.gens, out.slots);
  });
}

// ---- Air supply (spec §14.10) ----

/**
 * Spec §14.10: each side's transports on air_supply give sorties × 0.02
 * supply a day (100 = 2,000 milli) to the zone's regions of the side
 * short of supply: the encircled ones first, then the lowest supply share,
 * each what it lacks (its use less its ground supply: the region's supply
 * less yesterday's air supply there). [region, side, milli], in order.
 */
function airSupplyDay(
  air: WwAir,
  s: StrategicRegion,
  bySide: ReadonlyMap<number, readonly Sortie[]>,
  before: readonly [number, number, number][],
): [number, number, number][] {
  const out: [number, number, number][] = [];
  if (s.kind !== "land" || bySide.size === 0) return out;
  const land = air.land;
  for (const side of [...bySide.keys()].sort((a, b) => a - b)) {
    let pool = 0;
    for (const x of bySide.get(side)!) {
      pool += Math.floor((x.milli * WW_AIR_SUPPLY_PER_SORTIE_MILLI) / 1000);
    }
    if (pool <= 0) continue;
    const short: { r: number; enc: number; pm: number; need: number }[] = [];
    for (const r of s.members) {
      const c = land.controller[r] ?? 0;
      if (c === 0 || land.sideOf(c) !== side) continue;
      let had = 0;
      for (const [br, bs, m] of before) if (br === r && bs === side) had = m;
      const ground = Math.max(0, land.supplyMilli[r] - had);
      const use = land.useMilli[r];
      if (use <= ground) continue;
      short.push({
        r,
        enc: land.encircled[r],
        pm: Math.floor((ground * 1000) / use),
        need: use - ground,
      });
    }
    short.sort((a, b) => b.enc - a.enc || a.pm - b.pm || a.r - b.r);
    for (const x of short) {
      if (pool <= 0) break;
      const give = Math.min(pool, x.need);
      out.push([x.r, side, give]);
      pool -= give;
    }
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out;
}

/** Spec §14.10: air supply into `region` for `side`, milli a day (the hooks): the zone's day's share. */
export function airSupplyAt(air: WwAir, region: number, side: number): number {
  const sc = air.ww.scenario;
  const i = sc.srIdxOf(sc.regionSr(region));
  if (i < 0) return 0;
  for (const [r, s, m] of air.zoneState[i].airSupply) {
    if (r === region && s === side) return m;
  }
  return 0;
}

// ---- The zone's results ----

/**
 * The zone's result row per country: this lane's columns (CAS hits, bomb
 * points, naval damage; A1 writes shot down and lost) for today, and the
 * 30-day tallies (bombs given, ships sunk). True when the row changed.
 */
function writeResults(
  air: WwAir,
  z: ZoneAirState,
  fx: EffectTally,
  day: number,
): boolean {
  const slot = ((day % 30) + 30) % 30;
  for (const [owner, v] of fx.bomb) {
    const c = air.country(owner);
    if (c === null) continue;
    c.tally[2][slot] += v;
    air.markCountry(owner);
  }
  for (const [owner, v] of fx.sunk) {
    const c = air.country(owner);
    if (c === null) continue;
    c.tally[3][slot] += v;
    air.markCountry(owner);
  }
  const keys = new Set<number>([
    ...z.result.keys(),
    ...fx.cas.keys(),
    ...fx.bomb.keys(),
    ...fx.naval.keys(),
  ]);
  const next = new Map<number, number[]>();
  for (const k of [...keys].sort((a, b) => a - b)) {
    const v = [...(z.result.get(k) ?? [])];
    while (v.length < 5) v.push(0);
    v[2] = fx.cas.get(k) ?? 0;
    v[3] = fx.bomb.get(k) ?? 0;
    v[4] = fx.naval.get(k) ?? 0;
    if (v.some((x) => x !== 0)) next.set(k, v);
  }
  let same = next.size === z.result.size;
  if (same) {
    for (const [k, v] of next) {
      const o = z.result.get(k);
      if (
        o === undefined ||
        o.length !== v.length ||
        o.some((x, i) => x !== v[i])
      ) {
        same = false;
        break;
      }
    }
  }
  if (same) return false;
  z.result = next;
  return true;
}

function sameMap(
  a: ReadonlyMap<number, number>,
  b: ReadonlyMap<number, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function sameTriples(
  a: readonly (readonly [number, number, number])[],
  b: readonly (readonly [number, number, number])[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (x, i) => x[0] === b[i][0] && x[1] === b[i][1] && x[2] === b[i][2],
  );
}
