// ww177 I4b (Imjin design §7, §8): Japan's politics, as pure integer rules.
// Hideyoshi's great daimyo and their loyalty, his health, the run-up's
// readiness and Joseon's warning, and the go-betweens who carry (and may
// forge) the truce terms. The engine's state lives in
// packages/engine/src/imjin/japan/ImjinJapan.ts; everything here is a pure
// function of numbers, so the tests can pin it with fixed states.
//
// History is flavour (owner's rule): no date decides anything. Hideyoshi's
// health falls with age, war and bad news; the war starts by readiness; the
// truce breaks when the truth comes out; a second invasion comes by state.

/** A great daimyo: one corps of Japan's army (the N-th army is corps N). */
export interface GreatDaimyo {
  readonly id: string;
  /** The person's name (resources/lang: imjin.daimyo.*). */
  readonly nameKey: string;
  /** Loyalty 0..1000 at the start; also where it drifts back to. */
  readonly loyalty: number;
  /** Wants the war ended: loses loyalty in a long war, gains in a truce. */
  readonly dove: boolean;
  /** A hardliner: loses loyalty in a truce. */
  readonly hawk: boolean;
}

/**
 * Design §11: the 1592 divisions in their order (checked 2026-11-11):
 * Konishi with Sō Yoshitoshi and Matsura; Katō Kiyomasa with Nabeshima;
 * Kuroda; Shimazu Yoshihiro; Fukushima; Kobayakawa Takakage; Mōri
 * Terumoto; Ukita Hideie; Toyotomi Hidekatsu with Hosokawa. The loyalties
 * are my reading of the men: Konishi, a Sakai merchant's son and a
 * Christian, wanted trade and peace; Katō, his rival, wanted the war;
 * Shimazu, conquered in 1587, came late and unwilling; Fukushima, Ukita and
 * Hidekatsu were Hideyoshi's own kin or adopted.
 */
export const GREAT_DAIMYO: readonly GreatDaimyo[] = [
  {
    id: "konishi",
    nameKey: "imjin.daimyo.konishi",
    loyalty: 620,
    dove: true,
    hawk: false,
  },
  {
    id: "kato",
    nameKey: "imjin.daimyo.kato",
    loyalty: 860,
    dove: false,
    hawk: true,
  },
  {
    id: "kuroda",
    nameKey: "imjin.daimyo.kuroda",
    loyalty: 760,
    dove: false,
    hawk: false,
  },
  {
    id: "shimazu",
    nameKey: "imjin.daimyo.shimazu",
    loyalty: 440,
    dove: true,
    hawk: false,
  },
  {
    id: "fukushima",
    nameKey: "imjin.daimyo.fukushima",
    loyalty: 900,
    dove: false,
    hawk: true,
  },
  {
    id: "kobayakawa",
    nameKey: "imjin.daimyo.kobayakawa",
    loyalty: 660,
    dove: true,
    hawk: false,
  },
  {
    id: "mori",
    nameKey: "imjin.daimyo.mori",
    loyalty: 600,
    dove: true,
    hawk: false,
  },
  {
    id: "ukita",
    nameKey: "imjin.daimyo.ukita",
    loyalty: 900,
    dove: false,
    hawk: false,
  },
  {
    id: "hidekatsu",
    nameKey: "imjin.daimyo.hidekatsu",
    loyalty: 840,
    dove: false,
    hawk: false,
  },
];

/** Konishi carries Japan's terms (with Shen Weijing for Ming). */
export const BROKER = 0;
/** Katō Kiyomasa: the hardliner the truth gladdens. */
export const HARDLINER = 1;

export const LOYALTY_MAX = 1000;
/** Below this a daimyo's corps drags (orders and mobilisation). */
export const LOYALTY_LOW = 500;
/** Below this he is near open defiance. */
export const LOYALTY_DEFIANT = 250;
/** At or above this his corps is eager. */
export const LOYALTY_EAGER = 850;

/** The corps of the N-th army (1-based): its great daimyo's index. */
export function corpsOfArmy(nameNo: number): number {
  const n = GREAT_DAIMYO.length;
  return (((nameNo - 1) % n) + n) % n;
}

