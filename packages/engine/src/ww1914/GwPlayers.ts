import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { Player as StartPlayer } from "@openfront/engine-api/Schemas";
import { gwCountry, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import type { GwWorld } from "@openfront/engine-lib/ww1914/World1914";

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
  for (const p of players) {
    const pick = p.gwCountry ?? p.country;
    const tag = world.tags.find((t) => t === pick);
    if (tag !== undefined && !taken.has(tag)) taken.set(tag, p);
  }
  for (const p of players) {
    if ([...taken.values()].includes(p)) continue;
    const free = world.tags.find((t) => !taken.has(t));
    if (free !== undefined) taken.set(free, p);
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
