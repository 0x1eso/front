// World War 1936, the unlimited game (design 2026-10-29): the lobby's
// slow-pace toggle, off by default, right after the historical AI toggle,
// which now starts off too; the host's choice copied to the game; the join
// summary names the game's length. Nothing of it without the mode.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
  prewarmCosmetics: vi.fn(async () => {}),
  fetchCosmetics: vi.fn(async () => null),
}));
vi.mock("../../../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    isOnCrazyGames: vi.fn(() => false),
    requestMidgameAd: vi.fn(async () => {}),
  },
}));
vi.mock("../../../src/client/TerrainMapFileLoader", () => ({
  terrainMapFileLoader: { getMapData: vi.fn() },
}));
vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => key,
}));
vi.mock("../../../src/client/DesktopPresence", () => ({
  desktopPresence: {
    isAvailable: vi.fn(() => false),
    openInviteDialog: vi.fn(async () => true),
    set: vi.fn(),
    consumePendingInvite: vi.fn(async () => null),
    subscribeInvites: vi.fn(() => () => undefined),
  },
}));
// The map cards load their data when scrolled into view; jsdom has no
// IntersectionObserver.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { GameConfig } from "@openfront/engine-api/Schemas";
import { normalizeWorldWar1936Config } from "@openfront/engine-lib/ww1936/ModeConfig";
import { render, TemplateResult } from "lit";
import type {
  GameConfigSettings,
  ToggleOptionConfig,
} from "../../../src/client/components/GameConfigSettings";
import { HostLobbyModal } from "../../../src/client/HostLobbyModal";
import "../../../src/client/SinglePlayerModal";
import { notableLobbySettings } from "../../../src/client/utilities/LobbySettingsSummary";
import { renderDuration } from "../../../src/client/Utils";
import { applyGameConfigPatch } from "../../../src/server/ConfigPatch";
import { testGameConfig } from "../../util/Wire";

const AI = "game_settings.historical_ai";
const UNLIMITED = "ww1936.lobby.unlimited";
const LENGTH = "private_lobby.game_length";

const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", { detail: { labelKey, checked } });

/** The option toggles a modal hands its settings, as rendered. */
async function toggles(modal: unknown): Promise<ToggleOptionConfig[]> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  render((modal as { renderBody(): TemplateResult }).renderBody(), container);
  const settings = container.querySelector<GameConfigSettings>(
    "game-config-settings",
  )!;
  await settings.updateComplete;
  return settings.settings!.options.toggles;
}

