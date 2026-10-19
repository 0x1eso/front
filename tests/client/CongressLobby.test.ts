import { describe, expect, it, vi } from "vitest";
import { testGameConfig } from "../util/Wire";

vi.mock("../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
}));
vi.mock("../../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    isOnCrazyGames: vi.fn(() => false),
    requestMidgameAd: vi.fn(async () => {}),
  },
}));
vi.mock("../../src/client/TerrainMapFileLoader", () => ({
  terrainMapFileLoader: { getMapData: vi.fn() },
}));
vi.mock("../../src/client/DesktopPresence", () => ({
  desktopPresence: {
    isAvailable: vi.fn(() => false),
    openInviteDialog: vi.fn(async () => true),
    set: vi.fn(),
    consumePendingInvite: vi.fn(async () => null),
    subscribeInvites: vi.fn(() => () => undefined),
  },
}));

import { GameMode } from "@openfront/engine-api/game/GameTypes";
import { HostLobbyModal } from "../../src/client/HostLobbyModal";
import "../../src/client/SinglePlayerModal";
import { notableLobbySettings } from "../../src/client/utilities/LobbySettingsSummary";

const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", {
    detail: { labelKey, checked },
  });

describe("the world congress in the lobby", () => {
  it("solo: comes on with domestic mode, can be turned off, and is FFA only", async () => {
    const modal = document.createElement("single-player-modal") as any;
    const configs: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    await modal.startGame();
    expect(configs[0].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", true),
    );
    expect(modal.congress).toBe(true);
    await modal.startGame();
    expect(configs[1]).toMatchObject({ domesticMode: true, congress: true });

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.congress", false),
    );
    await modal.startGame();
    expect(configs[2].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.congress", true),
    );
    modal.gameMode = GameMode.Team;
    await modal.startGame();
    expect(configs[3].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", false),
    );
    expect(modal.congress).toBe(false);
  });

  it("host: domestic mode turns it on, the toggle updates the lobby", () => {
    const modal = new HostLobbyModal() as any;
    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", true),
    );
    expect(modal.congress).toBe(true);
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.congress", false),
    );
    expect(modal.congress).toBe(false);
    expect(putGameConfig).toHaveBeenCalledTimes(2);
  });

  it("the lobby summary lists it only when on with domestic mode and FFA", () => {
    const label = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null).map((i) => i.label);
    expect(
      label(testGameConfig({ domesticMode: true, congress: true })),
    ).toContain("game_settings.congress");
    expect(label(testGameConfig({ congress: true }))).not.toContain(
      "game_settings.congress",
    );
    expect(label(testGameConfig())).not.toContain("game_settings.congress");
    expect(
      label(
        testGameConfig({
          domesticMode: true,
          congress: true,
          gameMode: GameMode.Team,
        }),
      ),
    ).not.toContain("game_settings.congress");
  });
});
