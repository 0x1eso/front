// ww83, owner request 2026-11-05: by the end of a timed game (1946-09-25) a
// major has researched at least 80% of the tree, and the cheap research does
// not bring late gear years early. Calculated, no game: every day runs the
// engine's own numbers (researchProgress, aheadPct, techCostMilli) at normal
// speed with the start slots only. No research bonus, focus slot or special
// project counts, so a real game runs ahead of these figures.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  AHEAD_LATE_PCT,
  aheadPct,
  researchProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  isMajor,
  navalStartTechs,
  startResearchSlots,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { HIST_COUNTRIES } from "@openfront/engine-lib/ww1936/hist/Types";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import { researchPersonaOf } from "@openfront/engine-lib/ww1936/ResearchScore";
import {
  techCostMilli,
  WW_RESEARCH_COST_PM,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, it } from "vitest";
import {
  AiInput,
  AiOrder,
  planResearch,
} from "../../packages/engine/src/ww1936/economy/AiEconomy";

const END = dayOfDate("1946-09-25");
const DEV_MAJOR = 4;

function startSet(tag: CountryTag, dev: number): Set<WwTechId> {
  const out = new Set<WwTechId>();
  const add = (t: WwTechId) => {
    out.add(t);
    for (const old of WW_TECHS[t].absorbs ?? []) out.add(old);
  };
  const major = isMajor(tag);
  startTechs(tag, major ? 99_999 : 0).forEach(add);
  landStartTechs(tag, major, dev).forEach(add);
  navalStartTechs(tag, dev, true).forEach(add);
  return out;
}

interface Run {
  /** Percent of the tree's days done (one either/or line, start techs left out). */
  pct: number;
  /** Day each tech finished. */
  done: Map<WwTechId, number>;
  /** Slot-days empty, by year from 1936. */
  idle: number[];
}

type Picker = (
  day: number,
  researched: ReadonlySet<WwTechId>,
  running: readonly (WwTechId | null)[],
) => WwTechId[];

/** One country's research from day 0 to the end, slots refilled by `pick`. */
function runTree(tag: CountryTag, dev: number, pick: Picker): Run {
  const researched = startSet(tag, dev);
  const todo = WW_TECH_IDS.filter(
    (t) =>
      WW_TECHS[t].retired !== true &&
      WW_TECHS[t].exclusive?.line !== 1 &&
      !researched.has(t),
  );
  const slots: ({ tech: WwTechId; milli: number } | null)[] = new Array(
    startResearchSlots(tag),
  ).fill(null);
  const done = new Map<WwTechId, number>();
  const idle = new Array<number>(11).fill(0);
  let milli = 0;
  for (let day = 0; day < END; day++) {
    if (slots.includes(null)) {
      const next = pick(
        day,
        researched,
        slots.map((s) => s?.tech ?? null),
      );
      for (const tech of next) {
        const k = slots.indexOf(null);
        if (k >= 0) slots[k] = { tech, milli: 0 };
      }
    }
    slots.forEach((s, k) => {
      if (s === null) {
        idle[Math.floor(day / 366)]++;
        return;
      }
      s.milli += researchProgress(0, aheadPct(WW_TECHS[s.tech].year, day));
      if (s.milli < techCostMilli(s.tech)) return;
      researched.add(s.tech);
      for (const old of WW_TECHS[s.tech].absorbs ?? []) researched.add(old);
      done.set(s.tech, day);
      milli += techCostMilli(s.tech);
      slots[k] = null;
    });
  }
  const total = todo.reduce((n, t) => n + techCostMilli(t), 0);
  return { pct: (milli * 100) / total, done, idle };
}

const open = (t: WwTechId, researched: ReadonlySet<WwTechId>) =>
  WW_TECHS[t].retired !== true &&
  WW_TECHS[t].exclusive?.line !== 1 &&
  WW_TECHS[t].project === undefined &&
  !researched.has(t) &&
  WW_TECHS[t].prereqs.every((p) => researched.has(p));

