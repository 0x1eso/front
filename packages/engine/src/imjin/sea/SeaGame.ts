// Imjin sea layer: the bridge to a running Game. Everything here is behind
// `isImjin`; a 1936 game never builds a sea context or ticks the layer. The
// owner-side hooks (hostility, ports, prize rule, zones, current axes) come
// from the Imjin state at the P0-P2 merge; the defaults below keep the layer
// runnable on its own.
import { seaFlagsAt } from "@openfront/engine-lib/imjin/Terrain";
import { isImjin } from "@openfront/engine-lib/ww1936/scenario/Profile";
import type { Game } from "../../game/Game";
import { PathFinding } from "../../pathfinding/PathFinder";
import type { SeaCtx } from "./SeaCtx";
import type { SeaState } from "./SeaState";
import { seaTick } from "./SeaTick";

export type SeaHooks = Partial<
  Pick<
    SeaCtx,
    | "hostile"
    | "nearestPort"
    | "portLevelAt"
    | "currentAxis"
    | "keepsPrizes"
    | "zoneOf"
  >
>;

export interface SeaClock {
  month: number;
  day: number;
  night: boolean;
  seed: number;
}

export function imjinSeaOn(game: Game): boolean {
  return isImjin(game.config().gameConfig() as { ww1936Scenario?: string });
}

export function seaCtxForGame(
  game: Game,
  clock: SeaClock,
  hooks: SeaHooks = {},
): SeaCtx {
  const map = game.map();
  const water = PathFinding.Water(game);
  return {
    seed: clock.seed,
    tick: game.ticks(),
    month: clock.month,
    day: clock.day,
    night: clock.night,
    width: map.width(),
    height: map.height(),
    ref: (x, y) => map.ref(x, y),
    tileX: (t) => map.x(t),
    tileY: (t) => map.y(t),
    isWater: (t) => map.isWater(t),
    flags: (t) => seaFlagsAt(map, t),
    zoneOf: hooks.zoneOf ?? (() => 0),
    hostile: hooks.hostile ?? ((a, b) => a !== b),
    path: (from, to) => water.findPath(from, to),
    nearestPort: hooks.nearestPort ?? (() => -1),
    portLevelAt: hooks.portLevelAt ?? (() => 0),
    currentAxis: hooks.currentAxis ?? (() => 0),
    keepsPrizes: hooks.keepsPrizes ?? (() => true),
  };
}

/** One sea tick for an Imjin game; a no-op in every other game. */
export function imjinSeaTick(
  game: Game,
  st: SeaState,
  clock: SeaClock,
  newDay: boolean,
  hooks: SeaHooks = {},
): void {
  if (!imjinSeaOn(game)) return;
  seaTick(st, seaCtxForGame(game, clock, hooks), newDay);
}
