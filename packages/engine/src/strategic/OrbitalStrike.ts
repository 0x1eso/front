import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Structures } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  STRIKE_SCATTER_PCT,
  STRIKE_STRUCTURE_RADIUS,
  STRIKE_TROOP_LOSS_PCT,
  strikeCraterRadius,
} from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";

/**
 * Crater tries allowed: random disks overlap, so covering the goal takes
 * about 0.36 * land / area tries; this allows several times that (area is
 * taken as 3 r^2), whatever the nation's size.
 */
function maxCraterAttempts(goal: number, radius: number): number {
  return 64 + 4 * Math.ceil(goal / (3 * radius * radius));
}

/**
 * The orbital strike on `target` (spec §6.4): every building destroyed by
 * `attacker`, 70% of the troops killed, and land turned to sea at each
 * building site (STRIKE_STRUCTURE_RADIUS) plus scattered craters until
 * about STRIKE_SCATTER_PCT more of the land is gone — the target's land
 * only, even without water nukes. Seeded by the tick and both players, so
 * every client scatters alike. Returns the impact tiles: the crater
 * centers, then the building sites.
 */
export function orbitalStrike(
  mg: Game,
  attacker: Player,
  target: Player,
): TileRef[] {
  const sites: TileRef[] = [];
  const craters: TileRef[] = [];
  const sea = new Set<TileRef>();
  const structures = target.units(Structures.types);
  for (const unit of structures) {
    sites.push(unit.tile());
    addOwnedDisk(mg, target, unit.tile(), STRIKE_STRUCTURE_RADIUS, sea);
  }
  for (const unit of structures) {
    if (unit.isActive()) unit.delete(true, attacker);
  }

  const land = Array.from(target.tiles()).sort((a, b) => a - b);
  const goal = Math.floor((land.length * STRIKE_SCATTER_PCT) / 100);
  const radius = strikeCraterRadius(land.length);
  const rand = new PseudoRandom(
    mg.ticks() * 7919 + target.smallID() * 104_729 + attacker.smallID(),
  );
  const maxAttempts = maxCraterAttempts(goal, radius);
  let scattered = 0;
  for (let attempt = 0; scattered < goal && attempt < maxAttempts; attempt++) {
    const center = land[rand.nextInt(0, land.length)];
    if (sea.has(center)) continue;
    const before = sea.size;
    addOwnedDisk(mg, target, center, radius, sea);
    scattered += sea.size - before;
    craters.push(center);
  }

  target.removeTroops(
    Math.floor((target.troops() * STRIKE_TROOP_LOSS_PCT) / 100),
  );
  for (const tile of sea) {
    target.relinquish(tile);
    mg.queueWaterConversion(tile, true);
    mg.queueNukeImpact(tile);
  }
  return [...craters, ...sites];
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
