// World War 1936 P3 (spec §11.2, §21.3): national focus — start, queue,
// cancel, bypass, cancelIf, completion and the cards, on the test map
// ww1936pol with the test content; Germany is human.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { dailyPpMilli } from "@openfront/engine-lib/ww1936/PoliticsRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { EffectCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import type * as EffectsPolModule from "@openfront/engine/ww1936/politics/EffectsPol";
import {
  focusBlock,
  focusCards,
  focusDaysMilli,
  queueFocus,
  startFocus,
  stepFocus,
} from "@openfront/engine/ww1936/politics/Focus";
import type { CountryPol } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  order,
  pol,
  POL,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

// Every political effect a focus dispatches, recorded on its way to lane P's
// body (which runs: the 70-day test checks the PP it gives too).
const applied = vi.hoisted(
  () => [] as { kind: string; actor: number; day: number }[],
);
vi.mock(
  "@openfront/engine/ww1936/politics/EffectsPol",
  async (importOriginal) => {
    const m = await importOriginal<typeof EffectsPolModule>();
    return {
      ...m,
      applyPoliticalEffect: (ctx: EffectCtx, e: Effect, actor: number) => {
        applied.push({ kind: e.kind, actor, day: ctx.day });
        m.applyPoliticalEffect(ctx, e, actor);
      },
    };
  },
);

const flag = (f: string) => ({ kind: "flag" as const, flag: f });
const root = (id: string, extra: Partial<FocusDef> = {}): FocusDef => ({
  id,
  tree: "generic",
  x: 5,
  y: 5,
  days: 70,
  branch: "politics",
  icon: "flag",
  effects: [{ kind: "pp", amount: 5 }],
  ...extra,
});
let col = 2;
/** This file's focuses (each its own grid cell), after the fixture's three. */
const TEST_FOCUSES: FocusDef[] = [
  root("gen_t_by", { bypass: { kind: "always", value: true } }),
  root("gen_t_after_by", { days: 35, prereq: [["gen_t_by"]] }),
  root("gen_t_byflag", { bypass: flag("t_skip") }),
  root("gen_t_ci", { cancelIf: flag("t_stop") }),
  root("gen_t_av", {
    days: 35,
    available: {
      all: [{ kind: "always", value: true }, flag("t_open"), flag("t_open2")],
    },
  }),
  root("gen_t_av2", {
    available: { all: [{ kind: "always", value: true }, flag("t_open")] },
  }),
  root("gen_t_any", {
    available: { any: [flag("t_open"), { kind: "always", value: true }] },
  }),
  root("gen_t_needs_c", { prereq: [["gen_t_c"]] }),
].map((f) => ({ ...f, x: col++, y: 3 }));

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);

interface Game1 {
  runner: GameRunner;
  updates: Awaited<ReturnType<typeof wwRunnerCapture>>["updates"];
  id: number;
  c: CountryPol;
  /** Germany's own tick within a day. */
  slot: number;
}

async function game(): Promise<Game1> {
  const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
  step(runner);
  const id = byTag(runner.game, "DEU").smallID();
  const c = pol(runner.game).country(id)!;
  return { runner, updates, id, c, slot: id % WW_DAY_SPLIT };
}

/** Runs to just after Germany's daily step of `day` (controller ruling R21). */
function afterSlot(g: Game1, day: number): void {
  stepTo(g.runner, dayStart(day) + g.slot + 1);
}

/** Runs to just before Germany's daily step of `day`. */
function beforeSlot(g: Game1, day: number): void {
  stepTo(g.runner, dayStart(day) + g.slot);
}

/** A human order now (it runs on the next tick, before that tick's politics). */
function send(g: Game1, o: WwOrder): void {
  step(g.runner, 1, [order(HUMAN, o)]);
}

const pos = (id: string) => pol0().content.treePos.get(id)!;
let current: Game1 | null = null;
const pol0 = () => pol(current!.runner.game);
const deuApplied = () => applied.filter((a) => a.actor === current!.id);

beforeEach(() => {
  const base = politicsFixture();
  usePoliticsContent(
    politicsFixture({
      focuses: [...base.focuses, ...TEST_FOCUSES],
      spirits: [
        ...base.spirits,
        { id: "gen_t_fast", stats: { focusSpeedPct: 100 }, icon: "flag" },
      ],
    }),
  );
  applied.length = 0;
  current = null;
});
afterEach(() => usePoliticsContent(null));

