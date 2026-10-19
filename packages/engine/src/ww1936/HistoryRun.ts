import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import type { Game } from "../game/Game";
import type { WorldWar } from "./WorldWar";

// Task 5 fills these (spec §7.4).

export function rollHistory(
  ww: WorldWar,
  _random: PseudoRandom,
  _enabled: boolean,
): void {
  ww.setHistory([]);
}

export function processHistory(
  _mg: Game,
  _ww: WorldWar,
  _day: number,
  _tick: number,
): void {}
