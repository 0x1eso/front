// ww193: GBR's departments. Lane W-GBR owns this file and
// resources/ww1914/ko/GBR.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and any new scene the design asks for (the twelve).
//
// Products are existing papers, in order; the first that holds is brought,
// else the common report `gw_dept_<kind>`. Subject topics that match the old
// schedule fields (shells, rifles, bread, recruits; straits) are the ids those
// papers' `picked` variants read, should the task's topic ever reach them.
// New papers here: the honours list (#1), Casement's reprieve (#4) and the
// King's name (#11), plus the four ceremonies' cards (acts/gbr.ts).
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwLeverRow,
  GwTaskRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import type {
  GwCond,
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  byName,
  flag,
  holder,
  memory,
  not,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: ["GBR"] = ["GBR"];

const war: GwCond = { kind: "at_war", tag: "DEU" };
const notWar = not(world({ is: "war" }));
const peace = all(notWar, world({ is: "peace_months", min: 1 }));
const months = (min: number): GwCond =>
  all(war, world({ is: "war_months", own: true, min }));
const neutral = (tag: GwTag): GwCond =>
  all(world({ is: "war" }), world({ is: "neutral", tag }));
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const king = byName("gbr_george_v");

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, tell: string[], effects: GwEffect[]) => ({
  id,
  tell,
  effects,
});
const inst = (
  i: "commons" | "opposition" | "cabinet" | "irish",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });

// ---- Tasks ----

type Row = Omit<GwTaskRow, "id" | "nation" | "office" | "kind" | "chapters">;
const task = (
  subject: string,
  office: GwOffice,
  kind: GwTaskRow["kind"],
  chapters: number,
  products: string[],
  more: Partial<Row> = {},
): GwTaskRow => ({
  id: `gbr_task_${subject}`,
  nation: NATION,
  office,
  kind,
  chapters,
  products,
  ...more,
});

