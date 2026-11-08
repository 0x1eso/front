import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { ServerStartGameMessage } from "@openfront/shared/WireSchemas";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import { censorTelegram } from "../../src/server/Censor";
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

const pick = (c: Client, tag: GwTag | null) =>
  mockWsOf(c).emit({ type: "pick_seat", tag });

const startMessage = (c: Client): ServerStartGameMessage =>
  mockWsOf(c)
    .sent()
    .find((m): m is ServerStartGameMessage => m.type === "start")!;

const seatsOf = (c: Client) =>
  Object.fromEntries(
    startMessage(c).gameStartInfo.players.map((p) => [p.clientID, p.gwCountry]),
  );

describe("Great War 1914 seats on a private lobby", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const lobby = (config: Partial<GameConfig> = { greatWar1914: true }) => {
    const game = makeGame({
      config: { gameType: GameType.Private, ...config },
    });
    const a = player("a");
    const b = player("b");
    game.joinClient(a);
    game.joinClient(b);
    return { game, a, b };
  };

  it("takes tags COUNTRY_TAGS can't name, and refuses a held one", async () => {
    const { game, a, b } = lobby();
    await pick(a, "AUH");
    await pick(b, "AUH");
    expect(game.gameInfo().gwPicks).toEqual([
      { clientID: a.clientID, tag: "AUH" },
    ]);
    await pick(b, "RUS");
    expect(game.gameInfo().gwPicks).toHaveLength(2);
  });

  it("refuses a country that is no seat, and any pick in another mode", async () => {
    const { game, a } = lobby();
    await pick(a, "LUX");
    expect(game.gameInfo().gwPicks).toEqual([]);
    const other = lobby({});
    await pick(other.a, "DEU");
    expect(other.game.gameInfo().gwPicks).toBeUndefined();
  });

  it("stamps the seats on the start info", async () => {
    const { game, a, b } = lobby();
    await pick(a, "AUH");
    await pick(b, "RUS");
    await startGame(game);
    expect(seatsOf(a)).toEqual({ [a.clientID]: "AUH", [b.clientID]: "RUS" });
  });

  const save = new Uint8Array([1, 2, 3, 250]);
  const resume = (game: ReturnType<typeof lobby>["game"]) =>
    game.setGwResume(
      { seats: ["DEU", "RUS", "GBR"], chapter: 4, date: "1914-07-26" },
      save,
      { greatWar1914Calendar: "y1914" },
    );

  it("offers a resumed lobby only its saved seats", async () => {
    const { game, a } = lobby();
    expect(resume(game)).toBe(true);
    await pick(a, "AUH");
    expect(game.gameInfo().gwPicks).toEqual([]);
    await pick(a, "RUS");
    expect(game.gameInfo().gwPicks).toEqual([
      { clientID: a.clientID, tag: "RUS" },
    ]);
    expect(game.gameInfo().gwResume?.chapter).toBe(4);
  });

  it("gives who didn't pick a saved seat and sends the save with the start", async () => {
    const { game, a, b } = lobby();
    resume(game);
    await pick(b, "DEU");
    await startGame(game);
    expect(seatsOf(a)).toEqual({ [a.clientID]: "RUS", [b.clientID]: "DEU" });
    expect(startMessage(a).snapshot).toEqual(save);
    expect(startMessage(b).snapshot).toEqual(save);
  });

  it("won't take a save once the game has started", async () => {
    const { game } = lobby();
    await startGame(game);
    expect(resume(game)).toBe(false);
  });

  it("censors a telegram before the relay, and only a telegram's text", async () => {
    const { game, a } = lobby();
    await pick(a, "AUH");
    await startGame(game);
    game.handleIntent(
      {
        type: "gw_order",
        order: { kind: "telegram", to: "RUS", cipher: 0, text: "시발 벨기에" },
      },
      {
        clientID: a.clientID,
        isLobbyCreator: true,
        isAdmin: false,
        isAdminBot: false,
      },
    );
    const queued = (game as unknown as { intents: { order: unknown }[] })
      .intents;
    expect(queued[queued.length - 1].order).toMatchObject({
      text: "** 벨기에",
    });
  });
});

describe("censorTelegram", () => {
  it("leaves Korean alone", () => {
    const text = "니키, 벨기에는 건드리지 않겠네.\n약속하지.";
    expect(censorTelegram(text)).toBe(text);
  });

  it("stars out what the matcher finds and keeps the rest", () => {
    expect(censorTelegram("fuck 약속")).toBe("**** 약속");
    expect(censorTelegram("병신 같은 조약")).toBe("** 같은 조약");
  });

  it("keeps its length", () => {
    const text = "가".repeat(270) + " hitler";
    expect(censorTelegram(text)).toHaveLength(text.length);
  });
});

describe("the start message on the wire", () => {
  it("carries a save's bytes", () => {
    const players = [{ clientID: "AAAAAAA1", username: "aaa", clanTag: null }];
    const ctx = createGameWireContext(players);
    const snapshot = new Uint8Array(70_000).map((_, i) => i % 251);
    const bytes = encodeServerMessage(
      {
        type: "start",
        turns: [],
        lobbyCreatedAt: 1,
        gameStartInfo: {
          gameID: "ABCDEFGH",
          lobbyCreatedAt: 1,
          config: {
            ...makeGame({ config: { gameType: GameType.Private } }).gameInfo()
              .gameConfig!,
          },
          players,
        },
        snapshot,
      } as ServerStartGameMessage,
      ctx,
    );
    const back = decodeServerMessage(bytes, ctx) as ServerStartGameMessage;
    expect(back.snapshot).toEqual(snapshot);
  });
});
