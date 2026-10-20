// World War 1936 P1: changing laws (spec §5.4). The judgement lives in
// engine-lib EconomyChecks (shared with the screens).
import {
  ConscriptionLaw,
  LawKind,
  LawValue,
  WW_LAW_COOLDOWN_DAYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { lawBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { conscriptionPermille } from "@openfront/engine-lib/ww1936/WwLaws";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Why `ce` may not set this law on `day`; null if it may. */
export function lawBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  kind: LawKind,
  value: LawValue,
  day: number,
): WwOrderBlock | null {
  return lawBlockOf(ce.laws, ce.lawCooldownUntil, kind, value, {
    day,
    warDays: econ.warDays(ce.smallID, econ.mg.ticks()),
  });
}

/**
 * Spec §5.4: any number of steps at once, then 30 days before that kind may
 * change again. A conscription change moves manpower by the difference in
 * the recruitable pool the same day (never below zero, spec §6.2); the
 * consumer goods and the other effects follow from the next daily step.
 */
export function setLaw(
  econ: WwEconomy,
  ce: CountryEconomy,
  kind: LawKind,
  value: LawValue,
  day: number,
): WwOrderBlock | null {
  const block = lawBlock(econ, ce, kind, value, day);
  if (block !== null) return block;
  if (kind === "conscription") {
    const before = econ.recruitableWith(
      ce.smallID,
      conscriptionPermille(ce.laws.conscription),
    );
    const after = econ.recruitableWith(
      ce.smallID,
      conscriptionPermille(value as ConscriptionLaw),
    );
    ce.manpower = Math.max(0, ce.manpower + after - before);
  }
  (ce.laws as unknown as Record<LawKind, LawValue>)[kind] = value;
  ce.lawCooldownUntil[kind] = day + WW_LAW_COOLDOWN_DAYS;
  return null;
}
