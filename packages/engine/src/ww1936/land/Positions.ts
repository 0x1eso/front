// World War 1936 ww7: positions (war overhaul brief §4, design §5). The
// longer a side stands in a region, the better prepared it is there: a
// level 0..3 a region (WwLand.posLevel), +5% defence a level for the
// controller's defending divisions (CombatRules POSITION_DEF_BP, the
// battle card's "position" line). A position belongs to the region, not to
// the divisions: it stays when others take over, and goes when the region
// changes hands (WwLand.setController) or stands empty of the controller's
// side for POS_EMPTY_DAYS days.
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import type { WwLand } from "./WwLand";

/** The highest position level. */
export const POS_MAX_LEVEL = 3;
/** Days of standing a level takes (a region is a "position" only after this long, see stepPosition). */
export const POS_STEP_DAYS = 5;
/** Days a region stands empty of its controller's side before the position is gone. */
export const POS_EMPTY_DAYS = 5;

/**
 * One day of one region's position. `level` and `days` are WwLand.posLevel
 * and posDays: `days` > 0 counts days stood towards the next level (a day in
 * an army's Defend zone counts twice), `days` < 0 counts days empty.
 *
 * A region qualifies after POS_STEP_DAYS days of standing and then builds a
 * level every POS_STEP_DAYS days; one whose every edge to the enemy crosses
 * a river (`river`) qualifies at level 1. So an ordinary region has level 1
 * after 10 days (5 in a zone), a river one after 5.
 */
export function stepPosition(
  level: number,
  days: number,
  stood: boolean,
  zone: boolean,
  river: boolean,
): { level: number; days: number } {
  if (!stood) {
    // Nothing built yet: the standing starts over. Else the position
    // holds for POS_EMPTY_DAYS empty days (the progress to the next level
    // is lost at once).
    if (level === 0) return { level: 0, days: 0 };
    const empty = (days > 0 ? 0 : -days) + 1;
    return empty >= POS_EMPTY_DAYS
      ? { level: 0, days: 0 }
      : { level, days: -empty };
  }
  if (level >= POS_MAX_LEVEL) return { level: POS_MAX_LEVEL, days: 0 };
  let d = Math.max(0, days) + (zone ? 2 : 1);
  let lv = level;
  while (lv < POS_MAX_LEVEL) {
    const need = lv === 0 && !river ? 2 * POS_STEP_DAYS : POS_STEP_DAYS;
    if (d < need) break;
    d -= need;
    lv++;
  }
  return { level: lv, days: lv >= POS_MAX_LEVEL ? 0 : d };
}

/** Every edge of `region` to a region an enemy of `ctrl` controls crosses a river (and there is one). */
export function riverFronted(
  land: WwLand,
  region: number,
  ctrl: number,
): boolean {
  const sc = land.scenario;
  let any = false;
  for (const e of sc.edgesOf(region)) {
    const c = land.controller[e.to];
    if (!land.isEnemy(ctrl, c)) continue;
    if (sc.edge(e.edge).river === 0) return false;
    any = true;
  }
  return any;
}

/**
 * The country's day (WwLand.dailyCountry, with dailyEntrench): each region
 * `smallID` controls takes its day.
 */
export function dailyPositions(land: WwLand, smallID: number): void {
  const t = land.divisions;
  for (const reg of land.scenario.landRegions) {
    const r = reg.id;
    if (land.controller[r] !== smallID) continue;
    const level = land.posLevel[r];
    const days = land.posDays[r];
    // Who stood: a division of the controller's side that is not moving.
    let stood = false;
    let zone = false;
    for (const row of land.rowsIn(r)) {
      if (t.mode[row] !== MOVE_NONE) continue;
      if (!land.sameSide(land.fightOwner(row), smallID)) continue;
      stood = true;
      const a = land.armies.get(t.army[row]);
      if (a !== undefined && a.order.kind === "front" && a.front.includes(r)) {
        zone = true;
        break;
      }
    }
    if (!stood && level === 0 && days === 0) continue;
    // (Only a region without a level starts from the river.)
    const river = stood && level === 0 && riverFronted(land, r, smallID);
    const next = stepPosition(level, days, stood, zone, river);
    if (next.level === level && next.days === days) continue;
    land.posLevel[r] = next.level;
    land.posDays[r] = next.days;
    if (next.level !== level) land.markRegion(r);
  }
}

/** The region changed hands (WwLand.setController): its position is gone. */
export function resetPosition(land: WwLand, region: number): void {
  land.posLevel[region] = 0;
  land.posDays[region] = 0;
}
