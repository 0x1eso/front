import { GameType } from "@openfront/engine-api/game/GameTypes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameManager } from "../../src/server/GameManager";
import { ServerEnv } from "../../src/server/ServerEnv";
import {
  mockLogger as harnessLogger,
  makeClient,
  startGame,
} from "../util/GameServerHarness";
import { testGameConfig } from "../util/Wire";

vi.mock("../../src/server/Logger", () => ({
  logger: {
    child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
  },
}));
vi.mock("../../src/server/PollingLoop", () => ({ startPolling: vi.fn() }));

const mockLogger = harnessLogger();
const CREATOR = "11111111-1111-4111-8111-111111111111";

describe("self-hosted open rooms", () => {
  let selfHosted: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    selfHosted = vi.spyOn(ServerEnv, "selfHosted").mockReturnValue(true);
  });
  afterEach(() => {
    selfHosted.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("lists a host-created private lobby by default, with the host name", () => {
    const gm = new GameManager(mockLogger);
    const game = gm.createGame("room-a", undefined, CREATOR)!;
    game.joinClient(
      makeClient({ persistentID: CREATOR, username: "Hana" }) as any,
    );
    expect(game.isOpenRoom()).toBe(true);
    expect(game.isListed()).toBe(false);
    expect(gm.listedLobbies().map((g) => g.id)).toEqual(["room-a"]);
    expect(game.hostName()).toBe("Hana");
    expect(game.gameInfo().openRoom).toBe(true);
  });

  it("hides the lobby when the host turns listing off, and back on", () => {
    const gm = new GameManager(mockLogger);
    const game = gm.createGame("room-b", undefined, CREATOR)!;
    game.setOpenRoom(false);
    expect(gm.listedLobbies()).toEqual([]);
    expect(game.gameInfo().openRoom).toBe(false);
    game.setOpenRoom(true);
    expect(gm.listedLobbies()).toHaveLength(1);
  });

  it("delists when the game starts", () => {
    const gm = new GameManager(mockLogger);
    const game = gm.createGame("room-c", undefined, CREATOR)!;
    expect(gm.listedLobbies()).toHaveLength(1);
    startGame(game);
    expect(gm.listedLobbies()).toEqual([]);
  });

  it("delists when the lobby fills", () => {
    const gm = new GameManager(mockLogger);
    const game = gm.createGame(
      "room-d",
      testGameConfig({ gameType: GameType.Private, maxPlayers: 1 }),
      CREATOR,
    )!;
    expect(gm.listedLobbies()).toHaveLength(1);
    game.joinClient(makeClient({ persistentID: CREATOR }) as any);
    expect(gm.listedLobbies()).toEqual([]);
  });

  it("does not auto-start or lock the host out like a subscriber listing", () => {
    const gm = new GameManager(mockLogger);
    const game = gm.createGame("room-e", undefined, CREATOR)!;
    expect(game.autoStartAt()).toBeUndefined();
  });

  it("does not list public games or lobbies without a host", () => {
    const gm = new GameManager(mockLogger);
    gm.createGame("pub", testGameConfig({ gameType: GameType.Public }));
    gm.createGame("hostless", undefined, undefined);
    expect(gm.listedLobbies()).toEqual([]);
  });

  it("stays unlisted by default off self-hosted servers", () => {
    selfHosted.mockReturnValue(false);
    const gm = new GameManager(mockLogger);
    const game = gm.createGame("room-f", undefined, CREATOR)!;
    expect(game.isOpenRoom()).toBe(false);
    expect(gm.listedLobbies()).toEqual([]);
  });
});
