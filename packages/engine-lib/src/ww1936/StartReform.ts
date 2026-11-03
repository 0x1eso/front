// World War 1936: re-forming a start template's divisions when a human
// edits it in the preparation minute. The pure part of the rule: how many
// divisions the template's men budget makes. The engine (land/StartReform)
// and the lobby preview both call it.

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
