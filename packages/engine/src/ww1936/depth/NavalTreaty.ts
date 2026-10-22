// P6 lane W3 fills this file (plan Task 9): the naval treaty (spec §14).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** A member of the naval treaty now (the foundation's body: the list). */
export function treatyMember(d: WwDepth, id: number): boolean {
  return d.mech.treaty.members.includes(id) && !d.mech.treaty.ended;
}

export function treatyEscalated(d: WwDepth): boolean {
  return false;
}

/** The treaty refuses the naval line (cls, gen). */
export function treatyLineBlock(
  d: WwDepth,
  id: number,
  cls: number,
  gen: number,
): boolean {
  return false;
}
