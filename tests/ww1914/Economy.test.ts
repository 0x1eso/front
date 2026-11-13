// ww201 (design ww200 §8): the production step. Shells, bread and money come
// from what a country makes and holds; on the real 1914 set, since the land
// is what counts.
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwTableClaim } from "@openfront/engine-api/ww1914/GwTable";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { budgetStep } from "@openfront/engine/ww1914/Budget";
import {
  econForget,
  econTerms,
  peaceLevel,
  sumOf,
  type GwEconTerms,
} from "@openfront/engine/ww1914/Economy";
import { applyVassals, fateStep } from "@openfront/engine/ww1914/Fate";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveLand } from "@openfront/engine/ww1914/Land";
import { enter, openGeneral } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string): Promise<GreatWar> {
  const start = { ...startOf(id, "full", []), players: [] };
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

/** Puts the game at chapter `i`, on its date. */
function at(gw: GreatWar, i: number): void {
  gw.s.chapter = i;
  gw.s.day = gwChapters(gw.s.calendar)[i].day + gw.s.dayShift;
  econForget();
}

/** The chapters of a year and month range, by their dates. */
function chaptersOf(gw: GreatWar, year: number, from = 1, to = 12): number[] {
  return gwChapters(gw.s.calendar)
    .map((c, i) => ({ i, d: civilFromDays(c.day) }))
    .filter((x) => x.d.year === year && x.d.month >= from && x.d.month <= to)
    .map((x) => x.i);
}

const has = (t: GwEconTerms, g: keyof GwEconTerms, key: string) =>
  t[g].find(([k]) => k === key)?.[1] ?? 0;

const vassalClaim = (place: GwPlace): GwTableClaim => ({
  id: 0,
  session: 0,
  state: "agreed",
  step: "asked",
  offer: null,
  offerBy: null,
  offers: 0,
  pressed: false,
  place,
  by: "DEU",
  against: "FRA",
  fate: "vassal",
});

describe("the production step (ww201)", () => {
  test("Germany under a hard blockade loses bread over a war year while Russia's rises at the harvest", async () => {
    const gw = await world("GWECON1");
    openGeneral(gw, "DEU", "FRA", "test");
    for (const tag of ["GBR", "RUS"] as const) {
      if (gw.nation(tag)!.side === null) enter(gw, tag, "entente", "test");
    }
    const deu = gw.nation("DEU")!;
    const rus = gw.nation("RUS")!;
    gw.s.blockade = 9;
    const year = chaptersOf(gw, 1915);
    at(gw, year[0]);
    // The blockade is in the terms, by name.
    const t = econTerms(gw, deu);
    expect(has(t, "bread", "bread_blockade")).toBeLessThan(0);
    expect(has(t, "shells", "shells_blockade")).toBeLessThan(0);
    expect(has(t, "bread", "econ_imports")).toBeGreaterThan(0);
    deu.gauges.bread = 3;
    rus.gauges.bread = 1;
    let rusBefore = -1;
    let rusAfter = -1;
    let deuYear = 0;
    for (const i of year) {
      at(gw, i);
      const m = civilFromDays(gw.s.day).month;
      if (m === 8 && rusBefore < 0) rusBefore = rus.gauges.bread;
      const span = gwChapters(gw.s.calendar)[i].spanDays;
      deuYear += sumOf(econTerms(gw, deu).bread) * span;
      budgetStep(gw);
      if (m === 10) rusAfter = rus.gauges.bread;
    }
    // A year under the blockade costs Germany its bread, step by step.
    expect(deu.gauges.bread).toBeLessThan(3);
    expect(deuYear).toBeLessThan(0);
    // Russia's black earth comes in at the harvest.
    at(gw, chaptersOf(gw, 1915, 9, 9)[0]);
    const harvest = econTerms(gw, rus);
    expect(sumOf(harvest.bread)).toBeGreaterThan(0);
    expect(has(harvest, "bread", "econ_farms")).toBeGreaterThan(
      -has(harvest, "bread", "econ_eaters"),
    );
    expect(rusAfter).toBeGreaterThan(rusBefore);
  });

  test("an occupied place counts for its holder at its discount and no longer for its owner; a vassal's tribute stops when it breaks away", async () => {
    const gw = await world("GWECON2");
    openGeneral(gw, "DEU", "FRA", "test");
    at(gw, chaptersOf(gw, 1915, 3, 3)[0]);
    const deu = gw.nation("DEU")!;
    const fra = gw.nation("FRA")!;
    const before = { deu: econTerms(gw, deu), fra: econTerms(gw, fra) };
    moveLand(gw, "lille", "DEU", null, "occupation");
    econForget();
    const after = { deu: econTerms(gw, deu), fra: econTerms(gw, fra) };
    const gained =
      has(after.deu, "shells", "econ_held") -
      has(before.deu, "shells", "econ_held");
    const lost =
      has(before.fra, "shells", "econ_industry") -
      has(after.fra, "shells", "econ_industry");
    // Lille's works: France loses them, Germany gets less than France had.
    expect(gained).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(gained);
    expect(has(after.fra, "money", "econ_land_lost")).toBeLessThan(0);
    expect(has(after.deu, "money", "rule_levy")).toBeGreaterThan(0);

    // A vassal carved from France pays Germany, and stops when it is free.
    const v = await world("GWECON3");
    moveLand(v, "lille", "DEU", null, "occupation");
    moveLand(v, "cambrai", "DEU", null, "occupation");
    applyVassals(v, [vassalClaim("lille"), vassalClaim("cambrai")]);
    econForget();
    const lord = econTerms(v, v.nation("DEU")!);
    const slot = econTerms(v, v.nation("VFR")!);
    expect(has(lord, "bread", "econ_tribute")).toBeGreaterThan(0);
    expect(has(lord, "money", "econ_tribute")).toBeGreaterThan(0);
    expect(has(slot, "money", "econ_tribute_paid")).toBeLessThan(0);
    v.nation("VFR")!.vassal!.loyalty = 0;
    v.s.chapter++;
    fateStep(v);
    econForget();
    expect(v.nation("VFR")!.vassal).toBeUndefined();
    const free = econTerms(v, v.nation("DEU")!);
    expect(has(free, "bread", "econ_tribute")).toBe(0);
    expect(has(free, "money", "econ_tribute")).toBe(0);
  });

  test("a country at peace refills toward its peace level and stops there", async () => {
    const gw = await world("GWECON4");
    const deu = gw.nation("DEU")!;
    deu.gauges.shells = 0;
    deu.gauges.bread = 3;
    const level = peaceLevel("DEU", "shells");
    expect(level).toBe(2);
    let most = 0;
    const from = gw.s.chapter;
    for (let i = from; i < from + 30; i++) {
      at(gw, i);
      budgetStep(gw);
      most = Math.max(most, deu.gauges.shells);
    }
    expect(gw.s.warChapter).toBeNull();
    expect(deu.gauges.shells).toBe(level);
    expect(most).toBe(level);
    // Above its level nothing fills it more, and nothing drains it either.
    expect(deu.gauges.bread).toBe(3);
    expect(deu.econ!.why.shells).toBe("");
  });
});
