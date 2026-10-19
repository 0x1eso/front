import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

// Task 2 (spec §4) fills these in. Until then the ledger records nothing.

/** GameImpl.conquer: `next` took a tile from `prev` (both players). */
export function ledgerConquer(
  _mg: Game,
  _c: Congress,
  _prev: Player,
  _next: Player,
): void {}

/** Spec §4.2: attacking a connected human or nation first, right now. */
export function isAggressing(_mg: Game, _player: Player): boolean {
  return false;
}

/** Captures that are never aggression: an emergency member against the target, anyone against a condemned project's owner. */
export function aggressionExempt(
  _mg: Game,
  _c: Congress,
  _attacker: Player,
  _defender: Player,
): boolean {
  return false;
}
