import type { Game } from "../game/Game";
import type { WorldWar } from "./WorldWar";

// Task 6 fills these (spec §7.5).

/** Victory points each smallID controls now, indexed by smallID. */
export function controlledVp(_mg: Game, ww: WorldWar): number[] {
  return ww.scenario.startVpBySmallId();
}

/** Of a country's starting regions, the victory points it still controls. */
export function heldStartVp(_mg: Game, ww: WorldWar, smallID: number): number {
  return ww.startVp(smallID);
}

export function checkCapitulations(
  _mg: Game,
  _ww: WorldWar,
  _tick: number,
): void {}

export function stepTransfers(_mg: Game, _ww: WorldWar): void {}