const TASKS: GwTaskRow[] = [
  // Foreign Office: the neutrals, the allies' bargains, the peace soundings.
  task(
    "italy",
    "foreign",
    "plan",
    2,
    ["gw_o_ita_asks", "gw_o_ita_london", "gw_price_ita"],
    { topic: "ITA", when: neutral("ITA") },
  ),
  task(
    "romania",
    "foreign",
    "plan",
    2,
    ["gw_o_rou_transylvania", "gw_o_rou_moment", "gw_price_rou"],
    { topic: "ROU", when: neutral("ROU") },
  ),
  task(
    "bulgaria",
    "foreign",
    "plan",
    2,
    ["gw_o_bgr_macedonia", "gw_price_bgr"],
    { topic: "BGR", when: neutral("BGR") },
  ),
  task(
    "greece",
    "foreign",
    "plan",
    2,
    ["gw_o_grc_salonika", "gw_o_grc_king", "gw_price_grc"],
    { topic: "GRC", when: neutral("GRC") },
  ),
  task(
    "turkey",
    "foreign",
    "plan",
    1,
    ["gw_o_ott_price", "gbr_w_gates", "gw_price_ott"],
    { topic: "OTT", when: world({ is: "war" }) },
  ),
  task(
    "america",
    "foreign",
    "terms",
    2,
    ["gw_o_usa_loans", "gw_d_neutral_note", "gbr_wv_join_usa"],
    { topic: "USA", when: war },
  ),
  task(
    "arabs",
    "foreign",
    "terms",
    2,
    [
      "gbr_f_mcmahon",
      "gbr_f_sykes_picot",
      "gw_d_carve_ottoman",
      "gbr_f_palestine",
    ],
    { topic: "arabs", when: { kind: "at_war", tag: "OTT" } },
  ),
  task(
    "soundings",
    "foreign",
    "terms",
    2,
    ["gbr_f_vienna_feeler", "gw_d_sounding", "gw_peace_feeler"],
    { topic: "separate_peace", when: months(11) },
  ),
  task(
    "war_aims",
    "foreign",
    "terms",
    2,
    ["gw_d_aims_asked", "gbr_f_war_aims", "gw_law_gbr_war_aims"],
    { topic: "war_aims", when: months(17) },
  ),
  task(
    "berlin_talks",
    "foreign",
    "terms",
    2,
    ["gbr_y_talk_offer", "gbr_y_talk_berlin"],
    { topic: "DEU", when: peace },
  ),
  // Treasury: the City, the dollars, drink and tax.
  task(
    "city",
    "finance",
    "study",
    1,
    ["gbr_c_city", "gbr_f_morgan", "gbr_sh_dollars", "gw_x_prices"],
    { topic: "credit", once: true },
  ),
  task(
    "dollars",
    "finance",
    "terms",
    2,
    ["gbr_f_morgan", "gbr_sh_dollars", "gw_o_usa_loans", "gw_d_ally_money"],
    { topic: "loan", when: war },
  ),
  task("drink", "finance", "bill", 1, ["gbr_h_pledge", "gw_law_gbr_drink"], {
    topic: "drink",
    when: war,
  }),
  task("tax", "finance", "bill", 2, ["gw_x_prices", "gw_law_gbr_wealth"], {
    topic: "tax",
    when: war,
  }),
  task("copper", "finance", "study", 1, ["gbr_sh_copper"], {
    topic: "copper",
    when: months(6),
    once: true,
  }),
  // Admiralty and the First Sea Lord.
  task(
    "fleet",
    "navy",
    "plan",
    1,
    ["gbr_c_fleet_stays", "gbr_wv_front_sea", "gbr_aim_p_sea"],
    { topic: "sea" },
  ),
  task(
    "straits",
    "navy",
    "plan",
    2,
    ["gbr_w_naval_only", "gbr_wv_front_straits", "gbr_w_gates"],
    { topic: "straits", when: war },
  ),
  task("landships", "navy", "study", 3, ["gbr_inv_tank"], {
    topic: "tanks",
    when: months(6),
    once: true,
  }),
  task("nitrates", "navy", "study", 1, ["gbr_sh_nitrates"], {
    topic: "nitrates",
    when: war,
    once: true,
  }),
  task(
    "naval_race",
    "navy",
    "plan",
    2,
    ["gbr_y_arms_rival", "gbr_y_arms_bill"],
    { topic: "fleet", when: peace },
  ),
  task("convoy", "sea_lord", "study", 2, ["gbr_inv_convoy"], {
    topic: "convoys",
    when: months(20),
    once: true,
  }),
  task(
    "listening",
    "sea_lord",
    "study",
    2,
    ["gbr_inv_hydro", "gbr_inv_sound"],
    { topic: "submarines", when: months(6) },
  ),
  // Home Office: bread, rents and strikes, the vote, Casement.
  task(
    "food",
    "interior",
    "study",
    2,
    ["gbr_h_food", "gbr_hf_hunger", "gbr_sh_fats", "gw_law_gbr_food"],
    { topic: "food", when: war },
  ),
  task(
    "strikes",
    "interior",
    "report",
    1,
    ["gbr_h_rents", "gbr_lb_clyde", "gbr_lb_may", "gbr_y_home_strike"],
    { topic: "strikes" },
  ),
  task(
    "franchise",
    "interior",
    "bill",
    2,
    ["gbr_h_franchise", "gw_law_gbr_franchise"],
    { topic: "franchise", when: months(24) },
  ),
  task("flu", "interior", "study", 1, ["gbr_hf_flu"], {
    topic: "flu",
    when: world({ is: "flu", min: 1 }),
  }),
  task("casement", "interior", "report", 1, ["gbr_dept_casement"], {
    topic: "casement",
    when: all(war, flag("f_gbr_rising")),
    once: true,
  }),
  // The Irish Office.
  task(
    "home_rule",
    "ireland",
    "plan",
    2,
    ["gbr_h_ireland_talks", "gbr_h_home_rule_lives", "gw_law_gbr_home_rule"],
    { topic: "home_rule" },
  ),
  task(
    "rifles",
    "ireland",
    "report",
    1,
    ["gbr_c_ulster_rifles", "gbr_a_o_inquiry_r"],
    { topic: "rifles", cooldown: 4 },
  ),
  // The War Office: men, shells, the side shows, the raids.
  task(
    "recruits",
    "war",
    "study",
    2,
    ["gbr_w_new_armies", "gbr_w_manpower", "gbr_a_o_inquiry_r"],
    { topic: "recruits", when: war },
  ),
  task(
    "conscription",
    "war",
    "bill",
    2,
    [
      "gw_gbr_conscription",
      "gw_law_gbr_conscription",
      "gw_law_gbr_married_men",
    ],
    { topic: "conscription", when: months(9) },
  ),
  task(
    "shells",
    "war",
    "study",
    1,
    ["gbr_a_o_inquiry_r", "gbr_hf_women_shells", "gbr_inv_acetone"],
    { topic: "shells", when: war },
  ),
  // Was the schedule's commission (gbr_a_o_commission): an inquiry into a
  // campaign gone wrong.
  task("commission", "war", "report", 3, ["gbr_a_o_commission_r"], {
    topic: "straits",
    when: months(11),
    once: true,
  }),
  task(
    "mesopotamia",
    "war",
    "plan",
    2,
    ["gbr_w_baghdad_road", "gbr_a_o_commission_r"],
    {
      topic: "mesopotamia",
      when: world({ is: "open", theatre: "mesopotamia" }),
    },
  ),
  task("palestine", "war", "plan", 2, ["gbr_w_jerusalem"], {
    topic: "palestine",
    when: world({ is: "open", theatre: "palestine" }),
  }),
  task("air_raids", "war", "study", 1, ["gbr_w_air_raids"], {
    topic: "air_raids",
    when: months(20),
    once: true,
  }),
  // The Imperial General Staff.
  task(
    "west",
    "chief_of_staff",
    "plan",
    2,
    ["gbr_w_new_armies", "gbr_w_manpower"],
    { topic: "west", when: war },
  ),
  task(
    "salonika",
    "chief_of_staff",
    "plan",
    2,
    ["gbr_w_salonika", "gw_o_grc_salonika"],
    { topic: "balkan", when: months(9) },
  ),
  // Munitions, once the ministry is filled.
  task(
    "mun_shells",
    "munitions",
    "study",
    1,
    ["gbr_hf_women_shells", "gbr_inv_acetone", "gbr_a_o_inquiry_r"],
    { topic: "shells", when: war },
  ),
  task(
    "unions",
    "munitions",
    "report",
    1,
    ["gbr_h_unions", "gbr_lb_clyde", "gbr_lb_coal", "gbr_lb_may"],
    { topic: "strikes", when: war },
  ),
  // The Household.
  task("honours", "court", "report", 1, ["gbr_dept_honours"], {
    topic: "honours",
    cooldown: 4,
  }),
  task("windsor", "court", "report", 1, ["gbr_dept_windsor"], {
    topic: "windsor",
    when: months(24),
    once: true,
  }),
  // MO5 and the code breakers.
  task(
    "codes",
    "intelligence",
    "report",
    1,
    ["gbr_a_spy_codebook", "gbr_a_spy_read", "gw_d_cipher_book"],
    { topic: "DEU", when: war },
  ),
  task(
    "spies",
    "intelligence",
    "report",
    1,
    ["gbr_y_inc_spy", "gw_d_double_agent", "gw_spy_caught", "gbr_a_spy_fever"],
    { topic: "spies" },
  ),
];

