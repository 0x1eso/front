// ww219 (design ww218 §3): each seat country's war plan. The main front is
// where its trains run on the first day; the 작전 course "계획을 다시 짠다"
// prepares an alternative over some months, and while it runs the plan is
// empty. War in those months spoils the opening; once it is done the war's
// first paper offers both prepared plans, and going the other way beats the
// enemy's spies, who read the main one.
import type {
  GwSeatState,
  GwSide,
  GwTheatre,
  GwWarPlan,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_FRONT_UP } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwWarPlanView } from "@openfront/engine-api/ww1914/GwWorldView";
import type { GwWarPlanMoment } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_PLAN_FRONTS,
  planRoads,
} from "@openfront/engine-lib/ww1914/content/scenes/common";
import {
  civilFromDays,
  daysFromCivil,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { officeHolder } from "./People";
import { GW_AI_MAIN } from "./Tables";
import {
  frontsApart,
  germanPlan,
  memberEnd,
  membersOf,
  naturalSide,
} from "./Wars";
import {
  clampTo,
  fights,
  isLongChapter,
  other,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

/** Months a redraw takes, by country: Germany's timetables take longest. */
const REDRAW_MONTHS: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 6,
  RUS: 5,
  AUH: 4,
  FRA: 4,
  GBR: 3,
};

/** Chapters of the opening, when plans run on what was drawn up in peace. */
export const PLAN_OPENING_CHAPTERS = 3;
/** Percent: the prepared front's opening, an empty plan's, a wrong railway's. */
export const PLAN_READY = 25;
export const PLAN_EMPTY = -15;
export const PLAN_UNPLANNED = -10;
/** The follow-up paper where the ruler names the redraw's front. */
const redrawScene = (tag: GwTag) => `gw_plan_redraw_${tag.toLowerCase()}`;
/** The fronts where moving first counts (as Crises.stopWaiting). */
const FIRST_MOVER_FRONTS: readonly GwTheatre[] = ["west", "east"];

/** A seat country: one with a war plan. */
export function hasPlan(tag: GwTag): boolean {
  return GW_PLAN_FRONTS[tag] !== undefined;
}

function stateOf(gw: GreatWar, tag: GwTag): GwWarPlan | null {
  return gw.nation(tag)?.warPlan ?? null;
}

/** The stored plan, made on first write. */
function planState(gw: GreatWar, tag: GwTag): GwWarPlan | null {
  const n = gw.nation(tag);
  if (n === null || !hasPlan(tag)) return null;
  n.warPlan ??= {
    alt: null,
    redraw: null,
    picked: null,
    empty: false,
    done: null,
    met: null,
  };
  return n.warPlan;
}

/**
 * The front the plan goes for first. Germany's is its signed plan (the one in
 * the safe while none is signed); a Germany that waited has none.
 */
export function mainOf(gw: GreatWar, tag: GwTag): GwTheatre | null {
  const list = GW_PLAN_FRONTS[tag];
  if (list === undefined) return null;
  if (tag === "DEU") {
    const p = gw.s.plan ?? (ruledBySeat(gw, "DEU") ? "west" : germanPlan(gw));
    return p === "west" || p === "east" ? p : null;
  }
  return campMain(gw, tag) ?? list[0];
}

/**
 * ww220: the first of the country's fronts (Tables.GW_AI_MAIN) where it
 * would meet the other camp as the camps stand today; null if none.
 */
function campMain(gw: GreatWar, tag: GwTag): GwTheatre | null {
  const camp = naturalSide(gw, tag);
  if (camp === null) return null;
  const facing = (t: GwTheatre) =>
    gw.s.nations.some(
      (n) =>
        !n.out &&
        naturalSide(gw, n.tag) === other(camp) &&
        frontsApart(gw, tag, n.tag).includes(t),
    );
  return (GW_AI_MAIN[tag] ?? []).find(facing) ?? null;
}

/** The alternatives a redraw could prepare now. */
export function altsOf(gw: GreatWar, tag: GwTag): GwTheatre[] {
  const main = mainOf(gw, tag);
  return planRoads(tag).filter((t) => t !== main);
}

/** The prepared alternative, if one is ready and differs from the main. */
export function altOf(gw: GreatWar, tag: GwTag): GwTheatre | null {
  const alt = stateOf(gw, tag)?.alt ?? null;
  return alt !== null && alt !== mainOf(gw, tag) ? alt : null;
}

/** A redraw is under way: the plan is empty. */
export function redrawing(gw: GreatWar, tag: GwTag): boolean {
  return (stateOf(gw, tag)?.redraw ?? null) !== null;
}

/** The chapter the country's opening began, or null outside the war. */
function openingFrom(gw: GreatWar, tag: GwTag): number | null {
  const s = gw.s;
  const n = gw.nation(tag);
  if (s.warChapter === null || n === null || !fights(n)) return null;
  return Math.max(s.warChapter, n.entered ?? s.warChapter);
}

/** The country is in the first chapters of its war. */
export function inOpening(gw: GreatWar, tag: GwTag): boolean {
  const from = openingFrom(gw, tag);
  return from !== null && gw.s.chapter <= from + PLAN_OPENING_CHAPTERS;
}

/**
 * Which prepared plan the war runs on: the one picked, else, before the first
 * paper is kept, the one its main effort follows now.
 */
function pickOf(gw: GreatWar, tag: GwTag): "main" | "alt" {
  const wp = stateOf(gw, tag);
  if (wp !== null && wp.picked !== null) return wp.picked;
  const alt = altOf(gw, tag);
  if (alt === null) return "main";
  return allocOf(gw, tag)?.main === alt ? "alt" : "main";
}

/**
 * Where the war plan sends the main force: in peace the main front (null while
 * a redraw leaves it empty); at war the prepared front it runs on (null when
 * the war found it empty).
 */
export function planFront(gw: GreatWar, tag: GwTag): GwTheatre | null {
  if (!hasPlan(tag)) return null;
  const wp = stateOf(gw, tag);
  if (openingFrom(gw, tag) === null) {
    return (wp?.redraw ?? null) !== null ? null : mainOf(gw, tag);
  }
  if (wp?.empty === true) return null;
  return pickOf(gw, tag) === "alt" ? altOf(gw, tag) : mainOf(gw, tag);
}

/** One country's opening on `t`, percent: what its plan was ready for. */
export function planOn(gw: GreatWar, tag: GwTag, t: GwTheatre): number {
  if (!hasPlan(tag) || !inOpening(gw, tag)) return 0;
  if (stateOf(gw, tag)?.empty === true) return PLAN_EMPTY;
  const front = planFront(gw, tag);
  if (front === null) return 0;
  if (t === front) return PLAN_READY;
  // A redrawn plan, and the main effort on a front neither road prepared:
  // men on the wrong railway lines.
  const alt = altOf(gw, tag);
  if (
    alt !== null &&
    t !== alt &&
    t !== mainOf(gw, tag) &&
    allocOf(gw, tag)?.main === t
  ) {
    return PLAN_UNPLANNED;
  }
  return 0;
}

/** A side's opening on `t`: its members' plans, the best and worst bounded. */
export function sidePlan(gw: GreatWar, t: GwTheatre, by: GwSide): number {
  const sum = membersOf(gw, t, by).reduce(
    (a, tag) => a + planOn(gw, tag, t),
    0,
  );
  return clampTo(sum, PLAN_EMPTY, PLAN_READY);
}

/**
 * The war went the other way: `tag` signed its prepared alternative while its
 * main plan, the one spies read in peace, named `t`.
 */
export function wentOtherWay(gw: GreatWar, tag: GwTag, t: GwTheatre): boolean {
  return (
    hasPlan(tag) &&
    stateOf(gw, tag)?.empty !== true &&
    pickOf(gw, tag) === "alt" &&
    mainOf(gw, tag) === t
  );
}

/** The war found the plan empty: the chief's first paper is to hold. */
export function holdOnly(gw: GreatWar, tag: GwTag): boolean {
  const from = openingFrom(gw, tag);
  return (
    from !== null &&
    stateOf(gw, tag)?.empty === true &&
    gw.s.chapter <= from + 1
  );
}

/** The war's first paper offers both prepared plans, until one is kept. */
export function offersPlans(gw: GreatWar, tag: GwTag): boolean {
  const wp = stateOf(gw, tag);
  return (
    wp !== null &&
    !wp.empty &&
    wp.picked === null &&
    altOf(gw, tag) !== null &&
    mainOf(gw, tag) !== null &&
    inOpening(gw, tag)
  );
}

function addMonths(day: number, months: number): number {
  const d = civilFromDays(day);
  const m = d.month - 1 + months;
  const y = d.year + Math.floor(m / 12);
  return daysFromCivil(y, (m % 12) + 1, Math.min(d.day, 28));
}

/** Months a redraw takes for the seat: the chief of staff's hand counts. */
function redrawMonths(gw: GreatWar, seat: GwSeatState): number {
  const base = REDRAW_MONTHS[seat.tag] ?? 4;
  const cos = officeHolder(gw, seat, "chief_of_staff");
  const band = cos?.competence[0] ?? 2;
  return Math.max(1, base + (band >= 3 ? -1 : band <= 1 ? 1 : 0));
}

/**
 * The 작전 course "계획을 다시 짠다": the plan is empty from now; the ruler
 * names the front in the paper that follows. A redraw already running is
 * started again. Only in peace.
 */
export function beginRedraw(gw: GreatWar, seat: GwSeatState): void {
  if (openingFrom(gw, seat.tag) !== null) return;
  const wp = planState(gw, seat.tag);
  if (wp === null || altsOf(gw, seat.tag).length === 0) return;
  wp.redraw = {
    to: null,
    from: gw.s.chapter,
    until: addMonths(gw.s.day, redrawMonths(gw, seat)),
  };
  seat.scheduled.push({
    scene: redrawScene(seat.tag),
    chapter: gw.s.chapter + 1,
  });
}

/** The ruler names the front, or leaves it to the staff (null: the first). */
export function aimRedraw(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTheatre | null,
): void {
  const wp = stateOf(gw, seat.tag);
  if (wp === null || wp.redraw === null) return;
  const alts = altsOf(gw, seat.tag);
  wp.redraw.to = to !== null && alts.includes(to) ? to : (alts[0] ?? null);
}

/** "계획대로 둔다": a redraw under way is called off; the old plan stands. */
export function keepPlan(gw: GreatWar, seat: GwSeatState): void {
  const wp = stateOf(gw, seat.tag);
  if (wp === null || wp.redraw === null) return;
  wp.redraw = null;
  reason(gw, seat, "plan_kept");
}

/** The seat's staff could prepare `t` as the alternative now. */
export function altCan(gw: GreatWar, seat: GwSeatState, t: GwTheatre): boolean {
  return redrawing(gw, seat.tag) && altsOf(gw, seat.tag).includes(t);
}

/**
 * What the plan did this chapter, for the diary (WorldDsl `war_plan`). The
 * step that finishes a redraw and meets the war runs after the diary, so
 * those two count from the chapter before.
 */
export function planMoment(
  gw: GreatWar,
  tag: GwTag,
  m: GwWarPlanMoment,
): boolean {
  const wp = stateOf(gw, tag);
  if (wp === null) return false;
  const now = gw.s.chapter;
  switch (m) {
    case "begun":
      return wp.redraw !== null && wp.redraw.from === now;
    case "done":
      return wp.done === now - 1;
    case "empty":
      return wp.empty && wp.met === now - 1;
    case "hindsight":
      return (
        wp.empty &&
        wp.met !== null &&
        now === wp.met + PLAN_OPENING_CHAPTERS + 1
      );
  }
}

/** The plan moments of this chapter, heaviest first. */
export function planMoments(gw: GreatWar, tag: GwTag): GwWarPlanMoment[] {
  const all: GwWarPlanMoment[] = ["empty", "hindsight", "done", "begun"];
  return all.filter((m) => planMoment(gw, tag, m));
}

/** A redraw whose months are up: its front is the prepared alternative. */
function finish(gw: GreatWar, tag: GwTag, wp: GwWarPlan): void {
  const r = wp.redraw;
  if (r === null || gw.s.day < r.until) return;
  wp.alt = r.to ?? altsOf(gw, tag)[0] ?? null;
  wp.redraw = null;
  wp.done = gw.s.chapter;
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "plan_redrawn");
}

