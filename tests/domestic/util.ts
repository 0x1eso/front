import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";

export const HUMAN = new PlayerInfo(
  "human",
  PlayerType.Human,
  null,
  "human_id",
);

/** A plains game (100x100, all land) with domestic mode on. */
export async function domesticGame(
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [HUMAN],
): Promise<Game> {
  return setup("plains", { domesticMode: true, ...config }, humans);
}

export function conquerSquare(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  size: number,
): void {
  for (let x = x0; x < x0 + size; x++) {
    for (let y = y0; y < y0 + size; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}
