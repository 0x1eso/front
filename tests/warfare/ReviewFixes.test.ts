import {
  Cell,
  Difficulty,
  GameMode,
  HumansVsNations,
  Nation,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NationExecution } from "@openfront/engine/execution/NationExecution";
import { AllianceRequestExecution } from "@openfront/engine/execution/alliance/AllianceRequestExecution";
import { NationWarfareBehavior } from "@openfront/engine/execution/nation/NationWarfareBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { conquerRect } from "../domestic/util";
import { setup } from "../util/Setup";
import { UseRealAttackLogic } from "../util/TestConfig";
import { executeTicks } from "../util/utils";
import { BLUE, NATION, own, RED, warfareGame } from "./util";

const bombAt = (game: Game, p: Player, x: number, y: number) =>
  game.addExecution(
    new ConstructionExecution(p, UnitType.Bomber, game.ref(x, y)),
  );

// plains: red x 0-29 with an airport at (10, 10), blue x 60-99.
async function airfield(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  red.addTroops(100_000);
  blue.addTroops(100_000);
  red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
  return { game, red, blue };
}

const CLAN_A = new PlayerInfo("A", PlayerType.Human, null, "a_id", false, "CL");
const CLAN_B = new PlayerInfo("B", PlayerType.Human, null, "b_id", false, "CL");

/** Two human teammates (and the nation team as the enemy). */
async function teamGame(map: string) {
  const game = await setup(
    map,
    {
      infiniteGold: true,
      instantBuild: true,
      warfareExpansion: true,
      gameMode: GameMode.Team,
      playerTeams: HumansVsNations,
    },
    [CLAN_A, CLAN_B],
    undefined,
    UseRealAttackLogic,
  );
  return { game, a: game.player(CLAN_A.id), b: game.player(CLAN_B.id) };
}

describe("bombers and alliances", () => {
  test("a bomber is called off when its target becomes an ally mid-flight", async () => {
    const { game, red, blue } = await airfield();
    const tiles = blue.numTilesOwned();
    bombAt(game, red, 70, 10);
    executeTicks(game, 4);
    expect(red.units(UnitType.Bomber)).toHaveLength(1);
    game.addExecution(
      new AllianceRequestExecution(red, blue.id()),
      new AllianceRequestExecution(blue, red.id()),
    );
    executeTicks(game, 40);
    expect(red.units(UnitType.Bomber)).toHaveLength(0);
    expect(blue.numTilesOwned()).toBe(tiles);
  });

  test("launching rejects a pending alliance request from the target", async () => {
    const { game, red, blue } = await airfield();
    blue.createAllianceRequest(red);
    expect(red.incomingAllianceRequests()).toHaveLength(1);
    bombAt(game, red, 70, 10);
    executeTicks(game, 3);
    expect(red.units(UnitType.Bomber)).toHaveLength(1);
    expect(red.incomingAllianceRequests()).toHaveLength(0);
  });
});

