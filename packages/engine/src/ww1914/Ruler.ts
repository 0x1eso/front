// Great War 1914: the person at the desk. Four sides on a card: health, family,
// conscience, reputation. Age and the war wear them, scenes and signatures move
// them, each with a reason line. Each bottom comes with warnings first, the same
// way a resignation does: the doctors, or the friends, come and say so. Only
// what was ignored ends a game. Nothing here rolls a dice against the seat.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_RULER_MAX,
  GW_RULER_SIDES,
  GwRulerEnd,
  GwRulerSide,
  GwRulerState,
  GwRulerView,
} from "@openfront/engine-api/ww1914/GwRuler";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_RULER_EVENTS,
  GW_RULERS,
  GwRulerRow,
  headRow,
} from "@openfront/engine-lib/ww1914/RulerRows";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { closeSeat } from "./Endings";
import type { GreatWar } from "./GreatWar";
import { regimeRow, succeed, successionOf } from "./Regimes";
import { utopiaWaits } from "./Utopia";
import { chapterOf, clampTo, reason, turn } from "./World";

const P_START = idHash("gw_ruler_start");

/** Chapters after the first warning that the second comes. */
const WARNED_AGAIN = 2;
/** Chapters at the bottom, after two warnings, that end it. */
const LOST_AFTER = 4;
/** Months between what the country thinks of the war reaching the person. */
const OPINION_EVERY = 6;
/** Morale at which the person shares the credit, and the blame. */
const MORALE_PRAISED = 4;
const MORALE_BLAMED = 1;
/** Health at or under which the working day is shorter. */
const TIRED_AT = 1;
/** Family at or under which it takes time, where the row says so. */
const FAMILY_TAKES_AT = 1;
const LINES_KEPT = 6;
/** The lines the card shows. */
const LINES_SHOWN = 3;
/** The nudge a seed gives a side, either way. */
const NUDGE = 1;
const DAYS_IN_MONTH = 30;
/** One step above a bottom: the seat is told while it can still act. */
const NEAR_BOTTOM = 1;

/** Decision 1B: the head the seat chose to play on as; null none. */
export function playedHead(seat: GwSeatState): string | null {
  const u = seat.society?.utopia ?? null;
  return u !== null && u.choice === "play" ? u.head : null;
}

/**
 * The row that fits the seat now, or null where nobody has one. A seat that
 * plays a head (1B) has only his row: it fits the form his utopia brought
 * and the forms the row names; past them his game ends as anyone's does.
 */
export function rulerRow(gw: GreatWar, seat: GwSeatState): GwRulerRow | null {
  const n = gw.nation(seat.tag);
  const regime = n?.regime ?? "";
  const rows = GW_RULERS[seat.tag] ?? [];
  const sits = (r: GwRulerRow) =>
    r.regimes === undefined || r.regimes.includes(regime);
  const flagged = (r: GwRulerRow) =>
    r.flag === undefined || seat.flags.includes(r.flag);
  // ww208 1B: the player chose to play on as the utopia's head (lane P's
  // row, gated by S2's seat flag `gw_head_<id>`).
  const head = playedHead(seat);
  if (head !== null) {
    const brought = seat.society?.utopia?.regime ?? null;
    const row = rows.find(
      (r) => r.id === head && flagged(r) && (sits(r) || regime === brought),
    );
    return row ?? null;
  }
  // ww207: a form a utopia brought keeps the person, or has no place for him.
  const form = n === null ? null : regimeRow(n);
  if (form?.keeps === true) {
    const kept = rows.find((r) => r.id === seat.ruler.id);
    if (kept !== undefined) return kept;
  }
  if (form?.removes === true) return null;
  const row = rows.find(
    (r) => r.head !== true && sits(r) && flagged(r),
  );
  return row ?? null;
}

/** The seat's card, the row laid on it if the person has changed. */
function layRow(gw: GreatWar, seat: GwSeatState, row: GwRulerRow | null): void {
  const r = seat.ruler;
  if ((row?.id ?? null) === r.id) return;
  r.id = row?.id ?? null;
  r.broken = null;
  r.failing = null;
  r.shaken = null;
  r.seen = gw.s.chapter;
  r.counted = gw.nation(seat.tag)?.casualties ?? 0;
  r.lines = [];
  if (row === null) return;
  GW_RULER_SIDES.forEach((side, i) => {
    const roll =
      wwRoll(gw.s.seed, P_START, idHash(row.id), i) % (NUDGE * 2 + 1);
    r[side] = clampTo(row.start[side] + roll - NUDGE, 1, GW_RULER_MAX);
  });
}

