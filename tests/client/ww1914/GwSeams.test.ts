import {
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import type { GreatWarData } from "@openfront/engine-api/ww1914/GwView";
import { EventBus } from "@openfront/shared/EventBus";
import { GW_PACK_SHARES } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { shelfTotals } from "../../../src/client/hud/ww1914/GwModel";
import { GwPanel } from "../../../src/client/hud/ww1914/GwPanel";
import { reportText, unknownText } from "../../../src/client/hud/ww1914/GwText";
import { tickerLines } from "../../../src/client/hud/ww1914/GwTicker";
import { SendGwOrderIntentEvent } from "../../../src/client/Transport";
import { gwRunner, order, playChapter, seat, view } from "../../ww1914/util";

// The real Korean, so a hole left unfilled or a key with no text shows up here.
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

const read = (f: string) =>
  GwPackSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../../resources/ww1914/ko", f),
        "utf8",
      ),
    ),
  );
const PACK = mergeGwPacks(
  ["DEU.json", ...GW_PACK_SHARES.DEU!.map((x) => `DEU.${x}.json`)].map(read),
);

/** The screens on a view the real engine made, not a hand-written one. */
async function mount(d: GreatWarData) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => PACK })),
  );
  const panel = new GwPanel();
  const bus = new EventBus();
  const orders: unknown[] = [];
  bus.on(SendGwOrderIntentEvent, (e) => orders.push(e.order));
  panel.eventBus = bus;
  panel.game = {
    greatWarData: () => d,
    myPlayer: () => ({ smallID: () => d.seats[0].smallID }),
  } as unknown as GwPanel["game"];
  document.body.appendChild(panel);
  panel.tick();
  await vi.waitFor(() => {
    expect((panel as unknown as { pack: unknown }).pack).not.toBeNull();
  });
  await panel.updateComplete;
  return { panel, orders };
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function finished(): Promise<GreatWarData> {
  const { runner } = await gwRunner({}, "GWSEAMS");
  const gw = runner.game.greatWar()!;
  // A secret the seat never found, so the last page has something to say.
  gw.s.secrets = ["bel_forts_strong"];
  while (view(runner).ended === null) playChapter(runner);
  return view(runner);
}

