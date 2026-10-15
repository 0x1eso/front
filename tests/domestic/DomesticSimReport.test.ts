import {
  mean,
  milestoneVerdict,
  NationRecord,
  summarize,
} from "../../scripts/domestic-sim-report";

function record(
  personality: string,
  firstNuke: number | null,
  projectStart: number | null,
): NationRecord {
  return {
    personality,
    firstNuke,
    tier1: 5,
    tier2: 13,
    projectStart,
    projectDone: null,
    techs: 9,
    laws: 7,
  };
}

describe("domestic sim report", () => {
  test("verdicts allow the slack around the target range", () => {
    expect(milestoneVerdict(null, [18, 20], 3)).toBe("never");
    expect(milestoneVerdict(15, [18, 20], 3)).toBe("ok");
    expect(milestoneVerdict(14.9, [18, 20], 3)).toBe("below");
    expect(milestoneVerdict(23.1, [18, 20], 3)).toBe("above");
    expect(milestoneVerdict(11, [8, 10], 0)).toBe("above");
  });

  test("means ignore nations that never got there", () => {
    expect(mean([2, null, 4])).toBe(3);
    expect(mean([null])).toBeNull();
  });

  test("each milestone looks at the personalities it is about", () => {
    const rows = summarize([
      record("conqueror", 11, null),
      record("scholar", null, 19),
      record("merchant", 30, null),
    ]);
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get("first nuke (conqueror)")).toMatchObject({
      measured: 11,
      reached: 1,
      total: 1,
      verdict: "ok",
    });
    expect(byLabel.get("project start (scholar, zealot)")).toMatchObject({
      measured: 19,
      reached: 1,
      total: 1,
      verdict: "ok",
    });
    expect(byLabel.get("project done (scholar, zealot)")).toMatchObject({
      measured: null,
      verdict: "never",
    });
    expect(byLabel.get("techs per game")).toMatchObject({
      measured: 9,
      total: 3,
      verdict: "ok",
    });
  });
});
