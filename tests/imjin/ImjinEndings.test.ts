// ww177 P7a (Imjin design §10): the Imjin War's end. Each side is judged by
// its own aims (two can share a win); the game ends at the calendar's end
// or earlier by state; the ending card comes from the state.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  SEAT_ABROAD,
  SEAT_NORTH,
} from "@openfront/engine-lib/imjin/CourtRules";
import {
  IMJIN_EXPELLED_DAYS,
  imjinEndCause,
  imjinEnding,
  imjinGoals,
  JAPAN_HOLD_PM,
  JAPAN_TREATY_HOLD_PM,
  MING_SILVER_LIMIT,
  mingSilverDay,
  outDaysNext,
  type ImjinEndFacts,
} from "@openfront/engine-lib/imjin/EndingRules";
import { dayOfDateIn } from "@openfront/engine-lib/ww1936/Calendar";
import { IMJIN_CALENDARS } from "@openfront/engine-lib/ww1936/scenario/Profile";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, wwRunnerCapture } from "../ww1936/util";

const AT_WAR: ImjinEndFacts = {
  warBegan: true,
  atWar: true,
  jpnHeldPm: 400,
  josHeld: 5,
  seat: SEAT_NORTH,
  josCapitulated: false,
  peace: false,
  truce: false,
  truceBroken: false,
  liaodong: 0,
  silver: 0,
};

describe("the Imjin endings' rules", () => {
  test("the end comes by treaty, capitulation, expulsion or the calendar", () => {
    expect(imjinEndCause(AT_WAR, 0, 100, 3000)).toBeNull();
    expect(imjinEndCause(AT_WAR, 0, 3000, 3000)).toBe("calendar");
    // No calendar end (the unlimited row).
    expect(imjinEndCause(AT_WAR, 0, 99_999, -1)).toBeNull();
    expect(imjinEndCause({ ...AT_WAR, peace: true }, 0, 1, 3000)).toBe(
      "treaty",
    );
    // The king gone and every province lost.
    const fallen = { ...AT_WAR, josHeld: 0, seat: SEAT_ABROAD };
    expect(imjinEndCause(fallen, 0, 1, 3000)).toBe("capitulation");
    expect(imjinEndCause({ ...fallen, seat: SEAT_NORTH }, 0, 1, 3000)).toBe(
      null,
    );
    const out = { ...AT_WAR, jpnHeldPm: 0 };
    expect(imjinEndCause(out, IMJIN_EXPELLED_DAYS - 1, 1, 3000)).toBeNull();
    expect(imjinEndCause(out, IMJIN_EXPELLED_DAYS, 1, 3000)).toBe("expelled");
    // Before the war nothing but the calendar ends it.
    const peace = { ...out, warBegan: false, josHeld: 0, seat: SEAT_ABROAD };
    expect(imjinEndCause(peace, 500, 1, 3000)).toBeNull();
  });

  test("Japan's days out of Korea stand still under a truce and start again for a second war", () => {
    // ww177 final.
    const out = { ...AT_WAR, jpnHeldPm: 0 };
    expect(outDaysNext(out, 10)).toBe(11);
    expect(outDaysNext({ ...out, truce: true }, 10)).toBe(10);
    expect(outDaysNext({ ...out, rearming: true }, 10)).toBe(0);
    expect(outDaysNext(AT_WAR, 10)).toBe(0);
    expect(outDaysNext({ ...out, warBegan: false }, 10)).toBe(0);
  });

  test("the card comes from the state", () => {
    expect(imjinEnding(AT_WAR, "calendar")).toBe("partition");
    expect(imjinEnding({ ...AT_WAR, liaodong: 1 }, "calendar")).toBe(
      "japan_in_liaodong",
    );
    expect(imjinEnding({ ...AT_WAR, seat: SEAT_ABROAD }, "calendar")).toBe(
      "court_in_exile",
    );
    expect(imjinEnding({ ...AT_WAR, peace: true }, "treaty")).toBe(
      "investiture_peace",
    );
    expect(imjinEnding({ ...AT_WAR, jpnHeldPm: 0 }, "expelled")).toBe(
      "expulsion",
    );
    expect(imjinEnding({ ...AT_WAR, truceBroken: true }, "calendar")).toBe(
      "second_war",
    );
    expect(
      imjinEnding({ ...AT_WAR, atWar: false, truce: true }, "calendar"),
    ).toBe("truce_held");
    expect(imjinEnding({ ...AT_WAR, warBegan: false }, "calendar")).toBe(
      "truce_held",
    );
  });

  test("each side by its own aims: two can share a win", () => {
    // Japan holds a fifth of Korea: its aim, not Joseon's.
    expect(imjinGoals({ ...AT_WAR, jpnHeldPm: JAPAN_HOLD_PM })).toEqual({
      jos: false,
      jpn: true,
      min: false,
    });
    // The investiture taken with a coastal fort kept, the king at home:
    // Joseon has its land back and Japan its recognition.
    const peace = { ...AT_WAR, peace: true, jpnHeldPm: 30, atWar: false };
    expect(imjinGoals(peace)).toEqual({ jos: true, jpn: true, min: true });
    // Expelled, but the king across the Yalu and Ming's silver spent.
    const out = {
      ...AT_WAR,
      jpnHeldPm: 0,
      seat: SEAT_ABROAD,
      silver: MING_SILVER_LIMIT + 1,
    };
    expect(imjinGoals(out)).toEqual({ jos: false, jpn: false, min: false });
    // ww177 final: the investiture needs real land kept, not an islet.
    const islet = { ...peace, jpnHeldPm: JAPAN_TREATY_HOLD_PM - 1 };
    expect(imjinGoals(islet).jpn).toBe(false);
    expect(mingSilverDay(true, 3)).toBe(5);
    expect(mingSilverDay(false, 0)).toBe(0);
  });
});

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

