import { UnitType } from "@openfront/engine-api/game/GameTypes";

/**
 * Expanded warfare (GameConfig.warfareExpansion, spec §14b): starting
 * values and the pure rules the engine and the client share.
 */

/** Units that exist only with the option on (Config.isUnitDisabled). */
export const WARFARE_ONLY_UNITS: ReadonlySet<UnitType> = new Set([
  UnitType.CoastalBattery,
  UnitType.Airport,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
  UnitType.TransportPlane,
  UnitType.CargoPlane,
]);

// --- Coastal battery ---
/** Tiles from the battery within which it shells enemy boats and warships. */
export const COASTAL_BATTERY_RANGE = 40;
export const COASTAL_BATTERY_COST_STEP = 250_000;
export const COASTAL_BATTERY_COST_MAX = 1_000_000;
export const COASTAL_BATTERY_BUILD_TICKS = 10 * 10;

/** Ticks between shots: 3 s at level 1, faster per level, never under 1 s. */
export function coastalBatteryFireInterval(level: number): number {
  return Math.max(10, Math.floor(30 / Math.max(1, level)));
}

// --- Warships (option on only) ---
/** Percent of its rolled damage a warship's shell deals (−40%). */
export const WARSHIP_SHELL_DAMAGE_PCT = 60;
/** Percent of the vanilla time between a warship's shots (+50%). */
export const WARSHIP_SHELL_RATE_PCT = 150;

// --- Coastal barrage ---
export const BARRAGE_COST = 300_000;
export const BARRAGE_SHELLS = 8;
/** 8 shells 5 ticks apart: the salvo lasts 4 seconds. */
export const BARRAGE_SHELL_SPACING_TICKS = 5;
export const BARRAGE_RADIUS = 12;
/** Coastal batteries this close to a shell's impact are destroyed. */
export const BARRAGE_BATTERY_KILL_RADIUS = 3;
/** After the last shell the zone keeps defenses down this long (20 s). */
export const BARRAGE_SUPPRESSION_TICKS = 20 * 10;
/** Attacker losses on a suppressed tile (−40%). */
export const BARRAGE_ATTACKER_LOSS_FACTOR = 0.6;
/** Tiles a barrage shell flies per tick. */
export const BARRAGE_SHELL_SPEED = 6;

// --- Airport ---
export const AIRPORT_COST_STEP = 3_000_000;
export const AIRPORT_COST_MAX = 9_000_000;
export const AIRPORT_BUILD_TICKS = 60 * 10;
export const AIRPORT_BASE_RANGE = 150;
export const AIRPORT_RANGE_PER_LEVEL = 30;

/** How far an airport's planes reach (euclidean tiles). */
export function airportRange(level: number): number {
  return (
    AIRPORT_BASE_RANGE + AIRPORT_RANGE_PER_LEVEL * (Math.max(1, level) - 1)
  );
}

/** A used sortie comes back after 30 s; an airport has one per level. */
export const AIRPORT_SORTIE_COOLDOWN_TICKS = 30 * 10;
/** Tiles a plane flies per tick. */
export const PLANE_SPEED = 3;

// --- Paradrop ---
export const PARADROP_GOLD = 100_000;
/** The landing takes the target's land this close to the drop tile. */
export const PARADROP_RADIUS = 2;

// --- Bombing ---
export const BOMB_COST = 750_000;
export const BOMB_INNER = 8;
export const BOMB_OUTER = 18;
/** Carpet bombing (spec §14c): the bomber flies straight from its airport
 *  through the aimed tile and drops CARPET_BOMBS small blasts evenly along a
 *  CARPET_LENGTH-tile line centred on the aim. */
export const CARPET_BOMBS = 8;
export const CARPET_LENGTH = 48;
export const CARPET_BOMB_INNER = 4;
export const CARPET_BOMB_OUTER = 8;

/**
 * The carpet's drop points, in flight order: CARPET_BOMBS points on the
 * straight line from the airport (sx, sy) through the aim (tx, ty), centred
 * on the aim and spaced evenly over CARPET_LENGTH tiles. Points are rounded
 * to whole tiles and may fall off the map; callers clamp or skip them.
 * Engine and client preview both use this, so they agree tile for tile.
 */
export function carpetBombPoints(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): { x: number; y: number }[] {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Aimed at its own airport: drop along the x axis.
  const ux = len === 0 ? 1 : dx / len;
  const uy = len === 0 ? 0 : dy / len;
  const step = CARPET_LENGTH / (CARPET_BOMBS - 1);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < CARPET_BOMBS; i++) {
    const along = -CARPET_LENGTH / 2 + i * step;
    points.push({
      x: Math.round(tx + ux * along),
      y: Math.round(ty + uy * along),
    });
  }
  return points;
}
/** 1 in N: a bomber evades each SAM interception with 50%. */
export const BOMBER_EVADE_ODDS = 2;

// --- Cargo air routes ---
/** Each finished airport sends `level` cargo flights this often. */
export const CARGO_INTERVAL_TICKS = 30 * 10;

/** Gold one cargo flight pays each side, before multipliers and domestic modifiers. */
export function cargoGold(distance: number): number {
  return 20_000 + 100 * distance;
}
