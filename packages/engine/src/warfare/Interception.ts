import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { Game, isUnit, Unit } from "../game/Game";

/**
 * A SAM missile chasing `unit` is about to reach `tile`. A plane waits a
 * tick at its target for it, as NukeExecution does for nukes: the SAM side
 * decides whether the interception lands.
 */
export function samMissileClosingIn(
  mg: Game,
  unit: Unit,
  tile: TileRef,
): boolean {
  return (
    mg.nearbyUnits(
      tile,
      mg.config().defaultSamMissileSpeed(),
      UnitType.SAMMissile,
      ({ unit: missile }) =>
        isUnit(missile) &&
        missile.owner() !== unit.owner() &&
        missile.targetUnit()?.id() === unit.id(),
    ).length > 0
  );
}
