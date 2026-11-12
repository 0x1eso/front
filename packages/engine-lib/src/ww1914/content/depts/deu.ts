// ww193: DEU's departments. Lane W-DEU owns this file and
// resources/ww1914/ko/DEU.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
//
// The new papers (design §5): the Household's honours list (#1) and the privy
// purse's requests (#10), the foreign office's drafts for letters to kin on
// neutral thrones (#2), the Prussian house's dissolution plan with the OHL's
// counter-paper (#3), and the cards the schedule's new entries play
// (ceremonies, the purse, the kin letters: content/acts/deu.ts).
import type {
  GwDeptContent,
  GwTaskRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  all,
  any,
  chose,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  holder,
  memory,
  remember,
  role,
  schedule,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["DEU"];
const war: GwCond = world({ is: "war" });
const months = (min: number): GwCond => world({ is: "war_months", min });
const neutral = (tag: "GRC" | "ROU" | "ITA"): GwCond =>
  world({ is: "neutral", tag });
const atWar = (tag: "RUS" | "FRA" | "GBR"): GwCond => ({ kind: "at_war", tag });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const army = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "army",
  delta,
});
const ruler = (
  side: "family" | "conscience" | "reputation",
  delta: number,
  key: string,
): GwEffect => ({ kind: "ruler", side, delta, key });
const v = (id: string, c?: GwCond): GwVariant =>
  c === undefined ? { id } : { id, when: c };
const o = (id: string, tell: string[], effects: GwEffect[]): GwOption => ({
  id,
  tell,
  effects,
});
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});

/** The Prussian bill came back from the house with the plural vote in it. */
const gutted: GwCond = world({
  is: "law",
  id: "deu_three_class",
  of: ["persuade", "vote"],
  text: "plural_vote",
});

/** The foreign office's draft for this king was taken. */
const advised = (tag: "grc" | "rou"): GwCond =>
  any(memory(`k_deu_kin_${tag}_warm`), memory(`k_deu_kin_${tag}_frank`));

/** A kin letter's reply (#2): the king, his tone, and whether he turned. */
function kinReply(
  id: string,
  person: string,
  tag: "GRC" | "ROU",
  key: "grc" | "rou",
  shownPct: number,
): GwScene {
  const turned = world({ is: "entered", tag, side: "entente" });
  return {
    id,
    nation: NATION,
    kind: "letter",
    scheduledOnly: true,
    byAct: true,
    who: "other",
    cast: { other: { person } },
    salience: 5,
    tags: ["foreign"],
    variants: [
      v("broken", turned),
      v("fit", { kind: "tone_fits", who: role("other") }),
      v("threat", picked("tone", "threat")),
      v("base"),
    ],
    fallback: "close",
    options: [
      o(
        "again",
        ["entry"],
        [
          { kind: "letter", who: role("other"), tone: "warm" },
          doWorld({ do: "readiness", tag, delta: -3 }),
          {
            kind: "maybe",
            when: advised(key),
            then: [doWorld({ do: "readiness", tag, delta: -2 })],
          },
          // The king may show the letter to the other side.
          {
            kind: "roll",
            key: `${id}_shown`,
            pct: shownPct,
            then: [{ kind: "rumour", delta: 1 }],
          },
        ],
      ),
      o(
        "close",
        ["family:-1"],
        [
          { kind: "letter", who: role("other"), tone: "cold" },
          {
            kind: "maybe",
            when: turned,
            then: [ruler("family", -1, "deu_kin_broken")],
          },
        ],
      ),
    ],
  };
}

/** A ceremony's or the purse's card: a report on the desk. */
function card(
  id: string,
  cast: GwScene["cast"],
  tags: GwScene["tags"],
  variants: GwVariant[],
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "report",
    scheduledOnly: true,
    byAct: true,
    cast,
    salience: 4,
    tags,
    variants,
  };
}

