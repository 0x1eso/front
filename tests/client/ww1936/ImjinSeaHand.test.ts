// ww177 P3 (Imjin design §6.2): the sea by hand. The fleet card's era hulls,
// bars, wind, battle circle and chips; a tap on the sea moves a chosen
// Imjin fleet, a drag from it sets a heading, the decoy takes a tap; and the
// pure parts (sides, the wind's arrow, the current's countdown, the heading
// target, the atlas cells).
import type { ImjinData } from "@openfront/engine-api/imjin/ImjinTypes";
import { IMJIN_SHIP_KINDS } from "@openfront/engine-api/imjin/ImjinTypes";
import { WwOrder, WwOrderSchema } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import shipAtlasMeta from "resources/atlases/ship-atlas-meta.json";
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

import { WwFleetSelectedEvent } from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwFleetCard";
import type { WwFleetCard } from "../../../src/client/hud/ww1936/WwFleetCard";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import {
  ClaimDragEvent,
  WwStrokeEvent,
} from "../../../src/client/InputHandler";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { IMJIN_FLEET_ID_BASE } from "../../../src/client/view/ImjinFleets";
import {
  currentCountdown,
  headingTarget,
  imjinBattleShare,
  imjinBattleViews,
  imjinShipCell,
  imjinWindOver,
  windShown,
} from "../../../src/client/view/ImjinSea";
import { seaGame, SID } from "./SeaAirFixture";

const ME = SID("GBR");
const FOE = SID("DEU");

function data(battle = 0): ImjinData {
  return {
    fleets: [
      {
        id: 1,
        owner: ME,
        x: 85_500,
        y: 110_500,
        heading: 0,
        ships: 3,
        order: "hold",
        formation: "line",
        morale: 800,
        battle,
        target: -1,
        hullPm: 900,
      },
      ...(battle === 0
        ? []
        : [
            {
              id: 2,
              owner: FOE,
              x: 90_500,
              y: 110_500,
              heading: 512,
              ships: 2,
              order: "board",
              formation: "wedge",
              morale: 400,
              battle,
              target: -1,
              hullPm: 500,
            },
          ]),
    ],
    ships: [
      [1, 1, ME, 85_500, 110_500, 0, 0, 0],
      [2, 1, ME, 85_000, 111_000, 0, 1, 0],
      [3, 1, ME, 86_000, 111_000, 0, 2, 1],
    ],
    battles:
      battle === 0
        ? []
        : [
            {
              id: battle,
              cx: 88_000,
              cy: 110_500,
              current: 1,
              turnIn: 125,
              flow: 1,
              shores: ME,
            },
          ],
    winds: [],
    groups: [],
    orders: [],
    sieges: [],
  };
}

async function mount() {
  const g = seaGame({ wars: [["GBR", "DEU"]] });
  const game = { ...g.game, gameID: () => "IMJINTEST" };
  g.navy.applyImjin(data(), 700);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const controller = new WwSeaAirController(game as never, bus, () => 4, {
    layout: () => [],
    hit: () => 0,
    now: () => 50_000,
  });
  controller.init();
  const el = document.createElement("ww-fleet-card") as WwFleetCard;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const redraw = async () => {
    el.tick();
    await el.updateComplete;
  };
  const click = async (sel: string) => {
    q(sel)!.click();
    await redraw();
  };
  return { ...g, el, bus, sent, q, redraw, click, controller };
}

