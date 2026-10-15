import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GOLD_INDEX_TRADE,
  GOLD_INDEX_TRAIN_OTHER,
  GOLD_INDEX_TRAIN_SELF,
  GOLD_INDEX_WORK,
} from "@openfront/engine-api/StatsSchemas";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  domesticTradeGold,
  processDomesticSecond,
} from "@openfront/engine/domestic/DomesticEconomy";
import { TradeShipExecution } from "@openfront/engine/execution/TradeShipExecution";
import type { TrainExecution } from "@openfront/engine/execution/TrainExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import {
  createTrainStopHandlers,
  TrainStation,
} from "@openfront/engine/game/TrainStation";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantTechs,
} from "./util";

const HOST = new PlayerInfo(
  "host",
  PlayerType.Human,
  "client_host",
  "host_id",
  true, // lobby creator
);
const GUEST = new PlayerInfo(
  "guest",
  PlayerType.Human,
  "client_guest",
  "guest_id",
);

async function pair(
  config: Parameters<typeof domesticGame>[0] = {},
): Promise<[Game, Player, Player]> {
  const game = await domesticGame(config, [HOST, GUEST]);
  const host = game.player(HOST.id);
  const guest = game.player(GUEST.id);
  conquerSquare(game, host, 0, 0, 10); // 1% of the land
  conquerSquare(game, guest, 50, 50, 10);
  return [game, host, guest];
}

/** A player's end-game gold stat at `index` (0 when never recorded). */
function goldStat(game: Game, player: Player, index: number): bigint {
  const stats = game.stats().stats()[player.clientID()!];
  return stats?.gold?.[index] ?? 0n;
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("tithe", () => {
  test("the host's gold multiplier applies to the tithe like other income", async () => {
    const [game, host, guest] = await pair({
      hostCheats: { goldMultiplier: 2 },
    });
    grantGovernment(host, "theocracy");
    grantGovernment(guest, "theocracy");
    second(game, host);
    second(game, guest);
    expect(host.gold()).toBe(200n);
    expect(guest.gold()).toBe(100n);
  });

  test("the tithe is recorded as worker gold", async () => {
    const [game, host] = await pair();
    grantGovernment(host, "theocracy");
    second(game, host);
    expect(host.gold()).toBe(100n);
    expect(goldStat(game, host, GOLD_INDEX_WORK)).toBe(100n);
  });
});

test("banking interest is recorded as worker gold", async () => {
  const [game, host] = await pair();
  grantTechs(host, "banking");
  host.addGold(3_000_000n);
  second(game, host);
  expect(host.gold()).toBe(3_001_000n);
  expect(goldStat(game, host, GOLD_INDEX_WORK)).toBe(1_000n);
});

test("a trade ship's stats record what each side received", async () => {
  const [game, host, guest] = await pair();
  grantTechs(host, "navigation"); // trade ships +40%
  const port = (owner: Player, x: number) =>
    ({ owner: () => owner, tile: () => game.ref(x, x) }) as unknown as Unit;
  const exec = new TradeShipExecution(host, port(host, 5), port(guest, 55));
  const internals = exec as unknown as Record<string, unknown>;
  internals["mg"] = game;
  internals["tradeShip"] = { owner: () => host, delete: () => {} };
  internals["tilesTraveled"] = 120;
  const base = game.config().tradeShipGold(120, host);

  (internals["complete"] as () => void).call(exec);

  const hostGold = domesticTradeGold(base, host, guest, "tradeShip");
  expect(hostGold).toBeGreaterThan(base);
  expect(host.goldEarned()).toBe(hostGold);
  expect(goldStat(game, host, GOLD_INDEX_TRADE)).toBe(hostGold);
  expect(goldStat(game, guest, GOLD_INDEX_TRADE)).toBe(base);
});

test("a train stop's stats record what each side received", async () => {
  const [game, host, guest] = await pair();
  grantTechs(host, "industrialization"); // trains +50%
  const station = {
    unit: { owner: () => guest },
    tile: () => game.ref(55, 55),
  } as unknown as TrainStation;
  const train = {
    owner: () => host,
    tradeStopsVisited: () => 0,
  } as unknown as TrainExecution;
  const base = game.config().trainGold("other", 0, host);

  createTrainStopHandlers(new PseudoRandom(1))[UnitType.City]!.onStop(
    game,
    station,
    train,
  );

  const hostGold = domesticTradeGold(base, host, guest, "train");
  expect(hostGold).toBeGreaterThan(base);
  expect(goldStat(game, host, GOLD_INDEX_TRAIN_SELF)).toBe(hostGold);
  expect(goldStat(game, guest, GOLD_INDEX_TRAIN_OTHER)).toBe(base);
});
