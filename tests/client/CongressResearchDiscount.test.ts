import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import {
  DomesticData,
  TECH_IDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { techPactCostMilli } from "@openfront/engine-lib/congress/ResolutionEffects";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { render } from "lit";
import { researchDial } from "../../src/client/hud/domestic/DomesticStatus";
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
    // The pact cuts the research time too: 20 s × 0.7.
    expect(
      node(root, "currency").querySelector("[data-node-cost]")!.textContent,
    ).toContain('domestic.cost:{"cost":105,"seconds":14}');
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
    ).toContain('domestic.cost:{"cost":150,"seconds":20}');
    expect(root.querySelector('[data-sheet-action="start"]')).toBeNull();
    expect(root.querySelector('[data-sheet-action="gold"]')).not.toBeNull();
  });
});

describe("tech pact discount on the 🔬 dial", () => {
  // 120 science: short of every era-1 tech (150), enough for a pact one (105).
  test("a discounted open tech within reach lights the dial", () => {
    expect(researchDial(D).kind).toBe("short");
    expect(researchDial(D).progress).toBeCloseTo(120 / 150);
    expect(researchDial(D, ["currency"]).kind).toBe("available");
    // A discounted tech that isn't open yet doesn't count.
    expect(researchDial(D, ["railroad"]).kind).toBe("short");
  });

  test("the dial, the screen and the engine read one cost", () => {
    for (const tech of TECH_IDS) {
      const base = TECHS[tech].cost * MILLI;
      expect(techPactCostMilli(base, false)).toBe(base);
      expect(techPactCostMilli(base, true)).toBe(Math.round((base * 70) / 100));
    }
    expect(
      researchDial({ ...D, science: 30 }, ["currency"]).progress,
    ).toBeCloseTo(30 / 105);
  });
});
