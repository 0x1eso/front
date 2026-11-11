// ww173 phase A (design ww173 §3, §5): strain on a stalled front, the
// collapse, small moves and salients, and what a seat may see of it. Fixed
// states on the real 1914 set; no long runs (the 20-seed measure is the
// lane's own, in its scratch folder).
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { frontLandAt } from "@openfront/engine-lib/ww1914/FrontLand";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { posOf } from "@openfront/engine/ww1914/Eras";
import { pressOdds } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { peaceWill } from "@openfront/engine/ww1914/PairWar";
import {
  collapse,
  collapseAnswers,
  collapseHolds,
  pressureStep,
} from "@openfront/engine/ww1914/Stalemate";
import {
  addStrain,
  collapsedThisChapter,
  strainOf,
} from "@openfront/engine/ww1914/Strain";
import { gwView } from "@openfront/engine/ww1914/View";
import { openGeneral } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";
import { gwRunner } from "./util";

async function world(id: string): Promise<GreatWar> {
  const start = { ...startOf(id, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chapter = longChapter(gw, 8);
  gw.s.chain = null;
  gw.s.spark = null;
  return gw;
}

function longChapter(gw: GreatWar, from: number): number {
  return gwChapters(gw.s.calendar).findIndex(
    (c, i) => i >= from && c.spanDays >= 28,
  );
}

const theatre = (gw: GreatWar, id: string) =>
  gw.s.theatres.find((t) => t.id === id)!;

describe("the land a salient bites", () => {
  test("one place each, from the next line or back to its owner", () => {
    const base = frontLandAt("west", 1);
    expect(base.has("liege")).toBe(false);
    // Germany bites into Belgium, France into Lorraine.
    expect(frontLandAt("west", 1, 0, 1).get("liege")).toBe("central");
    expect(frontLandAt("west", 1, 0, -1).get("metz")).toBe("entente");
    expect(frontLandAt("west", 1, 0, 2).size).toBe(base.size + 2);
    // At the Hindenburg line a French bite gives Laon back to its owner.
    expect(frontLandAt("west", 2).get("laon")).toBe("central");
    expect(frontLandAt("west", 2, 0, -1).has("laon")).toBe(false);
    // A step past the line: the bite goes on from what the step took.
    expect(frontLandAt("west", 2, 1).get("peronne")).toBeUndefined();
    expect(frontLandAt("west", 2, 1, 1).get("peronne")).toBe("central");
    expect(frontLandAt("west", 2, 1, -1).has("arras")).toBe(false);
  });
});

describe("strain", () => {
  test("a strained end holds and attacks worse, read only where it fights", async () => {
    const gw = await world("GWSTR1");
    openGeneral(gw, "DEU", "FRA", "test");
    const west = theatre(gw, "west");
    expect(west.open).toBe(true);
    const push = pressOdds(gw, "west", "central");
    addStrain(gw, "west", "FRA", 90);
    expect(strainOf(gw, "west", "FRA")).toBe(90);
    expect(strainOf(gw, "west", "DEU")).toBe(0);
    expect(strainOf(gw, "west", "USA")).toBe(0);
    expect(pressOdds(gw, "west", "central")).toBeGreaterThan(push);
    addStrain(gw, "west", "FRA", 50);
    expect(strainOf(gw, "west", "FRA")).toBe(100);
    addStrain(gw, "west", "DEU", 80);
    expect(pressOdds(gw, "west", "entente")).toBeGreaterThan(0);
    // Nothing for a country that doesn't fight there.
    addStrain(gw, "west", "USA", 50);
    expect(west.strain).toEqual([80, 100]);
  });

  test("a worn front makes its staff talk sooner", async () => {
    const gw = await world("GWSTR2");
    openGeneral(gw, "DEU", "RUS", "test");
    const was = peaceWill(gw, "RUS", "DEU");
    addStrain(gw, "east", "RUS", 85);
    expect(peaceWill(gw, "RUS", "DEU")).toBe(was + 25);
  });
});

describe("collapse", () => {
  test("a broken end gives up a line and more, and the clock resets", async () => {
    const gw = await world("GWSTR3");
    openGeneral(gw, "DEU", "RUS", "test");
    const east = theatre(gw, "east");
    east.trench = 3;
    east.salient = 1;
    addStrain(gw, "east", "RUS", 95);
    addStrain(gw, "east", "DEU", 30);
    const before = posOf(east);
    const rus = gw.nation("RUS")!;
    const morale = rus.gauges.morale;
    const low = rus.lowOrder;
    collapse(gw, east, "entente");
    // East rises for the Central end: four steps, a line and one.
    expect(posOf(east)).toBe(before + 4);
    expect(east.trench).toBe(0);
    expect(east.salient).toBe(0);
    expect(east.strain).toEqual([20, 40]);
    expect(east.cooldown).toBeGreaterThan(gw.s.chapter + 4);
    expect(rus.gauges.morale).toBe(morale - 1);
    expect(rus.lowOrder).toBe(low + 2);
    expect(collapsedThisChapter(gw, "east")).toBe("RUS");
    expect(collapsedThisChapter(gw, "west")).toBeNull();
    expect(gw.s.news.some((x) => x.key === "front_collapse")).toBe(true);
    const rusSeat = { tag: "RUS", flags: [] } as unknown as GwSeatState;
    const deuSeat = { tag: "DEU", flags: [] } as unknown as GwSeatState;
    const own = {
      is: "collapse" as const,
      theatre: ["east" as const],
      max: 0,
    };
    expect(collapseHolds(gw, rusSeat, own)).toBe(true);
    expect(collapseHolds(gw, deuSeat, own)).toBe(false);
    expect(collapseHolds(gw, deuSeat, { ...own, foe: true })).toBe(true);
    // The card comes next chapter, months later on a long calendar: still now.
    gw.s.chapter++;
    expect(collapseHolds(gw, rusSeat, own)).toBe(true);
    gw.s.chapter += 4;
    expect(collapseHolds(gw, rusSeat, own)).toBe(false);
    gw.s.chapter -= 5;
  });

  test("small moves bite one place at a time, within the budget", async () => {
    const gw = await world("GWSTR4");
    openGeneral(gw, "DEU", "FRA", "test");
    const west = theatre(gw, "west");
    for (const n of gw.s.nations) {
      if (n.alloc !== null) n.alloc = { ...n.alloc, posture: "hold" };
    }
    const start = gw.s.chapter;
    let bites = 0;
    for (let c = start; c < start + 30; c++) {
      gw.s.chapter = c;
      const was = frontLandAt("west", 1, 0, west.salient ?? 0);
      pressureStep(gw, [west], [posOf(west)]);
      const now = frontLandAt("west", 1, 0, west.salient ?? 0);
      const moved = [...new Set([...was.keys(), ...now.keys()])].filter(
        (p) => was.get(p) !== now.get(p),
      );
      expect(moved.length).toBeLessThanOrEqual(1);
      expect(Math.abs(west.salient ?? 0)).toBeLessThanOrEqual(2);
      bites += moved.length;
    }
    expect(bites).toBeGreaterThan(0);
    expect(
      gw.s.news.filter((x) => x.key.startsWith("front_salient")).length,
    ).toBe(bites);
  });
});

describe("the seat", () => {
  test("never sees the enemy's strain; sees its own in words, and its card", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    openGeneral(gw, "DEU", "FRA", "test");
    const west = theatre(gw, "west");
    const seat = gw.s.seats[0];
    const shown = () => JSON.stringify(gwView(gw));
    const calm = shown();
    addStrain(gw, "west", "FRA", 99);
    expect(shown()).toBe(calm);
    addStrain(gw, "west", "DEU", 85);
    const front = gwView(gw).seats[0].world!.fronts.find(
      (f) => f.id === "west",
    )!;
    expect(front.strain).toBe(3);
    // Our end breaks: the card comes, and the river is dug in on.
    collapse(gw, west, "central");
    // The seat's own card when it has one, else the plain one.
    const card = gwContent().scenes.some((x) => x.id === "deu_w_collapse")
      ? "deu_w_collapse"
      : "gw_w_collapse";
    expect(seat.scheduled.some((q) => q.scene === card)).toBe(true);
    gw.s.chapter++;
    seat.choices.push({
      scene: card,
      pick: "river",
      chapter: gw.s.chapter,
      proxy: false,
    });
    collapseAnswers(gw);
    expect(west.trench).toBe(2);
    // The standing word on the fronts holds until changed.
    expect(
      applyGwOrder(gw, seat, { kind: "front_tempo", tempo: "quiet" }),
    ).toBe(null);
    expect(seat.tempo).toBe("quiet");
    applyGwOrder(gw, seat, { kind: "front_tempo", tempo: null });
    expect(seat.tempo).toBeUndefined();
  });
});
