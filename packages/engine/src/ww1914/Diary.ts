// Great War 1914 (ww196 §0.6): a personal line at the chapter's end, in the
// ruler's own form (Nicholas's diary, Poincaré's notes, the Kaiser's
// marginalia, Asquith's letters, Franz Joseph's letters to Schratt). The one
// or two heaviest moments of the chapter that have a row, else the seat's
// filler. Shown atop the next desk and kept in 수첩 › 일기.
import type {
  GwDiaryEntry,
  GwMemoir,
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_DIARY_HINDSIGHT,
  GwDiaryMoment,
  GwDiaryRow,
  GwDiaryView,
} from "@openfront/engine-api/ww1914/GwPersona";
import { GW_READ_ONLY_KINDS } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  civilFromDays,
  daysFromCivil,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import {
  noteFindings,
  personaRowHolds,
  personaState,
  tellFindings,
  Told,
} from "./Persona";
import { sceneOf } from "./SceneRun";
import { GW_PASSING, GW_PASSING_BY_SCENE } from "./Tables";

const P_DIARY = idHash("gw_diary");

/** Lines a chapter writes at most. */
export const GW_DIARY_LINES = 2;
/** Recent lines whose rows aren't used again while another fits. */
const FRESH = 6;

/** How heavy each kind of front news is for the person (0: not a moment). */
const FRONT_WEIGHT: Readonly<Record<string, number>> = {
  front_collapse: 6,
  front_collapsed: 6,
  front_collapsed_ours: 6,
  front_collapsed_theirs: 5,
  front_lost: 5,
  front_break: 5,
  front_won: 4,
  front_advance: 4,
  front_repelled: 3,
};
const W_DEATH = 7;
const W_FAILING = 6;
const W_BIG = 6;
const W_FAMILY = 4;
const W_HEALTH = 4;
const W_HINDSIGHT = 3;
const W_PRIVATE = 3;
const W_AUDIENCE = 2;

export interface DiaryMoment {
  moment: GwDiaryMoment;
  weight: number;
  who: string | null;
  scene: string | null;
  theatre: GwTheatre | null;
  /** A hindsight line: what proved wrong. */
  told?: Told;
}

const moment = (
  m: GwDiaryMoment,
  weight: number,
  x: Partial<Pick<DiaryMoment, "who" | "scene" | "theatre" | "told">> = {},
): DiaryMoment => ({
  moment: m,
  weight,
  who: x.who ?? null,
  scene: x.scene ?? null,
  theatre: x.theatre ?? null,
  ...(x.told === undefined ? {} : { told: x.told }),
});

function dayOf(gw: GreatWar, chapter: number): number {
  const chapters = gwChapters(gw.s.calendar);
  const c = chapters[Math.max(0, Math.min(chapter, chapters.length - 1))];
  return c.day + gw.s.dayShift;
}

/** The person who speaks or wrote a scene, from its cast. */
function speakerOf(
  sceneId: string,
  cast: Readonly<Record<string, string>> | undefined,
): string | null {
  const s = sceneOf(sceneId);
  const role = s?.who ?? s?.author;
  return role === undefined ? null : (cast?.[role] ?? null);
}

