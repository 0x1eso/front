// World War 1936 P3 (spec §10.4 event group, §10.5; Task 3): fire_event,
// news, unlock / lock / take_decision, if, random_list and tension, on the
// test map ww1936pol with the test content.
import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  DecisionDef,
  EventDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { decisionBlock } from "@openfront/engine/ww1936/politics/Decisions";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import { byTag, pol, POL, step, stepTo, wwRunnerCapture } from "./util";

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const mark = (id: string, who?: "from" | "target"): Effect =>
  who === undefined
    ? { kind: "unlock_decision", id }
    : { kind: "unlock_decision", id, who };

const TEST_EVENTS: EventDef[] = [
  {
    // self = the receiver, from = the sender.
    id: "t_recv",
    kind: "country",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [mark("t_got"), mark("t_sent", "from")],
      },
    ],
  },
  {
    id: "t_once",
    kind: "country",
    options: [{ id: "a", ai: { base: 1 }, effects: [mark("t_once_got")] }],
  },
];
const TEST_DECISIONS: DecisionDef[] = [
  {
    id: "t_locked",
    category: "political",
    for: "any",
    locked: true,
    effects: [],
    ai: { base: 0 },
  },
  {
    id: "t_dear",
    category: "political",
    for: "any",
    available: { kind: "always", value: false },
    cost: { pp: 1000 },
    effects: [mark("t_dear_done")],
    ai: { base: 0 },
  },
];

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      events: [...politicsFixture().events, ...TEST_EVENTS],
      decisions: [...politicsFixture().decisions, ...TEST_DECISIONS],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

/** A game past the preparation minute, every country AI. */
async function game(): Promise<{
  runner: GameRunner;
  updates: GameUpdateViewData[];
  p: WwPolitics;
  est: number;
  ltu: number;
}> {
  const { runner, updates } = await wwRunnerCapture({}, [], POL);
  stepTo(runner, WW_PREP_TICKS + 5);
  const g = runner.game;
  return {
    runner,
    updates,
    p: pol(g),
    est: byTag(g, "EST").smallID(),
    ltu: byTag(g, "LTU").smallID(),
  };
}

/** Runs `effects` for `self` now (target 0 unless given) and empties the queue. */
function run(
  runner: GameRunner,
  p: WwPolitics,
  self: number,
  effects: Effect[],
  target = 0,
): void {
  const t = runner.game.ticks();
  applyEffects(makeCtx(p, self, self, target, t), effects);
  p.flushEvents(t);
}

const politicsNews = (updates: GameUpdateViewData[]) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.WwPolitics] ?? [])
    .flatMap((u) => u.data.news);

