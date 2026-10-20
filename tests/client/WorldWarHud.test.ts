import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import { render } from "lit";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

vi.mock("../../src/client/Api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Api")>()),
  getUserMe: vi.fn(async () => null),
}));

vi.mock("../../src/client/Cosmetics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Cosmetics")>()),
  fetchCosmetics: vi.fn(() => new Promise(() => {})),
  resolveCosmetics: vi.fn(() => []),
}));

vi.mock("../../src/client/GamePortal", () => ({
  gamePortal: { happytime: vi.fn(), gameplayStop: vi.fn() },
}));

import { gamePortal } from "../../src/client/GamePortal";
import "../../src/client/hud/layers/PlayerPanel";
import type { PlayerPanel } from "../../src/client/hud/layers/PlayerPanel";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import "../../src/client/hud/layers/WinModal";
import type { WinModal } from "../../src/client/hud/layers/WinModal";
import {
  bandModel,
  callIns,
  countryLabel,
  diplomacyModel,
  regionInfo,
  translateCountryParams,
  TwoTap,
  wwWinView,
  type WwGame,
} from "../../src/client/hud/ww1936/WorldWarModel";
import "../../src/client/hud/ww1936/WwDiplomacyPanel";
import type { WwDiplomacyPanel } from "../../src/client/hud/ww1936/WwDiplomacyPanel";
import {
  ToggleWwDiplomacyEvent,
  WwTopBand,
} from "../../src/client/hud/ww1936/WwTopBand";
import { SendDeclareWarIntentEvent } from "../../src/client/Transport";

const MINI = path.join(__dirname, "../testdata/maps/ww1936mini");
const scenario = ScenarioIndex.fromFiles(
  ScenarioDataSchema.parse(
    JSON.parse(fs.readFileSync(path.join(MINI, "scenario.json"), "utf8")),
  ),
  new Uint8Array(fs.readFileSync(path.join(MINI, "regions.bin"))),
);
const ID = (tag: CountryTag) => scenario.smallIdOf(tag);

interface Fake {
  ticks?: number;
  me?: CountryTag;
  wars?: [CountryTag, CountryTag][];
  capitulated?: CountryTag[];
  humans?: Partial<Record<CountryTag, [string, string]>>;
  /** Tiles that changed hands: tile → new owner. */
  taken?: Map<number, CountryTag>;
  historicalAi?: boolean;
  /** What updatesSinceLastTick() returns (the win screen reads it). */
  updates?: Record<number, unknown[]>;
}

function fakeGame(o: Fake = {}): WwGame {
  const owners = scenario.ownerByRegion();
  const ownerID = (t: number) =>
    o.taken?.has(t) ? ID(o.taken.get(t)!) : (owners[scenario.regionAt(t)] ?? 0);
  const tiles = new Array<number>(scenario.countries.length + 1).fill(0);
  for (let t = 0; t < scenario.regionIds.length; t++) tiles[ownerID(t)]++;
  const players = scenario.countries.map((tag, i) => ({
    id: () => `P${i + 1}`,
    smallID: () => i + 1,
    countryTag: () => tag,
    clientID: () => o.humans?.[tag]?.[0] ?? null,
    name: () => COUNTRIES[tag].name,
    displayName: () => COUNTRIES[tag].name,
    clanTag: () => null,
    team: () => null,
    isOnSameTeam: () => false,
    isAlive: () => true,
    hasSpawned: () => true,
    isPlayer: () => true,
    numTilesOwned: () => tiles[i + 1],
    goldEarned: () => 0,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
  }));
  return {
    ticks: () => o.ticks ?? 700,
    worldWarScenario: () => scenario,
    worldWarData: () => ({
      prepEndTick: 600,
      wars: (o.wars ?? []).map(([a, b]) => ({
        a: ID(a),
        b: ID(b),
        sinceTick: 600,
      })),
      capitulated: (o.capitulated ?? []).map((t) => ({
        smallID: ID(t),
        victor: 0,
        tick: 600,
      })),
    }),
    playerBySmallID: (id: number) => players[id - 1],
    playerByClientID: (cid: string) =>
      players.find((p) => p.clientID() === cid) ?? null,
    myPlayer: () => (o.me === undefined ? null : players[ID(o.me) - 1]),
    ownerID,
    usernameOf: (cid: string) =>
      Object.values(o.humans ?? {}).find((h) => h?.[0] === cid)?.[1] ?? null,
    numLandTiles: () => 20300,
    playerViews: () => players,
    inSpawnPhase: () => false,
    updatesSinceLastTick: () => o.updates ?? {},
    config: () => ({
      historicalAi: () => o.historicalAi ?? true,
      gameConfig: () => ({ rankedType: undefined }),
      isReplay: () => false,
    }),
  } as unknown as WwGame;
}

