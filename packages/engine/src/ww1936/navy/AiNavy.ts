// World War 1936 P4: the navy AI (P4 spec §17.2). Stubs with the final
// signatures (plan Task 1 Step 18); the AI lane (Task 10) writes the
// bodies and fixes the pure input and output types here.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwNavy } from "./WwNavy";

/** The AI's view for aiNavalPlan (Task 10 widens it). */
export interface AiNavalInput {
  smallID: number;
  day: number;
}
/** An order the AI gives through navy.issue (the same as a player's). */
export type AiNavalOrder = WwOrder;

/** The country's AI day for its fleets and naval lines. Stub: nothing. */
export function aiNavy(navy: WwNavy, smallID: number, day: number): void {
  void navy;
  void smallID;
  void day;
}

/** Pure: the fleet and naval line orders of the day (tested without a game). Stub: none. */
export function aiNavalPlan(input: AiNavalInput): AiNavalOrder[] {
  void input;
  return [];
}
