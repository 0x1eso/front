// The budget voted like the law book (ww209/ww210 S1): the money bills on
// their pinned place, counted by each faction's purse, voted with the full
// ballot; a lost bill back to the lobby once, then the country's rule; war
// credits on the country's rhythm, refused credits stopping the borrowing;
// the SPD's left defying its line. Real content, seats set by state.
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBudgetPlan } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { budgetNorm } from "@openfront/engine-lib/ww1914/BudgetRules";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_SPLIT_PRESSURE,
  moneyIds,
} from "@openfront/engine-lib/ww1914/MoneyRows";
import { budgetStep } from "@openfront/engine/ww1914/Budget";
import { govHeat } from "@openfront/engine/ww1914/Government";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { factionOf, houseStep } from "@openfront/engine/ww1914/House";
import { moneyStep } from "@openfront/engine/ww1914/MoneyBills";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { societyStep } from "@openfront/engine/ww1914/Society";
import { worldEffect } from "@openfront/engine/ww1914/WorldDsl";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";

/** A seat of `tag` at war, a month-long chapter, its house started. */
async function atWar(tag: GwTag) {
  const made = await wwRunnerCapture(
    { greatWar1914: true, greatWar1914Calendar: "full" },
    [{ clientID: HUMAN, gwCountry: tag }],
    undefined,
    undefined,
    HUMAN,
  );
  step(made.runner, 2);
  const gw = made.runner.game.greatWar()!;
  const s = gw.s;
  s.warChapter = 0;
  s.dayShift = 800;
  s.day += 800;
  const { gwChapters } = await import("@openfront/engine-lib/ww1914/Calendars");
  s.chapter = gwChapters(s.calendar).findIndex((c) => c.spanDays >= 28) + 2;
  const seat = s.seats[0];
  const n = gw.nation(tag)!;
  n.authority = 80;
  const foe = { DEU: "FRA", GBR: "DEU", RUS: "DEU" } as Record<string, GwTag>;
  n.atWar = [foe[tag]];
  n.side = tag === "DEU" ? "central" : "entente";
  // A war budget already signed: no rally.
  n.budget.warPlan = true;
  houseStep(gw);
  seat.desk = [];
  seat.scheduled = [];
  for (const f of seat.house!.factions) {
    f.heat = 0;
    f.step = 0;
    f.held = -1;
    f.asking = null;
  }
  return { gw, n, seat };
}

/** Real seats for the factions named, their trust; every other faction out. */
function seats(
  seat: GwSeatState,
  chamber: string,
  by: Readonly<Record<string, [seats: number, trust: number]>>,
) {
  for (const f of seat.house!.factions) {
    const row = by[f.id];
    f.status = row === undefined ? "out" : "in";
    f.seats = row === undefined ? null : { [chamber]: row[0] };
    if (row !== undefined) f.trust = row[1];
  }
}

/** A plan at the norm with taxes as in June 1914: no line nor tax minded. */
function plain(n: GwNationState): GwBudgetPlan {
  return { shares: [...budgetNorm(n.tag, true)], mix: [100, 10, 0, 0] };
}

const put = (gw: GreatWar, seat: GwSeatState, plan: GwBudgetPlan) =>
  applyGwOrder(gw, seat, {
    kind: "budget_put",
    credits: false,
    shares: plan.shares,
    mix: plan.mix,
    tax: "consumption",
    marks: [],
  });

/** The call: one vote a chamber a chapter, so the benches are cleared first. */
const call = (gw: GreatWar, seat: GwSeatState, law: string) => {
  seat.house!.sat = {};
  return applyGwOrder(gw, seat, { kind: "bill_vote", law, confidence: false });
};

const meeting = (gw: GreatWar, n: GwNationState) => {
  n.budget.meeting = gw.s.chapter + 3;
  n.budget.draft = plain(n);
  n.budget.year = 1915;
};

