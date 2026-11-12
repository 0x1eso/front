// STUB: owner S2
// ww190 §3: ruling occupied land. The stub holds nothing and does nothing;
// S2's file replaces it at the merge.
import type {
  GwClient,
  GwRulePolicy,
  GwRuleRow,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwRuleCond = Extract<
  GwWorldCond,
  { is: "rule" | "resist" | "ruled" | "relief" }
>;
export type GwRuleEffect = Extract<GwWorldEffect, { do: "rule" }>;

export function ruleOf(
  _gw: GreatWar,
  _by: GwTag,
  _of: GwTag,
): GwRuleRow | null {
  return null;
}

export function setRule(
  _gw: GreatWar,
  _by: GwTag,
  _of: GwTag,
  _ch: {
    policy?: GwRulePolicy;
    hard?: number;
    relief?: boolean;
    client?: GwClient;
  },
): void {}

/** Resistance in land `by` rules (of `of`, or the highest), 0..3. */
export function resistOf(_gw: GreatWar, _by: GwTag, _of?: GwTag): number {
  return 0;
}

export function ruleHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwRuleCond,
): boolean {
  return false;
}

export function ruleDo(
  _gw: GreatWar,
  _seat: GwSeatState,
  _e: GwRuleEffect,
): void {}

export function ruleStep(_gw: GreatWar): void {}
