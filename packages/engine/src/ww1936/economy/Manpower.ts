// World War 1936 P1: manpower and the troop bridge (spec §6). STUB — Task 3
// fills the bodies; the signatures are final.
import { troopCapOf } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** One day of manpower growth (spec §6.2). */
export function stepManpower(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {}

/** The daily draft and the troop cap (spec §6.3, §6.4). */
export function stepRecruit(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  // Stub keeps the cap meaningful until Task 3.
  ce.totals.troopCap = troopCapOf(
    Math.floor(p.troops()),
    ce.manpower,
    ce.infStock(),
  );
}
