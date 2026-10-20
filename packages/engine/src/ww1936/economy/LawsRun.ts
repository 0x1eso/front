// World War 1936 P1: changing laws (spec §5.4). The judgement lives in
// engine-lib EconomyChecks (shared with the screens); P3 (plan decision 11)
// adds the conditions of P3 spec §7.2 and the political power cost.
import {
  ConscriptionLaw,
  LawKind,
  LawValue,
  WW_LAW_COOLDOWN_DAYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { lawBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { lawCost, LawCtx } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { conscriptionPermille } from "@openfront/engine-lib/ww1936/WwLaws";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** P3 spec §7.1: what the law conditions read for `ce` setting `value` now. */
export function lawCtxOf(
  econ: WwEconomy,
  ce: CountryEconomy,
  value: LawValue,
): LawCtx {
  const pol = econ.ww.politics;
  const c = pol.country(ce.smallID);
  return {
    wsBp: c?.wsBp ?? 0,
    wtBp: pol.wtBp,
    ruling: c?.ruling ?? IDEO_NEU,
    atWar: econ.ww.hasWar(ce.smallID),
    ppMilli: c?.ppMilli ?? 0,
    costMilli: lawCost(value, ce.stats) * 1000,
  };
}

/** Why `ce` may not set this law on `day`; null if it may. */
export function lawBlock(
  econ: WwEconomy,
  ce: CountryEconomy,
  kind: LawKind,
  value: LawValue,
  day: number,
): WwOrderBlock | null {
  return lawBlockOf(
    ce.laws,
    ce.lawCooldownUntil,
    kind,
    value,
    day,
    lawCtxOf(econ, ce, value),
  );
}

/**
 * Spec §5.4: any number of steps at once, then 30 days before that kind may
 * change again; P3 spec §7.1: the target law's cost in PP, once.
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
  const c = econ.ww.politics.country(ce.smallID);
  if (c !== null) c.ppMilli -= lawCost(value, ce.stats) * 1000;
  applyLawChange(econ, ce, kind, value);
  ce.lawCooldownUntil[kind] = day + WW_LAW_COOLDOWN_DAYS;
  return null;
}

/**
 * The change itself, with no condition, cost or cooldown (P3 controller
 * ruling R10: setLaw and P3's free set_law / law_step share it). A
 * conscription change moves manpower by the difference in the recruitable
 * pool the same day (never below zero, spec §6.2); the consumer goods and
 * the other effects follow from the next daily step; the law's stability
 * line (P3 spec §7.2) at once.
 */
export function applyLawChange(
  econ: WwEconomy,
  ce: CountryEconomy,
  kind: LawKind,
  value: LawValue,
): void {
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
  econ.ww.politics.recomputeStats(ce.smallID);
}
