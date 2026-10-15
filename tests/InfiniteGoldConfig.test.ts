import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { PlayerLike } from "@openfront/engine-api/game/ReadViews";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { describe, expect, it } from "vitest";

function config(over: Partial<GameConfig>): Config {
  return new Config(
    { infiniteGold: false, ...over } as unknown as GameConfig,
    false,
  );
}

function player(type: PlayerType, lobbyCreator = false): PlayerLike {
  return {
    type: () => type,
    isLobbyCreator: () => lobbyCreator,
  } as unknown as PlayerLike;
}

// The client's Config (engine-lib) answers like the engine's, so the
// domestic panel shows what the engine will charge.
describe("Config.hasInfiniteGold", () => {
  it("the lobby setting: every human, never a nation or bot", () => {
    const c = config({ infiniteGold: true });
    expect(c.hasInfiniteGold(player(PlayerType.Human))).toBe(true);
    expect(c.hasInfiniteGold(player(PlayerType.Nation))).toBe(false);
    expect(c.hasInfiniteGold(player(PlayerType.Bot))).toBe(false);
  });

  it("the host cheat: the lobby creator only", () => {
    const c = config({ hostCheats: { infiniteGold: true } } as never);
    expect(c.hasInfiniteGold(player(PlayerType.Human, true))).toBe(true);
    expect(c.hasInfiniteGold(player(PlayerType.Human, false))).toBe(false);
  });

  it("off by default", () => {
    expect(config({}).hasInfiniteGold(player(PlayerType.Human, true))).toBe(
      false,
    );
  });
});
