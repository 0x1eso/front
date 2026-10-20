import { afterEach, describe, expect, it, vi } from "vitest";

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
// Untranslated keys come back as the key; a message's parameters are appended
// so a test can see them (the real messages come from resources/lang).
vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? key : `${key} ${Object.values(params).join(" ")}`,
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

import {
  Difficulty,
  GameMapType,
  GameMode,
  maps,
} from "@openfront/engine-api/game/GameTypes";
import { MAJOR_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { EventBus } from "@openfront/shared/EventBus";
import { GameInfo, LobbyInfoEvent } from "@openfront/shared/WireSchemas";
import { html, render, TemplateResult } from "lit";
import "../../src/client/components/GameConfigSettings";
import type {
  GameConfigSettings,
  GameConfigSettingsData,
} from "../../src/client/components/GameConfigSettings";
import "../../src/client/components/map/MapPicker";
import type { MapPicker } from "../../src/client/components/map/MapPicker";
import "../../src/client/components/ww1936/CountryPicker";
import type { CountryPicker } from "../../src/client/components/ww1936/CountryPicker";
import { HostLobbyModal } from "../../src/client/HostLobbyModal";
import { JoinLobbyModal } from "../../src/client/JoinLobbyModal";
import { SendPickCountryEvent } from "../../src/client/LobbyEvents";
import "../../src/client/SinglePlayerModal";
import { getRandomMapType } from "../../src/client/utilities/GameConfigHelpers";
import { notableLobbySettings } from "../../src/client/utilities/LobbySettingsSummary";
import { testGameConfig } from "../util/Wire";

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

async function picker(): Promise<CountryPicker> {
  const el = document.createElement("ww-country-picker") as CountryPicker;
  el.myClientID = "A";
  el.picks = [{ clientID: "B", tag: "DEU" }];
  el.usernames = new Map([["B", "bob"]]);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", {
    detail: { labelKey, checked },
  });

/** Renders a modal's body into the page and waits for its settings. */
async function body(modal: unknown): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  render((modal as { renderBody(): TemplateResult }).renderBody(), container);
  await container.querySelector<GameConfigSettings>("game-config-settings")
    ?.updateComplete;
  await container.querySelector<CountryPicker>("ww-country-picker")
    ?.updateComplete;
  return container;
}

const tap = (root: ParentNode, tag: string) =>
  root.querySelector<HTMLButtonElement>(`button[data-tag="${tag}"]`)!.click();

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("<ww-country-picker> (spec §8.1)", () => {
  it("shows the seven majors first, then every country by region", async () => {
    const el = await picker();
    const tags = [
      ...el.querySelectorAll<HTMLButtonElement>("button[data-tag]"),
    ].map((b) => b.dataset.tag);
    expect(tags.slice(0, 7)).toEqual([...MAJOR_TAGS]);
    // Every country once: the majors as cards, the rest in their region.
    expect(tags).toHaveLength(79);
    expect(new Set(tags).size).toBe(79);
    expect(el.querySelectorAll("[data-group]")).toHaveLength(4);
  });

  it("a country someone else holds is greyed out with their name", async () => {
    const el = await picker();
    const deu = el.querySelector<HTMLButtonElement>('button[data-tag="DEU"]')!;
    expect(deu.disabled).toBe(true);
    expect(deu.textContent).toContain("bob");
  });

  it("tapping a free country picks it, tapping it again gives it up", async () => {
    const el = await picker();
    const seen: (string | null)[] = [];
    el.addEventListener("country-picked", (e) =>
      seen.push((e as CustomEvent<{ tag: string | null }>).detail.tag),
    );
    tap(el, "GBR");
    el.selected = "GBR";
    await el.updateComplete;
    tap(el, "GBR");
    expect(seen).toEqual(["GBR", null]);
  });
});

