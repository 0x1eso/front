import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { GameLike } from "@openfront/engine-api/game/ReadViews";
import type { NukeMagnitude } from "@openfront/engine-lib/configuration/Config";
import {
  listNukeBreakAlliance,
  wouldNukeBreakAlliance,
} from "@openfront/engine-lib/execution/NukeAlliance";
import {
  airportRange,
  BARRAGE_RADIUS,
  CARPET_BOMB_INNER,
  CARPET_BOMB_OUTER,
  carpetBombPoints,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";
import type { Ring } from "../render/gl/passes/WarfareRingPass";
import type { SAMInfo } from "../render/gl/utils/NukeTrajectory";

/**
 * Expanded warfare ghost rings: battery reach, airport range, barrage radius.
 * A bomber has none here: its 8 blasts are drawn along the flight line
 * (carpetAimRings), not as one circle at the aim.
 */
export function warfareGhostRadius(type: UnitType, level: number): number {
  switch (type) {
    case UnitType.CoastalBattery:
      return COASTAL_BATTERY_RANGE;
    case UnitType.Airport:
      return airportRange(level);
    case UnitType.CoastalBarrage:
      return BARRAGE_RADIUS;
    default:
      return 0;
  }
}

export interface FlightSourceUnit {
  tile(): TileRef;
  level(): number;
  isActive(): boolean;
  isInCooldown(): boolean;
  isUnderConstruction(): boolean;
}

/** Whether a unit can fly now (alive, built, a sortie or shot left). */
function isReady(u: FlightSourceUnit): boolean {
  return u.isActive() && !u.isInCooldown() && !u.isUnderConstruction();
}

/**
 * Where a bomber or paradrop (airport) or a barrage (silo) would take off
 * for `tile`: the nearest ready one, first wins a tie, the same pick as the
 * engine's airportSortieSpawn / barrageSpawn. A plane must be within its
 * airport's range; a barrage has no range limit (spec 14c). Null when none
 * qualifies.
 */
export function flightSource(
  units: readonly FlightSourceUnit[],
  type: UnitType.Bomber | UnitType.CoastalBarrage,
  tile: TileRef,
  dist2: (a: TileRef, b: TileRef) => number,
): TileRef | null {
  let best: FlightSourceUnit | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (!isReady(u)) continue;
    const d = dist2(u.tile(), tile);
    if (type === UnitType.Bomber) {
      const reach = airportRange(u.level());
      if (d > reach * reach) continue;
    }
    if (d >= bestDist) continue;
    best = u;
    bestDist = d;
  }
  return best?.tile() ?? null;
}

const RING_RANGE = [0.3, 0.85, 0.45] as const;
const RING_FLYER = [1.0, 1.0, 0.4] as const;
const RING_BOMB = [1.0, 0.55, 0.1] as const;
const RING_BOMB_BREAKS = [1.0, 0.2, 0.2] as const;
/** Size of the mark on the airport that would fly. */
export const FLYER_MARK_RADIUS = 5;

/**
 * Aiming a paradrop or bomber: the range ring of every airport that still
 * has a sortie, and a filled mark on the one that would fly.
 */
export function airportAimRings(
  airports: readonly FlightSourceUnit[],
  chosen: TileRef | null,
  xy: (tile: TileRef) => { x: number; y: number },
): Ring[] {
  const rings: Ring[] = [];
  for (const a of airports) {
    if (!isReady(a)) continue;
    const { x, y } = xy(a.tile());
    rings.push({
      x,
      y,
      radius: airportRange(a.level()),
      color: RING_RANGE,
      outline: true,
    });
  }
  if (chosen !== null) {
    const { x, y } = xy(chosen);
    rings.push({
      x,
      y,
      radius: FLYER_MARK_RADIUS,
      color: RING_FLYER,
      outline: false,
    });
  }
  return rings;
}

/** The carpet's drop tiles on the map, in flight order (off-map ones skipped). */
export function carpetTiles(
  src: { x: number; y: number },
  aim: { x: number; y: number },
  game: {
    isValidCoord(x: number, y: number): boolean;
    ref(x: number, y: number): TileRef;
  },
): TileRef[] {
  const tiles: TileRef[] = [];
  for (const p of carpetBombPoints(src.x, src.y, aim.x, aim.y)) {
    if (game.isValidCoord(p.x, p.y)) tiles.push(game.ref(p.x, p.y));
  }
  return tiles;
}

/** The 8 blast circles of the carpet, red when it would break an alliance. */
export function carpetAimRings(
  src: { x: number; y: number },
  aim: { x: number; y: number },
  breaksAlliance: boolean,
): Ring[] {
  return carpetBombPoints(src.x, src.y, aim.x, aim.y).map((p) => ({
    x: p.x,
    y: p.y,
    radius: CARPET_BOMB_OUTER,
    color: breaksAlliance ? RING_BOMB_BREAKS : RING_BOMB,
    outline: true,
  }));
}

interface CarpetAllianceParams {
  game: GameLike;
  tiles: readonly TileRef[];
  config: { nukeAllianceBreakThreshold(): number };
  allySmallIds: Set<number>;
}

const CARPET_BLAST: NukeMagnitude = {
  inner: CARPET_BOMB_INNER,
  outer: CARPET_BOMB_OUTER,
};

/** True when any of the carpet's blasts would break an alliance. */
export function carpetWouldBreakAlliance(p: CarpetAllianceParams): boolean {
  const threshold = p.config.nukeAllianceBreakThreshold();
  return p.tiles.some((targetTile) =>
    wouldNukeBreakAlliance({
      game: p.game,
      targetTile,
      magnitude: CARPET_BLAST,
      allySmallIds: p.allySmallIds,
      threshold,
    }),
  );
}

/** Every player the carpet's blasts would anger (including unallied ones). */
export function carpetBetrayed(
  p: Omit<CarpetAllianceParams, "allySmallIds">,
): Set<number> {
  const threshold = p.config.nukeAllianceBreakThreshold();
  const all = new Set<number>();
  for (const targetTile of p.tiles) {
    for (const id of listNukeBreakAlliance({
      game: p.game,
      targetTile,
      magnitude: CARPET_BLAST,
      threshold,
    })) {
      all.add(id);
    }
  }
  return all;
}

export interface PlaneThreatSam<P> {
  isActive(): boolean;
  owner(): P;
  tile(): TileRef;
  level(): number;
}

/**
 * The SAMs a transport plane of `me` must fear, by the engine's rule
 * (SAMLauncherExecution.isValidNukeTarget): every active SAM whose owner is
 * not me and not friendly with me (ally or teammate). A paradrop does not
 * betray anyone and a transport plane cannot evade, so the whole flight is
 * covered by whatever range these SAMs have.
 */
export function paradropThreatSams<P>(
  sams: Iterable<PlaneThreatSam<P>>,
  me: P,
  isFriendly: (owner: P) => boolean,
  xy: (tile: TileRef) => { x: number; y: number },
  rangeOf: (owner: P, level: number) => number,
): SAMInfo[] {
  const out: SAMInfo[] = [];
  for (const s of sams) {
    if (!s.isActive()) continue;
    const owner = s.owner();
    if (owner === me || isFriendly(owner)) continue;
    const { x, y } = xy(s.tile());
    out.push({ x, y, r: rangeOf(owner, s.level()) });
  }
  return out;
}
