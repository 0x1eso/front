// World War 1936 P3: advisors (spec §8). STUB: lane P (Task 4) writes the
// bodies; the signatures are final.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwPolitics } from "./WwPolitics";

export function hireAdvisor(
  pol: WwPolitics,
  id: number,
  slot: number,
  advisor: string,
  day: number,
): WwOrderBlock | null {
  return "advisor_unavailable";
}

export function fireAdvisor(
  pol: WwPolitics,
  id: number,
  slot: number,
  day: number,
): WwOrderBlock | null {
  return "advisor_unavailable";
}

/** The person ids (and titled cards) `id` may hire today. */
export function candidatesFor(
  pol: WwPolitics,
  id: number,
  day: number,
): string[] {
  return [];
}
