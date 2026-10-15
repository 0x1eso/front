import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENTS } from "./Governments";
import { LAWS } from "./Laws";

/** Modifiers of the proclaimed laws and the current government. */
export function policyModifiers(
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): Modifier[] {
  const out: Modifier[] = [];
  for (const [law, chosen] of laws) {
    out.push(...LAWS[law][chosen].modifiers);
  }
  out.push(...GOVERNMENTS[government].modifiers);
  return out;
}

/** Special effects (spec §7.2's flags) of the laws and the government. */
export function policyFlags(
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): Set<PolicyFlag> {
  const out = new Set<PolicyFlag>();
  for (const [law, chosen] of laws) {
    for (const flag of LAWS[law][chosen].flags) out.add(flag);
  }
  for (const flag of GOVERNMENTS[government].flags) out.add(flag);
  return out;
}
