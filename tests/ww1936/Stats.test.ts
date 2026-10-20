// World War 1936 P3 (spec §3, plan decisions 9, 10): one stats table for
// every modifier.
import { TECH_BRANCHES } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_STAT_KEYS,
  WW_TECH_STAT_COUNT,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addStatsInto,
  clampStats,
  emptyStats,
  researchSpeedPct,
  RS_STAT_OF_BRANCH,
  statsArray,
  sumStats,
  techStats,
} from "@openfront/engine-lib/ww1936/Stats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, step, wwRunner } from "./util";

describe("politics stats", () => {
  it("the first 34 stat keys are the tech effect keys in order", () => {
    expect(WW_STAT_KEYS.slice(0, WW_TECH_STAT_COUNT)).toEqual(
      Object.keys(techTotals(new Set())),
    );
    expect(WW_TECH_STAT_COUNT).toBe(34);
  });

  it("stat keys are unique: 14 + 20 + 42", () => {
    expect(new Set(WW_STAT_KEYS).size).toBe(WW_STAT_KEYS.length);
    expect(WW_STAT_KEYS).toHaveLength(76);
  });

  it("sums add by key; a missing key is 0", () => {
    const s = sumStats([{ ppGainPct: 10 }, { ppGainPct: -3, attackPct: 5 }]);
    expect(s.ppGainPct).toBe(7);
    expect(s.attackPct).toBe(5);
    expect(s.stabilityBp).toBe(0);
    const t = emptyStats();
    addStatsInto(t, { orgPct: 2 }, 3);
    expect(t.orgPct).toBe(6);
    expect(statsArray({ constructionPct: 4 })[0]).toBe(4);
    expect(statsArray({})).toHaveLength(76);
  });

  it("the tech totals become the first 34 stats", () => {
    const tech = techTotals(new Set(["construction_1", "tools_1"] as const));
    const s = techStats(tech);
    for (const k of WW_STAT_KEYS.slice(0, WW_TECH_STAT_COUNT)) {
      expect(s[k], k).toBe(tech[k as keyof typeof tech]);
    }
    for (const k of WW_STAT_KEYS.slice(WW_TECH_STAT_COUNT))
      expect(s[k], k).toBe(0);
  });

  it("Pct sums are clamped to −90..300", () => {
    const s = clampStats(
      sumStats([
        {
          attackPct: 500,
          ppGainPct: -200,
          stabilityBp: 20_000,
          entrenchMax: 9,
        },
      ]),
    );
    expect(s.attackPct).toBe(300);
    expect(s.ppGainPct).toBe(-90);
    // Not a percentage: kept as summed.
    expect(s.stabilityBp).toBe(20_000);
    expect(s.entrenchMax).toBe(9);
  });

  it("research speed adds the branch's stat to researchPct", () => {
    const s = sumStats([{ researchPct: 5, rsArmorPct: 15, rsAirPct: 7 }]);
    expect(researchSpeedPct(s, "armour")).toBe(20);
    expect(researchSpeedPct(s, "air")).toBe(12);
    expect(researchSpeedPct(s, "infantry")).toBe(5);
    expect(Object.keys(RS_STAT_OF_BRANCH).sort()).toEqual(
      [...TECH_BRANCHES].sort(),
    );
  });

  it("stats with only techs equal the P1 totals", async () => {
    // Spec §3.1: no politics row (test content) — neutral, 50% stability
    // and war support: no government, spirit, advisor or dynamic line.
    usePoliticsContent(politicsFixture());
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    usePoliticsContent(null);
    step(runner);
    const g = runner.game;
    const id = byTag(g, "DEU").smallID();
    const ce = g.worldWar()!.economy.country(id)!;
    expect(ce.stats).toBe(pol(g).country(id)!.stats);
    for (const k of WW_STAT_KEYS.slice(0, WW_TECH_STAT_COUNT)) {
      expect(ce.stats[k], k).toBe(ce.tech[k as keyof typeof ce.tech]);
    }
    for (const k of WW_STAT_KEYS.slice(WW_TECH_STAT_COUNT)) {
      expect(ce.stats[k], k).toBe(0);
    }
  });
});
