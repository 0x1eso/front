// ww190 §10: after the conference's sessions come three months of the
// aftermath, before the closing chapter: ratification, demobilisation.
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_TABLE_SESSIONS } from "@openfront/engine-lib/ww1914/TableRows";
import {
  afterMonths,
  demobOf,
  GW_AFTER_CHAPTERS,
} from "@openfront/engine/ww1914/Aftermath";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { armistice } from "@openfront/engine/ww1914/Peace";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { enter, openGeneral } from "@openfront/engine/ww1914/Wars";
import { stageOf } from "@openfront/engine/ww1914/World";
import { worldEffect } from "@openfront/engine/ww1914/WorldDsl";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

async function lostWar(): Promise<GreatWar> {
  const { runner } = await gwRunner();
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  openGeneral(gw, "DEU", "FRA", "test");
  gw.nation("AUH")!.ai = "hardline";
  if (gw.nation("AUH")!.side === null) enter(gw, "AUH", "central", "test");
  armistice(gw, "central_lost", "DEU");
  return gw;
}

describe("the aftermath", () => {
  test("the sessions, then three aftermath months, then the closing chapter; the table signs before the first", async () => {
    const gw = await lostWar();
    const seat = gw.s.seats[0];
    const stages: string[] = [];
    const months: (number | null)[] = [];
    for (let guard = 0; guard < 20 && gw.s.ended === null; guard++) {
      advanceChapter(gw, 0, true);
      stages.push(stageOf(gw));
      months.push(afterMonths(gw));
      if (stageOf(gw) === "aftermath" && afterMonths(gw) === 1) {
        expect(gw.s.table?.closed).toBe(true);
        expect(
          holds(
            { gw, seat, cast: {} },
            world({ is: "after_months", min: 1, max: 1 }),
          ),
        ).toBe(true);
        worldEffect({ gw, seat, cast: {} }, { do: "demob", level: 2 });
      }
    }
    const want = [
      ...Array<string>(GW_TABLE_SESSIONS).fill("conference"),
      ...Array<string>(GW_AFTER_CHAPTERS).fill("aftermath"),
    ];
    expect(stages.slice(0, want.length)).toEqual(want);
    expect(stages[want.length]).toBe("closing");
    expect(months.slice(GW_TABLE_SESSIONS, want.length)).toEqual([1, 2, 3]);
    expect(gw.s.ended).not.toBeNull();
    // The seat's country chose all at once; a government nobody plays, by classes.
    expect(demobOf(gw, "DEU")).toBe(2);
    expect(demobOf(gw, "FRA")).toBe(1);
    expect(gw.s.news.some((x) => x.key === "demob_done" && x.a === "DEU")).toBe(
      true,
    );
  });

  test("a hardline loser refuses to ratify and the winners trust it less; the others ratify", async () => {
    const gw = await lostWar();
    const fra = gw.nation("FRA")!;
    for (let guard = 0; guard < 20 && stageOf(gw) !== "aftermath"; guard++) {
      advanceChapter(gw, 0, true);
    }
    const before = fra.trust.AUH ?? 0;
    advanceChapter(gw, 0, true);
    const seat = gw.s.seats[0];
    expect(gw.s.unratified).toContain("AUH");
    expect(fra.trust.AUH).toBe(Math.max(-3, before - 2));
    expect(gw.s.ratified).toContain("FRA");
    expect(gw.s.ratified).toContain("DEU");
    expect(holds({ gw, seat, cast: {} }, world({ is: "ratified" }))).toBe(true);
  });
});
