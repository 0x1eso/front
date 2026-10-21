// World War 1936 P4: radar and the land war's air penalties (P4 spec
// §12.1 radar, §14.6). Lane A1 (Task 7). The penalties are O(1) reads of
// what the zone's day stored (pre-flight D): ZoneAirState.enemySup holds,
// per side, the worst superiority of a side at war with it over the zone,
// and under the key −side the battlefield-support bonus (supPenaltyPp) of
// the side that holds it. The superiority itself is AirCombat's
// dailyAirZone (spec §14.5).
import {
  WW_AA_CUT_MAX_PCT,
  WW_AIR_PENALTY_BP_PER_PM,
  WW_AIR_PENALTY_MAX_BP,
  WW_RADAR_DETECT_PM,
  WW_RADAR_RANGE_KM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  airMoveFactorPm,
  airPenaltyBp,
} from "@openfront/engine-lib/ww1936/AirRules";
import { effectiveLevel } from "../economy/Buildings";
import type { WwAir, ZoneAirState } from "./WwAir";

/** Spec §14.6 with battlefield support: the penalty's cap, bp (−35% − 5%p). */
export const WW_AIR_PENALTY_DOCTRINE_MAX_BP = 4_000;

/**
 * Spec §12.1: `side`'s radar detection bonus over zone `sr`, ‰: every
 * working radar a member of the side controls whose center lies within
 * 300 km × level of the zone's center gives 150 × level; overlaps give
 * the largest. (radar_2's +50 is its airDetectPct, counted in
 * detectionPm.) Scans the radar levels: only zones with an air battle ask.
 */
export function radarPmAt(air: WwAir, side: number, sr: number): number {
  const sc = air.ww.scenario;
  if (sc.sr(sr) === undefined) return 0;
  const land = air.land;
  const levels = air.econ.buildingArray("radar");
  let best = 0;
  for (let r = 1; r < levels.length; r++) {
    if (levels[r] === 0 || sc.region(r) === undefined) continue;
    const c = land.controller[r] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    const lv = effectiveLevel(air.econ, r, "radar");
    if (lv <= 0 || WW_RADAR_DETECT_PM * lv <= best) continue;
    if (sc.srKm(r, sr) <= WW_RADAR_RANGE_KM * lv)
      best = WW_RADAR_DETECT_PM * lv;
  }
  return best;
}

/**
 * Spec §14.6: the cut, bp ≤ 0, of the worst enemy superiority `enemySupPm`
 * with the enemy's battlefield-support bonus `bonusPp` (+5%p a level of
 * it, up to −40% in all), less the division's anti-air. Without a bonus it
 * is engine-lib airPenaltyBp.
 */
export function airPenaltyWithBonusBp(
  enemySupPm: number,
  bonusPp: number,
  divAirAtk: number,
): number {
  if (bonusPp <= 0) return airPenaltyBp(enemySupPm, divAirAtk);
  const base = Math.min(
    WW_AIR_PENALTY_MAX_BP,
    Math.max(0, enemySupPm - 500) * WW_AIR_PENALTY_BP_PER_PM,
  );
  if (base === 0) return 0;
  const raw = Math.min(WW_AIR_PENALTY_DOCTRINE_MAX_BP, base + bonusPp * 100);
  const cut = Math.min(WW_AA_CUT_MAX_PCT, Math.floor((divAirAtk * 3) / 2));
  const v = Math.floor((raw * (100 - cut)) / 100);
  return v === 0 ? 0 : -v;
}

function landZoneOf(air: WwAir, region: number): ZoneAirState | null {
  const sc = air.ww.scenario;
  const i = sc.srIdxOf(sc.regionSr(region));
  return i < 0 ? null : air.zoneState[i];
}

/** Spec §14.6: a division's attack and defense cut in `region` (WwAir.airPenaltyBp). */
export function airPenaltyFor(
  air: WwAir,
  region: number,
  side: number,
  divAirAtk: number,
): number {
  const z = landZoneOf(air, region);
  if (z === null) return 0;
  const worst = z.enemySup.get(side) ?? 0;
  if (worst <= 500) return 0;
  return airPenaltyWithBonusBp(worst, z.enemySup.get(-side) ?? 0, divAirAtk);
}

/** Spec §14.6: movement into `region` under enemy superiority, ‰ (WwAir.airMoveFactorPm). */
export function airMoveFactorFor(
  air: WwAir,
  region: number,
  side: number,
): number {
  const z = landZoneOf(air, region);
  if (z === null) return 1000;
  const worst = z.enemySup.get(side) ?? 0;
  return worst <= 500 ? 1000 : airMoveFactorPm(worst);
}
