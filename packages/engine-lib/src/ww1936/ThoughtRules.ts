// World War 1936 military thought sliders (design §5-§6, §8): the curve, the
// end values, the star bonuses, the start positions. Pure integer math.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  MASTERY_TO_XP_PCT,
  StartThoughtDef,
  THOUGHT_DRIFT_MILLI,
  THOUGHT_EDGE_STEP,
  THOUGHT_MAX_STEP,
  THOUGHT_SLIDER_COUNT,
  THOUGHT_START_JITTER,
  THOUGHT_START_JITTER_FREE,
  THOUGHT_START_LIMIT,
  THOUGHT_START_YEAR,
  THOUGHT_YEAR_MAX_PCT,
  THOUGHT_YEAR_PCT,
} from "@openfront/engine-api/ww1936/ThoughtTypes";
import { idHash, wwRoll } from "./Roll";

/** One scaled stat of an end: its full-score value at the end of a 100% year, and the budget points it costs. */
export interface ThoughtTerm {
  key: WwStatKey;
  max: number;
  pts: number;
}
export interface ThoughtEndDef {
  /** Scaled by thoughtWeightPm and the year. The terms' points sum to THOUGHT_BUDGET_PTS[service]. */
  terms: readonly ThoughtTerm[];
  /** The star bonus: applies at THOUGHT_EDGE_STEP notches or more toward this end; no year scaling. */
  edge: Partial<Record<WwStatKey, number>>;
}

const t = (key: WwStatKey, max: number, pts: number): ThoughtTerm => ({
  key,
  max,
  pts,
});

/** Design §5.1 and §6: index 2 * slider + end (0 left / negative, 1 right / positive). */
export const THOUGHT_ENDS: readonly ThoughtEndDef[] = [
  // off_def
  {
    terms: [t("attackPct", 8, 24), t("breakthroughPct", 6, 12)],
    edge: { riverPenaltyCutPct: 25, fortPenaltyCutPct: 10 },
  },
  {
    terms: [t("defensePct", 14, 28), t("entrenchSpeedPct", 16, 8)],
    edge: { entrenchMax: 2, fortDefPerLevelBp: 300 },
  },
  // mob_fire
  {
    terms: [t("speedPct", 8, 16), t("mechBreakPct", 20, 20)],
    edge: { advanceSpeedPct: 15, mechOrg: 5, planSpeedPct: 25 },
  },
  {
    terms: [t("artillerySoftPct", 24, 24), t("atHardPct", 12, 12)],
    edge: { fortPenaltyCutPct: 15, engineerMulPct: 50 },
  },
  // quant_qual
  {
    terms: [
      t("recruitablePct", 8, 16),
      t("infTrainCutPct", 20, 10),
      t("reinforcePct", 20, 10),
    ],
    edge: { manpowerGrowthPct: 10, supplyUsePct: -10 },
  },
  {
    terms: [t("divXpGainPct", 30, 15), t("orgPct", 7, 21)],
    edge: { planMaxBp: 1000, armorRelPp: 5, recoveryPct: 10 },
  },
  // gun_carrier
  {
    terms: [t("capitalAttackPct", 14, 14), t("capitalHpPct", 10, 10)],
    edge: { navalDamageTakenPct: -8, shoreBombardPct: 15 },
  },
  {
    terms: [
      t("carrierStrikePct", 12, 12),
      t("deckPct", 6, 6),
      t("navalStrikePct", 6, 6),
    ],
    edge: { carrierRoundsCut: 1, navalBomberPct: 15, airNavalPct: 10 },
  },
  // raid_escort
  {
    terms: [t("convoyRaidPct", 20, 12), t("subTorpedoPct", 16, 12)],
    edge: { subVisibilityPct: -15, subOrg: 10, surfaceRaidPct: 30 },
  },
  {
    terms: [
      t("convoyEscortPct", 20, 12),
      t("depthChargePct", 20, 8),
      t("aaPct", 8, 4),
    ],
    edge: { convoyLossPct: -10, depthChargePct: 10 },
  },
  // battle_patrol
  {
    terms: [
      t("screeningPct", 16, 8),
      t("positioningPct", 8, 8),
      t("navyDefensePct", 8, 8),
    ],
    edge: { navalOrg: 5, repairPct: 15 },
  },
  {
    terms: [
      t("navalDetectPct", 16, 8),
      t("navalPatrolPct", 20, 8),
      t("screenAttackPct", 12, 8),
    ],
    edge: { navalSpeedPct: 5, convoyEscortPct: 10 },
  },
  // intercept_escort
  {
    terms: [
      t("interceptShareBp", 2000, 8),
      t("airDetectPct", 10, 8),
      t("airDefensePct", 8, 8),
    ],
    edge: { aaPct: 15 },
  },
  {
    terms: [t("fighterAttackPct", 14, 14), t("fighterAgilityPct", 10, 10)],
    edge: { airRangePct: 15 },
  },
  // strat_cas
  {
    terms: [t("stratBombPct", 24, 16), t("heavyDefensePct", 12, 8)],
    edge: { nightBombBp: 1500 },
  },
  {
    terms: [t("casPct", 24, 16), t("supPenaltyPp", 6, 8)],
    edge: { paradropPrepPct: -50 },
  },
  // tempo_preserve
  {
    terms: [t("sortieEffPct", 12, 24)],
    edge: { reconPct: 10 },
  },
  {
    terms: [t("airLossCutPct", 20, 16), t("bomberDefensePct", 8, 8)],
    edge: { fuelUsePct: -10 },
  },
];