/** The first card of a game. */
export function rollRuler(gw: GreatWar, seat: GwSeatState): void {
  layRow(gw, seat, rulerRow(gw, seat));
}

/** Where the card starts: what the years left, so no line and no bottom. */
export function startRuler(
  seat: GwSeatState,
  side: GwRulerSide,
  delta: number,
): void {
  const r = seat.ruler;
  if (r.id !== null) r[side] = clampTo(r[side] + delta, 1, GW_RULER_MAX);
}

/** Moves a side and says why. A conscience that gave out doesn't come back. */
export function moveRuler(
  gw: GreatWar,
  seat: GwSeatState,
  side: GwRulerSide,
  delta: number,
  key: string,
): void {
  const r = seat.ruler;
  if (r.id === null) return;
  if (side === "conscience" && r.broken !== null) return;
  const was = r[side];
  r[side] = clampTo(was + delta, 0, GW_RULER_MAX);
  if (side === "reputation" && delta > 0) r.seen = gw.s.chapter;
  const moved = r[side] - was;
  if (moved === 0) return;
  r.lines.push({ side, key, delta: moved, chapter: gw.s.chapter });
  r.lines = r.lines.slice(-LINES_KEPT);
  reason(gw, seat, key);
  if (r[side] === NEAR_BOTTOM && was > NEAR_BOTTOM) nearBottom(gw, seat, side);
}

/** A side that can end the game says so a step before the doctors or friends. */
function nearBottom(gw: GreatWar, seat: GwSeatState, side: GwRulerSide): void {
  const row = rulerRow(gw, seat);
  const fatal =
    (side === "health" && row?.mortal === true) ||
    (side === "reputation" && row?.removable === true && row.shaken !== null);
  if (fatal) reason(gw, seat, `ruler_thin_${side}`);
}

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

type RulerCond = Extract<
  GwCond,
  {
    kind:
      | "ruler"
      | "ruler_is"
      | "ruler_broken"
      | "ruler_failing"
      | "ruler_shaken";
  }
>;

export function rulerHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: RulerCond,
): boolean {
  const r = seat.ruler;
  if (r.id === null) return false;
  const since = (from: number | null, x: { min?: number; max?: number }) =>
    from !== null && inRange(gw.s.chapter - from, x);
  switch (c.kind) {
    case "ruler":
      return inRange(r[c.side], c);
    case "ruler_is":
      return c.of.includes(r.id);
    case "ruler_broken":
      return r.broken !== null;
    case "ruler_failing":
      return since(r.failing, c);
    case "ruler_shaken":
      return since(r.shaken, c);
  }
}

/** A chapter's summons, less what the card takes. Never down to none. */
export function rulerAudiences(
  gw: GreatWar,
  seat: GwSeatState,
  summons: number,
): number {
  const r = seat.ruler;
  const row = rulerRow(gw, seat);
  if (r.id === null || row === null) return summons;
  const tired = r.health <= TIRED_AT ? 1 : 0;
  const home = row.familyTakesTime && r.family <= FAMILY_TAKES_AT ? 1 : 0;
  return Math.max(Math.min(1, summons), summons - tired - home);
}

/** Whether a beat of `months` falls in the chapter now closing. */
function beatNow(gw: GreatWar, months: number): boolean {
  const s = gw.s;
  const first = gwChapters(s.calendar)[0].day;
  const beats = (day: number) =>
    Math.floor((day - first) / (DAYS_IN_MONTH * months));
  return beats(s.day + chapterOf(gw).spanDays) > beats(s.day);
}

