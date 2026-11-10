// ww170 S3 (design ww168 B4): the crisis ladder from the 통치 tab, the state
// conditions scenes now wait on, and the filler rows for odd states.
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LADDER_POWERS } from "@openfront/engine-lib/ww1914/content/ladder";
import { GW_FILLER_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/filler";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
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
    expect(GW_LADDER_POWERS.map((p) => p.id)).toEqual([
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

  test("before the war a note goes across the July lines, one at a time", () => {
    julyPassed();
    const to = ladderTargets(gw, "DEU");
    expect(to).toEqual(expect.arrayContaining(["RUS", "FRA", "SRB"]));
    expect(to).not.toContain("AUH");
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

  test("a seat sent a note refuses; the AI sender who won't press backs down", () => {
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
    expect(l.step).toBe("backed_down");
    expect(gw.nation("RUS")!.authority).toBeLessThan(rus);
    expect(st().log.map((x) => x.key)).toContain("ladder_they_backed_down");
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
