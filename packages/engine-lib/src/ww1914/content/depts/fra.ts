// ww193, ww196: FRA's departments. Lane W-FRA owns this file and
// resources/ww1914/ko/FRA.depts.json: the answer rows (답신) over the common
// task types and the seat's own (`chambers`), the honours and their orders,
// leans, wants, and the scenes the twelve kept.
//
// The seat is the President: the departments are the government's, headed by
// the ministers (and GQG, the 2e Bureau) he can only advise and ask. A task
// brings back its own answer, addressed to him; the old papers come only as
// the `then` of a course taken. The twelve's papers kept: the terms the Quai
// and GQG bring against an early armistice and the premier's answer (#9), and
// the three ceremonies (acts/fra.ts plays them). The Légion's list (#1, #12)
// is now an honours row, given at its occasion.
import type {
  GwGauge,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAnswerRow,
  GwCourseRow,
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwFindingRow,
  GwHonourOrder,
  GwHonourPool,
  GwHonourRow,
  GwLean,
  GwTaskRow,
  GwTaskType,
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
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

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

export const FRA_DEPT_SCENES: readonly GwScene[] = [TERMS, TIGER_LETTER];

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

// ---- Tasks (일을 맡긴다, ww196 §3) ----

/**
 * The nine common types need no rows: TaskRows GW_TASK_OFFICES gives them to
 * the Quai, GQG, the Finances, Agriculture, the Intérieur, the Marine,
 * Armement (else the Guerre), the Guerre and the 2e Bureau. The seat's own
 * type is the Conseil's: what the government will tell the chambers.
 */
const TASKS: GwTaskRow[] = [
  {
    id: "fra_task_chambers",
    nation: ["FRA"],
    office: "chancellor",
    type: "chambers",
    chapters: 1,
    cooldown: 3,
  },
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
  war: { fra_h_embusques: "back_bill" },
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

// ---- Answers (답신, ww196 §2): what a task finds and proposes ----
//
// Seat rows come before the common ones (lane C), so France's courses lead
// the answer; the common rows add what these leave out. `then` names an
// existing paper only where it reads as the next step of the course taken.

const find = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
/** The finding a weak head brings instead of a true one. */
const wrong = (id: string, truth?: GwCond): GwFindingRow => ({
  id,
  weight: 1,
  wrong: true,
  ...(truth === undefined ? {} : { truth }),
});
const course = (
  id: string,
  lean: GwLean[],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });
const answer = (
  id: string,
  type: GwTaskType,
  more: Partial<GwAnswerRow>,
  findings: GwFindingRow[],
  courses: GwCourseRow[],
): GwAnswerRow => ({
  id: `fra_ans_${id}`,
  nation: ["FRA"],
  type,
  ...more,
  findings,
  courses,
});

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const readiness = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "readiness", tag, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const neutral = (tag: GwTag): GwCond => world({ is: "neutral", tag });
const atWarWith = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const since = (from: string): GwCond => world({ is: "date", from });
const russiaBroke = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep", "soviet"],
});
const chamberSour: GwCond = { kind: "inst", inst: "chamber", max: -1 };
const chamberOk: GwCond = { kind: "inst", inst: "chamber", min: 0 };

