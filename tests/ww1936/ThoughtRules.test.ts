// World War 1936 military thought sliders (design §5-§6): the curve, the
// budgets, the star bonuses, the start rows.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  THOUGHT_BUDGET_PTS,
  THOUGHT_EDGE_IDS,
  THOUGHT_SLIDER_COUNT,
  THOUGHT_SLIDER_DOMAIN,
  THOUGHT_SLIDERS,
  THOUGHT_START_LIMIT,
} from "@openfront/engine-api/ww1936/ThoughtTypes";
import { START_THOUGHTS } from "@openfront/engine-lib/ww1936/content/depth/thought";
import {
  THOUGHT_ENDS,
  thoughtDaysToGo,
  thoughtNotch,
  thoughtSetBlock,
  thoughtStartPos,
  thoughtStats,
  thoughtStep,
  thoughtValue,
  thoughtWeightPm,
  thoughtYearPct,
} from "@openfront/engine-lib/ww1936/ThoughtRules";

const MID = new Array<number>(THOUGHT_SLIDER_COUNT).fill(0);
const at = (s: number, n: number) => MID.map((_, i) => (i === s ? n : 0));

describe("thought rules", () => {
  it("the weight curve", () => {
    const w = [-10, -9, -5, 0, 5, 9, 10].map(thoughtWeightPm);
    expect(w).toEqual([-100, -31, 225, 500, 725, 869, 900]);
  });

  it("18 ends, 9 sliders, every end's points sum to its service budget", () => {
    expect(THOUGHT_ENDS).toHaveLength(18);
    expect(THOUGHT_EDGE_IDS).toHaveLength(18);
    expect(THOUGHT_SLIDERS).toHaveLength(9);
    THOUGHT_ENDS.forEach((e, i) => {
      const dom = THOUGHT_SLIDER_DOMAIN[i >> 1];
      const sum = e.terms.reduce((a, x) => a + x.pts, 0);
      expect(sum, THOUGHT_EDGE_IDS[i]).toBe(THOUGHT_BUDGET_PTS[dom]);
    });
  });

  it("every key is a stat key", () => {
    const keys = new Set<string>(WW_STAT_KEYS);
    for (const e of THOUGHT_ENDS) {
      for (const k of [...e.terms.map((x) => x.key), ...Object.keys(e.edge)]) {
        expect(keys.has(k), k).toBe(true);
      }
    }
  });

  it("design table: attack and defence at the middle, the end, the far end", () => {
    const s = (n: number) => thoughtStats(at(0, n), 100);
    expect([s(0).attackPct, s(0).defensePct]).toEqual([4, 7]);
    expect([s(-10).attackPct, s(-10).defensePct]).toEqual([7, -1]);
    expect(s(-10).breakthroughPct).toBe(5);
  });

  it("scaled values, year multiplier, no -0", () => {
    expect(thoughtValue(16, -10, 100)).toBe(-1);
    expect(thoughtValue(8, -10, 100)).toBe(0);
    expect(Object.is(thoughtValue(8, -10, 100), 0)).toBe(true);
    expect(thoughtYearPct(1936)).toBe(100);
    expect(thoughtYearPct(1900)).toBe(100);
    expect(thoughtYearPct(1939)).toBe(130);
    expect(thoughtYearPct(1950)).toBe(160);
    expect(thoughtValue(14, 10, thoughtYearPct(1942))).toBe(20);
  });

  it("star bonus lights at 9 notches and is not year-scaled", () => {
    expect(thoughtStats(at(0, 8), 100).riverPenaltyCutPct).toBeUndefined();
    expect(thoughtStats(at(0, -9), 100).riverPenaltyCutPct).toBe(25);
    expect(thoughtStats(at(0, -9), 160).riverPenaltyCutPct).toBe(25);
    expect(thoughtStats(at(0, 9), 100).entrenchMax).toBe(2);
    expect(thoughtStats(MID, 100).entrenchMax).toBeUndefined();
  });

  it("notch, step and days", () => {
    expect(thoughtNotch(499)).toBe(0);
    expect(thoughtNotch(500)).toBe(1);
    expect(thoughtNotch(-500)).toBe(0);
    expect(thoughtNotch(-501)).toBe(-1);
    expect(thoughtStep(0, 10, 100)).toBe(100);
    expect(thoughtStep(950, 10, 100)).toBe(1050);
    expect(thoughtStep(9_950, 10, 100)).toBe(10_000);
    expect(thoughtDaysToGo(-10_000, 10, 100)).toBe(200);
    expect(thoughtSetBlock(0, 11, 0)).toBe("bad_index");
    expect(thoughtSetBlock(0, 3, 3)).toBe("bad_index");
    expect(thoughtSetBlock(0, 3, 0)).toBeNull();
  });

  it("start rows: in range, one per major and leaning, deterministic jitter", () => {
    for (const r of START_THOUGHTS) {
      expect(r.pos).toHaveLength(THOUGHT_SLIDER_COUNT);
      for (const p of r.pos) expect(Math.abs(p)).toBeLessThanOrEqual(10);
    }
    const tags = START_THOUGHTS.map((r) => r.tag);
    for (const t of ["DEU", "SUN", "GBR", "FRA", "USA", "ITA", "JPN"]) {
      expect(tags).toContain(t);
      expect(COUNTRY_TAGS).toContain(t);
    }
    const base = {
      table: START_THOUGHTS,
      tag: "DEU" as const,
      personality: "aggressor" as const,
      historical: true,
      seed: 7,
      id: 3,
    };
    expect(thoughtStartPos({ ...base, jitter: 0 })).toEqual(
      START_THOUGHTS.find((r) => r.tag === "DEU")!.pos,
    );
    const a = thoughtStartPos(base);
    expect(thoughtStartPos(base)).toEqual(a);
    for (const p of a)
      expect(Math.abs(p)).toBeLessThanOrEqual(THOUGHT_START_LIMIT);
    // Historical AI off: the personality's row.
    expect(thoughtStartPos({ ...base, historical: false, jitter: 0 })).toEqual(
      START_THOUGHTS.find((r) => r.tag === "@aggressor")!.pos,
    );
    // No table: all middle.
    expect(thoughtStartPos({ ...base, table: [], jitter: 0 })).toEqual(MID);
  });
});
