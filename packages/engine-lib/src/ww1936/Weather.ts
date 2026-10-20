// World War 1936 P2: weather v1 (P2 spec §10). Stateless: a region's
// weather is a function of the day and its place, so the engine and every
// screen roll the same.
import { LandTerrain, Weather } from "@openfront/engine-api/ww1936/LandTypes";
import { dateOfDay } from "./Calendar";

export interface WeatherDef {
  movePct: number;
  attackBp: number;
  /** Daily attrition, ‰ of men and equipment. */
  attritionPm: number;
  supplyPct: number;
}

export const WEATHER: Readonly<Record<Weather, WeatherDef>> = {
  clear: { movePct: 100, attackBp: 0, attritionPm: 0, supplyPct: 100 },
  rain: { movePct: 80, attackBp: -1000, attritionPm: 0, supplyPct: 90 },
  mud: { movePct: 50, attackBp: -2000, attritionPm: 0, supplyPct: 75 },
  snow: { movePct: 70, attackBp: -1000, attritionPm: 2, supplyPct: 80 },
  frozen: { movePct: 60, attackBp: -3000, attritionPm: 5, supplyPct: 70 },
  heat: { movePct: 90, attackBp: -1000, attritionPm: 3, supplyPct: 100 },
};

export type Climate =
  | "polar"
  | "continental"
  | "temperate"
  | "desert"
  | "tropical";

/** A 32-bit mix of two integers (no state, no PRNG). */
export function hash32(a: number, b: number): number {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** P2 spec §3.1: the 10°×10° cell of a point (hundredths of a degree). */
export function weatherCell(lonC: number, latC: number): number {
  const lon = Math.max(0, Math.min(359, Math.floor((lonC + 18000) / 100)));
  const lat = Math.max(0, Math.min(149, Math.floor((latC + 6000) / 100)));
  return Math.floor(lon / 10) + 36 * Math.floor(lat / 10);
}

/**
 * Task 11 balance (controller ruling 1): Atlantic and western-central
 * Europe, the weather cells from 30°W to 20°E, stay temperate up to this
 * latitude (Paris, London, Berlin: a mild winter); east of 20°E the
 * continental band starts at 40°N, elsewhere at 45°N (spec §10).
 */
export const TEMPERATE_WEST_LAT_C = 5500;
export const TEMPERATE_WEST_LON_MIN = -30;
export const TEMPERATE_WEST_LON_MAX = 20;

/** P2 spec §10: the climate band from latitude, terrain and the cell's longitude. */
export function climateOf(
  latC: number,
  land: LandTerrain,
  wcell: number,
): Climate {
  const lat = Math.abs(latC);
  if (lat >= 6000) return "polar";
  if (land === "desert") return "desert";
  if (lat < 2350) return "tropical";
  const lon = (wcell % 36) * 10 - 180;
  const west =
    latC > 0 && lon >= TEMPERATE_WEST_LON_MIN && lon < TEMPERATE_WEST_LON_MAX;
  if (west) return lat >= TEMPERATE_WEST_LAT_C ? "continental" : "temperate";
  if (lat >= 4500 || (lat >= 4000 && lon >= 20)) return "continental";
  return "temperate";
}

/** P2 spec §10: one region's weather on `day` (same week and cell: same roll). */
export function weatherAt(
  day: number,
  latC: number,
  land: LandTerrain,
  wcell: number,
): Weather {
  const d = dateOfDay(day);
  // Southern hemisphere: six months later.
  const m = latC < 0 ? ((d.month + 5) % 12) + 1 : d.month;
  const dom = d.day;
  const h = hash32(wcell, Math.floor(day / 7)) % 100;
  switch (climateOf(latC, land, wcell)) {
    case "polar":
      if (m === 12 || m <= 2) return h < 60 ? "frozen" : "snow";
      if (m === 3) return "snow";
      if (m === 4) return "mud";
      if (m <= 9) return h < 20 ? "rain" : "clear";
      return m === 10 ? "mud" : "snow";
    case "continental":
      if (m === 12 || m <= 2) return h < 40 ? "frozen" : "snow";
      if (m === 3) return dom >= 21 ? "mud" : "snow";
      if (m === 4) return "mud";
      if (m <= 9) return h < 15 ? "rain" : "clear";
      if (m === 10) return dom >= 15 ? "mud" : h < 30 ? "rain" : "clear";
      return dom <= 15 ? "mud" : "snow";
    case "temperate":
      if (m === 12 || m <= 2)
        return h < 35 ? "snow" : h < 60 ? "rain" : "clear";
      if (m <= 4) return h < 40 ? "rain" : "clear";
      if (m <= 9) return h < 15 ? "rain" : "clear";
      return h < 40 ? "rain" : "clear";
    case "desert":
      return m >= 6 && m <= 8 && h < 70 ? "heat" : "clear";
    case "tropical":
      if (m === 12 || m <= 2) return h < 15 ? "rain" : "clear";
      if (m <= 5) return "clear";
      if (m <= 9) return h < 60 ? "rain" : "clear";
      return h < 30 ? "rain" : "clear";
  }
}