describe("the World 1936 map outside its mode", () => {
  it("is never the random map", () => {
    for (let i = 0; i < 200; i++) {
      vi.spyOn(Math, "random").mockReturnValueOnce(i / 200);
      expect(getRandomMapType()).not.toBe(GameMapType.World1936);
    }
  });

  it("is not offered by the map picker, not even by search", async () => {
    const world1936 = maps.find((m) => m.type === GameMapType.World1936)!;
    // "world" would find it by its id, beside World and World Inverted.
    for (const searchQuery of ["", "world"]) {
      const el = document.createElement("map-picker") as MapPicker;
      el.searchQuery = searchQuery;
      document.body.appendChild(el);
      await el.updateComplete;
      const shown = [...el.querySelectorAll("map-display")].map(
        (d) => (d as unknown as { mapKey: string }).mapKey,
      );
      expect(shown.length).toBeGreaterThan(0);
      expect(shown).not.toContain(world1936.id);
      el.remove();
    }
  });
});

describe("the settings layout with the mode on", () => {
  const settings = (worldWar?: { picker: TemplateResult }) =>
    ({
      map: { selected: GameMapType.World, useRandom: false },
      difficulty: { selected: testGameConfig().difficulty, disabled: false },
      gameMode: { selected: GameMode.Team },
      teamCount: { selected: 2 },
      options: {
        titleKey: "game_settings.options",
        bots: {
          value: 400,
          labelKey: "game_settings.bots",
          disabledKey: "common.disabled",
        },
        nations: {
          value: 10,
          labelKey: "game_settings.nations",
          disabledKey: "common.disabled",
        },
        toggles: [],
        inputCards: [],
      },
      unitTypes: {
        titleKey: "game_settings.disable_units",
        disabledUnits: [],
      },
      ...(worldWar ? { worldWar } : {}),
    }) satisfies GameConfigSettingsData;

  async function settingsEl(data: GameConfigSettingsData) {
    const el = document.createElement(
      "game-config-settings",
    ) as GameConfigSettings;
    el.settings = data;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it("puts the country picker in the map's place and hides what the mode fixes", async () => {
    const el = await settingsEl(
      settings({ picker: html`<p data-test-picker></p>` }),
    );
    expect(el.querySelector("[data-test-picker]")).not.toBeNull();
    expect(el.querySelector("map-picker")).toBeNull();
    expect(el.textContent).toContain("ww1936.lobby.pick_country");
    expect(el.textContent).not.toContain("host_modal.mode");
    expect(el.textContent).not.toContain("host_modal.team_count");
    expect(el.textContent).not.toContain("game_settings.disable_units");
    expect(el.querySelectorAll("fluent-slider")).toHaveLength(0);
    // The mode plays its AI countries on Medium.
    expect(el.textContent).not.toContain("difficulty.difficulty");
    expect(el.querySelector("difficulty-display")).toBeNull();
  });

  it("is unchanged without the mode", async () => {
    const el = await settingsEl(settings());
    expect(el.querySelector("map-picker")).not.toBeNull();
    expect(el.textContent).toContain("host_modal.mode");
    expect(el.textContent).toContain("host_modal.team_count");
    expect(el.textContent).toContain("game_settings.disable_units");
    expect(el.textContent).toContain("difficulty.difficulty");
    expect(el.querySelectorAll("difficulty-display")).toHaveLength(4);
    expect(el.querySelectorAll("fluent-slider")).toHaveLength(2);
  });
});

describe("solo World War 1936", () => {
  function solo(): any {
    return document.createElement("single-player-modal");
  }

  it("turning it on turns the other fork modes off and keeps only its toggles", async () => {
    const modal = solo();
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", true),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.warfare_expansion", true),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.strategic_weapons", true),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    expect(modal.worldWar1936).toBe(true);
    expect(modal.domesticMode).toBe(false);
    expect(modal.congress).toBe(false);
    expect(modal.warfareExpansion).toBe(false);
    expect(modal.strategicWeapons).toBe(false);

    const root = await body(modal);
    const text = root.querySelector("game-config-settings")!.textContent!;
    expect(text).toContain("game_settings.world_war_1936");
    expect(text).toContain("game_settings.historical_ai");
    expect(text).toContain("game_settings.instant_build");
    expect(text).not.toContain("game_settings.domestic_mode");
    expect(text).not.toContain("game_settings.random_spawn");
    expect(text).not.toContain("game_settings.max_timer");
    expect(text).not.toContain("difficulty.difficulty");
    expect(root.querySelector("ww-country-picker")).not.toBeNull();
    expect(root.querySelector("map-picker")).toBeNull();
  });

  it("is offered among the toggles while off", async () => {
    const root = await body(solo());
    expect(root.textContent).toContain("game_settings.world_war_1936");
    expect(root.querySelector("ww-country-picker")).toBeNull();
  });

  it("starts on the mode's map and rules with the picked country", async () => {
    const modal = solo();
    const starts: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      starts.push((e as CustomEvent).detail.gameStartInfo),
    );
    modal.gameMode = GameMode.Team;
    modal.bots = 250;
    // A timer switched on but left empty: its card is hidden in the mode,
    // which fixes the length, so it must not block the start.
    modal.maxTimer = true;
    modal.maxTimerValue = undefined;
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.historical_ai", false),
    );
    const root = await body(modal);
    tap(root, "FRA");
    expect(modal.country).toBe("FRA");

    await modal.startGame();
    const { config, players } = starts[0];
    // The client loads the map named here (controller ruling T1-3).
    expect(config).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
      gameMap: GameMapType.World1936,
      gameMode: GameMode.FFA,
      bots: 0,
      maxTimerValue: 45,
    });
    expect(config.playerTeams).toBeUndefined();
    expect(players[0].country).toBe("FRA");
  });

  it("without a pick the engine chooses, and turning it off leaves no trace", async () => {
    const modal = solo();
    const starts: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      starts.push((e as CustomEvent).detail.gameStartInfo),
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    await modal.startGame();
    expect(starts[0].config.gameMap).toBe(GameMapType.World1936);
    expect(starts[0].players[0].country).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", false),
    );
    await modal.startGame();
    expect(starts[1].config.gameMap).toBe(GameMapType.World);
    expect(starts[1].config.worldWar1936).toBeUndefined();
    expect(starts[1].config.historicalAi).toBeUndefined();
  });
});

