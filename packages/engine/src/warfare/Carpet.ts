import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  CARPET_BOMB_OUTER,
  carpetBombPoints,
} from "@openfront/engine-lib/warfare/Warfare";
import { Game } from "../game/Game";

/**
 * The on-map drop tiles of a carpet from `airport` through `aim`, in flight
 * order (off-map points are skipped). The bomber flies on to the last one.
 */
export function carpetDropTiles(
  mg: Game,
  airport: TileRef,
  aim: TileRef,
): TileRef[] {
  const tiles: TileRef[] = [];
  for (const p of carpetBombPoints(
    mg.x(airport),
    mg.y(airport),
    mg.x(aim),
    mg.y(aim),
  )) {
    if (mg.isValidCoord(p.x, p.y)) tiles.push(mg.ref(p.x, p.y));
  }
  return tiles;
}

/** Every on-map tile within `radius` of `center` (a bomb's outer disc). */
export function discTiles(
  mg: Game,
  center: TileRef,
  radius: number = CARPET_BOMB_OUTER,
): TileRef[] {
  const cx = mg.x(center);
  const cy = mg.y(center);
  const r2 = radius * radius;
  const out: TileRef[] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!mg.isValidCoord(x, y)) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) out.push(mg.ref(x, y));
    }
  }
  return out;
}
