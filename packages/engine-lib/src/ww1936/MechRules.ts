// World War 1936 P6 (P6 spec §12, §13): the US congress, the balance of
// power and continuous focuses. Tables final (plan Task 1 Step 8); lane W3
// fills the …Block bodies (Task 9).
import {
  CFOCUS_UNLOCK_DATE,
  CFOCUS_UNLOCK_FOCUSES,
  CONTINUOUS_FOCUSES,
  type ContinuousFocus,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "./Calendar";

export const CONGRESS = {
  declare: 6_000,
  lendLease: 5_000,
  laws: 5_000,
  faction: 7_000,
  stepBp: 20,
  attackedDays: 90,
  pearlDays: 365,
} as const;

export function congressTargetBp(tensionBp: number, attacked: boolean): number {
  return Math.max(
    0,
    Math.min(
      10_000,
      2_000 + Math.floor(tensionBp / 2) + (attacked ? 4_000 : 0),
    ),
  );
}

export function congressStep(cur: number, target: number): number {
  return cur < target
    ? Math.min(target, cur + CONGRESS.stepBp)
    : Math.max(target, cur - CONGRESS.stepBp);
}

export function bopBand(valuePm: number): 0 | 1 | 2 | 3 | 4 {
  return valuePm <= -600
    ? 0
    : valuePm < -200
      ? 1
      : valuePm <= 200
        ? 2
        : valuePm < 600
          ? 3
          : 4;
}

export interface BopDef {
  tag: "CHN" | "JPN" | "FRA";
  startPm: number;
  spirits: readonly (string | null)[];
}

/** Spec §13.2; spirit ids per band (null: none) are K5's spirits (content/depth/mech.ts). */
export const BOP_DEFS: readonly BopDef[] = [
  {
    tag: "CHN",
    startPm: 300,
    spirits: ["bop_chn_strong_centre", null, null, null, "bop_chn_warlords"],
  },
  {
    tag: "JPN",
    startPm: -200,
    spirits: ["bop_jpn_army", null, "bop_jpn_balance", null, "bop_jpn_navy"],
  },
  {
    tag: "FRA",
    startPm: -300,
    spirits: [
      "bop_fra_popular_front",
      null,
      null,
      null,
      "bop_fra_national_union",
    ],
  },
];

export const CFOCUS_STATS: Readonly<Record<ContinuousFocus, Partial<WwStats>>> =
  {
    cf_industry: { outputPct: 5 },
    cf_construction: { constructionPct: 10 },
    cf_research: { researchPct: 5 },
    cf_political: { ppMilli: 250 },
    cf_stability: { stabilityWeeklyBp: 50 },
    cf_war_effort: { warSupportWeeklyBp: 50 },
    cf_army: { armyXpMilli: 150, rsDoctrinePct: 10 },
    cf_navy_air: { navyXpMilli: 100, airXpMilli: 100 },
  };

export interface CfocusInput {
  open: boolean;
  /** CONTINUOUS_FOCUSES index of the running one, -1 none. */
  current: number;
  /** The first day a new pick is allowed (a pick or a clear locks 30 days). */
  lockUntil: number;
  day: number;
  /** W3: the CONTINUOUS_FOCUSES index asked for (cfocus_set); omitted: any. */
  want?: number;
}

/**
 * Spec §12: continuous focuses open after 10 focuses (done or bypassed),
 * on 1939-01-01, or by a cfocus_unlock effect.
 */
export function cfocusOpen(
  doneFocuses: number,
  day: number,
  unlocked: boolean,
): boolean {
  return (
    unlocked ||
    doneFocuses >= CFOCUS_UNLOCK_FOCUSES ||
    day >= dayOfDate(CFOCUS_UNLOCK_DATE)
  );
}

/**
 * Refusal of cfocus_set (plan decision 40, spec §12): closed, or within
 * 30 days of the last pick or clear → cfocus_locked; an unknown id or the
 * one running already → bad_index.
 */
export function cfocusBlock(
  i: CfocusInput,
): "cfocus_locked" | "bad_index" | null {
  if (!i.open) return "cfocus_locked";
  if (
    i.want !== undefined &&
    (i.want < 0 || i.want >= CONTINUOUS_FOCUSES.length || i.want === i.current)
  ) {
    return "bad_index";
  }
  if (i.day < i.lockUntil) return "cfocus_locked";
  return null;
}

/** Spec §14.1: shared research, +10% per other member holding the tech, at most +30%. */
export function sharedResearchBonusPct(holders: number): number {
  return Math.min(30, Math.max(0, holders) * 10);
}

/** Spec §13.1: the support an action of the US needs, bp. */
export function congressNeedBp(
  action: "declare" | "lend_lease" | "law" | "faction",
): number {
  return action === "declare"
    ? CONGRESS.declare
    : action === "lend_lease"
      ? CONGRESS.lendLease
      : action === "law"
        ? CONGRESS.laws
        : CONGRESS.faction;
}
