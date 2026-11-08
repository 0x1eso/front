import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { aiStep } from "./Ai";
import { budgetStep } from "./Budget";
import { craftStep } from "./Craft";
import { crisisStep, stampMobilisation } from "./Crises";
import { dealDesk } from "./Desk";
import { closeGame, endingStep, finalEnding } from "./Endings";
import { frontsStep, warScore } from "./Fronts";
import { govStep } from "./Government";
import type { GreatWar } from "./GreatWar";
import { homeStep } from "./Home";
import { houseStep } from "./House";
import { dossierStep } from "./Dossier";
import { alliesStep } from "./Asks";
import { intelStep } from "./Intel";
import { frontLandStep } from "./Land";
import { lawStep } from "./Laws";
import { nextConferenceChapter, skipToConference } from "./Peace";
import { peopleStep } from "./People";
import { firstEdition, pressStep } from "./Press";
import { rulerAudiences, rulerStep } from "./Ruler";
import { closeUndecided } from "./SceneRun";
import { seaStep } from "./Sea";
import { storyStep } from "./Story";
import { openSession, tableStep } from "./Table";
import { termsStep } from "./Terms";
import { trimLines } from "./World";
import { worldFlagsStep } from "./WorldFlags";

/**
 * What runs when a chapter closes, in this order, after open cards took
 * their fallback and before the next chapter's date. The war, the home front
 * and the AI each add their step here (append; the order is the simulation).
 */
export const GW_CHAPTER_STEPS: readonly ((gw: GreatWar) => void)[] = [
  stampMobilisation,
  crisisStep,
  frontsStep,
  frontLandStep,
  (gw) => seaStep(gw, warScore(gw, "central")),
  budgetStep,
  lawStep,
  houseStep,
  dossierStep,
  alliesStep,
  homeStep,
  craftStep,
  peopleStep,
  govStep,
  aiStep,
  termsStep,
  intelStep,
  worldFlagsStep,
  rulerStep,
  pressStep,
  storyStep,
  tableStep,
  endingStep,
];

/** Seats that count for "everyone is ready": a dropped friend doesn't. */
function waitedFor(gw: GreatWar, seat: GwSeatState): boolean {
  if (seat.memoir !== null) return false;
  const p = gw.mg.playerBySmallID(seat.smallID);
  return !(p.isPlayer() && p.isDisconnected());
}

export function allReady(gw: GreatWar): boolean {
  const seats = gw.s.seats.filter((x) => waitedFor(gw, x));
  return seats.length > 0 && seats.every((x) => x.ready);
}

/** What the ticker says when a chapter is one the cabinet will want to talk of. */
const BIG_NEWS =
  /^(entered_war|america_entered|britain_entered|nation_|sued_|regime_|front_break|unrest_[34])/;
/** Chapters between two big ones, so a bad autumn isn't all talk. */
const BIG_EVERY = 6;

/** A big chapter: the world turned last chapter and the last big one is past. */
function bigChapter(gw: GreatWar, seat: GwSeatState): boolean {
  const s = gw.s;
  if (s.chapter - seat.big < BIG_EVERY) return false;
  const turned = s.news.some(
    (x) => x.chapter === s.chapter - 1 && BIG_NEWS.test(x.key),
  );
  if (turned) seat.big = s.chapter;
  return turned;
}

/** Opens chapter `s.chapter`: its date, summons, deadline and desk. */
export function openChapter(gw: GreatWar, ticks: number): void {
  const s = gw.s;
  const ch = gwChapters(s.calendar)[s.chapter];
  s.day = s.closingDay ?? ch.day + s.dayShift;
  stampMobilisation(gw);
  s.deadlineTick = gw.deadlineFrom(ticks);
  for (const seat of s.seats) {
    seat.ready = false;
    seat.audiences = rulerAudiences(
      gw,
      seat,
      ch.summons + (bigChapter(gw, seat) ? ch.bigSummons : 0),
    );
    seat.privates = ch.privates;
    seat.acts = ch.acts;
    firstEdition(gw, seat);
    dealDesk(gw, seat);
  }
  openSession(gw, ticks);
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
  for (const seat of s.seats) trimLines(gw, seat);
  for (const step of GW_CHAPTER_STEPS) {
    step(gw);
    if (s.ended !== null) break;
  }
  gw.touch();
  if (s.ended === null && s.conferenceLeft > 0) {
    nextConferenceChapter(gw);
    openChapter(gw, ticks);
    return;
  }
  if (s.ended === null && s.chapter + 1 >= gwChapters(s.calendar).length) {
    s.ended = finalEnding(gw);
  }
  if (s.ended !== null) {
    closeGame(gw);
    return;
  }
  skipToConference(gw);
  s.chapter++;
  openChapter(gw, ticks);
}
