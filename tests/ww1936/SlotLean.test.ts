// Per-slot auto-research leaning (owner request 2026-11-03): a slot that is
// not balanced takes only techs of its area, the tech lands in that slot,
// research_lean sets every current slot, a new slot starts balanced.
import {
  RESEARCH_LEANS,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { reserveResearch } from "@openfront/engine/ww1936/economy/ResearchQueue";
import {
  setResearchLean,
  setSlotLean,
  slotLeanOf,
  startResearch,
} from "@openfront/engine/ww1936/economy/ResearchRun";
import {
  byTag,
  clearStartSetup,
  gameHash,
  HUMAN,
  order,
  step,
  stepTo,
  wwRunner,
} from "./util";

const DEU = [{ clientID: HUMAN, country: "DEU" as const }];
const LEAN = (l: (typeof RESEARCH_LEANS)[number]) => RESEARCH_LEANS.indexOf(l);

async function germany() {
  const runner = await wwRunner({}, DEU);
  step(runner);
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  const deu = byTag(g, "DEU");
  const ce = econ.country(deu.smallID())!;
  clearStartSetup(econ, ce);
  return { runner, g, econ, deu, ce };
}

/** Auto research on, then through the first day's processing. */
function autoDay(
  runner: Awaited<ReturnType<typeof germany>>["runner"],
  id: number,
) {
  step(runner, 1, [
    order(HUMAN, { kind: "auto_set", domain: "research", on: true }),
  ]);
  stepTo(runner, dayStartTick(1, WW_PREP_TICKS) + (id % 7) + 1);
}

const tabOf = (t: string | undefined) =>
  t === undefined ? undefined : WW_TECHS[t as WwTechId].tab;

describe("research leaning per slot", () => {
  test("a strict slot takes its area only, in its own slot, past a waiting reservation", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(ce.totals.slotCount).toBe(3);
    // Slot 0 runs a prerequisite; slot 1 keeps its place for a queued tech
    // waiting on it, so slot 2 is the only free one.
    expect(startResearch(econ, ce, "inf_eq_2")).toBeNull();
    expect(reserveResearch(econ, ce, "inf_eq_3", 1)).toBeNull();
    expect(setSlotLean(econ, ce, 2, "air")).toBeNull();
    autoDay(runner, deu.smallID());
    expect(ce.slots[0]?.tech).toBe("inf_eq_2");
    expect(ce.slots[1]).toBeNull();
    expect(tabOf(ce.slots[2]?.tech)).toBe("air");
  }, 60_000);

  test("slots with different leanings each get what their leaning chose", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(setSlotLean(econ, ce, 0, "navy")).toBeNull();
    expect(setSlotLean(econ, ce, 1, "air")).toBeNull();
    expect(setSlotLean(econ, ce, 2, "army")).toBeNull();
    autoDay(runner, deu.smallID());
    expect(tabOf(ce.slots[0]?.tech)).toBe("naval");
    expect(tabOf(ce.slots[1]?.tech)).toBe("air");
    expect(["infantry", "support", "armour", "artillery"]).toContain(
      tabOf(ce.slots[2]?.tech),
    );
  }, 60_000);

  test("an industry slot takes industry or electronics only", async () => {
    const { runner, econ, deu, ce } = await germany();
    expect(setSlotLean(econ, ce, 1, "industry")).toBeNull();
    autoDay(runner, deu.smallID());
    expect(["industry", "electronics"]).toContain(tabOf(ce.slots[1]?.tech));
  }, 60_000);

  test("an area with nothing left falls back to any tech", async () => {
    const { runner, econ, deu, ce } = await germany();
    for (const id of WW_TECH_IDS)
      if (WW_TECHS[id].tab === "air") ce.researched.add(id);
    expect(setSlotLean(econ, ce, 0, "air")).toBeNull();
    autoDay(runner, deu.smallID());
    expect(ce.slots[0]).not.toBeNull();
    expect(tabOf(ce.slots[0]?.tech)).not.toBe("air");
  }, 60_000);

  test("research_lean sets every current slot; a new slot starts balanced; bad slot and AI refused", async () => {
    const { runner, g, econ, ce } = await germany();
    const n = ce.totals.slotCount;
    const h0 = gameHash(runner);
    step(runner, 1, [order(HUMAN, { kind: "research_lean", lean: "navy" })]);
    expect(ce.slotLeans).toEqual(new Array<number>(n).fill(LEAN("navy")));
    expect(gameHash(runner)).not.toBe(h0);
    ce.totals.slotCount = n + 1;
    expect(slotLeanOf(ce, n)).toBe(0);
    expect(setSlotLean(econ, ce, n + 5, "air")).toBe("bad_slot");
    expect(setResearchLean(econ, ce, "balanced")).toBeNull();
    expect(ce.slotLeans).toEqual([]);
    const pol = econ.country(byTag(g, "POL").smallID())!;
    expect(setSlotLean(econ, pol, 0, "air")).toBe("not_controlled");
  }, 60_000);

  test("snapshot and hash keep the leanings; an old single leaning applies to its slots", async () => {
    const { runner, econ, ce } = await germany();
    const plain = gameHash(runner);
    setSlotLean(econ, ce, 1, "air");
    expect(ce.slotLeans).toEqual([0, LEAN("air")]);
    expect(gameHash(runner)).not.toBe(plain);
    const snap = econ.snapshot();
    const c = snap.countries.find((x) => x.smallID === ce.smallID)!;
    expect(c.slotLeans).toEqual([0, LEAN("air")]);
    ce.slotLeans = [];
    econ.restoreState(snap);
    expect(ce.slotLeans).toEqual([0, LEAN("air")]);
    // A save from before: one leaning for all the slots it had.
    delete c.slotLeans;
    c.researchLean = LEAN("army");
    econ.restoreState(snap);
    expect(ce.slotLeans).toEqual(
      new Array<number>(ce.totals.slotCount).fill(LEAN("army")),
    );
  }, 60_000);
});
