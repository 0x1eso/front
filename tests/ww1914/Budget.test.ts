import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import { GW_BUDGET_LINES } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import {
  budgetDraft,
  budgetRow,
  budgetStart,
  budgetValid,
  budgetVote,
  budgetYear,
  GW_BUDGET_BODIES,
  GW_DRIFT_STEP,
  moneyWord,
  outlayOf,
  tilted,
} from "@openfront/engine-lib/ww1914/BudgetRules";
import {
  GW_BUDGET_DATES,
  GW_CALENDARS,
  gwChapters,
} from "@openfront/engine-lib/ww1914/Calendars";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { moneyIds } from "@openfront/engine-lib/ww1914/MoneyRows";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { basisOf, budgetStep } from "@openfront/engine/ww1914/Budget";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffSnapshots } from "../util/Snapshot";
import { MINI, stamped, step, wwGameStart } from "../ww1936/util";
import { gwRunner, HUMAN, playChapter } from "./util";

const SEATS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;

const basis = (over = {}) => ({
  tag: "DEU",
  war: true,
  warYears: 0,
  treasury: 3000,
  debt: 5000,
  prices: 1000,
  rate: 100,
  morale: 3,
  news: 0,
  loanCap: 3,
  rally: false,
  ...over,
});
const gauges = { shells: 2, bread: 2, money: 2, morale: 3, order: 3 };

async function war(tag: GwTag = "DEU", id = "GWB1") {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  const seat = gw.s.seats[0];
  seat.tag = tag;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  return { runner, gw, seat, n: gw.nation(tag)! };
}

const pass = (gw: GreatWar, r: GameRunner, chapters: number) => {
  for (let i = 0; i < chapters && gw.s.ended === null; i++) {
    advanceChapter(gw, r.game.ticks(), false);
  }
};

/**
 * ww209: the budget is a bill in the house. The seat's plan goes onto the
 * pinned place (`budget` unforced, as `budget_put`); the call votes it.
 */
const callBudget = (gw: GreatWar, seat: GreatWar["s"]["seats"][number]) => {
  seat.house!.sat = {};
  return applyGwOrder(gw, seat, {
    kind: "bill_vote",
    law: moneyIds.budget(seat.tag as GwTag),
    confidence: false,
  });
};

/** Every faction out of the house: nobody votes the budget, it fails. */
const emptyHouse = (seat: GreatWar["s"]["seats"][number]) => {
  for (const f of seat.house!.factions) f.status = "out";
};

/** Runs chapters until `tag`'s meeting stands open. */
function toMeeting(gw: GreatWar, r: GameRunner, tag: GwTag): void {
  for (let i = 0; i < 40 && gw.nation(tag)!.budget.meeting === null; i++) {
    pass(gw, r, 1);
  }
  expect(gw.nation(tag)!.budget.meeting).not.toBeNull();
}

