// World War 1936 historical catalogue: real aircraft specifications to game
// stats (PlaneDesignStats), one pure integer function.
//
// Calibration (1936-39 baseline, today's generation-1 numbers): a fighter of
// 560 km/h with 2 rifle-calibre MGs and 2 x 20 mm cannons (Bf 109 E class,
// about 2,000 g/s of fire) has air attack 18; a medium bomber carrying 2 t has
// ground 6 and strategic 4; a 6 t heavy bomber strategic 12; a 750 kg torpedo
// naval 12.
import {
  DS_CARGO,
  DS_CARRIER,
  DS_JET,
  DS_RADAR,
  PlaneDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { RELIABILITY_PM } from "./ConvertTank";
import { clampInt, interp, isqrt, resVec, roundInt, Table } from "./Num";
import { GunGroup, HistAirType, PlaneEntry } from "./Types";

/** Mass of one round by calibre, grams (rifle bullet to 40 mm shell). */
export const ROUND_GRAMS: Table = [
  [7, 10],
  [8, 12],
  [12, 42],
  [13, 50],
  [15, 70],
  [20, 115],
  [23, 200],
  [30, 330],
  [37, 700],
  [40, 900],
  [57, 2800],
];
/** Weight of fire of a battery, grams per second. */
export function fluxGramsPerSec(guns: readonly GunGroup[]): number {
  let f = 0;
  for (const g of guns) {
    f += (g.count * g.rpm * interp(ROUND_GRAMS, g.mm)) / 60;
  }
  return Math.floor(f);
}

/** Empty mass to air defence (centi): a big airframe soaks more. */
export const AIR_DEF_CENTI: Table = [
  [1500, 900],
  [2500, 1250],
  [6000, 1650],
  [16000, 2400],
  [35000, 3200],
];
/** Agility share of the 7500 / wing-loading figure, percent, by type. */
const AGILITY_PCT: Readonly<Record<HistAirType, number>> = {
  fighter: 100,
  cv_fighter: 100,
  heavy_fighter: 70,
  cas: 70,
  cv_cas: 70,
  bomber: 45,
  naval_bomber: 45,
  cv_naval_bomber: 45,
  strat_bomber: 30,
  transport_plane: 30,
};
const FIGHTER_LIKE: ReadonlySet<HistAirType> = new Set([
  "fighter",
  "cv_fighter",
  "heavy_fighter",
]);
/** Ground attack share of the bomb and gun figure: close support is built for it, heavy bombers hardly. */
const GROUND_MULT_PCT: Readonly<Partial<Record<HistAirType, number>>> = {
  cas: 400,
  cv_cas: 400,
  strat_bomber: 15,
  naval_bomber: 30,
  cv_naval_bomber: 30,
  transport_plane: 0,
};
/** Agility ceiling by type (a biplane's low wing loading does not make a torpedo bomber a fighter). */
const AGILITY_MAX: Readonly<Record<HistAirType, number>> = {
  fighter: 80,
  cv_fighter: 80,
  heavy_fighter: 45,
  cas: 45,
  cv_cas: 45,
  bomber: 30,
  naval_bomber: 30,
  cv_naval_bomber: 30,
  strat_bomber: 12,
  transport_plane: 12,
};
const STRAT_TYPES: ReadonlySet<HistAirType> = new Set([
  "bomber",
  "strat_bomber",
  "naval_bomber",
]);
/**
 * Milli industry points: 1.1 IC per thousand 1940 dollars, linear like tanks
 * and ships (a 20 thousand dollar fighter is 22 IC). Real price ratios.
 */
export const PLANE_COST_MILLI_PER_K = 1100;
export function planeCostMilli(costK: number): number {
  return roundInt(costK * PLANE_COST_MILLI_PER_K);
}

/** Game stats of a plane entry. Pure, integer, deterministic. */
export function planeStatsOfEntry(e: PlaneEntry): PlaneDesignStats {
  const s = e.spec;
  const flux = fluxGramsPerSec(s.guns);
  const fighterLike = FIGHTER_LIKE.has(e.type);
  const airAttack = clampInt(
    isqrt(1620 * flux) + 40 * Math.min(s.defGuns, 12),
    0,
    3200,
  );
  const airDefense = interp(AIR_DEF_CENTI, s.emptyKg) + 30 * s.defGuns;
  const agility = clampInt(
    Math.floor((7500 * AGILITY_PCT[e.type]) / (s.wingLoad * 100)),
    1,
    AGILITY_MAX[e.type],
  );
  const dive = s.dive === true ? 150 : 100;
  const ground = clampInt(
    Math.floor(
      (((s.bombKg * 30) / 100 + flux / 20) *
        (GROUND_MULT_PCT[e.type] ?? 100) *
        dive) /
        10000,
    ),
    0,
    2400,
  );
  const strategic = STRAT_TYPES.has(e.type)
    ? clampInt(Math.floor((s.bombKg * 20) / 100), 0, 1800)
    : 0;
  const naval = clampInt(
    Math.floor((s.torpedoKg * 16) / 10 + (s.bombKg * 15 * dive) / 10000),
    0,
    1600,
  );
  const alu = s.emptyKg < 4000 ? 2 : s.emptyKg < 12000 ? 3 : 4;
  const jet = s.jet === true;
  return {
    kind: "plane",
    type: e.type,
    airAttack,
    airDefense,
    agility,
    ground,
    strategic,
    naval,
    speed: Math.floor((s.maxKmh * 9) / 10),
    range: Math.floor((s.rangeKm * (fighterLike ? 100 : 50)) / 100),
    detect: s.radar === true ? 20 : 0,
    relPm: RELIABILITY_PM[s.reliability],
    costMilli: planeCostMilli(s.costK),
    resources: resVec(RESOURCE_IDS, {
      aluminium: alu + (jet ? 1 : 0),
      rubber: s.emptyKg < 20000 ? 1 : 2,
    }),
    fuelPct: jet ? 60 : 0,
    flags:
      (jet ? DS_JET : 0) |
      (s.radar === true ? DS_RADAR : 0) |
      (e.type.startsWith("cv_") ? DS_CARRIER : 0) |
      (e.type === "transport_plane" ? DS_CARGO : 0),
    year: e.year,
  };
}
