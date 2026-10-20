// World War 1936 P3: war goals, justification and the declaration rules
// (spec §14.2–§14.5). STUB: lane D (Task 5) writes the bodies; the
// signatures are final.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WarGoalType } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { WwPolitics } from "./WwPolitics";

export function startJustification(
  pol: WwPolitics,
  id: number,
  target: number,
  goal: WarGoalType,
  group: string,
  tick: number,
): WwOrderBlock | null {
  return "justify_blocked";
}

export function cancelJustification(
  pol: WwPolitics,
  id: number,
): WwOrderBlock | null {
  return "justify_blocked";
}

export function stepJustifications(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {}

/** Whether the running justification is paused by its conditions now (the screens). */
export function justificationBlocked(pol: WwPolitics, id: number): boolean {
  return false;
}

export function justifyBlock(
  pol: WwPolitics,
  id: number,
  target: number,
): WwOrderBlock | null {
  return "justify_blocked";
}

/** Spec §14.5: P0 Diplomacy asks before a declaration (join = a call-to-arms / guarantee / beat join). */
export function declareWarRules(
  pol: WwPolitics,
  attacker: number,
  target: number,
  join: boolean,
): { block: DeclareWarBlock | null; noGoal: boolean } {
  return { block: null, noGoal: false };
}

export function afterWarDeclared(
  pol: WwPolitics,
  attacker: number,
  target: number,
  joined: readonly number[],
  noGoal: boolean,
  tick: number,
): void {}

export function afterWarJoined(
  pol: WwPolitics,
  actor: number,
  enemy: number,
  tick: number,
): void {}

export function afterCapitulation(
  pol: WwPolitics,
  loser: number,
  victor: number,
  tick: number,
): void {}
