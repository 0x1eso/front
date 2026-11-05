// World War 1936 war overhaul (ww7, lane B): occupation in depth bands
// (design §3, brief §2). A region of depth d falls band by band: every won
// battle takes one (WwLand.bandProg), the attackers move into the region
// ("occupying") while it is still the defenders', the defenders step back to
// the next band inside it, and control (with the victory-point tile) changes
// only when the last band falls (Occupation.capture). This file holds what
// the battles and the days share: the depth, the in-region retreat, the
// phase of a band fight, the push back and the daily upkeep.
import {
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_SEA,
  TPL_PARA_ANY,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  BAND_ATTACK_ORG_PCT,
  BAND_WITHDRAW_ORG_PCT,
  regionDepth,
} from "@openfront/engine-lib/ww1936/BandRules";
import { edgeTicks, moveNeed } from "@openfront/engine-lib/ww1936/MoveRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { joinBattle, leaveBattle, retreatDivision } from "./Battles";
import { walkStepInto } from "./Movement";
import type { Battle, WwLand } from "./WwLand";

/** The phases of a band fight (bandPhase): a round, hold, or the band falls. */
export const BAND_FIGHT = 0;
export const BAND_WAIT = 1;
export const BAND_WON = 2;

const depthCaches = new WeakMap<ScenarioIndex, Uint8Array>();

/**
 * The bands of a region (BandRules.regionDepth over its tiles, terrain and
 * victory points): static, kept per scenario.
 */
export function depthOf(land: WwLand, region: number): number {
  const sc = land.scenario;
  let cache = depthCaches.get(sc);
  if (cache === undefined) {
    cache = new Uint8Array(sc.maxRegionId() + 1);
    depthCaches.set(sc, cache);
  }
  let d = cache[region];
  if (d === 0) {
    const r = sc.region(region);
    d =
      r === undefined
        ? 1
        : regionDepth(sc.regionTiles(region).length, r.vp);
    cache[region] = d;
  }
  return d;
}

/**
 * Milli-km a division covers crossing one band of `region`: the mean time to
 * enter it over its edges (the edge time) divided by its bands. The retreat
 * in place and the walk through an empty band take this.
 */
export function bandNeedOf(land: WwLand, region: number): number {
  const sc = land.scenario;
  const edges = sc.edgesOf(region);
  if (edges.length === 0) return 1000;
  let sum = 0;
  for (const e of edges) sum += moveNeed(sc.edge(e.edge));
  return Math.max(1, Math.floor(sum / edges.length / depthOf(land, region)));
}

/**
 * Division `row` steps back to the next band inside its own region: a
 * retreat whose next region is the one it stands in. It leaves the battle,
 * takes a band's time to settle, and recovers half as fast as one standing
 * (Battles.stepRecovery). `withdrawBonus`: an orderly withdrawal gives back
 * some org at once.
 */
export function retreatInBand(
  land: WwLand,
  row: number,
  withdrawBonus: boolean,
): void {
  const t = land.divisions;
  const R = t.region[row];
  leaveBattle(land, row);
  t.mode[row] = MOVE_RETREAT;
  t.next[row] = R;
  t.edge[row] = -1;
  t.prog[row] = 0;
  t.step[row] = 0;
  t.need[row] = bandNeedOf(land, R);
  t.dest[row] = R;
  if (withdrawBonus) {
    const max = land.orgMaxOf(row);
    t.org[row] = Math.min(
      max,
      t.org[row] + Math.floor((max * BAND_WITHDRAW_ORG_PCT) / 100),
    );
  }
  land.markArmy(t.army[row]);
}

/** True while a division is stepping back to the next band of the region it stands in. */
export function steppingBack(land: WwLand, row: number): boolean {
  const t = land.divisions;
  return (
    t.mode[row] === MOVE_RETREAT &&
    t.next[row] === t.region[row] &&
    t.need[row] > 0
  );
}

/** Defenders of `region` stepping back inside it, against the `attacker` country. */
function defendersStepping(
  land: WwLand,
  region: number,
  attacker: number,
): boolean {
  for (const r of land.rowsIn(region)) {
    if (steppingBack(land, r) && land.isEnemy(attacker, land.fightOwner(r))) {
      return true;
    }
  }
  return false;
}

/** Whether any division of the side `attacker` fights stands in `region` (not attacking it): the defence is not empty. */
export function defenceIn(
  land: WwLand,
  region: number,
  attacker: number,
): boolean {
  const t = land.divisions;
  for (const r of land.rowsIn(region)) {
    if (t.id[r] === 0) continue;
    if (land.isEnemy(attacker, land.fightOwner(r))) return true;
  }
  return false;
}

/**
 * What the battle over band `b.band` of its region does this tick, once
 * its attackers and defenders are known: fight a round; hold (the
 * defenders are stepping back to the next band, or an empty band is being
 * walked through); or the band falls. With one band left this is the old
 * rule: no defender on its feet and it falls.
 */
