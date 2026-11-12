// ww193: RUS's departments. Lane W-RUS owns this file and
// resources/ww1914/ko/RUS.depts.json: task rows pointing at existing papers,
// leans, wants, levers, and the new papers the design asks for (ww191's #1
// St George, #2 kin letters, #5 church posts, #8 mercy, #10 the purse).
//
// Task rows list existing papers first, most particular first; a bill row
// names its law's draft first (the engine lays it only when it holds), then
// the papers that argue it. The kin letters and the ceremonies are acts in
// acts/rus.ts; their scenes are here (`byAct`), their words in RUS.depts.json.
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
  GwOption,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  character,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const war = world({ is: "war" });
const reign = world({ is: "regime", of: ["tsar", "crown"] });
const inWar = all(war, reign);
const atWar = (tag: "OTT" | "ROU" | "GRC"): GwCond => ({
  kind: "at_war",
  tag,
});
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });

type Ear = "court" | "stavka" | "duma" | "ministers";
type Gauge = "shells" | "bread" | "money" | "morale" | "order";
type Bloc = "army" | "court" | "parliament" | "business" | "workers" | "press";
const ear = (inst: Ear, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const gauge = (g: Gauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const opinion = (bloc: Bloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const remember = (key: string): GwEffect => ({ kind: "remember", key });
const ruler = (
  side: "family" | "conscience" | "reputation",
  delta: number,
  key: string,
): GwEffect => ({ kind: "ruler", side, delta, key });
const trustOf = (person: string, delta: number): GwEffect => ({
  kind: "person_trust",
  who: { person },
  delta,
});
const pride = (delta: number): GwEffect => ({
  kind: "pride",
  who: role("who"),
  delta,
});
const low = (g: Gauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (who: string): GwCond => ({ kind: "tone_fits", who: role(who) });

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, tell: string[], effects: GwEffect[]): GwOption => ({
  id,
  tell,
  effects,
});

// ---- Task rows ----

const task = (
  id: string,
  office: GwTaskRow["office"],
  kind: GwTaskRow["kind"],
  chapters: number,
  products: string[],
  more: Partial<GwTaskRow> = {},
): GwTaskRow => ({
  id: `rus_task_${id}`,
  nation: ["RUS"],
  office,
  kind,
  chapters,
  products,
  ...more,
});

const TASKS: GwTaskRow[] = [
  // 외무부 (Sazonov): the neutrals, the allies, the straits.
  task(
    "romania",
    "foreign",
    "plan",
    2,
    [
      "rus_wv_join_rou_claims",
      "gw_o_rou_moment",
      "gw_o_rou_transylvania",
      "gw_o_rou_grain",
    ],
    { topic: "ROU", when: all(reign, not(atWar("ROU"))) },
  ),
  task(
    "bulgaria",
    "foreign",
    "plan",
    2,
    ["gw_o_bgr_macedonia", "rus_wv_own_bgr"],
    { topic: "BGR", when: reign },
  ),
  task("italy", "foreign", "terms", 2, ["gw_o_ita_asks", "gw_o_ita_london"], {
    topic: "ITA",
    when: inWar,
  }),
  task("greece", "foreign", "plan", 2, ["gw_o_grc_king", "gw_o_grc_salonika"], {
    topic: "GRC",
    when: all(reign, not(atWar("GRC"))),
  }),
  task(
    "straits",
    "foreign",
    "terms",
    2,
    [
      "rus_wv_war_ott_straits",
      "gw_d_carve_ottoman",
      "gw_o_ott_price",
      "rus_ap_tsargrad_corps",
      "rus_y_inc_straits_shut",
    ],
    { topic: "straits", when: reign },
  ),
  task(
    "poland",
    "foreign",
    "plan",
    2,
    [
      "gw_law_rus_poland",
      "rus_c_poland_word",
      "gw_d_poland_word",
      "rus_ld_ours_poles",
      "rus_oc_ruled_poland",
    ],
    { topic: "poland", when: reign },
  ),
  task(
    "allies",
    "foreign",
    "terms",
    1,
    [
      "rus_y_ally_crack",
      "rus_y_ally_renew",
      "gw_d_ally_summit",
      "gw_d_offer_card",
      "gw_d_ally_shells",
    ],
    { topic: "allies", when: reign },
  ),
  task(
    "sep_peace",
    "foreign",
    "terms",
    3,
    [
      "rus_wv_peace_offer_deu",
      "gw_o_ott_peace",
      "gw_d_peace_reply",
      "gw_d_sounding",
    ],
    { topic: "sep_peace", when: all(inWar, months(6)), cooldown: 4 },
  ),
  task("persia", "foreign", "plan", 1, ["rus_y_inc_persia", "gw_o_per_oil"], {
    topic: "persia",
    when: reign,
  }),
  // #2: the draft of a letter to a cousin on a neutral throne.
  task("kin_rou", "foreign", "plan", 1, ["rus_dept_kin_rou"], {
    topic: "ROU",
    when: all(reign, not(atWar("ROU"))),
    cooldown: 4,
  }),
  task("kin_grc", "foreign", "plan", 1, ["rus_dept_kin_grc"], {
    topic: "GRC",
    when: all(reign, not(atWar("GRC"))),
    cooldown: 4,
  }),
  // 각료회의 (Goremykin): the Duma, the cabinet, Finland.
  task(
    "duma",
    "chancellor",
    "plan",
    1,
    ["gov_rus_duma_2", "rus_h_peace_duma", "pr_rus_parliament"],
    { topic: "duma", when: reign },
  ),
  task(
    "cabinet",
    "chancellor",
    "report",
    1,
    ["gov_rus_cabinet_2", "rus_r_crown_war"],
    { topic: "cabinet", when: reign },
  ),
  task("finland", "chancellor", "bill", 2, ["gw_law_rus_finland"], {
    topic: "finland",
    when: reign,
    once: true,
  }),
  // 농업부 (Krivoshein): grain, wagons, the land.
  task(
    "grain",
    "agriculture",
    "study",
    2,
    [
      "gw_law_rus_grain",
      "rus_h_grain_levy",
      "rus_hf_hunger",
      "rus_sh_fats",
      "rus_h_wagons",
    ],
    { topic: "bread", when: reign },
  ),
  task(
    "land",
    "agriculture",
    "plan",
    3,
    ["gw_law_rus_peasants", "rus_y_home_reform"],
    { topic: "land", when: reign, cooldown: 6 },
  ),
  // 재무부 (Bark): roubles, loans, drink.
  task(
    "money",
    "finance",
    "study",
    1,
    ["rus_h_rubles", "gw_x_prices", "rus_y_arms_price"],
    { topic: "money", when: reign },
  ),
  task(
    "loan",
    "finance",
    "terms",
    2,
    ["rus_y_arms_rail_loan", "gw_d_ally_money", "gw_o_usa_loans"],
    { topic: "loan", when: reign },
  ),
  task("dry", "finance", "bill", 1, ["gw_law_rus_dry", "rus_c_vodka"], {
    topic: "dry",
    when: reign,
  }),
  // 육군부 (Sukhomlinov): shells, rifles, men, the occupied lands.
  task(
    "shells",
    "war",
    "study",
    1,
    [
      "rus_c_first_shells",
      "rus_w_rifles",
      "rus_h_war_industry",
      "rus_sh_nitrates",
      "rus_sh_copper",
    ],
    { topic: "shells", when: inWar },
  ),
  // The retired 숫자 조사 act (rus_a_o_figures): its paper comes from here.
  task("rails", "war", "study", 1, ["rus_a_o_figures_s"], {
    topic: "rails",
    when: reign,
    cooldown: 4,
  }),
  task(
    "manpower",
    "war",
    "bill",
    2,
    ["gw_law_rus_ratniki", "rus_w_depots", "rus_cs_asia_decree"],
    { topic: "manpower", when: inWar },
  ),
  task(
    "councils",
    "war",
    "bill",
    2,
    ["gw_law_rus_councils", "gw_law_rus_factories", "rus_h_war_industry"],
    { topic: "councils", when: all(inWar, months(6)) },
  ),
  task(
    "army_bill",
    "war",
    "bill",
    2,
    ["gw_law_rus_great_programme", "rus_y_arms_bill", "rus_h_peace_programme"],
    { topic: "army_bill", when: reign },
  ),
  task(
    "wounded",
    "war",
    "study",
    1,
    ["rus_hf_wounded", "rus_hf_pows_ours", "rus_hf_women_factories"],
    { topic: "wounded", when: all(inWar, months(3)) },
  ),
  task(
    "galicia",
    "war",
    "plan",
    2,
    ["rus_oc_galicia", "rus_ld_ours_galicia", "rus_oc_requisition"],
    { topic: "galicia", when: inWar },
  ),
  // 참모본부 (Yanushkevich): a plan for a front, the army's state.
  task(
    "front",
    "chief_of_staff",
    "plan",
    2,
    [
      "rus_w_carpathians",
      "rus_w_naroch",
      "rus_w_evert_holds",
      "rus_w_kovel",
      "rus_w_berlin_road",
      "rus_w_romania",
    ],
    { topic: "east", when: inWar },
  ),
  task(
    "caucasus",
    "chief_of_staff",
    "plan",
    2,
    ["rus_w_caucasus_snow", "rus_wv_front_caucasus", "rus_wv_own_ott"],
    { topic: "caucasus", when: all(inWar, atWar("OTT")) },
  ),
  task(
    "army",
    "chief_of_staff",
    "report",
    1,
    ["pr_rus_army", "rus_w_mogilev", "rus_y_arms_rival"],
    { topic: "army", when: reign },
  ),
  // 해군부 (Grigorovich): the Black Sea and the Baltic.
  task(
    "black_sea",
    "navy",
    "plan",
    2,
    [
      "rus_w_bosporus_plan",
      "rus_cs_goeben_hunt",
      "rus_cs_trebizond",
      "rus_y_inc_dreadnoughts",
    ],
    { topic: "black_sea", when: reign },
  ),
  task(
    "baltic",
    "navy",
    "plan",
    2,
    ["rus_cs_baltic_mines", "rus_cs_baltic_riga", "rus_y_ally_staff"],
    { topic: "baltic", when: reign },
  ),
  // 내무부 (Maklakov): the streets, the papers, refugees, and mercy (#8).
  task(
    "strikes",
    "interior",
    "report",
    1,
    ["pr_rus_workers", "rus_y_home_strike", "rus_lb_unions"],
    { topic: "strikes", when: reign },
  ),
  task("rumour", "interior", "report", 1, ["pr_rus_rumour", "pr_rus_press"], {
    topic: "rumour",
    when: reign,
  }),
  task(
    "refugees",
    "interior",
    "plan",
    1,
    ["rus_h_refugees", "rus_hf_refugees", "gw_x_refugees"],
    { topic: "refugees", when: all(inWar, months(6)) },
  ),
  task(
    "pale",
    "interior",
    "bill",
    2,
    ["gw_law_rus_pale", "gw_law_rus_amnesty", "gw_law_rus_press"],
    { topic: "pale", when: reign },
  ),
  task("mercy", "interior", "report", 1, ["rus_dept_mercy"], {
    topic: "mercy",
    when: reign,
    cooldown: 4,
  }),
  // 궁내부 (Fredericks): the honours list (#1), the purse (#10), the Synod (#5).
  task("honours", "court", "plan", 1, ["rus_dept_honours"], {
    topic: "honours",
    when: inWar,
    cooldown: 4,
  }),
  task("purse", "court", "report", 1, ["rus_dept_purse"], {
    topic: "purse",
    when: reign,
    cooldown: 4,
  }),
  task("synod", "court", "plan", 2, ["rus_dept_synod"], {
    topic: "synod",
    when: reign,
    cooldown: 6,
  }),
  // 정보부 (Batyushin): the enemy's rails and wires, the neutrals, traitors.
  task(
    "spies",
    "intelligence",
    "report",
    2,
    ["rus_spy_rail", "rus_spy_galicia", "rus_spy_read"],
    { pick: "country", from: ["DEU", "AUH"], when: inWar },
  ),
  task("neutrals", "intelligence", "report", 2, ["rus_spy_neutral"], {
    topic: "neutrals",
    when: inWar,
  }),
  task(
    "traitors",
    "intelligence",
    "report",
    2,
    ["rus_spy_hunt", "rus_ag_hire"],
    { topic: "traitors", when: inWar },
  ),
];

// ---- Leans: the option a department marks as its own ----

const lean = (
  office: GwDeptLean["office"],
  l: GwDeptLean["lean"],
  more: Partial<GwDeptLean> = {},
): GwDeptLean => ({ nation: ["RUS"], office, lean: l, ...more });

const LEANS: GwDeptLean[] = [
  lean("foreign", "gentle", {
    picks: {
      gw_o_rou_transylvania: "promise_land",
      rus_wv_join_rou_claims: "haggle",
      gw_o_ita_london: "cut_dalmatia",
      gw_o_bgr_macedonia: "press_serbia",
      rus_wv_war_ott_straits: "say_it",
      gw_d_carve_ottoman: "sign",
      rus_c_poland_word: "let_it_stand",
    },
  }),
  lean("chancellor", "wait", {
    camp: "court",
    picks: { gov_rus_duma_2: "recess" },
  }),
  lean("chancellor", "calm"),
  lean("agriculture", "calm"),
  lean("finance", "cheap", { picks: { rus_h_rubles: "gold_to_london" } }),
  lean("war", "calm", {
    camp: "duma",
    picks: {
      gw_law_rus_councils: "with_zemgor",
      rus_h_war_industry: "workers_group",
    },
  }),
  lean("war", "firm"),
  lean("chief_of_staff", "firm", {
    picks: { rus_ld_theirs_jews: "expel", rus_ld_theirs_poland: "scorch" },
  }),
  lean("navy", "bold"),
  lean("interior", "calm", { camp: "duma" }),
  lean("interior", "firm", {
    picks: { pr_rus_workers: "arrest", rus_lb_unions: "refuse" },
  }),
  lean("court", "wait"),
  lean("intelligence", "firm", { picks: { rus_spy_hunt: "sign" } }),
];

// ---- Wants ----

const want = (
  id: string,
  who: Pick<GwDeptWant, "office"> | Pick<GwDeptWant, "person">,
  more: Partial<GwDeptWant> = {},
): GwDeptWant => ({ id: `rus_want_${id}`, nation: ["RUS"], ...who, ...more });

const WANTS: GwDeptWant[] = [
  want("fm_straits", { office: "foreign" }, { when: atWar("OTT") }),
  want("fm_allies", { office: "foreign" }),
  want("pm_quiet", { office: "chancellor" }),
  want("agr_grain", { office: "agriculture" }, { when: inWar }),
  want("agr_land", { office: "agriculture" }, { cover: "rus_want_agr_cover" }),
  want("fin_loan", { office: "finance" }, { cover: "rus_want_fin_cover" }),
  want("war_name", { office: "war" }, { cover: "rus_want_war_cover" }),
  want("cos_shells", { office: "chief_of_staff" }, { when: inWar }),
  want("cos_ready", { office: "chief_of_staff" }),
  want("navy_ships", { office: "navy" }),
  want("int_order", { office: "interior" }, { cover: "rus_want_int_cover" }),
  want("court_door", { office: "court" }),
  want(
    "spy_files",
    { office: "intelligence" },
    { cover: "rus_want_spy_cover" },
  ),
  // #5: the Empress petitions for the Friend's man; he hides his own aim.
  want(
    "empress_synod",
    { person: "rus_alexandra" },
    { when: all(inWar, months(10)) },
  ),
  want("empress_home", { person: "rus_alexandra" }),
  want(
    "friend_men",
    { person: "rus_rasputin" },
    { cover: "rus_want_friend_cover" },
  ),
];

// ---- Levers ----

const lever = (
  id: string,
  kind: GwLeverRow["lever"],
  people: GwLeverRow["people"],
  when: GwCond,
  effects: GwEffect[],
): GwLeverRow => ({
  id: `rus_lv_${id}`,
  nation: ["RUS"],
  lever: kind,
  people,
  when,
  effects,
});

const LEVERS: GwLeverRow[] = [
  lever("st_george", "honour", "own", inWar, [pride(1), opinion("army", 1)]),
  lever("nevsky", "honour", "cabinet", reign, [pride(1), ear("ministers", 1)]),
  lever("council_seat", "post", "cabinet", reign, [pride(1), ear("court", 1)]),
  lever("purse", "purse", "own", reign, [
    ruler("reputation", 1, "rus_dept_purse_gift"),
  ]),
  lever("pardon", "pardon", "own", reign, [
    opinion("parliament", -1),
    ear("court", 1),
  ]),
];

// ---- New papers ----

const headed = { head: { called: true as const } };

/** A department's paper the engine brings for its task (`called` head). */
const brought = (
  id: string,
  kind: "proposal" | "report",
  tags: GwScene["tags"],
  variants: GwVariant[],
  options: GwOption[] = [],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind,
  cast: headed,
  author: "head",
  salience: 5,
  tags,
  scheduledOnly: true,
  variants,
  ...(options.length > 0 ? { options, fallback: options[0].id } : {}),
  ...more,
});

/** #1: who gets the white cross. Shared by the task and the initiative. */
const HONOURS: GwOption[] = [
  o(
    "generals",
    ["army:+1", "stavka:+1"],
    [opinion("army", 1), ear("stavka", 1)],
  ),
  o("ranks", ["morale:+1", "court:-1"], [gauge("morale", 1), ear("court", -1)]),
  o(
    "court_list",
    ["court:+1", "army:-1"],
    [ear("court", 1), opinion("army", -1)],
  ),
  o("later", [], [remember("rus_dept_honours_later")]),
];

const lostEast = world({
  is: "battle",
  theatre: "east",
  of: ["break", "advance"],
  by: "foe",
});
const wonEast = world({
  is: "battle",
  theatre: "east",
  of: ["break", "advance"],
  by: "seat",
});

/** Read-only report the foreign office writes for a letter: tone advice. */
const kinAdvice = (id: string, cast: GwScene["cast"], who: string): GwScene =>
  brought(
    id,
    "report",
    ["foreign"],
    [
      v("sly", character(role(who), "opportunist")),
      v("careful", character(role(who), "cautious")),
      v("hard", character(role(who), "hardline")),
      v("base"),
    ],
    [],
    { cast: { ...headed, ...cast }, stamp: "estimate" },
  );

/** A letter act's reply card (acts/rus.ts plays it). */
const reply = (
  id: string,
  cast: GwScene["cast"],
  who: string,
  variants: GwVariant[],
  options: GwOption[],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "letter",
  who,
  cast,
  salience: 6,
  tags: ["foreign"],
  variants,
  options,
  fallback: options[0].id,
  noBack: true,
  scheduledOnly: true,
  byAct: true,
});

/** A ceremony's card (acts/rus.ts plays it). */
const rite = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "report",
  cast: {},
  salience: 6,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  byAct: true,
});

