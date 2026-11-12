// Great War 1914 (ww190 §4): France's own ladder, the refusals in the army,
// the President's review of the sentences, and Poincaré's private life in the
// years the other files don't reach (peace, the refusals, the home front, the
// aftermath). Owned by the W-FRA lane; conds and effects in
// /home/eser/dev/ww190-interfaces.md. Text in resources/ww1914/ko/FRA.president.json.
import type { GwRefusalAnswer } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  flag,
  memory,
  not,
  remember,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  atWar,
  cos,
  gauge,
  home,
  inst,
  low,
  men,
  opinion,
  paper,
  pm,
  ranged,
  v,
  warMin,
  warMonths,
} from "./fra_years";

// ---- Conditions ----

/** Laid only by the world's code (HomeTable, Refusals.ts), never drawn. */
const called = flag("gw_world_called_only");
const refusals = (min?: number, max?: number): GwCond =>
  ranged({ is: "refusals", tag: "FRA" }, min, max);
const answered = (...of: Exclude<GwRefusalAnswer, "none">[]): GwCond =>
  any(...of.map((answer) => ranged({ is: "refusals", tag: "FRA", answer }, 0)));
const pardons = (min?: number, max?: number): GwCond =>
  world({
    is: "refusals",
    tag: "FRA",
    pardons: {
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    },
  });
const sentenced = answered("courts", "both");
const repulsed = world({
  is: "offensive",
  theatre: ["west"],
  result: ["repulsed", "attrition"],
});
const peace = (min: number): GwCond =>
  all(world({ is: "peace_months", min }), not(atWar));
const after = (min: number): GwCond => ranged({ is: "after_months" }, min);
const m = (key: string): GwCond => memory(`m_fra_${key}`);

// ---- Effects ----

const calm = doWorld({ do: "calm" });
const answer = (a: Exclude<GwRefusalAnswer, "none">): GwEffect =>
  doWorld({ do: "refusals", answer: a });
const pardon = (many: boolean): GwEffect => doWorld({ do: "pardon", many });
const rem = (key: string): GwEffect => remember(`m_fra_pr_${key}`);
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });

// ---- 1. France's ladder (HomeTable: gw_home_fra_1..4) ----

const RUNG = {
  salience: 9,
  tags: ["home", "tension_down"],
} as Partial<GwScene>;

const RUNGS: GwScene[] = [
  paper(
    "gw_home_fra_1",
    called,
    [v("long", warMonths(30)), v("base")],
    [
      ["arbitrate", [calm, gauge("money", -1)]],
      ["wages", [calm, inst("chamber", 1), opinion("business", -1)]],
      ["firm", [inst("army", 1)]],
    ],
    { ...RUNG, cast: { home }, fallback: "arbitrate" },
  ),
  paper(
    "gw_home_fra_2",
    called,
    [v("hungry", low("bread", 1)), v("base")],
    [
      ["prices", [calm, gauge("money", -1)]],
      ["papers", [calm, censor(1), opinion("press", -1)]],
      ["firm", [inst("army", 1), gauge("morale", -1)]],
    ],
    { ...RUNG, cast: { home, pm }, fallback: "prices" },
  ),
  paper(
    "gw_home_fra_3",
    called,
    [v("refusals", refusals(1)), v("base")],
    [
      ["leave", [calm, men(-2)]],
      ["amnesty", [calm, inst("army", -1)]],
      ["firm", [inst("army", 1), gauge("morale", -1)]],
    ],
    { ...RUNG, cast: { war: warMin }, fallback: "leave" },
  ),
  paper(
    "gw_home_fra_4",
    called,
    [v("base")],
    [
      ["union", [calm, inst("chamber", 1), inst("army", -1)]],
      ["troops", [calm, opinion("workers", -2)]],
      ["firm", [inst("army", 1), gauge("order", -1)]],
    ],
    { ...RUNG, cast: { pm, home }, fallback: "union" },
  ),
];

// ---- 2. The refusals (Refusals.ts lays fra_m_refusals_1..3) ----

const STAGE = {
  salience: 9,
  once: true,
  noBack: true,
  tags: ["war", "home"],
} as Partial<GwScene>;
const ANSWERS: [string, GwEffect[]][] = [
  ["courts", [answer("courts")]],
  ["rest", [answer("rest")]],
  ["both", [answer("both")]],
];

