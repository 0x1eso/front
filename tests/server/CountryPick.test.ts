import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GameMapType,
  GameMode,
  GameType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { ServerStartGameMessage } from "@openfront/shared/WireSchemas";
import type { Client } from "../../src/server/Client";
import {
  cid,
  makeClient,
  makeGame,
  mockWsOf,
  startGame,
} from "../util/GameServerHarness";

const player = (id: string): Client =>
  makeClient({
    clientID: cid(id),
    persistentID: `${id}-pid`,
    publicId: `${id}-pub`,
  });

const pick = (c: Client, tag: "DEU" | "GBR" | null) =>
  mockWsOf(c).emit({ type: "pick_country", tag });

const startMessage = (c: Client): ServerStartGameMessage =>
  mockWsOf(c)
    .sent()
    .find((m): m is ServerStartGameMessage => m.type === "start")!;

describe("World War 1936 country picks (spec §8.1)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const lobby = (config: Partial<GameConfig> = { worldWar1936: true }) => {
    const game = makeGame({
      config: { gameType: GameType.Private, ...config },
    });
    const a = player("a");
    const b = player("b");
    game.joinClient(a);
    game.joinClient(b);
    return { game, a, b };
  };

  it("a taken country is refused", async () => {
    const { game, a, b } = lobby();
    await pick(a, "DEU");
    await pick(b, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
    ]);
    await pick(b, "GBR");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
      { clientID: b.clientID, tag: "GBR" },
    ]);
  });

  it("giving a country up, or turning spectator, frees it", async () => {
    const { game, a, b } = lobby();
    await pick(a, "DEU");
    await pick(a, null);
    await pick(b, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: b.clientID, tag: "DEU" },
    ]);
    await mockWsOf(b).emit({ type: "spectate", spectator: true });
    expect(game.gameInfo().countryPicks).toEqual([]);
    await pick(a, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
    ]);
  });

  it("the start gives each player the country it picked", async () => {
    const { game, a, b } = lobby();
    await pick(a, "DEU");
    startGame(game);
    const players = startMessage(a).gameStartInfo.players;
    expect(players.find((p) => p.clientID === a.clientID)?.country).toBe("DEU");
    expect(
      players.find((p) => p.clientID === b.clientID)?.country,
    ).toBeUndefined();
    await pick(b, "GBR"); // too late
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
    ]);
  });

  it("outside the mode there are no picks", async () => {
    const { game, a } = lobby({});
    await pick(a, "DEU");
    expect(game.gameInfo().countryPicks).toBeUndefined();
  });

  it("a player who disconnects gives its country up", async () => {
    const { game, a, b } = lobby();
    await pick(a, "DEU");
    await mockWsOf(a).trigger("close");
    expect(game.gameInfo().countryPicks).toEqual([]);
    await pick(b, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: b.clientID, tag: "DEU" },
    ]);
    startGame(game);
    const players = startMessage(b).gameStartInfo.players;
    expect(players.map((p) => [p.clientID, p.country])).toEqual([
      [b.clientID, "DEU"],
    ]);
  });

  it("a spectator's pick is ignored", async () => {
    const { game, a } = lobby();
    const watcher = makeClient({
      clientID: cid("s"),
      persistentID: "s-pid",
      publicId: "s-pub",
      spectator: true,
    });
    game.joinClient(watcher);
    await pick(watcher, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([]);
    // Nor kept for later: it plays after all, without a country.
    await mockWsOf(watcher).emit({ type: "spectate", spectator: false });
    expect(game.gameInfo().countryPicks).toEqual([]);
    await pick(a, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
    ]);
  });

  it("a pick made before the mode was turned on is not kept", async () => {
    const { game, a, b } = lobby({});
    await pick(a, "DEU");
    game.updateGameConfig({ worldWar1936: true });
    expect(game.gameInfo().countryPicks).toEqual([]);
    await pick(b, "DEU");
    expect(game.gameInfo().countryPicks).toEqual([
      { clientID: b.clientID, tag: "DEU" },
    ]);
  });

  it("a pick is told to everyone in the lobby", async () => {
    const { a, b } = lobby();
    mockWsOf(b).send.mockClear();
    await pick(a, "DEU");
    const infos = mockWsOf(b)
      .sent()
      .filter((m) => m.type === "lobby_info");
    expect(infos[infos.length - 1]?.lobby.countryPicks).toEqual([
      { clientID: a.clientID, tag: "DEU" },
    ]);
  });
});

