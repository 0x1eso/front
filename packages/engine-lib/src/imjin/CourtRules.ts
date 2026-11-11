// ww177 P4 (Imjin design §7, §10; lane I4a): the pure rules of Joseon's
// court, the king's flight, the righteous armies and Ming's intervention
// meter. Integers only; the engine side is engine/imjin/JoseonMing.ts.
// History is a loose guide: everything here is moved by the game's state
// (who holds what, the court's cohesion, the picks), never by a date.
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { ImjinStartId } from "./Starts";

// ---- The court (design §7): three factions on the 1936 ideology slots ----

/** 서인: the 1936 "democratic" slot. */
export const COURT_WEST = IDEO_DEM;
/** 남인: the 1936 "communist" slot. */
export const COURT_SOUTH = IDEO_COM;
/** 북인: the 1936 "fascist" slot. */
export const COURT_NORTH = IDEO_FAS;
/** 왕권: the 1936 "non-aligned" slot (the king's own men, no faction). */
export const COURT_THRONE = IDEO_NEU;
/** The three factions that can hold the chief councillor's seat. */
export const COURT_FACTIONS = [COURT_WEST, COURT_SOUTH, COURT_NORTH] as const;

export interface CourtStart {
  readonly ruling: number;
  /** IDEOLOGIES order, sums to 10,000. */
  readonly pop: readonly [number, number, number, number];
  /** Cohesion is Joseon's stability (bp). */
  readonly cohesionBp: number;
  readonly warSupportBp: number;
}

/**
 * 1590: the Westerners hold the court (Jeong Cheol). 1592: Jeong Cheol has
 * fallen (1591) and the Easterners lead, Ryu Seong-ryong's Southerners first.
 */
export const COURT_STARTS: Readonly<Record<ImjinStartId, CourtStart>> = {
  y1590: {
    ruling: COURT_WEST,
    pop: [4000, 2500, 2000, 1500],
    cohesionBp: 5500,
    warSupportBp: 3500,
  },
  y1592: {
    ruling: COURT_SOUTH,
    pop: [2000, 4000, 2500, 1500],
    cohesionBp: 4500,
    warSupportBp: 4000,
  },
};

/** The court's step runs every this many days. */
export const COURT_STEP_DAYS = 10;
/** A ruling faction this strong holds the court together: +cohesion a step. */
export const COURT_STRONG_BP = 4500;
export const COURT_CALM_UP_BP = 100;
/** Two factions this close at the top quarrel: −cohesion a step. */
export const COURT_CLOSE_BP = 500;
export const COURT_QUARREL_DOWN_BP = 100;
export const COURT_COHESION_MAX_BP = 7000;
export const COURT_COHESION_MIN_BP = 1500;
/** A rival this far ahead of the ruling faction asks for the court. */
export const COURT_SHIFT_LEAD_BP = 800;
export const COURT_SHIFT_COOLDOWN_DAYS = 180;
/** A lost (won back) county moves this much support from (to) the ruling faction. */
export const COURT_LOSS_POP_BP = 50;

/**
 * One court step: the cohesion change (bp) from the factions' support.
 * `pop` in IDEOLOGIES order; `cohesion` the current stability.
 */
export function courtCohesionStep(
  pop: readonly number[],
  ruling: number,
  cohesion: number,
): number {
  let d = 0;
  if ((pop[ruling] ?? 0) >= COURT_STRONG_BP) d += COURT_CALM_UP_BP;
  const top = COURT_FACTIONS.map((f) => pop[f] ?? 0).sort((a, b) => b - a);
  if (top[0] - top[1] < COURT_CLOSE_BP) d -= COURT_QUARREL_DOWN_BP;
  const next = Math.min(
    COURT_COHESION_MAX_BP,
    Math.max(COURT_COHESION_MIN_BP, cohesion + d),
  );
  // Never pull an outside value (an event's) back across the bounds.
  if (d > 0 && cohesion >= COURT_COHESION_MAX_BP) return 0;
  if (d < 0 && cohesion <= COURT_COHESION_MIN_BP) return 0;
  return next - cohesion;
}

/** The faction (0..2) that asks for the court now, or -1. */
export function courtRival(pop: readonly number[], ruling: number): number {
  let best = -1;
  for (const f of COURT_FACTIONS) {
    if (f === ruling) continue;
    if (best < 0 || pop[f] > pop[best]) best = f;
  }
  const own = ruling === COURT_THRONE ? 0 : (pop[ruling] ?? 0);
  return best >= 0 && pop[best] >= own + COURT_SHIFT_LEAD_BP ? best : -1;
}

// ---- Appointments (design §7): cohesion decides ----

