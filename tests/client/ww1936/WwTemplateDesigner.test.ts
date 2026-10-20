// World War 1936 P2 (spec §15.5 tab 3, pre-flight U1): the template
// designer — the 5 × 5 grid and the support slots, the battalion list
// (locked ones name their tech), changed cells, the numbers, the army
// experience, save (two taps when it costs), copy, delete (two taps).
import type { WwOrder } from "@openfront/engine-api/Schemas";
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

import "../../../src/client/hud/ww1936/WwTemplateDesigner";
import type { WwTemplateDesigner } from "../../../src/client/hud/ww1936/WwTemplateDesigner";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail } from "./EconomyFixture";
import {
  fakeLandGame,
  landDetail,
  LandOptions,
  startTemplate,
} from "./LandFixture";

/** Germany's techs with the companies its 1936 infantry uses. */
const RESEARCHED = [
  ...detail("DEU").researched,
  "engineer_company",
  "recon_company",
] as const;

async function mount(templateId: number, o: LandOptions = {}) {
  const g = fakeLandGame({
    details: [detail("DEU", { researched: [...RESEARCHED] })],
    landDetails: [landDetail("DEU", { armyXpMilli: 62_000 })],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement(
    "ww-template-designer",
  ) as WwTemplateDesigner;
  el.game = g.game as never;
  el.eventBus = bus;
  el.templateId = templateId;
  let closed = 0;
  el.addEventListener("ww-designer-close", () => closed++);
  document.body.appendChild(el);
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    await el.updateComplete;
  };
  return { el, sent, q, click, closed: () => closed };
}

const slot = (kind: string, i: number) =>
  `[data-ww-slot-kind='${kind}'][data-ww-slot='${i}']`;

describe("<ww-template-designer> (spec §15.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("edits the grid: the changed cell turns yellow, the numbers and the cost follow", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount(1);
    // German infantry: 11 battalions and the next empty cell, 25 places.
    expect(m.el.querySelectorAll("[data-ww-battalion-grid] > *")).toHaveLength(
      25,
    );
    expect(
      m.el.querySelectorAll("[data-ww-slot-kind='battalion']"),
    ).toHaveLength(12);
    expect(m.q("[data-ww-designer-xp]")!.textContent).toContain(
      "[ww1936.land.designer_xp] cost=0,have=62",
    );
    // The empty cell: the battalion list; tanks need their tech.
    await m.click(slot("battalion", 11));
    expect(m.q("[data-ww-pick='medium_armor']")!.dataset.locked).toBe("true");
    expect(m.q("[data-ww-pick='medium_armor']")!.textContent).toContain(
      "[ww1936.land.locked_by] tech=[ww1936.tech.medium_tank_1]",
    );
    await m.click("[data-ww-pick='medium_armor']");
    expect(
      m.el.querySelectorAll("[data-ww-slot-kind='battalion']"),
    ).toHaveLength(12);
    await m.click("[data-ww-pick='artillery']");
    expect(m.q(slot("battalion", 11))!.dataset.changed).toBe("true");
    expect(m.q(slot("battalion", 0))!.dataset.changed).toBe("false");
    expect(m.q("[data-ww-stat='width'] [data-changed]")!.dataset.changed).toBe(
      "true",
    );
    expect(
      m.q("[data-ww-stat='width'] td:last-child")!.textContent!.trim(),
    ).toBe("27");
    expect(m.q("[data-ww-designer-xp]")!.textContent).toContain("cost=5");
    expect(m.q("[data-ww-need='artillery']")!.textContent).toContain(
      "[ww1936.land.factory_days]",
    );
    // Saving spends army experience: two taps.
    await m.click("[data-ww-designer-save]");
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-designer-save]")!.dataset.armed).toBe("true");
    vi.setSystemTime(101_000);
    await m.click("[data-ww-designer-save]");
    const t = startTemplate("DEU");
    expect(m.sent).toEqual([
      {
        kind: "template_save",
        template: 1,
        base: 0,
        name: "[ww1936.tpl.infantry]",
        battalions: [...t.battalions, "artillery"],
        support: t.support,
      },
    ]);
    expect(m.closed()).toBe(1);
  });

  it("a full cell can be removed; the support slots take each company once", async () => {
    const m = await mount(1);
    await m.click(slot("battalion", 0));
    await m.click("[data-ww-slot-remove]");
    expect(
      m.el.querySelectorAll("[data-ww-slot-kind='battalion']"),
    ).toHaveLength(11);
    // Engineers and recon already in: the third slot offers neither.
    await m.click(slot("support", 2));
    expect(m.q("[data-ww-pick='engineer']")).toBeNull();
    expect(m.q("[data-ww-pick='support_artillery']")).not.toBeNull();
  });

  it("copy saves a new template in one tap when nothing changed; delete takes two", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount(1);
    await m.click("[data-ww-designer-copy]");
    await m.click("[data-ww-designer-save]");
    const t = startTemplate("DEU");
    expect(m.sent).toEqual([
      {
        kind: "template_save",
        template: 0,
        base: 1,
        name: "[ww1936.tpl.infantry] 2",
        battalions: t.battalions,
        support: t.support,
      },
    ]);
    const d = await mount(1);
    await d.click("[data-ww-designer-delete]");
    expect(d.sent).toEqual([]);
    vi.setSystemTime(101_000);
    await d.click("[data-ww-designer-delete]");
    expect(d.sent).toEqual([{ kind: "template_delete", template: 1 }]);
    // In use: it says so and sends nothing.
    const used = await mount(1, {
      landDetails: [
        landDetail("DEU", {
          templates: [startTemplate("DEU", 1, { inUse: 3 })],
        }),
      ],
    });
    await used.click("[data-ww-designer-delete]");
    expect(used.q("[data-ww-block='template_in_use']")).not.toBeNull();
    expect(used.sent).toEqual([]);
  });

  it("a new template needs a name and its experience; no title attributes", async () => {
    const m = await mount(0, {
      landDetails: [landDetail("DEU", { armyXpMilli: 4_000 })],
    });
    await m.click(slot("battalion", 0));
    await m.click("[data-ww-pick='infantry']");
    await m.click("[data-ww-designer-save]");
    expect(m.q("[data-ww-block='bad_template']")).not.toBeNull();
    await m.click("[data-ww-designer-name]");
    const input = m.q("[data-ww-designer-name-input]") as HTMLInputElement;
    input.value = "Garrison";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("blur"));
    await m.el.updateComplete;
    // 5 experience for the battalion, 4 in hand.
    await m.click("[data-ww-designer-save]");
    expect(m.q("[data-ww-block='no_xp']")).not.toBeNull();
    expect(m.sent).toEqual([]);
    expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
    for (const b of m.el.querySelectorAll("button")) {
      expect(b.className).toMatch(/\b(h-9|size-9|min-h-9)\b/);
    }
  });
});
