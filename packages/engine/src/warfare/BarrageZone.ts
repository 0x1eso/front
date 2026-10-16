import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { BARRAGE_RADIUS } from "@openfront/engine-lib/warfare/Warfare";
import { Game, Player } from "../game/Game";

/**
 * True when a finished coastal barrage's zone covers `tile` (spec §14b):
 * the defender's defense posts are off there and attackers lose 40% fewer
 * troops. A zone never helps against its shooter or the shooter's friends.
 */
export function barrageSuppresses(
  mg: Game,
  tile: TileRef,
  defender: Player,
): boolean {
  if (mg.unitCount(UnitType.CoastalBarrage) === 0) return false;
  return mg.anyUnitNearby(
    tile,
    BARRAGE_RADIUS,
    [UnitType.CoastalBarrage],
    (zone) =>
      zone.reachedTarget() &&
      zone.owner() !== defender &&
      !defender.isFriendly(zone.owner()),
  );
}
