// World War 1936 P2 (spec §15.6): a battle's card — the region, terrain
// and weather, both sides, the widths, the modifiers, and "leave this
// battle" for my attacking armies.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { ROLE_ATTACK } from "@openfront/engine-api/ww1936/LandTypes";
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

import {
  OpenWwBattleEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwBattleCard";
import type { WwBattleCard } from "../../../src/client/hud/ww1936/WwBattleCard";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail } from "./EconomyFixture";
import {
  army,
  battle,
  division,
  fakeLandGame,
  landDetail,
  LandOptions,
} from "./LandFixture";

async function mount(o: LandOptions = {}) {
  const g = fakeLandGame({
    ticks: 700,
    wars: [["DEU", "POL"]],
    details: [detail("DEU")],
    battles: [
      battle(7, "DEU", "POL", { width: 80, attWidth: 72, defWidth: 36 }),
    ],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  new WwLandController(g.game as never, bus, {
    scale: 1,
    screenToWorldCoordinatesFloat: (x, y) => ({ x, y }),
  }).init();
  const el = document.createElement("ww-battle-card") as WwBattleCard;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new OpenWwBattleEvent(7));
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  return { ...g, el, bus, sent, q };
}

describe("<ww-battle-card> (spec §15.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the battle: region, terrain, sides, widths and modifiers", async () => {
    const m = await mount();
    const card = m.q("[data-ww-battle-card='7']")!;
    expect(card.textContent).toContain("Krakow");
    expect(card.textContent).toContain("[ww1936.terrain.hills]");
    expect(m.q("[data-ww-battle-side='attacker']")!.textContent).toContain(
      "[ww1936.country.DEU]",
    );
    expect(
      m.q("[data-ww-battle-side='defender'] [data-ww-battle-width]")!
        .textContent,
    ).toBe("[ww1936.land.battle_width] used=36,width=80");
    // Hills: the attacker's −25%.
    const terrain = m.q("[data-ww-mods='attacker'] [data-ww-mod='terrain']")!;
    expect(terrain.textContent).toContain("[ww1936.mod.terrain]");
    expect(terrain.textContent).toContain("−25%");
    // Not mine: no "leave this battle"; no title anywhere.
    expect(m.q("[data-ww-leave-battle]")).toBeNull();
    expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
    expect(m.q("[data-ww-battle-close]")!.className).toContain("size-9");
  });

  it("my attacking army can leave the battle; choosing an army closes the card", async () => {
    const m = await mount({
      armies: [army(1, "DEU", 4)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 4, { battle: 7, role: ROLE_ATTACK })],
        }),
      ],
    });
    const leave = m.q("[data-ww-leave-battle]")!;
    expect(leave.className).toContain("h-9");
    leave.click();
    expect(m.sent).toEqual([{ kind: "army_execute", army: 1, on: false }]);
    m.bus.emit(new WwSelectArmyEvent(1));
    await m.el.updateComplete;
    expect(m.q("[data-ww-battle-card]")).toBeNull();
  });

  it("closes with ✕ and when the battle ends", async () => {
    const m = await mount();
    m.q("[data-ww-battle-close]")!.click();
    await m.el.updateComplete;
    expect(m.q("[data-ww-battle-card]")).toBeNull();
    m.bus.emit(new OpenWwBattleEvent(7));
    await m.el.updateComplete;
    expect(m.q("[data-ww-battle-card]")).not.toBeNull();
    m.land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [7],
        regions: [],
        countries: [],
        details: [],
      },
      701,
    );
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-battle-card]")).toBeNull();
  });
});
