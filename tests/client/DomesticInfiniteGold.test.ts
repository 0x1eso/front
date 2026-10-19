import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { GameMode, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import {
  DomesticScreen,
  OpenDomesticScreenEvent,
} from "../../src/client/hud/domestic/DomesticEvents";
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
    congressData: () => null,
    numLandTiles: () => 100,
    numTilesWithFallout: () => 0,
    config: () => ({
      conquestPercent: () => 80,
      maxTimerMinutes: () => 30,
      gameConfig: () => ({ gameMode: GameMode.FFA }),
      hasInfiniteGold: (p: unknown) => infiniteGold && p === me,
      isUnitDisabled: () => false,
    }),
    elapsedGameSeconds: () => 0,
    playerViews: () => [me],
  } as unknown as DomesticPanel["game"];
  panel.eventBus = new EventBus();
  document.body.appendChild(panel);
  panel.init();
  panel.tick();
  await panel.updateComplete;
  return panel;
}

async function show(panel: DomesticPanel, screen: DomesticScreen) {
  panel.eventBus.emit(new OpenDomesticScreenEvent(screen));
  await panel.updateComplete;
}

async function tap(panel: DomesticPanel, selector: string) {
  panel.querySelector<HTMLButtonElement>(selector)!.click();
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
      await show(panel, "research");
      await tap(panel, '[data-tech="currency"]');
      const sheet = panel.querySelector("[data-tech-sheet]")!;
      expect(
        sheet.querySelector<HTMLButtonElement>('[data-sheet-action="gold"]')!
          .disabled,
      ).toBe(blocked);
      expect(sheet.querySelector("[data-reason]") !== null).toBe(blocked);
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])(
    "infinite gold %s: a gold proclamation blocked = %s",
    async (infinite, blocked) => {
      const panel = await openDrawer(infinite);
      await show(panel, "laws");
      await tap(panel, '[data-law="trade"] [data-option="A"] [data-law-pick]');
      const option = panel.querySelector(
        '[data-law="trade"] [data-option="A"]',
      )!;
      expect(
        option.querySelector<HTMLButtonElement>("[data-law-confirm]")!.disabled,
      ).toBe(blocked);
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
      await show(panel, "victory");
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
      await show(panel, "victory");
      expect(panel.textContent).toContain(
        `[domestic.victory.cost_science:${JSON.stringify({ gold })}]`,
      );
    },
  );
});