/** A careful player: the least early open tech, the shortest of those. */
function leastEarly(first: readonly WwTechId[] = []): Picker {
  return (day, researched, running) => {
    const taken = new Set(running);
    const out: WwTechId[] = [];
    for (
      let free = running.filter((t) => t === null).length;
      free > 0;
      free--
    ) {
      const list = WW_TECH_IDS.filter(
        (t) => open(t, researched) && !taken.has(t),
      );
      const rush = first.find((t) => list.includes(t));
      const best =
        rush ??
        list.sort(
          (a, b) =>
            aheadPct(WW_TECHS[a].year, day) - aheadPct(WW_TECHS[b].year, day) ||
            techCostMilli(a) - techCostMilli(b),
        )[0];
      if (best === undefined) break;
      taken.add(best);
      out.push(best);
    }
    return out;
  };
}

/** The AI's own research turn on an empty economy. */
function aiPlan(tag: CountryTag, seed: number): Picker {
  const slotCount = startResearchSlots(tag);
  return (day, researched, running) => {
    const orders: AiOrder[] = [];
    planResearch(
      {
        tag,
        personality: researchPersonaOf(tag),
        day,
        researched: [...researched],
        slots: [...running],
        slotCount,
        coastal: true,
        lines: [],
        research: {
          seed,
          smallID: 3,
          navalLines: 2,
          bonusKeys: [],
          shared: [],
          projects: 0,
        },
      } as unknown as AiInput,
      orders,
    );
    return orders.flatMap((o) => (o.kind === "research" ? [o.tech] : []));
  };
}

/** A tech and what it needs, prerequisites first. */
function chainTo(t: WwTechId): WwTechId[] {
  const out: WwTechId[] = [];
  const visit = (x: WwTechId) => {
    if (out.includes(x)) return;
    WW_TECHS[x].prereqs.forEach(visit);
    out.push(x);
  };
  visit(t);
  return out;
}

describe("research pace (ww83)", () => {
  it("the knob and the steep part of the ahead-of-time cost", () => {
    expect(WW_RESEARCH_COST_PM).toBe(350);
    expect(AHEAD_LATE_PCT).toBe(600);
    // 1936 has 366 days: day 1 is one year and two years before these.
    expect(aheadPct(1937, 1)).toBe(100);
    expect(aheadPct(1938, 1)).toBe(100 + 600);
    expect(aheadPct(1936, 0)).toBe(0);
  });

  it("every major researches 80% of the tree in a careful order", () => {
    for (const tag of HIST_COUNTRIES) {
      const r = runTree(tag, DEV_MAJOR, leastEarly());
      expect(r.pct, tag).toBeGreaterThanOrEqual(85);
      expect(
        r.idle.slice(0, 9).every((n) => n === 0),
        tag,
      ).toBe(true);
    }
  });

  it("every AI major researches 80% of the tree, no slot waiting", () => {
    for (const tag of HIST_COUNTRIES) {
      for (const seed of [1, 987_654]) {
        const r = runTree(tag, DEV_MAJOR, aiPlan(tag, seed));
        expect(r.pct, `${tag} ${seed}`).toBeGreaterThanOrEqual(80);
        // Empty only when its list ends, in the last years.
        expect(
          r.idle.slice(0, 9).every((n) => n === 0),
          tag,
        ).toBe(true);
      }
    }
  });

  it("a minor reaches about half of the tree with its two slots", () => {
    for (const dev of [2, 3]) {
      const r = runTree("POL", dev, leastEarly());
      expect(r.pct).toBeGreaterThanOrEqual(50);
      expect(r.pct).toBeLessThanOrEqual(62);
    }
  });

  // Run first by a major, at normal speed, projects assumed done.
  it("late gear comes at most about two years early", () => {
    const openProject = (first: readonly WwTechId[]): Picker => {
      const pick = leastEarly(first);
      return (day, researched, running) => {
        const next = first.find(
          (t) =>
            !researched.has(t) &&
            !running.includes(t) &&
            WW_TECHS[t].prereqs.every((p) => researched.has(p)),
        );
        const rest = pick(day, researched, running);
        return next === undefined ? rest : [next, ...rest];
      };
    };
    for (const [tech, earliest] of [
      ["medium_tank_3", "1941-01-01"],
      ["tank_gun_4", "1942-01-01"],
      ["fighter_3", "1942-01-01"],
      ["jet_airframe_2", "1943-01-01"],
    ] as const) {
      for (const tag of ["DEU", "SUN"] as const) {
        const r = runTree(tag, DEV_MAJOR, openProject(chainTo(tech)));
        expect(r.done.get(tech), `${tag} ${tech}`).toBeGreaterThanOrEqual(
          dayOfDate(earliest),
        );
      }
    }
  });
});