describe("the rule", () => {
  test.each(SEATS)("%s's draft is a valid plan in peace and war", (tag) => {
    for (const war of [false, true]) {
      const plan = budgetDraft(
        basis({ tag, war, debt: budgetRow(tag).debt }),
        gauges,
      );
      expect(budgetValid(plan), `${tag} ${war}`).toBe(true);
    }
    const row = budgetRow(tag);
    for (const shares of [row.peace, row.war]) {
      expect(shares.length).toBe(GW_BUDGET_LINES.length);
      expect(shares.reduce((a, x) => a + x, 0)).toBe(100);
    }
  });

  test("the draft answers what is short, the same for any country", () => {
    const row = budgetRow("DEU");
    const plan = budgetDraft(basis(), { ...gauges, shells: 0, bread: 1 });
    expect(plan.shares[0]).toBeGreaterThanOrEqual(row.war[0]);
    expect(plan.shares[2]).toBeGreaterThan(row.war[2]);
  });

  test("every source has its price", () => {
    const b = basis({ treasury: 900000 });
    const plain = { shares: [...budgetRow("DEU").war], mix: [100, 40, 0, 0] };
    const y = budgetYear(b, plain);
    const taxed = budgetYear(b, { ...plain, mix: [150, 40, 0, 0] });
    expect(taxed.taxes).toBeGreaterThan(y.taxes);
    expect(taxed.drift.order).toBeLessThan(y.drift.order);
    const printed = budgetYear(b, { ...plain, mix: [100, 40, 0, 30] });
    expect(printed.print).toBeGreaterThan(0);
    expect(printed.prices).toBeGreaterThan(y.prices);
    expect(printed.debt).toBe(y.debt);
    const bad = budgetYear({ ...b, morale: 0, news: -2 }, plain);
    expect(bad.bonds).toBeLessThan(y.bonds);
    expect(bad.appetite).toBeLessThan(y.appetite);
    // A loan is only what the lenders will give.
    const asked = budgetYear(b, { ...plain, mix: [100, 40, 50, 0] });
    expect(asked.loans).toBe(Math.trunc((outlayOf(b) * 3) / 100));
  });

  test("shares feed the gauges, and prices come back through order", () => {
    const b = basis();
    const row = budgetRow("DEU");
    const y = budgetYear(b, { shares: [...row.war], mix: [100, 0, 0, 0] });
    expect(y.drift.shells).toBe(0);
    expect(y.drift.bread).toBe(0);
    const up = tilted(row.war, "army", 10);
    expect(up.reduce((a, x) => a + x, 0)).toBe(100);
    const more = budgetYear(b, { shares: up, mix: [100, 0, 0, 0] });
    expect(more.drift.shells).toBeGreaterThan(100);
    const dear = budgetYear(basis({ prices: 3000 }), {
      shares: [...row.war],
      mix: [100, 0, 0, 0],
    });
    expect(dear.drift.order).toBeLessThan(0);
    expect(dear.why.order).toBe("order_prices");
  });

  test("the money gauge follows the numbers", () => {
    const row = budgetRow("DEU");
    expect(moneyWord(basis({ treasury: row.step * 2 + 1 }))).toBe(2);
    expect(moneyWord(basis({ treasury: 0 }))).toBe(0);
    // Too much interest takes room to borrow however full the treasury.
    expect(
      moneyWord(basis({ treasury: row.step * 3, debt: 60000 })),
    ).toBeLessThan(3);
    expect(budgetStart("GBR", 3).treasury).toBeGreaterThan(
      budgetRow("GBR").step * 3,
    );
  });

  test("each row has its body: refuse, consent, or a Tsar who signs alone", () => {
    expect(GW_BUDGET_BODIES.empire.inst).toBe("reichstag");
    expect(GW_BUDGET_BODIES.liberal.inst).toBe("commons");
    expect(GW_BUDGET_BODIES.liberal.second?.inst).toBe("cabinet");
    expect(GW_BUDGET_BODIES.dual_monarchy.kind).toBe("consent");
    expect(GW_BUDGET_BODIES.tsar.kind).toBe("alone");
    const plan = { shares: [...budgetRow("DEU").war], mix: [180, 0, 0, 0] };
    const body = GW_BUDGET_BODIES.empire;
    expect(budgetVote(body, { reichstag: 0 }, basis(), plan).pass).toBe(true);
    const no = budgetVote(body, { reichstag: -3 }, basis(), plan);
    expect(no.pass).toBe(false);
    expect(no.why).toContain("taxes_heavy");
  });
});

describe("the calendar", () => {
  test("every length has its meetings, and none on the closing chapter", () => {
    for (const id of Object.keys(
      GW_CALENDARS,
    ) as (keyof typeof GW_CALENDARS)[]) {
      const held = gwChapters(id).filter((c) => c.budget !== null);
      expect(held.length, id).toBe(GW_BUDGET_DATES[id].length);
      for (const c of held) expect(c.stage, id).not.toBe("closing");
    }
  });
});

