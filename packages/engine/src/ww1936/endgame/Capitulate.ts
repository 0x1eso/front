// P5 lane W fills this file (plan Task 2): capitulation (spec §5). The
// foundation's stub mimics P0–P4 exactly (plan decision 9, pre-flight §0-2):
// the loser's war records say capitulated, its wars end, its forces go
// (X's capitulationForces: P2 removeCountryForces, P4 navy and air), then
// control and the legal owner move to the victor, then politics.
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { transferOnCapitulation } from "../land/Occupation";
import { capitulationForces } from "./Exile";
import type { WwEndgame } from "./WwEndgame";

export function capitulate(
  eg: WwEndgame,
  loser: number,
  victor: number,
  tick: number,
): void {
  const ww = eg.ww;
  // Member states first: onWarPairRemoved leaves a non-active member be.
  for (const w of eg.wars) {
    if (w.ended !== null) continue;
    const m = eg.member(w, loser);
    if (m !== null && m.state === "active") {
      eg.setMemberState(w.id, loser, "capitulated");
    }
  }
  ww.endWarsOf(loser);
  // P2 spec §5.5, §12.5 and P4 decision 32: its divisions, armies, fleets
  // and air deployments are gone this tick (X turns some into an exile's).
  capitulationForces(eg, loser, victor, 0, tick);
  if (victor !== 0) {
    // Land still on its way to the loser goes straight on to its victor.
    for (const t of ww.transfers()) {
      if (t.to === loser) t.to = victor;
    }
    transferOnCapitulation(ww.land, loser, victor);
    // P3 spec §17.1: its legal regions go to the victor (cores unchanged).
    for (const r of ww.scenario.landRegions) {
      if (ww.politics.legalOwner[r.id] === loser) {
        ww.politics.setLegalOwner(r.id, victor);
      }
    }
  }
  // P3: its politics stop (cards, focus, faction leadership, treaties).
  ww.politics.onCapitulated(loser, victor, tick);
  eg.setCountryState(loser, CS_GONE);
}
