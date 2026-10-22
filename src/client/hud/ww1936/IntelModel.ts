// P6 lane U3 fills this file (plan Task 12): the intelligence drawer (spec §20.6).
// The foundation's stub holds the class and its constructor; the lane adds
// the methods its Interfaces name.
import type { GameView } from "../../view/GameView";

export class IntelModel {
  constructor(readonly view: GameView) {}
}
