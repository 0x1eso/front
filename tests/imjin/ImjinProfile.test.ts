// ww177 (Imjin design §2, §10): the profile seam, the calendar and the lobby
// rules, without a game.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import {
  COUNTRY_TAGS,
  DORMANT_TAGS,
  IMJIN_TAGS,
  MAJOR_TAGS,
  PICK_ORDER,
} from "@openfront/engine-api/ww1936/Countries";
import { lunarOf, reignYearOf } from "@openfront/engine-lib/imjin/Lunar";
import { imjinStartOf } from "@openfront/engine-lib/imjin/Starts";
import { normalizeModeConfig } from "@openfront/engine-lib/ww1914/ModeConfig";
import { dateOfDay, epochDaysOf } from "@openfront/engine-lib/ww1936/Calendar";
import { wwTempo, wwUnlimited } from "@openfront/engine-lib/ww1936/Pace";
import {
  humanSeatsOf,
  isImjin,
  scenarioOf,
  WW_SYSTEMS,
  wwEpochDays,
  wwSystemOn,
} from "@openfront/engine-lib/ww1936/scenario/Profile";
import { assignCountries } from "@openfront/engine/ww1936/ScenarioPlayers";
import { describe, expect, test } from "vitest";
import { wwGameStart } from "../ww1936/util";

const IMJIN = { ww1936Scenario: "imjin1590" as const };
const lunar = (iso: string) => lunarOf(epochDaysOf(iso))!;

describe("the profile seam", () => {
  test("an absent key is 1936, and 1936 runs every system", () => {
    expect(scenarioOf({})).toBe("ww1936");
    expect(isImjin({})).toBe(false);
    expect(isImjin(IMJIN)).toBe(true);
    for (const s of WW_SYSTEMS) {
      expect(wwSystemOn({}, s)).toBe(true);
      expect(wwSystemOn(IMJIN, s)).toBe(false);
    }
    expect(humanSeatsOf({})).toBeNull();
    expect(humanSeatsOf(IMJIN)).toEqual(["JOS", "JPN"]);
  });

  test("the Imjin tags come after an explicit dormant list, outside the 1936 lobby", () => {
    expect(COUNTRY_TAGS.slice(-3)).toEqual([...IMJIN_TAGS]);
    expect(COUNTRY_TAGS.slice(-17, -3)).toEqual([...DORMANT_TAGS]);
    for (const t of IMJIN_TAGS) {
      expect(MAJOR_TAGS).not.toContain(t);
      expect(PICK_ORDER).not.toContain(t);
    }
  });

  test("unpicked humans take Joseon, then Japan; Ming is never a seat", () => {
    const seats = ["JOS", "JPN"] as const;
    const got = assignCountries(
      [{ clientID: "A", country: "MIN" }, { clientID: "B" }, { clientID: "C" }],
      [...seats],
      seats,
    );
    expect([...got]).toEqual([
      ["A", "JOS"],
      ["B", "JPN"],
    ]);
  });
});

describe("the calendar", () => {
  test("day 0 is the row's epoch; 1936 keeps its own", () => {
    expect(dateOfDay(0)).toEqual({ year: 1936, month: 1, day: 1 });
    const e = wwEpochDays(IMJIN);
    expect(dateOfDay(0, e)).toEqual({ year: 1590, month: 4, day: 1 });
    expect(
      dateOfDay(0, wwEpochDays({ ...IMJIN, imjinCalendar: "y1592" })),
    ).toEqual({ year: 1592, month: 4, day: 1 });
  });

  test("the lunar dates of the war's known days", () => {
    expect(lunar("1592-05-23")).toEqual({
      year: 1592,
      month: 4,
      leap: false,
      day: 13,
    });
    expect(lunar("1592-08-14")).toMatchObject({ month: 7, day: 8 });
    expect(lunar("1597-10-26")).toMatchObject({ month: 9, day: 16 });
    expect(lunar("1598-12-16")).toMatchObject({ month: 11, day: 19 });
    expect(lunar("1598-09-18")).toMatchObject({ month: 8, day: 18 });
    // Wanli 19, leap 3rd month, 18th day (Ming Shilu).
    expect(lunar("1591-05-10")).toMatchObject({
      year: 1591,
      month: 3,
      leap: true,
      day: 18,
    });
    expect(lunarOf(epochDaysOf("1936-01-01"))).toBeNull();
  });

  test("reign years by court", () => {
    const d = lunar("1592-05-23");
    expect(reignYearOf("joseon", d)).toEqual({ era: "seonjo", year: 25 });
    expect(reignYearOf("ming", d)).toEqual({ era: "wanli", year: 20 });
    expect(reignYearOf("japan", d)).toEqual({ era: "tensho", year: 20 });
    expect(reignYearOf("japan", lunar("1593-03-14"))).toEqual({
      era: "bunroku",
      year: 2,
    });
    expect(reignYearOf("japan", lunar("1597-10-26"))).toEqual({
      era: "keicho",
      year: 2,
    });
  });
});

describe("the mode's rules", () => {
  const norm = (c: Partial<GameConfig>) =>
    normalizeModeConfig(wwGameStart({ ...IMJIN, ...c }).config);

  test("the default row: 45 minutes, two seats, no 1936 extras", () => {
    const c = norm({ maxPlayers: 8 });
    expect(c.imjinCalendar).toBe("y1590");
    expect(c.maxTimerValue).toBe(45);
    expect(c.maxPlayers).toBe(2);
    expect(c.historicalAi).toBe(false);
    expect(c.ww1936Nukes).toBe(false);
    expect(c.ww1936Designer).toBeUndefined();
    expect(wwTempo(c)).toBe(1);
  });

  test("the long row is slower; unlimited has no timer", () => {
    expect(wwTempo(norm({ imjinCalendar: "long" }))).toBe(2);
    expect(norm({ imjinCalendar: "y1592" }).maxTimerValue).toBe(30);
    const u = norm({ imjinCalendar: "unlimited" });
    expect(u.maxTimerValue).toBeUndefined();
    expect(wwUnlimited(u)).toBe(true);
    expect(wwTempo(u)).toBe(2);
  });

  test("the 1936 game is untouched", () => {
    const c = normalizeModeConfig(wwGameStart({}).config);
    expect(c.gameMap).toBe(GameMapType.World1936);
    expect(c.ww1936Scenario).toBeUndefined();
    expect(c.imjinCalendar).toBeUndefined();
    expect(c.maxTimerValue).toBe(50);
  });

  test("the starts are data, Japan readier in 1592", () => {
    expect(imjinStartOf("y1592", "JPN").army).toBeGreaterThan(
      imjinStartOf("y1590", "JPN").army,
    );
    expect(imjinStartOf("y1590", "JOS").techs).toContain("artillery_1");
  });
});
