// World War 1936 P4: convoy raiding, escorts and ASW (P4 spec §10.6), one
// sea region's day (dailySeaRegion, after supremacy). Expected values with
// milli remainders, no randomness: raid power of the raiders at war with a
// country against the escorts of its side gives the loss rate ‰ of its
// convoys through the region; the escorts' depth charges hurt the raiding
// submarines they have spotted.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  aswDamageMilli,
  convoyLossRatePm,
  convoySinkMilli,
  escortPowerCenti,
  raidPowerCenti,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { exploiting } from "../depth/Crypto";
import { designPlaneP4 } from "../depth/Designs";
import { minesConvoyLossPm } from "../depth/Mines";
import { loseConvoys } from "../economy/Buildings";
import { admiralPct, fleetAdmiralTraits } from "./AdmiralTraits";
import { takeFromRoutes, USE_VOYAGE } from "./Convoys";
import { onConvoysLost } from "./EndgameHooks";
import { applyShipDamage } from "./NavalBattles";
import { setRest } from "./SeaTransfer";
import type { Fleet, WwNavy } from "./WwNavy";

const RAID = FLEET_MISSIONS.indexOf("raid");
const ESCORT = FLEET_MISSIONS.indexOf("escort");
const SS = SHIP_CLASSES.indexOf("ss");
const DD = SHIP_CLASSES.indexOf("dd");
const CL = SHIP_CLASSES.indexOf("cl");
const NAVAL_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
/** P6 spec §8.7 (pre-flight A12): a raider exploiting the victim's broken codes raids it +10%. */
const EXPLOIT_RAID_PCT = 10;

/** A fleet on its mission in the region: at sea there, out of any battle. */
function onMission(navy: WwNavy, f: Fleet, sr: number): boolean {
  if (f.docked !== 0 || f.missionSr !== sr) return false;
  if (navy.scenario.zoneSr(f.zone) !== sr) return false;
  return !(
    navy.battles.get(f.zone)?.fleets.some((l) => l.includes(f.id)) ?? false
  );
}

function add(m: Map<number, number>, k: number, v: number): void {
  m.set(k, (m.get(k) ?? 0) + v);
}

/**
 * Spec §10.6 for sea region `sr` on `day`: for every side A with raiders
 * there and every country b at war with them whose routes cross the
 * region (smallID order), the sinking of b's traffic by A's raid power
 * (its members at war with b) against the escorts of b's side; the
 * integer convoys go from b's stock and routes, the remainder stays. Then
 * the escorts' ASW on the raiding submarines (the most damaged first), the
 * loss rate by side (P5) and the day's records for spotting and screens.
 */
