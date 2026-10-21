// World War 1936 P4 — the names new ships take (spec §4.4, plan decision
// 17), and the historical fleet names. The types and the name list are the
// foundation's (plan Task 1 Step 15); lane G (Task 13) fills the tables.
//
// A ship's nameIdx (state): > 0 is index + 1 into shipNameList(tag, cls):
// the names of the country's START_NAVY ships of that class (table order),
// then its START_NAVY lines' names, then SHIP_NAMES[tag][cls] (the names
// ships built in the game take, in order); < 0 is a numbered name −n
// ("Destroyer No. n"). Keys are ww1936.ship.<name>.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";
import { START_NAVY } from "./StartNavy";

export const SHIP_NAMES: Readonly<
  Partial<
    Record<CountryTag, Readonly<Partial<Record<ShipClass, readonly string[]>>>>
  >
> = {};

/** Historical fleet names, ww1936.fleet.<key> (a fleet's nameIdx > 0 is index + 1). */
export const FLEET_NAMES: readonly string[] = [];

const lists = new Map<string, { names: string[]; queueFrom: number }>();

function listOf(
  tag: CountryTag,
  cls: ShipClass,
): { names: string[]; queueFrom: number } {
  const key = `${tag}:${cls}`;
  let l = lists.get(key);
  if (l !== undefined) return l;
  const names: string[] = [];
  const add = (n: string) => {
    if (!names.includes(n)) names.push(n);
  };
  for (const d of START_NAVY) {
    if (d.tag !== tag) continue;
    for (const s of d.ships)
      if (s.cls === cls && s.name !== undefined) add(s.name);
    for (const ln of d.lines)
      if (ln.cls === cls) for (const n of ln.names) add(n);
  }
  const queueFrom = names.length;
  for (const n of SHIP_NAMES[tag]?.[cls] ?? []) add(n);
  l = { names, queueFrom };
  lists.set(key, l);
  return l;
}

/** Every name a (country, class) ship can carry, in nameIdx order. */
export function shipNameList(
  tag: CountryTag,
  cls: ShipClass,
): readonly string[] {
  return listOf(tag, cls).names;
}

/** The nameIdx of a name of the list, 0 when it is not in it. */
export function shipNameIdx(
  tag: CountryTag,
  cls: ShipClass,
  name: string,
): number {
  return listOf(tag, cls).names.indexOf(name) + 1;
}

/**
 * The nameIdx of the `n`-th name of the build queue (SHIP_NAMES order);
 * 0 when the queue has no more (the ship takes a numbered name).
 */
export function queuedShipName(
  tag: CountryTag,
  cls: ShipClass,
  n: number,
): number {
  const l = listOf(tag, cls);
  const i = l.queueFrom + n;
  return i < l.names.length ? i + 1 : 0;
}

/** The name key of a nameIdx > 0 (ww1936.ship.<key>), or null for a numbered name. */
export function shipNameKey(
  tag: CountryTag,
  cls: ShipClass,
  nameIdx: number,
): string | null {
  if (nameIdx <= 0) return null;
  return listOf(tag, cls).names[nameIdx - 1] ?? null;
}

/** A fleet name's nameIdx (FLEET_NAMES index + 1), 0 when unknown. */
export function fleetNameIdx(key: string): number {
  return FLEET_NAMES.indexOf(key) + 1;
}
