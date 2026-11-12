// ww177 (Imjin design §2): the game's calendar on the client. The engine's
// day 0 is its profile's epoch (Profile.wwEpochDays); GameView sets it when
// a game starts, and every date the screens write reads it. The Imjin War's
// date line adds the lunar date and the reign year of the viewer's court.
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  ImjinCourt,
  lunarOf,
  reignYearOf,
} from "@openfront/engine-lib/imjin/Lunar";
import { dateOfDay, epochDaysOf } from "@openfront/engine-lib/ww1936/Calendar";
import {
  isImjin,
  WW1936_EPOCH_ISO,
  wwEpochDays,
} from "@openfront/engine-lib/ww1936/scenario/Profile";
import { translateText } from "../../Utils";

let epoch = epochDaysOf(WW1936_EPOCH_ISO);
let imjin = false;

/** The game's calendar: its epoch and whether the Imjin date line shows. */
export function useWwCalendar(
  gc: Pick<GameConfig, "ww1936Scenario" | "imjinCalendar">,
): void {
  epoch = wwEpochDays(gc);
  imjin = isImjin(gc);
}

/** Days since 1970 of the game's day 0. */
export function wwEpoch(): number {
  return epoch;
}

export function imjinCalendarOn(): boolean {
  return imjin;
}

let viewer: CountryTag | null = null;

/** ww194: the viewer's country, whose court names the screens read by default. */
export function setImjinViewer(tag: CountryTag | null): void {
  viewer = tag;
}

export function imjinViewer(): CountryTag | null {
  return viewer;
}

/** The court whose years a viewer reads: Japan's for Japan, else Joseon's. */
export function courtOf(tag: CountryTag | null): ImjinCourt {
  if (tag === "JPN") return "japan";
  if (tag === "MIN" || tag === "JUR") return "ming";
  return "joseon";
}

/** The Gregorian date of a game day, in words (`ww1936.date`). */
export function civilLabel(day: number): string {
  const d = dateOfDay(day, epoch);
  return translateText("ww1936.date", {
    year: d.year,
    month: translateText(`ww1936.month.m${d.month < 10 ? "0" : ""}${d.month}`),
    day: d.day,
  });
}

/**
 * The Imjin War's date line: the Gregorian date, the lunar date and the
 * reign year (`imjin.date.line`). Outside the lunar table, the date alone.
 */
export function imjinDateLabel(day: number, tag: CountryTag | null): string {
  const civil = civilLabel(day);
  const lunar = lunarOf(epoch + day);
  if (lunar === null) return civil;
  const reign = reignYearOf(courtOf(tag), lunar);
  const lunarText = translateText(
    lunar.leap ? "imjin.date.lunar_leap" : "imjin.date.lunar",
    { month: lunar.month, day: lunar.day },
  );
  if (reign === null) {
    return translateText("imjin.date.line_no_reign", {
      date: civil,
      lunar: lunarText,
    });
  }
  return translateText("imjin.date.line", {
    date: civil,
    lunar: lunarText,
    reign: translateText(`imjin.era.${reign.era}`, { year: reign.year }),
  });
}
