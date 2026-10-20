// World War 1936 P1: changing laws (spec §5.4). The judgement is final
// (engine-lib EconomyChecks, shared with the screens); setLaw is a STUB that
// Task 3 fills, with its final signature.
import {
  LawKind,
  LawValue,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { lawBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
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

export function setLaw(
  econ: WwEconomy,
  ce: CountryEconomy,
  kind: LawKind,
  value: LawValue,
  day: number,
): WwOrderBlock | null {
  return null;
}
