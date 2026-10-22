// World War 1936 P4: spotting (P4 spec §8.4). Lane N1 (Task 3).
// Once a day per sea region: every side with search there (its fleets in
// the region, docked strike forces included, and yesterday's naval patrol
// planes) raises its progress on each enemy fleet at sea there by
// search × visibility / area, up to 1000‰ (spotted). No search that day:
// −300. A fleet that left the region, docked or made peace drops out.
import {
  admiralTraitBit,
  SHIP_CLASSES,
  WW_SPOT_DECAY_PM,
  WW_SPOT_FULL_PM,
  WW_SPOT_RAID_BONUS_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  fleetVis,
  searchPoints,
  spotGainPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { exploiting } from "../depth/Crypto";
import { hasUp } from "../depth/Operatives";
import { admiralPct, fleetAdmiralTraits } from "./AdmiralTraits";
import {
  fleetMissionPm,
  noteNewlySpotted,
  sideAtWarWith,
  sideMembers,
} from "./Missions";
import type { Fleet, WwNavy } from "./WwNavy";

/** Spec §7.4: the spotter trait's search bonus, %. */
const SPOTTER_PCT = 20;
/** P6 spec §8.2: the naval intelligence department (ag_navy_dept): our fleets' search +5%. */
const NAVY_DEPT_PCT = 5;
/** P6 spec §8.7 (pre-flight A12): exploiting the target's broken codes, search on its fleets +20%. */
const EXPLOIT_SPOT_PCT = 20;
/** Spec §7.4: search % per point of the admiral's manoeuvre. */
const MANEUVER_SEARCH_PCT = 5;

/** A side's search in a region: surface and anti-submarine, plus planes in milli-sorties. */
interface Search {
  surf: number;
  sub: number;
  airSurfMilli: number;
  airSubMilli: number;
}

/**
 * Spec §8.4: the search modifier of a fleet, % (stats.navalDetectPct, the
 * admiral's manoeuvre × 5, the spotter trait 20; naval_radar_1 is in the
 * ships' detection numbers already).
 */
export function fleetSearchModPct(navy: WwNavy, f: Fleet): number {
  let pct = navy.econ.country(f.owner)?.stats.navalDetectPct ?? 0;
  if (hasUp(navy.ww.depth.country(f.owner), "ag_navy_dept")) {
    pct += NAVY_DEPT_PCT;
  }
  const a = navy.admirals.get(f.admiral);
  if (a !== undefined && a.fleet === f.id) {
    pct += a.skills[2] * MANEUVER_SEARCH_PCT;
    if ((a.traits & admiralTraitBit("spotter")) !== 0) pct += SPOTTER_PCT;
  }
  return pct;
}

/** Spec §8.4: a fleet's visibility and whether it is submarines only (0: no ships). */
export function fleetVisOf(
  navy: WwNavy,
  f: Fleet,
): { vis: number; subsOnly: boolean } {
  const t = navy.ships;
  let surfMax = 0;
  let surfN = 0;
  let subMax = 0;
  let subN = 0;
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const v = navy.shipStatsOf(r).vis;
    if (SHIP_CLASSES[t.cls[r]] === "ss") {
      subN++;
      subMax = Math.max(subMax, v);
    } else {
      surfN++;
      surfMax = Math.max(surfMax, v);
    }
  }
  // P6 (spec §4.2): blockade_runner's fleet is 10% harder to find.
  const pct = admiralPct(fleetAdmiralTraits(navy, f), "visibilityPct");
  const k = (v: number) =>
    pct === 0 ? v : Math.max(1, Math.floor((v * (100 + pct)) / 100));
  if (surfN > 0)
    return { vis: k(fleetVis(surfMax, surfN, false)), subsOnly: false };
  return { vis: k(fleetVis(subMax, subN, true)), subsOnly: true };
}

/**
 * A sea region's day of spotting progress (WwNavy.setSpotPm). Sides in
 * key order, enemy fleets in id order; the pairs that reach 1000‰ today
 * go to this region's engageRegion (spec §9.1). P6 (spec §8.7): a side
 * one of whose members exploits the fleet owner's codes searches it +20%.
 */
