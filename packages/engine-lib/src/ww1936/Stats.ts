// World War 1936 P3 (spec §3): every modifier is one WwStats; sources add up.
import { TechBranch } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_STAT_KEYS,
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { TechTotals } from "./WwTechs";

/** Every stat at 0, built once (copies keep one object shape: fast). */
const ZERO_STATS: Readonly<WwStats> = Object.freeze(
  Object.fromEntries(WW_STAT_KEYS.map((k) => [k, 0])) as WwStats,
);

export function emptyStats(): WwStats {
  return { ...ZERO_STATS };
}

/** Sets every stat of `s` back to 0 (a reused sum). */
export function zeroStats(s: WwStats): WwStats {
  return Object.assign(s, ZERO_STATS);
}

/**
 * Adds `p` into `out`: only `p`'s own keys (a partial holds a few; integer
 * sums, so the order does not matter).
 */
export function addStatsInto(
  out: WwStats,
  p: Partial<WwStats>,
  times = 1,
): void {
  for (const k in p) {
    const v = p[k as WwStatKey];
    if (v !== undefined) out[k as WwStatKey] += v * times;
  }
}

/**
 * Adds `p` into the partial sum `out` (a key `out` lacks starts at 0): the
 * same numbers addStatsInto gives on a full object, without carrying every
 * zero (final perf lane: P3's daily recompute adds the P6 parts through
 * these sparse sums).
 */
export function addSparseInto(
  out: Partial<WwStats>,
  p: Partial<WwStats>,
): void {
  for (const k in p) {
    const v = p[k as WwStatKey];
    if (v !== undefined) out[k as WwStatKey] = (out[k as WwStatKey] ?? 0) + v;
  }
}

/** WW_STAT_KEYS index of a stat key. */
export const STAT_INDEX: ReadonlyMap<string, number> = new Map(
  WW_STAT_KEYS.map((k, i) => [k, i]),
);

/**
 * addStatsInto for a sum kept by WW_STAT_KEYS index (final perf lane: a
 * typed array reads and writes by position, the object by name). A key
 * that is no stat is skipped (on an object it was a stray, never read).
 */
export function addStatsIntoArray(
  sum: Float64Array,
  p: Partial<WwStats>,
): void {
  for (const k in p) {
    const v = p[k as WwStatKey];
    if (v === undefined) continue;
    const i = STAT_INDEX.get(k);
    if (i !== undefined) sum[i] += v;
  }
}

export function sumStats(parts: readonly Partial<WwStats>[]): WwStats {
  const out = emptyStats();
  for (const p of parts) addStatsInto(out, p);
  return out;
}

/** The tech totals as stats (the P1+P2 keys are the first 34; P4's nine follow by name). */
export function techStats(t: TechTotals): WwStats {
  return sumStats([t as unknown as Partial<WwStats>]);
}

/** The …Pct keys (spec §3.3's clamp). */
export const PCT_STAT_KEYS: readonly WwStatKey[] = WW_STAT_KEYS.filter((k) =>
  k.endsWith("Pct"),
);

/** P4 plan decision 25: the ranges of the P4 keys that are no …Pct. */
const P4_CLAMP: readonly (readonly [WwStatKey, number, number])[] = [
  ["invasionCapacity", 0, 20],
  ["navyXpMilli", 0, 10_000],
  ["airXpMilli", 0, 10_000],
  // The doctrine keys that are no …Pct (P6 pre-flight).
  ["subOrg", 0, 50],
  ["carrierRoundsCut", 0, 2],
  ["supPenaltyPp", 0, 50],
  // P5 (P5 spec §8.6): the occupation output share, percentage points.
  ["occupationOutputPp", -50, 50],
];

/**
 * P6 (plan decision 24, pre-flight §0-6): the ranges of the P6 keys that are
 * no …Pct: the MIO family keys (…Pct_<family>: −90..300), …Pp −50..50,
 * …Org −20..20, the bp keys and carrierCycleCut. Only the P6 names: the
 * older …Pp / …Bp keys keep their P3 meaning.
 */
const P6_FIRST = WW_STAT_KEYS.indexOf("infAttackPct");
const P6_CLAMP: readonly (readonly [WwStatKey, number, number])[] =
  WW_STAT_KEYS.slice(P6_FIRST).flatMap(
    (k): (readonly [WwStatKey, number, number])[] => {
      if (k.startsWith("mioCostPct_") || k.startsWith("mioStatPct_")) {
        return [[k, -90, 300]];
      }
      if (k.startsWith("mioEffCapBp_")) return [[k, -2000, 2000]];
      if (k.endsWith("Pp") || k.startsWith("mioRelPp_")) return [[k, -50, 50]];
      if (k.endsWith("Org")) return [[k, -20, 20]];
      if (k === "fortDefPerLevelBp") return [[k, 0, 1000]];
      if (k === "nightBombBp" || k === "interceptShareBp") {
        return [[k, 0, 10_000]];
      }
      if (k === "carrierCycleCut") return [[k, 0, 2]];
      return [];
    },
  );

/** P6: by WW_STAT_KEYS index, the [lo, hi] of a P6 key that is no …Pct (null otherwise). */
export const P6_STAT_RANGE: readonly (readonly [number, number] | null)[] =
  WW_STAT_KEYS.map((k) => {
    const r = P6_CLAMP.find((x) => x[0] === k);
    return r === undefined ? null : [r[1], r[2]];
  });

/** Spec §3.3: every …Pct sum is kept in −90..+300 (P4: and decision 25's ranges; P6's). */
export function clampStats(s: WwStats): WwStats {
  for (const k of PCT_STAT_KEYS) s[k] = Math.max(-90, Math.min(300, s[k]));
  for (const [k, lo, hi] of P4_CLAMP) s[k] = Math.max(lo, Math.min(hi, s[k]));
  for (const [k, lo, hi] of P6_CLAMP) s[k] = Math.max(lo, Math.min(hi, s[k]));
  return s;
}

/** The stats as a number array in WW_STAT_KEYS order (screens, snapshots). */
export function statsArray(s: Partial<WwStats>): number[] {
  return WW_STAT_KEYS.map((k) => s[k] ?? 0);
}

export const RS_STAT_OF_BRANCH: Readonly<Record<TechBranch, WwStatKey>> = {
  infantry: "rsInfantryPct",
  artillery: "rsArtilleryPct",
  armour: "rsArmorPct",
  air: "rsAirPct",
  industry: "rsIndustryPct",
  electronics: "rsElectronicsPct",
  doctrine: "rsDoctrinePct",
  naval: "rsNavalPct",
};

/** Spec §3.4: research speed % of a branch (the law's share is added by P1). */
export function researchSpeedPct(s: WwStats, branch: TechBranch): number {
  return s.researchPct + s[RS_STAT_OF_BRANCH[branch]];
}
