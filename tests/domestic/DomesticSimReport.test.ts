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
  death: number | null = null,
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
    death,
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
      strict: "ok",
    });
  });

  test("only nations alive when a milestone is due count", () => {
    const early = { ...record("merchant", null, null, 3), techs: 2, tier1: 2 };
    const late = { ...record("merchant", null, null, 25), techs: 12 };
    const rows = summarize([
      early,
      record("merchant", null, null, 10),
      late,
      record("merchant", null, null),
    ]);
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    // Tier 1 is due by minute 6: the nation that died at 3 doesn't count.
    expect(byLabel.get("government tier 1")).toMatchObject({
      measured: 5,
      reached: 3,
      total: 3,
    });
    // Techs per game: the nations alive at minute 20, (12 + 9) / 2.
    expect(byLabel.get("techs per game")).toMatchObject({
      measured: 10.5,
      total: 2,
    });
  });

  test("strict verdicts allow no slack", () => {
    const rows = summarize([{ ...record("merchant", null, null), tier1: 3 }]);
    const tier1 = rows.find((r) => r.label === "government tier 1");
    expect(tier1).toMatchObject({ verdict: "ok", strict: "below" });
  });
});

describe("domestic sim report: reach and run length", () => {
  test("a milestone fewer than half the nations reach is rare, whatever its mean", () => {
    const rows = summarize([
      record("scholar", null, 19),
      record("scholar", null, null),
      record("zealot", null, null),
    ]);
    expect(
      rows.find((r) => r.label === "project start (scholar, zealot)"),
    ).toMatchObject({
      measured: 19,
      reached: 1,
      total: 3,
      verdict: "rare",
      strict: "rare",
    });
  });

  test("half the nations is enough", () => {
    const rows = summarize([
      record("scholar", null, 19),
      record("zealot", null, null),
    ]);
    expect(
      rows.find((r) => r.label === "project start (scholar, zealot)"),
    ).toMatchObject({ verdict: "ok", strict: "ok" });
  });

  test("a milestone due after the run's end is short", () => {
    const rows = summarize([record("scholar", 11, 19)], 10);
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get("government tier 1")).toMatchObject({ verdict: "ok" });
    expect(byLabel.get("project start (scholar, zealot)")).toMatchObject({
      verdict: "short",
      strict: "short",
    });
    expect(byLabel.get("techs per game")).toMatchObject({ verdict: "short" });
  });
});