export function convoyWar(navy: WwNavy, sr: number, day: number): void {
  const sc = navy.scenario;
  const land = navy.land;
  const s = sc.sr(sr);
  const idx = sc.srIdxOf(sr);
  if (s === undefined || s.kind !== "sea" || idx < 0) return;
  const st = navy.srState[idx];
  const tick = navy.mg.ticks();

  // The raiders and escorts on station here, by fleet id.
  const fleets: Fleet[] = [];
  for (const z of s.members) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id);
      if (f !== undefined) fleets.push(f);
    }
  }
  fleets.sort((a, b) => a.id - b.id);
  const raidFleets = new Map<number, Fleet[]>();
  const sub = new Map<number, number>();
  const surf = new Map<number, number>();
  const dd = new Map<number, number>();
  const cl = new Map<number, number>();
  const other = new Map<number, number>();
  for (const f of fleets) {
    if (!onMission(navy, f, sr)) continue;
    const raid = f.mission === RAID;
    if (!raid && f.mission !== ESCORT) continue;
    if (raid) {
      const l = raidFleets.get(f.owner);
      if (l === undefined) raidFleets.set(f.owner, [f]);
      else l.push(f);
    }
    // P6 (spec §4.2): convoy_master's escort +20%, on its fleet's ships.
    const esc = raid ? 0 : admiralPct(fleetAdmiralTraits(navy, f), "escortPct");
    let fdd = 0;
    let fcl = 0;
    let fother = 0;
    for (const id of f.ships) {
      const r = navy.ships.rowOf(id);
      if (r < 0) continue;
      const x = navy.shipStatsOf(r);
      const c = navy.ships.cls[r];
      if (raid) {
        if (c === SS) add(sub, f.owner, x.torpedo);
        else add(surf, f.owner, x.light + x.heavy);
      } else if (c === DD) {
        fdd += x.depth * 2 + x.light;
      } else if (c === CL) {
        fcl += x.depth + x.light;
      } else {
        fother += x.light;
      }
    }
    if (!raid) {
      const k = (v: number) =>
        esc === 0 ? v : Math.floor((v * (100 + esc)) / 100);
      if (fdd > 0) add(dd, f.owner, k(fdd));
      if (fcl > 0) add(cl, f.owner, k(fcl));
      if (fother > 0) add(other, f.owner, k(fother));
    }
  }
  const air = airOf(navy, sr, idx);

  // Raid power per raiding country, escort power per side.
  const raidPow = new Map<number, number>();
  const raiders = [...new Set([...raidFleets.keys(), ...air.strike.keys()])];
  raiders.sort((a, b) => a - b);
  for (const m of raiders) {
    const ce = navy.econ.country(m);
    if (ce === null) continue;
    const p = raidPowerCenti(
      sub.get(m) ?? 0,
      surf.get(m) ?? 0,
      air.strike.get(m) ?? 0,
      ce.stats,
      ce.researched,
      ce.fuelRatioPm,
    );
    if (p > 0) raidPow.set(m, p);
  }
  // P6 (spec §15.1): a mined region still sinks convoys with no raider here.
  if (raidPow.size === 0 && navy.ww.depth.mineIndex.get(sr) === undefined) {
    st.lossYesterday = new Map();
    st.raidedYesterday = [];
    st.lossRate = new Map();
    return;
  }
  const escMember = new Map<number, number>();
  const escorts = [
    ...new Set([
      ...dd.keys(),
      ...cl.keys(),
      ...other.keys(),
      ...air.patrol.keys(),
    ]),
  ].sort((a, b) => a - b);
  for (const m of escorts) {
    const ce = navy.econ.country(m);
    if (ce === null) continue;
    const e = escortPowerCenti(
      dd.get(m) ?? 0,
      cl.get(m) ?? 0,
      other.get(m) ?? 0,
      air.patrol.get(m) ?? 0,
      ce.stats,
    );
    if (e > 0) escMember.set(m, e);
  }
  const escortOf = (side: number): number => {
    let e = 0;
    for (const m of land.sideMembers(side)) e += escMember.get(m) ?? 0;
    return e;
  };
  const raiderSides = new Map<number, number[]>();
  for (const m of raidPow.keys()) {
    const k = land.sideOf(m);
    const l = raiderSides.get(k);
    if (l === undefined) raiderSides.set(k, [m]);
    else l.push(m);
  }
  const sides = [...raiderSides.keys()].sort((a, b) => a - b);
  // P6 (spec §8.7): raider m's power against country b (+10% exploiting b's codes).
  const depth = navy.ww.depth;
  const powVs = (m: number, b: number): number => {
    const p = raidPow.get(m)!;
    return exploiting(depth, m, b)
      ? Math.floor((p * (100 + EXPLOIT_RAID_PCT)) / 100)
      : p;
  };

  // Traffic: each route through here once (a voyage where it sails now).
  const traffic = new Map<number, number>();
  for (const r of navy.routes.values()) {
    if (!r.srs.includes(sr)) continue;
    let n = r.got;
    if (r.use === USE_VOYAGE) {
      const v = navy.voyages.get(r.ref);
      const z =
        v === undefined ? 0 : r.zones[Math.min(v.zoneIdx, r.zones.length - 1)];
      n = v !== undefined && sc.zoneSr(z) === sr ? v.bound : 0;
    }
    if (n > 0) add(traffic, r.owner, n);
  }
  const victims = [...traffic.keys()].sort((a, b) => a - b);

  // The sinking, side by side, victim by victim.
  const sink = new Map<number, number>();
  // P5 (pre-flight §0-10): by victim, each raider's share of what it sank
  // (milli × its raid power / the side's), for the war score.
  const sinkBy = new Map<number, Map<number, number>>();
  const raided = new Set<number>();
  const asw: { f: Fleet; side: number; escort: number }[] = [];
  const aswSeen = new Set<string>();
  for (const a of sides) {
    const ms = raiderSides.get(a)!;
    for (const b of victims) {
      const at = ms.filter((m) => land.isEnemy(m, b));
      if (at.length === 0) continue;
      let raid = 0;
      for (const m of at) raid += powVs(m, b);
      const bSide = land.sideOf(b);
      const escort = escortOf(bSide);
      const milli = convoySinkMilli(traffic.get(b)!, raid, escort, s.area);
      if (milli <= 0) continue;
      add(sink, b, milli);
      let by = sinkBy.get(b);
      if (by === undefined) sinkBy.set(b, (by = new Map()));
      for (const m of at) {
        add(by, m, Math.floor((milli * powVs(m, b)) / raid));
      }
      for (const m of at) {
        for (const f of raidFleets.get(m) ?? []) {
          raided.add(f.id);
          const key = `${f.id}|${bSide}`;
          if (escort > 0 && !aswSeen.has(key)) {
            aswSeen.add(key);
            asw.push({ f, side: bSide, escort });
          }
        }
      }
    }
  }

  // The loss rate ‰ by side (P5's lend-lease reads it): what every side at
  // war with a raider here would lose today.
  const rates = new Map<number, number>();
  for (const side of land.sideList()) {
    let rate = 0;
    for (const a of sides) {
      if (a === side.key) continue;
      let raid = 0;
      for (const m of raiderSides.get(a)!) {
        if (!side.members.some((y) => land.isEnemy(m, y))) continue;
        // The display rate: +10% when it exploits any member's codes.
        const p = raidPow.get(m)!;
        raid += side.members.some((y) => exploiting(depth, m, y))
          ? Math.floor((p * (100 + EXPLOIT_RAID_PCT)) / 100)
          : p;
      }
      if (raid > 0) rate += convoyLossRatePm(raid, escortOf(side.key), s.area);
    }
    if (rate > 0) rates.set(side.key, rate);
  }

  // The losses: the integer convoys, the remainder kept.
  const lossToday = new Map<number, number>();
  for (const b of victims) {
    // P6 (spec §15.1): enemy mines add m / 10 ‰ of the traffic (traffic
    // convoys × ‰ = milli-convoys). Nobody is credited for them.
    const lossPct = navy.econ.country(b)?.stats.convoyLossPct ?? 0;
    const raw =
      (sink.get(b) ?? 0) +
      traffic.get(b)! * minesConvoyLossPm(navy.ww.depth, sr, b);
    // P6 (spec §21.2, T1b): the victim's convoyLossPct (−: fewer lost).
    const milli =
      lossPct === 0
        ? raw
        : Math.floor((raw * Math.max(0, 100 + lossPct)) / 100);
    if (milli <= 0) continue;
    lossToday.set(b, milli);
    const rest = (st.raidRest.get(b) ?? 0) + milli;
    const n = Math.floor(rest / 1000);
    setRest(st.raidRest, b, rest - n * 1000);
    const ce = navy.econ.country(b);
    const lost = ce === null || n <= 0 ? 0 : loseConvoys(ce, n);
    if (lost > 0) takeFromRoutes(navy, b, sr, lost);
    if (lost > 0) creditConvoyKills(navy, b, sinkBy.get(b), lost);
    const cn = navy.country(b);
    if (cn !== null) cn.convoyLoss[day % 30] += milli;
    navy.convoysSunkTotal += lost;
    navy.markCountry(b);
  }
  st.lossYesterday = lossToday;
  st.raidedYesterday = [...raided].sort((a, b) => a - b);
  st.lossRate = rates;

  // ASW: the escorts' depth charges on the raiding submarines they spotted.
  for (const { f, side, escort } of asw) {
    if (navy.fleets.get(f.id) !== f) continue;
    // P6 (spec §4.2): blockade_runner's raiders take 15% less.
    const cut = admiralPct(fleetAdmiralTraits(navy, f), "raidLossPct");
    const raw = aswDamageMilli(escort, navy.spotPm(side, f.id));
    const dmg = cut === 0 ? raw : Math.floor((raw * (100 + cut)) / 100);
    if (dmg <= 0) continue;
    let by = 0;
    let best = 0;
    for (const m of land.sideMembers(side)) {
      const e = escMember.get(m) ?? 0;
      if (e > best) {
        best = e;
        by = m;
      }
    }
    hurtSubs(navy, f, dmg, tick, by);
  }
  navy.markSr(idx);
}

