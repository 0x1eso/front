// Great War 1914: plots (brief ww158, S2). A plot is a threat row with signs
// and a fair warning (engine-lib HouseRows GwPlotRow, content/house/<tag>.ts):
// its fatal step can't fire until two signs and the warning have been opened,
// the warning at least two chapters before. Court and army plots remove the
// ruler; Britain's cabal feeds `gbr_table`; red plots feed the unrest ladder.
// S1 lands the shapes; the S2 lane runs them here.
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { SceneCtx } from "./SceneRun";

type PlotCond = Extract<GwWorldCond, { is: "plot_signs" | "plot_warned" }>;
type PlotEffect = Extract<GwWorldEffect, { do: "plot_sign" | "plot_warn" }>;

function plotOf(ctx: SceneCtx, id: string) {
  return ctx.seat.house?.plots.find((p) => p.id === id) ?? null;
}

export function plotHolds(ctx: SceneCtx, c: PlotCond): boolean {
  const p = plotOf(ctx, c.id);
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
  }
}

export function plotEffect(ctx: SceneCtx, e: PlotEffect): void {
  const h = ctx.seat.house;
  if (h === undefined) return;
  let p = plotOf(ctx, e.id);
  if (p === null) {
    p = { id: e.id, signs: [], warned: -1 };
    h.plots.push(p);
  }
  switch (e.do) {
    case "plot_sign":
      // S2: the sign scene's id; until then a running count.
      p.signs.push(`sign_${p.signs.length + 1}`);
      return;
    case "plot_warn":
      if (p.warned < 0) p.warned = ctx.gw.s.chapter;
      return;
  }
}