/** Design §7: low loyalty slows the corps' orders (plan readiness), percent. */
export function corpsPlanSpeedPct(loyalty: number): number {
  if (loyalty < LOYALTY_LOW) {
    return -Math.min(50, Math.floor((LOYALTY_LOW - loyalty) / 10));
  }
  return loyalty >= LOYALTY_EAGER ? 10 : 0;
}

/** Design §7: and its org recovery (the morale floor), percent. */
export function corpsRecoveryPct(loyalty: number): number {
  if (loyalty >= LOYALTY_LOW) return 0;
  return -Math.min(25, Math.floor((LOYALTY_LOW - loyalty) / 20));
}

/** The words a loyalty reads as: 0 eager, 1 loyal, 2 wavering, 3 defiant. */
export function loyaltyBand(loyalty: number): 0 | 1 | 2 | 3 {
  if (loyalty >= LOYALTY_EAGER) return 0;
  if (loyalty >= LOYALTY_LOW) return 1;
  if (loyalty >= LOYALTY_DEFIANT) return 2;
  return 3;
}

/** Integer mean of the loyalties (0 when none). */
export function meanLoyalty(loyalty: readonly number[]): number {
  if (loyalty.length === 0) return 0;
  let s = 0;
  for (const v of loyalty) s += v;
  return Math.floor(s / loyalty.length);
}

/**
 * Japan's country stats from the daimyo and the regency (design §7):
 * mobilisation drags with the mean loyalty; after Hideyoshi's death the
 * pressure to withdraw wears stability down week by week.
 */
export function japanStats(
  meanLoy: number,
  pressure: number,
  regency: boolean,
): { trainPct: number; recruitablePct: number; stabilityWeeklyBp: number } {
  const trainPct =
    meanLoy < 600 ? -Math.min(60, Math.floor((600 - meanLoy) / 8)) : 0;
  const recruitablePct =
    meanLoy < LOYALTY_LOW
      ? -Math.min(25, Math.floor((LOYALTY_LOW - meanLoy) / 20))
      : 0;
  const stabilityWeeklyBp = regency
    ? -Math.min(200, Math.floor(pressure / 5))
    : 0;
  return { trainPct, recruitablePct, stabilityWeeklyBp };
}

// ---- Hideyoshi's health (design §7: never a date) ----

/** Health is in points; a constitution of 100,000 to 130,000 by seed. */
export const HEALTH_BASE = 100_000;
export const HEALTH_SPREAD = 30_000;
/** The war's strain a day while Japan fights Joseon or Ming. */
export const WAR_STRAIN = 10;
/** The blow of one piece of bad news. */
export const BAD_NEWS_BLOW = 3_000;

/**
 * Age: a day's loss grows as he ages (`ageDay` counts from April 1590, when
 * he was 53). About 8 years of a hard war leave little.
 */
export function ageLoss(ageDay: number): number {
  return 10 + Math.floor(Math.max(0, ageDay) / 73);
}

/** Health lost in one day. */
export function dailyHealthLoss(ageDay: number, wars: number): number {
  return ageLoss(ageDay) + WAR_STRAIN * Math.min(2, wars);
}

/** The aging of the days before a later start, taken off at once. */
export function agingBefore(days: number): number {
  let s = 0;
  for (let d = 0; d < days; d++) s += ageLoss(d);
  return s;
}
/** A 1592 start is 731 days after April 1590. */
export const AGE_DAYS_1592 = 731;

/** The words of his health: 0 hale, 1 failing, 2 bedridden, 3 gravely ill. */
export function healthBand(
  health: number,
  constitution: number,
): 0 | 1 | 2 | 3 {
  if (constitution <= 0) return 3;
  const pm = Math.floor((Math.max(0, health) * 1000) / constitution);
  if (pm > 600) return 0;
  if (pm > 300) return 1;
  if (pm > 100) return 2;
  return 3;
}

// ---- The run-up (design §8) ----

/** Readiness 0..1000. The 1590 start; the 1592 start is at the bar. */
export const READINESS_1590 = 100;
export const READINESS_1592 = 1000;
/** A human Japan may strike from here (design §8: "once its readiness passes a bar"). */
export const STRIKE_BAR = 500;
/** Below this the first wave is thin; from FULL_WAVE it is full. */
export const THIN_WAVE = 700;
export const FULL_WAVE = 950;

