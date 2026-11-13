// ww190 (ww187 merge fix): a shut house passes no budget, and the desk
// never says it passed; the rule tab's view knows the house is shut.
import { GW_BUDGET_LINES } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { tilted } from "@openfront/engine-lib/ww1914/BudgetRules";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { dissolve, GW_ELECTION_DAYS } from "@openfront/engine/ww1914/Assumes";
import {
  budgetStep,
  budgetView,
  submitBudget,
} from "@openfront/engine/ww1914/Budget";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moneyStep } from "@openfront/engine/ww1914/MoneyBills";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string, seat: GwTag): Promise<GreatWar> {
  const runner = await createGameRunner(
    startOf(id, "full", [], seat),
    undefined,
    realMap(),
    () => {},
  );
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  return runner.game.greatWar()!;
}

const said = (gw: GreatWar, key: string) =>
  gw.s.seats[0].log.some((l) => l.key === key && l.chapter === gw.s.chapter);

describe("the budget and a shut house", () => {
  test("a dissolved Reichstag votes nothing: the meeting waits for the election", async () => {
    const gw = await world("GWBSHUT1", "DEU");
    const seat = gw.s.seats[0];
    const n = gw.nation("DEU")!;
    n.budget.draft = {
      shares: [...n.budget.plan.shares],
      mix: [...n.budget.plan.mix],
    };
    n.budget.meeting = gw.s.chapter;
    dissolve(gw, seat);
    expect(budgetView(gw, seat).shut?.until).not.toBeNull();
    expect(submitBudget(gw, n, n.budget.draft)).toBe("waits");
    expect(said(gw, "budget_waits")).toBe(true);
    expect(said(gw, "budget_signed")).toBe(false);
    // Due now, it waits a chapter more rather than passing by proxy.
    budgetStep(gw);
    moneyStep(gw);
    expect(n.budget.meeting).toBe(gw.s.chapter + 1);
    expect(n.budget.last).not.toBe("proxy");
    // After the election the house sits and votes again.
    gw.s.day += GW_ELECTION_DAYS;
    expect(budgetView(gw, seat).shut ?? null).toBeNull();
    expect(submitBudget(gw, n, n.budget.draft!)).not.toBe("waits");
  });

  test("a prorogued Parliament: supply by decree, and the line says so", async () => {
    const gw = await world("GWBSHUT2", "GBR");
    const seat = gw.s.seats[0];
    const n = gw.nation("GBR")!;
    seat.flags.push("f_gbr_prorogued");
    expect(budgetView(gw, seat).shut).toEqual({ until: null });
    expect(submitBudget(gw, n, n.budget.plan)).toBe("passed");
    expect(said(gw, "budget_by_decree")).toBe(true);
    expect(said(gw, "budget_signed")).toBe(false);
  });

  test("in the peace years a new budget keeps the arms the last one was raised to", async () => {
    const gw = await world("GWBSHUT3", "DEU");
    const n = gw.nation("FRA")!;
    const rows = gwChapters(gw.s.calendar);
    const c = rows.findIndex(
      (x, i) => i + 1 < rows.length && rows[i + 1].budget !== null,
    );
    expect(c).toBeGreaterThanOrEqual(0);
    gw.s.chapter = c;
    const army = GW_BUDGET_LINES.indexOf("army");
    n.budget.plan.shares = tilted(n.budget.plan.shares, "army", 10);
    const raised = n.budget.plan.shares[army];
    n.budget.lastChapter = -9;
    n.budget.meeting = null;
    budgetStep(gw);
    expect(n.budget.lastChapter).toBe(c);
    expect(n.budget.plan.shares[army]).toBeGreaterThanOrEqual(raised);
  });
});
