// Authoring words for the statecraft files (content/craft/<tag>.ts). See
// /home/eser/dev/ww157-format.md.
import type {
  GwInventionStage,
  GwInventStep,
  GwProjectPhase,
  GwProjectStep,
  GwShortage,
} from "@openfront/engine-api/ww1914/GwCraft";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

// ---- Conditions ----
export const invented = (id: string, ...of: GwInventionStage[]): GwCond =>
  world({ is: "invention", id, of });
/** Fielded before it was ripe: the enemy knew. */
export const usedEarly = (id: string): GwCond =>
  world({ is: "invention", id, of: ["fielded"], early: true });
export const projectAt = (id: string, ...of: GwProjectPhase[]): GwCond =>
  world({ is: "project", id, of });
/** The running project, whichever it is, is in one of these chapters. */
export const running = (...of: GwProjectPhase[]): GwCond =>
  world({ is: "project", of });
export const footingAt = (min: number, max?: number): GwCond =>
  world(
    max === undefined ? { is: "footing", min } : { is: "footing", min, max },
  );
/** The shortage is on now. */
export const short = (id: GwShortage): GwCond => world({ is: "shortage", id });
export const answered = (id: GwShortage): GwCond =>
  world({ is: "shortage", id, solved: true });

// ---- Effects ----
export const invent = (id: string, step: GwInventStep): GwEffect =>
  doWorld({ do: "invent", id, step });
export const project = (step: GwProjectStep, id?: string): GwEffect =>
  doWorld(
    id === undefined ? { do: "project", step } : { do: "project", id, step },
  );
export const projectLead = (who: GwWho): GwEffect =>
  doWorld({ do: "project_lead", who });
export const footing = (level: number): GwEffect =>
  doWorld({ do: "footing", level });
export const shortage = (id: GwShortage, on: boolean): GwEffect =>
  doWorld({ do: "shortage", id, on });

// ---- Cast ----
/** Someone outside the cabinet: an inventor, an engineer, a union man. */
export const outsider = (id: string): GwCastRule => ({ past: id });
/** The person in charge of the running project. */
export const inCharge: GwCastRule = { called: true };
