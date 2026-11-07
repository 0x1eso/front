// Great War 1914 (국가 목표): the seat says what this war or reign is for, in
// place of being handed three tasks. Later scenes read it (`aim`, `aim_met`),
// the memoir judges it, and giving it up costs the seat at home.
import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAim } from "@openfront/engine-api/ww1914/GwActs";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwAimsView } from "@openfront/engine-api/ww1914/GwView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GreatWar } from "./GreatWar";
import { moveRuler } from "./Ruler";
import { holds, runEffects, SceneCtx } from "./SceneRun";
import { clampTo, reason } from "./World";

/** What the price of a changed aim takes, each time more. */
const CHANGE_AUTHORITY = 10;
const CHANGE_AUTHORITY_MORE = 5;
const CHANGE_REPUTATION = -1;

const plain = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

function aimsOf(seat: GwSeatState): readonly GwAim[] {
  return (gwContent().aims ?? []).filter((a) => a.nation.includes(seat.tag));
}

/** Whether this country chooses its aim: one with none keeps its three tasks. */
export function hasAims(seat: GwSeatState): boolean {
  return aimsOf(seat).length > 0;
}

/** The chapter from which the seat's silence is its answer: the war's first. */
function silenceChapter(gw: GreatWar): number {
  const list = gwChapters(gw.s.calendar);
  const at = list.findIndex((c) => c.stage !== "crisis");
  return at < 0 ? list.length - 1 : at;
}

/** The three tasks follow the aim; those it doesn't name stay as drawn. */
function setTasks(seat: GwSeatState, a: GwAim): void {
  const kept = seat.mandates.slice(a.tasks.length);
  seat.mandates = [...a.tasks, ...kept].slice(0, seat.mandates.length);
}

function payForChange(gw: GreatWar, seat: GwSeatState, old: GwAim | null) {
  const n = gw.nation(seat.tag);
  const times = seat.aimsDropped.length;
  if (n !== null) {
    const price = CHANGE_AUTHORITY + times * CHANGE_AUTHORITY_MORE;
    n.authority = clampTo(n.authority - price, 0, 100);
  }
  // With no ruler card to move, the line still has to be said.
  moveRuler(gw, seat, "reputation", CHANGE_REPUTATION, "aim_changed");
  reason(gw, seat, "aim_changed");
  runEffects(plain(gw, seat), old?.dropped ?? []);
}

/** Applies the `aim` order; null when it took effect. */
export function declareAim(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwOrderBlock | null {
  const a = aimsOf(seat).find((x) => x.id === id);
  if (a === undefined || seat.aim === id) return "no_aim";
  const ctx = plain(gw, seat);
  if (a.when !== undefined && !holds(ctx, a.when)) return "no_aim";
  const old = aimsOf(seat).find((x) => x.id === seat.aim) ?? null;
  // The cabinet's three tasks stood in for the seat's word: that is a change too.
  const late = seat.aim === null && gw.s.chapter > silenceChapter(gw);
  if (old !== null || late) {
    payForChange(gw, seat, old);
  }
  if (seat.aim !== null) {
    seat.aimsDropped.push({ id: seat.aim, chapter: gw.s.chapter });
  }
  seat.aim = a.id;
  setTasks(seat, a);
  runEffects(ctx, a.effects ?? []);
  return null;
}

/** The screen's list: what can be declared now, what stands. */
export function aimsView(gw: GreatWar, seat: GwSeatState): GwAimsView | null {
  if (!hasAims(seat)) return null;
  const ctx = plain(gw, seat);
  return {
    aim: seat.aim,
    open: aimsOf(seat)
      .filter((a) => a.when === undefined || holds(ctx, a.when))
      .map((a) => a.id),
    /** Declaring now has a price. */
    priced: seat.aim !== null || gw.s.chapter > silenceChapter(gw),
    dropped: seat.aimsDropped.map((x) => x.id),
  };
}

/** Whether the three drawn tasks show: once the seat has spoken, or stayed silent. */
export function tasksShown(gw: GreatWar, seat: GwSeatState): boolean {
  if (!hasAims(seat) || seat.aim !== null) return true;
  return gw.s.chapter >= silenceChapter(gw);
}

/** The memoir's record. */
export function aimRecord(gw: GreatWar, seat: GwSeatState) {
  const a = aimsOf(seat).find((x) => x.id === seat.aim);
  if (a === undefined) return null;
  return {
    id: a.id,
    met: holds(plain(gw, seat), a.met),
    dropped: seat.aimsDropped.map((x) => x.id),
  };
}