/** Yi Sun-sin's appointment comes to a court at least this cohesive. */
export const APPOINT_YI_COHESION_BP = 4000;
/** …and the Southerners (Ryu Seong-ryong) at least this strong. */
export const APPOINT_YI_SOUTH_BP = 3000;
/** …after this many days of the game (the run-up has begun). */
export const APPOINT_YI_DAY = 90;
/** Gwon Yul's command comes to a court this cohesive, this long at war. */
export const APPOINT_GWON_COHESION_BP = 3500;
export const APPOINT_GWON_WAR_DAYS = 20;
/** A double agent's tip can bring an admiral down only below this. */
export const TIP_COHESION_BP = 4000;
export const TIP_WAR_DAYS = 300;

// ---- The king's flight (design §7) ----

export const SEAT_CAPITAL = 0;
export const SEAT_NORTH = 1;
export const SEAT_BORDER = 2;
export const SEAT_ABROAD = 3;

export type FlightPick = "hold" | "flee" | "split" | "cross";

export interface FlightResult {
  readonly seat: number;
  readonly cohesionBp: number;
  readonly warSupportBp: number;
  /** Support the ruling faction loses (bp of the court). */
  readonly rulingPopBp: number;
  readonly mingBp: number;
  readonly divided: boolean;
}

/** What a pick at `seat` does (the result card says it in words). */
export function flightResult(seat: number, pick: FlightPick): FlightResult {
  switch (pick) {
    case "hold":
      return {
        seat,
        cohesionBp: 300,
        warSupportBp: 500,
        rulingPopBp: 0,
        mingBp: 0,
        divided: false,
      };
    case "flee":
      return {
        seat: Math.min(SEAT_BORDER, seat + 1),
        cohesionBp: -1000,
        warSupportBp: -500,
        rulingPopBp: 800,
        mingBp: seat >= SEAT_NORTH ? 1000 : 400,
        divided: false,
      };
    case "split":
      return {
        seat: Math.min(SEAT_BORDER, seat + 1),
        cohesionBp: -1500,
        warSupportBp: 500,
        rulingPopBp: 800,
        mingBp: seat >= SEAT_NORTH ? 1000 : 400,
        divided: true,
      };
    case "cross":
      return {
        seat: SEAT_ABROAD,
        cohesionBp: -1500,
        warSupportBp: -1000,
        rulingPopBp: 1000,
        mingBp: 2500,
        divided: false,
      };
  }
}

/** The seat fell with the court in it: it escapes north in disorder. */
export const SEAT_FALLEN: Omit<FlightResult, "seat" | "divided"> = {
  cohesionBp: -2500,
  warSupportBp: -1500,
  rulingPopBp: 1000,
  mingBp: 1000,
};

/** How far (region hops) a fleeing court looks for safety. */
export const SEAT_SAFE_HOPS = 6;

// ---- Righteous armies (design §7) ----

export interface RighteousLeader {
  /** Lang key `imjin.person.<id>`. */
  readonly id: string;
  /** Province (strategic region) or county names the leader rises in. */
  readonly homes: readonly string[];
  /** A monk: rises only after a temple has burned and the call went out. */
  readonly monk: boolean;
}

/**
 * Real leaders (design §11; the ones it lists as unchecked are noted in
 * the lane report). Append only: the snapshot stores them by position.
 */
export const RIGHTEOUS_LEADERS: readonly RighteousLeader[] = [
  {
    id: "gwak_jae_u",
    homes: ["Gyeongsang", "Uiryeong", "Jinju", "Miryang", "Daegu"],
    monk: false,
  },
  {
    id: "go_gyeong_myeong",
    homes: ["Jeolla", "Gwangju", "Damyang"],
    monk: false,
  },
  {
    id: "jo_heon",
    homes: ["Chungcheong", "Cheongju", "Okcheon", "Chungju"],
    monk: false,
  },
  { id: "kim_cheon_il", homes: ["Jeolla", "Naju"], monk: false },
  {
    id: "jeong_mun_bu",
    homes: ["Hamgyeong", "Kyongsong", "Gilju", "Hoeryong"],
    monk: false,
  },
  { id: "kim_deok_ryeong", homes: ["Jeolla", "Gwangju"], monk: false },
  { id: "yi_jeong_am", homes: ["Hwanghae", "Yeonan", "Haeju"], monk: false },
  {
    id: "hyujeong",
    homes: ["Pyeongan", "Pyongyang", "Anju", "Deokcheon"],
    monk: true,
  },
  {
    id: "yujeong",
    homes: ["Gangwon", "Hoeyang", "Gangneung", "Wonju"],
    monk: true,
  },
  { id: "yeonggyu", homes: ["Chungcheong", "Gongju", "Cheongju"], monk: true },
];

/** Leader states (by RIGHTEOUS_LEADERS position). */
export const LEADER_WAITING = 0;
export const LEADER_RAIDING = 1;
export const LEADER_JOINED = 2;
export const LEADER_FALLEN = 3;

/** An occupied county this restless can raise a leader. */
export const RISE_RES_BP = 2000;

/**
 * Percent a day that a waiting leader rises where his home's most restless
 * occupied county stands at `resBp`: 1 per 10% of resistance from 20%, +2
 * with the crown prince's court raising men, +1 under the court's command.
 */
