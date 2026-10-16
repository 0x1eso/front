import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ShellExecution } from "@openfront/engine/execution/ShellExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, own, RED, warfareGame } from "./util";

/** The damage a fresh shell fired by `from` would deal (same roll per tick). */
function shellDamage(game: Game, owner: Player, from: Unit, at: Unit): number {
  const shell = new ShellExecution(from.tile(), owner, from, at);
  shell.init(game, game.ticks());
  return shell.getEffectOnTargetForTesting();
}

async function ships(warfare: boolean) {
  const game = warfare
    ? await warfareGame("half_land_half_ocean")
    : await setup("half_land_half_ocean", {}, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 8, 8);
  const blue = own(game, BLUE.id, 0, 8, 8, 8);
  const ship = red.buildUnit(UnitType.Warship, game.ref(10, 3), {
    patrolTile: game.ref(10, 3),
  });
  const target = blue.buildUnit(UnitType.Warship, game.ref(12, 3), {
    patrolTile: game.ref(12, 3),
  });
  // Coastal batteries exist only with the option on.
  const battery = warfare
    ? red.buildUnit(UnitType.CoastalBattery, game.ref(7, 3), {})
    : undefined;
  return { game, red, ship, target, battery };
}

describe("warships with expanded warfare", () => {
  test("vanilla: 20 ticks between shots and full damage", async () => {
    const { game, red, ship, target } = await ships(false);
    expect(game.config().warshipShellAttackRate()).toBe(20);
    expect(game.config().warshipShellDamagePct()).toBe(100);
    const dmg = shellDamage(game, red, ship, target);
    expect(dmg).toBeGreaterThanOrEqual(200);
    expect(dmg).toBeLessThanOrEqual(300);
  });

  test("on: 30 ticks between shots and 60% damage, priorities untouched", async () => {
    const { game, red, ship, target } = await ships(true);
    expect(game.config().warshipShellAttackRate()).toBe(30);
    expect(game.config().warshipShellDamagePct()).toBe(60);
    const dmg = shellDamage(game, red, ship, target);
    expect(dmg).toBeGreaterThanOrEqual(120);
    expect(dmg).toBeLessThanOrEqual(180);
  });

  test("the same roll is cut to 60%, rounded down", async () => {
    const vanilla = await ships(false);
    const warfare = await ships(true);
    const a = shellDamage(
      vanilla.game,
      vanilla.red,
      vanilla.ship,
      vanilla.target,
    );
    const b = shellDamage(
      warfare.game,
      warfare.red,
      warfare.ship,
      warfare.target,
    );
    expect(b).toBe(Math.floor((a * 60) / 100));
  });

  test("coastal battery shells keep full damage", async () => {
    const { game, red, battery, target } = await ships(true);
    const dmg = shellDamage(game, red, battery!, target);
    expect(dmg).toBeGreaterThanOrEqual(200);
    expect(dmg).toBeLessThanOrEqual(300);
  });
});
