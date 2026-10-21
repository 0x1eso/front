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
];

/** Spec §3.3: every …Pct sum is kept in −90..+300 (P4: and decision 25's ranges). */
export function clampStats(s: WwStats): WwStats {
  for (const k of PCT_STAT_KEYS) s[k] = Math.max(-90, Math.min(300, s[k]));
  for (const [k, lo, hi] of P4_CLAMP) s[k] = Math.max(lo, Math.min(hi, s[k]));
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
