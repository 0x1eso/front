// World War 1936: the template overwrite picker (divisions_convert), on
// the army panel's templates tab and on the army card's "more" panel.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
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
  OpenWwArmyEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyCard";
import type { WwArmyCard } from "../../../src/client/hud/ww1936/WwArmyCard";
import "../../../src/client/hud/ww1936/WwArmyPanel";
import type { WwArmyPanel } from "../../../src/client/hud/ww1936/WwArmyPanel";
import { convertOptions } from "../../../src/client/hud/ww1936/WwConvertPicker";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, summary } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  landDetail,
  startTemplate,
} from "./LandFixture";

const INF = startTemplate("DEU", 1, {
  inUse: 3,
  key: "",
  name: "Inf",
  battalions: Array(9).fill("infantry"),
  support: [],
});
// Six mountain battalions each: the special cap is 24 here.
const MTN = startTemplate("DEU", 2, {
  key: "",
  name: "Gebirge",
  battalions: Array(10).fill("mountain"),
  support: [],
});
const PARA = startTemplate("DEU", 3, {
  key: "",
  name: "Fall",
  battalions: ["paratrooper"],
  support: [],
});

function game(over: object = {}) {
  return fakeLandGame({
    ticks: 700,
    details: [detail("DEU")],
    summaries: [summary("DEU")],
    armies: [army(1, "DEU", 3), army(2, "DEU", 4)],
    landDetails: [
      landDetail("DEU", {
        templates: [INF, MTN],
        divisions: [
          division(1, 1, 3),
          division(2, 1, 3),
          division(3, 2, 4, { template: 2 }),
        ],
      }),
    ],
    ...over,
  });
}

function mountOn<T extends HTMLElement & { init(): void; tick(): void }>(
  tag: string,
  g: ReturnType<typeof game>,
) {
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  new WwLandController(g.game as never, bus, {
    scale: 1,
    screenToWorldCoordinatesFloat: (x, y) => ({ x, y }),
  }).init();
  const el = document.createElement(tag) as T;
  Object.assign(el, { game: g.game, eventBus: bus });
  document.body.appendChild(el);
  el.init();
  return { el, bus, sent };
}

describe("convert options", () => {
  const researched = new Set<WwTechId>(["mountaineers"]);
  it("counts what changes, blocks missing parts and the special cap", () => {
    const o = convertOptions(
      [INF, MTN, PARA],
      [],
      researched,
      new Map([[1, 3]]),
      1,
    );
    expect(o.map((x) => [x.template.id, x.changes])).toEqual([
      [2, 3],
      [3, 3],
    ]);
    // Paratroopers need a tech the country lacks.
    expect(o[1].block).toBe("no_tech");
    // 3 divisions x 10 special battalions break the cap of 24.
    expect(o[0].block).toBe("special_cap");
    // Two of them stay under it.
    const two = convertOptions(
      [INF, MTN],
      [],
      researched,
      new Map([[1, 2]]),
      1,
    );
    expect(two[0].block).toBeNull();
  });
});

describe("overwrite picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("templates tab: two taps send the order; the old template can then be deleted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const g = game({
      landDetails: [
        landDetail("DEU", {
          templates: [
            INF,
            startTemplate("DEU", 2, {
              key: "",
              name: "B",
              battalions: ["infantry"],
              support: [],
            }),
          ],
          divisions: [division(1, 1, 3)],
        }),
      ],
    });
    const m = mountOn<WwArmyPanel>("ww-army-panel", g);
    m.bus.emit(new OpenWwArmyEvent("templates"));
    m.el.tick();
    await m.el.updateComplete;
    const q = (s: string) => m.el.querySelector<HTMLElement>(s);
    const click = async (s: string) => {
      q(s)!.click();
      await m.el.updateComplete;
    };
    // Only a template in use offers it.
    expect(q("[data-ww-convert-open='2']")).toBeNull();
    await click("[data-ww-convert-open='1']");
    expect(q("[data-ww-convert='template:1']")!.textContent).toContain(
      "[ww1936.convert.intro_template] name=Inf,n=3",
    );
    expect(q("[data-ww-convert-to='1']")).toBeNull();
    await click("[data-ww-convert-to='2']");
    expect(m.sent).toEqual([]);
    expect(q("[data-ww-convert-to='2']")!.textContent).toContain(
      "[ww1936.convert.tap_again] n=3",
    );
    for (const b of m.el.querySelectorAll("[data-ww-convert] button")) {
      expect(b.className).toMatch(/\b(h-9|h-10|min-h-10|min-h-11)\b/);
    }
    vi.setSystemTime(101_000);
    await click("[data-ww-convert-to='2']");
    expect(m.sent).toEqual([{ kind: "divisions_convert", to: 2, from: 1 }]);
    expect(q("[data-ww-converted]")).not.toBeNull();
  });

  it("card: [convert] opens the templates tab on the army; mixed templates, two taps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const g = game({
      landDetails: [
        landDetail("DEU", {
          templates: [INF, MTN],
          divisions: [
            division(1, 1, 3),
            division(2, 1, 3, { template: 2 }),
            division(3, 1, 3),
          ],
        }),
      ],
    });
    const card = mountOn<WwArmyCard>("ww-army-card", g);
    const opened: [string, number | undefined][] = [];
    card.bus.on(OpenWwArmyEvent, (e) => opened.push([e.tab, e.convertArmy]));
    card.bus.emit(new WwSelectArmyEvent(1));
    card.el.tick();
    await card.el.updateComplete;
    const cq = (s: string) => card.el.querySelector<HTMLElement>(s);
    cq("[data-ww-army-btn='more']")!.click();
    await card.el.updateComplete;
    cq("[data-ww-army-btn='convert']")!.click();
    expect(opened).toEqual([["templates", 1]]);
    // The panel, told the same, shows the army's picker.
    const m = mountOn<WwArmyPanel>("ww-army-panel", g);
    m.bus.emit(new OpenWwArmyEvent("templates", 1));
    m.el.tick();
    await m.el.updateComplete;
    const q = (s: string) => m.el.querySelector<HTMLElement>(s);
    const click = async (s: string) => {
      q(s)!.click();
      await m.el.updateComplete;
    };
    expect(q("[data-ww-convert='army:1']")!.textContent).toContain("n=3");
    // The first template: two of the three are on it already.
    await click("[data-ww-convert-to='1']");
    expect(m.sent).toEqual([]);
    expect(q("[data-ww-convert-to='1']")!.textContent).toContain(
      "[ww1936.convert.tap_again] n=1",
    );
    vi.setSystemTime(101_000);
    await click("[data-ww-convert-to='1']");
    expect(m.sent).toEqual([{ kind: "divisions_convert", to: 1, army: 1 }]);
  });
});
