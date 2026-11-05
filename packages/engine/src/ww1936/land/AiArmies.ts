// World War 1936 ww81 lane A: the pure rules for how the AI (and a human's
// training switch) composes armies: where a new division joins, which two
// small armies merge, which role an auto-trained army plays, and which
// battalion shape pays no width penalty. Plain data in, a decision out; no
// game state, so each rule is tested alone (AiLand wires them in).
import { WW_MAX_ARMY_DIVISIONS } from "@openfront/engine-api/ww1936/LandTypes";
import {
  excessWidthBp,
  TERRAIN,
} from "@openfront/engine-lib/ww1936/CombatRules";

/** The armour share a shock army keeps: at least a third (the measured 20:4 trap is below it). */
export const SHOCK_THIRD = 3;
/** Armour in one shock army: half of a full army (12 armour + 12 line). */
export const SHOCK_ARMOUR_MAX = WW_MAX_ARMY_DIVISIONS / 2;
/** An army under this many divisions is a merge candidate. */
export const MERGE_UNDER = 6;
/** Merges one country makes in a day. */
export const MERGES_PER_DAY = 2;

/** What the rules need to know of an army. */
export interface ArmyFacts {
  id: number;
  /** Divisions, counting those in training for it. */
  n: number;
  /** Armour and motorized divisions. */
  armour: number;
  /** Mountain, marine, paratroop and cavalry divisions: kept apart. */
  apart: number;
}

/** An army is a shock army when armour is at least a third of it. */
export function isShock(a: ArmyFacts): boolean {
  return a.armour > 0 && a.armour * SHOCK_THIRD >= a.n;
}

/** Most of the army is special troops: they stay among their own. */
export const mostlyApart = (a: ArmyFacts) => a.apart * 2 > a.n;

/**
 * The army a new division joins (0: a new one). `armour`: an armour or
 * motorized division, else a line one (mountain and cavalry count as line,
 * as before). Candidates are already filtered for stretch, orders and
 * guards; an idle forming army of any size is among them.
 *
 * Armour: a shock army (else any army with armour) under 12 armour with
 * room, the most armoured first. Line: a shock army that stays a third
 * armour with the division in, the most armoured first; else the smallest
 * line army with room. Never makes 20:4. ww91 rule 8, `unit` (Guards, marines,
 * the national mountain troops): the fullest army of its own kind with room,
 * else a new one, so that the good troops can be posted as one.
 */
export function trainTargetArmy(
  armour: boolean,
  armies: readonly ArmyFacts[],
  unit = false,
): number {
  if (unit) {
    const own = armies
      .filter((a) => a.n < WW_MAX_ARMY_DIVISIONS && mostlyApart(a))
      .sort((a, b) => b.n - a.n || a.id - b.id);
    return own[0]?.id ?? 0;
  }
  const room = armies.filter(
    (a) => a.n < WW_MAX_ARMY_DIVISIONS && !mostlyApart(a),
  );
  const byId = (a: ArmyFacts, b: ArmyFacts) => a.id - b.id;
  if (armour) {
    const c = room
      .filter((a) => a.armour > 0 && a.armour < SHOCK_ARMOUR_MAX)
      .sort(
        (a, b) =>
          Number(isShock(b)) - Number(isShock(a)) ||
          b.armour - a.armour ||
          byId(a, b),
      );
    return c[0]?.id ?? 0;
  }
  const shock = room
    .filter((a) => a.armour > 0 && a.armour * SHOCK_THIRD >= a.n + 1)
    .sort((a, b) => b.armour - a.armour || byId(a, b));
  if (shock.length > 0) return shock[0].id;
  const line = room
    .filter((a) => !isShock(a))
    .sort((a, b) => a.n - b.n || byId(a, b));
  return line[0]?.id ?? 0;
}

/** An army for the merge choice. */
export interface MergeFacts extends ArmyFacts {
  region: number;
  /** The land stretch of our side it stands in. */
  comp: number;
  /** The enemy of its front or plan; -1: idle. */
  front: number;
  planBp: number;
}

/**
 * The merge to make: the smallest army under 6 divisions and the nearest
 * partner (by `km`) with which it makes a good army of at most 24: same
 * stretch, the same enemy's front or idle, kept-apart divisions only with
 * their own kind, and never armour under a third (20:4). The partner with
 * the higher plan readiness keeps its plan (ties: the bigger, then the
 * lower id). `near`: same region, so the merge is legal now; else the
 * small army has to walk first.
 */
