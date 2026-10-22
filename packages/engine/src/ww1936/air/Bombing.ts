// World War 1936 P4: strategic bombing (P4 spec §14.8). Lane A2 (Task 8).
// The zone's day (AirEffects.airMissionEffects) hands this file the
// strategic bombing sorties by side; the points go to the enemy regions
// of the zone by industry weight, the damage to their buildings through
// Buildings.damageBuilding (so P1's output and P2's supply and movement
// read it, plan decision 13), the points taken after anti-air to the
// victim's 30-day ring (its war support line). Repairs are lane E's
// (Repairs.stepRepairs): this file only makes the damage.
import {
  WW_BOMB_WS_DIV,
  WW_BOMB_WS_MAX_BP,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { bombDamageMilli } from "@openfront/engine-lib/ww1936/AirRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { nightMods } from "../depth/AirExtras";
import {
  damageBuilding,
  damageOf,
  effectiveBuildings,
  effectiveLevel,
} from "../economy/Buildings";
import type { WwEconomy } from "../economy/WwEconomy";
import type { WwLand } from "../land/WwLand";
import type { EffectTally, Sortie } from "./AirEffects";
import type { WwAir } from "./WwAir";

const BOMB_KEY = "events_display.ww1936_bombed" as const;

/**
 * The regions of strategic region `sr` strategic bombing may pick, in id
 * order: never a no-strike region (engine-lib NoStrike; P6 pre-flight).
 * Lane A2's target choice and the AI read this. Final. P6 (T1b): by day
 * or by night, the depth judge (WwDepth.noStrike: the engine-lib names
 * and the content's P5 groups).
 */
export function bombableRegions(air: WwAir, sr: number): number[] {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "land") return [];
  const d = air.ww.depth;
  return s.members.filter((r) => !isNoStrike(sc, r) && !d.noStrike(r));
}

/**
 * Spec §14.8: the "bomb fatigue" war support line of a country, bp ≤ 0
 * (P3's dynamic lines): −min(15%, the bomb points taken in the last 30
 * days after anti-air / 400).
 */
export function bombFatigueBp(air: WwAir, smallID: number): number {
  const c = air.country(smallID);
  if (c === null) return 0;
  let sum = 0;
  for (const v of c.bombTaken) sum += v;
  const bp = Math.min(WW_BOMB_WS_MAX_BP, Math.floor(sum / WW_BOMB_WS_DIV));
  return bp <= 0 ? 0 : -bp;
}

/**
 * Splits `total` (a whole number) in proportion to `weights` by the
 * largest remainder (ties: the smaller index), never more than `caps[i]`
 * to entry i (what a capped entry cannot take goes to the others; with
 * no room left the rest is dropped). Shared by the bombing, the strikes
 * and the losses.
 */
export function apportion(
  total: number,
  weights: readonly number[],
  caps?: readonly number[],
): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  let left = Math.max(0, Math.floor(total));
  const room = (i: number) =>
    caps === undefined ? Number.MAX_SAFE_INTEGER : caps[i] - out[i];
  while (left > 0) {
    const live: number[] = [];
    let w = 0;
    for (let i = 0; i < n; i++) {
      if (weights[i] > 0 && room(i) > 0) {
        live.push(i);
        w += weights[i];
      }
    }
    if (w === 0) break;
    const want = new Array<number>(n).fill(0);
    let given = 0;
    for (const i of live) {
      want[i] = Math.floor((left * weights[i]) / w);
      given += want[i];
    }
    // The units the floors left over: the largest remainders first.
    const spare = left - given;
    if (spare > 0) {
      const byRem = [...live].sort(
        (a, b) =>
          ((left * weights[b]) % w) - ((left * weights[a]) % w) || a - b,
      );
      for (let k = 0; k < spare; k++) want[byRem[k]]++;
    }
    let placed = 0;
    for (const i of live) {
      const take = Math.min(want[i], room(i));
      out[i] += take;
      placed += take;
    }
    if (placed === 0) break;
    left -= placed;
  }
  return out;
}

/**
 * Spec §14.8 industry weight, doubled to stay whole: 2 for each working
 * civilian and military factory, dockyard, synthetic refinery and
 * infrastructure level, 1 for each naval base, air base, anti-air and
 * radar level (the spec's halves). BUILDING_IDS order (the tie order).
 */
const BOMB_WEIGHTS: readonly (readonly [BuildingId, number])[] = [
  ["civ", 2],
  ["mil", 2],
  ["dock", 2],
  ["infra", 2],
  ["naval_base", 1],
  ["air_base", 1],
  ["anti_air", 1],
  ["radar", 1],
  ["synthetic_refinery", 2],
];
/** The "factories" the message counts (the buildings that produce). */
const FACTORIES: readonly BuildingId[] = [
  "civ",
  "mil",
  "dock",
  "synthetic_refinery",
];

/** A region's industry weight (×2) from its working buildings. */
export function regionBombWeight(econ: WwEconomy, region: number): number {
  let w = 0;
  for (const [b, k] of BOMB_WEIGHTS) {
    w += effectiveBuildings(econ, region, b) * k;
  }
  return w;
}

/**
 * Spec §14.8: `milli` of building damage into `region`, building by
 * building in proportion to the weight: the whole buildings first (each
 * stops one working building, at most the ones still working), then the
 * rest below one building, both by the largest remainder; never more than
 * the region's buildings (damageBuilding's cap). Returns the milli added.
 */
