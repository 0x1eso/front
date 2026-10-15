import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  DOMESTIC_CONQUEST_PERCENT,
  DOMESTIC_TIMER_MINUTES,
  MILLI,
  POLITICAL_PROJECT_GOLD,
  POLITICAL_PROJECT_POLITICAL,
  PROJECT_GOVERNMENT_TIER,
  PROJECT_HOST_MIN_LEVEL,
  SCIENCE_PROJECT_GOLD,
  VICTORY_PROJECT_SECONDS,
} from "./Balance";

export interface VictoryProjectDef {
  kind: VictoryProjectKind;
  /** The building the project runs in (level PROJECT_HOST_MIN_LEVEL or more). */
  hostType: UnitType.ResearchInstitute | UnitType.AdminOffice;
  goldCost: bigint;
  politicalCostMilli: number;
  ticks: number;
  /** Progress stops while the owner is attacking another nation. */
  pausesWhileAttacking: boolean;
}

// Spec §8.1.
export const VICTORY_PROJECTS: Readonly<
  Record<VictoryProjectKind, VictoryProjectDef>
> = {
  science: {
    kind: "science",
    hostType: UnitType.ResearchInstitute,
    goldCost: SCIENCE_PROJECT_GOLD,
    politicalCostMilli: 0,
    ticks: VICTORY_PROJECT_SECONDS * 10,
    pausesWhileAttacking: false,
  },
  political: {
    kind: "political",
    hostType: UnitType.AdminOffice,
    goldCost: POLITICAL_PROJECT_GOLD,
    politicalCostMilli: POLITICAL_PROJECT_POLITICAL * MILLI,
    ticks: VICTORY_PROJECT_SECONDS * 10,
    pausesWhileAttacking: true,
  },
};

/** Whether a player has unlocked `kind`: the space program tech, or government tier 3. */
export function projectQualified(
  kind: VictoryProjectKind,
  hasSpaceProgram: boolean,
  governmentTier: number,
): boolean {
  return kind === "science"
    ? hasSpaceProgram
    : governmentTier >= PROJECT_GOVERNMENT_TIER;
}

export type ProjectBlock =
  | "busy"
  | "requirement"
  | "host"
  | "gold"
  | "political";

/** What a start attempt looks like to the rules, from either side. */
export interface ProjectAttempt {
  /** The player already has a project (one at a time). */
  busy: boolean;
  qualified: boolean;
  /** The chosen host's level if it is the player's own finished building of the right type; null otherwise. */
  hostLevel: number | null;
  gold: bigint;
  politicalMilli: number;
}

/** Why `kind` can't start now, or null when it can. Checked in this order. */
export function victoryProjectBlock(
  kind: VictoryProjectKind,
  a: ProjectAttempt,
): ProjectBlock | null {
  if (a.busy) return "busy";
  if (!a.qualified) return "requirement";
  if (a.hostLevel === null || a.hostLevel < PROJECT_HOST_MIN_LEVEL) {
    return "host";
  }
  const def = VICTORY_PROJECTS[kind];
  if (a.gold < def.goldCost) return "gold";
  if (a.politicalMilli < def.politicalCostMilli) return "political";
  return null;
}

/**
 * Game length in minutes; null when there is no timer. Domestic games
 * always end on a timer (spec §8.3): 30 minutes unless the lobby set one,
 * including the host lobby's "timer off" (null).
 */
export function effectiveMaxTimerMinutes(
  gc: Pick<GameConfig, "maxTimerValue" | "domesticMode">,
): number | null {
  const set = gc.maxTimerValue ?? null;
  if (set !== null) return set;
  return gc.domesticMode === true ? DOMESTIC_TIMER_MINUTES : null;
}

/** Conquest threshold of a domestic game (percent of non-fallout land). */
export function domesticConquestPercent(
  gc: Pick<GameConfig, "conquestPercent">,
): number {
  return gc.conquestPercent ?? DOMESTIC_CONQUEST_PERCENT;
}
