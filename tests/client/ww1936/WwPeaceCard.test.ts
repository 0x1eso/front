// World War 1936 P5 (plan Task 9, spec §20.1): the peace conference card.
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_PEACE_MAX_ROUNDS,
  type WwConferenceView,
  type WwDemandView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { peaceUiOf } from "../../../src/client/hud/ww1936/PeaceModel";
import { TWO_TAP_MS } from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwEventCards";
import type { WwEventCards } from "../../../src/client/hud/ww1936/WwEventCards";
import "../../../src/client/hud/ww1936/WwPeaceCard";
import type { WwPeaceCard } from "../../../src/client/hud/ww1936/WwPeaceCard";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import {
  card,
  fakePolGame,
  polDetail,
  PolOptions,
  polSummary,
} from "./PoliticsFixture";

const WARSAW = 6;
const KRAKOW = 7;
const TICKS = 700;

const aiTake = (region: number, slot: number): WwDemandView => ({
  kind: "take",
  slot,
  regions: [region],
  target: 0,
  beneficiary: 0,
  k: 0,
  pct: 0,
  cost: 12,
});

/** Germany and Italy against Poland, round 1, 15 s (150 ticks) left. */
function conference(): WwConferenceView {
  return {
    id: 3,
    losers: [ID("POL")],
    status: "open",
    round: 1,
    roundEndTick: TICKS + 150,
    participants: [
      {
        id: ID("DEU"),
        pts: 100,
        sharePm: 700,
        order: 0,
        human: true,
        final: false,
      },
      {
        id: ID("ITA"),
        pts: 40,
        sharePm: 300,
        order: 1,
        human: false,
        final: false,
      },
    ],
    stake: [
      { region: WARSAW, base: 40, settledBy: 0, zone: false },
      { region: KRAKOW, base: 30, settledBy: 0, zone: false },
    ],
    mine: [
      {
        id: ID("DEU"),
        submitted: null,
        ai: [aiTake(WARSAW, 0), aiTake(KRAKOW, 1)],
      },
    ],
    lastRound: [],
    releasable: [],
    claims: [],
    conquer: [],
    topple: [],
    reserved: [],
  };
}

