import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { render } from "lit";
import { renderGovernmentTab } from "../../src/client/hud/domestic/GovernmentTab";
import { renderLawsTab } from "../../src/client/hud/domestic/LawsTab";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const BASE: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 0,
  politicalPerSec: 0,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

function mount(template: unknown): HTMLElement {
  const root = document.createElement("div");
  render(template, root);
  return root;
}

function optionCard(root: HTMLElement, law: string, option: string) {
  return root.querySelector(
    `[data-law="${law}"] [data-option="${option}"]`,
  ) as HTMLElement;
}

function optionButton(root: HTMLElement, law: string, option: string) {
  return optionCard(root, law, option).querySelector(
    "button",
  ) as HTMLButtonElement;
}

function govCard(root: HTMLElement, government: string) {
  return root.querySelector(`[data-government="${government}"]`) as HTMLElement;
}

describe("laws tab", () => {
  test("shows the next cost and the proclaimed and closed options", () => {
    const view = new DomesticClientView({
      ...BASE,
      political: 200,
      laws: { trade: "A" },
    });
    const root = mount(
      renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim: vi.fn() }),
    );
    expect(root.textContent).toContain('domestic.law_next_cost:{"cost":150}');
    expect(optionCard(root, "trade", "A").textContent).toContain(
      "domestic.proclaimed",
    );
    expect(optionCard(root, "trade", "B").textContent).toContain(
      "domestic.rejected",
    );
    expect(optionCard(root, "trade", "A").querySelector("button")).toBeNull();
  });

  test("clicking an open option proclaims it", () => {
    const proclaim = vi.fn();
    const view = new DomesticClientView({ ...BASE, political: 200 });
    const root = mount(renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim }));
    optionButton(root, "taxation", "B").click();
    expect(proclaim).toHaveBeenCalledWith("taxation", "B", false);
  });

  test("without enough political power the button pays the rest in gold", () => {
    const view = new DomesticClientView({ ...BASE, political: 40 });
    const poor = mount(
      renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim: vi.fn() }),
    );
    expect(optionButton(poor, "trade", "A").textContent).toContain(
      "domestic.proclaim_with_gold",
    );
    expect(optionButton(poor, "trade", "A").disabled).toBe(true);

    const proclaim = vi.fn();
    const rich = mount(
      renderLawsTab({ view, gold: 60_000n, nowTick: 0, proclaim }),
    );
    expect(optionButton(rich, "trade", "A").disabled).toBe(false);
    optionButton(rich, "trade", "A").click();
    expect(proclaim).toHaveBeenCalledWith("trade", "A", true);
  });

  test("the cooldown and a missing tech disable the buttons", () => {
    const cooling = mount(
      renderLawsTab({
        view: new DomesticClientView({
          ...BASE,
          political: 1000,
          lawCooldownUntilTick: 500,
        }),
        gold: 0n,
        nowTick: 100,
        proclaim: vi.fn(),
      }),
    );
    expect(cooling.textContent).toContain(
      'domestic.law_cooldown:{"seconds":40}',
    );
    expect(optionButton(cooling, "trade", "A").disabled).toBe(true);

    const ready = mount(
      renderLawsTab({
        view: new DomesticClientView({ ...BASE, political: 1000 }),
        gold: 0n,
        nowTick: 0,
        proclaim: vi.fn(),
      }),
    );
    expect(optionButton(ready, "trade", "A").disabled).toBe(false);
    expect(optionButton(ready, "nuclear", "A").disabled).toBe(true);
    expect(ready.querySelector('[data-law="nuclear"]')!.textContent).toContain(
      "domestic.locked_requires",
    );
  });
});

describe("government tab", () => {
  test("tier 1: open governments, theocracy's requirement, tier 2 locked", () => {
    const choose = vi.fn();
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 1,
      cumulativePolitical: 400,
    });
    const root = mount(renderGovernmentTab({ view, choose }));
    expect(root.textContent).toContain(
      'domestic.gov_progress:{"value":400,"next":1500,"tier":2}',
    );
    expect(govCard(root, "monarchy").querySelector("button")).not.toBeNull();
    (govCard(root, "republic").querySelector("button") as HTMLElement).click();
    expect(choose).toHaveBeenCalledWith("republic");
    expect(govCard(root, "theocracy").querySelector("button")).toBeNull();
    expect(govCard(root, "theocracy").textContent).toContain(
      "domestic.gov_requires_law",
    );
    expect(govCard(root, "democracy").textContent).toContain(
      'domestic.gov_needs_tier:{"tier":2}',
    );
  });

  test("tier 2 under a monarchy: current, passed and open governments", () => {
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 2,
      government: "monarchy",
    });
    const root = mount(renderGovernmentTab({ view, choose: vi.fn() }));
    expect(govCard(root, "monarchy").textContent).toContain(
      "domestic.gov_active",
    );
    expect(govCard(root, "republic").textContent).toContain(
      "domestic.gov_passed",
    );
    expect(govCard(root, "fascism").querySelector("button")).not.toBeNull();
  });

  test("a chosen tier-2 government locks the others; tier 3 ends the bar", () => {
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 3,
      government: "democracy",
    });
    const root = mount(renderGovernmentTab({ view, choose: vi.fn() }));
    expect(govCard(root, "fascism").textContent).toContain(
      "domestic.gov_locked",
    );
    expect(root.textContent).toContain("domestic.gov_max_tier");
  });
});
