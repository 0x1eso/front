// ww170 S3 (design ww168 B4): the crisis ladder from the 통치 tab, the state
// conditions scenes now wait on, and the filler rows for odd states.
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LADDER_POWERS } from "@openfront/engine-lib/ww1914/content/ladder";
import { GW_FILLER_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/filler";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  closeChain,
  crisisStep,
  GW_SPARK_NEAR,
} from "@openfront/engine/ww1914/Crises";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  ladderAnswer,
  ladderPress,
  ladderStep,
  ladderTargets,
  yieldOdds,
} from "@openfront/engine/ww1914/Ladder";
import { takePower } from "@openfront/engine/ww1914/Powers";
import { holderOf, holds } from "@openfront/engine/ww1914/SceneRun";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner, seat as seatView } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];
const ctx = () => ({ gw, seat: st(), cast: {} });
const is = (c: GwCond) => holds(ctx(), c);
const note = (to: string) => ({
  id: "deu_pw_note",
  target: null,
  picks: [to],
  without: false,
  sound: false,
});

/** The July chain closed without a war, a chapter ago. */
function julyPassed(): void {
  expect(gw.s.chain).not.toBeNull();
  closeChain(gw, "compromise");
  gw.s.chapter += 1;
}

beforeEach(async () => {
  ({ runner } = await gwRunner({}, "GWLAD1"));
  gw = runner.game.greatWar()!;
});

