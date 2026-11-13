// Great War 1914 (ww207/ww208, lane S1): the society under the parties. The
// axes, communities, support, by-elections, general elections and their
// rules, births, splits, merges, deaths, the fervour term, the orders
// faction_promote / faction_condemn and the strip's view. The S0 format
// commit leaves these as stubs that change nothing (GW_DIGEST holds); S1
// owns this file. Rows: engine-lib/ww1914/SocietyRows. See
// /home/eser/dev/ww207-format.md.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  axesOf,
  GW_AXIS_NOTCHES,
  type GwElection,
  type GwSocietyView,
  type GwStripFactionView,
} from "@openfront/engine-api/ww1914/GwSociety";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";
import { factionRow, houseRow, seatsNow } from "./House";
import type { SceneCtx } from "./SceneRun";
import { abilityView, treeView } from "./Utopia";

export type SocietyCond = Extract<
  GwWorldCond,
  {
    is:
      | "axis"
      | "support"
      | "faction_trust"
      | "community"
      | "community_trust"
      | "election_due";
  }
>;

export type SocietyEffect = Extract<
  GwWorldEffect,
  {
    do:
      | "axis"
      | "support"
      | "faction_trust"
      | "community"
      | "community_trust"
      | "election";
  }
>;

/** The chapter's society step, after the house's (GW_CHAPTER_STEPS). S1. */
export function societyStep(gw: GreatWar): void {
  void gw;
}

/** S1: the society's world conds. The stub holds none. */
export function societyHolds(ctx: SceneCtx, c: SocietyCond): boolean {
  void ctx;
  void c;
  return false;
}

/** S1: the society's world effects. The stub does nothing. */
export function societyDo(ctx: SceneCtx, e: SocietyEffect): void {
  void ctx;
  void e;
}

/** Order `faction_promote` (지지한다). S1. */
export function promoteFaction(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  void gw;
  void seat;
  void faction;
  return "no_faction";
}

/** Order `faction_condemn` (규탄한다). S1. */
export function condemnFaction(
  gw: GreatWar,
  seat: GwSeatState,
  faction: string,
): GwOrderBlock | null {
  void gw;
  void seat;
  void faction;
  return "no_faction";
}

/**
 * The strip, the 정국 tab's axes and communities, the election card. S0's
 * reading from the house as it stands (S1 fills communities, support, the
 * due dates and the born flag; S2's treeView and abilityView fill the rest).
 */
export function societyView(
  gw: GreatWar,
  seat: GwSeatState,
): GwSocietyView | undefined {
  const house = houseRow(seat.tag);
  const h = seat.house;
  if (house === null || h === undefined) return undefined;
  const first = house.chambers[0]?.id;
  const axes = gw.nation(seat.tag)?.axes ?? {};
  const factions: GwStripFactionView[] = [];
  for (const f of h.factions) {
    if (f.status === "out" || f.status === "merged") continue;
    const row = factionRow(f.id);
    if (row === null) continue;
    factions.push({
      id: f.id,
      bloc: row.bloc,
      status: f.status,
      seats: first === undefined ? 0 : (seatsNow(seat, row)[first] ?? 0),
      support: f.support ?? row.support ?? 0,
      trust: f.trust ?? row.trust ?? 0,
      temper: f.step,
      ideals: row.ideals ?? {},
      leader: f.leader,
      affinity: f.affinity ?? 0,
      born: false,
      ability: abilityView(gw, seat, f.id),
      tree: treeView(gw, seat, f.id),
      promote: false,
      condemn: false,
    });
  }
  factions.sort((a, b) => b.seats - a.seats);
  return {
    axes: axesOf(seat.tag).map((axis) => ({
      axis,
      step: Math.trunc((axes[axis] ?? 0) / GW_AXIS_NOTCHES),
      trend: 0,
    })),
    communities: [],
    factions,
    election: { last: lastElection(seat), due: {} },
    utopia: seat.society?.utopia ?? null,
  };
}

function lastElection(seat: GwSeatState): GwElection | null {
  const list = seat.society?.elections ?? [];
  return list.length === 0 ? null : list[list.length - 1];
}
