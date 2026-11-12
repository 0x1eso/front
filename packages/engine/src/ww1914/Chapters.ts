import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { aftermathStep } from "./Aftermath";
import { aiStep } from "./Ai";
import { alliesStep } from "./Asks";
import { electionStep } from "./Assumes";
import { budgetStep } from "./Budget";
import { capitulationStep } from "./Capitulation";
import { craftStep } from "./Craft";
import { crisisStep, stampMobilisation } from "./Crises";
import { dealDesk } from "./Desk";
import { dossierStep } from "./Dossier";
import { closeGame, endingStep, finalEnding } from "./Endings";
import { frontsStep, warScore } from "./Fronts";
import { govStep } from "./Government";
import type { GreatWar } from "./GreatWar";
import { homeStep } from "./Home";
import { homeFrontStep } from "./HomeFront";
import { houseStep } from "./House";
import { intelStep } from "./Intel";
import { ladderStep } from "./Ladder";
import { frontLandStep } from "./Land";
import { lawStep } from "./Laws";
import { occupationStep } from "./Occupation";
import { warStep } from "./PairWar";
import { nextConferenceChapter, skipToConference } from "./Peace";
import { peaceYearsStep } from "./PeaceYears";
import { peopleStep } from "./People";
import { firstEdition, pressStep } from "./Press";
import { refusalsStep } from "./Refusals";
import { ruleStep } from "./Rule";
import { rulerAudiences, rulerStep } from "./Ruler";
import { closeUndecided } from "./SceneRun";
import { seaStep } from "./Sea";
import { closeSeats, regentStep, waitedFor } from "./Seats";
import { storyStep } from "./Story";
import { openSession, pairTableStep, tableStep } from "./Table";
import { GW_SUMMONS_LESS } from "./Tables";
import { telegramStep } from "./Telegrams";
import { termsStep } from "./Terms";
import { treatyStep } from "./Treaties";
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
  ladderStep,
  warStep,
  frontsStep,
  frontLandStep,
  capitulationStep,
  occupationStep,
  ruleStep,
  (gw) => seaStep(gw, warScore(gw, "central")),
  budgetStep,
  electionStep,
  lawStep,
  houseStep,
  dossierStep,
  alliesStep,
  homeStep,
  homeFrontStep,
  refusalsStep,
  craftStep,
  peopleStep,
  govStep,
  aiStep,
  peaceYearsStep,
  termsStep,
  intelStep,
  worldFlagsStep,
  rulerStep,
  pressStep,
  storyStep,
  tableStep,
  pairTableStep,
  aftermathStep,
  endingStep,
  treatyStep,
  regentStep,
  telegramStep,
];

export function allReady(gw: GreatWar): boolean {
  const seats = gw.s.seats.filter(waitedFor);
  return seats.length > 0 && seats.every((x) => x.ready);
}

/** What the ticker says when a chapter is one the cabinet will want to talk of. */
const BIG_NEWS =
  /^(entered_war|america_entered|britain_entered|nation_|sued_|regime_|front_break|front_collapse|unrest_[34]|war_pair|pair_peace$)/;
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

/** What the seat's flags take from a chapter's summons (GW_SUMMONS_LESS). */
function summonsLess(seat: GwSeatState): number {
  return seat.flags.reduce((n, f) => n + (GW_SUMMONS_LESS[f] ?? 0), 0);
}

/** Opens chapter `s.chapter`: its date, summons, deadline and desk. */
export function openChapter(gw: GreatWar, ticks: number): void {
  const s = gw.s;
  const ch = gwChapters(s.calendar)[s.chapter];
  s.day = s.closingDay ?? ch.day + s.dayShift;
  stampMobilisation(gw);
  s.deadlineTick = gw.deadlineFrom(ticks);
  s.slowAsked = [];
  s.slowGranted = 0;
  for (const seat of s.seats) {
    seat.ready = false;
    seat.wired = 0;
    seat.audiences = Math.max(
      0,
      rulerAudiences(
        gw,
        seat,
        ch.summons + (bigChapter(gw, seat) ? ch.bigSummons : 0),
      ) - summonsLess(seat),
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
