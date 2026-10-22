// World War 1936 P3 (spec §12, plan decisions 13, 26; Task 3): events —
// human cards, the AI's choice, chains, delays, MTTH and dated events — on
// the test map ww1936pol with the test content and this file's events.
// Effects are marked with unlock_decision (the event group's own effect),
// so the results do not depend on the other lanes' groups.
import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dateOfDay, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  aiChooseOption,
  checkTriggeredEvents,
} from "@openfront/engine/ww1936/politics/Events";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  order,
  pol,
  POL,
  step,
  stepTo,
  takeRegion,
  wwRunner,
  wwRunnerCapture,
} from "./util";

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const iso = (day: number) => {
  const d = dateOfDay(day);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${p(d.month)}-${p(d.day)}`;
};
const mark = (id: string): Effect => ({ kind: "unlock_decision", id });
const news = (id: string): Effect => ({ kind: "news", id });
const fire = (id: string): Effect => ({ kind: "fire_event", id });
const two = (
  extra: Partial<EventDef> & { id: string },
  aHistory = true,
): EventDef => ({
  kind: "country",
  options: [
    {
      id: "a",
      history: aHistory,
      ai: { base: 10 },
      effects: [mark(`${extra.id}_a`)],
    },
    { id: "b", ai: { base: 10 }, effects: [mark(`${extra.id}_b`)] },
  ],
  ...extra,
});

const TEST_EVENTS: EventDef[] = [
  two({ id: "t_card" }),
  two({ id: "t_card2" }),
  two({ id: "t_card_long", timeoutSec: 30 }),
  {
    id: "t_annex",
    kind: "country",
    humanDefault: "b",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 100 },
        effects: [mark("t_annexed")],
      },
      { id: "b", ai: { base: 0 }, effects: [mark("t_refused")] },
    ],
  },
  {
    id: "t_repeat",
    kind: "country",
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_rep")] }],
  },
  two({ id: "t_hist95", historyPct: 95 }),
  {
    id: "t_weights",
    kind: "country",
    options: [
      { id: "a", history: true, ai: { base: 30 }, effects: [] },
      {
        id: "b",
        ai: {
          base: 70,
          mods: [{ if: { kind: "tag", tag: "LTU" }, factor: 0 }],
        },
        effects: [],
      },
    ],
  },
  {
    id: "t_zero",
    kind: "country",
    options: [
      {
        id: "a",
        ai: { base: 10 },
        available: { kind: "always", value: false },
        effects: [],
      },
      { id: "b", ai: { base: 0 }, effects: [] },
      { id: "c", ai: { base: 0 }, effects: [] },
    ],
  },
  {
    id: "t_fifo",
    kind: "country",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [fire("t_fifo_x"), fire("t_fifo_y")],
      },
    ],
  },
  {
    id: "t_fifo_x",
    kind: "country",
    options: [
      { id: "a", ai: { base: 1 }, effects: [news("n_x"), fire("t_fifo_z")] },
    ],
  },
  {
    id: "t_fifo_y",
    kind: "country",
    options: [{ id: "a", ai: { base: 1 }, effects: [news("n_y")] }],
  },
  {
    id: "t_fifo_z",
    kind: "country",
    options: [{ id: "a", ai: { base: 1 }, effects: [news("n_z")] }],
  },
  {
    id: "t_chain_n",
    kind: "country",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [news("n_chain"), fire("t_chain_n")],
      },
    ],
  },
  {
    id: "t_delay",
    kind: "country",
    aiDelayDays: [3, 3],
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_delayed")] }],
  },
  {
    id: "t_delay_range",
    kind: "country",
    aiDelayDays: [2, 4],
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    id: "t_mtth",
    kind: "country",
    receivers: ["EST"],
    trigger: { kind: "always", value: true },
    mtthDays: 60,
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    id: "t_date",
    kind: "country",
    date: { on: iso(3), to: ["POL", "ITA", "FRA"] },
    options: [{ id: "a", ai: { base: 1 }, effects: [news("n_date")] }],
  },
  {
    id: "t_date_false",
    kind: "country",
    date: { on: iso(3), to: ["EST"] },
    trigger: { kind: "gflag", flag: "t_go" },
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_date_fired")] }],
  },
  {
    // Controller ruling R21: never checked as a triggered event (the data
    // forbids date + receivers; the engine does not rely on it).
    id: "t_date_rcv",
    kind: "country",
    receivers: ["LTU"],
    date: { on: iso(400), to: ["LTU"] },
    trigger: { kind: "always", value: true },
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_rcv_fired")] }],
  },
  {
    id: "t_once_c",
    kind: "country",
    options: [{ id: "a", ai: { base: 1 }, effects: [news("n_once_c")] }],
  },
  {
    id: "t_once_g",
    kind: "country",
    once: "game",
    options: [{ id: "a", ai: { base: 1 }, effects: [news("n_once_g")] }],
  },
];

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({ events: [...politicsFixture().events, ...TEST_EVENTS] }),
  ),
);
afterEach(() => usePoliticsContent(null));

/** Politics' roll seed (a test sets it to sample many games without making them). */
function setSeed(p: WwPolitics, seed: number): void {
  (p as unknown as { _seed: number })._seed = seed;
}

function fireNow(
  p: WwPolitics,
  ticks: number,
  id: string,
  to: number,
  from = to,
  target = 0,
): void {
  p.queueEvent(id, to, from, target, 0);
  p.flushEvents(ticks);
}

const politicsNews = (updates: GameUpdateViewData[]) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.WwPolitics] ?? [])
    .flatMap((u) => u.data.news);

const messages = (updates: GameUpdateViewData[], key: string) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
    .filter((m) => m.message === `events_display.${key}`);

describe("human event cards", () => {
  it("a human event card applies the shown AI option at its deadline", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const deu = byTag(g, "DEU").smallID();
    const c = p.country(deu)!;
    const t0 = g.ticks();
    fireNow(p, t0, "gen_t_choice", deu);
    fireNow(p, t0, "t_card", deu);
    expect(c.pending.map((x) => x.eventId)).toEqual(["gen_t_choice", "t_card"]);
    const day = g.worldWar()!.day(t0);
    for (const [i, id] of ["gen_t_choice", "t_card"].entries()) {
      const card = c.pending[i];
      expect(card.firedTick).toBe(t0);
      expect(card.deadlineTick).toBe(t0 + 200);
      expect(card.aiOption).toBe(aiChooseOption(p, id, deu, deu, 0, day));
    }
    const shown = c.pending[1].aiOption;
    // The screens get both cards with their open options.
    step(runner);
    const cards = updates
      .flatMap((u) => u.updates[GameUpdateType.WwPolitics] ?? [])
      .flatMap((u) => u.data.cards);
    expect(cards.map((x) => [x.to, x.eventId, x.open])).toEqual([
      [deu, "gen_t_choice", ["a", "b"]],
      [deu, "t_card", ["a", "b"]],
    ]);
    // Up to the deadline tick nothing happens.
    stepTo(runner, t0 + 201);
    expect(c.pending).toHaveLength(2);
    expect(c.unlocked.size).toBe(0);
    expect(messages(updates, "ww1936_event_auto_chosen")).toEqual([]);
    // Tick deadline + 1: the shown option applies.
    step(runner);
    expect(c.pending).toEqual([]);
    expect([...c.unlocked]).toEqual([`t_card_${shown}`]);
    expect(
      messages(updates, "ww1936_event_auto_chosen").map((m) => m.params),
    ).toEqual([
      { event: "gen_t_choice", option: expect.any(String) },
      { event: "t_card", option: shown },
    ]);
  });

  it("a human choice before the deadline wins", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const deu = byTag(g, "DEU").smallID();
    const c = p.country(deu)!;
    fireNow(p, g.ticks(), "t_card", deu);
    fireNow(p, g.ticks(), "t_card2", deu);
    const [card, late] = c.pending;
    const other = card.aiOption === "a" ? "b" : "a";
    const lateOther = late.aiOption === "a" ? "b" : "a";
    // A closed or unknown pick is refused and changes nothing.
    expect(
      p.issue(
        deu,
        { kind: "event_choose", uid: card.uid + 99, option: "a" },
        g.ticks(),
      ),
    ).toBe("no_event");
    expect(
      p.issue(
        deu,
        { kind: "event_choose", uid: card.uid, option: "c" },
        g.ticks(),
      ),
    ).toBe("bad_option");
    expect(c.pending).toHaveLength(2);
    // The order runs on the deadline tick itself: it still wins.
    stepTo(runner, card.deadlineTick);
    step(runner, 1, [
      order(HUMAN, { kind: "event_choose", uid: card.uid, option: other }),
    ]);
    expect(c.pending).toEqual([late]);
    // One tick later the deadline has passed: the shown option applied first.
    step(runner, 1, [
      order(HUMAN, { kind: "event_choose", uid: late.uid, option: lateOther }),
    ]);
    expect(c.pending).toEqual([]);
    step(runner, 5);
    expect([...c.unlocked]).toEqual([
      `t_card_${other}`,
      `t_card2_${late.aiOption}`,
    ]);
    expect(
      messages(updates, "ww1936_event_auto_chosen").map((m) => m.params),
    ).toEqual([{ event: "t_card2", option: late.aiOption }]);
  });

  it("a 30-second event waits 300 ticks", async () => {
    const runner = await wwRunner({}, DEU_HUMAN, POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const deu = byTag(g, "DEU").smallID();
    const c = p.country(deu)!;
    const t0 = g.ticks();
    fireNow(p, t0, "t_card_long", deu);
    expect(c.pending[0].deadlineTick).toBe(t0 + 300);
    stepTo(runner, t0 + 301);
    expect(c.pending).toHaveLength(1);
    step(runner);
    expect(c.pending).toEqual([]);
    expect(c.unlocked.size).toBe(1);
  });

  it("humanDefault replaces the AI option on a human card", async () => {
    const runner = await wwRunner({}, DEU_HUMAN, POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const deu = byTag(g, "DEU").smallID();
    const aut = byTag(g, "AUT").smallID();
    const day = g.worldWar()!.day(g.ticks());
    expect(aiChooseOption(p, "t_annex", deu, deu, 0, day)).toBe("a");
    fireNow(p, g.ticks(), "t_annex", deu);
    expect(p.country(deu)!.pending[0].aiOption).toBe("b");
    // An AI receiver takes its own choice at once.
    fireNow(p, g.ticks(), "t_annex", aut, deu);
    expect([...p.country(aut)!.unlocked]).toEqual(["t_annexed"]);
    // The human's card times out to refusing.
    stepTo(runner, p.country(deu)!.pending[0].deadlineTick + 2);
    expect([...p.country(deu)!.unlocked]).toEqual(["t_refused"]);
  });

  it("a ninth card resolves the oldest", async () => {
    const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const deu = byTag(g, "DEU").smallID();
    const c = p.country(deu)!;
    for (let i = 0; i < 8; i++) fireNow(p, g.ticks(), "t_repeat", deu);
    const uids = c.pending.map((x) => x.uid);
    expect(uids).toHaveLength(8);
    expect(c.unlocked.size).toBe(0);
    step(runner);
    // The message goes out inside a tick: fire the ninth from an order's tick.
    p.queueEvent("t_repeat", deu, deu, 0, 0);
    step(runner);
    expect(c.pending.map((x) => x.uid).slice(0, 7)).toEqual(uids.slice(1));
    expect(c.pending).toHaveLength(8);
    expect([...c.unlocked]).toEqual(["t_rep"]);
    expect(
      messages(updates, "ww1936_event_auto_chosen").map((m) => m.params),
    ).toEqual([{ event: "t_repeat", option: "a" }]);
  });

  it("cards vanish when the country capitulates", async () => {
    // The German victor is played too (P5 lane W): with an AI one, the peace
    // conference ends in one tick and its treaty may revive Poland at once.
    const runner = await wwRunner(
      {},
      [
        { clientID: HUMAN, country: "POL" },
        { clientID: "HUMANDEU", country: "DEU" },
      ],
      POL,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const g = runner.game;
    const ww = g.worldWar()!;
    const p = pol(g);
    const [deu, pl] = [byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()];
    const c = p.country(pl)!;
    fireNow(p, g.ticks(), "t_card", pl);
    fireNow(p, g.ticks(), "t_repeat", pl);
    expect(c.pending).toHaveLength(2);
    const deadline = c.pending[0].deadlineTick;
    ww.setWar(deu, pl, g.ticks());
    takeRegion(g, 6, "DEU");
    ww.setCapitulationGauge(pl, WW_CAPITULATION_DAYS - 1);
    stepTo(runner, dayStart(ww.day(g.ticks()) + 1) + 1);
    expect(ww.isCapitulated(pl)).toBe(true);
    expect(c.pending).toEqual([]);
    stepTo(runner, deadline + 5);
    expect(c.unlocked.size).toBe(0);
  });
});

describe("the AI's choice", () => {
  it("an AI country picks the history option 90% of the time across seeds", async () => {
    const runner = await wwRunner({}, [], POL);
    step(runner);
    const p = pol(runner.game);
    // 200 seeds, each country of the map a receiver: 2,000 choices.
    const ids = p.list().map((c) => c.smallID);
    const histPct = (id: string) => {
      let n = 0;
      for (let s = 1; s <= 200; s++) {
        setSeed(p, s);
        for (const to of ids) {
          if (aiChooseOption(p, id, to, to, 0, 40) === "a") n++;
        }
      }
      return (n * 100) / (200 * ids.length);
    };
    const h90 = histPct("t_card");
    expect(h90).toBeGreaterThanOrEqual(86);
    expect(h90).toBeLessThanOrEqual(94);
    const h95 = histPct("t_hist95");
    expect(h95).toBeGreaterThanOrEqual(91);
    expect(h95).toBeLessThanOrEqual(99);
  });

  it("with historical AI off the AI picks by weight", async () => {
    const runner = await wwRunner({ historicalAi: false }, [], POL);
    step(runner);
    const p = pol(runner.game);
    const [est, ltu] = [
      byTag(runner.game, "EST").smallID(),
      byTag(runner.game, "LTU").smallID(),
    ];
    const share = (to: number) => {
      let n = 0;
      for (let s = 1; s <= 200; s++) {
        setSeed(p, s);
        if (aiChooseOption(p, "t_weights", to, to, 0, 40) === "a") n++;
      }
      return n;
    };
    // a 30 : b 70, the history flag ignored (22.5–37.5% of 200).
    const a = share(est);
    expect(a).toBeGreaterThanOrEqual(45);
    expect(a).toBeLessThanOrEqual(75);
    // Lithuania's mod sets b's weight to 0.
    expect(share(ltu)).toBe(200);
  });

  it("all-zero weights pick the first open option", async () => {
    for (const historicalAi of [true, false]) {
      const runner = await wwRunner({ historicalAi }, [], POL);
      step(runner);
      const p = pol(runner.game);
      const est = byTag(runner.game, "EST").smallID();
      for (let s = 1; s <= 20; s++) {
        setSeed(p, s);
        expect(aiChooseOption(p, "t_zero", est, est, 0, 40)).toBe("b");
      }
    }
  });
});

describe("the event queue", () => {
  it("event chains run in FIFO order and stop at depth 16", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [], POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const est = byTag(g, "EST").smallID();
    const day = g.worldWar()!.day(g.ticks());
    // FIFO: x and y are queued by the first event; z by x, after y.
    p.queueEvent("t_fifo", est, est, 0, 0);
    // A chain: 17 deliveries (depth 0..16) in the tick, the 18th tomorrow.
    p.queueEvent("t_chain_n", est, est, 0, 0);
    p.queueEvent("gen_t_chain", est, est, 0, 0);
    step(runner);
    expect(p.queuedEvents()).toBe(0);
    const ids = politicsNews(updates).map((n) => n.id);
    expect(ids.filter((x) => x !== "n_chain").slice(0, 3)).toEqual([
      "n_x",
      "n_y",
      "n_z",
    ]);
    expect(ids.filter((x) => x === "n_chain")).toHaveLength(17);
    expect(p.delayed.map((d) => [d.day, d.kind, d.eventId, d.to])).toEqual([
      [day + 1, "fire", "t_chain_n", est],
      [day + 1, "fire", "gen_t_chain", est],
    ]);
    // The next day's common step runs both chains on, as far again.
    const before = ids.length;
    stepTo(runner, dayStart(day + 1) + 1);
    expect(p.queuedEvents()).toBe(0);
    const next = politicsNews(updates).slice(before);
    expect(next.filter((n) => n.id === "n_chain")).toHaveLength(17);
    expect(p.delayed.map((d) => [d.day, d.eventId])).toEqual([
      [day + 2, "t_chain_n"],
      [day + 2, "gen_t_chain"],
    ]);
  });

  it("an effect that declares war mid-flush keeps the queue in order", async () => {
    // A war declared by an option runs onWarDeclared, which flushes the same
    // queue (Events.ts header): what was queued before still comes in queue
    // order, the option's later effects after it, the same in every run.
    usePoliticsContent(
      politicsFixture({
        events: [
          ...politicsFixture().events,
          ...TEST_EVENTS,
          {
            id: "t_war_mid",
            kind: "country",
            options: [
              {
                id: "a",
                ai: { base: 1 },
                effects: [
                  fire("t_fifo_y"),
                  { kind: "declare_war", on: { tag: "LTU" } },
                  fire("t_after"),
                ],
              },
            ],
          },
          {
            id: "t_after",
            kind: "country",
            options: [{ id: "a", ai: { base: 1 }, effects: [news("n_after")] }],
          },
        ],
      }),
    );
    const run = async () => {
      const { runner, updates } = await wwRunnerCapture({}, [], POL);
      stepTo(runner, WW_PREP_TICKS + 5);
      const g = runner.game;
      const p = pol(g);
      const est = byTag(g, "EST").smallID();
      p.queueEvent("t_war_mid", est, est, 0, 0);
      p.queueEvent("t_fifo_x", est, est, 0, 0);
      step(runner);
      expect(p.queuedEvents()).toBe(0);
      return politicsNews(updates).map((n) => n.id);
    };
    const ids = await run();
    // x was queued before y, and z (queued by x) after y; n_after comes
    // after y (pure FIFO) or after z (when the declaration flushed first).
    expect(ids.filter((x) => x !== "n_after")).toEqual(["n_x", "n_y", "n_z"]);
    expect(ids.filter((x) => x === "n_after")).toHaveLength(1);
    expect(ids.indexOf("n_after")).toBeGreaterThan(ids.indexOf("n_y"));
    expect(await run()).toEqual(ids);
  });

  it("aiDelayDays delays an AI choice through the delay list", async () => {
    const runner = await wwRunner({}, [], POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const est = byTag(g, "EST").smallID();
    const day = g.worldWar()!.day(g.ticks());
    fireNow(p, g.ticks(), "t_delay", est);
    expect(p.delayed).toEqual([
      expect.objectContaining({
        day: day + 3,
        kind: "choose",
        eventId: "t_delay",
        to: est,
        option: "a",
      }),
    ]);
    const c = p.country(est)!;
    stepTo(runner, dayStart(day + 3));
    expect(c.unlocked.size).toBe(0);
    step(runner);
    expect([...c.unlocked]).toEqual(["t_delayed"]);
    expect(p.delayed).toEqual([]);
    // A range: the seeded day falls inside it, and both ends occur.
    const seen = new Set<number>();
    for (let s = 1; s <= 60; s++) {
      setSeed(p, s);
      fireNow(p, g.ticks(), "t_delay_range", est);
      const d = p.delayed.pop()!;
      seen.add(d.day - (day + 3));
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it("a mean-time-to-happen event fires about every N days", async () => {
    const runner = await wwRunner({}, [], POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const est = byTag(g, "EST").smallID();
    let firstSum = 0;
    let gaps = 0;
    let gapSum = 0;
    for (let s = 1; s <= 100; s++) {
      setSeed(p, s);
      let last = -1;
      for (let day = 0; day < 3000; day++) {
        if ((day + est) % 5 !== 0) continue;
        checkTriggeredEvents(p, est, day, g.ticks());
        if (p.queuedEvents() === 0) continue;
        p.flushEvents(g.ticks());
        if (last < 0) firstSum += day;
        else {
          gaps++;
          gapSum += day - last;
        }
        last = day;
      }
    }
    // MTTH 60: a 5/60 chance at each 5-day check.
    expect(firstSum / 100).toBeGreaterThanOrEqual(50);
    expect(firstSum / 100).toBeLessThanOrEqual(70);
    expect(gapSum / gaps).toBeGreaterThanOrEqual(55);
    expect(gapSum / gaps).toBeLessThanOrEqual(65);
  });
});

describe("dated and once events", () => {
  it("a date event fires on its day for every listed tag in tag order", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [], POL);
    const g = runner.game;
    stepTo(runner, dayStart(3));
    expect(politicsNews(updates).filter((n) => n.id === "n_date")).toEqual([]);
    step(runner);
    // The receivers in smallID order (Task 1 deviation 5): ITA 2, FRA 4, POL 6.
    expect(
      politicsNews(updates)
        .filter((n) => n.id === "n_date")
        .map((n) => n.params.countryTag),
    ).toEqual(["ITA", "FRA", "POL"]);
    stepTo(runner, dayStart(6));
    expect(politicsNews(updates).filter((n) => n.id === "n_date")).toHaveLength(
      3,
    );
    expect(pol(g).country(byTag(g, "POL").smallID())!.firedOnce).toContain(
      "t_date",
    );
  });

  it("a date event with a false trigger is dropped that day", async () => {
    const runner = await wwRunner({}, [], POL);
    const g = runner.game;
    const p = pol(g);
    const c = p.country(byTag(g, "EST").smallID())!;
    stepTo(runner, dayStart(4));
    expect(c.unlocked.size).toBe(0);
    expect(c.firedOnce.has("t_date_false")).toBe(false);
    // True from now on: never checked again.
    p.gflags.set("t_go", 4);
    stepTo(runner, dayStart(20));
    expect(c.unlocked.size).toBe(0);
  });

  it("a dated event is not checked as a triggered one", async () => {
    const runner = await wwRunner({}, [], POL);
    stepTo(runner, dayStart(30));
    const g = runner.game;
    const c = pol(g).country(byTag(g, "LTU").smallID())!;
    expect(c.unlocked.has("t_rcv_fired")).toBe(false);
  });

  it("once events fire once per country / per game", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [], POL);
    stepTo(runner, WW_PREP_TICKS + 5);
    const g = runner.game;
    const p = pol(g);
    const [est, ltu] = [byTag(g, "EST").smallID(), byTag(g, "LTU").smallID()];
    for (const to of [est, est, ltu, ltu]) {
      p.queueEvent("t_once_c", to, to, 0, 0);
      p.queueEvent("t_once_g", to, to, 0, 0);
    }
    step(runner);
    p.queueEvent("t_once_c", est, est, 0, 0);
    p.queueEvent("t_once_g", ltu, ltu, 0, 0);
    step(runner);
    const got = politicsNews(updates).map((n) => [n.id, n.params.countryTag]);
    expect(got).toEqual([
      ["n_once_c", "EST"],
      ["n_once_g", "EST"],
      ["n_once_c", "LTU"],
    ]);
    expect(p.firedOnceGlobal.has("t_once_g")).toBe(true);
  });
});
