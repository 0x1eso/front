// World War 1936 P5: what the peace conference card reads (spec §6, §21.4).
// The foundation's stub; P5 lane U1 fills it (plan Task 9) with the
// engine-lib rules (EndgameRules: demandCost, aggregateCost, …) so a card's
// price is the engine's.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  WwConferenceView,
  WwDemandView,
} from "@openfront/engine-api/ww1936/EndgameTypes";

export class PeaceModel {
  constructor(readonly conference: WwConferenceView | null) {}

  /** My points left this round after `demands`. Stub: 0. */
  remainingPts(me: number, demands: readonly WwDemandView[]): number {
    void me;
    void demands;
    return 0;
  }

  /** What a demand would cost me now. Stub: 0. */
  previewCost(me: number, demand: WwDemandView): number {
    void me;
    void demand;
    return 0;
  }

  /** The rows of my demand list. Stub: none. */
  demandRows(me: number): WwDemandView[] {
    void me;
    return [];
  }

  /** A stake region's line (base value, holder, zone). Stub: null. */
  stakeRegion(region: number): WwConferenceView["stake"][number] | null {
    void region;
    return null;
  }

  /** Whether `tag` may be released or liberated here. Stub: false. */
  canRelease(tag: CountryTag): boolean {
    void tag;
    return false;
  }
}
