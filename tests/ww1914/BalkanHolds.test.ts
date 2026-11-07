import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GW_LINES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { describe, expect, test } from "vitest";
import { wwRunnerCapture } from "../ww1936/util";
import { HUMAN } from "./util";

// ww155: Serbia fell by the tenth chapter in plain play. The Drina, Belgrade and
// the Morava now count as ground for the defence: in plain games the front
// stays short of Nis through December 1914, and Serbia is never beaten before
// the war has run most of a year.
describe("the Balkan front in plain play", () => {
  test("Serbia is not at Nis by December 1914 in most games, and never beaten early", async () => {
    const nis = GW_LINES.balkan.indexOf("nis");
    let atNis = 0;
    const games = 6;
    for (let i = 0; i < games; i++) {
      const { runner } = await wwRunnerCapture(
        {
          greatWar1914: true,
          gameType: GameType.Singleplayer,
          greatWar1914Calendar: "full",
        },
        [{ clientID: HUMAN, gwCountry: "DEU" }],
        undefined,
        `BH${i}`,
      );
      for (let k = 0; k < 2; k++) {
        runner.addTurn({ turnNumber: runner.game.ticks(), intents: [] });
        runner.executeNextTick();
      }
      const gw = runner.game.greatWar()!;
      for (let guard = 0; guard < 16 && gw.s.ended === null; guard++) {
        if (gw.s.chapter === 5 && gw.s.warChapter === null) {
          gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
          gw.s.temp = 9;
        }
        gw.s.seats[0].ready = true;
        advanceChapter(gw, runner.game.ticks(), false);
        if (gw.s.chapter === 10) {
          const t = gw.s.theatres.find((x) => x.id === "balkan")!;
          if (t.line >= nis) atNis++;
        }
        if (gw.s.chapter <= 15) {
          expect(
            gw.nation("SRB")!.out,
            `game ${i} chapter ${gw.s.chapter}`,
          ).toBe(false);
        }
      }
    }
    expect(atNis).toBeLessThanOrEqual(2);
  }, 240000);
});
