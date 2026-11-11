// ww177 merge 3: the Imjin War's people read their dates on the game's own
// calendar (1590s), not 1936's.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { imjinContent } from "@openfront/engine-lib/imjin/Content";
import { IMJIN_PERSON_DATES } from "@openfront/engine-lib/imjin/PersonDates";
import {
  dayOfDate,
  dayOfDateIn,
  epochDaysOf,
} from "@openfront/engine-lib/ww1936/Calendar";
import { candidatesFor } from "@openfront/engine/ww1936/politics/Advisors";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, wwRunner } from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

describe("Imjin people's dates", () => {
  test("a date reads against the given epoch; 1936's by default", () => {
    expect(dayOfDateIn("1936-03-01")).toBe(dayOfDate("1936-03-01"));
    expect(dayOfDateIn("1590-03-01", epochDaysOf("1590-01-01"))).toBe(59);
    const reg = imjinContent();
    for (const id of Object.keys(IMJIN_PERSON_DATES)) {
      expect(reg.personIdx.get(id), id).toBeDefined();
    }
    expect(reg.personIdx.get("imjin_maeda_toshiie")?.until).toBe("1599-04-27");
  });

  test("advisors open and leave by the Imjin calendar", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    step(r, WW_PREP_TICKS + 2);
    const ww = r.game.worldWar()!;
    const jpn = byTag(r.game, "JPN").smallID();
    const at = (iso: string) =>
      candidatesFor(ww.politics, jpn, dayOfDateIn(iso, ww.epoch));
    const early = at("1591-01-01");
    expect(early).toContain("imjin_maeda_toshiie");
    expect(early).toContain("imjin_kato_kiyomasa");
    expect(early).not.toContain("imjin_kobayakawa_hideaki");
    const late = at("1599-06-01");
    expect(late).toContain("imjin_kobayakawa_hideaki");
    expect(late).not.toContain("imjin_maeda_toshiie");
  });
});
