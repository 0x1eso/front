import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import {
  NationWarfareBehavior,
  warfareStyle,
} from "@openfront/engine/execution/nation/NationWarfareBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { buildLevel, conquerRect, grantTechs } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { NATION, own, RED, warfareGame } from "./util";

/** A nation player whose id hashes to `personality` (NationPersonality). */
function nationWith(personality: Personality): PlayerInfo {
  for (let i = 0; i < 1000; i++) {
    const id = `nation_${i}`;
    if (nationDomesticPlan(id).personality === personality) {
      return new PlayerInfo(id, PlayerType.Nation, null, id);
    }
  }
  throw new Error(`no ${personality} id below 1000`);
}

function nationIn(
  game: Game,
  info: PlayerInfo,
  x0: number,
  y0: number,
  w: number,
  h: number,
): Player {
  const nation = game.addPlayer(info);
  conquerRect(game, nation, x0, y0, w, h);
  return nation;
}

const behavior = (game: Game, nation: Player) =>
  new NationWarfareBehavior(new PseudoRandom(1), game, nation);

describe("nation warfare style", () => {
  test("domestic personalities lean on what suits them", async () => {
    const game = await warfareGame("plains", { domesticMode: true }, [RED]);
    const conqueror = nationIn(game, nationWith("conqueror"), 0, 0, 5, 5);
    const zealot = nationIn(game, nationWith("zealot"), 10, 0, 5, 5);
    const merchant = nationIn(game, nationWith("merchant"), 20, 0, 5, 5);
    expect(warfareStyle(conqueror).prefersBombing).toBe(true);
    expect(warfareStyle(conqueror).maxAirports).toBe(2);
    expect(warfareStyle(zealot).proactiveBatteries).toBe(true);
    expect(warfareStyle(zealot).maxBatteries).toBeGreaterThan(
      warfareStyle(merchant).maxBatteries,
    );
  });

  test("outside domestic mode every nation plays the same", async () => {
    const game = await warfareGame("plains", {}, [RED]);
    const a = nationIn(game, nationWith("conqueror"), 0, 0, 5, 5);
    const b = nationIn(game, nationWith("zealot"), 10, 0, 5, 5);
    expect(warfareStyle(a)).toEqual(warfareStyle(b));
  });
});

describe("nation coastal batteries", () => {
  async function coast(difficulty = Difficulty.Medium) {
    const game = await warfareGame(
      "half_land_half_ocean",
      { instantBuild: true, difficulty },
      [RED],
    );
    const nation = nationIn(game, NATION, 0, 0, 8, 8);
    const red = own(game, RED.id, 0, 8, 8, 8);
    nation.addGold(10_000_000n);
    red.addGold(10_000_000n);
    return { game, nation, red };
  }

  test("builds one where an enemy boat is about to land", async () => {
    const { game, nation, red } = await coast(Difficulty.Easy);
    red.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(nation.units(UnitType.CoastalBattery)).toHaveLength(1);
  });

  test("a quiet coast gets none", async () => {
    const { game, nation } = await coast(Difficulty.Easy);
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(nation.units(UnitType.CoastalBattery)).toHaveLength(0);
  });

  test("Hard: shells a defended coast before its own boat lands, once per zone", async () => {
    const { game, nation, red } = await coast(Difficulty.Hard);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 2), {});
    red.buildUnit(UnitType.CoastalBattery, game.ref(7, 12), {});
    nation.buildUnit(UnitType.TransportShip, game.ref(11, 13), {
      troops: 1000,
      targetTile: game.ref(7, 13),
    });
    const ai = behavior(game, nation);
    expect(ai.maybeBarrageLandings()).toBe(true);
    executeTicks(game, 3);
    expect(game.units(UnitType.CoastalBarrage)).toHaveLength(1);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 5), {});
    expect(ai.maybeBarrageLandings()).toBe(false);
  });

  test("Medium nations don't shell before landing", async () => {
    const { game, nation, red } = await coast(Difficulty.Medium);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 2), {});
    red.buildUnit(UnitType.CoastalBattery, game.ref(7, 12), {});
    nation.buildUnit(UnitType.TransportShip, game.ref(11, 13), {
      troops: 1000,
      targetTile: game.ref(7, 13),
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(game.units(UnitType.CoastalBarrage)).toHaveLength(0);
  });
});

describe("nation airports", () => {
  test("a rich nation builds one; Easy nations never do", async () => {
    for (const [difficulty, expected] of [
      [Difficulty.Medium, 1],
      [Difficulty.Easy, 0],
    ] as const) {
      const game = await warfareGame(
        "plains",
        { instantBuild: true, difficulty },
        [RED],
      );
      const nation = nationIn(game, NATION, 0, 0, 40, 40);
      nation.addGold(10_000_000n);
      behavior(game, nation).tick(null);
      executeTicks(game, 3);
      expect(nation.units(UnitType.Airport), difficulty).toHaveLength(expected);
    }
  });

  test("builds nothing while saving for its victory project", async () => {
    const run = async (projectKind: "science" | null): Promise<number> => {
      const game = await warfareGame(
        "plains",
        { instantBuild: true, difficulty: Difficulty.Hard, domesticMode: true },
        [RED],
      );
      const nation = nationIn(game, nationWith("scholar"), 0, 0, 40, 40);
      buildLevel(game, nation, UnitType.ResearchInstitute, 30, 30, 3);
      grantTechs(nation, "space_program", "industrialization");
      // Earned: 5M is within reach, so a scholar saves for it.
      nation.addGold(4_900_000n);
      behavior(game, nation).tick(projectKind);
      executeTicks(game, 3);
      return nation.units(UnitType.Airport).length;
    };
    expect(await run(null)).toBe(1);
    expect(await run("science")).toBe(0);
  });
});

describe("nation sorties", () => {
  async function airfield(domesticMode: boolean, nationInfo: PlayerInfo) {
    const game = await warfareGame(
      "plains",
      { instantBuild: true, domesticMode },
      [RED],
    );
    const nation = nationIn(game, nationInfo, 0, 0, 30, 30);
    const red = own(game, RED.id, 60, 0, 30, 30);
    if (domesticMode) grantTechs(nation, "industrialization");
    nation.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const city = red.buildUnit(UnitType.City, game.ref(70, 10), {});
    city.increaseLevel();
    red.buildUnit(UnitType.DefensePost, game.ref(65, 20), {});
    return { game, nation, red, city };
  }

  test("a conqueror bombs the biggest structure across the gap", async () => {
    const { game, nation, city } = await airfield(
      true,
      nationWith("conqueror"),
    );
    nation.addGold(10_000_000n);
    const style = { ...warfareStyle(nation), sortieOdds: 1 };
    expect(behavior(game, nation).maybeSortie(style)).toBe(true);
    executeTicks(game, 3);
    const bombers = nation.units(UnitType.Bomber);
    expect(bombers).toHaveLength(1);
    expect(bombers[0].targetTile()).toBe(city.tile());
  });

  test("short of gold for a bomb, a big army paradrops instead", async () => {
    const { game, nation, red, city } = await airfield(false, NATION);
    nation.addGold(300_000n);
    nation.addTroops(400_000);
    red.addTroops(50_000);
    const style = { ...warfareStyle(nation), sortieOdds: 1 };
    expect(behavior(game, nation).maybeSortie(style)).toBe(true);
    executeTicks(game, 2);
    const planes = nation.units(UnitType.TransportPlane);
    expect(planes).toHaveLength(1);
    expect(planes[0].targetTile()).toBe(city.tile());
  });
});
