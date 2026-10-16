import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { SatelliteTargetExecution } from "@openfront/engine/strategic/SatelliteOrders";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29 with a silo at (10, 10); blue holds x 60-99.
async function launchpad(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  blue.addGold(10_000_000n);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, silo };
}

/** build_unit Satellite: ConstructionExecution starts it on its first tick. */
function prepare(game: Game, player: Player, tile: TileRef): void {
  game.addExecution(
    new ConstructionExecution(player, UnitType.Satellite, tile),
  );
}

function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("satellite preparation", () => {
  test("90 s at the player's silo for 25M, in front of everyone, then orbit", async () => {
    const { game, red, silo } = await launchpad();
    const gold = red.gold();
    prepare(game, red, game.ref(12, 12));
    executeTicks(game, 1);
    const started = tickMessages(game);
    expect(sat(red)).toMatchObject({ phase: "preparing", siloId: silo.id() });
    expect(red.gold()).toBe(gold - 25_000_000n);
    const msg = started.find(
      (m) => m.message === "events_display.satellite_preparing",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.unitID).toBe(silo.id());

    executeTicks(game, 899);
    expect(sat(red).phase).toBe("preparing");
    const done = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "orbit" });
    expect(
      done.some((m) => m.message === "events_display.satellite_in_orbit"),
    ).toBe(true);
  });

  test("a level-1 silo fires nothing else meanwhile; a level-2 silo keeps a slot", async () => {
    const { game, red, silo } = await launchpad();
    red.strategic()!.addStock(UnitType.AtomBomb);
    const target = game.ref(80, 50);
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
    red.upgradeUnit(silo);
    silo.reloadMissile();
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(silo.tile());
  });

  test("destroying the silo fails it: the gold is gone, a new try is allowed", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const gold = red.gold();
    silo.delete();
    const msgs = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "none" });
    expect(red.gold()).toBe(gold);
    expect(
      msgs.some((m) => m.message === "events_display.satellite_prep_failed"),
    ).toBe(true);
    const again = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    expect(red.canBuild(UnitType.Satellite, again.tile())).toBe(again.tile());
  });

  test("capturing the silo fails it too", async () => {
    const { game, red, blue, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    blue.captureUnit(silo);
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "none" });
  });

  test("a conventional missile doesn't slow it; only destroying the silo stops it", async () => {
    const { game, red, blue, silo } = await launchpad();
    red.upgradeUnit(silo);
    silo.reloadMissile();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const before = sat(red);
    blue.buildUnit(UnitType.MissileSilo, game.ref(80, 50), {});
    game.addExecution(
      new ConstructionExecution(
        blue,
        UnitType.ConventionalMissile,
        silo.tile(),
      ),
    );
    executeTicks(game, 90);
    expect(silo.level()).toBe(1);
    expect(sat(red)).toEqual(before);
  });

  test("one at a time, and never again once in orbit", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const second = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    expect(red.canBuild(UnitType.Satellite, second.tile())).toBe(false);
    red.strategic()!.setSatellite({ phase: "spent" });
    expect(red.canBuild(UnitType.Satellite, second.tile())).toBe(false);
  });

  test("survives a snapshot mid-preparation", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("aiming the satellite", () => {
  test("a nation is struck 60 s later, and everyone hears who aims at whom", async () => {
    const { game, red, blue } = await launchpad();
    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    const msgs = tickMessages(game);
    const now = game.ticks() - 1;
    expect(sat(red)).toEqual({
      phase: "targeted",
      target: blue.smallID(),
      strikeTick: now + 600,
      interceptors: [],
    });
    const msg = msgs.find(
      (m) => m.message === "events_display.satellite_targeted",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.params).toEqual({
      name: "red",
      target: "blue",
      targetID: blue.smallID(),
    });
  });

  test("not before orbit, not itself, not an ally", async () => {
    const { game, red, blue } = await launchpad();
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "none" });

    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, red.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "orbit" });

    red.createAllianceRequest(blue)?.accept();
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("survives a snapshot while the strike counts down", async () => {
    const { game, red, blue } = await launchpad();
    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    await expectSnapshotRoundTrip(game, "plains", 20);
  });
});

describe("the satellite in domestic mode", () => {
  test("the space program unlocks it and the nuclear law discounts it", async () => {
    const { game, red, silo } = await launchpad({ domesticMode: true });
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(sat(red)).toEqual({ phase: "none" });
    grantTechs(red, "space_program");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(sat(red).phase).toBe("preparing");
    expect(red.gold()).toBe(gold - 20_000_000n);
  });
});
