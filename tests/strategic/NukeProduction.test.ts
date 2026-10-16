import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { StockpiledNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { MirvExecution } from "@openfront/engine/execution/MIRVExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29 with a factory at (10, 30) and a silo at
// (10, 10); blue holds x 60-99. No PlayerExecution runs, so gold only
// moves when something is bought.
async function arsenal(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", config);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, factory, silo };
}

function produce(game: Game, player: Player, type: StockpiledNuke): void {
  game.addExecution(new NukeProductionExecution(player, type));
}

/** Runs one tick and returns its display messages. */
function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const stock = (p: Player, t: StockpiledNuke) => p.strategic()!.stock(t);
const jobs = (p: Player) => p.strategic()!.jobs();

describe("nuke production", () => {
  test("an atom bomb costs 750K at the start and joins the stockpile 20 s later", async () => {
    const { game, red } = await arsenal();
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold - 750_000n);
    expect(jobs(red)).toHaveLength(1);
    executeTicks(game, 199);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.AtomBomb)).toBe(1);
    expect(jobs(red)).toHaveLength(0);
  });

  test("everyone hears '(name) 핵무기 개발 중'", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.HydrogenBomb);
    const msg = tickMessages(game).find(
      (m) => m.message === "events_display.nuke_production_started",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.params).toEqual({ name: "red" });
    expect(msg?.messageType).toBe(MessageType.NUKE_INBOUND);
    expect(msg?.unitID).toBe(factory.id());
  });

  test("hydrogen bombs take 40 s and MIRVs 60 s", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory); // two lines
    produce(game, red, UnitType.HydrogenBomb);
    produce(game, red, UnitType.MIRV);
    executeTicks(game, 400);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(1);
    executeTicks(game, 199);
    expect(stock(red, UnitType.MIRV)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.MIRV)).toBe(1);
  });

  test("one line per factory level: a busy factory takes no order and no gold", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(1);
    expect(red.gold()).toBe(gold);

    red.upgradeUnit(factory);
    const before = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(2);
    expect(red.gold()).toBe(before - 750_000n);
  });

  test("orders spread over factories with free lines", async () => {
    const { game, red, factory } = await arsenal();
    const second = red.buildUnit(UnitType.Factory, game.ref(20, 60), {});
    produce(game, red, UnitType.AtomBomb);
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red).map((j) => j.factoryId)).toEqual([
      factory.id(),
      second.id(),
    ]);
  });

  test("launching takes one from the stockpile and no gold", async () => {
    const { game, red } = await arsenal();
    red.strategic()!.addStock(UnitType.AtomBomb);
    const gold = red.gold();
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(80, 50), null),
      new NukeExecution(UnitType.AtomBomb, red, game.ref(80, 60), null),
    );
    executeTicks(game, 2);
    expect(red.units(UnitType.AtomBomb)).toHaveLength(1);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    expect(red.gold()).toBe(gold);
  });

  test("a MIRV launches from stock without raising the price", async () => {
    const { game, red } = await arsenal();
    red.strategic()!.addStock(UnitType.MIRV);
    game.addExecution(new MirvExecution(red, game.ref(80, 50)));
    executeTicks(game, 2);
    expect(red.units(UnitType.MIRV)).toHaveLength(1);
    expect(stock(red, UnitType.MIRV)).toBe(0);
    expect(game.mirvsLaunched()).toBe(0);
  });

  test("the MIRV price rises when production starts, even if it is lost", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.MIRV);
    executeTicks(game, 1);
    expect(game.mirvsLaunched()).toBe(1);
    expect(game.unitInfo(UnitType.MIRV).cost(game, red)).toBe(40_000_000n);
    factory.delete();
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    expect(game.mirvsLaunched()).toBe(1);
  });

  test("a destroyed factory loses every nuke in production, with no refund, and everyone hears it", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory);
    produce(game, red, UnitType.AtomBomb);
    produce(game, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    const gold = red.gold();
    factory.delete();
    const msgs = tickMessages(game);
    expect(jobs(red)).toHaveLength(0);
    expect(red.gold()).toBe(gold);
    const lost = msgs.find(
      (m) => m.message === "events_display.nuke_production_lost",
    );
    expect(lost?.playerID).toBeNull();
    expect(lost?.params).toEqual({ name: "red" });
    executeTicks(game, 500);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(0);
  });

  test("a captured factory loses them too", async () => {
    const { game, red, blue, factory } = await arsenal();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    blue.captureUnit(factory);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    expect(jobs(blue)).toHaveLength(0);
  });

  test("the stockpile never shrinks when factories and silos fall", async () => {
    const { game, red, factory, silo } = await arsenal();
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    red.strategic()!.addStock(UnitType.AtomBomb);
    factory.delete();
    silo.delete();
    executeTicks(game, 2);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(1);
    expect(stock(red, UnitType.AtomBomb)).toBe(1);
  });

  test("with the option off nothing is produced", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold);
    expect(red.strategic()).toBeNull();
  });

  test("survives a snapshot with an order pending and a line running", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory);
    produce(game, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    produce(game, red, UnitType.AtomBomb); // pending until the next tick
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("nuke production with the other modes", () => {
  test("domestic: a locked nuke can't be made; the nuclear law discounts it", async () => {
    const { game, red } = await arsenal({ domesticMode: true });
    produce(game, red, UnitType.AtomBomb); // no manhattan_project yet
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    grantTechs(red, "manhattan_project");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold - 600_000n);
  });

  test("expanded warfare: barrages still fire at once for gold, outside the stockpile", async () => {
    const { game, red, silo } = await arsenal({ warfareExpansion: true });
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(80, 50))).toBe(
      silo.tile(),
    );
    expect(game.unitInfo(UnitType.CoastalBarrage).cost(game, red)).toBe(
      300_000n,
    );
    expect(red.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
  });
});
