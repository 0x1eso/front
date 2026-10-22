// @vitest-environment jsdom
import { GameMode } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { GameLeftSidebar } from "../src/client/hud/layers/GameLeftSidebar";
import type { PlayerStats } from "../src/client/hud/layers/PlayerStats";
import type { TeamStats } from "../src/client/hud/layers/TeamStats";
import { peaceUiOf } from "../src/client/hud/ww1936/PeaceModel";
import { WwDrawerEvent } from "../src/client/hud/ww1936/WwDrawer";
import { UserSettings } from "../src/client/UserSettings";
import type { GameView, PlayerView } from "../src/client/view";

describe("GameLeftSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("owns the player and team stats tables", async () => {
    const game = {
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.Team }),
        congress: () => false,
      }),
    } as unknown as GameView;
    const eventBus = new EventBus();
    const sidebar = new GameLeftSidebar();
    sidebar.game = game;
    sidebar.eventBus = eventBus;
    document.body.append(sidebar);

    await sidebar.updateComplete;

    const playerStats = sidebar.querySelector("player-stats");
    const teamStats = sidebar.querySelector("team-stats");
    expect(typeof (playerStats as PlayerStats).refresh).toBe("function");
    expect(typeof (teamStats as TeamStats).refresh).toBe("function");
    expect((playerStats as PlayerStats).game).toBe(game);
    expect((playerStats as PlayerStats).eventBus).toBe(eventBus);
    expect((teamStats as TeamStats).game).toBe(game);

    sidebar.remove();
  });

  it("renders the player stats table after toggling it", async () => {
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
    const game = {
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        maxTroops: () => 1_000,
        congress: () => false,
      }),
      gameID: () => "test-game",
      inSpawnPhase: () => false,
      myPlayer: () => player,
      numLandTiles: () => 100,
      ticks: () => 600,
      numTilesWithFallout: () => 0,
      playerViews: () => [player],
      worldWarScenario: () => null,
    } as unknown as GameView;
    const sidebar = new GameLeftSidebar();
    sidebar.game = game;
    sidebar.eventBus = new EventBus();
    document.body.append(sidebar);
    sidebar.init();
    await sidebar.updateComplete;

    (sidebar.querySelector('[role="button"]') as HTMLElement).click();
    await sidebar.updateComplete;

    const playerStats = sidebar.querySelector("player-stats") as PlayerStats;
    await playerStats.updateComplete;
    expect(playerStats.visible).toBe(true);
    expect(playerStats.querySelector(".stats-table")).not.toBeNull();

    expect(() => sidebar.tick()).not.toThrow();
    await playerStats.updateComplete;
    expect(playerStats.querySelector(".stats-table-row")).not.toBeNull();

    sidebar.remove();
  });

  it("stacks the player and team stats tables vertically at every width", async () => {
    const game = {
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.Team }),
        congress: () => false,
      }),
    } as unknown as GameView;
    const sidebar = new GameLeftSidebar();
    sidebar.game = game;
    sidebar.eventBus = new EventBus();
    document.body.append(sidebar);
    await sidebar.updateComplete;

    const wrapper = sidebar.querySelector("player-stats")?.parentElement;
    expect(wrapper?.classList).toContain("flex-col");
    expect(wrapper?.className).not.toMatch(/flex-wrap|lg:flex/);
    expect(sidebar.querySelector("team-stats")?.className).not.toContain(
      "lg:flex-initial",
    );

    sidebar.remove();
  });

  it("folds under an open World War drawer it would reach, and comes back", async () => {
    // A 667 px phone: the expanded board runs to x 379, the drawer starts
    // at the middle (334). The drawer is drawn over it; the board yields.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const game = {
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        maxTroops: () => 1_000,
        congress: () => false,
      }),
      gameID: () => "g",
      inSpawnPhase: () => false,
      myPlayer: () => null,
      numLandTiles: () => 100,
      ticks: () => 600,
      numTilesWithFallout: () => 0,
      playerViews: () => [],
      worldWarScenario: () => null,
    } as unknown as GameView;
    const bus = new EventBus();
    const sidebar = new GameLeftSidebar();
    sidebar.game = game;
    sidebar.eventBus = bus;
    document.body.append(sidebar);
    sidebar.init();
    // After spawn the board opens by default (spec §14a).
    sidebar.tick();
    await sidebar.updateComplete;
    const rect = (left: number, right: number) => () =>
      ({
        left,
        right,
        width: right - left,
        top: 0,
        bottom: 200,
        height: 200,
      }) as DOMRect;
    sidebar.querySelector("aside")!.getBoundingClientRect = rect(8, 379);
    const drawer = document.createElement("aside");
    drawer.setAttribute("data-ww-drawer", "industry");
    drawer.getBoundingClientRect = rect(334, 619);
    document.body.append(drawer);
    const shown = () =>
      !sidebar.querySelector("player-stats")!.classList.contains("hidden");
    expect(shown()).toBe(true);

    bus.emit(new WwDrawerEvent("industry", true));
    await sidebar.updateComplete;
    expect(shown()).toBe(false);
    // Switching drawers keeps it folded (one closes as the other opens).
    bus.emit(new WwDrawerEvent("industry", false));
    bus.emit(new WwDrawerEvent("research", true));
    await sidebar.updateComplete;
    expect(shown()).toBe(false);
    // Closed: the board is back, still expanded by default.
    bus.emit(new WwDrawerEvent("research", false));
    await sidebar.updateComplete;
    expect(shown()).toBe(true);

    // Its button brings it back over an open drawer.
    bus.emit(new WwDrawerEvent("industry", true));
    await sidebar.updateComplete;
    expect(shown()).toBe(false);
    (sidebar.querySelector('[role="button"]') as HTMLElement).click();
    await sidebar.updateComplete;
    expect(shown()).toBe(true);
    bus.emit(new WwDrawerEvent("industry", false));
    await sidebar.updateComplete;

    // A wide screen: the drawer starts right of the board; nothing folds.
    drawer.getBoundingClientRect = rect(712, 1132);
    bus.emit(new WwDrawerEvent("industry", true));
    await sidebar.updateComplete;
    expect(shown()).toBe(true);

    drawer.remove();
    sidebar.remove();
    vi.unstubAllGlobals();
  });

  it("folds while the peace conference map mode is on, on a phone", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const innerHeight = window.innerHeight;
    const game = {
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        maxTroops: () => 1_000,
        congress: () => false,
      }),
      gameID: () => "g",
      inSpawnPhase: () => false,
      myPlayer: () => null,
      numLandTiles: () => 100,
      ticks: () => 600,
      numTilesWithFallout: () => 0,
      playerViews: () => [],
      worldWarScenario: () => ({}),
    } as unknown as GameView;
    const bus = new EventBus();
    const sidebar = new GameLeftSidebar();
    sidebar.game = game;
    sidebar.eventBus = bus;
    document.body.append(sidebar);
    sidebar.init();
    sidebar.tick();
    await sidebar.updateComplete;
    const shown = () =>
      !sidebar.querySelector("player-stats")!.classList.contains("hidden");
    expect(shown()).toBe(true);

    // A landscape phone (390 px tall): the map mode opens and closes the drawers.
    Object.defineProperty(window, "innerHeight", {
      value: 390,
      configurable: true,
    });
    const ui = peaceUiOf(game);
    ui.openMap();
    bus.emit(new WwDrawerEvent("industry", true));
    bus.emit(new WwDrawerEvent("industry", false));
    await sidebar.updateComplete;
    expect(shown()).toBe(false);
    // Its button brings it back for this map mode.
    (sidebar.querySelector('[role="button"]') as HTMLElement).click();
    await sidebar.updateComplete;
    expect(shown()).toBe(true);
    sidebar.tick();
    await sidebar.updateComplete;
    expect(shown()).toBe(true);
    // Leaving the map mode, then opening it again: it folds again.
    ui.closeMap();
    sidebar.tick();
    ui.openMap();
    sidebar.tick();
    await sidebar.updateComplete;
    expect(shown()).toBe(false);
    ui.closeMap();
    sidebar.tick();
    await sidebar.updateComplete;
    expect(shown()).toBe(true);

    // A taller screen: the map mode leaves it alone.
    Object.defineProperty(window, "innerHeight", {
      value: 900,
      configurable: true,
    });
    ui.openMap();
    sidebar.tick();
    await sidebar.updateComplete;
    expect(shown()).toBe(true);

    Object.defineProperty(window, "innerHeight", {
      value: innerHeight,
      configurable: true,
    });
    sidebar.remove();
    vi.unstubAllGlobals();
  });
});
