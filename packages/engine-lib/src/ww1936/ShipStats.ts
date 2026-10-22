// World War 1936 P4: the ship classes, their generations and the techs
// that change them (P4 spec §4.1–§4.3). Pure integer functions: the
// engine, the AI and the screens call the same ones.
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SHIP_ROLE,
  ShipClass,
  ShipStats,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

interface ShipBase {
  hp: number;
  org: number;
  light: number;
  lightPierce: number;
  heavy: number;
  heavyPierce: number;
  torpedo: number;
  depth: number;
  armor: number;
  aa: number;
  speedKn: number;
  rangeKm: number;
  vis: number;
  surfDetect: number;
  subDetect: number;
  fuelPerDay: number;
  cost: number;
  supWeight: number;
}
/** Spec §4.1, generation 1 (1922), HOI4 feel. */
export const SHIP_BASE: Readonly<Record<ShipClass, ShipBase>> = {
  dd: {
    hp: 15,
    org: 50,
    light: 5,
    lightPierce: 8,
    heavy: 0,
    heavyPierce: 0,
    torpedo: 16,
    depth: 10,
    armor: 0,
    aa: 3,
    speedKn: 34,
    rangeKm: 3500,
    vis: 12,
    surfDetect: 25,
    subDetect: 25,
    fuelPerDay: 6,
    cost: 1200,
    supWeight: 2,
  },
  cl: {
    hp: 35,
    org: 50,
    light: 15,
    lightPierce: 15,
    heavy: 0,
    heavyPierce: 0,
    torpedo: 8,
    depth: 3,
    armor: 8,
    aa: 6,
    speedKn: 32,
    rangeKm: 6000,
    vis: 16,
    surfDetect: 30,
    subDetect: 10,
    fuelPerDay: 10,
    cost: 3400,
    supWeight: 3,
  },
  ca: {
    hp: 60,
    org: 45,
    light: 6,
    lightPierce: 15,
    heavy: 20,
    heavyPierce: 40,
    torpedo: 6,
    depth: 0,
    armor: 18,
    aa: 5,
    speedKn: 32,
    rangeKm: 7000,
    vis: 20,
    surfDetect: 28,
    subDetect: 5,
    fuelPerDay: 14,
    cost: 5000,
    supWeight: 5,
  },
  bc: {
    hp: 110,
    org: 40,
    light: 8,
    lightPierce: 15,
    heavy: 38,
    heavyPierce: 70,
    torpedo: 0,
    depth: 0,
    armor: 30,
    aa: 6,
    speedKn: 29,
    rangeKm: 6000,
    vis: 28,
    surfDetect: 22,
    subDetect: 0,
    fuelPerDay: 20,
    cost: 9000,
    supWeight: 8,
  },
  bb: {
    hp: 150,
    org: 40,
    light: 10,
    lightPierce: 15,
    heavy: 50,
    heavyPierce: 80,
    torpedo: 0,
    depth: 0,
    armor: 50,
    aa: 8,
    speedKn: 22,
    rangeKm: 5500,
    vis: 30,
    surfDetect: 20,
    subDetect: 0,
    fuelPerDay: 24,
    cost: 12500,
    supWeight: 10,
  },
  cv: {
    hp: 85,
    org: 40,
    light: 4,
    lightPierce: 10,
    heavy: 0,
    heavyPierce: 0,
    torpedo: 0,
    depth: 0,
    armor: 10,
    aa: 12,
    speedKn: 28,
    rangeKm: 6500,
    vis: 34,
    surfDetect: 40,
    subDetect: 10,
    fuelPerDay: 20,
    cost: 9500,
    supWeight: 10,
  },
  ss: {
    hp: 10,
    org: 40,
    light: 1,
    lightPierce: 5,
    heavy: 0,
    heavyPierce: 0,
    torpedo: 20,
    depth: 0,
    armor: 0,
    aa: 0,
    speedKn: 16,
    rangeKm: 6000,
    vis: 6,
    surfDetect: 15,
    subDetect: 0,
    fuelPerDay: 2,
    cost: 900,
    supWeight: 1,
  },
};
/** Spec §4.2, index = generation − 1. */
export const GEN_HP_PCT = [100, 110, 120, 130] as const;
export const GEN_ATK_PCT = [100, 125, 150, 175] as const;
export const GEN_PIERCE_PCT = [100, 115, 130, 145] as const;
export const GEN_DETECT = [0, 5, 10, 15] as const;
export const GEN_SUB_VIS = [6, 5, 4, 3] as const;
export const GEN_DECK = [40, 60, 75, 90] as const;
export const GEN_COST_PCT = [100, 120, 140, 160] as const;
/** Spec §4.2: knots a generation adds (battleships +6, +8, +9: the fast battleships). */
export function genSpeedKn(cls: ShipClass, gen: number): number {
  return cls === "bb" ? [0, 6, 8, 9][gen - 1] : gen - 1;
}

