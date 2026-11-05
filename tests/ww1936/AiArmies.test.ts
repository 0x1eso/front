// ww81 lane A: the pure army rules (where a division joins, merges, role, width).
import {
  DIRECT_ADVANCE,
  DIRECT_MERGE,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  type ArmyFacts,
  chooseMerge,
  chooseShape,
  judgeRole,
  type MergeFacts,
  trainTargetArmy,
  widthPenaltyBp,
} from "@openfront/engine/ww1936/land/AiArmies";
import { aiTrainPlan } from "@openfront/engine/ww1936/land/AiLand";
import { byTag, HUMAN, land, wwRunner } from "./util";

const f = (id: number, n: number, armour = 0, apart = 0): ArmyFacts => ({
  id,
  n,
  armour,
  apart,
});
const m = (
  id: number,
  n: number,
  armour = 0,
  o: Partial<MergeFacts> = {},
): MergeFacts => ({
  ...f(id, n, armour),
  region: id,
  comp: 0,
  front: -1,
  planBp: 0,
  ...o,
});

describe("ww81 army composition", () => {
  test("armour gathers in one shock army; a lone first one opens it", () => {
    expect(trainTargetArmy(true, [f(1, 10), f(2, 8, 4)])).toBe(2);
    expect(trainTargetArmy(true, [f(1, 10)])).toBe(0);
    // A full armour half stays closed.
    expect(trainTargetArmy(true, [f(2, 20, 12)])).toBe(0);
  });
  test("line fills a shock army only while it stays a third armour", () => {
    expect(trainTargetArmy(false, [f(1, 5), f(2, 6, 3)])).toBe(2);
    // 4:20 is the trap: no line joins it, the smallest line army does.
    expect(trainTargetArmy(false, [f(1, 12), f(2, 20, 4)])).toBe(1);
  });
  test("a one-division forming army is a target (no chain)", () => {
    expect(trainTargetArmy(false, [f(7, 1)])).toBe(7);
  });
  test("merge: smallest into a good partner, never 20:4, readiness keeps", () => {
    const km = (a: number, b: number) => Math.abs(a - b);
    const r = chooseMerge([m(1, 2), m(2, 10, 0, { planBp: 5 })], km);
    expect(r).toEqual({ army: 1, into: 2, near: false });
    // Armour into a 20-line army would be under a third: refused.
    expect(chooseMerge([m(1, 3, 2), m(2, 20)], km)).toBeNull();
    // Different enemies' fronts stay apart.
    expect(
      chooseMerge([m(1, 2, 0, { front: 4 }), m(2, 5, 0, { front: 9 })], km),
    ).toBeNull();
    // Over 24 is refused.
    expect(chooseMerge([m(1, 5), m(2, 20)], km)).toBeNull();
  });
  test("role: shock or main sector attacks", () => {
    expect(judgeRole(f(1, 12, 6), null)).toBe("offence");
    expect(judgeRole(f(1, 20, 2), null)).toBe("defence");
    expect(judgeRole(f(1, 20, 2), true)).toBe("offence");
  });
  test("width follows the battle's fill rule", () => {
    for (const w of [17, 18, 21, 22, 30]) {
      expect(widthPenaltyBp(w)).toBeGreaterThanOrEqual(widthPenaltyBp(24) * 0);
    }
    expect(widthPenaltyBp(24)).toBeGreaterThan(widthPenaltyBp(22));
    expect(widthPenaltyBp(27)).toBeGreaterThan(widthPenaltyBp(22));
    expect(chooseShape(24, [{ index: 0, width: 22, delta: -1 }], -1)).toBe(0);
    expect(chooseShape(22, [{ index: 0, width: 24, delta: 1 }], 1)).toBe(-1);
  });
  test("the merge toggle is its own bit", () => {
    expect(DIRECT_MERGE & 7).toBe(0);
  });
});

describe("ww81 merge toggle", () => {
  test("army_direct merge sets only its bit, keeps auto, other orders keep it", async () => {
    const runner = await wwRunner({ historicalAi: false }, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const l = land(g);
    const deu = byTag(g, "DEU").smallID();
    const a = l.armiesOf(deu)[0];
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    expect(l.issue(deu, { kind: "army_direct", army: a.id, merge: true })).toBe(
      null,
    );
    expect(a.dflags).toBe(DIRECT_MERGE);
    expect(a.auto).toBe(true);
    l.issue(deu, { kind: "army_direct", army: a.id, advance: true });
    expect(a.dflags).toBe(DIRECT_MERGE | DIRECT_ADVANCE);
    // An ordinary order takes it off auto but leaves the toggle.
    l.issue(deu, { kind: "army_halt", army: a.id });
    expect(a.auto).toBe(false);
    expect(a.dflags & DIRECT_MERGE).toBe(DIRECT_MERGE);
    l.issue(deu, { kind: "army_direct", army: a.id, merge: false });
    expect(a.dflags).toBe(DIRECT_ADVANCE);
  }, 120_000);
});

describe("ww81 anti-tank share", () => {
  const input = (antiTankPct: number) => ({
    personality: "democracy" as const,
    major: true,
    dev: 5,
    hasArmorTech: false,
    hasAssault: false,
    training: 9,
    manpower: 1_000_000,
    counts: { infantry: 30, armor: 0, motorized: 0, mountain: 0, cavalry: 0 },
    antiTankPct,
    templates: [
      { id: 1, key: "infantry", men: 10_000, fillPm: 1000, have: 27 },
      {
        id: 2,
        key: "pre_anti_tank_infantry",
        men: 10_000,
        fillPm: 1000,
        have: 3,
      },
    ],
  });
  test("a tenth of the infantry is anti-tank against armour, a fifth when pierce is short", () => {
    expect(aiTrainPlan(input(0))).toEqual([1]);
    // 3 of 30 is a tenth: a fifth wants more, a tenth does not.
    expect(aiTrainPlan(input(10))).toEqual([1]);
    expect(aiTrainPlan(input(20))).toEqual([2]);
  });
});
