// World War 1936 P2: movement (P2 spec §7.2–§7.7). Task 3 owns this file.
// The foundation finished the tick loop (stepMovement, its step and its
// arrival: pre-flight U9) and stopDivision / startHopInto; startNextHop,
// pathTicks and findPath are Task 3's stubs.
import {
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  TPL_ARMOR_ANY,
  TPL_CAVALRY_MAJOR,
  TPL_MOTOR_ANY,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  moveNeed,
  moveStep,
  railStep,
} from "@openfront/engine-lib/ww1936/MoveRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { joinBattle, retreatDivision } from "./Battles";
import { generalOf } from "./GeneralsRun";
import { capture } from "./Occupation";
import type { Army, WwLand } from "./WwLand";

/** Every moving division by row (= id) order (spec §2.2-4). */
export function stepMovement(land: WwLand, tick: number): void {
  const t = land.divisions;
  const prep = land.ww.inPrep(tick);
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.mode[r] === MOVE_NONE) continue;
    const owner = t.owner[r];
    const mode = t.mode[r];
    const to = t.next[r];
    const c = land.controller[to];
    if (!land.sameSide(owner, c)) {
      if (mode === MOVE_WALK || mode === MOVE_ADVANCE) {
        // Spec §7.7: never across into an enemy region that has enemy divisions.
        if (prep || !land.isEnemy(owner, c)) {
          stopDivision(land, r);
          continue;
        }
        if (enemyDivisionsIn(land, owner, to) > 0) {
          stopDivision(land, r);
          joinBattle(land, t.id[r], to);
          continue;
        }
      } else if (mode === MOVE_RAIL || mode === MOVE_SEA) {
        // Spec §7.4: the enemy took a region on the way: off the train here.
        stopDivision(land, r);
        continue;
      } else if (mode === MOVE_RETREAT) {
        // Its refuge fell: retreat again from where it is (or be destroyed).
        stopDivision(land, r);
        retreatDivision(land, r);
        continue;
      }
    }
    const step = stepOf(land, r, mode);
    t.step[r] = step;
    t.prog[r] = Math.min(t.need[r], t.prog[r] + step);
    if (t.prog[r] >= t.need[r]) arrive(land, r, tick);
  }
}

function stepOf(land: WwLand, r: number, mode: number): number {
  const t = land.divisions;
  if (mode === MOVE_SEA) return 1000; // need is in milli-ticks
  const ce = land.econ.country(t.owner[r])!;
  if (mode === MOVE_RAIL) return railStep(ce.tech.railSpeedPct);
  const to = t.next[r];
  const sc = land.scenario;
  const w = weatherAt(land.day(), sc.latC(to), sc.landOf(to), sc.wcell(to));
  const s = land.baseStatsOf(r);
  return moveStep(
    s.speedCenti,
    land.econ.infra[to],
    w,
    t.supply[r],
    ce.tech.speedPct * 100 + traitSpeedBp(land, r, s.flags),
  );
}

function arrive(land: WwLand, r: number, tick: number): void {
  const t = land.divisions;
  const owner = t.owner[r];
  const to = t.next[r];
  const mode = t.mode[r];
  if (!land.sameSide(owner, land.controller[to])) {
    // Walking or advancing into an empty enemy region takes it (spec §7.7,
    // §9.7). Rows run in id order: the smaller division arrives first.
    capture(land, to, owner, tick);
  }
  land.setDivisionRegion(r, to);
  t.mode[r] = MOVE_NONE;
  t.prog[r] = 0;
  t.need[r] = 0;
  t.edge[r] = -1;
  t.step[r] = 0;
  t.stillDays[r] = 0;
  t.entrench[r] = 0;
  t.role[r] = 0;
  t.battle[r] = 0;
  if (mode !== MOVE_RETREAT && t.dest[r] !== to) startNextHop(land, r, tick);
}

/** Spec §6.2: the general's movement traits, bp (panzer leader, cavalry officer). */
export function traitSpeedBp(land: WwLand, r: number, flags: number): number {
  const army = land.armies.get(land.divisions.army[r]);
  const g = army === undefined ? null : generalOf(land, army);
  if (g === null) return 0;
  let bp = 0;
  if (
    (g.traits & traitBit("panzer_leader")) !== 0 &&
    (flags & (TPL_ARMOR_ANY | TPL_MOTOR_ANY)) !== 0
  ) {
    bp += 1000;
  }
  if (
    (g.traits & traitBit("cavalry_officer")) !== 0 &&
    (flags & TPL_CAVALRY_MAJOR) !== 0
  ) {
    bp += 1000;
  }
  return bp;
}

/**
 * Divisions in `region` (standing there: not advancing in or retreating
 * through) of countries `owner` may fight now.
 */
export function enemyDivisionsIn(
  land: WwLand,
  owner: number,
  region: number,
): number {
  const t = land.divisions;
  let n = 0;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (land.isEnemy(owner, t.owner[r])) n++;
  }
  return n;
}

/** Starts division `row` on the next edge toward its dest (or stops it). Task 3. */
export function startNextHop(land: WwLand, row: number, tick: number): void {}

/** Ticks for an army to walk `path` at its slowest division's pace (UI ETA, AI). Task 3. */
export function pathTicks(
  land: WwLand,
  army: Army,
  path: readonly number[],
): number {
  return 0;
}

/** Shortest region path (Dijkstra, spec §7.3) for `owner`'s army over regions `pass` accepts; [] when none. Task 3. */
export function findPath(
  land: WwLand,
  army: Army,
  from: number,
  to: number,
  pass: (region: number) => boolean,
): number[] {
  return [];
}

/** Stops a division where it stands (finished here by the foundation; C and A call it). */
export function stopDivision(land: WwLand, row: number): void {
  const t = land.divisions;
  t.mode[row] = MOVE_NONE;
  t.prog[row] = 0;
  t.need[row] = 0;
  t.step[row] = 0;
  t.edge[row] = -1;
  t.dest[row] = t.region[row];
  land.markArmy(t.army[row]);
}

/** Starts a division straight into a neighbouring region (advance, retreat, walking into an empty enemy region). */
export function startHopInto(
  land: WwLand,
  row: number,
  region: number,
  mode: number,
): void {
  const t = land.divisions;
  const e = land.scenario.edgeBetween(t.region[row], region);
  if (e < 0) return;
  t.next[row] = region;
  t.edge[row] = e;
  t.prog[row] = 0;
  t.step[row] = 0;
  t.mode[row] = mode;
  t.dest[row] = region;
  t.need[row] = moveNeed(land.scenario.edge(e), land.scenario.landOf(region));
  land.markArmy(t.army[row]);
}
