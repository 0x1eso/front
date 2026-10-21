// World War 1936 (P2 Task 12, P3 Task 17): restores on the real world1936
// map, every country an AI, the historical calendar on and off. The CI
// cut of scripts/ww1936/det-sim.ts (which plays to 1943 with every moment
// of lockstep.ts and replays the turns from turn 0): a copy is restored at
// the moments of the first years — mid-battle, mid-retreat, mid-spread,
// training, the delay list, a guarantee, a war, the Anschluss's transfer,
// a faction change, a justification — and runs 300 ticks beside the game:
// the game hash every tick, the World War state every 25 ticks, the
// snapshot bytes at the end, the object graphs at the restore.
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import { type Moment, runLockstep, worldFiles, worldMoments } from "./lockstep";

function start(seed: string, historical: boolean): GameStartInfo {
  return {
    gameID: seed,
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Private,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: true,
      donateTroops: true,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      worldWar1936: true,
      historicalAi: historical,
    },
    players: [],
  };
}

/** lockstep.ts's moments of these names (each game needs its own closures). */
function moments(names: string[]): Moment[] {
  const all = worldMoments();
  return names.map((n) => {
    const m = all.find((x) => x.name === n);
    if (m === undefined) throw new Error(`no moment "${n}"`);
    return m;
  });
}

describe("restores on the real world1936 map continue exactly", () => {
  // WWDET001 (det-sim): the Italo-Ethiopian and Spanish wars' battles in
  // 1936, the Anschluss in March 1938 (about tick 6,760; Austria's
  // divisions go to Germany: the P2 Task 12 stats-epoch fix).
  test("historical AI: the battles of 1936 to the Anschluss", async () => {
    const names = [
      "a battle in its tenth round",
      "a retreat",
      "a battle's spread part-way",
      "an AI choice on the delay list",
      "a peaceful transfer or annexation",
    ];
    const rep = await runLockstep({
      start: start("WWDET001", true),
      files: await worldFiles(),
      until: 7100,
      window: 300,
      wwEvery: 25,
      graphs: true,
      periodic: 3500,
      moments: moments(names),
    });
    expect(rep.missed).toEqual([]);
    expect(rep.restores).toHaveLength(names.length + 2);
  }, 900_000);

  // WWDET002 (det-sim): an early justification, war and annexation, and a
  // faction change by tick 2,700.
  test("historical AI off: justifications, wars, annexations, factions", async () => {
    const names = [
      "a justification under way",
      "a war declared",
      "divisions at sea",
      "a peaceful transfer or annexation",
      "the factions changed",
    ];
    const rep = await runLockstep({
      start: start("WWDET002", false),
      files: await worldFiles(),
      until: 3000,
      window: 300,
      wwEvery: 25,
      graphs: true,
      moments: moments(names),
    });
    expect(rep.missed).toEqual([]);
  }, 900_000);
});
