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
    // P2 Task 5: the winter's attrition takes men and reinforcement brings
    // some back from manpower; nothing drafts more, no line makes more.
    expect(deu.troops()).toBe(ww.land.fieldMen(deu.smallID()));
    expect(deu.troops()).toBeLessThanOrEqual(troops);
    ce.stock.forEach((n, k) => expect(n).toBeLessThanOrEqual(stock[k]));
    expect(ce.manpower).toBeGreaterThan(0);
    // The cap is the army itself; vanilla growth is 0.
    expect(g.config().maxTroops(deu)).toBe(deu.troops());
    expect(g.config().troopIncreaseRate(deu)).toBe(0);
  });

  test("the daily step sets the troops back to the field divisions' men", async () => {
    const { runner, ww, deu } = await germany();
    deu.setTroops(1);
    finishDay(runner, 0);
    expect(deu.troops()).toBe(ww.land.fieldMen(deu.smallID()));
    // The start's men less the day's winter attrition (P2 Task 5).
    expect(deu.troops()).toBe(
      350_000 - ww.land.country(deu.smallID())!.casualtiesToday,
    );
  });

  test("manpower regrows a tenth a year and stops at the ceiling", async () => {
    const { runner, ww, deu, ce } = await germany();
    ce.manpower = 0;
    // ww9: the thought sliders' start positions give Germany recruitablePct +1 (1,675,000 -> 1,691,750).
    finishDay(runner, 0);
    expect(ce.totals.recruitable).toBe(1_691_750);
    expect(ce.manpower).toBe(Math.floor(ce.totals.recruitable / 3650));
    expect(ce.manpower).toBe(463);
    // At the ceiling the pool stops growing.
    const ceiling = ce.totals.recruitable - ww.economy.armyMen(deu);
    ce.manpower = ceiling;
    finishDay(runner, 1);
    // P2 Task 5: after the economy's step the land's day reinforces the
    // divisions from manpower for yesterday's winter attrition (its dead
    // already left the pool), then today's attrition takes its men (Task
    // 11: Berlin's and Munich's winters are temperate and a division at
    // rest takes a quarter, so a day may take none).
    const winter = ww.land.country(deu.smallID())!.casualtiesToday;
    expect(winter).toBeGreaterThanOrEqual(0);
    expect(ce.manpower).toBeLessThanOrEqual(ceiling);
    expect(ce.manpower).toBeGreaterThanOrEqual(ceiling - winter);
  });

  test("T7: past the ceiling manpower stays; the growth stops", async () => {
    const { runner, econ, deu, ce } = await germany();
    finishDay(runner, 0);
    // The land is lost: the pool's regions no longer cover the army.
    const before = 1_000_000;
    ce.manpower = before;
    ce.totals.recruitable = econ.armyMen(deu) - 1;
    stepManpower(econ, ce, deu);
    expect(ce.manpower).toBe(before);
  });

  test("a continental winter takes no men: Poland in January (ww84)", async () => {
    // Warsaw and Krakow are continental (snow or frost all January), but
    // weather left attrition with the overhaul: an army at rest in supply
    // loses nobody.
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const ww = runner.game.worldWar()!;
    const pol = byTag(runner.game, "POL");
    finishDay(runner, 0);
    finishDay(runner, 1);
    expect(ww.land.country(pol.smallID())!.casualtiesToday).toBe(0);
  });

  test("T7: the casualty debt opens the ceiling again, 5 % a year", async () => {
    const { runner, econ, deu, ce } = await germany();
    finishDay(runner, 0);
    ce.casualties = 1_000_000;
    ce.manpower = 0;
    const step = () => {
      econ.refreshTotals(ce, 0, runner.game.ticks());
      stepManpower(econ, ce, deu);
    };
    step();
    const open = ce.totals.recruitable;
    for (let d = 0; d < 365; d++) step();
    expect(ce.casualties).toBeLessThan(952_000);
    expect(ce.totals.recruitable - open).toBeGreaterThan(48_000);
  });

  test("the dead leave the pool: only the debt's slow fall gives them back", async () => {
    const { runner, ww, econ, deu, ce } = await germany();
    finishDay(runner, 0);
    const pool = ce.totals.recruitable;
    expect(pool).toBe(1_691_750);
    // P2 Task 5: the day's winter attrition killed some already.
    const cl = ww.land.country(deu.smallID())!;
    const winter = cl.casualtiesToday;
    expect(ce.casualties).toBe(winter);
    // At the ceiling: the army and manpower take the whole pool.
    ce.manpower = pool - winter - econ.armyMen(deu);
    const manpower = ce.manpower;
    // Ten divisions destroyed (P2 spec §9.6): their men (10,500 each, less
    // the winter's) are dead.
    const t = ww.land.divisions;
    let killed = 0;
    let dead = 0;
    for (let r = 0; r < t.rows && killed < 10; r++) {
      if (t.alive(r) && t.owner[r] === deu.smallID()) {
        dead += t.men[r];
        ww.land.killDivision(r, true);
        killed++;
      }
    }
    expect(dead).toBe(10 * 7_000 - (winter * 10) / 50);
    expect(cl.casualtiesToday).toBe(winter + dead);
    finishDay(runner, 1);
    expect(ce.totals.recruitable).toBe(pool - winter - dead);
    // No manpower grew into the places of the dead, then or a month on
    // past the debt's fall, a few men a day (it only pays for the winter's
    // losses).
    expect(ce.manpower).toBeLessThanOrEqual(manpower + 10);
    finishDay(runner, 31);
    expect(ce.manpower).toBeLessThanOrEqual(manpower + 31 * 10);
    // The pool is less the debt: every man dead, less the days' falls
    // (today's attrition and fall count tomorrow).
    const debt = winter + dead;
    expect(ce.casualties).toBeGreaterThanOrEqual(debt - 31 * 10);
    expect(ce.totals.recruitable).toBeLessThanOrEqual(
      pool - ce.casualties + cl.casualtiesToday + 10,
    );
    expect(econ.armyMen(deu) + ce.manpower).toBeLessThanOrEqual(
      pool - ce.casualties + 10,
    );
    expect(deu.troops()).toBe(ww.land.fieldMen(deu.smallID()));
    expect(deu.troops()).toBeLessThanOrEqual(472_500 - dead);
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
    // One man under the ceiling: it grows that one man and no further.
    ce.manpower = ce.totals.recruitable - field - 10_500 - 1;
    stepManpower(econ, ce, deu);
    expect(ce.manpower).toBe(ce.totals.recruitable - field - 10_500);
    // Below the ceiling it grows by the day's regrowth.
    ce.manpower = 0;
    stepManpower(econ, ce, deu);
    expect(ce.manpower).toBe(manpowerRegrowth(ce.totals.recruitable));
  });
});