/** Both toggles off, the unlimited one right after the historical AI. */
function expectBothOffInOrder(list: ToggleOptionConfig[]): void {
  const keys = list.map((t) => t.labelKey);
  const ai = keys.indexOf(AI);
  expect(ai).toBeGreaterThanOrEqual(0);
  expect(keys[ai + 1]).toBe(UNLIMITED);
  expect(list[ai].checked).toBe(false);
  expect(list[ai + 1].checked).toBe(false);
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("the solo lobby", () => {
  const solo = (): any => document.createElement("single-player-modal");

  it("shows the toggle after the historical AI, both off; not without the mode", async () => {
    const modal = solo();
    expect((await toggles(modal)).map((t) => t.labelKey)).not.toContain(
      UNLIMITED,
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    expectBothOffInOrder(await toggles(modal));
  });

  it("starts timed with the historical AI off; checked, unlimited with no timer", async () => {
    const modal = solo();
    const configs: GameConfig[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    await modal.startGame();
    expect(configs[0]).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
      ww1936Unlimited: false,
      maxTimerValue: 45,
    });

    // (A start resets the lobby's options: the mode is turned on again.)
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    modal.handleConfigOptionToggleChanged(toggle(UNLIMITED, true));
    expect(
      (await toggles(modal)).find((t) => t.labelKey === UNLIMITED),
    ).toMatchObject({ checked: true });
    await modal.startGame();
    expect(configs[1].ww1936Unlimited).toBe(true);
    expect(configs[1].historicalAi).toBe(false);
    expect("maxTimerValue" in configs[1]).toBe(false);

    // The start reset it: the next game is timed again.
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    await modal.startGame();
    expect(configs[2].ww1936Unlimited).toBe(false);
    expect(configs[2].maxTimerValue).toBe(45);

    // Without the mode neither key is sent.
    await modal.startGame();
    expect(configs[3].ww1936Unlimited).toBeUndefined();
    expect(configs[3].historicalAi).toBeUndefined();
  });
});

describe("the host lobby", () => {
  function host(): any {
    const modal = new HostLobbyModal() as any;
    modal.lobbyId = "ABCD1234";
    modal.constructUrl = vi.fn(async () => "http://localhost/");
    modal.updateLobbyHistory = vi.fn();
    return modal;
  }

  async function sent(modal: any): Promise<any> {
    let config: any;
    const listener = (e: Event) => {
      config = (e as CustomEvent).detail.config;
    };
    modal.addEventListener("update-game-config", listener);
    await modal.putGameConfig();
    modal.removeEventListener("update-game-config", listener);
    return config;
  }

  it("shows the toggle after the historical AI, both off", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    expectBothOffInOrder(await toggles(modal));
  });

  it("sends both keys off by default; the toggle updates the lobby", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    expect(await sent(modal)).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
      ww1936Unlimited: false,
    });

    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleConfigOptionToggleChanged(toggle(UNLIMITED, true));
    expect(modal.ww1936Unlimited).toBe(true);
    expect(putGameConfig).toHaveBeenCalledTimes(1);
    delete modal.putGameConfig;
    expect((await sent(modal)).ww1936Unlimited).toBe(true);

    // Like the atomic-bomb key, it goes only with the mode.
    modal.worldWar1936 = false;
    expect((await sent(modal)).ww1936Unlimited).toBeUndefined();
  });

  it("closing the lobby turns both back off", () => {
    const modal = host();
    modal.leaveLobbyOnClose = false;
    modal.historicalAi = true;
    modal.ww1936Unlimited = true;
    modal.onClose();
    expect(modal.historicalAi).toBe(false);
    expect(modal.ww1936Unlimited).toBe(false);
  });
});

describe("the game it makes", () => {
  it("the server copies the host's choice and drops the timer", () => {
    const target = testGameConfig({ worldWar1936: true, maxTimerValue: 45 });
    applyGameConfigPatch(target, { worldWar1936: true, ww1936Unlimited: true });
    expect(target.ww1936Unlimited).toBe(true);
    expect("maxTimerValue" in target).toBe(false);
  });

  it("the join summary has one game-length row: unlimited, or 45 minutes timed", () => {
    const rows = (c: GameConfig) =>
      notableLobbySettings(c, null).filter((i) => i.label === LENGTH);
    const unlimited = [{ label: LENGTH, value: "ww1936.lobby.unlimited_on" }];
    expect(
      rows(testGameConfig({ worldWar1936: true, ww1936Unlimited: true })),
    ).toEqual(unlimited);
    expect(
      rows(
        normalizeWorldWar1936Config(
          testGameConfig({ worldWar1936: true, ww1936Unlimited: true }),
        ),
      ),
    ).toEqual(unlimited);
    // A timer value left on an unlimited config adds no second row.
    expect(
      rows(
        testGameConfig({
          worldWar1936: true,
          ww1936Unlimited: true,
          maxTimerValue: 45,
        }),
      ),
    ).toEqual(unlimited);
    // Timed: 45 minutes, as before.
    expect(
      rows(normalizeWorldWar1936Config(testGameConfig({ worldWar1936: true }))),
    ).toEqual([{ label: LENGTH, value: renderDuration(45 * 60) }]);
    // The key alone does nothing.
    expect(rows(testGameConfig({ ww1936Unlimited: true }))).toEqual([]);
  });
});
