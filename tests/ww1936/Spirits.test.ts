// World War 1936 P3 (spec §9.1; controller ruling R2): national spirits —
// terms, the same spirit twice, swaps and rules — on the test map
// ww1936pol with the test content.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { buildBlock } from "@openfront/engine/ww1936/economy/Construction";
import { dmzBlocks } from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  addSpirit,
  dmzRegions,
  hasRule,
  removeSpirit,
  ruleValue,
  swapSpirit,
} from "@openfront/engine/ww1936/politics/Spirits";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, stepTo, wwRunner } from "./util";

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      spirits: [
        { id: "gen_t_spirit", stats: { ppGainPct: 10 }, icon: "flag" },
        { id: "t_a", stats: {}, icon: "flag" },
        { id: "t_b", stats: { outputPct: 5 }, icon: "flag" },
        { id: "t_c", stats: {}, icon: "flag" },
        { id: "t_x", stats: { outputPct: -5 }, icon: "flag" },
        {
          id: "t_no_faction",
          stats: {},
          icon: "flag",
          rules: ["no_faction", "free_guarantees"],
        },
        { id: "t_dmz", stats: {}, icon: "flag", rules: [{ dmz: "rhineland" }] },
        {
          id: "t_dmz2",
          stats: {},
          icon: "flag",
          rules: [{ dmz: "french_border_de" }],
        },
        {
          id: "t_gate1",
          stats: {},
          icon: "flag",
          rules: [{ guaranteeGatePct: 20 }, { factionGateMinusPp: 5 }],
        },
        {
          id: "t_gate2",
          stats: {},
          icon: "flag",
          rules: [{ guaranteeGatePct: 10 }, { factionGateMinusPp: 15 }],
        },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }], POL);
  step(runner);
  const g = runner.game;
  const p = pol(g);
  const deu = byTag(g, "DEU").smallID();
  const at = (d: number) =>
    stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (deu % WW_DAY_SPLIT) + 1);
  return { runner, g, p, deu, c: p.country(deu)!, at };
}

describe("national spirits", () => {
  it("a timed spirit goes on its day, on the country's own step", async () => {
    const { p, deu, c, at } = await game();
    at(2);
    addSpirit(p, deu, "gen_t_spirit", 10, 2);
    expect(c.spirits).toEqual([
      { id: "gen_t_spirit", untilDay: 12, addedDay: 2 },
    ]);
    expect(c.stats.ppGainPct).toBe(10);
    at(11);
    expect(c.hasSpirit("gen_t_spirit")).toBe(true);
    at(12);
    expect(c.hasSpirit("gen_t_spirit")).toBe(false);
    expect(c.stats.ppGainPct).toBe(0);
  });

  it("a spirit without days stays for good; removing it ends it", async () => {
    const { p, deu, c, at } = await game();
    addSpirit(p, deu, "gen_t_spirit", undefined, 0);
    expect(c.spirits[0].untilDay).toBe(-1);
    at(40);
    expect(c.hasSpirit("gen_t_spirit")).toBe(true);
    removeSpirit(p, deu, "gen_t_spirit");
    expect(c.spirits).toEqual([]);
    expect(c.stats.ppGainPct).toBe(0);
  });

  it("the same spirit twice is on once, for the longer term", async () => {
    const { p, deu, c } = await game();
    addSpirit(p, deu, "gen_t_spirit", 10, 0);
    addSpirit(p, deu, "gen_t_spirit", 30, 5);
    expect(c.spirits).toEqual([
      { id: "gen_t_spirit", untilDay: 35, addedDay: 0 },
    ]);
    addSpirit(p, deu, "gen_t_spirit", 5, 6);
    expect(c.spirits[0].untilDay).toBe(35);
    // Its stats count once.
    expect(c.stats.ppGainPct).toBe(10);
    addSpirit(p, deu, "gen_t_spirit", undefined, 7);
    expect(c.spirits[0].untilDay).toBe(-1);
    addSpirit(p, deu, "gen_t_spirit", 10, 8);
    expect(c.spirits).toEqual([
      { id: "gen_t_spirit", untilDay: -1, addedDay: 0 },
    ]);
  });

  it("swap keeps the spirit's place", async () => {
    const { p, deu, c } = await game();
    for (const s of ["t_a", "t_b", "t_c"]) addSpirit(p, deu, s, undefined, 0);
    expect(c.stats.outputPct).toBe(5);
    swapSpirit(p, deu, "t_b", "t_x", 4);
    expect(c.spirits.map((s) => s.id)).toEqual(["t_a", "t_x", "t_c"]);
    expect(c.spirits[1]).toEqual({ id: "t_x", untilDay: -1, addedDay: 4 });
    expect(c.stats.outputPct).toBe(-5);
    // Without `from`: an add.
    swapSpirit(p, deu, "t_b", "t_b", 5);
    expect(c.spirits.map((s) => s.id)).toEqual(["t_a", "t_x", "t_c", "t_b"]);
    // Onto a spirit already on: `from` just goes.
    swapSpirit(p, deu, "t_a", "t_c", 6);
    expect(c.spirits.map((s) => s.id)).toEqual(["t_x", "t_c", "t_b"]);
  });

  it("rules: no_faction, dmz and the gates", async () => {
    const { g, p, deu } = await game();
    const ww = g.worldWar()!;
    expect(hasRule(p, deu, "no_faction")).toBe(false);
    expect(dmzRegions(p, deu)).toEqual([]);
    expect(ruleValue(p, deu, "guaranteeGatePct")).toBeNull();
    addSpirit(p, deu, "t_no_faction", undefined, 0);
    expect(hasRule(p, deu, "no_faction")).toBe(true);
    expect(hasRule(p, deu, "free_guarantees")).toBe(true);
    expect(hasRule(p, deu, "no_justify")).toBe(false);
    // {dmz}: the groups' regions, once each, ascending.
    addSpirit(p, deu, "t_dmz2", undefined, 0);
    addSpirit(p, deu, "t_dmz", undefined, 0);
    expect(dmzRegions(p, deu)).toEqual([3, 4]);
    expect(dmzBlocks(ww.land, deu, 4)).toBe(true);
    expect(dmzBlocks(ww.land, byTag(g, "POL").smallID(), 4)).toBe(false);
    const ce = ww.economy.country(deu)!;
    expect(buildBlock(ww.economy, ce, 4, "fort", 1)).toBe("not_controlled");
    expect(buildBlock(ww.economy, ce, 4, "infra", 0)).not.toBe(
      "not_controlled",
    );
    removeSpirit(p, deu, "t_dmz2");
    expect(dmzRegions(p, deu)).toEqual([4]);
    // The smallest guarantee gate, the largest faction cut.
    addSpirit(p, deu, "t_gate1", undefined, 0);
    expect(ruleValue(p, deu, "guaranteeGatePct")).toBe(20);
    addSpirit(p, deu, "t_gate2", undefined, 0);
    expect(ruleValue(p, deu, "guaranteeGatePct")).toBe(10);
    expect(ruleValue(p, deu, "factionGateMinusPp")).toBe(15);
  });
});
