// World War 1936 P2: the only paths between the P1 stockpile / manpower
// pool and the divisions (P2 spec §5.5, §21.3). Generations never mix: a
// slot goes back to its own key (Review Focus 4).
import {
  EQUIPMENT_GENS,
  EquipmentType,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  groundSlotOf,
} from "@openfront/engine-api/ww1936/LandTypes";
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
 * Fills `slots` (GROUND_SLOTS) toward `need` (EQUIPMENT_TYPES order) from
 * the stock, newest generation first (spec §5.1, §5.3); at most
 * `cap(need)` of each type this call (default: all that is missing).
 */
export function drawTemplateEquip(
  ce: CountryEconomy,
  slots: number[] | Int32Array,
  need: readonly number[],
  types: readonly EquipmentType[],
  cap: (needed: number) => number = (x) => x,
): void {
  for (let i = 0; i < types.length; i++) {
    const tk = typeSlots(types[i]);
    let have = 0;
    for (let k = 0; k < tk.slots.length; k++) have += slots[tk.slots[k]];
    // Nothing missing: nothing drawn (cap is never negative).
    if (need[i] - have <= 0) continue;
    let want = Math.min(need[i] - have, cap(need[i]));
    for (let k = tk.slots.length - 1; k >= 0 && want > 0; k--) {
      const got = drawEquip(ce, tk.keys[k], want);
      slots[tk.slots[k]] += got;
      want -= got;
    }
  }
}

/** A type's division slots and their stock keys, generation 1 first (only generations a division holds). */
interface TypeSlots {
  slots: number[];
  keys: number[];
}
const TYPE_SLOT_CACHE = new Map<EquipmentType, TypeSlots>();

function typeSlots(type: EquipmentType): TypeSlots {
  let ts = TYPE_SLOT_CACHE.get(type);
  if (ts === undefined) {
    ts = { slots: [], keys: [] };
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const key = equipKey(type, g);
      const s = groundSlotOf(key);
      if (s < 0) continue;
      ts.slots.push(s);
      ts.keys.push(key);
    }
    TYPE_SLOT_CACHE.set(type, ts);
  }
  return ts;
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
