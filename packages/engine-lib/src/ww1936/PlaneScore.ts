// Plane design reform: the performance score of a plane (a static
// generation or a design) and the cell rule's map from a design cell
// (plane type x airframe) to the static plane it stands in for. Static
// planes and designs are on one scale: both are the plane's base numbers
// (PlaneStats' generation numbers; a design's final numbers), air attack,
// defence, ground, strategic and naval attack in centi-points, agility in
// points, speed in km/h, range in km — before the country's percentages.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { PLANE_BASE } from "./PlaneStats";

/** The numbers a plane's score reads. */
export interface PlaneNumbers {
  airAtk: number;
  airDef: number;
  agility: number;
  speed: number;
  range: number;
  ground: number;
  strat: number;
  naval: number;
}

/** Spec §12.2 generations (PlaneStats): +30 % / +60 % on the attack numbers, speed +80 / +160, range +20 % / +40 %. */
const GEN_PCT = [100, 130, 160];
const GEN_SPEED = [0, 80, 160];
const GEN_RANGE_PCT = [100, 120, 140];

/** A static plane type's generation with no country percentages (PlaneStats.planeStats at zero stats). */
export function staticPlaneNumbers(type: AirType, gen: number): PlaneNumbers {
  const b = PLANE_BASE[type];
  const g = Math.max(0, Math.min(2, gen - 1));
  return {
    airAtk: b.airAtk * GEN_PCT[g],
    airDef: b.airDef * GEN_PCT[g],
    agility: Math.floor((b.agility * GEN_PCT[g]) / 100),
    speed: b.speedKmh + GEN_SPEED[g],
    range: Math.floor((b.rangeKm * GEN_RANGE_PCT[g]) / 100),
    ground: b.ground * GEN_PCT[g],
    strat: b.strat * GEN_PCT[g],
    naval: b.naval * GEN_PCT[g],
  };
}

/**
 * Score weights, percent, in the order air attack, air defence, agility,
 * speed, range, ground, strategic, naval attack. Cost is not in it.
 */
type W = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
const W_FIGHTER: W = [40, 20, 20, 20, 0, 0, 0, 0];
const W_CAS: W = [0, 25, 0, 15, 0, 60, 0, 0];
const W_BOMBER: W = [0, 35, 0, 0, 0, 45, 20, 0];
const W_STRAT: W = [0, 40, 0, 0, 0, 0, 60, 0];
const W_NAVAL: W = [0, 30, 0, 0, 0, 0, 0, 70];
const W_TRANSPORT: W = [0, 30, 0, 30, 40, 0, 0, 0];
const WEIGHTS: Readonly<Record<string, W>> = {
  fighter: W_FIGHTER,
  heavy_fighter: W_FIGHTER,
  cv_fighter: W_FIGHTER,
  cas: W_CAS,
  cv_cas: W_CAS,
  bomber: W_BOMBER,
  strat_bomber: W_STRAT,
  naval_bomber: W_NAVAL,
  cv_naval_bomber: W_NAVAL,
  transport_plane: W_TRANSPORT,
};

/**
 * The score of a plane flying as `type` (integers only): fighters on air
 * attack, air defence, agility and speed; ground attack planes on ground
 * attack, defence and speed; bombers on their bombing numbers (ground,
 * strategic) and defence; naval bombers on naval attack and defence;
 * transports on range, speed and defence. Agility counts x30 and speed x4
 * to stand on the centi scale of the attacks; range x1.
 */
export function planeScore(type: string, n: PlaneNumbers): number {
  const w = WEIGHTS[type] ?? W_FIGHTER;
  const sum =
    n.airAtk * w[0] +
    n.airDef * w[1] +
    n.agility * 30 * w[2] +
    n.speed * 4 * w[3] +
    n.range * w[4] +
    n.ground * w[5] +
    n.strat * w[6] +
    n.naval * w[7];
  return Math.floor(sum / 100);
}

/** The score of a static plane type's generation. */
export function staticPlaneScore(type: AirType, gen: number): number {
  return planeScore(type, staticPlaneNumbers(type, gen));
}

/**
 * The static plane a design cell (plane type x airframe) stands in for, the
 * first save into the cell absorbing it: the generation is the airframe's
 * (small_N, medium_N, large_N) and the static type must be the one flown on
 * that airframe size. Small frames: fighter, cas, naval bomber and their
 * carrier forms; medium: heavy fighter (three generations, medium_3 being
 * heavy_fighter_3), bomber (two: medium_3 has none) and the transport
 * (generation 1 only); large: strategic bomber. Jets and the types a size
 * does not field as a static (a medium naval bomber, a large heavy
 * fighter...) have no partner: null.
 */
export function staticPartnerOfCell(
  type: string,
  base: string,
): { type: AirType; gen: number } | null {
  const m = /^(small|medium|large)_(\d)$/.exec(base);
  if (m === null) return null;
  const gen = Number(m[2]);
  const size = m[1];
  const ok =
    size === "small"
      ? [
          "fighter",
          "cas",
          "naval_bomber",
          "cv_fighter",
          "cv_cas",
          "cv_naval_bomber",
        ].includes(type)
      : size === "medium"
        ? (type === "heavy_fighter" && gen <= 3) ||
          (type === "bomber" && gen <= 2) ||
          (type === "transport_plane" && gen === 1)
        : type === "strat_bomber";
  return ok ? { type: type as AirType, gen } : null;
}

/** The plane types the designer's type row offers, in its order. */
export const PLANE_CELL_TYPES = [
  "fighter",
  "cas",
  "naval_bomber",
  "heavy_fighter",
  "bomber",
  "strat_bomber",
  "transport_plane",
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
] as const;

/**
 * Whether a design of plane type `type` can exist on airframe size `size`
 * (planeType): small frames fly fighters, ground attackers and naval
 * bombers, and the carrier forms of those; medium ones heavy fighters,
 * bombers, naval bombers and transports; large ones strategic bombers,
 * naval bombers and transports.
 */
export function planeTypeOnSize(type: string, size: string): boolean {
  switch (size) {
    case "small":
      return [
        "fighter",
        "cas",
        "naval_bomber",
        "cv_fighter",
        "cv_cas",
        "cv_naval_bomber",
      ].includes(type);
    case "medium":
      return [
        "heavy_fighter",
        "bomber",
        "naval_bomber",
        "transport_plane",
      ].includes(type);
    default:
      return ["strat_bomber", "naval_bomber", "transport_plane"].includes(type);
  }
}