/** Design §5.2: the weight, in per mille, of the end that p notches were moved toward (p in -10..+10). */
export function thoughtWeightPm(p: number): number {
  return 500 + 50 * p - p * p;
}

/** Design §5.2: the year multiplier, percent (100 in 1936 and before, 160 from 1942). */
export function thoughtYearPct(year: number): number {
  return Math.max(
    100,
    Math.min(
      THOUGHT_YEAR_MAX_PCT,
      100 + THOUGHT_YEAR_PCT * (year - THOUGHT_START_YEAR),
    ),
  );
}

/** trunc(max * weight * yearPct / 100000); never -0. */
export function thoughtValue(max: number, p: number, yearPct: number): number {
  const v = Math.trunc((max * thoughtWeightPm(p) * yearPct) / 100_000);
  return v === 0 ? 0 : v;
}

/** The notch an actual position (milli) shows and works at: nearest, halves up. */
export function thoughtNotch(curMilli: number): number {
  return Math.max(
    -THOUGHT_MAX_STEP,
    Math.min(THOUGHT_MAX_STEP, Math.floor((curMilli + 500) / 1000)),
  );
}

/** Design §5.4: milli-notches a day for a rsDoctrinePct stat. */
export function thoughtRateMilli(rsDoctrinePct: number): number {
  return Math.floor(
    (THOUGHT_DRIFT_MILLI * Math.max(0, 100 + rsDoctrinePct)) / 100,
  );
}

/** One day's move of the actual position toward the target notch. */
export function thoughtStep(
  curMilli: number,
  target: number,
  rateMilli: number,
): number {
  const goal = target * 1000;
  const gap = goal - curMilli;
  if (gap === 0) return curMilli;
  return Math.abs(gap) <= rateMilli
    ? goal
    : curMilli + (gap > 0 ? rateMilli : -rateMilli);
}

/** Whole days to arrive, 0 if there (for the screens' "N days"). */
export function thoughtDaysToGo(
  curMilli: number,
  target: number,
  rateMilli: number,
): number {
  const gap = Math.abs(target * 1000 - curMilli);
  return rateMilli <= 0 ? 0 : Math.ceil(gap / rateMilli);
}

