import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  InterceptorNuke,
  STOCKPILED_NUKES,
  StockpiledNuke,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";

/**
 * Strategic weapons (GameConfig.strategicWeapons): the numbers and the pure
 * rules the engine and the client share.
 */

/** Units that exist only with the option on (Config.isUnitDisabled). */
export const STRATEGIC_ONLY_UNITS: ReadonlySet<UnitType> = new Set([
  UnitType.ConventionalMissile,
  UnitType.Satellite,
]);

const STOCKPILED: ReadonlySet<UnitType> = new Set(STOCKPILED_NUKES);

/** Atom bombs, hydrogen bombs and MIRVs: made in factories, fired from the stockpile. */
export function isStockpiledNuke(type: UnitType): type is StockpiledNuke {
  return STOCKPILED.has(type);
}

// --- Nuke production (spec §4) ---
/** Ticks one factory line takes per nuke: 20 s, 40 s, 60 s. */
export const NUKE_PRODUCTION_TICKS: Readonly<Record<StockpiledNuke, number>> = {
  [UnitType.AtomBomb]: 20 * 10,
  [UnitType.HydrogenBomb]: 40 * 10,
  [UnitType.MIRV]: 60 * 10,
};

/** A finished factory: one production line per level. */
export interface LineFactory {
  id: number;
  level: number;
}

/**
 * The factory a new nuke goes to: the one with the most free lines (level
 * minus the jobs running there), the lowest id on ties; null when every
 * line is busy.
 */
export function factoryWithFreeLine(
  factories: readonly LineFactory[],
  jobs: readonly { factoryId: number }[],
): number | null {
  let best: LineFactory | null = null;
  let bestFree = 0;
  for (const f of factories) {
    const free = f.level - jobs.filter((j) => j.factoryId === f.id).length;
    if (free <= 0) continue;
    if (
      best === null ||
      free > bestFree ||
      (free === bestFree && f.id < best.id)
    ) {
      best = f;
      bestFree = free;
    }
  }
  return best?.id ?? null;
}

/** Every stockpiled nuke a player holds (the leaderboard's "Nukes"). */
export function stockTotal(data: StrategicData | null): number {
  if (data === null) return 0;
  return STOCKPILED_NUKES.reduce((sum, t) => sum + data.stock[t], 0);
}

// --- Conventional missile (spec §5) ---
export const CONVENTIONAL_MISSILE_COST = 500_000;
/** Tiles per tick (an atom bomb flies 10). */
export const CONVENTIONAL_MISSILE_SPEED = 12;
/** The missile hits the enemy structure nearest the aimed tile within this many tiles. */
export const MISSILE_TARGET_RADIUS = 10;

/** A map point with a stable id, for pickNearestWithin. */
export interface PickCandidate {
  id: number;
  x: number;
  y: number;
}

/** The candidate nearest (x, y) within `radius` tiles (euclidean), the lowest id on ties; null if none. */
export function pickNearestWithin<T extends PickCandidate>(
  x: number,
  y: number,
  radius: number,
  candidates: readonly T[],
): T | null {
  const r2 = radius * radius;
  let best: T | null = null;
  let bestD2 = r2;
  for (const c of candidates) {
    const d2 = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d2 > r2) continue;
    if (best === null || d2 < bestD2 || (d2 === bestD2 && c.id < best.id)) {
      best = c;
      bestD2 = d2;
    }
  }
  return best;
}

// --- Orbital satellite (spec §6) ---
export const SATELLITE_COST = 25_000_000;
/** 90 s at a silo before the satellite reaches orbit. */
export const SATELLITE_PREP_TICKS = 90 * 10;
/** The satellite button picks the player's ready silo nearest the aim within this many tiles. */
export const SATELLITE_SILO_PICK_RADIUS = 15;
/** The strike lands 60 s after the target is chosen. */
export const SATELLITE_STRIKE_DELAY_TICKS = 60 * 10;
/** An interceptor is judged 3 s after launch; a due strike waits for every interceptor still flying. */
export const INTERCEPTOR_FLIGHT_TICKS = 3 * 10;
/** 1 in N per interceptor: hydrogen 20%, atom 4% (spec §6.3). */
export const INTERCEPT_ODDS: Readonly<Record<InterceptorNuke, number>> = {
  [UnitType.HydrogenBomb]: 5,
  [UnitType.AtomBomb]: 25,
};

/** One interceptor's hit chance in percent (the band's buttons). */
export function interceptHitPct(type: InterceptorNuke): number {
  return 100 / INTERCEPT_ODDS[type];
}

/** Share of the target's troops the strike kills. */
export const STRIKE_TROOP_LOSS_PCT = 70;
/** Tiles around each destroyed building that turn to sea. */
export const STRIKE_STRUCTURE_RADIUS = 3;
/** Share of the target's land the scattered fire turns to sea, beyond the building sites. */
export const STRIKE_SCATTER_PCT = 30;

/** Radius of each scattered crater: wider for bigger nations, 3 to 10 tiles. */
export function strikeCraterRadius(territoryTiles: number): number {
  return Math.max(3, Math.min(10, Math.floor(Math.sqrt(territoryTiles) / 6)));
}

/** Whole seconds left before a targeted satellite fires (0 once due). */
export function strikeSecondsLeft(strikeTick: number, now: number): number {
  return Math.max(0, Math.ceil((strikeTick - now) / 10));
}
