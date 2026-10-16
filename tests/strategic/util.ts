import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, RED } from "../warfare/util";

export { BLUE, NATION, own, RED } from "../warfare/util";

/** A third human, for "anyone may intercept". */
export const GREEN = new PlayerInfo(
  "green",
  PlayerType.Human,
  null,
  "green_id",
);

/**
 * A test map game with strategic weapons on. Maps (tests/testdata/maps):
 * "plains" 100x100 land, "big_plains" 200x200 land.
 */
export async function strategicGame(
  map: string,
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [RED, BLUE],
): Promise<Game> {
  return setup(map, { strategicWeapons: true, ...config }, humans);
}
