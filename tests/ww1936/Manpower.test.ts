import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { manpowerRegrowth } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { stepManpower } from "@openfront/engine/ww1936/economy/Manpower";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { byTag, HUMAN, stamped, step, stepTo, wwRunner } from "./util";

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + 7);
}

const inf = (gen: number) => equipKey("infantry_equipment", gen);

/** Sets the infantry stock, generation 1 first; the rest 0. */
function setInfantry(ce: CountryEconomy, ...byGen: number[]): void {
  for (let gen = 1; gen <= EQUIPMENT_GENS.infantry_equipment; gen++) {
    ce.stock[inf(gen)] = byGen[gen - 1] ?? 0;
  }
}

/** Germany played by a human: no AI economy touches the numbers. */
async function germany() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  const deu = byTag(g, "DEU");
  return { runner, g, econ, deu, ce: econ.country(deu.smallID())! };
}

describe("manpower and the draft (spec §6)", () => {
  test("troops do not grow without infantry equipment", async () => {
    const { runner, g, deu, ce } = await germany();
    setInfantry(ce);
    expect(ce.infStock()).toBe(0);
    const troops = deu.troops();
    finishDay(runner, 0);
    finishDay(runner, 1);
    expect(ce.totals.recruited).toBe(0);
    expect(deu.troops()).toBe(troops);
    expect(ce.manpower).toBeGreaterThan(0);
    // Nothing left to arm: the cap is the army itself.
    expect(g.config().maxTroops(deu)).toBe(troops);
  });

  test("a draft takes manpower and one rifle per ten men, newest first", async () => {
    const { runner, deu, ce } = await germany();
    setInfantry(ce, 100, 50);
    const troops = deu.troops();
    const units = ce.fieldInfUnits;
    const genSum = ce.fieldInfGenSum;
    finishDay(runner, 0);
    // Plenty of manpower; 150 rifles arm 1,500 men, under the training cap.
    expect(ce.totals.trainCap).toBeGreaterThan(1_500);
    expect(ce.totals.recruited).toBe(Math.min(1_500, ce.totals.trainCap));
    expect(deu.troops()).toBe(troops + 1_500);
    // Regrowth stopped at the ceiling (1,675,000 - 480,000), then the draft.
    expect(ce.manpower).toBe(1_195_000 - 1_500);
    expect([ce.stock[inf(1)], ce.stock[inf(2)]]).toEqual([0, 0]);
    expect(ce.fieldInfUnits).toBe(units + 150);
    expect(ce.fieldInfGenSum).toBe(genSum + 100 * 1 + 50 * 2);

    // Only 600 men to draft: 60 rifles, generation 2 first.
    setInfantry(ce, 100, 50);
    ce.manpower = 600 - manpowerRegrowth(ce.totals.recruitable);
    finishDay(runner, 1);
    expect(ce.totals.recruited).toBe(600);
    expect(ce.manpower).toBe(0);
    expect([ce.stock[inf(1)], ce.stock[inf(2)]]).toEqual([90, 0]);
    expect(ce.fieldInfUnits).toBe(units + 150 + 60);
    expect(ce.fieldInfGenSum).toBe(genSum + 200 + 50 * 2 + 10 * 1);
    expect(deu.troops()).toBe(troops + 2_100);
  });

  test("a part of ten men still takes a whole rifle", async () => {
    const { runner, ce } = await germany();
    // Only the day's regrowth to draft: 458 men take 46 rifles.
    setInfantry(ce, 46);
    ce.manpower = 0;
    finishDay(runner, 0);
    expect(ce.totals.recruited).toBe(458);
    expect(ce.stock[inf(1)]).toBe(0);
  });

  test("manpower regrows a tenth a year and stops at the ceiling", async () => {
    const { runner, deu, ce } = await germany();
    // No rifles: nothing drafted, so manpower shows the growth alone.
    setInfantry(ce);
    ce.manpower = 0;
    finishDay(runner, 0);
    expect(ce.totals.recruitable).toBe(1_675_000);
    expect(ce.manpower).toBe(Math.floor(ce.totals.recruitable / 3650));
    expect(ce.manpower).toBe(458);
    ce.manpower = ce.totals.recruitable;
    finishDay(runner, 1);
    expect(ce.manpower).toBe(ce.totals.recruitable - deu.troops());
    expect(ce.manpower).toBe(1_195_000);
  });

  test("men away at sea count against the ceiling", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "GBR" }]);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const [gbr, ita] = (["GBR", "ITA"] as const).map((t) => byTag(g, t));
    const ce = econ.country(gbr.smallID())!;
    stepTo(runner, WW_PREP_TICKS + 1);
    step(runner, 1, [
      stamped(HUMAN, { type: "declare_war", target: ita.id() }),
    ]);
    // Through Britain's day-0 step (tick 603): its draft is done.
    step(runner, 2);
    const army = gbr.troops();
    step(runner, 1, [
      stamped(HUMAN, { type: "boat", troops: 50_000, dst: g.ref(65, 99) }),
    ]);
    step(runner, 2);
    const [boat] = gbr.units(UnitType.TransportShip);
    expect(boat.troops()).toBe(50_000);
    expect(gbr.troops()).toBe(army - 50_000);
    expect(econ.armyMen(gbr)).toBe(army);
    // The 50,000 on the boat are still the army's: no manpower for them.
    ce.manpower = ce.totals.recruitable;
    stepManpower(econ, ce, gbr);
    expect(ce.manpower).toBe(ce.totals.recruitable - army);
  });

  test("the troop cap is the army plus what can still be drafted", async () => {
    const { runner, g, deu, ce } = await germany();
    finishDay(runner, 0);
    // A full day's draft took the training cap.
    expect(ce.totals.recruited).toBe(ce.totals.trainCap);
    const cap = deu.troops() + Math.min(ce.manpower, ce.infStock() * 10);
    expect(ce.totals.troopCap).toBe(cap);
    expect(deu.wwTroopCap()).toBe(cap);
    expect(g.config().maxTroops(deu)).toBe(cap);
    // Manpower runs out: the rifles alone add nothing.
    ce.manpower = 0;
    finishDay(runner, 1);
    expect(ce.totals.recruited).toBe(manpowerRegrowth(ce.totals.recruitable));
    expect(ce.manpower).toBe(0);
    expect(g.config().maxTroops(deu)).toBe(deu.troops());
  });
});