describe("the Imjin War's end in a game", () => {
  test("Japan out of Korea for 180 days: expulsion, and the seats whose aims were met win", async () => {
    // Both seats human: nobody lands, nobody moves.
    const { runner: r, updates } = await wwRunnerCapture(
      CONFIG,
      [
        { clientID: HUMAN, country: "JOS" },
        { clientID: "HUMAN002", country: "JPN" },
      ],
      "imjinmini",
    );
    const g = r.game;
    const ww = g.worldWar()!;
    const im = ww.imjinWar!;
    // The default calendar ends in December 1599.
    expect(IMJIN_CALENDARS.y1590.endIso).toBe("1599-12-31");
    expect(im.endings.endDay()).toBe(dayOfDateIn("1599-12-31", ww.epoch));
    step(r, WW_PREP_TICKS + 1);
    const jos = byTag(g, "JOS").smallID();
    const jpn = byTag(g, "JPN").smallID();
    ww.setWar(jpn, jos, g.ticks());
    const warDay = ww.day(g.ticks());
    while (im.endings.ending() === null && ww.day(g.ticks()) < 200) step(r);
    const e = im.endings.ending()!;
    expect(e).toMatchObject({
      ending: "expulsion",
      cause: "expelled",
      jos: true,
      jpn: false,
      min: true,
      jpnHeldPm: 0,
    });
    expect(e.day - warDay).toBeGreaterThanOrEqual(IMJIN_EXPELLED_DAYS - 1);
    // The screens get it with the Imjin data.
    const sent = updates
      .flatMap((u) => u.updates[GameUpdateType.WwImjin] ?? [])
      .map((u) => u.data.ending)
      .filter((x) => x !== null);
    expect(sent[sent.length - 1]).toEqual(e);
    // The win check ends the game with the card: Joseon's human wins.
    step(r, 10);
    const wins = updates.flatMap((u) => u.updates[GameUpdateType.Win] ?? []);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({
      winner: ["team", "expulsion", HUMAN],
      reason: "imjin_end",
    });
    // The card is fixed: the days go on, it does not change.
    step(r, 30);
    expect(im.endings.ending()).toEqual(e);
  });
});
