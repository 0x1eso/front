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
import { lawsSection, lawStrip } from "../../../src/client/hud/ww1914/GwLaws";

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

function ctx(rows: GwLawView[], audiences = 1) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1915-08-09", chapter: 6 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      audiences,
      world: { laws: rows },
    } as unknown as GwSeatView,
    pack: PACK,
    ui: { armedRepeal: null, summoned: 0, notes: [] } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(lawsSection(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("the country tab's lines", () => {
  test("no bill, no box", () => {
    expect(q(ctx([]).root, "[data-gw-laws]")).toBeNull();
  });

  test("an open bill reads by its name and is taken up with one tap", () => {
    const { root, sent } = ctx([bill()]);
    expect(root.textContent).toContain("검열령");
    expect(root.textContent).toContain("검열을 묶는다.");
    q(root, "[data-gw-law-draft]")!.click();
    expect(sent).toEqual([{ kind: "law", law: "deu_censor", act: "draft" }]);
  });

  test("while another bill moves it says so and stays shut", () => {
    const { root } = ctx([bill({ waits: "busy" })]);
    expect(q(root, "[data-gw-law-draft]")!.disabled).toBe(true);
  });

  test("a moving bill shows a word for the count and who can be called", () => {
    const { root, sent } = ctx([
      bill({
        stage: "persuade",
        outlook: "short",
        talk: { person: "deu_ebert", topic: "gw_lt_deu_censor" },
      }),
    ]);
    expect(q(root, '[data-gw-law-outlook="short"]')).not.toBeNull();
    q(root, "[data-gw-law-talk]")!.click();
    expect(sent).toEqual([
      { kind: "summon", person: "deu_ebert", topic: "gw_lt_deu_censor" },
    ]);
  });

  test("no audience left, no call", () => {
    const row = bill({
      stage: "vote",
      talk: { person: "deu_ebert", topic: "gw_lt_deu_censor" },
    });
    expect(q(ctx([row], 0).root, "[data-gw-law-talk]")!.disabled).toBe(true);
  });

  test("repeal takes a second tap; its price shows only after it", () => {
    const { c, root, sent } = ctx([
      bill({
        stage: "force",
        how: "voted",
        repeal: { tell: ["authority:-15"], open: true },
      }),
    ]);
    q(root, "[data-gw-law-repeal]")!.click();
    expect(sent).toEqual([]);
    expect(root.textContent).not.toContain("15");
    q(root, "[data-gw-law-repeal]")!.click();
    expect(sent).toEqual([{ kind: "law", law: "deu_censor", act: "repeal" }]);
    expect(c.ui.notes[0].tell).toEqual(["authority:-15"]);
  });

  test("what moves comes before what stands", () => {
    const { root } = ctx([
      bill({ id: "a", stage: "force", how: "voted" }),
      bill({ id: "b", stage: "vote", outlook: "easy" }),
    ]);
    const ids = [...root.querySelectorAll("[data-gw-law]")].map((x) =>
      x.getAttribute("data-gw-law"),
    );
    expect(ids).toEqual(["b", "a"]);
  });

  test("the day's card carries the count in words", () => {
    const { c } = ctx([bill({ stage: "vote", outlook: "tight" })]);
    const box = document.createElement("div");
    render(lawStrip(c, "gw_lv_deu_censor"), box);
    expect(q(box, '[data-gw-law-outlook="tight"]')).not.toBeNull();
  });
});