describe("solo World War 1936 on a phone on its side", () => {
  function solo(): any {
    return document.createElement("single-player-modal");
  }
  const footer = (root: ParentNode) =>
    root.querySelector<HTMLElement>("[data-solo-footer]")!;
  const startSize = (root: ParentNode) =>
    (root.querySelector("o-button") as unknown as { size: string }).size;

  // jsdom has no matchMedia; the IntersectionObserver stub above must stay.
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("the start footer is slim with the mode on, and only then", async () => {
    const modal = solo();
    modal.shortLandscape = true;
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    const slim = await body(modal);
    expect(footer(slim).className).toContain("py-2");
    expect(footer(slim).className).not.toContain("p-6");
    expect(startSize(slim)).toBe("md");

    // The mode off, or a taller screen: the footer is as it always was.
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", false),
    );
    const vanilla = await body(modal);
    expect(footer(vanilla).className).toContain("p-6");
    expect(startSize(vanilla)).toBe("lg");
    const tablet = solo();
    tablet.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    const tall = await body(tablet);
    expect(footer(tall).className).toContain("p-6");
    expect(startSize(tall)).toBe("lg");
  });

  it("follows the screen's height and orientation", () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const removed = vi.fn();
    const queries: string[] = [];
    window.matchMedia = ((query: string) => {
      queries.push(query);
      return {
        matches: true,
        addEventListener: (_: string, l: (e: { matches: boolean }) => void) =>
          listeners.push(l),
        removeEventListener: removed,
      };
    }) as unknown as typeof window.matchMedia;
    const modal = solo();
    document.body.appendChild(modal);
    expect(queries).toContain(
      "(max-height: 500px) and (orientation: landscape)",
    );
    expect(modal.shortLandscape).toBe(true);
    for (const l of listeners) l({ matches: false });
    expect(modal.shortLandscape).toBe(false);
    modal.remove();
    expect(removed).toHaveBeenCalled();
  });

  async function toggledScroll(shortLandscape: boolean): Promise<number> {
    const modal = solo();
    modal.inline = true;
    modal.shortLandscape = shortLandscape;
    document.body.appendChild(modal);
    await modal.updateComplete;
    const scroll = modal.querySelector("[data-solo-scroll]") as HTMLElement;
    let top = 500;
    Object.defineProperty(scroll, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    // The list starts 223 px below the top of the scroll area.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const y =
          this.tagName === "WW-COUNTRY-PICKER" ? 300 : this === scroll ? 77 : 0;
        return { top: y } as DOMRect;
      },
    );
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    await vi.waitFor(async () => {
      await modal.updateComplete;
      expect(modal.querySelector("ww-country-picker")).not.toBeNull();
    });
    await new Promise((r) => setTimeout(r, 0));
    return top;
  }

  it("turning the mode on brings the country list into view", async () => {
    expect(await toggledScroll(true)).toBe(500 + 223);
  });

  it("a taller screen keeps its scroll", async () => {
    expect(await toggledScroll(false)).toBe(500);
  });
});

