// World War 1936 P3: laws set by effects (spec §7.2 set_law free, law_step).
// STUB: lane P (Task 4) writes the bodies; the signatures are final. The
// order path (cost, blocks) is P1's LawsRun, finished by the foundation.
import type {
  LawKind,
  LawValue,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwPolitics } from "./WwPolitics";

export function setLawFree(
  pol: WwPolitics,
  id: number,
  kind: LawKind,
  value: LawValue,
): void {}

export function lawStep(
  pol: WwPolitics,
  id: number,
  kind: LawKind,
  steps: number,
): void {}
