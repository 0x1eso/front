import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import { DIAL_GLOW_CLASS } from "../../src/client/hud/domestic/Dial";
// Side-effect import: the custom element must register.
import "../../src/client/hud/domestic/DomesticDials";
import type { DomesticDials } from "../../src/client/hud/domestic/DomesticDials";
import {
  DomesticScreenShownEvent,
  OpenDomesticScreenEvent,
} from "../../src/client/hud/domestic/DomesticEvents";
import { SetRecruitTargetIntentEvent } from "../../src/client/Transport";
import type { GameView } from "../../src/client/view";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const BASE: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 2.5,
  politicalPerSec: 1,
  techs: [],
  research: null,
  recruitTargetPct: 80,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

interface Setup {
  ticks?: number;
  gold?: bigint;
  hosts?: { level: number }[];
  domestic?: boolean;
}

async function mount(
  d: Partial<DomesticData>,
  setup: Setup = {},
): Promise<DomesticDials> {
  const data = { ...BASE, ...d };
  const el = document.createElement("domestic-dials") as DomesticDials;
  const me = {
    isAlive: () => true,
    domestic: () =>
      setup.domestic === false ? null : new DomesticClientView(data),
    domesticData: () => (setup.domestic === false ? null : data),
    gold: () => setup.gold ?? 0n,
    units: () =>
      (setup.hosts ?? []).map((h) => ({
        level: () => h.level,
        isUnderConstruction: () => false,
      })),
  };
  el.game = {
    myPlayer: () => me,
    inSpawnPhase: () => false,
    ticks: () => setup.ticks ?? 0,
    config: () => ({ hasInfiniteGold: () => false }),
  } as unknown as GameView;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  return el;
}

function dial(el: HTMLElement, screen: string): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>(`[data-dial="${screen}"]`);
}

function progress(button: HTMLElement): number {
  const fill = button.querySelector("[data-ring], [data-clock]")!;
  return Number(fill.getAttribute("data-progress"));
}