describe("the meeting", () => {
  test("the outbreak calls a meeting, with a draft and a card", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    expect(n.budget.draft).not.toBeNull();
    expect(seat.desk.some((c) => c.scene === "gw_bm_deu_1914")).toBe(true);
  });

  test("a yearly meeting comes on every calendar's chapter", async () => {
    const { runner } = await gwRunner(
      { greatWar1914Calendar: "y1914" },
      "GWB2",
    );
    const gw = gwOf(runner);
    const at = gwChapters("y1914").findIndex((c) => c.budget !== null);
    pass(gw, runner, at);
    const b = gw.nation("DEU")!.budget;
    expect(b.meeting ?? b.lastChapter).toBeGreaterThanOrEqual(at - 1);
  });

  test("putting the plan takes the card away; the house votes it into force", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    const d = n.budget.draft!;
    const shares = tilted(d.shares, "relief", 5);
    const block = applyGwOrder(gw, seat, {
      kind: "budget",
      shares,
      mix: d.mix,
      force: false,
    });
    expect(block).toBeNull();
    expect(seat.desk.some((c) => c.scene.startsWith("gw_bm_"))).toBe(false);
    expect(n.budget.put?.shares).toEqual(shares);
    expect(n.budget.meeting).not.toBeNull();
    expect(callBudget(gw, seat)).toBeNull();
    expect(n.budget.plan.shares).toEqual(shares);
    expect(n.budget.meeting).toBeNull();
    expect(n.budget.last).toBe("signed");
    expect(seat.desk.some((c) => c.scene.startsWith("gw_bm_"))).toBe(false);
  });

  test("a plan that doesn't sum to 100 is refused, and no meeting means no bill", async () => {
    const { runner, gw, seat, n } = await war();
    const bill = {
      kind: "budget" as const,
      shares: [50, 10, 10, 10, 10],
      mix: [100, 0, 0, 0],
      force: false,
    };
    expect(applyGwOrder(gw, seat, bill)).toBe("no_meeting");
    toMeeting(gw, runner, "DEU");
    expect(applyGwOrder(gw, seat, bill)).toBe("bad_budget");
    expect(n.budget.meeting).not.toBeNull();
  });

  test("refused, last year's runs on; or authority forces it", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    n.inst.reichstag = -5;
    n.budget.warPlan = true;
    emptyHouse(seat);
    const was = n.budget.plan;
    const d = n.budget.draft!;
    const bill = { kind: "budget" as const, ...d, force: false };
    expect(applyGwOrder(gw, seat, bill)).toBeNull();
    expect(callBudget(gw, seat)).toBeNull();
    expect(n.budget.refused).toBe(true);
    expect(n.budget.plan).toEqual(was);
    n.authority = 10;
    expect(applyGwOrder(gw, seat, { ...bill, force: true })).toBe(
      "no_authority",
    );
    n.authority = 50;
    expect(applyGwOrder(gw, seat, { ...bill, force: true })).toBeNull();
    expect(n.budget.last).toBe("forced");
    expect(n.authority).toBe(50 - GW_BUDGET_BODIES.empire.forcePrice);
    expect(n.budget.plan.shares).toEqual(d.shares);
  });

  test("the first war budget passes where a later one would not", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    n.inst.reichstag = -5;
    const bill = { kind: "budget" as const, ...n.budget.draft!, force: false };
    expect(applyGwOrder(gw, seat, bill)).toBeNull();
    expect(callBudget(gw, seat)).toBeNull();
    expect(n.budget.last).toBe("signed");
    expect(n.budget.warPlan).toBe(true);
  });

  test("left refused, the year closes on last year's plan", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    n.inst.reichstag = -5;
    n.budget.warPlan = true;
    emptyHouse(seat);
    const was = n.budget.plan;
    applyGwOrder(gw, seat, {
      kind: "budget",
      ...n.budget.draft!,
      force: false,
    });
    seat.desk = [];
    // ww209: the deadline's vote, lost for good.
    for (let i = 0; i < 4 && n.budget.meeting !== null; i++) {
      pass(gw, runner, 1);
    }
    expect(n.budget.last).toBe("refused");
    expect(n.budget.plan).toEqual(was);
    expect(n.budget.meeting).toBeNull();
    expect(seat.log.some((l) => l.key === "budget_runs_on")).toBe(true);
  });

  test("the Tsar's budget goes round the Duma by Article 87, at the Duma's price", async () => {
    const { runner, gw, seat, n } = await war("RUS", "GWB3");
    toMeeting(gw, runner, "RUS");
    n.regime = "tsar";
    n.inst.duma = -4;
    n.budget.warPlan = true;
    expect(
      applyGwOrder(gw, seat, {
        kind: "budget",
        ...n.budget.draft!,
        force: false,
      }),
    ).toBeNull();
    // The Duma in recess: the way round is open.
    seat.flags = seat.flags.filter((f) => f !== "f_gov_rus_session");
    n.authority = 60;
    expect(
      applyGwOrder(gw, seat, {
        kind: "bill_round",
        law: moneyIds.budget("RUS"),
      }),
    ).toBeNull();
    expect(n.budget.last).toBe("forced");
    expect(n.budget.meeting).toBeNull();
    expect(n.inst.duma).toBeLessThan(-4);
    expect(n.authority).toBeLessThan(60);
  });

  test("Hungary's consent is the common budget's door", async () => {
    const { runner, gw, seat, n } = await war("AUH", "GWB4");
    toMeeting(gw, runner, "AUH");
    n.regime = "dual_monarchy";
    n.inst.hungary = -5;
    n.budget.warPlan = true;
    applyGwOrder(gw, seat, {
      kind: "budget",
      ...n.budget.draft!,
      force: false,
    });
    // Tisza's party turned against it: Budapest's consent is refused.
    seat.house!.factions.find((f) => f.id === "auh_work")!.step = 2;
    expect(callBudget(gw, seat)).toBeNull();
    expect(n.budget.refused).toBe(true);
  });

  test("hands off: the house votes the draft at the deadline, by proxy", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    const d = n.budget.draft!;
    seat.desk = [];
    for (let i = 0; i < 4 && n.budget.meeting !== null; i++) {
      pass(gw, runner, 1);
    }
    expect(n.budget.last).toBe("proxy");
    expect(n.budget.plan.shares).toEqual(d.shares);
    expect(seat.log.some((l) => l.key === "budget_proxy")).toBe(true);
  });

  test("a card the timer signs puts the draft; the deadline votes it", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    expect(seat.desk.some((c) => c.scene.startsWith("gw_bm_"))).toBe(true);
    advanceChapter(gw, runner.game.ticks(), true);
    expect(n.budget.put).not.toBeNull();
    for (let i = 0; i < 4 && n.budget.meeting !== null; i++) {
      advanceChapter(gw, runner.game.ticks(), true);
    }
    expect(n.budget.last).toBe("proxy");
    expect(seat.choices.some((c) => c.proxy)).toBe(true);
  });

  test("AI countries run the same rule", async () => {
    const { runner, gw } = await war();
    pass(gw, runner, 12);
    const fra = gw.nation("FRA")!;
    expect(fra.budget.last).not.toBe("none");
    expect(fra.budget.meeting).toBeNull();
    expect(fra.budget.plan.shares.reduce((a, x) => a + x, 0)).toBe(100);
  });
});

