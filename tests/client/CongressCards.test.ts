import { SessionData } from "@openfront/engine-api/congress/CongressTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/congress/CongressCards";
import {
  COLLAPSE_TICKS,
  CongressCards,
  STAMP_TICKS,
} from "../../src/client/hud/congress/CongressCards";
import { OpenDomesticScreenEvent } from "../../src/client/hud/domestic/DomesticEvents";
import { SendCongressVoteIntentEvent } from "../../src/client/Transport";
import { EMPTY, FakeCongress, fakeCongressGame } from "./CongressFixture";

const REGULAR: SessionData = {
  id: 7,
  kind: "regular",
  openTick: 1800,
  closeTick: 2100,
  items: [
    {
      resolution: "sanction",
      targets: [2],
      param: null,
      reason: "aggressor",
      reasonValue: 2.1,
      voters: 3,
    },
  ],
};

async function mount(state: FakeCongress) {
  const el = document.createElement("congress-cards") as CongressCards;
  el.game = fakeCongressGame(state);
  el.eventBus = new EventBus();
  const votes: SendCongressVoteIntentEvent[] = [];
  el.eventBus.on(SendCongressVoteIntentEvent, (e) => votes.push(e));
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const step = async (now?: number) => {
    if (now !== undefined) state.now = now;
    el.tick();
    await el.updateComplete;
  };
  return { el, votes, step };
}

const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);

