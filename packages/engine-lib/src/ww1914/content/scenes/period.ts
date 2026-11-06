import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * The plans' period marks. Chapters 0-10 are the same on every calendar, so the
 * crisis and 1914 fence by chapter; after that by the game's date.
 */
const MARKS = {
  c: ["1914-06", "1914-08"],
  "14": ["1914-08", "1914-12"],
  "15a": ["1915-01", "1915-06"],
  "15b": ["1915-07", "1915-12"],
  "16a": ["1916-01", "1916-06"],
  "16b": ["1916-07", "1916-12"],
  "17a": ["1917-01", "1917-06"],
  "17b": ["1917-07", "1917-12"],
  "18a": ["1918-01", "1918-06"],
  "18b": ["1918-07", "1918-12"],
} as const;
export type GwPeriod = keyof typeof MARKS;

/** The chapter the war's first full month opens in. */
const FIRST_WAR_CHAPTER = 6;

/** From the start of `from` to the end of `to`, on any calendar. */
export function period(from: GwPeriod, to: GwPeriod = from): GwCond {
  const date: GwCond = {
    kind: "world",
    of: { is: "date", from: MARKS[from][0], to: MARKS[to][1] },
  };
  const of: GwCond[] = [date];
  if (from === "14") of.push({ kind: "chapter", min: FIRST_WAR_CHAPTER });
  if (to === "c") of.push({ kind: "chapter", max: FIRST_WAR_CHAPTER - 1 });
  return of.length === 1 ? date : { kind: "all", of };
}

/** From a chapter of 1914 up to the end of a period. */
export const sinceChapter = (chapter: number, to: GwPeriod): GwCond => ({
  kind: "all",
  of: [
    { kind: "chapter", min: chapter },
    { kind: "world", of: { is: "date", to: MARKS[to][1] } },
  ],
});