/** HP damage on a fleet's submarines, the lowest HP share first, the overflow to the next. */
function hurtSubs(
  navy: WwNavy,
  f: Fleet,
  dmg: number,
  tick: number,
  by: number,
): void {
  const t = navy.ships;
  const subs: { id: number; hp: number; max: number }[] = [];
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0 || t.cls[r] !== SS) continue;
    subs.push({
      id,
      hp: t.hp[r],
      max: Math.max(1, navy.shipStatsOf(r).hpMilli),
    });
  }
  subs.sort((a, b) => a.hp * b.max - b.hp * a.max || a.id - b.id);
  let left = dmg;
  for (const x of subs) {
    if (left <= 0) break;
    const take = Math.min(x.hp, left);
    left -= take;
    applyShipDamage(navy, x.id, take, 0, tick, by);
  }
}

/**
 * The air war's part here (lanes A1/A2 keep the sorties): per country the
 * naval strike planes' naval attack × sortie efficiency (its naval-strike
 * milli-sorties over its planes there), centi; per country its naval
 * patrol planes flying (anti-submarine milli-sorties / 1000).
 */
function airOf(
  navy: WwNavy,
  sr: number,
  idx: number,
): { strike: Map<number, number>; patrol: Map<number, number> } {
  const strike = new Map<number, number>();
  const patrol = new Map<number, number>();
  const air = navy.ww.air;
  const zs = air.zoneState[idx];
  if (zs === undefined) return { strike, patrol };
  for (const [m, v] of zs.navalAsw) {
    const n = Math.floor(v / 1000);
    if (n > 0) patrol.set(m, n);
  }
  const naval = new Map<number, number>();
  const planes = new Map<number, number>();
  for (const id of air.deploymentsIn(sr)) {
    const d = air.deployments.get(id);
    if (d === undefined || d.mission !== NAVAL_STRIKE) continue;
    const ce = navy.econ.country(d.owner);
    const type = AIR_TYPES[d.type];
    if (ce === null || type === undefined) continue;
    d.counts.forEach((n, g) => {
      if (n <= 0) return;
      add(
        naval,
        d.owner,
        n * planeStats(type, g + 1, ce.stats, ce.researched).naval,
      );
      add(planes, d.owner, n);
    });
    // P6 (lane E): its design planes, at their design's naval attack.
    d.dcounts.forEach((n, s) => {
      const st =
        n > 0 ? designPlaneP4(navy.ww.depth, d.owner, s + 1, type) : null;
      if (st === null) return;
      add(naval, d.owner, n * st.naval);
      add(planes, d.owner, n);
    });
  }
  for (const [m, v] of naval) {
    const n = planes.get(m) ?? 0;
    const eff =
      n <= 0 ? 0 : Math.min(1000, Math.floor((zs.navalStrike.get(m) ?? 0) / n));
    const c = Math.floor((v * eff) / 1000);
    if (c > 0) strike.set(m, c);
  }
  return { strike, patrol };
}

