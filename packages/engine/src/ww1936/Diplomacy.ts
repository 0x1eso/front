import { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "../game/Game";
import type { WorldWar } from "./WorldWar";

// Task 5 fills these (spec §7.3). Until then nobody can declare war.

export function declareWarBlock(
  _mg: Game,
  _ww: WorldWar,
  _attacker: Player,
  _target: Player,
  _tick: number,
): DeclareWarBlock | null {
  return "prep";
}

/** The smallIDs newly at war with the attacker, the target first. */
export function declareWar(
  _mg: Game,
  _ww: WorldWar,
  _attacker: Player,
  _target: Player,
  _tick: number,
): number[] {
  return [];
}

export function joinWar(
  _mg: Game,
  _ww: WorldWar,
  _actor: Player,
  _enemy: Player,
  _tick: number,
): boolean {
  return false;
}
