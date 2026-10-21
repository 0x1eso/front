// P6 lane S fills this file (plan Task 6): special projects and scientists (spec §9.1–§9.3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

export function dailyProjects(d: WwDepth, id: number, day: number): void {}

/** project_start … raid_cancel. */
export function issueProjects(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "project_locked";
}

/** Uranium the atomic project wants today (taken before the lines). */
export function uraniumDemand(d: WwDepth, id: number): number {
  return 0;
}

/** A region changed hands: a facility (and its project) may be lost. */
export function onRegionControl(
  d: WwDepth,
  region: number,
  from: number,
  to: number,
  tick: number,
): void {}

/** The project_progress effect (spec §18.3). */
export function applyProjectEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "project_progress" }>,
  actor: number,
): void {}