/**
 * The war found the plan: an empty one spoils the opening, its first-mover
 * fronts a step behind (as Crises.stopWaiting).
 */
function meetWar(gw: GreatWar, tag: GwTag): void {
  const wp = planState(gw, tag)!;
  wp.met = gw.s.chapter;
  if (wp.redraw === null) return;
  wp.redraw = null;
  wp.empty = true;
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "plan_empty_war");
  for (const t of gw.s.theatres) {
    if (!t.open || !FIRST_MOVER_FRONTS.includes(t.id)) continue;
    const side = memberEnd(gw, t.id, tag);
    if (side === null) continue;
    const back = GW_FRONT_UP[t.id] === side ? -1 : 1;
    t.progress = clampTo(t.progress + back, -2, 2);
  }
}

/** The first paper of the war is kept: the plan it runs on stays. */
function keepPick(gw: GreatWar, tag: GwTag, wp: GwWarPlan): void {
  if (wp.picked !== null || wp.empty || altOf(gw, tag) === null) return;
  const signed = seatsOf(gw, tag).some((x) => x.signed === gw.s.chapter);
  if (!signed && !isLongChapter(gw)) return;
  wp.picked = pickOf(gw, tag);
}

/** Chapter step, last: redraws run their months, and the war meets the plans. */
export function warPlanStep(gw: GreatWar): void {
  for (const tag of Object.keys(GW_PLAN_FRONTS) as GwTag[]) {
    const n = gw.nation(tag);
    if (n === null) continue;
    const wp = stateOf(gw, tag);
    if (wp !== null) finish(gw, tag, wp);
    const from = openingFrom(gw, tag);
    if (from === null) continue;
    if (wp === null || wp.met === null) {
      meetWar(gw, tag);
      continue;
    }
    if (gw.s.chapter > from) keepPick(gw, tag, wp);
  }
}

/** The 작전 tab's line on the plan; absent for a country with none. */
export function warPlanView(
  gw: GreatWar,
  tag: GwTag,
): GwWarPlanView | undefined {
  if (!hasPlan(tag)) return undefined;
  const wp = stateOf(gw, tag);
  const r = wp?.redraw ?? null;
  return {
    main: mainOf(gw, tag),
    alt: altOf(gw, tag),
    redraw:
      r === null
        ? null
        : { to: r.to, until: formatIsoDate(civilFromDays(r.until)) },
    empty: wp?.empty === true,
  };
}