// ---- Leans: the department's own option ----

const lean = (
  office: GwOffice,
  l: GwDeptLean["lean"],
  picks?: Record<string, string>,
  camp?: GwDeptLean["camp"],
): GwDeptLean => ({
  nation: NATION,
  office,
  ...(camp === undefined ? {} : { camp }),
  lean: l,
  ...(picks === undefined ? {} : { picks }),
});

const LEANS: GwDeptLean[] = [
  // Grey's office: no binding word, little said in public.
  lean("foreign", "gentle", {
    gbr_c_naval_talks: "vague",
    gbr_h_lansdowne: "stay_silent",
    gbr_f_mcmahon: "vague_lines",
  }),
  // A hard man at the Treasury spends to win; a moderate one counts.
  lean("finance", "bold", { gbr_f_morgan: "sign_morgan" }, "hard"),
  lean("finance", "cheap", {
    gbr_c_city: "bank_holiday",
    gbr_f_morgan: "sign_morgan",
  }),
  // The Admiralty kept the fleet together in July 1914.
  lean("navy", "bold", {
    gbr_c_fleet_stays: "keep_fleet",
    gbr_w_naval_only: "ships_only",
  }),
  lean("sea_lord", "firm", { gbr_w_naval_only: "hear_fisher" }, "hard"),
  lean("sea_lord", "wait"),
  // The Home Office's lawyers: let the law take its course.
  lean("interior", "calm", { gbr_dept_casement: "hang" }),
  lean("intelligence", "firm", { gbr_dept_casement: "hang_diaries" }),
  lean("ireland", "calm", { gbr_h_ireland_talks: "convention" }),
  lean("war", "firm", undefined, "military"),
  lean("war", "calm"),
  // The general staff wants every division in France.
  lean("chief_of_staff", "firm", { gbr_w_salonika: "words_only" }),
  lean("munitions", "bold"),
  // Stamfordham found the name Windsor.
  lean("court", "wait", {
    gbr_dept_windsor: "house_and_titles",
    gbr_dept_honours: "as_drawn",
  }),
];