function wear(gw: GreatWar, seat: GwSeatState, row: GwRulerRow): void {
  const r = seat.ruler;
  if (beatNow(gw, row.agesEvery)) {
    moveRuler(gw, seat, "health", -1, `${row.id}_age`);
  }
  const lost = gw.nation(seat.tag)?.casualties ?? 0;
  const steps = (n: number) => Math.floor(n / row.tollEvery);
  if (steps(lost) > steps(r.counted)) {
    moveRuler(gw, seat, "conscience", -1, `${row.id}_toll`);
  }
  r.counted = lost;
  const span = chapterOf(gw).spanDays;
  const unseen =
    row.seenEvery !== null &&
    (gw.s.chapter - r.seen) * span >= row.seenEvery * DAYS_IN_MONTH;
  if (unseen) {
    moveRuler(gw, seat, "reputation", -1, `${row.id}_unseen`);
    r.seen = gw.s.chapter;
  }
  if (!beatNow(gw, OPINION_EVERY)) return;
  const morale = gw.nation(seat.tag)?.gauges.morale ?? 0;
  if (morale >= MORALE_PRAISED) {
    moveRuler(gw, seat, "reputation", 1, `${row.id}_praised`);
  } else if (morale <= MORALE_BLAMED) {
    moveRuler(gw, seat, "reputation", -1, `${row.id}_blamed`);
  }
}

/** What a scene did by coming: it was dealt this chapter. */
function events(gw: GreatWar, seat: GwSeatState): void {
  for (const e of GW_RULER_EVENTS) {
    if (seat.seen[e.scene] === gw.s.chapter) {
      moveRuler(gw, seat, e.side, e.delta, e.key);
    }
  }
}

function call(gw: GreatWar, seat: GwSeatState, scene: string | null): void {
  if (scene === null) return;
  seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
}

/** The person is gone: the game is lost, the memoir comes. */
export function rulerGone(
  gw: GreatWar,
  seat: GwSeatState,
  how: GwRulerEnd,
): void {
  const s = gw.s;
  const row = rulerRow(gw, seat);
  const p = row?.person === undefined ? null : gw.person(row.person);
  if (p !== null) {
    p.status = how === "death" ? "dead" : "fallen";
    p.office = null;
  }
  const ending = row?.gone?.[how] ?? endingOf(seat.tag, how);
  turn(gw, `ruler_${how}`);
  if (s.seats.length > 1) closeSeat(gw, seat, ending);
  else s.ended = ending;
}

/**
 * ww197 (owner's A, "그 사람이 끝나면 내 판도 끝"): the country took a form the
 * person has no place in (a republic, the Provisional Government, a
 * federation). His game ends there, with the ending his row names for it; in
 * a game of several seats the others play on and this one watches.
 */
function personEnds(gw: GreatWar, seat: GwSeatState): void {
  const s = gw.s;
  const was = (GW_RULERS[seat.tag] ?? []).find((r) => r.id === seat.ruler.id);
  const regime = gw.nation(seat.tag)?.regime ?? "";
  const ending =
    was?.ends?.[regime] ?? was?.ends?.["*"] ?? endingOf(seat.tag, "removed");
  standDown(gw, was);
  if (s.seats.length > 1) closeSeat(gw, seat, ending);
  else s.ended = ending;
}

function endingOf(tag: GwTag, how: GwRulerEnd) {
  const id = `${tag.toLowerCase()}_r_${how}`;
  return id as Parameters<typeof closeSeat>[2];
}

/**
 * Moves a clock of warnings; true when the time has run out. It can't run out
 * on a seat that never read the warning: it comes again until it has been.
 */
function bottom(
  gw: GreatWar,
  seat: GwSeatState,
  at: number | null,
  scene: string | null,
): boolean {
  if (at === null || scene === null) return false;
  const n = gw.s.chapter - at;
  const warned = (seat.seen[scene] ?? -1) > at;
  if (n === WARNED_AGAIN || (n >= LOST_AFTER && !warned)) {
    call(gw, seat, scene);
  }
  return n >= LOST_AFTER && warned;
}

/** The three bottoms. Returns once the game has closed for this seat. */
function watch(gw: GreatWar, seat: GwSeatState, row: GwRulerRow): void {
  const r = seat.ruler;
  const s = gw.s;
  if (r.conscience <= 0 && r.broken === null) {
    r.broken = s.chapter;
    reason(gw, seat, `${row.id}_broken`);
    call(gw, seat, row.broken);
  }
  if (r.health > 0) {
    r.failing = null;
  } else if (r.failing === null) {
    r.failing = s.chapter;
    reason(gw, seat, `${row.id}_failing`);
    call(gw, seat, row.doctors);
  }
  if (r.reputation > 0) {
    r.shaken = null;
  } else if (r.shaken === null && row.shaken !== null) {
    r.shaken = s.chapter;
    reason(gw, seat, `${row.id}_shaken`);
    call(gw, seat, row.shaken);
  }
  const dying = bottom(gw, seat, r.failing, row.doctors);
  if (dying && row.mortal) {
    rulerGone(gw, seat, "death");
    return;
  }
  // Not mortal: his end is the written succession, and it comes only so
  // (ww169, owner's 2B: Franz Joseph dies by his health, never by a date).
  const heirs = dying ? successionOf(gw, seat.tag) : null;
  if (heirs !== null && succeed(gw, heirs)) {
    r.failing = null;
    return;
  }
  const out = bottom(gw, seat, r.shaken, row.shaken);
  if (out && row.removable) rulerGone(gw, seat, "removed");
}

