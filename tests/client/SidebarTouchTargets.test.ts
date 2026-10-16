import { GameMode, GameType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { beforeEach, describe, expect, it } from "vitest";
import "../../src/client/hud/layers/GameLeftSidebar";
import type { GameLeftSidebar } from "../../src/client/hud/layers/GameLeftSidebar";
import "../../src/client/hud/layers/GameRightSidebar";
import type { GameRightSidebar } from "../../src/client/hud/layers/GameRightSidebar";
import { PauseGameIntentEvent } from "../../src/client/Transport";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";

function rightGame(gameType: GameType): GameView {
  const config = {
    gameConfig: () => ({ gameType, maxTimerValue: undefined }),
    doomsdayClockConfig: () => ({ enabled: false }),
    overtimeConfig: () => ({ enabled: false, startMinutes: 0 }),
    isReplay: () => false,
    listed: false,
  };
  return {
    config: () => config,
    inSpawnPhase: () => false,
    elapsedGameSeconds: () => 0,
    myPlayer: () => undefined,
    gameID: () => "test-game",
  } as unknown as GameView;
}

async function mountRight(gameType: GameType): Promise<GameRightSidebar> {
  const el = document.createElement("game-right-sidebar") as GameRightSidebar;
  el.game = rightGame(gameType);
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  await el.updateComplete;
  return el;
}

function setFullscreenEnabled(value: boolean): void {
  Object.defineProperty(document, "fullscreenEnabled", {
    value,
    configurable: true,
  });
}

describe("top-right sidebar on a tablet", () => {
  beforeEach(() => setFullscreenEnabled(true));

  it("every control is a plain button at the original 20px icon size", async () => {
    const el = await mountRight(GameType.Singleplayer);
    const ids = [...el.querySelectorAll<HTMLElement>("aside button")].map(
      (b) => b.dataset.sidebar,
    );
    expect(ids).toEqual(["replay", "pause", "settings", "fullscreen", "exit"]);
    for (const b of el.querySelectorAll("aside button")) {
      expect(b.classList.contains("size-11")).toBe(false);
      expect(b.querySelector("img")!.getAttribute("width")).toBe("20");
    }
    expect(
      el.querySelectorAll("aside .cursor-pointer:not(button)"),
    ).toHaveLength(0);
  });

  it("the pause button pauses a single-player game", async () => {
    const el = await mountRight(GameType.Singleplayer);
    const paused: boolean[] = [];
    el.eventBus.on(PauseGameIntentEvent, (e) => paused.push(e.paused));

    el.querySelector<HTMLButtonElement>('[data-sidebar="pause"]')!.click();

    expect(paused).toEqual([true]);
  });

  it("offers no fullscreen button where the browser has none", async () => {
    setFullscreenEnabled(false);
    const el = await mountRight(GameType.Singleplayer);
    expect(el.querySelector('[data-sidebar="fullscreen"]')).toBeNull();
  });
});

function richLeftGame(): GameView {
  const player = {
    id: () => "player-1",
    smallID: () => 0,
    name: () => "Player 1",
    displayName: () => "Player 1",
    clanTag: () => null,
    numTilesOwned: () => 10,
    gold: () => 100n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
    team: () => null,
  } as unknown as PlayerView;
  return {
    config: () => ({
      gameConfig: () => ({ gameMode: GameMode.FFA }),
      maxTroops: () => 1_000,
    }),
    gameID: () => "test-game",
    inSpawnPhase: () => false,
    myPlayer: () => player,
    numLandTiles: () => 100,
    ticks: () => 600,
    numTilesWithFallout: () => 0,
    playerViews: () => [player],
  } as unknown as GameView;
}

describe("top-left sidebar on a tablet", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("its toggles keep the original 20px icons", async () => {
    const el = document.createElement("game-left-sidebar") as GameLeftSidebar;
    el.game = {
      config: () => ({ gameConfig: () => ({ gameMode: GameMode.Team }) }),
    } as unknown as GameView;
    el.eventBus = new EventBus();
    document.body.appendChild(el);
    await el.updateComplete;

    const toggles = [...el.querySelectorAll('[role="button"]')];
    expect(toggles).toHaveLength(2);
    for (const t of toggles) {
      expect(t.classList.contains("size-11")).toBe(false);
      expect(t.querySelector("img")!.getAttribute("width")).toBe("20");
    }
  });

  it("opens the leaderboard after spawn at any width", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 900,
      configurable: true,
      writable: true,
    });
    const el = document.createElement("game-left-sidebar") as GameLeftSidebar;
    el.game = richLeftGame();
    el.eventBus = new EventBus();
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;

    expect(
      (el as unknown as { isPlayerStatsShown: boolean }).isPlayerStatsShown,
    ).toBe(true);
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
      writable: true,
    });
  });
});
