// The designer's [Presets] and [Old -> New] buttons, and the idle bar's model.
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
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

import { idleEquipment } from "../../../src/client/hud/ww1936/LandModel";
import "../../../src/client/hud/ww1936/WwTemplateDesigner";
import type { WwTemplateDesigner } from "../../../src/client/hud/ww1936/WwTemplateDesigner";
import { detail } from "./EconomyFixture";
import { fakeLandGame, landDetail, startTemplate } from "./LandFixture";

async function mount(researched: string[]) {
  const g = fakeLandGame({
    details: [
      detail("DEU", {
        researched: [
          ...detail("DEU").researched,
          "engineer_company",
          "recon_company",
          ...researched,
        ] as never,
      }),
    ],
    landDetails: [landDetail("DEU", { armyXpMilli: 500_000 })],
  });
  const el = document.createElement(
    "ww-template-designer",
  ) as WwTemplateDesigner;
  el.game = g.game as never;
  el.eventBus = new EventBus();
  el.templateId = 0;
  document.body.appendChild(el);
  await el.updateComplete;
  const click = async (sel: string) => {
    el.querySelector<HTMLElement>(sel)!.click();
    await el.updateComplete;
  };
  return { el, click, q: (s: string) => el.querySelector<HTMLElement>(s) };
}

describe("template presets in the designer", () => {
  afterEach(() => (document.body.innerHTML = ""));

  it("lists every preset; a usable one fills the grid, a locked one names its need", async () => {
    const m = await mount([]);
    await m.click("[data-ww-presets]");
    expect(
      m.el.querySelectorAll("[data-ww-preset]").length,
    ).toBeGreaterThanOrEqual(20);
    const heavy = m.q("[data-ww-preset='pre_heavy_breakthrough']")!;
    expect(heavy.dataset.locked).toBe("true");
    expect(heavy.textContent).toContain("ww1936.land.needs_design");
    await m.click("[data-ww-preset='pre_heavy_breakthrough']");
    expect(
      m.el.querySelectorAll("[data-ww-slot-kind='battalion']"),
    ).toHaveLength(1);
    expect(m.q("[data-ww-preset='pre_light_armored']")!.dataset.locked).toBe(
      "false",
    );
    await m.click("[data-ww-preset='pre_light_armored']");
    // 4 light + 2 motorized + 1 mot_artillery, and the next empty cell.
    expect(
      m.el.querySelectorAll("[data-ww-slot-kind='battalion']"),
    ).toHaveLength(8);
    expect(m.q("[data-ww-preset-list]")).toBeNull();
  });

  it("[Old -> New] turns light tanks into medium ones once researched", async () => {
    const off = await mount(["medium_tank_1"]);
    await off.click("[data-ww-presets]");
    await off.click("[data-ww-preset='pre_light_armored']");
    expect(off.q("[data-ww-upgrade]")!.getAttribute("aria-disabled")).toBe(
      "false",
    );
    await off.click("[data-ww-upgrade]");
    expect(off.el.textContent).not.toContain("light_armor");
    // Light armour gone and mot_artillery in: nothing left to upgrade.
    expect(off.q("[data-ww-upgrade]")!.getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("the picker marks design-only battalions", async () => {
    const m = await mount(["medium_tank_1", "heavy_tank_1"]);
    await m.click("[data-ww-slot-kind='battalion'][data-ww-slot='0']");
    expect(
      m
        .q("[data-ww-pick='heavy_armor']")!
        .querySelector("[data-ww-design-only]"),
    ).not.toBeNull();
    expect(
      m.q("[data-ww-pick='infantry']")!.querySelector("[data-ww-design-only]"),
    ).toBeNull();
  });
});

describe("idle equipment", () => {
  it("offers the preset that uses an idle tank stock, once", () => {
    const researched = new Set([
      "motorized_1",
      "light_tank_1",
      "medium_tank_1",
      "recon_company",
      "engineer_company",
      "artillery_1",
    ] as const);
    const stock = new Array<number>(200).fill(0);

    stock[EQUIP_KEYS.findIndex(([t]) => t === "medium_tank")] = 120;
    const tpl = startTemplate("DEU");
    const idle = idleEquipment(stock, [tpl], researched as never, new Set());
    expect(idle).toMatchObject({
      type: "medium_tank",
      count: 120,
      preset: { id: "pre_medium_armored" },
    });
    const have = { ...tpl, id: 2, key: "pre_medium_armored" };
    expect(
      idleEquipment(stock, [tpl, have], researched as never, new Set())?.preset
        .id,
    ).not.toBe("pre_medium_armored");
  });
});
