// World War 1936 P3: the AI's politics (spec §18.6). STUB: lane A (Task 6)
// writes the bodies; the signatures are final.
import type { DiploAsk } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function aiPoliticsTick(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {}

/** Spec §18.6 table: ≥ 50 accepts. */
export function aiAcceptScore(
  pol: WwPolitics,
  kind: DiploAsk,
  from: number,
  to: number,
): number {
  return 0;
}
