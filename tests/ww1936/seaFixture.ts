// World War 1936 P4 (plan Task 1 Step 24): the facts of the test map
// ww1936sea (scripts/ww1936/make-test-map.ts --variant sea checks them when
// it writes the map). Every P4 test reads these, never its own numbers.
export const SEA = {
  map: "ww1936sea" as const,
  width: 200,
  height: 120,
  kmPerTile: 4,
};
export const TAG_ID = {
  DEU: 1,
  ITA: 2,
  GBR: 3,
  FRA: 4,
  SUN: 5,
  POL: 6,
  TUR: 7,
} as const;
export const REGION = {
  paris: 1,
  lyon: 2,
  berlin: 3,
  munich: 4,
  rome: 5,
  warsaw: 6,
  krakow: 7,
  moscow: 8,
  kiev: 9,
  london: 10,
  isthmus: 11,
  malta: 12,
} as const;
export const ZONE = {
  west: 40001,
  middle: 40002,
  east: 40003,
  narrows: 40004,
} as const;
export const SR = {
  westLand: 1,
  eastLand: 2,
  approaches: 1001,
  central: 1002,
  eastern: 1003,
} as const;
/** Harbor zone by region (spec §3.5); every other region has none. */
export const HARBOR = {
  2: 40001,
  5: 40002,
  7: 40002,
  9: 40003,
  10: 40001,
  11: 40003,
  12: 40002,
} as const;
/** Start naval base levels by region; every other region 0. */
export const NAVAL_BASE = { 10: 6, 5: 3, 9: 2, 2: 1, 12: 1 } as const;
/** Start air base levels by region; every other region 0. */
export const AIR_BASE = { 3: 2, 10: 2, 5: 1 } as const;
/** Start convoys: (civilian + military) × 5 with a coast. */
export const START_CONVOYS = {
  FRA: 65,
  ITA: 35,
  GBR: 35,
  SUN: 80,
  POL: 30,
  TUR: 5,
  DEU: 0,
} as const;
/** Sea edges' km (the date line, the strait, the canal). */
export const SEA_KM = {
  westMiddle: 300,
  westEastDateline: 240,
  middleNarrows: 160,
  narrowsEastCanal: 60,
} as const;
/** Shortest sea routes. */
export const PATH_KM = {
  westToEast: 240,
  middleToEast: 220,
  middleToEastCanalClosed: 540,
  middleToNarrowsStraitClosed: 600,
} as const;
/** kmBetween from a region's center to a strategic region's center. */
export const AIR_KM = {
  londonToCentral: 200,
  berlinToCentral: 381,
  berlinToEastern: 532,
  romeToApproaches: 242,
  moscowToApproaches: 394,
} as const;
