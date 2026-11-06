import {
  GW_GAUGE_MAX,
  GW_SIDES,
  GwGauge,
  GwNationState,
  GwPersonState,
  GwSeatState,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GreatWar } from "./GreatWar";

/** Small helpers every world system shares. Stateless. */

export const other = (side: GwSide): GwSide =>
  side === GW_SIDES[0] ? GW_SIDES[1] : GW_SIDES[0];

export const clampTo = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export function chapterOf(gw: GreatWar) {
  return gwChapters(gw.s.calendar)[gw.s.chapter];
}

/** War chapters are a month or two; a crisis week is too short for a battle. */
export function isLongChapter(gw: GreatWar): boolean {
  return chapterOf(gw).spanDays >= 28;
}

/** Whole months this chapter stands for, at least 1. */
export function monthsOf(gw: GreatWar): number {
  return Math.max(1, Math.floor(chapterOf(gw).spanDays / 30));
}

/** Whether a month count of the war, every `k` months, falls in this chapter. */
export function everyMonths(gw: GreatWar, k: number, offset = 0): boolean {
  const s = gw.s;
  if (s.warChapter === null) return false;
  const chapters = gwChapters(s.calendar);
  const end = chapters[s.chapter].day - chapters[s.warChapter].day;
  const start = end - chapters[s.chapter].spanDays;
  const beats = (days: number) => Math.floor((days / 30 - offset) / k);
  return end > 0 && beats(end) > beats(start);
}

/** The last of a list, or undefined. */
export function lastOf<T>(list: readonly T[]): T | undefined {
  return list[list.length - 1];
}

export function seatsOf(gw: GreatWar, tag: GwTag): GwSeatState[] {
  return gw.s.seats.filter((x) => x.tag === tag);
}

/** A person holds this country: a regent's seat is the AI's to run. */
export function ruledBySeat(gw: GreatWar, tag: GwTag): boolean {
  return gw.s.seats.some((x) => x.tag === tag && !x.regent);
}

export function fights(n: GwNationState | null): boolean {
  return n !== null && n.side !== null && !n.out;
}

/** A person's country people, those still in play. */
export function ownPeople(gw: GreatWar, tag: GwTag): GwPersonState[] {
  const ids = new Set(
    gwContent()
      .people.filter((d) => d.tag === tag)
      .map((d) => d.id),
  );
  return gw.s.people.filter((p) => ids.has(p.id) && p.status === "active");
}

export function defOf(id: string) {
  return gwContent().people.find((d) => d.id === id) ?? null;
}

export function news(
  gw: GreatWar,
  key: string,
  a: GwTag | null = null,
  b: GwTag | null = null,
  theatre: GwTheatre | null = null,
): void {
  gw.s.news.push({ key, chapter: gw.s.chapter, a, b, theatre });
}

/** A reason line on the seat's log, once a chapter. */
export function reason(gw: GreatWar, seat: GwSeatState, key: string): void {
  const c = gw.s.chapter;
  if (seat.log.some((l) => l.key === key && l.chapter === c)) return;
  seat.log.push({ key, chapter: c });
}

/** A turning point of the game: every seat keeps it, the memoir reads it. */
export function turn(gw: GreatWar, key: string): void {
  for (const seat of gw.s.seats) {
    seat.memory.push({ key, who: null, chapter: gw.s.chapter, weight: 0 });
  }
}

/** Moves a gauge and writes why on the country's seats. */
export function moveGauge(
  gw: GreatWar,
  tag: GwTag,
  gauge: GwGauge,
  delta: number,
  key: string,
): void {
  const n = gw.nation(tag);
  if (n === null || delta === 0) return;
  const was = n.gauges[gauge];
  n.gauges[gauge] = clampTo(was + delta, 0, GW_GAUGE_MAX[gauge]);
  const moved = n.gauges[gauge] - was;
  if (moved === 0) return;
  for (const seat of seatsOf(gw, tag)) {
    seat.lines.push({ gauge, key, delta: moved, chapter: gw.s.chapter });
  }
}

/** Keeps a seat's reason lines to the last few chapters. */
export function trimLines(gw: GreatWar, seat: GwSeatState): void {
  const from = gw.s.chapter - 2;
  seat.lines = seat.lines.filter((l) => l.chapter >= from);
}
