import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  BombDropUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { carpetBombPoints } from "@openfront/engine-lib/warfare/Warfare";
import {
  AttackLogicInput,
  AttackLogicResult,
} from "@openfront/engine/configuration/EngineConfig";
import { withCongressCombat } from "@openfront/engine/congress/Conflict";
import { CongressExecution } from "@openfront/engine/congress/CongressExecution";
import { domesticCombat } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { canTargetWithSatellite } from "@openfront/engine/strategic/Satellite";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(config: Partial<GameConfig> = {}): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame(config, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

function truce(game: Game, a: Player, b: Player): void {
  enact(game, {
    resolution: "truce",
    targets: [a.smallID(), b.smallID()],
    expires: game.ticks() + 1200,
  });
}

describe("the truce (spec §8.1 S2)", () => {
  test("forbids every hostile act between the two, and only between them", async () => {
    const { game, red, blue, green } = await three({
      strategicWeapons: true,
      warfareExpansion: true,
    });
    grantTechs(red, "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    blue.addGold(10_000_000n);
    green.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    red.strategic()!.addStock(UnitType.AtomBomb);
    blue.buildUnit(UnitType.City, game.ref(45, 50), {});
    const greenCity = green.buildUnit(UnitType.City, game.ref(75, 50), {});
    truce(game, red, blue);
    expect(red.isTruceWith(blue)).toBe(true);
    expect(blue.isTruceWith(red)).toBe(true);
    expect(red.isTruceWith(green)).toBe(false);
    expect(red.canAttackPlayer(blue)).toBe(false);
    expect(blue.canAttackPlayer(red)).toBe(false);
    expect(red.canAttackPlayer(green)).toBe(true);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 60))).toBe(false);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(75, 60))).not.toBe(false);
    expect(red.missileTarget(game.ref(45, 50))).toBeNull();
    expect(red.missileTarget(game.ref(75, 50))?.id()).toBe(greenCity.id());
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(45, 60))).toBe(false);
    expect(canTargetWithSatellite(game, red, blue)).toBe(false);
    expect(canTargetWithSatellite(game, red, green)).toBe(true);
  });

  test("a truce pulls running attacks back whole", async () => {
    const { game, red, blue } = await three();
    red.setTroops(10_000);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 2);
    const attack = red.outgoingAttacks()[0];
    expect(attack).toBeDefined();
    const inFlight = attack.troops();
    const home = red.troops();
    truce(game, red, blue);
    runTicks(game, 1);
    expect(red.outgoingAttacks()).toHaveLength(0);
    expect(Math.abs(red.troops() - (home + inFlight))).toBeLessThan(1);
  });

  test("a blocked attack leaves no embargo or grudge", async () => {
    const { game, red, blue } = await three();
    red.setTroops(10_000);
    truce(game, red, blue);
    const relation = blue.relation(red);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 1);
    expect(red.outgoingAttacks()).toHaveLength(0);
    expect(blue.hasEmbargoAgainst(red)).toBe(false);
    expect(blue.relation(red)).toBe(relation);
    expect(red.troops()).toBe(10_000);
  });

  test("a boat at sea turns back and lands home whole", async () => {
    // half_land_half_ocean: land x 0-7, sea x 8-15, shore at x = 7.
    const game = await congressGame({}, [RED, BLUE], "half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 4);
    const blue = own(game, BLUE.id, 0, 12, 8, 4);
    game.executeNextTick();
    red.setTroops(10_000);
    game.addExecution(new TransportShipExecution(red, game.ref(7, 13), 1000));
    runTicks(game, 3);
    expect(red.units(UnitType.TransportShip)).toHaveLength(1);
    expect(red.troops()).toBe(9_000);
    truce(game, red, blue);
    for (let i = 0; i < 300; i++) {
      if (red.units(UnitType.TransportShip).length === 0) break;
      game.executeNextTick();
    }
    expect(red.units(UnitType.TransportShip)).toHaveLength(0);
    expect(red.troops()).toBe(10_000);
    expect(blue.numTilesOwned()).toBe(32);
  });

  test("a boat sent at a truce partner never sails and turns down nothing", async () => {
    const game = await congressGame({}, [RED, BLUE], "half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 4);
    const blue = own(game, BLUE.id, 0, 12, 8, 4);
    game.executeNextTick();
    red.setTroops(10_000);
    blue.createAllianceRequest(red);
    truce(game, red, blue);
    game.addExecution(new TransportShipExecution(red, game.ref(7, 13), 1000));
    runTicks(game, 3);
    expect(red.units(UnitType.TransportShip)).toHaveLength(0);
    expect(red.troops()).toBe(10_000);
    expect(
      red.incomingAllianceRequests().some((r) => r.requestor() === blue),
    ).toBe(true);
  });

  test("a carpet bomb skips a truce partner's land and falls on the rest", async () => {
    // red x 0-29 with an airport at (10, 10), blue x 40-56, green x 60-99:
    // a carpet aimed at green flies over blue.
    const game = await congressGame(
      { warfareExpansion: true, instantBuild: true },
      [RED, BLUE, GREEN],
    );
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 40, 0, 17, 100);
    const green = own(game, GREEN.id, 60, 0, 40, 100);
    game.executeNextTick();
    grantTechs(red, "industrialization");
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    truce(game, red, blue);
    const aim = game.ref(70, 10);
    expect(red.canBuild(UnitType.Bomber, game.ref(48, 10))).toBe(false);
    expect(red.canBuild(UnitType.Bomber, aim)).not.toBe(false);
    const points = carpetBombPoints(10, 10, 70, 10);
    const ownerAt = (p: { x: number; y: number }) =>
      game.owner(game.ref(p.x, p.y));
    const overBlue = points.filter((p) => ownerAt(p) === blue);
    const expected = points.filter((p) => ownerAt(p) === green);
    expect(overBlue.length).toBeGreaterThan(0);
    expect(expected.length + overBlue.length).toBe(points.length);
    game.addExecution(new ConstructionExecution(red, UnitType.Bomber, aim));
    const drops: BombDropUpdate[] = [];
    for (let i = 0; i < 80; i++) {
      drops.push(...(game.executeNextTick()[GameUpdateType.BombDrop] ?? []));
    }
    expect(drops.map((d) => game.x(d.tile))).toEqual(expected.map((p) => p.x));
    // More than a blast away from green's nearest drop point: untouched.
    expect(game.owner(game.ref(overBlue[0].x, overBlue[0].y))).toBe(blue);
  });

  test("a paradrop in flight when a truce starts is recalled whole", async () => {
    const game = await congressGame(
      { warfareExpansion: true, instantBuild: true },
      [RED, BLUE],
    );
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 60, 0, 40, 100);
    game.executeNextTick();
    grantTechs(red, "industrialization");
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const troops = red.troops();
    const dst = game.ref(70, 10);
    game.addExecution(new ParadropExecution(red, 30_000, dst));
    runTicks(game, 5);
    expect(red.units(UnitType.TransportPlane)).toHaveLength(1);
    expect(red.troops()).toBe(troops - 30_000);
    truce(game, red, blue);
    runTicks(game, 30);
    expect(red.units(UnitType.TransportPlane)).toHaveLength(0);
    expect(game.owner(dst)).toBe(blue);
    expect(red.outgoingAttacks()).toHaveLength(0);
    expect(red.troops()).toBeGreaterThanOrEqual(troops);
  });

  test("emergency members can't fight each other; the target can be fought", async () => {
    const { game, red, blue, green } = await three();
    congressOf(game).setEmergency({
      kind: "aggression",
      target: green.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID(), blue.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(red.isTruceWith(blue)).toBe(true);
    expect(red.canAttackPlayer(blue)).toBe(false);
    expect(red.isTruceWith(green)).toBe(false);
  });
});

