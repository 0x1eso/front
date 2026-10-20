// World War 1936 P3: decisions and missions (spec §13). STUB: lane E
// (Task 3) writes the bodies; the signatures are final.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  DecisionId,
  WwDecisionCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function takeDecision(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
  tick: number,
  free: boolean,
): WwOrderBlock | null {
  return "decision_unavailable";
}

export function cancelMission(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
): WwOrderBlock | null {
  return "decision_unavailable";
}

export function stepDecisions(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {}

export function decisionBlock(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
): WwOrderBlock | null {
  return "decision_unavailable";
}

export function decisionCards(pol: WwPolitics, id: number): WwDecisionCard[] {
  return [];
}
