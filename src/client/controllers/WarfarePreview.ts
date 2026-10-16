import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { NukeMagnitude } from "@openfront/engine-lib/configuration/Config";
import {
  airportRange,
  BARRAGE_RADIUS,
  BARRAGE_SILO_RANGE,
  BOMB_INNER,
  BOMB_OUTER,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";

/** Expanded warfare ghost rings: battery reach, airport range, barrage and bomb radius. */
export function warfareGhostRadius(type: UnitType, level: number): number {
  switch (type) {
    case UnitType.CoastalBattery:
      return COASTAL_BATTERY_RANGE;
    case UnitType.Airport:
      return airportRange(level);
    case UnitType.CoastalBarrage:
      return BARRAGE_RADIUS;
    case UnitType.Bomber:
      return BOMB_OUTER;
    default:
      return 0;
  }
}

/**
 * The blast zone a strike breaks alliances over: a bomber's fixed radii, a
 * nuke's from the config.
 */
export function strikeMagnitude(
  config: { nukeMagnitudes(type: UnitType): NukeMagnitude },
  type: UnitType,
): NukeMagnitude {
  return type === UnitType.Bomber
    ? { inner: BOMB_INNER, outer: BOMB_OUTER }
    : config.nukeMagnitudes(type);
}

export interface FlightSourceUnit {
  tile(): TileRef;
  level(): number;
  isActive(): boolean;
  isInCooldown(): boolean;
  isUnderConstruction(): boolean;
}

/**
 * Where a bomber (airport) or barrage (silo) would take off for `tile`: the
 * nearest ready one in reach, first wins a tie, the same pick as the
 * engine's airportSortieSpawn / barrageSpawn. Null when none reaches.
 */
export function flightSource(
  units: readonly FlightSourceUnit[],
  type: UnitType.Bomber | UnitType.CoastalBarrage,
  tile: TileRef,
  dist2: (a: TileRef, b: TileRef) => number,
): TileRef | null {
  let best: FlightSourceUnit | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (!u.isActive() || u.isInCooldown() || u.isUnderConstruction()) continue;
    const reach =
      type === UnitType.Bomber ? airportRange(u.level()) : BARRAGE_SILO_RANGE;
    const d = dist2(u.tile(), tile);
    if (d > reach * reach || d >= bestDist) continue;
    best = u;
    bestDist = d;
  }
  return best?.tile() ?? null;
}
