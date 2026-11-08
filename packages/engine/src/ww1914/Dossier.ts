// Great War 1914: the dossier, 서류철 (brief ww158, S2). Files on the seat's own
// people, gathered by the police, used in a talk with the `hold` reply. S1
// lands the shapes; the S2 lane runs them here.
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { SceneCtx, whoIn } from "./SceneRun";

type FileCond = Extract<GwWorldCond, { is: "file" }>;
type FileEffect = Extract<GwWorldEffect, { do: "file" | "use_file" }>;

export function fileHolds(ctx: SceneCtx, c: FileCond): boolean {
  const id = whoIn(ctx, c.who)?.id ?? null;
  const files = ctx.seat.house?.files.filter((f) => f.who === id) ?? [];
  const of = c.of ?? ["held"];
  return files.some(
    (f) =>
      (of.includes("held") && !f.out) ||
      (of.includes("used") && f.used > 0) ||
      (of.includes("out") && f.out),
  );
}

/** S2 gathers and uses files; until then these do nothing. */
export function fileEffect(_ctx: SceneCtx, _e: FileEffect): void {}