const ANSWERS: GwAnswerRow[] = [
  // ---- The Quai: a country (envoy) ----
  answer(
    "envoy_ita",
    "envoy",
    {
      office: "foreign",
      topic: ["ITA"],
      when: neutral("ITA"),
      question: "reach",
    },
    [
      find("price", 3),
      find("barrere", 2),
      find("bidders", 2, { slots: { bidders: ["bidding"] } }),
      find("close", 2, { slots: { readiness: ["close"] } }),
      find("far", 2, { slots: { readiness: ["far"] } }),
      find("dalmatia", 1),
      wrong("cheap"),
    ],
    [
      course(
        "pay",
        ["bold", "gentle"],
        [readiness("ITA", 20), trust("RUS", -1)],
        {
          needs: [{ kind: "consent", tag: "RUS" }],
        },
      ),
      course("haggle", ["cheap", "firm"], [readiness("ITA", 10)], {
        then: ["fra_f_italy_price"],
      }),
      course("neutral", ["wait", "calm"], [trust("ITA", 1)], { wait: true }),
    ],
  ),
  answer(
    "envoy_rou",
    "envoy",
    {
      office: "foreign",
      topic: ["ROU"],
      when: neutral("ROU"),
      question: "reach",
    },
    [
      find("price", 3),
      find("waits", 3),
      find("close", 2, { slots: { readiness: ["close"] } }),
      find("shells", 2),
      find("bidders", 1, { slots: { bidders: ["bidding"] } }),
      wrong("alone"),
    ],
    [
      course(
        "pay",
        ["bold", "gentle"],
        [readiness("ROU", 20), trust("RUS", -1)],
        {
          needs: [{ kind: "consent", tag: "RUS" }],
        },
      ),
      course(
        "press_russia",
        ["firm"],
        [readiness("ROU", 10), trust("RUS", -1)],
        { then: ["fra_f_romania"] },
      ),
      course("wait", ["wait", "cheap", "calm"], [trust("ROU", 1)], {
        wait: true,
      }),
    ],
  ),
  answer(
    "envoy_grc",
    "envoy",
    { office: "foreign", topic: ["GRC"], when: neutral("GRC") },
    [find("king", 3), find("venizelos", 3), find("fleet", 1), wrong("army")],
    [
      course("venizelos", ["bold"], [readiness("GRC", 10), trust("GRC", -1)]),
      course(
        "press_king",
        ["firm"],
        [readiness("GRC", 15), trust("GRC", -2), { kind: "temp", delta: 1 }],
      ),
      course("wait", ["wait", "calm", "gentle"], [trust("GRC", 1)], {
        wait: true,
      }),
    ],
  ),
  answer(
    "envoy_rus",
    "envoy",
    { office: "foreign", topic: ["RUS"], question: "person" },
    [
      find("envoy", 3, { slots: { envoy: ["*"] } }),
      find("shells", 3, { when: war }),
      find("straits", 2, { when: all(war, atWarWith("OTT")) }),
      find("rails", 2, { when: not(war) }),
      find("court", 1, { when: months(12) }),
      wrong("berlin", not(months(6))),
    ],
    [
      course("press", ["firm", "bold"], [trust("RUS", -1)], {
        when: war,
      }),
      course("loan", ["gentle"], [trust("RUS", 1), gauge("money", -1)], {
        when: not(war),
        then: ["fra_y_ally_renew"],
      }),
      course("mission", ["calm", "gentle"], [trust("RUS", 1)], {
        when: all(war, not(russiaBroke)),
        slots: { sent: ["*"] },
        then: ["fra_f_rhine_russia"],
        thenAfter: 3,
        needs: [{ kind: "person", office: "foreign" }],
      }),
      course("trust", ["wait", "cheap"], [trust("RUS", 1)], { wait: true }),
    ],
  ),
  answer(
    "envoy_usa",
    "envoy",
    {
      office: "foreign",
      topic: ["USA"],
      when: neutral("USA"),
      question: "money",
    },
    [
      find("envoy", 3, { slots: { envoy: ["*"] } }),
      find("banks", 2, { when: war }),
      find("uboats", 2, { when: months(8) }),
      find("cables", 1),
      wrong("never", neutral("USA")),
    ],
    [
      course("loans", ["bold"], [trust("USA", 1), gauge("money", 1)], {
        when: war,
        then: ["fra_f_usa_loans"],
        thenAfter: 3,
      }),
      course("press", ["firm"], [trust("USA", -1), readiness("USA", 5)]),
      course("patience", ["wait", "calm", "cheap"], [trust("USA", 1)], {
        wait: true,
      }),
    ],
  ),
  answer(
    "envoy_gbr",
    "envoy",
    { office: "foreign", topic: ["GBR"] },
    [
      find("cambon_peace", 3, { slots: { envoy: ["*"] }, when: not(war) }),
      find("cambon_war", 3, { slots: { envoy: ["*"] }, when: war }),
      find("fleets", 2, { when: not(war) }),
      find("money", 2, { when: war }),
      find("front", 1, { when: war }),
      wrong("belgium", not(war)),
    ],
    [
      course("in_writing", ["firm"], [trust("GBR", -1)], {
        when: not(war),
        then: ["fra_y_ally_staff"],
      }),
      course("more_line", ["firm", "bold"], [trust("GBR", -1)], { when: war }),
      course("word", ["calm", "gentle", "wait"], [trust("GBR", 1)]),
    ],
  ),

  // ---- GQG: a front ----
  answer(
    "front_west",
    "front",
    { topic: ["west"], when: atDeu },
    [
      find("line", 3, { slots: { line: ["*"] } }),
      find("shells_low", 3, { slots: { shells: ["low"] } }),
      find("shells_up", 2, { slots: { shells: ["middling", "high"] } }),
      find("commander", 2, { slots: { commander: ["*"] } }),
      find("british", 1, { when: months(6) }),
      wrong("empty"),
    ],
    [
      course(
        "attack",
        ["bold", "firm"],
        [gauge("shells", -1), opinion("army", 1)],
        { front: "attack" },
      ),
      course("hold", ["wait", "calm", "cheap"], [gauge("morale", 1)], {
        front: "hold",
      }),
      course("shorten", ["gentle", "cheap"], [trust("GBR", -1)], {
        front: "shorten",
        when: months(6),
      }),
    ],
  ),
  answer(
    "front_orient",
    "front",
    { topic: ["balkan", "thrace"], question: "person" },
    [
      find("fever", 3, { when: months(10) }),
      find("athens", 2, { when: neutral("GRC") }),
      find("serbs", 2, { when: months(18) }),
      find("commander", 1, { slots: { commander: ["*"] } }),
      wrong("bulgars"),
    ],
    [
      course("reinforce", ["bold"], [opinion("army", -1)], {
        front: "attack",
        slots: { sent: ["*"] },
        needs: [{ kind: "divisions", word: "div_some" }],
      }),
      course("hold", ["wait", "calm"], [], { front: "hold" }),
      course("withdraw", ["cheap", "gentle"], [trust("SRB", -1)], {
        front: "shorten",
      }),
    ],
  ),

  // ---- The Finances ----
  answer(
    "money",
    "money",
    { office: "finance" },
    [
      find("chest_low", 3, { slots: { treasury: ["low"] } }),
      find("chest_ok", 2, { slots: { treasury: ["middling", "high"] } }),
      find("bonds", 3, { when: war }),
      find("prices", 2, { slots: { prices: ["high"] } }),
      find("tax_stuck", 2, { when: not(since("1914-07")) }),
      find("tax_unused", 2, {
        when: all(since("1914-07"), not(since("1916-01"))),
      }),
      wrong("short", world({ is: "war_months", own: true, max: 5 })),
    ],
    [
      course("rentes", ["cheap", "calm"], [gauge("money", 1)], {
        when: war,
      }),
      course(
        "tax",
        ["firm", "bold"],
        [opinion("parliament", -1), gauge("money", 1)],
        { needs: [{ kind: "bill", law: "fra_law_income_tax" }] },
      ),
      course("banque", ["gentle", "wait"], [gauge("money", 1)]),
      course("abroad", ["bold"], [gauge("money", 1), trust("GBR", -1)], {
        when: months(10),
        needs: [{ kind: "consent", tag: "GBR" }],
        then: ["fra_f_usa_loans"],
        thenAfter: 3,
      }),
    ],
  ),

  // ---- Agriculture (else the Intérieur): bread ----
  answer(
    "bread",
    "bread",
    { question: "money" },
    [
      find("bread_low", 3, { slots: { bread: ["low"] } }),
      find("bread_ok", 2, { slots: { bread: ["middling", "high"] } }),
      find("fields", 3, { when: war }),
      find("ships", 2, { when: months(6) }),
      find("queues", 2, { slots: { prices: ["high"] } }),
      wrong("hoarded"),
    ],
    [
      course(
        "cap",
        ["calm", "firm"],
        [opinion("workers", 1), gauge("bread", -1)],
      ),
      course("mixed", ["cheap", "wait"], [gauge("bread", 1)], {
        slots: { spend: ["thrift"] },
      }),
      course("buy", ["bold"], [gauge("money", -1), gauge("bread", 1)], {
        slots: { spend: ["ample"] },
        when: war,
        then: ["fra_sh_freight"],
        needs: [{ kind: "money", word: "money_much" }],
      }),
      course("cards", ["firm"], [gauge("bread", 1), opinion("workers", -1)], {
        when: months(30),
      }),
    ],
  ),

  // ---- The Intérieur: unrest ----
  answer(
    "unrest",
    "unrest",
    { office: "interior" },
    [
      find("agitators", 3, { slots: { agitators: ["*"] } }),
      find("strikes_high", 3, { slots: { strikes: ["high"] } }),
      find("strikes_low", 2, { slots: { strikes: ["low", "middling"] } }),
      find("carnet", 2, { when: all(war, not(months(6))) }),
      find("papers", 2, { when: months(18) }),
      find("barracks", 1, { when: months(30) }),
      wrong("german_money"),
    ],
    [
      course("arrest", ["firm"], [gauge("order", 1), opinion("workers", -2)]),
      course("watch", ["calm", "wait", "cheap"], [rumour(-1)]),
      course("hear", ["gentle"], [opinion("workers", 1), gauge("money", -1)]),
    ],
  ),

  // ---- The Marine ----
  answer(
    "fleet",
    "fleet",
    { office: "navy", when: war },
    [
      find("pola", 3, { when: atWarWith("AUH") }),
      find("fleet_low", 2, { slots: { fleet: ["low"] } }),
      find("uboats", 2, { when: months(12) }),
      find("coal", 2),
      wrong("sortie"),
    ],
    [
      course("otranto", ["firm", "bold"], [gauge("money", -1)], {
        when: atWarWith("AUH"),
        then: ["fra_cs_otranto"],
      }),
      course("convoys", ["calm", "gentle"], [gauge("bread", 1)]),
      course("harbour", ["wait", "cheap"], [], { wait: true }),
    ],
  ),

  // ---- Armement (else the Guerre): shells ----
  answer(
    "arms",
    "arms",
    {},
    [
      find("shells_low", 3, { slots: { shells: ["low"] } }),
      find("hands", 3, { when: war }),
      find("works", 2),
      find("women", 2, { when: months(8) }),
      wrong("bursts"),
    ],
    [
      course("industry", ["bold"], [gauge("shells", 1), gauge("money", -1)], {
        then: ["fra_lb_night"],
        thenAfter: 3,
        when: months(4),
      }),
      course(
        "skilled_back",
        ["bold", "firm"],
        [gauge("shells", 1), opinion("army", -1)],
        { when: war },
      ),
      course("arsenals", ["calm", "cheap"], [gauge("shells", 1)], {
        then: ["fra_h_women"],
        thenAfter: 3,
        when: months(6),
      }),
      course("buy", ["gentle"], [gauge("shells", 1), gauge("money", -1)], {
        when: war,
        then: ["fra_sh_freight"],
      }),
    ],
  ),

  // ---- The Guerre: men ----
  answer(
    "men",
    "men",
    { office: "war", when: war },
    [
      find("losses", 3, { when: heavy }),
      find("next_class", 2),
      find("shirkers", 2, { when: months(6) }),
      find("colonies", 2, { when: months(10) }),
      wrong("theirs_too"),
    ],
    [
      course(
        "dalbiez",
        ["firm"],
        [opinion("army", 1), opinion("workers", -1)],
        {
          needs: [{ kind: "bill", law: "fra_law_dalbiez" }],
          when: months(6),
        },
      ),
      course("early_class", ["bold"], [gauge("morale", -1)]),
      course("colonial", ["cheap", "gentle"], [], {
        when: months(10),
        then: ["fra_cs_diagne"],
      }),
      course("spare", ["wait", "calm"], [], { wait: true }),
    ],
  ),

  // ---- The 2e Bureau: a country (intel) ----
  answer(
    "intel",
    "intel",
    { office: "intelligence", question: "money" },
    [
      find("wireless", 3, { when: war }),
      find("swiss", 2, { slots: { country: ["*"] } }),
      find("court", 2, { slots: { ruler: ["*"] } }),
      find("few", 1, { slots: { country: ["*"] } }),
      wrong("collapse"),
    ],
    [
      course("more_men", ["bold"], [gauge("money", -1)], {
        slots: { spend: ["ample"] },
      }),
      course("false_word", ["firm"], [rumour(1)]),
      course("as_is", ["wait", "cheap", "calm"], [], { wait: true }),
    ],
  ),

  // ---- The Conseil: the chambers (the seat's own type) ----
  answer(
    "chambers",
    "chambers",
    { office: "chancellor" },
    [
      find("sour", 3, { when: chamberSour }),
      find("willing", 2, { when: chamberOk }),
      find("secret", 2, { when: months(18) }),
      find("control", 2, { when: months(12) }),
      find("senate", 2, {
        when: all(months(15), not(tiger), {
          kind: "person_active",
          person: "fra_clemenceau",
        }),
      }),
      wrong("summer", chamberOk),
    ],
    [
      course(
        "secret_session",
        ["gentle", "calm"],
        [inst("chamber", 1), opinion("army", -1)],
        { when: months(12), then: ["fra_m_secret_session"] },
      ),
      course("speak", ["bold"], [inst("chamber", 1), rumour(-1)]),
      course("short", ["firm", "wait"], [inst("chamber", -1)]),
    ],
  ),
];

