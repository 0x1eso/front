// ww193: what every seat's departments share. Lane C owns this file and
// resources/ww1914/ko/common.depts.json: the fallback reports `gw_dept_<kind>`
// (a task none of whose papers holds brings one of these, its topic in the
// card's `dept.topic`), the rival pairs, and common leans.
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import { GW_TASK_KINDS } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/** A department's own report on its task: published or kept in the drawer. */
function fallback(kind: (typeof GW_TASK_KINDS)[number]): GwScene {
  return {
    id: `gw_dept_${kind}`,
    nation: [...GW_TAGS],
    kind: "proposal",
    cast: { head: { called: true } },
    author: "head",
    salience: 4,
    tags: ["home"],
    scheduledOnly: true,
    variants: [{ id: "base" }],
    options: [
      {
        id: "publish",
        tell: [],
        effects: [{ kind: "remember", key: "dept_report_out", weight: 0 }],
      },
      {
        id: "bury",
        tell: [],
        effects: [{ kind: "remember", key: "dept_report_kept", weight: 0 }],
      },
    ],
    fallback: "bury",
  };
}

export const COMMON_DEPT_SCENES: readonly GwScene[] =
  GW_TASK_KINDS.map(fallback);

export const COMMON_DEPTS: GwDeptContent = {
  // Design §4.8: who comes with a counter-paper.
  rivals: [
    { office: "foreign", against: ["chief_of_staff"] },
    { office: "chief_of_staff", against: ["foreign"] },
    { office: "navy", against: ["war", "finance"] },
    { office: "interior", against: ["war"], tags: ["home"] },
    { office: "finance", cost: true },
    { office: "hun_pm", against: ["chancellor"] },
    { office: "chancellor", against: ["hun_pm"] },
  ],
};
