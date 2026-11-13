import type { GwLawView } from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import { lawStrip } from "../../../src/client/hud/ww1914/GwLaws";

const bill = (over: Partial<GwLawView> = {}): GwLawView => ({
  id: "deu_censor",
  stage: "open",
  how: "none",
  text: null,
  outlook: null,
  body: "reichstag",
  second: null,
  decree: true,
  waits: null,
  talk: null,
  repeal: null,
  ...over,
});

const PACK = {
  version: 1,
  people: { deu_ebert: { name: "에베르트", lean: "" } },
  scenes: {
    gw_law_deu_censor: { title: "검열령", topic: "검열을 묶는다.", text: {} },
  },
} as unknown as GwPack;

function ctx(rows: GwLawView[]) {
  return {
    c: {
      data: { date: "1915-08-09", chapter: 6 } as unknown as GreatWarData,
      seat: { tag: "DEU", world: { laws: rows } } as unknown as GwSeatView,
      pack: PACK,
      ui: { notes: [] } as unknown as GwUi,
      tick: 0,
      send: (_o: GwOrder) => undefined,
      redraw: () => undefined,
      card: () => undefined,
    } as GwCtx,
  };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("the day's card", () => {
  test("the day's card carries the count in words", () => {
    const { c } = ctx([bill({ stage: "vote", outlook: "tight" })]);
    const box = document.createElement("div");
    render(lawStrip(c, "gw_lv_deu_censor"), box);
    expect(q(box, '[data-gw-law-outlook="tight"]')).not.toBeNull();
  });
});
