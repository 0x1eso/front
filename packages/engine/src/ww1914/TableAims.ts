// ww220 (decision 6B): a country's aims at the table, its known case plus
// the short list against each enemy history never gave it (GW_TABLE_AIMS_VS),
// while the two stand on opposite sides.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  GW_TABLE_AIMS,
  GW_TABLE_AIMS_VS,
} from "@openfront/engine-lib/ww1914/TableRows";
import type { GreatWar } from "./GreatWar";

/** What `tag` came for, most wanted first: the case, then the new enemies'. */
export function aimsOf(gw: GreatWar, tag: GwTag): readonly GwPlace[] {
  const base = GW_TABLE_AIMS[tag] ?? [];
  const vs = GW_TABLE_AIMS_VS[tag];
  const mine = gw.nation(tag)?.side ?? null;
  if (vs === undefined || mine === null) return base;
  const more: GwPlace[] = [];
  for (const [x, places] of Object.entries(vs)) {
    const theirs = gw.nation(x as GwTag)?.side ?? null;
    if (theirs === null || theirs === mine) continue;
    for (const p of places ?? []) {
      if (!base.includes(p) && !more.includes(p)) more.push(p);
    }
  }
  return more.length === 0 ? base : [...base, ...more];
}
