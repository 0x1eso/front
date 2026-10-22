// @vitest-environment jsdom
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  CIVIL_WAR_SLOTS,
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import type { WirePlayer } from "@openfront/shared/WireSchemas";
import { afterEach, describe, expect, test } from "vitest";
import {
  bandModel,
  factionOfId,
  sameFaction,
} from "../../src/client/hud/ww1936/WorldWarModel";
import { UserSettings } from "../../src/client/UserSettings";
import { GameView } from "../../src/client/view/GameView";
import type { PlayerView } from "../../src/client/view/PlayerView";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { stubWorker } from "../util/viewStubs";
import { HUMAN, MINI, step, wwGameStart, wwRunnerCapture } from "./util";

const HUMANS = [{ clientID: HUMAN, country: "POL" as const }];

/** A real GameView fed the engine's first ticks, as ClientGameRunner builds it. */
async function viewAndEngine() {
  const { runner, updates } = await wwRunnerCapture({}, HUMANS);
  step(runner, 3);
  const start = wwGameStart({}, HUMANS);
  const terrain = await loadTerrainMap(
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
  );
  const view = new GameView(
    stubWorker(),
    new Config(start.config, false),
    terrain,
    HUMAN,
    "player0",
    null,
    start.gameID,
    start.players as WirePlayer[],
  );
  for (const gu of updates) view.update(gu);
  return { game: runner.game, view, runner, updates };
}

function hex([r, g, b]: readonly [number, number, number]): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

describe("the World War 1936 game view", () => {
  const userSettings = new UserSettings();
  afterEach(() => userSettings.setGraphicsOverrides({}));

  test("draws the engine's 1936 owners without any tile update", async () => {
    const { game, view } = await viewAndEngine();
    expect(view.worldWarScenario()).not.toBeNull();
    let owned = 0;
    game.forEachTile((t) => {
      expect(view.ownerID(t)).toBe(game.ownerID(t));
      if (game.ownerID(t) !== 0) owned++;
    });
    expect(owned).toBe(20300);
  });

  test("every player is its country: tag, name and the WorldWar data", async () => {
    const { game, view } = await viewAndEngine();
    const ww = game.worldWar()!;
    for (const p of game.allPlayers()) {
      const pv = view.playerBySmallID(p.smallID()) as PlayerView;
      const tag = ww.tagOf(p.smallID());
      expect(pv.countryTag()).toBe(tag);
      // Decision 3: the country's name, never anonymized, not my username.
      expect(pv.name()).toBe(COUNTRIES[tag].name);
    }
    expect(view.myPlayer()?.countryTag()).toBe("POL");
    expect(view.usernameOf(HUMAN)).toBe("player0");
    expect(view.worldWarData()).toEqual({
      prepEndTick: WW_PREP_TICKS,
      wars: [],
      capitulated: [],
      gauges: [],
    });
  });

  test("P3: the view holds politics, and the screens' factions read it", async () => {
    const { game, view, runner, updates } = await viewAndEngine();
    const pv = view.wwPolitics()!;
    const ww = game.worldWar()!;
    for (const c of ww.politics.list()) {
      expect(pv.summary(c.smallID)?.faction).toBe(
        ww.politics.factionIdx(c.smallID),
      );
    }
    expect(pv.global?.factions.map((f) => f.key)).toEqual([
      "axis",
      "allies",
      "comintern",
    ]);
    const [deu, ita, pol] = (["DEU", "ITA", "POL"] as const).map((t) =>
      ww.scenario.smallIdOf(t),
    );
    expect(factionOfId(view, deu)).toBe("axis");
    // Poland (mine) is in no faction.
    expect(bandModel(view).myFaction).toBeNull();
    const asView = (id: number) => view.playerBySmallID(id) as PlayerView;
    expect(sameFaction(asView(pol), asView(deu), view)).toBe(false);
    // A faction change the engine makes reaches the screens.
    ww.politics.factions[0].members.push(pol);
    ww.politics.factionsChanged();
    const seen = updates.length;
    step(runner);
    for (const gu of updates.slice(seen)) view.update(gu);
    expect(factionOfId(view, pol)).toBe("axis");
    expect(bandModel(view).myFaction).toBe("axis");
    expect(sameFaction(asView(pol), asView(ita), view)).toBe(true);
    // Without the game, sameFaction keeps P0's starting factions.
    expect(sameFaction(asView(pol), asView(ita))).toBe(false);
  });

  test("country flag and colour show for everyone, whatever the cosmetics settings", async () => {
    // Settings that hide everyone else's cosmetics in a normal game.
    userSettings.setGraphicsOverrides({
      cosmetics: { showFrom: "self", flags: false, territorySkins: false },
    });
    const { game, view } = await viewAndEngine();
    const ww = game.worldWar()!;
    const cwColors: string[] = [];
    for (const p of game.allPlayers()) {
      const pv = view.playerBySmallID(p.smallID()) as PlayerView;
      const tag = ww.tagOf(p.smallID());
      const def = COUNTRIES[tag];
      expect(pv.cosmetics.flag).toBe(`/flags/${def.flag}.svg`);
      // P5 lane U3: a civil-war slot wears its own fixed colour, not the
      // slots' shared gray; every other country its own.
      const color = pv.cosmetics.color?.color ?? "";
      if ((CIVIL_WAR_SLOTS as readonly CountryTag[]).includes(tag)) {
        cwColors.push(color);
        expect(color).not.toBe(hex(def.color));
      } else expect(color).toBe(hex(def.color));
      expect(pv.territoryColor().toHex()).toBe(color);
    }
    expect(cwColors).toHaveLength(CIVIL_WAR_SLOTS.length);
    expect(new Set(cwColors).size).toBe(CIVIL_WAR_SLOTS.length);
    // A settings change re-resolves them the same way.
    view.refreshPlayerCosmetics();
    const deu = view.playerBySmallID(1) as PlayerView;
    expect(deu.cosmetics.flag).toBe("/flags/German Empire.svg");
  });
});
