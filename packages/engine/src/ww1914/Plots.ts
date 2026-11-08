// Great War 1914: plots (brief ww158, S2). A plot is a threat row with signs
// and a fair warning (engine-lib HouseRows GwPlotRow, content/house/<tag>.ts),
// run here beside the government's threats (Government.ts calls `plotsStep`
// and finds plot rows by id, so `gov_heat`, `gov_beaten` and the `gov` cond
// work on them). Its heat climbs on its feeds like any threat; its signs come
// as papers, talks or police reports as the heat passes them; its steps come
// as scenes. **Fair warning:** the last step can't come until two signs and
// the warning have been opened this round, the warning at least two chapters
// before; until then the heat holds one below and what is missing comes
// (again). The last step is the seat's last chance: if the plot is still hot
// once it has been read, it ends. Court and army plots remove the ruler;
// Britain's cabal feeds `gbr_table`; red plots feed the unrest ladder. Plots
// never show on the band or the country tab: the seat learns of them only
// through their signs and the police.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPlotState } from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_PLOT_SIGNS,
  GW_PLOT_TABLE_HEAT,
  GW_PLOT_WARN_GAP,
  GW_POLICE_EVERY,
  GwPlotRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { govEntry, govHeatBy, govLive } from "./Government";
import type { GreatWar } from "./GreatWar";
import { sendHouseReport } from "./Intel";
import { rulerGone } from "./Ruler";
import { holds, SceneCtx, sceneOf } from "./SceneRun";
import { clampTo, everyMonths, monthsOf, moveGauge, reason } from "./World";

const P_POLICE_PLOT = idHash("gw_police_plot");

type PlotCond = Extract<
  GwWorldCond,
  { is: "plot_signs" | "plot_warned" | "plot_report" }
>;
type PlotEffect = Extract<GwWorldEffect, { do: "plot_sign" | "plot_warn" }>;

// ---- Rows and state ----

export function plotRows(): readonly GwPlotRow[] {
  return gwContent().plots ?? [];
}

export function plotRow(id: string): GwPlotRow | null {
  return plotRows().find((r) => r.id === id) ?? null;
}

function stateOf(seat: GwSeatState, id: string): GwPlotState | null {
  return seat.house?.plots.find((p) => p.id === id) ?? null;
}

/** The plot's record, made at its first month (needs the seat's house). */
function ensure(gw: GreatWar, seat: GwSeatState, id: string) {
  const h = seat.house;
  if (h === undefined) return null;
  let p = stateOf(seat, id);
  if (p === null) {
    p = { id, signs: [], warned: -1, since: gw.s.chapter };
    h.plots.push(p);
  }
  return p;
}

/** A new round: what was seen of the last one doesn't warn of this one. */
export function plotReset(gw: GreatWar, seat: GwSeatState, id: string): void {
  const p = stateOf(seat, id);
  if (p === null) return;
  p.signs = [];
  p.warned = -1;
  p.since = gw.s.chapter + 1;
}

const lastOf = (row: GwPlotRow) => row.steps[row.steps.length - 1];

/**
 * A friend takes the seat back from the regent: every plot starts a new
 * round, and one whose last step came while nobody sat there steps back to
 * the one before, so the warning and the last step come to the friend.
 */
export function plotsAfterRegency(gw: GreatWar, seat: GwSeatState): void {
  for (const p of seat.house?.plots ?? []) {
    const row = plotRow(p.id);
    plotReset(gw, seat, p.id);
    if (row === null) continue;
    const e = govEntry(seat, row.id);
    if (e.step < row.steps.length) continue;
    e.step = row.steps.length - 1;
    e.heat = Math.min(e.heat, lastOf(row).at - 1);
  }
}

/** Opened this round: dealt since it began (a card closes by its chapter's end). */
function opened(seat: GwSeatState, p: GwPlotState, scene: string): boolean {
  const at = seat.seen[scene];
  return at !== undefined && at >= p.since;
}

function waiting(seat: GwSeatState, scene: string): boolean {
  return (
    seat.scheduled.some((q) => q.scene === scene) ||
    seat.desk.some((c) => c.scene === scene)
  );
}

function call(seat: GwSeatState, scene: string, chapter: number): void {
  if (sceneOf(scene) === null || waiting(seat, scene)) return;
  seat.scheduled.push({ scene, chapter });
}

