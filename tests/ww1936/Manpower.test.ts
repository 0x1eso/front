import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { manpowerRegrowth } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { stepManpower } from "@openfront/engine/ww1936/economy/Manpower";
import { byTag, clearStartSetup, HUMAN, stepTo, wwRunner } from "./util";

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + 7);
}

/**
 * Germany played by a human: no AI economy or land war touches the
 * numbers, and no starting line makes rifles.
 */
async function germany() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const deu = byTag(g, "DEU");
  const ce = econ.country(deu.smallID())!;
  clearStartSetup(econ, ce);
  return { runner, g, ww, econ, deu, ce };
}

// P2 (plan decision 12, spec §13.2): the daily draft and the troop cap are
// gone; the troops mirror the field divisions, and the manpower ceiling is
// the recruitable pool less the divisions' and the trainees' men.
describe("manpower (spec §6; P2 spec §13.2)", () => {
  test("no draft: the troops are the field divisions' men", async () => {
    const { runner, g, ww, deu, ce } = await germany();
    const troops = deu.troops();
    expect(troops).toBe(ww.land.fieldMen(deu.smallID()));
    const stock = [...ce.stock];
    finishDay(runner, 0);
    finishDay(runner, 1);
    expect(deu.troops()).toBe(troops);
    expect(ce.stock).toEqual(stock);
    expect(ce.manpower).toBeGreaterThan(0);
    // The cap is the army itself; vanilla growth is 0.
    expect(g.config().maxTroops(deu)).toBe(troops);
    expect(g.config().troopIncreaseRate(deu)).toBe(0);
  });

  test("the daily step sets the troops back to the field divisions' men", async () => {
    const { runner, ww, deu } = await germany();
    deu.setTroops(1);
    finishDay(runner, 0);
    expect(deu.troops()).toBe(ww.land.fieldMen(deu.smallID()));
    expect(deu.troops()).toBe(472_500);
  });

  test("manpower regrows a tenth a year and stops at the ceiling", async () => {
    const { runner, deu, ce } = await germany();
    ce.manpower = 0;
    finishDay(runner, 0);
    expect(ce.totals.recruitable).toBe(1_675_000);
    expect(ce.manpower).toBe(Math.floor(ce.totals.recruitable / 3650));
    expect(ce.manpower).toBe(458);
    ce.manpower = ce.totals.recruitable;
    finishDay(runner, 1);
    expect(ce.manpower).toBe(ce.totals.recruitable - deu.troops());
    expect(ce.manpower).toBe(1_202_500);
  });

  test("the dead do not come back: casualties leave the pool for good", async () => {
    const { runner, ww, econ, deu, ce } = await germany();
    finishDay(runner, 0);
    const pool = ce.totals.recruitable;
    expect(pool).toBe(1_675_000);
    // At the ceiling: the army and manpower take the whole pool.
    ce.manpower = pool - econ.armyMen(deu);
    const manpower = ce.manpower;
    // Ten divisions destroyed (P2 spec §9.6): their 105,000 men are dead.
    const t = ww.land.divisions;
    let killed = 0;
    for (let r = 0; r < t.rows && killed < 10; r++) {
      if (t.alive(r) && t.owner[r] === deu.smallID()) {
        ww.land.killDivision(r, true);
        killed++;
      }
    }
    const dead = 10 * 10_500;
    expect(ww.land.country(deu.smallID())!.casualtiesToday).toBe(dead);
    finishDay(runner, 1);
    expect(ce.casualties).toBe(dead);
    expect(ce.totals.recruitable).toBe(pool - dead);
    // No manpower grew into the places of the dead, then or a month on.
    expect(ce.manpower).toBe(manpower);
    finishDay(runner, 31);
    expect(ce.manpower).toBe(manpower);
    expect(ce.totals.recruitable).toBe(pool - dead);
    expect(econ.armyMen(deu) + ce.manpower).toBe(pool - dead);
    expect(deu.troops()).toBe(472_500 - dead);
  });

  test("men in training count against the ceiling", async () => {
    const { runner, ww, econ, deu, ce } = await germany();
    finishDay(runner, 0);
    const field = ww.land.fieldMen(deu.smallID());
    ww.land.country(deu.smallID())!.trainees.push({
      entry: 1,
      template: 1,
      men: 10_500,
      equip: [],
      days: 0,
    });
    expect(econ.armyMen(deu)).toBe(field + 10_500);
    ce.manpower = ce.totals.recruitable;
    stepManpower(econ, ce, deu);
    expect(ce.manpower).toBe(ce.totals.recruitable - field - 10_500);
    // Below the ceiling it grows by the day's regrowth.
    ce.manpower = 0;
    stepManpower(econ, ce, deu);
    expect(ce.manpower).toBe(manpowerRegrowth(ce.totals.recruitable));
  });
});