describe("the Imjin sea by hand (design §6.2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the card, its chips, a tap to move, a drag for a heading, the decoy", async () => {
    const m = await mount();
    const id = IMJIN_FLEET_ID_BASE + 1;
    m.bus.emit(new WwFleetSelectedEvent(id));
    await m.redraw();
    expect(m.q("[data-imjin-card]")).not.toBeNull();
    const kinds = m.q("[data-imjin-kinds]")!.textContent!;
    for (const k of ["panokseon", "turtle", "hyeopseon"]) {
      expect(kinds).toContain(`imjin.sea.kind.${k}`);
    }
    expect(m.q("[data-ww-bar='morale']")!.textContent).toContain("80%");
    expect(m.q("[data-imjin-wind]")).not.toBeNull();
    expect(m.q("[data-imjin-burning]")!.textContent).toContain("n=1");
    expect(m.q("[data-ww-hint='steer']")).not.toBeNull();
    // No 1936 lines on an Imjin card.
    expect(m.q("[data-ww-fleet-fuel]")).toBeNull();

    // Formation and order chips; the line says what the chip does.
    await m.click("[data-ww-fleet-btn='imjin_formation_crane']");
    expect(m.q("[data-imjin-note='crane']")).not.toBeNull();
    expect(
      m.q("[data-ww-fleet-btn='imjin_formation_crane']")!.className,
    ).toContain("border-dashed");
    await m.click("[data-ww-fleet-btn='imjin_keep_range']");
    // Greyed out of battle: the fire ship and break off; with no convoy of
    // mine at sea, the escort. Each says why.
    await m.click("[data-ww-fleet-btn='imjin_fire_ship']");
    expect(m.q("[data-imjin-note='fire_ship']")!.textContent).toContain(
      "imjin.sea.fire_ship_closed",
    );
    await m.click("[data-ww-fleet-btn='imjin_escort']");
    expect(m.q("[data-imjin-note='escort']")!.textContent).toContain(
      "imjin.sea.escort_closed",
    );
    await m.click("[data-ww-fleet-btn='imjin_break_off']");
    expect(m.sent.map((o) => (o as { order?: string }).order)).toEqual([
      "formation",
      "keep_range",
    ]);
    expect(m.sent[0]).toMatchObject({ formation: "crane", fleet: 1 });

    // A tap on the sea sails there at once.
    expect(m.controller.handleTap(90.2, 110.4)).toBe(true);
    expect(m.sent[m.sent.length - 1]).toEqual({
      kind: "imjin_fleet",
      fleet: 1,
      order: "move",
      tile: 110 * 200 + 90,
      formation: "line",
    });

    // The decoy: its chip, then the sea it flees to.
    await m.click("[data-ww-fleet-btn='imjin_lure']");
    expect(m.controller.draft.mode).toBe("lure");
    m.controller.handleTap(80.5, 108.5);
    expect(m.sent[m.sent.length - 1]).toMatchObject({
      order: "lure",
      tile: 108 * 200 + 80,
    });
    expect(m.controller.draft.mode).toBe("none");

    // A drag from the fleet: the arrow follows, the release orders a heading.
    const claim = new ClaimDragEvent(85.6, 110.6, false);
    m.bus.emit(claim);
    expect(claim.claimed).toBe(true);
    m.bus.emit(new WwStrokeEvent("start", 85.6, 110.6));
    m.bus.emit(new WwStrokeEvent("move", 89, 110.5));
    expect(m.controller.selection.aim).toMatchObject({ x: 89, y: 110.5 });
    m.bus.emit(new WwStrokeEvent("end", 89, 110.5));
    expect(m.controller.selection.aim).toBeNull();
    const last = m.sent[m.sent.length - 1] as { order: string; tile: number };
    expect(last.order).toBe("move");
    // At least 8 tiles out, east along the row.
    expect(Math.floor(last.tile / 200)).toBe(110);
    expect(last.tile % 200).toBeGreaterThanOrEqual(93);
    // A press away from the fleet is the map's.
    const far = new ClaimDragEvent(40, 20, false);
    m.bus.emit(far);
    expect(far.claimed).toBe(false);

    // In battle: both sides' bars, the current's turn (we hold both
    // shores), and break off, the fire ship and the escort open.
    m.navy.applyImjin(
      {
        ...data(5),
        groups: [{ id: 1, owner: ME, x: 80_000, y: 110_000, convoys: 4 }],
      },
      760,
    );
    await m.redraw();
    expect(m.q("[data-imjin-current='known']")!.textContent).toContain("s=13");
    await m.click("[data-ww-fleet-btn='imjin_fire_ship']");
    expect(m.sent[m.sent.length - 1]).toMatchObject({
      order: "fire_ship",
      fleet: 1,
    });
    await m.click("[data-ww-fleet-btn='imjin_escort']");
    expect(m.sent[m.sent.length - 1]).toMatchObject({
      order: "escort",
      fleet: 1,
    });
    expect(m.q("[data-imjin-battle='5']")).not.toBeNull();
    expect(m.q("[data-imjin-side='us']")!.textContent).toContain("n=3");
    expect(m.q("[data-imjin-side='them']")!.textContent).toContain("n=2");
    expect(m.q("[data-ww-bar='them_morale']")!.textContent).toContain("40%");
    await m.click("[data-ww-fleet-btn='imjin_break_off']");
    expect(m.sent[m.sent.length - 1]).toMatchObject({ order: "break_off" });
    for (const o of m.sent)
      expect(WwOrderSchema.safeParse(o).success).toBe(true);
  });

  it("the battle's sides, the wind, the current's countdown, the heading, the hulls", () => {
    const v = imjinBattleViews(data(5), FOE)[0];
    // Side 0 is the viewer's.
    expect(v.sides[0]).toMatchObject({ owners: [FOE], ships: 2, morale: 400 });
    expect(v.sides[1]).toMatchObject({ owners: [ME], ships: 3, hullPm: 900 });
    expect(imjinBattleShare(v)).toBeCloseTo((2 * 900) / (2 * 900 + 3 * 1700));

    // The wind blows to the north (768): from the south, arrow up.
    expect(windShown({ to: 768, strength: 2 })).toEqual({
      arrow: "↑",
      from: "s",
      strength: 2,
    });
    expect(windShown({ to: 100, strength: 0 }).arrow).toBe("·");

    // The engine's current: the countdown shows only to the side holding
    // both shores.
    const b = { current: 1, turnIn: 150, flow: -1, shores: FOE };
    expect(currentCountdown(b, (o) => o === FOE)).toEqual({
      seconds: 15,
      with: false,
    });
    expect(currentCountdown(b, (o) => o === ME)).toBeNull();
    expect(currentCountdown({ ...b, shores: 0 }, () => true)).toBeNull();

    // The wind over a fleet is the engine's for its zone; calm without one.
    const sc = { width: 10, height: 8, regionAt: () => 40_001 };
    const winds = { winds: [[40_001, 768, 2]] };
    expect(imjinWindOver(winds, sc, 5_000, 4_000)).toEqual({
      to: 768,
      strength: 2,
    });
    expect(imjinWindOver({ winds: [] }, sc, 5_000, 4_000).strength).toBe(0);

    // A heading stops at the last water before land.
    const W = 10;
    const sea = (t: number) => t % W < 7;
    expect(headingTarget(1.5, 4.5, 2.5, 4.5, W, 8, sea)).toBe(4 * W + 6);
    expect(headingTarget(1.5, 4.5, 1.6, 4.5, W, 8, sea)).toBe(-1);

    // Every era hull has its own atlas cell.
    const cells = shipAtlasMeta.cells as Record<string, number>;
    IMJIN_SHIP_KINDS.forEach((_k, i) => {
      expect(cells[imjinShipCell(i)]).toBeGreaterThanOrEqual(28);
    });
  });
});
