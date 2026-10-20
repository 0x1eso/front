// World War 1936 P2: fronts (P2 spec §8.1) over plain data, so the screens'
// front preview and the engine's daily fronts agree. STUB: Task 3 writes
// the bodies (the signatures are final).
import type { ScenarioIndex } from "./ScenarioIndex";

export interface FrontWorld {
  scenario: ScenarioIndex;
  controller: ArrayLike<number>;
  /** a and b on the same side (spec §7.1). */
  sameSide(a: number, b: number): boolean;
  /** a may fight b now. */
  isEnemy(a: number, b: number): boolean;
}

/** Spec §8.1: our side's regions touching `enemy` (0: any enemy of `me`), ascending. */
export function borderRegionsOf(
  w: FrontWorld,
  me: number,
  enemy: number,
): number[] {
  return [];
}

/** Spec §8.1: BFS over the border graph from `anchor`, neighbours by id, up to `count`. */
export function frontOf(
  w: FrontWorld,
  me: number,
  enemy: number,
  anchor: number,
  count: number,
): number[] {
  return [];
}

/** Spec §8.1: ceil(divisions / 3). */
export function frontSize(divisions: number): number {
  return Math.max(1, Math.ceil(divisions / 3));
}

/** Spec §8.1: largest-remainder split of `n` divisions over `weights` (ties: smaller index). */
export function splitByWeight(n: number, weights: readonly number[]): number[] {
  return weights.map(() => 0);
}
