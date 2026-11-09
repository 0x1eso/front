import { GwGov, GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwGovView,
  GwPollView,
} from "@openfront/engine-api/ww1914/GwView";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_ELECTIONS, GW_GOV, GwGovRow } from "./GovTable";
import type { GreatWar } from "./GreatWar";
import { plotReset, plotRow, plotsStep } from "./Plots";
import { holds, SceneCtx, sceneOf } from "./SceneRun";
import { clampTo, isLongChapter, monthsOf, reason } from "./World";

/** A threat's row: the table's, or a plot's (S2, from the house content). */
const rowOf = (id: string): GwGovRow | null =>
  GW_GOV.find((r) => r.id === id) ?? plotRow(id);

const lastAt = (row: GwGovRow) => row.steps[row.steps.length - 1].at;

/** Months a threat lies quiet after its last scene cooled it. */
const GOV_BREATH = 4;
/** Chapters until the paper a deal promised. */
const SOON_CHAPTERS = 3;

const chaptersOf = (gw: GreatWar, months: number) =>
  Math.ceil(months / monthsOf(gw));

export function govEntry(seat: GwSeatState, id: string): GwGov {
  let e = seat.gov.find((x) => x.id === id);
  if (e === undefined) {
    e = { id, heat: 0, step: 0, rest: -1, beaten: 0 };
    seat.gov.push(e);
  }
  return e;
}

export function govHeat(seat: GwSeatState, id: string): number {
  return seat.gov.find((x) => x.id === id)?.heat ?? 0;
}

/** A scene moved the threat. It can't pass its last step's heat. */
export function govHeatBy(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  delta: number,
): void {
  const row = rowOf(id);
  if (row === null) return;
  const e = govEntry(seat, id);
  e.heat = clampTo(e.heat + delta, 0, lastAt(row));
  // Cooled below the last step, it can climb to that scene again, after a
  // breath: a crisis met isn't the same crisis next month.
  if (e.step === row.steps.length && e.heat < lastAt(row)) {
    e.step--;
    e.rest = Math.max(e.rest, gw.s.chapter + chaptersOf(gw, GOV_BREATH));
  }
  gw.touch();
}

/** Its row's paper comes in a few chapters, once, and isn't called again. */
export function govSoon(gw: GreatWar, seat: GwSeatState, id: string): void {
  const row = rowOf(id);
  // A plot's steps come by its heat and the fair warning, never sooner.
  if (row === null || row.steps.length < 2 || plotRow(id) !== null) return;
  const e = govEntry(seat, id);
  e.step = Math.max(e.step, 2);
  call(seat, row.steps[1].scene, gw.s.chapter + SOON_CHAPTERS);
}

/** Puts a scene on its way unless it is already waiting or on the desk. */
function call(seat: GwSeatState, scene: string, chapter: number): void {
  const waits =
    seat.scheduled.some((q) => q.scene === scene) ||
    seat.desk.some((c) => c.scene === scene);
  if (!waits) seat.scheduled.push({ scene, chapter });
}

/** Fought off: it starts again from nothing, after its rest. */
export function govBeaten(gw: GreatWar, seat: GwSeatState, id: string): void {
  const row = rowOf(id);
  if (row === null) return;
  const e = govEntry(seat, id);
  e.heat = 0;
  e.step = 0;
  e.beaten++;
  e.rest = gw.s.chapter + chaptersOf(gw, row.rest);
  plotReset(gw, seat, id);
  seat.memory.push({
    key: `gov_held_${id}`,
    who: null,
    chapter: gw.s.chapter,
    weight: 0,
  });
}

/** Whether this row can run for this seat now. */
export function govLive(ctx: SceneCtx, row: GwGovRow): boolean {
  const { gw, seat } = ctx;
  if (row.tag !== seat.tag) return false;
  if (row.unless !== undefined && seat.flags.includes(row.unless)) return false;
  if (!row.regimes.includes(gw.nation(seat.tag)?.regime ?? "")) return false;
  return holds(ctx, world({ is: "date", from: row.from }));
}

