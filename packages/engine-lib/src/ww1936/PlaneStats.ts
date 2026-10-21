// World War 1936 P4: the aircraft types and their generations (P4 spec
// §12.2, §12.3). Generation 1 is the 1936 model; attack and defense are
// points here and centi in PlaneStats.
import type {
  AirType,
  PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

interface PlaneBase {
  airAtk: number;
  airDef: number;
  agility: number;
  speedKmh: number;
  rangeKm: number;
  ground: number;
  strat: number;
  naval: number;
  /** Fuel a sortie ×10 (0.2 → 2). */
  fuel: number;
  fighter: boolean;
}

/** Spec §12.2, generation 1. */
export const PLANE_BASE: Readonly<Record<AirType, PlaneBase>> = {
  fighter: {
    airAtk: 18,
    airDef: 12,
    agility: 50,
    speedKmh: 450,
    rangeKm: 650,
    ground: 1,
    strat: 0,
    naval: 0,
    fuel: 2,
    fighter: true,
  },
  bomber: {
    airAtk: 4,
    airDef: 16,
    agility: 20,
    speedKmh: 380,
    rangeKm: 900,
    ground: 6,
    strat: 4,
    naval: 3,
    fuel: 3,
    fighter: false,
  },
  heavy_fighter: {
    airAtk: 16,
    airDef: 18,
    agility: 30,
    speedKmh: 430,
    rangeKm: 1000,
    ground: 2,
    strat: 0,
    naval: 1,
    fuel: 3,
    fighter: true,
  },
  cas: {
    airAtk: 3,
    airDef: 10,
    agility: 30,
    speedKmh: 350,
    rangeKm: 450,
    ground: 12,
    strat: 0,
    naval: 2,
    fuel: 2,
    fighter: false,
  },
  naval_bomber: {
    airAtk: 3,
    airDef: 12,
    agility: 25,
    speedKmh: 350,
    rangeKm: 800,
    ground: 1,
    strat: 0,
    naval: 12,
    fuel: 3,
    fighter: false,
  },
  strat_bomber: {
    airAtk: 4,
    airDef: 24,
    agility: 10,
    speedKmh: 350,
    rangeKm: 1500,
    ground: 1,
    strat: 12,
    naval: 1,
    fuel: 5,
    fighter: false,
  },
  transport_plane: {
    airAtk: 0,
    airDef: 8,
    agility: 10,
    speedKmh: 300,
    rangeKm: 1100,
    ground: 0,
    strat: 0,
    naval: 0,
    fuel: 3,
    fighter: false,
  },
  cv_fighter: {
    airAtk: 16,
    airDef: 11,
    agility: 48,
    speedKmh: 430,
    rangeKm: 550,
    ground: 1,
    strat: 0,
    naval: 0,
    fuel: 2,
    fighter: true,
  },
  cv_cas: {
    airAtk: 3,
    airDef: 9,
    agility: 28,
    speedKmh: 330,
    rangeKm: 400,
    ground: 10,
    strat: 0,
    naval: 6,
    fuel: 2,
    fighter: false,
  },
  cv_naval_bomber: {
    airAtk: 3,
    airDef: 10,
    agility: 24,
    speedKmh: 330,
    rangeKm: 700,
    ground: 1,
    strat: 0,
    naval: 11,
    fuel: 3,
    fighter: false,
  },
};
/** Spec §12.2 generations: +30% / +60% attack, defense, agility, ground, strategic, naval. */
const GEN_PCT = [100, 130, 160];
const GEN_SPEED = [0, 80, 160];
const GEN_RANGE_PCT = [100, 120, 140];

/**
 * Spec §12.2–§12.3: a plane's numbers at its generation; the doctrine
 * bonuses come as stat keys (P6 pre-flight: P6's grand doctrines feed the
 * same keys), `techs` stays for the generation techs P6's designs read.
 */
export function planeStats(
  type: AirType,
  gen: number,
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
): PlaneStats {
  const b = PLANE_BASE[type];
  const g = gen - 1;
  const fighterLike = type === "fighter" || type === "cv_fighter";
  // Doctrine bonuses come as stat keys (P6 pre-flight).
  void techs;
  const atkPct =
    GEN_PCT[g] +
    stats.airAttackPct +
    (fighterLike ? stats.fighterAttackPct : 0);
  const defPct =
    GEN_PCT[g] +
    stats.airDefensePct +
    (type === "heavy_fighter" || type === "strat_bomber"
      ? stats.heavyDefensePct
      : 0);
  const agiPct =
    GEN_PCT[g] +
    stats.airAgilityPct +
    (b.fighter ? stats.fighterAgilityPct : 0);
  const navPct =
    GEN_PCT[g] +
    stats.airNavalPct +
    (type === "naval_bomber" || type === "cv_naval_bomber"
      ? stats.navalBomberPct
      : 0);
  const airAtk = b.airAtk * atkPct;
  const airDef = b.airDef * defPct;
  return {
    airAtk,
    airDef,
    agility: Math.floor((b.agility * agiPct) / 100),
    speedKmh: b.speedKmh + GEN_SPEED[g],
    rangeKm: Math.floor((b.rangeKm * GEN_RANGE_PCT[g]) / 100),
    ground: b.ground * GEN_PCT[g],
    strat: b.strat * GEN_PCT[g],
    naval: b.naval * navPct,
    supWeightMilli: b.fighter ? Math.floor((airAtk + airDef) / 3) : 100,
    fuelPerSortieMilli: b.fuel * 100,
  };
}

/** The base type whose generation techs a carrier type shares (spec §12.3 carrier_aviation). */
const CARRIER_BASE: Readonly<Partial<Record<AirType, AirType>>> = {
  cv_fighter: "fighter",
  cv_cas: "cas",
  cv_naval_bomber: "naval_bomber",
};

/**
 * The techs that open (type, gen) (spec §12.3): `<type>_<gen>` (fighter
 * and bomber are P1's), a carrier type carrier_aviation and its base
 * type's tech of the same generation.
 */
export function planeGenTechs(type: AirType, gen: number): WwTechId[] {
  const base = CARRIER_BASE[type];
  if (base !== undefined) {
    return ["carrier_aviation", `${base}_${gen}` as WwTechId];
  }
  return [`${type}_${gen}` as WwTechId];
}
