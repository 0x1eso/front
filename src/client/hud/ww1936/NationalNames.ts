// ww91 (lane N2): the national units' names. No new battalion id: once the
// country holds its unit (stat natUnit), its base battalion carries the
// unit's numbers and name on every screen that lists the player's own
// battalions.
import type { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";
import { natUnitRow } from "@openfront/engine-lib/ww1936/NationalUnits";
import { translateText } from "../../Utils";

/** The battalion's name: the national unit's when `natUnit` turns `id` into it. */
export function battalionName(id: BattalionId, natUnit = 0): string {
  const row = natUnitRow(natUnit, id);
  return row === null
    ? translateText(`ww1936.battalion.${id}`)
    : translateText(`ww1936.battalion_nat.${row.tag}`);
}

/** One line on what the unit is, for the picker; null for any other battalion. */
export function natUnitNote(id: BattalionId, natUnit = 0): string | null {
  const row = natUnitRow(natUnit, id);
  return row === null
    ? null
    : translateText(`ww1936.nat_unit_desc.${row.tag}`);
}
