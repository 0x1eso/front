// ww193: AUH's departments. Lane W-AUH owns this file and
// resources/ww1914/ko/AUH.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and the new papers the design asks for: the honours
// list and the Maria Theresa investiture (#1), the privy purse (#10), Karl's
// last orders (#6: the fleet to Zagreb, the Hungarian regiments home; the
// renunciation is the dissolution ending's own coda, auh_e_dissolution) and
// the welfare ministries with Budapest's counter-paper (#7), plus the
// ceremonies the schedule plays (acts/auh.ts).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwLeverRow,
  GwTaskRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  all,
  any,
  type GwCond,
  type GwEffect,
  type GwOption,
  type GwScene,
  type GwVariant,
  holder,
  not,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  atWar,
  ffThrone,
  gauge,
  hungaryAt,
  inst,
  inWar,
  italyIn,
  karl,
  opinion,
  peace,
  trust,
} from "../scenes/auh_act";

const NATION: GwScene["nation"] = ["AUH"];
const AUH: GwTag[] = ["AUH"];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});
const ruler = (
  side: "conscience" | "reputation" | "family",
  delta: number,
  key: string,
): GwEffect => ({ kind: "ruler", side, delta, key });
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });
const won = (theatre: "east" | "balkan" | "italy"): GwCond =>
  world({ is: "battle", theatre, of: ["advance", "break"], by: "seat" });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const holds = (office: "hun_pm", person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const memory = (key: string, within?: number): GwCond =>
  within === undefined
    ? { kind: "memory", key }
    : { kind: "memory", key, within };
/** The crown is Karl's (or the heir's who lived). */
const newReign = any(karl, ffThrone);
/** The last weeks: the manifesto out, or the streets and the score gone. */
const theEnd = all(
  karl,
  inWar,
  any(
    seen("auh_k_manifesto"),
    world({ is: "unrest", min: 3 }),
    world({ is: "score", max: -25 }),
  ),
);

/** Vienna's welfare bill is in reach: a new reign, or a long war. */
const welfareDue = all(inWar, any(newReign, months(30)));

// ---- The new papers (design §5) ----

/** A department's paper with options: the head who writes it is `author`. */
const paper = (
  id: string,
  kind: "proposal" | "dispute",
  cast: GwScene["cast"],
  author: string,
  variants: GwVariant[],
  options: GwOption[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind,
  cast,
  author,
  salience: 6,
  tags: ["home"],
  variants,
  fallback: options[options.length - 1].id,
  options,
  ...more,
});

/** What the schedule's ceremonies play: seen with the ruler's own eyes. */
const rite = (
  id: string,
  cast: GwScene["cast"],
  variants: GwVariant[],
): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  cast,
  salience: 6,
  tags: ["people"],
  variants,
  scheduledOnly: true,
  // Played by an act, as Content.ts marks acts/<seat>'s own scenes.
  byAct: true,
  stamp: "confirmed",
  source: "own_eyes",
});

/** Names chosen for the Order: the investiture is open (acts/auh.ts). */
export const AUH_HONOURS_KEY = "auh_d_honours_list";

