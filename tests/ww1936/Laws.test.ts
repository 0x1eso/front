import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { lawBlock, setLaw } from "@openfront/engine/ww1936/economy/LawsRun";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  withTestPolitics,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + 7);
}

/**
 * Germany and Poland played by humans: no AI economy changes their laws,
 * and a war between them stays quiet. P3 (plan Task 1 Step 20): Germany
 * gets 500 PP, as laws cost political power now (spec §7.1); with no
 * politics row it is neutral at 50% war support.
 */
async function germany() {
  const runner = await wwRunner({}, [
    { clientID: HUMAN, country: "DEU" },
    { clientID: HUMAN_POL, country: "POL" },
  ]);
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const deu = byTag(g, "DEU");
  const pol = byTag(g, "POL");
  const c = ww.politics.country(deu.smallID())!;
  c.ppMilli = 500_000;
  // P4 spec §10.2 (lane C): the sea way is a route between naval bases;
  // Rome gets one, so the AIs trade across the sea as with P1's rule.
  econ.buildingArray("naval_base")[5] = 1;
  econ.afterBuildingChange(5, "naval_base");
  return {
    runner,
    g,
    ww,
    econ,
    deu,
    pol,
    c,
    ce: econ.country(deu.smallID())!,
  };
}

const lawOrder = (order: WwOrder) =>
  stamped(HUMAN, { type: "ww_order", order });

// P3: the P1/P2 numbers, not the 1936 politics content (plan Task 1).
withTestPolitics();

