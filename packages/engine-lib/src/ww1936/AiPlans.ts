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
  /** Rule 7: world tension, bp, from which it builds for war; -1: as its personality does. */
  alertWtBp: number;
  /** Rule 7: factory entries to one dockyard entry, while short of its dock target. */
  milPerDock: number;
  /** Rule 7: fort level it wants before a war on a border with a threat (0: none). */
  fortLevel: number;
  /** Rule 7: mine levels it will build where a short resource lies. */
  mineMax: number;
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
  alertWtBp: -1,
  milPerDock: 4,
  fortLevel: 0,
  mineMax: 6,
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
    milPerDock: 6,
    fortLevel: 1,
    mineMax: 12,
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
    alertWtBp: 2000,
    milPerDock: 6,
    fortLevel: 2,
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
    milPerDock: 2,
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
    alertWtBp: 1500,
    milPerDock: 2,
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
    alertWtBp: 1200,
    fortLevel: 4,
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
    milPerDock: 1,
    mineMax: 12,
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
    milPerDock: 3,
    fortLevel: 1,
    mineMax: 10,
  },
};

/** wwRoll purpose of a plan's seeded strength. */
export const P_AI_PLAN = idHash("ai_plan");

/** How strongly this game's country leans its plan, % (60-140). */
export function planStrengthPct(seed: number, smallID: number): number {
  return (wwRoll(seed, P_AI_PLAN, smallID) % 81) + 60;
}

/** A bar, not an amount: on or off, and where. The seed does not move it. */
const UNSCALED: ReadonlySet<keyof NationalPlan> = new Set([
  "counterPm",
  "alertWtBp",
]);

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

// ---- Rule 7: build for the plan ----

/** What the factory choice looks at. */
export interface FactoryView {
  plan: Readonly<NationalPlan>;
  /** The personality's alert tension, bp, used when the plan names none. */
  personalityAlertWtBp: number;
  atWar: boolean;
  /** A war it plans or expects within the pre-war window. */
  plannedWar: boolean;
  wtBp: number;
  /** A possible enemy next door has this % of our divisions. */
  threatPct: number;
  /** Working military factories no line uses. */
  idleMil: number;
  /** The lines lack resources that trade can't bring in. */
  starved: boolean;
}

/** A neighbour with this % of our divisions alerts a major whatever the tension. */
export const AI_BUILD_THREAT_PCT = 150;
/** World tension, bp, from which the mix leans twice as hard to the military. */
export const AI_BUILD_TENSE_BP = 3500;
/** Lines filled under this ‰ are short of resources. */
export const AI_BUILD_FILL_PM = 800;
/** Idle military factories from which no more are built. */
export const AI_BUILD_IDLE_MIL = 3;

/**
 * Rule 7: from when a country builds for war. A civilian factory repays its
 * cost in about four years (10,800 points against some 6.7 a day, after
 * consumer goods), so it only suits a country that expects no war for that
 * long: war, a planned war, a stronger neighbour or tension ends it.
 */
export function buildsForWar(i: FactoryView): boolean {
  if (i.atWar || i.plannedWar || i.threatPct >= AI_BUILD_THREAT_PCT) {
    return true;
  }
  const bar = i.plan.alertWtBp >= 0 ? i.plan.alertWtBp : i.personalityAlertWtBp;
  return i.wtBp >= bar;
}

/**
 * Rule 7: the next factory entry, given the entries in the queue. Before the
 * alert civilian. More military factories than the lines can feed (idle ones,
 * or lines short of what trade can bring) make nothing: a civilian one grows
 * the rest. At war or with a war planned, military. Otherwise the plan's
 * mix, twice as military from high tension.
 */
export function nextFactory(
  i: FactoryView,
  milEntries: number,
  civEntries: number,
): "civ" | "mil" {
  if (!buildsForWar(i)) return "civ";
  if (i.idleMil >= AI_BUILD_IDLE_MIL || i.starved) return "civ";
  if (i.atWar || i.plannedWar) return "mil";
  const ratio = i.plan.milPerCiv * (i.wtBp >= AI_BUILD_TENSE_BP ? 2 : 1);
  return milEntries >= ratio * (civEntries + 1) ? "civ" : "mil";
}

/**
 * Rule 7: this border wants a fort before the war: the plan builds them, the
 * neighbour is a threat, and the region is under the plan's level.
 */
export function wantsPeaceFort(
  plan: Readonly<NationalPlan>,
  level: number,
  threat: boolean,
): boolean {
  return threat && level < plan.fortLevel;
}
