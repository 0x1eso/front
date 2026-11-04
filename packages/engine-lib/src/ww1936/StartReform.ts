// World War 1936: re-forming a start template's divisions when a human
// edits it in the preparation minute. The pure part of the rule: how many
// divisions the template's men budget makes. The engine (land/StartReform)
// and the lobby preview both call it.
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
  NEED_GROUP_COUNT,
} from "@openfront/engine-api/ww1936/LandTypes";
import { groupDrawSlots, slotGroup, STATIC_KEY_STATS } from "./TemplateStats";

/** A start division may be re-formed into at most this many times its original count. */
export const START_REFORM_MAX_FACTOR = 2;

/**
 * The count of divisions for an edited start template.
 * - `budget`: original division count x the original men of the template.
 * - `originalCount`: the original division count (the 2x cap).
 * - `men`: the edited template's men per division.
 * - `fillable`: how many full-strength divisions of it the stock (men and
 *   equipment, after the old divisions gave theirs back) can fill. Pass
 *   Infinity when unknown.
 *
 * floor(budget / men), cut to `fillable`, capped at 2 x `originalCount`; at
 * least one division when one can be filled; 0 when none can.
 */
export function startReformCount(
  budget: number,
  originalCount: number,
  men: number,
  fillable: number,
): number {
  if (men <= 0 || fillable < 1 || originalCount < 1) return 0;
  const byBudget = Math.floor(budget / men);
  const n = Math.min(
    byBudget,
    START_REFORM_MAX_FACTOR * originalCount,
    fillable,
  );
  return Math.max(1, n);
}

/**
 * Splits `total` over weights by largest remainder: deterministic, the
 * result sums to `total`; ties go to the lower index.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map(() => 0);
  if (sum <= 0 || total <= 0) return out;
  const rem: number[] = [];
  let given = 0;
  for (let i = 0; i < weights.length; i++) {
    const q = total * weights[i];
    out[i] = Math.floor(q / sum);
    rem.push(q % sum);
    given += out[i];
  }
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => rem[b] - rem[a] || a - b);
  for (let k = 0; given < total && k < order.length; k++, given++) {
    out[order[k]]++;
  }
  return out;
}

// ---- the stock side: what a template could be filled from ----

/** Need groups that have division slots at all (design-only ones have none until a design exists). */
export const FILLABLE_GROUP: readonly boolean[] = Array.from(
  { length: NEED_GROUP_COUNT },
  (_, g) => groupDrawSlots(STATIC_KEY_STATS, g).length > 0,
);

/** The stock (EQUIP_KEYS order) as one number per need group: the static ground slots summed. */
export function groupStockOf(stock: ArrayLike<number>): number[] {
  const out = new Array<number>(NEED_GROUP_COUNT).fill(0);
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    out[slotGroup(STATIC_KEY_STATS, j)] += stock[GROUND_EQUIP_KEYS[j]] ?? 0;
  }
  return out;
}

/** A start division as the start fields it: its template and that template's need per group. */
export interface StartKind {
  key: string;
  need: readonly number[];
}

/**
 * What is left in the stock after the start fielded `field` in order (each
 * division draws up to its need from what remains, so late ones may be
 * understrength), and what each template's divisions hold between them.
 * Men are not modelled: the pool is far larger than the army.
 */
export function startHoldings(
  groupStock: readonly number[],
  field: readonly StartKind[],
): { left: number[]; held: Map<string, number[]> } {
  const left = [...groupStock];
  const held = new Map<string, number[]>();
  for (const d of field) {
    let h = held.get(d.key);
    if (h === undefined) {
      h = new Array<number>(NEED_GROUP_COUNT).fill(0);
      held.set(d.key, h);
    }
    for (let g = 0; g < NEED_GROUP_COUNT; g++) {
      const take = Math.max(0, Math.min(d.need[g] ?? 0, left[g]));
      left[g] -= take;
      h[g] += take;
    }
  }
  return { left, held };
}

/** One edited start template. */
export interface ReformEdit {
  key: string;
  /** The edited template's need per group and men per division. */
  need: readonly number[];
  men: number;
  /** The template's original division count and men budget (count x men). */
  originalCount: number;
  budget: number;
}

export interface ReformPreview {
  count: number;
  /** The need group that cut the count (a stock shortage), or -1: the budget or the 2x cap did. */
  limitedBy: number;
}

/**
 * The re-form of each edit in order, as the engine does it: the old
 * divisions give everything back, as many full-strength divisions as the
 * budget, the 2x cap and the stock allow draw it again. A later edit sees
 * what the earlier ones left.
 */
export function previewReforms(
  groupStock: readonly number[],
  field: readonly StartKind[],
  edits: readonly ReformEdit[],
): ReformPreview[] {
  const { left, held } = startHoldings(groupStock, field);
  const out: ReformPreview[] = [];
  for (const e of edits) {
    const old = held.get(e.key) ?? new Array<number>(NEED_GROUP_COUNT).fill(0);
    const pool = left.map((x, g) => x + old[g]);
    let fillable = Infinity;
    let limit = -1;
    for (let g = 0; g < NEED_GROUP_COUNT; g++) {
      const need = e.need[g] ?? 0;
      if (need <= 0 || !FILLABLE_GROUP[g]) continue;
      const n = Math.floor(pool[g] / need);
      if (n < fillable) {
        fillable = n;
        limit = g;
      }
    }
    const count = startReformCount(e.budget, e.originalCount, e.men, fillable);
    if (count === 0) {
      // Nothing could be re-formed: the old divisions stay as they were.
      out.push({ count: 0, limitedBy: limit });
      continue;
    }
    const byBudget = Math.min(
      e.men > 0 ? Math.floor(e.budget / e.men) : 0,
      START_REFORM_MAX_FACTOR * e.originalCount,
    );
    out.push({ count, limitedBy: fillable < byBudget ? limit : -1 });
    const mine = new Array<number>(NEED_GROUP_COUNT).fill(0);
    for (let g = 0; g < NEED_GROUP_COUNT; g++) {
      mine[g] = count * (e.need[g] ?? 0);
      left[g] = pool[g] - mine[g];
    }
    held.set(e.key, mine);
  }
  return out;
}