/** A foreign office draft for a letter to a king (#2). */
function kinDraft(id: string, tag: "GRC" | "ROU", key: string): GwScene {
  return {
    id,
    nation: NATION,
    kind: "proposal",
    when: all(war, neutral(tag)),
    cast: { fm: holder("foreign") },
    author: "fm",
    salience: 4,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    fallback: "not_now",
    options: [
      o("warm", [], [remember(`k_deu_kin_${key}_warm`)]),
      o("frank", [], [remember(`k_deu_kin_${key}_frank`)]),
      o("not_now", [], []),
    ],
  };
}

export const DEU_DEPT_SCENES: readonly GwScene[] = [
  // #1 The honours list: the Household brings it after a victory or at the
  // new year, or when asked. The investiture is a ceremony on the schedule.
  {
    id: "deu_dept_honours",
    nation: NATION,
    kind: "proposal",
    when: all(
      war,
      months(3),
      any(world({ is: "month", of: [1] }), world({ is: "score", min: 10 })),
    ),
    cast: { court: holder("court") },
    author: "court",
    salience: 5,
    tags: ["home"],
    cooldown: 6,
    max: 4,
    variants: [
      v("victory", world({ is: "score", min: 10 })),
      v("new_year", world({ is: "month", of: [1] })),
      v("base"),
    ],
    fallback: "short_list",
    options: [
      o(
        "the_front",
        ["opinion:+1", "opinion:-1"],
        [
          opinion("army", 1),
          opinion("parliament", -1),
          remember("k_deu_hon_front"),
        ],
      ),
      o(
        "the_offices",
        ["opinion:+1"],
        [opinion("court", 1), remember("k_deu_hon_offices")],
      ),
      o(
        "the_works",
        ["opinion:+1", "opinion:-1"],
        [
          opinion("business", 1),
          opinion("army", -1),
          remember("k_deu_hon_works"),
        ],
      ),
      o(
        "short_list",
        ["reputation:+1"],
        [ruler("reputation", 1, "deu_dept_hon_short")],
      ),
    ],
  },
  // #10 The privy purse: the Household brings the requests on it.
  {
    id: "deu_dept_purse",
    nation: NATION,
    kind: "proposal",
    when: all(war, months(6)),
    cast: { court: holder("court") },
    author: "court",
    salience: 4,
    tags: ["home", "people"],
    cooldown: 8,
    max: 3,
    variants: [
      v("hungry", { kind: "gauge", gauge: "bread", max: 1 }),
      v("base"),
    ],
    fallback: "keep",
    options: [
      o(
        "red_cross",
        ["conscience:+1", "opinion:+1"],
        [ruler("conscience", 1, "deu_dept_purse_given"), opinion("press", 1)],
      ),
      o(
        "widows",
        ["conscience:+1", "opinion:+1"],
        [ruler("conscience", 1, "deu_dept_purse_given"), opinion("workers", 1)],
      ),
      o(
        "war_loan",
        ["opinion:+1", "money:+1"],
        [opinion("business", 1), gauge("money", 1)],
      ),
      o("keep", ["opinion:+1"], [opinion("court", 1)]),
    ],
  },
  // #2 Kin on neutral thrones: the foreign office drafts what to write.
  kinDraft("deu_dept_kin_grc", "GRC", "grc"),
  kinDraft("deu_dept_kin_rou", "ROU", "rou"),
  // #3 The Prussian franchise: once the house guts the bill, the chancellery
  // and the interior bring the dissolution plan. Dissolving brings the OHL's
  // counter-paper the next chapter.
  {
    id: "deu_dept_landtag",
    nation: NATION,
    kind: "proposal",
    when: gutted,
    cast: { chancellor: holder("chancellor"), interior: holder("interior") },
    author: "chancellor",
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [v("base")],
    fallback: "wait",
    options: [
      o(
        "dissolve",
        ["authority:-1", "opinion:+1", "opinion:-1"],
        [
          doWorld({ do: "authority", delta: -1 }),
          opinion("workers", 1),
          opinion("court", -1),
          remember("k_deu_landtag_dissolve"),
          schedule("deu_dept_landtag_ohl", 1),
        ],
      ),
      o(
        "press_on",
        ["support:+1", "opinion:+1"],
        [
          doWorld({ do: "law_support", law: "deu_three_class", delta: 1 }),
          opinion("parliament", 1),
        ],
      ),
      o(
        "wait",
        ["opinion:-1", "order:-1"],
        [opinion("workers", -1), gauge("order", -1)],
      ),
    ],
  },
  {
    id: "deu_dept_landtag_ohl",
    nation: NATION,
    kind: "dispute",
    scheduledOnly: true,
    cast: { a: holder("chancellor"), b: holder("chief_of_staff") },
    author: "a",
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [v("base")],
    fallback: "back_b",
    options: [
      o(
        "back_a",
        ["army:-1", "order:+1"],
        [
          army(-1),
          gauge("order", 1),
          // The new house may come back the same.
          {
            kind: "roll",
            key: "deu_landtag_vote",
            pct: 50,
            then: [
              doWorld({ do: "law_support", law: "deu_three_class", delta: 2 }),
              remember("k_deu_landtag_new"),
            ],
            otherwise: [remember("k_deu_landtag_same"), opinion("court", 1)],
          },
        ],
      ),
      o(
        "back_b",
        ["army:+1", "opinion:-2", "order:-1"],
        [
          army(1),
          opinion("workers", -2),
          gauge("order", -1),
          remember("k_deu_landtag_kept"),
        ],
      ),
    ],
  },

  // ---- What the schedule's new entries play (content/acts/deu.ts) ----
  card(
    "deu_a_investiture_r",
    { court: holder("court") },
    ["home"],
    [
      v("front", chose("deu_dept_honours", "the_front")),
      v("works", chose("deu_dept_honours", "the_works")),
      v("base"),
    ],
  ),
  card(
    "deu_a_review_r",
    { cos: holder("chief_of_staff") },
    ["war"],
    [v("tired", { kind: "gauge", gauge: "morale", max: 1 }), v("base")],
  ),
  card(
    "deu_a_service_r",
    { court: holder("court") },
    ["home", "people"],
    [v("long", months(24)), v("base")],
  ),
  card(
    "deu_a_purse_r",
    { court: holder("court") },
    ["home", "people"],
    [
      v("widows", picked("where", "widows")),
      v("loan", picked("where", "loan")),
      v("base"),
    ],
  ),
  kinReply("deu_a_constantine_r", "grc_constantine", "GRC", "grc", 30),
  kinReply("deu_a_marie_r", "rou_marie", "ROU", "rou", 40),
];

