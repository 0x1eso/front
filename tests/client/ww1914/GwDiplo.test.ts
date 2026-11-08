import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import {
  gwCleanTelegram,
  GwOrderSchema,
} from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWarData } from "@openfront/engine-api/ww1914/GwView";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { gwView } from "@openfront/engine/ww1914/View";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, test, vi } from "vitest";
import { clauseText } from "../../../src/client/hud/ww1914/GwDiplo";
import { tabsOf } from "../../../src/client/hud/ww1914/GwModel";
import { GwPanel } from "../../../src/client/hud/ww1914/GwPanel";
import { SendGwOrderIntentEvent } from "../../../src/client/Transport";
import { stamped, step, wwRunnerCapture } from "../../ww1936/util";

vi.mock("../../../src/client/Utils", async (importOriginal) => {
  const { readFileSync } = await import("node:fs");
  const file = `${process.cwd()}/resources/lang/ko.json`;
  const ko = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const lookup = (key: string) =>
    key
      .split(".")
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ko);
  return {
    ...(await importOriginal<object>()),
    translateText: (key: string, params: Record<string, unknown> = {}) => {
      const text = lookup(key);
      if (typeof text !== "string") return key;
      return text.replace(/\{(\w+)\}/g, (hole, k) =>
        params[k] === undefined ? hole : String(params[k]),
      );
    },
  };
});

const A = "AAAAAAA1";
const B = "BBBBBBB2";

async function friends(): Promise<GameRunner> {
  const { runner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Private },
    [
      { clientID: A, gwCountry: "DEU" },
      { clientID: B, gwCountry: "RUS" },
    ],
  );
  step(runner, 2);
  return runner;
}

const send = (r: GameRunner, who: string, o: GwOrder) => {
  step(r, 1, [stamped(who, { type: "gw_order", order: o })]);
  step(r, 1);
};

/** What `who`'s page gets: its own seat and the table. */
const viewOf = (r: GameRunner, who: string): GreatWarData =>
  gwView(r.game.greatWar()!, r.game.playerByClientID(who)!.smallID());

async function mount(d: GreatWarData) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: 1, scenes: {}, people: {} }),
    })),
  );
  const panel = new GwPanel();
  const bus = new EventBus();
  const orders: GwOrder[] = [];
  bus.on(SendGwOrderIntentEvent, (e) => orders.push(e.order));
  panel.eventBus = bus;
  panel.game = {
    greatWarData: () => d,
    myPlayer: () => ({ smallID: () => d.seats[0].smallID }),
    playerBySmallID: () => ({
      isPlayer: () => true,
      clientID: () => A,
    }),
    usernameOf: () => "친구",
  } as unknown as GwPanel["game"];
  document.body.appendChild(panel);
  panel.tick();
  await vi.waitFor(() => {
    expect((panel as unknown as { pack: unknown }).pack).not.toBeNull();
  });
  await panel.updateComplete;
  return { panel, orders };
}

