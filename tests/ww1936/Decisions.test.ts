// World War 1936 P3 (spec §13, §26.4; Task 3): decisions and missions on
// the test map ww1936pol with the test content and this file's decisions,
// for a human Germany (no AI politics: plan decision 24). Effects are
// marked with unlock_decision (the event group's own effect).
import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  DecisionDef,
  WW_FOREVER,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  cancelMission,
  decisionBlock,
  decisionCards,
  stepDecisions,
  takeDecision,
} from "@openfront/engine/ww1936/politics/Decisions";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  land,
  order,
  pol,
  POL,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];
const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const mark = (id: string): Effect => ({ kind: "unlock_decision", id });
const dec = (d: Partial<DecisionDef> & { id: string }): DecisionDef => ({
  category: "political",
  for: "any",
  ai: { base: 0 },
  ...d,
});

const TEST_DECISIONS: DecisionDef[] = [
  dec({
    id: "t_dec",
    cost: { pp: 30 },
    cooldownDays: 10,
    effects: [mark("t_dec_done")],
  }),
  dec({ id: "t_once", effects: [mark("t_once_done")] }),
  dec({
    id: "t_costly",
    cost: { manpower: 1000, armyXp: 5, equipment: ["infantry_equipment", 100] },
    effects: [],
  }),
  dec({
    id: "t_mission",
    cost: { pp: 10 },
    cooldownDays: 1,
    days: 10,
    effects: [mark("t_m_started")],
    completeEffects: [mark("t_m_done")],
    failIf: { kind: "gflag", flag: "t_fail" },
    failEffects: [mark("t_m_failed")],
  }),
  dec({ id: "t_locked", locked: true, effects: [] }),
  dec({
    id: "t_target",
    target: {
      // self = the candidate, from = the decider: not a major, no pact with me.
      among: {
        all: [
          { not: { kind: "is_major" } },
          { not: { kind: "nap_with", of: "from" } },
        ],
      },
    },
    // Listed while closed (without `visible` it would follow `available`).
    visible: { kind: "always", value: true },
    available: { kind: "gflag", flag: "t_open" },
    cost: { pp: 20 },
    cooldownDays: 30,
    effects: [mark("t_target_done")],
  }),
  dec({
    id: "t_dear",
    cost: { pp: 1000 },
    available: { kind: "always", value: false },
    effects: [mark("t_dear_done")],
  }),
  dec({ id: "t_gbr_only", for: ["GBR"], effects: [mark("t_gbr_done")] }),
  dec({
    id: "t_open_only",
    available: { kind: "gflag", flag: "t_open" },
    effects: [],
  }),
];

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      decisions: [...politicsFixture().decisions, ...TEST_DECISIONS],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game(): Promise<{
  runner: GameRunner;
  updates: GameUpdateViewData[];
  p: WwPolitics;
  deu: number;
}> {
  const { runner, updates } = await wwRunnerCapture({}, DEU_HUMAN, POL);
  stepTo(runner, WW_PREP_TICKS + 5);
  return {
    runner,
    updates,
    p: pol(runner.game),
    deu: byTag(runner.game, "DEU").smallID(),
  };
}

const take = (
  runner: GameRunner,
  p: WwPolitics,
  id: number,
  decision: string,
  target = 0,
  free = false,
) => takeDecision(p, id, decision, target, runner.game.ticks(), free);

const messages = (updates: GameUpdateViewData[], key: string) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
    .filter((m) => m.message === `events_display.${key}`)
    .map((m) => m.params);

