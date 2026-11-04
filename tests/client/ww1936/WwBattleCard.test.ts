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
    // Hills: the attacker's −5 %.
    const terrain = m.q("[data-ww-mods='attacker'] [data-ww-mod='terrain']")!;
    expect(terrain.textContent).toContain("[ww1936.mod.terrain]");
    expect(terrain.textContent).toContain("−5%");
    // Not mine: no "leave this battle"; no title anywhere.
    expect(m.q("[data-ww-leave-battle]")).toBeNull();
    expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
    expect(m.q("[data-ww-battle-close]")!.className).toContain("size-10");
    // An engine that sends no forecast fields: no luck block at all.
    expect(m.q("[data-ww-luck]")).toBeNull();
  });

  it("ww7: the luck block — band, odds, ratio range, tactics (cancelled), initiative, reserve", async () => {
    const m = await mount({
      battles: [
        battle(7, "DEU", "POL", {
          band: 1,
          depth: 3,
          winPct: 72,
          lowPm: 1300,
          midPm: 1800,
          highPm: 2600,
          tacticAtt: 1,
          tacticDef: 1,
          initAtt: 61,
          initDef: 38,
          reinfPct: 40,
        }),
      ],
    });
    expect(m.q("[data-ww-battle-band]")!.textContent).toContain(
      "[ww1936.land.battle_band] n=2,d=3",
    );
    expect(m.q("[data-ww-odds]")!.getAttribute("data-ww-odds")).toBe("72");
    expect(m.q("[data-ww-odds] > div")!.getAttribute("style")).toContain(
      "width: 72%",
    );
    expect(m.q("[data-ww-odds-text]")!.textContent).toBe(
      "[ww1936.land.battle_odds] pct=72",
    );
    expect(m.q("[data-ww-range]")!.textContent).toContain(
      "[ww1936.land.battle_range] low=1.30,mid=1.80,high=2.60",
    );
    const tactics = m.q("[data-ww-tactics]")!;
    expect(tactics.textContent).toContain("[ww1936.tactic.assault]");
    expect(tactics.textContent).toContain("[ww1936.tactic.ambush]");
    expect(tactics.querySelector("[data-ww-tactic-cancel]")).not.toBeNull();
    expect(m.q("[data-ww-initiative]")!.textContent).toBe(
      "[ww1936.land.battle_initiative] att=61,def=38",
    );
    expect(m.q("[data-ww-reinforce]")!.textContent).toBe(
      "[ww1936.land.battle_reinforce] pct=40",
    );
  });

  it("ww7: each field of the luck block shows only when the engine sent it", async () => {
    // Tactics that do not cancel, nothing else.
    const m = await mount({
      battles: [battle(7, "DEU", "POL", { tacticAtt: 0, tacticDef: 0 })],
    });
    expect(m.q("[data-ww-tactics]")).not.toBeNull();
    expect(m.q("[data-ww-tactic-cancel]")).toBeNull();
    for (const sel of [
      "[data-ww-battle-band]",
      "[data-ww-odds]",
      "[data-ww-range]",
      "[data-ww-initiative]",
      "[data-ww-reinforce]",
    ]) {
      expect(m.q(sel), sel).toBeNull();
    }
    // The odds alone: a bar and its number, no range.
    const odds = await mount({
      battles: [battle(7, "DEU", "POL", { winPct: 35 })],
    });
    expect(odds.q("[data-ww-odds-text]")).not.toBeNull();
    expect(odds.q("[data-ww-range]")).toBeNull();
    expect(odds.q("[data-ww-tactics]")).toBeNull();
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
    expect(leave.className).toContain("h-10");
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
