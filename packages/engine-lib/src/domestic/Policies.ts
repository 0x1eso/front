import {
  Condition,
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

/** Everything a player's domestic modifiers depend on. */
export interface DomesticModifierInput {
  techs: Iterable<TechId>;
  laws: ReadonlyMap<LawId, LawOption>;
  government: GovernmentId;
  /** Conditional modifiers count only for these conditions. */
  conditions: ReadonlySet<Condition>;
}

/**
 * The modifier totals of a player's techs, laws and government, with each
 * conditional modifier counted only while its condition holds, so `pct(stat)`
 * needs no conditions. PlayerDomestic (engine) and DomesticClientView (client)
 * both build their totals here, so the two sides agree on every percent.
 */
export function domesticModifierTotals(
  input: DomesticModifierInput,
): ModifierTotals {
  const active: Modifier[] = [];
  const all = [
    ...techModifiers(input.techs),
    ...policyModifiers(input.laws, input.government),
  ];
  for (const m of all) {
    if (m.when === undefined) {
      active.push(m);
    } else if (input.conditions.has(m.when)) {
      active.push({ stat: m.stat, pct: m.pct });
    }
  }
  return new ModifierTotals(active);
}