function rowStep(ctx: SceneCtx, row: GwGovRow): void {
  const { gw, seat } = ctx;
  const s = gw.s;
  const e = govEntry(seat, row.id);
  if (s.chapter < e.rest) return;
  const by = row.feeds
    .filter((f) => holds(ctx, f.when))
    .reduce((n, f) => n + (f.by ?? 1), 0);
  const months = monthsOf(gw);
  e.heat = clampTo(e.heat + (by > 0 ? by : -1) * months, 0, lastAt(row));
  if (e.heat === 0 && e.step > 0) {
    e.step = 0;
    reason(gw, seat, `gov_${row.id}_calm`);
    return;
  }
  const next = row.steps[e.step];
  if (next === undefined || e.heat < next.at) return;
  // A friend away can't lose the game: a regent's seat never reaches the
  // last scene of a fatal row (as with plots).
  if (row.fatal && seat.regent && e.step === row.steps.length - 1) return;
  e.step++;
  // What was said in a talk stands: the same person doesn't come twice.
  if (
    next.again !== true &&
    sceneOf(next.scene)?.kind === "talk" &&
    seat.seen[next.scene] !== undefined
  ) {
    return;
  }
  reason(gw, seat, `gov_${row.id}_${e.step}`);
  call(seat, next.scene, s.chapter + 1);
}

/** Chapter step: each threat to each seat's government has its month. */
export function govStep(gw: GreatWar): void {
  if (!isLongChapter(gw)) return;
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null) continue;
    const ctx: SceneCtx = { gw, seat, cast: {} };
    for (const row of GW_GOV) if (govLive(ctx, row)) rowStep(ctx, row);
    plotsStep(gw, seat);
  }
}

/** The whips' count: seats past a majority, alone and with friends. */
export function pollOf(ctx: SceneCtx, id: string): GwPollView | null {
  const row = GW_ELECTIONS.find((x) => x.id === id);
  if (row === undefined) return null;
  const swings = row.swings.filter((x) => holds(ctx, x.when));
  const seats = row.base + swings.reduce((n, x) => n + x.seats, 0);
  const friends = row.friends.map((f) => ({
    id: f.id,
    seats: f.seats,
    with: holds(ctx, f.when),
  }));
  const allied = friends.filter((f) => f.with);
  return {
    id,
    seats,
    need: row.need,
    total: row.total,
    own: seats - row.need,
    margin: seats + allied.reduce((n, f) => n + f.seats, 0) - row.need,
    friends,
    lines: swings.map((x) => ({ key: x.key, seats: x.seats })),
  };
}

/** The threats the seat can see: what it is, how far on, what feeds it. */
export function govView(gw: GreatWar, seat: GwSeatState): GwGovView[] {
  const ctx: SceneCtx = { gw, seat, cast: {} };
  return seat.gov.flatMap((e) => {
    // A plot never shows here: the seat knows it only by its signs.
    const row = GW_GOV.find((r) => r.id === e.id) ?? null;
    if (row === null || !govLive(ctx, row) || e.heat === 0) return [];
    return [
      {
        id: e.id,
        step: e.step,
        steps: row.steps.length,
        fatal: row.fatal,
        feeds: [
          ...new Set(
            row.feeds
              .filter((f) => f.quiet !== true && holds(ctx, f.when))
              .map((f) => f.key),
          ),
        ],
      },
    ];
  });
}

/** The count of a running election, once the seat is in one. */
export function pollView(gw: GreatWar, seat: GwSeatState): GwPollView | null {
  const ctx: SceneCtx = { gw, seat, cast: {} };
  for (const row of GW_ELECTIONS) {
    const e = seat.gov.find((x) => x.id === row.id);
    if (e !== undefined && e.step > 0) return pollOf(ctx, row.id);
  }
  return null;
}