describe("decisions", () => {
  it("taking a decision pays, applies and starts its cooldown", async () => {
    const { runner, updates, p, deu } = await game();
    const g = runner.game;
    const c = p.country(deu)!;
    const day = g.worldWar()!.day(g.ticks());
    c.ppMilli = 100_000;
    expect(decisionBlock(p, deu, "t_dec", 0)).toBeNull();
    expect(take(runner, p, deu, "t_dec")).toBeNull();
    expect(c.ppMilli).toBe(70_000);
    expect(c.unlocked.has("t_dec_done")).toBe(true);
    expect(c.taken.has("t_dec")).toBe(true);
    expect(c.decisionCooldown.get("t_dec")).toBe(day + 10);
    expect(decisionBlock(p, deu, "t_dec", 0)).toBe("decision_cooldown");
    expect(take(runner, p, deu, "t_dec")).toBe("decision_cooldown");
    expect(c.ppMilli).toBe(70_000);
    // An untargeted decision takes no target.
    expect(decisionBlock(p, deu, "t_once", 6)).toBe("bad_target");
    // No cooldownDays: once a game.
    expect(take(runner, p, deu, "t_once")).toBeNull();
    expect(c.decisionCooldown.get("t_once")).toBe(WW_FOREVER);
    // Day + 10: open again; the order path tells the player.
    stepTo(runner, dayStart(day + 10) + 1);
    c.ppMilli = 100_000;
    expect(decisionBlock(p, deu, "t_dec", 0)).toBeNull();
    step(runner, 2, [
      order(HUMAN, { kind: "decision_take", decision: "t_dec", target: 0 }),
    ]);
    expect(c.ppMilli).toBeLessThanOrEqual(70_000 + 2 * 3000);
    expect(c.decisionCooldown.get("t_dec")).toBe(day + 20);
    expect(messages(updates, "ww1936_decision")).toEqual([
      { decision: "t_dec" },
      { decision: "t_once" },
      { decision: "t_dec" },
    ]);
    // Short of PP, or in debt: no_pp, nothing paid.
    c.ppMilli = 5_000;
    expect(decisionBlock(p, deu, "t_mission", 0)).toBe("no_pp");
    c.ppMilli = -1;
    expect(decisionBlock(p, deu, "t_locked", 0)).toBe("decision_unavailable");
    expect(decisionBlock(p, deu, "t_costly", 0)).toBe("no_pp");
  });

  it("manpower, army experience and equipment are paid, newest equipment first", async () => {
    const { runner, p, deu } = await game();
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(deu)!;
    const cl = land(runner.game).country(deu)!;
    const [g1, g2, g3] = [1, 2, 3].map((gen) =>
      equipKey("infantry_equipment", gen),
    );
    ce.stock[g1] = 80;
    ce.stock[g2] = 50;
    ce.stock[g3] = 0;
    ce.manpower = 999;
    cl.armyXpMilli = 5000;
    expect(decisionBlock(p, deu, "t_costly", 0)).toBe("decision_unavailable");
    ce.manpower = 1500;
    expect(decisionBlock(p, deu, "t_costly", 0)).toBeNull();
    cl.armyXpMilli = 4999;
    expect(decisionBlock(p, deu, "t_costly", 0)).toBe("decision_unavailable");
    cl.armyXpMilli = 6000;
    ce.stock[g1] = 49;
    expect(decisionBlock(p, deu, "t_costly", 0)).toBe("decision_unavailable");
    ce.stock[g1] = 80;
    expect(take(runner, p, deu, "t_costly")).toBeNull();
    expect(ce.manpower).toBe(500);
    expect(cl.armyXpMilli).toBe(1000);
    expect([ce.stock[g1], ce.stock[g2], ce.stock[g3]]).toEqual([30, 0, 0]);
  });

  it("a mission completes after its days or fails on failIf", async () => {
    const { runner, updates, p, deu } = await game();
    const g = runner.game;
    const c = p.country(deu)!;
    const day = g.worldWar()!.day(g.ticks());
    expect(take(runner, p, deu, "t_mission")).toBeNull();
    expect(c.unlocked.has("t_m_started")).toBe(true);
    expect(c.missions).toEqual([
      { id: "t_mission", target: 0, startDay: day, endDay: day + 10 },
    ]);
    // Running: blocked even once the cooldown (1 day, from the take) is over.
    stepTo(runner, dayStart(day + 2));
    expect(c.decisionCooldown.get("t_mission")).toBe(day + 1);
    expect(decisionBlock(p, deu, "t_mission", 0)).toBe("decision_cooldown");
    stepDecisions(p, deu, day + 9, g.ticks());
    expect(c.missions).toHaveLength(1);
    expect(c.unlocked.has("t_m_done")).toBe(false);
    // In the game: done on the country's step of day + 10.
    stepTo(runner, dayStart(day + 11));
    expect(c.missions).toEqual([]);
    expect(c.unlocked.has("t_m_done")).toBe(true);
    expect(messages(updates, "ww1936_mission_done")).toEqual([
      { decision: "t_mission" },
    ]);
    // Again; failIf turns true: removed with its fail effects.
    c.ppMilli = 100_000;
    expect(take(runner, p, deu, "t_mission")).toBeNull();
    p.gflags.set("t_fail", day + 11);
    const failDay = g.worldWar()!.day(g.ticks());
    stepTo(runner, dayStart(failDay + 2));
    expect(c.missions).toEqual([]);
    expect(c.unlocked.has("t_m_failed")).toBe(true);
    expect(messages(updates, "ww1936_mission_failed")).toEqual([
      { decision: "t_mission" },
    ]);
    // Cancelling: only a running mission, no refund.
    p.gflags.delete("t_fail");
    c.ppMilli = 100_000;
    expect(take(runner, p, deu, "t_mission")).toBeNull();
    expect(cancelMission(p, deu, "t_mission", 0)).toBeNull();
    expect(c.missions).toEqual([]);
    expect(c.ppMilli).toBe(90_000);
    expect(cancelMission(p, deu, "t_mission", 0)).toBe("decision_unavailable");
  });

  it("a decision without visible is listed only while available", async () => {
    const { p, deu } = await game();
    const listed = () =>
      decisionCards(p, deu).some((x) => x.id === "t_open_only");
    expect(listed()).toBe(false);
    p.gflags.set("t_open", 0);
    expect(listed()).toBe(true);
  });

  it("locked decisions need unlock_decision", async () => {
    const { runner, p, deu } = await game();
    const ids = () => decisionCards(p, deu).map((x) => x.id);
    expect(decisionBlock(p, deu, "t_locked", 0)).toBe("decision_unavailable");
    expect(ids()).not.toContain("t_locked");
    const run = (e: Effect) =>
      applyEffects(makeCtx(p, deu, deu, 0, runner.game.ticks()), [e]);
    run({ kind: "unlock_decision", id: "t_locked" });
    expect(decisionBlock(p, deu, "t_locked", 0)).toBeNull();
    expect(ids()).toContain("t_locked");
    run({ kind: "lock_decision", id: "t_locked" });
    expect(decisionBlock(p, deu, "t_locked", 0)).toBe("decision_unavailable");
    expect(ids()).not.toContain("t_locked");
    // Not for this country: neither listed nor takeable.
    expect(ids()).not.toContain("t_gbr_only");
    expect(decisionBlock(p, deu, "t_gbr_only", 0)).toBe("decision_unavailable");
  });

  it("targeted decisions list one card per candidate", async () => {
    const { runner, p, deu } = await game();
    const g = runner.game;
    const c = p.country(deu)!;
    const id = (t: "POL" | "CSK" | "AUT" | "EST" | "LTU") =>
      byTag(g, t).smallID();
    const cards = () =>
      decisionCards(p, deu).filter((x) => x.id === "t_target");
    // Not a major and no pact with Germany: Poland (the 1934 pact) is out.
    expect(cards().map((x) => [x.target, x.state, x.failing])).toEqual([
      [id("CSK"), 1, [0]],
      [id("AUT"), 1, [0]],
      [id("EST"), 1, [0]],
      [id("LTU"), 1, [0]],
    ]);
    expect(decisionBlock(p, deu, "t_target", id("CSK"))).toBe(
      "decision_unavailable",
    );
    p.gflags.set("t_open", 0);
    expect(cards().every((x) => x.state === 0 && x.costPp === 20)).toBe(true);
    expect(decisionBlock(p, deu, "t_target", 0)).toBe("bad_target");
    expect(decisionBlock(p, deu, "t_target", deu)).toBe("bad_target");
    expect(decisionBlock(p, deu, "t_target", id("POL"))).toBe(
      "decision_unavailable",
    );
    expect(take(runner, p, deu, "t_target", id("CSK"))).toBeNull();
    expect(c.decisionCooldown.has(`t_target@${id("CSK")}`)).toBe(true);
    // Each target keeps its own cooldown; short of PP the others show cost.
    c.ppMilli = 10_000;
    expect(cards().map((x) => [x.target, x.state])).toEqual([
      [id("CSK"), 3],
      [id("AUT"), 2],
      [id("EST"), 2],
      [id("LTU"), 2],
    ]);
    c.ppMilli = 100_000;
    expect(take(runner, p, deu, "t_target", id("AUT"))).toBeNull();
    expect(cards().map((x) => x.state)).toEqual([3, 3, 0, 0]);
  });

  it("free take_decision ignores cost and conditions", async () => {
    const { runner, p, deu } = await game();
    const c = p.country(deu)!;
    const pp = c.ppMilli;
    expect(decisionBlock(p, deu, "t_dear", 0)).toBe("decision_unavailable");
    expect(take(runner, p, deu, "t_dear")).toBe("decision_unavailable");
    expect(take(runner, p, deu, "t_dear", 0, true)).toBeNull();
    expect(c.ppMilli).toBe(pp);
    expect(c.unlocked.has("t_dear_done")).toBe(true);
    // Also on cooldown, also through the effect; an untargeted decision
    // drops the context's target.
    applyEffects(makeCtx(p, deu, deu, 6, runner.game.ticks()), [
      { kind: "take_decision", id: "t_once" },
      { kind: "take_decision", id: "t_once" },
    ]);
    expect(c.decisionCooldown.get("t_once")).toBe(WW_FOREVER);
    expect(c.decisionCooldown.has("t_once@6")).toBe(false);
    // Only for the countries it is for.
    expect(take(runner, p, deu, "t_gbr_only", 0, true)).toBe(
      "decision_unavailable",
    );
    expect(c.unlocked.has("t_gbr_done")).toBe(false);
  });

  it("decisionCostPct changes the PP cost", async () => {
    const { runner, p, deu } = await game();
    const c = p.country(deu)!;
    const costOf = () =>
      decisionCards(p, deu).find((x) => x.id === "t_dec")!.costPp;
    expect(costOf()).toBe(30);
    c.stats.decisionCostPct = -50;
    expect(costOf()).toBe(15);
    c.ppMilli = 20_000;
    expect(take(runner, p, deu, "t_dec")).toBeNull();
    expect(c.ppMilli).toBe(5_000);
    c.stats.decisionCostPct = 100;
    expect(costOf()).toBe(60);
  });
});
