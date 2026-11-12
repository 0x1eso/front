// ww190 §10-11: the chapters after the conference, and a seat that plays on
// after its own peace. The aftermath is GW_AFTER_CHAPTERS more months on the
// conference's count (Peace.skipToConference): the treaty is ratified or
// refused, the armies come home, the prisoners with them. A seat whose country
// made its own peace may stay at the desk, out of the war, until the world's
// armistice or the calendar's end.
import type {
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { closeSeat, outEnding } from "./Endings";
import type { GreatWar } from "./GreatWar";
import { returnPrisoners } from "./HomeFront";
import { beatenAt } from "./Occupation";
import { sceneOf } from "./SceneRun";
import {
  clampTo,
  GW_AFTER_CHAPTERS,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
  stageOf,
} from "./World";

export { GW_AFTER_CHAPTERS };

export type GwAfterCond = Extract<
  GwWorldCond,
  { is: "ratified" | "after_months" | "demob" | "left_war" }
>;
export type GwAfterEffect = Extract<
  GwWorldEffect,
  { do: "ratify" | "demob" | "play_on" }
>;

/** Seat flag: its country made its own peace and the seat plays on. */
export const GW_SEP_ON = "gw_sep_on";
/** Manpower back each aftermath month for a country demobilising by classes. */
const DEMOB_BY_CLASSES = 4;
/** Manpower back at once when every man goes home together. */
const DEMOB_AT_ONCE = 10;

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

const ratifyScene = (tag: GwTag) => `${tag.toLowerCase()}_aft_ratify`;
const sepScene = (tag: GwTag) => `${tag.toLowerCase()}_sep_on`;

/** Whole months since the table signed; null before (or with no conference). */
export function afterMonths(gw: GreatWar): number | null {
  const s = gw.s;
  const t = s.table;
  if (s.armistice === null || t === null || !t.closed) return null;
  if (t.pair !== undefined) return null;
  return GW_AFTER_CHAPTERS + 1 - Math.min(s.conferenceLeft, GW_AFTER_CHAPTERS);
}

/** The side that won the war, by the armistice; null for a compromise. */
function winners(gw: GreatWar): GwSide | null {
  const a = gw.s.armistice;
  if (a === null || a.kind === "compromise") return null;
  return a.kind === "central_lost" ? "entente" : "central";
}

/**
 * `tag` ratifies the treaty, or refuses: a refusal costs it two steps of
 * trust with every winner. Each country answers once.
 */
export function ratify(gw: GreatWar, tag: GwTag, yes: boolean): void {
  const s = gw.s;
  if (s.ratified?.includes(tag) || s.unratified?.includes(tag)) return;
  if (yes) (s.ratified ??= []).push(tag);
  else (s.unratified ??= []).push(tag);
  news(gw, yes ? "ratified" : "ratify_refused", tag);
  for (const seat of seatsOf(gw, tag)) {
    reason(gw, seat, yes ? "ratified" : "ratify_refused");
  }
  const won = winners(gw);
  if (yes || won === null) return;
  for (const n of s.nations) {
    if (n.tag === tag || n.side !== won) continue;
    n.trust[tag] = clampTo((n.trust[tag] ?? 0) - 2, -3, 3);
  }
}

/** 0 hold, 1 by classes, 2 all at once. */
export function demobOf(gw: GreatWar, tag: GwTag): number {
  return gw.s.demob?.[tag] ?? 0;
}

/**
 * Demobilisation goes to `level`, never back. All at once brings the men
 * home in a month: manpower now, money saved, and order shaken by it.
 */
export function setDemob(gw: GreatWar, tag: GwTag, level: number): void {
  const n = gw.nation(tag);
  const to = clampTo(level, 0, 2);
  if (n === null || to <= demobOf(gw, tag)) return;
  (gw.s.demob ??= {})[tag] = to;
  if (to < 2) return;
  n.manpower = clampTo(n.manpower + DEMOB_AT_ONCE, 0, 100);
  moveGauge(gw, tag, "money", 1, "demob_done");
  moveGauge(gw, tag, "order", -1, "demob_done");
  news(gw, "demob_done", tag);
}

/** The seat's country left by its own peace and the seat plays on. */
export function playingOn(seat: GwSeatState): boolean {
  return seat.memoir === null && seat.flags.includes(GW_SEP_ON);
}

/** The chapter `tag` left the war: knocked out or its own peace, else its last war's end. */
function leftChapter(gw: GreatWar, tag: GwTag): number {
  const out = beatenAt(gw, tag);
  if (out !== null) return out;
  let last = gw.s.chapter;
  for (const w of gw.s.wars) {
    if ((w.a === tag || w.b === tag) && w.ended !== null) last = w.ended;
  }
  return last;
}

/**
 * The seat's answer after its own peace: play on, out of the war, or close
 * with the memoir. A no closes it as the chapter ends (Endings.endingStep).
 */
export function playOn(gw: GreatWar, seat: GwSeatState, on: boolean): void {
  const n = gw.nation(seat.tag);
  if (!on || n === null || !n.out || playingOn(seat)) return;
  seat.flags.push(GW_SEP_ON);
  seat.leftAt = leftChapter(gw, seat.tag);
  news(gw, "left_war_on", seat.tag);
  reason(gw, seat, "left_war_on");
}

/**
 * Endings.endingStep asks before closing a seat whose country is out. A
 * country that left by its own peace, not beaten and not in revolution,
 * waits for its card (`<tag>_sep_on`), scheduled here once. A pack without
 * that card, a card dealt and not taken up, or a revolution: it closes.
 */
export function waitsToPlayOn(gw: GreatWar, seat: GwSeatState): boolean {
  if (playingOn(seat)) return true;
  const n = gw.nation(seat.tag);
  if (n === null || n.unrest >= 3) return false;
  if (outEnding(gw, seat) !== "separate_peace") return false;
  const scene = sepScene(seat.tag);
  if (sceneOf(scene) === null || seat.seen[scene] !== undefined) return false;
  if (seat.scheduled.some((q) => q.scene === scene)) return true;
  seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  return true;
}

/** Whole months between two chapters, by their dates. */
function monthsBetween(gw: GreatWar, from: number, to: number): number {
  const rows = gwChapters(gw.s.calendar);
  const at = (i: number) => rows[clampTo(i, 0, rows.length - 1)].day;
  return Math.floor((at(to) - at(from)) / 30);
}

export function afterHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwAfterCond,
): boolean {
  const s = gw.s;
  switch (c.is) {
    case "ratified": {
      const tag = c.tag ?? seat.tag;
      const list = c.no === true ? s.unratified : s.ratified;
      return list?.includes(tag) ?? false;
    }
    case "after_months": {
      const m = afterMonths(gw);
      return m !== null && inRange(m, c);
    }
    case "demob":
      return inRange(demobOf(gw, c.tag ?? seat.tag), c);
    case "left_war":
      if (!playingOn(seat) || seat.leftAt === undefined) return false;
      return inRange(monthsBetween(gw, seat.leftAt, s.chapter), c);
  }
}

