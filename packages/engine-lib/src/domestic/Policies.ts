import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENTS } from "./Governments";
import { LAWS } from "./Laws";
import { ModifierTotals, techModifiers } from "./Modifiers";

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

/**
 * All of a domestic player's modifiers (researched techs, proclaimed laws
 * and the government), summed per stat and per condition. The engine
 * (PlayerDomestic) and the client (DomesticClientView) both build their
 * totals here so they can't drift apart; each passes the conditions in
 * force to ModifierTotals.pct.
 */
export function domesticModifiers(
  techs: Iterable<TechId>,
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): ModifierTotals {
  return new ModifierTotals([
    ...techModifiers(techs),
    ...policyModifiers(laws, government),
  ]);
}