describe("hosting World War 1936", () => {
  function host(): any {
    const modal = new HostLobbyModal() as any;
    modal.lobbyId = "ABCD1234";
    modal.constructUrl = vi.fn(async () => "http://localhost/");
    modal.updateLobbyHistory = vi.fn();
    return modal;
  }

  async function sent(modal: any): Promise<any> {
    let config: any;
    modal.addEventListener("update-game-config", (e: CustomEvent) => {
      config = e.detail.config;
    });
    await modal.putGameConfig();
    return config;
  }

  it("the toggle turns the other modes off and updates the lobby", () => {
    const modal = host();
    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.domesticMode = true;
    modal.congress = true;
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.world_war_1936", true),
    );
    expect(modal.worldWar1936).toBe(true);
    expect(modal.domesticMode).toBe(false);
    expect(modal.congress).toBe(false);
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.historical_ai", false),
    );
    expect(modal.historicalAi).toBe(false);
    expect(putGameConfig).toHaveBeenCalledTimes(2);
  });

  it("keeps the lobby's own controls and hides what the mode fixes", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    const text = (await body(modal)).querySelector(
      "game-config-settings",
    )!.textContent!;
    for (const kept of [
      "game_settings.world_war_1936",
      "game_settings.historical_ai",
      "game_settings.instant_build",
      "host_modal.anonymous_players",
      "host_modal.host_cheats",
      "host_modal.player_limit",
      "host_modal.start_delay",
      "host_modal.player_whitelist",
    ]) {
      expect(text).toContain(kept);
    }
    for (const fixed of [
      "game_settings.domestic_mode",
      "game_settings.random_spawn",
      "game_settings.compact_map",
      "game_settings.max_timer",
      "host_modal.player_immunity_duration",
      "game_settings.custom_alliances",
      "map.map",
      "difficulty.difficulty",
    ]) {
      expect(text).not.toContain(fixed);
    }
  });

  it("sends both keys, and false when off so the server turns it off", async () => {
    const modal = host();
    modal.worldWar1936 = true;
    modal.historicalAi = false;
    expect(await sent(modal)).toMatchObject({
      worldWar1936: true,
      historicalAi: false,
    });
    modal.worldWar1936 = false;
    expect((await sent(modal)).worldWar1936).toBe(false);
  });

  it("the host's pick goes to the server, and the lobby's picks come back", async () => {
    const modal = host();
    const bus = new EventBus();
    const emitted: (string | null)[] = [];
    bus.on(SendPickCountryEvent, (e) => emitted.push(e.tag));
    modal.eventBus = bus;
    modal.startLobbyUpdates();
    modal.worldWar1936 = true;
    const lobby: GameInfo = {
      gameID: "ABCD1234",
      serverTime: 0,
      lobbyCreatorClientID: "HOST0000",
      clients: [
        { clientID: "HOST0000", username: "hosty", clanTag: null },
        { clientID: "BOB00000", username: "bobby", clanTag: null },
      ],
      countryPicks: [{ clientID: "BOB00000", tag: "DEU" }],
    };
    bus.emit(new LobbyInfoEvent(lobby, "HOST0000"));
    expect(modal.countryPicks).toEqual([{ clientID: "BOB00000", tag: "DEU" }]);

    const root = await body(modal);
    const deu = root.querySelector<HTMLButtonElement>(
      'button[data-tag="DEU"]',
    )!;
    expect(deu.disabled).toBe(true);
    expect(deu.textContent).toContain("bobby");
    tap(root, "ITA");
    expect(emitted).toEqual(["ITA"]);
  });
});

