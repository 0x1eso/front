// ww190 §1, §6: the peace years (arms, bonds, accords, the second crisis) and
// the great power that sits the war out (courting, mediation).
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  armsLevel,
  bondOf,
  courtSeats,
  GW_ARMS_STEP,
  mediate,
  moveBond,
  offerAccord,
  peaceYearsStep,
  raiseArms,
} from "@openfront/engine/ww1914/PeaceYears";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { GW_START_TREATIES } from "@openfront/engine/ww1914/Tables";
import { honourPct } from "@openfront/engine/ww1914/Wars";
import { worldEffect } from "@openfront/engine/ww1914/WorldDsl";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];
const ctx = () => ({ gw, seat: st(), cast: {} });
const is = (c: GwCond) => holds(ctx(), c);
const newsOf = (key: string) => gw.s.news.filter((x) => x.key === key);

/** Peace, on a month-long chapter: the long-chapter rules run. */
function longPeace(): void {
  gw.s.warChapter = null;
  const rows = gwChapters(gw.s.calendar);
  gw.s.chapter = rows.findIndex((c, i) => i > 2 && c.spanDays >= 28);
  expect(gw.s.chapter).toBeGreaterThan(0);
}

beforeEach(async () => {
  ({ runner } = await gwRunner());
  gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
});

describe("arms", () => {
  test("a step for every five points over June 1914, three once mobilised; the effect tilts the running plan out of the spare lines", () => {
    expect(armsLevel(gw, "DEU")).toBe(0);
    const before = [...gw.nation("DEU")!.budget.plan.shares];
    worldEffect(ctx(), { do: "arms", line: "army", delta: GW_ARMS_STEP });
    const after = gw.nation("DEU")!.budget.plan.shares;
    expect(after[0]).toBe(before[0] + GW_ARMS_STEP);
    expect(after.reduce((a, b) => a + b, 0)).toBe(100);
    expect(armsLevel(gw, "DEU")).toBe(1);
    expect(is(world({ is: "arming", min: 1 }))).toBe(true);
    expect(newsOf("arms_raised")).toHaveLength(1);
    gw.nation("FRA")!.mob = 1;
    expect(armsLevel(gw, "FRA")).toBe(3);
    expect(is(world({ is: "arms_race", tag: "FRA" }))).toBe(true);
    expect(is(world({ is: "arms_race", tag: "AUH" }))).toBe(false);
  });

  test("a hardline government nobody plays, a step behind its rival, catches up", () => {
    gw.nation("AUH")!.ai = "hardline";
    raiseArms(gw, "RUS", "army", GW_ARMS_STEP);
    longPeace();
    peaceYearsStep(gw);
    expect(armsLevel(gw, "AUH")).toBe(1);
  });
});

describe("bonds", () => {
  test("only treaty pairs and the Entente have one; it is clamped, read by the cond and by a treaty's honour", () => {
    expect(bondOf(gw, "DEU", "AUH")).toBe(0);
    expect(bondOf(gw, "GBR", "FRA")).toBe(0);
    expect(bondOf(gw, "DEU", "GBR")).toBeNull();
    expect(is(world({ is: "bond", tag: "GBR" }))).toBe(false);
    const row = GW_START_TREATIES.find(
      (t) => t.by === "AUH" && t.for === "DEU",
    )!;
    const was = honourPct(gw, row);
    worldEffect(ctx(), { do: "bond", tag: "AUH", delta: -5 });
    expect(bondOf(gw, "AUH", "DEU")).toBe(-3);
    expect(gw.s.bonds).toEqual({ AUH_DEU: -3 });
    expect(is(world({ is: "bond", tag: "AUH", max: -1 }))).toBe(true);
    expect(honourPct(gw, row)).toBe(was - 30);
    moveBond(gw, "DEU", "GBR", 1);
    expect(gw.s.bonds).toEqual({ AUH_DEU: -3 });
  });
});

