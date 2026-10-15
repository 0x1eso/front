import {
  DomesticView,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TECHS } from "./Techs";

const UNLOCKING_TECH: ReadonlyMap<UnitType, TechId> = new Map(
  TECH_IDS.flatMap((id) => TECHS[id].unlocks.map((u) => [u, id] as const)),
);

/** The tech that unlocks `type` in domestic mode, or null if it never locks. */
export function requiredTech(type: UnitType): TechId | null {
  return UNLOCKING_TECH.get(type) ?? null;
}

/** True for a domestic-mode player who hasn't researched `type` yet. */
export function isLockedByTech(
  view: DomesticView | null,
  type: UnitType,
): boolean {
  if (view === null) return false;
  const tech = requiredTech(type);
  return tech !== null && !view.hasTech(tech);
}
