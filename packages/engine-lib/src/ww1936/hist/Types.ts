// World War 1936: the historical equipment catalogue (owner-approved
// 2026-11-04, docs in /home/eser/dev/ww61-hist-equip-design.md).
//
// An entry is DATA ONLY: real specifications plus the techs that open it
// and a source. The game's numbers are computed from the specification by
// the conversion functions in this folder (ConvertTank, ConvertPlane,
// ConvertShip, ConvertGear), one per family, so every number is traceable
// and a data lane never writes a game stat by hand.
//
// How a data lane writes an entry: add an object to the country's list in
// `<tag>.ts` (see deu.ts), typed as one of the entry types below, with the
// real figures in the stated units and a `source` comment line. Ids are
// `<tag lower>_<name>` in snake case (`deu_pz3_e`), unique across the whole
// catalogue; the text key is `ww1936.hist.<id>`.
//
// Specifications may hold decimals; the conversions turn them into integers
// with exact operations only (no Math.sin, pow, exp, log, ...), so they are
// bit-identical on every client.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";

/** The seven majors that have a catalogue. */
export const HIST_COUNTRIES = [
  "DEU",
  "ITA",
  "JPN",
  "USA",
  "GBR",
  "FRA",
  "SUN",
] as const satisfies readonly CountryTag[];
export type HistCountry = (typeof HIST_COUNTRIES)[number];

/** Fields every entry has. */
export interface HistBase {
  /** `<tag lower>_<name>`, unique in the catalogue; text key ww1936.hist.<id>. */
  id: string;
  country: HistCountry;
  /**
   * Techs that must all be researched to build it (chassis, gun, airframe,
   * ship generation). Never a date. May be empty for 1936 standard issue.
   */
  techs: readonly WwTechId[];
  /** Year it entered service (display and tie-break only, never a gate). */
  year: number;
  /** Where the figures come from (reference, edition). Note disagreements. */
  source: string;
  /**
   * Optional: this entry is the country's stand-in for a generic static
   * equipment key, written "<equipment type>:<generation>" (for example
   * "light_tank:1", "medium_tank:3", "infantry_equipment:2"). The static
   * key then takes this entry's stats and name for that country. Without
   * one, the engine picks the first entry of the right group whose first
   * tech is the key's tech.
   */
  staticFor?: string;
}

// ---------------------------------------------------------------- tanks
/**
 * Tank groups. light includes armoured cars, medium includes cruiser and
 * infantry tanks of that weight class, heavy the heavy tanks. td, spa and
 * spaa are the design-only groups (tank destroyer, SP artillery, SP AA).
 */
export const HIST_TANK_ROLES = [
  "light",
  "medium",
  "heavy",
  "td",
  "spa",
  "spaa",
] as const;
export type HistTankRole = (typeof HIST_TANK_ROLES)[number];

export interface TankSpec {
  /** Combat mass, tonnes. */
  massT: number;
  /** Best frontal hull armour, mm. */
  hullFrontMm: number;
  /** Slope of that plate from the vertical, degrees (0 = upright). */
  hullSlopeDeg: number;
  /** Frontal turret or mantlet armour, mm; omit for a turretless/casemate vehicle. */
  turretFrontMm?: number;
  /** Main gun calibre, mm (the biggest gun that fires at tanks or the howitzer). */
  gunMm: number;
  /**
   * Armour penetration at 500 m, 30 degrees from the vertical (the usual
   * Western standard), mm, with the best normal AP round of the period
   * (APCBC/APC; not tungsten APCR unless it was the normal issue).
   * 0 for guns with no AP round (howitzers, MG-only vehicles).
   */
  penMm500: number;
  /** Explosive filler of the standard HE shell, grams; 0 if none. */
  heFillerG: number;
  /** Machine guns carried (all, coaxial and hull, rifle calibre or heavier). */
  mgs: number;
  /** Cross-country speed, km/h. */
  offroadKmh: number;
  /** Road speed, km/h (display, and armoured-car mobility). */
  roadKmh: number;
  /** Diesel engine (lower fuel use). */
  diesel?: boolean;
  /** Open-topped fighting compartment. */
  openTop?: boolean;
  /** Full tracks or half tracks = false; wheeled armoured car = true. */
  wheeled?: boolean;
  /**
   * Mechanical reliability by the history, 1..5 (1 notoriously poor, 3
   * average, 5 excellent). Tiger and Panther 2, Sherman and T-34 4.
   */
  reliability: 1 | 2 | 3 | 4 | 5;
  /** Unit production cost, thousand 1940 US dollars at the official rate. */
  costK: number;
  /** Anti-aircraft fit (SP anti-air only): barrels, rounds per minute each, calibre mm. */
  aa?: { barrels: number; rpm: number; mm: number };
}
export interface TankEntry extends HistBase {
  family: "tank";
  role: HistTankRole;
  spec: TankSpec;
}

// ---------------------------------------------------------------- planes
/** The P4 aircraft types an entry flies as (AirType in engine-api). */
export const HIST_AIR_TYPES = [
  "fighter",
  "bomber",
  "heavy_fighter",
  "cas",
  "naval_bomber",
  "strat_bomber",
  "transport_plane",
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
] as const;
export type HistAirType = (typeof HIST_AIR_TYPES)[number];

