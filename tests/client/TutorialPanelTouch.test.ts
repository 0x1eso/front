import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { TutorialPanel } from "../../src/client/hud/layers/TutorialPanel";

/** A spawned player early in the tutorial, as the panel sees it. */
async function mountTutorial(): Promise<TutorialPanel> {
  const panel = document.createElement("tutorial-panel") as TutorialPanel;
  expect(panel).toBeInstanceOf(TutorialPanel);
  const me = {
    hasSpawned: () => true,
    isAlive: () => true,
    outgoingAttacks: () => [],
    units: () => [],
    alliances: () => [],
    gold: () => 0n,
    buildables: () => Promise.resolve([]),
    nameLocation: () => ({ x: 5, y: 5 }),
    smallID: () => 1,
    isPlayer: () => true,
    type: () => "HUMAN",
  };
  panel.game = {
    myPlayer: () => me,
    config: () => ({
      isReplay: () => false,
      isUnitDisabled: () => false,
      disableAlliances: () => false,
    }),
    ticks: () => 1,
    inSpawnPhase: () => false,
    playerViews: () => [me],
    setOwnSpawnRing: () => {},
    setMarkedPlayers: () => {},
    markedPlayers: () => null,
  } as unknown as TutorialPanel["game"];
  panel.eventBus = {
    on: () => {},
    emit: () => {},
  } as unknown as TutorialPanel["eventBus"];
  panel.userSettings = {
    tutorialDismissed: () => false,
    setTutorialDismissed: () => {},
    parsedUserKeybinds: () => ({}),
  } as unknown as TutorialPanel["userSettings"];
  panel.uiState = { attackRatio: 0.2 } as TutorialPanel["uiState"];
  document.body.appendChild(panel);
  // Spawning is already done: let its ✓ linger out to the next step.
  for (
    let i = 0;
    i < 100 && !panel.textContent!.includes("[tutorial.skip]");
    i++
  ) {
    panel.tick();
    await panel.updateComplete;
  }
  return panel;
}

function expectTouchSized(panel: TutorialPanel) {
  const buttons = [...panel.querySelectorAll("button")];
  expect(buttons.length).toBeGreaterThan(0);
  for (const b of buttons) {
    // Original size (spec §14d): no 44px minimums.
    expect(b.className).not.toMatch(/\b(size-11|h-11|min-h-11|min-w-11)\b/);
  }
  // No hover-only tooltips (spec §14a); the ✕ keeps its aria-label.
  expect(panel.querySelectorAll("[title]")).toHaveLength(0);
}

describe("tutorial panel on a tablet", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("its header buttons are original-sized with no tooltips", async () => {
    const panel = await mountTutorial();
    expect(panel.textContent).toContain("[tutorial.skip]");
    expectTouchSized(panel);
    expect(
      panel.querySelector(`[aria-label="[tutorial.close]"]`),
    ).not.toBeNull();
  });

  it("so are the close choices", async () => {
    const panel = await mountTutorial();
    panel
      .querySelector<HTMLButtonElement>(`[aria-label="[tutorial.close]"]`)!
      .click();
    await panel.updateComplete;
    expect(panel.textContent).toContain("[tutorial.hide_for_game]");
    expectTouchSized(panel);
  });

  it("draws one way at every width", async () => {
    const panel = await mountTutorial();
    const classes = [...panel.querySelectorAll("*")].flatMap((el) => [
      ...el.classList,
    ]);
    expect(
      classes.filter((c) => /^(sm|md|lg|xl|2xl):|^(min|max)-\[/.test(c)),
    ).toEqual([]);
  });
});
