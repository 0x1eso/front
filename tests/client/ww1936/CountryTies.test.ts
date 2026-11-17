// ww241: clicking (or hovering) a country on the map shows its diplomatic
// ties on the country card: faction and leader, wars, overlord or
// subjects, guarantees, pacts, access. A country with none: no section.
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, p?: Record<string, unknown>) =>
    p === undefined ? `[${key}]` : `[${key} ${JSON.stringify(p)}]`,
}));

import "../../../src/client/hud/layers/PlayerInfoOverlay";
import type { PlayerInfoOverlay } from "../../../src/client/hud/layers/PlayerInfoOverlay";
import {
  countryTies,
  TIES_MAX_NAMES,
} from "../../../src/client/hud/ww1936/CountryTiesModel";
import { ID } from "./EconomyFixture";
import { fakeEndGame } from "./EndgameFixture";
import { startFactions } from "./PoliticsFixture";

/** The card's ties section for `tag`, rendered alone. */
function tiesOf(game: ReturnType<typeof fakeEndGame>["game"], tag: string) {
  const overlay = document.createElement(
    "player-info-overlay",
  ) as PlayerInfoOverlay;
  overlay.game = game as never;
  overlay.eventBus = new EventBus();
  const box = document.createElement("div");
  render(
    (overlay as unknown as { renderWwTies(p: unknown): unknown }).renderWwTies(
      game.playerBySmallID(ID(tag as never)),
    ),
    box,
  );
  return box;
}

const names = (box: HTMLElement, row: string) =>
  [...box.querySelectorAll(`[data-ww-tie=${row}] [data-ww-tie-country]`)].map(
    (e) => e.getAttribute("data-ww-tie-country"),
  );

describe("ww241: a country's ties on the country card", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows its faction, war, guarantees and subject with the right names", () => {
    // France: in the Allies under Britain, at war with Germany, guarantees
    // Poland (with Britain), and Italy is its puppet.
    const { game } = fakeEndGame({
      me: "SUN",
      wars: [["DEU", "FRA"]],
      global: {
        factions: startFactions(),
        guarantees: [
          [ID("GBR"), ID("POL")],
          [ID("FRA"), ID("POL")],
        ],
        naps: [[ID("FRA"), ID("SUN"), 0, true]],
        access: [[ID("GBR"), ID("FRA")]],
      },
      endgame: {
        subjects: [
          {
            subject: ID("ITA"),
            overlord: ID("FRA"),
            level: "puppet",
            autBp: 0,
            deltaBp: 0,
            neutral: false,
          },
        ],
      },
    });
    const fra = tiesOf(game, "FRA");
    expect(fra.querySelector("[data-ww-ties]")).not.toBeNull();
    expect(
      [...fra.querySelectorAll("[data-ww-tie]")].map((e) =>
        e.getAttribute("data-ww-tie"),
      ),
    ).toEqual([
      "faction",
      "war",
      "subjects",
      "guarantees",
      "nap",
      "access_gives",
    ]);
    const faction = fra.querySelector("[data-ww-tie=faction]")!.textContent!;
    expect(faction).toContain("[ww1936.ties.faction]");
    // The faction by name with its leader (the leader is not listed again).
    expect(faction).toContain('"leader":"[ww1936.country.GBR]"');
    expect(names(fra, "faction")).toEqual([]);
    expect(names(fra, "war")).toEqual(["DEU"]);
    expect(names(fra, "subjects")).toEqual(["ITA"]);
    expect(names(fra, "guarantees")).toEqual(["POL"]);
    expect(names(fra, "nap")).toEqual(["SUN"]);
    expect(names(fra, "access_gives")).toEqual(["GBR"]);
    expect(
      fra.querySelector("[data-ww-tie=war] [data-ww-tie-country]")!.textContent,
    ).toContain("[ww1936.country.DEU]");
    expect(fra.querySelector("[data-ww-tie=war] img")).not.toBeNull();

    // Poland, guaranteed by Britain and France; Italy under its overlord.
    expect(names(tiesOf(game, "POL"), "guaranteed_by")).toEqual(["GBR", "FRA"]);
    const ita = tiesOf(game, "ITA");
    expect(names(ita, "overlord")).toEqual(["FRA"]);
    expect(ita.querySelector("[data-ww-tie=overlord]")!.textContent).toContain(
      "[ww1936.subject_level.puppet]",
    );
    // The faction leader reads as the leader; its members are listed.
    const gbr = tiesOf(game, "GBR");
    expect(gbr.querySelector("[data-ww-tie=faction]")!.textContent).toContain(
      "[ww1936.ties.faction_leader",
    );
    expect(names(gbr, "faction")).toEqual(["FRA"]);
    expect(names(gbr, "access_has")).toEqual(["FRA"]);
  });

  it("a country with no ties shows no section; long lists are capped", () => {
    const { game } = fakeEndGame({
      me: "DEU",
      global: {
        factions: startFactions().filter((f) => f.key !== "comintern"),
        // Britain guarantees five countries: four names and "+1 more".
        guarantees: (["FRA", "DEU", "ITA", "POL", "SUN"] as const).map(
          (t) => [ID("GBR"), ID(t)] as [number, number],
        ),
      },
    });
    const pol = fakeEndGame({
      me: "DEU",
      global: { factions: [] },
    }).game;
    const none = tiesOf(pol, "POL");
    expect(none.querySelector("[data-ww-ties]")).toBeNull();
    expect(countryTies(pol, ID("POL"))).toEqual([]);

    const rows = countryTies(game, ID("GBR"));
    const g = rows.find((r) => r.id === "guarantees")!;
    expect(g.countries).toHaveLength(TIES_MAX_NAMES);
    expect(g.more).toBe('[ww1936.ties.more {"n":1}]');
  });
});
