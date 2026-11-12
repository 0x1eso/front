// ww193: what every seat's departments share. Lane C owns this file and
// resources/ww1914/ko/common.depts.json: the fallback reports `gw_dept_<kind>`
// (a task none of whose papers holds brings one of these, its topic in the
// card's `dept.topic`), the rival pairs, and the words every seat shares
// (department names, subject words, the heads' voices by temperament).
//
// No common leans: Content.ts joins this file first and `leanRow` takes the
// first row that fits, so a common row would hide a seat's own. A department
// with no row of its seat leans by GW_DEPT_LEAN_DEFAULT (TaskRows.ts).
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import { GW_TASK_KINDS } from "@openfront/engine-api/ww1914/GwDepts";
import {
  GwEffect,
  GwScene,
  moody,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

const head = role("head");

/**
 * Taking the work up: the head whose plan, terms or draft is taken is pleased
 * (a gain, so the paper can be sent back firmer). Making a study or a report
 * known quiets the talk in the streets. Shelving it only keeps it.
 */
const TAKEN: Readonly<Record<(typeof GW_TASK_KINDS)[number], GwEffect[]>> = {
  plan: [trustOf(head, 1)],
  study: [{ kind: "rumour", delta: -1 }],
  terms: [trustOf(head, 1)],
  bill: [trustOf(head, 1)],
  report: [{ kind: "rumour", delta: -1 }],
};

/**
 * A department's own report on its task: taken up or kept in the drawer. The
 * body follows the head's temper: a cunning or arrogant head writes one road,
 * an anxious or weary one hedges; the stamp (his band) is the engine's.
 */
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
    variants: [
      { id: "sure", when: moody(head, "cunning", "arrogant") },
      { id: "unsure", when: moody(head, "anxious", "weary") },
      { id: "base" },
    ],
    options: [
      {
        id: "publish",
        tell: [],
        effects: [
          ...TAKEN[kind],
          { kind: "remember", key: "dept_report_out", weight: 0 },
        ],
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
  // Design §4.8: whose head comes with a counter-paper. Several rows may name
  // one office: each row is its own pairing, with its own tags.
  rivals: [
    // ww193 merge: rows about named papers come first; on those the heads
    // need not be at odds. DEU #3: the general staff answers the plan to
    // dissolve the Prussian house with its own paper.
    {
      office: "chancellor",
      against: ["chief_of_staff"],
      papers: ["deu_dept_landtag"],
      counter: "deu_dept_landtag_ohl",
    },
    {
      office: "interior",
      against: ["chief_of_staff"],
      papers: ["deu_dept_landtag"],
      counter: "deu_dept_landtag_ohl",
    },
    // GBR #4: the intelligence head's line on Casement (the diaries) is
    // marked beside the Home Office's.
    {
      office: "interior",
      against: ["intelligence"],
      papers: ["gbr_dept_casement"],
    },
    // The diplomats against the soldiers, both ways.
    { office: "foreign", against: ["chief_of_staff", "supreme_commander"] },
    { office: "chief_of_staff", against: ["foreign"] },
    // A supreme commander against the war ministry that supplies him, and the
    // diplomats who promise what his front must hold.
    { office: "supreme_commander", against: ["war", "foreign"] },
    // The fleet against the army's share, the purse and its own sea lords.
    { office: "navy", against: ["war", "finance", "sea_lord"] },
    // Order at home: the police and the army over strikes and the streets.
    { office: "interior", against: ["war"], tags: ["home"] },
    // Munitions against the war ministry it took the shells from.
    { office: "munitions", against: ["war"] },
    // The government against the soldiers over the war's own papers.
    { office: "chancellor", against: ["chief_of_staff"], tags: ["war"] },
    // Whatever spends, the treasury has a word on it.
    { office: "finance", cost: true },
    // Vienna and Budapest.
    { office: "hun_pm", against: ["chancellor"] },
    { office: "chancellor", against: ["hun_pm"] },
  ],
};
