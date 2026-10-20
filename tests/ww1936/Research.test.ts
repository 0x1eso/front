import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { addLineBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  aheadPct,
  researchProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { techDays } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import {
  cancelResearch,
  researchBlock,
  startResearch,
} from "@openfront/engine/ww1936/economy/ResearchRun";
import { byTag, HUMAN, stamped, step, stepTo, wwRunnerCapture } from "./util";

/** Runs through `p`'s processing on `day` (tick dayStart + smallID % 7). */
function throughDay(runner: GameRunner, p: Player, day: number): void {
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS) + (p.smallID() % 7) + 1);
}

/** A game where Germany is a human's (no AI economy touches it). */
async function germany() {
  const { runner, updates } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  const deu = byTag(g, "DEU");
  const ce = econ.country(deu.smallID())!;
  return { runner, updates, g, econ, deu, ce };
}

/** The economy messages so far: [key, player, params]. */
function messages(updates: GameUpdateViewData[]) {
  return updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
    .filter(
      (m) =>
        m.message === "events_display.ww1936_research_done" ||
        m.message === "events_display.ww1936_slot_free",
    )
    .map((m) => [m.message, m.playerID, m.params ?? null]);
}

describe("research (spec §9)", () => {
  test("a 1936 tech takes 120 days", async () => {
    const { runner, econ, deu, ce } = await germany();
    // Germany's speed is 0: limited exports, no electronics.
    expect(ce.tech.researchPct + ce.law().researchPct).toBe(0);
    // Ordered during the preparation minute: day 0 is its first day.
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research", tech: "electronics_1" },
      }),
    ]);
    expect(ce.slots).toEqual([
      { tech: "electronics_1", progress: 0 },
      null,
      null,
    ]);
    throughDay(runner, deu, 0);
    expect(ce.slots[0]).toEqual({ tech: "electronics_1", progress: 1000 });
    // The 119th day processed: not yet.
    throughDay(runner, deu, 118);
    expect(ce.slots[0]).toEqual({ tech: "electronics_1", progress: 119_000 });
    expect(ce.researched.has("electronics_1")).toBe(false);
    // The 120th: done, the slot is free and the tech counts.
    throughDay(runner, deu, 119);
    expect(ce.slots).toEqual([null, null, null]);
    expect(ce.researched.has("electronics_1")).toBe(true);
    expect(ce.tech.researchPct).toBe(3);
    expect(econ.country(deu.smallID())).toBe(ce);
  }, 60_000);

  test("a tech years ahead goes slower, a little less so every day", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "inf_eq_2")).toBeNull();
    // 1939 seen from 1 January 1936: three years ahead, a quarter speed.
    expect(aheadPct(1939, 0)).toBe(300);
    throughDay(runner, deu, 0);
    expect(ce.slots[0]!.progress).toBe(researchProgress(0, aheadPct(1939, 0)));
    expect(ce.slots[0]!.progress).toBe(250);
    // The penalty is worked out again every day.
    throughDay(runner, deu, 9);
    let sum = 0;
    for (let d = 0; d <= 9; d++) sum += researchProgress(0, aheadPct(1939, d));
    expect(ce.slots[0]!.progress).toBe(sum);
    expect(researchProgress(0, aheadPct(1939, 400))).toBeGreaterThan(250);
  });

  test("slots, prerequisites, doctrine", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "mobile_1")).toBeNull();
    expect(startResearch(econ, ce, "mobile_1")).toBe("in_progress");
    // One land doctrine school only: mobile warfare closed firepower.
    expect(startResearch(econ, ce, "firepower_1")).toBe("doctrine");
    expect(researchBlock(econ, ce, "mobile_2")).toBe("prereq");
    expect(startResearch(econ, ce, "inf_eq_3")).toBe("prereq");
    expect(startResearch(econ, ce, "tools_1")).toBe("researched");
    expect(startResearch(econ, ce, "electronics_1")).toBeNull();
    // An order on the wire takes the third slot.
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research", tech: "tools_2" },
      }),
    ]);
    expect(ce.slots.map((s) => s?.tech ?? null)).toEqual([
      "mobile_1",
      "electronics_1",
      "tools_2",
    ]);
    expect(startResearch(econ, ce, "inf_eq_2")).toBe("no_slot");
    // A refused order changes nothing.
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "research", tech: "inf_eq_2" },
      }),
    ]);
    expect(ce.slots.map((s) => s?.tech ?? null)).toEqual([
      "mobile_1",
      "electronics_1",
      "tools_2",
    ]);
    // Finished, the school stays: firepower is still closed.
    ce.slots[0]!.progress = techDays(1936) * 1000 - 1;
    throughDay(runner, deu, 0);
    expect(ce.researched.has("mobile_1")).toBe(true);
    expect(startResearch(econ, ce, "mobile_1")).toBe("researched");
    expect(startResearch(econ, ce, "firepower_1")).toBe("doctrine");
    expect(startResearch(econ, ce, "mobile_2")).toBeNull();
    expect(ce.slots[0]!.tech).toBe("mobile_2");
  });

  test("completion unlocks the generation", async () => {
    const { runner, econ, deu, ce } = await germany();
    const inf2 = () =>
      addLineBlockOf(ce.researched, ce.lines.length, "infantry_equipment", 2);
    expect(inf2()).toBe("no_tech");
    expect(startResearch(econ, ce, "inf_eq_2")).toBeNull();
    ce.slots[0]!.progress = techDays(1939) * 1000 - 1;
    throughDay(runner, deu, 0);
    expect(ce.researched.has("inf_eq_2")).toBe(true);
    expect(ce.slots[0]).toBeNull();
    expect(inf2()).toBeNull();
    expect(addLine(econ, ce, "infantry_equipment", 2, 1)).toBeNull();
    // addTech keeps the set in WW_TECH_IDS order (as a restore builds it).
    expect([...ce.researched]).toEqual(
      WW_TECH_IDS.filter((id) => ce.researched.has(id)),
    );
  });

  test("only humans hear of it", async () => {
    const { runner, updates, g, econ, deu, ce } = await germany();
    const ita = byTag(g, "ITA");
    const ceIta = econ.country(ita.smallID())!;
    for (const c of [ce, ceIta]) {
      expect(startResearch(econ, c, "electronics_1")).toBeNull();
      c.slots[0]!.progress = techDays(1936) * 1000 - 1000;
    }
    throughDay(runner, ita, 0);
    expect(ce.researched.has("electronics_1")).toBe(true);
    expect(ceIta.researched.has("electronics_1")).toBe(true);
    expect(messages(updates)).toEqual([
      [
        "events_display.ww1936_research_done",
        deu.smallID(),
        { tech: "electronics_1" },
      ],
    ]);
  });

  test("cancelling frees the slot and drops the progress", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(startResearch(econ, ce, "electronics_1")).toBeNull();
    throughDay(runner, deu, 4);
    expect(ce.slots[0]).toEqual({ tech: "electronics_1", progress: 5000 });
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "cancel_research", slot: 0 },
      }),
    ]);
    expect(ce.slots).toEqual([null, null, null]);
    expect(ce.researched.has("electronics_1")).toBe(false);
    expect(cancelResearch(econ, ce, 0)).toBe("bad_slot");
    expect(cancelResearch(econ, ce, 3)).toBe("bad_slot");
    expect(startResearch(econ, ce, "electronics_1")).toBeNull();
    expect(ce.slots[0]).toEqual({ tech: "electronics_1", progress: 0 });
  });

  test("a new slot is told once; a lost one pauses", async () => {
    const { runner, updates, g, econ, deu, ce } = await germany();
    const berlin = g
      .worldWar()!
      .scenario.landRegions.find((r) => r.name === "Berlin")!.id;
    for (const t of ["electronics_1", "tools_2", "inf_eq_2"] as const) {
      expect(startResearch(econ, ce, t)).toBeNull();
    }
    throughDay(runner, deu, 0);
    // Day 0 brings no news: every slot existed from the start.
    expect(messages(updates)).toEqual([]);
    // 15 factories → 55: a fourth slot the next day.
    econ.addBuilding(berlin, "civ", 40);
    throughDay(runner, deu, 1);
    expect(ce.totals.slotCount).toBe(4);
    expect(ce.slots).toHaveLength(4);
    expect(ce.slots[3]).toBeNull();
    const told = [["events_display.ww1936_slot_free", deu.smallID(), null]];
    expect(messages(updates)).toEqual(told);
    expect(startResearch(econ, ce, "support_eq_2")).toBeNull();
    expect(ce.slots[3]!.tech).toBe("support_eq_2");
    throughDay(runner, deu, 2);
    const paused = ce.slots[3]!.progress;
    expect(paused).toBeGreaterThan(0);
    // Back to 15 factories: the fourth slot stops, its progress kept.
    econ.addBuilding(berlin, "civ", -40);
    throughDay(runner, deu, 4);
    expect(ce.totals.slotCount).toBe(3);
    expect(ce.slots[3]).toEqual({ tech: "support_eq_2", progress: paused });
    expect(ce.slots[0]!.progress).toBe(5000);
    expect(startResearch(econ, ce, "computing_1")).toBe("prereq");
    expect(startResearch(econ, ce, "construction_2")).toBe("no_slot");
    // And again: the slot is back, not new; nothing more is told.
    econ.addBuilding(berlin, "civ", 40);
    throughDay(runner, deu, 5);
    expect(ce.slots[3]!.progress).toBeGreaterThan(paused);
    expect(messages(updates)).toEqual(told);
  });
});
