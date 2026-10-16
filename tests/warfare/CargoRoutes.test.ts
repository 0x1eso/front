import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red's airport at (10, 10), blue's at (70, 10): 60 tiles apart, so
// a flight pays 20,000 + 100 x 60 = 26,000 to each side. Each airport sends
// one flight 300 ticks after it opens, so each side gets 52,000 per round.
async function route(
  config: Parameters<typeof warfareGame>[1] = {},
  map = "plains",
  blueAt: [number, number] = [70, 10],
) {
  const game = await warfareGame(map, { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 30);
  const blue = own(game, BLUE.id, blueAt[0] - 10, blueAt[1] - 10, 20, 20);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  if (config.domesticMode) {
    grantTechs(red, "industrialization");
    grantTechs(blue, "industrialization");
  }
  game.addExecution(
    new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    new ConstructionExecution(blue, UnitType.Airport, game.ref(...blueAt)),
  );
  executeTicks(game, 3);
  const redAirport = red.units(UnitType.Airport)[0];
  const blueAirport = blue.units(UnitType.Airport)[0];
  expect(redAirport).toBeDefined();
  expect(blueAirport).toBeDefined();
  return { game, red, blue, redAirport, blueAirport };
}

function earned(game: Game, players: Player[], ticks: number): bigint[] {
  const before = players.map((p) => p.gold());
  executeTicks(game, ticks);
  return players.map((p, i) => p.gold() - before[i]);
}

const planes = (game: Game): Unit[] => game.units(UnitType.CargoPlane);

describe("cargo air routes", () => {
  test("two airports in each other's range trade both ways", async () => {
    const { game, red, blue } = await route();
    const trade = red.tradeGold();
    expect(earned(game, [red, blue], 330)).toEqual([52_000n, 52_000n]);
    expect(red.tradeGold() - trade).toBe(52_000n);
  });

  test("an embargo stops the flights", async () => {
    const { game, red, blue } = await route();
    red.addEmbargo(blue, false);
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("an embargo mid-flight drops the cargo unpaid", async () => {
    const { game, red, blue } = await route();
    executeTicks(game, 305);
    expect(planes(game).length).toBe(2);
    red.addEmbargo(blue, false);
    expect(earned(game, [red, blue], 30)).toEqual([0n, 0n]);
    expect(planes(game)).toHaveLength(0);
  });

  test("a captured destination airport gets no flight; a plane already up still pays its owner", async () => {
    const { game, red, blue, blueAirport } = await route();
    executeTicks(game, 305);
    red.captureUnit(blueAirport);
    // Red's plane now flies red to red and vanishes; blue's, launched before
    // the capture, still lands and pays blue and the airport's owner.
    expect(earned(game, [red, blue], 30)).toEqual([26_000n, 26_000n]);
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("both airports must reach each other", async () => {
    const { game, red, blue, redAirport } = await route(
      {},
      "big_plains",
      [170, 170],
    ); // 226 tiles apart
    red.addGold(100_000_000n);
    red.upgradeUnit(redAirport);
    red.upgradeUnit(redAirport);
    red.upgradeUnit(redAirport); // level 4 reaches 240, blue's level 1 only 150
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("SAMs never shoot cargo planes", async () => {
    const { game, red, blue } = await route();
    const sam = blue.buildUnit(UnitType.SAMLauncher, game.ref(64, 12), {});
    game.addExecution(new SAMLauncherExecution(blue, null, sam));
    expect(earned(game, [red, blue], 330)).toEqual([52_000n, 52_000n]);
  });

  test("survives a snapshot mid-flight", async () => {
    const { game } = await route();
    executeTicks(game, 310);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("cargo air routes in domestic mode", () => {
  test("isolationism stops foreign cargo", async () => {
    const { game, red, blue } = await route({ domesticMode: true });
    grantLaws(red, { diplomacy: "B" });
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("trade modifiers raise each side's own pay", async () => {
    const { game, red, blue } = await route({ domesticMode: true });
    grantLaws(red, { trade: "A" }); // trade +40%
    expect(earned(game, [red, blue], 330)).toEqual([72_800n, 52_000n]);
  });
});
