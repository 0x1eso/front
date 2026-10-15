import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  DOMESTIC_INTERVAL_TICKS,
  LAW_COOLDOWN_TICKS,
} from "@openfront/engine-lib/domestic/Balance";
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

/** Gives a player techs directly, skipping costs and era rules. */
export function grantTechs(player: Player, ...techs: TechId[]): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const tech of techs) {
    d.beginResearch(tech, 0);
    d.advanceResearch(DOMESTIC_INTERVAL_TICKS);
  }
}

/** Proclaims laws directly, skipping costs, conditions and the cooldown. */
export function grantLaws(
  player: Player,
  laws: Partial<Record<LawId, LawOption>>,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const [law, option] of Object.entries(laws) as [LawId, LawOption][]) {
    // A cooldown that ends at tick 0 leaves the next proclamation open.
    d.proclaimLaw(law, option, -LAW_COOLDOWN_TICKS);
  }
}

/** Adopts a government directly, skipping tier rules and the cooldown. */
export function grantGovernment(
  player: Player,
  government: GovernmentId,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  d.chooseGovernment(government, -LAW_COOLDOWN_TICKS);
}
