import type { GwCraftView } from "@openfront/engine-api/ww1914/GwCraft";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import {
  craftSection,
  footingChip,
} from "../../../src/client/hud/ww1914/GwCraft";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";

const view = (over: Partial<GwCraftView> = {}): GwCraftView => ({
  footing: 0,
  raise: null,
  inventions: [],
  project: null,
  past: [],
  shortages: [],
  ...over,
});

const PACK = {
  version: 1,
  people: {
    deu_i_haber: { name: "프리츠 하버", lean: "화학자" },
    deu_delbrueck: { name: "델브뤼크", lean: "" },
  },
  scenes: {},
  craft: {
    deu_inv_gas: { name: "염소가스", note: "실린더로 내보내는 가스" },
    deu_pj_canal: { name: "미텔란트 운하" },
  },
} as unknown as GwPack;

function ctx(v: GwCraftView | undefined) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1915-08-09", chapter: 6 } as unknown as GreatWarData,
    seat: { tag: "DEU", world: { craft: v } } as unknown as GwSeatView,
    pack: PACK,
    ui: { armedField: null, notes: [] } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(craftSection(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("statecraft on the country tab", () => {
  test("a country with none of it shows nothing", () => {
    expect(ctx(undefined).root.textContent?.trim()).toBe("");
    expect(ctx(view()).root.querySelector("section")).toBeNull();
  });

  test("a ready invention reads by name and inventor and is fielded on the second tap", () => {
    const { root, sent } = ctx(
      view({
        inventions: [
          {
            id: "deu_inv_gas",
            inventor: "deu_i_haber",
            stage: "ready",
            early: false,
            ripe: false,
          },
        ],
      }),
    );
    expect(root.textContent).toContain("염소가스");
    q(root, "[data-gw-field]")!.click();
    expect(sent).toEqual([]);
    q(root, "[data-gw-field]")!.click();
    expect(sent).toEqual([{ kind: "field", invention: "deu_inv_gas" }]);
  });

  test("the footing asks for its next step, shut when not open; shortages listed", () => {
    const { root, sent } = ctx(
      view({
        footing: 1,
        raise: { open: true, asked: false },
        shortages: [
          { id: "nitrates", solved: false },
          { id: "rubber", solved: true },
        ],
      }),
    );
    expect(q(root, '[data-gw-footing="1"]')).not.toBeNull();
    expect(q(root, "[data-gw-shortages]")).not.toBeNull();
    expect(q(root, '[data-gw-shortage-solved="rubber"]')).not.toBeNull();
    q(root, '[data-gw-footing-raise="2"]')!.click();
    expect(sent).toEqual([{ kind: "footing" }]);
    const shut = ctx(view({ raise: { open: false, asked: false } }));
    expect(q(shut.root, "[data-gw-footing-raise]")!.disabled).toBe(true);
  });

  test("the year's project shows its name, chapter and the man in charge", () => {
    const { root } = ctx(
      view({
        project: {
          id: "deu_pj_canal",
          phase: "opp",
          lead: "deu_delbrueck",
          year: 1915,
        },
      }),
    );
    expect(q(root, '[data-gw-project="deu_pj_canal"]')).not.toBeNull();
    expect(root.textContent).toContain("미텔란트 운하");
  });

  test("the band names the footing once it has moved", () => {
    const root = document.createElement("div");
    const c = (footing: number) =>
      ({ seat: { world: { craft: view({ footing }) } } }) as unknown as GwCtx;
    render(footingChip(c(0)), root);
    expect(root.querySelector("[data-gw-footing-chip]")).toBeNull();
    render(footingChip(c(2)), root);
    expect(root.querySelector('[data-gw-footing-chip="2"]')).not.toBeNull();
  });
});