export const AUH_DEPT_SCENES: readonly GwScene[] = [
  // #1: the military chancellery brings the list now and then in the war
  // (its words follow the last victory), or when asked. Choosing names opens
  // the investiture.
  paper(
    "auh_d_honours",
    "proposal",
    { court: holder("court"), cos: holder("chief_of_staff") },
    "court",
    [
      v("east", won("east")),
      v("south", any(won("balkan"), won("italy"))),
      v("quiet"),
    ],
    [
      opt("front_first", [
        remember(AUH_HONOURS_KEY),
        opinion("army", 1),
        trustOf(role("court"), 1),
      ]),
      opt("staff_too", [
        remember(AUH_HONOURS_KEY),
        remember("auh_d_honours_staff"),
        trustOf(role("cos"), 1),
        opinion("press", -1),
      ]),
      opt("small_list", [remember("auh_d_honours_small")]),
    ],
    { when: all(inWar, months(3)), cooldown: 10, tags: ["people", "war"] },
  ),
  // #10: the purse's requests, brought by the military chancellery.
  paper(
    "auh_d_purse",
    "proposal",
    { court: holder("court") },
    "court",
    [v("hungry", { kind: "gauge", gauge: "bread", max: 1 }), v("base")],
    [
      opt("red_cross", [
        ruler("conscience", 1, "auh_d_purse_cross"),
        opinion("court", 1),
      ]),
      opt("widows", [ruler("reputation", 1, "auh_d_purse_widows")]),
      opt("war_loan", [
        gauge("money", 1),
        ruler("family", -1, "auh_d_purse_loan"),
      ]),
      opt("keep", []),
    ],
    {
      when: all(inWar, months(4)),
      cooldown: 10,
      tags: ["people"],
    },
  ),
  // #6: the navy brings the handover plan in the last weeks (30-31 Oct
  // 1918: the fleet went to the Zagreb National Council at Pola).
  paper(
    "auh_d_last_fleet",
    "proposal",
    { navy: holder("navy"), war: holder("war") },
    "navy",
    [v("manifesto", seen("auh_k_manifesto")), v("base")],
    [
      opt("to_zagreb", [
        setFlag("f_auh_fleet_zagreb"),
        trust("ITA", -1),
        inst("nations", 1),
        remember("auh_d_fleet_given"),
      ]),
      opt("keep_for_terms", [remember("auh_d_fleet_kept")]),
    ],
    { when: theEnd, once: true, salience: 8, tags: ["war", "foreign"] },
  ),
  // #6: the war ministry brings the Hungarian regiments' going home.
  paper(
    "auh_d_last_regiments",
    "proposal",
    { war: holder("war"), hun: holder("hun_pm") },
    "war",
    [v("karolyi", holds("hun_pm", "auh_karolyi")), v("base")],
    [
      opt("let_them_go", [
        inst("hungary", 1),
        inst("army", -1),
        remember("auh_d_regiments_home"),
      ]),
      opt("hold_them", [inst("hungary", -1), remember("auh_d_regiments_held")]),
    ],
    {
      when: all(
        theEnd,
        any(hungaryAt({ max: -2 }), holds("hun_pm", "auh_karolyi")),
      ),
      once: true,
      salience: 8,
      tags: ["war", "home"],
    },
  ),
  // #7: the Austrian PM's bill: a ministry of social welfare, and one of
  // public health (Vienna, 1917-1918). Budapest answers.
  paper(
    "auh_d_welfare",
    "proposal",
    { chancellor: holder("chancellor") },
    "chancellor",
    [v("hungry", { kind: "gauge", gauge: "bread", max: 0 }), v("base")],
    [
      opt("two_ministries", [
        setFlag("f_auh_welfare"),
        setFlag("f_auh_health"),
        gauge("order", 1),
        gauge("money", -1),
        schedule("auh_d_welfare_pest", 1),
      ]),
      opt("welfare_only", [
        setFlag("f_auh_welfare"),
        gauge("order", 1),
        schedule("auh_d_welfare_pest", 1),
      ]),
      opt("not_now", [remember("auh_d_welfare_later")]),
    ],
    // Asked for, or brought by the office itself late in the war.
    { when: welfareDue, once: true, salience: 5 },
  ),
  // #7: Budapest's counter-paper: the Hungarian half will not follow.
  paper(
    "auh_d_welfare_pest",
    "dispute",
    { chancellor: holder("chancellor"), hun: holder("hun_pm") },
    "hun",
    [v("tisza", holds("hun_pm", "auh_tisza")), v("base")],
    [
      opt("press_budapest", [inst("hungary", -1), opinion("workers", 1)]),
      opt("vienna_alone", [remember("auh_d_welfare_alone")]),
    ],
    { scheduledOnly: true, once: true },
  ),
  // The ceremonies (acts/auh.ts, kind "ceremony").
  rite("auh_d_c_investiture", { court: holder("court") }, [
    v("staff", memory("auh_d_honours_staff", 8)),
    v("base"),
  ]),
  rite("auh_d_c_funeral", { court: holder("court") }, [
    v("war", inWar),
    v("base"),
  ]),
  rite("auh_d_c_review", { war: holder("war") }, [
    v("italy", italyIn),
    v("base"),
  ]),
  rite("auh_d_c_service", {}, [
    v("many", world({ is: "casualties", min: 500 })),
    v("base"),
  ]),
];

// ---- Task rows: existing papers first, in order (design §4.2) ----

const task = (
  id: string,
  office: GwTaskRow["office"],
  kind: GwTaskRow["kind"],
  chapters: number,
  products: string[],
  more: Partial<GwTaskRow> = {},
): GwTaskRow => ({
  id,
  nation: AUH,
  office,
  kind,
  chapters,
  products,
  ...more,
});

