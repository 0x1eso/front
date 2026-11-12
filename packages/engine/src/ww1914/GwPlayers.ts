import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { Player as StartPlayer } from "@openfront/engine-api/Schemas";
import { gwCountry, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import type { GwWorld } from "@openfront/engine-lib/ww1914/World1914";
import type { Game } from "../game/Game";
import { takeBack } from "./Seats";

/**
 * Every country as a player, GW_TAGS order. Humans take their pick if it is
 * a free country of 1914, else the first free one: Germany for a solo game.
 */
export function gwPlayers(
  players: readonly StartPlayer[],
  world: GwWorld,
  random: PseudoRandom,
): PlayerInfo[] {
  const taken = new Map<GwTag, StartPlayer>();
  // ww199: a human takes a country of June 1914, never a dormant new state.
  const free = world.tags.slice(0, world.landed);
  for (const p of players) {
    const pick = p.gwCountry ?? p.country;
    const tag = free.find((t) => t === pick);
    if (tag !== undefined && !taken.has(tag)) taken.set(tag, p);
  }
  for (const p of players) {
    if ([...taken.values()].includes(p)) continue;
    const next = free.find((t) => !taken.has(t));
    if (next !== undefined) taken.set(next, p);
  }
  return world.tags.map((tag) => {
    const def = gwCountry(tag);
    const human = taken.get(tag);
    return new PlayerInfo(
      def.name,
      human === undefined ? PlayerType.Nation : PlayerType.Human,
      human?.clientID ?? null,
      random.nextID(),
      human?.isLobbyCreator ?? false,
      null,
      human?.friends ?? [],
      null,
      def.flag,
    );
  });
}

/**
 * A friends' game resumed from a save, in a new lobby: new connections take
 * the saved seats by the country the server stamped on them. A seat nobody
 * took stays with its old id, away, and its regent runs it. A solo resume
 * names no seat and keeps its player.
 */
export function rebindGwSeats(
  game: Game,
  players: readonly StartPlayer[],
): void {
  const gw = game.greatWar();
  if (gw === null || !players.some((p) => p.gwCountry !== undefined)) return;
  for (const seat of gw.s.seats) {
    const p = game.playerBySmallID(seat.smallID);
    if (!p.isPlayer()) continue;
    const taker = players.find((x) => x.gwCountry === seat.tag);
    if (taker !== undefined) {
      p.rebindClient(taker.clientID, taker.isLobbyCreator ?? false);
      takeBack(gw, seat);
    }
    p.markDisconnected(taker === undefined);
  }
}
