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
  DS_HIST,
  DS_JET,
  DS_RADAR,
  PlaneDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  atMostGeneric,
  atMostGenericRes,
  scaledCost,
  softCap,
} from "./ConvertCost";
import { RELIABILITY_PM } from "./ConvertTank";
import { clampInt, interp, isqrt, resVec, Table } from "./Num";
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
/**
 * Explosive effect of one round, percent of its mass: rifle-calibre bullets
 * 100, a 13 mm round hardly more, a 20 mm shell with a bursting charge about
 * twice, 30 mm and bigger mine shells 2.6 and up.
 */
export const EXPLOSIVE_PCT: Table = [
  [8, 100],
  [12, 100],
  [13, 110],
  [15, 130],
  [20, 200],
  [23, 220],
  [30, 260],
  [37, 300],
  [40, 320],
  [57, 400],
];
/**
 * Muzzle velocity and hitting power of an automatic gun, percent, read from
 * its rate of fire (the fast-firing aircraft cannon were also the fast
 * ones: MG FF 520 rpm and 585 m/s, MG 151 700 rpm and 700 m/s, Hispano II
 * 600 rpm and 840 m/s, Ho-5 and B-20 800+ rpm). Rifle-calibre guns are
 * left alone: their rate is already their weight of fire.
 */
export const GUN_QUALITY_PCT: Table = [
  [400, 60],
  [520, 70],
  [600, 100],
  [700, 130],
  [850, 145],
];
/** Weight of fire of a battery, grams per second, counting explosive effect and gun quality. */
export function fluxGramsPerSec(guns: readonly GunGroup[]): number {
  let f = 0;
  for (const g of guns) {
    let w = (g.count * g.rpm * interp(ROUND_GRAMS, g.mm)) / 60;
    if (g.mm >= 15) {
      w =
        (w * interp(EXPLOSIVE_PCT, g.mm) * interp(GUN_QUALITY_PCT, g.rpm)) /
        10000;
    } else {
      w = (w * interp(EXPLOSIVE_PCT, g.mm)) / 100;
    }
    f += w;
  }
  return Math.floor(f);
}

/**
 * Share of the fixed-gun fire a role can use, percent. A fighter is its
 * guns; a ground attacker aims them at the ground; a bomber's few fixed
 * guns are an afterthought (the B-25J's eight .50 are a strafer's, the
 * Tu-2's two cannon are not a fighter's).
 */
const GUN_USE_PCT: Readonly<Record<HistAirType, number>> = {
  fighter: 100,
  cv_fighter: 100,
  heavy_fighter: 100,
  cas: 50,
  cv_cas: 50,
  bomber: 15,
  naval_bomber: 15,
  cv_naval_bomber: 20,
  strat_bomber: 10,
  transport_plane: 10,
};

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
 * Cost by air type: the median real price of the catalogue's type (thousand
 * 1940 dollars) costs the anchor, about today's generic generation-1 figure
 * for the type (fighter 22, bomber 30, strategic bomber 48). Real price
 * ratios stay, compressed at the extremes (see ConvertCost): a B-29 is about
 * twice a B-17, not 3.3 times.
 */
export const PLANE_COST: Readonly<
  Record<HistAirType, { refK: number; anchorMilli: number }>
> = {
  fighter: { refK: 32, anchorMilli: 22_500 },
  cv_fighter: { refK: 34, anchorMilli: 25_000 },
  heavy_fighter: { refK: 60, anchorMilli: 30_000 },
  cas: { refK: 32, anchorMilli: 22_500 },
  cv_cas: { refK: 38, anchorMilli: 26_000 },
  bomber: { refK: 80, anchorMilli: 30_000 },
  naval_bomber: { refK: 88, anchorMilli: 28_000 },
  cv_naval_bomber: { refK: 48, anchorMilli: 30_000 },
  strat_bomber: { refK: 190, anchorMilli: 48_000 },
  transport_plane: { refK: 85, anchorMilli: 30_000 },
};
export function planeCostMilli(type: HistAirType, costK: number): number {
  const c = PLANE_COST[type];
  return scaledCost(c.anchorMilli, costK, c.refK);
}

/** Game stats of a plane entry. Pure, integer, deterministic. */
export function planeStatsOfEntry(e: PlaneEntry): PlaneDesignStats {
  const s = e.spec;
  const flux = fluxGramsPerSec(s.guns);
  const fighterLike = FIGHTER_LIKE.has(e.type);
  // Soft cap: a Me 262 with four 30 mm still beats a Fw 190 with four 20 mm.
  const airAttack = Math.min(
    4000,
    softCap(
      isqrt((1000 * flux * GUN_USE_PCT[e.type]) / 100) +
        40 * Math.min(s.defGuns, 12),
      2400,
      4000,
    ),
  );
  const airDefense = interp(AIR_DEF_CENTI, s.emptyKg) + 30 * s.defGuns;
  const agility = clampInt(
    Math.floor((7500 * AGILITY_PCT[e.type]) / (s.wingLoad * 100)),
    1,
    AGILITY_MAX[e.type],
  );
  const dive = s.dive === true ? 150 : 100;
  const groundRaw = Math.floor(
    (((s.bombKg * 30) / 100 + (flux * GUN_USE_PCT[e.type]) / 2000) *
      (GROUND_MULT_PCT[e.type] ?? 100) *
      dive) /
      10000,
  );
  const ground = Math.max(0, softCap(groundRaw, 1600, 3600));
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
    // w73: never dearer, nor hungrier per factory, than the generic plane
    // of its type and generation.
    costMilli: atMostGeneric(
      planeCostMilli(e.type, s.costK),
      e.type,
      e.techs,
      e.type.replace(/^cv_/, ""),
    ),
    resources: atMostGenericRes(
      resVec(RESOURCE_IDS, {
        aluminium: alu + (jet ? 1 : 0),
        rubber: s.emptyKg < 20000 ? 1 : 2,
      }),
      e.type,
    ),
    fuelPct: jet ? 60 : 0,
    flags:
      DS_HIST |
      (jet ? DS_JET : 0) |
      (s.radar === true ? DS_RADAR : 0) |
      (e.type.startsWith("cv_") ? DS_CARRIER : 0) |
      (e.type === "transport_plane" ? DS_CARGO : 0),
    year: e.year,
  };
}
