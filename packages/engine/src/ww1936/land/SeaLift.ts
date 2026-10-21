// World War 1936 P4 (pre-flight A16, A17): the land war's side of a convoy
// voyage, for lanes C (sea moves) and I (invasions). A division at sea
// keeps its departure region with mode MOVE_SEA and need 0 (the voyage
// moves it; stepMovement skips such a row), so every per-region loop of P2
// stays whole.
import { MOVE_NONE, MOVE_SEA } from "@openfront/engine-api/ww1936/LandTypes";
import { applyHpLoss, leaveBattle } from "./Battles";
import { arrive } from "./Movement";
import type { WwLand } from "./WwLand";

/** Whether the division row is on a convoy voyage (lifted). */
export function atSea(land: WwLand, row: number): boolean {
  const t = land.divisions;
  return t.mode[row] === MOVE_SEA && t.need[row] === 0;
}

/**
 * Puts divisions (ids) on their convoys: out of their battles, mode
 * MOVE_SEA with need 0, org 0 (P2 spec §7.5: they sail with none).
 */
export function liftDivisions(land: WwLand, divs: readonly number[]): void {
  const t = land.divisions;
  for (const id of divs) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    leaveBattle(land, r);
    t.mode[r] = MOVE_SEA;
    t.next[r] = t.region[r];
    t.dest[r] = t.region[r];
    t.edge[r] = -1;
    t.prog[r] = 0;
    t.need[r] = 0;
    t.step[r] = 0;
    t.org[r] = 0;
    t.stillDays[r] = 0;
    t.entrench[r] = 0;
    land.markArmy(t.army[r]);
  }
}

/**
 * Lands divisions (ids) in `region` the way P2's arrival does (an empty
 * enemy region is taken this tick). `amphibious`: lane I's landing (it
 * opens the battle itself; the divisions only stand there).
 */
export function landDivisions(
  land: WwLand,
  divs: readonly number[],
  region: number,
  amphibious: boolean,
  tick: number,
): void {
  const t = land.divisions;
  for (const id of divs) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    if (amphibious) {
      land.setDivisionRegion(r, region);
      t.mode[r] = MOVE_NONE;
      t.next[r] = region;
      t.dest[r] = region;
      t.edge[r] = -1;
      t.prog[r] = 0;
      t.need[r] = 0;
      t.step[r] = 0;
      land.markArmy(t.army[r]);
      continue;
    }
    t.next[r] = region;
    t.dest[r] = region;
    arrive(land, r, tick);
  }
}

/**
 * P2 spec §5.5's loss rule on divisions (ids): each loses `fracPm` ‰ of
 * its HP in men and equipment (a division with no men left is destroyed).
 */
export function damageDivisions(
  land: WwLand,
  divs: readonly number[],
  fracPm: number,
): void {
  const t = land.divisions;
  for (const id of divs) {
    const r = t.rowOf(id);
    if (r < 0 || fracPm <= 0) continue;
    const hp = land.statsOf(r).hpMilli;
    applyHpLoss(land, r, Math.max(1, Math.floor((hp * fracPm) / 1000)));
  }
}

/** P4 spec §10.5: a division's convoy weight, centi. */
export function divisionWeightCenti(land: WwLand, div: number): number {
  const r = land.divisions.rowOf(div);
  return r < 0 ? 0 : land.baseStatsOf(r).weightCenti;
}
