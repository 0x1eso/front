import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  EQUIP_KEY_COUNT,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
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

import { render } from "lit";
import "../../../src/client/hud/ww1936/WwAidTab";
import {
  AidActions,
  OpenWwAidEvent,
  type WwAidTab,
} from "../../../src/client/hud/ww1936/WwAidTab";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, ID, summary } from "./EconomyFixture";
import { type EndOptions, fakeEndGame } from "./EndgameFixture";

/** Germany with 500 infantry equipment I and 120 II, fuel 3,000. */
function stock(): number[] {
  const s = new Array<number>(EQUIP_KEY_COUNT).fill(0);
  s[equipKey("infantry_equipment", 1)] = 500;
  s[equipKey("infantry_equipment", 2)] = 120;
  return s;
}

async function mount(endgame: EndOptions["endgame"] = {}) {
  // Italy fights France; the Soviet Union is at peace (and tension is 0).
  const { game } = fakeEndGame({
    me: "DEU",
    wars: [["ITA", "FRA"]],
    summaries: [summary("DEU")],
    details: [detail("DEU", { stock: stock(), fuelMilli: 3_000_000 })],
    endgame,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-aid-tab") as WwAidTab;
  el.game = game;
  el.eventBus = bus;
  document.body.appendChild(el);
  await el.updateComplete;
  const q = <T extends HTMLElement = HTMLButtonElement>(sel: string) =>
    el.querySelector<T>(sel);
  const click = async (sel: string) => {
    const b = q(sel);
    if (b === null) throw new Error(`no ${sel}`);
    b.click();
    await el.updateComplete;
  };
  const step = () => q<HTMLElement>("[data-ww-aid-walk]")?.dataset.wwAidWalk;
  return { el, sent, q, click, step };
}

describe("<ww-aid-tab> (P5 spec §20.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("new contract walks country, item, generation, amount", async () => {
    const { sent, q, click, step } = await mount();
    expect(q("[data-ww-aid-contracts]")).toBeNull();
    await click("[data-ww-aid-new]");
    expect(step()).toBe("country");
    // Italy (at war) can get lend-lease; the Soviet Union (at peace, tension 0) not.
    expect(q(`[data-ww-aid-country="${ID("ITA")}"]`)!.disabled).toBe(false);
    const sun = q(`[data-ww-aid-country="${ID("SUN")}"]`)!;
    expect(sun.disabled).toBe(true);
    expect(
      sun.querySelector<HTMLElement>("[data-ww-aid-why]")?.dataset.wwAidWhy,
    ).toBe("ww1936.aid.why.ll_peace");
    // Me neither.
    expect(q(`[data-ww-aid-country="${ID("DEU")}"]`)).toBeNull();

    await click(`[data-ww-aid-country="${ID("ITA")}"]`);
    expect(step()).toBe("item");
    // What I hold: infantry equipment (620) and fuel (3,000).
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-ww-aid-item]")].map(
        (b) => b.dataset.wwAidItem,
      ),
    ).toEqual(["infantry_equipment", "fuel"]);
    await click('[data-ww-aid-item="infantry_equipment"]');
    expect(step()).toBe("gen");
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-ww-aid-gen]")].map(
        (b) => b.dataset.wwAidGen,
      ),
    ).toEqual(["1", "2"]);
    await click('[data-ww-aid-gen="2"]');
    expect(step()).toBe("amount");
    // A tenth of the stock to start; −/+ step by 1, 10, 100…
    expect(q("[data-ww-aid-amount]")!.textContent?.trim()).toBe("12");
    await click("[data-ww-aid-plus]");
    expect(q("[data-ww-aid-amount]")!.textContent?.trim()).toBe("22");
    await click("[data-ww-aid-plus]");
    expect(q("[data-ww-aid-amount]")!.textContent?.trim()).toBe("32");
    await click("[data-ww-aid-minus]");
    expect(q("[data-ww-aid-amount]")!.textContent?.trim()).toBe("22");
    expect(q("[data-ww-aid-path]")!.textContent).toContain("→");
    await click("[data-ww-aid-submit]");
    expect(sent).toEqual([
      {
        kind: "lend_lease",
        to: ID("ITA"),
        item: "infantry_equipment",
        gen: 2,
        perMonth: 22,
      },
    ]);
    // The walk closes once sent.
    expect(step()).toBeUndefined();
  });

  it("final review C (M5): the volunteer room shows only while the gate is open", () => {
    // Italy (at war with France, 7 divisions) and the Soviet Union (at peace).
    const { game, land } = fakeEndGame({
      me: "DEU",
      wars: [["ITA", "FRA"]],
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [
          { smallID: ID("DEU"), divisions: 40 } as never,
          { smallID: ID("ITA"), divisions: 7 } as never,
          { smallID: ID("SUN"), divisions: 7 } as never,
        ],
        details: [],
      },
      600,
    );
    const label = (tag: "ITA" | "SUN") => {
      const box = document.createElement("div");
      render(
        new AidActions().render(game, new EventBus(), ID(tag), () => {}),
        box,
      );
      return box.querySelector("[data-ww-act='volunteers_send']")!.textContent!;
    };
    // Open: the room (here max(2, floor(7 / 3)) = 2).
    expect(label("ITA")).toContain("[ww1936.aid.volunteers_cap] n=2");
    // Closed (no war to volunteer for): no number from its army's size.
    expect(label("SUN")).not.toContain("volunteers_cap");
    expect(label("SUN")).toContain("[ww1936.aid.volunteers_send]");
  });

  it("the player panel's request starts the walk at the item", async () => {
    const { el, sent, click, step } = await mount();
    el.preset = { to: ID("ITA"), mode: "request", nonce: 1 };
    await el.updateComplete;
    expect(step()).toBe("item");
    await click('[data-ww-aid-item="fuel"]');
    // A request has no generation step.
    expect(step()).toBe("amount");
    await click("[data-ww-aid-submit]");
    expect(sent).toEqual([
      {
        kind: "lend_lease_request",
        from: ID("ITA"),
        item: "fuel",
        perMonth: 100,
      },
    ]);
    expect(new OpenWwAidEvent(ID("ITA")).mode).toBe("send");
  });

  it("lend-lease I receive: human senders' contracts, then shipments on the way", async () => {
    const line = (id: number, to: number) => ({
      id,
      to,
      item: "artillery" as const,
      gen: 1,
      perMonth: 30,
      sentMonth: 20,
      arrivedMonth: 12,
      blocked: null,
    });
    const aid = (tag: "DEU" | "ITA", o: object = {}) => ({
      smallID: ID(tag),
      contracts: [],
      incoming: [],
      volunteersOut: [],
      volunteersIn: [],
      ...o,
    });
    const { el } = await mount({
      aid: [
        aid("DEU", {
          incoming: [
            { from: ID("SUN"), item: "fuel", count: 400, arriveDay: 9 },
          ],
          volunteersIn: [{ army: 77, from: ID("ITA"), divisions: 3 }],
        }),
        aid("ITA", { contracts: [line(1, ID("DEU")), line(2, ID("FRA"))] }),
      ],
    });
    const rows = [
      ...el.querySelectorAll<HTMLElement>("[data-ww-aid-incoming] li"),
    ].map((li) => li.textContent?.replace(/\s+/g, " ").trim() ?? "");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("[ww1936.aid.received_line]");
    expect(rows[0]).toContain("n=12");
    expect(rows[1]).toContain("[ww1936.aid.incoming_line]");
    expect(rows[1]).toContain("n=400");
    expect(el.textContent).toContain("[ww1936.aid.volunteers_received]");
  });
});