const TASKS: GwTaskRow[] = [
  // 외무부 (Ballhausplatz)
  task(
    "auh_task_romania",
    "foreign",
    "terms",
    2,
    ["auh_h_romania_offer", "auh_y_inc_romania", "auh_ld_table_sits_rou"],
    { topic: "ROU", when: not(atWar("ROU")) },
  ),
  task(
    "auh_task_italy",
    "foreign",
    "terms",
    2,
    [
      "auh_c_italy_art7",
      "auh_y_adriatic_accord",
      "auh_y_ally_renew",
      "auh_y_ally_crack",
      "auh_ld_table_sits_ita",
    ],
    { topic: "ITA" },
  ),
  task(
    "auh_task_berlin",
    "foreign",
    "plan",
    2,
    ["auh_h_mitteleuropa", "auh_nt_berlin", "auh_ld_occ_berlin_asks"],
    { topic: "mitteleuropa" },
  ),
  task(
    "auh_task_serbia",
    "foreign",
    "plan",
    2,
    [
      "auh_h_serbia_rule",
      "auh_ld_table_sits_srb",
      "auh_ld_out_srb",
      "auh_c_failed_plot",
    ],
    { topic: "SRB" },
  ),
  task(
    "auh_task_poland",
    "foreign",
    "plan",
    2,
    ["auh_nt_poland", "auh_oc_poland", "auh_oc_ukraine"],
    { topic: "poland" },
  ),
  task(
    "auh_task_peace",
    "foreign",
    "terms",
    3,
    ["auh_m_peace", "auh_nt_mediate", "auh_nt_entente", "auh_sep_home"],
    { topic: "sep_peace", when: inWar },
  ),
  task(
    "auh_task_balkans",
    "foreign",
    "plan",
    1,
    ["auh_y_balkan_accord", "auh_c_albania", "auh_y_inc_albania"],
    { topic: "albania" },
  ),
  // The order act retired into a commission (design §4.2): the inquiry.
  task("auh_task_inquiry", "foreign", "report", 1, ["auh_a_o_inquiry_r"], {
    topic: "sarajevo",
    when: {
      kind: "opening",
      of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
    },
    once: true,
  }),
  // 오스트리아 총리실
  task(
    "auh_task_bread",
    "chancellor",
    "study",
    2,
    ["auh_h_bread_cards", "auh_hf_hunger", "auh_m_bread"],
    { topic: "food", when: inWar },
  ),
  task(
    "auh_task_strikes",
    "chancellor",
    "report",
    1,
    ["auh_h_strike_1", "auh_lb_strike", "auh_lb_union"],
    { topic: "strikes", when: inWar },
  ),
  task(
    "auh_task_bohemia",
    "chancellor",
    "plan",
    2,
    [
      "auh_h_bohemia_rule",
      "auh_y_home_bohemia",
      "auh_c_q_bohemia",
      "auh_k_may_decl",
    ],
    { topic: "bohemia" },
  ),
  task(
    "auh_task_reichsrat",
    "chancellor",
    "plan",
    2,
    ["auh_h_reichsrat_call", "auh_k_amnesty", "auh_h_kramar_verdict"],
    { topic: "reichsrat" },
  ),
  task(
    "auh_task_refugees",
    "chancellor",
    "study",
    1,
    [
      "auh_hf_refugees",
      "auh_hf_women_1",
      "auh_hf_pows_theirs",
      "auh_oc_ruled_exiles",
    ],
    { topic: "refugees", when: inWar },
  ),
  task(
    "auh_task_galicia",
    "chancellor",
    "plan",
    2,
    ["auh_y_inc_galicia", "auh_oc_ruled_galicia"],
    { topic: "galicia" },
  ),
  // #7
  task("auh_task_welfare", "chancellor", "bill", 2, ["auh_d_welfare"], {
    topic: "welfare",
    when: welfareDue,
    once: true,
  }),
  // 헝가리 총리실
  task(
    "auh_task_grain",
    "hun_pm",
    "terms",
    2,
    ["auh_h_grain_border", "auh_h_food_committee", "auh_nt_profits"],
    { topic: "food" },
  ),
  task(
    "auh_task_transylvania",
    "hun_pm",
    "plan",
    2,
    ["auh_h_transylvania", "auh_y_inc_romania"],
    { topic: "transylvania" },
  ),
  task(
    "auh_task_pows",
    "hun_pm",
    "study",
    1,
    ["auh_hf_pows_ours", "auh_y_arms_price"],
    { topic: "pows" },
  ),
  // 참모본부
  task(
    "auh_task_east",
    "chief_of_staff",
    "plan",
    2,
    ["auh_w_galicia_plan", "auh_w_przemysl", "auh_w_carpathian"],
    { topic: "east", when: atWar("RUS") },
  ),
  task(
    "auh_task_south",
    "chief_of_staff",
    "plan",
    2,
    ["auh_w_serbia_again", "auh_cs_danube", "auh_cs_albania"],
    { topic: "balkan", when: inWar },
  ),
  task("auh_task_tyrol", "chief_of_staff", "plan", 3, ["auh_w_tyrol_strike"], {
    topic: "italy",
    when: italyIn,
  }),
  task(
    "auh_task_occupied",
    "chief_of_staff",
    "study",
    2,
    ["auh_oc_serbia", "auh_oc_italy", "auh_oc_resistance"],
    { topic: "occupation", when: inWar },
  ),
  task(
    "auh_task_army_peace",
    "chief_of_staff",
    "plan",
    2,
    ["auh_y_rus_army", "auh_y_army_bill", "auh_y_staff_talks", "auh_nt_army"],
    { topic: "army_bill", when: peace },
  ),
  // 전쟁부
  task(
    "auh_task_shells",
    "war",
    "study",
    2,
    ["auh_h_shell_output", "auh_sh_nitrates", "auh_sh_copper", "auh_sh_rubber"],
    { topic: "shells", when: inWar },
  ),
  task(
    "auh_task_manpower",
    "war",
    "study",
    2,
    ["auh_h_manpower", "auh_c_harvest", "auh_hf_wounded", "auh_lb_women"],
    { topic: "manpower", when: inWar },
  ),
  task(
    "auh_task_factories",
    "war",
    "bill",
    2,
    ["auh_h_factory_law", "auh_hf_women_2", "auh_h_language_order"],
    { topic: "factories", when: inWar },
  ),
  // #6, the war ministry's half
  task("auh_task_regiments", "war", "plan", 1, ["auh_d_last_regiments"], {
    topic: "regiments",
    when: theEnd,
    once: true,
  }),
  // 해군부
  task(
    "auh_task_fleet",
    "navy",
    "plan",
    2,
    [
      "auh_w_fleet_out",
      "auh_cs_fleet_harbour",
      "auh_cs_otranto",
      "auh_cs_barrage",
      "auh_cs_fleet_idle",
      "auh_y_navy_estimates",
      "auh_y_ita_navy",
    ],
    { topic: "fleet" },
  ),
  // #6, the navy's half
  task("auh_task_last_fleet", "navy", "plan", 1, ["auh_d_last_fleet"], {
    topic: "fleet",
    when: theEnd,
    once: true,
  }),
  // 공동 재무부
  task(
    "auh_task_quota",
    "finance",
    "terms",
    2,
    ["auh_h_quota", "auh_c_q_bosnia_rail", "auh_y_arms_price"],
    { topic: "quota" },
  ),
  // 군사내각 (#1, #10)
  task("auh_task_honours", "court", "report", 1, ["auh_d_honours"], {
    topic: "honours",
    when: inWar,
    cooldown: 8,
  }),
  task("auh_task_purse", "court", "report", 1, ["auh_d_purse"], {
    topic: "purse",
    when: inWar,
    cooldown: 10,
  }),
  // 정보국 (Evidenzbureau)
  task(
    "auh_task_codes",
    "intelligence",
    "report",
    2,
    ["auh_spy_read", "auh_spy_codebook", "auh_spy_dark", "auh_ag_hire"],
    { topic: "codes", when: inWar },
  ),
  task(
    "auh_task_hunt",
    "intelligence",
    "report",
    1,
    ["auh_spy_hunt", "auh_spy_blown", "auh_ag_polish_pow"],
    { topic: "spies", when: inWar },
  ),
];

