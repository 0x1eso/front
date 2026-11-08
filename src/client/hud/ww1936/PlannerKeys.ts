// ww162 (battle planner, design ww162 §2): the text keys of the army
// card's line modes, the division list and the plan view. The contract
// (lane L0) names them here; the screens (L5a, L5b) pass them to
// translateText. Every key is in en.json and ko.json under ww1936.planner.
export const PLANNER_KEYS = {
  btnClear: "ww1936.planner.btn_clear",
  btnDivisions: "ww1936.planner.btn_divisions",
  btnExecute: "ww1936.planner.btn_execute",
  btnFallBackNow: "ww1936.planner.btn_fall_back_now",
  btnFallback: "ww1936.planner.btn_fallback",
  btnFront: "ww1936.planner.btn_front",
  btnGoal: "ww1936.planner.btn_goal",
  btnHalt: "ww1936.planner.btn_halt",
  btnRelease: "ww1936.planner.btn_release",
  btnReleaseAll: "ww1936.planner.btn_release_all",
  btnSuggest: "ww1936.planner.btn_suggest",
  btnUndo: "ww1936.planner.btn_undo",
  fbAuto: "ww1936.planner.fb_auto",
  goalBroad: "ww1936.planner.goal_broad",
  goalSpear: "ww1936.planner.goal_spear",
  /** ww162 §1.1-§1.3: the line modes draw an army group's lines. */
  groupLines: "ww1936.planner.group_lines",
  hintDivisions: "ww1936.planner.hint_divisions",
  hintFallback: "ww1936.planner.hint_fallback",
  hintFront: "ww1936.planner.hint_front",
  hintGoal: "ww1936.planner.hint_goal",
  hintPan: "ww1936.planner.hint_pan",
  pinned: "ww1936.planner.pinned",
  /** Params: n. */
  pinnedCount: "ww1936.planner.pinned_count",
  planView: "ww1936.planner.plan_view",
  refuseGoalFar: "ww1936.planner.refuse_goal_far",
  /** Params: n (WW_GOAL_MAX). */
  refuseGoalFull: "ww1936.planner.refuse_goal_full",
  /** Params: region (a region name), n. */
  regionDivisions: "ww1936.planner.region_divisions",
} as const;
export type PlannerKey = (typeof PLANNER_KEYS)[keyof typeof PLANNER_KEYS];
