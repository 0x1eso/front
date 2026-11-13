import type { GwHouseView } from "@openfront/engine-api/ww1914/GwHouse";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, render, TemplateResult } from "lit";
import { describe, expect, test } from "vitest";
import { headlineText } from "../../../src/client/hud/ww1914/GwBlocs";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  blocFactions,
  houseChip,
  houseSection,
} from "../../../src/client/hud/ww1914/GwHouse";
import { promiseText } from "../../../src/client/hud/ww1914/GwText";

const house = (over: Partial<GwHouseView> = {}): GwHouseView => ({
  bill: null,
  calls: 0,
  record: { right: 0, wrong: 0 },
  whipPerson: "deu_helfferich",
  factions: [],
  out: null,
  around: "bundesrat",
  closed: [],
  gone: false,
  ballot: null,
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

  test("a house gone or sent home says so, and names what doesn't sit (ww171)", () => {
    const sits = ctx(house(), (c) => html`${houseSection(c)}`).root;
    expect(sits.querySelector("[data-gw-house-gone]")).toBeNull();
    expect(sits.querySelector("[data-gw-house-closed]")).toBeNull();
    const { root } = ctx(
      house({ around: "art87", closed: ["duma", "council"], gone: true }),
      (c) => html`${houseSection(c)}`,
    );
    // The tests run without a language: the line is its key.
    expect(
      root.querySelector("[data-gw-house-gone]")?.textContent?.trim(),
    ).toBe("gw.house.gone.art87");
    expect(root.querySelector("[data-gw-house-closed]")).not.toBeNull();
  });

  test("a faction with no leader at hand shows only its word, no stray separator", () => {
    const { root } = ctx(
      house({
        bill: {
          law: "deu_aux",
          stage: "persuade",
          origin: "seat",
          sponsor: null,
          chambers: ["reichstag"],
          whip: null,
          factions: [
            { id: "deu_spd", leader: null, said: -1, deal: false, call: null },
          ],
          delayTo: null,
        },
      }),
      (c) => html`${houseSection(c)}`,
    );
    const line = root.querySelector("[data-gw-house-faction=deu_spd] p");
    expect(line?.textContent?.trim()).not.toMatch(/^·/);
    expect(line?.textContent?.trim().length).toBeGreaterThan(0);
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

  test("a house story's headline falls back to the pack's heads, the faction named", () => {
    const pack = {
      ...PACK,
      factions: { ...PACK.factions, deu_uspd: { name: "독립사민당" } },
      heads: {
        house_split: {
          head: "{faction}, 따로 서다",
          deck: "{who}이(가) 이끈다.",
        },
        house_joined_deu_bloc: { head: "{faction}만의 머리기사" },
      },
    } as unknown as GwPack;
    const e = {
      chapter: 20,
      story: "house_split",
      scene: null,
      who: "deu_ebert",
      faction: "deu_uspd",
      heads: [],
      rumour: null,
    };
    const h = { paper: "vorwaerts", tone: 1, blank: false, soft: false };
    expect(headlineText(pack, e, h)).toEqual({
      head: "독립사민당, 따로 서다",
      deck: "에베르트가 이끈다.",
    });
    const joined = { ...e, story: "house_joined", faction: "deu_bloc" };
    expect(headlineText(pack, joined, h).head).toBe("deu_bloc만의 머리기사");
  });

  test("a deal's promise reads as a sentence naming the leader and the bill", () => {
    const pack = {
      ...PACK,
      promises: {
        house_deal:
          "「{bill}」에 {who}의 무리가 찬성하는 대신, 그가 청한 것을 들어주기로 했다.",
        house_deal_plain: "{who}의 무리가 찬성하는 대신.",
      },
    } as unknown as GwPack;
    const p = {
      key: "house_deu_spd_deu_aux",
      who: "deu_ebert",
      due: "1917-01-01",
      kept: false,
      broken: false,
    };
    expect(promiseText(pack, p as never)).toBe(
      "「조국 봉사법」에 에베르트의 무리가 찬성하는 대신, 그가 청한 것을 들어주기로 했다.",
    );
    expect(
      promiseText(pack, { ...p, key: "house_deu_spd_deu_nothing" } as never),
    ).toBe("에베르트의 무리가 찬성하는 대신.");
  });
});
