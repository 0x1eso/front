// World War 1936 P1 (spec §13.5): "Build here" on a touch screen. The
// region card shows under the radial menu's full-screen overlay, which
// takes the tap, so the radial menu carries the button there.
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import "../../../src/client/hud/layers/PlayerInfoOverlay";
import type { PlayerInfoOverlay } from "../../../src/client/hud/layers/PlayerInfoOverlay";
import {
  MenuElementParams,
  rootMenuElement,
  wwBuildHereElement,
} from "../../../src/client/hud/layers/RadialMenuElements";
import { OpenWwIndustryEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import { Platform } from "../../../src/client/Platform";
import {
  detail,
  fakeEconGame,
  ID,
  region,
  summary,
  tileOf,
} from "./EconomyFixture";

/** The radial menu's params on `tile`, which my country owns. */
function params(game: ReturnType<typeof fakeEconGame>["game"], tile: number) {
  const bus = new EventBus();
  const me = {
    ...game.myPlayer()!,
    isAlliedWith: () => false,
    isDisconnected: () => false,
  };
  const closeMenu = vi.fn();
  const p = {
    myPlayer: me,
    selected: me,
    tile,
    playerActions: { canAttack: false, buildableUnits: [], interaction: {} },
    game: {
      ...game,
      owner: () => me,
      isLand: () => true,
      config: () => ({ isUnitDisabled: () => false }),
    },
    eventBus: bus,
    closeMenu,
  } as unknown as MenuElementParams;
  return { p, bus, closeMenu };
}

describe("World War 1936: Build here on a touch screen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("the radial menu on my own region opens construction there", () => {
    const { game } = fakeEconGame({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    const { p, bus, closeMenu } = params(game, tileOf(4));
    const items = rootMenuElement.subMenu!(p);
    // It takes the alliance request's slot (no alliance with myself).
    expect(items.map((i) => i.id)).toEqual([
      "info",
      "delete",
      "ww_build_here",
      "build",
    ]);
    const item = items[2];
    expect(item.text).toBe("[ww1936.econ.build_here]");
    expect(item.disabled(p)).toBe(false);
    const opened: OpenWwIndustryEvent[] = [];
    bus.on(OpenWwIndustryEvent, (e) => opened.push(e));
    item.action!(p);
    // Munich, on the construction tab; the menu (and with it the card) closes.
    expect(opened.map((e) => [e.tab, e.region])).toEqual([["construction", 4]]);
    expect(closeMenu).toHaveBeenCalledOnce();
  });

  it("is off where I don't hold the region, and outside the mode", () => {
    // My tile, but Poland still holds the region (a border tile).
    const { game } = fakeEconGame({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      regions: [region(6, { controller: ID("POL") })],
    });
    const off = params(game, tileOf(6));
    expect(wwBuildHereElement(off.p)!.disabled(off.p)).toBe(true);
    // Not World War 1936: the vanilla ring, alliance request and all.
    const vanilla = params(
      { ...game, worldWarScenario: () => null } as never,
      tileOf(4),
    );
    expect(wwBuildHereElement(vanilla.p)).toBeNull();
    expect(rootMenuElement.subMenu!(vanilla.p).map((i) => i.id)).toEqual([
      "info",
      "delete",
      "ally_request",
      "build",
    ]);
  });

  it("the region card keeps its button off touch screens", () => {
    const { game } = fakeEconGame({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = game as never;
    overlay.eventBus = new EventBus();
    const card = () => {
      const box = document.createElement("div");
      render(
        (
          overlay as unknown as { renderRegionEconomy(t: number): unknown }
        ).renderRegionEconomy(tileOf(4)),
        box,
      );
      return box;
    };
    const touch = vi.spyOn(Platform, "isTouch", "get").mockReturnValue(false);
    expect(card().querySelector("[data-ww-build-here]")).not.toBeNull();
    touch.mockReturnValue(true);
    const box = card();
    expect(box.querySelector("[data-ww-build-here]")).toBeNull();
    // The rest of the card still shows.
    expect(box.querySelector("[data-ww-region-economy]")).not.toBeNull();
  });
});