export function bandPhase(land: WwLand, b: Battle, tick: number): number {
  const t = land.divisions;
  const R = b.region;
  let broken = false;
  for (const id of b.defenders) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    if (t.org[r] > 0) {
      land.bandDue[R] = 0;
      return BAND_FIGHT;
    }
    broken = true;
  }
  if (land.bandProg[R] + 1 >= depthOf(land, R) || broken) return BAND_WON;
  if (defendersStepping(land, R, b.attLead)) return BAND_WAIT;
  const due = land.bandDue[R];
  return due === 0 || tick >= due ? BAND_WON : BAND_WAIT;
}

/**
 * The tick an empty band of `region` falls to the `rows` standing in it:
 * a band's walk at the slowest of them. Written to bandDue.
 */
export function walkThrough(
  land: WwLand,
  region: number,
  rows: readonly number[],
  tick: number,
): void {
  let step = Infinity;
  for (const r of rows) step = Math.min(step, walkStepInto(land, r, region));
  if (step === Infinity) step = 1;
  land.bandDue[region] =
    tick + Math.max(1, edgeTicks(bandNeedOf(land, region), step));
}

/** Clears the band progress of a region (a peace, a taker that is no more). */
export function clearBands(land: WwLand, region: number): void {
  if (
    land.bandProg[region] === 0 &&
    land.bandTaker[region] === 0 &&
    land.bandDue[region] === 0
  ) {
    return;
  }
  land.bandProg[region] = 0;
  land.bandTaker[region] = 0;
  land.bandDue[region] = 0;
  land.markRegion(region);
}

/**
 * Whether an occupier keeps attacking on its own: its army runs a plan
 * (the ones that advance into a region after a win), or it is a
 * paratrooper dropped in with no order of its own. A halted army sits.
 */
function pressesOn(land: WwLand, row: number): boolean {
  const a = land.armies.get(land.divisions.army[row]);
  if (a !== undefined && a.order.kind === "plan" && a.order.executing) {
    return true;
  }
  return (land.baseStatsOf(row).flags & TPL_PARA_ANY) !== 0;
}

/**
 * The divisions of the taker's side standing in `region` while it is the
 * enemy's (the occupiers): those fit to fight (org at least a third, not
 * in a battle, standing) join the battle over the next band. Returns
 * whether any occupier stands there at all.
 */
export function attachOccupiers(land: WwLand, region: number): boolean {
  const t = land.divisions;
  const taker = land.bandTaker[region];
  const ctrl = land.controller[region];
  let any = false;
  for (const r of [...land.rowsIn(region)]) {
    if (t.id[r] === 0) continue;
    const fo = land.fightOwner(r);
    if (!land.isEnemy(fo, ctrl) || !land.sameSide(fo, taker)) continue;
    any = true;
    if (
      t.battle[r] === 0 &&
      t.mode[r] === MOVE_NONE &&
      t.org[r] > 0 &&
      t.org[r] * 100 >= land.orgMaxOf(r) * BAND_ATTACK_ORG_PCT &&
      pressesOn(land, r)
    ) {
      joinBattle(land, t.id[r], region);
    }
  }
  return any;
}

/**
 * The defenders held: the occupation recedes one band. The occupiers
 * step back one band inside the region; at band 0 they leave it for their
 * side's neighbour (or are destroyed with none).
 */
export function pushBack(land: WwLand, region: number): void {
  const prog = land.bandProg[region];
  if (prog === 0) return;
  const t = land.divisions;
  const ctrl = land.controller[region];
  const taker = land.bandTaker[region];
  const left = prog - 1;
  land.bandProg[region] = left;
  land.bandDue[region] = 0;
  if (left === 0) land.bandTaker[region] = 0;
  land.markRegion(region);
  for (const r of [...land.rowsIn(region)]) {
    if (t.id[r] === 0) continue;
    const fo = land.fightOwner(r);
    if (!land.isEnemy(fo, ctrl) || !land.sameSide(fo, taker)) continue;
    const m = t.mode[r];
    if (m === MOVE_RETREAT || m === MOVE_SEA) continue;
    if (left === 0) retreatDivision(land, r);
    else retreatInBand(land, r, false);
  }
}

/**
 * Once a day: regions in progress. A taker that is no longer at war with
 * the controller gives the progress up; the occupiers fit to fight attack
 * the next band; with none standing and no battle the defenders win a
 * band back. A scan of the region arrays, once a day.
 */
export function dailyBands(land: WwLand): void {
  const prog = land.bandProg;
  for (let R = 1; R < prog.length; R++) {
    if (prog[R] === 0) continue;
    const ctrl = land.controller[R];
    if (!land.isEnemy(land.bandTaker[R], ctrl)) {
      clearBands(land, R);
      continue;
    }
    const occupied = attachOccupiers(land, R);
    if (!occupied && !land.battles.has(R)) {
      prog[R]--;
      land.bandDue[R] = 0;
      if (prog[R] === 0) land.bandTaker[R] = 0;
      land.markRegion(R);
    }
  }
}
