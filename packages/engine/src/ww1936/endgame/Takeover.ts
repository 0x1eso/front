// World War 1936 P5 lane X (plan Task 5 Step 6; spec §11.2): takeover
// candidates — the AI countries of the faction the lost country was last
// in (an exile's at the time it went into exile) that still play on their
// own: active, not capitulated, not exiles.
import {
  CS_ACTIVE,
  WW_TAKEOVER_CANDIDATES,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { WwEndgame } from "./WwEndgame";

/**
 * Up to three, by factories (civilian + military, the most first; ties the
 * smaller smallID). The faction: the exile record's (when `from` is an
 * exile that had one), else its P3 faction now.
 */
export function takeoverCandidates(
  eg: WwEndgame,
  fromSmallID: number,
): number[] {
  const pol = eg.ww.politics;
  const ex = eg.exileIdx.get(fromSmallID);
  const recorded = ex === undefined ? -1 : eg.exiles[ex].faction;
  const f = recorded >= 0 ? recorded : pol.factionIdx(fromSmallID);
  if (f < 0) return [];
  return pol
    .factionMembers(f)
    .filter(
      (m) =>
        m !== fromSmallID &&
        !eg.isHumanControlled(m) &&
        eg.countryStateArr[m] === CS_ACTIVE &&
        !eg.ww.isCapitulated(m) &&
        !eg.isExile(m) &&
        eg.isActor(m),
    )
    .sort((a, b) => eg.factoriesOf(b) - eg.factoriesOf(a) || a - b)
    .slice(0, WW_TAKEOVER_CANDIDATES);
}
