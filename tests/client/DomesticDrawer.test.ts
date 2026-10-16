import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { GameMode, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  DOMESTIC_SCREENS,
  DomesticScreen,
  DomesticScreenShownEvent,
  OpenDomesticScreenEvent,
} from "../../src/client/hud/domestic/DomesticEvents";
// Side-effect import: the custom element must register.
import "../../src/client/hud/domestic/DomesticPanel";
import type { DomesticPanel } from "../../src/client/hud/domestic/DomesticPanel";
import { MapControls } from "../../src/client/hud/layers/MapControls";
import {
  ProclaimLawIntentEvent,
  SendQueueResearchIntentEvent,
} from "../../src/client/Transport";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const INDEX = new DOMParser().parseFromString(
  fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"),
  "text/html",
);

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

/** A drawer wired to a real bus; nothing open yet. */
async function mountDrawer(
  overrides: Partial<DomesticData> = {},
): Promise<DomesticPanel> {
  const data = { ...DATA, ...overrides };
  const panel = document.createElement("domestic-panel") as DomesticPanel;
  // A finished level-3 Research Institute / Admin Office: a project host.
  const host = {
    id: () => 7,
    level: () => 3,
    isUnderConstruction: () => false,
  };
  const me = {
    domesticData: () => data,
    domestic: () => new DomesticClientView(data),
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
    config: () => ({
      conquestPercent: () => 80,
      maxTimerMinutes: () => 30,
      gameConfig: () => ({ gameMode: GameMode.FFA }),
      hasInfiniteGold: () => false,
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

/** Tap a dial: the drawer opens on (or closes) its screen. */
async function tapDial(panel: DomesticPanel, screen: DomesticScreen) {
  panel.eventBus.emit(new OpenDomesticScreenEvent(screen));
  await panel.updateComplete;
}

async function openDrawer(
  screen: DomesticScreen = "research",
  overrides: Partial<DomesticData> = {},
): Promise<DomesticPanel> {
  const panel = await mountDrawer(overrides);
  await tapDial(panel, screen);
  return panel;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** jsdom has no layout: give an element the box the browser would. */
function place(el: Element, b: Box) {
  el.getBoundingClientRect = () =>
    ({
      ...b,
      x: b.left,
      y: b.top,
      width: b.right - b.left,
      height: b.bottom - b.top,
      toJSON: () => b,
    }) as DOMRect;
}

/** The HUD the open drawer must leave visible, laid out as on a tablet. */
async function mountHud(width: number, height: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  const topRight = document.createElement("div");
  topRight.setAttribute("data-hud-top-right", "");
  // Sidebar row plus the replay speed panel under it.
  place(topRight, { left: width - 290, top: 0, right: width, bottom: 150 });
  const bottomHud = document.createElement("div");
  bottomHud.setAttribute("data-bottom-hud", "");
  // The whole bottom HUD: its height follows the tallest column, here the
  // events and chat column on the right.
  place(bottomHud, {
    left: 0,
    top: height - 350,
    right: width,
    bottom: height,
  });
  const rows = document.createElement("div");
  rows.setAttribute("data-bottom-hud-rows", "");
  // Its fixed rows: control panel, build bar and the domestic row.
  place(rows, {
    left: width / 2 - 300,
    top: height - 180,
    right: width / 2 + 300,
    bottom: height,
  });
  bottomHud.append(rows);
  const controls = document.createElement("map-controls") as MapControls;
  expect(controls).toBeInstanceOf(MapControls);
  controls.eventBus = {
    on: () => {},
    emit: () => {},
  } as unknown as MapControls["eventBus"];
  document.body.append(topRight, bottomHud, controls);
  controls.init();
  await controls.updateComplete;
  const buttons = controls.firstElementChild!;
  place(buttons, {
    left: width - 52,
    top: height / 2 - 74,
    right: width - 8,
    bottom: height / 2 + 74,
  });
  return { topRight, bottomHud, rows, buttons };
}

/** The drawer's inline offsets, in CSS px. */
function offsets(drawer: HTMLElement) {
  return {
    top: parseFloat(drawer.style.top),
    right: parseFloat(drawer.style.right),
    bottom: parseFloat(drawer.style.bottom),
  };
}

/** Tailwind z-index of an element (z-200, z-[200]). */
function zIndex(el: Element): number {
  for (const c of el.classList) {
    const m = /^z-\[?(\d+)\]?$/.exec(c);
    if (m) return Number(m[1]);
  }
  throw new Error(`no z-index on ${el.outerHTML.slice(0, 80)}`);
}

describe("domestic drawer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("opens as a right-side drawer that leaves the map visible", async () => {
    const panel = await openDrawer();
    const drawer = panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    expect(drawer.tagName).toBe("ASIDE");
    expect(drawer.classList).toContain("fixed");
    expect(drawer.style.right).not.toBe("");
    expect(drawer.classList).toContain("w-[45vw]");
    // No full-screen backdrop: taps on the map still reach the map.
    expect([...panel.querySelectorAll(".fixed")]).toEqual([drawer]);
  });

  it.each([
    [1024, 768],
    [1180, 820],
    [1366, 1024],
  ])(
    "at %ix%i it sits between the top-right sidebar, the bottom HUD and the map buttons",
    async (width, height) => {
      const hud = await mountHud(width, height);
      const panel = await openDrawer();
      const drawer = panel.querySelector<HTMLElement>(
        "[data-domestic-drawer]",
      )!;
      const { top, right, bottom } = offsets(drawer);
      // Below the sidebar, above the bottom HUD's fixed rows (build bar,
      // attack ratio, the domestic dials), left of the map buttons:
      // whatever its width, the drawer covers none of them.
      expect(top).toBeGreaterThanOrEqual(
        hud.topRight.getBoundingClientRect().bottom,
      );
      expect(height - bottom).toBeLessThanOrEqual(
        hud.rows.getBoundingClientRect().top,
      );
      expect(width - right).toBeLessThanOrEqual(
        hud.buttons.getBoundingClientRect().left,
      );
      // ...and still has room for its cards.
      expect(height - bottom - top).toBeGreaterThan(300);
    },
  );

  it("follows the HUD when it grows or the screen turns", async () => {
    const observed: Element[] = [];
    let onResize: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          onResize = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect = disconnect;
      },
    );
    const hud = await mountHud(1024, 768);
    const panel = await openDrawer();
    expect(observed).toEqual(
      expect.arrayContaining([hud.topRight, hud.rows, hud.buttons]),
    );
    const drawer = () =>
      panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    expect(offsets(drawer()).bottom).toBeGreaterThanOrEqual(180);
    const before = offsets(drawer()).bottom;

    // Events and chat pile up in the right column: the bottom HUD grows, but
    // the drawer keeps its height (M8) -- that column draws over it.
    place(hud.bottomHud, { left: 0, top: 200, right: 1024, bottom: 768 });
    onResize();
    window.dispatchEvent(new Event("resize"));
    await panel.updateComplete;
    expect(offsets(drawer()).bottom).toBe(before);

    // The fixed rows grow (the build bar wraps): the drawer moves up.
    place(hud.rows, { left: 212, top: 538, right: 812, bottom: 768 });
    onResize();
    await panel.updateComplete;
    expect(offsets(drawer()).bottom).toBeGreaterThanOrEqual(230);

    // The replay speed panel closes: the drawer moves up.
    place(hud.topRight, { left: 734, top: 0, right: 1024, bottom: 52 });
    window.dispatchEvent(new Event("resize"));
    await panel.updateComplete;
    expect(offsets(drawer()).top).toBeLessThan(100);
    expect(offsets(drawer()).top).toBeGreaterThanOrEqual(52);

    panel.querySelector<HTMLButtonElement>("[data-domestic-close]")!.click();
    await panel.updateComplete;
    expect(disconnect).toHaveBeenCalled();
  });

  it("pads its list so the HUD stacked over its lower band scrolls clear (C3)", async () => {
    const observed: Element[] = [];
    let onResize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          onResize = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    const hud = await mountHud(1024, 768);
    // A busy game: attack rows above the fixed rows, and the events and chat
    // column on the right, both drawn over the drawer (z-200 over z-150).
    const attacks = document.createElement("attacks-display");
    place(attacks, { left: 212, top: 468, right: 812, bottom: 588 });
    const side = document.createElement("div");
    side.setAttribute("data-bottom-hud-side", "");
    place(side, { left: 820, top: 300, right: 1016, bottom: 768 });
    hud.bottomHud.append(attacks, side);

    const panel = await openDrawer();
    expect(observed).toEqual(expect.arrayContaining([attacks, side]));
    const drawer = panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    const { top, right, bottom } = offsets(drawer);
    const drawerBottom = 768 - bottom;
    place(drawer, {
      left: 1024 - right - 420,
      top,
      right: 1024 - right,
      bottom: drawerBottom,
    });
    const padding = async () => {
      onResize();
      await panel.updateComplete;
      return parseFloat(
        panel.querySelector<HTMLElement>("[data-domestic-scroll]")!.style
          .paddingBottom,
      );
    };

    // The events column reaches highest: the last card can scroll above it.
    expect(await padding()).toBeGreaterThanOrEqual(drawerBottom - 300);

    // The column empties: only the attack rows still reach in.
    place(side, { left: 820, top: 768, right: 1016, bottom: 768 });
    const attacksOnly = await padding();
    expect(attacksOnly).toBeGreaterThanOrEqual(drawerBottom - 468);
    expect(attacksOnly).toBeLessThan(drawerBottom - 300);

    // HUD beside the drawer rather than over it is no reason to pad.
    place(attacks, { left: 0, top: 468, right: 500, bottom: 588 });
    expect(await padding()).toBeLessThanOrEqual(12);
  });

  it("marks the events and chat column the drawer pads for", () => {
    const side = INDEX.querySelector("[data-bottom-hud-side]")!;
    expect(side).not.toBeNull();
    for (const tag of ["chat-display", "events-display", "actionable-events"]) {
      expect(side.querySelector(tag)).not.toBeNull();
    }
    expect(
      INDEX.querySelector("[data-bottom-hud] attacks-display"),
    ).not.toBeNull();
  });

  it("keeps clear of the box with the control panel and build bar", () => {
    const rows = INDEX.querySelector("[data-bottom-hud-rows]")!;
    expect(rows).not.toBeNull();
    for (const tag of ["control-panel", "unit-display", "domestic-dials"]) {
      expect(rows.querySelector(tag)).not.toBeNull();
    }
    // Not the events and chat column, whose height changes all game.
    expect(rows.querySelector("events-display")).toBeNull();
    expect(rows.querySelector("chat-display")).toBeNull();
  });

  it("stacks under the HUD it leaves clear", async () => {
    const hud = await mountHud(1024, 768);
    const panel = await openDrawer();
    const z = zIndex(panel.querySelector("[data-domestic-drawer]")!);
    // A build-bar card popping up over the drawer stays on top, and the HUD
    // stays tappable even before the drawer refits to a taller HUD.
    expect(z).toBeLessThan(zIndex(INDEX.querySelector("[data-bottom-hud]")!));
    expect(z).toBeLessThan(
      zIndex(INDEX.querySelector("[data-hud-top-right]")!),
    );
    expect(z).toBeLessThan(zIndex(hud.buttons));
  });

  it("opens on the tapped dial's screen; a second tap on it closes", async () => {
    const panel = await mountDrawer();
    const shown: (DomesticScreen | null)[] = [];
    panel.eventBus.on(DomesticScreenShownEvent, (e) => shown.push(e.screen));
    const drawer = () =>
      panel.querySelector<HTMLElement>("[data-domestic-drawer]");
    expect(drawer()).toBeNull();
    // Each screen shows its own content, under its own title.
    const content: Record<DomesticScreen, string> = {
      research: "[data-tech-tree]",
      laws: "[data-law-status]",
      victory: "[data-victory-block]",
    };
    for (const screen of DOMESTIC_SCREENS) {
      await tapDial(panel, screen);
      expect(drawer()!.dataset.screen).toBe(screen);
      expect(
        panel.querySelector("[data-domestic-title]")!.textContent,
      ).toContain(`[domestic.screen.${screen}]`);
      for (const other of DOMESTIC_SCREENS) {
        expect(panel.querySelector(content[other]) !== null).toBe(
          other === screen,
        );
      }
    }
    await tapDial(panel, "victory");
    expect(drawer()).toBeNull();
    expect(shown).toEqual(["research", "laws", "victory", null]);
  });

  it("has no tab row: the dials choose the screen", async () => {
    const panel = await openDrawer();
    expect(panel.querySelector('[role="tablist"]')).toBeNull();
    expect(panel.querySelector('[role="tab"]')).toBeNull();
  });

  it("puts nothing behind a hover on any screen", async () => {
    const panel = await openDrawer();
    for (const screen of DOMESTIC_SCREENS) {
      await tapDial(panel, screen);
      expect(panel.querySelectorAll("[title]")).toHaveLength(0);
    }
  });

  it("lays the research tree out by era, one column per branch", async () => {
    const panel = await openDrawer("research");
    const firstEra = panel.querySelector('[data-era="1"]')!;
    expect(
      [...firstEra.querySelectorAll<HTMLElement>("[data-column]")].map(
        (c) => c.dataset.column,
      ),
    ).toEqual(["economy", "military", "learning"]);
    expect(firstEra.querySelector('[data-tech="currency"]')).not.toBeNull();
  });

  it("the research sheet says why a gold payment is blocked", async () => {
    const panel = await openDrawer("research");
    panel.querySelector<HTMLButtonElement>('[data-tech="currency"]')!.click();
    await panel.updateComplete;
    const sheet = panel.querySelector("[data-tech-sheet]")!;
    const gold = sheet.querySelector<HTMLButtonElement>(
      '[data-sheet-action="gold"]',
    )!;
    expect(gold.disabled).toBe(true);
    expect(sheet.querySelector("[data-reason]")!.textContent).toContain(
      "[build_menu.not_enough_money]",
    );
  });

  it("reserving from the sheet sends the queue intent; the slot's ✕ clears it", async () => {
    const panel = await openDrawer("research", {
      research: { tech: "currency", ticksLeft: 100, totalTicks: 200 },
      queuedTech: "academia",
    });
    const queued: (string | null)[] = [];
    panel.eventBus.on(SendQueueResearchIntentEvent, (e) => queued.push(e.tech));
    panel.querySelector<HTMLButtonElement>('[data-tech="navigation"]')!.click();
    await panel.updateComplete;
    const queue = () =>
      panel.querySelector<HTMLButtonElement>('[data-sheet-action="queue"]')!;
    queue().click();
    await panel.updateComplete;
    expect(queued).toEqual([]);
    queue().click();
    await panel.updateComplete;
    expect(queued).toEqual(["navigation"]);

    panel.querySelector<HTMLButtonElement>("[data-queue-cancel]")!.click();
    expect(queued).toEqual(["navigation", null]);
  });

  it("the detail sheet sits above the HUD over the drawer, and the list scrolls clear of it", async () => {
    let onResize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          onResize = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const hud = await mountHud(1024, 768);
    const side = document.createElement("div");
    side.setAttribute("data-bottom-hud-side", "");
    place(side, { left: 820, top: 400, right: 1016, bottom: 768 });
    hud.bottomHud.append(side);
    const panel = await openDrawer("research");
    const drawer = panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    const { top, right, bottom } = offsets(drawer);
    place(drawer, {
      left: 1024 - right - 460,
      top,
      right: 1024 - right,
      bottom: 768 - bottom,
    });
    onResize();
    await panel.updateComplete;
    const covered = 768 - bottom - 400;
    expect(covered).toBeGreaterThan(0);

    panel.querySelector<HTMLButtonElement>('[data-tech="currency"]')!.click();
    await panel.updateComplete;
    const sheet = panel.querySelector<HTMLElement>("[data-tech-sheet]")!;
    expect(parseFloat(sheet.style.bottom)).toBe(covered);
    place(sheet, { left: 0, top: 0, right: 400, bottom: 220 });
    panel.requestUpdate();
    await panel.updateComplete;
    await panel.updateComplete;
    const padding = parseFloat(
      panel.querySelector<HTMLElement>("[data-domestic-scroll]")!.style
        .paddingBottom,
    );
    expect(padding).toBe(12 + covered + 220);
  });

  it("the laws screen says why a gold proclamation is blocked", async () => {
    const panel = await openDrawer("laws");
    // No political power and no gold: the open law pays in gold it lacks.
    const option = panel.querySelector('[data-law="trade"] [data-option="A"]')!;
    option.querySelector<HTMLButtonElement>("[data-law-pick]")!.click();
    await panel.updateComplete;
    expect(
      option.querySelector<HTMLButtonElement>("[data-law-confirm]")!.disabled,
    ).toBe(true);
    expect(option.querySelector("[data-reason]")!.textContent).toContain(
      "[build_menu.not_enough_money]",
    );
    // A law locked behind a tech names the tech instead of the gold.
    const locked = panel.querySelector('[data-law="nuclear"]')!;
    expect(locked.textContent).toContain("[domestic.locked_requires]");
    expect(locked.querySelector("[data-reason]")).toBeNull();
  });

  it("a law takes a second tap, and leaving the screen forgets the first (M7)", async () => {
    const panel = await openDrawer("laws", { political: 1000 });
    const proclaimed: string[] = [];
    panel.eventBus.on(ProclaimLawIntentEvent, (e) =>
      proclaimed.push(`${e.law}:${e.option}:${e.payWithGold}`),
    );
    const card = () =>
      panel.querySelector('[data-law="trade"] [data-option="A"]')!;
    const confirm = () =>
      card().querySelector<HTMLButtonElement>("[data-law-confirm]");
    card().querySelector<HTMLButtonElement>("[data-law-pick]")!.click();
    await panel.updateComplete;
    expect(confirm()!.textContent).toContain("[domestic.book.proclaim]");
    expect(proclaimed).toEqual([]);

    await tapDial(panel, "research");
    await tapDial(panel, "laws");
    expect(confirm()).toBeNull();
    card().querySelector<HTMLButtonElement>("[data-law-pick]")!.click();
    await panel.updateComplete;
    confirm()!.click();
    expect(proclaimed).toEqual(["trade:A:false"]);
  });

  it("the victory screen says on screen why a project cannot start", async () => {
    const panel = await openDrawer("victory");
    const reason = panel.querySelector<HTMLElement>("[data-victory-block]")!;
    // Neither project is qualified yet (no Space Program, government tier 0).
    expect(reason.textContent).toContain(
      "[domestic.victory.blocked.requirement]",
    );
    const button = reason.parentElement!.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.type).toBe("button");
  });

  it("closes with the ✕ button and tells the dials", async () => {
    const panel = await openDrawer();
    const shown: (DomesticScreen | null)[] = [];
    panel.eventBus.on(DomesticScreenShownEvent, (e) => shown.push(e.screen));
    panel.querySelector<HTMLButtonElement>("[data-domestic-close]")!.click();
    await panel.updateComplete;
    expect(panel.querySelector("[data-domestic-drawer]")).toBeNull();
    expect(shown).toEqual([null]);
  });
});
