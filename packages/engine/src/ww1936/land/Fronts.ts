// World War 1936 P2: front assignment (P2 spec §8.1). STUB: Task 3 writes
// the bodies; the signatures are final.
import type { WwLand } from "./WwLand";

/** Spec §8.1: the country's day for its front and plan armies. */
export function dailyFronts(land: WwLand, smallID: number, day: number): void {}

/** Spec §8.1: our regions touching `enemy`'s (0: any enemy), ascending. */
export function borderRegions(
  land: WwLand,
  smallID: number,
  enemy: number,
): number[] {
  return [];
}

/** Spec §8.1: the front of `count` border regions from `anchor`, BFS order. */
export function frontFrom(
  land: WwLand,
  smallID: number,
  enemy: number,
  anchor: number,
  count: number,
): number[] {
  return [];
}
