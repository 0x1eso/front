// World War 1936 P1: the AI economy (spec §12). STUB — Task 6 fills the
// body; the signature is final.
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** An AI country's economy decisions, every WW_AI_PERIOD_DAYS days. */
export function aiEconomyTick(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
  day: number,
  tick: number,
): void {}