/**
 * Writes down the signs and the warning dealt this round. A regent's desk
 * closes by itself: nobody read what came, so none of it warns anyone.
 */
function note(seat: GwSeatState, row: GwPlotRow, p: GwPlotState): void {
  if (seat.regent) return;
  for (const s of row.plot.signs) {
    if (!p.signs.includes(s.scene) && opened(seat, p, s.scene)) {
      p.signs.push(s.scene);
    }
  }
  if (p.warned < 0 && opened(seat, p, row.plot.warn)) {
    p.warned = seat.seen[row.plot.warn];
  }
}

/**
 * Whether the last step may come now: the owner's fair-warning rule. Never
 * under a regent: a friend away can't lose the game to a plot.
 */
export function plotFair(gw: GreatWar, seat: GwSeatState, id: string): boolean {
  const p = stateOf(seat, id);
  return (
    !seat.regent &&
    p !== null &&
    p.signs.length >= GW_PLOT_SIGNS &&
    p.warned >= 0 &&
    gw.s.chapter - p.warned >= GW_PLOT_WARN_GAP
  );
}

// ---- What the police see ----

/** The plot as the police would put it: 0 cold .. 4 the last step taken. */
export function plotBand(seat: GwSeatState, row: GwPlotRow): number {
  const e = seat.gov.find((x) => x.id === row.id);
  if (e === undefined || e.heat === 0) return 0;
  const n = row.steps.length;
  if (e.step >= n) return 4;
  if (e.step >= Math.max(1, n - 1)) return 3;
  return e.step >= 1 ? 2 : 1;
}

/** The police's word on a plot; a wrong word on a cold one is a false sign. */
function policeWord(gw: GreatWar, seat: GwSeatState, row: GwPlotRow): void {
  const truth = plotBand(seat, row);
  const r = sendHouseReport(gw, seat, "plot", truth, "police", row.id);
  if (r.claim <= truth || truth > 1) return;
  const p = ensure(gw, seat, row.id);
  if (p === null) return;
  const sign = row.plot.signs.find(
    (s) => s.via === "report" && !opened(seat, p, s.scene),
  );
  if (sign !== undefined) call(seat, sign.scene, gw.s.chapter + 1);
}

/** Now and then the police speak of one plot, astir or not. */
function policeRound(gw: GreatWar, seat: GwSeatState, ctx: SceneCtx): void {
  if (!everyMonths(gw, GW_POLICE_EVERY, 1)) return;
  const live = plotRows().filter((r) => govLive(ctx, r));
  if (live.length === 0) return;
  const pick = wwRoll(gw.s.seed, P_POLICE_PLOT, gw.s.chapter) % live.length;
  policeWord(gw, seat, live[pick]);
}

// ---- The month ----

/** A sign comes: by the heat, or, held back by the rule, whatever the heat. */
function nextSign(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPlotRow,
  p: GwPlotState,
  heat: number,
): void {
  const due = row.plot.signs.find(
    (s) =>
      sceneOf(s.scene) !== null &&
      !opened(seat, p, s.scene) &&
      !waiting(seat, s.scene) &&
      (heat < 0 || heat >= s.at),
  );
  if (due === undefined) return;
  call(seat, due.scene, gw.s.chapter + 1);
  if (due.via === "report") policeWord(gw, seat, row);
}

function warn(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPlotRow,
  p: GwPlotState,
): void {
  if (p.warned >= 0) return;
  call(seat, row.plot.warn, gw.s.chapter + 1);
}

/** The plot has its way. */
function plotEnds(gw: GreatWar, seat: GwSeatState, row: GwPlotRow): void {
  reason(gw, seat, `plot_${row.id}_end`);
  const e = govEntry(seat, row.id);
  e.heat = 0;
  e.step = 0;
  e.beaten++;
  e.rest = gw.s.chapter + Math.ceil(row.rest / monthsOf(gw));
  plotReset(gw, seat, row.id);
  switch (row.plot.end) {
    case "removed":
      rulerGone(gw, seat, "removed");
      return;
    case "gbr_table":
      govHeatBy(gw, seat, "gbr_table", GW_PLOT_TABLE_HEAT);
      return;
    case "unrest": {
      const n = gw.nation(seat.tag);
      if (n === null) return;
      // One rung's worth of months at the bottom: the ladder does the rest.
      n.lowOrder += 2;
      moveGauge(gw, seat.tag, "order", -2, `plot_${row.id}_end`);
      return;
    }
  }
}