/** Readiness a day before the war: the muster goes on by itself. */
export function dailyReadiness(meanLoy: number, day: number): number {
  // A loyal muster is quicker: a point a day from a mean of 700, every
  // other day from 400, every fourth below.
  if (meanLoy >= 700) return 1;
  return day % (meanLoy >= 400 ? 2 : 4) === 0 ? 1 : 0;
}

/** What each run-up decision adds to readiness and to Joseon's warning. */
export const RUNUP_STEPS = {
  muster: { readiness: 80, warning: 40 },
  sekibune: { readiness: 60, warning: 40 },
  nagoya: { readiness: 100, warning: 120 },
  demands: { readiness: 20, warning: 150 },
} as const;
/** Joseon heeds a warning (its scene): how much more warned it is. */
export const HEED_WARNING = 150;
/** Loyalty a grant of fiefs and gold buys every daimyo. */
export const GRANT_LOYALTY = 60;

/**
 * The AI's bar and patience, from a roll (design §8: seeds spread the
 * start from autumn 1591 to 1593): a bar of 650..1000 and 0..150 days of
 * waiting once there. 1592's start: the bar is met, 20..70 days.
 */
export function aiStrikePlan(
  roll: number,
  y1592: boolean,
): { bar: number; patience: number } {
  const r = roll >>> 0;
  if (y1592) return { bar: READINESS_1592, patience: 20 + (r % 51) };
  return { bar: 650 + (r % 351), patience: (r >>> 9) % 151 };
}

/** Joseon's warning 0..1000 at the start of each calendar. */
export const WARNING_1590 = 0;
export const WARNING_1592 = 300;
/** Below this Joseon is caught unready; below WARNED, half ready. */
export const UNWARNED = 350;
export const WARNED = 700;

/** A day of visible preparations warns Joseon a little. */
export function dailyWarning(readiness: number): number {
  return readiness >= 300 ? 1 : 0;
}

/** Which first wave Japan lands: 0 thin, 1 ordinary, 2 full. */
export function waveOf(readiness: number): 0 | 1 | 2 {
  if (readiness < THIN_WAVE) return 0;
  return readiness >= FULL_WAVE ? 2 : 1;
}

/** How Joseon meets it: 0 caught unready, 1 half ready, 2 warned. */
export function warnedOf(warning: number): 0 | 1 | 2 {
  if (warning < UNWARNED) return 0;
  return warning < WARNED ? 1 : 2;
}

// ---- The go-betweens (design §7, v1 §4) ----

/**
 * The chance, percent, that the broker softens both texts: a loyal broker
 * carries the true terms (and Ming refuses them); a disloyal one forges.
 */
export function forgeChancePct(brokerLoyalty: number): number {
  return Math.max(0, Math.min(100, Math.floor((700 - brokerLoyalty) / 4)));
}

/** Days of talks, and of the truce until the investiture envoys arrive. */
export function talkDays(roll: number): number {
  return 30 + ((roll >>> 0) % 31);
}
export function truceDays(roll: number): number {
  return 300 + ((roll >>> 0) % 301);
}

/** The AI's bar for a second invasion, after the truth: 600..900. */
export function secondBar(roll: number): number {
  return 600 + ((roll >>> 0) % 301);
}
/** Readiness after the truce breaks (the muster begins again). */
export const REARM_READINESS = 300;

// ---- After Hideyoshi (design §7) ----

/** The fall in every daimyo's loyalty, and in where it drifts back to. */
export const DEATH_LOYALTY = 150;
/** Withdrawal pressure 0..1000; the AI goes home at the top. */
export const PRESSURE_MAX = 1000;
/** A human Japan is asked from here (and plays on if it says no). */
export const PRESSURE_ASK = 600;

/** A day's withdrawal pressure. */
export function dailyPressure(
  heldPm: number,
  atWarWithMing: boolean,
  atWar: boolean,
): number {
  if (!atWar) return 0;
  let p = 2;
  if (heldPm < 500) p += 2;
  if (atWarWithMing) p += 1;
  if (heldPm >= 800) p -= 1;
  return p;
}
