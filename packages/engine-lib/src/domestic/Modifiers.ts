import {
  Condition,
  Modifier,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { STAT_CAPS } from "./Balance";
import { TECHS } from "./Techs";

const COMBAT_LOSS_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  "attackLoss",
  "defenseLoss",
]);
const NO_CONDITIONS: ReadonlySet<Condition> = new Set();

/** Clamps one stat's summed percent to the spec caps (§7.1). */
export function capPct(stat: StatKey, pct: number): number {
  const min = COMBAT_LOSS_STATS.has(stat)
    ? STAT_CAPS.combatLossMinPct
    : STAT_CAPS.reductionMinPct;
  return Math.min(STAT_CAPS.increaseMaxPct, Math.max(min, pct));
}

/** Clamps a sum over several stats (e.g. buildCost + portCost). */
export function capCombinedPct(pct: number): number {
  return Math.min(
    STAT_CAPS.increaseMaxPct,
    Math.max(STAT_CAPS.reductionMinPct, pct),
  );
}

export function applyPct(value: number, pct: number): number {
  return value * (1 + pct / 100);
}

/** Per-stat sums of a modifier list, split by condition. Immutable. */
export class ModifierTotals {
  private readonly always = new Map<StatKey, number>();
  private readonly conditional = new Map<Condition, Map<StatKey, number>>();

  constructor(modifiers: readonly Modifier[]) {
    for (const m of modifiers) {
      let bucket = this.always;
      if (m.when !== undefined) {
        bucket = this.conditional.get(m.when) ?? new Map<StatKey, number>();
        this.conditional.set(m.when, bucket);
      }
      bucket.set(m.stat, (bucket.get(m.stat) ?? 0) + m.pct);
    }
  }

  pct(stat: StatKey, active: ReadonlySet<Condition> = NO_CONDITIONS): number {
    let total = this.always.get(stat) ?? 0;
    for (const c of active) {
      total += this.conditional.get(c)?.get(stat) ?? 0;
    }
    return capPct(stat, total);
  }
}

export function techModifiers(techs: Iterable<TechId>): Modifier[] {
  const out: Modifier[] = [];
  for (const id of techs) {
    out.push(...TECHS[id].modifiers);
  }
  return out;
}
