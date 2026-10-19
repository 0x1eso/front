import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/domestic/DomesticDials";
import type { DomesticDials } from "../../src/client/hud/domestic/DomesticDials";
import { OpenDomesticScreenEvent } from "../../src/client/hud/domestic/DomesticEvents";
import type { GameView } from "../../src/client/view";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { EMPTY } from "./CongressFixture";

const DOMESTIC: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 1,
  politicalPerSec: 1,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

async function mount(
  congress: Partial<typeof EMPTY> | null,
  influence = 120,
  ticks = 900,
): Promise<DomesticDials> {
  const el = document.createElement("domestic-dials") as DomesticDials;
  const me = {
    isAlive: () => true,
    smallID: () => 1,
    domestic: () => new DomesticClientView(DOMESTIC),
    domesticData: () => DOMESTIC,
    congressData: () => ({
      influence,
      influencePerSec: 0.4,
      status: "peaceful",
      ballots: [],
    }),
    gold: () => 0n,
    units: () => [],
    isFriendly: () => false,
  };
  el.game = {
    myPlayer: () => me,
    inSpawnPhase: () => false,
    ticks: () => ticks,
    congressData: () => (congress === null ? null : { ...EMPTY, ...congress }),
    playerBySmallID: () => ({ isPlayer: () => true, displayName: () => "x" }),
    config: () => ({
      hasInfiniteGold: () => false,
      congress: () => congress !== null,
    }),
  } as unknown as GameView;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  return el;
}

const dial = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('[data-dial="congress"]');

describe("the congress dial", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is absent without the congress", async () => {
    const el = await mount(null);
    expect(dial(el)).toBeNull();
    expect(el.querySelector('[data-dial="research"]')).not.toBeNull();
  });

  it("idles with my influence under it", async () => {
    const el = await mount({});
    expect(dial(el)!.dataset.state).toBe("idle");
    expect(
      el.querySelector("[data-congress-influence]")!.textContent,
    ).toContain('[congress.dial.influence:{"value":120}]');
  });

  it("glows while voting with the seconds left and a vote badge", async () => {
    const el = await mount(
      {
        session: {
          id: 1,
          kind: "regular",
          openTick: 800,
          closeTick: 1100,
          items: [
            {
              resolution: "war_tax",
              targets: [],
              param: null,
              reason: "global",
              reasonValue: 0,
              voters: 0,
            },
          ],
        },
      },
      120,
      900,
    );
    const d = dial(el)!;
    expect(d.dataset.state).toBe("voting");
    expect(d.textContent).toContain('[domestic.dial.seconds:{"seconds":20}]');
    expect(d.querySelector('[data-dial-badge="vote"]')).not.toBeNull();
  });

  it("shows a 🚨 badge when I can convene, and opens the congress screen", async () => {
    const el = await mount({
      available: [{ kind: "nuclear", target: 2, sinceTick: 0 }],
    });
    const d = dial(el)!;
    expect(
      d
        .querySelector('[data-dial-badge="convene"]')!
        .getAttribute("aria-label"),
    ).toBe("[congress.screen.available]");
    const opened: string[] = [];
    el.eventBus.on(OpenDomesticScreenEvent, (e) => opened.push(e.screen));
    d.click();
    expect(opened).toEqual(["congress"]);
  });

  it("marks a harmful resolution on me with a red, labelled badge", async () => {
    const el = await mount({
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [1],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    });
    const badge = dial(el)!.querySelector<HTMLElement>(
      '[data-dial-badge="target"]',
    )!;
    expect(badge.getAttribute("aria-label")).toBe("[congress.band.target]");
    expect(badge.classList).toContain("bg-red-500");
    // A world rule (no one named) is no badge.
    const world = await mount({
      active: [
        {
          resolution: "war_tax",
          option: "A",
          targets: [],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    });
    expect(dial(world)!.querySelector("[data-dial-badge]")).toBeNull();
  });
});
