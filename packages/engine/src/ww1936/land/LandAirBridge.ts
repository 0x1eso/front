// World War 1936 P4: the land war's side of a paradrop (P4 spec §14.10,
// plan decision 35), lane A2 (Task 8): the share of the army's strength
// the transports' losses take (air/Paradrop.paradropLosses), for the
// drop and for the screens' and the AI's estimates.
import { paradropLosses } from "../air/Paradrop";
import type { WwLand } from "./WwLand";

/** The share of the dropping army's strength lost with the transports, ‰ (0: no such army). */
export function paradropLossPm(
  land: WwLand,
  army: number,
  target: number,
): number {
  const a = land.armies.get(army);
  if (a === undefined || land.scenario.region(target) === undefined) return 0;
  return paradropLosses(land.ww.air, a, target).pm;
}
