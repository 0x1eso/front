// World War 1936 P6 lane I (plan Task 5, spec §19.5, plan decision 39):
// the AI's intelligence — founding (K5's day with historical AI, a seeded
// day in the window without it, PP and development for minors), the
// upgrade order, its operatives' roles and the code-breaking target.
import {
  AGENCY_UPGRADES,
  INTEL_MISSIONS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { P_INTEL_CAPTURE } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  capturePmMilli,
  upgradeBit,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { dailyIntel } from "@openfront/engine/ww1936/depth/Agency";
import {
  AI_FOUND_FROM,
  AI_FOUND_TO,
  aiIntelDay,
  foundDay,
} from "@openfront/engine/ww1936/depth/AiIntel";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { wwRunner } from "./util";

const STARTS = [
  { tag: "DEU" as const, date: "1936-03-01" },
  { tag: "GBR" as const, date: "1936-01-01" },
];
beforeEach(() => usePoliticsContent(depthFixture({ agencyStarts: STARTS })));
afterEach(() => usePoliticsContent(null));

const { DEU, GBR, ITA, FRA, SUN, POL } = DEEP.tag;

describe("World War 1936 P6: the intelligence AI (lane I)", () => {
  it("AI founds its agency on the table date and recruits", async () => {
    const r = await wwRunner({}, [], DEEP.map);
    const d = r.game.worldWar()!.depth;
    const due = dayOfDate("1936-03-01");
    expect(foundDay(d, DEU)).toBe(due);
    aiIntelDay(d, DEU, due - 1);
    expect(d.country(DEU)!.intel.agency).toBe(false);
    aiIntelDay(d, DEU, due);
    const c = d.country(DEU)!;
    expect(c.intel.agency).toBe(true);
    expect(r.game.worldWar()!.politics.country(DEU)!.ppMilli).toBe(0);
    // One slot at first: one recruit, 30 days.
    expect(c.intel.operatives.map((o) => o.recruitLeft)).toEqual([30]);
  });

  it("without historical AI a major founds on a seeded day in the window", async () => {
    const r = await wwRunner({ historicalAi: false }, [], DEEP.map);
    const d = r.game.worldWar()!.depth;
    const days = [DEU, ITA, GBR, FRA, SUN].map((id) => foundDay(d, id));
    for (const day of days) {
      expect(day).toBeGreaterThanOrEqual(dayOfDate(AI_FOUND_FROM));
      expect(day).toBeLessThanOrEqual(dayOfDate(AI_FOUND_TO));
    }
    // K5's day is not used; the majors differ (games vary, owner 2026-10-21).
    expect(days[0]).not.toBe(dayOfDate("1936-03-01"));
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("a minor founds with 150 PP and development 3", async () => {
    const r = await wwRunner({}, [], DEEP.map);
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    ww.politics.country(POL)!.ppMilli = 149_000;
    aiIntelDay(d, POL, 10);
    expect(d.country(POL)!.intel.agency).toBe(false);
    ww.politics.country(POL)!.ppMilli = 150_000;
    // Poland is development 1 on the test map: not yet.
    aiIntelDay(d, POL, 10);
    expect(d.country(POL)!.intel.agency).toBe(false);
    vi.spyOn(ww.scenario, "devOf").mockReturnValue(3);
    aiIntelDay(d, POL, 10);
    expect(d.country(POL)!.intel.agency).toBe(true);
    expect(ww.politics.country(POL)!.ppMilli).toBe(100_000);
  });

  it("at war: the upgrade order, a network on the enemy, codes, counter-intelligence at home", async () => {
    const r = await wwRunner({}, [], DEEP.map);
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    ww.setWar(GBR, DEU, r.game.ticks());
    ww.politics.country(GBR)!.ppMilli = 300_000;
    ww.economy.country(GBR)!.totals.freeCivMilli = 10_000;
    // Its first operative is never caught in these days (a stateless roll).
    const seed = ww.politics.seed;
    const p = capturePmMilli(false, 1, 0, false);
    let uid = 1_000;
    while (
      Array.from({ length: 130 }, (_, i) => i + 1).some(
        (day) => wwRoll(seed, P_INTEL_CAPTURE, uid, day, DEU) % 1_000_000 < p,
      )
    ) {
      uid++;
    }
    d.nextUid = uid;
    const c = d.country(GBR)!;
    aiIntelDay(d, GBR, 0);
    expect(c.intel.agency).toBe(true);
    expect(c.intel.upId).toBe(AGENCY_UPGRADES.indexOf("ag_ops_1"));
    expect(c.intel.cryptoTarget).toBe(DEU);
    let assigned = -1;
    for (let day = 1; day <= 130; day++) {
      d.lastCommonDay = day;
      dailyIntel(d, GBR, day);
      aiIntelDay(d, GBR, day);
      const first = c.intel.operatives[0];
      if (assigned < 0 && first.mission >= 0) {
        assigned = day;
        expect(first.target).toBe(DEU);
        expect(INTEL_MISSIONS[first.mission]).toBe("build_network");
      }
    }
    expect(assigned).toBe(30);
    // ag_ops_1 done on day 90: a second slot, its recruit at home on counter-intelligence.
    expect(c.intel.upgrades & upgradeBit("ag_ops_1")).not.toBe(0);
    expect(c.intel.upId).toBe(AGENCY_UPGRADES.indexOf("ag_crypto_1"));
    const second = c.intel.operatives[1];
    expect(second.target).toBe(GBR);
    expect(INTEL_MISSIONS[second.mission]).toBe("counter_intelligence");
  });
});
