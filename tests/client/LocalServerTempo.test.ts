import type { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import type { ServerMessage } from "@openfront/shared/WireSchemas";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Auth", () => ({
  getAuthHeader: vi.fn(async () => "Bearer test-jwt"),
  getPersistentID: vi.fn(() => "123e4567-e89b-12d3-a456-426614174000"),
}));

vi.mock("../../src/client/Api", () => ({
  getApiBase: vi.fn(() => "https://api.test"),
}));

vi.mock("src/client/ClientEnv", () => ({
  ClientEnv: {
    turnIntervalMs: vi.fn(() => 100),
    gitCommit: vi.fn(() => "DEV"),
  },
}));

import { LocalServer } from "../../src/client/LocalServer";

// World War 1936, the unlimited game (engine-lib/ww1936/Pace.ts): the same
// simulation with 400 ms ticks, so the singleplayer server hands the client
// a turn every 400 ms; every other game keeps the 100 ms turn.

const CLIENT_ID = "abCD1234";

function gameStartInfo(config: Partial<GameConfig>): GameStartInfo {
  return {
    gameID: "gameID12",
    lobbyCreatedAt: 1000,
    config: {
      gameMap: "Africa",
      difficulty: "Medium",
      donateGold: false,
      donateTroops: false,
      gameType: "Singleplayer",
      gameMode: "Free For All",
      gameMapSize: "Normal",
      nations: "default",
      bots: 400,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      ...config,
    },
    players: [{ clientID: CLIENT_ID, username: "TestUser", clanTag: null }],
  } as GameStartInfo;
}

describe("LocalServer: the turn follows the game's tick length", () => {
  let server: LocalServer;

  afterEach(() => {
    clearInterval((server as any).turnCheckInterval);
    vi.useRealTimers();
  });

  // Starts a singleplayer game; returns how many turns it has handed over.
  function start(config: Partial<GameConfig>): () => number {
    vi.useFakeTimers();
    server = new LocalServer(
      {
        gameID: "gameID12",
        playerName: "TestUser",
        playerClanTag: null,
        gameStartInfo: gameStartInfo(config),
      } as any,
      false,
      new EventBus(),
    );
    let turns = 0;
    server.updateCallback(
      () => {},
      (msg: ServerMessage) => {
        if (msg.type === "turn") {
          turns++;
          // Done at once, so the backlog gate never holds a turn back.
          server.turnComplete();
        }
      },
    );
    server.start();
    // The first turn goes on the first check.
    vi.advanceTimersByTime(5);
    expect(turns).toBe(1);
    return () => turns;
  }

  it("an unlimited World War 1936 game hands over a turn only after 400 ms", () => {
    const turns = start({ worldWar1936: true, ww1936Unlimited: true });
    vi.advanceTimersByTime(395);
    expect(turns()).toBe(1);
    vi.advanceTimersByTime(10);
    expect(turns()).toBe(2);
  });

  it("a vanilla game hands over a turn after 100 ms", () => {
    const turns = start({});
    vi.advanceTimersByTime(95);
    expect(turns()).toBe(1);
    vi.advanceTimersByTime(10);
    expect(turns()).toBe(2);
  });

  it("a timed World War 1936 game hands over a turn after 100 ms", () => {
    const turns = start({ worldWar1936: true });
    vi.advanceTimersByTime(105);
    expect(turns()).toBe(2);
  });
});