/** What happened to the person in the chapter now closing, heaviest first. */
export function chapterMoments(
  gw: GreatWar,
  seat: GwSeatState,
  told: readonly Told[],
): DiaryMoment[] {
  const s = gw.s;
  const now = s.chapter;
  const out: DiaryMoment[] = [];
  // Deaths: the record's day fell in this chapter, or a card reported it.
  const from = now === 0 ? -Infinity : dayOf(gw, now - 1);
  for (const row of GW_PASSING) {
    const [y, m, d] = row.on.split("-").map(Number);
    const day = daysFromCivil(y, m, d);
    const p = gw.person(row.person);
    if (p === null || !row.person.startsWith(seat.tag.toLowerCase())) continue;
    if (day > from && day <= s.day)
      out.push(moment("death", W_DEATH, { who: row.person }));
  }
  for (const row of GW_PASSING_BY_SCENE) {
    if (seat.seen[row.scene] !== now) continue;
    out.push(moment("death", W_DEATH, { who: row.person, scene: row.scene }));
  }
  // The fronts the seat fights on.
  for (const n of s.news) {
    if (n.chapter !== now || n.theatre === null) continue;
    const w = FRONT_WEIGHT[n.key] ?? 0;
    if (w === 0) continue;
    const t = s.theatres.find((x) => x.id === n.theatre);
    const ours =
      n.a === seat.tag ||
      n.b === seat.tag ||
      t?.attacker === seat.tag ||
      t?.defender === seat.tag;
    if (ours) out.push(moment("front", w, { theatre: n.theatre }));
  }
  // His own decisions and audiences.
  for (const c of seat.choices) {
    if (c.chapter !== now || c.proxy) continue;
    const sc = sceneOf(c.scene);
    if (sc === null) continue;
    const who = speakerOf(c.scene, c.cast);
    // An audience is with someone; with nobody named it is a decision.
    if ((sc.kind === "audience" || sc.kind === "talk") && who !== null) {
      out.push(moment("audience", W_AUDIENCE, { who, scene: c.scene }));
    } else if (!GW_READ_ONLY_KINDS.includes(sc.kind)) {
      const w = sc.big === true ? W_BIG : Math.ceil(sc.salience / 2);
      out.push(moment("decision", w, { who, scene: c.scene }));
    }
  }
  // His card: family and health this chapter.
  const r = seat.ruler;
  if (r.failing === now) out.push(moment("health", W_FAILING));
  for (const l of r.lines) {
    if (l.chapter !== now || l.delta >= 0) continue;
    if (l.side === "family") out.push(moment("family", W_FAMILY));
    if (l.side === "health") out.push(moment("health", W_HEALTH));
  }
  for (const [id, ch] of Object.entries(seat.seen)) {
    if (ch !== now) continue;
    const sc = sceneOf(id);
    if (sc?.tags.includes("private") === true) {
      out.push(moment("family", W_PRIVATE, { scene: id }));
    }
  }
  for (const t of told) {
    out.push(moment("hindsight", W_HINDSIGHT, { who: t.by, told: t }));
  }
  // Heaviest first; a stable order among equals.
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.weight - a.m.weight || a.i - b.i)
    .map((x) => x.m);
}

function monthNow(gw: GreatWar): number {
  return civilFromDays(gw.s.day).month;
}

/** The rows that fit a moment now. */
function rowsFor(
  gw: GreatWar,
  seat: GwSeatState,
  m: DiaryMoment,
): GwDiaryRow[] {
  const month = monthNow(gw);
  const cast: Record<string, string> = m.who === null ? {} : { who: m.who };
  return (gwContent().persona?.diary ?? []).filter(
    (r) =>
      r.moment === m.moment &&
      (r.months === undefined || r.months.includes(month)) &&
      (r.theatre === undefined ||
        (m.theatre !== null && r.theatre.includes(m.theatre))) &&
      personaRowHolds(gw, seat, r, cast),
  );
}

/** One of the rows, the freshest first, by the seed. */
function pickRow(
  gw: GreatWar,
  seat: GwSeatState,
  rows: readonly GwDiaryRow[],
  m: DiaryMoment,
  taken: readonly string[],
): string | null {
  const recent = [
    ...(seat.persona?.diary ?? []).slice(-FRESH).map((e) => e.row),
    ...taken,
  ];
  const fresh = rows.filter((r) => !recent.includes(r.id));
  const pool =
    fresh.length > 0 ? fresh : rows.filter((r) => !taken.includes(r.id));
  if (pool.length === 0) return null;
  // A row for this very front or person comes before a general one.
  const sharp = pool.filter((r) => r.theatre !== undefined);
  const list = sharp.length > 0 ? sharp : pool;
  const roll = wwRoll(gw.s.seed, P_DIARY, gw.s.chapter, idHash(m.moment));
  return list[roll % list.length].id;
}

