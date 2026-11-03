// World War 1936 w14: the map lenses on the test map (Germany me, Poland
// at war with it): the cells two lenses make, a region's readout, the
// source's quiet when nothing moved, and sea and air living in the same list.
import { EventBus } from "@openfront/shared/EventBus";
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

import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import {
  lensCells,
  lensMapSource,
  lensReadout,
  lensStats,
  TERRAIN_RGB,
  WEATHER_RGB,
} from "../../../src/client/hud/ww1936/LensModel";
import { SeaAirSelection } from "../../../src/client/hud/ww1936/SeaAirSelection";
import { today } from "../../../src/client/hud/ww1936/WorldWarModel";
import { WwDrawerEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwLens";
import type { WwLens } from "../../../src/client/hud/ww1936/WwLens";
import { WwPanelMinimizedEvent } from "../../../src/client/hud/ww1936/WwPanelMode";
import { seaAirOf } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { ID, region, scenario } from "./EconomyFixture";
import { fogGame } from "./FogFixture";

function sel(over: Partial<SeaAirSelection> = {}): SeaAirSelection {
  return Object.assign(new SeaAirSelection(), over);
}

describe("map lenses (w14)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("colours every region by its terrain, and by today's weather", () => {
    const g = fogGame({ level: 100 });
    const game = g.game as never;
    const terrain = lensCells(game, sel({ regionLens: "terrain" }));
    expect(terrain).toHaveLength(scenario.landRegions.length);
    for (const c of terrain) {
      expect(c.rgb).toEqual(TERRAIN_RGB[scenario.landOf(c.region)]);
    }
    // The test map's Lyon and Rome stand on different ground: different colours.
    const at = (r: number) => terrain.find((c) => c.region === r)!.rgb;
    expect(scenario.landOf(2)).not.toBe(scenario.landOf(5));
    expect(at(2)).not.toEqual(at(5));

    const day = today(game);
    const weather = lensCells(game, sel({ regionLens: "weather" }));
    for (const c of weather) {
      const w = weatherAt(
        day,
        scenario.latC(c.region),
        scenario.landOf(c.region),
        scenario.wcell(c.region),
      );
      expect(c.rgb).toEqual(WEATHER_RGB[w]);
    }
  });

  it("names a region's value: terrain effect, victory points and the surrender line", () => {
    const g = fogGame({ level: 100 });
    const game = g.game as never;
    const t = lensReadout(game, sel({ regionLens: "terrain" }), 4)!;
    expect(t.title).toBe(scenario.region(4)!.name);
    expect(t.lines.join("|")).toContain("[ww1936.terrain.forest]");
    expect(t.lines.join("|")).toContain("atk=-15");
    const vp = lensReadout(game, sel({ regionLens: "vp" }), 3)!;
    expect(vp.lines[0]).toBe("[ww1936.lens.vp_here] n=21");
    expect(vp.lines.join("|")).toContain("[ww1936.lens.vp_is_capital]");
    expect(vp.lines.join("|")).toContain("line=80,lost=0");
    // No region, no readout.
    expect(lensReadout(game, sel({ regionLens: "vp" }), 0)).toBeNull();
    expect(lensReadout(game, sel(), 3)).toBeNull();
  });

  it("recolours only when what the lens shows changed; no lens costs nothing", () => {
    const g = fogGame({
      level: 100,
      regions: [region(4, { fort: 2 })],
    });
    const game = g.game as never;
    const selection = sel();
    const src = lensMapSource(game, selection);
    const before = lensStats.builds;
    expect(src.on()).toBe(false);
    expect(lensStats.builds).toBe(before);

    selection.setRegionLens("defence");
    expect(src.on()).toBe(true);
    const k1 = src.key();
    expect(lensStats.builds).toBe(before + 1);
    expect(src.key()).toBe(k1);
    expect(lensStats.builds).toBe(before + 1);
    // The land view merged an update with the same facts: same colours, same key.
    g.land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      700,
    );
    expect(src.key()).toBe(k1);
    // A fort went up in Munich: the colours differ, so does the key.
    g.view.apply({
      countries: [],
      details: [],
      regions: [region(4, { fort: 5 })],
    });
    expect(src.key()).not.toBe(k1);
  });

  it("keeps sea and air in the same list: one lens at a time, off in one tap", () => {
    const g = fogGame({ level: 100 });
    const game = g.game as never;
    const bus = new EventBus();
    const el = document.createElement("ww-lens") as WwLens;
    el.game = game;
    el.eventBus = bus;
    document.body.appendChild(el);
    const s = seaAirOf(game).selection;
    const src = lensMapSource(game, s);

    el.choose("air");
    expect(s.layer).toBe("air");
    expect(src.on()).toBe(false);
    el.choose("terrain");
    expect(s.layer).toBe("none");
    expect(s.regionLens).toBe("terrain");
    expect(src.on()).toBe(true);
    el.choose("sea");
    expect(s.layer).toBe("sea");
    expect(s.regionLens).toBe("none");
    expect(src.on()).toBe(false);
    el.choose("sea");
    expect(s.layer).toBe("none");
    expect(s.regionLens).toBe("none");
    expect(ID("DEU")).toBeGreaterThan(0);
  });

  it("steps aside while a full-screen panel covers the map, and comes back", async () => {
    const g = fogGame({ level: 100 });
    const bus = new EventBus();
    const el = document.createElement("ww-lens") as WwLens;
    el.game = g.game as never;
    el.eventBus = bus;
    el.init();
    document.body.appendChild(el);
    const shown = async () => {
      await el.updateComplete;
      return el.querySelector("[data-ww-lens-button]") !== null;
    };
    expect(await shown()).toBe(true);

    bus.emit(new WwDrawerEvent("research", true));
    expect(await shown()).toBe(false);
    // Opening the next panel closes the last one after it says so.
    bus.emit(new WwDrawerEvent("focus", true));
    bus.emit(new WwDrawerEvent("research", false));
    expect(await shown()).toBe(false);
    // A map flow sets the panel aside: the map is back, so is the button.
    bus.emit(new WwPanelMinimizedEvent(true));
    expect(await shown()).toBe(true);
    bus.emit(new WwPanelMinimizedEvent(false));
    expect(await shown()).toBe(false);
    bus.emit(new WwDrawerEvent("focus", false));
    expect(await shown()).toBe(true);
  });
});
