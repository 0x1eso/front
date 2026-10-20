// World War 1936 P2: generals (P2 spec §6.2). Task 5 writes assignGeneral
// and appointGeneral (a titled general's id: Generals.titledGeneralId);
// generalOf is the foundation's.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Army, CountryLand, GeneralState, WwLand } from "./WwLand";

/** Spec §6.2: puts `general` at the head of `army` (0: takes it away). STUB. */
export function assignGeneral(
  land: WwLand,
  cl: CountryLand,
  army: number,
  general: number,
): WwOrderBlock | null {
  return null;
}

/** Spec §6.2: a titled general for army experience. STUB. */
export function appointGeneral(
  land: WwLand,
  cl: CountryLand,
): WwOrderBlock | null {
  return null;
}

/** Spec §6.2: the general of an army, null when none. */
export function generalOf(land: WwLand, army: Army): GeneralState | null {
  if (army.general === 0) return null;
  return (
    land.country(army.owner)?.generals.find((g) => g.id === army.general) ??
    null
  );
}
