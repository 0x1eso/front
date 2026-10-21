// P6 lane W2 fills this file (plan Task 8): night bombing and recon (spec §15.1, §15.3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

/** The air zone's day (after P4's mission effects). */
export function airZoneDay(
  d: WwDepth,
  sr: number,
  day: number,
  tick: number,
): void {}

/** air_night. */
export function issueSeaAir(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "bad_index";
}

/** Recon's cut of the enemy's readiness at `region`, bp ≤ 0. */
export function reconPlanCutBp(
  d: WwDepth,
  attacker: number,
  region: number,
): number {
  return 0;
}

/** `side`'s recon sorties today over the zone. */
export function reconToday(d: WwDepth, side: number, sr: number): number {
  return 0;
}

/** Spec §8.8: the observer's recon covers a region of the target. */
export function reconCovers(
  d: WwDepth,
  observer: number,
  target: number,
): boolean {
  return false;
}

/** Night missions: losses and bombing, bp of the day's value. */
export function nightMods(
  d: WwDepth,
  deploymentId: number,
): { lossBp: number; bombBp: number } {
  return { lossBp: 10_000, bombBp: 10_000 };
}
