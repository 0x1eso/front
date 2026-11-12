// ww193: RUS's departments. Lane W-RUS owns this file and
// resources/ww1914/ko/RUS.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

export const RUS_DEPT_SCENES: readonly GwScene[] = [];

export const RUS_DEPTS: GwDeptContent = {
  tasks: [],
  leans: [],
  wants: [],
  levers: [],
};
