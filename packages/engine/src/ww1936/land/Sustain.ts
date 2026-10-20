// World War 1936 P2: reinforcement, upgrades, attrition and experience (P2
// spec §5.1, §5.3, §5.4, §6.2). Task 5 writes dailySustain; disbandDivision
// is the foundation's (one path for the equipment back to the stock).
import { returnDivisionEquip } from "../economy/Stock";
import type { WwLand } from "./WwLand";

/** Spec §5.1, §5.3, §5.4, §6.2 dates and experience: the country's day. STUB. */
export function dailySustain(
  land: WwLand,
  smallID: number,
  day: number,
): void {}

/** Disband (spec §5.3): men and equipment back, then the division goes. Orders call it. */
export function disbandDivision(land: WwLand, row: number): void {
  const ce = land.econ.country(land.divisions.owner[row]);
  if (ce !== null) {
    returnDivisionEquip(
      ce,
      land.divisions.equipOf(row),
      land.divisions.men[row],
    );
  }
  land.killDivision(row, false);
}