export function chooseMerge(
  armies: readonly MergeFacts[],
  km: (a: number, b: number) => number,
): { army: number; into: number; near: boolean } | null {
  const smalls = armies
    .filter((a) => a.n < MERGE_UNDER && a.n > 0)
    .sort((a, b) => a.n - b.n || a.id - b.id);
  for (const s of smalls) {
    let best: MergeFacts | null = null;
    let bestKm = Infinity;
    for (const p of armies) {
      if (p.id === s.id || p.comp !== s.comp || p.comp < 0) continue;
      if (s.front >= 0 && p.front >= 0 && s.front !== p.front) continue;
      const total = p.n + s.n;
      if (total > WW_MAX_ARMY_DIVISIONS) continue;
      if (mostlyApart(s) !== mostlyApart(p)) continue;
      const armour = p.armour + s.armour;
      if (armour > 0 && armour * SHOCK_THIRD < total) continue;
      const d = km(s.region, p.region);
      if (d < bestKm || (d === bestKm && best !== null && p.id < best.id)) {
        best = p;
        bestKm = d;
      }
    }
    if (best === null) continue;
    const keep =
      s.planBp > best.planBp ||
      (s.planBp === best.planBp &&
        (s.n > best.n || (s.n === best.n && s.id < best.id)))
        ? s
        : best;
    const gone = keep === s ? best : s;
    return {
      army: gone.id,
      into: keep.id,
      near: s.region === best.region,
    };
  }
  return null;
}

/** What ww91 rule 3 weighs of an army of an outnumbered front. */
export interface PoolFacts {
  id: number;
  n: number;
  /** Armour or special troops: the fist. */
  fist: boolean;
  /** It stands behind the line already. */
  back: boolean;
}

/**
 * ww91 rule 3: the armies kept out of an outnumbered front's line, about
 * `pct` % of its divisions: those back already, then the fist, then the
 * smaller, as long as one army stays and the rest keep a division for each of
 * the `regions` of the line. None with fewer than three armies, and no army
 * of more than twice the share (a pool is a part, not the front).
 */
export function choosePool(
  armies: readonly PoolFacts[],
  pct: number,
  regions: number,
): number[] {
  if (armies.length < 3 || pct <= 0) return [];
  let total = 0;
  for (const a of armies) total += a.n;
  const want = Math.floor((total * pct) / 100);
  const order = [...armies].sort(
    (a, b) =>
      Number(b.back) - Number(a.back) ||
      Number(b.fist) - Number(a.fist) ||
      a.n - b.n ||
      a.id - b.id,
  );
  const out: number[] = [];
  let kept = 0;
  for (const a of order) {
    if (kept >= want || out.length + 1 >= armies.length) break;
    if (a.n > want * 2 || total - kept - a.n < regions) continue;
    out.push(a.id);
    kept += a.n;
  }
  return out;
}

/** The AI's two auto levels for a human's auto-trained army. */
export type ArmyRole = "defence" | "offence";

/**
 * Role of an auto-trained army: a shock army, or one on the main sector,
 * goes offence; the rest defend. `onMain`: null while no main-sector rule
 * exists (lane C's land/AiEffort.ts), then armour share alone judges.
 */
export function judgeRole(a: ArmyFacts, onMain: boolean | null): ArmyRole {
  return isShock(a) || onMain === true ? "offence" : "defence";
}

// ---- Width (T1) ----

/** Combat widths a line meets: each land type's, with 1 to 4 directions. */
const COMBAT_WIDTHS: readonly number[] = (() => {
  const set = new Set<number>();
  for (const t of Object.values(TERRAIN)) {
    for (let d = 0; d < 4; d++) set.add(t.width + t.perDirection * d);
  }
  return [...set].sort((a, b) => a - b);
})();

/**
 * The attack lost (bp, summed over the combat widths) by a line of
 * divisions `w` wide, filled by the battle's own rule: the last division
 * stands when a third of it fits, and the excess costs 2 % per 1 %.
 */
export function widthPenaltyBp(w: number): number {
  if (w <= 0) return 0;
  let sum = 0;
  for (const width of COMBAT_WIDTHS) {
    let used = 0;
    for (;;) {
      const over = used + w > width;
      if (!over || (width - used) * 3 >= w) used += w;
      if (over) break;
    }
    sum += excessWidthBp(used, width);
  }
  return -sum;
}

/** A battalion shape and the width it makes. */
export interface ShapeCandidate {
  index: number;
  width: number;
  /** Battalions added (1) or removed (-1) against the current shape. */
  delta: number;
}

/**
 * The shape to refit to: the least width penalty; at a tie the current
 * one stays, else the doctrine's (`prefer`: -1 removes a battalion, 1 adds
 * one). Returns the candidate's index, or -1 to keep the current shape.
 */
export function chooseShape(
  currentWidth: number,
  candidates: readonly ShapeCandidate[],
  prefer: -1 | 1,
): number {
  let bestPenalty = widthPenaltyBp(currentWidth);
  let best = -1;
  let bestDelta = 0;
  for (const c of candidates) {
    const p = widthPenaltyBp(c.width);
    if (
      p < bestPenalty ||
      (p === bestPenalty &&
        best >= 0 &&
        c.delta === prefer &&
        bestDelta !== prefer)
    ) {
      bestPenalty = p;
      best = c.index;
      bestDelta = c.delta;
    }
  }
  return best;
}
