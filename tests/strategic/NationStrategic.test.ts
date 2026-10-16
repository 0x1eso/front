import {
  Difficulty,
  PlayerInfo,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { NationMIRVBehavior } from "@openfront/engine/execution/nation/NationMIRVBehavior";
import {
  NationStrategicBehavior,
  stockpiledNukeTypes,
} from "@openfront/engine/execution/nation/NationStrategicBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { conquerRect } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { BLUE, NATION, own, RED, strategicGame } from "./util";

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
  new NationStrategicBehavior(new PseudoRandom(1), game, nation);

// plains: the nation holds x 0-29 with a factory at (10, 30) and a silo at
// (10, 10); red holds x 60-99 (the biggest), blue a 10x10 corner.
async function nationGame(
  difficulty = Difficulty.Hard,
  config: Parameters<typeof strategicGame>[1] = {},
) {
  const game = await strategicGame(
    "plains",
    { instantBuild: true, difficulty, ...config },
    [RED, BLUE],
  );
  const nation = nationIn(game, NATION, 0, 0, 30, 100);
  const red = own(game, RED.id, 60, 0, 40, 100);
  const blue = own(game, BLUE.id, 40, 90, 10, 10);
  nation.buildUnit(UnitType.Factory, game.ref(10, 30), {});
  const silo = nation.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, nation, red, blue, silo };
}

const jobTypes = (p: Player) =>
  p
    .strategic()!
    .jobs()
    .map((j) => j.type);

describe("nation strategic weapons", () => {
  test("make hydrogen bombs when rich, atom bombs otherwise", async () => {
    const rich = await nationGame();
    rich.nation.addGold(11_000_000n);
    behavior(rich.game, rich.nation).tick(null);
    executeTicks(rich.game, 1);
    expect(jobTypes(rich.nation)).toEqual([UnitType.HydrogenBomb]);

    const poor = await nationGame();
    poor.nation.addGold(2_000_000n);
    behavior(poor.game, poor.nation).tick(null);
    executeTicks(poor.game, 1);
    expect(jobTypes(poor.nation)).toEqual([UnitType.AtomBomb]);
  });

  test("make nothing without a silo to fire from", async () => {
    const { game, nation, silo } = await nationGame();
    silo.delete();
    nation.addGold(11_000_000n);
    behavior(game, nation).tick(null);
    executeTicks(game, 1);
    expect(jobTypes(nation)).toEqual([]);
  });

  test("fire from the stockpile, hydrogen first", async () => {
    const { nation } = await nationGame();
    const s = nation.strategic()!;
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([]);
    s.addStock(UnitType.AtomBomb);
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([UnitType.AtomBomb]);
    s.addStock(UnitType.HydrogenBomb);
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([
      UnitType.HydrogenBomb,
      UnitType.AtomBomb,
    ]);
    expect(stockpiledNukeTypes(nation, s, true)).toEqual([UnitType.AtomBomb]);
  });

  test("a MIRV needs one in stock, not gold", async () => {
    const { game, nation } = await nationGame();
    nation.addGold(100_000_000n);
    const random = new PseudoRandom(1);
    const mirv = new NationMIRVBehavior(
      random,
      game,
      nation,
      new NationEmojiBehavior(random, game, nation),
    );
    expect(mirv.considerMIRV()).toBe(false);
  });

  test("Hard: a conventional missile at a factory making nukes; Medium: none", async () => {
    for (const [difficulty, missiles] of [
      [Difficulty.Hard, 1],
      [Difficulty.Medium, 0],
    ] as const) {
      const { game, nation, red } = await nationGame(difficulty);
      nation.addGold(5_000_000n);
      red.addGold(10_000_000n);
      const factory = red.buildUnit(UnitType.Factory, game.ref(80, 50), {});
      red.strategic()!.startJob({
        factoryId: factory.id(),
        type: UnitType.AtomBomb,
        startTick: 0,
        endTick: 10_000,
      });
      behavior(game, nation).tick(null);
      executeTicks(game, 3);
      expect(
        nation.units(UnitType.ConventionalMissile),
        difficulty,
      ).toHaveLength(missiles);
    }
  });

  test("Hard: prepares a satellite when very rich and aims it at the biggest other nation", async () => {
    const { game, nation, red } = await nationGame();
    nation.addGold(50_000_000n);
    const b = behavior(game, nation);
    b.tick(null);
    executeTicks(game, 2);
    expect(nation.strategic()!.satellite().phase).toBe("preparing");

    nation.strategic()!.setSatellite({ phase: "orbit" });
    b.tick(null);
    executeTicks(game, 1);
    expect(nation.strategic()!.satellite()).toMatchObject({
      phase: "targeted",
      target: red.smallID(),
    });
  });

  test("any difficulty: a targeted nation intercepts, hydrogen first, as its silos allow", async () => {
    const { game, nation, red } = await nationGame(Difficulty.Easy);
    const s = nation.strategic()!;
    s.addStock(UnitType.HydrogenBomb);
    s.addStock(UnitType.AtomBomb);
    s.addStock(UnitType.AtomBomb);
    red.strategic()!.setSatellite({
      phase: "targeted",
      target: nation.smallID(),
      strikeTick: game.ticks() + 600,
      interceptors: [],
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 1);
    expect(red.strategic()!.satellite()).toMatchObject({
      interceptors: [{ type: UnitType.HydrogenBomb }],
    });
    expect(s.stock(UnitType.HydrogenBomb)).toBe(0);
    expect(s.stock(UnitType.AtomBomb)).toBe(2);
  });

  test("domestic: no satellite before the space program", async () => {
    const { game, nation } = await nationGame(Difficulty.Hard, {
      domesticMode: true,
    });
    nation.addGold(50_000_000n);
    behavior(game, nation).tick(null);
    executeTicks(game, 2);
    expect(nation.strategic()!.satellite().phase).toBe("none");
  });
});
