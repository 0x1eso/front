import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { congressNukeHit } from "@openfront/engine/congress/Emergencies";
import { MirvExecution } from "@openfront/engine/execution/MIRVExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { StrategicExecution } from "@openfront/engine/strategic/StrategicExecution";
import { startOrbitalStrike } from "@openfront/engine/strategic/StrikeWaves";
import { grantTechs } from "../domestic/util";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  own,
  RED,
  runTicks,
} from "./util";

describe("the nuke score (spec §4.2, §9.1)", () => {
  test("atom 1, hydrogen 2, MIRV 3, orbital 3, warheads 0; only against humans and nations", async () => {
    const game = await congressGame({}, [RED, BLUE, botInfo("bot")]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    const bot = own(game, "bot_id", 60, 0, 30, 100);
    game.executeNextTick();
    const c = congressOf(game);
    const score = () => red.congress()!.nukeScore(game.ticks());
    congressNukeHit(game, c, red, new Map([[blue, 50]]), UnitType.AtomBomb);
    expect(score()).toBe(1);
    expect(blue.congress()!.lostTiles(game.ticks())).toBe(50);
    expect(blue.congress()!.lastHitTick(red.smallID())).toBe(game.ticks());
    congressNukeHit(game, c, red, new Map([[blue, 9]]), UnitType.MIRVWarhead);
    expect(score()).toBe(1);
    congressNukeHit(game, c, red, new Map([[blue, 0]]), UnitType.MIRV);
    expect(score()).toBe(4);
    congressNukeHit(game, c, red, new Map([[bot, 80]]), UnitType.HydrogenBomb);
    expect(score()).toBe(4);
    congressNukeHit(
      game,
      c,
      red,
      new Map([
        [bot, 10],
        [blue, 30],
      ]),
      UnitType.HydrogenBomb,
    );
    expect(score()).toBe(6);
  });

  test("a real atom bomb on a nation scores", async () => {
    const game = await congressGame({}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    grantTechs(red, "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(45, 50), null),
    );
    runTicks(game, 100);
    expect(red.congress()!.nukeScore(game.ticks())).toBe(1);
  });

  test("a real MIRV scores 3 once, at separation; its warheads only add to the losses", async () => {
    const game = await congressGame({}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 70, 100);
    game.executeNextTick();
    grantTechs(red, "rocketry", "manhattan_project", "thermonuclear", "mirv");
    red.addGold(1_000_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    game.addExecution(new MirvExecution(red, game.ref(70, 50)));
    runTicks(game, 2);
    expect(red.units(UnitType.MIRV)).toHaveLength(1);
    // The MIRV unit is gone once it separates.
    for (let i = 0; i < 600 && red.units(UnitType.MIRV).length > 0; i++) {
      expect(red.congress()!.nukeScore(game.ticks())).toBe(0);
      game.executeNextTick();
    }
    expect(red.units(UnitType.MIRV)).toHaveLength(0);
    expect(red.congress()!.nukeScore(game.ticks())).toBe(3);
    expect(blue.congress()!.lastHitTick(red.smallID())).not.toBeNull();
    runTicks(game, 300);
    expect(red.units(UnitType.MIRVWarhead)).toHaveLength(0);
    expect(red.congress()!.nukeScore(game.ticks())).toBe(3);
    expect(blue.congress()!.lostTiles(game.ticks())).toBe(
      7000 - blue.numTilesOwned(),
    );
    expect(blue.congress()!.lostTiles(game.ticks())).toBeGreaterThan(0);
  });

  test("an orbital strike scores 3", async () => {
    const game = await congressGame({ strategicWeapons: true }, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    startOrbitalStrike(game, red, red.strategic()!, blue, game.ticks());
    expect(red.congress()!.nukeScore(game.ticks())).toBe(3);
  });

  test("every wave of an orbital strike adds the land it sinks to the target's losses; only the first scores", async () => {
    const game = await congressGame({ strategicWeapons: true }, [RED, BLUE]);
    game.addExecution(new StrategicExecution());
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    startOrbitalStrike(game, red, red.strategic()!, blue, game.ticks());
    const afterFirst = blue.congress()!.lostTiles(game.ticks());
    expect(afterFirst).toBe(3000 - blue.numTilesOwned());
    runTicks(game, 40);
    expect(red.strategic()!.strike()).toBeNull();
    const lost = blue.congress()!.lostTiles(game.ticks());
    expect(lost).toBe(3000 - blue.numTilesOwned());
    expect(lost).toBeGreaterThan(afterFirst);
    expect(red.congress()!.nukeScore(game.ticks())).toBe(3);
    expect(blue.congress()!.lastHitTick(red.smallID())).not.toBeNull();
  });
});