describe("no dead ends", () => {
  test("no money doesn't stop the country: it prints, and says so", async () => {
    const { gw, seat, n } = await war();
    n.budget.treasury = 0;
    n.budget.plan = { shares: [...budgetRow("DEU").war], mix: [100, 0, 0, 0] };
    const was = n.budget.prices;
    budgetStep(gw);
    expect(gw.s.ended).toBeNull();
    // ww201: only what the land and trade bring in, under a step.
    expect(n.budget.treasury).toBeLessThan(budgetRow("DEU").step);
    expect(n.budget.prices).toBeGreaterThan(was);
    expect(n.gauges.money).toBe(0);
    expect(seat.log.some((l) => l.key === "budget_shortfall")).toBe(true);
  });

  test("bankruptcy is a card with choices, never an ending", async () => {
    const { runner, gw, seat, n } = await war();
    n.budget.debt = 2_000_000;
    budgetStep(gw);
    expect(seat.scheduled.some((q) => q.scene === "gw_bc_deu")).toBe(true);
    expect(gw.s.ended).toBeNull();
    const scene = GW_CONTENT.scenes.find((s) => s.id === "gw_bc_deu")!;
    expect(scene.options!.filter((o) => o.when === undefined).length).toBe(4);
    const ends = JSON.stringify(scene.options);
    expect(ends).not.toContain('"end"');
    pass(gw, runner, 1);
    expect(gw.s.ended).toBeNull();
  });

  test("a scene's money moves the treasury, what's missing is printed", async () => {
    const { gw, n, seat } = await war();
    const step = budgetRow("DEU").step;
    n.budget.treasury = step * 2 + 10;
    n.gauges.money = 2;
    const was = n.budget.prices;
    const ctx = { gw, seat, cast: {} };
    const { runEffects } = await import("@openfront/engine/ww1914/SceneRun");
    runEffects(ctx, [{ kind: "gauge", gauge: "money", delta: -1 }]);
    expect(n.gauges.money).toBe(1);
    runEffects(ctx, [{ kind: "gauge", gauge: "money", delta: -3 }]);
    expect(n.gauges.money).toBe(0);
    expect(n.budget.treasury).toBe(0);
    expect(n.budget.prices).toBeGreaterThan(was);
  });

  test("what piles up moves a gauge a step, with its reason", async () => {
    const { gw, seat, n } = await war();
    n.budget.drift.shells = GW_DRIFT_STEP - 1;
    n.gauges.shells = 1;
    n.budget.plan = {
      shares: tilted(budgetRow("DEU").war, "army", 10),
      mix: [100, 50, 0, 20],
    };
    budgetStep(gw);
    expect(n.gauges.shells).toBe(2);
    // ww201: the reason is the largest cause, the plan's or the works'.
    const why = n.econ!.why.shells;
    expect(["budget_army", "econ_industry"]).toContain(why);
    expect(seat.lines.some((l) => l.gauge === "shells" && l.key === why)).toBe(
      true,
    );
  });

  test("a lender owed enough comes to collect", async () => {
    const { gw, seat, n } = await war("GBR", "GWB5");
    n.budget.lent.morgan = budgetRow("GBR").revenue * 2;
    budgetStep(gw);
    expect(seat.scheduled.some((q) => q.scene === "gw_bl_gbr")).toBe(true);
    expect(n.budget.asked.morgan).toBe(1);
  });
});

