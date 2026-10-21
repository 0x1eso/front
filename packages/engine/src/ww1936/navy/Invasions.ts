// World War 1936 P4: naval invasions (P4 spec §11). Stubs with the final
// signatures (plan Task 1 Step 18, pre-flight A10, A11); lane I (Task 6)
// writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CombatMods } from "@openfront/engine-api/ww1936/LandTypes";
import type { InvasionOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwNavy } from "./WwNavy";

/** army_invade / invasion_execute / invasion_cancel. Stub: "no_army" unless the army is the sender's, then null. */
export function issueInvasionOrder(
  navy: WwNavy,
  smallID: number,
  order: InvasionOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const a = navy.land.armies.get(order.army);
  return a === undefined || a.owner !== smallID ? "no_army" : null;
}

/** The country's day of invasions: preparation, auto launch, aborts. Stub: nothing. */
export function dailyInvasions(
  navy: WwNavy,
  smallID: number,
  day: number,
  tick: number,
): void {
  void navy;
  void smallID;
  void day;
  void tick;
}

/** Spec §11.3: the launch of a prepared invasion. Stub: not ready. */
export function launchInvasion(
  navy: WwNavy,
  army: number,
  tick: number,
): WwOrderBlock | null {
  void navy;
  void army;
  void tick;
  return "invasion_not_ready";
}

/** Spec §11.4: an invasion voyage arrives (lane C's stepSeaVoyages calls it). Stub: nothing. */
export function landInvasion(navy: WwNavy, voyage: number, tick: number): void {
  void navy;
  void voyage;
  void tick;
}

/** Spec §11.1: another order for the army drops its invasion (P2 issueArmyOrder calls it). Stub: nothing. */
export function cancelInvasion(navy: WwNavy, army: number): void {
  void navy;
  void army;
}

/** Spec §11.4: the defender's shore bombardment cut in `region` from `side`'s enemies, bp ≤ 0 (the hooks). Stub: 0. */
export function shoreBombardAt(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  void navy;
  void region;
  void side;
  return 0;
}

/** Spec §11.4: a landing division's battle lines (the hooks), null for any other. Stub: null. */
export function amphibiousModsFor(
  navy: WwNavy,
  battleRegion: number,
  row: number,
): CombatMods | null {
  void navy;
  void battleRegion;
  void row;
  return null;
}

/** Spec §11.5: the beachheads (lane C's coastal supply reads them; state in WwNavy). */
export function beachheads(
  navy: WwNavy,
): ReadonlyMap<number, { side: number; until: number }> {
  return navy.beachhead;
}

/** Spec §11.5: a beachhead's coastal supply hub for `side`, milli (P2's daily supply). Stub: 0. */
export function beachheadCapacityMilli(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  void navy;
  void region;
  void side;
  return 0;
}
