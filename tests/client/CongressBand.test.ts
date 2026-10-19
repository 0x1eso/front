import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/congress/CongressBand";
import {
  CongressBand,
  TOAST_TICKS,
} from "../../src/client/hud/congress/CongressBand";
import { PlaySoundEffectEvent } from "../../src/client/sound/Sounds";
import { SendConveneEmergencyIntentEvent } from "../../src/client/Transport";
import { EMPTY, FakeCongress, fakeCongressGame } from "./CongressFixture";

async function mount(state: FakeCongress) {
  const el = document.createElement("congress-band") as CongressBand;
  el.game = fakeCongressGame(state);
  el.eventBus = new EventBus();
  const sounds: string[] = [];
  const convened: SendConveneEmergencyIntentEvent[] = [];
  el.eventBus.on(PlaySoundEffectEvent, (e) => sounds.push(e.effect));
  el.eventBus.on(SendConveneEmergencyIntentEvent, (e) => convened.push(e));
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  const step = async (now?: number) => {
    if (now !== undefined) state.now = now;
    el.tick();
    await el.updateComplete;
  };
  return { el, sounds, convened, step };
}

const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);

const AVAILABLE = {
  ...EMPTY,
  available: [{ kind: "nuclear" as const, target: 2, sinceTick: 0 }],
};

describe("the congress band", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("draws nothing when nothing is going on", async () => {
    const { el } = await mount({
      now: 0,
      data: EMPTY,
      ballots: [],
      influence: 0,
    });
    expect(q(el, "[data-congress-band]")).toBeNull();
  });

  it("toasts a session's results once, with the gavel, for 3 s", async () => {
    const state: FakeCongress = {
      now: 2000,
      data: EMPTY,
      ballots: [],
      influence: 0,
    };
    const { el, sounds, step } = await mount(state);
    state.data = {
      ...EMPTY,
      history: [
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "war_tax",
          targets: [],
          param: null,
          a: 3,
          b: 1,
          adopted: "A",
        },
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "trade_pact",
          targets: [],
          param: "train",
          a: 2,
          b: 2,
          adopted: null,
        },
      ],
    };
    await step(2100);
    const toast = q(el, "[data-congress-toast]")!;
    expect(toast.textContent).toContain(
      '[congress.toast.adopted:{"title":"[congress.resolution.war_tax.name]","option":"[congress.resolution.war_tax.a]","a":3,"b":1}]',
    );
    expect(toast.textContent).toContain(
      '[congress.toast.tied:{"title":"[congress.resolution.trade_pact.name] · [congress.param.train]","a":2,"b":2}]',
    );
    expect(sounds).toEqual(["click-3"]);
    await step(2101);
    expect(sounds).toEqual(["click-3"]);
    await step(2100 + TOAST_TICKS);
    expect(q(el, "[data-congress-toast]")).toBeNull();
  });

  it("a seated player convenes with one tap", async () => {
    const { el, convened } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 80,
    });
    expect(q(el, "[data-available]")!.textContent).toContain(
      '[congress.band.available:{"name":"jiho","kind":"[congress.emergency.nuclear]"}]',
    );
    q(el, '[data-convene="nuclear:2"]')!.click();
    expect(convened.map((e) => [e.kind, e.target])).toEqual([
      ["nuclear", "p2"],
    ]);
  });

  it("the button is off with the reason when I can't convene", async () => {
    const { el, convened } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 10,
    });
    const button = q(el, '[data-convene="nuclear:2"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(q(el, "[data-convene-reason]")!.textContent).toContain(
      '[congress.block.influence:{"cost":50}]',
    );
    button.click();
    expect(convened).toEqual([]);
  });

  it("the target is warned, without a button", async () => {
    const { el } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 300,
      me: 2,
    });
    expect(q(el, "[data-available-target]")!.textContent).toContain(
      '[congress.band.available_target:{"kind":"[congress.emergency.nuclear]"}]',
    );
    expect(q(el, "[data-convene]")).toBeNull();
  });

  it("an emergency shows its goal, time and my part", async () => {
    const { el } = await mount({
      now: 600,
      data: {
        ...EMPTY,
        emergency: {
          kind: "nuclear",
          target: 2,
          startTick: 0,
          endTick: 1540,
          goalKind: "silos",
          goal: 2,
          progress: 1,
          members: [1],
          hero: 1,
        },
      },
      ballots: [],
      influence: 0,
      emergencyMember: true,
    });
    const row = q(el, "[data-emergency]")!;
    expect(row.dataset.emergencyRole).toBe("member");
    expect(row.textContent).toContain(
      '[congress.band.active:{"kind":"[congress.emergency.nuclear]","name":"jiho","goal":"[congress.goal.silos:{\\"progress\\":1,\\"goal\\":2}]","time":"1:34"}]',
    );
    expect(row.textContent).toContain("[congress.band.member]");
    expect(q(row, "[data-progress]")!.style.width).toBe("50%");
  });

  it("my part comes from my own data, never from the member list", async () => {
    const emergency = {
      kind: "aggression" as const,
      target: 2,
      startTick: 0,
      endTick: 1500,
      goalKind: "land" as const,
      goal: 300,
      progress: 0,
      members: [] as number[],
      hero: null,
    };
    // A member who hasn't taken anything yet: not on the list, still my part.
    const joined = await mount({
      now: 600,
      data: { ...EMPTY, emergency },
      ballots: [],
      influence: 0,
      emergencyMember: true,
    });
    expect(q(joined.el, "[data-emergency]")!.dataset.emergencyRole).toBe(
      "member",
    );
    document.body.innerHTML = "";
    // On the list but not told I'm a member: no part.
    const listed = await mount({
      now: 600,
      data: { ...EMPTY, emergency: { ...emergency, members: [1] } },
      ballots: [],
      influence: 0,
    });
    const row = q(listed.el, "[data-emergency]")!;
    expect(row.dataset.emergencyRole).toBe("none");
    expect(row.textContent).not.toContain("[congress.band.member]");
    document.body.innerHTML = "";
    // The target sees a red band.
    const target = await mount({
      now: 600,
      data: { ...EMPTY, emergency },
      ballots: [],
      influence: 0,
      me: 2,
    });
    const red = q(target.el, "[data-emergency]")!;
    expect(red.dataset.emergencyRole).toBe("target");
    expect(red.classList).toContain("bg-red-800/90");
    expect(red.textContent).toContain("[congress.band.target]");
  });

  it("an emergency vote has its line while the card sits in the card slot", async () => {
    const { el } = await mount({
      now: 140,
      data: {
        ...EMPTY,
        session: {
          id: 3,
          kind: "emergency",
          openTick: 100,
          closeTick: 300,
          items: [
            {
              resolution: "emergency",
              targets: [2],
              param: "aggression",
              reason: "convened",
              reasonValue: 3,
              voters: 1,
            },
          ],
        },
      },
      ballots: [],
      influence: 0,
    });
    expect(q(el, "[data-emergency-vote]")!.textContent).toContain(
      '[congress.band.voting:{"kind":"[congress.emergency.aggression]","name":"jiho","seconds":16}]',
    );
  });

  it("sits below the satellite band", async () => {
    const sat = document.createElement("div");
    sat.setAttribute("data-satellite-band", "");
    sat.getBoundingClientRect = () => ({ bottom: 60 }) as DOMRect;
    document.body.appendChild(sat);
    const { el } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 80,
    });
    expect(q(el, "[data-congress-band]")!.style.top).toBe("64px");
  });
});