const openTab = async (panel: GwPanel) => {
  panel.querySelector<HTMLElement>("[data-gw-tab=diplo]")!.click();
  await panel.updateComplete;
};

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the diplomacy tab", () => {
  test("is there between friends and not alone", async () => {
    const r = await friends();
    const d = viewOf(r, A);
    expect(tabsOf(d)).toContain("diplo");
    expect(tabsOf({ ...d, roster: d.roster.slice(0, 1) })).not.toContain(
      "diplo",
    );
  });

  test("shows the table and sends a telegram it has cleaned", async () => {
    const r = await friends();
    const { panel, orders } = await mount(viewOf(r, A));
    await openTab(panel);
    expect(panel.querySelectorAll("[data-gw-seat-row]").length).toBe(2);
    const box = panel.querySelector<HTMLTextAreaElement>(
      "[data-gw-wire-text]",
    )!;
    box.value = "  니키,​ 벨기에는 안 건드리네  ";
    box.dispatchEvent(new Event("input"));
    await panel.updateComplete;
    panel.querySelector<HTMLElement>("[data-gw-wire-send]")!.click();
    expect(orders).toEqual([
      {
        kind: "telegram",
        to: "RUS",
        cipher: 1,
        text: "니키, 벨기에는 안 건드리네",
      },
    ]);
    expect(GwOrderSchema.safeParse(orders[0]).success).toBe(true);
  });

  test("puts a treaty together and sends it", async () => {
    const r = await friends();
    const { panel, orders } = await mount(viewOf(r, A));
    await openTab(panel);
    panel.querySelector<HTMLElement>("[data-gw-clause-add]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLElement>("[data-gw-treaty-send]")!.click();
    expect(orders[0]).toMatchObject({
      kind: "treaty_offer",
      to: "RUS",
      clauses: [{ kind: "neutrality", by: "RUS" }],
    });
    expect(GwOrderSchema.safeParse(orders[0]).success).toBe(true);
  });

  test("asks the second party to sign, and arms a break", async () => {
    const r = await friends();
    send(r, A, {
      kind: "treaty_offer",
      to: "RUS",
      clauses: [{ kind: "neutrality", by: "RUS", theatre: null, value: 0 }],
    });
    const first = await mount(viewOf(r, B));
    await openTab(first.panel);
    first.panel.querySelector<HTMLElement>("[data-gw-treaty-sign]")!.click();
    expect(first.orders).toEqual([
      { kind: "treaty_answer", treaty: 1, sign: true },
    ]);
    first.panel.remove();
    send(r, B, first.orders[0]);
    const second = await mount(viewOf(r, B));
    await openTab(second.panel);
    const button = () =>
      second.panel.querySelector<HTMLElement>("[data-gw-treaty-break]")!;
    button().click();
    expect(second.orders).toEqual([]);
    await second.panel.updateComplete;
    button().click();
    expect(second.orders).toEqual([{ kind: "treaty_break", treaty: 1 }]);
  });

  test("says every clause in Korean", () => {
    for (const c of [
      { kind: "alliance", by: "DEU", theatre: null, value: 0 },
      { kind: "neutrality", by: "RUS", theatre: null, value: 0 },
      { kind: "loan", by: "DEU", theatre: null, value: 1 },
      { kind: "passage", by: "RUS", theatre: "west", value: 0 },
      { kind: "entry", by: "RUS", theatre: null, value: 7 },
    ] as const) {
      const text = clauseText(c, "DEU", "RUS");
      expect(text).toMatch(/[가-힣]/);
      expect(text).not.toMatch(/gw\.|\{/);
    }
  });
});

describe("the end between friends", () => {
  test("opens the memoirs side by side, the treaty and who read what", async () => {
    const r = await friends();
    const gw = r.game.greatWar()!;
    send(r, A, {
      kind: "treaty_offer",
      to: "RUS",
      clauses: [{ kind: "neutrality", by: "RUS", theatre: null, value: 0 }],
    });
    send(r, B, { kind: "treaty_answer", treaty: 1, sign: true });
    send(r, B, { kind: "treaty_break", treaty: 1 });
    gw.s.telegrams.push({
      uid: 9,
      from: "DEU",
      to: "RUS",
      cipher: 0,
      text: "속았구려",
      chapter: 0,
      delivered: true,
      copies: ["GBR"],
    });
    gw.s.ended = "closing";
    step(r, 2);
    const { panel } = await mount(viewOf(r, A));
    const finale = panel.querySelector("[data-gw-finale]")!;
    expect(finale.querySelectorAll("[data-gw-finale-seat]").length).toBe(2);
    expect(finale.textContent).toContain("러시아");
    expect(
      finale.querySelector("[data-gw-finale-treaties]")!.textContent,
    ).toContain("찢었다");
    expect(
      finale.querySelector("[data-gw-finale-wires]")!.textContent,
    ).toContain("속았구려");
    expect(finale.textContent).not.toMatch(/gw\.[a-z]/);
  });
});

describe("text between friends", () => {
  test("a composer can't send what would get its sender kicked", () => {
    const text = gwCleanTelegram("a\u0000b\r\nc‮");
    expect(text).toBe("ab\nc");
    expect(
      GwOrderSchema.safeParse({ kind: "telegram", to: "RUS", cipher: 0, text })
        .success,
    ).toBe(true);
  });
});