const REFUSALS: GwScene[] = [
  paper(
    "fra_m_refusals_1",
    called,
    [v("after_attack", repulsed), v("base")],
    ANSWERS,
    { ...STAGE, cast: { war: warMin, cos }, fallback: "both" },
  ),
  paper(
    "fra_m_refusals_2",
    called,
    [v("after_attack", repulsed), v("base")],
    ANSWERS,
    { ...STAGE, cast: { war: warMin, cos }, fallback: "both" },
  ),
  paper("fra_m_refusals_3", called, [v("base")], ANSWERS, {
    ...STAGE,
    cast: { war: warMin, cos, pm },
    fallback: "both",
  }),
  paper(
    "fra_m_courts",
    answered("courts"),
    [v("deep", refusals(2)), v("base")],
    [
      ["let_run", [inst("army", 1)]],
      ["lawyers", [inst("chamber", 1), inst("army", -1)]],
      ["general_visits", [gauge("morale", 1)]],
    ],
    { ...STAGE, salience: 7, cast: { war: warMin } },
  ),
  paper(
    "fra_m_rest",
    answered("rest", "both"),
    [v("both", answered("both")), v("base")],
    [
      ["leave_trains", [gauge("morale", 1), gauge("money", -1)]],
      ["kitchens", [gauge("morale", 1), gauge("bread", -1)]],
      ["wait_americans", [inst("army", -1)]],
    ],
    { ...STAGE, salience: 7, cast: { war: warMin, cos } },
  ),
  paper(
    "fra_m_letters",
    refusals(1),
    [v("deep", refusals(2)), v("base")],
    [
      ["cabinet", [inst("countersign", 1)]],
      ["leave", [gauge("morale", 1), men(-1)]],
      ["burn", [censor(1)]],
    ],
    { ...STAGE, salience: 6, cast: { home } },
  ),
  paper(
    "fra_m_secret_session",
    all(refusals(2), world({ is: "sits", id: "chambre" })),
    [v("pardons", pardons(1)), v("base")],
    [
      ["tell_all", [inst("chamber", 1), inst("army", -1)]],
      ["tell_little", [inst("army", 1), inst("chamber", -1)]],
      ["pm_speaks", [inst("countersign", 1)]],
    ],
    {
      ...STAGE,
      salience: 8,
      cast: { pm, war: warMin },
      assumes: { sits: ["chambre"] },
    },
  ),
  paper(
    "fra_m_calm",
    all(refusals(0, 0), answered("courts", "rest", "both")),
    [v("courts", answered("courts")), v("base")],
    [
      ["flags", [gauge("morale", 1)]],
      ["officers", [inst("army", -1), gauge("order", 1)]],
      ["forget", [inst("army", 1)]],
    ],
    { ...STAGE, salience: 6, cast: { war: warMin } },
  ),
];

// ---- 3. The President's review (fra_pr_grace_*, cooldown 3) ----

const GRACE = {
  salience: 8,
  cooldown: 3,
  noBack: true,
  tags: ["war", "people"],
} as Partial<GwScene>;

const REVIEW: GwScene[] = [
  paper(
    "fra_pr_grace_first",
    all(sentenced, pardons(undefined, 0)),
    [v("deep", refusals(2)), v("base")],
    [
      ["many", [pardon(true)]],
      ["few", [pardon(false)]],
    ],
    { ...GRACE, once: true, cast: { war: warMin } },
  ),
  paper(
    "fra_pr_grace_more",
    all(sentenced, pardons(1), refusals(1)),
    [v("again", pardons(3)), v("base")],
    [
      ["many", [pardon(true)]],
      ["few", [pardon(false)]],
    ],
    { ...GRACE, max: 3, cast: { war: warMin } },
  ),
  paper(
    "fra_pr_grace_last",
    all(sentenced, pardons(1), refusals(0, 0)),
    [v("many", pardons(3)), v("base")],
    [
      ["many", [pardon(true)]],
      ["few", [pardon(false)]],
    ],
    { ...GRACE, once: true, cast: { war: warMin } },
  ),
];

// ---- 4. His own life (fra_pr_*, tag private, cooldown 4) ----

const PRIVATE = {
  salience: 3,
  cooldown: 4,
  once: true,
  noBack: true,
  tags: ["private", "tension_down"],
} as Partial<GwScene>;
const own = (
  id: string,
  when: GwCond,
  variants: ReturnType<typeof v>[],
  options: [string, GwEffect[]][],
): GwScene =>
  paper(
    id,
    when,
    variants,
    options.map(([oid, fx]) => [
      oid,
      [...fx, rem(`${id.slice("fra_pr_".length)}_${oid}`)],
    ]),
    { ...PRIVATE, fallback: options[0][0] },
  );