describe("domestic dials", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("draw nothing outside domestic mode", async () => {
    const el = await mount({}, { domestic: false });
    expect(el.querySelector("[data-domestic-dials]")).toBeNull();
  });

  describe("research dial", () => {
    it("fills its ring and counts down while researching", async () => {
      const el = await mount({
        research: { tech: "currency", ticksLeft: 150, totalTicks: 200 },
      });
      const d = dial(el, "research")!;
      expect(d.dataset.state).toBe("researching");
      expect(progress(d)).toBeCloseTo(0.25);
      expect(d.textContent).toContain('[domestic.dial.seconds:{"seconds":15}]');
      expect(d.classList).not.toContain(DIAL_GLOW_CLASS);
    });

    it("glows with a ! badge when idle and an open tech is paid for", async () => {
      const el = await mount({ science: 150 });
      const d = dial(el, "research")!;
      expect(d.dataset.state).toBe("available");
      expect(d.classList).toContain(DIAL_GLOW_CLASS);
      expect(d.querySelector('[data-dial-badge="ready"]')!.textContent).toBe(
        "!",
      );
    });

    it("is grey with the ring at the science toward the cheapest open tech", async () => {
      const el = await mount({ science: 75 });
      const d = dial(el, "research")!;
      expect(d.dataset.state).toBe("short");
      // The cheapest open tech is an era-1 one at 150 science.
      expect(progress(d)).toBeCloseTo(0.5);
      expect(d.classList).not.toContain(DIAL_GLOW_CLASS);
      expect(d.querySelector("[data-dial-badge]")).toBeNull();
      expect(d.querySelector(".grayscale")).not.toBeNull();
    });

    it("marks a reserved next research", async () => {
      const plain = await mount({
        research: { tech: "currency", ticksLeft: 100, totalTicks: 200 },
      });
      expect(plain.querySelector("[data-dial-queued]")).toBeNull();
      document.body.innerHTML = "";
      const el = await mount({
        research: { tech: "currency", ticksLeft: 100, totalTicks: 200 },
        queuedTech: "navigation",
      });
      expect(el.querySelector("[data-dial-queued]")).not.toBeNull();
    });
  });

  describe("laws dial", () => {
    it("shows the cooldown as a shrinking clock with the seconds left", async () => {
      const el = await mount(
        { political: 1000, lawCooldownUntilTick: 300 },
        { ticks: 75 },
      );
      const d = dial(el, "laws")!;
      expect(d.dataset.state).toBe("cooldown");
      // 225 of the 450 cooldown ticks left.
      expect(progress(d)).toBeCloseTo(0.5);
      expect(d.textContent).toContain('[domestic.dial.seconds:{"seconds":23}]');
      expect(d.classList).not.toContain(DIAL_GLOW_CLASS);
    });

    it("glows when a law can be proclaimed", async () => {
      const el = await mount({ political: 400 });
      const d = dial(el, "laws")!;
      expect(d.dataset.state).toBe("available");
      expect(d.classList).toContain(DIAL_GLOW_CLASS);
    });

    it("is grey with the ring at the power toward the next law", async () => {
      const el = await mount({ political: 175 });
      const d = dial(el, "laws")!;
      expect(d.dataset.state).toBe("short");
      // The first law costs 350.
      expect(progress(d)).toBeCloseTo(0.5);
      expect(d.classList).not.toContain(DIAL_GLOW_CLASS);
    });

    it("wears a badge while a new government can be chosen", async () => {
      const before = await mount({ governmentTier: 0 });
      expect(before.querySelector('[data-dial-badge="government"]')).toBeNull();
      document.body.innerHTML = "";
      const el = await mount({ governmentTier: 1, cumulativePolitical: 900 });
      expect(
        dial(el, "laws")!.querySelector('[data-dial-badge="government"]'),
      ).not.toBeNull();
      document.body.innerHTML = "";
      // Chosen: no badge until the next tier.
      const chosen = await mount({
        governmentTier: 1,
        government: "republic",
      });
      expect(chosen.querySelector('[data-dial-badge="government"]')).toBeNull();
    });
  });

  describe("victory dial", () => {
    it("stays hidden until a victory project opens", async () => {
      const el = await mount({});
      expect(dial(el, "victory")).toBeNull();
    });

    it("appears once qualified, and glows when a project can start now", async () => {
      const qualified = await mount({ techs: ["space_program"] });
      expect(dial(qualified, "victory")!.dataset.state).toBe("qualified");
      expect(dial(qualified, "victory")!.classList).not.toContain(
        DIAL_GLOW_CLASS,
      );
      document.body.innerHTML = "";
      const ready = await mount(
        { techs: ["space_program"] },
        { gold: 5_000_000n, hosts: [{ level: 3 }] },
      );
      expect(dial(ready, "victory")!.dataset.state).toBe("ready");
      expect(dial(ready, "victory")!.classList).toContain(DIAL_GLOW_CLASS);
    });

    it("shows a running project's progress", async () => {
      const el = await mount({
        project: {
          kind: "science",
          hostUnitId: 7,
          ticksLeft: 1800,
          totalTicks: 2400,
          paused: false,
        },
      });
      const d = dial(el, "victory")!;
      expect(d.dataset.state).toBe("running");
      expect(progress(d)).toBeCloseTo(0.25);
      expect(d.textContent).toContain("25%");
    });
  });

  it("shows science and political power per second under the dials", async () => {
    const el = await mount({});
    expect(dial(el, "research")!.parentElement!.textContent).toContain(
      '[domestic.per_sec:{"value":"2.5"}]',
    );
    expect(dial(el, "laws")!.parentElement!.textContent).toContain(
      '[domestic.per_sec:{"value":"1.0"}]',
    );
  });

  it("a tap opens the dial's screen; the open screen's dial is marked", async () => {
    const el = await mount({ techs: ["space_program"] });
    const opened: string[] = [];
    el.eventBus.on(OpenDomesticScreenEvent, (e) => opened.push(e.screen));
    for (const screen of ["research", "laws", "victory"]) {
      dial(el, screen)!.click();
    }
    expect(opened).toEqual(["research", "laws", "victory"]);

    el.eventBus.emit(new DomesticScreenShownEvent("laws"));
    await el.updateComplete;
    expect(dial(el, "laws")!.getAttribute("aria-pressed")).toBe("true");
    expect(dial(el, "research")!.getAttribute("aria-pressed")).toBe("false");
  });

  describe("recruit chip", () => {
    it("says the target and opens the slider, which sends the new target", async () => {
      const el = await mount({});
      const chip = el.querySelector<HTMLButtonElement>("[data-recruit-chip]")!;
      expect(chip.textContent).toContain('[domestic.recruit_chip:{"pct":80}]');
      expect(el.querySelector("[data-recruit-popover]")).toBeNull();

      chip.click();
      await el.updateComplete;
      const targets: number[] = [];
      el.eventBus.on(SetRecruitTargetIntentEvent, (e) =>
        targets.push(e.percent),
      );
      const slider = el.querySelector<HTMLInputElement>(
        '[data-recruit-popover] input[type="range"]',
      )!;
      slider.value = "60";
      slider.dispatchEvent(new Event("input"));
      slider.dispatchEvent(new Event("change"));
      await el.updateComplete;

      expect(targets).toEqual([60]);
      // The chip follows the slider while the intent round-trips.
      expect(chip.textContent).toContain('[domestic.recruit_chip:{"pct":60}]');
    });

    it("closes on a tap outside or on its ✕", async () => {
      const el = await mount({});
      const chip = el.querySelector<HTMLButtonElement>("[data-recruit-chip]")!;
      chip.click();
      await el.updateComplete;
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await el.updateComplete;
      expect(el.querySelector("[data-recruit-popover]")).toBeNull();

      chip.click();
      await el.updateComplete;
      el.querySelector<HTMLButtonElement>("[data-recruit-close]")!.click();
      await el.updateComplete;
      expect(el.querySelector("[data-recruit-popover]")).toBeNull();
    });
  });

  it("keeps the dials compact and puts nothing behind a hover", async () => {
    const el = await mount({ science: 150, techs: ["space_program"] });
    for (const b of el.querySelectorAll("[data-dial]")) {
      // 44px: in line with the build bar, not the tallest thing in the HUD.
      expect(b.classList).toContain("size-11");
    }
    expect(el.querySelectorAll("[title]")).toHaveLength(0);
  });
});
