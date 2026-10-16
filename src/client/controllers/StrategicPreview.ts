import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Structures, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  MISSILE_TARGET_RADIUS,
  pickNearestWithin,
  SATELLITE_SILO_PICK_RADIUS,
} from "@openfront/engine-lib/strategic/Strategic";
import type { GameView, PlayerView, UnitView } from "../view";

/** Ring drawn around the building a missile would hit or the silo a satellite would use. */
export const TARGET_RING_RADIUS = 4;

type PreviewGame = Pick<GameView, "units" | "x" | "y">;

/** The building a conventional missile aimed at `tile` hits (PlayerImpl.missileTarget's rule), or null. */
export function missileTargetPreview(
  game: PreviewGame,
  me: PlayerView,
  tile: TileRef,
): UnitView | null {
  const candidates: { id: number; x: number; y: number; unit: UnitView }[] = [];
  for (const unit of game.units(...Structures.types)) {
    const owner = unit.owner();
    if (owner === me || me.isFriendly(owner)) continue;
    candidates.push({
      id: unit.id(),
      x: game.x(unit.tile()),
      y: game.y(unit.tile()),
      unit,
    });
  }
  return (
    pickNearestWithin(
      game.x(tile),
      game.y(tile),
      MISSILE_TARGET_RADIUS,
      candidates,
    )?.unit ?? null
  );
}

/** My ready silo the satellite button aimed at `tile` uses (PlayerImpl.satelliteSpawn's rule), or null. */
export function satelliteSiloPreview(
  game: PreviewGame,
  me: PlayerView,
  tile: TileRef,
): UnitView | null {
  const silos = me
    .units(UnitType.MissileSilo)
    .filter(
      (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
    )
    .map((s) => ({
      id: s.id(),
      x: game.x(s.tile()),
      y: game.y(s.tile()),
      unit: s,
    }));
  return (
    pickNearestWithin(
      game.x(tile),
      game.y(tile),
      SATELLITE_SILO_PICK_RADIUS,
      silos,
    )?.unit ?? null
  );
}
