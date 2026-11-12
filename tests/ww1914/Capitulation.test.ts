// ww188: a beaten country leaves the war, and the fronts follow the land.
// On the real 1914 set, since the places are what move.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  capitulationOdds,
  capitulationStep,
  homePlaces,
  lineFollowsLand,
} from "@openfront/engine/ww1914/Capitulation";
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

/** The next month-long chapter after `from`: the monthly roll runs in those. */
function nextMonth(gw: GreatWar, from: number): number {
  const rows = gwChapters(gw.s.calendar);
  return rows.findIndex((c, i) => i > from && c.spanDays >= 28);
}

const theatre = (gw: GreatWar, id: string) =>
  gw.s.theatres.find((t) => t.id === id)!;

/** Every home place of `owner` but `keep` goes to `to`. */
function takeAllBut(gw: GreatWar, owner: GwTag, to: GwTag, keep: GwPlace[]) {
  for (const p of homePlaces(gw, owner)) {
    if (!keep.includes(p)) moveLand(gw, p, to, null, "occupation");
  }
}

/**
 * France beaten down to three places, Belgium overrun, Britain beside them
 * in the west.
 */
async function franceAtTheEnd(id: string): Promise<GreatWar> {
  const gw = await world(id);
  openGeneral(gw, "DEU", "FRA", "test");
  enter(gw, "GBR", "entente", "test");
  gw.s.chapter = nextMonth(gw, 8);
  expect(theatre(gw, "west").open).toBe(true);
  takeAllBut(gw, "BEL", "DEU", []);
  takeAllBut(gw, "FRA", "DEU", ["bordeaux", "brest", "marseille"]);
  return gw;
}

describe("capitulation", () => {
  test("France with Paris gone and three places left gives up within months; the west closes, or passes to Britain where it holds ground", async () => {
    const gw = await franceAtTheEnd("GWCAP1");
    // Britain on its soil holds it a while, not for ever: six months at most.
    expect(capitulationOdds(gw, "FRA")).toBeGreaterThan(0);
    for (let i = 0; i < 7 && !gw.nation("FRA")!.out; i++) {
      capitulationStep(gw);
      gw.s.chapter = nextMonth(gw, gw.s.chapter);
    }
    expect(gw.nation("FRA")!.out).toBe(true);
    expect(gw.s.news.some((x) => x.key === "capital_fell")).toBe(true);
    expect(gw.s.news.some((x) => x.key === "nation_capitulated")).toBe(true);
    // Britain holds nothing there: its men go home and the front closes.
    expect(gw.nation("GBR")!.atWar).toContain("DEU");
    expect(gw.s.withdrawn).toContainEqual(
      expect.objectContaining({ theatre: "west", tag: "GBR" }),
    );
    expect(theatre(gw, "west").open).toBe(false);
    expect(gw.s.armistice).toBeNull();

    // With a place of its own on that ground, Britain holds the front.
    const held = await franceAtTheEnd("GWCAP2");
    moveLand(held, "calais", "GBR", null, "occupation");
    for (let i = 0; i < 7 && !held.nation("FRA")!.out; i++) {
      capitulationStep(held);
      held.s.chapter = nextMonth(held, held.s.chapter);
    }
    expect(held.nation("FRA")!.out).toBe(true);
    expect(held.s.withdrawn ?? []).not.toContainEqual(
      expect.objectContaining({ theatre: "west", tag: "GBR" }),
    );
    expect(theatre(held, "west").open).toBe(true);
    expect(theatre(held, "west").defender).toBe("GBR");
  });

  test("Serbia with Belgrade gone but its army whole fights on for a while", async () => {
    const gw = await world("GWCAP3");
    openGeneral(gw, "AUH", "SRB", "test");
    gw.s.chapter = nextMonth(gw, 8);
    for (const p of ["belgrade", "valjevo"] as const) {
      moveLand(gw, p, "AUH", null, "occupation");
    }
    const odds: number[] = [];
    for (let i = 0; i < 3; i++) {
      capitulationStep(gw);
      odds.push(capitulationOdds(gw, "SRB"));
      expect(gw.nation("SRB")!.out, `month ${i}`).toBe(false);
      gw.s.chapter = nextMonth(gw, gw.s.chapter);
    }
    expect(gw.s.govSeats).toContainEqual(
      expect.objectContaining({ tag: "SRB", place: "nis", fightOn: true }),
    );
    // Each month fighting on with the capital lost presses harder.
    expect(odds[2]).toBeGreaterThan(odds[0]);
    expect(odds[2]).toBeLessThan(50);
  });

  test("the west front's line moves past an occupied Paris", async () => {
    const gw = await world("GWCAP4");
    openGeneral(gw, "DEU", "FRA", "test");
    const west = theatre(gw, "west");
    west.line = 5; // the Marne
    west.progress = 0;
    moveLand(gw, "paris", "DEU", null, "occupation");
    lineFollowsLand(gw);
    expect(west.line).toBe(6);
  });
});