describe("the memoir on the world's data", () => {
  test("the aim is judged on the closing page, with what was given up", async () => {
    const d = await finished();
    const s = d.seats[0];
    const memoir = {
      ...s.world.memoir!,
      aim: { id: "deu_aim_x", met: false, dropped: ["deu_aim_y"] },
    };
    const world = { ...s.world, memoir };
    const { panel } = await mount({ ...d, seats: [{ ...s, world }] });
    const box = panel.querySelector("[data-gw-memoir-aim]")!;
    expect(box.textContent).toContain("deu_aim_x");
    expect(box.textContent).toContain("deu_aim_y");
    // ww193 merge: a whole game is played first; five seconds was too tight.
  }, 30000);

  test("the end opens the memoir: ending, mandates, what you never knew", async () => {
    const d = await finished();
    const memoir = d.seats[0].world.memoir!;
    expect(memoir.unknown.length).toBeGreaterThan(0);
    const { panel } = await mount(d);
    const ending = panel.querySelector("[data-gw-ending]")!;
    expect(ending.getAttribute("data-gw-ending")).toBe(memoir.ending);
    expect(ending.textContent).toContain(
      PACK.endings![memoir.ending].slice(0, 6),
    );
    expect(panel.querySelector("[data-gw-unknown]")!.textContent).toContain(
      "이 판에서 당신이 몰랐던 것",
    );
    const lines = panel.querySelectorAll("[data-gw-unknown] p");
    expect(lines.length).toBe(memoir.unknown.length);
    for (const u of memoir.unknown) {
      expect(unknownText(PACK, u)).not.toMatch(/gw\.|\{/);
    }
    expect(panel.querySelector("[data-gw-memoir-mandates]")).not.toBeNull();
    expect(panel.querySelector("[data-gw-memoir-people]")).not.toBeNull();
  });

  test("the shelf takes the game once, from the memoir", async () => {
    const d = await finished();
    const { panel } = await mount(d);
    const shelf = JSON.parse(localStorage.getItem("gw1914.shelf")!);
    const memoir = d.seats[0].world.memoir!;
    expect(shelf.endings).toEqual([`DEU:${memoir.ending}`]);
    expect(shelf.people).toEqual(expect.arrayContaining(memoir.shelf.people));
    expect(shelf.runs.length).toBe(1);
    panel.tick();
    expect(JSON.parse(localStorage.getItem("gw1914.shelf")!).runs.length).toBe(
      1,
    );
    // ww193: the count follows the endings the pack has, not a fixed number.
    expect(panel.querySelector("[data-gw-shelf]")!.textContent).toContain(
      `결말 1/${shelfTotals(0, "DEU").endings}`,
    );
  });
});

describe("the people tab on real data", () => {
  test("a summons, a dismissal, and the vacancy it leaves", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const price = seat(runner).world.people.find(
      (p) => p.id === "deu_jagow",
    )!.dismissPrice;
    gw.nation("DEU")!.authority = price;
    let { panel, orders } = await mount(view(runner));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    expect(panel.querySelector("[data-gw-vacant]")).toBeNull();
    // ww193: a head is his department's row (사람 › 부서).
    const row = panel.querySelector("[data-gw-dept=foreign]")!;
    row.querySelector("button")!.click();
    await panel.updateComplete;
    const button = () =>
      panel.querySelector<HTMLButtonElement>("[data-gw-dismiss=deu_jagow]")!;
    expect(button().textContent).toContain(String(price));
    button().click();
    await panel.updateComplete;
    button().click();
    expect(orders).toEqual([{ kind: "dismiss", person: "deu_jagow" }]);

    order(runner, { kind: "dismiss", person: "deu_jagow" });
    expect(seat(runner).world.authority).toBe(0);
    document.body.innerHTML = "";
    ({ panel, orders } = await mount(view(runner)));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    const seatNow = seat(runner);
    expect(seatNow.people.find((p) => p.id === "deu_jagow")!.office).toBeNull();
    expect(seatNow.world.candidates.foreign?.length).toBeGreaterThan(0);
    const vacant = panel.querySelector("[data-gw-vacant-office=foreign]")!;
    const name = vacant.querySelector<HTMLButtonElement>(
      "[data-gw-appoint-name]",
    )!;
    const next = name.getAttribute("data-gw-appoint-name")!;
    name.click();
    expect(orders).toEqual([
      { kind: "appoint", person: next, office: "foreign" },
    ]);
    order(runner, { kind: "appoint", person: next, office: "foreign" });
    expect(seat(runner).people.find((p) => p.id === next)!.office).toBe(
      "foreign",
    );
  });

  test("each row's topic count is what opening that person shows", async () => {
    const { runner } = await gwRunner({}, "GWSEAMS");
    const counts: number[] = [];
    for (let chapter = 0; chapter < 3; chapter++) {
      if (chapter > 0) playChapter(runner);
      const d = view(runner);
      const { panel } = await mount(d);
      panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
      await panel.updateComplete;
      // ww193: a department's head is his department's row (사람 › 부서).
      const heads = new Map(
        (d.seats[0].depts ?? []).flatMap((x) =>
          x.head === null ? [] : [[x.head, x.office] as const],
        ),
      );
      for (const p of d.seats[0].people) {
        const office = heads.get(p.id);
        const row = () =>
          panel.querySelector(
            office === undefined
              ? `[data-gw-person=${p.id}]`
              : `[data-gw-dept=${office}]`,
          )!;
        const badge = row().querySelector("[data-gw-topic-count]");
        // Only a number: never which talks, nor how they would go.
        const shown = badge === null ? 0 : Number(badge.textContent!.trim());
        expect(badge?.textContent?.trim() ?? "0").toMatch(/^\d+$/);
        if (office === undefined) {
          expect(row().hasAttribute("data-gw-no-topics")).toBe(shown === 0);
          expect(row().className.includes("opacity-60")).toBe(shown === 0);
        }
        row().querySelector("button")!.click();
        await panel.updateComplete;
        expect(row().querySelectorAll("[data-gw-topic]").length).toBe(shown);
        expect(row().className).not.toContain("opacity-60");
        counts.push(shown);
      }
      document.body.innerHTML = "";
    }
    expect(counts.some((n) => n > 0)).toBe(true);
    expect(counts.some((n) => n === 0)).toBe(true);
  });

  test("the ticker reads the world's wires", async () => {
    const { runner } = await gwRunner({}, "GWSEAMS");
    playChapter(runner);
    const d = view(runner);
    expect(d.seats[0].world.news.length).toBeGreaterThan(0);
    const lines = tickerLines(d, d.seats[0], PACK);
    expect(lines.join("\n")).not.toMatch(/gw\.|\{a\}/);
    expect(lines.length).toBeGreaterThan(1);
  });

  test("the whip's count report names the bill, in words", () => {
    const r = {
      uid: 1,
      fact: "count",
      tag: "DEU",
      theatre: null,
      source: "whip",
      stamp: "unconfirmed",
      claim: 1,
      chapter: 3,
      checked: false,
      corrected: null,
      about: "deu_censor",
    };
    const line = reportText(r as never, PACK);
    expect(line).toContain(PACK.scenes.gw_law_deu_censor.title!);
    expect(line).not.toMatch(/gw\.|deu_|\d/);
  });
});