describe("the crisis ladder", () => {
  test("every seat has a row; it waits for the July chain to close", () => {
    expect(GW_LADDER_POWERS.map((p) => p.id).slice(0, 5)).toEqual([
      "deu_pw_note",
      "gbr_pw_ultimatum",
      "auh_pw_ultimatum",
      "rus_pw_ultimatum",
      "fra_pw_ultimatum",
    ]);
    const row = () =>
      seatView(runner).powers!.find((p) => p.id === "deu_pw_note")!;
    expect(row().why).not.toBeNull();
    julyPassed();
    expect(row().why).toBeNull();
  });

  test("before the war a note goes to any it could fight, one at a time", () => {
    julyPassed();
    const to = ladderTargets(gw, "DEU");
    expect(to).toEqual(expect.arrayContaining(["RUS", "FRA", "SRB"]));
    // Allies by treaty, and those with no front between them, are not.
    expect(to).not.toContain("AUH");
    expect(to).not.toContain("OTT");
    holderOf(gw, st(), "chancellor")!.trust = 3;
    gw.nation("DEU")!.authority = 100;
    expect(takePower(gw, st(), note("rus"))).toBeNull();
    expect(gw.s.ladders).toMatchObject([
      { from: "DEU", to: "RUS", step: "sent" },
    ]);
    expect(is(world({ is: "ladder", role: "from", tag: "RUS" }))).toBe(true);
    expect(ladderTargets(gw, "DEU")).toEqual([]);
    expect(ladderTargets(gw, "FRA")).not.toContain("RUS");
  });

  test("an AI answers by the chapter's roll; a fearful one gives way more", () => {
    julyPassed();
    gw.s.ladders.push({
      from: "DEU",
      to: "SRB",
      step: "sent",
      opened: gw.s.chapter,
      chapter: gw.s.chapter,
    });
    const l = gw.s.ladders[0];
    const srb = gw.nation("SRB")!;
    srb.ai = "hardline";
    const hard = yieldOdds(gw, l);
    srb.ai = "cautious";
    expect(yieldOdds(gw, l)).toBeGreaterThan(hard);
    gw.s.chapter += 1;
    ladderStep(gw);
    expect(["accepted", "rejected"]).toContain(l.step);
  });

  test("a seat sent a note refuses; the AI sender presses or backs down by its state", () => {
    julyPassed();
    gw.s.ladders.push({
      from: "RUS",
      to: "DEU",
      step: "sent",
      opened: gw.s.chapter,
      chapter: gw.s.chapter,
    });
    const l = gw.s.ladders[0];
    const rus = gw.nation("RUS")!.authority;
    ladderAnswer(gw, st(), false);
    expect(l.step).toBe("rejected");
    gw.s.chapter += 1;
    ladderStep(gw);
    expect(["backed_down", "mobilised"]).toContain(l.step);
    if (l.step === "backed_down") {
      expect(gw.nation("RUS")!.authority).toBeLessThan(rus);
      expect(st().log.map((x) => x.key)).toContain("ladder_they_backed_down");
    } else {
      expect(st().scheduled.map((q) => q.scene)).toContain("gw_ladder_last");
    }
  });

  test("refused, the seat mobilises; standing firm at the last is the war", () => {
    julyPassed();
    gw.s.ladders.push({
      from: "DEU",
      to: "RUS",
      step: "rejected",
      opened: gw.s.chapter,
      chapter: gw.s.chapter,
    });
    const l = gw.s.ladders[0];
    ladderPress(gw, st(), true);
    expect(l.step).toBe("mobilised");
    expect(gw.nation("DEU")!.mob).toBe(2);
    // The other side is a seat in this case: its last answer is no.
    l.from = "RUS";
    l.to = "DEU";
    ladderAnswer(gw, st(), false);
    expect(l.step).toBe("war");
    expect(gw.s.warChapter).not.toBeNull();
    expect(gw.nation("DEU")!.side).toBe("central");
    expect(gw.nation("RUS")!.side).toBe("entente");
  });

  test("the Tsar may answer Vienna's July note with war; the other seats' rows still wait (ww179)", () => {
    const war = (id: string, on: string) => ({
      id,
      target: null,
      picks: [on],
      without: false,
      sound: false,
    });
    const c = gw.s.chain!;
    expect(c.short).toBe(false);
    gw.nation("RUS")!.authority = 100;
    gw.nation("DEU")!.authority = 100;
    holderOf(gw, st(), "chancellor")!.trust = 3;
    // Before Vienna's note goes to Belgrade, nobody's war row is open.
    c.step = 2;
    st().tag = "RUS";
    expect(takePower(gw, st(), war("rus_pw_war_on", "auh"))).not.toBeNull();
    // The note is out: Petersburg may declare on Vienna, and on no one else.
    c.step = 4;
    expect(takePower(gw, st(), war("rus_pw_war_on", "deu"))).not.toBeNull();
    st().tag = "DEU";
    expect(takePower(gw, st(), war("deu_pw_war_on", "rus"))).not.toBeNull();
    expect(gw.s.chain).not.toBeNull();
    st().tag = "RUS";
    expect(takePower(gw, st(), war("rus_pw_war_on", "auh"))).toBeNull();
    // July's declaration: the chain closes into the general war.
    expect(gw.s.chain).toBeNull();
    expect(gw.s.warChapter).not.toBeNull();
    expect(gw.nation("RUS")!.atWar).toContain("AUH");
    expect(gw.nation("RUS")!.side).toBe("entente");
    expect(gw.nation("AUH")!.side).toBe("central");
  });

  test("a later spark starts as hot as the world and ends in a note, not a war (ww176)", () => {
    julyPassed();
    // Calm after calm: no longer a hotter start each time.
    for (let i = 0; i < 4; i++) {
      gw.s.chains.push({
        topic: "colonial",
        outcome: "compromise",
        chapter: 1,
      });
    }
    gw.s.temp = 0;
    // ww190: a later spark lights on the question under most pressure (a
    // near tie, within GW_SPARK_NEAR, is the seed's).
    gw.s.pressure = {
      ...gw.s.pressure,
      balkan: 0,
      straits: 0,
      colonial: GW_SPARK_NEAR + 1,
    };
    gw.s.spark = { topic: "colonial", chapter: gw.s.chapter };
    crisisStep(gw);
    expect(gw.s.chain).toMatchObject({ topic: "colonial", short: true });
    expect(gw.s.temp).toBeLessThan(6);
    // Its top link, at its hottest: a note between the colonial rivals.
    gw.s.chain!.step = 5;
    gw.s.temp = 10;
    crisisStep(gw);
    expect(gw.s.chain).toBeNull();
    expect(gw.s.warChapter).toBeNull();
    // Berlin is the seat: Paris sends, and Berlin is dealt the card.
    expect(gw.s.ladders).toMatchObject([
      { from: "FRA", to: "DEU", step: "sent" },
    ]);
    expect(st().scheduled.map((q) => q.scene)).toContain("gw_ladder_note");
    const l = gw.s.ladders[0];
    for (let i = 0; i < 4 && l.step !== "war"; i++) {
      gw.s.chapter += 1;
      ladderStep(gw);
      if (gw.s.warChapter !== null) expect(l.step).toBe("war");
      if (i === 0) expect(l.step).toBe("rejected");
    }
    expect(gw.s.wars.some((w) => w.cause === "july")).toBe(false);
  });

  test("between crises the heat rises from the state and does not fall by itself (ww179)", () => {
    julyPassed();
    // A calm crisis cools a step, no longer by half.
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: true };
    gw.s.temp = 7;
    closeChain(gw, "compromise");
    expect(gw.s.temp).toBe(6);
    const quiet = () => {
      gw.s.spark = { topic: "balkan", chapter: 99 };
      for (const n of gw.s.nations) {
        n.mob = 0;
        n.unrest = 0;
        n.budget.plan.shares = [0, 0, 100, 0, 0];
      }
      for (const t of ["straits", "colonial", "balkan"] as const) {
        gw.s.pressure[t] = 0;
      }
    };
    // Nothing heats it: six chapters on it stands where it was.
    const from = gw.s.chapter;
    for (let i = 1; i <= 6; i++) {
      quiet();
      gw.s.chapter = from + i;
      crisisStep(gw);
    }
    expect(gw.s.temp).toBe(6);
    expect(gw.s.news.some((x) => x.key.startsWith("heat_"))).toBe(false);
    // Armies on foot, streets out, the Balkans unsettled: it climbs.
    const temps: number[] = [];
    for (let i = 0; i < 6; i++) {
      quiet();
      gw.nation("RUS")!.mob = 1;
      gw.nation("AUH")!.unrest = 2;
      gw.s.pressure.balkan = 9;
      gw.s.chapter = from + 1 + i;
      crisisStep(gw);
      temps.push(gw.s.temp);
    }
    expect(temps.every((t, i) => t >= (temps[i - 1] ?? 6))).toBe(true);
    expect(gw.s.temp).toBeGreaterThanOrEqual(8);
    expect(gw.s.news.some((x) => x.key.startsWith("heat_"))).toBe(true);
    // At the edge an AI gives way less readily.
    gw.s.ladders.push({
      from: "AUH",
      to: "SRB",
      step: "sent",
      opened: gw.s.chapter,
      chapter: gw.s.chapter,
    });
    const l = gw.s.ladders[0];
    gw.s.temp = 4;
    const cool = yieldOdds(gw, l);
    gw.s.temp = 10;
    expect(yieldOdds(gw, l)).toBeLessThan(cool);
  });
});

