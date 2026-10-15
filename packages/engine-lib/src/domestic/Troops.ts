import { DomesticView } from "@openfront/engine-api/domestic/DomesticTypes";
import { applyPct } from "./Modifiers";

/**
 * Troop growth under domestic rules (spec §3.5): troopRegen scales growth
 * and growth stops at the recruit target. At or above the target growth is
 * zero (DomesticExecution demobilizes the excess gradually); troops over
 * max still snap down like vanilla.
 */
export function domesticTroopIncrease(
  troops: number,
  baseIncrease: number,
  maxTroops: number,
  d: DomesticView,
): number {
  const target = (maxTroops * d.recruitTargetPct()) / 100;
  if (troops >= target) {
    return Math.min(0, maxTroops - troops);
  }
  return (
    Math.min(troops + applyPct(baseIncrease, d.pct("troopRegen")), target) -
    troops
  );
}