// ---- Leans (design §4.3): the option each department marks ----

const lean = (
  office: GwDeptLean["office"],
  l: GwDeptLean["lean"],
  picks?: Record<string, string>,
  camp?: GwDeptLean["camp"],
): GwDeptLean => ({
  nation: AUH,
  office,
  lean: l,
  ...(camp === undefined ? {} : { camp }),
  ...(picks === undefined ? {} : { picks }),
});

const LEANS: GwDeptLean[] = [
  lean(
    "foreign",
    "firm",
    { auh_h_romania_offer: "words_only", auh_m_bread: "send_grain" },
    "hard",
  ),
  lean("foreign", "gentle", {
    auh_m_peace: "hear_them",
    auh_m_bread: "send_grain",
  }),
  lean(
    "chancellor",
    "calm",
    {
      auh_h_reichsrat_call: "stay_shut",
      auh_m_bread: "keep_grain",
      auh_d_welfare: "welfare_only",
    },
    "hard",
  ),
  lean("chancellor", "calm", {
    auh_h_reichsrat_call: "open_it",
    auh_m_bread: "keep_grain",
    auh_d_welfare: "two_ministries",
  }),
  lean("hun_pm", "wait", {
    auh_h_transylvania: "nothing",
    auh_d_welfare_pest: "vienna_alone",
  }),
  lean("chief_of_staff", "firm", {
    auh_c_conrad_now: "mobilise_now",
    auh_w_tyrol_strike: "strike",
    auh_w_carpathian: "push_on",
  }),
  lean("war", "firm", {
    auh_h_shell_output: "army_runs_plants",
    auh_d_last_regiments: "hold_them",
  }),
  // Haus kept the fleet in Pola: a fleet in being, not a fleet in battle.
  lean("navy", "wait", {
    auh_w_fleet_out: "stay_in_pola",
    auh_cs_fleet_harbour: "harbour",
    auh_d_last_fleet: "keep_for_terms",
  }),
  lean("finance", "cheap"),
  lean("court", "wait", {
    auh_d_honours: "front_first",
    auh_d_purse: "red_cross",
  }),
  lean("intelligence", "firm"),
];