describe("laws (spec §5)", () => {
  test("conditions (P3 spec §7.2: war support, war, government, PP)", async () => {
    const { runner, g, ww, econ, deu, pol, c, ce } = await germany();
    expect(ce.laws).toEqual({
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    });
    expect(lawBlock(econ, ce, "economy", "free_trade", 0)).toBe("law_kind");
    expect(lawBlock(econ, ce, "economy", "partial_mobilization", 0)).toBe(
      "law_same",
    );
    // At peace, 20% war support: the war-support steps are shut.
    c.wsBp = 2000;
    expect(setLaw(econ, ce, "economy", "war_economy", 0)).toBe("law_ws");
    expect(ce.laws.economy).toBe("partial_mobilization");
    expect(lawBlock(econ, ce, "conscription", "extensive", 0)).toBe("law_ws");
    c.wsBp = 3000;
    expect(lawBlock(econ, ce, "conscription", "extensive", 0)).toBeNull();
    expect(lawBlock(econ, ce, "conscription", "service", 0)).toBe("law_ws");
    // "At war and": total mobilization waits for a war (P1's law_condition).
    c.wsBp = 9000;
    expect(lawBlock(econ, ce, "economy", "total_mobilization", 0)).toBe(
      "law_condition",
    );
    // A democracy needs tension too, at peace only.
    c.ruling = 0;
    ww.politics.wtBp = 4999;
    expect(lawBlock(econ, ce, "economy", "war_economy", 0)).toBe("law_tension");
    expect(lawBlock(econ, ce, "trade", "closed_economy", 0)).toBe(
      "law_ideology",
    );
    // At war from the first tick: tension and the "or at war" steps open.
    expect(ww.setWar(deu.smallID(), pol.smallID(), 0)).toBe(true);
    expect(lawBlock(econ, ce, "economy", "war_economy", 0)).toBeNull();
    expect(lawBlock(econ, ce, "trade", "closed_economy", 0)).toBeNull();
    c.wsBp = 6999;
    expect(lawBlock(econ, ce, "economy", "total_mobilization", 0)).toBe(
      "law_ws",
    );
    c.wsBp = 7000;
    const pp = c.ppMilli;
    expect(setLaw(econ, ce, "economy", "total_mobilization", 0)).toBeNull();
    expect(ce.laws.economy).toBe("total_mobilization");
    // The target law's cost, once (spec §7.1).
    expect(c.ppMilli).toBe(pp - 150_000);
    expect(lawBlock(econ, ce, "conscription", "scraping", 0)).toBe("law_ws");
    // Fascists keep no free trade.
    c.ruling = 2;
    expect(lawBlock(econ, ce, "trade", "free_trade", 0)).toBe("law_ideology");
    // Too little PP.
    c.ruling = 3;
    c.ppMilli = 99_999;
    expect(lawBlock(econ, ce, "trade", "free_trade", 0)).toBe("no_pp");
    // Peace does not undo a law (spec §5.4).
    ww.endWarsOf(deu.smallID());
    finishDay(runner, 1);
    expect(econ.warDays(deu.smallID(), g.ticks())).toBe(-1);
    expect(ce.laws.economy).toBe("total_mobilization");
  });

  test("thirty days between changes of one kind", async () => {
    const { econ, ce } = await germany();
    expect(setLaw(econ, ce, "economy", "civilian", 10)).toBeNull();
    expect(ce.lawCooldownUntil.economy).toBe(40);
    expect(setLaw(econ, ce, "economy", "early_mobilization", 10)).toBe(
      "law_cooldown",
    );
    // Another kind is free.
    expect(setLaw(econ, ce, "trade", "free_trade", 10)).toBeNull();
    expect(setLaw(econ, ce, "economy", "early_mobilization", 39)).toBe(
      "law_cooldown",
    );
    expect(setLaw(econ, ce, "economy", "early_mobilization", 40)).toBeNull();
    expect(ce.laws).toEqual({
      economy: "early_mobilization",
      trade: "free_trade",
      conscription: "limited",
    });
  });

  test("the player's law order waits out the thirty days", async () => {
    const { runner, ww, ce } = await germany();
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    step(runner, 1, [
      lawOrder({ kind: "set_law", law: "economy", value: "civilian" }),
    ]);
    expect(ce.laws.economy).toBe("civilian");
    expect(ce.lawCooldownUntil.economy).toBe(32);
    const early = lawOrder({
      kind: "set_law",
      law: "economy",
      value: "early_mobilization",
    });
    step(runner, 1, [early]);
    expect(ce.laws.economy).toBe("civilian");
    stepTo(runner, dayStartTick(32, WW_PREP_TICKS));
    expect(ww.day(runner.game.ticks())).toBe(32);
    step(runner, 1, [early]);
    expect(ce.laws.economy).toBe("early_mobilization");
  });

  test("raising conscription adds the difference at once", async () => {
    const { runner, ww, econ, deu, pol, ce } = await germany();
    ww.setWar(deu.smallID(), pol.smallID(), 0);
    const id = deu.smallID();
    const gain = econ.recruitableWith(id, 100) - econ.recruitableWith(id, 25);
    expect(gain).toBe(6_700_000 - 1_675_000);
    const before = ce.manpower;
    expect(setLaw(econ, ce, "conscription", "service", 0)).toBeNull();
    expect(ce.manpower).toBe(before + gain);
    // The next day's pool follows the law.
    finishDay(runner, 0);
    expect(ce.totals.recruitable).toBe(6_700_000);
    // Lowering it takes the difference away, never below zero.
    const now = ce.manpower;
    const loss = econ.recruitableWith(id, 100) - econ.recruitableWith(id, 50);
    expect(setLaw(econ, ce, "conscription", "extensive", 30)).toBeNull();
    expect(ce.manpower).toBe(now - loss);
    ce.manpower = 1_000;
    expect(setLaw(econ, ce, "conscription", "volunteer", 60)).toBeNull();
    expect(ce.manpower).toBe(0);
  });

  test("consumer goods follow the economy law", async () => {
    const { runner, ce } = await germany();
    finishDay(runner, 0);
    // Partial mobilisation: 25% of 15 factories.
    expect([ce.totals.civ, ce.totals.mil]).toEqual([9, 6]);
    expect(ce.totals.cgMilli).toBe(15 * 25 * 10);
    step(runner, 1, [
      lawOrder({ kind: "set_law", law: "economy", value: "civilian" }),
    ]);
    expect(ce.laws.economy).toBe("civilian");
    // The day's totals wait for the next daily step.
    expect(ce.totals.cgMilli).toBe(15 * 25 * 10);
    finishDay(runner, 1);
    expect(ce.totals.cgMilli).toBe((ce.totals.civ + ce.totals.mil) * 35 * 10);
    expect(ce.totals.cgMilli).toBe(5_250);
    expect(ce.totals.freeCivMilli).toBe(9_000 - 5_250);
  });
});