describe("national focus", { timeout: 60_000 }, () => {
  it("a 70-day focus completes on day 70 and applies its effects once", async () => {
    const g = (current = await game());
    // Day 4 has 8 ticks: the order lands after Germany's step of that day.
    afterSlot(g, 4);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    expect(g.runner.game.worldWar()!.day(g.runner.game.ticks())).toBe(4);
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 0 });
    // The end of day 4 + 69: still running.
    stepTo(g.runner, dayStart(4 + 70));
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 69_000 });
    beforeSlot(g, 4 + 70);
    expect(g.c.focus?.progressMilli).toBe(69_000);
    expect(deuApplied()).toEqual([]);
    const pp = g.c.ppMilli;
    step(g.runner);
    // Lane P's pp effect: gen_t_a's 50 PP (x3, a focus) on top of the day's own gain.
    expect(g.c.ppMilli - pp).toBe(dailyPpMilli(g.c.stats) + 150_000);
    expect(g.c.focus).toBeNull();
    expect(g.c.focusState[pos("gen_t_a")]).toBe(1);
    expect(g.c.focusesDone).toBe(1);
    expect(deuApplied()).toEqual([{ kind: "pp", actor: g.id, day: 74 }]);
    const done = g.updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_focus_done");
    expect(done.map((m) => m.params)).toEqual([{ focus: "gen_t_a" }]);
    // Once: nothing more on the following days.
    stepTo(g.runner, dayStart(4 + 75));
    expect(deuApplied()).toHaveLength(1);
    expect(startFocus(pol0(), g.id, "gen_t_a", g.runner.game.ticks())).toBe(
      "focus_done",
    );
  });

  it("focus speed modifies progress", async () => {
    const g = (current = await game());
    afterSlot(g, 2);
    g.c.spirits.push({ id: "gen_t_fast", untilDay: -1, addedDay: 2 });
    pol0().recomputeStats(g.id);
    expect(g.c.stats.focusSpeedPct).toBe(100);
    // Spec §21.3: "70 days → 35".
    expect(focusDaysMilli(pol0(), g.id, "gen_t_a")).toBe(35_000);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    beforeSlot(g, 2 + 35);
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 68_000 });
    step(g.runner);
    expect(g.c.focus).toBeNull();
    expect(g.c.focusState[pos("gen_t_a")]).toBe(1);
  });

  it("a cancelled focus keeps its progress", async () => {
    const g = (current = await game());
    afterSlot(g, 4);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    afterSlot(g, 4 + 20);
    send(g, { kind: "focus_cancel" });
    expect(g.c.focus).toBeNull();
    expect(g.c.partial.get("gen_t_a")).toBe(20_000);
    // An empty day earns nothing (spec §11.2).
    afterSlot(g, 4 + 22);
    expect(g.c.partial.get("gen_t_a")).toBe(20_000);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 20_000 });
    expect(g.c.partial.has("gen_t_a")).toBe(false);
    beforeSlot(g, 4 + 22 + 50);
    expect(g.c.focus?.progressMilli).toBe(69_000);
    step(g.runner);
    expect(g.c.focusState[pos("gen_t_a")]).toBe(1);
  });

  it("exclusive focuses block each other", async () => {
    const g = (current = await game());
    const p = pol0();
    const t = () => g.runner.game.ticks();
    g.c.focusState[pos("gen_t_a")] = 1;
    // Running: gen_t_b. gen_t_c can neither start nor queue.
    expect(startFocus(p, g.id, "gen_t_b", t())).toBeNull();
    expect(focusBlock(p, g.id, "gen_t_c", true)).toBe("focus_exclusive");
    expect(queueFocus(p, g.id, "gen_t_c")).toBe("focus_exclusive");
    // Queued: gen_t_b behind another focus.
    g.c.focus = null;
    expect(startFocus(p, g.id, "gen_t_any", t())).toBeNull();
    expect(queueFocus(p, g.id, "gen_t_b")).toBeNull();
    expect(g.c.queued).toBe("gen_t_b");
    // Spec §11.2: a new queue replaces the old one, its exclusive partner too.
    expect(queueFocus(p, g.id, "gen_t_c")).toBeNull();
    expect(g.c.queued).toBe("gen_t_c");
    // With nothing running, a start is refused by the queued partner.
    g.c.focus = null;
    expect(startFocus(p, g.id, "gen_t_b", t())).toBe("focus_exclusive");
    // Completed: gen_t_c is closed for good, and the other way round.
    g.c.focus = null;
    g.c.queued = null;
    g.c.focusState[pos("gen_t_b")] = 1;
    expect(startFocus(p, g.id, "gen_t_c", t())).toBe("focus_exclusive");
    g.c.focusState[pos("gen_t_b")] = 0;
    g.c.focusState[pos("gen_t_c")] = 1;
    expect(startFocus(p, g.id, "gen_t_b", t())).toBe("focus_exclusive");
    // The other refusals.
    expect(startFocus(p, g.id, "gen_t_c", t())).toBe("focus_done");
    expect(startFocus(p, g.id, "no_such_focus", t())).toBe("focus_unavailable");
    g.c.focusState.fill(0);
    expect(startFocus(p, g.id, "gen_t_b", t())).toBe("focus_prereq");
    expect(startFocus(p, g.id, "gen_t_av", t())).toBe("focus_unavailable");
    expect(startFocus(p, g.id, "gen_t_a", t())).toBeNull();
    expect(startFocus(p, g.id, "gen_t_any", t())).toBe("focus_busy");
    expect(queueFocus(p, g.id, "gen_t_a")).toBe("focus_busy");
  });

  it("bypass completes without effects", async () => {
    const g = (current = await game());
    afterSlot(g, 2);
    // Chosen with its bypass true: finished at once, nothing runs.
    send(g, { kind: "focus_start", focus: "gen_t_by" });
    expect(g.c.focus).toBeNull();
    expect(g.c.focusState[pos("gen_t_by")]).toBe(2);
    expect(g.c.focusesDone).toBe(0);
    // It counts as done for its followers.
    expect(focusBlock(pol0(), g.id, "gen_t_after_by", false)).toBeNull();
    // Running, its bypass becomes true: finished on that day's step, and
    // the queued focus starts.
    send(g, { kind: "focus_start", focus: "gen_t_byflag" });
    send(g, { kind: "focus_queue", focus: "gen_t_after_by" });
    afterSlot(g, 2 + 10);
    expect(g.c.focus).toEqual({ id: "gen_t_byflag", progressMilli: 10_000 });
    g.c.flags.set("t_skip", [12, -1]);
    afterSlot(g, 2 + 11);
    expect(g.c.focusState[pos("gen_t_byflag")]).toBe(2);
    expect(g.c.partial.has("gen_t_byflag")).toBe(false);
    expect(g.c.focus).toEqual({ id: "gen_t_after_by", progressMilli: 0 });
    expect(deuApplied()).toEqual([]);
  });

  it("cancelIf cancels and keeps the progress", async () => {
    const g = (current = await game());
    afterSlot(g, 2);
    send(g, { kind: "focus_start", focus: "gen_t_ci" });
    afterSlot(g, 2 + 10);
    expect(g.c.focus?.progressMilli).toBe(10_000);
    g.c.flags.set("t_stop", [12, -1]);
    afterSlot(g, 2 + 11);
    expect(g.c.focus).toBeNull();
    expect(g.c.partial.get("gen_t_ci")).toBe(10_000);
    expect(g.c.focusState[pos("gen_t_ci")]).toBe(0);
    expect(deuApplied()).toEqual([]);
  });

  it("the queued focus starts the day the current one ends", async () => {
    const g = (current = await game());
    afterSlot(g, 4);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    // gen_t_b needs gen_t_a: the running one counts for the queue.
    expect(focusBlock(pol0(), g.id, "gen_t_b", false)).toBe("focus_busy");
    send(g, { kind: "focus_queue", focus: "gen_t_b" });
    expect(g.c.queued).toBe("gen_t_b");
    // A new queue replaces the old one; unqueue empties it.
    send(g, { kind: "focus_queue", focus: "gen_t_any" });
    expect(g.c.queued).toBe("gen_t_any");
    send(g, { kind: "focus_unqueue" });
    expect(g.c.queued).toBeNull();
    send(g, { kind: "focus_queue", focus: "gen_t_b" });
    afterSlot(g, 4 + 70);
    expect(g.c.focusState[pos("gen_t_a")]).toBe(1);
    expect(g.c.focus).toEqual({ id: "gen_t_b", progressMilli: 0 });
    expect(g.c.queued).toBeNull();
    afterSlot(g, 4 + 71);
    expect(g.c.focus).toEqual({ id: "gen_t_b", progressMilli: 1000 });
  });

  it("starting the queued focus takes it out of the queue", async () => {
    const g = (current = await game());
    afterSlot(g, 4);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    send(g, { kind: "focus_queue", focus: "gen_t_any" });
    send(g, { kind: "focus_cancel" });
    // The queue waits for the next step; started by hand, it leaves it.
    expect(g.c.queued).toBe("gen_t_any");
    send(g, { kind: "focus_start", focus: "gen_t_any" });
    expect(g.c.queued).toBeNull();
    afterSlot(g, 4 + 71);
    expect(g.c.focusState[pos("gen_t_any")]).toBe(1);
    const failed = g.updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_focus_queue_failed");
    expect(failed).toEqual([]);
  });

  it("progress never stalls or reverses", async () => {
    const g = (current = await game());
    afterSlot(g, 2);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    // Below -100%: still one milli a day (recomputeStats clamps to -90%).
    g.c.stats.focusSpeedPct = -150;
    const day = g.runner.game.worldWar()!.day(g.runner.game.ticks());
    stepFocus(pol0(), g.id, day, g.runner.game.ticks());
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 1 });
    expect(focusDaysMilli(pol0(), g.id, "gen_t_a")).toBe(70_000 * 1000);
  });

  it("a failed queue tells the owner", async () => {
    const g = (current = await game());
    afterSlot(g, 4);
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    // `available` is looked at when it starts, not when it is queued.
    send(g, { kind: "focus_queue", focus: "gen_t_av" });
    expect(g.c.queued).toBe("gen_t_av");
    afterSlot(g, 4 + 70);
    expect(g.c.focusState[pos("gen_t_a")]).toBe(1);
    expect(g.c.focus).toBeNull();
    expect(g.c.queued).toBeNull();
    const failed = g.updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_focus_queue_failed");
    expect(failed.map((m) => [m.params, m.playerID])).toEqual([
      [{ focus: "gen_t_av" }, g.id],
    ]);
  });

  it("orders during the preparation minute set a focus that progresses from tick 600", async () => {
    const g = (current = await game());
    send(g, { kind: "focus_start", focus: "gen_t_a" });
    expect(g.runner.game.ticks()).toBeLessThan(WW_PREP_TICKS);
    expect(g.c.focus).toEqual({ id: "gen_t_a", progressMilli: 0 });
    stepTo(g.runner, WW_PREP_TICKS);
    expect(g.c.focus?.progressMilli).toBe(0);
    // Day 0 starts at tick 600: its step is the first progress.
    afterSlot(g, 0);
    expect(g.c.focus?.progressMilli).toBe(1000);
  });

  it("focus cards report states and failing leaves", async () => {
    const g = (current = await game());
    const p = pol0();
    const t = () => g.runner.game.ticks();
    g.c.focusState[pos("gen_t_a")] = 1;
    expect(startFocus(p, g.id, "gen_t_by", t())).toBeNull();
    expect(startFocus(p, g.id, "gen_t_b", t())).toBeNull();
    expect(queueFocus(p, g.id, "gen_t_after_by")).toBeNull();
    const cards = focusCards(p, g.id);
    const at = (id: string) => cards[pos(id)];
    expect(cards.map((c) => c.idx)).toEqual(cards.map((_, i) => i));
    expect(at("gen_t_a")).toEqual({
      idx: pos("gen_t_a"),
      state: 1,
      failing: [],
    });
    expect(at("gen_t_by").state).toBe(2);
    expect(at("gen_t_b").state).toBe(3);
    expect(at("gen_t_needs_c").state).toBe(4);
    // Only the second leaf of three is false.
    g.c.flags.set("t_open2", [0, -1]);
    const cards2 = focusCards(p, g.id);
    expect(cards2[pos("gen_t_av")]).toEqual({
      idx: pos("gen_t_av"),
      state: 5,
      failing: [1],
    });
    expect(cards2[pos("gen_t_av2")].failing).toEqual([1]);
    expect(at("gen_t_c").state).toBe(6);
    expect(at("gen_t_after_by").state).toBe(7);
    // A satisfied `any` is open though one of its leaves is false.
    expect(at("gen_t_any")).toEqual({
      idx: pos("gen_t_any"),
      state: 0,
      failing: [],
    });
    expect(at("gen_t_ci").state).toBe(0);
    expect(new Set(cards.map((c) => c.state))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6, 7]),
    );
    // Controller ruling R21: a queued exclusive partner shows as exclusive.
    g.c.focus = null;
    g.c.queued = "gen_t_b";
    expect(focusCards(p, g.id)[pos("gen_t_c")].state).toBe(6);
    expect(focusBlock(p, g.id, "gen_t_c", false)).toBe("focus_exclusive");
  });
});
