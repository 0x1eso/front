// World War 1936 historical catalogue: real ship specifications to game
// stats (ShipStats), one pure integer function. The result is absolute (no
// generation percents): the catalogue entry IS the generation.
//
// Calibration: a destroyer of 1,500 t with 5 x 127 mm and 8 tubes of 300 kg
// warheads is today's generation-1 destroyer (hp 15, light 5, torpedo 16);
// 9 x 16 in on 36,000 t with a 300 mm belt is the generation-1 battleship
// (hp 150, heavy 50, armour 50).
import type { ShipStats } from "@openfront/engine-api/ww1936/NavyTypes";
import { SHIP_BASE } from "../ShipStats";
import { scaledCost } from "./ConvertCost";
import { interp, isqrt, roundInt, Table } from "./Num";
import { HistShipClass, ShipEntry } from "./Types";

/** Standard displacement (t) to hit points. */
export const SHIP_HP: Table = [
  [700, 10],
  [1500, 15],
  [2500, 22],
  [6000, 35],
  [10000, 60],
  [14000, 72],
  [20000, 88],
  [26000, 110],
  [36000, 150],
  [46000, 185],
  [65000, 240],
];
/** Shell mass by calibre (mm), kg, for the usual naval gun of that size. */
export const SHELL_KG: Table = [
  [76, 6],
  [102, 13],
  [127, 25],
  [152, 50],
  [203, 118],
  [254, 225],
  [280, 300],
  [305, 400],
  [330, 570],
  [356, 680],
  [381, 880],
  [406, 1016],
  [460, 1460],
];
/** Rounds per minute a mount sustains, by calibre (mm). */
export const SHIP_RPM: Table = [
  [76, 15],
  [102, 14],
  [127, 7],
  [152, 7],
  [203, 4],
  [305, 2],
  [460, 2],
];
/** Light-gun penetration by calibre, centi. */
const LIGHT_PIERCE: Table = [
  [76, 500],
  [127, 800],
  [152, 1500],
  [203, 1800],
];
/** Heavy-gun penetration by calibre, centi. */
const HEAVY_PIERCE: Table = [
  [203, 4000],
  [280, 5600],
  [305, 7000],
  [356, 7600],
  [406, 8500],
  [460, 9500],
];
/** Belt armour (mm) to armour points, centi. */
const BELT_CENTI: Table = [
  [0, 0],
  [25, 200],
  [80, 700],
  [127, 1100],
  [200, 2000],
  [250, 3000],
  [330, 4800],
  [410, 6000],
];
/** Light AA barrel weights, tenths of a point per barrel, by calibre. */
const AA_TENTHS: Table = [
  [12, 8],
  [20, 10],
  [25, 15],
  [37, 20],
  [40, 24],
  [57, 40],
];
/**
 * Hull cost by class: the median real price of the catalogue's class
 * (million 1940 dollars) costs the anchor, about today's generation-1 naval
 * points (destroyer 1,200, battleship 12,500). A Yamato is about 1.4 times a
 * typical battleship, not 2.5 (see ConvertCost).
 */
export const SHIP_COST: Readonly<
  Record<HistShipClass, { refM: number; anchor: number }>
> = {
  dd: { refM: 5.8, anchor: 1150 },
  cl: { refM: 19, anchor: 3300 },
  ca: { refM: 28, anchor: 4800 },
  bc: { refM: 66, anchor: 8800 },
  bb: { refM: 75, anchor: 12000 },
  cv: { refM: 45, anchor: 9000 },
  ss: { refM: 3.8, anchor: 850 },
};
/**
 * A dual-purpose mount (a 100-140 mm battery that the ship also counts as heavy AA:
 * Fletcher's 5 in/38, Atlanta's) is power-loaded and elevates
 * fully: double the rate of a surface-only gun of the same calibre (Fubuki's
 * 5 in/50 managed 5 or 6 rounds a minute).
 */
const DP_RATE_PCT = 200;
/** Range: up to the generic class figure as real, above it two fifths of the excess, at most twice the generic figure. */
export function gameRangeKm(realKm: number, genericKm: number): number {
  if (realKm <= genericKm) return realKm;
  return Math.min(
    genericKm * 2,
    genericKm + Math.floor(((realKm - genericKm) * 2) / 5),
  );
}
/** Torpedo divisor: tubes x warhead kg over this = points; submarines use SUB. */
const TORP_DIV = 160;
const TORP_DIV_SS = 70;
const DEPTH_CENTI: readonly number[] = [0, 600, 1000, 1400];
/** Heavy guns are 203 mm and over. */
export const HEAVY_MM = 203;

/** Game stats of a ship entry. Pure, integer, deterministic. */
export function shipStatsOfEntry(e: ShipEntry): ShipStats {
  const s = e.spec;
  const b = SHIP_BASE[e.cls];
  const kgMin = (g: { count: number; mm: number; rpm?: number }) => {
    let rpm = g.rpm ?? interp(SHIP_RPM, g.mm);
    if (
      g.rpm === undefined &&
      g.mm >= 100 &&
      g.mm <= 140 &&
      g.count <= s.aaHeavy
    ) {
      rpm = (rpm * DP_RATE_PCT) / 100;
    }
    return g.count * interp(SHELL_KG, g.mm) * rpm;
  };
  let lightKgMin = 0;
  let heavySalvoKg = 0;
  let heavyMm = 0;
  let lightMm = 0;
  for (const g of [s.main, ...(s.secondary ? [s.secondary] : [])]) {
    if (g.count <= 0) continue;
    if (g.mm >= HEAVY_MM) {
      heavySalvoKg += g.count * interp(SHELL_KG, g.mm);
      heavyMm = Math.max(heavyMm, g.mm);
    } else {
      lightKgMin += kgMin(g);
      lightMm = Math.max(lightMm, g.mm);
    }
  }
  let aaPts10 = s.aaHeavy * 40;
  for (const a of s.aaLight) aaPts10 += a.count * interp(AA_TENTHS, a.mm);
  const warheadTotal = s.torpTubes * s.torpWarheadKg;
  return {
    hpMilli: interp(SHIP_HP, s.dispT) * 1000,
    orgMilli: b.org * 1000,
    light: isqrt(lightKgMin * 200),
    lightPierce: lightMm === 0 ? 0 : interp(LIGHT_PIERCE, lightMm),
    heavy: 55 * isqrt(heavySalvoKg),
    heavyPierce: heavyMm === 0 ? 0 : interp(HEAVY_PIERCE, heavyMm),
    torpedo: Math.floor(
      (warheadTotal * 100) / (e.cls === "ss" ? TORP_DIV_SS : TORP_DIV),
    ),
    depth: DEPTH_CENTI[s.asw],
    armor: interp(BELT_CENTI, s.beltMm),
    aa: Math.floor((aaPts10 * 2) / 5),
    speedCentiKn: roundInt(s.speedKn * 100),
    rangeKm: gameRangeKm(Math.floor((s.rangeNm * 1852) / 1000), b.rangeKm),
    vis: b.vis,
    surfDetect: b.surfDetect,
    subDetect: b.subDetect,
    deck: e.cls === "cv" ? s.aircraft : 0,
    fuelPerDayMilli: b.fuelPerDay * 1000,
    cost: Math.max(
      300,
      scaledCost(SHIP_COST[e.cls].anchor, s.costM, SHIP_COST[e.cls].refM),
    ),
    supWeight: b.supWeight,
  };
}
