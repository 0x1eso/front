// World War 1936 P5 (plan Task 11, lane U3): the endgame's names — the map
// label of a civil-war slot, the leaderboard (no dormant slot, a gone
// country struck through, an exile badged, the human on the country they
// play now) and the P5 notices' params.
import {
  MessageType,
  type TerraNullius,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import type { WwCountryView } from "@openfront/engine-api/ww1936/EndgameTypes";
import type { WorldWarData } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params && Object.keys(params).length > 0
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";
import { PlayerStats } from "../../../src/client/hud/layers/PlayerStats";
import {
  countryFlagUrl,
  countryText,
  endgameNoticeParams,
  occupationParams,
  wwMapName,
} from "../../../src/client/hud/ww1936/EndgameNames";
import { UserSettings } from "../../../src/client/UserSettings";
import type { PlayerView } from "../../../src/client/view";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID, scenario } from "./EconomyFixture";

const view = (
  tag: CountryTag,
  over: Partial<WwCountryView> = {},
): WwCountryView => ({
  smallID: ID(tag),
  state: "active",
  nameKey: null,
  nameArg: null,
  color: null,
  flag: COUNTRIES[tag].flag,
  ...over,
});

interface FakePlayer {
  tag: CountryTag;
  tiles: number;
  client?: string;
}

function player(f: FakePlayer): PlayerView {
  return {
    id: () => f.tag,
    smallID: () => ID(f.tag),
    name: () => COUNTRIES[f.tag].name,
    displayName: () => COUNTRIES[f.tag].name,
    clanTag: () => null,
    countryTag: () => f.tag,
    clientID: () => f.client ?? null,
    numTilesOwned: () => f.tiles,
    gold: () => 0n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => 0,
    troops: () => f.tiles,
    totalUnitLevels: () => 0,
    isAlive: () => f.tiles > 0,
    hasSpawned: () => true,
    isPlayer: () => true,
    isOnSameTeam: () => false,
    strategicData: () => null,
  } as unknown as PlayerView;
}

/** A World War game on the mini map around an endgame view. */
function fakeGame(
  eg: WwEndgameView,
  players: FakePlayer[],
  o: { me?: CountryTag | null; capitulated?: CountryTag[] } = {},
) {
  const views = players.map(player);
  const byId = new Map(views.map((p) => [p.smallID(), p]));
  const usernames: Record<string, string> = { c1: "minsu", c2: "jiwoo" };
  const me = o.me === undefined ? "DEU" : o.me;
  return {
    views,
    game: {
      ticks: () => 600,
      worldWarScenario: () => scenario,
      worldWarData: () =>
        ({
          wars: [],
          capitulated: (o.capitulated ?? []).map((t) => ({ smallID: ID(t) })),
        }) as unknown as WorldWarData,
      wwEndgame: () => eg,
      playerBySmallID: (id: number) =>
        byId.get(id) ?? ({ isPlayer: () => false } as unknown as TerraNullius),
      playerByClientID: (c: string) =>
        views.find((p) => p.clientID() === c) ?? null,
      myPlayer: () => (me === null ? null : (byId.get(ID(me)) ?? null)),
      myClientID: () => "c1",
      usernameOf: (c: string) => usernames[c] ?? null,
      playerViews: () => views,
      config: () => ({ maxTroops: () => 100 }),
      numLandTiles: () => 100,
      numTilesWithFallout: () => 0,
      ownerID: () => 0,
    },
  };
}

async function leaderboard(game: unknown): Promise<string[]> {
  const ps = new PlayerStats();
  ps.game = game as never;
  ps.visible = true;
  document.body.append(ps);
  ps.refresh();
  await ps.updateComplete;
  const rows = [...ps.querySelectorAll(".stats-table-row")].map((row) => {
    const cell = row.querySelectorAll('[role="cell"]')[2];
    const name = cell?.querySelector("span:last-child");
    const badge = cell?.querySelector("[data-row-badge]")?.textContent ?? "";
    const struck = name?.classList.contains("line-through") ? "~" : "";
    return `${badge ? `${badge} ` : ""}${struck}${name?.textContent?.trim()}`;
  });
  ps.remove();
  return rows;
}

