import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { DomesticPanel } from "../../src/client/hud/domestic/DomesticPanel";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

function data(techs: DomesticData["techs"]): DomesticData {
  return {
    science: 0,
    political: 0,
    cumulativeScience: 0,
    cumulativePolitical: 0,
    sciencePerSec: 0,
    politicalPerSec: 0,
    techs,
    research: null,
    recruitTargetPct: 100,
    laws: {},
    lawCooldownUntilTick: 0,
    governmentTier: 0,
    government: "chiefdom",
    conditions: [],
  };
}

async function openPanel(d: DomesticData): Promise<DomesticPanel> {
  if (!customElements.get("domestic-panel")) {
    customElements.define("domestic-panel", DomesticPanel);
  }
  const panel = document.createElement("domestic-panel") as DomesticPanel;
  const me = {
    domesticData: () => d,
    domestic: () => new DomesticClientView(d),
    gold: () => 0n,
  };
  panel.game = { myPlayer: () => me } as any;
  let toggle: () => void = () => {};
  panel.eventBus = { on: (_: unknown, cb: () => void) => (toggle = cb) } as any;
  document.body.appendChild(panel);
  panel.init();
  toggle();
  panel.tick();
  await panel.updateComplete;
  return panel;
}

describe("domestic-panel research time", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the base research time without modifiers", async () => {
    const panel = await openPanel(data([]));
    expect(panel.textContent).toContain("[domestic.cost] cost=300,seconds=30");
  });

  it("shows the time after researchTime modifiers", async () => {
    // Scientific method: research time -30%, so 30 s becomes 21 s.
    const panel = await openPanel(data(["scientific_method"]));
    expect(panel.textContent).toContain("[domestic.cost] cost=300,seconds=21");
    expect(panel.textContent).not.toContain("seconds=30");
  });
});
