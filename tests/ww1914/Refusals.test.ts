// ww190 §4: France's army refusals, the command's answer, the President's review.
import type { GwOffensive } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { offensiveFront } from "@openfront/engine/ww1914/Offensives";
import {
  refusalsDo,
  refusalsHolds,
  refusalsOf,
  refusalsStep,
  restBlocks,
} from "@openfront/engine/ww1914/Refusals";
import { setEndStrain } from "@openfront/engine/ww1914/Strain";
import { openGeneral } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string, seat?: GwTag): Promise<GreatWar> {
  const start =
    seat === undefined
      ? { ...startOf(id, "full", []), players: [] }
      : startOf(id, "full", [], seat);
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  return gw;
}

function nextMonth(gw: GreatWar, from: number): number {
  const rows = gwChapters(gw.s.calendar);
  return rows.findIndex((c, i) => i > from && c.spanDays >= 28);
}

/** France worn out in the west, a great attack just thrown back. */
async function failedAttack(id: string, seat?: GwTag): Promise<GreatWar> {
  const gw = await world(id, seat);
  openGeneral(gw, "DEU", "FRA", "test");
  gw.s.chapter = nextMonth(gw, 12);
  const west = gw.s.theatres.find((t) => t.id === "west")!;
  expect(west.open).toBe(true);
  setEndStrain(west, "entente", 70);
  gw.nation("FRA")!.gauges.morale = 2;
  const o: GwOffensive = {
    tag: "FRA",
    theatre: "west",
    end: "entente",
    from: gw.s.chapter - 2,
    launch: gw.s.chapter - 1,
    method: "long",
    weight: 1,
    feint: false,
    quiet: false,
    round: 1,
    seenBy: [],
    months: 1,
    prepared: 1,
    press: null,
    done: gw.s.chapter,
    codeBy: [],
    last: "repulsed",
    answers: [],
  };
  gw.s.offensives = [o];
  return gw;
}

function month(gw: GreatWar): void {
  gw.s.chapter = nextMonth(gw, gw.s.chapter);
  refusalsStep(gw);
}

describe("refusals in the French army", () => {
  test("unanswered they spread a stage a month; the world learns at the second; the third breaks order", async () => {
    const gw = await failedAttack("GWREF1", "FRA");
    const seat = gw.s.seats[0];
    expect(refusalsHolds(gw, seat, { is: "refusals" })).toBe(false);
    refusalsStep(gw);
    expect(refusalsOf(gw, "FRA")!.stage).toBe(1);
    expect(gw.s.news.some((x) => x.key === "refusals_1")).toBe(true);
    expect(gw.s.secrets).not.toContain("fra_army_refusals");
    month(gw);
    expect(refusalsOf(gw, "FRA")!.stage).toBe(2);
    expect(gw.s.secrets).toContain("fra_army_refusals");
    month(gw);
    expect(refusalsOf(gw, "FRA")!.stage).toBe(3);
    expect(refusalsHolds(gw, seat, { is: "refusals", min: 3 })).toBe(true);
    const n = gw.nation("FRA")!;
    n.gauges.order = 4;
    const low = n.lowOrder;
    month(gw);
    month(gw);
    expect(n.gauges.order).toBe(2);
    expect(n.lowOrder).toBe(low + 2);
  });

  test("the answers: courts, rest (no great attack meanwhile), both; the President's review", async () => {
    const gw = await failedAttack("GWREF2", "FRA");
    const seat = gw.s.seats[0];
    const n = gw.nation("FRA")!;
    refusalsStep(gw);
    month(gw);
    month(gw);
    const army = n.inst.army!;
    const chamber = n.inst.chamber!;
    refusalsDo(gw, seat, { do: "refusals", answer: "courts" });
    const r = refusalsOf(gw, "FRA")!;
    expect(r).toMatchObject({ stage: 2, answer: "courts" });
    expect(n.inst.army).toBe(Math.min(5, army + 1));
    expect(n.inst.chamber).toBe(Math.max(-5, chamber - 1));
    expect(
      refusalsHolds(gw, seat, { is: "refusals", answer: "courts", min: 2 }),
    ).toBe(true);

    refusalsDo(gw, seat, { do: "refusals", answer: "rest" });
    expect(r.stage).toBe(1);
    expect(restBlocks(gw, "FRA")).toBe(true);
    // The rest, not the last attack's own pause, keeps the paper away.
    gw.s.offensives = [];
    expect(offensiveFront(gw, "FRA", "west")).toBe(false);
    month(gw);
    expect(restBlocks(gw, "FRA")).toBe(true);
    refusalsDo(gw, seat, { do: "refusals", answer: "both" });
    expect(r.stage).toBe(0);

    refusalsDo(gw, seat, { do: "pardon", many: true });
    refusalsDo(gw, seat, { do: "pardon", many: false });
    expect(r.pardons).toBe(2);
    expect(
      refusalsHolds(gw, seat, { is: "refusals", pardons: { min: 2 } }),
    ).toBe(true);
    for (let i = 0; i < 3; i++) month(gw);
    expect(restBlocks(gw, "FRA")).toBe(false);
    expect(offensiveFront(gw, "FRA", "west")).toBe(true);
  });

  test("an AI command answers at once, by its character", async () => {
    const gw = await failedAttack("GWREF3");
    gw.nation("FRA")!.ai = "hardline";
    refusalsStep(gw);
    month(gw);
    expect(refusalsOf(gw, "FRA")).toMatchObject({ stage: 0, answer: "courts" });
    const mild = await failedAttack("GWREF4");
    mild.nation("FRA")!.ai = "principled";
    refusalsStep(mild);
    month(mild);
    expect(refusalsOf(mild, "FRA")).toMatchObject({ stage: 0, answer: "both" });
  });
});
