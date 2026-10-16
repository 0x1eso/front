import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { SATELLITE_PREP_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";
import type { PlayerStrategic } from "./PlayerStrategic";

/** A satellite message for every player, naming `player` (re-resolved through focusPlayerID). */
export function announceSatellite(
  mg: Game,
  key: string,
  type: MessageType,
  player: Player,
  params: Record<string, string | number> = {},
  unitId?: number,
): void {
  mg.displayMessage(
    key,
    type,
    null,
    undefined,
    { name: player.displayName(), ...params },
    unitId,
    player.id(),
  );
}

/** build_unit Satellite at a silo (spec §6.1): pays and starts the 90 s preparation there. */
export function startSatellitePrep(
  mg: Game,
  player: Player,
  tile: TileRef,
): void {
  const s = player.strategic();
  const spawn = player.canBuild(UnitType.Satellite, tile);
  if (s === null || spawn === false) return;
  const silo = player
    .units(UnitType.MissileSilo)
    .find((u) => u.tile() === spawn);
  if (silo === undefined) return;
  player.removeGold(mg.unitInfo(UnitType.Satellite).cost(mg, player));
  const now = mg.ticks();
  s.setSatellite({
    phase: "preparing",
    siloId: silo.id(),
    startTick: now,
    readyTick: now + SATELLITE_PREP_TICKS,
  });
  announceSatellite(
    mg,
    "events_display.satellite_preparing",
    MessageType.NUKE_INBOUND,
    player,
    {},
    silo.id(),
  );
}

/** Whether `player` may aim its satellite at `target` (spec §6.2). */
export function canTargetWithSatellite(
  mg: Game,
  player: Player,
  target: Player,
): boolean {
  return (
    target !== player &&
    target.isAlive() &&
    !player.isFriendly(target, true) &&
    !mg.isSpawnImmunityActive()
  );
}

/**
 * One tick of a player's satellite (spec §6.1): a preparation fails when
 * its silo is gone or has a new owner (the gold is lost, a new try is
 * allowed) and reaches orbit when its time is up.
 */
export function processSatellite(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  now: number,
): void {
  const sat = s.satellite();
  if (sat.phase !== "preparing") return;
  const silo = mg.unit(sat.siloId);
  if (silo === undefined || !silo.isActive() || silo.owner() !== player) {
    s.setSatellite({ phase: "none" });
    announceSatellite(
      mg,
      "events_display.satellite_prep_failed",
      MessageType.UNIT_DESTROYED,
      player,
    );
  } else if (now >= sat.readyTick) {
    s.setSatellite({ phase: "orbit" });
    announceSatellite(
      mg,
      "events_display.satellite_in_orbit",
      MessageType.NUKE_INBOUND,
      player,
    );
  }
}
