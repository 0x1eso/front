// World War 1936 P1: the combat bridge (spec §6.5, §10). STUB — Task 5
// fills the bodies; the signatures are final.
import type { DomesticCombat } from "../../domestic/DomesticEconomy";
import type { Player } from "../../game/Game";
import type { WorldWar } from "../WorldWar";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Equipment lost with the men noted since the last day (spec §6.5). */
export function applyCombatLosses(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  ce.lossMilli = 0;
}

/** The country's attack, defense and speed percent (spec §10.1). */
export function updateCombatStats(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {}

/** The vanilla attack's scales in this mode (spec §10.2); `base` outside it. */
export function withWwCombat(
  base: Readonly<DomesticCombat>,
  ww: WorldWar | null,
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  return base;
}