function plotMonth(ctx: SceneCtx, row: GwPlotRow): void {
  const { gw, seat } = ctx;
  const s = gw.s;
  const p = ensure(gw, seat, row.id);
  if (p === null) return;
  const e = govEntry(seat, row.id);
  note(seat, row, p);
  if (s.chapter < e.rest) return;
  const last = lastOf(row);
  // The last step was laid: read and not answered, the plot has its way.
  if (e.step >= row.steps.length) {
    const at = seat.seen[last.scene];
    const read =
      opened(seat, p, last.scene) && at !== undefined && at > p.warned;
    if (read && e.heat >= last.at && !seat.regent) plotEnds(gw, seat, row);
    return;
  }
  const by = row.feeds
    .filter((f) => holds(ctx, f.when))
    .reduce((n, f) => n + (f.by ?? 1), 0);
  e.heat = clampTo(e.heat + (by > 0 ? by : -1) * monthsOf(gw), 0, last.at);
  if (e.heat === 0) {
    if (e.step > 0 || p.signs.length > 0 || p.warned >= 0) {
      e.step = 0;
      plotReset(gw, seat, row.id);
    }
    return;
  }
  nextSign(gw, seat, row, p, e.heat);
  const next = row.steps[e.step];
  const isLast = e.step === row.steps.length - 1;
  if (isLast && e.heat >= next.at && !plotFair(gw, seat, row.id)) {
    // Held one below: the warning and the signs come first, again if unread.
    e.heat = next.at - 1;
    warn(gw, seat, row, p);
    if (p.signs.length < GW_PLOT_SIGNS) nextSign(gw, seat, row, p, -1);
    return;
  }
  if (e.heat < next.at) return;
  e.step++;
  call(seat, next.scene, s.chapter + 1);
  // The plain warning comes with the step before the last.
  if (e.step >= Math.max(1, row.steps.length - 1)) warn(gw, seat, row, p);
}

/** Chapter step (from govStep, month-long chapters): each plot has its month. */
export function plotsStep(gw: GreatWar, seat: GwSeatState): void {
  if (seat.house === undefined) return;
  const ctx: SceneCtx = { gw, seat, cast: {} };
  for (const row of plotRows()) {
    if (gw.s.ended !== null || seat.memoir !== null) return;
    if (govLive(ctx, row)) plotMonth(ctx, row);
  }
  if (gw.s.ended === null && seat.memoir === null) policeRound(gw, seat, ctx);
}

// ---- Scenes read and act ----

export function plotHolds(ctx: SceneCtx, c: PlotCond): boolean {
  const p = stateOf(ctx.seat, c.id);
  switch (c.is) {
    case "plot_signs": {
      const n = p?.signs.length ?? 0;
      return (
        (c.min === undefined || n >= c.min) &&
        (c.max === undefined || n <= c.max)
      );
    }
    case "plot_warned":
      return p !== null && p.warned >= 0;
    case "plot_report": {
      const of = c.of ?? ["confirmed"];
      const since = p?.since ?? 0;
      return ctx.gw.s.reports.some(
        (r) =>
          r.smallID === ctx.seat.smallID &&
          r.fact === "plot" &&
          r.source === "police" &&
          r.about === c.id &&
          r.chapter >= since &&
          r.claim > 0 &&
          of.includes(r.stamp),
      );
    }
  }
}

/** A scene not in the row can count as a sign, or as the warning. */
export function plotEffect(ctx: SceneCtx, e: PlotEffect): void {
  const { gw, seat } = ctx;
  const p = ensure(gw, seat, e.id);
  if (p === null) return;
  if (seat.regent) return;
  switch (e.do) {
    case "plot_sign": {
      const id = ctx.card?.scene ?? `sign_${gw.s.chapter}`;
      if (!p.signs.includes(id)) p.signs.push(id);
      return;
    }
    case "plot_warn":
      if (p.warned < 0) p.warned = gw.s.chapter;
      return;
  }
}
