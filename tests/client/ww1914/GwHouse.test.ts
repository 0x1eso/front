import type { GwHouseView } from "@openfront/engine-api/ww1914/GwHouse";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, render, TemplateResult } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  blocFactions,
  houseChip,
  houseSection,
} from "../../../src/client/hud/ww1914/GwHouse";

const house = (over: Partial<GwHouseView> = {}): GwHouseView => ({
  bill: null,
  calls: 0,
  record: { right: 0, wrong: 0 },
  whipPerson: "deu_helfferich",
  factions: [],
  out: null,
  around: "bundesrat",
  ...over,
});

const PACK = {
  version: 1,
  people: {
    deu_helfferich: { name: "헬페리히", lean: "" },
    deu_ebert: { name: "에베르트", lean: "" },
    deu_i_westarp: { name: "베스타르프", lean: "" },
  },
  scenes: { gw_law_deu_aux: { title: "조국 봉사법", text: { base: "." } } },
  factions: {
    deu_spd: { name: "사민당", why: { spd_bread: "빵이 바닥났다." } },
    deu_cons: { name: "보수당" },
  },
} as unknown as GwPack;

function ctx(v: GwHouseView | undefined, draw: (c: GwCtx) => TemplateResult) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1916-11-09", chapter: 20 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      audiences: 0,
      world: { house: v },
    } as unknown as GwSeatView,
    pack: PACK,
    ui: { notes: [] } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(draw(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

describe("the house on the country tab", () => {
  test("a country with no house shows nothing", () => {
    const { root } = ctx(undefined, (c) => html`${houseSection(c)}`);
    expect(root.textContent?.trim()).toBe("");
  });

  test("the moving bill: the whip's word, the factions, the calls in words", () => {
    const { root, sent } = ctx(
      house({
        calls: 2,
        record: { right: 3, wrong: 1 },
        bill: {
          law: "deu_aux",
          stage: "persuade",
          origin: "seat",
          sponsor: "deu_helfferich",
          chambers: ["reichstag"],
          whip: { person: "deu_helfferich", word: "wide", chapter: 20 },
          factions: [
            {
              id: "deu_spd",
              leader: "deu_ebert",
              said: 1,
              deal: true,
              call: "gw_lb_deu_spd",
            },
            {
              id: "deu_cons",
              leader: "deu_i_westarp",
              said: null,
              deal: false,
              call: null,
            },
          ],
          delayTo: null,
        },
      }),
      (c) => html`${houseSection(c)}`,
    );
    const text = root.textContent ?? "";
    expect(text).toContain("조국 봉사법");
    expect(text).toContain("에베르트");
    expect(root.querySelector("[data-gw-house-whip=wide]")).not.toBeNull();
    expect(text).toContain("사민당");
    expect(root.querySelector("[data-gw-house-deal]")).not.toBeNull();
    expect(text).not.toMatch(/[+-]\d/);
    // No summons left, but the house's extra calls are.
    const b = root.querySelector(
      "[data-gw-house-call=deu_spd]",
    ) as HTMLButtonElement;
    expect(b.disabled).toBe(false);
    b.click();
    expect(sent).toEqual([
      { kind: "summon", person: "deu_ebert", topic: "gw_lb_deu_spd" },
    ]);
    expect(root.querySelector("[data-gw-house-call=deu_cons]")).toBeNull();
    expect(root.querySelector("[data-gw-house-record]")).not.toBeNull();
  });

  test("the 정국 tab lists a bloc's factions in words; the band shows one chip while one is out", () => {
    const v = house({
      factions: [
        {
          id: "deu_spd",
          bloc: "workers",
          status: "in",
          strength: 3,
          temper: 2,
          trend: -1,
          why: "spd_bread",
          leader: "deu_ebert",
          chambers: ["reichstag"],
        },
      ],
      out: { id: "deu_spd", bloc: "workers" },
    });
    const { root } = ctx(v, (c) => html`${blocFactions(c, "workers")}`);
    expect(root.textContent).toContain("사민당");
    expect(root.textContent).toContain("빵이 바닥났다.");
    expect(root.textContent).toContain("gw.house.strength.3");
    expect(
      ctx(v, (c) => html`${blocFactions(c, "army")}`).root.textContent?.trim(),
    ).toBe("");
    const chip = ctx(v, (c) => html`${houseChip(c)}`).root;
    expect(chip.querySelector("[data-gw-house-out=deu_spd]")).not.toBeNull();
  });
});
