// ww173 phase B: the great offensive as a decision (design ww173 §4).
// Fixed states only: no long runs.
import type { GwOffensive } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { offenseOdds, proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  aiOffensive,
  markSeen,
  offensiveRatio,
  offensiveResult,
  offensivesOf,
  type GwOffResult,
} from "@openfront/engine/ww1914/Offensives";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { holds, runEffect } from "@openfront/engine/ww1914/SceneRun";
import { intelOf } from "@openfront/engine/ww1914/Spies";
import { gwView } from "@openfront/engine/ww1914/View";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;
const west = (gw: GreatWar) => gw.s.theatres.find((t) => t.id === "west")!;

/** A full-calendar game with the general war open, the seat on Germany. */
async function war(id = "GWOFF1") {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  return { runner, gw, seat: gw.s.seats[0] };
}

function pass(gw: GreatWar, runner: GameRunner, chapters: number): void {
  for (let i = 0; i < chapters && gw.s.ended === null; i++) {
    advanceChapter(gw, runner.game.ticks(), false);
  }
}

/** The west in 1916-17: dug to the cap, past the opening. */
function stalemate(gw: GreatWar, chapter: number): void {
  gw.s.warChapter = 0;
  gw.s.chapter = chapter;
  const t = west(gw);
  t.trench = 5;
  t.since = 0;
  // As the launch paper signs it: the main effort, on a major scale.
  const seat = gw.s.seats[0];
  seat.alloc = { ...seat.alloc, main: "west", posture: "offensive" };
  seat.alloc.scale = "major";
}

function record(over: Partial<GwOffensive>): GwOffensive {
  return {
    tag: "DEU",
    theatre: "west",
    end: "central",
    from: 0,
    launch: null,
    method: "long",
    weight: 45,
    feint: false,
    quiet: false,
    round: 1,
    seenBy: ["FRA"],
    months: 3,
    prepared: 3,
    press: null,
    done: null,
    codeBy: [],
    last: null,
    answers: [],
    ...over,
  };
}

/** Results of one round on many seeds, percent. */
function spread(gw: GreatWar, o: GwOffensive): Record<GwOffResult, number> {
  const out: Record<GwOffResult, number> = {
    break: 0,
    bite: 0,
    attrition: 0,
    repulsed: 0,
  };
  const seed = gw.s.seed;
  const n = 400;
  for (let i = 0; i < n; i++) {
    gw.s.seed = seed + i * 7919;
    const { ratio, faced } = offensiveRatio(gw, o);
    out[offensiveResult(ratio, faced)]++;
  }
  gw.s.seed = seed;
  for (const k of Object.keys(out) as GwOffResult[]) {
    out[k] = Math.round((out[k] * 100) / n);
  }
  return out;
}

const ids = (gw: GreatWar) => proposalsFor(gw, gw.s.seats[0]).map((p) => p.id);

describe("the launch table (design §4 targets)", () => {
  test("the dug-in west: most stall or fail, about one in ten breaks", async () => {
    const { gw } = await war();
    // A three months' long bombardment, seen, nobody reinforced: no surprise.
    for (const chapter of [24, 34]) {
      stalemate(gw, chapter);
      const o = record({ weight: 75 });
      gw.s.offensives = [o];
      const r = spread(gw, o);
      expect(r.break).toBeGreaterThanOrEqual(3);
      expect(r.break).toBeLessThanOrEqual(10);
      expect(r.bite).toBeGreaterThanOrEqual(17);
      expect(r.bite).toBeLessThanOrEqual(32);
      expect(r.attrition).toBeGreaterThanOrEqual(38);
      expect(r.attrition).toBeLessThanOrEqual(58);
      expect(r.repulsed).toBeGreaterThanOrEqual(16);
      expect(r.repulsed).toBeLessThanOrEqual(34);
    }
    // 1918: infiltration, unseen, a month's preparation.
    stalemate(gw, 46);
    gw.nation("DEU")!.techs = ["infiltration"];
    const sur = record({ weight: 25, method: "surprise", seenBy: [] });
    gw.s.offensives = [sur];
    const r = spread(gw, sur);
    expect(r.break).toBeGreaterThanOrEqual(18);
    expect(r.break).toBeLessThanOrEqual(33);
  }, 60000);

  test("allies going in the same chapter on two fronts each gain", async () => {
    const { gw } = await war();
    stalemate(gw, 24);
    const o = record({ launch: 24 });
    gw.s.offensives = [o];
    const alone = offensiveRatio(gw, o).ratio;
    gw.s.offensives.push(record({ tag: "AUH", theatre: "east", launch: 24 }));
    expect(offensiveRatio(gw, o).ratio).toBeGreaterThan(alone + 9);
  });
});

