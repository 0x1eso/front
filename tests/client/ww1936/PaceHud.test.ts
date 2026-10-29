// World War 1936, the unlimited game (engine-lib/ww1936/Pace.ts): a tick
// lasts 400 ms, and the human windows are a quarter of the ticks (the same
// real seconds). The screens count their seconds with Config.msPerTick and
// take each card's total from wwRealTicks; at 100 ms they read as before.
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params && Object.keys(params).length > 0
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type {
  WwConferenceView,
  WwTakeoverView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import {
  eventCardModel,
  politicsInput,
  type PolGame,
} from "../../../src/client/hud/ww1936/PoliticsModel";
import {
  prepSecondsLeft,
  TWO_TAP_MIN_MS,
  type WwGame,
} from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwEventCards";
import type { WwEventCards } from "../../../src/client/hud/ww1936/WwEventCards";
import "../../../src/client/hud/ww1936/WwPeaceCard";
import {
  peaceTimeLeft,
  type WwPeaceCard,
} from "../../../src/client/hud/ww1936/WwPeaceCard";
import "../../../src/client/hud/ww1936/WwTakeoverCard";
import {
  takeoverCardModel,
  type TakeoverGame,
  type WwTakeoverCard,
} from "../../../src/client/hud/ww1936/WwTakeoverCard";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { makeGameView, stubConfig } from "../../util/viewStubs";
import { testGameConfig } from "../../util/Wire";
import { fakeEconGame, ID } from "./EconomyFixture";
import { card, fakePolGame, polDetail, polSummary } from "./PoliticsFixture";

/** The unlimited game: 400 ms ticks. */
const SLOW = new Config(
  testGameConfig({ worldWar1936: true, ww1936Unlimited: true }),
  false,
);
/** The timed game: 100 ms ticks, as every game before. */
const TIMED = new Config(testGameConfig({ worldWar1936: true }), false);

/** A game reading only the tick, the preparation's end and the config. */
function prepGame(
  config: Config,
  ticks: number,
  prepEndTick: number | null,
): WwGame {
  return {
    ticks: () => ticks,
    worldWarData: () => (prepEndTick === null ? null : { prepEndTick }),
    config: () => config,
  } as unknown as WwGame;
}

/** My takeover card (Germany's controller picks Italy or Britain). */
function takeover(deadlineTick: number): WwTakeoverView {
  return {
    client: "c1",
    from: ID("DEU"),
    candidates: [ID("ITA"), ID("GBR")],
    deadlineTick,
  };
}

function takeoverGame(
  config: Config,
  ticks: number,
  deadlineTick: number,
): TakeoverGame {
  const eg = new WwEndgameView();
  eg.apply({ news: [], takeover: [takeover(deadlineTick)] });
  return {
    ...fakeEconGame({ ticks }).game,
    myClientID: () => "c1",
    wwEndgame: () => eg,
    config: () => config,
  } as unknown as TakeoverGame;
}

/** Germany and Italy against Poland, round 1, ending at `roundEndTick`. */
function conference(roundEndTick: number): WwConferenceView {
  return {
    id: 3,
    losers: [ID("POL")],
    status: "open",
    round: 1,
    roundEndTick,
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
    stake: [{ region: 6, base: 40, settledBy: 0, zone: false }],
    mine: [{ id: ID("DEU"), submitted: null, ai: [] }],
    lastRound: [],
    releasable: [],
    claims: [],
    conquer: [],
    topple: [],
    reserved: [],
    settled: [],
    mainVictor: ID("DEU"),
  };
}

/** Mounts a HUD card the way the HUD does (game, bus, column, init, tick). */
async function mountCard<
  T extends HTMLElement & {
    game: unknown;
    eventBus: EventBus;
    init(): void;
    tick(): void;
    updateComplete: Promise<boolean>;
    cardLayer(): HTMLElement | null;
  },
>(tag: string, game: unknown) {
  const bus = new EventBus();
  const sent: unknown[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const column = document.createElement("div");
  document.body.appendChild(column);
  const el = document.createElement(tag) as T;
  el.game = game;
  el.eventBus = bus;
  column.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const layer = el.cardLayer()!;
  const text = (s: string) => layer.querySelector(s)?.textContent?.trim();
  /** The game moves to `ticks`, and the HUD's next tick runs. */
  const at = async (ticks: number) => {
    (game as { ticks: () => number }).ticks = () => ticks;
    el.tick();
    await el.updateComplete;
  };
  return { el, sent, layer, text, at };
}

describe("the countdowns at the game's tick length", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("the preparation minute counts real seconds", () => {
    // 50 ticks of 400 ms: 20 s; of 100 ms: 5 s.
    expect(prepSecondsLeft(prepGame(SLOW, 100, 150))).toBe(20);
    expect(prepSecondsLeft(prepGame(TIMED, 550, 600))).toBe(5);
    // Before the engine's data arrives the preparation ends where the
    // engine ends it: wwRealTicks(600), 150 ticks in the unlimited game.
    expect(prepSecondsLeft(prepGame(SLOW, 100, null))).toBe(20);
    expect(prepSecondsLeft(prepGame(TIMED, 550, null))).toBe(5);
  });

  it("an event card counts real seconds", () => {
    const at = (config: Config) => {
      const { game } = fakePolGame({ ticks: 125 });
      const i = politicsInput({
        ...game,
        config: () => config,
      } as unknown as PolGame)!;
      return eventCardModel(i, card({ firedTick: 75, deadlineTick: 150 }))!;
    };
    // 25 ticks left of 75.
    expect(at(SLOW)).toMatchObject({
      secondsLeft: 10,
      seconds: "[ww1936.eventui.seconds] s=10",
    });
    expect(at(SLOW).fraction).toBeCloseTo(1 / 3);
    expect(at(TIMED)).toMatchObject({
      secondsLeft: 3,
      seconds: "[ww1936.eventui.seconds] s=3",
    });
  });

  it("a peace round's bar is full at a quarter of the ticks", () => {
    // 75 ticks: the whole unlimited round (wwRealTicks(300)), 30 s.
    const slow = { config: () => SLOW };
    expect(peaceTimeLeft(slow, 75)).toEqual({ fraction: 1, seconds: 30 });
    // At 100 ms the same 75 ticks are a quarter of the round, 8 s.
    const timed = { config: () => TIMED };
    expect(peaceTimeLeft(timed, 75)).toEqual({ fraction: 0.25, seconds: 8 });
    expect(peaceTimeLeft(timed, 300)).toEqual({ fraction: 1, seconds: 30 });
  });

  it("the takeover card's bar is full at a quarter of the ticks", () => {
    const slow = takeoverCardModel(takeoverGame(SLOW, 700, 775))!;
    expect(slow.fraction).toBe(1);
    expect(slow.secondsLeft).toBe(30);
    const timed = takeoverCardModel(takeoverGame(TIMED, 700, 775))!;
    expect(timed.fraction).toBe(0.25);
    expect(timed.secondsLeft).toBe(8);
  });

  it("the game clock counts real seconds", () => {
    const at = (msPerTick: number) => {
      const view = makeGameView({
        config: stubConfig({ msPerTick: () => msPerTick }),
      });
      vi.spyOn(view, "ticksSinceStart").mockReturnValue(50);
      return view.elapsedGameSeconds();
    };
    expect(at(400)).toBe(20);
    expect(at(100)).toBe(5);
  });
});

// The cards re-render when their second changes. At 400 ms a second is
// 2.5 ticks: 7 ticks inside one 10-tick block are three seconds.
describe("the cards redraw each second at 400 ms", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("the takeover card", async () => {
    const m = await mountCard<WwTakeoverCard>(
      "ww-takeover-card",
      takeoverGame(SLOW, 691, 775),
    );
    expect(m.layer.textContent).toContain("[ww1936.takeover.time] s=34");
    await m.at(698);
    expect(m.layer.textContent).toContain("[ww1936.takeover.time] s=31");
  });

  it("the peace card", async () => {
    const { game } = fakePolGame({ me: "DEU", ticks: 701 });
    const eg = new WwEndgameView();
    eg.apply({ news: [], conference: conference(775) });
    const m = await mountCard<WwPeaceCard>("ww-peace-card", {
      ...game,
      wwEndgame: () => eg,
      config: () => SLOW,
    });
    expect(m.text("[data-ww-peace-seconds]")).toBe(
      "[ww1936.peace.time_left] s=30",
    );
    expect(
      m.layer.querySelector<HTMLElement>("[data-ww-peace-time]")!.style.width,
    ).toBe("99%");
    await m.at(708);
    expect(m.text("[data-ww-peace-seconds]")).toBe(
      "[ww1936.peace.time_left] s=27",
    );
  });

  it("an event card", async () => {
    const pending = [card({ uid: 1, firedTick: 650, deadlineTick: 775 })];
    const { game } = fakePolGame({
      me: "DEU",
      ticks: 691,
      polSummaries: [polSummary("DEU")],
      polDetails: [polDetail("DEU", { pending })],
    });
    const m = await mountCard<WwEventCards>("ww-event-cards", {
      ...game,
      config: () => SLOW,
    });
    expect(m.text("[data-ww-event='1']")).toContain(
      "[ww1936.eventui.seconds] s=34",
    );
    await m.at(698);
    expect(m.text("[data-ww-event='1']")).toContain(
      "[ww1936.eventui.seconds] s=31",
    );
  });
});

