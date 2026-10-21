// World War 1936 P4: paradrops (P4 spec §14.10, plan decision 35), lane
// A2 (Task 8). The army order stays P2's (readyDay, the drop, the 30-day
// cooldown); this file adds the air war's conditions (the pure judge is
// engine-lib AirRules.paradropBlockOf, the army card's too) and the
// transports' losses at the drop, which the dropping divisions share.
import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  TPL_PARA_ANY,
  WW_PARA_COOLDOWN_DAYS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  aaLossPm,
  detectionPm,
  ParadropAsk,
  paradropBlockOf,
  paradropTransports,
} from "@openfront/engine-lib/ww1936/AirRules";
import { effectiveLevel } from "../economy/Buildings";
import { damageDivisions, divisionWeightCenti } from "../land/SeaLift";
import type { Army } from "../land/WwLand";
import { onPlanesLost } from "../navy/EndgameHooks";
import { airDuelMilli, type DuelPlanes } from "./AirCombat";
import { zoneFlightsOf } from "./AirEffects";
import { radarPmAt } from "./AirSuperiority";
import type { WwAir } from "./WwAir";

const M_SUP = AIR_MISSIONS.indexOf("air_superiority");
const M_INT = AIR_MISSIONS.indexOf("interception");
const TRANSPORT = "transport_plane" as const;

/**
 * Every tick (spec §2.2-7 ③). P2 keeps the paradrop's state (readyDay,
 * paraLastDay) and its drop tick calls resolveParadrop: nothing ages here.
 */
export function stepParadrops(air: WwAir, tick: number): void {
  void air;
  void tick;
}

/** The transports in `smallID`'s stock (not deployed), every generation. */
export function transportStock(air: WwAir, smallID: number): number {
  const ce = air.econ.country(smallID);
  if (ce === null) return 0;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[TRANSPORT]; g++) {
    n += ce.stock[equipKey(TRANSPORT, g)];
  }
  return n;
}

/** Spec §14.10: the transports the army's divisions need (20 a weight point, 10 a paratrooper battalion). */
export function transportsFor(air: WwAir, a: Army): number {
  let w = 0;
  for (const id of a.divisions) w += divisionWeightCenti(air.land, id);
  return paradropTransports(w);
}

/**
 * Spec §14.10: the air war's view of a paradrop of `a` onto `target` for
 * the pure judge: every region of the army has a working air base, the
 * farthest of them to the target's center against the transports' range,
 * the stock against the need, our superiority over the target's zone (its
 * last day: yesterday's).
 */
export function paradropAskOf(
  air: WwAir,
  a: Army,
  target: number,
): ParadropAsk {
  const land = air.land;
  const sc = air.ww.scenario;
  const regions = new Set<number>();
  for (const id of a.divisions) {
    const r = land.divisions.rowOf(id);
    if (r >= 0) regions.add(land.divisions.region[r]);
  }
  const to = sc.centerTile(target);
  let km = 0;
  let base = regions.size > 0;
  for (const r of regions) {
    if (effectiveLevel(air.econ, r, "air_base") < 1) base = false;
    km = Math.max(km, sc.kmBetween(sc.centerTile(r), to));
  }
  return {
    fromAirBase: base,
    targetKm: km,
    transportRangeKm: air.planeStatsOf(a.owner, TRANSPORT, 1).rangeKm,
    transportsFree: transportStock(air, a.owner),
    transportsNeed: transportsFor(air, a),
    airSupPm: air.airSup(land.sideOf(a.owner), sc.regionSr(target)),
  };
}

/**
 * Spec §14.10: a paradrop's conditions — P2's (our army, a land region,
 * every division a paratrooper's, an enemy target, 30 days since the last
 * drop), then the air war's (paradropBlockOf: an air base, the transports'
 * range, enough transports, 70% superiority). P2's order check asks this
 * first (pre-flight A20); null when they hold.
 */
export function paradropBlockFor(
  air: WwAir,
  smallID: number,
  army: number,
  target: number,
): WwOrderBlock | null {
  const land = air.land;
  const a = land.armies.get(army);
  if (a === undefined || a.owner !== smallID) return "no_army";
  if (air.ww.scenario.region(target) === undefined) return "bad_region";
  let rows = 0;
  for (const id of a.divisions) {
    const r = land.divisions.rowOf(id);
    if (r < 0) continue;
    rows++;
    if ((land.baseStatsOf(r).flags & TPL_PARA_ANY) === 0) return "bad_template";
  }
  if (rows === 0) return "bad_template";
  if (!land.isEnemy(smallID, land.controller[target] ?? 0)) {
    return "not_at_war";
  }
  if (
    a.paraLastDay >= 0 &&
    land.day() - a.paraLastDay < WW_PARA_COOLDOWN_DAYS
  ) {
    return "para_cooldown";
  }
  return paradropBlockOf(paradropAskOf(air, a, target));
}

