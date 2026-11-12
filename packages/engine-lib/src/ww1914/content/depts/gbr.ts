// ww193: GBR's departments. Lane W-GBR owns this file and
// resources/ww1914/ko/GBR.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

export const GBR_DEPT_SCENES: readonly GwScene[] = [];

export const GBR_DEPTS: GwDeptContent = {
  tasks: [],
  leans: [],
  wants: [],
  levers: [],
};