/**
 * Spec §4.1–§4.3: a ship's numbers at its generation. Equipment techs
 * (sonar, torpedo, radar) are read by id (plan decision 23); doctrine
 * bonuses only as stat keys (P6 pre-flight: P6 retires the doctrine techs
 * and feeds the same keys from grand doctrines).
 */
export function shipStats(
  cls: ShipClass,
  gen: number,
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
): ShipStats {
  const b = SHIP_BASE[cls];
  const g = gen - 1;
  const role = SHIP_ROLE[cls];
  const sonar = (techs.has("sonar_1") ? 1 : 0) + (techs.has("sonar_2") ? 1 : 0);
  const screen = role === "screen";
  // Doctrine bonuses come as stat keys (P6 pre-flight), techs by id.
  const capital = cls === "bb" || cls === "bc";
  const hpPct = GEN_HP_PCT[g] + (capital ? stats.capitalHpPct : 0);
  const atk = GEN_ATK_PCT[g];
  // P6 (spec §21.2, T1b): torpedoPct on every ship's torpedoes,
  // depthChargePct on its depth charges.
  const torpPct =
    atk +
    (techs.has("torpedo_1") ? 15 : 0) +
    (cls === "ss" ? stats.subTorpedoPct : 0) +
    stats.torpedoPct;
  const depthPct = atk + (screen ? 15 * sonar : 0) + stats.depthChargePct;
  // P6 (lane M, T1b): the naval MIO's stat % on every weapon.
  const mio = (v: number) =>
    stats.mioStatPct_naval === 0
      ? v
      : Math.floor((v * (100 + stats.mioStatPct_naval)) / 100);
  const pierce = GEN_PIERCE_PCT[g];
  const surf = Math.floor(
    ((b.surfDetect + GEN_DETECT[g]) *
      (100 + (techs.has("naval_radar_1") ? 20 : 0))) /
      100,
  );
  const subBase = b.subDetect > 0 ? b.subDetect + GEN_DETECT[g] : 0;
  const sub = Math.floor((subBase * (100 + (screen ? 30 * sonar : 0))) / 100);
  const vis =
    cls === "ss"
      ? Math.max(
          1,
          Math.floor((GEN_SUB_VIS[g] * (100 + stats.subVisibilityPct)) / 100),
        )
      : b.vis;
  // P6 (spec §21.2, T1b): carrierDeckPct beside the MIO's deckPct.
  const deck =
    cls === "cv"
      ? Math.floor(
          (GEN_DECK[g] * (100 + stats.deckPct + stats.carrierDeckPct)) / 100,
        )
      : 0;
  return {
    hpMilli: b.hp * hpPct * 10,
    // P6 (spec §21.2, T1b): navalOrg on every ship.
    orgMilli:
      Math.max(1, b.org + (cls === "ss" ? stats.subOrg : 0) + stats.navalOrg) *
      1000,
    light: mio(b.light * atk),
    lightPierce: b.lightPierce * pierce,
    heavy: mio(b.heavy * atk),
    heavyPierce: b.heavyPierce * pierce,
    torpedo: mio(b.torpedo * Math.max(0, torpPct)),
    depth: mio(b.depth * Math.max(0, depthPct)),
    armor: b.armor * pierce,
    aa: mio(b.aa * atk),
    speedCentiKn: (b.speedKn + genSpeedKn(cls, gen)) * 100,
    rangeKm: b.rangeKm,
    vis,
    surfDetect: surf,
    subDetect: sub,
    deck,
    fuelPerDayMilli: b.fuelPerDay * 1000,
    cost: Math.floor((b.cost * GEN_COST_PCT[g]) / 100),
    supWeight: b.supWeight,
  };
}

/** Spec §5.3: a convoy costs 60 on a naval line. */
export const CONVOY_COST = 60;
/** The naval industry points one unit of a naval line costs (spec §4.2, §5.3). */
export function lineUnitCost(cls: ShipClass | "convoy", gen: number): number {
  return cls === "convoy"
    ? CONVOY_COST
    : Math.floor((SHIP_BASE[cls].cost * GEN_COST_PCT[gen - 1]) / 100);
}
/** Resources per assigned dockyard a day, RESOURCE_IDS order (spec §4.1 last but one column, §5.3). */
export function lineResources(cls: ShipClass | "convoy"): number[] {
  // [oil, aluminium, rubber, tungsten, steel, chromium]
  if (cls === "ca" || cls === "bc" || cls === "bb") return [0, 0, 0, 0, 1, 1];
  if (cls === "cv") return [0, 1, 0, 0, 1, 0];
  return [0, 0, 0, 0, 1, 0];
}
/** The tech that opens (cls, gen); gen 1 is always open (spec §4.3 last line). */
export function shipGenTech(cls: ShipClass, gen: number): WwTechId | null {
  return gen <= 1 ? null : (`${cls}_${gen}` as WwTechId);
}