describe("strikes in team games", () => {
  test("neither bomb nor barrage may reach a teammate's structure or a disconnected teammate", async () => {
    const { game, a, b } = await teamGame("plains");
    const enemy = game.addPlayer(NATION);
    conquerRect(game, a, 0, 0, 30, 100);
    conquerRect(game, b, 30, 60, 20, 40);
    conquerRect(game, enemy, 50, 0, 50, 100);
    a.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    a.buildUnit(UnitType.MissileSilo, game.ref(12, 12), {});
    expect(a.isOnSameTeam(b)).toBe(true);
    expect(a.isOnSameTeam(enemy)).toBe(false);
    // Clear of every teammate structure.
    expect(a.canBuild(UnitType.Bomber, game.ref(60, 50))).not.toBe(false);
    expect(a.canBuild(UnitType.CoastalBarrage, game.ref(60, 50))).not.toBe(
      false,
    );
    // An enemy tile whose blast would reach the teammate's city.
    b.buildUnit(UnitType.City, game.ref(48, 62), {});
    expect(a.canBuild(UnitType.Bomber, game.ref(55, 62))).toBe(false);
    expect(a.canBuild(UnitType.CoastalBarrage, game.ref(55, 62))).toBe(false);
    // A disconnected teammate's own land.
    b.markDisconnected(true);
    expect(a.canBuild(UnitType.Bomber, game.ref(40, 80))).toBe(false);
    expect(a.canBuild(UnitType.CoastalBarrage, game.ref(40, 80))).toBe(false);
  });

  test("a disconnected ally's land can't be bombed", async () => {
    const { game, red, blue } = await airfield();
    red.createAllianceRequest(blue)?.accept();
    blue.markDisconnected(true);
    expect(red.canBuild(UnitType.Bomber, game.ref(70, 10))).toBe(false);
  });

  test("a battery leaves a disconnected teammate's ships alone", async () => {
    const { game, a, b } = await teamGame("half_land_half_ocean");
    conquerRect(game, a, 0, 0, 8, 8);
    conquerRect(game, b, 0, 8, 8, 8);
    game.addExecution(
      new ConstructionExecution(a, UnitType.CoastalBattery, game.ref(7, 3)),
    );
    executeTicks(game, 3);
    const boat = b.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 12),
    });
    b.markDisconnected(true);
    executeTicks(game, 30);
    expect(boat.isActive()).toBe(true);
    expect(a.unitsConstructed(UnitType.Shell)).toBe(0);
  });
});

describe("barrage and disconnected allies", () => {
  test("spares a disconnected ally's battery near the impact", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 100, 50);
    const blue = own(game, BLUE.id, 0, 50, 50, 50);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(50, 10), {});
    red.createAllianceRequest(blue)?.accept();
    blue.markDisconnected(true);
    const allied = blue.buildUnit(
      UnitType.CoastalBattery,
      game.ref(49, 60),
      {},
    );
    game.addExecution(
      new ConstructionExecution(red, UnitType.CoastalBarrage, game.ref(51, 60)),
    );
    executeTicks(game, 63);
    expect(allied.isActive()).toBe(true);
  });
});

describe("cargo planes", () => {
  test("pay the plane's owner even if its airport changed hands", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 60, 0, 20, 20);
    const green = game.addPlayer(NATION);
    red.addGold(10_000_000n);
    blue.addGold(10_000_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
      new ConstructionExecution(blue, UnitType.Airport, game.ref(70, 10)),
    );
    executeTicks(game, 3);
    const airport = red.units(UnitType.Airport)[0];
    for (
      let i = 0;
      i < 400 && game.units(UnitType.CargoPlane).length === 0;
      i++
    )
      executeTicks(game, 1);
    expect(game.units(UnitType.CargoPlane).length).toBeGreaterThan(0);
    airport.setOwner(green);
    const redTrade = red.tradeGold();
    executeTicks(game, 100);
    expect(red.tradeGold() - redTrade).toBe(26_000n);
  });

  test("a lobby disabling the internal plane or shell doesn't crash the tick", async () => {
    const game = await warfareGame("plains", {
      instantBuild: true,
      disabledUnits: [UnitType.CargoPlane, UnitType.Shell],
    });
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 60, 0, 20, 20);
    red.addGold(10_000_000n);
    blue.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
      new ConstructionExecution(blue, UnitType.Airport, game.ref(70, 10)),
      new ConstructionExecution(red, UnitType.CoastalBarrage, game.ref(65, 5)),
    );
    expect(() => executeTicks(game, 700)).not.toThrow();
    expect(game.units(UnitType.CargoPlane)).toHaveLength(0);
    expect(game.units(UnitType.CoastalBarrage)).toHaveLength(0);
  });
});

