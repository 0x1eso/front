import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { aiStep } from "./Ai";
import { crisisStep } from "./Crises";
import { dealDesk } from "./Desk";
import { closeGame, endingStep, finalEnding } from "./Endings";
import { frontsStep } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { homeStep } from "./Home";
import { intelStep } from "./Intel";
import { peopleStep } from "./People";
import { closeUndecided } from "./SceneRun";
import { closeSeats, regentStep, waitedFor } from "./Seats";
import { telegramStep } from "./Telegrams";
import { treatyStep } from "./Treaties";
import { trimLines } from "./World";
import { worldFlagsStep } from "./WorldFlags";

/**
 * What runs when a chapter closes, in this order, after open cards took
 * their fallback and before the next chapter's date. The war, the home front
 * and the AI each add their step here (append; the order is the simulation).
 */
export const GW_CHAPTER_STEPS: readonly ((gw: GreatWar) => void)[] = [
  crisisStep,
  frontsStep,
  homeStep,
  peopleStep,
  aiStep,
  intelStep,
  worldFlagsStep,
  endingStep,
  treatyStep,
  regentStep,
  telegramStep,
];

export function allReady(gw: GreatWar): boolean {
  const seats = gw.s.seats.filter(waitedFor);
  return seats.length > 0 && seats.every((x) => x.ready);
}

/** Opens chapter `s.chapter`: its date, summons, deadline and desk. */
export function openChapter(gw: GreatWar, ticks: number): void {
  const s = gw.s;
  const ch = gwChapters(s.calendar)[s.chapter];
  s.day = ch.day + s.dayShift;
  s.deadlineTick = gw.deadlineFrom(ticks);
  s.slowAsked = [];
  s.slowGranted = 0;
  for (const seat of s.seats) {
    seat.ready = false;
    seat.wired = 0;
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
  // Nobody decided for a seat that isn't there: that is the proxy's stamp too.
  for (const seat of s.seats) {
    closeUndecided(gw, seat, late || !waitedFor(seat));
  }
  closeSeats(gw);
  for (const seat of s.seats) trimLines(gw, seat);
  for (const step of GW_CHAPTER_STEPS) {
    step(gw);
    if (s.ended !== null) break;
  }
  gw.touch();
  if (s.ended === null && s.chapter + 1 >= gwChapters(s.calendar).length) {
    s.ended = finalEnding(gw);
  }
  if (s.ended !== null) {
    closeGame(gw);
    return;
  }
  s.chapter++;
  openChapter(gw, ticks);
}
