import { Difficulty, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { MissileSiloExecution } from "@openfront/engine/execution/MissileSiloExecution";
import { NationStrategicBehavior } from "@openfront/engine/execution/nation/NationStrategicBehavior";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { BombingExecution } from "@openfront/engine/warfare/BombingExecution";
import { conquerRect } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { BLUE, NATION, own, RED, strategicGame } from "./util";

/** A square nation on a stub map: every tile is its land. */
function fakeWorld(side: number) {
  const owner = { id: "t" } as any;
  const tiles = new Set<number>();
  for (let i = 0; i < side * side; i++) tiles.add(i);
  let sea = 0;
  const mg: any = {
    x: (t: number) => t % side,
    y: (t: number) => Math.floor(t / side),
    isValidCoord: (x: number, y: number) =>
      x >= 0 && y >= 0 && x < side && y < side,
    ref: (x: number, y: number) => y * side + x,
    owner: (t: number) => (tiles.has(t) ? owner : null),
    isLand: () => true,
    isImpassable: () => false,
    ticks: () => 5000,
    congress: () => null,
    queueWaterConversion: () => {
      sea++;
    },
    queueNukeImpact: () => {},
  };
  Object.assign(owner, {
    units: () => [],
    tiles: () => tiles,
    smallID: () => 2,
    troops: () => 1000,
    removeTroops: () => 0,
    relinquish: (t: number) => tiles.delete(t),
  });
  return {
    mg,
    owner,
    attacker: { smallID: () => 1 } as any,
    side,
    seaCount: () => sea,
  };
}

describe("the orbital strike on large nations", () => {
  test.each([200, 700, 1000, 1500])(
    "a %i x %i nation loses about 30% to scattered craters",
    (side) => {
      const w = fakeWorld(side);
      orbitalStrike(w.mg, w.attacker, w.owner);
      const pct = (100 * w.seaCount()) / (side * side);
      expect(pct).toBeGreaterThanOrEqual(29);
      expect(pct).toBeLessThan(34);
    },
  );
});

describe("a bomber's bomb and a conventional missile in flight", () => {
  test("the missile survives the blast", async () => {
    const game = await strategicGame("plains", {
      instantBuild: true,
      warfareExpansion: true,
    });
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 60, 0, 40, 100);
    red.addGold(10_000_000n);
    blue.addGold(100_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    game.addExecution(
      new ConstructionExecution(
        red,
        UnitType.ConventionalMissile,
        game.ref(80, 50),
      ),
    );
    for (
      let i = 0;
      i < 6 && red.units(UnitType.ConventionalMissile).length === 0;
      i++
    ) {
      executeTicks(game, 1);
    }
    executeTicks(game, 3);
    const missile = red.units(UnitType.ConventionalMissile)[0];
    expect(missile?.isActive()).toBe(true);
    const at = missile.tile();
    const exec = new BombingExecution(blue, at) as any;
    exec.mg = game;
    exec.bomber = blue.buildUnit(UnitType.Bomber, game.ref(90, 90), {
      targetTile: at,
      trajectory: [],
    });
    exec.drops = [at];
    exec.dropBomb(0);
    expect(missile.isActive()).toBe(true);
  });
});

describe("a nation AI under two satellites", () => {
  test("it shoots at both, the earlier strike first", async () => {
    const game = await strategicGame(
      "plains",
      { instantBuild: true, difficulty: Difficulty.Hard },
      [RED, BLUE],
    );
    const nation = game.addPlayer(NATION);
    conquerRect(game, nation, 0, 0, 30, 100);
    const red = own(game, RED.id, 60, 0, 40, 100);
    const blue = own(game, BLUE.id, 40, 90, 10, 10);
    const silo = nation.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    nation.upgradeUnit(silo);
    nation.upgradeUnit(silo);
    nation.upgradeUnit(silo);
    game.addExecution(new MissileSiloExecution(silo));
    executeTicks(game, 200);
    const s = nation.strategic()!;
    for (let i = 0; i < 20; i++) s.addStock(UnitType.AtomBomb);
    // Blue strikes first.
    red.strategic()!.setSatellite({
      phase: "targeted",
      target: nation.smallID(),
      strikeTick: game.ticks() + 700,
      interceptors: [],
    });
    blue.strategic()!.setSatellite({
      phase: "targeted",
      target: nation.smallID(),
      strikeTick: game.ticks() + 600,
      interceptors: [],
    });
    const b = new NationStrategicBehavior(new PseudoRandom(1), game, nation);
    b.tick(null);
    executeTicks(game, 2);
    const shots = (p: typeof red) => {
      const sat = p.strategic()!.satellite();
      return sat.phase === "targeted"
        ? sat.interceptors.filter((i) => i.by === nation.smallID()).length
        : 0;
    };
    expect(shots(blue)).toBeGreaterThan(0);
    expect(shots(red)).toBeGreaterThan(0);
    expect(shots(blue)).toBeGreaterThanOrEqual(shots(red));
  });
});