// ---- Wants ----

const want = (
  id: string,
  who: { office: GwOffice } | { person: string },
  when?: GwCond,
  cover?: string,
): GwDeptWant => ({
  id,
  nation: NATION,
  ...who,
  ...(when === undefined ? {} : { when }),
  ...(cover === undefined ? {} : { cover }),
});

const WANTS: GwDeptWant[] = [
  want("gbr_want_fm_allies", { office: "foreign" }, war),
  want("gbr_want_fm_free", { office: "foreign" }),
  want("gbr_want_fin_dollars", { office: "finance" }, war),
  want("gbr_want_fin_budget", { office: "finance" }),
  want("gbr_want_navy_fleet", { office: "navy" }),
  want("gbr_want_sea_escorts", { office: "sea_lord" }, war),
  want("gbr_want_home_quiet", { office: "interior" }),
  want("gbr_want_ire_home_rule", { office: "ireland" }),
  want("gbr_want_war_armies", { office: "war" }, war),
  want("gbr_want_cos_france", { office: "chief_of_staff" }, war),
  want("gbr_want_mun_hands", { office: "munitions" }),
  want("gbr_want_court_crown", { office: "court" }),
  want("gbr_want_intel_men", { office: "intelligence" }),
  // People's own: a cunning man shows a cover until the dossier has him.
  want(
    "gbr_want_lg_lead",
    { person: "gbr_lloyd_george" },
    war,
    "gbr_want_lg_cover",
  ),
  want("gbr_want_churchill_straits", { person: "gbr_churchill" }, war),
  want("gbr_want_redmond_word", { person: "gbr_redmond" }, war),
  want(
    "gbr_want_northcliffe_power",
    { person: "gbr_northcliffe" },
    war,
    "gbr_want_northcliffe_cover",
  ),
];

// ---- Levers: the PM advises the Crown's gifts ----

const pride = (delta: number): GwEffect => ({
  kind: "pride",
  who: role("who"),
  delta,
});

const LEVERS: GwLeverRow[] = [
  {
    id: "gbr_lv_peerage",
    nation: NATION,
    lever: "honour",
    effects: [pride(2)],
  },
  {
    id: "gbr_lv_knighthood",
    nation: NATION,
    lever: "honour",
    effects: [pride(1)],
  },
  // The whips' list: a title for a gift to the party chest. A secret.
  {
    id: "gbr_lv_fund",
    nation: NATION,
    lever: "honour",
    when: flag("f_pm_lg"),
    effects: [
      pride(1),
      inst("commons", 1),
      { kind: "rumour", delta: 1 },
      remember("k_gbr_fund_honours"),
    ],
  },
  // A seat at the table with little to run: the Duchy of Lancaster.
  {
    id: "gbr_lv_duchy",
    nation: NATION,
    lever: "post",
    people: "cabinet",
    once: true,
    effects: [inst("cabinet", 1)],
  },
];

// ---- New papers ----

/** A department's paper of its own: it reaches the head's tray. */
const paper = (
  id: string,
  cast: GwScene["cast"],
  more: Partial<GwScene> & Pick<GwScene, "variants" | "options" | "fallback">,
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  cast,
  salience: 6,
  tags: ["home"],
  ...more,
});

