import type {
  GwReason,
  GwStage,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
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
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { moveMoney } from "./Budget";
import type { GreatWar } from "./GreatWar";
import { GW_SEAT_PERSON } from "./Tables";

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

/** Whole months from chapter `from` to this one, on the calendar's dates. */
export function monthsFrom(gw: GreatWar, from: number): number {
  const days = gwChapters(gw.s.calendar);
  const a = days[Math.max(0, Math.min(from, days.length - 1))].day;
  return Math.floor((days[gw.s.chapter].day - a) / 30);
}

/** The last of a list, or undefined. */
export function lastOf<T>(list: readonly T[]): T | undefined {
  return list[list.length - 1];
}

/** The stage the game is at: the table's, unless the peace is being made. */
export function stageOf(gw: GreatWar): GwStage {
  if (gw.s.conferenceLeft > 0) return "conference";
  return gwChapters(gw.s.calendar)[gw.s.chapter].stage;
}

/** Seats still at the desk: a closed one's country is the AI's. */
export function seatsOf(gw: GreatWar, tag: GwTag): GwSeatState[] {
  return gw.s.seats.filter((x) => x.tag === tag && x.memoir === null);
}

/** A person holds this country: a regent's seat is the AI's to run. */
export function ruledBySeat(gw: GreatWar, tag: GwTag): boolean {
  return gw.s.seats.some(
    (x) => x.tag === tag && x.memoir === null && !x.regent,
  );
}

/** In the war: a coalition's member still in it, or a country at war alone. */
export function fights(n: GwNationState | null): boolean {
  return n !== null && !n.out && (n.side !== null || n.atWar.length > 0);
}

/** The person who is the seat now: never on its own cast tab. */
export function seatPerson(seat: GwSeatState): string | null {
  const rows = GW_SEAT_PERSON[seat.tag] ?? [];
  const row = rows.find(
    (r) => r.flag === undefined || seat.flags.includes(r.flag),
  );
  return row?.person ?? null;
}

/** A person's country people, those still in play, the seat itself left out. */
export function ownPeople(gw: GreatWar, tag: GwTag): GwPersonState[] {
  const ids = new Set(
    gwContent()
      .people.filter((d) => d.tag === tag)
      .map((d) => d.id),
  );
  const seat = gw.s.seats.find((x) => x.tag === tag);
  const self = seat === undefined ? null : seatPerson(seat);
  return gw.s.people.filter(
    (p) => ids.has(p.id) && p.status === "active" && p.id !== self,
  );
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
  place?: GwPlace,
): void {
  gw.s.news.push(
    place === undefined
      ? { key, chapter: gw.s.chapter, a, b, theatre }
      : { key, chapter: gw.s.chapter, a, b, theatre, place },
  );
}

/** The power being used (Powers.takePower): lines written meanwhile name it. */
let cause: string | undefined;

/** Runs `fn` with every reason line it writes answering `power` (ww169). */
export function withCause<T>(power: string, fn: () => T): T {
  const was = cause;
  cause = power;
  try {
    return fn();
  } finally {
    cause = was;
  }
}

const caused = () => (cause === undefined ? {} : { power: cause });

/** A reason line on the seat's log, once a chapter (and cause). */
export function reason(
  gw: GreatWar,
  seat: GwSeatState,
  key: string,
  who?: string,
): void {
  const c = gw.s.chapter;
  const same = (l: GwReason) =>
    l.key === key &&
    l.chapter === c &&
    (l.who ?? undefined) === who &&
    l.power === cause;
  if (seat.log.some(same)) return;
  seat.log.push(
    who === undefined
      ? { key, chapter: c, ...caused() }
      : { key, chapter: c, who, ...caused() },
  );
}

/** A why-line about one person: the line names them with {who}. */
export function reasonOf(
  gw: GreatWar,
  seat: GwSeatState,
  key: string,
  who: string,
): void {
  const c = gw.s.chapter;
  if (
    seat.log.some(
      (l) =>
        l.key === key && l.chapter === c && l.who === who && l.power === cause,
    )
  ) {
    return;
  }
  seat.log.push({ key, chapter: c, who, ...caused() });
}

/** A turning point of the game: every seat keeps it, the memoir reads it. */
export function turn(gw: GreatWar, key: string): void {
  for (const seat of gw.s.seats) {
    seat.memory.push({ key, who: null, chapter: gw.s.chapter, weight: 0 });
  }
}

/** Moves a gauge and writes why on the country's seats. */
/** ww180: morale lines a censor's hush holds back (Propaganda.ts). */
const HUSHED: readonly string[] = [
  "casualty_lists",
  "front_collapsed",
  "morale_rumour",
];

export function moveGauge(
  gw: GreatWar,
  tag: GwTag,
  gauge: GwGauge,
  delta: number,
  key: string,
): void {
  const n = gw.nation(tag);
  if (n === null || delta === 0) return;
  if (gauge === "money") {
    moveMoney(gw, n, delta, key);
    return;
  }
  // ww180: the censor keeps this blow out of the papers (Propaganda.ts).
  if (delta < 0 && gauge === "morale" && HUSHED.includes(key)) {
    const p = n.prop;
    if (p !== undefined && p.hush >= gw.s.day) {
      p.hidden++;
      return;
    }
  }
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
