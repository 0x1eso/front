// World War 1936 P4: sea moves and voyages (P4 spec §10.4, plan decision
// 34). Stubs with the final signatures (plan Task 1 Step 18, pre-flight
// A9); lane C (Task 5) writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LandOrderSource } from "@openfront/engine-api/ww1936/LandTypes";
import type { ArmySeaOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import { issueArmyOrder } from "../land/Orders";
import type { WwNavy } from "./WwNavy";

/**
 * army_sea (decision 34; WwLand.issue sends the AI's here too). Stub: P2's
 * sea move as it was (issueArmyOrder: seaTicks, no convoys, no interception).
 */
export function issueSeaTransfer(
  navy: WwNavy,
  smallID: number,
  order: ArmySeaOrder,
  tick: number,
  by: LandOrderSource = "player",
): WwOrderBlock | null {
  void tick;
  const cl = navy.land.country(smallID);
  if (cl === null) return "dead";
  return issueArmyOrder(navy.land, cl, order, by);
}

/**
 * A convoy voyage of `divs` (division ids) of `army` from port `from` to
 * `to` (an invasion when `invasion`): binds the convoys, lifts the
 * divisions (SeaLift.liftDivisions). Returns the voyage id, 0 when none
 * started. Stub: none.
 */
export function startVoyage(
  navy: WwNavy,
  owner: number,
  army: number,
  divs: readonly number[],
  from: number,
  to: number,
  invasion: boolean,
  tick: number,
): number {
  void navy;
  void owner;
  void army;
  void divs;
  void from;
  void to;
  void invasion;
  void tick;
  return 0;
}

/** Every voyage one tick on its route (arrivals: landDivisions or lane I's landInvasion). Stub: nothing. */
export function stepSeaVoyages(navy: WwNavy, tick: number): void {
  void navy;
  void tick;
}

/** The owner's day of its voyages: interception, aborts (after allocateConvoys). Stub: nothing. */
export function dailyVoyages(navy: WwNavy, smallID: number, day: number): void {
  void navy;
  void smallID;
  void day;
}
