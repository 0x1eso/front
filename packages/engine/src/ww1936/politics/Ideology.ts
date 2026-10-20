// World War 1936 P3: governments, leaders, civil war (spec §5.6–§5.8).
// STUB: lane P (Task 4) writes the bodies; the signatures are final.
import type { PersonId } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function setGovernment(
  pol: WwPolitics,
  id: number,
  ideology: number,
  tick: number,
): void {}

export function setLeader(
  pol: WwPolitics,
  id: number,
  person: PersonId,
  tick: number,
): void {}

export function civilWar(
  pol: WwPolitics,
  id: number,
  ideology: number,
  tick: number,
): void {}