const LIFE: GwScene[] = [
  // In peace.
  own(
    "fra_pr_rambouillet",
    peace(3),
    [v("armed", ranged({ is: "arming", tag: "DEU" }, 2)), v("base")],
    [
      ["ambassadors", [opinion("press", 1)]],
      ["friends", []],
      ["stay", [gauge("order", 1)]],
    ],
  ),
  own(
    "fra_pr_clos_summer",
    all(peace(6), world({ is: "month", of: [7, 8] })),
    [v("august", m("clos_august")), v("base")],
    [
      ["whole_month", []],
      ["two_weeks", []],
      ["paris", [gauge("order", 1)]],
    ],
  ),
  own(
    "fra_pr_church",
    peace(2),
    [v("burned", m("hen_burned")), v("base")],
    [
      ["deny", [opinion("press", -1)]],
      ["answer", [opinion("press", 1), opinion("parliament", -1)]],
      ["ignore", []],
    ],
  ),
  own(
    "fra_pr_academy",
    peace(4),
    [v("base")],
    [
      ["speech", [opinion("press", 1)]],
      ["listen", []],
      ["skip", []],
    ],
  ),
  own(
    "fra_pr_nubecourt",
    peace(9),
    [v("base")],
    [
      ["with_her", []],
      ["alone", []],
      ["lucien", []],
    ],
  ),
  own(
    "fra_pr_quiet_years",
    // ww190 tune: peace_months counts from the last crisis, so 18 of them never
    // came. The home question climbs about a point a month in peace: at 20
    // the summer is well over a year behind (the state, not a
    // date), two quiet months on.
    all(peace(2), { kind: "pressure", topic: "home", min: 20 }),
    [v("base")],
    [
      ["write", []],
      ["travel", [opinion("press", 1)]],
      ["work", [gauge("order", 1)]],
    ],
  ),
  // In the war.
  own(
    "fra_pr_condemned",
    all(sentenced, refusals(1)),
    [v("many", pardons(1)), v("base")],
    [
      ["tell_her", []],
      ["say_nothing", []],
      ["read_again", []],
    ],
  ),
  own(
    "fra_pr_refugees",
    all(atWar, ranged({ is: "refugees" }, 1)),
    [v("meuse", m("meuse_answered")), v("base")],
    [
      ["rooms", [gauge("money", -1)]],
      ["prefect", []],
      ["visit", [gauge("morale", 1)]],
    ],
  ),
  own(
    "fra_pr_flu",
    ranged({ is: "flu" }, 1),
    [v("again", ranged({ is: "flu" }, 2)), v("base")],
    [
      ["send_home", []],
      ["doctor", []],
      ["carry_on", []],
    ],
  ),
  own(
    "fra_pr_prisoner_mother",
    all(atWar, ranged({ is: "prisoners", held: "theirs" }, 50)),
    [v("base")],
    [
      ["own_hand", []],
      ["red_cross", []],
      ["secretary", []],
    ],
  ),
  own(
    "fra_pr_workshop",
    all(atWar, ranged({ is: "women_work" }, 2)),
    [v("rooms", m("hen_rooms")), v("base")],
    [
      ["go_with", [opinion("workers", 1)]],
      ["she_goes", []],
      ["not_now", []],
    ],
  ),
  own(
    "fra_pr_alsace_visit",
    all(
      ranged({ is: "land_taken", from: "DEU", group: ["alsace_lorraine"] }, 3),
      ranged({ is: "rule", of: "DEU" }),
    ),
    [v("base")],
    [
      ["go", [gauge("morale", 1)]],
      ["send_pm", []],
      ["later", []],
    ],
  ),
  own(
    "fra_pr_table",
    all(atWar, ranged({ is: "hunger" }, 1)),
    [v("hard", ranged({ is: "hunger" }, 2)), v("base")],
    [
      ["ration", [gauge("morale", 1)]],
      ["guests", []],
      ["as_before", [opinion("press", -1)]],
    ],
  ),
  // After.
  own(
    "fra_pr_village",
    after(1),
    [v("shelled", { kind: "seen", scene: "fra_p_clos_shelled" }), v("base")],
    [
      ["give", [gauge("money", -1)]],
      ["visit", []],
      ["letter", []],
    ],
  ),
  own(
    "fra_pr_godsons",
    all(after(1), ranged({ is: "demob" }, 1)),
    [v("wrote", m("hen_wrote")), v("base")],
    [
      ["tea", []],
      ["letters", []],
      ["her_alone", []],
    ],
  ),
  own(
    "fra_pr_term",
    after(3),
    [v("base")],
    [
      ["senate", []],
      ["books", []],
      ["undecided", []],
    ],
  ),
  own(
    "fra_pr_sep_quiet",
    ranged({ is: "left_war" }, 1),
    [v("base")],
    [
      ["walk", []],
      ["diary", []],
      ["work", [gauge("order", 1)]],
    ],
  ),
];

export const FRA_PRESIDENT_SCENES: readonly GwScene[] = [
  ...RUNGS,
  ...REFUSALS,
  ...REVIEW,
  ...LIFE,
];
