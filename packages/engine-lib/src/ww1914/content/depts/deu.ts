// ww196: DEU's departments. Lane W-DEU owns this file and
// resources/ww1914/ko/DEU.depts.json: the seat's answer rows over the common
// task types and its own types (aims, poland, franchise), their `then` links
// to existing papers, the honours rows and orders, leans and wants.
//
// Papers kept from ww193 (design ww195 §3): the privy purse's requests (#10),
// the foreign office's drafts for letters to kin on neutral thrones (#2), the
// Prussian house's dissolution plan with the OHL's counter-paper (#3), and the
// cards the schedule's entries play (content/acts/deu.ts). The honours list
// (#1) is gone: honours come at their occasions (HONOURS below, Honours.ts).
import type {
  GwAnswerRow,
  GwCourseRow,
  GwDeptContent,
  GwFindingRow,
  GwHonourOrder,
  GwHonourRow,
  GwLean,
  GwTaskRow,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  all,
  any,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  holder,
  memory,
  not,
  remember,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["DEU"];
const DEU: ["DEU"] = ["DEU"];
const war: GwCond = world({ is: "war" });
const months = (min: number): GwCond => world({ is: "war_months", min });
const neutral = (tag: "GRC" | "ROU" | "ITA" | "BGR" | "OTT" | "USA"): GwCond =>
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

/** Warsaw and beyond are ours on the eastern front. */
const warsawOurs: GwCond = world({
  is: "front",
  theatre: "east",
  from: "warsaw",
  to: "kiev",
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
/** ww193 merge: Marie is queen only once Ferdinand is king (10 Oct 1914). */
const queenMarie: GwCond = world({ is: "date", from: "1914-11" });

function kinDraft(id: string, tag: "GRC" | "ROU", key: string): GwScene {
  return {
    id,
    nation: NATION,
    kind: "proposal",
    when:
      tag === "ROU"
        ? all(war, neutral(tag), queenMarie)
        : all(war, neutral(tag)),
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
  // and the interior bring the dissolution plan. Taking it opens the power
  // `deu_pw_landtag` on the 통치 tab (powers/deu.ts); the OHL's counter-paper
  // comes with the plan through the rival rule (depts/common.ts, ww193 merge).
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
        [],
        [
          { kind: "flag", flag: "f_deu_landtag_plan" },
          remember("k_deu_landtag_plan"),
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
    // The chancellery's or the interior's plan; the general staff answers.
    cast: {
      a: { any_of: [{ office: "chancellor" }, { office: "interior" }] },
      b: holder("chief_of_staff"),
    },
    author: "b",
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [v("base")],
    fallback: "back_b",
    options: [
      o("back_a", ["army:-1", "order:+1"], [army(-1), gauge("order", 1)]),
      o(
        "back_b",
        ["army:+1", "opinion:-2", "order:-1"],
        [
          army(1),
          opinion("workers", -2),
          gauge("order", -1),
          remember("k_deu_landtag_kept"),
          { kind: "unflag", flag: "f_deu_landtag_plan" },
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
      v("front", world({ is: "score", min: 10 })),
      v("works", all(months(18), { kind: "gauge", gauge: "shells", min: 2 })),
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
// ---- ww196: own task types (design ww195 §3) ----
// The common types (envoy, front, money, bread, unrest, fleet, arms, men,
// intel) are offered without rows, to the offices of GW_TASK_OFFICES.DEU.

const OWN_TASKS: GwTaskRow[] = [
  {
    id: "deu_task_aims",
    nation: DEU,
    office: "chancellor",
    type: "aims",
    chapters: 2,
    when: all(war, months(1)),
    cooldown: 12,
  },
  {
    id: "deu_task_poland",
    nation: DEU,
    office: "chancellor",
    type: "poland",
    chapters: 2,
    when: all(war, warsawOurs),
    cooldown: 12,
  },
  {
    id: "deu_task_franchise",
    nation: DEU,
    office: "interior",
    type: "franchise",
    chapters: 2,
    when: all(war, months(6)),
    cooldown: 12,
  },
];

// ---- ww196: the answers (GwAnswerRow), seat rows before the common ones ----

const fd = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
const co = (
  id: string,
  lean: GwLean[],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });
const ans = (
  id: string,
  type: GwAnswerRow["type"],
  findings: GwFindingRow[],
  courses: GwCourseRow[],
  more: Partial<GwAnswerRow> = {},
): GwAnswerRow => ({
  id: `deu_ans_${id}`,
  nation: DEU,
  type,
  findings,
  courses,
  ...more,
});
const ready = (tag: "ITA" | "ROU" | "BGR" | "OTT" | "USA", delta: number) =>
  doWorld({ do: "readiness", tag, delta });
const entered = (tag: "ITA" | "ROU" | "BGR" | "OTT" | "USA"): GwCond =>
  world({ is: "entered", tag });
const until = (to: string): GwCond => world({ is: "date", to });
const since = (from: string): GwCond => world({ is: "date", from });
const mem = (key: string): GwEffect => remember(key);

const ANSWERS: GwAnswerRow[] = [
  // ---- envoy: 외무부 ----
  ans(
    "ita",
    "envoy",
    [
      fd("trentino", 3),
      fd("vienna_deaf", 3),
      fd("bulow", 2, { when: all(since("1914-12"), until("1915-05")) }),
      fd("stays_out", 1, { wrong: true, truth: not(entered("ITA")) }),
    ],
    [
      co("press_vienna", ["gentle", "calm"], [ready("ITA", -3)], {
        then: ["gw_o_ita_trentino"],
        needs: [{ kind: "consent", tag: "AUH" }],
      }),
      co("pay_rome", ["bold"], [ready("ITA", -2), gauge("money", -1)], {
        then: ["gw_o_ita_asks"],
        needs: [{ kind: "money", word: "much" }],
      }),
      co("let_go", ["firm", "cheap"], [opinion("army", 1)]),
      co("wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["ITA"], when: all(war, neutral("ITA")), question: "reach" },
  ),
  ans(
    "rou",
    "envoy",
    [
      fd("king", 3, { slots: { ruler: ["*"] } }),
      fd("transylvania", 3),
      fd("grain_oil", 2),
      fd("waits_winner", 2, { slots: { readiness: ["far", "near"] } }),
      fd("with_us", 1, {
        wrong: true,
        truth: not(world({ is: "entered", tag: "ROU", side: "entente" })),
      }),
    ],
    [
      co("buy_grain", ["cheap", "calm"], [gauge("bread", 1)], {
        then: ["gw_o_rou_grain"],
        needs: [{ kind: "money", word: "some" }],
      }),
      co("press_vienna", ["gentle"], [ready("ROU", -3)], {
        then: ["gw_o_rou_transylvania"],
        needs: [{ kind: "consent", tag: "AUH" }],
      }),
      co("warn", ["firm", "bold"], [ready("ROU", 2)], {
        then: ["gw_o_rou_moment"],
      }),
      co("wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["ROU"], when: all(war, neutral("ROU")), question: "reach" },
  ),
  ans(
    "bgr",
    "envoy",
    [
      fd("macedonia", 3),
      fd("ferdinand", 2, { slots: { ruler: ["*"] } }),
      fd("loan", 2),
      fd("bidding", 2, { slots: { bidders: ["bidding"] } }),
    ],
    [
      co("promise_macedonia", ["bold"], [ready("BGR", 3)], {
        then: ["gw_o_bgr_macedonia"],
      }),
      co("loan", ["cheap", "calm"], [ready("BGR", 2), gauge("money", -1)], {
        needs: [{ kind: "money", word: "some" }],
      }),
      co("wait", ["wait", "gentle"], [], { wait: true }),
    ],
    { topic: ["BGR"], when: all(war, neutral("BGR")), question: "reach" },
  ),
  ans(
    "ott",
    "envoy",
    [
      fd("enver", 3),
      fd("ships", 3, { when: neutral("OTT") }),
      fd("wangenheim", 2, { when: until("1915-10") }),
      fd("gold", 2),
      fd("india", 2, { when: entered("OTT") }),
    ],
    [
      co("give_ships", ["bold"], [ready("OTT", 4)], {
        when: neutral("OTT"),
        then: ["gw_o_ott_ships"],
      }),
      co("gold", ["calm", "gentle"], [ready("OTT", 2), gauge("money", -1)], {
        then: ["gw_o_ott_price"],
        needs: [{ kind: "money", word: "much" }],
      }),
      co("india_road", ["bold", "firm"], [mem("k_deu_india_road")], {
        when: entered("OTT"),
        then: ["gw_d_india_road"],
      }),
      co("officers", ["cheap", "calm"], [opinion("army", 1)], {
        needs: [{ kind: "person", office: "chief_of_staff" }],
      }),
    ],
    { topic: ["OTT"], when: war, question: "person" },
  ),
  ans(
    "usa",
    "envoy",
    [
      fd("munitions", 3),
      fd("bernstorff", 2, { when: until("1917-02") }),
      fd("wilson", 2),
      fd("notes", 2, { when: { kind: "seen", scene: "deu_w_sub_note" } }),
      fd("never_comes", 1, { wrong: true, truth: not(entered("USA")) }),
    ],
    [
      co("mediation", ["gentle", "calm"], [ready("USA", -2)], {
        then: ["deu_s_wilson_mediation"],
      }),
      co("protest_arms", ["firm"], [ready("USA", 1)], {
        then: ["gw_o_usa_arms"],
      }),
      co("polite_no", ["cheap", "wait"], []),
    ],
    { topic: ["USA"], when: all(war, neutral("USA")), question: "reach" },
  ),
  ans(
    "gbr",
    "envoy",
    [
      fd("lichnowsky", 3, {
        slots: { envoy: ["*"] },
        when: not(war),
      }),
      fd("grey", 3, { when: not(war) }),
      fd("belgium", 3, { when: atWar("GBR") }),
      fd("blockade", 2, { when: atWar("GBR") }),
      fd("stays_out", 1, { wrong: true, truth: not(atWar("GBR")) }),
    ],
    [
      co("neutral_word", ["gentle", "calm"], [mem("k_deu_gbr_sounded")], {
        when: not(war),
        then: ["deu_w_gbr_neutral"],
      }),
      co("belgium_price", ["gentle"], [opinion("army", -1)], {
        when: atWar("GBR"),
        then: ["deu_s_belgium_price"],
      }),
      co("fleet_word", ["bold"], [opinion("court", 1)], {
        when: not(war),
        then: ["deu_y_talks_offer"],
      }),
      co("no_word", ["firm", "cheap"], [opinion("press", 1)]),
    ],
    { topic: ["GBR"], question: "reach" },
  ),
  ans(
    "rus",
    "envoy",
    [
      fd("andersen", 3),
      fd("court_party", 2),
      fd("revolution", 2, { when: months(18) }),
      fd("nicky_yields", 1, {
        wrong: true,
        truth: world({ is: "out", tag: "RUS" }),
      }),
    ],
    [
      co("copenhagen", ["gentle", "calm"], [mem("k_deu_rus_sounded")], {
        then: ["deu_s_separate_russia"],
      }),
      co("terms", ["bold"], [mem("k_deu_rus_terms")], {
        then: ["deu_w_separate_peace"],
        needs: [{ kind: "consent", tag: "AUH" }],
      }),
      co("press_on", ["firm"], [opinion("army", 1)]),
    ],
    { topic: ["RUS"], when: atWar("RUS"), question: "person" },
  ),
  ans(
    "auh",
    "envoy",
    [
      fd("conrad", 3),
      fd("tschirschky", 2, { when: until("1916-11") }),
      fd("nations", 2),
      fd("money", 2),
      fd("separate", 1, { when: months(24) }),
    ],
    [
      co("summit", ["calm", "gentle"], [mem("k_deu_vienna_summit")], {
        when: war,
        then: ["gw_d_ally_summit"],
      }),
      co("money", ["gentle"], [gauge("money", -1)], {
        when: war,
        then: ["gw_d_ally_money"],
        needs: [{ kind: "money", word: "much" }],
      }),
      co("command", ["firm", "bold"], [opinion("army", 1)], {
        when: atWar("RUS"),
        then: ["deu_f_unified_command"],
      }),
      co("renew", ["calm"], [], {
        when: not(war),
        then: ["deu_y_ally_renew"],
      }),
    ],
    { topic: ["AUH"], question: "person" },
  ),
  ans(
    "neutrals",
    "envoy",
    [fd("iron", 3), fd("food", 2), fd("blockade_list", 2)],
    [
      co(
        "quiet_deal",
        ["calm", "gentle"],
        [gauge("money", -1), gauge("bread", 1)],
        {
          then: ["gw_o_swe_iron", "gw_o_nld_food"],
        },
      ),
      co("press", ["firm"], [opinion("press", 1)], {
        then: ["gw_o_dnk_belt"],
      }),
    ],
    {
      topic: ["SWE", "NLD", "DNK", "NOR", "CHE"],
      when: all(war, atWar("GBR")),
      question: "money",
    },
  ),

  // ---- front: 참모본부 ----
  ans(
    "west",
    "front",
    [
      fd("line", 3, { slots: { line: ["*"] } }),
      fd("enemy", 3, { slots: { enemy: ["*"] } }),
      fd("shells_low", 2, { slots: { shells: ["low"] } }),
      fd("shells_ok", 2, { slots: { shells: ["middling", "high"] } }),
      fd("two_fronts", 2),
      fd("they_crack", 1, {
        wrong: true,
        truth: world({
          is: "battle",
          theatre: "west",
          of: ["break", "advance"],
          by: "seat",
        }),
      }),
    ],
    [
      co("attack", ["bold"], [gauge("morale", 1)], {
        front: "attack",
        then: ["deu_f_offensive_month"],
        thenAfter: 3,
        needs: [{ kind: "divisions", word: "many" }],
      }),
      co("depth", ["calm", "cheap"], [], {
        front: "hold",
        then: ["deu_f_somme_doctrine"],
      }),
      co("withdraw", ["firm", "cheap"], [opinion("army", -1)], {
        front: "shorten",
        then: ["deu_f_withdraw_line"],
      }),
      co("east_first", ["gentle"], [], {
        front: "shift",
        when: atWar("RUS"),
        then: ["deu_f_east1_year"],
      }),
    ],
    { topic: ["west"], when: war, question: "person" },
  ),
  ans(
    "east",
    "front",
    [
      fd("line", 3, { slots: { line: ["*"] } }),
      fd("commander", 2, { slots: { commander: ["*"] } }),
      fd("rails", 2),
      fd("ally_weak", 2),
      fd("russia_spent", 1, {
        wrong: true,
        truth: world({ is: "out", tag: "RUS" }),
      }),
    ],
    [
      co("push", ["bold"], [gauge("morale", 1)], {
        front: "attack",
        then: ["deu_w_east_first", "deu_f_gorlice"],
        needs: [{ kind: "divisions", word: "many" }],
      }),
      co("help_vienna", ["gentle", "calm"], [], {
        front: "hold",
        then: ["deu_f_brusilov_help"],
        needs: [{ kind: "consent", tag: "AUH" }],
      }),
      co("strip_east", ["cheap", "firm"], [], {
        front: "shift",
        when: world({ is: "out", tag: "RUS" }),
        then: ["deu_f_east_garrison"],
      }),
    ],
    { topic: ["east"], when: atWar("RUS"), question: "person" },
  ),
  ans(
    "balkan",
    "front",
    [
      fd("serbia", 3),
      fd("road", 3),
      fd("bulgaria", 2, { when: entered("BGR") }),
    ],
    [
      co("german_lead", ["bold", "firm"], [opinion("army", 1)], {
        front: "attack",
        when: entered("BGR"),
        then: ["deu_f_serbia_road"],
      }),
      co("shells_by_rail", ["calm"], [gauge("shells", -1)], {
        when: world({ is: "open", theatre: "straits" }),
        then: ["deu_f_straits_shells"],
      }),
      co("vienna_alone", ["cheap", "wait"], [], { front: "hold" }),
    ],
    { topic: ["balkan"], when: war, question: "person" },
  ),
  ans(
    "italy",
    "front",
    [fd("isonzo", 3), fd("ally_asks", 2), fd("alps", 2)],
    [
      co("send_corps", ["bold"], [opinion("army", 1)], {
        front: "attack",
        then: ["deu_f_italy_corps"],
        needs: [{ kind: "divisions", word: "few" }],
      }),
      co("no_men", ["cheap", "firm"], [], { front: "hold" }),
    ],
    {
      topic: ["italy"],
      when: world({ is: "entered", tag: "ITA", side: "entente" }),
      question: "person",
    },
  ),

  // ---- money: 재무부 ----
  ans(
    "money",
    "money",
    [
      fd("treasury_low", 3, { slots: { treasury: ["low"] } }),
      fd("treasury_ok", 3, { slots: { treasury: ["middling", "high"] } }),
      fd("no_reich_tax", 3),
      fd("loan_bureaus", 2, { when: war }),
      fd("enemy_pays", 1, { wrong: true }),
    ],
    [
      co(
        "loan",
        ["calm", "gentle"],
        [gauge("money", 1), opinion("business", 1)],
        {
          when: war,
          then: ["deu_w_first_loan", "deu_h_loan_drive"],
        },
      ),
      co(
        "profits_tax",
        ["firm"],
        [opinion("business", -1), opinion("workers", 1)],
        {
          when: war,
          then: ["deu_h_war_profits"],
        },
      ),
      co("print", ["cheap", "bold"], [gauge("money", 1)], {
        when: war,
        then: ["gw_x_prices"],
        thenAfter: 3,
      }),
      co("budget", ["calm"], [], {
        when: not(war),
        then: ["deu_y_arms_price"],
      }),
    ],
    { question: "money" },
  ),

  // ---- bread: 내무부 ----
  ans(
    "bread",
    "bread",
    [
      fd("bread_low", 3, { slots: { bread: ["low"] } }),
      fd("bread_ok", 3, { slots: { bread: ["middling", "high"] } }),
      fd("blockade", 3, { when: atWar("GBR") }),
      fd("pigs", 2, { when: months(6) }),
      fd("states", 2),
      fd("prices", 2, { slots: { prices: ["middling", "high"] } }),
      fd("harvest_saves", 1, {
        wrong: true,
        truth: { kind: "gauge", gauge: "bread", min: 2 },
      }),
    ],
    [
      co("cards", ["firm", "calm"], [gauge("order", 1)], {
        then: ["deu_w_bread_cards"],
        needs: [{ kind: "bill", law: "deu_bread_cards" }],
      }),
      co("price_caps", ["cheap"], [opinion("workers", 1)], {
        then: ["deu_h_price_caps"],
      }),
      co("food_office", ["bold"], [opinion("parliament", 1)], {
        when: months(18),
        then: ["deu_h_food_office"],
        needs: [{ kind: "bill", law: "deu_food_office" }],
      }),
      co("pigs", ["firm", "bold"], [gauge("bread", 1)], {
        when: atWar("GBR"),
        then: ["deu_h_pig_cull"],
      }),
    ],
    { when: war, question: "money" },
  ),

  // ---- unrest: 내무부 ----
  ans(
    "unrest",
    "unrest",
    [
      fd("agitators", 3, { slots: { agitators: ["*"] } }),
      fd("strikes", 3, { slots: { strikes: ["middling", "high"] } }),
      fd("quiet", 2, { slots: { strikes: ["low"] } }),
      fd("burgfrieden", 2, { when: war }),
      fd("foreign_money", 1, { wrong: true }),
    ],
    [
      co("arrest", ["firm"], [gauge("order", 1), opinion("workers", -1)], {
        then: ["deu_h_liebknecht_may"],
      }),
      co("ban_rallies", ["calm", "cheap"], [gauge("order", 1)], {
        then: ["deu_p_rally_ban"],
      }),
      co(
        "hear_unions",
        ["gentle"],
        [opinion("workers", 1), opinion("army", -1)],
      ),
    ],
    { question: "person" },
  ),

  // ---- fleet: 해군부 ----
  ans(
    "fleet",
    "fleet",
    [
      fd("ratio_low", 3, { slots: { fleet: ["low", "middling"] } }),
      fd("ratio_ok", 3, { slots: { fleet: ["high"] } }),
      fd("blockade", 3, {
        when: atWar("GBR"),
        slots: { blockade: ["middling", "high"] },
      }),
      fd("uboats", 2, { when: atWar("GBR") }),
      fd("coal", 1),
      fd("grand_fleet_out", 1, { wrong: true }),
    ],
    [
      co("sortie", ["bold"], [gauge("morale", 1)], {
        when: atWar("GBR"),
        then: ["deu_w_fleet_out"],
      }),
      co("in_being", ["calm", "wait"], []),
      co("uboat_zone", ["firm", "bold"], [opinion("army", 1)], {
        when: atWar("GBR"),
        then: ["deu_w_sub_note"],
      }),
      co("novelle", ["bold"], [gauge("money", -1)], {
        when: not(war),
        then: ["deu_w_peace_novelle"],
      }),
    ],
    { question: "money" },
  ),

  // ---- arms: 육군부 ----
  ans(
    "arms",
    "arms",
    [
      fd("shells_low", 3, { slots: { shells: ["low"] } }),
      fd("shells_ok", 3, { slots: { shells: ["middling", "high"] } }),
      fd("nitrate", 3, { when: atWar("GBR") }),
      fd("raw", 2),
      fd("skilled", 2, { when: months(12) }),
    ],
    [
      co("raw_office", ["calm", "bold"], [gauge("shells", 1)], {
        then: ["deu_w_raw_materials"],
      }),
      co("nitrate_plants", ["bold"], [gauge("money", -1)], {
        then: ["deu_w_shell_crisis"],
        needs: [{ kind: "money", word: "much" }],
      }),
      co("industry", ["cheap", "gentle"], [opinion("business", 1)], {
        then: ["deu_f_new_arms"],
      }),
      co("skilled_back", ["firm"], [gauge("shells", 1)], {
        when: months(12),
        then: ["deu_lb_reclaim"],
      }),
    ],
    { when: war, question: "money" },
  ),

  // ---- men: 육군부 ----
  ans(
    "men",
    "men",
    [
      fd("losses", 3),
      fd("next_class", 3),
      fd("exempt", 2),
      fd("women", 2, { when: months(12) }),
    ],
    [
      co(
        "call_class",
        ["firm", "bold"],
        [doWorld({ do: "manpower", delta: 1 })],
        {
          then: ["deu_f_last_classes"],
        },
      ),
      co("women", ["gentle", "cheap"], [opinion("workers", 1)], {
        when: months(12),
        then: ["deu_h_women_work"],
      }),
      co("aux_law", ["bold"], [opinion("parliament", -1)], {
        when: months(24),
        needs: [{ kind: "bill", law: "deu_aux" }],
      }),
    ],
    { when: war, question: "person" },
  ),

  // ---- intel: IIIb ----
  ans(
    "intel",
    "intel",
    [
      fd("press", 2),
      fd("rails", 2, { slots: { stance: ["enemy"] } }),
      fd("mood", 2),
      fd("double", 1, { wrong: true }),
    ],
    [
      co("more_men", ["bold"], [gauge("money", -1)], {
        then: ["deu_spy_read"],
      }),
      co("false_trail", ["firm"], [mem("k_deu_false_trail")]),
      co("as_is", ["cheap", "calm"], []),
    ],
    { when: war, question: "money" },
  ),

  // ---- own: 재상부, 내무부 ----
  ans(
    "aims",
    "aims",
    [
      fd("september", 3),
      fd("annexationists", 3),
      fd("reichstag", 2, { when: months(24) }),
      fd("belgium", 2),
      fd("easy_peace", 1, { wrong: true }),
    ],
    [
      co("hold_secret", ["calm", "wait"], [], {
        then: ["deu_w_war_aims"],
      }),
      co(
        "big_aims",
        ["bold", "firm"],
        [opinion("army", 1), opinion("workers", -1)],
        {
          then: ["deu_k_war_aims_gag"],
        },
      ),
      co(
        "small_aims",
        ["gentle"],
        [opinion("parliament", 1), opinion("army", -1)],
        {
          then: ["gw_d_aims_asked"],
        },
      ),
    ],
    { question: "reach" },
  ),
  ans(
    "poland",
    "poland",
    [fd("legion", 3), fd("vienna_wants", 3), fd("recruits", 2), fd("strip", 2)],
    [
      co("with_vienna", ["gentle", "calm"], [], {
        then: ["deu_s_poland_kingdom"],
        needs: [{ kind: "consent", tag: "AUH" }],
      }),
      co("strip", ["firm", "bold"], [opinion("army", 1)], {
        then: ["deu_ld_occ_rus_long"],
      }),
      co("council", ["cheap"], [], {
        then: ["deu_oc_client"],
      }),
    ],
    { question: "person" },
  ),
  ans(
    "franchise",
    "franchise",
    [
      fd("three_class", 3),
      fd("lords", 3),
      fd("trenches", 2),
      fd("russia", 2, {
        when: not(world({ is: "regime", tag: "RUS", of: ["tsar"] })),
      }),
    ],
    [
      co("word_after", ["calm", "wait"], [opinion("workers", 1)], {
        then: ["deu_k_three_class"],
      }),
      co(
        "bill_now",
        ["bold", "gentle"],
        [opinion("workers", 1), opinion("court", -1)],
        {
          needs: [{ kind: "bill", law: "deu_three_class" }],
        },
      ),
      co(
        "not_now",
        ["firm", "cheap"],
        [opinion("court", 1), opinion("workers", -1)],
      ),
    ],
    { question: "reach" },
  ),
];

// ---- ww196: honours (design ww195 §4; facts ww196-facts.md DEU) ----

const ORDERS: GwHonourOrder[] = [
  {
    id: "deu_or_black_eagle",
    nation: DEU,
    rank: 1,
    pools: ["generals", "heads"],
  },
  { id: "deu_or_merite", nation: DEU, rank: 1, pools: ["generals"] },
  {
    id: "deu_or_iron_cross_1",
    nation: DEU,
    rank: 2,
    pools: ["generals", "soldier"],
    from: "1914-08-05",
  },
  {
    id: "deu_or_red_eagle",
    nation: DEU,
    rank: 2,
    pools: ["heads", "officials", "industry"],
  },
  {
    id: "deu_or_iron_cross_2",
    nation: DEU,
    rank: 3,
    pools: ["soldier", "officials", "industry"],
    from: "1914-08-05",
  },
  {
    id: "deu_or_crown",
    nation: DEU,
    rank: 3,
    pools: ["officials", "industry"],
  },
  {
    id: "deu_or_war_aid",
    nation: DEU,
    rank: 3,
    pools: ["industry", "officials"],
    from: "1916-12-05",
  },
];

const HONOURS: GwHonourRow[] = [
  // The January list: the Kaiser's birthday, 27 Jan (the Ordensfest of 18 Jan
  // in wartime is unchecked: the list goes out on the birthday, no feast).
  {
    id: "deu_oc_january",
    nation: DEU,
    occasion: "date",
    day: "01-27",
    pools: ["generals", "heads", "officials", "industry"],
    orders: [
      "deu_or_black_eagle",
      "deu_or_red_eagle",
      "deu_or_crown",
      "deu_or_iron_cross_1",
      "deu_or_war_aid",
    ],
    from: ["court", "chancellor", "chief_of_staff"],
  },
  // Pour le Mérite and the Iron Cross any time, on the OHL's or the military
  // cabinet's proposal: after a won front, at sea after a battle.
  {
    id: "deu_oc_victory",
    nation: DEU,
    occasion: "victory",
    when: war,
    pools: ["generals", "soldier"],
    orders: ["deu_or_merite", "deu_or_iron_cross_1", "deu_or_iron_cross_2"],
    from: ["chief_of_staff", "war"],
  },
  {
    id: "deu_oc_sea",
    nation: DEU,
    occasion: "victory",
    theatre: ["sea"],
    when: war,
    pools: ["generals", "soldier"],
    orders: ["deu_or_merite", "deu_or_iron_cross_1"],
    from: ["navy"],
  },
  {
    id: "deu_oc_deed",
    nation: DEU,
    occasion: "deed",
    when: war,
    pools: ["soldier"],
    orders: ["deu_or_iron_cross_1", "deu_or_iron_cross_2"],
    from: ["chief_of_staff"],
  },
  {
    id: "deu_oc_petition",
    nation: DEU,
    occasion: "petition",
    when: war,
    pools: ["generals", "heads", "industry"],
    orders: ["deu_or_merite", "deu_or_iron_cross_1", "deu_or_war_aid"],
    from: ["chief_of_staff", "war", "navy"],
  },
];

export const DEU_DEPTS: GwDeptContent = {
  tasks: OWN_TASKS,
  answers: ANSWERS,
  honours: HONOURS,
  orders: ORDERS,
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
      picks: { deu_dept_purse: "widows" },
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
};
