import type { UnitState } from "../../types";

/**
 * Build progress (0..1) of a structure under construction. Domestic mode
 * sends each structure's real build time; otherwise the unit type's
 * duration applies.
 */
export function constructionProgress(
  unit: Pick<UnitState, "constructionStartTick" | "constructionTicks">,
  gameTick: number,
  defaultDuration: number,
): number {
  const duration = unit.constructionTicks ?? defaultDuration;
  const start = unit.constructionStartTick ?? gameTick;
  return Math.min(1, Math.max(0, (gameTick - start) / duration));
}