/**
 * P5 (pre-flight §0-10): `lost` convoys of `owner` shared among the
 * raiders by what each sank today (floor; the remainder to the biggest,
 * ties the smaller smallID), into the war score (EndgameHooks.onConvoysLost).
 */
function creditConvoyKills(
  navy: WwNavy,
  owner: number,
  by: ReadonlyMap<number, number> | undefined,
  lost: number,
): void {
  if (by === undefined) return;
  const rows = [...by].filter(([, w]) => w > 0).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let top = 0;
  for (let i = 0; i < rows.length; i++) {
    total += rows[i][1];
    if (rows[i][1] > rows[top][1]) top = i;
  }
  if (total <= 0) return;
  const share = rows.map(([, w]) => Math.floor((lost * w) / total));
  share[top] += lost - share.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rows.length; i++) {
    if (share[i] > 0) onConvoysLost(navy, owner, rows[i][0], share[i]);
  }
}

/**
 * The convoy loss rate ‰ of `owner`'s side in sea region `sr` on the
 * region's last day (P5 lend-lease reads it): the state convoyWar writes
 * (SrNavyState.lossRate by side; WwNavy.lossRatePm).
 */
export function convoyLossPmOf(
  navy: WwNavy,
  owner: number,
  sr: number,
): number {
  const i = navy.scenario.srIdxOf(sr);
  // P6 (spec §15.1): plus the enemy mines' convoy losses there; P6
  // (spec §21.2, T1b): × the owner's convoyLossPct.
  const pm =
    (i < 0 ? 0 : navy.lossRatePm(i, owner)) +
    minesConvoyLossPm(navy.ww.depth, sr, owner);
  const pct = navy.econ.country(owner)?.stats.convoyLossPct ?? 0;
  return pct === 0 ? pm : Math.floor((pm * Math.max(0, 100 + pct)) / 100);
}