export function spotRegion(navy: WwNavy, sr: number, day: number): void {
  const sc = navy.scenario;
  const idx = sc.srIdxOf(sr);
  const s = sc.sr(sr);
  if (idx < 0 || s === undefined || s.kind !== "sea") return;
  const st = navy.srState[idx];
  const fleets: Fleet[] = [];
  for (const z of s.members) {
    for (const id of navy.fleetsIn(z)) fleets.push(navy.fleets.get(id)!);
  }
  fleets.sort((a, b) => a.id - b.id);

  const search = new Map<number, Search>();
  const of = (side: number): Search => {
    let x = search.get(side);
    if (x === undefined) {
      search.set(
        side,
        (x = { surf: 0, sub: 0, airSurfMilli: 0, airSubMilli: 0 }),
      );
    }
    return x;
  };
  for (const f of fleets) {
    const pm = fleetMissionPm(navy, f, "search");
    if (pm <= 0) continue;
    let surf = 0;
    let sub = 0;
    for (const id of f.ships) {
      const r = navy.ships.rowOf(id);
      if (r < 0) continue;
      const stats = navy.shipStatsOf(r);
      surf += stats.surfDetect;
      sub += stats.subDetect;
    }
    const mods = fleetSearchModPct(navy, f);
    const x = of(navy.sideOf(f.owner));
    x.surf += searchPoints(surf, pm, mods);
    x.sub += searchPoints(sub, pm, mods);
  }
  // Yesterday's naval patrol planes (A1, pre-flight A4): milli-sorties by country.
  const air = navy.ww.air.zoneState[idx];
  if (air !== undefined) {
    for (const [c, ms] of air.navalSearch)
      of(navy.sideOf(c)).airSurfMilli += ms;
    for (const [c, ms] of air.navalAsw) of(navy.sideOf(c)).airSubMilli += ms;
  }

  const live = new Set(navy.sideList().map((x) => x.key));
  const keys = new Set<number>(st.spot.keys());
  for (const [side, x] of search) {
    if (x.surf + x.sub + x.airSurfMilli + x.airSubMilli > 0) keys.add(side);
  }
  const targets = fleets.filter((f) => f.docked === 0 && f.ships.length > 0);
  const raided = new Set(st.raidedYesterday);
  // A raider gives itself away to the sides whose convoys it sank here
  // yesterday, whether or not they have ships or planes here (spec §8.4:
  // attacking reveals it).
  if (raided.size > 0) {
    for (const c of st.lossYesterday.keys()) keys.add(navy.sideOf(c));
  }
  const newly: [number, number][] = [];
  // Task 15's perf pass: each target's visibility once, not once a side.
  const visMemo = new Map<number, { vis: number; subsOnly: boolean }>();
  const visOf = (f: Fleet) => {
    let v = visMemo.get(f.id);
    if (v === undefined) visMemo.set(f.id, (v = fleetVisOf(navy, f)));
    return v;
  };
  for (const side of [...keys].sort((a, b) => a - b)) {
    const before = new Map(st.spot.get(side) ?? []);
    const seen = new Set<number>();
    if (live.has(side)) {
      const members = sideMembers(navy, side);
      const x = search.get(side);
      const surf =
        x === undefined ? 0 : x.surf + Math.floor(x.airSurfMilli / 1000);
      const sub =
        x === undefined ? 0 : x.sub + Math.floor(x.airSubMilli / 1000);
      const atWar = new Map<number, boolean>();
      const cracked = new Map<number, boolean>();
      for (const f of targets) {
        if (navy.sideOf(f.owner) === side) continue;
        let w = atWar.get(f.owner);
        if (w === undefined) {
          w = sideAtWarWith(navy, members, f.owner);
          atWar.set(f.owner, w);
        }
        if (!w) continue;
        seen.add(f.id);
        const v = visOf(f);
        let c = cracked.get(f.owner);
        if (c === undefined) {
          c = members.some((m) => exploiting(navy.ww.depth, m, f.owner));
          cracked.set(f.owner, c);
        }
        const base = v.subsOnly ? sub : surf;
        const srch = c
          ? Math.floor((base * (100 + EXPLOIT_SPOT_PCT)) / 100)
          : base;
        const was = before.get(f.id) ?? 0;
        const bonus = raided.has(f.id) ? WW_SPOT_RAID_BONUS_PM : 0;
        let p = was + bonus;
        if (srch > 0) p += spotGainPm(srch, v.vis, s.area);
        else if (bonus === 0) p -= WW_SPOT_DECAY_PM;
        p = Math.max(0, Math.min(WW_SPOT_FULL_PM, p));
        if (p !== was) navy.setSpotPm(sr, side, f.id, p);
        if (was < WW_SPOT_FULL_PM && p >= WW_SPOT_FULL_PM)
          newly.push([side, f.id]);
      }
    }
    // Gone, docked, out of the region, at peace, or the side is no more.
    for (const fid of before.keys()) {
      if (!seen.has(fid)) navy.setSpotPm(sr, side, fid, 0);
    }
  }
  newly.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  noteNewlySpotted(navy, sr, day, newly);
}