describe("accords", () => {
  test("Britain offers the seat a naval holiday; taken, it holds; a navy that grows breaks it, with its prices", () => {
    offerAccord(gw, "GBR", "naval", "DEU");
    expect(is(world({ is: "accord_offered", kind: "naval", tag: "GBR" }))).toBe(
      true,
    );
    expect(newsOf("accord_offered")).toHaveLength(1);
    worldEffect(ctx(), { do: "accord_answer", yes: true });
    expect(is(world({ is: "accord_offered" }))).toBe(false);
    expect(is(world({ is: "accord", kind: "naval", broken: false }))).toBe(
      true,
    );
    const naval = gw.s.pressure.naval;
    const temp = gw.s.temp;
    raiseArms(gw, "DEU", "navy", GW_ARMS_STEP);
    expect(is(world({ is: "accord", kind: "naval", broken: true }))).toBe(true);
    expect(gw.s.pressure.naval).toBe(naval + 3);
    expect(gw.s.temp).toBe(Math.min(10, temp + 1));
    expect(gw.nation("GBR")!.trust.DEU).toBe(-2);
    expect(newsOf("accord_broken")).toHaveLength(1);
  });

  test("a government nobody plays answers as the chapter closes: yes when behind or cautious, else no", () => {
    gw.nation("FRA")!.ai = "hardline";
    worldEffect(ctx(), { do: "accord", kind: "colonial", tag: "FRA" });
    peaceYearsStep(gw);
    expect(newsOf("accord_refused")).toHaveLength(1);
    expect(gw.s.accords ?? []).toEqual([]);
    gw.nation("GBR")!.ai = "hardline";
    raiseArms(gw, "DEU", "navy", GW_ARMS_STEP);
    worldEffect(ctx(), { do: "accord", kind: "naval", tag: "GBR" });
    peaceYearsStep(gw);
    expect(newsOf("accord_made")).toHaveLength(1);
  });

  test("an accord in force cools its question each long chapter", () => {
    longPeace();
    offerAccord(gw, "DEU", "balkan", "AUH");
    gw.nation("AUH")!.ai = "cautious";
    gw.s.pressure.balkan = 4;
    peaceYearsStep(gw);
    expect(gw.s.pressure.balkan).toBe(3);
  });

  test("a broken accord brings the spark on its question a chapter sooner", () => {
    gw.s.spark = { topic: "colonial", chapter: gw.s.chapter + 5 };
    offerAccord(gw, "DEU", "colonial", "FRA");
    gw.nation("FRA")!.ai = "cautious";
    peaceYearsStep(gw);
    worldEffect(ctx(), { do: "break_accord", kind: "colonial" });
    expect(gw.s.spark?.chapter).toBe(gw.s.chapter + 4);
  });
});

describe("the second crisis", () => {
  test("the spark comes on the question under most pressure", () => {
    gw.s.chain = { topic: "balkan", step: 0, hold: 0, short: true };
    gw.s.pressure.colonial = 20;
    closeChain(gw, "compromise");
    expect(gw.s.spark?.topic).toBe("colonial");
  });
});

describe("the great power that sits it out", () => {
  test("the sides bid for the seat's neutral country while the war runs", () => {
    gw.s.warChapter = gw.s.chapter;
    expect(gw.nation("DEU")!.side).toBeNull();
    for (let i = 0; i < 40; i++) {
      gw.s.chapter = i;
      courtSeats(gw);
    }
    expect(is(world({ is: "courted", min: 2 }))).toBe(true);
    expect(is(world({ is: "courted", min: 6 }))).toBe(false);
  });

  test("an offer to mediate waits a chapter, then each side's lead answers it", () => {
    gw.s.warChapter = gw.s.chapter;
    mediate(gw, st());
    expect(is(world({ is: "mediating" }))).toBe(true);
    peaceYearsStep(gw);
    expect(is(world({ is: "mediating" }))).toBe(true);
    peaceYearsStep(gw);
    expect(is(world({ is: "mediating" }))).toBe(false);
    const answers = gw.s.news.filter((x) => x.key.startsWith("mediation_"));
    expect(answers).toHaveLength(1);
    expect(answers[0].a).toBe("DEU");
    mediate(gw, st());
    expect(is(world({ is: "mediating" }))).toBe(false);
  });
});