// Controller ruling (T1-3): the client loads the map named by the raw start
// config and the engine throws on a map mismatch, so a lobby created with the
// mode already on (no host settings change ever normalized it) must still
// start on the mode's map and rules.
describe("World War 1936 start config", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("a lobby created with the mode on starts on the 1936 map", () => {
    const game = makeGame({
      config: {
        gameType: GameType.Private,
        worldWar1936: true,
        gameMap: GameMapType.World,
        gameMode: GameMode.Team,
        playerTeams: 2,
        bots: 400,
        domesticMode: true,
      },
    });
    const a = player("a");
    game.joinClient(a);
    startGame(game);
    const config = startMessage(a).gameStartInfo.config;
    expect(config.gameMap).toBe(GameMapType.World1936);
    expect(config.gameMode).toBe(GameMode.FFA);
    expect(config.bots).toBe(0);
    expect(config.domesticMode).toBeUndefined();
    expect(config.historicalAi).toBe(true);
    expect(config.disabledUnits).toContain(UnitType.AtomBomb);
  });

  it("a lobby created with a wrong map shows the 1936 map before any settings change", async () => {
    // As POST /api/create_game and the admin routes store it: unnormalized.
    const game = makeGame({
      config: {
        gameType: GameType.Private,
        worldWar1936: true,
        gameMap: GameMapType.Africa,
        bots: 400,
      },
    });
    const a = player("a");
    game.joinClient(a);
    await pick(a, "DEU"); // broadcasts lobby_info at once
    const infos = mockWsOf(a)
      .sent()
      .filter((m) => m.type === "lobby_info");
    const info = infos[infos.length - 1];
    expect(info.lobby.gameConfig?.gameMap).toBe(GameMapType.World1936);
    expect(info.lobby.gameConfig?.bots).toBe(0);
    startGame(game);
    expect(startMessage(a).gameStartInfo.config.gameMap).toBe(
      GameMapType.World1936,
    );
  });

  it("the start applies the mode whatever changed the config since", () => {
    const game = makeGame({
      config: { gameType: GameType.Private, worldWar1936: true },
    });
    game.gameConfig.gameMap = GameMapType.World;
    game.gameConfig.bots = 400;
    const a = player("a");
    game.joinClient(a);
    startGame(game);
    const config = startMessage(a).gameStartInfo.config;
    expect(config.gameMap).toBe(GameMapType.World1936);
    expect(config.bots).toBe(0);
  });

  it("a game without the mode starts on its own config", () => {
    const game = makeGame({
      config: { gameType: GameType.Private, gameMap: GameMapType.Europe },
    });
    const a = player("a");
    game.joinClient(a);
    startGame(game);
    const config = startMessage(a).gameStartInfo.config;
    expect(config.gameMap).toBe(GameMapType.Europe);
    expect(config.worldWar1936).toBeUndefined();
    expect(config.historicalAi).toBeUndefined();
  });

  it("a lobby created on the 1936 map without the mode plays the World map", () => {
    // The map only exists for the mode (as applyGameConfigPatch rules).
    const game = makeGame({
      config: { gameType: GameType.Private, gameMap: GameMapType.World1936 },
    });
    expect(game.gameConfig.gameMap).toBe(GameMapType.World);
    const a = player("a");
    game.joinClient(a);
    startGame(game);
    expect(startMessage(a).gameStartInfo.config.gameMap).toBe(
      GameMapType.World,
    );
  });
});