// ---- Task rows: each points at papers that exist ----

const task = (
  id: string,
  office: GwTaskRow["office"],
  kind: GwTaskRow["kind"],
  chapters: number,
  products: string[],
  more: Partial<GwTaskRow> = {},
): GwTaskRow => ({
  id: `deu_task_${id}`,
  nation: ["DEU"],
  office,
  kind,
  chapters,
  products,
  ...more,
});

const TASKS: GwTaskRow[] = [
  // 외무부 (Auswärtiges Amt)
  task("italy", "foreign", "terms", 2, ["gw_o_ita_asks", "gw_o_ita_trentino"], {
    topic: "ITA",
    when: war,
  }),
  task(
    "romania",
    "foreign",
    "terms",
    2,
    ["gw_o_rou_transylvania", "gw_o_rou_grain", "gw_o_rou_moment"],
    { topic: "ROU", when: war },
  ),
  task("bulgaria", "foreign", "terms", 2, ["gw_o_bgr_macedonia"], {
    topic: "BGR",
    when: war,
  }),
  task(
    "ottoman",
    "foreign",
    "terms",
    2,
    ["gw_o_ott_ships", "gw_o_ott_price", "gw_d_india_road"],
    { topic: "OTT" },
  ),
  task(
    "russia_peace",
    "foreign",
    "terms",
    3,
    ["deu_s_separate_russia", "deu_w_separate_peace", "gw_d_sounding"],
    { topic: "RUS", when: atWar("RUS") },
  ),
  task(
    "america",
    "foreign",
    "plan",
    2,
    [
      "deu_s_wilson_mediation",
      "gw_d_aims_asked",
      "gw_d_fourteen",
      "gw_o_usa_arms",
    ],
    { topic: "USA", when: war },
  ),
  task(
    "britain",
    "foreign",
    "plan",
    2,
    ["deu_w_gbr_neutral", "deu_s_belgium_price", "deu_y_talks_offer"],
    { topic: "GBR" },
  ),
  task(
    "vienna",
    "foreign",
    "plan",
    1,
    [
      "deu_y_ally_renew",
      "deu_y_ally_crack",
      "deu_w_peace_vienna",
      "gw_d_ally_summit",
      "gw_d_ally_money",
    ],
    { topic: "AUH" },
  ),
  task(
    "neutrals",
    "foreign",
    "study",
    2,
    [
      "gw_o_swe_iron",
      "gw_o_nld_food",
      "gw_o_che_coal",
      "gw_o_nor_tonnage",
      "gw_o_dnk_belt",
      "gw_d_neutral_press",
    ],
    { topic: "neutral_trade", when: war },
  ),
  task("kin_grc", "foreign", "plan", 1, ["deu_dept_kin_grc"], {
    topic: "GRC",
    when: all(war, neutral("GRC")),
    once: true,
  }),
  task("kin_rou", "foreign", "plan", 1, ["deu_dept_kin_rou"], {
    topic: "ROU",
    when: all(war, neutral("ROU")),
    once: true,
  }),

  // 재상부 (Reichskanzlei)
  task(
    "war_aims",
    "chancellor",
    "plan",
    2,
    ["deu_w_war_aims", "deu_k_war_aims_gag", "gw_d_aims_asked"],
    { topic: "war_aims", when: war },
  ),
  task(
    "poland",
    "chancellor",
    "plan",
    2,
    [
      "deu_s_poland_kingdom",
      "deu_ld_occ_rus_long",
      "gw_d_poland_word",
      "deu_oc_client",
    ],
    { topic: "poland", when: war },
  ),
  task(
    "belgium",
    "chancellor",
    "plan",
    2,
    ["deu_ld_occ_bel_long", "deu_ld_occ_bel", "deu_s_belgium_price"],
    { topic: "BEL", when: war },
  ),
  task(
    "parties",
    "chancellor",
    "report",
    1,
    [
      "deu_k_interparty",
      "deu_h_fatherland_party",
      "deu_k_princes",
      "pr_deu_parliament",
    ],
    { topic: "parties" },
  ),
  task("landtag", "chancellor", "plan", 1, ["deu_dept_landtag"], {
    topic: "franchise",
    when: gutted,
    once: true,
  }),

  // 내무부 (Reichsamt des Innern)
  task(
    "food",
    "interior",
    "study",
    2,
    [
      "deu_w_bread_cards",
      "deu_h_price_caps",
      "deu_h_food_office",
      "deu_h_pig_cull",
      "deu_h_hunger_truth",
      "deu_hf_hunger",
    ],
    { topic: "food", when: war },
  ),
  task(
    "strikes",
    "interior",
    "report",
    1,
    [
      "deu_h_liebknecht_may",
      "deu_p_rally_ban",
      "deu_y_home_strike",
      "pr_deu_rumour",
    ],
    { topic: "strikes" },
  ),
  task(
    "franchise_bill",
    "interior",
    "bill",
    2,
    ["deu_k_three_class", "deu_w_peace_franchise", "deu_m_home_lords"],
    { topic: "franchise" },
  ),
  task("landtag_i", "interior", "plan", 1, ["deu_dept_landtag"], {
    topic: "franchise",
    when: gutted,
    once: true,
  }),
  task("censor", "interior", "bill", 1, ["deu_h_censor"], {
    topic: "censor",
    when: war,
  }),
  task(
    "coal",
    "interior",
    "study",
    1,
    ["deu_h_coal_winter", "gw_x_coal_winter"],
    { topic: "coal", when: war },
  ),
  task(
    "refugees",
    "interior",
    "report",
    1,
    ["deu_hf_refugees", "deu_hf_flu", "gw_x_refugees"],
    { topic: "refugees", when: war },
  ),

  // 전쟁부 (Kriegsministerium)
  task(
    "shells",
    "war",
    "study",
    1,
    ["deu_w_shell_crisis", "deu_w_raw_materials", "deu_f_new_arms"],
    { topic: "shells", when: war },
  ),
  task(
    "manpower",
    "war",
    "study",
    2,
    [
      "deu_f_last_classes",
      "deu_h_women_work",
      "deu_hf_women",
      "deu_lb_reclaim",
    ],
    { topic: "manpower", when: war },
  ),
  // The retired inquiry's last subject: its report is the wounded's figures.
  task(
    "wounded",
    "war",
    "study",
    1,
    ["deu_h_wounded_home", "deu_hf_wounded", "deu_a_inquiry_r"],
    { topic: "wounded", when: war },
  ),
  task(
    "army_bill",
    "war",
    "bill",
    2,
    ["deu_w_peace_arms", "deu_y_arms_bill", "deu_h_war_office"],
    { topic: "army_bill" },
  ),
  task(
    "prisoners",
    "war",
    "report",
    1,
    ["deu_hf_pow_camps", "deu_hf_pow_ours", "gw_d_prisoner_swap"],
    { topic: "prisoners", when: war },
  ),

  // 참모본부 (Großer Generalstab, then the OHL)
  task(
    "east",
    "chief_of_staff",
    "plan",
    2,
    [
      "deu_w_east_first",
      "deu_f_gorlice",
      "deu_f_brusilov_help",
      "deu_f_east_garrison",
    ],
    { topic: "east", when: atWar("RUS") },
  ),
  task(
    "west",
    "chief_of_staff",
    "plan",
    2,
    [
      "deu_f_somme_doctrine",
      "deu_f_withdraw_line",
      "deu_f_offensive_month",
      "deu_f_east1_year",
    ],
    { topic: "west", when: atWar("FRA") },
  ),
  task(
    "balkan",
    "chief_of_staff",
    "plan",
    2,
    ["deu_f_serbia_road", "deu_f_straits_shells"],
    { topic: "balkan", when: war },
  ),
  task(
    "allied_command",
    "chief_of_staff",
    "terms",
    2,
    ["deu_f_unified_command", "deu_f_italy_corps", "deu_y_ally_staff"],
    { topic: "AUH" },
  ),
  task(
    "occupied",
    "chief_of_staff",
    "report",
    1,
    [
      "deu_oc_resist",
      "deu_oc_labour",
      "deu_oc_fra",
      "deu_oc_rus",
      "deu_oc_rou",
    ],
    { topic: "occupied", when: war },
  ),

  // 해군부 (Reichsmarineamt)
  task(
    "fleet",
    "navy",
    "plan",
    2,
    ["deu_w_fleet_out", "deu_s_fleet_out", "deu_s_neutral_flags"],
    { topic: "sea", when: atWar("GBR") },
  ),
  task("uboats", "navy", "plan", 2, ["deu_w_sub_note", "deu_s_neutral_flags"], {
    topic: "uboats",
    when: atWar("GBR"),
  }),
  task(
    "fleet_law",
    "navy",
    "bill",
    2,
    ["deu_w_peace_novelle", "deu_y_inc_naval", "deu_y_talks_keep"],
    { topic: "fleet_law" },
  ),

  // 재무부 (Reichsschatzamt)
  task(
    "war_loan",
    "finance",
    "bill",
    1,
    ["deu_w_first_loan", "deu_w_second_credit", "deu_h_loan_drive"],
    { topic: "war_loan", when: war },
  ),
  task(
    "war_tax",
    "finance",
    "bill",
    2,
    ["deu_h_war_profits", "gw_x_prices", "deu_y_arms_price"],
    { topic: "war_tax" },
  ),
  task(
    "allies_money",
    "finance",
    "terms",
    2,
    ["gw_d_ally_money", "deu_oc_requisition", "gw_o_usa_loans"],
    { topic: "allies_money", when: war },
  ),

  // 궁내부 (the naval cabinet's chief stands for the Household)
  task("honours", "court", "plan", 1, ["deu_dept_honours", "deu_p_orders"], {
    topic: "honours",
    when: war,
  }),
  task("purse", "court", "plan", 1, ["deu_dept_purse"], {
    topic: "purse",
    when: war,
  }),
  task(
    "court_mood",
    "court",
    "report",
    1,
    ["deu_k_new_faces", "deu_p_year_end", "deu_k_silent_rule"],
    { topic: "court" },
  ),

  // 정보부 (Abteilung IIIb)
  task(
    "enemy",
    "intelligence",
    "report",
    2,
    ["deu_spy_read", "deu_spy_code_lost", "gw_spy_peace_read"],
    { pick: "country", from: ["FRA", "RUS", "GBR", "ITA", "ROU", "USA"] },
  ),
];