export const RUS_DEPT_SCENES: readonly GwScene[] = [
  // #1 St George: the list the court ministry brings.
  brought(
    "rus_dept_honours",
    "proposal",
    ["home", "war"],
    [v("lost", lostEast), v("won", wonEast), v("base")],
    HONOURS,
  ),
  // #1: the same list, unasked, after a victory or at the new year.
  {
    id: "rus_dept_honours_win",
    nation: ["RUS"],
    kind: "proposal",
    cast: { head: { office: "court" } },
    author: "head",
    salience: 4,
    tags: ["home", "war"],
    when: all(inWar, any(wonEast, world({ is: "month", of: [1] }))),
    max: 3,
    variants: [v("victory", wonEast), v("base")],
    options: HONOURS,
    fallback: "later",
  },
  // #10 the privy purse.
  brought(
    "rus_dept_purse",
    "proposal",
    ["home"],
    [v("hungry", low("bread", 1)), v("war", inWar), v("base")],
    [
      o(
        "red_cross",
        ["morale:+1"],
        [gauge("morale", 1), ruler("reputation", 1, "rus_dept_purse_hospital")],
      ),
      o(
        "the_poor",
        ["opinion:+1"],
        [opinion("workers", 1), ruler("conscience", 1, "rus_dept_purse_poor")],
      ),
      o(
        "bonds",
        ["money:+1", "opinion:+1"],
        [
          gauge("money", 1),
          opinion("business", 1),
          ruler("family", -1, "rus_dept_purse_bonds"),
        ],
      ),
      o("keep", ["court:+1"], [ear("court", 1)]),
    ],
  ),
  // #5 the Synod's list: the Empress's man against the Synod's.
  brought(
    "rus_dept_synod",
    "proposal",
    ["home", "people"],
    [v("war", inWar), v("base")],
    [
      o(
        "synod_man",
        ["duma:+1", "trust:-1"],
        [ear("duma", 1), trustOf("rus_alexandra", -1)],
      ),
      o(
        "her_man",
        ["court:+1", "duma:-1", "trust:+1"],
        [
          ear("court", 1),
          ear("duma", -1),
          { kind: "rumour", delta: 1 },
          trustOf("rus_alexandra", 1),
        ],
      ),
      o("leave_empty", [], [remember("rus_dept_synod_left")]),
    ],
    { cast: { ...headed, empress: { person: "rus_alexandra" } } },
  ),
  // #8 mercy: the case file and the families' petition.
  brought(
    "rus_dept_mercy",
    "proposal",
    ["home", "people"],
    [v("war", inWar), v("base")],
    [
      o(
        "pardon",
        ["opinion:+1", "army:-1"],
        [
          opinion("parliament", 1),
          opinion("army", -1),
          ruler("conscience", 1, "rus_dept_mercy_given"),
        ],
      ),
      o("commute", ["duma:+1"], [ear("duma", 1)]),
      o(
        "let_stand",
        ["army:+1", "opinion:-1"],
        [
          opinion("army", 1),
          opinion("workers", -1),
          ruler("conscience", -1, "rus_dept_mercy_refused"),
        ],
      ),
    ],
  ),
  // #2: the foreign office's draft advice for a cousin's letter.
  kinAdvice("rus_dept_kin_rou", { queen: { person: "rou_marie" } }, "queen"),
  kinAdvice(
    "rus_dept_kin_grc",
    { king: { person: "grc_constantine" } },
    "king",
  ),
  // #2: the cousins' replies.
  reply(
    "rus_a_l_marie_r",
    { queen: { person: "rou_marie" } },
    "queen",
    [
      v("join_fits", all(picked("subject", "join"), fits("queen"))),
      v("join", picked("subject", "join")),
      v("grain", picked("subject", "grain")),
      v("fits", fits("queen")),
      v("base"),
    ],
    [
      o("file", [], []),
      o(
        "show_fm",
        ["rou:+1", "ministers:+1"],
        [{ kind: "trust", tag: "ROU", delta: 1 }, ear("ministers", 1)],
      ),
    ],
  ),
  reply(
    "rus_a_l_tino_r",
    { king: { person: "grc_constantine" } },
    "king",
    [
      v("stay_out", picked("subject", "stay_out")),
      v("fits", fits("king")),
      v("base"),
    ],
    [
      o("file", [], []),
      o("show_allies", ["gbr:+1"], [{ kind: "trust", tag: "GBR", delta: 1 }]),
    ],
  ),
  // Ceremonies (acts/rus.ts).
  rite("rus_a_c_st_george_s", [
    v("hall", picked("place", "hall")),
    v("stavka", picked("place", "stavka")),
    v("base"),
  ]),
  rite("rus_a_c_panikhida_s", [v("long", months(12)), v("base")]),
  rite("rus_a_c_icon_s", [v("thin", low("shells", 1)), v("base")]),
];

export const RUS_DEPTS: GwDeptContent = {
  tasks: TASKS,
  leans: LEANS,
  wants: WANTS,
  levers: LEVERS,
};
