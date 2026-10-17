import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { TutorialPanel } from "../../src/client/hud/layers/TutorialPanel";

/** A spawned player early in the tutorial, as the panel sees it. */
async function mountTutorial(
  setTutorialDismissed: (v: boolean) => void = () => {},
  dismissed = false,
): Promise<TutorialPanel> {
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
    tutorialDismissed: () => dismissed,
    setTutorialDismissed,
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

  it("✕ closes the tutorial for good, with no extra choice", async () => {
    const setDismissed = vi.fn();
    const panel = await mountTutorial(setDismissed);
    panel
      .querySelector<HTMLButtonElement>(`[aria-label="[tutorial.close]"]`)!
      .click();
    await panel.updateComplete;
    expect(setDismissed).toHaveBeenCalledWith(true);
    expect(panel.textContent).toBe("");
    expect(panel.classList.contains("hidden")).toBe(true);
  });

  it("stays hidden once it was finished or skipped before", async () => {
    const panel = document.createElement("tutorial-panel") as TutorialPanel;
    panel.userSettings = {
      tutorialDismissed: () => true,
    } as unknown as TutorialPanel["userSettings"];
    panel.game = {} as TutorialPanel["game"];
    document.body.appendChild(panel);
    panel.tick();
    await panel.updateComplete;
    expect(panel.textContent).toBe("");
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

describe("tutorial panel on a short landscape screen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  function stubMedia(matches: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => {
      return {
        matches: query.includes("max-height: 500px") ? matches : false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    });
    // jsdom's window is the global here; stubGlobal covers `window.matchMedia`.
    window.matchMedia = globalThis.matchMedia;
  }

  it("is a one-line strip, not the big box", async () => {
    stubMedia(true);
    const panel = await mountTutorial();
    expect(panel.querySelector(".tutorial-compact")).not.toBeNull();
    expect(panel.textContent).not.toContain("[tutorial.title]");
    expect(panel.querySelector("ul")).toBeNull();
    expect(panel.querySelector("p")).toBeNull();
    const text = panel.querySelector<HTMLButtonElement>(
      ".tutorial-compact-text",
    )!;
    expect(text.className).toContain("truncate");
    expect(panel.textContent).toContain("[tutorial.skip]");
  });

  it("tap on the text expands and collapses it", async () => {
    stubMedia(true);
    const panel = await mountTutorial();
    const text = () =>
      panel.querySelector<HTMLButtonElement>(".tutorial-compact-text")!;
    text().click();
    await panel.updateComplete;
    expect(text().className).not.toContain("truncate");
    expect(text().getAttribute("aria-expanded")).toBe("true");
    text().click();
    await panel.updateComplete;
    expect(text().className).toContain("truncate");
  });

  it("✕ in the strip also counts as done", async () => {
    stubMedia(true);
    const setDismissed = vi.fn();
    const panel = await mountTutorial(setDismissed);
    panel
      .querySelector<HTMLButtonElement>(`[aria-label="[tutorial.close]"]`)!
      .click();
    expect(setDismissed).toHaveBeenCalledWith(true);
  });

  it("keeps the full box on bigger screens", async () => {
    stubMedia(false);
    const panel = await mountTutorial();
    expect(panel.querySelector(".tutorial-compact")).toBeNull();
    expect(panel.textContent).toContain("[tutorial.title]");
  });
});
