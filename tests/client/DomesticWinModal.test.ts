import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCosmetics } from "../../src/client/Cosmetics";
import "../../src/client/hud/layers/WinModal";
import type { WinModal } from "../../src/client/hud/layers/WinModal";
import type { GameView } from "../../src/client/view";

vi.mock("../../src/client/Utils", () => ({
  translateText: vi.fn((key: string) => key),
  getTranslatedPlayerTeamLabel: vi.fn((team: string | null) => team ?? ""),
  getGamesPlayed: vi.fn(() => 10),
  isInIframe: vi.fn(() => false),
  homeHref: vi.fn(() => "/"),
  TUTORIAL_VIDEO_URL: "https://example.com/tutorial",
}));

vi.mock("../../src/client/Api", () => ({
  getUserMe: vi.fn(async () => null),
}));

vi.mock("../../src/client/Cosmetics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Cosmetics")>()),
  fetchCosmetics: vi.fn(async () => null),
  resolveCosmetics: vi.fn(() => []),
}));

vi.mock("../../src/client/GamePortal", () => ({
  gamePortal: {
    happytime: vi.fn(),
    gameplayStop: vi.fn(),
  },
}));

function makeGame(reason: string | undefined): GameView {
  const winUpdate = {
    winner: ["team", "Blue"],
    allPlayersStats: {},
    ...(reason === undefined ? {} : { reason }),
  };
  return {
    myPlayer: () => ({
      isAlive: () => true,
      hasSpawned: () => true,
      team: () => "Blue",
      clientID: () => null,
    }),
    inSpawnPhase: () => false,
    updatesSinceLastTick: () => ({ [GameUpdateType.Win]: [winUpdate] }),
    playerByClientID: () => undefined,
    config: () => ({
      gameConfig: () => ({ rankedType: undefined }),
      isReplay: () => false,
    }),
  } as unknown as GameView;
}

describe("WinModal win reason", () => {
  let modal: WinModal | undefined;

  function open(game: GameView): WinModal {
    // A visible modal activates steam-wishlist, which observes its own size;
    // jsdom has no ResizeObserver.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.mocked(fetchCosmetics).mockReturnValueOnce(new Promise(() => {}));
    const m = document.createElement("win-modal") as WinModal;
    m.game = game;
    m.eventBus = new EventBus();
    document.body.appendChild(m);
    m.tick();
    return m;
  }

  afterEach(() => {
    modal?.remove();
    modal = undefined;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows why the game was won", async () => {
    modal = open(makeGame("science"));
    await vi.waitFor(() =>
      expect(
        modal!.querySelector("[data-win-reason]")?.textContent?.trim(),
      ).toBe("domestic.win_reason.science"),
    );
  });

  it("shows no reason for vanilla wins", async () => {
    modal = open(makeGame(undefined));
    await vi.waitFor(() => expect(modal!.isVisible).toBe(true));
    await modal.updateComplete;
    expect(modal.querySelector("[data-win-reason]")).toBeNull();
  });
});