/** A ceremony's card (acts/gbr.ts): what the seat saw there. */
const rite = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  cast: {},
  salience: 5,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  byAct: true,
  noBack: true,
  stamp: "confirmed",
  source: "own_eyes",
});

export const GBR_DEPT_SCENES: readonly GwScene[] = [
  // #1: the honours list, at the new year and the King's birthday.
  paper(
    "gbr_dept_honours",
    { court: holder("court") },
    {
      author: "court",
      tags: ["home", "people"],
      salience: 5,
      cooldown: 4,
      max: 6,
      when: world({ is: "month", of: [12, 6] }),
      variants: [v("lg", flag("f_pm_lg")), v("war", war), v("base")],
      fallback: "as_drawn",
      options: [
        o("as_drawn", ["cabinet:+1"], [inst("cabinet", 1)]),
        o(
          "front_first",
          ["opinion:+1", "cabinet:-1"],
          [opinion("army", 1), inst("cabinet", -1)],
        ),
        o(
          "fund_names",
          ["commons:+1"],
          [
            inst("commons", 1),
            { kind: "rumour", delta: 1 },
            remember("k_gbr_fund_honours"),
          ],
        ),
        o(
          "short_list",
          ["opinion:+1", "cabinet:-1"],
          [opinion("press", 1), inst("cabinet", -1)],
        ),
      ],
    },
  ),
  // #4: Casement's reprieve, after a rising in Ireland.
  paper(
    "gbr_dept_casement",
    { home: holder("interior"), intel: holder("intelligence") },
    {
      author: "home",
      once: true,
      salience: 7,
      when: all(war, flag("f_gbr_rising")),
      variants: [
        v("petition", world({ is: "neutral", tag: "USA" })),
        v("base"),
      ],
      fallback: "hang",
      options: [
        o(
          "spare",
          ["irish:+1", "usa:+1", "opposition:+1"],
          [
            inst("irish", 1),
            { kind: "trust", tag: "USA", delta: 1 },
            inst("opposition", 1),
            { kind: "pressure", topic: "ireland", delta: -1 },
          ],
        ),
        o(
          "hang",
          ["irish:-1", "usa:-1"],
          [
            inst("irish", -1),
            { kind: "trust", tag: "USA", delta: -1 },
            { kind: "pressure", topic: "ireland", delta: 1 },
          ],
        ),
        o(
          "hang_diaries",
          ["irish:-1"],
          [
            inst("irish", -1),
            { kind: "pressure", topic: "ireland", delta: 1 },
            { kind: "rumour", delta: 1 },
            remember("k_gbr_casement_diaries"),
          ],
        ),
      ],
    },
  ),
  // #11: the King's German name, in the third year of the war.
  paper(
    "gbr_dept_windsor",
    { court: holder("court") },
    {
      author: "court",
      once: true,
      tags: ["home", "people"],
      when: all(
        months(30),
        { kind: "person_active", person: "gbr_george_v" },
        not(memory("k_gbr_windsor")),
      ),
      variants: [v("raids", seen("gbr_w_air_raids")), v("base")],
      fallback: "house_and_titles",
      options: [
        o(
          "house_and_titles",
          ["opinion:+1", "king:+1"],
          [opinion("press", 1), trustOf(king, 1), remember("k_gbr_windsor")],
        ),
        o(
          "name_only",
          ["opinion:+1"],
          [opinion("press", 1), remember("k_gbr_windsor")],
        ),
        o(
          "leave_it",
          ["king:-1", "opinion:-1"],
          [trustOf(king, -1), opinion("press", -1)],
        ),
      ],
    },
  ),
  // The ceremonies' cards.
  rite("gbr_a_c_investiture_r", [
    v("fund", memory("k_gbr_fund_honours")),
    v("war", war),
    v("base"),
  ]),
  rite("gbr_a_c_privy_council_r", [v("base")]),
  rite("gbr_a_c_review_r", [v("base")]),
  rite("gbr_a_c_memorial_r", [v("base")]),
];

export const GBR_DEPTS: GwDeptContent = {
  tasks: TASKS,
  leans: LEANS,
  wants: WANTS,
  levers: LEVERS,
};
