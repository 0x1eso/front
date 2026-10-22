// @vitest-environment jsdom
// World War 1936 P6 (spec §9.8, plan decision 21): the lobby's atomic-bomb
// key — on by default in the mode, the host's choice copied to the game,
// shown in the join summary; nothing of it without the mode.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
  prewarmCosmetics: vi.fn(async () => {}),
  fetchCosmetics: vi.fn(async () => null),
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
vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => key,
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
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  applyWorldWar1936Rules,
  normalizeWorldWar1936Config,
} from "@openfront/engine-lib/ww1936/ModeConfig";
import "../../src/client/SinglePlayerModal";
import { notableLobbySettings } from "../../src/client/utilities/LobbySettingsSummary";
import { applyGameConfigPatch } from "../../src/server/ConfigPatch";
import { testGameConfig } from "../util/Wire";

const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", { detail: { labelKey, checked } });

describe("the atomic-bomb lobby key", () => {
  it("the solo lobby: on by default in the mode, off when toggled", async () => {
    const modal = document.createElement("single-player-modal") as any;
    const configs: GameConfig[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    await modal.startGame();
    expect(configs[0].ww1936Nukes).toBe(true);
    // (A start resets the lobby's options: the mode is turned on again.)
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    modal.handleConfigOptionToggleChanged(toggle("ww1936.lobby.nukes", false));
    await modal.startGame();
    expect(configs[1].ww1936Nukes).toBe(false);
    // Without the mode the key is not sent.
    await modal.startGame();
    expect(configs[2].ww1936Nukes).toBeUndefined();
  });

  it("the mode fills it on; off stays off; without the mode, the same object", () => {
    const on = testGameConfig({ worldWar1936: true });
    applyWorldWar1936Rules(on);
    expect(on.ww1936Nukes).toBe(true);
    const off = testGameConfig({ worldWar1936: true, ww1936Nukes: false });
    applyWorldWar1936Rules(off);
    expect(off.ww1936Nukes).toBe(false);
    const vanilla = testGameConfig({});
    expect(normalizeWorldWar1936Config(vanilla)).toBe(vanilla);
    expect(vanilla.ww1936Nukes).toBeUndefined();
  });

  it("the server copies the host's choice", () => {
    const target = testGameConfig({ worldWar1936: true });
    applyGameConfigPatch(target, { worldWar1936: true, ww1936Nukes: false });
    expect(target.ww1936Nukes).toBe(false);
  });

  it("the join summary shows it", () => {
    const items = notableLobbySettings(
      testGameConfig({ worldWar1936: true, ww1936Nukes: false }),
      null,
    );
    const line = items.find((i) => i.label === "ww1936.lobby.nukes");
    expect(line?.value).toBe("ww1936.lobby.nukes_off");
  });
});