export function damageRegion(
  econ: WwEconomy,
  region: number,
  milli: number,
): number {
  if (milli <= 0) return 0;
  const working = BOMB_WEIGHTS.map(([b]) =>
    effectiveBuildings(econ, region, b),
  );
  const weights = BOMB_WEIGHTS.map(([, k], i) => working[i] * k);
  const whole = apportion(Math.floor(milli / 1000), weights, working);
  const rest = apportion(milli % 1000, weights);
  let done = 0;
  BOMB_WEIGHTS.forEach(([b], i) => {
    const m = whole[i] * 1000 + rest[i];
    if (m > 0) done += damageBuilding(econ, region, b, m);
  });
  return done;
}

/** The factories of a region stopped by bomb damage now (the message's count). */
export function factoriesStopped(econ: WwEconomy, region: number): number {
  let n = 0;
  for (const b of FACTORIES) {
    const count = econ.buildingArray(b)[region] ?? 0;
    n += Math.min(count, Math.floor(damageOf(econ, region, b) / 1000));
  }
  return n;
}

/** The countries of a side (a country alone is its own side). */
export function sideMembersOf(land: WwLand, side: number): readonly number[] {
  const m = land.sideMembers(side);
  return m.length > 0 ? m : [side];
}

/**
 * Spec §14.8: a land zone's day of strategic bombing, side by side (key
 * order). A side's points = Σ sorties × strategic attack × (100 +
 * stratBombPct) / 100 (each owner's stats; the doctrine techs feed the
 * same key); the targets are the zone's bombable regions a country at war
 * with the side controls, by industry weight; each region's damage is
 * bombDamageMilli (anti-air, the victim's bombDamageTakenPct). The
 * victim's ring gets the points after anti-air and, on its first bombing
 * of the day, one line naming the region hit hardest. The bombers' losses
 * to anti-air are A1's (AirCombat).
 */
export function strategicBombing(
  air: WwAir,
  sr: number,
  day: number,
  bySide: ReadonlyMap<number, readonly Sortie[]>,
  fx: EffectTally,
): void {
  if (bySide.size === 0) return;
  const regions = bombableRegions(air, sr);
  if (regions.length === 0) return;
  const econ = air.econ;
  const land = air.land;
  const slot = ((day % 30) + 30) % 30;
  // P6 (spec §15.3): a night group's records share the flag, so a zone
  // with no flagged record has no night raid (nightMods is not asked).
  let night = false;
  for (const l of bySide.values()) {
    for (const x of l) if (x.d.night) night = true;
  }
  for (const side of [...bySide.keys()].sort((a, b) => a - b)) {
    const byOwner = new Map<number, number>();
    let centi = 0;
    for (const x of bySide.get(side)!) {
      const pct = econ.country(x.d.owner)?.stats.stratBombPct ?? 0;
      const lit = Math.floor(
        (Math.floor((x.milli * x.stats.strat) / 1000) *
          Math.max(0, 100 + pct)) /
          100,
      );
      // P6 (spec §15.3): a night raid scores ×0.6 (+ nightBombBp).
      const c = night
        ? Math.floor((lit * nightMods(air.ww.depth, x.d.id).bombBp) / 10_000)
        : lit;
      if (c <= 0) continue;
      centi += c;
      byOwner.set(x.d.owner, (byOwner.get(x.d.owner) ?? 0) + c);
    }
    const points = Math.floor(centi / 100);
    if (points <= 0) continue;
    const members = sideMembersOf(land, side);
    const targets = regions.filter((r) => {
      const c = land.controller[r] ?? 0;
      return c !== 0 && members.some((m) => land.isEnemy(m, c));
    });
    if (targets.length === 0) continue;
    const share = apportion(
      points,
      targets.map((r) => regionBombWeight(econ, r)),
    );
    let given = 0;
    // victim → points taken after anti-air; the region hit hardest
    const hit = new Map<
      number,
      { after: number; region: number; milli: number }
    >();
    targets.forEach((r, i) => {
      const p = share[i];
      if (p <= 0) return;
      given += p;
      const victim = land.controller[r];
      const aa = effectiveLevel(econ, r, "anti_air");
      const taken = econ.country(victim)?.stats.bombDamageTakenPct ?? 0;
      const done = damageRegion(econ, r, bombDamageMilli(p, aa, taken));
      const after = Math.floor((p * (1000 - Math.min(400, 80 * aa))) / 1000);
      const h = hit.get(victim);
      if (h === undefined) {
        hit.set(victim, { after, region: r, milli: done });
      } else {
        h.after += after;
        if (done > h.milli) {
          h.region = r;
          h.milli = done;
        }
      }
    });
    if (given === 0) continue;
    air.bombPointsTotal += given;
    for (const [owner, c] of byOwner) {
      fx.bomb.set(owner, (fx.bomb.get(owner) ?? 0) + Math.floor(c / 100));
    }
    for (const victim of [...hit.keys()].sort((a, b) => a - b)) {
      const h = hit.get(victim)!;
      const c = air.country(victim);
      if (c === null || h.after <= 0) continue;
      const first = c.bombTaken[slot] === 0;
      c.bombTaken[slot] += h.after;
      air.markCountry(victim);
      // Spec §14.8, §18.10: one line a day, building damage only.
      if (first) {
        air.message(victim, BOMB_KEY, {
          region: h.region,
          n: factoriesStopped(econ, h.region),
        });
      }
    }
  }
}
