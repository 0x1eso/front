import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { isHeritageProtected } from "@openfront/engine/congress/Conflict";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { buildLevel, grantTechs } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  own,
  RED,
  runTicks,
} from "./util";

// red holds x 0-29 with a level-3 institute at (15, 50) running the space
// program under world heritage A; blue holds x 30-59.
async function protectedProject(config: Partial<GameConfig> = {}) {
  const game = await congressGame({ strategicWeapons: true, ...config }, [
    RED,
    BLUE,
  ]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  game.executeNextTick();
  const host = buildLevel(game, red, UnitType.ResearchInstitute, 15, 50, 3);
  red.domestic()!.beginVictoryProject("science", host.id(), 2400);
  enact(game, {
    resolution: "world_heritage",
    targets: [red.smallID()],
    param: String(host.id()),
    expires: "project_end",
  });
  return { game, red, blue, host };
}

describe("world heritage A (spec §10.2)", () => {
  test("protects exactly the named host of its owner", async () => {
    const { game, red, host } = await protectedProject();
    expect(isHeritageProtected(game, host)).toBe(true);
    red.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(isHeritageProtected(game, city)).toBe(false);
  });

  test("the host survives a nuke and keeps its tile", async () => {
    const { game, red, blue, host } = await protectedProject();
    grantTechs(blue, "rocketry", "manhattan_project");
    blue.addGold(100_000_000n);
    blue.buildUnit(UnitType.MissileSilo, game.ref(45, 10), {});
    blue.strategic()!.addStock(UnitType.AtomBomb);
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, blue, host.tile(), null),
    );
    runTicks(game, 100);
    expect(blue.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
    expect(host.isActive()).toBe(true);
    expect(game.owner(host.tile())).toBe(red);
  });

  test("the host and its ground survive an orbital strike; the rest burns", async () => {
    const { game, red, blue, host } = await protectedProject();
    red.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    orbitalStrike(game, blue, red);
    expect(city.isActive()).toBe(false);
    expect(host.isActive()).toBe(true);
    expect(game.owner(host.tile())).toBe(red);
  });

  test("the host and its tile survive a carpet bomb; a city beside it doesn't", async () => {
    const { game, red, blue, host } = await protectedProject({
      warfareExpansion: true,
      instantBuild: true,
    });
    red.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(18, 55), {});
    grantTechs(blue, "industrialization");
    blue.addGold(10_000_000n);
    blue.buildUnit(UnitType.Airport, game.ref(45, 50), {});
    // Drops land at x 25, 18, 12 and 5 on y 50: two within 3 of the host.
    game.addExecution(
      new ConstructionExecution(blue, UnitType.Bomber, host.tile()),
    );
    runTicks(game, 80);
    expect(blue.units(UnitType.Bomber)).toHaveLength(0);
    expect(city.isActive()).toBe(false);
    expect(host.isActive()).toBe(true);
    expect(game.owner(host.tile())).toBe(red);
  });

  test("a conventional missile can't touch the host", async () => {
    const { game, blue, host } = await protectedProject({
      instantBuild: true,
    });
    blue.addGold(10_000_000n);
    blue.buildUnit(UnitType.MissileSilo, game.ref(45, 10), {});
    expect(blue.missileTarget(host.tile())?.id()).toBe(host.id());
    game.addExecution(
      new ConstructionExecution(
        blue,
        UnitType.ConventionalMissile,
        host.tile(),
      ),
    );
    runTicks(game, 3);
    expect(blue.units(UnitType.ConventionalMissile)).toHaveLength(1);
    runTicks(game, 100);
    expect(blue.units(UnitType.ConventionalMissile)).toHaveLength(0);
    expect(host.isActive()).toBe(true);
    expect(host.level()).toBe(3);
  });

  test("capture still ends the project, and the protection with it", async () => {
    const { game, red, blue, host } = await protectedProject();
    game.addExecution(new DomesticExecution());
    blue.captureUnit(host);
    runTicks(game, 21);
    expect(red.domestic()!.victoryProject()).toBeNull();
    expect(congressOf(game).active()).toEqual([]);
  });
});