export function afterDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: GwAfterEffect,
): void {
  switch (e.do) {
    case "ratify":
      ratify(gw, seat.tag, e.yes);
      return;
    case "demob":
      setDemob(gw, seat.tag, e.level);
      return;
    case "play_on":
      playOn(gw, seat, e.on);
      return;
  }
}

/** Countries that fought the great war: they sign, ratify and demobilise. */
function fought(gw: GreatWar): GwTag[] {
  return gw.s.nations
    .filter((n) => n.side !== null && n.entered !== null)
    .map((n) => n.tag);
}

/** A government nobody plays ratifies unless it lost and is hardline. */
function aiRatifies(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  const won = winners(gw);
  const lost = n !== null && won !== null && n.side !== won;
  return !(lost && n?.ai === "hardline");
}

/** The last session closes: each seat's ratification card for the first month after. */
function scheduleRatification(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of s.seats) {
    const side = gw.nation(seat.tag)?.side ?? null;
    if (seat.memoir !== null || side === null) continue;
    const scene = ratifyScene(seat.tag);
    if (sceneOf(scene) === null) continue;
    seat.scheduled.push({ scene, chapter: s.chapter });
  }
}

/** At the world's armistice a seat that played on after its own peace closes. */
function closePlayingOn(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const waiting = seat.scheduled.some((q) => q.scene === sepScene(seat.tag));
    if (!playingOn(seat) && !waiting) continue;
    closeSeat(gw, seat, "separate_peace");
  }
}

/**
 * Chapter step, after the tables. In the last session the ratification is
 * called; through the aftermath the countries answer it, the men come home
 * and the prisoners with them.
 */
export function aftermathStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice === null) return;
  closePlayingOn(gw);
  const left = s.conferenceLeft;
  if (left === GW_AFTER_CHAPTERS + 1) {
    scheduleRatification(gw);
    return;
  }
  if (stageOf(gw) !== "aftermath") return;
  const tags = fought(gw);
  const first = left === GW_AFTER_CHAPTERS;
  if (first) {
    returnPrisoners(gw);
    for (const tag of tags) {
      if (!ruledBySeat(gw, tag)) setDemob(gw, tag, 1);
      ratify(gw, tag, ruledBySeat(gw, tag) || aiRatifies(gw, tag));
    }
  } else if (left === GW_AFTER_CHAPTERS - 1) {
    for (const tag of tags) setDemob(gw, tag, 1);
  }
  for (const tag of tags) {
    const n = gw.nation(tag);
    if (n === null || demobOf(gw, tag) !== 1) continue;
    n.manpower = clampTo(n.manpower + DEMOB_BY_CLASSES, 0, 100);
    if (left === 1) news(gw, "demob_done", tag);
  }
}
