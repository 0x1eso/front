// P5 lane C fills this file (plan Task 7): civil wars (spec §15). The
// foundation's stub: none starts (P3's civil_war stays a government change).
import type { Ideology } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwEndgame } from "./WwEndgame";

/** Spec §15.1: `smallID` splits; true when a civil war began (P3 then does nothing). Stub: false. */
export function startCivilWar(
  eg: WwEndgame,
  smallID: number,
  ideology: Ideology,
  tick: number,
): boolean {
  void eg;
  void smallID;
  void ideology;
  void tick;
  return false;
}

/** Spec §15.4: a civil war ended with side `winner` on top. Stub: nothing. */
export function endCivilWar(
  eg: WwEndgame,
  warId: number,
  winner: 0 | 1,
  tick: number,
): void {
  void eg;
  void warId;
  void winner;
  void tick;
}
