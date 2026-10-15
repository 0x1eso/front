import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  DomesticPanel,
  TABS,
} from "../../src/client/hud/domestic/DomesticPanel";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

// Phase-2 fields; the cast keeps this valid as DomesticData grows (phase 3).
const DATA = {
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
} as unknown as DomesticData;

async function openDrawer(): Promise<DomesticPanel> {
  const panel = document.createElement("domestic-panel") as DomesticPanel;
  // A finished level-3 Research Institute / Admin Office: a project host.
  const host = {
    id: () => 7,
    level: () => 3,
    isUnderConstruction: () => false,
  };
  const me = {
    domesticData: () => DATA,
    domestic: () => new DomesticClientView(DATA),
    gold: () => 0n,
    units: () => [host],
    numTilesOwned: () => 10,
    smallID: () => 1,
    isAlive: () => true,
    type: () => PlayerType.Human,
    goldEarned: () => 0,
    displayName: () => "me",
  };
  panel.game = {
    myPlayer: () => me,
    ticks: () => 0,
    numLandTiles: () => 100,
    numTilesWithFallout: () => 0,
    config: () => ({ conquestPercent: () => 80, maxTimerMinutes: () => 30 }),
    elapsedGameSeconds: () => 0,
    playerViews: () => [me],
  } as unknown as DomesticPanel["game"];
  let toggle: () => void = () => {};
  panel.eventBus = {
    on: (_: unknown, cb: () => void) => (toggle = cb),
    emit: vi.fn(),
  } as unknown as DomesticPanel["eventBus"];
  document.body.appendChild(panel);
  panel.init();
  toggle();
  panel.tick();
  await panel.updateComplete;
  return panel;
}

describe("domestic drawer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens as a right-side drawer that leaves the map visible", async () => {
    const panel = await openDrawer();
    const drawer = panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    expect(drawer.tagName).toBe("ASIDE");
    expect(drawer.classList).toContain("right-0");
    expect(drawer.classList).toContain("w-[40vw]");
    // No full-screen backdrop: taps on the map still reach the map.
    expect(panel.querySelector(".inset-0")).toBeNull();
  });

  it("has one tab button per tab, whatever the tab list holds", async () => {
    const panel = await openDrawer();
    const tabs = [...panel.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((t) => t.dataset.tab)).toEqual([...TABS]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("switches tabs and keeps every control 44px with no tooltips", async () => {
    const panel = await openDrawer();
    for (const tab of TABS) {
      panel
        .querySelector<HTMLButtonElement>(`[role="tab"][data-tab="${tab}"]`)!
        .click();
      await panel.updateComplete;
      expect(
        panel
          .querySelector(`[role="tab"][data-tab="${tab}"]`)!
          .getAttribute("aria-selected"),
      ).toBe("true");
      for (const b of panel.querySelectorAll("button")) {
        expect(b.className).toMatch(/\b(size-11|h-11|min-h-11)\b/);
      }
      expect(panel.querySelectorAll("[title]")).toHaveLength(0);
    }
  });

  it("lists technologies by era with their branch on the card", async () => {
    const panel = await openDrawer();
    const firstEra = panel.querySelector('[data-era="1"]')!;
    expect(firstEra.textContent).toContain("[domestic.era]");
    expect(firstEra.querySelector("[data-tech]")!.textContent).toMatch(
      /\[domestic\.branch\.(economy|military|learning)\]/,
    );
  });

  it("says why a gold payment is blocked", async () => {
    const panel = await openDrawer();
    const card = panel.querySelector('[data-era="1"] [data-tech]')!;
    expect(card.querySelector("button")!.disabled).toBe(true);
    expect(card.querySelector("[data-reason]")!.textContent).toContain(
      "[build_menu.not_enough_money]",
    );
  });

  it("the laws tab says why a gold proclamation is blocked", async () => {
    const panel = await openDrawer();
    panel
      .querySelector<HTMLButtonElement>('[role="tab"][data-tab="laws"]')!
      .click();
    await panel.updateComplete;
    // No political power and no gold: the open law pays in gold it lacks.
    const option = panel.querySelector('[data-law="trade"] [data-option="A"]')!;
    expect(option.querySelector("button")!.disabled).toBe(true);
    expect(option.querySelector("[data-reason]")!.textContent).toContain(
      "[build_menu.not_enough_money]",
    );
    // A law locked behind a tech names the tech instead of the gold.
    const locked = panel.querySelector('[data-law="nuclear"]')!;
    expect(locked.textContent).toContain("[domestic.locked_requires]");
    expect(locked.querySelector("[data-reason]")).toBeNull();
  });

  it("the victory tab says on screen why a project cannot start", async () => {
    const panel = await openDrawer();
    panel
      .querySelector<HTMLButtonElement>('[role="tab"][data-tab="victory"]')!
      .click();
    await panel.updateComplete;
    const reason = panel.querySelector<HTMLElement>("[data-victory-block]")!;
    // Neither project is qualified yet (no Space Program, government tier 0).
    expect(reason.textContent).toContain(
      "[domestic.victory.blocked.requirement]",
    );
    const button = reason.parentElement!.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.type).toBe("button");
  });

  it("closes with the ✕ button", async () => {
    const panel = await openDrawer();
    panel.querySelector<HTMLButtonElement>("[data-domestic-close]")!.click();
    await panel.updateComplete;
    expect(panel.querySelector("[data-domestic-drawer]")).toBeNull();
  });
});