describe("the World War 1936 screens (spec §8.2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the band counts the preparation down, then shows the date", () => {
    expect(bandModel(fakeGame({ ticks: 180 })).label).toBe(
      "[ww1936.band.prep] time=0:42",
    );
    expect(bandModel(fakeGame({ ticks: 600 })).label).toBe(
      "[ww1936.date] year=1936,month=[ww1936.month.m01],day=1",
    );
    expect(bandModel(fakeGame({ ticks: dayStartTick(366, 600) })).label).toBe(
      "[ww1936.date] year=1937,month=[ww1936.month.m01],day=1",
    );
  });

  it("the band names my country, my faction and my wars", () => {
    const m = bandModel(fakeGame({ me: "DEU", wars: [["DEU", "POL"]] }));
    expect(m).toMatchObject({
      myTag: "DEU",
      myFaction: "axis",
      wars: 1,
      inPrep: false,
    });
  });

  it("the drawer lists the factions, my wars, the camp scores and the next date", () => {
    const m = diplomacyModel(
      fakeGame({
        me: "DEU",
        wars: [["DEU", "POL"]],
        capitulated: ["FRA"],
        ticks: 600,
      }),
    );
    expect(m.factions.map((f) => [f.id, f.members.map((x) => x.tag)])).toEqual([
      ["axis", ["DEU", "ITA"]],
      ["allies", ["GBR", "FRA"]],
      ["comintern", ["SUN"]],
    ]);
    expect(m.factions[1].members[1].capitulated).toBe(true);
    expect(m.myWars).toEqual(["POL"]);
    expect(m.camps[0]).toMatchObject({ mine: true, scoreBp: 3005 });
    // The first entry whose two countries are on this map: Germany → Poland.
    expect(m.nextHistory).toBe(
      "[ww1936.date] year=1939,month=[ww1936.month.m09],day=1",
    );
  });

  it("the region line shows the name, the points and the 1936 owner when it changed", () => {
    const krakow = scenario.landRegions.find((r) => r.name === "Krakow")!;
    const tile = scenario.vpTile(krakow);
    expect(regionInfo(fakeGame(), tile, true)).toEqual({
      name: "크라쿠프",
      vp: 3,
      originalOwner: null,
    });
    const taken = new Map([[tile, "DEU" as CountryTag]]);
    expect(regionInfo(fakeGame({ taken }), tile, false)).toEqual({
      name: "Krakow",
      vp: 3,
      originalOwner: "POL",
    });
  });

  it("names: the country, and the username for a human", () => {
    const g = fakeGame({ humans: { DEU: ["C1", "minsu"] } });
    expect(countryLabel(g, g.playerBySmallID(ID("DEU")) as never)).toBe(
      "[ww1936.country.DEU] · minsu",
    );
    expect(countryLabel(g, g.playerBySmallID(ID("ITA")) as never)).toBe(
      "[ww1936.country.ITA]",
    );
    expect(
      translateCountryParams({
        attackerTag: "DEU",
        targetTag: "FRA",
        allies: 1,
      }),
    ).toEqual({
      attackerTag: "DEU",
      targetTag: "FRA",
      allies: 1,
      attacker: "[ww1936.country.DEU]",
      target: "[ww1936.country.FRA]",
    });
  });

  it("a declaration needs a second tap within three seconds", () => {
    const t = new TwoTap();
    expect(t.tap("x", 0)).toBe(false);
    expect(t.tap("x", 2999)).toBe(true);
    expect(t.tap("x", 5000)).toBe(false);
    expect(t.tap("x", 8001)).toBe(false);
    expect(t.tap("y", 8002)).toBe(false);
    expect(t.tap("y", 8003)).toBe(true);
  });

  it("the confirmation counts the target's faction members it brings in", () => {
    const fra = (g: WwGame) => g.playerBySmallID(ID("FRA")) as never;
    expect(callIns(fakeGame(), fra(fakeGame()))).toBe(1);
    const g = fakeGame({ capitulated: ["GBR"] });
    expect(callIns(g, fra(g))).toBe(0);
  });

  it("the win names the faction, celebrates on its side and lists its MVPs", () => {
    const win = wwWinView(
      fakeGame({ me: "DEU", humans: { DEU: ["C1", "minsu"] } }),
      ["team", "axis", "C1"],
    );
    expect(win.isWin).toBe(true);
    expect(win.title).toBe(
      "[ww1936.win.your_faction] faction=[ww1936.faction.axis]",
    );
    expect(win.mvp[0]).toBe("[ww1936.country.DEU] · minsu");
    const lost = wwWinView(fakeGame({ me: "GBR" }), ["team", "axis"]);
    expect(lost.isWin).toBe(false);
    expect(lost.title).toBe(
      "[ww1936.win.faction_won] faction=[ww1936.faction.axis]",
    );
  });

  it("<ww-top-band> renders the date and opens the drawer", async () => {
    const band = document.createElement("ww-top-band") as WwTopBand;
    const emitted: unknown[] = [];
    band.game = fakeGame({ me: "DEU" }) as never;
    band.eventBus = { emit: (e: unknown) => emitted.push(e) } as never;
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    expect(band.querySelector("[data-ww-date]")!.textContent).toContain(
      "ww1936.date",
    );
    band.querySelector<HTMLButtonElement>("[data-ww-wars]")!.click();
    expect(emitted[0]).toBeInstanceOf(ToggleWwDiplomacyEvent);
  });

  it("<ww-top-band> never covers the top-right stack on a narrow landscape phone", async () => {
    vi.stubGlobal("innerWidth", 667);
    let stackWidth = 160;
    const stack = document.createElement("div");
    stack.setAttribute("data-hud-top-right", "");
    stack.getBoundingClientRect = () =>
      ({
        left: 667 - stackWidth,
        right: 667,
        top: 0,
        bottom: 120,
        width: stackWidth,
        height: 120,
      }) as DOMRect;
    document.body.appendChild(stack);
    const band = document.createElement("ww-top-band") as WwTopBand;
    band.game = fakeGame({ me: "DEU" }) as never;
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    const el = () => band.querySelector<HTMLElement>("[data-ww-band]")!;
    // Centred, with the stack's width and a gap kept clear on both sides:
    // 667 − 2 × (160 + 8).
    expect(el().getAttribute("style")).toContain("max-width: 331px");
    expect(el().getAttribute("style")).not.toContain("right:");
    expect(el().className).toContain("left-1/2");
    // A wider stack leaves too little room for a centred band: it moves
    // just left of the stack instead.
    stackWidth = 250;
    band.tick();
    await band.updateComplete;
    expect(el().getAttribute("style")).toContain("right: 258px");
    expect(el().getAttribute("style")).toContain("max-width: 401px");
    expect(el().className).not.toContain("left-1/2");
  });
  it("nothing of it shows when the mode is off", async () => {
    const off = { ...fakeGame(), worldWarScenario: () => null } as never;
    const band = document.createElement("ww-top-band") as WwTopBand;
    band.game = off;
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    expect(band.querySelector("[data-ww-band]")).toBeNull();
    const drawer = document.createElement(
      "ww-diplomacy-panel",
    ) as WwDiplomacyPanel;
    drawer.game = off;
    drawer.eventBus = new EventBus();
    document.body.appendChild(drawer);
    drawer.init();
    drawer.eventBus.emit(new ToggleWwDiplomacyEvent());
    await drawer.updateComplete;
    expect(drawer.querySelector("[data-ww-diplomacy]")).toBeNull();
  });

  it("<ww-diplomacy-panel> opens on the band's event, right of the centre, and closes", async () => {
    const drawer = document.createElement(
      "ww-diplomacy-panel",
    ) as WwDiplomacyPanel;
    drawer.game = fakeGame({
      me: "DEU",
      wars: [["DEU", "POL"]],
      capitulated: ["FRA"],
      ticks: 600,
    }) as never;
    drawer.eventBus = new EventBus();
    document.body.appendChild(drawer);
    drawer.init();
    drawer.eventBus.emit(new ToggleWwDiplomacyEvent());
    await drawer.updateComplete;
    const aside = drawer.querySelector<HTMLElement>("[data-ww-diplomacy]")!;
    expect(aside).not.toBeNull();
    // Never wider than the space right of the screen's middle.
    expect(aside.getAttribute("style")).toContain("calc(50vw - 8px)");
    expect(aside.getAttribute("style")).toContain("top: 40px");
    expect(
      [...drawer.querySelectorAll("[data-ww-faction]")].map((e) =>
        e.getAttribute("data-ww-faction"),
      ),
    ).toEqual(["axis", "allies", "comintern"]);
    expect(drawer.querySelector("[data-ww-member=FRA]")!.className).toContain(
      "line-through",
    );
    expect(
      drawer.querySelector("[data-ww-member=GBR]")!.className,
    ).not.toContain("line-through");
    expect(drawer.querySelector("[data-ww-my-wars]")!.textContent).toContain(
      "ww1936.country.POL",
    );
    expect(drawer.querySelector("[data-ww-next]")!.textContent).toContain(
      "ww1936.panel.next_history",
    );
    drawer
      .querySelector<HTMLButtonElement>("[data-ww-diplomacy-close]")!
      .click();
    await drawer.updateComplete;
    expect(drawer.querySelector("[data-ww-diplomacy]")).toBeNull();
    // The band's button toggles it.
    drawer.eventBus.emit(new ToggleWwDiplomacyEvent());
    drawer.eventBus.emit(new ToggleWwDiplomacyEvent());
    await drawer.updateComplete;
    expect(drawer.isOpen()).toBe(false);
  });

  it("the drawer leaves out the next date without the historical AI", async () => {
    const drawer = document.createElement(
      "ww-diplomacy-panel",
    ) as WwDiplomacyPanel;
    drawer.game = fakeGame({ me: "DEU", historicalAi: false }) as never;
    drawer.eventBus = new EventBus();
    document.body.appendChild(drawer);
    drawer.init();
    drawer.eventBus.emit(new ToggleWwDiplomacyEvent());
    await drawer.updateComplete;
    expect(drawer.querySelector("[data-ww-diplomacy]")).not.toBeNull();
    expect(drawer.querySelector("[data-ww-next]")).toBeNull();
  });

  it("the player panel declares war on the second tap within three seconds", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const g = fakeGame({ me: "DEU" });
    const fra = g.playerBySmallID(ID("FRA")) as never;
    const panel = document.createElement("player-panel") as PlayerPanel;
    panel.g = g as never;
    panel.eventBus = new EventBus();
    const sent: SendDeclareWarIntentEvent[] = [];
    panel.eventBus.on(SendDeclareWarIntentEvent, (e) => sent.push(e));
    const p = panel as unknown as {
      renderDeclareWar(other: unknown): unknown;
      handleDeclareWarClick(e: Event, other: unknown): void;
    };
    const label = () => {
      const div = document.createElement("div");
      render(p.renderDeclareWar(fra), div);
      return div.querySelector("button")!.textContent!.trim();
    };
    expect(label()).toBe("[ww1936.declare.button]");
    p.handleDeclareWarClick(new Event("click"), fra);
    expect(sent).toHaveLength(0);
    // Britain would join France.
    expect(label()).toBe("[ww1936.declare.confirm] n=1");
    vi.setSystemTime(13_001);
    expect(label()).toBe("[ww1936.declare.button]");
    p.handleDeclareWarClick(new Event("click"), fra);
    expect(sent).toHaveLength(0);
    vi.setSystemTime(15_000);
    p.handleDeclareWarClick(new Event("click"), fra);
    expect(sent).toHaveLength(1);
    expect(sent[0].target).toBe(fra);
    expect(panel.isVisible).toBe(false);
  });

  it("the leaderboard names countries and emphasizes my faction", () => {
    const g = fakeGame({ me: "DEU", humans: { DEU: ["C1", "minsu"] } });
    const stats = new PlayerStats();
    const rows = (
      stats as unknown as {
        buildRows(
          game: unknown,
          columns: never[],
        ): { name: string; emphasized: boolean }[];
      }
    ).buildRows(g, []);
    const row = (tag: CountryTag) => rows[ID(tag) - 1];
    expect(row("DEU")).toMatchObject({
      name: "[ww1936.country.DEU] · minsu",
      emphasized: true,
    });
    expect(row("ITA")).toMatchObject({
      name: "[ww1936.country.ITA]",
      emphasized: true,
    });
    expect(row("FRA").emphasized).toBe(false);
  });

  it("<win-modal> names the winning faction and lists its MVPs", async () => {
    // A visible modal activates steam-wishlist, which observes its own size.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const g = fakeGame({
      me: "DEU",
      humans: { DEU: ["C1", "minsu"] },
      updates: {
        [GameUpdateType.Win]: [
          {
            winner: ["team", "axis", "C1"],
            allPlayersStats: {},
            reason: "ww_score",
          },
        ],
      },
    });
    const modal = document.createElement("win-modal") as WinModal;
    modal.game = g as never;
    modal.eventBus = new EventBus();
    document.body.appendChild(modal);
    modal.tick();
    await vi.waitFor(() => expect(modal.isVisible).toBe(true));
    await modal.updateComplete;
    expect(modal.querySelector("h2")!.textContent!.trim()).toBe(
      "[ww1936.win.your_faction] faction=[ww1936.faction.axis]",
    );
    expect(modal.querySelector("[data-win-reason]")!.textContent!.trim()).toBe(
      "[domestic.win_reason.ww_score]",
    );
    expect(modal.querySelector("[data-ww-mvp] p")!.textContent!.trim()).toBe(
      "[ww1936.win.mvp]",
    );
    const mvp = [...modal.querySelectorAll("[data-ww-mvp] li")].map((li) =>
      li.textContent!.trim(),
    );
    expect(mvp).toEqual([
      "[ww1936.country.DEU] · minsu",
      "[ww1936.country.ITA]",
    ]);
    expect(gamePortal.happytime).toHaveBeenCalled();
  });
});
