// World War 1936 P2: battle plans and planning (P2 spec §8.2, §8.3). STUB:
// Task 3 writes the bodies; the signatures are final.
import type { BattlePrediction } from "@openfront/engine-api/ww1936/LandTypes";
import type { Army, WwLand } from "./WwLand";

/** Spec §8.2: one day of an executing plan for one front region. */
export function planDay(land: WwLand, army: Army, day: number): void {}

/** Spec §8.3: readiness change for the day. */
export function readinessDay(land: WwLand, army: Army): void {}

/**
 * Spec §9.9 for the engine: `attackers` (rows) against `region`'s enemy
 * divisions, with their modifiers (plans, AI). Gathers each side's
 * modifiers with Battles.modInputOf (pre-flight U11), as the battles do.
 */
export function predictAttack(
  land: WwLand,
  attackers: readonly number[],
  region: number,
): BattlePrediction {
  return { ratioPm: 0, rounds: 0, days: 0 };
}
