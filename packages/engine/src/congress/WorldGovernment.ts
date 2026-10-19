import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 5 (spec §10.1, §10.3) fills these in.

/** One-shot effects of an adopted item (world government: progress and verdict). */
export function applyAdoption(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}

/** A complete world-government proclamation that the congress hasn't ratified: no victory yet. */
export function awaitsRatification(_mg: Game, _player: Player): boolean {
  return false;
}

/** Spec §10.3: whether nations may single out `player`'s victory project (always without a congress). */
export function isProjectCondemned(_mg: Game, _player: Player): boolean {
  return true;
}
