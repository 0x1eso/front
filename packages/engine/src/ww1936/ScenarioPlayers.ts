import {
  Cell,
  Nation,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import type {
  ClientID,
  Player as StartPlayer,
} from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  isDormantTag,
  PICK_ORDER,
} from "@openfront/engine-api/ww1936/Countries";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/**
 * Spec §7.1: each human keeps a valid, untaken pick (first come, in player
 * order); everyone else gets the first free country in PICK_ORDER. Humans
 * beyond the number of countries get none (they watch).
 */
export function assignCountries(
  players: readonly Pick<StartPlayer, "clientID" | "country">[],
  present: readonly CountryTag[],
): Map<ClientID, CountryTag> {
  const taken = new Set<CountryTag>();
  const out = new Map<ClientID, CountryTag>();
  for (const p of players) {
    const pick = p.country;
    if (pick !== undefined && present.includes(pick) && !taken.has(pick)) {
      out.set(p.clientID, pick);
      taken.add(pick);
    }
  }
  for (const p of players) {
    if (out.has(p.clientID)) continue;
    const free = PICK_ORDER.find((t) => present.includes(t) && !taken.has(t));
    if (free === undefined) continue;
    out.set(p.clientID, free);
    taken.add(free);
  }
  return out;
}

/**
 * Every country of the scenario as a player, in scenario order (plan
 * decision 2): picked ones as humans, the rest as nations whose spawn cell
 * is their capital. The name is the country's English name (decision 3).
 * P5 plan decision 4: then every dormant slot, a nation player with no
 * land and no Nation (no spawn cell: no NationExecution until it wakes).
 */
export function scenarioPlayers(
  players: readonly StartPlayer[],
  scenario: ScenarioIndex,
  random: PseudoRandom,
): { players: PlayerInfo[]; nations: Nation[] } {
  const assigned = assignCountries(players, scenario.scenarioTags());
  const humanByTag = new Map<CountryTag, StartPlayer>();
  for (const p of players) {
    const tag = assigned.get(p.clientID);
    if (tag !== undefined) humanByTag.set(tag, p);
  }
  const infos: PlayerInfo[] = [];
  const nations: Nation[] = [];
  for (const tag of scenario.countries) {
    const def = COUNTRIES[tag];
    if (isDormantTag(tag)) {
      infos.push(
        new PlayerInfo(
          def.name,
          PlayerType.Nation,
          null,
          random.nextID(),
          false,
          null,
          [],
          null,
          def.flag,
        ),
      );
      continue;
    }
    const human = humanByTag.get(tag);
    if (human !== undefined) {
      infos.push(
        new PlayerInfo(
          def.name,
          PlayerType.Human,
          human.clientID,
          random.nextID(),
          human.isLobbyCreator ?? false,
          null,
          human.friends ?? [],
          null,
          def.flag,
        ),
      );
      continue;
    }
    const info = new PlayerInfo(
      def.name,
      PlayerType.Nation,
      null,
      random.nextID(),
      false,
      null,
      [],
      null,
      def.flag,
    );
    infos.push(info);
    const [x, y] = scenario.capitalXY(tag);
    nations.push(new Nation(new Cell(x, y), info));
  }
  return { players: infos, nations };
}