export function riseChancePct(
  resBp: number,
  divided: boolean,
  commanded: boolean,
): number {
  if (resBp < RISE_RES_BP) return 0;
  return Math.floor(resBp / 1000) - 1 + (divided ? 2 : 0) + (commanded ? 1 : 0);
}

/** Resistance a raiding band adds in its province's occupied counties, bp a day. */
export function bandResistanceBp(commanded: boolean): number {
  return commanded ? 30 : 15;
}

/**
 * The supply an occupier keeps on a raided county's roads, permille
 * (design §7: −30% on hill and forest roads, less on open ground).
 */
export function raidSupplyPm(land: string, commanded: boolean): number {
  const rough =
    land === "hills" ||
    land === "forest" ||
    land === "mountain" ||
    land === "marsh";
  if (rough) return commanded ? 600 : 700;
  return commanded ? 850 : 900;
}

/** The court commands the bands only this cohesive (its authority). */
export const COMMAND_COHESION_BP = 4000;
/** A refused command costs the court this much cohesion. */
export const COMMAND_REFUSED_BP = 200;
/** Per mille a day that a band's leader falls while enemy troops stand in its county. */
export const LEADER_FALL_PM = 2;
/** A band joins the army as this many divisions… */
export const BAND_DIVISIONS = 1;
/** …with this % of its template's equipment. */
export const BAND_EQUIP_PCT = 30;

/** Percent that a captured county with a mountain temple sees it burn. */
export const TEMPLE_BURN_PCT = 35;
/** Counties whose temple always burns when the enemy takes them (Bulguksa). */
export const TEMPLE_COUNTIES: readonly string[] = ["Gyeongju"];

/** Whether a county's land holds a mountain temple. */
export function templeLand(land: string): boolean {
  return land === "mountain" || land === "forest" || land === "hills";
}

// ---- Ming's intervention meter (design §7) ----

export const MING_METER_MAX = 10_000;
/** Ming enters the war and sends its vanguard (as Zu Chengxun's)… */
export const MING_VANGUARD_BP = 6000;
/** …and when the meter fills, the relief army (as Li Rusong's). */
export const MING_RELIEF_BP = MING_METER_MAX;
export const MING_VANGUARD_DIVISIONS = 2;
export const MING_RELIEF_DIVISIONS = 6;
export const MING_FORCE_EQUIP_PCT = 80;
/** After Ming's entry, a meter this low asks for a way out (the truce lane reads the flag). */
export const MING_WEARY_BP = 2500;
/** A Joseon envoy: meter up, suspicion down. */
export const MING_ENVOY_BP = 900;
export const MING_ENVOY_SUSPICION_BP = 400;
/** Japan's open demand (passage to Ming), once. */
export const MING_DEMAND_BP = 1500;
/** Joseon's first day at war with Japan, once. */
export const MING_WAR_BP = 500;
/** A Joseon county lost in the war's first 60 days: Ming suspects collusion. */
export const MING_EARLY_LOSS_SUSPICION_BP = 150;
export const MING_EARLY_DAYS = 60;
export const MING_SUSPICION_MAX = 5000;

export const MING_START: Readonly<
  Record<ImjinStartId, { meterBp: number; suspicionBp: number }>
> = {
  y1590: { meterBp: 1000, suspicionBp: 1500 },
  y1592: { meterBp: 1500, suspicionBp: 1500 },
};

/** A northwest war (as Ningxia's) may start every this many days… */
export const MING_NORTHWEST_EVERY_DAYS = 90;
/** …one time in this many… */
export const MING_NORTHWEST_ONE_IN = 4;
/** …and lasts this long. */
export const MING_NORTHWEST_DAYS = 120;

export interface MingInputs {
  /** Joseon and Japan are at war. */
  readonly war: boolean;
  /** Region hops from Japan's nearest county to Ming land (99: far). */
  readonly nearHops: number;
  /** The Joseon court's seat (SEAT_*). */
  readonly seat: number;
  readonly suspicionBp: number;
  /** Ming fights a war elsewhere, or a northwest rising runs. */
  readonly otherFront: boolean;
  /** Ming is in the war. */
  readonly intervened: boolean;
  /** Ming divisions on Joseon soil. */
  readonly divisionsAbroad: number;
}

/** The meter's change in a day (bp), before the one-off pushes. */
export function mingDailyDelta(i: MingInputs): number {
  if (!i.war) return -5;
  let d = 10;
  if (i.nearHops <= 1) d += 120;
  else if (i.nearHops === 2) d += 60;
  else if (i.nearHops === 3) d += 20;
  if (i.seat === SEAT_BORDER) d += 10;
  if (i.seat === SEAT_ABROAD) d += 20;
  d -= Math.floor(i.suspicionBp / 200);
  if (i.otherFront) d -= 15;
  // The silver spent: every day in the field costs Ming's will.
  if (i.intervened) d -= 4 + i.divisionsAbroad;
  return d;
}

/** Suspicion fades by this much a day. */
export const MING_SUSPICION_FADE_BP = 5;
