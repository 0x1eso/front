import type { GwBudgetView } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { budgetRow } from "@openfront/engine-lib/ww1914/BudgetRules";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import {
  budgetPanel,
  budgetSummary,
  moneyText,
  planOf,
  pricesText,
  sharesLeft,
  stepsText,
} from "../../../src/client/hud/ww1914/GwBudget";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import { boldParts } from "../../../src/client/hud/ww1914/GwText";

const view = (over: Partial<GwBudgetView> = {}): GwBudgetView => ({
  basis: {
    tag: "DEU",
    war: true,
    warYears: 0,
    treasury: 3000,
    debt: 5000,
    prices: 1000,
    rate: 100,
    morale: 3,
    news: 0,
    loanCap: 3,
    rally: false,
  },
  plan: { shares: [...budgetRow("DEU").peace], mix: [100, 0, 0, 0] },
  draft: { shares: [...budgetRow("DEU").war], mix: [100, 60, 2, 15] },
  norm: budgetRow("DEU").war,
  meeting: true,
  refused: false,
  last: "none",
  next: "1915-01-01",
  notes: [{ item: "treasury", key: "outlay", delta: -900 }],
  lenders: [{ id: "neutrals", open: true, cap: 3, owed: 0 }],
  body: {
    kind: "vote",
    inst: "reichstag",
    need: -4,
    second: null,
    secondNeed: 0,
    value: 0,
    secondValue: 0,
    forcePrice: 30,
  },
  authority: 40,
  holder: "deu_kuhn",
  ...over,
});

function ctx(
  v: GwBudgetView,
  inst: GwSeatView["inst"] = { reichstag: 0 },
): { c: GwCtx; sent: GwOrder[]; root: HTMLElement } {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const ui = { budgetOpen: true, budgetPlan: null } as unknown as GwUi;
  const c = {
    data: { date: "1914-08-09", chapter: 6 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      inst,
      world: { budget: v, war: { regime: "empire" } },
    } as unknown as GwSeatView,
    pack: null,
    ui,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(budgetPanel(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("the words", () => {
  test("sums read as Korean sums", () => {
    expect(moneyText("GBR", 1559)).toContain("15억 6천만");
    expect(moneyText("GBR", 66)).toContain("6,600만");
    expect(moneyText("DEU", -2000)).toContain("-20억");
    expect(moneyText("DEU", 1998)).toContain("20억");
    expect(moneyText("DEU", 0)).not.toContain("만");
  });

  test("an option's bold line is bold, and its marks don't show", () => {
    expect(boldParts("**서명한다.** 공채로 간다.")).toEqual([
      { text: "서명한다.", bold: true },
      { text: " 공채로 간다.", bold: false },
    ]);
    expect(boldParts("그냥 글")).toEqual([{ text: "그냥 글", bold: false }]);
  });

  test("points read as steps, prices as June 1914 = 100", () => {
    expect(stepsText(120)).toBe("+1.2");
    expect(stepsText(-50)).toBe("-0.5");
    expect(pricesText(1480)).toBe(148);
  });
});

describe("the ledger", () => {
  test("shows now against proposed and the year before anyone signs", () => {
    const { root } = ctx(view());
    const army = q(root, '[data-gw-budget-row="army"]')!;
    expect(army.textContent).toContain("40");
    expect(army.textContent).toContain("72");
    expect(q(root, "[data-gw-budget-forecast]")).not.toBeNull();
    expect(q(root, '[data-gw-drift="shells"]')).not.toBeNull();
    expect(q(root, '[data-gw-budget-note="outlay"]')).not.toBeNull();
    expect(q(root, "[data-gw-budget-interest]")).not.toBeNull();
    expect(q(root, '[data-gw-budget-pass="yes"]')).not.toBeNull();
  });

  test("a step moves the proposal; off 100 it can't be signed", () => {
    const { c, root, sent } = ctx(view());
    q(root, '[data-gw-step="army:5"]')!.click();
    expect(sharesLeft(planOf(c))).toBe(-5);
    expect(q(root, "[data-gw-budget-left]")).not.toBeNull();
    expect(q(root, "[data-gw-budget-sign]")!.disabled).toBe(true);
    q(root, '[data-gw-step="relief:-5"]')!.click();
    expect(sharesLeft(planOf(c))).toBe(0);
    q(root, "[data-gw-budget-sign]")!.click();
    expect(sent[0]).toMatchObject({ kind: "budget", force: false });
    expect(c.ui.budgetOpen).toBe(false);
  });

  test("what would be refused offers force, priced in authority", () => {
    const { root, sent } = ctx(view(), { reichstag: -5 });
    expect(q(root, '[data-gw-budget-pass="no"]')).not.toBeNull();
    const force = q(root, "[data-gw-budget-force]")!;
    expect(force.disabled).toBe(false);
    force.click();
    expect(sent[0]).toMatchObject({ kind: "budget", force: true });
  });

  test("with no meeting it reads and can't be changed", () => {
    const { root } = ctx(view({ meeting: false, draft: null }));
    expect(q(root, "[data-gw-budget-sign]")).toBeNull();
    expect(q(root, "[data-gw-step]")).toBeNull();
    expect(q(root, "[data-gw-budget-next]")).not.toBeNull();
  });

  test("the country tab opens it", () => {
    const { c } = ctx(view());
    c.ui.budgetOpen = false;
    const root = document.createElement("div");
    render(budgetSummary(c), root);
    q(root, "[data-gw-budget-open]")!.click();
    expect(c.ui.budgetOpen).toBe(true);
  });
});
