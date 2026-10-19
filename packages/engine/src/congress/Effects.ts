import type {
  Modifier,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import type { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

// Task 4 (spec §8) fills these in. Until then no resolution changes anything.

/** Once a second: every player's congress modifiers into its domestic totals; the tech-pact list. */
export function refreshCongressEffects(_mg: Game, _c: Congress): void {}

/** The modifiers the resolutions in force give `player` now. */
export function congressModifiers(
  _mg: Game,
  _c: Congress,
  _player: Player,
): Modifier[] {
  return [];
}

/** S1 A: a sanctioned side trades with nobody. */
export function tradeBlocked(_c: Congress, _a: Player, _b: Player): boolean {
  return false;
}

/** S1 A: a sanctioned player receives no gold or troops. */
export function donationBlocked(_c: Congress, _recipient: Player): boolean {
  return false;
}

/** E2 B, S6 A, S7 A and the nuclear-emergency ban (stock launches are never banned). */
export function congressBans(
  _c: Congress,
  _player: Player,
  _type: UnitType,
): boolean {
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function buildCostPct(_c: Congress, _type: UnitType): number {
  return 0;
}

/** E2 A: build-time percent for `type`. */
export function buildTimePct(_c: Congress, _type: UnitType): number {
  return 0;
}

/** S6 B, S7 B: nuke production time percent for `player`. */
export function nukeProductionTimePct(_c: Congress, _player: Player): number {
  return 0;
}

/** E4 A: what `tech` costs now, in milli-points. */
export function researchCostMilli(
  _c: Congress | null,
  _tech: TechId,
  baseMilli: number,
): number {
  return baseMilli;
}

/** E4 A: research time percent for `tech` now. */
export function researchTimePct(_c: Congress | null, _tech: TechId): number {
  return 0;
}

/** E4 B: the patent when `player` completes `tech`. */
export function onResearchComplete(
  _mg: Game,
  _player: Player,
  _tech: TechId,
): void {}