describe("the paper, the launch, press on or stop", () => {
  test("a seat prepares one, it goes in, and it is stopped", async () => {
    const { gw, runner, seat } = await war();
    stalemate(gw, 24);
    const paper = proposalsFor(gw, seat).find((p) => p.id === "offensive")!;
    expect(
      paper.offensive!.methods.find((m) => m.method === "long")!.open,
    ).toBe(true);
    expect(
      paper.offensive!.methods.find((m) => m.method === "surprise")!.open,
    ).toBe(false);
    const sign = (id: string, extra = {}) =>
      applyGwOrder(gw, seat, {
        kind: "allocate",
        main: "west",
        posture: "hold",
        scale: "limited",
        allyShare: 0,
        research: "artillery",
        paper: id,
        ...extra,
      });
    expect(sign("offensive", { method: "surprise", months: 1 })).toBe("closed");
    expect(sign("offensive", { method: "long", months: 1 })).toBe(null);
    expect(offensivesOf(gw).map((o) => [o.tag, o.theatre, o.round])).toEqual([
      ["DEU", "west", 0],
    ]);
    expect(ids(gw)).toEqual(["prep_go", "prep_stop"]);
    pass(gw, runner, 1);
    expect(gw.s.offensives![0].weight).toBeGreaterThan(0);
    expect(ids(gw)).toEqual(["launch", "prep_stop"]);
    const front = gwView(gw).seats[0].world.fronts.find(
      (f) => f.id === "west",
    )!;
    expect(front.prep).toMatchObject({ method: "long", round: 0, ready: true });
    pass(gw, runner, 1);
    const fought = gw.s.battles.filter(
      (b) => b.theatre === "west" && b.chapter === gw.s.chapter - 1,
    );
    expect(fought.map((b) => b.by)).toEqual(["central"]);
    expect(gw.s.news.some((n) => n.key === "off_launched")).toBe(true);
    const ctx = { gw, seat, cast: {} };
    expect(
      holds(ctx, world({ is: "offensive", method: ["long"], min: 1 })),
    ).toBe(true);
    expect(new Set(ids(gw))).toEqual(new Set(["press_on", "stop"]));
    expect(sign("stop")).toBe(null);
    expect(offensivesOf(gw)).toEqual([]);
    // A rest follows: no new paper for a while.
    pass(gw, runner, 1);
    expect(ids(gw)).not.toContain("offensive");
  }, 60000);

  test("an AI staff prepares on good odds and presses while it can", async () => {
    const { gw } = await war();
    stalemate(gw, 24);
    const fra = gw.nation("FRA")!;
    fra.strength.west = 5;
    gw.nation("DEU")!.strength.west = 1;
    west(gw).line += 1;
    fra.spent = -9;
    fra.gauges.shells = 3;
    fra.gauges.morale = 3;
    fra.manpower = 80;
    const plan = aiOffensive(gw, fra, "west", "artillery");
    expect(plan).toMatchObject({ main: "west", posture: "hold" });
    const o = gw.s.offensives!.find((x) => x.tag === "FRA" && !x.feint)!;
    expect(o.round).toBe(0);
    o.round = 1;
    o.launch = gw.s.chapter;
    expect(aiOffensive(gw, fra, "west", "artillery")).toMatchObject({
      posture: "offensive",
    });
    expect(o.press).toBe(gw.s.chapter + 1);
  });
});

describe("the defender learns of it", () => {
  test("the seat gets the scene and answers; play dumb needs a code", async () => {
    const { gw, seat } = await war();
    stalemate(gw, 24);
    gw.s.offensives = [
      record({ tag: "FRA", end: "entente", round: 0, seenBy: [], prepared: 0 }),
    ];
    const view = offensivesOf(gw)[0];
    const ctx = { gw, seat, cast: {} };
    const before = offenseOdds(gw, west(gw), "entente", 0);
    markSeen(gw, view, "DEU");
    expect(seat.scheduled.map((q) => q.scene)).toContain("gw_offensive_seen");
    expect(holds(ctx, world({ is: "foe_offensive" }))).toBe(true);
    expect(holds(ctx, world({ is: "foe_offensive", code: true }))).toBe(false);
    markSeen(gw, view, "DEU", true);
    expect(holds(ctx, world({ is: "foe_offensive", code: true }))).toBe(true);
    runEffect(ctx, doWorld({ do: "counter_offensive", pick: "reserves" }));
    expect(gw.s.offensives![0].answers).toEqual([
      { tag: "DEU", pick: "reserves", chapter: gw.s.chapter },
    ]);
    expect(holds(ctx, world({ is: "foe_offensive" }))).toBe(false);
    expect(offenseOdds(gw, west(gw), "entente", 0)).toBeLessThan(before);
    // Acting on what the code told makes France wonder (design §6, 7A).
    expect(intelOf(gw, "FRA").suspect.DEU).toBe(1);
  });

  test("playing dumb on a code's word keeps France unsuspecting", async () => {
    const { gw, seat } = await war();
    stalemate(gw, 24);
    gw.s.offensives = [
      record({ tag: "FRA", end: "entente", round: 0, seenBy: [], prepared: 0 }),
    ];
    markSeen(gw, offensivesOf(gw)[0], "DEU", true);
    runEffect(
      { gw, seat, cast: {} },
      doWorld({ do: "counter_offensive", pick: "dumb" }),
    );
    expect(intelOf(gw, "FRA").suspect.DEU ?? 0).toBe(0);
  });

  test("an AI defender weighs it at once", async () => {
    const { gw } = await war();
    stalemate(gw, 24);
    gw.s.offensives = [record({ round: 0, seenBy: [], prepared: 0 })];
    markSeen(gw, offensivesOf(gw)[0], "FRA");
    expect(gw.s.offensives[0].answers.map((a) => a.tag)).toEqual(["FRA"]);
  });

  test("nothing of another country's offensive reaches a seat's view", async () => {
    const { gw, seat } = await war();
    stalemate(gw, 24);
    gw.s.offensives = [
      record({ tag: "FRA", end: "entente", round: 0, weight: 61, prepared: 1 }),
      record({ tag: "FRA", end: "entente", theatre: "italy", feint: true }),
    ];
    const text = JSON.stringify(gwView(gw, seat.smallID));
    expect(text).not.toContain("offensives");
    expect(text).not.toContain('"weight"');
    const fronts = gwView(gw, seat.smallID).seats[0].world.fronts;
    expect(fronts.every((f) => f.prep === null)).toBe(true);
  });
});