describe("the view", () => {
  test("the seat reads its numbers, and forecasts what the chapter will do", async () => {
    const { runner, gw, seat, n } = await war();
    toMeeting(gw, runner, "DEU");
    const b = basisOf(gw, n);
    expect(b.tag).toBe("DEU");
    const { budgetView } = await import("@openfront/engine/ww1914/Budget");
    const v = budgetView(gw, seat);
    expect(v.meeting).toBe(true);
    expect(v.draft).toEqual(n.budget.draft);
    expect(v.body?.inst).toBe("reichstag");
    expect(JSON.stringify(v)).not.toContain("competence");
  });
});

describe("a save", () => {
  test("a game saved in a meeting comes back the same, through the signature", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "y1914" });
    const gw = gwOf(runner);
    const n = gw.nation("DEU")!;
    for (let i = 0; i < 12 && n.budget.meeting === null; i++) {
      playChapter(runner);
    }
    expect(n.budget.meeting).not.toBeNull();
    const copy = await createGameRunnerFromSnapshot(
      wwGameStart({ greatWar1914: true, greatWar1914Calendar: "y1914" }, [
        { clientID: HUMAN, country: "DEU" },
      ]),
      runner.snapshot(),
      undefined,
      await loadMapFiles(
        new TestDataMapLoader(MINI),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
      () => {},
    );
    expect(diffSnapshots(runner.snapshot(), copy.snapshot())).toEqual([]);
    expect(gwOf(copy).s.nations[0].budget).toEqual(gw.s.nations[0].budget);
    const d = n.budget.draft!;
    const bill: StampedIntent[] = [
      stamped(HUMAN, {
        type: "gw_order",
        order: { kind: "budget", ...d, force: false },
      }),
    ];
    step(runner, 1, bill);
    step(copy, 1, bill);
    expect(gwOf(copy).hash()).toBe(gw.hash());
    // ww209: the plan is put to the house, on both.
    expect(gwOf(copy).nation("DEU")!.budget.put).not.toBeNull();
  });
});

describe("the writing", () => {
  const res = (f: string) =>
    JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../resources", f), "utf8"),
    );
  const load = (tag: GwTag): Promise<GwPack> =>
    loadGwPack(tag, async (p) => res(p));

  test.each(SEATS)("%s has a scene for each year of war", async (tag) => {
    const pack = await load(tag);
    const t = tag.toLowerCase();
    const bodies = new Set<string>();
    for (const year of [1914, 1915, 1916, 1917, 1918, "peace"]) {
      const scene = GW_CONTENT.scenes.find(
        (s) => s.id === `gw_bm_${t}_${year}`,
      );
      expect(scene, `${tag} ${year}`).toBeDefined();
      for (const v of scene!.variants) {
        const text = pack.scenes[scene!.id].text[v.id];
        expect(text, `${scene!.id}.${v.id}`).toBeTruthy();
        expect(bodies.has(text)).toBe(false);
        bodies.add(text);
      }
    }
  });

  test.each(SEATS)("%s has three talks on money and more", (tag) => {
    const t = tag.toLowerCase();
    const talks = GW_CONTENT.scenes.filter((s) =>
      s.id.startsWith(`gw_bt_${t}_`),
    );
    expect(talks.length).toBeGreaterThanOrEqual(3);
    for (const s of talks) expect(s.kind).toBe("talk");
  });

  test("Britain's old budget card folded in", () => {
    expect(GW_CONTENT.scenes.some((s) => s.id === "gw_gbr_budget")).toBe(false);
    expect(GW_CONTENT.scenes.some((s) => s.id === "gw_bl_gbr")).toBe(true);
  });
});