describe("vote cards", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("one tap votes; then the chips raise it, priced by the raise", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    };
    const { el, votes, step } = await mount(state);
    const pressed = () =>
      [...el.querySelectorAll<HTMLElement>("[data-vote]")].map((b) => [
        b.dataset.vote,
        b.getAttribute("aria-pressed"),
      ]);
    expect(pressed()).toEqual([
      ["A", "false"],
      ["B", "false"],
    ]);
    q(el, '[data-congress-card="0"] [data-vote="A"]')!.click();
    expect(votes.map((v) => [v.session, v.item, v.option, v.extra])).toEqual([
      [7, 0, "A", 0],
    ]);
    state.ballots = [{ sessionId: 7, item: 0, option: "A", extra: 0 }];
    await step();
    expect(q(el, '[data-vote="B"]')!.hasAttribute("disabled")).toBe(true);
    // My side reads as pressed (an end-to-end check waits for it).
    expect(pressed()).toEqual([
      ["A", "true"],
      ["B", "false"],
    ]);
    const chips = [...el.querySelectorAll<HTMLButtonElement>("[data-extra]")];
    expect(chips.map((c) => [c.dataset.extra, c.disabled])).toEqual([
      ["1", false],
      ["2", false],
      ["3", true],
      ["4", true],
      ["5", true],
    ]);
    expect(chips[1].textContent).toContain(
      '[congress.card.extra:{"votes":2,"cost":30}]',
    );
    // Big enough to tap on a phone.
    for (const c of chips) expect(c.classList).toContain("h-8");
    chips[1].click();
    expect(votes[votes.length - 1]).toMatchObject({ option: "A", extra: 2 });
  });

  it("shows the turnout, never the sides", async () => {
    const { el } = await mount({
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    });
    const card = q(el, "[data-congress-card]")!;
    expect(q(card, "[data-turnout]")!.textContent).toContain(
      '[congress.card.turnout:{"voted":3,"total":3}]',
    );
    expect(card.textContent).not.toMatch(/"a":|"b":/);
  });

  it("the target of an emergency can only oppose and sees which side is good for it", async () => {
    const { el } = await mount({
      now: 120,
      data: {
        ...EMPTY,
        seats: [2, 3],
        session: {
          id: 2,
          kind: "emergency",
          openTick: 100,
          closeTick: 300,
          items: [
            {
              resolution: "emergency",
              targets: [1],
              param: "nuclear",
              reason: "convened",
              reasonValue: 2,
              voters: 1,
            },
          ],
        },
      },
      ballots: [],
      influence: 100,
    });
    const a = q(el, '[data-vote="A"]')! as HTMLButtonElement;
    const b = q(el, '[data-vote="B"]')! as HTMLButtonElement;
    expect(a.disabled).toBe(true);
    expect(b.disabled).toBe(false);
    expect(a.dataset.side).toBe("bad");
    expect(b.dataset.side).toBe("good");
    expect(el.textContent).toContain("[congress.card.b_only]");
    expect(el.textContent).toContain("[congress.emergency.nuclear] · me");
  });

  it("folds into a pill 5 s after my last vote, and the pill opens it again", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "B", extra: 0 }],
      influence: 50,
    };
    const { el, step } = await mount(state);
    await step(1900 + COLLAPSE_TICKS - 1);
    expect(q(el, "[data-congress-card]")).not.toBeNull();
    await step(1900 + COLLAPSE_TICKS);
    expect(q(el, "[data-congress-card]")).toBeNull();
    const pill = q(el, "[data-congress-pill]")!;
    expect(pill.textContent).toContain(
      '[congress.card.collapsed:{"seconds":15,"voted":1,"total":1}]',
    );
    pill.click();
    await step();
    expect(q(el, "[data-congress-card]")).not.toBeNull();
  });

  it("the dial opens folded cards too", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "B", extra: 0 }],
      influence: 50,
    };
    const { el, step } = await mount(state);
    await step(1900 + COLLAPSE_TICKS);
    el.eventBus.emit(new OpenDomesticScreenEvent("congress"));
    await step();
    expect(q(el, "[data-congress-card]")).not.toBeNull();
  });

  it("stamps each result for 3 s once the session closes", async () => {
    const state: FakeCongress = {
      now: 2090,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    };
    const { el, step } = await mount(state);
    state.data = {
      ...EMPTY,
      nextSessionTick: 3600,
      history: [
        {
          sessionId: 7,
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
    };
    await step(2100);
    expect(q(el, "[data-congress-card]")).toBeNull();
    expect(q(el, "[data-congress-stamp]")!.textContent).toContain(
      '[congress.card.adopted:{"option":"[congress.resolution.sanction.a]","a":11,"b":9}]',
    );
    await step(2100 + STAMP_TICKS);
    expect(q(el, "[data-congress-stamp]")).toBeNull();
  });

  it("chips list resolutions in force and open the congress screen", async () => {
    const { el } = await mount({
      now: 100,
      data: {
        ...EMPTY,
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
      },
      ballots: [],
      influence: 0,
    });
    const opened: string[] = [];
    el.eventBus.on(OpenDomesticScreenEvent, (e) => opened.push(e.screen));
    const chip = q(el, "[data-congress-chip]")!;
    expect(chip.textContent).toContain("[congress.resolution.war_tax.name]");
    expect(chip.textContent).toContain("3:20");
    chip.click();
    expect(opened).toEqual(["congress"]);
  });

  it("keeps at most three stamps when more results land at once", async () => {
    const state: FakeCongress = {
      now: 2090,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 0,
    };
    const { el, step } = await mount(state);
    const result = (sessionId: number) => ({
      sessionId,
      kind: "regular" as const,
      tick: 2100,
      resolution: "war_tax" as const,
      targets: [],
      param: null,
      a: 2,
      b: 1,
      adopted: "A" as const,
    });
    state.data = {
      ...EMPTY,
      history: [result(7), result(8), result(9), result(10)],
    };
    await step(2100);
    expect(el.querySelectorAll("[data-congress-stamp]")).toHaveLength(3);
  });

  it("keeps the raise chips on one line, the turnout on the reason line", async () => {
    const { el } = await mount({
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "A", extra: 0 }],
      influence: 300,
    });
    const footer = q(el, "[data-card-footer]")!;
    expect(footer.classList).toContain("flex-nowrap");
    expect(footer.classList).toContain("overflow-x-auto");
    expect(footer.querySelectorAll("[data-extra]")).toHaveLength(5);
    expect(q(footer, "[data-turnout]")).toBeNull();
    expect(
      q(el, "[data-card-reason]")!.parentElement!.querySelector(
        "[data-turnout]",
      ),
    ).not.toBeNull();
  });

  it("restarts the fold timer when I raise, so the card never folds under my finger", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "A", extra: 0 }],
      influence: 300,
    };
    const { el, step } = await mount(state);
    // A raise tap 4.5 s after my vote holds the card open...
    await step(1945);
    q(el, '[data-extra="1"]')!.click();
    await step(1950);
    expect(q(el, "[data-congress-card]")).not.toBeNull();
    // ...and the raised ballot coming back restarts the 5 s.
    state.ballots = [{ sessionId: 7, item: 0, option: "A", extra: 1 }];
    await step(1948 + 10);
    await step(1958 + COLLAPSE_TICKS - 1);
    expect(q(el, "[data-congress-card]")).not.toBeNull();
    await step(1958 + COLLAPSE_TICKS);
    expect(q(el, "[data-congress-card]")).toBeNull();
  });

  it("a dead player gets no cards and no pill", async () => {
    const { el } = await mount({
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 0,
      alive: false,
    });
    expect(q(el, "[data-congress-card]")).toBeNull();
    expect(q(el, "[data-congress-pill]")).toBeNull();
  });

  it("bounds the card stack by the room above the bottom HUD column", async () => {
    const column = document.createElement("div");
    document.body.appendChild(column);
    const el = document.createElement("congress-cards") as CongressCards;
    el.game = fakeCongressGame({
      now: 1900,
      data: {
        ...EMPTY,
        session: {
          ...REGULAR,
          items: [REGULAR.items[0], REGULAR.items[0], REGULAR.items[0]],
        },
      },
      ballots: [],
      influence: 50,
    });
    el.eventBus = new EventBus();
    column.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const stack = q(el, "[data-card-stack]")!;
    expect(stack.style.maxHeight).toBe("");
    // Three cards overflow a phone: the column starts 50 px above the screen.
    let top = -50;
    column.getBoundingClientRect = () => ({ top }) as DOMRect;
    stack.getBoundingClientRect = () => ({ height: 390 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    await el.updateComplete;
    expect(stack.style.maxHeight).toBe(`${390 - 50 - 8}px`);
    // A tall screen leaves room: the cap grows past the stack.
    top = 300;
    window.dispatchEvent(new Event("resize"));
    await el.updateComplete;
    expect(stack.style.maxHeight).toBe(`${390 + 300 - 8}px`);
  });

  it("gives resolution chips a full touch height", async () => {
    const { el } = await mount({
      now: 100,
      data: {
        ...EMPTY,
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
      },
      ballots: [],
      influence: 0,
    });
    expect(q(el, "[data-congress-chip]")!.classList).toContain("h-8");
  });

  it("wraps resolution chips within a card's width, so they stay left of the map's centre", async () => {
    // A phone at 800x360: a full-width chip row above the dials crossed the
    // screen's middle (the column starts at x 120, the centre is at 400).
    const { el } = await mount({
      now: 1900,
      data: {
        ...EMPTY,
        session: REGULAR,
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
      },
      ballots: [],
      influence: 0,
    });
    const cardWidth = [...q(el, "[data-congress-card]")!.classList].find((c) =>
      c.startsWith("w-["),
    );
    expect(cardWidth).toBeDefined();
    expect(q(el, "[data-congress-chips]")!.classList).toContain(cardWidth);
    // A chip longer than the row is cut short rather than spilling past it.
    const chip = q(el, "[data-congress-chip]")!.classList;
    expect(chip).toContain("max-w-full");
    expect(chip).toContain("truncate");
  });
});
