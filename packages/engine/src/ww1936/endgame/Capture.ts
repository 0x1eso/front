// P5 lane A fills this file (plan Task 6): captured equipment (spec §14).
// The foundation's stub: nothing is captured (Battle.capEq and dmgBy are
// filled by P2's hooks).
import type { Battle } from "../land/WwLand";
import type { WwEndgame } from "./WwEndgame";

/** P2: a battle ended; side `winnerSide` (0 attackers, 1 defenders) took the field. Stub: nothing. */
export function captureOnBattleEnd(
  eg: WwEndgame,
  battle: Battle,
  winnerSide: 0 | 1,
): void {
  void eg;
  void battle;
  void winnerSide;
}

/** P2: division `row` was destroyed encircled by `by`'s side. Stub: nothing. */
export function captureOnEncircled(
  eg: WwEndgame,
  row: number,
  by: number,
): void {
  void eg;
  void row;
  void by;
}

/** Spec §14: a capitulation's stock share for the victor. Stub: nothing. */
export function captureOnCapitulation(
  eg: WwEndgame,
  loser: number,
  victor: number,
): void {
  void eg;
  void loser;
  void victor;
}
