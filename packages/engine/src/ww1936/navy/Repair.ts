// World War 1936 P4: repairs, navy experience and admirals (P4 spec §5.4,
// §7.1, §7.4, §7.5). Stubs with the final signatures (plan Task 1 Step 18);
// lane N2 (Task 4) writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwNavy } from "./WwNavy";

/** The country's day of repairs in its naval bases (borrows docks: lendDocks). Stub: nothing. */
export function dailyRepair(navy: WwNavy, smallID: number, day: number): void {
  void navy;
  void smallID;
  void day;
}

/** The country's day of navy experience and admiral experience. Stub: nothing. */
export function dailyNavyXp(navy: WwNavy, smallID: number, day: number): void {
  void navy;
  void smallID;
  void day;
}

/** appoint_admiral (spec §7.4: a titled admiral for 10 navy XP). Stub: refused. */
export function appointAdmiral(
  navy: WwNavy,
  smallID: number,
): WwOrderBlock | null {
  void navy;
  void smallID;
  return "no_xp";
}
