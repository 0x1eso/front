import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { SnapshotHeader } from "@openfront/engine-api/game/SnapshotHeader";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
  prewarmCosmetics: vi.fn(async () => {}),
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

vi.mock("../../src/client/SavedGamesApi", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadSavedGame: vi.fn(async () => new Uint8Array([1])),
}));

const worker = vi.hoisted(() => ({ readSnapshotHeader: vi.fn() }));
vi.mock("../../src/client/WorkerClient", () => ({
  readSnapshotHeader: worker.readSnapshotHeader,
}));

const dialogs = vi.hoisted(() => ({
  showInGameAlert: vi.fn(async () => true),
  showInGameConfirm: vi.fn(async () => true),
}));
vi.mock("../../src/client/InGameModal", () => dialogs);

const offlineMaps = vi.hoisted(() => ({
  mapPlayableOffline: vi.fn(async () => false),
}));
vi.mock("../../src/client/pwa/OfflineMaps", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  mapPlayableOffline: offlineMaps.mapPlayableOffline,
}));

import { setOffline } from "../../src/client/pwa/OfflineState";
import "../../src/client/SinglePlayerModal";

const HEADER = {
  format: 1,
  gitCommit: "abc123",
  gameID: "origGame",
  tick: 4200,
  gameConfig: {
    gameMap: GameMapType.World1936,
    difficulty: Difficulty.Hard,
    donateGold: false,
    donateTroops: false,
    gameType: GameType.Singleplayer,
    gameMode: GameMode.FFA,
    gameMapSize: GameMapSize.Normal,
    nations: "default",
    bots: 0,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
  },
  humans: [{ clientID: "SAVEDCID", name: "TheSaver" }],
} as unknown as SnapshotHeader;

function createModal(): { modal: any; events: unknown[] } {
  const modal = document.createElement("single-player-modal") as any;
  const events: unknown[] = [];
  modal.addEventListener("join-lobby", (e: Event) =>
    events.push((e as CustomEvent).detail),
  );
  return { modal, events };
}

describe("starting a solo game offline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worker.readSnapshotHeader.mockResolvedValue(HEADER);
  });

  afterEach(() => setOffline(false));

  it("refuses a map this browser has not kept, and says how to get it", async () => {
    setOffline(true);
    offlineMaps.mapPlayableOffline.mockResolvedValue(false);
    const { modal, events } = createModal();

    await modal.startSavedGame("abcdefghijklmnopqrstuv", false);

    expect(offlineMaps.mapPlayableOffline).toHaveBeenCalledWith(
      HEADER.gameConfig,
    );
    expect(events).toEqual([]);
    expect(dialogs.showInGameAlert).toHaveBeenCalledWith("pwa.map_not_offline");
    expect(modal.starting).toBe(false);
  });

  it("starts on a map it has", async () => {
    setOffline(true);
    offlineMaps.mapPlayableOffline.mockResolvedValue(true);
    const { modal, events } = createModal();

    await modal.startSavedGame("abcdefghijklmnopqrstuv", false);

    expect(events).toHaveLength(1);
    expect(dialogs.showInGameAlert).not.toHaveBeenCalled();
  });

  it("online, it does not look: the map comes from the network", async () => {
    const { modal, events } = createModal();

    await modal.startSavedGame("abcdefghijklmnopqrstuv", false);

    expect(offlineMaps.mapPlayableOffline).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });
});
