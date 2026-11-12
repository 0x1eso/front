// ww193: FRA's departments. Lane W-FRA owns this file and
// resources/ww1914/ko/FRA.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
//
// The seat is the President: the departments are the government's, headed by
// the ministers (and GQG, the 2e Bureau) he can only advise and ask. What he
// commissions comes back as the papers France already has; the new ones are
// the twelve's: the Légion's list (#1, #12), the terms the Quai and GQG bring
// against an early armistice and the premier's answer (#9), and the three
// ceremonies (acts/fra.ts plays them).
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwLean,
  GwTaskRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import type {
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["FRA"];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

const war = world({ is: "war" });
const atDeu: GwCond = { kind: "at_war", tag: "DEU" };
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const tiger = flag("f_pm_clemenceau");
const usaIn = world({ is: "entered", tag: "USA", side: "entente" });
const heavy = world({ is: "casualties", min: 400 });
const lowDeu: GwCond = {
  kind: "nation_gauge",
  tag: "DEU",
  gauge: "morale",
  max: 2,
};

const trustOf = (r: string, delta: number): GwEffect => ({
  kind: "person_trust",
  who: role(r),
  delta,
});
const opinion = (
  bloc: "army" | "parliament" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const inst = (
  i: "chamber" | "senate" | "countersign" | "army",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const pride = (r: string, delta: number): GwEffect => ({
  kind: "pride",
  who: role(r),
  delta,
});

// ---- The twelve's new papers ----

/**
 * #1, #12: the Légion's list. The President is the order's grand master; the
 * army's names come up from the War ministry. An initiative of the ministry in
 * a long war, or what it brings when asked.
 */
const HONOURS: GwScene = {
  id: "fra_dept_honours",
  nation: NATION,
  kind: "proposal",
  when: all(war, months(4)),
  cast: { war: { office: "war" } },
  author: "war",
  salience: 4,
  tags: ["war"],
  cooldown: 8,
  max: 3,
  variants: [v("heavy", heavy), v("base")],
  fallback: "as_drawn",
  options: [
    o("as_drawn", [opinion("army", 1), trustOf("war", 1)]),
    o("add_home", [opinion("workers", 1), opinion("press", 1)]),
    o("hold_for_victory", [opinion("army", -1), trustOf("war", -1)]),
  ],
};

/**
 * #9: the terms against an early armistice. The Quai and GQG bring them; the
 * premier's line is the other side of the same paper (a dispute). The harder
 * terms write `k_foc_rhine`, which opens the big scene's harder terms; with
 * Clemenceau at the Conseil he answers by letter, offering to go.
 */
const TERMS: GwScene = {
  id: "fra_dept_armistice_terms",
  nation: NATION,
  kind: "dispute",
  stage: ["war"],
  when: all(atDeu, any(lowDeu, months(48)), not(seen("fra_big_armistice"))),
  cast: {
    fm: { office: "foreign" },
    pm: { office: "chancellor" },
    cos: { office: "chief_of_staff" },
  },
  author: "fm",
  salience: 7,
  tags: ["foreign", "war"],
  once: true,
  variants: [v("tiger", tiger), v("base")],
  fallback: "council",
  options: [
    o("harder", [
      { kind: "remember", key: "k_foc_rhine" },
      trustOf("fm", 1),
      trustOf("cos", 1),
      trustOf("pm", -1),
      trust("USA", -1),
      {
        kind: "maybe",
        when: tiger,
        then: [
          { kind: "schedule", scene: "fra_dept_tiger_letter", chapters: 1 },
        ],
      },
    ]),
    o("pm_line", [
      trustOf("pm", 1),
      trustOf("fm", -1),
      inst("countersign", 1),
      trust("USA", 1),
    ]),
    o("council", [inst("countersign", 1), trustOf("cos", -1)]),
  ],
};

/** #9: the premier's letter. He offers to go; the choice is the President's. */
const TIGER_LETTER: GwScene = {
  id: "fra_dept_tiger_letter",
  nation: NATION,
  kind: "crisis",
  scheduledOnly: true,
  noBack: true,
  when: all(tiger, not(seen("fra_big_armistice"))),
  cast: { pm: { office: "chancellor" } },
  who: "pm",
  salience: 8,
  tags: ["home", "tension_up"],
  once: true,
  variants: [v("base")],
  fallback: "give_way",
  options: [
    o("give_way", [
      { kind: "forget", key: "k_foc_rhine" },
      trustOf("pm", 1),
      inst("countersign", 1),
    ]),
    o("hold_quietly", [
      trustOf("pm", -1),
      pride("pm", 1),
      { kind: "rumour", delta: 1 },
    ]),
    o("take_resignation", [
      { kind: "dismiss", who: role("pm") },
      inst("chamber", -1),
      opinion("parliament", -1),
    ]),
  ],
};

export const FRA_DEPT_SCENES: readonly GwScene[] = [
  HONOURS,
  TERMS,
  TIGER_LETTER,
];

// ---- The ceremonies (acts/fra.ts plays them; text in FRA.depts.json) ----

const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const ceremony = (
  id: string,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  cast: {},
  salience: 6,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  noBack: true,
  stamp: "confirmed",
  source: "own_eyes",
  ...more,
});
/** Held in Paris: the schedule offers it only while Paris is ours. */
const inParis: Partial<GwScene> = { assumes: { held: { paris: "us" } } };

/** Played from the schedule: acts/fra.ts adds them to FRA_ACT_SCENES. */
export const FRA_CEREMONY_SCENES: readonly GwScene[] = [
  ceremony("fra_a_c_investiture_r", [
    v("front", picked("where", "front")),
    v("city", picked("where", "city")),
    v("base"),
  ]),
  ceremony(
    "fra_a_c_review_r",
    [
      v("allies_usa", all(picked("who", "allies"), usaIn)),
      v("allies", picked("who", "allies")),
      v("base"),
    ],
    inParis,
  ),
  ceremony("fra_a_c_invalides_r", [v("heavy", heavy), v("base")], inParis),
];

// ---- Commissions (일을 맡긴다) ----

const task = (
  id: string,
  office: GwOffice,
  kind: GwTaskRow["kind"],
  topic: string,
  chapters: 1 | 2 | 3,
  products: string[],
  when?: GwCond,
  more: Partial<GwTaskRow> = {},
): GwTaskRow => ({
  id: `fra_task_${id}`,
  nation: ["FRA"],
  office,
  kind,
  topic,
  chapters,
  products,
  ...(when === undefined ? {} : { when }),
  ...more,
});

const TASKS: GwTaskRow[] = [
  // Présidence du Conseil
  task(
    "chambers",
    "chancellor",
    "plan",
    "chambers",
    1,
    [
      "fra_c_chamber_december",
      "fra_h_secret_committee",
      "fra_m_secret_session",
    ],
    war,
  ),
  task(
    "war_aims",
    "chancellor",
    "terms",
    "war_aims",
    2,
    ["fra_aim_p_peace", "fra_f_rhine_aim"],
    war,
  ),
  task(
    "colonial",
    "chancellor",
    "plan",
    "colonial",
    2,
    ["fra_cs_diagne", "fra_cs_indochina", "fra_h_colonial_workers"],
    all(war, months(6)),
  ),
  task(
    "home_work",
    "chancellor",
    "study",
    "home_work",
    1,
    ["fra_hf_women_fields", "fra_hf_munitions"],
    war,
  ),
  // Quai d'Orsay
  task("italy", "foreign", "terms", "ITA", 2, [
    "fra_f_italy_price",
    "fra_y_italy",
    "fra_wv_join_ita",
  ]),
  task(
    "romania",
    "foreign",
    "terms",
    "ROU",
    2,
    ["fra_f_romania", "fra_wv_join_rou"],
    war,
  ),
  task(
    "greece",
    "foreign",
    "plan",
    "GRC",
    2,
    ["fra_f_greece", "fra_wv_join_grc"],
    war,
  ),
  task("russia", "foreign", "terms", "RUS", 2, [
    "fra_y_ally_renew",
    "fra_y_ally_crack",
    "fra_y_ally_staff",
    "fra_f_straits_deal",
    "fra_f_rhine_russia",
    "fra_f_russia_revolution",
  ]),
  task(
    "levant",
    "foreign",
    "plan",
    "levant",
    2,
    ["fra_f_sykes_picot", "fra_aim_p_levant", "fra_wv_war_ott"],
    war,
  ),
  task(
    "america",
    "foreign",
    "terms",
    "USA",
    2,
    ["fra_aim_p_guarantee", "fra_f_wilson_points", "fra_wv_join_usa"],
    war,
  ),
  task(
    "prisoners",
    "foreign",
    "report",
    "prisoners",
    1,
    [
      "fra_hf_swiss",
      "fra_oc_relief",
      "fra_oc_relief_north",
      "fra_oc_hostages",
      "fra_hf_reprisal",
    ],
    all(war, months(4)),
  ),
  task(
    "armistice",
    "foreign",
    "terms",
    "armistice",
    1,
    ["fra_dept_armistice_terms"],
    all(atDeu, months(36)),
    { once: true },
  ),
  // GQG
  task(
    "offensive",
    "chief_of_staff",
    "plan",
    "west",
    2,
    ["fra_wv_front_west", "fra_w_plan_1915", "fra_w_champagne", "fra_w_somme"],
    atDeu,
  ),
  task(
    "allied_armies",
    "chief_of_staff",
    "plan",
    "allied_armies",
    2,
    ["fra_f_bef", "fra_w_americans"],
    war,
  ),
  task(
    "morale",
    "chief_of_staff",
    "study",
    "morale",
    1,
    [
      "fra_w_noria",
      "fra_m_rest",
      "fra_m_refusals_1",
      "fra_m_refusals_2",
      "fra_m_refusals_3",
      "fra_m_calm",
    ],
    all(war, months(6)),
  ),
  task(
    "armistice_gqg",
    "chief_of_staff",
    "terms",
    "armistice",
    1,
    ["fra_dept_armistice_terms"],
    all(atDeu, months(36)),
    { once: true },
  ),
  // Guerre. The inquiry (fra_a_o_inquiry) comes back as the forts study.
  task("forts", "war", "study", "forts", 1, ["fra_a_o_inquiry_r"], undefined, {
    cooldown: 6,
  }),
  task(
    "shells",
    "war",
    "study",
    "shells",
    1,
    ["fra_c_shells", "fra_h_first_winter", "fra_ld_theirs_mines"],
    war,
  ),
  task(
    "manpower",
    "war",
    "bill",
    "manpower",
    2,
    ["gw_law_fra_law_dalbiez", "fra_h_embusques", "gw_lf_fra_law_dalbiez"],
    war,
  ),
  task(
    "soldiers",
    "war",
    "study",
    "soldiers",
    1,
    ["fra_h_army_post", "fra_hf_wounded", "fra_h_letters_front"],
    war,
  ),
  task(
    "salonika",
    "war",
    "plan",
    "balkan",
    2,
    ["fra_w_salonika", "fra_wv_front_balkan", "fra_w_sarrail_case"],
    war,
  ),
  task(
    "honours",
    "war",
    "report",
    "honours",
    1,
    ["fra_dept_honours"],
    all(war, months(4)),
    { cooldown: 6 },
  ),
  task(
    "pardons",
    "war",
    "report",
    "pardons",
    1,
    [
      "fra_pr_grace_first",
      "fra_pr_grace_more",
      "fra_pr_grace_last",
      "fra_m_courts",
    ],
    all(war, months(5)),
  ),
  // Marine
  task(
    "sea",
    "navy",
    "plan",
    "sea",
    2,
    [
      "fra_wv_war_auh",
      "fra_cs_otranto",
      "fra_cs_med_fleet",
      "fra_cs_corfu",
      "fra_w_dardanelles",
      "fra_cs_straits_ships",
    ],
    war,
  ),
  task("navy_law", "navy", "bill", "navy_law", 2, [
    "gw_law_fra_law_navy",
    "fra_y_arms_bill",
  ]),
  // Intérieur
  task("strikes", "interior", "report", "strikes", 1, [
    "fra_y_home_strike",
    "gw_home_fra_1",
    "fra_lb_homework",
    "fra_lb_loire",
    "fra_h_strikes",
  ]),
  task(
    "refugees",
    "interior",
    "plan",
    "refugees",
    1,
    ["fra_h_refugees", "fra_hf_refugees", "fra_ld_theirs_north"],
    war,
  ),
  task(
    "press",
    "interior",
    "bill",
    "press",
    1,
    ["gw_law_fra_law_censorship", "fra_m_letters", "fra_h_bonnet_rouge"],
    war,
  ),
  task(
    "alsace",
    "interior",
    "plan",
    "alsace",
    2,
    ["fra_h_thann", "fra_ld_ours_alsace", "fra_ld_ours_school"],
    war,
  ),
  // Finances
  task("loans", "finance", "terms", "loans", 2, [
    "fra_y_ally_renew",
    "fra_f_usa_loans",
    "fra_ld_out_rus",
  ]),
  task("tax", "finance", "bill", "tax", 2, [
    "gw_law_fra_law_income_tax",
    "gw_law_fra_law_war_profits",
    "fra_y_arms_price",
  ]),
  task(
    "freight",
    "finance",
    "study",
    "freight",
    1,
    ["fra_sh_freight", "fra_sh_coal"],
    war,
  ),
  // Agriculture
  task(
    "bread",
    "agriculture",
    "study",
    "bread",
    1,
    [
      "fra_hf_bread",
      "fra_h_bread",
      "gw_law_fra_law_supply_decrees",
      "fra_h_rations",
      "fra_sh_fats",
    ],
    war,
  ),
  // 2e Bureau
  task("agents", "intelligence", "report", "agents", 1, [
    "fra_spy_codes",
    "fra_spy_rome",
    "fra_spy_exposed",
  ]),
  // Armement (once Thomas holds it)
  task("factories", "munitions", "study", "factories", 1, [
    "fra_h_women",
    "fra_lb_night",
    "fra_lb_loire",
  ]),
];

// ---- Leans (외무부 안) ----

const PICKS: Partial<Record<GwOffice, Record<string, string>>> = {
  chancellor: {
    fra_h_secret_committee: "pm_speaks",
    fra_dept_armistice_terms: "pm_line",
  },
  foreign: {
    fra_f_italy_price: "pay",
    fra_f_romania: "pay",
    fra_f_sykes_picot: "sign",
    fra_dept_armistice_terms: "harder",
  },
  chief_of_staff: {
    fra_w_salonika: "no_orient",
    fra_w_americans: "ask_amalgam",
    fra_w_deputies_front: "back_joffre",
    fra_dept_armistice_terms: "harder",
  },
  war: { fra_h_embusques: "back_bill", fra_dept_honours: "as_drawn" },
  interior: {
    fra_c_carnet_b: "not_apply",
    fra_h_strikes: "arbitration",
    fra_h_bonnet_rouge: "let_it_be",
  },
  finance: { fra_f_usa_loans: "morgan" },
  munitions: { fra_h_women: "equal_rate" },
};

const lean = (
  office: GwOffice,
  l: GwLean,
  camp?: GwDeptLean["camp"],
  picks: Record<string, string> = PICKS[office] ?? {},
): GwDeptLean => ({
  nation: ["FRA"],
  office,
  ...(camp === undefined ? {} : { camp }),
  lean: l,
  ...(Object.keys(picks).length === 0 ? {} : { picks }),
});

const LEANS: GwDeptLean[] = [
  // A hard man at the Conseil (Clemenceau) or the Quai (Delcassé) is firm.
  lean("chancellor", "firm", "hard"),
  lean("chancellor", "calm"),
  lean("foreign", "firm", "hard"),
  lean("foreign", "gentle"),
  // A cautious GQG (Pétain's) waits for the tanks and the Americans.
  lean("chief_of_staff", "wait", "moderate", {
    ...PICKS.chief_of_staff,
    fra_m_refusals_1: "both",
  }),
  lean("chief_of_staff", "firm", undefined, {
    ...PICKS.chief_of_staff,
    fra_m_refusals_1: "courts",
  }),
  lean("war", "firm"),
  lean("navy", "bold"),
  lean("interior", "firm", "hard", {
    fra_c_carnet_b: "apply_all",
    fra_h_strikes: "firm",
    fra_h_bonnet_rouge: "close_paper",
  }),
  lean("interior", "calm"),
  lean("finance", "cheap"),
  lean("agriculture", "cheap"),
  lean("intelligence", "firm"),
  lean("munitions", "bold"),
];

// ---- Wants (…가 바라는 것) ----

const want = (
  id: string,
  who: { office: GwOffice } | { person: string },
  when?: GwCond,
  cover?: string,
): GwDeptWant => ({
  id: `fra_want_${id}`,
  nation: ["FRA"],
  ...who,
  ...(when === undefined ? {} : { when }),
  ...(cover === undefined ? {} : { cover: `fra_want_${cover}` }),
});

const WANTS: GwDeptWant[] = [
  want(
    "quai_italy",
    { office: "foreign" },
    all(war, world({ is: "neutral", tag: "ITA" })),
  ),
  want("quai_alliance", { office: "foreign" }),
  want("gqg_alone", { office: "chief_of_staff" }, war),
  want("gqg_law", { office: "chief_of_staff" }),
  want("war_men", { office: "war" }, war),
  want("war_guns", { office: "war" }),
  want("navy_sea", { office: "navy" }),
  want("interior_left", { office: "interior" }, war, "interior_order"),
  want("interior_order", { office: "interior" }),
  want("finance_loans", { office: "finance" }, war),
  want("finance_budget", { office: "finance" }),
  want("pm_chambers", { office: "chancellor" }),
  want("farm_price", { office: "agriculture" }),
  want("intel_men", { office: "intelligence" }),
  want("munitions_men", { office: "munitions" }),
  want("tiger_free", { person: "fra_clemenceau" }, tiger),
  want("tiger_power", { person: "fra_clemenceau" }, war),
  want("caillaux_peace", { person: "fra_caillaux" }, war, "caillaux_tax"),
  want("caillaux_tax", { person: "fra_caillaux" }),
  want("foch_unity", { person: "fra_foch" }, war),
];

// ---- Gifts: the President's own ----

const LEVERS: GwDeptContent["levers"] = [
  {
    id: "fra_lv_legion",
    nation: ["FRA"],
    lever: "honour",
    people: "own",
    effects: [pride("who", 1)],
  },
  {
    id: "fra_lv_military_medal",
    nation: ["FRA"],
    lever: "honour",
    people: "own",
    when: all(war, months(3)),
    effects: [pride("who", 1), opinion("army", 1)],
  },
  {
    id: "fra_lv_mission",
    nation: ["FRA"],
    lever: "post",
    people: "own",
    when: war,
    effects: [pride("who", 1)],
  },
  {
    id: "fra_lv_grace",
    nation: ["FRA"],
    lever: "pardon",
    people: "own",
    when: all(war, months(5)),
    effects: [inst("army", -1), opinion("workers", 1)],
  },
];

export const FRA_DEPTS: GwDeptContent = {
  tasks: TASKS,
  leans: LEANS,
  wants: WANTS,
  levers: LEVERS,
};
