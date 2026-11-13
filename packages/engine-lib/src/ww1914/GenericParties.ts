// Great War 1914 (ww208, lane S1): the generic parties' faction rows. A seat
// sees a peasants' party, a veterans' league, a peace party and a nationalist
// party of each of its national communities born where no real row fits
// (GwGenericPartyRow, content/society/common.ts). The engine reads them as
// faction rows like any other (House.factionRows), made here once per
// content: no seats, no leader, `out` until born. Text: common.house.json
// `factions.<id>` (genericFactionId).
import {
  axesOf,
  type GwAxis,
  type GwIdeals,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwContent } from "./content/Content";
import type { GwFactionRow } from "./HouseRows";
import { genericFactionId, type GwGenericPartyRow } from "./SocietyRows";

/** The axes a nationalist party is born on (one per community of these). */
export const GW_NATION_AXES: readonly GwAxis[] = ["nations", "dual", "union"];

const made = new WeakMap<GwContent, readonly GwFactionRow[]>();

/** Keeps the ideals on the seat's own axes. */
function onAxes(tag: GwFactionRow["tag"], ideals: GwIdeals): GwIdeals {
  const out: Partial<Record<GwAxis, -1 | 0 | 1>> = {};
  for (const a of axesOf(tag)) {
    const v = ideals[a];
    if (v !== undefined && v !== 0) out[a] = v;
  }
  return out;
}

function rowOf(
  g: GwGenericPartyRow,
  tag: GwFactionRow["tag"],
  ideals: GwIdeals,
  community?: string,
): GwFactionRow {
  return {
    id: genericFactionId(tag, g.kind, community),
    tag,
    bloc: g.bloc,
    leaders: [],
    seats: {},
    start: "out",
    strength: 1,
    ideals,
    template: g.template,
  };
}

/**
 * Every seat's generic faction rows: one a kind per seat with a house, and a
 * nationalist one per community whose ideal is on a national axis.
 */
export function genericFactionRows(c: GwContent): readonly GwFactionRow[] {
  const hit = made.get(c);
  if (hit !== undefined) return hit;
  const out: GwFactionRow[] = [];
  const generic = c.society?.generic ?? [];
  for (const house of c.houses ?? []) {
    const tag = house.tag;
    for (const g of generic) {
      if (g.kind !== "nationalist") {
        out.push(rowOf(g, tag, onAxes(tag, g.ideals)));
        continue;
      }
      for (const k of c.society?.communities ?? []) {
        if (k.tag !== tag || !GW_NATION_AXES.includes(k.ideal.axis)) continue;
        const ideals = {
          ...onAxes(tag, g.ideals),
          [k.ideal.axis]: k.ideal.side,
        };
        out.push(rowOf(g, tag, ideals, k.id));
      }
    }
  }
  made.set(c, out);
  return out;
}
