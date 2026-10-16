import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import {
  InterceptorData,
  InterceptorNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  SatelliteInterceptExecution,
  SatelliteTargetExecution,
} from "@openfront/engine/strategic/SatelliteOrders";
import { vi } from "vitest";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, GREEN, own, RED, strategicGame } from "./util";

// Whether an interceptor hits is a seeded roll (InterceptOdds.test.ts);
// here each test picks the outcome and records what was judged.
const control = vi.hoisted(() => ({ hit: false, judged: [] as string[] }));
vi.mock("@openfront/engine/strategic/Interception", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@openfront/engine/strategic/Interception")
  >()),
  interceptorHits: (_t: number, _o: number, shot: InterceptorData) => {
    control.judged.push(shot.type);
    return control.hit;
  },
}));

// plains: red (the satellite's owner) holds x 0-29, green x 30-59 with a
// silo at (40, 50), blue (the target) x 60-99 with a city at (80, 50) and
// a silo at (90, 90).
async function countdown() {
  const game = await strategicGame("plains", { instantBuild: true }, [
    RED,
    BLUE,
    GREEN,
  ]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const green = own(game, GREEN.id, 30, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
  const greenSilo = green.buildUnit(UnitType.MissileSilo, game.ref(40, 50), {});
  const blueSilo = blue.buildUnit(UnitType.MissileSilo, game.ref(90, 90), {});
  red.strategic()!.setSatellite({ phase: "orbit" });
  game.addExecution(new SatelliteTargetExecution(red, blue.id()));
  executeTicks(game, 1);
  const strikeTick = (red.strategic()!.satellite() as { strikeTick: number })
    .strikeTick;
  return { game, red, green, blue, city, greenSilo, blueSilo, strikeTick };
}

function intercept(
  game: Game,
  player: Player,
  attacker: Player,
  type: InterceptorNuke,
): void {
  game.addExecution(
    new SatelliteInterceptExecution(player, attacker.id(), type),
  );
}

function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("intercepting a satellite", () => {
  beforeEach(() => {
    control.hit = false;
    control.judged = [];
  });

  test("anyone may fire a stockpiled bomb from any silo; a hit downs the satellite for good", async () => {
    control.hit = true;
    const { game, red, green, city, greenSilo } = await countdown();
    green.strategic()!.addStock(UnitType.AtomBomb);
    intercept(game, green, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(green.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
    expect(greenSilo.isInCooldown()).toBe(true);
    expect(sat(red)).toMatchObject({
      phase: "targeted",
      interceptors: [{ by: green.smallID(), type: UnitType.AtomBomb }],
    });
    executeTicks(game, 29);
    const msgs = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "none" });
    const hit = msgs.find(
      (m) => m.message === "events_display.satellite_intercept_hit",
    );
    expect(hit?.playerID).toBeNull();
    expect(hit?.params).toEqual({ name: "green", unit: "unit_type.atom_bomb" });
    executeTicks(game, 700);
    expect(city.isActive()).toBe(true);
  });

  test("a miss is announced and the strike still lands", async () => {
    const { game, red, blue, city } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 30);
    const msgs = tickMessages(game);
    expect(
      msgs.some((m) => m.message === "events_display.satellite_intercept_miss"),
    ).toBe(true);
    expect(sat(red)).toMatchObject({ phase: "targeted", interceptors: [] });
    executeTicks(game, 600);
    expect(city.isActive()).toBe(false);
  });

  test("an interceptor fired the tick before the strike is still judged before it lands", async () => {
    control.hit = true;
    const { game, red, blue, city, strikeTick } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    executeTicks(game, strikeTick - 1 - game.ticks());
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1); // fired at strikeTick - 1
    executeTicks(game, 10); // the clock has run out: the strike waits
    expect(sat(red).phase).toBe("targeted");
    expect(city.isActive()).toBe(true);
    executeTicks(game, 25);
    expect(sat(red)).toEqual({ phase: "none" });
    expect(city.isActive()).toBe(true);
  });

  test("a late miss lets the strike land right after its judgement", async () => {
    const { game, red, blue, city, strikeTick } = await countdown();
    blue.strategic()!.addStock(UnitType.AtomBomb);
    executeTicks(game, strikeTick - 1 - game.ticks());
    intercept(game, blue, red, UnitType.AtomBomb);
    executeTicks(game, 11);
    expect(city.isActive()).toBe(true);
    executeTicks(game, 60);
    expect(city.isActive()).toBe(false);
    expect(sat(red)).toEqual({ phase: "none" });
  });

  test("both kinds can go up; each is judged once", async () => {
    const { game, red, blue, blueSilo } = await countdown();
    blue.upgradeUnit(blueSilo);
    blueSilo.reloadMissile();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    blue.strategic()!.addStock(UnitType.AtomBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.AtomBomb);
    executeTicks(game, 31);
    expect(control.judged).toEqual([UnitType.HydrogenBomb, UnitType.AtomBomb]);
  });

  test("no shot from the satellite's owner, without stock, without a ready silo, or after the clock", async () => {
    const { game, red, blue, blueSilo, strikeTick } = await countdown();
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    intercept(game, red, red, UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb); // no stock
    executeTicks(game, 1);
    expect(sat(red)).toMatchObject({ interceptors: [] });
    expect(red.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);

    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    blueSilo.launch(); // reloading
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    expect(sat(red)).toMatchObject({ interceptors: [] });

    blueSilo.reloadMissile();
    executeTicks(game, strikeTick - game.ticks());
    intercept(game, blue, red, UnitType.HydrogenBomb); // at strikeTick
    executeTicks(game, 1);
    expect(blue.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);
  });

  test("an interceptor remembers the silo it was fired from", async () => {
    const { game, red, blue, greenSilo, green } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    green.strategic()!.addStock(UnitType.HydrogenBomb);
    intercept(game, green, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    const s = red.strategic()!.satellite();
    if (s.phase !== "targeted") throw new Error("not targeted");
    expect(s.interceptors[0].from).toBe(greenSilo.tile());
    expect(red.strategic()!.toData().satellite).toEqual(s);
  });

  test("survives a snapshot with an interceptor in flight", async () => {
    const { game, red, blue } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    await expectSnapshotRoundTrip(game, "plains", 40);
  });
});