describe("event effects", () => {
  it("fire_event queues the event for the receiver, from the actor", async () => {
    const { runner, p, est, ltu } = await game();
    run(runner, p, est, [
      { kind: "fire_event", id: "t_recv", to: { tag: "LTU" } },
    ]);
    expect([...p.country(ltu)!.unlocked]).toEqual(["t_got"]);
    expect([...p.country(est)!.unlocked]).toEqual(["t_sent"]);
    // No `to`: the actor itself; a once event already received is ignored.
    run(runner, p, est, [{ kind: "fire_event", id: "t_once" }]);
    run(runner, p, est, [{ kind: "fire_event", id: "t_once" }]);
    expect([...p.country(est)!.unlocked]).toEqual(["t_sent", "t_once_got"]);
    // A receiver that does not exist here: nothing.
    run(runner, p, est, [
      { kind: "fire_event", id: "t_recv", to: { tag: "USA" } },
    ]);
    expect(p.queuedEvents()).toBe(0);
  });

  it("fire_event with days goes through the delay list", async () => {
    const { runner, p, est, ltu } = await game();
    const day = runner.game.worldWar()!.day(runner.game.ticks());
    run(runner, p, est, [
      { kind: "fire_event", id: "t_recv", to: { tag: "LTU" }, days: 4 },
    ]);
    expect(p.delayed).toEqual([
      expect.objectContaining({
        day: day + 4,
        kind: "fire",
        eventId: "t_recv",
        to: ltu,
        from: est,
      }),
    ]);
    stepTo(runner, dayStart(day + 4));
    expect(p.country(ltu)!.unlocked.size).toBe(0);
    step(runner);
    expect([...p.country(ltu)!.unlocked]).toEqual(["t_got"]);
    expect(p.delayed).toEqual([]);
  });

  it("news reaches the update with the actor and the target", async () => {
    const { runner, updates, p, est, ltu } = await game();
    run(runner, p, est, [{ kind: "news", id: "t_news" }]);
    run(runner, p, est, [{ kind: "news", id: "t_news2" }], ltu);
    step(runner);
    expect(politicsNews(updates)).toEqual([
      { id: "t_news", params: { countryTag: "EST", targetTag: "none" } },
      { id: "t_news2", params: { countryTag: "EST", targetTag: "LTU" } },
    ]);
    // The next update carries none (news is not state).
    step(runner);
    expect(politicsNews(updates)).toHaveLength(2);
  });

  it("unlock_decision, lock_decision and take_decision", async () => {
    const { runner, p, est } = await game();
    const c = p.country(est)!;
    expect(decisionBlock(p, est, "t_locked", 0)).toBe("decision_unavailable");
    run(runner, p, est, [{ kind: "unlock_decision", id: "t_locked" }]);
    expect(decisionBlock(p, est, "t_locked", 0)).toBeNull();
    run(runner, p, est, [{ kind: "lock_decision", id: "t_locked" }]);
    expect(decisionBlock(p, est, "t_locked", 0)).toBe("decision_unavailable");
    run(runner, p, est, [{ kind: "unlock_decision", id: "t_locked" }]);
    expect(decisionBlock(p, est, "t_locked", 0)).toBeNull();
    // take_decision is free: no cost, no condition.
    const pp = c.ppMilli;
    expect(decisionBlock(p, est, "t_dear", 0)).toBe("decision_unavailable");
    run(runner, p, est, [{ kind: "take_decision", id: "t_dear" }]);
    expect(c.ppMilli).toBe(pp);
    expect(c.taken.has("t_dear")).toBe(true);
    expect(c.unlocked.has("t_dear_done")).toBe(true);
  });

  it("if runs then or else by its condition", async () => {
    const { runner, p, est } = await game();
    const c = p.country(est)!;
    const branch = (value: boolean): Effect => ({
      kind: "if",
      cond: { kind: "always", value },
      then: [mark(`t_then_${value}`)],
      else: [mark(`t_else_${value}`)],
    });
    run(runner, p, est, [branch(true), branch(false)]);
    expect([...c.unlocked]).toEqual(["t_then_true", "t_else_false"]);
    // No else: nothing.
    run(runner, p, est, [
      { kind: "if", cond: { kind: "always", value: false }, then: [mark("x")] },
    ]);
    expect(c.unlocked.has("x")).toBe(false);
  });

  it("random_list picks by weight from the seeded roll", async () => {
    const { runner, updates, p, est } = await game();
    const list: Effect = {
      kind: "random_list",
      options: [
        { weight: 1, effects: [{ kind: "news", id: "t_r1" }] },
        { weight: 3, effects: [{ kind: "news", id: "t_r3" }] },
        { weight: 0, effects: [{ kind: "news", id: "t_r0" }] },
      ],
    };
    for (let i = 0; i < 1000; i++) run(runner, p, est, [list]);
    step(runner);
    const ids = politicsNews(updates).map((n) => n.id);
    expect(ids).toHaveLength(1000);
    expect(ids.filter((x) => x === "t_r0")).toEqual([]);
    // 1 : 3 → 25% (21–29% of 1,000).
    const ones = ids.filter((x) => x === "t_r1").length;
    expect(ones).toBeGreaterThanOrEqual(210);
    expect(ones).toBeLessThanOrEqual(290);
    // All weights 0: nothing.
    run(runner, p, est, [
      {
        kind: "random_list",
        options: [{ weight: 0, effects: [{ kind: "news", id: "t_none" }] }],
      },
    ]);
    step(runner);
    expect(politicsNews(updates)).toHaveLength(1000);
  });

  // Lane D's addTension is a stub: the controller revives this after D merges.
  it.skip("tension adds world tension and the actor's own share", async () => {
    const { runner, p, est } = await game();
    const wt = p.wtBp;
    const own = p.threatBp[est];
    run(runner, p, est, [{ kind: "tension", pct: 3 }]);
    expect(p.wtBp).toBe(wt + 300);
    expect(p.threatBp[est]).toBe(own + 300);
  });
});
