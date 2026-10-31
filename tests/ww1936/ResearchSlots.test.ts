// Research overhaul R1 (changes §1): the slot rule, its sources, the cap,
// the slot chip's view.
import { WW_MAX_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { researchSlotCount } from "@openfront/engine-lib/ww1936/EconomyRules";
import { startResearchSlots } from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  decisionBlock,
  takeDecision,
} from "@openfront/engine/ww1936/politics/Decisions";
import { WW_MAX_EXTRA_RESEARCH_SLOTS } from "@openfront/engine/ww1936/politics/EffectsEcon";
import {
  researchSlotView,
  SCIENCE_DECISION,
} from "@openfront/engine/ww1936/politics/ResearchSlots";
import { describe, expect, it } from "vitest";
import { byTag, HUMAN, pol, POL, step, wwRunner } from "./util";

const givesSlot = (f: (typeof CONTENT.focuses)[number]) =>
  (f.effects ?? []).some((e) => e.kind === "research_slot");

describe("research slots (research overhaul R1)", () => {
  it("start slots by country, the effects' room and the cap", () => {
    expect(
      ["DEU", "GBR", "FRA", "ITA", "JPN"].map((t) =>
        startResearchSlots(t as "DEU"),
      ),
    ).toEqual([3, 3, 3, 3, 3]);
    expect(startResearchSlots("USA")).toBe(4);
    expect(startResearchSlots("SUN")).toBe(4);
    expect(startResearchSlots("POL")).toBe(2);
    expect(WW_MAX_EXTRA_RESEARCH_SLOTS).toBe(4);
    // Factories count for nothing: the start plus the effects, at most 6.
    expect(researchSlotCount(3, 3)).toBe(6);
    expect(researchSlotCount(4, 3)).toBe(WW_MAX_SLOTS);
    expect(researchSlotCount(2, 3)).toBe(5);
  });

  it("two slot focuses in each major's tree and the generic one; the decision for all, once", () => {
    for (const tree of [
      "DEU",
      "GBR",
      "SUN",
      "USA",
      "FRA",
      "ITA",
      "JPN",
      "generic",
    ]) {
      const n = CONTENT.focuses.filter((f) => f.tree === tree && givesSlot(f));
      expect(n.length, tree).toBe(2);
      // The AI takes them early (weight 20).
      for (const f of n) expect(f.ai?.base, f.id).toBe(20);
    }
    const d = CONTENT.decisions.find((x) => x.id === SCIENCE_DECISION)!;
    expect(d.for).toBe("any");
    expect(d.cost?.pp).toBe(100);
    expect(d.cooldownDays).toBeUndefined();
    expect(d.effects).toEqual([{ kind: "research_slot", amount: 1 }]);
    expect(d.ai.base).toBe(40);
  });

  it("the decision: 10 factories and (180 days of war or 50% tension); a slot for good; the chip's dot", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    step(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const p = pol(g);
    const id = byTag(g, "DEU").smallID();
    const c = p.country(id)!;
    const ce = ww.economy.country(id)!;
    c.ppMilli = 300_000;
    p.wtBp = 0;
    ww.economy.refreshTotals(ce, ww.day(g.ticks()), g.ticks());
    const base = ce.totals.slotCount;
    expect(base).toBe(3);
    expect(ce.totals.civ + ce.totals.mil).toBeGreaterThanOrEqual(10);
    // At peace, no tension: not yet.
    expect(decisionBlock(p, id, SCIENCE_DECISION, 0)).toBe(
      "decision_unavailable",
    );
    p.wtBp = 5000;
    expect(decisionBlock(p, id, SCIENCE_DECISION, 0)).toBeNull();
    // The chip: a slot focus (Kaiser Wilhelm Institute) is ready first.
    const v = researchSlotView(p, id, base)!;
    expect(v.sources).toEqual({ start: 3, focus: 0, decision: 0, max: 6 });
    expect(v.hint?.ready).toBe(true);
    expect(
      takeDecision(p, id, SCIENCE_DECISION, 0, g.ticks(), false),
    ).toBeNull();
    expect(c.extraResearchSlots).toBe(1);
    ww.economy.refreshTotals(ce, ww.day(g.ticks()), g.ticks());
    expect(ce.totals.slotCount).toBe(base + 1);
    // Once a game; the slot stays when the tension falls.
    expect(decisionBlock(p, id, SCIENCE_DECISION, 0)).toBe("decision_cooldown");
    p.wtBp = 0;
    ww.economy.refreshTotals(ce, ww.day(g.ticks()), g.ticks());
    expect(ce.totals.slotCount).toBe(base + 1);
    expect(researchSlotView(p, id, ce.totals.slotCount)!.sources).toMatchObject(
      { focus: 0, decision: 1 },
    );
    // At the cap: no hint.
    c.extraResearchSlots = WW_MAX_EXTRA_RESEARCH_SLOTS;
    ww.economy.refreshTotals(ce, ww.day(g.ticks()), g.ticks());
    expect(ce.totals.slotCount).toBe(WW_MAX_SLOTS);
    expect(researchSlotView(p, id, WW_MAX_SLOTS)!.hint).toBeUndefined();
  });
});
