// @vitest-environment jsdom
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { designBlock } from "@openfront/engine-lib/ww1936/DesignRules";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  designerLayout,
  DesignerModel,
} from "../../../src/client/hud/ww1936/DesignerModel";
import { designerGame } from "./DesignerFixture";

describe("designer taps", () => {
  it("saving a medium II long-gun tank takes six taps or fewer", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank"); // 1: open
    m.setBase("medium_2"); // 2: base chip
    m.selectSlot(0); // 3: slot card
    m.setModule(0, "gun_hv"); // 4: module row
    expect(m.tapSave(1_000)).toBeNull(); // 5: arm
    const order = m.tapSave(2_000); // 6: confirm
    expect(m.taps).toBeLessThanOrEqual(6);
    expect(order).toMatchObject({ kind: "design_save" });
    const def = (order as { def: Parameters<typeof designBlock>[0] }).def;
    expect(
      designBlock(def, {
        techs: new Set(WW_TECH_IDS),
        projects: 0,
        treatyMember: false,
        treatyEscalated: false,
      }),
    ).toBeNull();
  });

  it("the recommended fill needs four taps", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("medium_2");
    m.recommend();
    m.tapSave(1_000);
    expect(m.tapSave(2_000)).not.toBeNull();
    expect(m.taps).toBe(5);
  });

  it("a confirming tap that comes too soon does not save", () => {
    const m = new DesignerModel(designerGame());
    m.open("tank");
    m.setBase("light_1");
    m.tapSave(1_000);
    expect(m.tapSave(1_100)).toBeNull();
  });

  it("the phone layout keeps the grid and the stats column inside 844 × 390", () => {
    for (const slots of [6, 7, 5, 4, 3]) {
      const l = designerLayout(844, 390, slots);
      expect(l.drawerW).toBe(540);
      expect(l.fits).toBe(true);
      expect(l.gridH).toBeLessThanOrEqual(l.middleH);
      expect(l.sheetH).toBe(Math.floor(l.drawerH * 0.55));
    }
  });
});

describe("<ww-designer>", () => {
  it("opens from the design button's event and saves with two taps", async () => {
    const { EventBus } = await import("@openfront/shared/EventBus");
    const { WwDepthOpenEvent } =
      await import("../../../src/client/hud/ww1936/DepthEvents");
    const { SendWwOrderIntentEvent } =
      await import("../../../src/client/Transport");
    await import("../../../src/client/hud/ww1936/WwDesigner");
    const bus = new EventBus();
    const sent: unknown[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement("ww-designer") as HTMLElement & {
      game: unknown;
      eventBus: unknown;
      updateComplete: Promise<boolean>;
      init(): void;
    };
    el.game = designerGame();
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new WwDepthOpenEvent("designer", { kind: "tank" }));
    await el.updateComplete;
    const click = async (sel: string) => {
      (el.querySelector(sel) as HTMLElement).click();
      await el.updateComplete;
    };
    await click("[data-ww-base=medium_2]");
    await click("[data-ww-slot='0']");
    await click("[data-ww-module-row=gun_hv]");
    expect(el.querySelectorAll("[data-ww-stat]")).toHaveLength(8);
    await click("[data-ww-design-save]");
    expect(sent).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 400));
    await click("[data-ww-design-save]");
    expect(sent).toHaveLength(1);
    el.remove();
  });
});