describe("the money bills", () => {
  test("a DEU 1915 budget passes with the Centre and fails without it; last year's runs on", async () => {
    const { gw, n, seat } = await atWar("DEU");
    n.inst.reichstag = 0;
    const law = moneyIds.budget("DEU");
    // The Centre trusts the chancellor; the SPD doesn't.
    seats(seat, "reichstag", {
      deu_centre: [100, 2],
      deu_spd: [90, -2],
    });
    meeting(gw, n);
    const plan = { ...plain(n), shares: [...plain(n).shares] };
    expect(put(gw, seat, plan)).toBe(null);
    const st = n.laws.find((x) => x.id === law)!;
    expect(st.stage).toBe("persuade");
    // On the pinned place, not one of the agenda's three.
    expect(n.budget.put).toEqual({ ...plan, tax: "consumption" });
    expect(call(gw, seat, law)).toBe(null);
    const ballot = seat.house!.last!.ballot!;
    expect(ballot.law).toBe(law);
    expect(ballot.pass).toBe(true);
    expect(n.budget.meeting).toBe(null);
    expect(n.budget.last).toBe("signed");
    expect(n.budget.voted?.budget).toBe("passed");

    // Without the Centre: lost, back to the lobby once, lost again for good.
    // (Distrust alone only makes a faction waver; the USPD votes no to every
    // war budget.)
    const before = JSON.stringify(n.budget.plan);
    seats(seat, "reichstag", { deu_uspd: [90, -2], deu_cons: [40, 0] });
    meeting(gw, n);
    const changed = { ...plain(n), mix: [100, 20, 0, 0] };
    expect(put(gw, seat, changed)).toBe(null);
    expect(call(gw, seat, law)).toBe(null);
    expect(seat.house!.last!.ballot!.pass).toBe(false);
    expect(n.laws.find((x) => x.id === law)!.stage).toBe("persuade");
    expect(n.budget.tries).toBe(1);
    expect(call(gw, seat, law)).toBe(null);
    expect(n.budget.meeting).toBe(null);
    expect(n.budget.last).toBe("refused");
    expect(n.budget.voted?.budget).toBe("failed");
    expect(JSON.stringify(n.budget.plan)).toBe(before);
    expect(seat.log.some((l) => l.key === "budget_runs_on")).toBe(true);
  });

  test("refused credits stop the borrowing; Britain's are confidence; Russia's need no vote", async () => {
    const { gw, n, seat } = await atWar("DEU");
    // The SPD votes the credits in war (W-DEU's purse): the USPD doesn't.
    seats(seat, "reichstag", { deu_uspd: [90, -2], deu_cons: [40, 0] });
    n.inst.reichstag = -3;
    n.budget.credits = { n: 1, due: gw.s.chapter, stopTo: -1, lost: 0 };
    moneyStep(gw);
    const law = moneyIds.credits("DEU", 2);
    expect(n.laws.find((x) => x.id === law)?.stage).toBe("persuade");
    expect(call(gw, seat, law)).toBe(null);
    expect(call(gw, seat, law)).toBe(null);
    const cr = n.budget.credits!;
    expect(cr.lost).toBe(1);
    expect(cr.stopTo).toBeGreaterThan(gw.s.chapter);
    expect(n.laws.some((x) => x.id === law)).toBe(false);
    // The period runs on no bonds and no loans: the debt doesn't grow by them.
    n.budget.plan = { ...n.budget.plan, mix: [100, 30, 10, 0] };
    const debt = n.budget.debt;
    budgetStep(gw);
    expect(n.budget.debt).toBe(debt);

    const gbr = await atWar("GBR");
    // Labour votes the credits (W-GBR's purse); the ILP doesn't.
    seats(gbr.seat, "commons", {
      gbr_ilp: [200, -2],
      gbr_liberals: [100, 0],
    });
    gbr.n.inst.commons = -3;
    gbr.n.budget.credits = {
      n: 1,
      due: gbr.gw.s.chapter,
      stopTo: -1,
      lost: 0,
    };
    moneyStep(gbr.gw);
    const vote = moneyIds.credits("GBR", 2);
    const heat = govHeat(gbr.seat, "gbr_table");
    expect(call(gbr.gw, gbr.seat, vote)).toBe(null);
    expect(gbr.seat.house!.last!.ballot!.pass).toBe(false);
    expect(govHeat(gbr.seat, "gbr_table")).toBeGreaterThan(heat);

    const rus = await atWar("RUS");
    rus.n.budget.credits = {
      n: 1,
      due: rus.gw.s.chapter,
      stopTo: -1,
      lost: 0,
    };
    moneyStep(rus.gw);
    expect(rus.n.budget.credits!.n).toBe(2);
    expect(rus.n.laws.some((x) => x.id.includes("_money_credits_"))).toBe(
      false,
    );
  });

  test("the SPD's left defies its line on the credits: Liebknecht alone first, then Haase's wing and the split's report", async () => {
    const { gw, n, seat } = await atWar("DEU");
    seats(seat, "reichstag", { deu_spd: [110, 2], deu_cons: [60, 1] });
    const f = seat.house!.factions.find((x) => x.id === "deu_spd")!;
    const scene = gwContent().scenes.find((x) => x.id === "deu_h_spd_split")!;
    const ctx = { gw, seat, cast: {} };
    // Dec 1914: Liebknecht; Mar 1915: Liebknecht and Rühle; then the wing.
    const who = [
      ["deu_liebknecht", undefined, 1],
      ["deu_liebknecht", ["deu_i_ruehle"], 2],
      ["deu_haase", undefined, null],
      ["deu_haase", undefined, null],
      ["deu_haase", undefined, null],
    ] as const;
    n.budget.credits = { n: 1, due: gw.s.chapter, stopTo: -1, lost: 0 };
    who.forEach(([person, others, size], i) => {
      const k = i + 2;
      f.heat = 1;
      f.step = 1;
      n.budget.credits!.due = gw.s.chapter;
      moneyStep(gw);
      const law = moneyIds.credits("DEU", k);
      expect(call(gw, seat, law)).toBe(null);
      const b = seat.house!.last!.ballot!;
      expect(b.pass).toBe(true);
      const defy = b.chambers[0].blocks.find((x) => x.beat === "defy")!;
      expect(defy.faction).toBe("deu_spd");
      expect(defy.cast).toBe("against");
      expect(defy.person).toBe(person);
      expect(defy.with).toEqual(others);
      if (size !== null) expect(defy.seats).toBe(size);
      expect(defy.wing).toBe(true);
      expect(f.defied).toBe(k - 1);
      // The lone men press no split; the wing's report comes with the wing.
      expect(f.split ?? 0).toBe(Math.max(0, k - 3));
      expect(holds(ctx, scene.when as GwCond)).toBe(k >= 4);
    });
    // The wing's third defy: split pressure enough, the left goes its way.
    expect(f.split).toBe(GW_SPLIT_PRESSURE);
    societyStep(gw);
    expect(factionOf(seat, "deu_uspd")?.status).toBe("in");
    expect(f.split).toBe(0);
  });

  test("ww210 merge: a strong faction against brings its own tilt; a moratorium costs the propertied", async () => {
    const { gw, n, seat } = await atWar("DEU");
    seats(seat, "reichstag", { deu_uspd: [120, -1], deu_cons: [200, 2] });
    meeting(gw, n);
    const plan = plain(n);
    expect(put(gw, seat, plan)).toBe(null);
    moneyStep(gw);
    // Not the chapter it was put: the house reads the plan first.
    expect(n.budget.tilt).toBeUndefined();
    gw.s.chapter++;
    moneyStep(gw);
    expect(n.budget.tilt).toBe("deu_uspd");
    expect(n.budget.put!.shares).not.toEqual(plan.shares);
    expect(n.budget.put!.shares.reduce((a, b) => a + b, 0)).toBe(
      plan.shares.reduce((a, b) => a + b, 0),
    );
    expect(seat.log.some((l) => l.key === "money_tilt")).toBe(true);
    // Once a year: the next chapter leaves the plan as it stands.
    const now = [...n.budget.put!.shares];
    gw.s.chapter++;
    moneyStep(gw);
    expect(n.budget.put!.shares).toEqual(now);

    // The row's trust (1) until the society is started.
    const owners = () =>
      seat.society?.communities.find((c) => c.id === "deu_owners")?.trust ?? 1;
    const had = owners();
    worldEffect(
      { gw, seat, cast: {} },
      { do: "budget_rate", pct: 50, shut: 12 },
    );
    expect(owners()).toBe(had - 1);
  });
});
