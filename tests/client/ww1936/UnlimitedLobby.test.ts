// World War 1936, the game length (design 2026-10-29 + w53): the lobby's
// three choices (50 minutes, unlimited slow, unlimited fast), timed by
// default; the historical AI toggle starts off; the host's choice copied to
// the game; the join summary names the length. Nothing of it without the mode.
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
const LENGTH = "private_lobby.game_length";

const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", { detail: { labelKey, checked } });

/** The option toggles a modal hands its settings, as rendered. */
async function settingsOf(modal: unknown): Promise<GameConfigSettings> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  render((modal as { renderBody(): TemplateResult }).renderBody(), container);
  const settings = container.querySelector<GameConfigSettings>(
    "game-config-settings",
  )!;
  await settings.updateComplete;
  return settings;
}

async function toggles(modal: unknown): Promise<ToggleOptionConfig[]> {
  return (await settingsOf(modal)).settings!.options.toggles;
}

/** The length cards a lobby shows and the one it marks as chosen. */
async function lengthOf(modal: unknown): Promise<string | undefined> {
  return (await settingsOf(modal)).settings!.worldWar?.length;
}

const pick = (length: string) =>
  new CustomEvent("ww-length-selected", { detail: { length } });

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("the solo lobby", () => {
  const solo = (): any => document.createElement("single-player-modal");

  it("offers the three lengths in the mode only, timed chosen; the historical AI starts off", async () => {
    const modal = solo();
    expect(await lengthOf(modal)).toBeUndefined();
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    expect(await lengthOf(modal)).toBe("timed");
    const list = await toggles(modal);
    expect(list.find((t) => t.labelKey === AI)?.checked).toBe(false);
    expect(list.map((t) => t.labelKey)).not.toContain("ww1936.lobby.unlimited");
    const settings = await settingsOf(modal);
    expect(
      [...settings.querySelectorAll("[data-ww-length-option]")].map((e) =>
        e.getAttribute("data-ww-length-option"),
      ),
    ).toEqual(["timed", "slow", "fast"]);
  });

  it("starts timed; slow and fast send their keys and no timer; the start resets it", async () => {
    const modal = solo();
    const configs: GameConfig[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    const wwOn = () =>
      modal.handleConfigOptionToggleChanged(
        toggle("game_settings.world_war_1936", true),
      );
    wwOn();
    await modal.startGame();
    expect(configs[0]).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
      ww1936Unlimited: false,
      maxTimerValue: 50,
    });
    expect(configs[0].ww1936FastTempo).toBeUndefined();

    // (A start resets the lobby's options: the mode is turned on again.)
    wwOn();
    modal.handleWwLengthSelected(pick("slow"));
    expect(await lengthOf(modal)).toBe("slow");
    await modal.startGame();
    expect(configs[1].ww1936Unlimited).toBe(true);
    expect(configs[1].ww1936FastTempo).toBeUndefined();
    expect("maxTimerValue" in configs[1]).toBe(false);

    wwOn();
    modal.handleWwLengthSelected(pick("fast"));
    expect(await lengthOf(modal)).toBe("fast");
    await modal.startGame();
    expect(configs[2]).toMatchObject({
      ww1936Unlimited: true,
      ww1936FastTempo: true,
    });
    expect("maxTimerValue" in configs[2]).toBe(false);

    // The start reset it: the next game is timed again.
    wwOn();
    await modal.startGame();
    expect(configs[3].ww1936Unlimited).toBe(false);
    expect(configs[3].maxTimerValue).toBe(50);

    // Without the mode no key is sent.
    await modal.startGame();
    expect(configs[4].ww1936Unlimited).toBeUndefined();
    expect(configs[4].ww1936FastTempo).toBeUndefined();
    expect(configs[4].historicalAi).toBeUndefined();
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

  it("offers the three lengths, timed chosen", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    expect(await lengthOf(modal)).toBe("timed");
  });

  it("sends the keys of the chosen length; a choice updates the lobby; only with the mode", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    expect(await sent(modal)).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
      ww1936Unlimited: false,
      ww1936FastTempo: false,
    });

    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleWwLengthSelected(pick("fast"));
    expect(putGameConfig).toHaveBeenCalledTimes(1);
    delete modal.putGameConfig;
    expect(await sent(modal)).toMatchObject({
      ww1936Unlimited: true,
      ww1936FastTempo: true,
    });
    expect(await lengthOf(modal)).toBe("fast");

    modal.handleWwLengthSelected(pick("slow"));
    expect(await sent(modal)).toMatchObject({
      ww1936Unlimited: true,
      ww1936FastTempo: false,
    });

    modal.worldWar1936 = false;
    const off = await sent(modal);
    expect(off.ww1936Unlimited).toBeUndefined();
    expect(off.ww1936FastTempo).toBeUndefined();
  });

  it("closing the lobby turns the length back to timed", () => {
    const modal = host();
    modal.leaveLobbyOnClose = false;
    modal.historicalAi = true;
    modal.ww1936Unlimited = true;
    modal.ww1936FastTempo = true;
    modal.onClose();
    expect(modal.historicalAi).toBe(false);
    expect(modal.ww1936Unlimited).toBe(false);
    expect(modal.ww1936FastTempo).toBe(false);
  });
});

describe("the game it makes", () => {
  it("the server copies the host's choice and drops the timer", () => {
    const target = testGameConfig({ worldWar1936: true, maxTimerValue: 50 });
    applyGameConfigPatch(target, {
      worldWar1936: true,
      ww1936Unlimited: true,
      ww1936FastTempo: true,
    });
    expect(target.ww1936Unlimited).toBe(true);
    expect(target.ww1936FastTempo).toBe(true);
    expect("maxTimerValue" in target).toBe(false);
    applyGameConfigPatch(target, { ww1936FastTempo: false });
    expect(target.ww1936FastTempo).toBe(false);
  });

  it("the join summary has one game-length row: unlimited, or 50 minutes timed", () => {
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
    // The fast one names its own tempo.
    expect(
      rows(
        testGameConfig({
          worldWar1936: true,
          ww1936Unlimited: true,
          ww1936FastTempo: true,
        }),
      ),
    ).toEqual([{ label: LENGTH, value: "ww1936.lobby.unlimited_fast_on" }]);
    // A timer value left on an unlimited config adds no second row.
    expect(
      rows(
        testGameConfig({
          worldWar1936: true,
          ww1936Unlimited: true,
          maxTimerValue: 50,
        }),
      ),
    ).toEqual(unlimited);
    // Timed: 50 minutes, as before.
    expect(
      rows(normalizeWorldWar1936Config(testGameConfig({ worldWar1936: true }))),
    ).toEqual([{ label: LENGTH, value: renderDuration(50 * 60) }]);
    // The key alone does nothing.
    expect(rows(testGameConfig({ ww1936Unlimited: true }))).toEqual([]);
  });
});
