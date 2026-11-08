// World War 1936 diplomacy D1 (ww161 Design B §1; lane L1): who a peace
// offer may go to, as the engine checks it (WhitePeace.peaceOfferBlock,
// SeparatePeace.offerHome) and the war card greys its 단독 강화 and "come
// home" buttons with. Reads only a war's sides, so the engine's WwWar and
// the screens' WwWarSummary both fit.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";

/** What the rule reads of a war: each side's leader and its members' states. */
export interface SepPeaceWar {
  readonly sides: readonly {
    readonly leader: number;
    readonly members: readonly {
      readonly id: number;
      readonly state: string;
    }[];
  }[];
}

/** Still in the war: active or in exile (WhitePeace.fighting). */
export const sepFights = (state: string | undefined): boolean =>
  state === "active" || state === "exiled";

/** The side of `w` that `id` is on (-1: none). */
export function sepSideOf(w: SepPeaceWar, id: number): number {
  return w.sides.findIndex((s) => s.members.some((m) => m.id === id));
}

function stateOf(w: SepPeaceWar, side: number, id: number): string | undefined {
  return w.sides[side]?.members.find((m) => m.id === id)?.state;
}

/**
 * Whom `from` may offer peace in `w` (null: `target` will do). Today's
 * target, the other side's leader, stays open to any member. Any other
 * fighting member of that side that is no puppet (`isPuppet`: a puppet
 * follows its overlord, whose peace covers it) may be offered a separate
 * peace by `from` only when `from` leads its own side: it speaks for its
 * side, so the target leaves the war against the whole side. Only the
 * target is checked here; the war, the proposer and the timers are
 * peaceOfferBlock's.
 */
export function peaceTargetBlock(
  w: SepPeaceWar,
  from: number,
  target: number,
  isPuppet: (id: number) => boolean,
): WwOrderBlock | null {
  const s = sepSideOf(w, from);
  if (s < 0) return "not_at_war";
  const st = s === 0 ? 1 : 0;
  if (target === from || !sepFights(stateOf(w, st, target))) {
    return "bad_target";
  }
  if (w.sides[st].leader === target) return null;
  if (isPuppet(target)) return "peace_puppet";
  if (w.sides[s].leader !== from) return "peace_not_leader";
  return null;
}

/**
 * Whether an offer of `from` to `to` in `w` is a side leader's separate
 * peace with an enemy member (D1): `whole` (sent by its side's leader) and
 * `to` is not the other side's leader. The target and its puppets then
 * leave the war; otherwise the offer is today's (the whole war, or the
 * proposer's own separate peace).
 */
export function targetLeaves(
  w: SepPeaceWar,
  from: number,
  to: number,
  whole: boolean,
): boolean {
  if (!whole) return false;
  const s = sepSideOf(w, from);
  if (s < 0) return false;
  const st = s === 0 ? 1 : 0;
  return w.sides[st].leader !== to && sepSideOf(w, to) === st;
}

/**
 * "Come home as my subject" (D1): `target` must be an enemy member in
 * exile that is no puppet and not the other side's leader (an exiled
 * leader is the last one standing there: a whole-war peace is the way),
 * and `from` its own side's leader. Null: it may be offered.
 */
export function homeTargetBlock(
  w: SepPeaceWar,
  from: number,
  target: number,
  isPuppet: (id: number) => boolean,
): WwOrderBlock | null {
  const s = sepSideOf(w, from);
  if (s < 0) return "not_at_war";
  const st = s === 0 ? 1 : 0;
  if (stateOf(w, st, target) !== "exiled") return "home_not_exile";
  if (w.sides[st].leader === target) return "bad_target";
  if (isPuppet(target)) return "peace_puppet";
  if (w.sides[s].leader !== from) return "peace_not_leader";
  return null;
}
