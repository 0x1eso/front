import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Structures } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  STRIKE_SCATTER_PCT,
  STRIKE_STRUCTURE_RADIUS,
  STRIKE_TROOP_LOSS_PCT,
  strikeCraterRadius,
} from "@openfront/engine-lib/strategic/Strategic";
import { isHeritageProtected } from "../congress/Conflict";
import type { Game, Player } from "../game/Game";

/**
 * Crater tries allowed: random disks overlap, so covering the goal takes
 * about 0.36 * land / area tries; this allows several times that (area is
 * taken as 3 r^2), whatever the nation's size.
 */
function maxCraterAttempts(goal: number, radius: number): number {
  return 64 + 4 * Math.ceil(goal / (3 * radius * radius));
}

/** The strike lands in waves, one per tick at most, over this many ticks (spec §6.6). */
export const STRIKE_WAVE_TICKS = 30;

/** Where a strike will fall, fixed when it starts (and kept in StrikeState). */
export interface StrikePlan {
  /** Building sites, nearest the nation's centre first. */
  sites: TileRef[];
  /** Scattered crater centres, in the order they were drawn. */
  craters: TileRef[];
  craterRadius: number;
}

/** What one wave did. */
export interface WaveResult {
  impacts: TileRef[];
  buildings: number;
  troops: number;
}

/**
 * Plans the orbital strike on `target` (spec §6.4): a crater at every
 * building site (STRIKE_STRUCTURE_RADIUS) plus scattered craters until
 * about STRIKE_SCATTER_PCT more of the land is gone. Seeded by the tick
 * and both players, so every client scatters alike. Changes nothing.
 */
export function planOrbitalStrike(
  mg: Game,
  attacker: Player,
  target: Player,
): StrikePlan {
  const land = Array.from(target.tiles()).sort((a, b) => a - b);
  const sea = new Set<TileRef>();
  const sites = target
    .units(Structures.types)
    .map((u) => u.tile())
    .sort((a, b) => a - b);
  for (const site of sites) {
    addOwnedDisk(mg, target, site, STRIKE_STRUCTURE_RADIUS, sea);
  }
  sortFromCentre(mg, sites, land);

  const goal = Math.floor((land.length * STRIKE_SCATTER_PCT) / 100);
  const craterRadius = strikeCraterRadius(land.length);
  const rand = new PseudoRandom(
    mg.ticks() * 7919 + target.smallID() * 104_729 + attacker.smallID(),
  );
  const craters: TileRef[] = [];
  const maxAttempts = maxCraterAttempts(goal, craterRadius);
  let scattered = 0;
  for (let attempt = 0; scattered < goal && attempt < maxAttempts; attempt++) {
    const center = land[rand.nextInt(0, land.length)];
    if (sea.has(center)) continue;
    const before = sea.size;
    addOwnedDisk(mg, target, center, craterRadius, sea);
    scattered += sea.size - before;
    craters.push(center);
  }
  return { sites, craters, craterRadius };
}

/** Orders `tiles` by distance from the centroid of `land` (ties by tile id). */
function sortFromCentre(mg: Game, tiles: TileRef[], land: TileRef[]): void {
  if (tiles.length < 2 || land.length === 0) return;
  let sx = 0;
  let sy = 0;
  for (const t of land) {
    sx += mg.x(t);
    sy += mg.y(t);
  }
  const cx = sx / land.length;
  const cy = sy / land.length;
  const dist = (t: TileRef) => (mg.x(t) - cx) ** 2 + (mg.y(t) - cy) ** 2;
  tiles.sort((a, b) => dist(a) - dist(b) || a - b);
}

/** Number of waves a plan lands in, and the tick offset of wave `w`. */
export function strikeWaveCount(plan: StrikePlan): number {
  const n = plan.sites.length + plan.craters.length;
  return Math.max(1, Math.min(STRIKE_WAVE_TICKS, n));
}
export function strikeWaveOffset(plan: StrikePlan, wave: number): number {
  return Math.floor((wave * STRIKE_WAVE_TICKS) / strikeWaveCount(plan));
}

/**
 * Lands wave `wave` of `plan`: its share of the impacts (building sites
 * first, then craters) destroy the target's buildings there and turn the
 * target's land around them to sea. The first wave also kills the troops.
 */
export function landStrikeWave(
  mg: Game,
  attacker: Player,
  target: Player,
  plan: StrikePlan,
  wave: number,
): WaveResult {
  const all = [...plan.sites, ...plan.craters];
  const waves = strikeWaveCount(plan);
  const from = Math.floor((wave * all.length) / waves);
  const to = Math.floor(((wave + 1) * all.length) / waves);
  const impacts = all.slice(from, to);
  const last = wave === waves - 1;

  // World heritage A (spec §10.2): the host and its site's crater stay.
  const spared = new Set<TileRef>();
  if (mg.congress() !== null) {
    for (const unit of target.units(Structures.types)) {
      if (unit.isActive() && isHeritageProtected(mg, unit)) {
        addOwnedDisk(mg, target, unit.tile(), STRIKE_STRUCTURE_RADIUS, spared);
      }
    }
  }

  let buildings = 0;
  const sea = new Set<TileRef>();
  for (const [k, tile] of impacts.entries()) {
    const isSite = from + k < plan.sites.length;
    if (isSite) {
      for (const unit of target.units(Structures.types)) {
        if (
          unit.tile() === tile &&
          unit.isActive() &&
          !isHeritageProtected(mg, unit)
        ) {
          unit.delete(true, attacker);
          buildings++;
        }
      }
    }
    addOwnedDisk(
      mg,
      target,
      tile,
      isSite ? STRIKE_STRUCTURE_RADIUS : plan.craterRadius,
      sea,
    );
  }
  if (last) {
    // Anything built or captured since the plan was made goes too.
    for (const unit of target.units(Structures.types)) {
      if (unit.isActive() && !isHeritageProtected(mg, unit)) {
        unit.delete(true, attacker);
        buildings++;
      }
    }
  }
  let troops = 0;
  if (wave === 0) {
    troops = Math.floor((target.troops() * STRIKE_TROOP_LOSS_PCT) / 100);
    target.removeTroops(troops);
  }
  for (const tile of sea) {
    if (spared.has(tile)) continue;
    target.relinquish(tile);
    mg.queueWaterConversion(tile, true);
    mg.queueNukeImpact(tile);
  }
  return { impacts, buildings, troops };
}

/**
 * The whole strike at once (every wave in one go). The game itself lands it
 * over time (see Satellite.ts, StrikeState); this is the same strike
 * without the delay. Returns the impact tiles: the crater centers, then the
 * building sites.
 */
export function orbitalStrike(
  mg: Game,
  attacker: Player,
  target: Player,
): TileRef[] {
  const plan = planOrbitalStrike(mg, attacker, target);
  for (let w = 0; w < strikeWaveCount(plan); w++) {
    landStrikeWave(mg, attacker, target, plan, w);
  }
  return [...plan.craters, ...plan.sites];
}

/** Adds the owner's passable land within `r` tiles of `center` to `into`. */
function addOwnedDisk(
  mg: Game,
  owner: Player,
  center: TileRef,
  r: number,
  into: Set<TileRef>,
): void {
  const cx = mg.x(center);
  const cy = mg.y(center);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (!mg.isValidCoord(cx + dx, cy + dy)) continue;
      const tile = mg.ref(cx + dx, cy + dy);
      if (
        mg.owner(tile) === owner &&
        mg.isLand(tile) &&
        !mg.isImpassable(tile)
      ) {
        into.add(tile);
      }
    }
  }
}