/** The person in a row leaves the cast's offices: the chair has passed on. */
function standDown(gw: GreatWar, row: GwRulerRow | undefined): void {
  const p = row?.person === undefined ? null : gw.person(row.person);
  if (p !== null && p.status !== "dead") {
    p.status = "fallen";
    p.office = null;
  }
}

/**
 * Decision 1B, the utopia's card (Utopia.ts asks it, order utopia_choice).
 * True while the seat waits on it or has just closed at it: a word not yet
 * given holds the person's card as it is; "end" closes the seat with the
 * head's winning ending. "play" lays the head's card (rulerRow).
 */
function atUtopiaCard(gw: GreatWar, seat: GwSeatState): boolean {
  const u = seat.society?.utopia ?? null;
  const row = headRow(u?.head ?? null);
  if (u === null || row === null || seat.ruler.id === row.id) return false;
  if (u.choice === null) return true;
  if (u.choice !== "end") return false;
  standDown(
    gw,
    (GW_RULERS[seat.tag] ?? []).find((r) => r.id === seat.ruler.id),
  );
  const ending = row.won ?? endingOf(seat.tag, "removed");
  if (gw.s.seats.length > 1) closeSeat(gw, seat, ending);
  else gw.s.ended = ending;
  return true;
}

/** Whether the person in the row has left the game by some other door. */
function personGone(gw: GreatWar, row: GwRulerRow): GwRulerEnd | null {
  const p = row.person === undefined ? null : gw.person(row.person);
  if (p === null) return null;
  if (p.status === "dead") return "death";
  return p.status === "fallen" || p.status === "exiled" ? "removed" : null;
}

/** Chapter step: the card follows the seat, then age, the war and the bottoms. */
export function rulerStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null || gw.s.ended !== null) continue;
    if (atUtopiaCard(gw, seat)) continue;
    const row = rulerRow(gw, seat);
    if (row === null && seat.ruler.id !== null) {
      // ww207 (1B): the utopia's card asks first: end here, or play on.
      if (utopiaWaits(seat)) continue;
      personEnds(gw, seat);
      continue;
    }
    if (row?.head === true && seat.ruler.id !== row.id) {
      const was = GW_RULERS[seat.tag] ?? [];
      standDown(
        gw,
        was.find((r) => r.id === seat.ruler.id),
      );
    }
    layRow(gw, seat, row);
    if (row === null) continue;
    const gone = personGone(gw, row);
    if (gone !== null) {
      rulerGone(gw, seat, gone);
      continue;
    }
    events(gw, seat);
    wear(gw, seat, row);
    watch(gw, seat, row);
  }
}

const level = (v: number): number => (v <= 1 ? 0 : v <= 3 ? 1 : 2);

function ageOn(gw: GreatWar, born: string): number {
  const [y, m, d] = born.split("-").map(Number);
  const now = civilFromDays(gw.s.day);
  const had = now.month > m || (now.month === m && now.day >= d);
  return now.year - y - (had ? 0 : 1);
}

export function rulerView(gw: GreatWar, seat: GwSeatState): GwRulerView | null {
  const r: GwRulerState = seat.ruler;
  const row = rulerRow(gw, seat);
  if (r.id === null || row === null) return null;
  return {
    id: r.id,
    age: ageOn(gw, row.born),
    levels: GW_RULER_SIDES.map((x) => level(r[x])),
    broken: r.broken !== null,
    atRisk:
      row.mortal && r.failing !== null
        ? "health"
        : row.removable && r.shaken !== null
          ? "reputation"
          : null,
    lines: r.lines
      .slice(-LINES_SHOWN)
      .reverse()
      .map((l) => ({ side: l.side, key: l.key, delta: l.delta })),
  };
}
