// World War 1936 P4: what the fleet card and the navy drawer compute from
// the views (plan Task 12 writes it).
import type { GameView } from "../../view/GameView";
import type { WwAirView } from "../../view/WwAirView";
import type { WwNavyView } from "../../view/WwNavyView";

export class NavyModel {
  constructor(
    readonly navy: WwNavyView,
    readonly air: WwAirView,
    readonly game: GameView,
  ) {}
}
