// The Imjin War's land AI rules (ww175 design §9, ww177 lane I5a), pure and
// integer. The 1936 land AI still runs every army; these rules only tell it
// where the war is going, by state:
// - its aim: the first city of its country's chain an enemy holds (Japan
//   drives on Hanseong, then Pyongyang; Ming relieves Pyongyang, then
//   Hanseong), reached by the cheapest way over the land, open ground
//   first and the passes last;
// - which of its own regions it guards: castles and passes count;
// - each country's personality (IMJIN_AI_PLANS, over 1936's AiPlans).
// The engine side is `engine/imjin/land/ImjinLandAi.ts`.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { NationalPlan } from "../ww1936/AiPlans";
import type { ImjinTerrain } from "./Terrain";

/**
 * The cities each country drives on, in order (region names). The aim is
 * the first one an enemy holds; a chain whose cities are all friendly
 * leaves the 1936 targets alone (Ming then pushes on the nearest of its
 * ally's regions Japan holds). Joseon has none: it holds and retakes by
 * the 1936 rules (the nearest of its own regions first).
 */
export const AIM_CHAIN: Readonly<Record<string, readonly string[]>> = {
  JPN: ["Hanseong", "Pyongyang", "Uiju"],
  MIN: ["Pyongyang", "Hanseong"],
};

/** The march cost of entering a region (design §4: big, readable terrain). */
export function aimCost(t: ImjinTerrain): number {
  switch (t) {
    case "plain":
    case "paddy":
    case "walled":
      return 3;
    case "hills":
    case "forest":
    case "marsh":
    case "fortress":
      return 4;
    case "mountain":
    case "pass":
      // A pass is where an ambush waits: gone round when the way round is
      // not much longer.
      return 6;
  }
}

/** The march cost of the cheapest way from every region to `aim`. */
export function aimDistances(
  n: number,
  aim: number,
  neighbours: (r: number) => readonly number[],
  cost: (r: number) => number,
  passable: (r: number) => boolean,
): Int32Array {
  const FAR = 1 << 30;
  const dist = new Int32Array(n).fill(FAR);
  if (aim < 0 || aim >= n) return dist;
  dist[aim] = 0;
  // A small Dijkstra (the map has ~150 regions): the cost of a step is the
  // region being left toward the aim, so the march pays for what it crosses.
  const done = new Uint8Array(n);
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] === 0 && dist[i] < FAR && (u < 0 || dist[i] < dist[u])) {
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    for (const v of neighbours(u)) {
      if (v < 0 || v >= n || done[v] === 1 || !passable(v)) continue;
      const d = dist[u] + cost(v);
      if (d < dist[v]) dist[v] = d;
    }
  }
  return dist;
}

/** Victory points an enemy region gets as a target, by its march cost to the aim. */
export const AIM_PULL_VP = 40;
export function aimBonusVp(costToAim: number): number {
  return Math.max(0, AIM_PULL_VP - costToAim);
}

/**
 * What a region of ours is worth as a guard post (the garrison slots): a
 * castle or a fortress holds a road, and a pass is where a small force
 * stops a large one (and lies in ambush, design §5).
 */
export function guardBonusVp(t: ImjinTerrain): number {
  switch (t) {
    case "walled":
    case "fortress":
      return 2;
    case "pass":
      return 3;
    default:
      return 0;
  }
}

/**
 * The war's personalities (design §9: "Personalities come from AiPlans
 * rows"), over AI_PLAN_DEFAULT and scaled by each game's seeded strength
 * like 1936's:
 * - Japan pushes hard: it attacks at lower odds and wearier, keeps few
 *   guards and lands with no fleet to cover it;
 * - Joseon holds: a large guard for the castles and passes, a reserve
 *   that counter-attacks only when strong, and lines that give ground
 *   (to the north) when outnumbered;
 * - Ming comes in strength and attacks as a major does.
 */
export const IMJIN_AI_PLANS: Readonly<
  Partial<Record<CountryTag, Readonly<Partial<NationalPlan>>>>
> = {
  JPN: {
    offensePct: 300,
    oneEnemyPct: 100,
    gateMidPct: 80,
    gateLowPct: 75,
    reservePct: 5,
    holdCenti: 100,
    regroupPm: 250,
    reattackPm: 600,
    landingSupPm: 0,
    invasionSparePct: 10,
  },
  JOS: {
    offensePct: 150,
    reservePct: 25,
    poolPct: 20,
    counterPm: 1300,
    ringVpPct: 200,
    holdCenti: 250,
    regroupPm: 450,
    reattackPm: 900,
  },
  MIN: {
    offensePct: 220,
    oneEnemyPct: 100,
    gateMidPct: 95,
    regroupPm: 350,
    reattackPm: 800,
  },
};

/**
 * The share of the occupation's garrison need an AI fills, % (1936: 90,
 * or 60 when its fronts want the troops). Japan drives on with a thin
 * rear: the counties it leaves unguarded rise (the righteous armies).
 */
export const IMJIN_GARRISON_PCT: Readonly<Record<string, number>> = {
  JPN: 30,
};

/**
 * How much of a region's supply an AI counts on when it masses for an
 * attack, % (1936: 100, never more than the region feeds). Japan masses
 * on three times what its landed grain feeds and takes the hunger: a
 * short, hard drive before the convoy war bites (design §1, §9).
 */
export const IMJIN_FEED_PCT: Readonly<Record<string, number>> = {
  JPN: 300,
};
