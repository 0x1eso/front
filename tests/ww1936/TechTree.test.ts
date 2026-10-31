// Research overhaul (changes §2): the 234-tech tree, its pacing, the
// either/or pair and the project gates.
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  TECH_TABS,
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { RS_STAT_OF_BRANCH } from "@openfront/engine-lib/ww1936/Stats";
import {
  COST_BIG,
  COST_IMP,
  COST_NORMAL,
  techCostMilli,
  techDays,
  techTotals,
  WW_RESEARCH_COST_PM,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, it } from "vitest";
import { en, keyIn, ko } from "./contentUtil";

const NEW = WW_TECH_IDS.slice(146);
const LIVE = WW_TECH_IDS.filter((t) => WW_TECHS[t].retired !== true);

describe("the research tree (research overhaul)", () => {
  it("108 new techs: a def, a tab, a cost, en/ko names, valid prerequisites", () => {
    expect(NEW).toHaveLength(108);
    expect(LIVE).toHaveLength(234);
    const stats = new Set<string>(WW_STAT_KEYS);
    for (const id of WW_TECH_IDS) {
      const d = WW_TECHS[id];
      expect(d.id).toBe(id);
      expect(TECH_TABS).toContain(d.tab);
      expect(d.tab).toBe(d.branch);
      expect([COST_IMP, COST_NORMAL, COST_BIG]).toContain(d.costPm);
      expect(d.year >= 1936 && d.year <= 1945, id).toBe(true);
      for (const k of Object.keys(d.effects))
        expect(stats.has(k), k).toBe(true);
      for (const p of d.prereqs) {
        expect(WW_TECHS[p], `${id} needs ${p}`).toBeDefined();
        expect(WW_TECHS[p].year, `${id} needs ${p}`).toBeLessThanOrEqual(
          d.year,
        );
        if (d.retired !== true) {
          expect(WW_TECHS[p].retired, `${id} needs ${p}`).not.toBe(true);
        }
      }
      if (d.project !== undefined)
        expect(SPECIAL_PROJECTS).toContain(d.project);
      if (d.retired !== true) {
        expect(keyIn(en, `ww1936.tech.${id}`), id).toBeTypeOf("string");
        expect(keyIn(ko, `ww1936.tech.${id}`), id).toBeTypeOf("string");
      }
    }
    // Acyclic: every tech's prerequisites resolve before it (DFS).
    const state = new Map<WwTechId, 1 | 2>();
    const visit = (t: WwTechId): void => {
      expect(state.get(t), `cycle at ${t}`).not.toBe(1);
      if (state.get(t) === 2) return;
      state.set(t, 1);
      WW_TECHS[t].prereqs.forEach(visit);
      state.set(t, 2);
    };
    WW_TECH_IDS.forEach(visit);
    // The support companies moved, nothing else (changes §2.6).
    expect(WW_TECHS.signal_company.branch).toBe("support");
    expect(WW_TECHS.military_police.tab).toBe("support");
    expect(RS_STAT_OF_BRANCH.support).toBe("rsSupportPct");
  });

  it("tabs, years and days as the change list (§2.2, §2.7)", () => {
    const tabs: Record<string, number> = {};
    for (const t of LIVE)
      tabs[WW_TECHS[t].tab] = (tabs[WW_TECHS[t].tab] ?? 0) + 1;
    expect(tabs).toEqual({
      infantry: 21,
      support: 17,
      armour: 28,
      artillery: 19,
      naval: 49,
      air: 41,
      electronics: 22,
      industry: 37,
    });
    const years: Record<number, number> = {};
    for (const t of NEW)
      years[WW_TECHS[t].year] = (years[WW_TECHS[t].year] ?? 0) + 1;
    expect(years).toEqual({
      1937: 5,
      1938: 13,
      1939: 13,
      1940: 16,
      1941: 18,
      1942: 16,
      1943: 11,
      1944: 10,
      1945: 6,
    });
    // The tree without one either/or line: 38,434 days.
    const milli = LIVE.filter((t) => WW_TECHS[t].exclusive?.line !== 1).reduce(
      (n, t) => n + techCostMilli(t),
      0,
    );
    expect(Math.round(milli / 1000)).toBe(38_434);
  });

  it("research days: the year's days × the multiplier × the knob", () => {
    expect(WW_RESEARCH_COST_PM).toBe(1000);
    expect(techCostMilli("inf_eq_2")).toBe(techDays(1939) * 1000);
    expect(techCostMilli("art_imp_2")).toBe(135_000);
    expect(techCostMilli("modern_tank_1")).toBe(318_750);
    expect(techCostMilli("inf_eq_2", 1100)).toBe(techDays(1939) * 1100);
    expect(techCostMilli("art_imp_2", 900)).toBe(121_500);
  });

  it("concentrated ⇄ dispersed: one line only; cancelled, the other opens", () => {
    const base = {
      researched: new Set<WwTechId>(["tools_1", "tools_2"]),
      slots: [null, null] as (WwTechId | null)[],
      slotCount: 2,
    };
    expect(researchBlockOf(base, "dispersed_1")).toBeNull();
    const running = {
      ...base,
      slots: ["concentrated_1", null] as (WwTechId | null)[],
    };
    expect(researchBlockOf(running, "dispersed_1")).toBe("exclusive");
    expect(researchBlockOf(running, "concentrated_1")).toBe("in_progress");
    const done = {
      ...base,
      researched: new Set<WwTechId>([...base.researched, "dispersed_1"]),
    };
    expect(researchBlockOf(done, "concentrated_1")).toBe("exclusive");
    expect(researchBlockOf(done, "dispersed_2")).toBeNull();
    expect(WW_ORDER_BLOCKS.slice(-2)).toEqual(["exclusive", "no_project"]);
  });

  it("four techs wait for their special project", () => {
    const gated = LIVE.filter((t) => WW_TECHS[t].project !== undefined);
    expect(gated.sort()).toEqual(
      ["aa_imp_3", "jet_airframe_2", "jet_bomber_1", "radar_3"].sort(),
    );
    const s = {
      researched: new Set<WwTechId>(["radar_1", "radar_2"]),
      slots: [null] as (WwTechId | null)[],
      slotCount: 1,
    };
    expect(researchBlockOf(s, "radar_3")).toBe("no_project");
    const bit = 1 << SPECIAL_PROJECTS.indexOf("sp_cavity_magnetron");
    expect(researchBlockOf({ ...s, projects: bit }, "radar_3")).toBeNull();
  });

  it("a new tech's stats reach the totals (a new key too)", () => {
    const t = techTotals(
      new Set<WwTechId>(["inf_at_1", "hospital_2", "concentrated_1"]),
    );
    expect(t.infHardPct).toBe(15);
    expect(t.casualtyReturnPp).toBe(10);
    expect(t.outputPct).toBe(5);
  });
});
