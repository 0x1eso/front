import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { render } from "lit";
import {
  renderResearchScreen,
  renderTechSheet,
  ResearchScreenContext,
} from "../../src/client/hud/domestic/ResearchScreen";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const D: DomesticData = {
  science: 120,
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

function draw(discounted: ResearchScreenContext["discounted"]) {
  const root = document.createElement("div");
  const ctx: ResearchScreenContext = {
    view: new DomesticClientView(D),
    gold: 0n,
    infiniteGold: false,
    selected: "currency",
    armed: null,
    select: () => {},
    arm: () => {},
    isUnitDisabled: (type) => type === UnitType.Satellite,
    research: vi.fn(),
    queue: vi.fn(),
    discounted,
  };
  render([renderResearchScreen(ctx), renderTechSheet(ctx)], root);
  return root;
}

const node = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-tech="${id}"]`)!;

describe("tech pact discount on the research screen", () => {
  test("a discounted tech shows 30% off and can start with that much science", () => {
    const root = draw(["currency"]);
    expect(
      node(root, "currency").querySelector("[data-node-cost]")!.textContent,
    ).toContain('domestic.cost:{"cost":105,');
    expect(
      node(root, "currency").querySelector("[data-node-discount]")!.textContent,
    ).toContain("congress.discounted");
    expect(
      root.querySelector('[data-sheet-action="start"]')!.textContent,
    ).toContain('domestic.tree.start:{"cost":105}');
    expect(
      node(root, "navigation").querySelector("[data-node-discount]"),
    ).toBeNull();
  });

  test("without the pact nothing changes", () => {
    const root = draw(undefined);
    expect(
      node(root, "currency").querySelector("[data-node-cost]")!.textContent,
    ).toContain('domestic.cost:{"cost":150,');
    expect(root.querySelector('[data-sheet-action="start"]')).toBeNull();
    expect(root.querySelector('[data-sheet-action="gold"]')).not.toBeNull();
  });
});
