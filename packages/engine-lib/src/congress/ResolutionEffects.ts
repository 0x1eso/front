import {
  BallotOption,
  BUILDING_PACT_UNITS,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";

/** What the effect rules read of a resolution in force (ActiveResolution and ActiveResolutionData both fit). */
export interface ResolutionLike {
  resolution: ResolutionId;
  option: BallotOption;
  targets: readonly number[];
  param: string | null;
}

/** What the modifier rules read of a player. */
export interface ModifierFacts {
  smallID: number;
  government: GovernmentId;
  laws: ReadonlyMap<LawId, LawOption>;
}

/** The unit a building_pact parameter names, or null. */
export function buildingPactType(param: string | null): UnitType | null {
  return BUILDING_PACT_UNITS.find((u) => u.key === param)?.type ?? null;
}

// Task 4 (spec §8) fills in the rules below; until then nothing applies.

/** The domestic modifiers `r` gives a player with `facts`. */
export function resolutionModifiers(
  _r: ResolutionLike,
  _facts: ModifierFacts,
): Modifier[] {
  return [];
}

/** E2 B, S6 A, S7 A: whether `type` may not be bought, built, upgraded or produced by `smallID`. */
export function resolutionBans(
  _active: readonly ResolutionLike[],
  _smallID: number,
  _type: UnitType,
): boolean {
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function resolutionBuildCostPct(
  _active: readonly ResolutionLike[],
  _type: UnitType,
): number {
  return 0;
}

/** E2 A: build-time percent for `type`. */
export function resolutionBuildTimePct(
  _active: readonly ResolutionLike[],
  _type: UnitType,
): number {
  return 0;
}

/** S6 B, S7 B: nuke production time percent for `smallID`. */
export function resolutionNukeTimePct(
  _active: readonly ResolutionLike[],
  _smallID: number,
): number {
  return 0;
}
