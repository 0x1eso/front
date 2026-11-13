// ww210 S0: the money bills' and the bargaining's format. Shapes parse, the
// rows name real chambers, the ids read back, and the stubs refuse cleanly.
// S1 and S2 write the rules' tests (BudgetVote.test.ts, design §7).
import { GwBudgetPlanSchema } from "@openfront/engine-api/ww1914/GwBudget";
import { GwDealSchema } from "@openfront/engine-api/ww1914/GwDeals";
import {
  GwBallotBlockSchema,
  GwFactionStateSchema,
} from "@openfront/engine-api/ww1914/GwHouse";
import {
  GwOrderSchema,
  type GwOrder,
} from "@openfront/engine-api/ww1914/GwOrders";
import {
  GwWorldCondSchema,
  GwWorldEffectSchema,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { moneyBillOf, moneyIds } from "@openfront/engine-lib/ww1914/MoneyRows";
import { houseStep } from "@openfront/engine/ww1914/House";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const ORDERS: GwOrder[] = [
  {
    kind: "budget_put",
    credits: false,
    shares: [60, 6, 14, 10, 10],
    mix: [130, 20, 0, 10],
    tax: "property",
    marks: ["deu_east_prussia"],
  },
  {
    kind: "bill_counter",
    law: "deu_money_budget",
    faction: "deu_centre",
    counter: "region",
    pick: "deu_east_prussia",
  },
  {
    kind: "bill_term",
    law: "deu_money_budget",
    faction: "deu_centre",
    want: "w1",
    term: "war_end",
  },
  {
    kind: "bill_favour",
    law: "deu_money_credits_2",
    faction: "deu_spd",
    want: null,
    call: true,
  },
  {
    kind: "bill_threat",
    law: "deu_money_credits_2",
    faction: "deu_spd",
    threat: "dissolve",
  },
  {
    kind: "bill_peel",
    law: "deu_money_credits_2",
    faction: "deu_spd",
    want: null,
  },
  {
    kind: "table_counter",
    counters: [{ claim: 3, fate: "vassal", term: null }],
  },
];

describe("ww210 money format", () => {
  test("the new shapes parse", () => {
    for (const o of ORDERS)
      expect(GwOrderSchema.safeParse(o).success).toBe(true);
    expect(
      GwBudgetPlanSchema.safeParse({
        shares: [60, 6, 14, 10, 10],
        mix: [100, 0, 0, 0],
        tax: "profits",
        marks: [],
      }).success,
    ).toBe(true);
    expect(
      GwDealSchema.safeParse({
        uid: 1,
        kind: "threat",
        faction: "deu_spd",
        person: "deu_ebert",
        law: "deu_money_credits_2",
        threat: "file",
        chapter: 5,
        due: 7,
        fate: "open",
        ended: -1,
      }).success,
    ).toBe(true);
    expect(
      GwBallotBlockSchema.safeParse({
        faction: "deu_spd",
        cast: "against",
        seats: 1,
        beat: "defy",
        person: "deu_liebknecht",
        wing: true,
      }).success,
    ).toBe(true);
    expect(
      GwFactionStateSchema.partial().safeParse({
        defied: 2,
        split: 3,
        peels: [4],
      }).success,
    ).toBe(true);
    for (const c of [
      { is: "money", bill: "credits", now: "failed" },
      { is: "tax_kind", tax: "income" },
      { is: "defy", id: "deu_spd", min: 2 },
      { is: "ledger", kind: "owe", id: "deu_centre" },
    ]) {
      expect(GwWorldCondSchema.safeParse(c).success).toBe(true);
    }
    for (const e of [
      { do: "earmark", id: "deu_east_prussia", on: true },
      { do: "split_pressure", id: "deu_spd", delta: 1 },
      { do: "ledger", kind: "owed", id: "deu_centre" },
    ]) {
      expect(GwWorldEffectSchema.safeParse(e).success).toBe(true);
    }
  });

  test("every seat has a money row on its own chambers, and the ids read back", () => {
    const money = gwContent().money!;
    const houses = gwContent().houses ?? [];
    expect(money.rows.map((r) => r.tag).sort()).toEqual([
      "AUH",
      "DEU",
      "FRA",
      "GBR",
      "RUS",
    ]);
    for (const r of money.rows) {
      const own = houses
        .find((h) => h.tag === r.tag)!
        .chambers.map((c) => c.id);
      for (const c of r.houses) expect(own).toContain(c);
      expect(r.credits.length).toBeGreaterThan(0);
    }
    expect(moneyBillOf(moneyIds.budget("DEU"))).toEqual({
      tag: "DEU",
      kind: "budget",
      n: 0,
    });
    expect(moneyBillOf(moneyIds.credits("FRA", 5))).toEqual({
      tag: "FRA",
      kind: "credits",
      n: 5,
    });
    expect(moneyBillOf("deu_money_budget_2")).toBeNull();
    // GBR's 1914 Budget is a law row of its own, not a money bill.
    expect(moneyBillOf("gbr_budget")).toBeNull();
    expect(moneyBillOf("deu_war_credits")).toBeNull();
  });

  test("the stubs refuse and change nothing", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    houseStep(gw);
    const seat = gw.s.seats[0];
    const before = JSON.stringify(gw.s);
    expect(applyGwOrder(gw, seat, ORDERS[0])).toBe("no_meeting");
    for (const o of ORDERS.slice(1, 6)) {
      expect(applyGwOrder(gw, seat, o)).toBe("no_law");
    }
    expect(applyGwOrder(gw, seat, ORDERS[6])).toBe("table_no");
    expect(JSON.stringify(gw.s)).toBe(before);
  });
});