describe("congress combat scales", () => {
  test("duel, protectorate, partition, hegemony check, emergency members and a condemned owner", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const base = domesticCombat(red, blue);
    expect(withCongressCombat(base, c, red, blue)).toBe(base);
    expect(withCongressCombat(base, null, red, blue)).toBe(base);

    enact(game, {
      resolution: "truce",
      option: "B",
      targets: [red.smallID(), blue.smallID()],
      expires: game.ticks() + 1200,
    });
    let s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.25);
    expect(s.attackerLoss).toBeCloseTo(0.85);
    expect(withCongressCombat(base, c, red, green)).toBe(base);
    c.expireResolutions(game.ticks() + 2000);

    enact(game, { resolution: "protectorate", targets: [blue.smallID()] });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerLoss).toBeCloseTo(1.4);
    expect(s.attackerSpeed).toBeCloseTo(0.8);
    expect(s.defenderLoss).toBeCloseTo(0.8);
    c.dropTallyResolutions();

    enact(game, {
      resolution: "protectorate",
      option: "B",
      targets: [blue.smallID()],
    });
    expect(withCongressCombat(base, c, red, blue).attackerLoss).toBeCloseTo(
      0.8,
    );
    c.dropTallyResolutions();

    enact(game, { resolution: "hegemony_check", targets: [blue.smallID()] });
    expect(withCongressCombat(base, c, red, blue).attackerLoss).toBeCloseTo(
      0.85,
    );
    c.dropTallyResolutions();

    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [blue.smallID()],
      param: "1",
    });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.2);
    expect(s.attackerLoss).toBeCloseTo(0.8);
    c.dropTallyResolutions();

    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.2);
    expect(s.attackerLoss).toBeCloseTo(0.8);
    expect(withCongressCombat(base, c, green, blue)).toBe(base);
  });

  test("attacks fight with them", async () => {
    class RecordingConfig extends TestConfig {
      readonly inputs: AttackLogicInput[] = [];
      override attackLogic(i: AttackLogicInput): AttackLogicResult {
        this.inputs.push(i);
        return super.attackLogic(i);
      }
    }
    const game = await setup(
      "plains",
      { domesticMode: true, congress: true },
      [RED, BLUE],
      undefined,
      RecordingConfig,
    );
    game.addExecution(new CongressExecution(1));
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    enact(game, { resolution: "protectorate", targets: [blue.smallID()] });
    red.setTroops(10_000);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 3);
    const inputs = (game.config() as RecordingConfig).inputs;
    const input = inputs[inputs.length - 1];
    expect(input.attacker.lossScale).toBeCloseTo(1.4);
    expect(input.attacker.speedScale).toBeCloseTo(0.8);
    expect(input.defender!.lossScale).toBeCloseTo(0.8);
  });
});
