// World War 1936 P2 (spec §15.1, §15.7, §15.8, §13.2, §13.3): the land
// war in the P0/P1 HUD — the ⚔ dial, the band's divisions and casualties,
// the region card's land lines, the notices' names, the overseas wars,
// the radial menu without tile attacks or boats, the research cards'
// new units.
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
} from "@openfront/engine-api/ww1936/LandTypes";
import { titledGeneralId } from "@openfront/engine-lib/ww1936/Generals";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

// The fronts are Task 3's (stubs here): border regions are my side's
// regions touching the enemy's.
vi.mock("@openfront/engine-lib/ww1936/FrontRules", async (orig) => {
  const real =
    await orig<typeof import("@openfront/engine-lib/ww1936/FrontRules")>();
  const borderRegionsOf: typeof real.borderRegionsOf = (w, me, enemy) =>
    w.scenario.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          w.sameSide(me, w.controller[r]) &&
          w.scenario
            .edgesOf(r)
            .some((e) =>
              enemy === 0
                ? w.isEnemy(me, w.controller[e.to])
                : w.controller[e.to] === enemy,
            ),
      );
  return { ...real, borderRegionsOf };
});

import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";
import "../../../src/client/hud/layers/PlayerInfoOverlay";
import type { PlayerInfoOverlay } from "../../../src/client/hud/layers/PlayerInfoOverlay";
import {
  centerButtonElement,
  MenuElementParams,
  rootMenuElement,
} from "../../../src/client/hud/layers/RadialMenuElements";
import { effectLines } from "../../../src/client/hud/ww1936/EconomyModel";
import { OpenWwArmyEvent } from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwDials";
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import type { WwDiplomacyPanel } from "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import "../../../src/client/hud/ww1936/WwTopBand";
import {
  ToggleWwDiplomacyEvent,
  type WwTopBand,
} from "../../../src/client/hud/ww1936/WwTopBand";
import { detail, region, summary, tileOf } from "./EconomyFixture";
import {
  army,
  fakeLandGame,
  ID,
  landDetail,
  LandOptions,
  landRegion,
  training,
} from "./LandFixture";

function game(o: LandOptions = {}) {
  return fakeLandGame({
    summaries: [summary("DEU")],
    details: [detail("DEU")],
    landDetails: [landDetail("DEU")],
    ...o,
  });
}

const landCountry = (divisions: number, casualtiesToday: number) => ({
  smallID: ID("DEU"),
  divisions,
  fieldMen: 472_500,
  trainingMen: 0,
  casualtiesToday,
  battles: 1,
  encircledArmies: 0,
});

