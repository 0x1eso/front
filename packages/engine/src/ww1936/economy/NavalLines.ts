// World War 1936 P4: naval lines on dockyards (P4 spec §5.2–§5.4). Stubs
// with the final signatures (plan Task 1 Step 18); lane E (Task 9) writes
// the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { NavalLineOrder } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/**
 * naval_line_add / _docks / _count / _remove / _move (spec §5.2); a new
 * line asks navy/EndgameHooks.navalBuildBlock first (P5). Stub: refused.
 */
export function issueNavalLineOrder(
  econ: WwEconomy,
  ce: CountryEconomy,
  order: NavalLineOrder,
  sc: ScenarioIndex,
): WwOrderBlock | null {
  void econ;
  void ce;
  void order;
  void sc;
  return "not_buildable";
}

/**
 * Resources a day each naval line asks for, ce.navalLines order
 * (RESOURCE_IDS rows): P1's allocation serves them after the P1 lines and
 * writes each line's `fill` (Production.stepProduction). Stub: none.
 */
export function navalLineDemand(
  econ: WwEconomy,
  ce: CountryEconomy,
): number[][] {
  void econ;
  void ce;
  return [];
}

/** The country turn's naval lines (after production, spec §16.1). Stub: nothing. */
export function stepNavalLines(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): void {
  void econ;
  void ce;
  void day;
}

/**
 * Spec §5.4: lends `n` dockyards to repairs today; returns how many it
 * lent. Stub: all of them.
 */
export function lendDocks(ce: CountryEconomy, n: number): number {
  void ce;
  return n;
}

/** The dockyards no line or repair uses (the drawer's "idle N"). Stub: 0. */
export function dockyardsFree(econ: WwEconomy, ce: CountryEconomy): number {
  void econ;
  void ce;
  return 0;
}