/** Refusal of thought_set: not a notch in range, or the target already. */
export function thoughtSetBlock(
  sliderIdx: number,
  pos: number,
  currentTarget: number,
): "bad_index" | null {
  if (
    sliderIdx < 0 ||
    sliderIdx >= THOUGHT_SLIDER_COUNT ||
    !Number.isInteger(pos) ||
    Math.abs(pos) > THOUGHT_MAX_STEP ||
    pos === currentTarget
  ) {
    return "bad_index";
  }
  return null;
}

/** A star end is lit: end e of a slider at `notch`. */
export function thoughtEdgeLit(notch: number, end: number): boolean {
  return end === 0 ? notch <= -THOUGHT_EDGE_STEP : notch >= THOUGHT_EDGE_STEP;
}

/** The value one term of an end has at `notch` of its slider (end 0 = left). */
export function thoughtTermValue(
  term: ThoughtTerm,
  notch: number,
  end: number,
  yearPct: number,
): number {
  return thoughtValue(term.max, end === 0 ? -notch : notch, yearPct);
}

/**
 * Design §5.2, §6: the stats the nine sliders give. `notches`: THOUGHT_SLIDERS
 * order, whole notches (thoughtNotch of the actual position). The scaled
 * terms of both ends, then every lit star bonus. Zero results are left out.
 */
export function thoughtStats(
  notches: readonly number[],
  yearPct: number,
): Partial<WwStats> {
  const out: Record<string, number> = {};
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    const n = notches[s] ?? 0;
    for (let e = 0; e < 2; e++) {
      const def = THOUGHT_ENDS[2 * s + e];
      for (const term of def.terms) {
        const v = thoughtTermValue(term, n, e, yearPct);
        if (v !== 0) out[term.key] = (out[term.key] ?? 0) + v;
      }
      if (thoughtEdgeLit(n, e)) {
        for (const [k, v] of Object.entries(def.edge)) {
          out[k] = (out[k] ?? 0) + (v as number);
        }
      }
    }
  }
  return out as Partial<WwStats>;
}

// ---- Start positions (design §5.5) ----

/** The start roll's purpose. */
export const P_START_THOUGHT = idHash("start_thought");

/** Design §3: the experience (milli) a doctrine_mastery effect of `amount` gives; 60 -> 40.2, 120 -> 80.4. */
export function masteryXpMilli(amount: number): number {
  return Math.trunc((amount * 1000 * MASTERY_TO_XP_PCT) / 100);
}

export type ThoughtPersonality = "aggressor" | "democracy" | "minor";

export interface StartThoughtInput {
  /** content/depth/thought.ts START_THOUGHTS. */
  table: readonly StartThoughtDef[];
  tag: CountryTag;
  personality: ThoughtPersonality;
  /** The lobby's historical AI is on (humans too: a major keeps its own row). Off: every country takes its personality's row. */
  historical: boolean;
  seed: number;
  id: number;
  /** Tests: 0 to read the row itself. */
  jitter?: number;
}

/**
 * Design §5.5: the nine start notches of a country: its own row when
 * the historical AI is on (a major), else its personality's; then a seeded
 * +-jitter per slider (THOUGHT_START_JITTER, or the free one with the
 * historical AI off), clamped to +-THOUGHT_START_LIMIT. No row: all 0.
 */
export function thoughtStartPos(i: StartThoughtInput): number[] {
  const own = i.historical ? i.table.find((r) => r.tag === i.tag) : undefined;
  const row = own ?? i.table.find((r) => r.tag === `@${i.personality}`);
  const j =
    i.jitter ??
    (i.historical ? THOUGHT_START_JITTER : THOUGHT_START_JITTER_FREE);
  const out: number[] = [];
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    const base = row?.pos[s] ?? 0;
    const d =
      j === 0
        ? 0
        : (wwRoll(i.seed, P_START_THOUGHT, i.id, s) % (2 * j + 1)) - j;
    out.push(
      Math.max(-THOUGHT_START_LIMIT, Math.min(THOUGHT_START_LIMIT, base + d)),
    );
  }
  return out;
}
