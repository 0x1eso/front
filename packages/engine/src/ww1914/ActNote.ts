// Great War 1914 (ww169): what a schedule act did, line by line. An act's
// effects run with a reason context (SceneCtx.fx); each one that moved
// something leaves a why-log line tagged with the act, which the desk note
// lists under it. Lines are past tense and in words (gw.reason.fx_*).
import type {
  GwReason,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwActKind } from "@openfront/engine-api/ww1914/GwActs";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

/** The act a run of effects belongs to. */
export interface GwActFx {
  act: string;
  kind: GwActKind;
}

/** Flags an act can set that mean something the player should read. */
export const GW_FX_FLAGS: Readonly<Record<string, string>> = {
  gw_mediator: "fx_mediator",
};

/** The gauge line's key for an act's gauge moves (gw.line.act_<kind>). */
export const actLineKey = (fx: GwActFx): string => `act_${fx.kind}`;

const upDown = (d: number): "up" | "down" => (d > 0 ? "up" : "down");

/** One line under the act; nothing outside an act's context. */
export function noteFx(
  seat: GwSeatState,
  chapter: number,
  fx: GwActFx | undefined,
  key: string,
  more: { who?: string | null; tag?: GwTag; what?: string } = {},
): void {
  if (fx === undefined) return;
  const r: GwReason = { key, chapter, act: fx.act };
  if (more.who !== undefined && more.who !== null) r.who = more.who;
  if (more.tag !== undefined) r.tag = more.tag;
  if (more.what !== undefined) r.what = more.what;
  seat.log.push(r);
}

/** A move from `was` to `now`, as a line; none when nothing moved. */
export function noteMove(
  seat: GwSeatState,
  chapter: number,
  fx: GwActFx | undefined,
  family: string,
  was: number,
  now: number,
  more: { who?: string | null; tag?: GwTag; what?: string } = {},
): void {
  if (now === was) return;
  noteFx(seat, chapter, fx, `${family}_${upDown(now - was)}`, more);
}