describe("joining a World War 1936 lobby", () => {
  function joined(spectator = false): { modal: any; emitted: unknown[] } {
    const modal = new JoinLobbyModal() as any;
    const bus = new EventBus();
    const emitted: (string | null)[] = [];
    bus.on(SendPickCountryEvent, (e) => emitted.push(e.tag));
    modal.eventBus = bus;
    modal.currentLobbyId = "ABCD1234";
    modal.isConnecting = false;
    modal.currentClientID = "AMY00000";
    modal.gameConfig = testGameConfig({ worldWar1936: true });
    modal.players = [
      { clientID: "AMY00000", username: "amy", clanTag: null, spectator },
      { clientID: "BOB00000", username: "bobby", clanTag: null },
    ];
    modal.countryPicks = [
      { clientID: "BOB00000", tag: "DEU" },
      { clientID: "AMY00000", tag: "JPN" },
    ];
    return { modal, emitted };
  }

  it("a player picks from the same list, and the pick goes to the server", async () => {
    const { modal, emitted } = joined();
    const root = await body(modal);
    const picker = root.querySelector<CountryPicker>("ww-country-picker")!;
    expect(picker.selected).toBe("JPN");
    expect(
      root.querySelector<HTMLButtonElement>('button[data-tag="DEU"]')!
        .textContent,
    ).toContain("bobby");
    tap(root, "ITA");
    tap(root, "JPN");
    expect(emitted).toEqual(["ITA", null]);
  });

  it("a spectator picks nothing, and neither does a lobby without the mode", async () => {
    expect(
      (await body(joined(true).modal)).querySelector("ww-country-picker"),
    ).toBeNull();
    const { modal } = joined();
    modal.gameConfig = testGameConfig();
    expect((await body(modal)).querySelector("ww-country-picker")).toBeNull();
  });
});

describe("the lobby summary", () => {
  it("lists the mode and the historical AI", () => {
    const items = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null);
    expect(items(testGameConfig({ worldWar1936: true }))).toEqual(
      expect.arrayContaining([
        { label: "game_settings.world_war_1936", value: "common.enabled" },
        { label: "game_settings.historical_ai", value: "common.enabled" },
      ]),
    );
    expect(
      items(testGameConfig({ worldWar1936: true, historicalAi: false })),
    ).toContainEqual({
      label: "game_settings.historical_ai",
      value: "common.disabled",
    });
    expect(items(testGameConfig()).map((i) => i.label)).not.toContain(
      "game_settings.world_war_1936",
    );
  });

  it("shows no difficulty: the mode fixes it", () => {
    const labels = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null).map((i) => i.label);
    // A private lobby above Easy names its difficulty, but not in the mode.
    expect(labels(testGameConfig({ difficulty: Difficulty.Hard }))).toContain(
      "difficulty.difficulty",
    );
    expect(
      labels(
        testGameConfig({ worldWar1936: true, difficulty: Difficulty.Hard }),
      ),
    ).not.toContain("difficulty.difficulty");
  });
});
