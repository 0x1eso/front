import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { dealDesk } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { closeUndecided } from "./SceneRun";

/**
 * What runs when a chapter closes, in this order, after open cards took
 * their fallback and before the next chapter's date. The war, the home front
 * and the AI each add their step here (append; the order is the simulation).
 */
export const GW_CHAPTER_STEPS: readonly ((gw: GreatWar) => void)[] = [];

/** Seats that count for "everyone is ready": a dropped friend doesn't. */
function waitedFor(gw: GreatWar, seat: GwSeatState): boolean {
  const p = gw.mg.playerBySmallID(seat.smallID);
  return !(p.isPlayer() && p.isDisconnected());
}

export function allReady(gw: GreatWar): boolean {
  const seats = gw.s.seats.filter((x) => waitedFor(gw, x));
  return seats.length > 0 && seats.every((x) => x.ready);
}

/** Opens chapter `s.chapter`: its date, summons, deadline and desk. */
export function openChapter(gw: GreatWar, ticks: number): void {
  const s = gw.s;
  const ch = gwChapters(s.calendar)[s.chapter];
  s.day = ch.day + s.dayShift;
  s.deadlineTick = gw.deadlineFrom(ticks);
  for (const seat of s.seats) {
    seat.ready = false;
    seat.audiences = ch.summons;
    dealDesk(gw, seat);
  }
  gw.touch();
}

/** `late`: the timer closed it, so undecided cards are stamped as proxied. */
export function advanceChapter(
  gw: GreatWar,
  ticks: number,
  late: boolean,
): void {
  const s = gw.s;
  for (const seat of s.seats) closeUndecided(gw, seat, late);
  for (const step of GW_CHAPTER_STEPS) step(gw);
  gw.touch();
  if (s.ended !== null) return;
  if (s.chapter + 1 >= gwChapters(s.calendar).length) {
    s.ended = "closing";
    s.deadlineTick = null;
    return;
  }
  s.chapter++;
  openChapter(gw, ticks);
}
