// World War 1936 P4: the air AI (P4 spec §17.3). Stubs with the final
// signatures (plan Task 1 Step 18); the AI lane (Task 10) writes the
// bodies and fixes the pure input and output types here.
import type { AirOrder } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwAir } from "./WwAir";

/** The AI's view for aiAirPlan (Task 10 widens it). */
export interface AiAirInput {
  smallID: number;
  day: number;
}
/** An order the AI gives through air.issue (the same as a player's). */
export type AiAirOrder = AirOrder;

/** The country's AI day for its air force. Stub: nothing. */
export function aiAir(air: WwAir, smallID: number, day: number): void {
  void air;
  void smallID;
  void day;
}

/** Pure: the deployments of the day (tested without a game). Stub: none. */
export function aiAirPlan(input: AiAirInput): AiAirOrder[] {
  void input;
  return [];
}
