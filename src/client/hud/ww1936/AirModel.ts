// World War 1936 P4: what the air zone card and the air drawer compute
// from the views (plan Task 12 writes it).
import type { GameView } from "../../view/GameView";
import type { WwAirView } from "../../view/WwAirView";
import type { WwNavyView } from "../../view/WwNavyView";

export class AirModel {
  constructor(
    readonly navy: WwNavyView,
    readonly air: WwAirView,
    readonly game: GameView,
  ) {}
}
