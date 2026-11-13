// ww190 §3: ruling occupied land, on the real 1914 set.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { econForget, econTerms } from "@openfront/engine/ww1914/Economy";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveLand } from "@openfront/engine/ww1914/Land";
import {
  clientOpen,
  resistOf,
  ruleDo,
  ruleHolds,
  ruleOf,
  ruleStep,
} from "@openfront/engine/ww1914/Rule";
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

/** Runs the rule's chapter step for `months` month-long chapters. */
function months(gw: GreatWar, n: number): void {
  for (let i = 0; i < n; i++) {
    gw.s.chapter = nextMonth(gw, gw.s.chapter);
    ruleStep(gw);
  }
}

const placesOf = (owner: GwTag, group?: string) =>
  GW_PLACE_KEYS.filter(
    (p) =>
      GW_PLACES[p].owner === owner &&
      (group === undefined || GW_PLACES[p].group === group),
  );

describe("ruling occupied land", () => {
  test("two places held three months open a row; hard rule feeds the ruler and stirs the land; relief calms it; the row closes when the land is gone", async () => {
    const gw = await world("GWRULE1", "DEU");
    const seat = gw.s.seats[0];
    openGeneral(gw, "DEU", "FRA", "test");
    gw.s.chapter = nextMonth(gw, 8);
    const taken = placesOf("FRA")
      .filter((p) => p !== "paris")
      .slice(0, 3);
    for (const p of taken) moveLand(gw, p, "DEU", null, "occupation");
    months(gw, 2);
    expect(ruleOf(gw, "DEU", "FRA")).toBeNull();
    months(gw, 2);
    const r = ruleOf(gw, "DEU", "FRA")!;
    // A seat starts under the army, and says how hard from its own card.
    expect(r).toMatchObject({ policy: "army", hard: 1, resist: 0 });
    expect(gw.s.news.some((x) => x.key === "rule_opened")).toBe(true);
    expect(ruleHolds(gw, seat, { is: "rule", of: "FRA", min: 1 })).toBe(true);

    ruleDo(gw, seat, { do: "rule", of: "FRA", hard: 5, policy: "civil" });
    expect(r).toMatchObject({ policy: "civil", hard: 3 });
    const n = gw.nation("DEU")!;
    const men = n.manpower;
    // ww201: the land's grain feeds the ruler through the production step,
    // more the harder it is ruled.
    econForget();
    const fed = econTerms(gw, n).bread.find(([k]) => k === "rule_requisition");
    expect(fed?.[1] ?? 0).toBeGreaterThan(0);
    // Hard rule stirs a step every three months.
    months(gw, 9);
    expect(n.manpower).toBeGreaterThanOrEqual(men + 2 - 1);
    expect(resistOf(gw, "DEU", "FRA")).toBe(3);
    expect(gw.s.news.some((x) => x.key === "occupied_rising")).toBe(true);
    const fraSeat = { ...seat, tag: "FRA" as const };
    expect(ruleHolds(gw, fraSeat, { is: "ruled", by: "DEU", min: 3 })).toBe(
      true,
    );

    ruleDo(gw, seat, { do: "rule", of: "FRA", relief: true });
    expect(r.resist).toBe(2);
    expect(ruleHolds(gw, seat, { is: "relief", of: "FRA" })).toBe(true);
    expect(ruleHolds(gw, fraSeat, { is: "relief" })).toBe(true);

    for (const p of taken) moveLand(gw, p, "FRA", null, "occupation");
    months(gw, 1);
    expect(ruleOf(gw, "DEU", "FRA")).toBeNull();
  });

  test("a client state needs the land whole or its owner beaten; an AI ruler starts by its character", async () => {
    const gw = await world("GWRULE2", "DEU");
    const seat = gw.s.seats[0];
    openGeneral(gw, "DEU", "RUS", "test");
    gw.nation("AUH")!.ai = "hardline";
    gw.s.chapter = nextMonth(gw, 8);
    const poland = placesOf("RUS", "russian_poland");
    for (const p of poland.slice(0, 3)) moveLand(gw, p, "DEU", null);
    const east = placesOf("RUS", "baltic").slice(0, 2);
    for (const p of east) moveLand(gw, p, "AUH", null);
    months(gw, 4);
    expect(ruleOf(gw, "AUH", "RUS")).toMatchObject({ policy: "army", hard: 2 });
    expect(clientOpen(gw, "DEU", "RUS", "poland")).toBe(false);
    ruleDo(gw, seat, { do: "rule", of: "RUS", client: "poland" });
    expect(ruleOf(gw, "DEU", "RUS")!.client).toBeNull();

    for (const p of poland) moveLand(gw, p, "DEU", null);
    expect(clientOpen(gw, "DEU", "RUS", "poland")).toBe(true);
    ruleDo(gw, seat, { do: "rule", of: "RUS", client: "poland" });
    expect(ruleOf(gw, "DEU", "RUS")).toMatchObject({
      policy: "client",
      client: "poland",
    });
    expect(gw.s.news.some((x) => x.key === "rule_client")).toBe(true);
    expect(
      ruleHolds(gw, seat, { is: "rule", of: "RUS", client: "poland" }),
    ).toBe(true);
  });
});
