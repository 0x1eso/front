import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  civilFromDays,
  dateOfDay,
  dayIndex,
  dayOfDate,
  daysFromCivil,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";

describe("the 1936 calendar", () => {
  test("civil dates round-trip through day numbers", () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(2000, 3, 1)).toBe(11017);
    for (const z of [-25567, 0, 11016, 11017, 19000]) {
      const d = civilFromDays(z);
      expect(daysFromCivil(d.year, d.month, d.day)).toBe(z);
    }
    expect(formatIsoDate(civilFromDays(-25567))).toBe("1900-01-01");
  });

  test("days since 1936-01-01 of the spec's events", () => {
    expect(dayOfDate("1936-01-01")).toBe(0);
    expect(dayOfDate("1936-07-17")).toBe(198);
    expect(dayOfDate("1939-09-01")).toBe(1339);
    expect(dayOfDate("1941-06-22")).toBe(1999);
    expect(dayOfDate("1944-06-06")).toBe(3079);
    expect(dayOfDate("1945-08-21")).toBe(3520);
    expect(formatIsoDate(dateOfDay(1339))).toBe("1939-09-01");
  });

  test("one day is 7.5 ticks after the preparation minute; 45:00 is 1945-08-21", () => {
    expect(dayIndex(0, WW_PREP_TICKS)).toBe(0);
    expect(dayIndex(WW_PREP_TICKS, WW_PREP_TICKS)).toBe(0);
    expect(dayIndex(WW_PREP_TICKS + 7, WW_PREP_TICKS)).toBe(0);
    expect(dayIndex(WW_PREP_TICKS + 8, WW_PREP_TICKS)).toBe(1);
    expect(dayIndex(WW_PREP_TICKS + 15, WW_PREP_TICKS)).toBe(2);
    expect(dayIndex(27_000, WW_PREP_TICKS)).toBe(3520);
    expect(formatIsoDate(dateOfDay(dayIndex(27_000, WW_PREP_TICKS)))).toBe(
      "1945-08-21",
    );
    for (const day of [0, 1, 2, 3, 198, 1339]) {
      const t = dayStartTick(day, WW_PREP_TICKS);
      expect(dayIndex(t, WW_PREP_TICKS)).toBe(day);
      if (day > 0) expect(dayIndex(t - 1, WW_PREP_TICKS)).toBe(day - 1);
    }
  });
});
