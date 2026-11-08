// World War 1936 diplomacy D2 (ww161 Design B §2; lane L5): collaboration
// governments on a capitulated country's occupied land — the order, the
// country it wakes (CS_GONE tag, DiploTypes.COLLAB_TAGS, or a civil-war
// slot), the neutral collaborator subject, and the AI's monthly check.
// Until L5 fills them the order is refused and nothing runs.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

/** collab_create by `from` on capitulated `target`'s `regions`. */
export function createCollab(
  _eg: WwEndgame,
  _from: number,
  _target: number,
  _regions: readonly number[],
  _tick: number,
): WwOrderBlock | null {
  return "collab_not_occupier";
}

/** Daily for an AI country (staggered by smallID; acts monthly). */
export function aiCollabDay(
  _eg: WwEndgame,
  _id: number,
  _day: number,
  _tick: number,
): void {}
