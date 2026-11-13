// ww196: AUH's departments. Lane W-AUH owns this file and
// resources/ww1914/ko/AUH.depts.json: the answer rows over the common task
// types and Austria's own (`ausgleich` with Budapest, `nations`), their task
// rows, the honours rows at their occasions (the emperor's birthday, Karl's
// coronation, the war crosses, the Maria Theresa Order through its chapter),
// leans, wants, and the papers of the ww193 design that stay: the privy purse
// (#10), Karl's last orders (#6: the fleet to Zagreb, the Hungarian regiments
// home) and the welfare ministries with Budapest's counter-paper (#7), plus
// the ceremonies the schedule plays (acts/auh.ts). ww196 dropped the product
// task rows, the gifts (levers) and the old honours paper: honours come at
// their occasions now (engine Honours.ts).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAnswerRow,
  GwCourseRow,
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwFindingRow,
  GwHonourOrder,
  GwHonourRow,
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
  schedule,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { REICHSRAT_OPEN } from "../house/houses";
import {
  atWar,
  berlinAt,
  between,
  ffThrone,
  gauge,
  hungaryAt,
  inst,
  inWar,
  italyIn,
  karl,
  opinion,
  peace,
  since,
  trust,
  until,
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
const holds = (office: GwTaskRow["office"], person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
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

export const AUH_DEPT_SCENES: readonly GwScene[] = [
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

// ---- ww196: answers (design ww195 §2-3) ----
// Each row adds findings and courses to the answer of a task of its type;
// the common rows (common.ts) add theirs after. Findings and courses that
// name a slot gate on it. Text: depts.answers.<row>.

const f = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
const c = (
  id: string,
  lean: GwCourseRow["lean"],
  effects: GwEffect[],
  more: Partial<GwCourseRow> = {},
): GwCourseRow => ({ id, lean, effects, ...more });
const answer = (
  id: string,
  type: GwAnswerRow["type"],
  findings: GwFindingRow[],
  courses: GwCourseRow[],
  more: Partial<GwAnswerRow> = {},
): GwAnswerRow => ({ id, nation: AUH, type, findings, courses, ...more });

const offer = (tag: GwTag, value: number): GwEffect =>
  doWorld({ do: "offer", tag, value });
const readiness = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "readiness", tag, delta });
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const neutral = (tag: GwTag): GwCond => world({ is: "neutral", tag });
const lost = (theatre: "east" | "balkan" | "italy"): GwCond =>
  world({ is: "battle", theatre, of: ["advance", "break"], by: "foe" });
const berlinConsent = { kind: "consent", tag: "DEU" } as const;
const conradCos = holds("chief_of_staff", "auh_conrad");
const tiszaPm = holds("hun_pm", "auh_tisza");
/** Bulgaria fights on our side (its zone in Serbia, its Dobruja). */
const bgrIn = world({ is: "entered", tag: "BGR", side: "central" });
/** Courses for a country still to be won over. */
const unwon = { stance: ["neutral", "leans_us", "leans_them"] };

const ANSWERS: GwAnswerRow[] = [
  // 외무부 (Ballhausplatz): Romania, while it sits out.
  answer(
    "auh_ans_rou",
    "envoy",
    [
      f("price", 3),
      f("king", 2, { slots: { ruler: ["*"] }, when: until("1917-12") }),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("close", 3, { slots: { readiness: ["close"] } }),
      f("far", 1, { slots: { readiness: ["far"] } }),
      f("stays_out", 2, { wrong: true, truth: neutral("ROU") }),
    ],
    [
      c(
        "bukovina",
        ["gentle", "bold"],
        [offer("ROU", 2), opinion("army", -1)],
        {
          slots: unwon,
        },
      ),
      c("schools", ["calm", "cheap"], [offer("ROU", 1), inst("hungary", -1)], {
        slots: unwon,
        needs: [{ kind: "bill", law: "auh_transylvania" }],
        then: ["auh_h_transylvania"],
      }),
      c(
        "warn",
        ["firm"],
        [readiness("ROU", -1), trust("ROU", -1), inst("berlin", 1)],
        { slots: unwon, needs: [berlinConsent] },
      ),
      c("wait", ["wait"], [], { wait: true }),
    ],
    {
      office: "foreign",
      topic: ["ROU"],
      when: not(atWar("ROU")),
      question: "reach",
    },
  ),
  // Italy, before May 1915: Article 7 and the Trentino.
  answer(
    "auh_ans_ita",
    "envoy",
    [
      f("art7", 3),
      f("trentino", 3),
      f("bulow", 2, { when: between("1914-12", "1915-05") }),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("giolitti", 2, { wrong: true, truth: neutral("ITA") }),
    ],
    [
      c(
        "trentino",
        ["gentle", "bold"],
        [offer("ITA", 3), opinion("army", -1), inst("berlin", -1)],
      ),
      c("talk_long", ["wait", "calm", "cheap"], [offer("ITA", 1)]),
      c(
        "refuse",
        ["firm"],
        [trust("ITA", -1), readiness("ITA", 1), opinion("army", 1)],
      ),
    ],
    {
      office: "foreign",
      topic: ["ITA"],
      when: not(italyIn),
      question: "reach",
    },
  ),
  // Berlin, in the war: the ally that lends divisions and takes command.
  answer(
    "auh_ans_deu",
    "envoy",
    [
      f("west_first", 3),
      f("command", 2, { when: berlinAt({ min: 2 }) }),
      f("customs", 2, { when: months(12) }),
      f("tschirschky", 1, { when: until("1916-10") }),
      f("winter", 2, { wrong: true }),
    ],
    [
      c("help", ["gentle", "calm"], [inst("berlin", 1), trust("DEU", 1)]),
      c(
        "press",
        ["firm", "bold"],
        [
          doWorld({ do: "force", tag: "DEU", theatre: "east", delta: 1 }),
          inst("berlin", 1),
          trust("DEU", -1),
        ],
        { needs: [berlinConsent] },
      ),
      c("own_way", ["bold", "cheap"], [inst("berlin", -1), trust("DEU", -1)]),
    ],
    { office: "foreign", topic: ["DEU"], when: inWar },
  ),
  // Bulgaria, while it can still be bought.
  answer(
    "auh_ans_bgr",
    "envoy",
    [
      f("macedonia", 3),
      f("tsar", 2, { slots: { ruler: ["*"] } }),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("loan", 1),
    ],
    [
      c("macedonia", ["bold", "gentle"], [offer("BGR", 2)], { slots: unwon }),
      c("win_first", ["wait", "calm"], [], { slots: unwon, wait: true }),
      c("berlin_pays", ["cheap"], [offer("BGR", 1), inst("berlin", 1)], {
        slots: unwon,
        needs: [berlinConsent],
      }),
    ],
    {
      office: "foreign",
      topic: ["BGR"],
      when: not(atWar("BGR")),
      question: "reach",
    },
  ),
  // 참모본부: the Russian front.
  answer(
    "auh_ans_east",
    "front",
    [
      f("line", 3, { slots: { line: ["*"] } }),
      f("commander", 2, { slots: { commander: ["*"] } }),
      f("passes", 2, { when: atWar("RUS") }),
      f("broken", 3, { when: lost("east") }),
      f("czechs", 1),
      f("germans", 2, { when: berlinAt({ min: 1 }) }),
      f("russians_spent", 2, { wrong: true, truth: won("east") }),
    ],
    [
      c("attack", ["bold", "firm"], [gauge("shells", -1)], {
        front: "attack",
        needs: [{ kind: "divisions" }],
        then: ["auh_w_carpathian"],
      }),
      c("with_germans", ["gentle"], [inst("berlin", 1), opinion("army", -1)], {
        front: "attack",
        needs: [berlinConsent],
      }),
      c("hold", ["calm", "cheap", "wait"], [], { front: "hold" }),
      c("shorten", ["cheap"], [opinion("army", -1)], { front: "shorten" }),
    ],
    { office: "chief_of_staff", topic: ["east"], when: atWar("RUS") },
  ),
  // The Serbian front.
  answer(
    "auh_ans_balkan",
    "front",
    [
      f("line", 3, { slots: { line: ["*"] } }),
      f("commander", 2, { slots: { commander: ["*"] } }),
      f("typhus", 2, { when: between("1914-12", "1915-06") }),
      f("mackensen", 2, { when: since("1915-09") }),
      f("hills", 1),
      f("serbs_spent", 2, { wrong: true, truth: won("balkan") }),
    ],
    [
      c("attack", ["bold", "firm"], [gauge("shells", -1)], {
        front: "attack",
        needs: [{ kind: "divisions" }],
      }),
      c("hold", ["calm", "cheap", "wait"], [], { front: "hold" }),
      c("to_italy", ["gentle"], [opinion("army", -1)], {
        front: "shift",
        when: italyIn,
      }),
      c("to_east", ["gentle"], [opinion("army", -1)], {
        front: "shift",
        when: not(italyIn),
      }),
    ],
    { office: "chief_of_staff", topic: ["balkan"], when: atWar("SRB") },
  ),
  // The Italian front.
  answer(
    "auh_ans_italy",
    "front",
    [
      f("line", 3, { slots: { line: ["*"] } }),
      f("commander", 2, { slots: { commander: ["*"] } }),
      f("cadorna", 2, { when: until("1917-10") }),
      f("tyrol", 2, { when: conradCos }),
      f("mules", 2, { slots: { shells: ["low", "middling"] } }),
      f("italians_spent", 2, { wrong: true, truth: won("italy") }),
    ],
    [
      c("hold", ["calm", "cheap", "wait"], [], { front: "hold" }),
      c("tyrol_strike", ["bold", "firm"], [gauge("shells", -1)], {
        front: "attack",
        needs: [{ kind: "divisions" }],
      }),
      c("with_germans", ["gentle"], [inst("berlin", 1), opinion("army", -1)], {
        front: "attack",
        needs: [berlinConsent],
      }),
    ],
    { office: "chief_of_staff", topic: ["italy"], when: italyIn },
  ),
  // 공동 재무부: the war's money.
  answer(
    "auh_ans_money",
    "money",
    [
      f("empty", 3, { slots: { treasury: ["low"] } }),
      f("notes", 3),
      f("quota", 2),
      f("loan_vienna", 2),
      f("berlin_debt", 2, { when: berlinAt({ min: 1 }) }),
      f("crown_holds", 1, { wrong: true }),
    ],
    [
      c(
        "war_loan",
        ["calm", "gentle"],
        [gauge("money", 1), opinion("business", 1)],
      ),
      c(
        "print",
        ["cheap", "bold"],
        [gauge("money", 1), gauge("order", -1), opinion("workers", -1)],
      ),
      c(
        "berlin_loan",
        ["wait", "firm"],
        [gauge("money", 1), inst("berlin", 1)],
        {
          needs: [berlinConsent],
        },
      ),
    ],
    { office: "finance", when: inWar, question: "money" },
  ),
  // 오스트리아 총리실: bread.
  answer(
    "auh_ans_bread",
    "bread",
    [
      f("hungary", 3),
      f("queues", 2, { slots: { bread: ["low", "middling"] } }),
      f("war_bread", 1),
      f("galicia", 2, { when: lost("east") }),
      f("hoards", 2, { wrong: true }),
    ],
    [
      c("cards", ["firm", "calm"], [gauge("bread", 1), opinion("workers", -1)]),
      c(
        "ask_budapest",
        ["gentle", "wait"],
        [gauge("bread", 1), inst("hungary", -1)],
        {
          needs: [{ kind: "person", office: "hun_pm" }],
        },
      ),
      c("food_office", ["bold"], [gauge("bread", 1), inst("council", -1)], {
        needs: [{ kind: "bill", law: "auh_food" }],
        then: ["auh_h_food_committee"],
      }),
      c("price_cap", ["cheap"], [gauge("order", 1), opinion("business", -1)]),
    ],
    { office: "chancellor", when: inWar },
  ),
  // Unrest: strikes, the Czechs, the men back from Russia.
  answer(
    "auh_ans_unrest",
    "unrest",
    [
      f("agitators", 3, { slots: { agitators: ["*"] } }),
      f("strikes", 3, { slots: { strikes: ["high"] } }),
      f("prague", 2),
      f("returned", 2, { when: since("1918-03") }),
      f("few_men", 2, { wrong: true }),
    ],
    [
      c(
        "arrest",
        ["firm"],
        [gauge("order", 1), opinion("workers", -2), opinion("parliament", -1)],
      ),
      c("watch", ["wait", "calm", "cheap"], [], { wait: true }),
      c("listen", ["gentle"], [opinion("workers", 1), gauge("money", -1)]),
    ],
    { office: "chancellor", when: inWar },
  ),
  // 해군부: the fleet in Pola.
  answer(
    "auh_ans_fleet",
    "fleet",
    [
      f("pola", 3),
      f("outnumbered", 2, { slots: { fleet: ["low", "middling"] } }),
      f("otranto", 2, { when: italyIn }),
      f("flag", 2, { when: all(inWar, until("1916-07")) }),
      f("crews", 1, { when: months(30) }),
      f("italians_out", 2, { wrong: true }),
    ],
    [
      c("stay", ["wait", "cheap", "calm"], [], { wait: true }),
      c("raid", ["bold", "firm"], [opinion("press", 1), opinion("army", 1)], {
        when: inWar,
        then: ["auh_cs_otranto"],
      }),
      c("uboats", ["firm"], [gauge("money", -1), trust("DEU", 1)], {
        when: inWar,
      }),
      c("build", ["bold"], [gauge("money", -1), inst("hungary", -1)], {
        when: peace,
      }),
    ],
    { office: "navy" },
  ),
  // 전쟁부: shells and guns.
  answer(
    "auh_ans_arms",
    "arms",
    [
      f("skoda", 3),
      f("counted", 3, { slots: { shells: ["low"] } }),
      f("nitrates", 2),
      f("skilled", 2),
      f("rails", 1, { wrong: true }),
    ],
    [
      c("army_runs", ["firm"], [gauge("shells", 1), opinion("workers", -1)], {
        needs: [{ kind: "bill", law: "auh_factories" }],
      }),
      c(
        "owners",
        ["gentle", "calm"],
        [gauge("shells", 1), gauge("money", -1), opinion("business", 1)],
        { then: ["auh_h_factory_law"] },
      ),
      c(
        "buy_berlin",
        ["cheap", "wait"],
        [gauge("shells", 1), inst("berlin", 1)],
        { needs: [berlinConsent] },
      ),
      c("skilled_home", ["bold"], [gauge("shells", 1), manpower(-1)]),
    ],
    { office: "war", when: inWar, question: "money" },
  ),
  // Men: the next class, the Landsturm, the languages of the army.
  answer(
    "auh_ans_men",
    "men",
    [
      f("losses", 3),
      f("landsturm", 2, { when: since("1915-02") }),
      f("languages", 2),
      f("harvest", 1),
      f("reserves", 2, { wrong: true }),
    ],
    [
      c("next_class", ["firm", "calm"], [manpower(1), gauge("morale", -1)]),
      c("landsturm", ["bold"], [manpower(1), opinion("parliament", -1)], {
        needs: [{ kind: "bill", law: "auh_landsturm" }],
      }),
      c("exempt", ["cheap"], [manpower(1), opinion("business", -1)]),
      c("women", ["gentle"], [gauge("shells", 1), opinion("workers", 1)], {
        then: ["auh_hf_women_2"],
      }),
    ],
    { office: "war", when: inWar },
  ),
  // 정보국 (Evidenzbureau): what the codes say.
  answer(
    "auh_ans_intel",
    "intel",
    [
      f("rus_radio", 3, { slots: { country: ["RUS"] } }),
      f("ita_radio", 3, { slots: { country: ["ITA"] } }),
      f("srb_bands", 2, { slots: { country: ["SRB"] } }),
      f("rou_papers", 2, { slots: { country: ["ROU"] } }),
      f("bought_press", 2, {
        slots: { country: ["*"], stance: ["leans_them"] },
      }),
      f("redl", 1),
      f("mutiny", 2, { wrong: true, slots: { country: ["*"] } }),
    ],
    [
      c("more_men", ["bold", "firm"], [gauge("money", -1), opinion("army", 1)]),
      c("false_word", ["cheap", "firm"], [rumour(1)]),
      c("as_is", ["wait", "calm"], [], { wait: true }),
    ],
    { office: "intelligence", topic: ["RUS", "ITA", "SRB", "ROU"] },
  ),
  // ---- Austria's own: Budapest (헝가리 총리실) ----
  answer(
    "auh_ans_ag_quota",
    "ausgleich",
    [
      f("share", 3),
      f("renewal", 2, { when: until("1917-12") }),
      f("language", 2),
      f("army_bill", 1, { when: peace }),
    ],
    [
      c("usual", ["calm", "wait"], [], { wait: true }),
      // ww211: the Balkan winter's bill, and the recruits (1912).
      c("balkan_bill", ["cheap", "calm"], [], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_balkan_credits" }],
      }),
      c("recruits", ["bold", "firm"], [opinion("army", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_army_bill" }],
      }),
      c("more_from_pest", ["firm"], [gauge("money", 1), inst("hungary", -1)]),
      c("concede", ["gentle", "cheap"], [inst("hungary", 1), inst("army", -1)]),
    ],
    { office: "hun_pm", topic: ["quota"], question: "money" },
  ),
  answer(
    "auh_ans_ag_grain",
    "ausgleich",
    [
      f("border", 3),
      f("tisza", 2, { when: tiszaPm }),
      f("cheaper", 2, { slots: { prices: ["high", "middling"] } }),
      f("plenty", 1, { wrong: true }),
    ],
    [
      c("ask", ["gentle", "wait"], [gauge("bread", 1), inst("hungary", -1)]),
      c("committee", ["calm"], [gauge("bread", 1), inst("council", -1)], {
        needs: [{ kind: "bill", law: "auh_food" }],
      }),
      c("order", ["firm", "bold"], [gauge("bread", 1), inst("hungary", -2)]),
      c("trade", ["cheap"], [gauge("bread", 1), gauge("money", -1)]),
    ],
    { office: "hun_pm", topic: ["food"], when: inWar },
  ),
  answer(
    "auh_ans_ag_franchise",
    "ausgleich",
    [
      f("tisza_no", 3, { when: tiszaPm }),
      f("soldiers", 2),
      f("nations", 2),
      f("workers", 1, { slots: { strikes: ["middling", "high"] } }),
      f("quiet", 2, { wrong: true }),
    ],
    [
      c(
        "widen",
        ["bold", "gentle"],
        [inst("hungary", -1), opinion("workers", 1), gauge("morale", 1)],
        { needs: [{ kind: "bill", law: "auh_franchise" }] },
      ),
      c("veterans", ["calm"], [opinion("army", 1), inst("hungary", -1)]),
      // ww211: Tisza's answer to the obstruction (June 1912).
      c("house_rules", ["firm"], [inst("hungary", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_house_rules" }],
      }),
      c(
        "leave",
        ["wait", "firm", "cheap"],
        [inst("hungary", 1), opinion("workers", -1)],
        { wait: true },
      ),
    ],
    { office: "hun_pm", topic: ["franchise"] },
  ),
  // ---- Austria's own: the nations (오스트리아 총리실) ----
  answer(
    "auh_ans_na_bohemia",
    "nations",
    [
      f("kramar", 3, { when: between("1915-06", "1917-06") }),
      f("masaryk", 2, { when: since("1915-01") }),
      f("regiments", 2, { when: inWar }),
      f("loyal_union", 2, { when: since("1917-01") }),
      f("after_war", 2, { wrong: true }),
    ],
    [
      // ww211: in peace, the talks Thun and Stürgkh ran (1912-14), and the
      // house Stürgkh shut over them (16 March 1914).
      c("compromise", ["calm", "gentle"], [inst("nations", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_czech_german" }],
      }),
      c("recall", ["bold"], [opinion("parliament", 1)], {
        when: all(peace, not(REICHSRAT_OPEN)),
        needs: [{ kind: "bill", law: "auh_reichsrat" }],
      }),
      c(
        "army_rule",
        ["firm"],
        [inst("nations", -1), gauge("order", 1), opinion("parliament", -1)],
      ),
      c("talks", ["gentle", "calm"], [inst("nations", 1), opinion("army", -1)]),
      c(
        "amnesty",
        ["bold"],
        [inst("nations", 1), opinion("army", -1), opinion("parliament", 1)],
        { when: karl, then: ["auh_k_amnesty"] },
      ),
      c("wait", ["wait", "cheap"], [], { wait: true }),
    ],
    { office: "chancellor", topic: ["bohemia"] },
  ),
  answer(
    "auh_ans_na_galicia",
    "nations",
    [
      f("poles", 3),
      f("ruthenes", 2, { when: inWar }),
      f("legions", 2, { when: all(inWar, until("1917-06")) }),
      f("kingdom", 2, { when: since("1916-08") }),
      f("all_loyal", 1, { wrong: true }),
    ],
    [
      // ww211: the Galician compromise of January 1914.
      c("electoral_deal", ["calm", "gentle"], [inst("nations", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_galicia_vote" }],
      }),
      c(
        "apart",
        ["bold", "gentle"],
        [inst("nations", 1), opinion("parliament", 1)],
        { needs: [{ kind: "bill", law: "auh_galicia" }] },
      ),
      c("as_is", ["wait", "calm", "cheap"], [], { wait: true }),
      c("army", ["firm"], [inst("nations", -1), gauge("order", 1)]),
    ],
    { office: "chancellor", topic: ["galicia"] },
  ),
  answer(
    "auh_ans_na_south",
    "nations",
    [
      f("may_decl", 3, { when: since("1917-06") }),
      f("croats", 2),
      f("bosnia", 2, { when: inWar }),
      f("korosec", 2, { when: since("1917-05") }),
      f("hate_belgrade", 1, { wrong: true }),
    ],
    [
      // ww211: in peace, Croatia's suspended constitution and Bosnia's
      // emergency (1912-13).
      c("charter", ["calm", "gentle"], [inst("nations", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_croatia_charter" }],
      }),
      c("bosnia_order", ["firm"], [gauge("order", 1)], {
        when: peace,
        needs: [{ kind: "bill", law: "auh_bosnia_emergency" }],
      }),
      c("third_crown", ["bold"], [inst("nations", 1), inst("hungary", -2)]),
      c("hear", ["gentle", "calm"], [inst("nations", 1)]),
      c("refuse", ["firm", "wait"], [inst("nations", -1), inst("hungary", 1)]),
    ],
    { office: "chancellor", topic: ["south_slavs"] },
  ),
  // ---- ww199: a beaten country's fate (`settle`, the Ballhausplatz) ----
  // Each course paints a plan (Fate.settlePlan). The general staff's course,
  // `strip`, is last and the only `firm` one: an opposed chief of staff
  // brings it as his own (참모본부 안). Budapest wants no more Slavs inside
  // the monarchy; the army wants the land (the council of 7 January 1916).
  answer(
    "auh_ans_settle_srb",
    "settle",
    [
      f("budapest", 3),
      f("army", 3),
      f("bulgaria", 2, { when: bgrIn }),
      f("dynasty", 2),
      f("berlin", 1),
      f("tired", 1, { wrong: true }),
    ],
    [
      c(
        "protect",
        ["calm", "cheap"],
        [inst("hungary", 1), opinion("army", -1)],
        { settle: "vassal" },
      ),
      c(
        "north",
        ["gentle", "calm"],
        [inst("hungary", -1), inst("nations", -1)],
        { settle: "narrow" },
      ),
      c("rump", ["bold", "gentle"], [inst("hungary", 1), inst("nations", 1)], {
        settle: "wide",
      }),
      c("hold", ["wait"], [], { settle: "hold" }),
      c(
        "strip",
        ["firm"],
        [opinion("army", 1), inst("hungary", -2), inst("nations", -1)],
        { settle: "strip" },
      ),
    ],
    { office: "foreign", topic: ["SRB"] },
  ),
  answer(
    "auh_ans_settle_mne",
    "settle",
    [
      f("lovcen", 3),
      f("king", 2),
      f("clans", 2),
      f("italy", 2, { when: italyIn }),
      f("quiet", 1, { wrong: true }),
    ],
    [
      c("protect", ["calm", "gentle"], [inst("hungary", 1)], {
        settle: "vassal",
      }),
      c("hold", ["wait", "cheap"], [], { settle: "hold" }),
      c("strip", ["firm"], [opinion("army", 1), inst("nations", -1)], {
        settle: "strip",
      }),
    ],
    { office: "foreign", topic: ["MNE"] },
  ),
  answer(
    "auh_ans_settle_rou",
    "settle",
    [
      f("passes", 3),
      f("oil", 3),
      f("grain", 2),
      f("dobruja", 2, { when: bgrIn }),
      f("king", 2, { slots: { ruler: ["*"] } }),
      f("signs_all", 1, { wrong: true }),
    ],
    [
      c(
        "give_back",
        ["gentle", "calm"],
        [inst("hungary", -1), inst("berlin", 1)],
        { settle: "narrow" },
      ),
      c("protect", ["bold", "cheap"], [inst("berlin", -1)], {
        settle: "vassal",
      }),
      c("hold", ["wait", "cheap"], [gauge("bread", 1)], { settle: "hold" }),
      c(
        "strip",
        ["firm"],
        [inst("hungary", 2), opinion("army", 1), trust("ROU", -1)],
        { settle: "strip" },
      ),
    ],
    { office: "foreign", topic: ["ROU"] },
  ),
  answer(
    "auh_ans_settle_rus",
    "settle",
    [
      f("poles", 3),
      f("berlin_poland", 3),
      f("ukraine", 2),
      f("galicia_ask", 2),
      f("lublin", 2),
      f("no_return", 1, { wrong: true }),
    ],
    [
      c("states", ["bold", "gentle"], [inst("nations", 1), inst("berlin", 1)], {
        settle: "wide",
      }),
      c("lublin", ["cheap", "calm"], [inst("nations", -1)], {
        settle: "narrow",
      }),
      c("hold", ["wait"], [gauge("bread", 1)], { settle: "hold" }),
      c(
        "strip",
        ["firm"],
        [opinion("army", 1), inst("nations", -1), inst("berlin", 1)],
        { settle: "strip" },
      ),
    ],
    { office: "foreign", topic: ["RUS"] },
  ),
  answer(
    "auh_ans_settle_ita",
    "settle",
    [
      f("veneto", 3),
      f("pope", 2),
      f("hungry", 2),
      f("berlin", 2),
      f("old_venetia", 1),
      f("italy_done", 1, { wrong: true }),
    ],
    [
      c("give_back", ["gentle", "calm"], [opinion("army", -1)], {
        settle: "narrow",
      }),
      c("protect", ["bold"], [opinion("army", 1), inst("nations", -1)], {
        settle: "vassal",
      }),
      c("hold", ["wait", "cheap"], [gauge("bread", 1)], { settle: "hold" }),
      c("strip", ["firm"], [opinion("army", 1), trust("ITA", -1)], {
        settle: "strip",
      }),
    ],
    { office: "foreign", topic: ["ITA"] },
  ),
  // Any other country the monarchy beats (Albania, Greece, …).
  answer(
    "auh_ans_settle",
    "settle",
    [f("budapest", 3), f("army", 2), f("berlin", 2), f("neutrals", 1)],
    [
      c("protect", ["calm", "gentle"], [inst("hungary", 1)], {
        settle: "vassal",
      }),
      c("give_back", ["gentle", "cheap"], [opinion("army", -1)], {
        settle: "narrow",
      }),
      c("hold", ["wait"], [], { settle: "hold" }),
      c("strip", ["firm"], [opinion("army", 1), inst("hungary", -1)], {
        settle: "strip",
      }),
    ],
    {
      office: "foreign",
      topic: ["ALB", "GRC", "BGR", "OTT", "BEL", "FRA", "DEU", "GBR"],
    },
  ),
];

// ---- Task rows: Austria's own types (common types need none) ----

const task = (
  id: string,
  office: GwTaskRow["office"],
  type: GwTaskRow["type"],
  topic: string,
  more: Partial<GwTaskRow> = {},
): GwTaskRow => ({
  id,
  nation: AUH,
  office,
  type,
  topic,
  chapters: 2,
  // The bargain and the nations move slowly: asked less often (ww196 merge).
  cooldown: 18,
  ...more,
});

const TASKS: GwTaskRow[] = [
  // 헝가리 총리실: the bargain with Budapest.
  task("auh_task_ag_quota", "hun_pm", "ausgleich", "quota"),
  task("auh_task_ag_grain", "hun_pm", "ausgleich", "food", { when: inWar }),
  task("auh_task_ag_franchise", "hun_pm", "ausgleich", "franchise", {
    chapters: 3,
  }),
  // 오스트리아 총리실: the nations.
  task("auh_task_na_bohemia", "chancellor", "nations", "bohemia"),
  task("auh_task_na_galicia", "chancellor", "nations", "galicia"),
  task("auh_task_na_south", "chancellor", "nations", "south_slavs"),
  // 해군부: the fleet at Pola changes little; asked less often (ww196 merge).
  {
    id: "auh_task_fleet",
    nation: AUH,
    office: "navy",
    type: "fleet",
    chapters: 2,
    cooldown: 20,
  },
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
  lean("court", "wait", { auh_d_purse: "red_cross" }),
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

// ---- ww196: honours at their occasions (design ww195 §4) ----
// The emperor's birthday lists (18 Aug Franz Joseph, 17 Aug Karl, who gave
// the Maria Theresa Order at Wartholz on that day in 1917 and 1918), Karl's
// Hungarian coronation (30 Dec 1916), the war crosses on the general staff's
// proposal after a won battle, and the Maria Theresa Order, which its own
// chapter reviewed and proposed (ww196-facts.md, AUH).

const order = (
  id: string,
  rank: 1 | 2 | 3,
  pools: GwHonourOrder["pools"],
  more: Partial<GwHonourOrder> = {},
): GwHonourOrder => ({ id, nation: AUH, rank, pools, ...more });

const ORDERS: GwHonourOrder[] = [
  order("auh_ord_mmto", 3, ["generals"]),
  order("auh_ord_stephen", 3, ["heads", "officials"]),
  order("auh_ord_leopold", 2, ["heads", "officials", "generals"]),
  order("auh_ord_iron_crown", 2, ["officials", "industry", "generals"]),
  // A title, not a post: Wirklicher Geheimer Rat, "Excellency".
  order("auh_ord_privy", 2, ["heads", "officials"]),
  order("auh_ord_bravery", 2, ["soldier"]),
  order("auh_ord_fjo", 1, ["industry", "officials"]),
  order("auh_ord_mvk", 1, ["generals"]),
  order("auh_ord_signum", 1, ["generals"]),
  // Founded by Karl in December 1916.
  order("auh_ord_ktk", 1, ["soldier"], { from: "1916-12-13" }),
];

const honour = (
  id: string,
  occasion: GwHonourRow["occasion"],
  pools: GwHonourRow["pools"],
  orders: string[],
  from: GwHonourRow["from"],
  more: Partial<GwHonourRow> = {},
): GwHonourRow => ({ id, nation: AUH, occasion, pools, orders, from, ...more });

const HONOURS: GwHonourRow[] = [
  honour(
    "auh_hon_fj_birthday",
    "date",
    ["generals", "heads", "officials", "industry"],
    ["auh_ord_leopold", "auh_ord_iron_crown", "auh_ord_privy", "auh_ord_fjo"],
    ["court", "chancellor"],
    { day: "08-18", when: not(newReign) },
  ),
  honour(
    "auh_hon_karl_birthday",
    "date",
    ["generals", "heads", "officials", "industry"],
    [
      "auh_ord_mmto",
      "auh_ord_leopold",
      "auh_ord_iron_crown",
      "auh_ord_privy",
      "auh_ord_fjo",
    ],
    ["court", "chancellor"],
    { day: "08-17", when: karl },
  ),
  honour(
    "auh_hon_ff_birthday",
    "date",
    ["generals", "heads", "officials", "industry"],
    ["auh_ord_leopold", "auh_ord_iron_crown", "auh_ord_privy", "auh_ord_fjo"],
    ["court", "chancellor"],
    { day: "12-18", when: ffThrone },
  ),
  honour(
    "auh_hon_coronation",
    "date",
    ["heads", "officials"],
    ["auh_ord_stephen", "auh_ord_privy", "auh_ord_iron_crown"],
    ["hun_pm"],
    { day: "12-30", when: karl, since: "1916-12-01", until: "1916-12-31" },
  ),
  honour(
    "auh_hon_victory",
    "victory",
    ["generals", "soldier"],
    ["auh_ord_mvk", "auh_ord_signum", "auh_ord_bravery", "auh_ord_ktk"],
    ["chief_of_staff"],
    { theatre: ["east", "balkan", "italy"], when: inWar },
  ),
  honour("auh_hon_mmto", "deed", ["generals"], ["auh_ord_mmto"], ["court"], {
    when: all(inWar, months(6)),
  }),
  honour(
    "auh_hon_bravery",
    "deed",
    ["soldier"],
    ["auh_ord_bravery", "auh_ord_ktk"],
    ["war"],
    { when: inWar },
  ),
  honour(
    "auh_hon_petition",
    "petition",
    ["generals", "heads", "industry"],
    ["auh_ord_mvk", "auh_ord_leopold", "auh_ord_iron_crown", "auh_ord_fjo"],
    ["chief_of_staff", "war", "navy"],
    { when: inWar },
  ),
];

export const AUH_DEPTS: GwDeptContent = {
  tasks: TASKS,
  answers: ANSWERS,
  leans: LEANS,
  wants: WANTS,
  honours: HONOURS,
  orders: ORDERS,
};
