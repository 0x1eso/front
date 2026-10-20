// World War 1936 P3: what the politics drawer, the focus drawer, the event
// cards and the bands compute from the politics view (spec §21). STUB: lane
// U2 (Task 8) writes the bodies and widens the return types; no other lane
// calls this file.
import type { WwEventCard } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPoliticsView } from "../../view/WwPoliticsView";
import type { WwGame } from "./WorldWarModel";

export interface PoliticsModelInput {
  game: WwGame;
  view: WwPoliticsView;
  /** My smallID. */
  me: number;
}

export function bandStats(i: PoliticsModelInput): unknown {
  return null;
}

export function governmentTab(i: PoliticsModelInput): unknown {
  return null;
}

export function advisorTab(i: PoliticsModelInput): unknown {
  return null;
}

export function lawTab(i: PoliticsModelInput): unknown {
  return null;
}

export function spiritTab(i: PoliticsModelInput): unknown[] {
  return [];
}

export function decisionTab(i: PoliticsModelInput): unknown[] {
  return [];
}

export function factionTab(i: PoliticsModelInput): unknown {
  return null;
}

export function warGoalTab(i: PoliticsModelInput): unknown {
  return null;
}

export function treatyTab(i: PoliticsModelInput): unknown {
  return null;
}

export function worldTab(i: PoliticsModelInput): unknown {
  return null;
}

export function playerActions(i: PoliticsModelInput, other: number): unknown[] {
  return [];
}

export function eventCardModel(
  i: PoliticsModelInput,
  card: WwEventCard,
): unknown {
  return null;
}
