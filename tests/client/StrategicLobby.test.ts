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

import { HostLobbyModal } from "../../src/client/HostLobbyModal";
import "../../src/client/SinglePlayerModal";
import { notableLobbySettings } from "../../src/client/utilities/LobbySettingsSummary";

const toggle = (checked: boolean) =>
  new CustomEvent("option-toggle-changed", {
    detail: { labelKey: "game_settings.strategic_weapons", checked },
  });

describe("strategic weapons in the lobby", () => {
  it("solo: off by default, on when toggled", async () => {
    const modal = document.createElement("single-player-modal") as any;
    const configs: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    await modal.startGame();
    expect(configs[0].strategicWeapons).toBeUndefined();

    modal.handleConfigOptionToggleChanged(toggle(true));
    expect(modal.strategicWeapons).toBe(true);
    await modal.startGame();
    expect(configs[1].strategicWeapons).toBe(true);
  });

  it("host: the toggle updates the lobby", () => {
    const modal = new HostLobbyModal() as any;
    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleConfigOptionToggleChanged(toggle(true));
    expect(modal.strategicWeapons).toBe(true);
    expect(putGameConfig).toHaveBeenCalledOnce();
  });

  it("the lobby summary lists it only when on", () => {
    const label = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null).map((i) => i.label);
    // No language selector in jsdom: translateText returns the key.
    expect(label(testGameConfig({ strategicWeapons: true }))).toContain(
      "game_settings.strategic_weapons",
    );
    expect(label(testGameConfig())).not.toContain(
      "game_settings.strategic_weapons",
    );
  });
});
