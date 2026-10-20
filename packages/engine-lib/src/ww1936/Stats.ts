// World War 1936 P3 (spec §3): every modifier is one WwStats; sources add up.
import { TechBranch } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_STAT_KEYS,
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { TechTotals } from "./WwTechs";

export function emptyStats(): WwStats {
  const s = {} as WwStats;
  for (const k of WW_STAT_KEYS) s[k] = 0;
  return s;
}

/** Adds `p` into `out` (WW_STAT_KEYS order; missing keys are 0). */
export function addStatsInto(
  out: WwStats,
  p: Partial<WwStats>,
  times = 1,
): void {
  for (const k of WW_STAT_KEYS) {
    const v = p[k];
    if (v !== undefined) out[k] += v * times;
  }
}

export function sumStats(parts: readonly Partial<WwStats>[]): WwStats {
  const out = emptyStats();
  for (const p of parts) addStatsInto(out, p);
  return out;
}

/** The tech totals as stats (the P1+P2 keys are the first 34). */
export function techStats(t: TechTotals): WwStats {
  return sumStats([t as unknown as Partial<WwStats>]);
}

/** Spec §3.3: every …Pct sum is kept in −90..+300. */
export function clampStats(s: WwStats): WwStats {
  for (const k of WW_STAT_KEYS) {
    if (k.endsWith("Pct")) s[k] = Math.max(-90, Math.min(300, s[k]));
  }
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
};

/** Spec §3.4: research speed % of a branch (the law's share is added by P1). */
export function researchSpeedPct(s: WwStats, branch: TechBranch): number {
  return s.researchPct + s[RS_STAT_OF_BRANCH[branch]];
}
