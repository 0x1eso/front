import type { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import type { Game } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 3 (spec §6.2, §7, §8) fills these in. Until then no session opens.

/** At the scheduled tick: seats, the agenda, and the session opens. */
export function openRegularSession(
  _mg: Game,
  _c: Congress,
  _random: PseudoRandom,
): void {}

/** After a regular tally: the adopted resolution goes in force and everyone hears. */
export function onRegularResult(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}
