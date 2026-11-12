// World War 1936 P1: changing laws (spec §5.4). The judgement lives in
// engine-lib EconomyChecks (shared with the screens); P3 (plan decision 11)
// adds the conditions of P3 spec §7.2 and the political power cost.
import {
  CONSCRIPTION_LAWS,
  ConscriptionLaw,
  ECONOMY_LAWS,
  LawKind,
  LawValue,
  WW_LAW_COOLDOWN_DAYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { lawBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { lawCost, LawCtx } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { conscriptionPermille } from "@openfront/engine-lib/ww1936/WwLaws";
import { joseonLevyCap } from "../../imjin/land/ImjinDoctrine";
import { congressBlock } from "../depth/Congress";
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
    ...(econ.ww.imjin ? { noGovGates: true } : {}),
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
  const block = lawBlockOf(
    ce.laws,
    ce.lawCooldownUntil,
    kind,
    value,
    day,
    lawCtxOf(econ, ce, value),
  );
  if (block !== null) return block;
  // P6 hook (W3, spec §13.1): the US congress holds back conscription from
  // "limited" and the economy from "partial_mobilization".
  const gated =
    (kind === "conscription" &&
      CONSCRIPTION_LAWS.indexOf(value as never) >=
        CONSCRIPTION_LAWS.indexOf("limited")) ||
    (kind === "economy" &&
      ECONOMY_LAWS.indexOf(value as never) >=
        ECONOMY_LAWS.indexOf("partial_mobilization"));
  if (gated && congressBlock(econ.ww.depth, ce.smallID, "law")) {
    return "law_condition";
  }
  // ww177 P7b (doctrine §7.1): Joseon's levies stop at "limited" until the
  // 훈련도감 trains a standing army, ww181: and at "service" after it
  // (Imjin only).
  if (kind === "conscription" && econ.ww.imjinWar !== null) {
    const cap = joseonLevyCap(econ.ww.imjinWar, ce.smallID);
    if (
      cap !== null &&
      CONSCRIPTION_LAWS.indexOf(value as never) > CONSCRIPTION_LAWS.indexOf(cap)
    )
      return "law_condition";
  }
  return null;
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
 * pool the same day (never below zero, spec §6.2; ww115 T7: a rise stops at
 * the ceiling, as stepManpower no longer cuts what is past it); the consumer
 * goods and the other effects follow from the next daily step; the law's
 * stability line (P3 spec §7.2) at once.
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
    const ceiling = after - ce.casualties - econ.ww.land.armyMen(ce.smallID);
    ce.manpower =
      after > before
        ? Math.min(ce.manpower + after - before, Math.max(ce.manpower, ceiling))
        : Math.max(0, ce.manpower + after - before);
  }
  (ce.laws as unknown as Record<LawKind, LawValue>)[kind] = value;
  econ.ww.politics.recomputeStats(ce.smallID);
}