describe("conditions by state", () => {
  test("months of peace count from the crisis that closed; war months from the war", () => {
    expect(is(world({ is: "peace_months", min: 0 }))).toBe(false);
    julyPassed();
    expect(is(world({ is: "peace_months", min: 0, max: 0 }))).toBe(true);
    expect(is(world({ is: "war_months", min: 0 }))).toBe(false);
    gw.s.warChapter = gw.s.chapter;
    expect(is(world({ is: "war_months", min: 0, max: 0 }))).toBe(true);
    expect(is(world({ is: "war_months", own: true, min: 0 }))).toBe(false);
  });

  test("the calendar month is any year's", () => {
    const m = new Date(gw.s.day * 86400000).getUTCMonth() + 1;
    expect(is(world({ is: "month", of: [m] }))).toBe(true);
    expect(is(world({ is: "month", of: [((m + 5) % 12) + 1] }))).toBe(false);
  });
});

describe("filler rows", () => {
  test("every seat draws them, they repeat, and they are in the content", () => {
    const ids = new Set(gwContent().scenes.map((s) => s.id));
    for (const s of GW_FILLER_SCENES) {
      expect(ids.has(s.id)).toBe(true);
      expect(s.nation).toHaveLength(5);
      expect(s.cooldown).toBeGreaterThan(0);
      expect(s.scheduledOnly).toBeUndefined();
    }
  });

  test("a long peace opens the peace rows and not the war ones", () => {
    const peace = GW_FILLER_SCENES.find(
      (s) => s.id === "gw_fill_peace_reserves",
    )!;
    const late = GW_FILLER_SCENES.find((s) => s.id === "gw_fill_late_trains")!;
    julyPassed();
    expect(is(peace.when!)).toBe(false);
    // Two months on, by the calendar's chapters.
    const from = gw.s.chapter;
    for (let i = 0; i < 12 && !is(peace.when!); i++) gw.s.chapter += 1;
    expect(gw.s.chapter).toBeGreaterThan(from);
    expect(is(peace.when!)).toBe(true);
    expect(is(late.when!)).toBe(false);
  });
});
