// World War 1936 P1: manpower (spec §6). P2 trains divisions from it
// (land/Training.ts); the daily draft is gone (P2 plan decision 12).
import {
  casualtyRelease,
  manpowerRegrowth,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/**
 * One day of manpower growth (spec §6.2): a tenth of the recruitable pool a
 * year, up to what the regions could still give. The whole army counts
 * against that, the field divisions and the men in training (P2 spec
 * §13.2, WwEconomy.armyMen). ww115 T7: the ceiling only stops the growth;
 * manpower already in the pool stays when land is lost. The pool is less
 * the casualties (spec §6.5), so a man who dies leaves the army and the
 * pool alike, and that debt falls 5 % a year (casualtyRelease), so a long
 * war's ceiling opens again.
 */
export function stepManpower(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const ceiling = Math.max(0, ce.totals.recruitable - econ.armyMen(p));
  // P3 spec §3.4: × (100 + manpowerGrowthPct) / 100.
  const growth = Math.floor(
    (manpowerRegrowth(ce.totals.recruitable) *
      Math.max(0, 100 + ce.stats.manpowerGrowthPct)) /
      100,
  );
  if (ce.manpower < ceiling) {
    ce.manpower = Math.min(ce.manpower + growth, ceiling);
  }
  ce.casualties -= casualtyRelease(ce.casualties);
}
