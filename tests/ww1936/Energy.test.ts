// World War 1936 P6 lane W1 (plan Task 7 Step 1, spec §16.2): coal, energy
// and power plants on the deep test map. The countries are human (no P1–P6
// AI moves their numbers); demand and supply come from the DEEP facts.
import {
  COAL_PER_REFINERY,
  ENERGY_PER_COAL,
  ENERGY_PER_HYDRO,
  ENERGY_PER_PLANT,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { lineOutputMilli } from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  energyPenaltyPct,
  energyRatioPm,
} from "@openfront/engine-lib/ww1936/EnergyRules";
import {
  applyEnergyEffect,
  coalAvailable,
  coalDemand,
  dailyEnergy,
  energyDemand,
  energyParts,
  energyView,
} from "@openfront/engine/ww1936/depth/Energy";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { stepProduction } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const COAL = RESOURCE_IDS.indexOf("coal");

async function deep(country: "ITA" | "DEU") {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country }], DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, id: DEEP.tag[country] };
}

/** The country's regions' sum of a DEEP region table. */
function sumOf(
  ww: WorldWar,
  id: number,
  table: Readonly<Record<number, number>>,
): number {
  return ww.economy.regionsOf(id).reduce((a, r) => a + (table[r] ?? 0), 0);
}

/** The day's first tick of the next day. */
function nextDay(runner: Awaited<ReturnType<typeof deep>>["runner"]): void {
  const ww = runner.game.worldWar()!;
  const day = ww.day(runner.game.ticks());
  while (ww.day(runner.game.ticks()) === day) step(runner);
}

describe("World War 1936 P6: coal and energy (spec §16.2)", () => {
  it("energy shortage lowers output next day", async () => {
    const { runner, ww, id } = await deep("ITA");
    const d = ww.depth;
    const f = DEEP.factories.ITA;
    const demand = f.civ + f.mil + f.dock;
    expect(energyDemand(d, id)).toBe(demand);
    // Italy: no coal, Rome's hydro.
    expect(sumOf(ww, id, DEEP.coal)).toBe(0);
    const supply = sumOf(ww, id, DEEP.hydro) * ENERGY_PER_HYDRO;
    const pm = energyRatioPm(demand, supply);
    expect(pm).toBeLessThan(1000);
    const notes = vi.spyOn(d, "message");
    nextDay(runner);
    nextDay(runner);
    expect(d.country(id)!.mech.energyPm).toBe(pm);
    expect(d.energyOutputPct(id)).toBe(energyPenaltyPct(pm));
    expect(energyPenaltyPct(pm)).toBeLessThan(0);
    // Once a month: the first short day told the player.
    expect(
      notes.mock.calls.filter(
        (c) => c[0] === id && c[1] === "ww1936_energy_shortage",
      ),
    ).toEqual([[id, "ww1936_energy_shortage", { pct: Math.floor(pm / 10) }]]);
    notes.mockRestore();
    // The next P1 turn's line output carries the cut.
    const econ = ww.economy;
    const ce = econ.country(id)!;
    expect(ce.lines.length).toBeGreaterThan(0);
    stepProduction(econ, ce);
    const eff = ce.lines.map((l) => l.effBp);
    stepProduction(econ, ce);
    const pct = ce.law().outputPct + ce.stats.outputPct + energyPenaltyPct(pm);
    ce.lines.forEach((l, i) => {
      if (l.active === 0) return;
      expect(l.lastOutput).toBe(lineOutputMilli(l.active, eff[i], pct, l.fill));
    });
  }, 60_000);

  it("coal goes to synthetic refineries before energy", async () => {
    const { runner, ww, id } = await deep("DEU");
    const d = ww.depth;
    const econ = ww.economy;
    econ.addBuilding(DEEP.region.berlin, "synthetic_refinery", 2);
    nextDay(runner);
    nextDay(runner);
    const day = ww.day(runner.game.ticks());
    const p = energyParts(d, id, day);
    expect(p.refineries).toBe(2);
    // P1's allocation (plan decision 22): the refineries' 2 each first,
    // then what the energy lacks — before any line.
    const rest = p.hydro * ENERGY_PER_HYDRO + p.dams + p.plants * 6 + p.extra;
    const want =
      2 * COAL_PER_REFINERY +
      Math.ceil(Math.max(0, p.demand - rest) / ENERGY_PER_COAL);
    expect(coalDemand(d, id)).toBe(want);
    const have = coalAvailable(d, id);
    expect(have).toBeGreaterThan(0);
    const got = d.lastPriorityGot.get(id)![COAL];
    expect(got).toBe(Math.min(want, have));
    expect(p.coalGot).toBe(got);
    expect(p.coal).toBe(Math.max(0, got - 2 * COAL_PER_REFINERY));
    // The next depth turn reads this allocation.
    dailyEnergy(d, id, day);
    expect(d.country(id)!.mech.energyPm).toBe(
      energyRatioPm(p.demand, p.supply),
    );
    // The same day without refineries: all the coal is the energy's.
    econ.addBuilding(DEEP.region.berlin, "synthetic_refinery", -2);
    d.lastPriorityGot.delete(id);
    const q = energyParts(d, id, day);
    expect(q.coal).toBe(Math.min(have, coalDemand(d, id)));
    expect(q.coal).toBeGreaterThan(p.coal);
  }, 60_000);

  it("a power plant adds six", async () => {
    const { runner, ww, id } = await deep("ITA");
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    const before = energyParts(d, id, day);
    ww.economy.addBuilding(DEEP.region.rome, "power_plant", 1);
    const after = energyParts(d, id, day);
    expect(after.plants).toBe(before.plants + 1);
    expect(after.supply - before.supply).toBe(ENERGY_PER_PLANT);
    expect(ENERGY_PER_PLANT).toBe(6);
    dailyEnergy(d, id, day);
    expect(d.country(id)!.mech.energyPm).toBe(
      energyRatioPm(after.demand, after.supply),
    );
    // A plant bombed out works no more (P4's effective count).
    damageBuilding(ww.economy, DEEP.region.rome, "power_plant", 1_000);
    expect(energyParts(d, id, day).supply).toBe(before.supply);
  }, 60_000);

  it("the energy effect adds for good; the screen's block", async () => {
    const { runner, ww, id } = await deep("ITA");
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    const before = energyParts(d, id, day).supply;
    applyEnergyEffect(
      makeCtx(ww.politics, id, id, 0, runner.game.ticks()),
      { kind: "energy", amount: 12 },
      id,
    );
    expect(d.country(id)!.mech.energyExtra).toBe(12);
    expect(energyParts(d, id, day).supply).toBe(before + 12);
    const v = energyView(d, id);
    expect(v.extra).toBe(12);
    expect(v.demand).toBe(energyDemand(d, id));
    expect(v.hydro).toBe(sumOf(ww, id, DEEP.hydro));
    const t = ww.economy.country(id)!.totals;
    expect(v.coalStock).toBe(
      Math.max(0, t.produced[COAL] - t.exported[COAL] + t.imported[COAL]),
    );
  }, 60_000);
});
