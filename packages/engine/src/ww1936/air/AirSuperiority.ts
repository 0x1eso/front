// World War 1936 P4: radar and the land war's air penalties (P4 spec
// §12.1 radar, §14.6). Lane A1 (Task 7). The penalties are O(1) reads of
// what the zone's day stored (pre-flight D): ZoneAirState.enemySup holds,
// per side, the worst superiority of a side at war with it over the zone,
// enemyPp that enemy's battlefield-support bonus (supPenaltyPp); the
// screens get both (AirZoneData.enemySky) and the same engine-lib rule.
// The superiority itself is AirCombat's dailyAirZone (spec §14.5).
import {
  WW_RADAR_DETECT_PM,
  WW_RADAR_RANGE_KM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  airGroundPenaltyBp,
  airMoveFactorPm,
} from "@openfront/engine-lib/ww1936/AirRules";
import { effectiveLevel } from "../economy/Buildings";
import { hasMagnetron, MAGNETRON_RADAR_PM } from "./ProjectEffects";
import type { WwAir, ZoneAirState } from "./WwAir";

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
    // P6 (spec §9.3, T1b): the magnetron's +100‰ a level.
    const pm =
      (WW_RADAR_DETECT_PM +
        (hasMagnetron(air.ww.depth, c) ? MAGNETRON_RADAR_PM : 0)) *
      lv;
    if (lv <= 0 || pm <= best) continue;
    if (sc.srKm(r, sr) <= WW_RADAR_RANGE_KM * lv) best = pm;
  }
  return best;
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
  return airGroundPenaltyBp(worst, z.enemyPp.get(side) ?? 0, divAirAtk);
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
