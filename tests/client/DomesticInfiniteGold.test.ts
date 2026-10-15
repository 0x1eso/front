import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { GameMode, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

// Side-effect import: the custom element must register.
import "../../src/client/hud/domestic/DomesticPanel";
import type { DomesticPanel } from "../../src/client/hud/domestic/DomesticPanel";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

// No points, no gold, but a qualified science project and a level-3 host:
// only gold stands between this player and research, laws and the project.
const DATA = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 0,
  politicalPerSec: 0,
  techs: ["space_program"],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
} as unknown as DomesticData;

async function openDrawer(infiniteGold: boolean): Promise<DomesticPanel> {
  const panel = document.createElement("domestic-panel") as DomesticPanel;
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
    team: () => null,
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
    config: () => ({
      conquestPercent: () => 80,
      maxTimerMinutes: () => 30,
      gameConfig: () => ({ gameMode: GameMode.FFA }),
      hasInfiniteGold: (p: unknown) => infiniteGold && p === me,
    }),
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

async function showTab(panel: DomesticPanel, tab: string) {
  panel
    .querySelector<HTMLButtonElement>(`[role="tab"][data-tab="${tab}"]`)!
    .click();
  await panel.updateComplete;
}

describe("domestic panel with infinite gold (the engine charges no gold)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    "infinite gold %s: a gold research payment blocked = %s",
    async (infinite, blocked) => {
      const panel = await openDrawer(infinite);
      const card = panel.querySelector('[data-era="1"] [data-tech]')!;
      expect(card.querySelector("button")!.disabled).toBe(blocked);
      expect(card.querySelector("[data-reason]") !== null).toBe(blocked);
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])(
    "infinite gold %s: a gold proclamation blocked = %s",
    async (infinite, blocked) => {
      const panel = await openDrawer(infinite);
      await showTab(panel, "laws");
      const option = panel.querySelector(
        '[data-law="trade"] [data-option="A"]',
      )!;
      expect(option.querySelector("button")!.disabled).toBe(blocked);
      expect(option.querySelector("[data-reason]") !== null).toBe(blocked);
    },
  );

  it.each([
    [false, "[domestic.victory.blocked.gold]"],
    [true, null],
  ])(
    "infinite gold %s: the science project's block is %s",
    async (infinite, reason) => {
      const panel = await openDrawer(infinite);
      await showTab(panel, "victory");
      const science = [...panel.querySelectorAll("button")].find((b) =>
        b.textContent!.includes("[domestic.victory.start]"),
      )!;
      const block = science.parentElement!.querySelector(
        "[data-victory-block]",
      );
      expect(block?.textContent ?? null).toBe(reason);
      expect(science.disabled).toBe(reason !== null);
    },
  );

  it.each([
    [false, "5.00M"],
    [true, "0"],
  ])(
    "infinite gold %s: the science project's card says it costs %s gold (C8)",
    async (infinite, gold) => {
      const panel = await openDrawer(infinite);
      await showTab(panel, "victory");
      expect(panel.textContent).toContain(
        `[domestic.victory.cost_science:${JSON.stringify({ gold })}]`,
      );
    },
  );
});
