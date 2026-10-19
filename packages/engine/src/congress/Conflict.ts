import type { TileRef } from "@openfront/engine-api/game/GameMap";
import type { DomesticCombat } from "../domestic/DomesticEconomy";
import type { Game, Player, Unit } from "../game/Game";
import type { Congress } from "./Congress";

// Task 5 (spec §8, §9.4, §10.2) fills these in. Until then nothing applies.

/** S2 A truces (sessions and emergency aftermaths) and emergency members among themselves. */
export function isTruce(_c: Congress, _a: Player, _b: Player): boolean {
  return false;
}

/** `base` (the domestic combat scales) times the congress scales of this pair. */
export function withCongressCombat(
  base: Readonly<DomesticCombat>,
  _c: Congress | null,
  _attacker: Player,
  _defender: Player | null,
): Readonly<DomesticCombat> {
  return base;
}

/** World heritage A: the host can't be destroyed. */
export function isHeritageProtected(_mg: Game, _unit: Unit): boolean {
  return false;
}

const NO_TILES: ReadonlySet<TileRef> = new Set<TileRef>();

/** The tiles protected hosts stand on: blasts leave them owned. */
export function heritageHostTiles(_mg: Game): ReadonlySet<TileRef> {
  return NO_TILES;
}
