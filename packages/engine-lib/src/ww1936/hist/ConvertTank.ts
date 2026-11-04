// World War 1936 historical catalogue: real tank specifications to game
// stats, one pure integer function (owner-approved design, rule 3).
//
// Scale: armour and pierce are millimetres of effective armour / penetration
// (centi in the stats, like the designer's), so the threshold rule reads
// the real figures: the 88 mm of a Tiger (pierce 102) defeats a T-34's
// effective 70, the 76 mm of a T-34 (pierce 68) does not defeat a Tiger's 100.
// 1936-39 baseline: a Pz III E (armour about 31, pierce 30, soft 10-11,
// 12 IC) sits where today's generation-1 medium tank sits.
import {
  DS_HIST,
  DS_TD_DEFEND,
  TankDesignStats,
  TankRole,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_TYPES,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NG_HEAVY,
  NG_SPA,
  NG_SPAA,
  NG_TD,
} from "@openfront/engine-api/ww1936/LandTypes";
import { scaledCost, softCap } from "./ConvertCost";
import { clampInt, interp, isqrt, resVec, roundInt, Table } from "./Num";
import { HistTankRole, TankEntry, TankSpec } from "./Types";

/**
 * Slope multiplier, percent, by plate angle from the vertical. Geometry says
 * 1/cos; real plates gain less (shatter, ricochet are not certain), so it
 * is softened above 45 degrees: 60 degrees counts 1.75x, not 2x.
 */
export const SLOPE_PCT: Table = [
  [0, 100],
  [10, 102],
  [20, 107],
  [30, 115],
  [40, 128],
  [45, 138],
  [50, 150],
  [55, 162],
  [60, 175],
  [65, 185],
  [70, 195],
];

/**
 * Share of the slope bonus a plate keeps, percent, by its thickness (mm).
 * A thin plate gains little from slope: a shell as thick as the plate
 * overmatches it, bites and does not ricochet (45 mm of T-34 and 60 mm of
 * Hetzer are not worth 1.75x). Full from 80 mm up.
 */
export const THIN_PLATE_PCT: Table = [
  [0, 30],
  [30, 40],
  [50, 65],
  [80, 100],
];

/** Slope-adjusted hull plate, mm. */
function slopedHullMm(s: TankSpec): number {
  const gain = interp(SLOPE_PCT, s.hullSlopeDeg) - 100;
  const kept = (gain * interp(THIN_PLATE_PCT, s.hullFrontMm)) / 100;
  return roundInt((s.hullFrontMm * (100 + kept)) / 100);
}

/**
 * Effective frontal armour, mm. A turreted tank blends the hull plate 2:1
 * with the turret front. A casemate vehicle (tank destroyer, assault gun,
 * SP gun with no turret) is half its sloped upper plate, half the upright
 * thickness: its nose, mantlet and gun shield are not the sloped plate.
 */
export function effectiveArmorMm(s: TankSpec, casemate = false): number {
  const hull = slopedHullMm(s);
  if (s.turretFrontMm !== undefined) {
    return roundInt((2 * hull + s.turretFrontMm) / 3);
  }
  return casemate ? roundInt((hull + s.hullFrontMm) / 2) : hull;
}

/** Reliability 1..5 to per mille, in the 70-93 % range the designer used (80-86). */
export const RELIABILITY_PM: readonly number[] = [0, 700, 760, 830, 880, 930];

/** Centi-speed per km/h of cross-country speed (20 km/h = 6.0, today's medium tank). */
export const SPEED_CENTI_PER_KMH = 30;
/**
 * Cost by role: the median real price of the catalogue's role (thousand
 * 1940 dollars) costs the anchor, today's generic generation-1 figure (a
 * $38.5k Pz III E is about 12 IC). See ConvertCost.
 */
export const TANK_COST: Readonly<
  Record<HistTankRole, { refK: number; anchorMilli: number }>
> = {
  light: { refK: 20, anchorMilli: 8_000 },
  medium: { refK: 42, anchorMilli: 11_500 },
  heavy: { refK: 72, anchorMilli: 22_000 },
  td: { refK: 36, anchorMilli: 13_000 },
  spa: { refK: 38, anchorMilli: 14_000 },
  spaa: { refK: 44, anchorMilli: 12_000 },
};