export interface GunGroup {
  /** Calibre, mm. */
  mm: number;
  /** Guns of this calibre. */
  count: number;
  /** Rounds per minute per gun. */
  rpm: number;
}
export interface PlaneSpec {
  /** Maximum speed, km/h. */
  maxKmh: number;
  /** Range on internal fuel, km. */
  rangeKm: number;
  /** Empty mass, kg. */
  emptyKg: number;
  /** Wing loading at normal weight, kg per square metre. */
  wingLoad: number;
  /** Forward-firing guns (fixed). */
  guns: readonly GunGroup[];
  /** Defensive flexible guns (turrets, gunners): count of 7.7 mm or bigger. */
  defGuns: number;
  /** Maximum bomb load, kg (0 for a fighter that carries none). */
  bombKg: number;
  /** Carries rockets or a torpedo as its anti-ship weapon (torpedo mass kg; 0 none). */
  torpedoKg: number;
  /** Radar-equipped night/naval patrol set. */
  radar?: boolean;
  /** Dive-bomber (steep-attack accuracy). */
  dive?: boolean;
  /** Turbojet or rocket engine (fuel use up). */
  jet?: boolean;
  /** Reliability 1..5, as for tanks. */
  reliability: 1 | 2 | 3 | 4 | 5;
  /** Unit cost, thousand 1940 US dollars at the official rate. */
  costK: number;
}
export interface PlaneEntry extends HistBase {
  family: "plane";
  type: HistAirType;
  spec: PlaneSpec;
}

// ---------------------------------------------------------------- ships
export const HIST_SHIP_CLASSES = [
  "dd",
  "cl",
  "ca",
  "bc",
  "bb",
  "cv",
  "ss",
] as const;
export type HistShipClass = (typeof HIST_SHIP_CLASSES)[number];

export interface ShipSpec {
  /** Standard displacement, tonnes (Washington standard where known). */
  dispT: number;
  /** Main battery. */
  main: { count: number; mm: number };
  /** Secondary or dual-purpose battery; omit if none. */
  secondary?: { count: number; mm: number };
  /** Belt armour, mm (0 for unarmoured). */
  beltMm: number;
  /** Maximum speed, knots. */
  speedKn: number;
  /** Range, nautical miles, at economical speed. */
  rangeNm: number;
  /** Torpedo tubes (533 mm class or larger) or a submarine's tubes. */
  torpTubes: number;
  /** Mass of one torpedo's warhead, kg (0 if no torpedoes). */
  torpWarheadKg: number;
  /** 0 none, 1 depth-charge rails, 2 throwers and sonar, 3 hedgehog class. */
  asw: 0 | 1 | 2 | 3;
  /** Light AA barrels by calibre (20 mm to 40 mm), counted as barrels. */
  aaLight: readonly { count: number; mm: number }[];
  /** Dual-purpose heavy AA guns, count (76 mm to 133 mm). */
  aaHeavy: number;
  /** Carrier aircraft capacity (0 for non-carriers). */
  aircraft: number;
  /** Unit cost, million 1940 US dollars at the official rate. */
  costM: number;
}
export interface ShipEntry extends HistBase {
  family: "ship";
  cls: HistShipClass;
  spec: ShipSpec;
}

// ---------------------------------------------------------------- gear
/** Infantry equipment: the standard shoulder arm of the period. */
export interface InfantrySpec {
  /** Calibre, mm. */
  mm: number;
  /** Aimed rounds per minute a trained soldier fires. */
  aimedRpm: number;
  /** Effective range, m. */
  rangeM: number;
  /** Percent of riflemen carrying a self-loading or automatic weapon (0..100). */
  autoPct: number;
  /** Cost per weapon, 1940 US dollars. */
  costUsd: number;
}
export interface InfantryEntry extends HistBase {
  family: "infantry";
  spec: InfantrySpec;
}

/** Support equipment: signals, engineering and medical sets, trucks. */
export interface SupportSpec {
  /** What it mainly is. */
  kind: "signal" | "engineer" | "medical" | "recon" | "transport";
  /** Radio set range or vehicle range, km. */
  rangeKm: number;
  /** Cost per set, 1940 US dollars. */
  costUsd: number;
}
export interface SupportEntry extends HistBase {
  family: "support";
  spec: SupportSpec;
}

export const HIST_GUN_ROLES = ["artillery", "anti_tank", "anti_air"] as const;
export type HistGunRole = (typeof HIST_GUN_ROLES)[number];
export interface GunSpec {
  /** Calibre, mm. */
  mm: number;
  /** Sustained rounds per minute. */
  rpm: number;
  /** Maximum range, m (anti-air: effective ceiling, m). */
  rangeM: number;
  /** Shell mass, kg (the main HE or AP round). */
  shellKg: number;
  /** Armour penetration at 500 m, 30 degrees, mm (anti-tank; 0 otherwise). */
  penMm500: number;
  /** Weight in action, kg. */
  massKg: number;
  /** Barrels on one mount (anti-air multiples; 1 otherwise). */
  barrels: number;
  /** Unit cost, thousand 1940 US dollars. */
  costK: number;
}
export interface GunEntry extends HistBase {
  family: "gun";
  role: HistGunRole;
  spec: GunSpec;
}

export type HistEntry =
  | TankEntry
  | PlaneEntry
  | ShipEntry
  | InfantryEntry
  | SupportEntry
  | GunEntry;