describe("nation warfare AI", () => {
  // plains: the nation at x 0-29 with an airport; red's city across the gap.
  async function setupAi(difficulty: Difficulty) {
    const game = await warfareGame(
      "plains",
      { instantBuild: true, difficulty },
      [RED],
    );
    const nation = game.addPlayer(NATION);
    conquerRect(game, nation, 0, 0, 30, 30);
    const red = own(game, RED.id, 60, 0, 30, 30);
    nation.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    red.buildUnit(UnitType.City, game.ref(70, 10), {});
    nation.addGold(20_000_000n);
    nation.addTroops(100_000);
    return { game, nation, red };
  }
  const sortie = (game: Game, nation: Player, gate?: () => boolean) => {
    const ai = new NationWarfareBehavior(new PseudoRandom(1), game, nation);
    ai.tick(null, gate);
    executeTicks(game, 3);
    return (
      nation.units(UnitType.Bomber).length +
      nation.units(UnitType.TransportPlane).length
    );
  };

  test("honours the nation's attack gate", async () => {
    const a = await setupAi(Difficulty.Medium);
    expect(sortie(a.game, a.nation, () => false)).toBe(0);
    const b = await setupAi(Difficulty.Medium);
    expect(sortie(b.game, b.nation, () => true)).toBeGreaterThan(0);
  });

  test("never bombs a disconnected teammate's building", async () => {
    const { game, a, b } = await teamGame("plains");
    conquerRect(game, a, 0, 0, 30, 30);
    conquerRect(game, b, 60, 0, 30, 30);
    a.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    b.buildUnit(UnitType.City, game.ref(70, 10), {});
    b.markDisconnected(true);
    // a is a human here; the behaviour does not care who runs it.
    const ai = new NationWarfareBehavior(new PseudoRandom(1), game, a);
    expect(ai.maybeSortie({ ...style(), sortieOdds: 1 })).toBe(false);
  });

  test("keeps an ally's land out of the bomb's blast", async () => {
    const { game, nation, red } = await setupAi(Difficulty.Hard);
    const ally = game.addPlayer(BLUE);
    conquerRect(game, ally, 60, 30, 30, 20);
    // The ally's land lies within 8 tiles of the carpet line through (70, 10).
    conquerRect(game, ally, 60, 15, 30, 5);
    nation.createAllianceRequest(ally)?.accept();
    const ai = new NationWarfareBehavior(new PseudoRandom(1), game, nation);
    ai.maybeSortie({ ...style(), sortieOdds: 1, prefersBombing: true });
    executeTicks(game, 3);
    expect(nation.units(UnitType.Bomber)).toHaveLength(0);
    expect(red.isAlive()).toBe(true);
  });

  test("spends gold on one warfare action a tick", async () => {
    const game = await warfareGame(
      "half_land_half_ocean",
      { instantBuild: true, difficulty: Difficulty.Medium },
      [RED],
    );
    const nation = game.addPlayer(NATION);
    conquerRect(game, nation, 0, 0, 8, 8);
    const red = own(game, RED.id, 0, 8, 8, 8);
    nation.addGold(50_000_000n);
    red.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    new NationWarfareBehavior(new PseudoRandom(1), game, nation).tick(null);
    executeTicks(game, 3);
    expect(nation.units(UnitType.CoastalBattery)).toHaveLength(1);
    expect(nation.units(UnitType.Airport)).toHaveLength(0);
  });

  test("a running nation never queues a warfare build it can't afford", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const game = await warfareGame(
        "half_land_half_ocean",
        { instantBuild: true, difficulty: Difficulty.Medium },
        [RED],
      );
      const info = new PlayerInfo("nat", PlayerType.Nation, null, "nat_id");
      const nation = game.addPlayer(info);
      conquerRect(game, nation, 0, 0, 8, 8);
      nation.addGold(4_000_000n);
      const exec = new NationExecution(
        "game_x",
        new Nation(new Cell(3, 4), nation.info()),
      );
      exec.init(game);
      for (let t = 0; t < 1200; t++) {
        exec.tick(t);
        game.executeNextTick();
        if (t % 100 === 0) nation.addGold(3_000_000n);
      }
      const cannot = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => /cannot build (Coastal Battery|Airport)/.test(m));
      expect(cannot).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

import { warfareStyle } from "@openfront/engine/execution/nation/NationWarfareBehavior";
function style() {
  return warfareStyle({ domestic: () => null } as unknown as Player);
}