/** A drop's transport losses: how many flew, the milli planes lost, the ‰ and the killer. */
export interface ParadropLoss {
  planes: number;
  lostMilli: number;
  pm: number;
  by: number;
}

/**
 * Spec §14.10: the transports a drop of `a` on `target` loses — the
 * target's anti-air guns (3‰ a level, × the defender's aaPct: the land
 * anti-air of §14.4) and, when the enemy has fighters on superiority or
 * interception over the target's zone, one air battle (A1's airDuelMilli,
 * the transports weighing 3 against interceptors, 1 otherwise; the
 * dropping country's airLossCutPct, as A1's battles).
 */
export function paradropLosses(
  air: WwAir,
  a: Army,
  target: number,
): ParadropLoss {
  const land = air.land;
  const sc = air.ww.scenario;
  const planes = transportsFor(air, a);
  const ctrl = land.controller[target] ?? 0;
  if (planes <= 0) return { planes: 0, lostMilli: 0, pm: 0, by: ctrl };
  const aaPct = air.econ.country(ctrl)?.stats.aaPct ?? 0;
  const aaPm = aaLossPm(
    effectiveLevel(air.econ, target, "anti_air"),
    0,
    aaPct,
    false,
  );
  let lost = Math.floor((planes * 1000 * aaPm) / 1000);
  let by = ctrl;
  // The enemy's fighters over the target's zone.
  const sr = sc.regionSr(target);
  const attackers: DuelPlanes[] = [];
  const flown = new Map<number, number>();
  let interceptors = false;
  let side = 0;
  for (const f of zoneFlightsOf(air, sr, land.day())) {
    if (f.mission !== M_SUP && f.mission !== M_INT) continue;
    const d = air.deployments.get(f.id);
    if (d === undefined) continue;
    if (
      !land.isEnemy(a.owner, d.volunteerFor !== 0 ? d.volunteerFor : d.owner)
    ) {
      continue;
    }
    f.milli.forEach((milli, g) => {
      if (milli <= 0) return;
      attackers.push({ stats: f.stats[g], milli, weight: 1 });
      flown.set(d.owner, (flown.get(d.owner) ?? 0) + milli);
      if (f.mission === M_INT) interceptors = true;
      if (side === 0) side = f.side;
    });
  }
  if (attackers.length > 0) {
    let top = 0;
    let topV = -1;
    // Doctrine bonuses count once, through the stat keys (A1's rule): the
    // best detection of the fighters' owners, the victim's loss cut.
    let detectPct = 0;
    for (const [k, v] of flown) {
      if (v > topV || (v === topV && k < top)) {
        top = k;
        topV = v;
      }
      detectPct = Math.max(
        detectPct,
        air.econ.country(k)?.stats.airDetectPct ?? 0,
      );
    }
    const ownLand = (sc.sr(sr)?.members ?? []).some(
      (r) => land.sideOf(land.controller[r] ?? 0) === side,
    );
    const det = detectionPm(radarPmAt(air, side, sr), ownLand, detectPct, 0);
    const cut = air.econ.country(a.owner)?.stats.airLossCutPct ?? 0;
    const raw = airDuelMilli(
      attackers,
      [
        {
          stats: air.planeStatsOf(a.owner, TRANSPORT, 1),
          milli: planes * 1000,
          weight: interceptors ? 3 : 1,
        },
      ],
      det,
    );
    const duel = Math.floor((raw * (100 - Math.min(100, cut))) / 100);
    if (duel > 0) {
      lost += duel;
      by = top;
    }
  }
  lost = Math.min(planes * 1000, Math.max(0, lost));
  return { planes, lostMilli: lost, pm: Math.floor(lost / planes), by };
}

/**
 * Spec §14.10: the drop's transport losses (P2's drop calls it after
 * landing the army): the dropping divisions lose the same share of their
 * strength (the men aboard); the transports lost (whole planes) leave the
 * stock, the others stay in it.
 */
export function resolveParadrop(air: WwAir, army: number, tick: number): void {
  void tick;
  const land = air.land;
  const a = land.armies.get(army);
  if (a === undefined) return;
  const target = land.armyRegion(a);
  if (target === 0) return;
  const loss = paradropLosses(air, a, target);
  if (loss.lostMilli <= 0) return;
  const ce = air.econ.country(a.owner);
  if (ce !== null) {
    let left = Math.floor(loss.lostMilli / 1000);
    let gone = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[TRANSPORT] && left > 0; g++) {
      const k = equipKey(TRANSPORT, g);
      const take = Math.min(left, ce.stock[k]);
      ce.stock[k] -= take;
      left -= take;
      gone += take;
    }
    if (gone > 0) {
      onPlanesLost(air, a.owner, loss.by, TRANSPORT, gone);
      air.planesLostTotal += gone;
      air.markCountry(a.owner);
      air.econ.markCountryDirty(a.owner);
    }
  }
  damageDivisions(land, [...a.divisions], loss.pm);
}