// ---- Honours at their occasions (ww196 §4) ----

/**
 * The President is grand master of the Légion. Civil promotions come on
 * 1 January and 14 July; in the war the Guerre and GQG put up names as deeds
 * come (fallback name "전시 특별 서훈 명단": the wartime term is unchecked).
 * The Croix de guerre exists from its law of 8 April 1915 (ww196-facts).
 */
const order = (
  id: string,
  rank: 1 | 2 | 3,
  pools: GwHonourPool[],
  from?: string,
): GwHonourOrder => ({
  id: `fra_ho_${id}`,
  nation: ["FRA"],
  rank,
  pools,
  ...(from === undefined ? {} : { from }),
});

const ORDERS: GwHonourOrder[] = [
  order("legion_high", 1, ["generals", "heads"]),
  order("legion_officer", 2, ["generals", "heads", "officials", "industry"]),
  order("legion_knight", 3, ["soldier", "industry", "officials", "heads"]),
  order("medaille", 2, ["soldier", "generals"]),
  order("croix", 3, ["soldier", "generals"], "1915-04-08"),
];

const HONOURS: GwHonourRow[] = [
  {
    id: "fra_hr_new_year",
    nation: ["FRA"],
    occasion: "date",
    day: "01-01",
    pools: ["heads", "officials", "industry", "generals"],
    orders: [
      "fra_ho_legion_high",
      "fra_ho_legion_officer",
      "fra_ho_legion_knight",
    ],
    from: ["chancellor", "war"],
  },
  {
    id: "fra_hr_july",
    nation: ["FRA"],
    occasion: "date",
    day: "07-14",
    pools: ["heads", "officials", "industry", "generals"],
    orders: [
      "fra_ho_legion_high",
      "fra_ho_legion_officer",
      "fra_ho_legion_knight",
    ],
    from: ["chancellor", "war"],
  },
  {
    id: "fra_hr_victory",
    nation: ["FRA"],
    occasion: "victory",
    when: war,
    pools: ["generals", "soldier"],
    orders: ["fra_ho_legion_high", "fra_ho_medaille", "fra_ho_croix"],
    from: ["war", "chief_of_staff"],
  },
  {
    id: "fra_hr_deed",
    nation: ["FRA"],
    occasion: "deed",
    when: war,
    pools: ["soldier"],
    orders: ["fra_ho_croix", "fra_ho_medaille", "fra_ho_legion_knight"],
    from: ["chief_of_staff"],
  },
  {
    id: "fra_hr_tableau",
    nation: ["FRA"],
    occasion: "petition",
    when: war,
    pools: ["generals", "heads", "soldier"],
    orders: ["fra_ho_legion_officer", "fra_ho_medaille", "fra_ho_croix"],
    from: ["war", "chief_of_staff"],
  },
];

export const FRA_DEPTS: GwDeptContent = {
  tasks: TASKS,
  leans: LEANS,
  wants: WANTS,
  answers: ANSWERS,
  honours: HONOURS,
  orders: ORDERS,
};
