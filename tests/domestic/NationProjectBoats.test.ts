import {
  Cell,
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { vi } from "vitest";
import { createGame, L, W } from "../core/pathfinding/_fixtures";
import { buildLevel } from "./util";

// A nation on the north strip, an unowned island and a rival on the south one.
function sea(rival: boolean) {
  const width = 40;
  const height = 24;
  const grid: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) grid.push(y <= 7 || y >= 16 ? L : W);
  }
  const game = createGame(
    { width, height, grid },
    { difficulty: Difficulty.Hard, domesticMode: true },
  );
  const nation = game.addPlayer(
    new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
  );
  const other = game.addPlayer(
    new PlayerInfo("other", PlayerType.Nation, null, "other_id"),
  );
  game.map().forEachTile((t) => {
    const y = game.y(t);
    if (game.isLand(t) && y <= 7) nation.conquer(t);
    else if (rival && game.isLand(t) && y >= 16) other.conquer(t);
  });
  nation.largestClusterBoundingBox = {
    min: new Cell(0, 0),
    max: new Cell(width - 1, 7),
  };
  nation.setTroops(1_000_000);
  const host = buildLevel(game, nation, UnitType.AdminOffice, 5, 3, 3);
  nation.domestic()!.beginVictoryProject("political", host.id(), 2400);
  const random = new PseudoRandom(42);
  const emoji = new NationEmojiBehavior(random, game, nation);
  const behavior = new AiAttackBehavior(
    random,
    game,
    nation,
    0,
    0,
    0,
    new NationAllianceBehavior(random, game, nation, emoji),
    emoji,
  );
  const spy = vi.spyOn(game, "addExecution");
  const boatOwners = () =>
    spy.mock.calls
      .map((c) => c[0])
      .filter((e) => e instanceof TransportShipExecution)
      .map((e) => game.owner(e["ref"]));
  return { game, behavior, boatOwners };
}

describe("a world-government nation and boats", () => {
  test("still sends a boat to an unowned island", () => {
    const { game, behavior, boatOwners } = sea(false);
    for (let i = 0; i < 200 && boatOwners().length === 0; i++) {
      behavior.maybeAttack();
    }
    const owners = boatOwners();
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((o) => !o.isPlayer())).toBe(true);
    expect(game.config().domesticMode()).toBe(true);
  });

  test("sends no boat at another player", () => {
    const { behavior, boatOwners } = sea(true);
    for (let i = 0; i < 200; i++) behavior.maybeAttack();
    expect(boatOwners()).toHaveLength(0);
  });
});