const COEF_HE: Readonly<Record<HistTankRole, number>> = {
  light: 54,
  medium: 54,
  heavy: 54,
  td: 54,
  spa: 60,
  spaa: 54,
};

const GROUP: Readonly<Record<HistTankRole, number>> = {
  light: EQUIPMENT_TYPES.indexOf("light_tank"),
  medium: EQUIPMENT_TYPES.indexOf("medium_tank"),
  heavy: NG_HEAVY,
  td: NG_TD,
  spa: NG_SPA,
  spaa: NG_SPAA,
};
/** The NEED_GROUPS index a catalogue role fills. */
export function tankGroupOf(role: HistTankRole): number {
  return GROUP[role];
}
const ENGINE_ROLE: Readonly<Record<HistTankRole, TankRole>> = {
  light: "tank",
  medium: "tank",
  heavy: "tank",
  td: "tank_destroyer",
  spa: "sp_artillery",
  spaa: "sp_anti_air",
};

export interface HistTankStats extends TankDesignStats {
  /** Effective frontal armour, mm (armor / 100). */
  armorMm: number;
}

/** Game stats of a tank entry. Pure, integer, deterministic. */
export function tankStatsOfEntry(e: TankEntry): HistTankStats {
  const s = e.spec;
  const armorMm = effectiveArmorMm(
    s,
    e.role === "td" || e.role === "spa" || e.role === "spaa",
  );
  const he = COEF_HE[e.role] * isqrt(s.heFillerG);
  // Soft caps are soft: past the knee a bigger shell still counts, at a third,
  // so a 150 mm howitzer stays above a 122 mm one (and a Tiger II's gun above a Tiger's).
  const softRaw = 400 + he + 130 * Math.min(s.mgs, 3);
  const soft =
    e.role === "spa"
      ? clampInt(softCap(softRaw, 2200, 4400), 300, 4400)
      : clampInt(softCap(softRaw, 2400, 3600), 300, 3600);
  const hardRaw = (e.role === "spa" ? 0 : 100) + 22 * s.penMm500;
  const hard = softCap(hardRaw, 2800, 4200);
  const pierce = 100 * s.penMm500;
  const def = isqrt(armorMm * 10000);
  let brk = Math.min(5000, 1500 + Math.floor(((soft + hard) * 60) / 100));
  if (e.role === "td") brk = Math.floor((brk * 70) / 100);
  if (e.role === "spa") brk = Math.floor((brk * 40) / 100);
  if (e.role === "spaa") brk = Math.floor((brk * 50) / 100);
  const hardnessPm = clampInt(
    800 + Math.floor((armorMm * 3) / 2) - (s.openTop ? 100 : 0),
    700,
    970,
  );
  const fuelPct = clampInt(
    Math.floor(((s.massT * 100) / 22 - 100) / 3) + (s.diesel ? -25 : 0),
    -45,
    60,
  );
  const aa = s.aa
    ? Math.floor((s.aa.barrels * s.aa.rpm * s.aa.mm * 100) / 2000)
    : 0;
  const resources = resVec(RESOURCE_IDS, {
    steel: s.massT >= 60 ? 4 : s.massT >= 35 ? 3 : s.massT >= 12 ? 2 : 1,
    oil: s.massT >= 55 ? 2 : 1,
    chromium: armorMm >= 150 ? 2 : armorMm >= 60 ? 1 : 0,
    tungsten: s.penMm500 >= 100 ? 2 : s.penMm500 >= 60 ? 1 : 0,
    rubber: s.wheeled ? 1 : 0,
  });
  return {
    kind: "tank",
    role: ENGINE_ROLE[e.role],
    group: tankGroupOf(e.role),
    soft,
    hard,
    def,
    brk,
    pierce,
    armor: 100 * armorMm,
    aa,
    hardnessPm,
    speedCenti: roundInt(s.offroadKmh * SPEED_CENTI_PER_KMH),
    relPm: RELIABILITY_PM[s.reliability],
    orgAdd: 0,
    fuelPct,
    costMilli: scaledCost(
      TANK_COST[e.role].anchorMilli,
      s.costK,
      TANK_COST[e.role].refK,
    ),
    resources,
    flags: DS_HIST | (e.role === "td" ? DS_TD_DEFEND : 0),
    year: e.year,
    armorMm,
  };
}
