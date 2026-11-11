// ww177 P7a (Imjin design §10): how the Imjin War ends and how each side is
// judged. Each side has its own aims, so two can share a win:
// - Joseon wins back its land and keeps its king on the throne;
// - Japan holds Korean land, or gets Ming's recognition on its terms;
// - Ming expels Japan from Korea and keeps the tributary order, with its
//   silver spent under a limit.
// The game ends at the calendar's end, or earlier by state: Joseon's
// capitulation (the king gone and every province lost), Japan out of Korea
// for 180 days after it started the war (not counting a truce), or a
// signed treaty. Pure integer
// rules: the engine (imjin/Endings.ts) reads the state into ImjinEndFacts.
import type {
  ImjinEndCause,
  ImjinEnding,
} from "@openfront/engine-api/imjin/ImjinTypes";
import { SEAT_ABROAD } from "./CourtRules";

/**
 * Japan out of Korea this many days after starting the war ends the game.
 * ww177 final: 120 → 180 on P7b's 5 games (Japan was out by 1593 in 3 of
 * 5, and the war ended before its talks could).
 */
export const IMJIN_EXPELLED_DAYS = 180;
/** Japan holds Korean land: at least this per mille of Korea's land. */
export const JAPAN_HOLD_PM = 200;
/**
 * ww177 final: Japan's investiture counts as its aim only with real land
 * kept, at least this per mille of Korea's land (a coast of castles, not
 * an islet; it was any land at all). Under LAND_BACK_PM, so Joseon can
 * share that win.
 */
export const JAPAN_TREATY_HOLD_PM = 20;
/** Joseon has its land back: Japan holds at most this per mille of Korea's land. */
export const LAND_BACK_PM = 50;
/** Ming's silver in the field: thousands of taels a day at war… */
export const MING_SILVER_WAR_DAY = 2;
/** …and a thousand a day for each Ming division on Joseon's soil. */
export const MING_SILVER_DIVISION_DAY = 1;
/** Ming's aim holds only with its silver spent under this (thousands of taels). */
export const MING_SILVER_LIMIT = 10_000;

/** What the state says at the end (or on a day the end may come). */
export interface ImjinEndFacts {
  /** Japan has gone to war with Joseon at least once. */
  readonly warBegan: boolean;
  /** Japan and Joseon are at war now. */
  readonly atWar: boolean;
  /**
   * Per mille of Korea's land (Joseon's regions at the start, weighed by
   * their tiles) Japan controls. ww177 final: by land, not by region count,
   * where a pass or an islet weighed as much as a province.
   */
  readonly jpnHeldPm: number;
  /** Korean regions Joseon itself controls. */
  readonly josHeld: number;
  /** The Joseon court's seat (CourtRules.SEAT_*). */
  readonly seat: number;
  /** Joseon has capitulated (1936's endgame). */
  readonly josCapitulated: boolean;
  /** The investiture peace was signed (Japan took the title). */
  readonly peace: boolean;
  /** A truce stands now (not broken). */
  readonly truce: boolean;
  /** A truce broke once (the truth came out). */
  readonly truceBroken: boolean;
  /** Japan musters for a second war since the truce broke (not yet sailed). */
  readonly rearming?: boolean;
  /** Ming's regions (at the start) that Japan controls. */
  readonly liaodong: number;
  /** Ming's silver spent, thousands of taels. */
  readonly silver: number;
}

/** Ming's silver for a day: war days and its divisions on Joseon's soil. */
export function mingSilverDay(atWar: boolean, divisionsAbroad: number): number {
  return (
    (atWar ? MING_SILVER_WAR_DAY : 0) +
    MING_SILVER_DIVISION_DAY * Math.max(0, divisionsAbroad)
  );
}

/**
 * The days Japan has been out of Korea, counted on from yesterday's: they
 * run while it holds none of Korea, stand still while a truce stands (the
 * talks decide that end), and start again from naught when it holds land
 * again or musters for a second war after the truce broke (that war gets
 * its own days).
 */
export function outDaysNext(f: ImjinEndFacts, prev: number): number {
  if (!f.warBegan || f.jpnHeldPm > 0 || f.rearming === true) return 0;
  return f.truce ? prev : prev + 1;
}

/** Joseon is beaten: its king is gone and it holds no province. */
export function joseonCapitulates(f: ImjinEndFacts): boolean {
  return f.josHeld === 0 && (f.seat >= SEAT_ABROAD || f.josCapitulated);
}

/**
 * The cause the game ends on today, or null while it goes on. `outDays`:
 * the days Japan has been out of Korea since it started the war; `day` and
 * `endDay`: the calendar (endDay < 0: no calendar end).
 */
export function imjinEndCause(
  f: ImjinEndFacts,
  outDays: number,
  day: number,
  endDay: number,
): ImjinEndCause | null {
  if (f.peace) return "treaty";
  if (f.warBegan && joseonCapitulates(f)) return "capitulation";
  if (f.warBegan && outDays >= IMJIN_EXPELLED_DAYS) return "expelled";
  if (endDay >= 0 && day >= endDay) return "calendar";
  return null;
}

/** The ending card the state gives; the rarest come first. */
export function imjinEnding(
  f: ImjinEndFacts,
  cause: ImjinEndCause,
): ImjinEnding {
  if (f.liaodong > 0) return "japan_in_liaodong";
  // A signed peace names the end, wherever the court sits.
  if (cause === "treaty" || f.peace) return "investiture_peace";
  if (cause === "capitulation" || f.seat >= SEAT_ABROAD || f.josCapitulated) {
    return "court_in_exile";
  }
  // A war never begun is a peace that held.
  if (!f.warBegan) return "truce_held";
  if (f.jpnHeldPm === 0) return "expulsion";
  if (f.truceBroken && f.atWar) return "second_war";
  if (!f.atWar) return "truce_held";
  return "partition";
}

export interface ImjinGoals {
  readonly jos: boolean;
  readonly jpn: boolean;
  readonly min: boolean;
}

/** Each side judged by its own aims (two can share a win). */
export function imjinGoals(f: ImjinEndFacts): ImjinGoals {
  const landBack = f.jpnHeldPm <= LAND_BACK_PM;
  const kingHome = f.seat < SEAT_ABROAD && !f.josCapitulated;
  return {
    jos: landBack && kingHome,
    // Recognition on its terms: the title taken with Korean land kept.
    jpn:
      f.jpnHeldPm >= JAPAN_HOLD_PM ||
      (f.peace && f.jpnHeldPm >= JAPAN_TREATY_HOLD_PM),
    // The tributary order: Joseon stands as Ming's tributary and Ming's own
    // land is whole (an invested Japan is one more tributary).
    min:
      landBack &&
      !f.josCapitulated &&
      f.liaodong === 0 &&
      f.silver <= MING_SILVER_LIMIT,
  };
}
