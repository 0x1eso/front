// World War 1936 P2: the only paths between the P1 stockpile / manpower
// pool and the divisions (P2 spec §5.5, §21.3). Generations never mix: a
// slot goes back to its own key (Review Focus 4).
import type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  NEED_GROUPS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  groupDrawSlots,
  STATIC_KEY_STATS,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { CountryEconomy } from "./WwEconomy";

/** Takes up to `n` of stock key `key`; returns how many it took. */
export function drawEquip(ce: CountryEconomy, key: number, n: number): number {
  const take = Math.max(0, Math.min(n, ce.stock[key]));
  ce.stock[key] -= take;
  return take;
}

export function returnEquip(ce: CountryEconomy, key: number, n: number): void {
  if (n > 0) ce.stock[key] += n;
}

/** All or nothing (spec §5.1: the men leave the pool at once). */
export function drawManpower(ce: CountryEconomy, men: number): boolean {
  if (men < 0 || ce.manpower < men) return false;
  ce.manpower -= men;
  return true;
}

export function returnManpower(ce: CountryEconomy, men: number): void {
  if (men > 0) ce.manpower += men;
}

/**
 * Fills `slots` (GROUND_SLOTS) toward `need` (P6: NEED_GROUPS order) from
 * the stock, newest first (spec §5.1, §5.3; P6 plan decision 7: the
 * group's slots, the newest year first, then the smaller slot — P2's
 * newest generation first when it holds no design); at most `cap(need)` of
 * each group this call (default: all that is missing).
 */
export function drawTemplateEquip(
  ce: CountryEconomy,
  slots: number[] | Int32Array,
  need: readonly number[],
  ks: KeyStatsTable = STATIC_KEY_STATS,
  cap: (needed: number) => number = (x) => x,
): void {
  const order = drawOrderOf(ks);
  for (let g = 0; g < need.length; g++) {
    const list = order[g];
    if (list === undefined || list.length === 0) continue;
    let have = 0;
    for (let k = 0; k < list.length; k++) have += slots[list[k]];
    // Nothing missing: nothing drawn (cap is never negative).
    if (need[g] - have <= 0) continue;
    const want = Math.min(need[g] - have, cap(need[g]));
    drawGroupInto(ce, list, want, slots);
  }
}

/**
 * P6 (plan decision 7): takes up to `n` of need group `group` from the
 * stock in draw order (the newest year first, then the smaller slot) and
 * returns how many came from each division slot (GROUND_SLOTS long).
 */
export function drawGroupEquip(
  ce: CountryEconomy,
  group: number,
  n: number,
  ks: KeyStatsTable,
): number[] {
  const got = new Array<number>(GROUND_SLOTS).fill(0);
  const list = drawOrderOf(ks)[group];
  if (list !== undefined) drawGroupInto(ce, list, n, got);
  return got;
}

function drawGroupInto(
  ce: CountryEconomy,
  list: readonly number[],
  n: number,
  into: number[] | Int32Array,
): void {
  let want = n;
  for (let k = 0; k < list.length && want > 0; k++) {
    const j = list[k];
    const got = drawEquip(ce, GROUND_EQUIP_KEYS[j], want);
    into[j] += got;
    want -= got;
  }
}

/** Each need group's division slots in draw order, kept per KeyStatsTable (never written into). */
const DRAW_ORDER = new WeakMap<KeyStatsTable, number[][]>();

export function drawOrderOf(ks: KeyStatsTable): number[][] {
  let o = DRAW_ORDER.get(ks);
  if (o === undefined) {
    o = NEED_GROUPS.map((_, g) => groupDrawSlots(ks, g));
    DRAW_ORDER.set(ks, o);
  }
  return o;
}

/** A division's or trainee's men and every equipment slot back to the pool and stock. */
export function returnDivisionEquip(
  ce: CountryEconomy,
  slots: ArrayLike<number>,
  men: number,
): void {
  for (let j = 0; j < GROUND_SLOTS; j++) {
    returnEquip(ce, GROUND_EQUIP_KEYS[j], slots[j]);
  }
  returnManpower(ce, men);
}
