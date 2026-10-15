import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  DomesticPanel,
  TABS,
} from "../../src/client/hud/domestic/DomesticPanel";
import { MapControls } from "../../src/client/hud/layers/MapControls";
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
  // Tutorial, control panel, build bar and the domestic row with its toggle.
  place(bottomHud, {
    left: 0,
    top: height - 350,
    right: width,
    bottom: height,
  });
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
  return { topRight, bottomHud, buttons };
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
    expect(drawer.classList).toContain("w-[40vw]");
    // No full-screen backdrop: taps on the map still reach the map.
    expect(panel.querySelector(".inset-0")).toBeNull();
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
      // Below the sidebar, above the whole bottom HUD (build bar, attack
      // ratio, the domestic row and its toggle), left of the map buttons:
      // whatever its width, the drawer covers none of them.
      expect(top).toBeGreaterThanOrEqual(
        hud.topRight.getBoundingClientRect().bottom,
      );
      expect(height - bottom).toBeLessThanOrEqual(
        hud.bottomHud.getBoundingClientRect().top,
      );
      expect(width - right).toBeLessThanOrEqual(
        hud.buttons.getBoundingClientRect().left,
      );
      // ...and still has room for its tabs and cards.
      expect(height - bottom - top).toBeGreaterThan(200);
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
      expect.arrayContaining([hud.topRight, hud.bottomHud, hud.buttons]),
    );
    const drawer = () =>
      panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    expect(offsets(drawer()).bottom).toBeGreaterThanOrEqual(350);

    // An incoming attack row makes the bottom HUD taller.
    place(hud.bottomHud, { left: 0, top: 368, right: 1024, bottom: 768 });
    onResize();
    await panel.updateComplete;
    expect(offsets(drawer()).bottom).toBeGreaterThanOrEqual(400);

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

  it("has one tab button per tab, whatever the tab list holds", async () => {
    const panel = await openDrawer();
    const tabs = [...panel.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((t) => t.dataset.tab)).toEqual([...TABS]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps the tab row instead of hiding tabs off to the side", async () => {
    const panel = await openDrawer();
    const tablist = panel.querySelector('[role="tablist"]')!;
    // Long English tab names don't fit one row of a 420px drawer; every tab
    // must stay on screen rather than behind a sideways scroll.
    expect(tablist.classList).toContain("flex-wrap");
    expect(tablist.classList).not.toContain("overflow-x-auto");
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
