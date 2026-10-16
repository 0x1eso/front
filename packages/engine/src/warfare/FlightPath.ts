import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";

/**
 * A straight flight from `from` to `to`, one entry per tick at `speed`
 * tiles a tick: [from, …, to]. Only exact arithmetic and Math.round, so
 * every client gets the same tiles. Planes and barrage shells fly it.
 */
export function straightFlightPath(
  map: GameMap,
  from: TileRef,
  to: TileRef,
  speed: number,
): TileRef[] {
  const x0 = map.x(from);
  const y0 = map.y(from);
  const dx = map.x(to) - x0;
  const dy = map.y(to) - y0;
  const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / speed));
  const path: TileRef[] = [from];
  for (let i = 1; i <= steps; i++) {
    path.push(
      map.ref(
        x0 + Math.round((dx * i) / steps),
        y0 + Math.round((dy * i) / steps),
      ),
    );
  }
  return path;
}
