// World War 1936 air overhaul (ww8), lane D: a wing's experience (design §6).
// Lanes A, B and C call these at the events below. Experience is in milli,
// 0..WING_XP_MAX; the tiers and what they do are in engine-lib's WingRules.
import {
  type Wing,
  WP_GROUND,
  WP_REARM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  WING_XP_CAS,
  WING_XP_DELIVERY,
  WING_XP_FIGHT_BASE,
  WING_XP_FIGHT_KILL_MILLI,
  WING_XP_MAX,
  WING_XP_REST_CAP,
  WING_XP_REST_DAYS,
  WING_XP_STATION,
  xpTier,
} from "@openfront/engine-lib/ww1936/WingRules";
import { aceOnFight, aceRetireIfForeign } from "../depth/Aces";
import type { WwAir } from "./WwAir";

/** Planes in the wing, design slots included (never 0 for the division). */
function planesIn(w: Wing): number {
  let n = 0;
  for (const c of w.counts) n += c;
  for (const c of w.dcounts) n += c;
  return n;
}

/** Adds experience; the screen hears of it only when the tier changes. */
function gain(air: WwAir, w: Wing, milli: number, cap = WING_XP_MAX): void {
  if (milli <= 0 || w.xpMilli >= cap) return;
  const before = xpTier(w.xpMilli);
  w.xpMilli = Math.min(cap, w.xpMilli + milli);
  if (xpTier(w.xpMilli) !== before) air.markWing(w.id);
}

/** A pulse where it met the enemy, `shotDown` planes this pulse (lane B). */
export function noteWingFight(
  air: WwAir,
  w: Wing,
  shotDown: number,
  day: number,
): void {
  const planes = Math.max(1, planesIn(w));
  gain(
    air,
    w,
    WING_XP_FIGHT_BASE +
      Math.floor((shotDown * WING_XP_FIGHT_KILL_MILLI) / planes),
  );
  aceOnFight(air.ww.depth, w, day);
}

/** A CAS pulse inside a battle (lane B). */
export function noteWingCas(air: WwAir, w: Wing): void {
  gain(air, w, WING_XP_CAS);
}

/** A delivery: bombs or a naval strike (lane B, after deliverSortie). */
export function noteWingDelivery(air: WwAir, w: Wing): void {
  gain(air, w, WING_XP_DELIVERY);
}

/** A finished station on patrol or recon (lane B). */
export function noteWingStation(air: WwAir, w: Wing): void {
  gain(air, w, WING_XP_STATION);
}

/** The wing rested on the ground today (lane A's country turn): up to the start value, +1 every 5 days. */
export function noteWingRest(air: WwAir, w: Wing, day: number): void {
  aceRetireIfForeign(air.ww.depth, w);
  if (w.phase !== WP_GROUND && w.phase !== WP_REARM) {
    return;
  }
  if ((day + w.id) % WING_XP_REST_DAYS !== 0) return;
  gain(air, w, 1, WING_XP_REST_CAP);
}