describe("World War 1936 P5: endgame names", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("a civil war slot is labelled with its ideology name", () => {
    const eg = new WwEndgameView();
    const cw = view("CW1", {
      nameKey: "ww1936.cw_name.democratic",
      nameArg: "POL",
      flag: "ww_cw_democratic",
    });
    eg.apply({ news: [], countries: [cw, view("DEU")] });
    const { game } = fakeGame(eg, []);
    // The map: English, whatever the UI's language (mode spec §5.4).
    expect(wwMapName(eg.countries.get(ID("CW1")))).toBe("Free Poland");
    expect(
      wwMapName(
        view("CW2", { nameKey: "ww1936.cw_name.communist", nameArg: "FRA" }),
      ),
    ).toBe("People's France");
    // A rename (spec §3.5 set_name) keeps no country param.
    expect(wwMapName(view("CW3", { nameKey: "ww1936.rename.serbia" }))).toBe(
      "Serbia",
    );
    // Without a name key the P0 name stays.
    expect(wwMapName(eg.countries.get(ID("DEU")))).toBeNull();
    // The screens: the translated ideology name and the slot's flag.
    expect(countryText(game, ID("CW1"))).toBe(
      "[ww1936.cw_name.democratic] country=[ww1936.country.POL]",
    );
    expect(countryText(game, ID("DEU"))).toBe("[ww1936.country.DEU]");
    expect(countryFlagUrl(game, ID("CW1"))).toContain("ww_cw_democratic.svg");
  });

  it("dormant countries are not on the leaderboard", async () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      countries: [
        view("DEU"),
        view("POL", { state: "gone" }),
        view("FRA", { state: "gone" }),
        // Faked with land below: a dormant slot never shows.
        view("SVK", { state: "dormant" }),
      ],
      exiles: [
        {
          smallID: ID("POL"),
          host: ID("GBR"),
          legitBp: 5_400,
          deltaBp: 12,
          virtualMil: 5,
          capital: 6,
        },
      ],
    });
    const { game } = fakeGame(eg, [
      { tag: "DEU", tiles: 90, client: "c1" },
      { tag: "SVK", tiles: 50 },
      // Gone, its last tiles changing hands: struck through.
      { tag: "FRA", tiles: 20 },
      // A government in exile has no land and plays on: badged.
      { tag: "POL", tiles: 0, client: "c2" },
      // A dormant slot before the endgame's first update: never shown.
      { tag: "HRV", tiles: 10 },
    ]);
    expect(await leaderboard(game)).toEqual([
      "[ww1936.country.DEU] · minsu",
      "~[ww1936.country.FRA]",
      "[ww1936.exile.badge] [ww1936.country.POL] · jiwoo",
    ]);
  });

  it("the leaderboard puts a human on the country they play now", async () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      countries: [view("DEU", { state: "gone" }), view("ITA")],
      // c1 (minsu) took over Italy when Germany fell.
      controllers: [["c1", ID("ITA")]],
    });
    const { game } = fakeGame(
      eg,
      [
        { tag: "DEU", tiles: 5, client: "c1" },
        { tag: "ITA", tiles: 80 },
      ],
      { me: "ITA", capitulated: ["DEU"] },
    );
    expect(await leaderboard(game)).toEqual([
      "[ww1936.country.ITA] · minsu",
      "~[ww1936.country.DEU]",
    ]);
  });

  it("the daily batches spell out their items", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], countries: [view("GBR")] });
    const { game } = fakeGame(eg, []);
    // Captured: "slot:region:n" — infantry equipment I (slot 0) and II
    // (slot 1) sum; artillery I is division slot 5.
    expect(
      endgameNoticeParams(
        "events_display.ww1936_captured",
        { items: "0:9:600,1:9:40,5:9:22" },
        game,
      ),
    ).toEqual({
      items:
        "[ww1936.equip.infantry_equipment] 640 · [ww1936.equip.artillery] 22",
      region: "Kiev",
    });
    // Lend-lease: "from:key:n" (key: a stock index; any other is fuel).
    expect(
      endgameNoticeParams(
        "events_display.ww1936_ll_arrived",
        { items: `${ID("GBR")}:0:300,${ID("GBR")}:-1:50` },
        game,
      ),
    ).toEqual({
      items:
        "[ww1936.equip.infantry_equipment] 300 · [ww1936.aid.item_fuel] 50",
      fromTag: "[ww1936.country.GBR]",
    });
    expect(
      endgameNoticeParams(
        "events_display.ww1936_garrison_short",
        { items: "0:0:6" },
        game,
      ).n,
    ).toBe(6);
    // Countries, losers, level and law in the viewer's words.
    expect(
      endgameNoticeParams(
        "events_display.ww1936_exiled",
        { tag: "POL", hostTag: "GBR" },
        game,
      ),
    ).toEqual({ tag: "[ww1936.country.POL]", hostTag: "[ww1936.country.GBR]" });
    expect(
      endgameNoticeParams(
        "events_display.ww1936_conference_opened",
        { losers: `POL,${ID("FRA")}` },
        game,
      ).losers,
    ).toBe("[ww1936.country.POL], [ww1936.country.FRA]");
    expect(
      endgameNoticeParams(
        "events_display.ww1936_subject_level",
        { tag: "ITA", level: "puppet" },
        game,
      ).level,
    ).toBe("[ww1936.subject_level.puppet]");
  });

  it("occupation notices name the region and the law, never an id", () => {
    const { game } = fakeGame(new WwEndgameView(), [
      { tag: "DEU", tiles: 5, client: "c1" },
    ]);
    const regionId = 5;
    const o = occupationParams(game, { region: regionId, law: "occ_civil" });
    expect(o.region).not.toBe(String(regionId));
    expect(o.region).not.toMatch(/^\d+$/);
    expect(o.law).toBe("[ww1936.occ_law.occ_civil]");
    expect(
      endgameNoticeParams(
        "events_display.ww1936_uprising",
        { region: regionId },
        game,
      ).region,
    ).toBe(o.region);
  });

  it("the spectate notice reaches the human whose country it was", () => {
    const eg = new WwEndgameView();
    // c1 spectates: no country to take over.
    eg.apply({ news: [], controllers: [["c1", 0]] });
    const { game } = fakeGame(eg, [{ tag: "DEU", tiles: 0, client: "c1" }], {
      me: null,
    });
    const ed = new EventsDisplay();
    (ed as unknown as { game: unknown }).game = game;
    const notice = (playerID: number, message: string) =>
      ed.onDisplayMessageEvent({
        type: GameUpdateType.DisplayEvent,
        message,
        messageType: MessageType.WORLD_WAR,
        playerID,
        params: {},
      } as never);
    notice(ID("DEU"), "events_display.ww1936_spectating");
    // Any other notice to the old country no longer reaches me.
    notice(ID("DEU"), "events_display.ww1936_occ_law");
    notice(ID("ITA"), "events_display.ww1936_spectating");
    const events = (ed as unknown as { events: { description: string }[] })
      .events;
    expect(events.map((e) => e.description)).toEqual([
      "[events_display.ww1936_spectating]",
    ]);
  });
});
