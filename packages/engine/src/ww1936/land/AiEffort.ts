// World War 1936 ww81 (design ww80 C1): the AI's main effort, pure. A
// front's attacks go in on one chosen enemy region instead of along the
// whole border (a broad attack at 1.5:1 took 0 of 4 regions, all divisions
// on one region reached the objective). AiLand gathers the plain numbers
// below from the game and acts on the answer; nothing here reads the game.
import type { ArmyOrder } from "@openfront/engine-api/ww1936/LandTypes";
import { idHash } from "@openfront/engine-lib/ww1936/Roll";

/** wwRoll purpose of the main sector's seeded choice. */
export const P_AXIS = idHash("ai_axis");
/** Rule 1: a sector stands this many days, unless its effort ends first. */
export const AI_EFFORT_PERIOD_DAYS = 10;
/** Rule 1: a fort of this level or more is left out while anything else is in reach. */
export const AI_EFFORT_FORT_BAR = 4;
/** ww90: with heavy tanks or assault infantry at hand, a level higher, and a fort counts this share. */
export const AI_EFFORT_BREAK_FORT_BAR = 5;
export const AI_EFFORT_BREAK_FORT_PCT = 75;
/** Rule 1: an enemy capital's value, on top of its victory points. */
export const AI_EFFORT_CAPITAL_VALUE = 10;
/** Rule 2 (내 판단): the second-best sector is in the draw within this share of the best. */
export const AI_EFFORT_CLOSE_PCT = 15;

/** C4 (내 판단, from the 90 % measurement): enemy superiority from this ‰ halves a sector's score. */
export const AI_EFFORT_SKY_PM = 700;

/** One enemy region the effort could go for. */
export interface EffortRegion {
  region: number;
  vp: number;
  capital: boolean;
  /** Fort level there. */
  fort: number;
  /** Combat width of the region at that fort level. */
  width: number;
  /** The enemy divisions' defence there. */
  defence: number;
  /** What else counts: the divisions it would cut off, the road to deeper objectives. */
  extra: number;
  /** The enemy's superiority in the air zone, ‰. */
  skyPm?: number;
}

/**
 * Value × 1000 ÷ defence (rule 1). The value starts at 1, so that with no
 * victory points anywhere the weakest region still wins; the width stands
 * for the fort level, so that nobody at all behind a fort is not free. Under
 * an enemy sky the score halves (C4).
 */
export function effortScore(r: EffortRegion, breaksForts = false): number {
  const value = 1 + r.vp + (r.capital ? AI_EFFORT_CAPITAL_VALUE : 0) + r.extra;
  const fort = r.fort * r.width;
  const score = Math.floor(
    (value * 1000) /
      Math.max(
        1,
        r.defence +
          (breaksForts
            ? Math.floor((fort * AI_EFFORT_BREAK_FORT_PCT) / 100)
            : fort),
      ),
  );
  return (r.skyPm ?? 0) >= AI_EFFORT_SKY_PM ? Math.floor(score / 2) : score;
}

/**
 * The main sector among `regions`: the best score, the fort-free ones first;
 * ties to the smaller id. `roll` (any non-negative integer, the seeded draw of
 * this period) takes the second best half the time when it is within
 * AI_EFFORT_CLOSE_PCT of the best, so games differ. 0 with no region.
 * `keep`, the sector standing now, stays while it is that close to the best:
 * armies do not march off for a coin. `breaksForts`: ww90, the force has heavy
 * tanks or assault infantry.
 */
export function pickMainSector(
  regions: readonly EffortRegion[],
  roll: number,
  keep = 0,
  breaksForts = false,
): number {
  const bar = breaksForts ? AI_EFFORT_BREAK_FORT_BAR : AI_EFFORT_FORT_BAR;
  const open = regions.filter((r) => r.fort < bar);
  const list = (open.length > 0 ? open : regions)
    .map((r) => ({ region: r.region, score: effortScore(r, breaksForts) }))
    .sort((a, b) => b.score - a.score || a.region - b.region);
  if (list.length === 0) return 0;
  const [first, second] = list;
  const kept = list.find((r) => r.region === keep);
  if (
    kept !== undefined &&
    kept.score * 100 >= first.score * (100 - AI_EFFORT_CLOSE_PCT)
  ) {
    return keep;
  }
  const close =
    second !== undefined &&
    second.score * 100 >= first.score * (100 - AI_EFFORT_CLOSE_PCT);
  return close && roll % 2 === 1 ? second.region : first.region;
}

/**
 * The region an army's main effort goes for, 0 when it is on none: a plan
 * waiting (the AI's others run at once), or a direct attack. This is the main
 * sector other AI code reads; the orders are all the memory an effort has.
 */
export function effortTarget(o: ArmyOrder): number {
  if (o.kind !== "plan" || o.targets.length === 0) return 0;
  return o.direct === true || !o.executing ? o.targets[0] : 0;
}

/** C6: divisions the regions feed, at `unit` milli of supply a division (each region floored). */
export function effortRoom(supply: readonly number[], unit: number): number {
  const u = Math.max(1, unit);
  let n = 0;
  for (const m of supply) n += Math.floor(m / u);
  return n;
}

/** C6: a sector feeding under half of the force meant for it starts no effort. */
export function effortFed(room: number, divisions: number): boolean {
  return room * 2 >= divisions;
}

/** C3: what taking each region of an enemy's land would cut off, and what is cut already. */
export interface EnemyCuts {
  /** Region -> enemy divisions behind it, seen from the capital. */
  cut: Map<number, number>;
  /** Enemy regions no land road joins to the capital (pockets, from the map alone). */
  pocket: Set<number>;
}

/**
 * C3 rule 1: articulation regions of the enemy's land graph from its capital,
 * one linear pass (iterative low-link). `regions` ascending; `edges(r)` the
 * neighbours, in a fixed order; `divisions(r)` the enemy divisions in r. With
 * no capital (0, or not in the list) nothing is cut and nothing is a pocket.
 */
export function enemyCuts(
  regions: readonly number[],
  capital: number,
  edges: (region: number) => readonly number[],
  divisions: (region: number) => number,
): EnemyCuts {
  const cut = new Map<number, number>();
  const pocket = new Set<number>();
  const known = new Set(regions);
  if (!known.has(capital)) return { cut, pocket };
  const disc = new Map<number, number>();
  const low = new Map<number, number>();
  const below = new Map<number, number>();
  let clock = 0;
  const open = (r: number) => {
    clock++;
    disc.set(r, clock);
    low.set(r, clock);
    below.set(r, divisions(r));
    return {
      r,
      parent: 0,
      next: 0,
      list: edges(r).filter((e) => known.has(e)),
    };
  };
  const stack = [open(capital)];
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.next < top.list.length) {
      const e = top.list[top.next++];
      if (e === top.parent) continue;
      const seen = disc.get(e);
      if (seen !== undefined) {
        low.set(top.r, Math.min(low.get(top.r)!, seen));
        continue;
      }
      const child = open(e);
      child.parent = top.r;
      stack.push(child);
      continue;
    }
    stack.pop();
    const up = stack[stack.length - 1];
    if (up === undefined) break;
    low.set(up.r, Math.min(low.get(up.r)!, low.get(top.r)!));
    below.set(up.r, below.get(up.r)! + below.get(top.r)!);
    if (low.get(top.r)! >= disc.get(up.r)! && up.r !== capital) {
      cut.set(up.r, (cut.get(up.r) ?? 0) + below.get(top.r)!);
    }
  }
  for (const r of regions) if (!disc.has(r)) pocket.add(r);
  return { cut, pocket };
}
