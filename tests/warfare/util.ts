import {
  PlayerID,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game, Player } from "@openfront/engine/game/Game";
import { conquerRect } from "../domestic/util";
import { setup } from "../util/Setup";

export const RED = new PlayerInfo("red", PlayerType.Human, null, "red_id");
export const BLUE = new PlayerInfo("blue", PlayerType.Human, null, "blue_id");
export const NATION = new PlayerInfo(
  "nation",
  PlayerType.Nation,
  null,
  "nation_id",
);

/**
 * A test map game with expanded warfare on. Maps (tests/testdata/maps):
 * "plains" 100x100 land, "big_plains" 200x200 land, "half_land_half_ocean"
 * 16x16 with land at x 0-7 and sea at x 8-15 (shore tiles at x = 7).
 */
export async function warfareGame(
  map: string,
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [RED, BLUE],
): Promise<Game> {
  return setup(map, { warfareExpansion: true, ...config }, humans);
}

/** The player `id`, owning the given rectangle. */
export function own(
  game: Game,
  id: PlayerID,
  x0: number,
  y0: number,
  width: number,
  height: number,
): Player {
  const player = game.player(id);
  conquerRect(game, player, x0, y0, width, height);
  return player;
}