// A choice goes on the next turn; a card still there 2 s later was refused
// and its options come back. 2 s are 5 ticks at 400 ms.
describe("a refused pick comes back after 2 s at 400 ms", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  /** Two taps on `button()`, far enough apart to confirm. */
  async function twoTaps(
    button: () => HTMLElement,
    redraw: () => Promise<unknown>,
  ) {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    button().click();
    await redraw();
    now += TWO_TAP_MIN_MS + 50;
    button().click();
    await redraw();
  }

  it("an event card's options", async () => {
    const pending = [card({ uid: 9, firedTick: 650, deadlineTick: 775 })];
    const { game } = fakePolGame({
      me: "DEU",
      ticks: 700,
      polSummaries: [polSummary("DEU")],
      polDetails: [polDetail("DEU", { pending })],
    });
    const m = await mountCard<WwEventCards>("ww-event-cards", {
      ...game,
      config: () => SLOW,
    });
    const option = (id: string) =>
      m.layer.querySelector<HTMLButtonElement>(`[data-ww-option='${id}']`)!;
    await twoTaps(
      () => option("b"),
      async () => {
        m.el.requestUpdate();
        await m.el.updateComplete;
      },
    );
    expect(m.sent).toEqual([{ kind: "event_choose", uid: 9, option: "b" }]);
    expect(option("a").disabled).toBe(true);
    await m.at(704);
    expect(option("a").disabled).toBe(true);
    await m.at(705);
    expect(option("a").disabled).toBe(false);
  });

  it("the takeover card's candidates", async () => {
    const m = await mountCard<WwTakeoverCard>(
      "ww-takeover-card",
      takeoverGame(SLOW, 700, 775),
    );
    const britain = () =>
      m.layer.querySelector<HTMLButtonElement>(
        `[data-ww-candidate="${ID("GBR")}"]`,
      )!;
    const italy = () =>
      m.layer.querySelector<HTMLElement>(`[data-ww-candidate="${ID("ITA")}"]`)!;
    await twoTaps(italy, async () => {
      m.el.requestUpdate();
      await m.el.updateComplete;
    });
    expect(m.sent).toEqual([{ kind: "takeover_pick", smallID: ID("ITA") }]);
    expect(britain().disabled).toBe(true);
    await m.at(704);
    expect(britain().disabled).toBe(true);
    await m.at(705);
    expect(britain().disabled).toBe(false);
  });
});