/**
 * The country's day (allocateConvoys): one line each for the convoys it
 * lost and those its raiders sank in the sea regions whose day ran since
 * its own (spec §10.6, `{n, srs}`: srs = up to three strategic region ids,
 * the heaviest first, comma-separated; the screens name them); and the
 * 30-day loss ring's slot for tomorrow starts over.
 */
/** The sea strategic regions, srIdx order (static: Task 15 skips the land zones once). */
const seaLists = new WeakMap<
  WwNavy["scenario"],
  readonly { id: number; idx: number }[]
>();
function seaRegionsOf(
  sc: WwNavy["scenario"],
): readonly { id: number; idx: number }[] {
  let l = seaLists.get(sc);
  if (l === undefined) {
    l = sc
      .strategicList()
      .filter((s) => s.kind === "sea")
      .map((s) => ({ id: s.id, idx: s.idx }));
    seaLists.set(sc, l);
  }
  return l;
}

export function dailyConvoyNotices(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  const cn = navy.country(smallID);
  if (cn === null) return;
  cn.convoyLoss[(day + 1) % 30] = 0;
  const k = smallID % WW_DAY_SPLIT;
  const lost: [number, number][] = [];
  const sunk: [number, number][] = [];
  for (const s of seaRegionsOf(navy.scenario)) {
    const st = navy.srState[s.idx];
    if (st.lossYesterday.size === 0) continue;
    const ki = s.idx % WW_DAY_SPLIT;
    const fresh =
      (st.lastDay === day && ki <= k) || (st.lastDay === day - 1 && ki > k);
    if (!fresh) continue;
    const l = st.lossYesterday.get(smallID) ?? 0;
    if (l > 0) lost.push([s.id, l]);
    if (st.raidedYesterday.some((f) => navy.fleets.get(f)?.owner === smallID)) {
      let n = 0;
      for (const [b, m] of st.lossYesterday) {
        if (navy.land.isEnemy(smallID, b)) n += m;
      }
      if (n > 0) sunk.push([s.id, n]);
    }
  }
  notice(navy, smallID, "events_display.ww1936_convoys_lost", lost);
  notice(navy, smallID, "events_display.ww1936_convoys_sunk", sunk);
}

function notice(
  navy: WwNavy,
  to: number,
  key: string,
  bySr: [number, number][],
): void {
  let total = 0;
  for (const [, m] of bySr) total += m;
  const n = Math.floor(total / 1000);
  if (n < 1) return;
  const srs = [...bySr]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([sr]) => sr)
    .join(",");
  navy.message(to, key, { n, srs });
}
