// World War 1936 P4: what the sorties do (P4 spec §14.7–§14.10), lane A2
// (Task 8). A zone's day, right after A1's sorties, combat and superiority
// in the same call (its zoneFlights are the sorties): the close air
// support pool and its split over the battles by frontage, strategic bombing (Bombing.ts), naval and port
// strikes with the ships' anti-air, air supply into the side's regions.
// Naval patrol has no effect here (N1's spotting and C's escorts read its
// sorties, A1 writes them). Everything the land war reads later in the day
// is state of the zone (pre-flight A19): the CAS pool and shares, the air
// supply, computed on the zone's day.
import { AIR_TYPES, PlaneStats } from "@openfront/engine-api/ww1936/AirTypes";
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
import { apportion, sideMembersOf } from "./Bombing";
import { isCarrierWing, takeOffDeck } from "./Deploy";
import { oldestFirst } from "./DesignPlanes";
import { withFuze } from "./ProjectEffects";
import type { Wing, WwAir } from "./WwAir";
const PORT_AA_LOSS_MILLI = 5_000;

/** One generation of a deployment flying today. */
export interface Sortie {
  d: Wing;
  /** The side it fights for (wingSide). */
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

export function newTally(): EffectTally {
  return { cas: new Map(), bomb: new Map(), naval: new Map(), sunk: new Map() };
}

function addTo(m: Map<number, number>, k: number, v: number): void {
  if (v !== 0) m.set(k, (m.get(k) ?? 0) + v);
}

// ---- Close air support (spec §14.7) ----

/**
 * Spec §14.7: `side`'s close air support hits a round in the battle of
 * `battleRegion`, centi (the hooks; P2's round cuts them by the target's
 * and the region's anti-air): the CAS wings on station over it now.
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
  // ww8: the wings on station now (the pulses keep the rows).
  const rows = z.casNow;
  for (let k = 0; k < rows.length; k++) {
    if (rows[k][0] === battleRegion && rows[k][1] === side) return rows[k][2];
  }
  return 0;
}

// ---- Naval and port strikes (spec §14.9, §14.4) ----

/** Is country `c` at war with a member of `side`? */
export function enemyOfSide(air: WwAir, side: number, c: number): boolean {
  if (c === 0) return false;
  const land = air.land;
  return sideMembersOf(land, side).some((m) => land.isEnemy(m, c));
}

/**
 * The ship ids (ascending by fleet) of the enemy fleets `side` may strike at
 * sea in the sea zone `s`: the ones it has spotted (N1) and the ones in a
 * naval battle there. `only`: just that sea zone of its members (ww8).
 */
export function seaShipsFor(
  air: WwAir,
  s: StrategicRegion,
  side: number,
  only = 0,
): number[] {
  const navy = air.navy;
  const fleets = new Set<number>();
  for (const zone of s.members) {
    if (only !== 0 && zone !== only) continue;
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
  return ships;
}

/** The ports of a zone: a land zone's member ports, a sea zone's ports whose harbor zone is in it. */
export function portsOf(air: WwAir, s: StrategicRegion): number[] {
  const sc = air.ww.scenario;
  return s.kind === "land"
    ? s.members.filter((r) => sc.harborOf(r) !== 0)
    : sc.landRegions
        .map((r) => r.id)
        .filter((r) => s.members.includes(sc.harborOf(r)));
}

/** The enemy ships docked at `ports` (never a no-strike region's), their port, and the ports' anti-air, milli. */
export function portShipsFor(
  air: WwAir,
  side: number,
  ports: readonly number[],
): {
  ships: number[];
  portOf: Map<number, number>;
  baseAaMilli: number;
} {
  const sc = air.ww.scenario;
  const navy = air.navy;
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
  return { ships, portOf, baseAaMilli };
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
export function strike(
  air: WwAir,
  sorties: readonly Sortie[],
  shipIds: readonly number[],
  hitPm: number,
  aaLossPerCenti: number,
  baseAaMilli: number,
  fx: EffectTally,
  tick: number,
  portOf?: ReadonlyMap<number, number>,
  /** ww8: the anti-air's losses × this/100 (a delivery is several days of sorties). */
  aaScaleCenti = 100,
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
  takeLosses(
    air,
    sorties,
    aaScaleCenti === 100 ? aaMilli : Math.floor((aaMilli * aaScaleCenti) / 100),
    topKey(aaByOwner),
  );
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
    const d = air.wings.get(id);
    if (d === undefined || parts[i] <= 0) return;
    // P6 (spec §5.4.2, lane E): design planes' reliability, by count.
    const depth = air.ww.depth;
    d.lossRest += Math.floor(
      (parts[i] * planesLossBp(depth, d.owner, d.counts, d.dcounts)) / 10_000,
    );
    air.markWing(id);
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
