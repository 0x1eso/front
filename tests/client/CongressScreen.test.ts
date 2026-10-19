import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import { renderCongressScreen } from "../../src/client/hud/congress/CongressScreen";
import { OpenDomesticScreenEvent } from "../../src/client/hud/domestic/DomesticEvents";
import "../../src/client/hud/domestic/DomesticPanel";
import type { DomesticPanel } from "../../src/client/hud/domestic/DomesticPanel";
import { SendConveneEmergencyIntentEvent } from "../../src/client/Transport";
import type { GameView } from "../../src/client/view";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { EMPTY } from "./CongressFixture";

const t = (key: string, p?: Record<string, string | number>) =>
  p === undefined ? `[${key}]` : `[${key}:${JSON.stringify(p)}]`;

function mount(data = EMPTY, influence = 120) {
  const el = document.createElement("div");
  const convene = vi.fn();
  render(
    renderCongressScreen({
      data,
      viewer: {
        smallID: 1,
        alive: true,
        data: {
          influence,
          influencePerSec: 0.45,
          status: "peaceful",
          ballots: [],
        },
        friendlyTo: () => false,
      },
      now: 900,
      nameOf: (id) => ["", "me", "jiho", "seoyeon"][id] ?? "?",
      t,
      convene,
    }),
    el,
  );
  return { el, convene };
}

describe("the congress screen", () => {
  it("shows my influence, its rate and status, and the next session", () => {
    const { el } = mount();
    expect(
      el.querySelector("[data-congress-influence]")!.textContent,
    ).toContain('[congress.screen.influence:{"value":120}]');
    expect(el.textContent).toContain("[congress.status.peaceful]");
    expect(el.querySelector("[data-congress-next]")!.textContent).toContain(
      '[congress.screen.next_session:{"time":"1:30"}]',
    );
  });

  it("lists resolutions in force with their time left", () => {
    const { el } = mount({
      ...EMPTY,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [2],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    });
    const row = el.querySelector("[data-active-resolution]")!;
    expect(row.textContent).toContain(
      "[congress.resolution.sanction.name] · jiho",
    );
    expect(row.textContent).toContain("[congress.resolution.sanction.a]");
    // Until the next tally: 1800 + 300 - 900 ticks.
    expect(row.textContent).toContain("2:00");
  });

  it("convenes with one tap, and says why not when it can't", () => {
    const data = {
      ...EMPTY,
      available: [{ kind: "nuclear" as const, target: 2, sinceTick: 0 }],
    };
    const { el, convene } = mount(data);
    el.querySelector<HTMLButtonElement>('[data-convene="nuclear:2"]')!.click();
    expect(convene).toHaveBeenCalledWith("nuclear", 2);
    const poor = mount(data, 10);
    const button = poor.el.querySelector<HTMLButtonElement>(
      '[data-convene="nuclear:2"]',
    )!;
    expect(button.disabled).toBe(true);
    expect(poor.el.textContent).toContain(
      '[congress.block.influence:{"cost":50}]',
    );
  });

  it("shows totals in the history, never who voted what", () => {
    const { el } = mount({
      ...EMPTY,
      history: [
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "sanction",
          targets: [2],
          param: null,
          a: 11,
          b: 9,
          adopted: "A",
        },
      ],
    });
    const history = el.querySelector("[data-congress-history]")!.textContent!;
    expect(history).toContain('"a":11');
    expect(history).toContain('"b":9');
    expect(history).not.toContain("seoyeon");
  });

  it("names world-government verdicts: ratified, or not ratified", () => {
    const { el } = mount({
      ...EMPTY,
      verdicts: [
        { owner: 2, host: 40, ratified: false },
        { owner: 3, host: 41, ratified: true },
      ],
    });
    const rows = el.querySelector("[data-congress-worldgov]")!.textContent!;
    expect(rows).toContain('[congress.screen.not_ratified:{"name":"jiho"}]');
    expect(rows).toContain(
      '[congress.screen.world_gov_ratified:{"name":"seoyeon"}]',
    );
    expect(rows).not.toContain("world_gov_waiting");
  });

  it("gives the convene button a full touch height", () => {
    const { el } = mount({
      ...EMPTY,
      available: [{ kind: "aggression", target: 2, sinceTick: 0 }],
    });
    expect(
      el.querySelector('[data-convene="aggression:2"]')!.classList,
    ).toContain("h-11");
  });
});

describe("the drawer's congress screen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const DOMESTIC = {
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

  it("opens from the 🏛 dial, and a convene tap sends the target's player id", async () => {
    const panel = document.createElement("domestic-panel") as DomesticPanel;
    const me = {
      smallID: () => 1,
      isAlive: () => true,
      domesticData: () => DOMESTIC,
      domestic: () => new DomesticClientView(DOMESTIC),
      congressData: () => ({
        influence: 80,
        influencePerSec: 0.4,
        status: "peaceful",
        ballots: [],
      }),
      isFriendly: () => false,
    };
    panel.game = {
      myPlayer: () => me,
      ticks: () => 900,
      congressData: () => ({
        ...EMPTY,
        available: [{ kind: "nuclear", target: 2, sinceTick: 0 }],
      }),
      playerBySmallID: (id: number) => ({
        isPlayer: () => true,
        id: () => `p${id}`,
        displayName: () => ["", "me", "jiho"][id] ?? "?",
      }),
      config: () => ({ congress: () => true }),
    } as unknown as GameView;
    panel.eventBus = new EventBus();
    const convened: SendConveneEmergencyIntentEvent[] = [];
    panel.eventBus.on(SendConveneEmergencyIntentEvent, (e) => convened.push(e));
    document.body.appendChild(panel);
    panel.init();
    panel.tick();
    panel.eventBus.emit(new OpenDomesticScreenEvent("congress"));
    await panel.updateComplete;
    const drawer = panel.querySelector<HTMLElement>("[data-domestic-drawer]")!;
    expect(drawer.dataset.screen).toBe("congress");
    expect(panel.querySelector("[data-domestic-title]")!.textContent).toContain(
      "[domestic.screen.congress]",
    );
    expect(panel.querySelector("[data-congress-screen]")).not.toBeNull();
    panel
      .querySelector<HTMLButtonElement>('[data-convene="nuclear:2"]')!
      .click();
    expect(convened.map((e) => [e.kind, e.target])).toEqual([
      ["nuclear", "p2"],
    ]);
  });
});
