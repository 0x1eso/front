import {
  AgendaReason,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  Nation,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import type {
  ActiveResolution,
  AgendaItemInit,
  Congress,
} from "@openfront/engine/congress/Congress";
import { CongressExecution } from "@openfront/engine/congress/CongressExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, RED } from "../warfare/util";

export { BLUE, NATION, own, RED } from "../warfare/util";

export const GREEN = new PlayerInfo(
  "green",
  PlayerType.Human,
  null,
  "green_id",
);

/** A nation-type player without AI: the game adds it like a human. */
export function nationInfo(name: string): PlayerInfo {
  return new PlayerInfo(name, PlayerType.Nation, null, `${name}_id`);
}

export function botInfo(name: string): PlayerInfo {
  return new PlayerInfo(name, PlayerType.Bot, null, `${name}_id`);
}

/**
 * A test map game with domestic mode and the congress on and the congress
 * clock running (GameRunner adds it to real games). Maps
 * (tests/testdata/maps): "plains" 100x100 land (10,000 land tiles),
 * "big_plains" 200x200 land.
 */
export async function congressGame(
  config: Partial<GameConfig> = {},
  players: PlayerInfo[] = [RED, BLUE],
  map = "plains",
  nations: Nation[] = [],
): Promise<Game> {
  const game = await setup(
    map,
    { domesticMode: true, congress: true, ...config },
    players,
    undefined,
    undefined,
    undefined,
    nations,
  );
  game.addExecution(new CongressExecution(1));
  return game;
}

export function congressOf(game: Game): Congress {
  const c = game.congress();
  if (c === null) throw new Error("this game has no congress");
  return c;
}

/** Seats every alive player with a congress state, as a regular session would. */
export function seatAll(game: Game): void {
  congressOf(game).setSeats(
    game
      .players()
      .filter((p) => p.congress() !== null)
      .map((p) => p.smallID()),
  );
}

export function item(
  resolution: ResolutionId,
  targets: number[] = [],
  param: string | null = null,
  reason: AgendaReason = "global",
): AgendaItemInit {
  return { resolution, targets, param, reason, reasonValue: 0 };
}

export function giveInfluence(player: Player, points: number): void {
  const pc = player.congress();
  if (pc === null) throw new Error("player has no congress state");
  pc.grant(points * MILLI);
}

/** Whole influence points. */
export function influence(player: Player): number {
  return Math.floor((player.congress()?.influenceMilli() ?? 0) / MILLI);
}

/** A resolution in force from now, as an adopted session item adds it. */
export function enact(
  game: Game,
  r: Partial<ActiveResolution> & Pick<ActiveResolution, "resolution">,
): void {
  congressOf(game).addResolution({
    option: "A",
    targets: [],
    param: null,
    sinceTick: game.ticks(),
    expires: "next_tally",
    source: "session",
    ...r,
  });
}

export function runTicks(game: Game, n: number): void {
  for (let i = 0; i < n; i++) game.executeNextTick();
}
