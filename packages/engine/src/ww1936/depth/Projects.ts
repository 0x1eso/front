// P6 lane S fills this file (plan Task 6): special projects and scientists (spec §9.1–§9.3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  PROJECT_DEFS,
  projectDayMilli,
  scientistPct,
} from "@openfront/engine-lib/ww1936/ProjectRules";
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

/**
 * Review E6: a running project's days left and today's input, ‰ (spec §9.3
 * projectDayMilli). The foundation's body: its scientist's skill and
 * speciality, full input; lane S adds the uranium input and its stats.
 */
export function projectEta(
  d: WwDepth,
  id: number,
  run: { project: number; progressMilli: number; scientist: number },
): { daysLeft: number; inputPm: number } {
  const p = SPECIAL_PROJECTS[run.project];
  if (p === undefined) return { daysLeft: 0, inputPm: 1000 };
  const def = PROJECT_DEFS[p];
  const sci = d
    .country(id)
    ?.proj.scientists.find((s) => s.id === run.scientist);
  const specs = ["nuclear", "rocket", "electronics", "aviation"];
  const pct =
    sci === undefined
      ? 0
      : scientistPct(sci.skill, specs[sci.spec] === def.spec);
  const inputPm = 1000;
  const day = projectDayMilli(def.days, pct, inputPm, sci !== undefined);
  const left = Math.max(0, 1_000_000 - run.progressMilli);
  return { daysLeft: day <= 0 ? -1 : Math.ceil(left / day), inputPm };
}
