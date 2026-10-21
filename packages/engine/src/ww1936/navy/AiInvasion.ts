// World War 1936 P4: the invasion planner (P4 spec §17.4). Stubs with the
// final signatures (plan Task 1 Step 18); the AI lane (Task 10) writes the
// bodies and fixes the pure input type here.
import type { WwNavy } from "./WwNavy";

/** The AI's view of one invasion target for aiInvasionScore (Task 10 widens it). */
export interface AiInvasionInput {
  target: number;
  divisions: number;
  routeKm: number;
}

/** The country's AI day for invasions. Stub: nothing. */
export function aiInvasions(navy: WwNavy, smallID: number, day: number): void {
  void navy;
  void smallID;
  void day;
}

/** Pure: a target's score (tested without a game). Stub: 0. */
export function aiInvasionScore(input: AiInvasionInput): number {
  void input;
  return 0;
}
