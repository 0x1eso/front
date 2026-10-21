// World War 1936 P3: political power and the country's political day
// (spec §4.1, §5.2, §5.4, §5.5, §6.1, §8.1, §9.1).
import {
  addPpCapped,
  dailyPpMilli,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { dismissExpired } from "./Advisors";
import { dailyIdeology } from "./Ideology";
import { expireSpirits } from "./Spirits";
import { computeStability } from "./Stability";
import type { WwPolitics } from "./WwPolitics";

/**
 * Spec §2.2 order 3, first half: PP → spirits, advisors and flags that ran
 * out → stability & war support → stats → ideology.
 */
export function dailyPower(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id)!;
  const before = c.ppMilli;
  // P5 hook (X): an exile's daily political power is 50..100% (spec §10.4).
  const pct = pol.ww.endgame.ppFactorPct(id);
  const gain = dailyPpMilli(c.stats);
  c.ppMilli = addPpCapped(
    c.ppMilli,
    pct === 100 ? gain : Math.floor((gain * pct) / 100),
  );
  // The running total counts what was added (not what the cap took).
  c.ppCumMilli += Math.max(0, c.ppMilli - before);
  expireSpirits(pol, c, day);
  dismissExpired(pol, c, day);
  if (c.flags.size > 0) {
    for (const [f, [, until]] of [...c.flags]) {
      if (until >= 0 && until <= day) c.flags.delete(f);
    }
  }
  if ((day + id) % 7 === 0) {
    c.stabBaseBp = Math.max(
      0,
      Math.min(10_000, c.stabBaseBp + c.stats.stabilityWeeklyBp),
    );
    c.wsBaseBp = Math.max(
      0,
      Math.min(10_000, c.wsBaseBp + c.stats.warSupportWeeklyBp),
    );
  }
  const s = computeStability(pol, id);
  c.stabBp = s.stabBp;
  c.wsBp = s.wsBp;
  pol.recomputeStats(id);
  dailyIdeology(pol, id, day, tick);
}

/** Pays a cost in PP; false (nothing paid) when short or negative. */
export function payPp(pol: WwPolitics, id: number, pp: number): boolean {
  const c = pol.country(id);
  if (c === null || c.ppMilli < 0 || c.ppMilli < pp * 1000) return false;
  c.ppMilli -= pp * 1000;
  return true;
}