// ---- Wants, in words (design §4.9) ----

const want = (
  id: string,
  who: { office: NonNullable<GwDeptWant["office"]> } | { person: string },
  when?: GwCond,
  cover?: string,
): GwDeptWant => ({
  id,
  nation: AUH,
  ...who,
  ...(when === undefined ? {} : { when }),
  ...(cover === undefined ? {} : { cover }),
});

const WANTS: GwDeptWant[] = [
  want(
    "auh_want_fm_romania",
    { office: "foreign" },
    all(inWar, world({ is: "neutral", tag: "ROU" })),
    "auh_want_fm_cover",
  ),
  want(
    "auh_want_fm_italy",
    { office: "foreign" },
    all(inWar, world({ is: "neutral", tag: "ITA" })),
    "auh_want_fm_cover",
  ),
  want("auh_want_fm_peace", { office: "foreign" }, all(inWar, months(24))),
  want("auh_want_fm_serbia", { office: "foreign" }, peace),
  want("auh_want_chan_shut", { office: "chancellor" }, not(newReign)),
  want("auh_want_chan_bread", { office: "chancellor" }),
  want("auh_want_hun_grain", { office: "hun_pm" }, inWar),
  want("auh_want_hun_franchise", { office: "hun_pm" }),
  want(
    "auh_want_conrad_italy",
    { person: "auh_conrad" },
    not(italyIn),
    "auh_want_conrad_cover",
  ),
  want("auh_want_cos_divisions", { office: "chief_of_staff" }, inWar),
  want("auh_want_war_shells", { office: "war" }, inWar),
  want("auh_want_war_men", { office: "war" }),
  want("auh_want_navy_pola", { office: "navy" }),
  want(
    "auh_want_fin_bosnia",
    { person: "auh_bilinski" },
    undefined,
    "auh_want_fin_cover",
  ),
  want("auh_want_fin_notes", { office: "finance" }, inWar),
  want("auh_want_court_rest", { office: "court" }),
  want("auh_want_intel_money", { office: "intelligence" }),
];

// ---- Levers (design §4.9): gifts in an audience ----

const pride = (delta: number): GwEffect => ({
  kind: "pride",
  who: role("who"),
  delta,
});

const LEVERS: GwLeverRow[] = [
  {
    id: "auh_lv_maria_theresa",
    nation: AUH,
    lever: "honour",
    people: "own",
    when: inWar,
    effects: [pride(1), opinion("army", 1)],
  },
  {
    id: "auh_lv_title",
    nation: AUH,
    lever: "honour",
    people: "cabinet",
    effects: [pride(1), opinion("court", 1)],
  },
  {
    id: "auh_lv_privy",
    nation: AUH,
    lever: "post",
    people: "own",
    effects: [pride(1), remember("auh_lv_privy_given", role("who"))],
  },
  {
    id: "auh_lv_purse",
    nation: AUH,
    lever: "purse",
    when: inWar,
    effects: [ruler("conscience", 1, "auh_d_purse_widows")],
  },
  {
    id: "auh_lv_pardon",
    nation: AUH,
    lever: "pardon",
    people: "own",
    effects: [
      remember("auh_lv_pardoned", role("who")),
      opinion("parliament", 1),
    ],
  },
];

export const AUH_DEPTS: GwDeptContent = {
  tasks: TASKS,
  leans: LEANS,
  wants: WANTS,
  levers: LEVERS,
};
