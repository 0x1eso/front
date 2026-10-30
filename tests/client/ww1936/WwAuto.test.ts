// World War 1936: the automation switches on the screens (owner brief
// 2026-10-30) — the economy drawer's "자동 운영" row, each domain drawer's
// own switch (the navy drawer's too), the dock's "자동" badge, the army
// drawer's [모든 군 자동] / [모든 군 수동] pair, and the "A" mark on my auto
// armies' tokens.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { ARMY_AUTO } from "@openfront/engine-api/ww1936/LandTypes";
import { wwAutoBit } from "@openfront/engine-api/ww1936/WorldWarTypes";
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

import { WwLandSelection } from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyPanel";
import type { WwArmyPanel } from "../../../src/client/hud/ww1936/WwArmyPanel";
import {
  autoMaskOf,
  autoToggleOrder,
} from "../../../src/client/hud/ww1936/WwAutoUi";
import "../../../src/client/hud/ww1936/WwDials";
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import {
  OpenWwIndustryEvent,
  OpenWwNavyEvent,
  OpenWwResearchEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import "../../../src/client/hud/ww1936/WwNavyPanel";
import type { WwNavyPanel } from "../../../src/client/hud/ww1936/WwNavyPanel";
import "../../../src/client/hud/ww1936/WwResearchPanel";
import type { WwResearchPanel } from "../../../src/client/hud/ww1936/WwResearchPanel";
import { ArmyTokenPass } from "../../../src/client/render/gl/passes/ArmyTokenPass";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { TokenLayoutCache } from "../../../src/client/view/LandTokenLayout";
import { detail, fakeEconGame, ID, summary } from "./EconomyFixture";
import { army, fakeLandGame, landDetail } from "./LandFixture";
import { seaGame, SID } from "./SeaAirFixture";

type Game = ReturnType<typeof fakeEconGame>["game"];

/** My switches as the engine's WorldWar data sends them. */
function setMask(game: Game, mask: number): void {
  const data = game.worldWarData() as { auto?: unknown };
  data.auto = mask === 0 ? undefined : [{ smallID: ID("DEU"), mask }];
}

function wire<T extends HTMLElement>(
  tag: string,
  game: unknown,
  bus: EventBus,
) {
  const el = document.createElement(tag) as T;
  (el as unknown as { game: unknown }).game = game;
  (el as unknown as { eventBus: EventBus }).eventBus = bus;
  document.body.appendChild(el);
  (el as unknown as { init(): void }).init();
  return el;
}

function econ() {
  const { game } = fakeEconGame({
    summaries: [summary("DEU")],
    details: [detail("DEU")],
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  return { game, bus, sent };
}

describe("automation on the screens", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("my mask comes from the WorldWar data; a tap flips one domain", () => {
    const { game } = econ();
    expect(autoMaskOf(game, ID("DEU"))).toBe(0);
    setMask(game, wwAutoBit("research"));
    expect(autoMaskOf(game, ID("DEU"))).toBe(2);
    expect(autoMaskOf(game, ID("POL"))).toBe(0);
    expect(autoToggleOrder(2, "research")).toEqual({
      kind: "auto_set",
      domain: "research",
      on: false,
    });
    expect(autoToggleOrder(2, "air")).toEqual({
      kind: "auto_set",
      domain: "air",
      on: true,
    });
  });

  it("the economy drawer's 자동 운영 row: five switches with labels", async () => {
    const { game, bus, sent } = econ();
    setMask(game, wwAutoBit("training"));
    const el = wire<WwIndustryPanel>("ww-industry-panel", game, bus);
    bus.emit(new OpenWwIndustryEvent());
    await el.updateComplete;
    const row = el.querySelector("[data-ww-auto-row]")!;
    expect(row.textContent).toContain("[ww1936.auto.title]");
    const switches = [
      ...row.querySelectorAll<HTMLButtonElement>("[data-ww-auto]"),
    ];
    expect(switches.map((b) => b.dataset.wwAuto)).toEqual([
      "production",
      "research",
      "training",
      "air",
      "navy",
    ]);
    expect(switches.map((b) => b.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(switches[0].textContent).toContain("[ww1936.auto.production]");
    expect(switches[4].textContent).toContain("[ww1936.auto.navy]");
    switches[0].click();
    switches[2].click();
    switches[4].click();
    expect(sent).toEqual([
      { kind: "auto_set", domain: "production", on: true },
      { kind: "auto_set", domain: "training", on: false },
      { kind: "auto_set", domain: "navy", on: true },
    ]);
  });

  it("the research drawer shows its own switch in the head", async () => {
    const { game, bus, sent } = econ();
    setMask(game, wwAutoBit("research"));
    const el = wire<WwResearchPanel>("ww-research-panel", game, bus);
    bus.emit(new OpenWwResearchEvent());
    await el.updateComplete;
    const head = el.querySelector("[data-ww-drawer-head]")!;
    const sw = head.querySelector<HTMLButtonElement>("[data-ww-auto]")!;
    expect(sw.dataset.wwAuto).toBe("research");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    sw.click();
    expect(sent).toEqual([{ kind: "auto_set", domain: "research", on: false }]);
  });

  it("the navy drawer shows the navy switch in its head", async () => {
    const g = seaGame();
    const bus = new EventBus();
    const sent: WwOrder[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = wire<WwNavyPanel>("ww-navy-panel", g.game, bus);
    bus.emit(new OpenWwNavyEvent("fleets"));
    await el.updateComplete;
    const sw = () =>
      el
        .querySelector("[data-ww-drawer-head]")!
        .querySelector<HTMLButtonElement>("[data-ww-auto]")!;
    expect(sw().dataset.wwAuto).toBe("navy");
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(sw().getAttribute("aria-label")).toContain("[ww1936.auto.navy]");
    sw().click();
    expect(sent).toEqual([{ kind: "auto_set", domain: "navy", on: true }]);
    // The engine's data says it is on: the head redraws with it.
    const data = g.game.worldWarData() as { auto?: unknown };
    data.auto = [{ smallID: SID("GBR"), mask: wwAutoBit("navy") }];
    (el as unknown as { tick(): void }).tick();
    await el.updateComplete;
    expect(sw().getAttribute("aria-checked")).toBe("true");
    sw().click();
    expect(sent[1]).toEqual({ kind: "auto_set", domain: "navy", on: false });
  });

  it("the dock's 🏭 carries a 자동 badge while any switch is on", async () => {
    const { game, bus } = econ();
    const el = wire<WwDials>("ww-dials", game, bus);
    el.tick();
    await el.updateComplete;
    const badge = () =>
      el.querySelector("[data-ww-dial='industry'] [data-dial-badge='auto']");
    expect(badge()).toBeNull();
    setMask(game, wwAutoBit("air"));
    el.tick();
    await el.updateComplete;
    expect(badge()!.textContent).toBe("[ww1936.auto.badge]");
    // The navy alone says so too.
    setMask(game, wwAutoBit("navy"));
    el.tick();
    await el.updateComplete;
    expect(badge()).not.toBeNull();
    setMask(game, 0);
    el.tick();
    await el.updateComplete;
    expect(badge()).toBeNull();
  });

  it("the army drawer: its training switch and the all-armies pair", async () => {
    const g = fakeLandGame({
      details: [detail("DEU")],
      summaries: [summary("DEU")],
      armies: [army(1, "DEU", 3), army(2, "DEU", 4)],
      landDetails: [landDetail("DEU")],
    });
    const bus = new EventBus();
    const sent: WwOrder[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = wire<WwArmyPanel>("ww-army-panel", g.game, bus);
    (el as unknown as { setOpen(o: boolean): void }).setOpen(true);
    await el.updateComplete;
    const head = el.querySelector("[data-ww-drawer-head]")!;
    expect(
      head.querySelector<HTMLElement>("[data-ww-auto]")!.dataset.wwAuto,
    ).toBe("training");
    const on = el.querySelector<HTMLButtonElement>(
      "[data-ww-army-auto-all='on']",
    )!;
    const off = el.querySelector<HTMLButtonElement>(
      "[data-ww-army-auto-all='off']",
    )!;
    expect(on.textContent).toContain("[ww1936.auto.all_auto]");
    expect(off.textContent).toContain("[ww1936.auto.all_manual]");
    // No army is auto yet: "every army manual" has nothing to do.
    expect(off.disabled).toBe(true);
    on.click();
    expect(sent).toEqual([{ kind: "army_auto_all", on: true }]);
  });
});

describe("the A mark on my auto armies' tokens", () => {
  it("the token's state keeps ARMY_AUTO for my armies only", () => {
    const written: Float32Array[] = [];
    const gl = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
          if (prop === "bufferSubData") {
            return (
              _t: number,
              _o: number,
              d: Float32Array,
              _s: number,
              n: number,
            ) => written.push(d.slice(0, n));
          }
          if (prop === "getProgramParameter") return () => true;
          if (prop === "getShaderParameter") return () => true;
          return () => ({});
        },
      },
    ) as WebGL2RenderingContext;
    const g = fakeLandGame({
      armies: [
        army(1, "DEU", 3, { state: ARMY_AUTO }),
        army(2, "POL", 6, { state: ARMY_AUTO }),
      ],
    });
    const tex = {} as WebGLTexture;
    const pass = new ArmyTokenPass(gl, tex, tex);
    const layout = new TokenLayoutCache();
    const changed = layout.update(g.land, 0, 4);
    pass.update(g.land, layout, changed, new WwLandSelection(), ID("DEU"));
    const f = written[written.length - 1];
    const states = new Map<number, number>();
    for (let o = 0; o + 12 <= f.length; o += 12) {
      if (f[o + 2] === 0) states.set(f[o + 3], f[o + 8]);
    }
    expect([...states.keys()].sort((a, b) => a - b)).toEqual(
      [ID("DEU"), ID("POL")].sort((a, b) => a - b),
    );
    expect(states.get(ID("DEU"))! & ARMY_AUTO).toBe(ARMY_AUTO);
    expect(states.get(ID("POL"))! & ARMY_AUTO).toBe(0);
  });
});
