// World War 1936 P5: what the occupation, aid, subjects and wars tabs read
// (spec §8–§13, §21.4). The foundation's stub; P5 lane U2 fills it (plan
// Task 10).
import type {
  WwAidView,
  WwOccView,
  WwSubjectView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { WwEndgameView } from "../../view/WwEndgameView";

export class EndgameModel {
  constructor(readonly view: WwEndgameView | null) {}

  /** My administered regions in short (count, resistance, garrison cover). Stub: zeros. */
  occupationSummary(me: number): {
    regions: number;
    avgResBp: number;
    coveredPct: number;
  } {
    void me;
    return { regions: 0, avgResBp: 0, coveredPct: 0 };
  }

  /** My administered regions grouped by legal owner. Stub: none. */
  byLegalOwner(me: number): Map<number, WwOccView[]> {
    void me;
    return new Map();
  }

  /** My lend-lease and volunteer lines. Stub: none. */
  aidRows(me: number): WwAidView | null {
    void me;
    return null;
  }

  /** My subjects (or my overlord). Stub: none. */
  subjectRows(me: number): WwSubjectView[] {
    void me;
    return [];
  }

  /** The war cards (sides, members, shares). Stub: none. */
  warCards(me: number): WwWarSummary[] {
    void me;
    return [];
  }
}