describe("World War 1936 P2 in the HUD", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the ⚔ dial: the first division's training, armies fighting, encircled ones blink", async () => {
    const g = game({
      armies: [
        army(1, "DEU", 3, { state: ARMY_BATTLE }),
        army(2, "DEU", 4, { state: ARMY_BATTLE }),
      ],
      landDetails: [
        landDetail("DEU", {
          training: [
            training(1, { trainees: [{ days: 30, need: 120, fillPm: 1000 }] }),
          ],
        }),
      ],
    });
    const bus = new EventBus();
    const el = document.createElement("ww-dials") as WwDials;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const dial = el.querySelector<HTMLButtonElement>("[data-ww-dial='army']")!;
    expect(
      dial.querySelector("[data-ring]")!.getAttribute("data-progress"),
    ).toBe("0.25");
    const badge = dial.querySelector<HTMLElement>("[data-dial-badge]")!;
    expect([badge.dataset.dialBadge, badge.textContent]).toEqual([
      "fighting",
      "2",
    ]);
    const opened: OpenWwArmyEvent[] = [];
    bus.on(OpenWwArmyEvent, (e) => opened.push(e));
    dial.click();
    expect(opened.map((e) => e.tab)).toEqual(["armies"]);
    // One army encircled: its count, blinking.
    g.land.apply(
      {
        armies: [army(2, "DEU", 4, { state: ARMY_BATTLE | ARMY_ENCIRCLED })],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      601,
    );
    el.tick();
    await el.updateComplete;
    const blink = dial.querySelector<HTMLElement>("[data-dial-badge]")!;
    expect([blink.dataset.dialBadge, blink.textContent]).toEqual([
      "encircled",
      "1",
    ]);
    expect(blink.className).toContain("animate-pulse");
  });

  it("the band: my divisions, and today's casualties while at war", async () => {
    const mountBand = async (o: LandOptions) => {
      const g = game({ land: [landCountry(112, 3_200)], ...o });
      const bus = new EventBus();
      const band = document.createElement("ww-top-band") as WwTopBand;
      band.game = g.game as never;
      band.eventBus = bus;
      document.body.appendChild(band);
      band.tick();
      await band.updateComplete;
      return { band, bus };
    };
    const peace = await mountBand({});
    expect(
      peace.band.querySelector("[data-ww-divisions]")!.textContent!.trim(),
    ).toBe("🪖 112");
    expect(peace.band.querySelector("[data-ww-casualties]")).toBeNull();
    document.body.innerHTML = "";
    const war = await mountBand({ ticks: 700, wars: [["DEU", "POL"]] });
    expect(war.band.querySelector("[data-ww-casualties]")!.textContent).toBe(
      "[ww1936.land.band_casualties] n=3.2K",
    );
    // A count in the chip, not a button under 36 px: the ⚔ dial opens
    // the army drawer.
    expect(
      war.band.querySelector("[data-ww-economy] [data-ww-divisions]"),
    ).not.toBeNull();
    expect(war.band.querySelectorAll("button")).toHaveLength(2);
  });

  it("the region card's land lines", () => {
    const g = game({
      regions: [region(3, { fort: 3 })],
      landRegions: [
        landRegion(3, {
          supplyMilli: 34_000,
          useMilli: 12_000,
          counts: [[ID("DEU"), 4]],
          encircled: true,
        }),
      ],
    });
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = g.game as never;
    overlay.eventBus = new EventBus();
    const box = document.createElement("div");
    render(
      (
        overlay as unknown as { renderRegionLand(t: number): unknown }
      ).renderRegionLand(tileOf(3)),
      box,
    );
    const text = box.textContent!.replace(/\s+/g, " ");
    expect(text).toContain("[ww1936.terrain.plains]");
    expect(box.querySelector("[data-ww-region-fort]")!.textContent).toContain(
      "■■■□□",
    );
    expect(box.querySelector("[data-ww-region-rail]")!.textContent).toContain(
      "●●●○○",
    );
    expect(box.querySelector("[data-ww-region-supply]")!.textContent).toBe(
      "[ww1936.land.region_supply] have=34,use=12",
    );
    expect(box.querySelector("[data-ww-region-divisions]")!.textContent).toBe(
      "[ww1936.land.region_divisions] ours=4,theirs=0",
    );
    expect(box.querySelector("[data-ww-region-encircled]")).not.toBeNull();
    // Poland's Warsaw: no supply line (not my side).
    const other = document.createElement("div");
    render(
      (
        overlay as unknown as { renderRegionLand(t: number): unknown }
      ).renderRegionLand(tileOf(6)),
      other,
    );
    expect(other.querySelector("[data-ww-region-supply]")).toBeNull();
  });

  it("notices name the region, the army and the general", () => {
    const g = game();
    const events = new EventsDisplay();
    (events as unknown as { game: unknown }).game = g.game;
    const resolve = (message: string, params: Record<string, number>) =>
      (
        events as unknown as {
          resolveParams(e: unknown): Record<string, string | number>;
        }
      ).resolveParams({ message, params });
    expect(
      resolve("events_display.ww1936_region_taken", { region: 6 }),
    ).toEqual({
      region: "Warsaw",
    });
    expect(resolve("events_display.ww1936_encircled", { army: 2 }).army).toBe(
      "[ww1936.land.army_name_2] n=2",
    );
    expect(
      resolve("events_display.ww1936_general_available", { general: 1 })
        .general,
    ).toBe("[ww1936.general.rundstedt]");
    expect(
      resolve("events_display.ww1936_general_lost", {
        general: titledGeneralId(ID("DEU"), 2),
      }).general,
    ).toBe("[ww1936.land.titled_general] n=2");
  });

  it("the diplomacy drawer marks a war with no land front as overseas", async () => {
    const g = game({
      ticks: 700,
      wars: [
        ["DEU", "POL"],
        ["DEU", "GBR"],
      ],
    });
    const bus = new EventBus();
    const el = document.createElement("ww-diplomacy-panel") as WwDiplomacyPanel;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new ToggleWwDiplomacyEvent());
    await el.updateComplete;
    const wars = [...el.querySelectorAll("[data-ww-my-wars] li")].map((li) => [
      li.textContent!.includes("[ww1936.country.POL]"),
      li.querySelector("[data-ww-overseas]") !== null,
    ]);
    // Poland borders Germany; Britain only across the sea.
    expect(wars).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it("the radial menu has no tile attack and no boat in this mode", () => {
    const g = game({ ticks: 700, wars: [["DEU", "POL"]] });
    const poland = g.players[ID("POL") - 1];
    const me = {
      ...g.game.myPlayer()!,
      isAlliedWith: () => false,
      isDisconnected: () => false,
      isFriendly: () => false,
    };
    const params = (worldWar: boolean) =>
      ({
        myPlayer: me,
        selected: {
          ...poland,
          isAlliedWith: () => false,
          isFriendly: () => false,
          isDisconnected: () => false,
        },
        tile: tileOf(6),
        playerActions: {
          canAttack: true,
          buildableUnits: [],
          interaction: {},
        },
        game: {
          ...g.game,
          worldWarScenario: worldWar ? g.game.worldWarScenario : () => null,
          owner: () => poland,
          isLand: () => true,
          inSpawnPhase: () => false,
          config: () => ({ isUnitDisabled: () => false }),
        },
        eventBus: new EventBus(),
        closeMenu: () => {},
      }) as unknown as MenuElementParams;
    expect(rootMenuElement.subMenu!(params(true)).map((i) => i.id)).toEqual([
      "info",
      "ally_request",
    ]);
    expect(rootMenuElement.subMenu!(params(false)).map((i) => i.id)).toEqual([
      "info",
      "boat",
      "ally_request",
      "attack",
    ]);
    // The centre's sword attacks nothing here.
    expect(centerButtonElement.disabled(params(true))).toBe(true);
    expect(centerButtonElement.disabled(params(false))).toBe(false);
  });

  it("research cards name the battalion or company a land tech opens", () => {
    expect(effectLines("paratroopers")).toEqual([
      "[ww1936.effect.unlock_unit] unit=[ww1936.battalion.paratrooper]",
    ]);
    expect(effectLines("engineer_company")).toEqual([
      "[ww1936.effect.unlock_unit] unit=[ww1936.support.engineer]",
    ]);
    // An equipment generation keeps its own line only.
    expect(effectLines("artillery_1")).toHaveLength(1);
  });
});
