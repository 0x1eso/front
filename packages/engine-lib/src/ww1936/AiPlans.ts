// World War 1936 ww91 section 8: the plan each major's AI plays. One table of
// numbers, the same with the lobby's historical AI on or off: it says how a
// country fights and builds, never whom or when. Each number leans a rule the
// AI already has; nothing here names a date or a region. A plan is derived
// from the seed and the tag, never stored: `planOf` works it out again.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { idHash, wwRoll } from "./Roll";

export interface NationalPlan {
  /** Rule 7: military factories queued to one civilian, once it builds for war. */
  milPerCiv: number;
  /** Rule 1: the demand of an offensive front, % of the plain demand. */
  offensePct: number;
  /** Rule 1: how much of that the fronts off the main enemy give up, %. */
  oneEnemyPct: number;
  /** Main sector: the one standing stays within this % of the best. */
  effortKeepPct: number;
  /** Rule 2: the attack gate's two bars, % of the personality's. */
  gateMidPct: number;
  gateLowPct: number;
  /** Rule 2: fuel stock under this ‰ of its cap stops the offensives (0: never). */
  fuelStopPm: number;
  /** Share of the peak divisions that guards points and coasts, %. */
  reservePct: number;
  /** Rule 3: share of an outnumbered front's divisions kept out of the line, %. */
  poolPct: number;
  /** Rule 3: the mid ratio, ‰, at which the pool goes in on a sector (0: never early). */
  counterPm: number;
  /** Rule 3: victory points given up by a ring on an outnumbered front, % of normal. */
  ringVpPct: number;
  /** Combat widths a held border region asks for, hundredths. */
  holdCenti: number;
  /** Org ‰ at which an attacking army stops, and from which it attacks again. */
  regroupPm: number;
  reattackPm: number;
  /** Rule 4: enemy sky ‰ from which a sector or a landing is left out. */
  skyBarPm: number;
  /** Bombing wants this much of the sky ‰. */
  stratSupPm: number;
  /** Weights of the wings' close support, bombing and naval work, %. */
  casWeightPct: number;
  bombWeightPct: number;
  navalWeightPct: number;
  /** Rule 6: the route supremacy a landing wants ‰. */
  landingSupPm: number;
  /** With a land front, the share of divisions on no front a landing wants, %. */
  invasionSparePct: number;
  /** An island base's value to a landing. */
  islandBaseValue: number;
  /** Rule 5: value of a unit of a resource it lacks. */
  resourceValue: number;
  /** Rule 6: value of a target on the seas of its own ports. */
  homeSeaValue: number;
  /** Share of the divisions that are its special troops, %. */
  unitPct: number;
}

/** A minor, a human's auto armies and anyone without a row. */
export const AI_PLAN_DEFAULT: Readonly<NationalPlan> = {
  milPerCiv: 3,
  offensePct: 200,
  oneEnemyPct: 0,
  effortKeepPct: 15,
  gateMidPct: 100,
  gateLowPct: 100,
  fuelStopPm: 0,
  reservePct: 10,
  poolPct: 0,
  counterPm: 0,
  ringVpPct: 100,
  holdCenti: 200,
  regroupPm: 400,
  reattackPm: 850,
  skyBarPm: 700,
  stratSupPm: 300,
  casWeightPct: 100,
  bombWeightPct: 100,
  navalWeightPct: 100,
  landingSupPm: 600,
  invasionSparePct: 20,
  islandBaseValue: 5,
  resourceValue: 0,
  homeSeaValue: 0,
  unitPct: 0,
};

/** Section 8.4: what each major changes of the default. */
export const AI_PLANS: Readonly<
  Partial<Record<CountryTag, Readonly<Partial<NationalPlan>>>>
> = {
  DEU: {
    milPerCiv: 4,
    offensePct: 240,
    oneEnemyPct: 100,
    effortKeepPct: 25,
    gateMidPct: 90,
    fuelStopPm: 250,
    stratSupPm: 500,
    casWeightPct: 150,
    bombWeightPct: 50,
    navalWeightPct: 80,
    landingSupPm: 650,
    resourceValue: 5,
  },
  SUN: {
    offensePct: 220,
    oneEnemyPct: 100,
    gateLowPct: 90,
    reservePct: 15,
    poolPct: 15,
    counterPm: 1400,
    ringVpPct: 50,
    regroupPm: 300,
    reattackPm: 750,
    skyBarPm: 850,
    stratSupPm: 500,
    casWeightPct: 150,
    bombWeightPct: 50,
    navalWeightPct: 80,
    landingSupPm: 700,
    invasionSparePct: 30,
    unitPct: 5,
  },
  USA: {
    milPerCiv: 2,
    offensePct: 180,
    oneEnemyPct: 70,
    gateMidPct: 105,
    skyBarPm: 500,
    stratSupPm: 200,
    bombWeightPct: 200,
    navalWeightPct: 120,
    landingSupPm: 700,
    invasionSparePct: 15,
    islandBaseValue: 8,
    unitPct: 5,
  },
  GBR: {
    offensePct: 180,
    oneEnemyPct: 70,
    gateMidPct: 110,
    reservePct: 12,
    regroupPm: 450,
    reattackPm: 900,
    skyBarPm: 500,
    stratSupPm: 200,
    casWeightPct: 80,
    bombWeightPct: 200,
    navalWeightPct: 120,
    landingSupPm: 700,
    invasionSparePct: 15,
    homeSeaValue: 3,
    unitPct: 3,
  },
  FRA: {
    offensePct: 140,
    oneEnemyPct: 100,
    gateMidPct: 115,
    gateLowPct: 110,
    reservePct: 15,
    poolPct: 10,
    counterPm: 1600,
    ringVpPct: 200,
    holdCenti: 300,
    regroupPm: 450,
    reattackPm: 900,
    landingSupPm: 700,
    invasionSparePct: 30,
    homeSeaValue: 3,
    unitPct: 3,
  },
  JPN: {
    oneEnemyPct: 50,
    gateMidPct: 95,
    gateLowPct: 90,
    fuelStopPm: 250,
    reservePct: 8,
    ringVpPct: 200,
    holdCenti: 150,
    regroupPm: 350,
    reattackPm: 800,
    stratSupPm: 500,
    bombWeightPct: 50,
    navalWeightPct: 150,
    landingSupPm: 550,
    invasionSparePct: 10,
    islandBaseValue: 10,
    resourceValue: 10,
    unitPct: 8,
  },
  ITA: {
    offensePct: 180,
    oneEnemyPct: 100,
    gateMidPct: 110,
    gateLowPct: 110,
    fuelStopPm: 300,
    regroupPm: 450,
    reattackPm: 900,
    stratSupPm: 500,
    casWeightPct: 80,
    bombWeightPct: 50,
    navalWeightPct: 150,
    invasionSparePct: 25,
    resourceValue: 3,
    homeSeaValue: 5,
    unitPct: 8,
  },
};

