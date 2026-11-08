// Great War 1914: allies' asks and conferences (brief ww158, S2). An ask comes
// as a letter or by the ambassador; yes is a promise to that head, the `law`
// kind starts a bill with `ally` origin. S1 lands the shapes; the S2 lane runs
// them here.
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { SceneCtx } from "./SceneRun";

type AskCond = Extract<GwWorldCond, { is: "ask" }>;
type AskEffect = Extract<GwWorldEffect, { do: "ask" }>;

export function askHolds(ctx: SceneCtx, c: AskCond): boolean {
  const a = ctx.seat.house?.asks.find((x) => x.id === c.id) ?? null;
  return a !== null && c.of.includes(a.stage);
}

/** S2 answers asks; until then this does nothing. */
export function askEffect(_ctx: SceneCtx, _e: AskEffect): void {}