/** Writes the chapter's lines: its heaviest moments, else the filler. */
export function writeDiary(
  gw: GreatWar,
  seat: GwSeatState,
  moments: readonly DiaryMoment[],
): GwDiaryEntry[] {
  const lines: GwDiaryEntry[] = [];
  const kinds = new Set<GwDiaryMoment>();
  const entry = (m: DiaryMoment, row: string): GwDiaryEntry => ({
    chapter: gw.s.chapter,
    row,
    who: m.who,
    scene: m.scene,
    theatre: m.theatre,
    w: m.weight,
  });
  for (const m of moments) {
    if (lines.length >= GW_DIARY_LINES) break;
    if (kinds.has(m.moment)) continue;
    const taken = lines.map((l) => l.row);
    const row =
      pickRow(gw, seat, rowsFor(gw, seat, m), m, taken) ??
      (m.moment === "hindsight" ? GW_DIARY_HINDSIGHT : null);
    if (row === null) continue;
    kinds.add(m.moment);
    lines.push(entry(m, row));
  }
  if (lines.length === 0) {
    // The day's line is about the last paper he signed, if any.
    const last = seat.choices
      .filter(
        (c) =>
          c.chapter === gw.s.chapter &&
          !c.proxy &&
          !c.scene.startsWith("gw_paper_"),
      )
      .slice(-1)[0];
    const filler = moment("filler", 0, { scene: last?.scene });
    const row = pickRow(gw, seat, rowsFor(gw, seat, filler), filler, []);
    if (row !== null) lines.push(entry(filler, row));
  }
  if (lines.length > 0) personaState(seat).diary.push(...lines);
  return lines;
}

/**
 * Chapter step (after the card's own): the findings due are told, and the
 * person writes his line.
 */
export function personaStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null || gw.s.ended !== null) continue;
    if (seat.ruler.id === null) continue;
    noteFindings(gw, seat);
    const told = tellFindings(gw, seat);
    writeDiary(gw, seat, chapterMoments(gw, seat, told));
  }
}

/** The diary as the seat reads it, oldest first. */
export function diaryViews(gw: GreatWar, seat: GwSeatState): GwDiaryView[] {
  const st = seat.persona;
  if (st === undefined) return [];
  return st.diary.map((e) => {
    const h =
      e.who === null
        ? undefined
        : st.hindsight.find((x) => x.chapter === e.chapter && x.by === e.who);
    const hindsight =
      h === undefined || !isHindsightRow(e.row)
        ? undefined
        : { row: h.row, id: h.id };
    return {
      chapter: e.chapter,
      date: formatIsoDate(civilFromDays(dayOf(gw, e.chapter))),
      row: e.row,
      who: e.who,
      scene: e.scene,
      theatre: e.theatre,
      ...(hindsight === undefined ? {} : { hindsight }),
    };
  });
}

/** Lines a year the memoir keeps. */
export const GW_MEMOIR_DIARY_PER_YEAR = 3;

/**
 * ww197: the memoir's diary, a few lines a year: the heaviest moments of each
 * year (the earlier on a tie), then in the order they were written.
 */
export function memoirDiary(
  gw: GreatWar,
  seat: GwSeatState,
): NonNullable<GwMemoir["diary"]> {
  const entries = seat.persona?.diary ?? [];
  const views = diaryViews(gw, seat);
  const years = new Map<string, number[]>();
  views.forEach((v, i) => {
    const y = v.date.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), i]);
  });
  const kept: number[] = [];
  for (const idx of years.values()) {
    const heavy = [...idx].sort(
      (a, b) => (entries[b].w ?? 0) - (entries[a].w ?? 0) || a - b,
    );
    kept.push(...heavy.slice(0, GW_MEMOIR_DIARY_PER_YEAR));
  }
  return kept
    .sort((a, b) => a - b)
    .map((i) => {
      const v = views[i];
      return {
        chapter: v.chapter,
        date: v.date,
        row: v.row,
        who: v.who,
        scene: v.scene,
        theatre: entries[i].theatre,
      };
    });
}

function isHindsightRow(id: string): boolean {
  if (id === GW_DIARY_HINDSIGHT) return true;
  const r = (gwContent().persona?.diary ?? []).find((x) => x.id === id);
  return r?.moment === "hindsight";
}