const DEU: ["DEU"] = ["DEU"];

export const DEU_DEPTS: GwDeptContent = {
  tasks: TASKS,
  // The department's line: its head's camp first, else the office's own.
  leans: [
    { nation: DEU, office: "foreign", camp: "hard", lean: "firm" },
    {
      nation: DEU,
      office: "foreign",
      lean: "gentle",
      picks: {
        deu_s_separate_russia: "andersen_again",
        deu_w_gbr_neutral: "colonies_word",
        gw_o_rou_transylvania: "press_vienna",
        deu_s_wilson_mediation: "polite_no",
      },
    },
    {
      nation: DEU,
      office: "chancellor",
      camp: "hard",
      lean: "firm",
      picks: { deu_k_three_class: "not_now", deu_dept_landtag: "wait" },
    },
    {
      nation: DEU,
      office: "chancellor",
      lean: "calm",
      picks: {
        deu_k_three_class: "word_after_war",
        deu_w_war_aims: "hold_secret",
        deu_s_poland_kingdom: "proclaim_with_vienna",
        deu_k_interparty: "send_chancellor",
        deu_dept_landtag: "dissolve",
      },
    },
    { nation: DEU, office: "chief_of_staff", camp: "moderate", lean: "calm" },
    {
      nation: DEU,
      office: "chief_of_staff",
      lean: "firm",
      picks: {
        deu_f_somme_doctrine: "depth",
        deu_f_unified_command: "demand",
        deu_s_poland_kingdom: "proclaim",
        deu_dept_landtag_ohl: "back_b",
      },
    },
    { nation: DEU, office: "war", camp: "moderate", lean: "calm" },
    {
      nation: DEU,
      office: "war",
      lean: "firm",
      picks: { deu_w_shell_crisis: "nitrate_plants" },
    },
    { nation: DEU, office: "navy", camp: "moderate", lean: "wait" },
    {
      nation: DEU,
      office: "navy",
      lean: "bold",
      picks: {
        deu_w_fleet_out: "sortie",
        deu_w_sub_note: "declare_zone",
        deu_w_peace_novelle: "novelle",
      },
    },
    {
      nation: DEU,
      office: "interior",
      lean: "calm",
      picks: {
        deu_w_bread_cards: "ration_cards",
        deu_dept_landtag: "dissolve",
      },
    },
    {
      nation: DEU,
      office: "finance",
      lean: "cheap",
      picks: {
        deu_w_first_loan: "bonds",
        deu_h_war_profits: "light_tax",
        deu_h_loan_drive: "big_drive",
      },
    },
    {
      nation: DEU,
      office: "court",
      lean: "calm",
      picks: { deu_dept_honours: "short_list", deu_dept_purse: "widows" },
    },
    {
      nation: DEU,
      office: "intelligence",
      lean: "firm",
      picks: { deu_spy_read: "hide" },
    },
  ],
  // What each department wants, the first that holds; a cunning head hides it.
  wants: [
    {
      id: "deu_want_fm_italy",
      nation: DEU,
      office: "foreign",
      when: all(war, neutral("ITA")),
      cover: "deu_want_fm_cover",
    },
    {
      id: "deu_want_fm_peace",
      nation: DEU,
      office: "foreign",
      when: all(war, months(12)),
      cover: "deu_want_fm_cover",
    },
    {
      id: "deu_want_fm_quiet",
      nation: DEU,
      office: "foreign",
      cover: "deu_want_fm_cover",
    },
    {
      id: "deu_want_chan_franchise",
      nation: DEU,
      office: "chancellor",
      when: all(war, months(12)),
    },
    { id: "deu_want_chan_calm", nation: DEU, office: "chancellor" },
    {
      id: "deu_want_cos_decision",
      nation: DEU,
      office: "chief_of_staff",
      when: war,
      cover: "deu_want_cos_cover",
    },
    {
      id: "deu_want_cos_ready",
      nation: DEU,
      office: "chief_of_staff",
      cover: "deu_want_cos_cover",
    },
    {
      id: "deu_want_war_men",
      nation: DEU,
      office: "war",
      when: war,
      cover: "deu_want_war_cover",
    },
    {
      id: "deu_want_war_bill",
      nation: DEU,
      office: "war",
      cover: "deu_want_war_cover",
    },
    {
      id: "deu_want_navy_uboat",
      nation: DEU,
      office: "navy",
      when: all(war, atWar("GBR")),
      cover: "deu_want_navy_cover",
    },
    {
      id: "deu_want_navy_fleet",
      nation: DEU,
      office: "navy",
      cover: "deu_want_navy_cover",
    },
    { id: "deu_want_int_food", nation: DEU, office: "interior", when: war },
    { id: "deu_want_int_order", nation: DEU, office: "interior" },
    { id: "deu_want_fin_loans", nation: DEU, office: "finance", when: war },
    { id: "deu_want_fin_budget", nation: DEU, office: "finance" },
    {
      id: "deu_want_court_apart",
      nation: DEU,
      office: "court",
      cover: "deu_want_court_cover",
    },
    {
      id: "deu_want_spy_press",
      nation: DEU,
      office: "intelligence",
      when: war,
      cover: "deu_want_spy_cover",
    },
    {
      id: "deu_want_spy_east",
      nation: DEU,
      office: "intelligence",
      cover: "deu_want_spy_cover",
    },
    // People with no office who ask in the room.
    {
      id: "deu_want_heir_command",
      nation: DEU,
      person: "deu_heir",
      when: war,
    },
    {
      id: "deu_want_erzberger_peace",
      nation: DEU,
      person: "deu_erzberger",
      when: all(war, months(18)),
    },
  ],
  // Gifts in an audience (#1, #10): one a person a chapter.
  levers: [
    {
      id: "deu_lv_merite",
      nation: DEU,
      lever: "honour",
      people: "own",
      when: war,
      effects: [opinion("army", 1)],
    },
    {
      id: "deu_lv_eagle",
      nation: DEU,
      lever: "honour",
      people: "cabinet",
      effects: [opinion("court", 1)],
    },
    {
      id: "deu_lv_nobility",
      nation: DEU,
      lever: "honour",
      people: "own",
      effects: [opinion("business", 1), opinion("workers", -1)],
    },
    {
      id: "deu_lv_suite",
      nation: DEU,
      lever: "post",
      people: "own",
      effects: [opinion("army", 1), opinion("parliament", -1)],
    },
    {
      id: "deu_lv_purse",
      nation: DEU,
      lever: "purse",
      people: "own",
      effects: [ruler("conscience", 1, "deu_dept_purse_given")],
    },
    {
      id: "deu_lv_grace",
      nation: DEU,
      lever: "pardon",
      people: "own",
      effects: [opinion("press", 1), opinion("army", -1)],
    },
  ],
};