async function mount(me: CountryTag, o: PolOptions = {}) {
  const { game: base } = fakePolGame({ me, ticks: TICKS, ...o });
  const eg = new WwEndgameView();
  eg.apply({ news: [], conference: conference() });
  const game = { ...base, wwEndgame: () => eg };
  const bus = new EventBus();
  const sent: unknown[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const column = document.createElement("div");
  document.body.appendChild(column);
  const el = document.createElement("ww-peace-card") as WwPeaceCard;
  el.game = game as never;
  el.eventBus = bus;
  column.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const layer = el.cardLayer()!;
  const q = <T extends HTMLElement = HTMLElement>(s: string) =>
    layer.querySelector<T>(s);
  const redraw = async () => {
    el.requestUpdate();
    await el.updateComplete;
  };
  return { el, game, bus, sent, layer, q, redraw };
}

describe("<ww-peace-card> (P5 spec §20.1)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("the card shows round, timer and AI fallback", async () => {
    const m = await mount("DEU");
    expect(m.q("[data-ww-peace-card='card']")).not.toBeNull();
    expect(m.q("[data-ww-peace-round]")!.textContent!.trim()).toBe(
      `[ww1936.peace.round] n=1,max=${WW_PEACE_MAX_ROUNDS}`,
    );
    // The deadline in ticks: 150 of 300 left.
    expect(m.q("[data-ww-peace-seconds]")!.textContent!.trim()).toBe(
      "[ww1936.peace.time_left] s=15",
    );
    expect(m.q("[data-ww-peace-time]")!.style.width).toBe("50%");
    // Paused: the ticks stand still, so does the timer.
    m.el.tick();
    await m.redraw();
    expect(m.q("[data-ww-peace-seconds]")!.textContent!.trim()).toBe(
      "[ww1936.peace.time_left] s=15",
    );
    // The card's layer is above the drawers, like the event cards.
    expect(m.layer.className).toContain("z-[1003]");
    // The AI's demands that go in when time runs out.
    const ai = m.q<HTMLButtonElement>("[data-ww-peace-btn='ai']")!;
    expect(ai.textContent!.trim()).toBe("[ww1936.peace.ai_default] n=2");
    expect(m.q("[data-ww-peace-empty]")).not.toBeNull();
    ai.click();
    await m.redraw();
    expect(
      m.layer.querySelectorAll("[data-ww-peace-ai-list] > span"),
    ).toHaveLength(2);
    m.q<HTMLButtonElement>("[data-ww-peace-btn='ai-fill']")!.click();
    await m.redraw();
    expect(peaceUiOf(m.game).draft).toEqual([
      { kind: "take", region: WARSAW },
      { kind: "take", region: KRAKOW },
    ]);
    expect(m.layer.querySelectorAll("[data-ww-peace-row]")).toHaveLength(2);
    // The points line subtracts the draft's prices.
    expect(m.q("[data-ww-peace-score]")!.textContent!.trim()).toMatch(
      /^\[ww1936\.peace\.score\] score=100,left=\d+$/,
    );
    expect(m.q("[data-ww-peace-score]")!.textContent).not.toContain("left=100");
    // My place in the snake order.
    expect(m.q("[data-ww-peace-turn]")!.textContent!.trim()).toBe(
      "[ww1936.peace.turn] n=1",
    );
  });

  it("confirm needs a second tap within three seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = await mount("DEU");
    const confirm = () =>
      m.q<HTMLButtonElement>("[data-ww-peace-btn='confirm']")!;
    // Nothing to confirm yet.
    expect(confirm().disabled).toBe(true);
    peaceUiOf(m.game).add({ kind: "take", region: WARSAW });
    await m.redraw();
    confirm().click();
    await m.redraw();
    expect(m.sent).toEqual([]);
    expect(confirm().dataset.armed).toBe("true");
    expect(confirm().textContent!.trim()).toBe("[ww1936.eventui.confirm]");
    // Too late: the second tap only arms it again.
    vi.setSystemTime(10_000 + TWO_TAP_MS + 100);
    confirm().click();
    await m.redraw();
    expect(m.sent).toEqual([]);
    expect(confirm().dataset.armed).toBe("true");
    vi.setSystemTime(10_000 + TWO_TAP_MS + 700);
    confirm().click();
    await m.redraw();
    expect(m.sent).toEqual([
      {
        kind: "peace_submit",
        conf: 3,
        demands: [{ kind: "take", region: WARSAW }],
      },
    ]);
    expect(m.q("[data-ww-peace-confirmed]")!.textContent!.trim()).toBe(
      "[ww1936.peace.confirmed]",
    );
    // It can still be changed: a new demand makes it confirmable again.
    peaceUiOf(m.game).add({ kind: "take", region: KRAKOW });
    await m.redraw();
    expect(m.q("[data-ww-peace-confirmed]")).toBeNull();
    expect(confirm().disabled).toBe(false);
    // Passing the round also needs two taps.
    const pass = () => m.q<HTMLButtonElement>("[data-ww-peace-btn='pass']")!;
    pass().click();
    expect(m.sent).toHaveLength(1);
    vi.setSystemTime(10_000 + TWO_TAP_MS + 1_400);
    pass().click();
    expect(m.sent[m.sent.length - 1]).toEqual({ kind: "peace_pass", conf: 3 });
  });

  it("a loser sees only the waiting band", async () => {
    const m = await mount("POL");
    const band = m.q("[data-ww-peace-card='band']")!;
    expect(band).not.toBeNull();
    expect(m.q("[data-ww-peace-waiting]")!.textContent!.trim()).toBe(
      "[ww1936.peace.waiting]",
    );
    expect(band.textContent).toContain("[ww1936.peace.title]");
    // No demands, no buttons, no points.
    expect(m.layer.querySelectorAll("button")).toHaveLength(0);
    expect(m.q("[data-ww-peace-score]")).toBeNull();
    // A country outside the conference sees nothing.
    document.body.innerHTML = "";
    const other = await mount("GBR");
    expect(other.layer.childElementCount).toBe(0);
    expect(other.el.querySelector("[data-ww-peace-slot]")).toBeNull();
  });
  it("a pass after a draft is acknowledged and can't be sent again", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = await mount("DEU");
    peaceUiOf(m.game).add({ kind: "take", region: WARSAW });
    await m.redraw();
    const pass = () => m.q<HTMLButtonElement>("[data-ww-peace-btn='pass']")!;
    pass().click();
    await m.redraw();
    vi.setSystemTime(10_600);
    pass().click();
    await m.redraw();
    expect(m.sent).toEqual([{ kind: "peace_pass", conf: 3 }]);
    // No demands this round: the draft empties, "Confirmed" shows, and
    // neither Pass nor Confirm can be sent again.
    expect(peaceUiOf(m.game).draft).toEqual([]);
    expect(m.q("[data-ww-peace-confirmed]")!.textContent!.trim()).toBe(
      "[ww1936.peace.confirmed]",
    );
    expect(pass().disabled).toBe(true);
    expect(
      m.q<HTMLButtonElement>("[data-ww-peace-btn='confirm']")!.disabled,
    ).toBe(true);
    // A reload sees the engine's pass (an empty submission) the same way.
    const ui = peaceUiOf({});
    ui.sync(3, 1, []);
    expect(ui.sent).toBe("pass");
  });

  it("under the peace card one event card shows, and +N", async () => {
    const pending = [card({ uid: 1 }), card({ uid: 2 }), card({ uid: 3 })];
    const m = await mount("DEU", {
      polSummaries: [polSummary("DEU")],
      polDetails: [polDetail("DEU", { pending })],
    });
    const el = document.createElement("ww-event-cards") as WwEventCards;
    el.game = m.game as never;
    el.eventBus = m.bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const layer = el.cardLayer()!;
    expect(layer.querySelectorAll("[data-ww-event]")).toHaveLength(1);
    expect(
      layer.querySelector("[data-ww-event-more]")!.textContent!.trim(),
    ).toBe("[ww1936.eventui.more] n=2");
  });
});
