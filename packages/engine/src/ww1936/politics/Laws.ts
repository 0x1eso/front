// World War 1936 P3: laws set by effects (spec §7.2 set_law free, law_step).
// No condition, cost or cooldown: P1's applyLawChange (the manpower move,
// the law, the stats) and nothing else. The order path (cost, blocks) is
// P1's LawsRun, finished by the foundation.
import {
  LAW_LADDERS,
  LawKind,
  LawValue,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { applyLawChange } from "../economy/LawsRun";
import type { WwPolitics } from "./WwPolitics";

export function setLawFree(
  pol: WwPolitics,
  id: number,
  kind: LawKind,
  value: LawValue,
): void {
  const ce = pol.econ.country(id);
  if (ce === null || ce.laws[kind] === value) return;
  if (!LAW_LADDERS[kind].includes(value)) return;
  applyLawChange(pol.econ, ce, kind, value);
  pol.econ.markCountryDirty(id);
  pol.markCountry(id);
}

/** `steps` rungs up (down when negative) the law's ladder, stopping at its ends. */
export function lawStep(
  pol: WwPolitics,
  id: number,
  kind: LawKind,
  steps: number,
): void {
  const ce = pol.econ.country(id);
  if (ce === null) return;
  const ladder = LAW_LADDERS[kind];
  const now = ladder.indexOf(ce.laws[kind]);
  const to = Math.max(0, Math.min(ladder.length - 1, now + steps));
  setLawFree(pol, id, kind, ladder[to]);
}
