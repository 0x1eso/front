import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwEdition,
  GwPressView,
} from "@openfront/engine-api/ww1914/GwPress";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import {
  blocsTab,
  deskPapers,
  headlineText,
  tickerHead,
} from "../../../src/client/hud/ww1914/GwBlocs";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import { tabBadge } from "../../../src/client/hud/ww1914/GwModel";

const edition: GwEdition = {
  chapter: 4,
  story: "leak",
  scene: "s1",
  who: "deu_jagow",
  heads: [
    { paper: "vor", tone: 0, blank: true, soft: false },
    { paper: "tag", tone: 0, blank: false, soft: true },
  ],
  rumour: "gold_cars",
};

const press = (over: Partial<GwPressView> = {}): GwPressView => ({
  blocs: [
    {
      id: "workers",
      support: -2,
      word: 1,
      delta: -1,
      turning: "leaving",
      why: [{ key: "bread_short", up: false }],
      people: ["deu_jagow"],
      papers: ["vor"],
    },
    {
      id: "army",
      support: 3,
      word: 4,
      delta: 0,
      turning: null,
      why: [],
      people: [],
      papers: [],
    },
  ],
  ties: [
    { a: "army", b: "court", key: "sword_throne", on: true },
    { a: "workers", b: "court", key: "truce", on: false },
  ],
  papers: [
    {
      id: "vor",
      blocs: ["workers"],
      foe: "court",
      invitable: true,
      friend: false,
    },
    {
      id: "tag",
      blocs: ["parliament"],
      foe: "army",
      invitable: false,
      friend: true,
    },
  ],
  edition,
  censor: 1,
  censorCap: 2,
  censorPrice: 8,
  censorBar: null,
  rumour: 3,
  acted: false,
  ...over,
});

const pack = {
  scenes: { s1: { title: "그 결정", text: {} } },
  people: { deu_jagow: { name: "야고", lean: "" } },
  press: {
    blocs: { workers: { name: "노동자", who: "공장" } },
    papers: {
      vor: { name: "《전진》", lean: "" },
      tag: { name: "《베를린 일보》", lean: "" },
    },
    why: { bread_short: "빵이 모자란다" },
    ties: { sword_throne: "한 몸이다", truce_off: "끝났다" },
    heads: {
      leak: { tag: { head: "{who}을(를) 겨눈 기사", deck: "{who}의 일" } },
    },
    gaps: { vor: "흰 자리" },
    rumours: { gold_cars: "금 자동차" },
  },
} as unknown as GwPack;

function ctx(p: GwPressView | null, audiences = 2) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1915-03-01", chapter: 5 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      audiences,
      desk: [],
      people: [{ id: "deu_jagow", office: "foreign" }],
      world: { press: p, authority: 40 },
    } as unknown as GwSeatView,
    pack,
    ui: { tab: "blocs", pressPick: null } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(blocsTab(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("the blocs screen", () => {
  test("a bloc shows its word, its reason, and that it is about to turn", () => {
    const { root } = ctx(press());
    const row = root.querySelector("[data-gw-bloc=workers]")!;
    expect(row.textContent).toContain("노동자");
    expect(row.textContent).toContain("빵이 모자란다");
    expect(row.textContent).toContain("야고");
    expect(q(root, "[data-gw-turning=leaving]")).not.toBeNull();
  });

  test("a tie that broke reads its other line", () => {
    const { root } = ctx(press());
    expect(root.querySelector("[data-gw-tie=truce]")!.textContent).toContain(
      "끝났다",
    );
    expect(
      root.querySelector("[data-gw-tie=sword_throne]")!.textContent,
    ).toContain("한 몸이다");
  });

  test("the tab's badge counts those about to turn", () => {
    const { c } = ctx(press());
    expect(tabBadge(c.seat, "blocs")).toBe(1);
  });

  test("the country tab's badge counts what can end the game", () => {
    const seat = {
      gov: [
        { fatal: true, step: 1 },
        { fatal: false, step: 2 },
        { fatal: true, step: 0 },
      ],
      ruler: { levels: [0, 0, 0, 1] },
    } as unknown as GwCtx["seat"];
    expect(tabBadge(seat, "country")).toBe(2);
  });

  test("a country with no row says so", () => {
    const { root } = ctx(null);
    expect(q(root, "[data-gw-blocs-none]")).not.toBeNull();
  });
});

describe("the papers", () => {
  test("a gap replaces the headline; a name fills with its particle", () => {
    const a = headlineText(pack, edition, edition.heads[0]);
    expect(a).toEqual({ head: "흰 자리", deck: null });
    const b = headlineText(pack, edition, edition.heads[1]);
    expect(b.head).toBe("야고를 겨눈 기사");
    expect(b.deck).toBe("야고의 일");
  });

  test("the desk shows the page with what it is about and the rumour", () => {
    const { c } = ctx(press());
    const root = document.createElement("div");
    render(deskPapers(c), root);
    expect(root.textContent).toContain("gw.ui.press.about");
    expect(root.textContent).toContain("금 자동차");
    expect(q(root, "[data-gw-blank]")).not.toBeNull();
  });

  test("the ticker takes the first head that got through", () => {
    expect(tickerHead({ pack, press: press() })).toContain("《베를린 일보》");
  });
});

describe("press policy", () => {
  test("the censor's two buttons send their order", () => {
    const { root, sent } = ctx(press());
    q(root, "[data-gw-censor-up]")!.click();
    q(root, "[data-gw-censor-down]")!.click();
    expect(sent).toEqual([
      { kind: "press_censor", up: true },
      { kind: "press_censor", up: false },
    ]);
  });

  test("an act taken shuts the others until the next chapter", () => {
    const { root } = ctx(press({ acted: true }));
    expect(q(root, "[data-gw-censor-up]")!.disabled).toBe(true);
    expect(q(root, "[data-gw-press-pick=invite]")!.disabled).toBe(true);
    expect(q(root, "[data-gw-press-acted]")).not.toBeNull();
  });

  test("the censor can't go past its cap or its bar", () => {
    expect(
      q(ctx(press({ censor: 2 })).root, "[data-gw-censor-up]")!.disabled,
    ).toBe(true);
    expect(
      q(ctx(press({ censorBar: "commons" })).root, "[data-gw-censor-up]")!
        .disabled,
    ).toBe(true);
  });

  test("an invitation lists only those who would come, and needs an audience", () => {
    const { root, sent } = ctx(press());
    q(root, "[data-gw-press-pick=invite]")!.click();
    expect(q(root, "[data-gw-invite=tag]")).toBeNull();
    q(root, "[data-gw-invite=vor]")!.click();
    expect(sent).toEqual([{ kind: "press_invite", paper: "vor" }]);
    expect(
      q(ctx(press(), 0).root, "[data-gw-press-pick=invite]")!.disabled,
    ).toBe(true);
  });

  test("a leak picks a minister at home", () => {
    const { root, sent } = ctx(press());
    q(root, "[data-gw-press-pick=leak]")!.click();
    q(root, "[data-gw-leak=deu_jagow]")!.click();
    expect(sent).toEqual([{ kind: "press_leak", person: "deu_jagow" }]);
  });
});