/** wwRoll purpose of a plan's seeded strength. */
export const P_AI_PLAN = idHash("ai_plan");

/** How strongly this game's country leans its plan, % (60-140). */
export function planStrengthPct(seed: number, smallID: number): number {
  return (wwRoll(seed, P_AI_PLAN, smallID) % 81) + 60;
}

/** A bar, not an amount: on or off, and where. The seed does not move it. */
const UNSCALED: ReadonlySet<keyof NationalPlan> = new Set(["counterPm"]);

/**
 * The plan of `tag` in this game: each number moved from the default by the
 * seeded strength, rounded. A human's country and a minor get the default.
 */
export function planOf(
  tag: CountryTag,
  seed: number,
  smallID: number,
  human = false,
): Readonly<NationalPlan> {
  const row = AI_PLANS[tag];
  if (row === undefined || human) return AI_PLAN_DEFAULT;
  const pct = planStrengthPct(seed, smallID);
  const out = { ...AI_PLAN_DEFAULT };
  for (const k of Object.keys(row) as (keyof NationalPlan)[]) {
    const base = AI_PLAN_DEFAULT[k];
    const gap = row[k]! - base;
    out[k] = UNSCALED.has(k)
      ? row[k]!
      : base + Math.floor((gap * pct + 50) / 100);
  }
  out.oneEnemyPct = Math.min(100, out.oneEnemyPct);
  return out;
}

/** Rule 2: fuel at or over this ‰ of its cap is a strong position. */
export const AI_PLAN_STRONG_FUEL_PM = 500;
/** Rule 2: the armoured divisions' strength from which the armour "holds", ‰. */
export const AI_PLAN_ARMOUR_HOLDS_PM = 600;
/** Rule 2: what a stopped offensive's demand falls to, %. */
export const AI_PLAN_STOP_OFFENSE_PCT = 150;
/** Rule 2: how far a stopped offensive's gate rises, %. */
export const AI_PLAN_STOP_GATE_PCT = 120;

/** Rule 2's answer for today. */
export interface PlanStance {
  midPct: number;
  lowPct: number;
  offensePct: number;
  /** Out of fuel for offensives: rings open, the bars rise. */
  stopped: boolean;
}

/**
 * Rule 2, strike while strong. `fuelPm`: fuel against its cap; `armourPm`: the
 * armoured divisions' strength (1000 with none). The plan's low mid bar holds
 * only while strong; a bar above normal holds always.
 */
export function planStance(
  plan: Readonly<NationalPlan>,
  fuelPm: number,
  armourPm: number,
): PlanStance {
  const strong =
    fuelPm >= AI_PLAN_STRONG_FUEL_PM && armourPm >= AI_PLAN_ARMOUR_HOLDS_PM;
  const stopped = plan.fuelStopPm > 0 && fuelPm < plan.fuelStopPm;
  const mid = strong ? plan.gateMidPct : Math.max(100, plan.gateMidPct);
  const rise = stopped ? AI_PLAN_STOP_GATE_PCT : 100;
  return {
    midPct: Math.floor((mid * rise) / 100),
    lowPct: Math.floor((plan.gateLowPct * rise) / 100),
    offensePct: stopped
      ? Math.min(plan.offensePct, AI_PLAN_STOP_OFFENSE_PCT)
      : plan.offensePct,
    stopped,
  };
}

/** Rule 5: units of a deposit per point of value (deposits run to tens, points to ones). */
export const AI_PLAN_UNITS_PER_VALUE = 10;

/**
 * Rule 5, war for resources: what a region is worth for the resources the
 * country lacks: the plan's value for each unit there, no more of a resource
 * than the gap. `gap`: units a day short, RESOURCE_IDS order.
 */
export function resourceWorth(
  deposits: readonly number[],
  gap: readonly number[],
  value: number,
): number {
  if (value === 0) return 0;
  let units = 0;
  for (let k = 0; k < gap.length; k++) {
    if (gap[k] > 0) units += Math.min(deposits[k] ?? 0, gap[k]);
  }
  return Math.floor((value * units) / AI_PLAN_UNITS_PER_VALUE);
}
