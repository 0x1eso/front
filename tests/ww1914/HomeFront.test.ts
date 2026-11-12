// ww190 §5: the home front: prisoners, hunger, women at work, refugees, the flu.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  addPrisoners,
  exchange,
  fluWave,
  homeFrontHolds,
  homeFrontStep,
  hungerOf,
  prisonersHeld,
  refugeesOf,
  reprisal,
  returnPrisoners,
  womenAtWork,
} from "@openfront/engine/ww1914/HomeFront";
import { moveLand } from "@openfront/engine/ww1914/Land";
import { collapse } from "@openfront/engine/ww1914/Stalemate";
import { enter, openGeneral } from "@openfront/engine/ww1914/Wars";
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

describe("the home front", () => {
  test("prisoners: taken when a front breaks, swapped through Switzerland, made to pay, sent home", async () => {
    const gw = await world("GWHF1", "DEU");
    const seat = gw.s.seats[0];
    openGeneral(gw, "DEU", "FRA", "test");
    gw.s.chapter = nextMonth(gw, 8);
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    expect(west.open).toBe(true);
    collapse(gw, west, "entente");
    const taken = prisonersHeld(gw, "DEU", "FRA");
    expect(taken).toBeGreaterThan(0);
    expect(
      homeFrontHolds(gw, seat, { is: "prisoners", held: "ours", min: taken }),
    ).toBe(true);

    addPrisoners(gw, "FRA", "DEU", 100);
    exchange(gw, "DEU", "FRA");
    expect(prisonersHeld(gw, "DEU", "FRA")).toBe(taken - Math.ceil(taken / 10));
    expect(prisonersHeld(gw, "FRA", "DEU")).toBe(90);
    expect(gw.nation("DEU")!.trust.FRA).toBe(1);
    expect(gw.s.news.some((x) => x.key === "prisoners_exchanged")).toBe(true);

    const morale = gw.nation("FRA")!.gauges.morale;
    const ready = gw.nation("USA")!.readiness;
    reprisal(gw, "DEU", "FRA");
    expect(gw.nation("FRA")!.gauges.morale).toBe(Math.max(0, morale - 1));
    expect(gw.nation("DEU")!.trust.FRA).toBe(0);
    expect(gw.nation("USA")!.readiness).toBe(ready + 2);

    const men = gw.nation("DEU")!.manpower;
    returnPrisoners(gw);
    expect(gw.s.prisoners).toEqual([]);
    expect(gw.nation("DEU")!.manpower).toBe(Math.min(100, men + 1));
    expect(homeFrontHolds(gw, seat, { is: "prisoners", held: "theirs" })).toBe(
      false,
    );
  });

  test("hunger, women at work and refugees follow the state", async () => {
    const gw = await world("GWHF2");
    openGeneral(gw, "DEU", "FRA", "test");
    const deu = gw.nation("DEU")!;
    expect(hungerOf(gw, "DEU")).toBe(0);
    gw.s.blockade = 6;
    expect(hungerOf(gw, "DEU")).toBe(2);
    deu.gauges.bread = 0;
    expect(hungerOf(gw, "DEU")).toBe(3);
    // Shipping, not the blockade, is Britain's hunger.
    gw.s.shipping = 3;
    expect(hungerOf(gw, "GBR")).toBe(1);

    const fra = gw.nation("FRA")!;
    fra.manpower = 45;
    expect(womenAtWork(gw, "FRA")).toBe(2);
    fra.manpower = 25;
    expect(womenAtWork(gw, "FRA")).toBe(3);
    expect(womenAtWork(gw, "USA")).toBe(0);

    const lost = GW_PLACE_KEYS.filter((p) => GW_PLACES[p].owner === "FRA")
      .filter((p) => p !== "paris")
      .slice(0, 4);
    for (const p of lost) moveLand(gw, p, "DEU", null, "occupation");
    expect(refugeesOf(gw, "FRA")).toBe(2);
    // An ally's capital held: its people come over (Belgium's to Britain).
    openGeneral(gw, "DEU", "BEL", "test");
    enter(gw, "GBR", "entente", "test");
    expect(refugeesOf(gw, "GBR")).toBe(0);
    moveLand(gw, "brussels", "DEU", null, "occupation");
    expect(gw.nation("BEL")!.side).toBe("entente");
    expect(refugeesOf(gw, "GBR")).toBe(1);
  });

  test("the flu comes late in a long war, in waves months apart", async () => {
    const gw = await world("GWHF3");
    openGeneral(gw, "DEU", "FRA", "test");
    const rows = gwChapters(gw.s.calendar);
    gw.s.warChapter = nextMonth(gw, 8);
    gw.s.chapter = gw.s.warChapter;
    for (let i = 0; i < 30; i++) {
      gw.s.chapter = nextMonth(gw, gw.s.chapter);
      homeFrontStep(gw);
    }
    expect(gw.s.flu).toBeUndefined();
    const waves: number[] = [];
    for (let i = 0; i < 40 && gw.s.chapter < rows.length - 1; i++) {
      const next = nextMonth(gw, gw.s.chapter);
      if (next < 0) break;
      gw.s.chapter = next;
      const men = gw.nation("FRA")!.manpower;
      homeFrontStep(gw);
      const w = gw.s.flu?.wave ?? 0;
      if (w > waves.length) {
        waves.push(gw.s.chapter);
        expect(fluWave(gw)).toBe(w);
        expect(gw.nation("FRA")!.manpower).toBe(Math.max(0, men - 2));
      }
    }
    expect(waves.length).toBeGreaterThanOrEqual(2);
    expect(waves[1] - waves[0]).toBeGreaterThanOrEqual(5);
    expect(gw.s.news.some((x) => x.key === "flu_wave_1")).toBe(true);
  });
});
