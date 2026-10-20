// World War 1936 P1: manpower (spec §6). P2 trains divisions from it
// (land/Training.ts); the daily draft is gone (P2 plan decision 12).
import { manpowerRegrowth } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/**
 * One day of manpower growth (spec §6.2): a tenth of the recruitable pool a
 * year, never past what the regions could still give. The whole army counts
 * against that, the field divisions and the men in training (P2 spec
 * §13.2, WwEconomy.armyMen), so the army and manpower together never
 * exceed the recruitable pool. Losing regions shrinks manpower only
 * through this ceiling. The pool is less the casualties (spec §6.5), so a
 * man who dies leaves the army and the pool alike: the ceiling does not
 * refill.
 */
export function stepManpower(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const ceiling = Math.max(0, ce.totals.recruitable - econ.armyMen(p));
  ce.manpower = Math.min(
    ce.manpower + manpowerRegrowth(ce.totals.recruitable),
    ceiling,
  );
}
