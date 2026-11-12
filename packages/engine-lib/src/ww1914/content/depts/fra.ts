// ww193: FRA's departments. Lane W-FRA owns this file and
// resources/ww1914/ko/FRA.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

export const FRA_DEPT_SCENES: readonly GwScene[] = [];

export const FRA_DEPTS: GwDeptContent = {
  tasks: [],
  leans: [],
  wants: [],
  levers: [],
};
