// ww219 (design ww218 §3): the war plan's redraw. An empty plan at war spoils
// the opening and leaves the chief only "hold"; a finished redraw offers both
// prepared plans, and going the other way beats the spies who read the main.
import {
  GW_FRONT_UP,
  GW_THEATRES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  intelOf,
  PLAN_EDGE,
  planEdge,
  planOf,
} from "@openfront/engine/ww1914/Spies";
import {
  aimRedraw,
  beginRedraw,
  keepPlan,
  PLAN_EMPTY,
  PLAN_READY,
  PLAN_UNPLANNED,
  planFront,
  planMoment,
  planOn,
  warPlanStep,
  warPlanView,
} from "@openfront/engine/ww1914/WarPlan";
import { declareWar, openWar } from "@openfront/engine/ww1914/Wars";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];

/** The general war: Germany against Russia, France and Britain. */
function war(): void {
  openWar(gw);
  declareWar(gw, "DEU", "RUS", "test");
  declareWar(gw, "DEU", "FRA", "test");
  declareWar(gw, "DEU", "GBR", "test");
  expect(gw.nation("DEU")!.atWar).toContain("FRA");
}

beforeEach(async () => {
  ({ runner } = await gwRunner({}, "GWPLAN1"));
  gw = runner.game.greatWar()!;
  expect(gw.s.warChapter).toBeNull();
});

describe("the war plan's redraw", () => {
  test("a redraw empties the plan; war in those months spoils the opening and leaves only hold", () => {
    expect(planFront(gw, "DEU")).toBe("west");
    beginRedraw(gw, st());
    // The plan is empty: the spies find none, and the ruler names the road next.
    expect(planFront(gw, "DEU")).toBeNull();
    expect(planOf(gw, "DEU")).toBeNull();
    expect(st().scheduled).toContainEqual(
      expect.objectContaining({ scene: "gw_plan_redraw_deu" }),
    );
    expect(gwContent().scenes.some((x) => x.id === "gw_plan_redraw_deu")).toBe(
      true,
    );
    aimRedraw(gw, st(), "east");
    expect(warPlanView(gw, "DEU")?.redraw?.to).toBe("east");
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    war();
    const before = west.progress;
    warPlanStep(gw);
    // The war found it empty: the redraw is lost, the opening goes badly.
    expect(gw.nation("DEU")!.warPlan).toMatchObject({
      empty: true,
      redraw: null,
      alt: null,
    });
    const back = GW_FRONT_UP.west === "central" ? -1 : 1;
    expect(west.progress).toBe(Math.min(2, Math.max(-2, before + back)));
    expect(planOn(gw, "DEU", "west")).toBe(PLAN_EMPTY);
    expect(planOn(gw, "DEU", "east")).toBe(PLAN_EMPTY);
    gw.s.chapter += 1;
    expect(proposalsFor(gw, st()).map((p) => p.id)).toEqual(["hold_all"]);
    expect(planMoment(gw, "DEU", "empty")).toBe(true);
    // After the first paper the chief brings his usual ones again.
    gw.s.chapter += 1;
    expect(proposalsFor(gw, st()).length).toBeGreaterThan(1);
    // The hindsight comes once the opening is over.
    gw.s.chapter += 2;
    expect(planMoment(gw, "DEU", "hindsight")).toBe(true);
  });

  test("keeping the plan calls a redraw off: the old plan stands", () => {
    beginRedraw(gw, st());
    keepPlan(gw, st());
    expect(planFront(gw, "DEU")).toBe("west");
    war();
    warPlanStep(gw);
    expect(gw.nation("DEU")!.warPlan?.empty).toBe(false);
    expect(planOn(gw, "DEU", "west")).toBe(PLAN_READY);
  });

  test("a finished redraw: both prepared plans are offered; the other road beats the spies", () => {
    beginRedraw(gw, st());
    aimRedraw(gw, st(), "east");
    gw.s.day = gw.nation("DEU")!.warPlan!.redraw!.until;
    warPlanStep(gw);
    expect(gw.nation("DEU")!.warPlan).toMatchObject({
      alt: "east",
      redraw: null,
    });
    expect(planMoment(gw, "DEU", "done")).toBe(false);
    gw.s.chapter += 1;
    expect(planMoment(gw, "DEU", "done")).toBe(true);
    // In peace the spies read the main plan, west; France's agents did.
    expect(planOf(gw, "DEU")).toBe("west");
    intelOf(gw, "FRA").heard.push({
      fact: "plan",
      tag: "DEU",
      theatre: null,
      claim: GW_THEATRES.indexOf("west"),
      chapter: gw.s.chapter,
    });
    war();
    warPlanStep(gw);
    const ids = proposalsFor(gw, st()).map((p) => p.id);
    expect(ids.slice(0, 2)).toEqual(["plan_main", "plan_alt"]);
    // Read and kept to: the reader has the edge on the front it read.
    expect(planEdge(gw, "west", "entente")).toBe(PLAN_EDGE);
    // The ruler signs the other road: the opening goes east.
    st().alloc.main = "east";
    expect(planOn(gw, "DEU", "east")).toBe(PLAN_READY);
    expect(planOn(gw, "DEU", "west")).toBe(0);
    expect(planOf(gw, "DEU")).toBe("east");
    // France prepared for the plan it read and took the wrong road.
    expect(planEdge(gw, "west", "entente")).toBe(-PLAN_EDGE);
    expect(planEdge(gw, "west", "central")).toBe(PLAN_EDGE);
    // The pick is kept once the chapter is fought.
    gw.s.chapter += 1;
    st().signed = gw.s.chapter;
    warPlanStep(gw);
    expect(gw.nation("DEU")!.warPlan?.picked).toBe("alt");
    st().alloc.main = "west";
    expect(planOn(gw, "DEU", "east")).toBe(PLAN_READY);
    expect(planOn(gw, "DEU", "west")).toBe(0);
    // A front neither road prepared: men on the wrong railway lines.
    st().alloc.main = "balkan";
    expect(planOn(gw, "DEU", "balkan")).toBe(PLAN_UNPLANNED);
  });
});
