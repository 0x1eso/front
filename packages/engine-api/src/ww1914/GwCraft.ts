// Great War 1914: statecraft (brief ww157). Inventions that come from people,
// the ruler's great project of the year, and the country's footing for war.
// The words, the state a seat keeps and what it reads. The rows are
// engine-lib/ww1914/CraftRows, the running engine/ww1914/Craft. See
// /home/eser/dev/ww157-format.md. Lists are APPEND ONLY.
import { z } from "zod";

/**
 * Where an invention stands. `proposed`: its paper is on the desk. `building`:
 * the ruler backed it, a prototype is being made. `failed`: the trial went
 * wrong, the paper asks what now. `ready`: it worked and waits to be fielded.
 */
export const GW_INVENTION_STAGES = [
  "proposed",
  "refused",
  "building",
  "failed",
  "ready",
  "fielded",
  "dropped",
] as const;
export type GwInventionStage = (typeof GW_INVENTION_STAGES)[number];

/** What a scene does to an invention (`doWorld({do:"invent"})`). */
export const GW_INVENT_STEPS = [
  /** Backed: against the army at the row's price if `against` is set. */
  "back",
  /** Backed quietly, with a small sum: no fight, the prototype takes twice as long. */
  "quiet",
  "refuse",
  /** After a failed trial: another prototype, half the time, better odds. */
  "retry",
  "drop",
  /** Into the war now. Before `ripe` chapters it goes in early. */
  "field",
] as const;
export type GwInventStep = (typeof GW_INVENT_STEPS)[number];

/** A great project's chapters, then how it ended. `idle`: never begun. */
export const GW_PROJECT_PHASES = [
  "idle",
  "prep",
  "opp",
  "exec",
  "done",
  "failed",
  "dropped",
] as const;
export type GwProjectPhase = (typeof GW_PROJECT_PHASES)[number];

export const GW_PROJECT_STEPS = [
  "start",
  /** The year passes without one. */
  "later",
  /** Its odds of getting done, up or down. */
  "push",
  "slow",
  "drop",
] as const;
export type GwProjectStep = (typeof GW_PROJECT_STEPS)[number];

/** The country's footing: peacetime economy, war economy, total mobilisation. */
export const GW_FOOTINGS = ["peace", "war", "total"] as const;
export type GwFooting = (typeof GW_FOOTINGS)[number];

/** Raw materials the war runs short of. Text: gw.craft.shortage.<id>. */
export const GW_SHORTAGES = ["nitrates", "rubber", "copper", "fats"] as const;
export type GwShortage = (typeof GW_SHORTAGES)[number];

const int = z.number().int();
/** An id (GreatWarTypes imports this file, so not its GwIdSchema). */
const GwIdSchema = z.string();

export const GwInventionStateSchema = z.object({
  /** A row of the country's inventions. */
  id: GwIdSchema,
  stage: z.enum(GW_INVENTION_STAGES),
  /** The chapter it came to this stage. */
  since: int,
  /** Prototypes made so far. */
  tries: int,
  /** Chapters this prototype takes. */
  build: int,
  /** Fielded before it was ripe: the secret got out. */
  early: z.boolean(),
});
export type GwInventionState = z.infer<typeof GwInventionStateSchema>;

export const GwProjectStateSchema = z.object({
  id: GwIdSchema,
  phase: z.enum(GW_PROJECT_PHASES),
  /** The day it came to this phase. */
  day: int,
  /** The person in charge; null when nobody could be found. */
  lead: GwIdSchema.nullable(),
  /** What the chapters' choices added to its odds, percent. */
  push: int,
  /** The year it was picked. */
  year: int,
});
export type GwProjectState = z.infer<typeof GwProjectStateSchema>;

export const GwShortageStateSchema = z.object({
  id: z.enum(GW_SHORTAGES),
  since: int,
  /** An answer was found: it never comes back. */
  solved: z.boolean(),
});
export type GwShortageState = z.infer<typeof GwShortageStateSchema>;

/** A seat's statecraft. Absent until the first of it happens. */
export const GwCraftStateSchema = z.object({
  inventions: z.array(GwInventionStateSchema),
  /** Every project picked, the running one last. */
  projects: z.array(GwProjectStateSchema),
  /** The year of the last pick (or the year let pass); -1 never. */
  picked: int,
  /** 0 peace, 1 war economy, 2 total mobilisation (GW_FOOTINGS). */
  footing: int,
  /** The chapter of the last step; -1 never. */
  footingSince: int,
  /** The chapter the step's scene was last asked for; -1 never. */
  footingAsked: int,
  shortages: z.array(GwShortageStateSchema),
});
export type GwCraftState = z.infer<typeof GwCraftStateSchema>;

export const gwCraftStart = (): GwCraftState => ({
  inventions: [],
  projects: [],
  picked: -1,
  footing: 0,
  footingSince: -1,
  footingAsked: -1,
  shortages: [],
});

/** One invention as the country tab shows it. */
export interface GwInventionView {
  id: string;
  /** The inventor, a person id (people or the pack's `people`). */
  inventor: string;
  stage: GwInventionStage;
  /** Fielded early, so the enemy was ready for it. */
  early: boolean;
  /** Ready: fielding it now is no longer early. */
  ripe: boolean;
}

export interface GwProjectView {
  id: string;
  phase: GwProjectPhase;
  lead: string | null;
  year: number;
}

/** What the seat reads of its statecraft. */
export interface GwCraftView {
  footing: number;
  /** The next step up: whether it can be asked for now. Null at the top or with no row. */
  raise: { open: boolean; asked: boolean } | null;
  inventions: GwInventionView[];
  /** The running project, or null. */
  project: GwProjectView | null;
  /** Projects that ended, in order. */
  past: GwProjectView[];
  shortages: { id: GwShortage; solved: boolean }[];
}
