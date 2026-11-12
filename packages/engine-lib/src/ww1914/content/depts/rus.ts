// ww196: RUS's departments. Lane W-RUS owns this file and
// resources/ww1914/ko/RUS.depts.json: the answers Russia's departments bring
// over the common task types and its own (두마 대책, 피난민), the honours at
// their occasions (St George, the New Year list), leans, wants, and the papers
// that stay as initiatives (#2 kin advice, #5 the Synod, #8 mercy, #10 the
// purse) or act cards (kin replies, ceremonies).
//
// Russian dates: the game runs on the Gregorian (N.S.) calendar; Russia kept
// the Julian (O.S.), 13 days behind. Every honours `day` below is N.S., with
// the O.S. day in its comment (facts: ww196-facts.md, RUS).
import type {
  GwAnswerRow,
  GwCourseRow,
  GwDeptContent,
  GwDeptLean,
  GwDeptWant,
  GwFindingRow,
  GwHonourOrder,
  GwHonourRow,
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
  character,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const war = world({ is: "war" });
const reign = world({ is: "regime", of: ["tsar", "crown"] });
const inWar = all(war, reign);
const atWar = (tag: "OTT" | "ROU" | "GRC" | "BGR" | "ITA"): GwCond => ({
  kind: "at_war",
  tag,
});
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });
const after = (from: string): GwCond => world({ is: "date", from });

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
const trust = (
  tag: "ROU" | "BGR" | "GRC" | "ITA" | "OTT" | "GBR" | "FRA" | "SRB",
  delta: number,
): GwEffect => ({ kind: "trust", tag, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const low = (g: Gauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const high = (g: Gauge, min: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  min,
});
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (who: string): GwCond => ({ kind: "tone_fits", who: role(who) });
const active = (person: string): GwCond => ({ kind: "person_active", person });

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, tell: string[], effects: GwEffect[]): GwOption => ({
  id,
  tell,
  effects,
});

// ---- Task rows: Russia's own types, and the common ones it reshapes ----

const TASKS: GwTaskRow[] = [
  // 각료회의: the Duma, when to call it and what to give it.
  {
    id: "rus_task_duma",
    nation: ["RUS"],
    office: "chancellor",
    type: "duma",
    chapters: 1,
    when: reign,
  },
  // 내무부: the people the army's retreat drives east.
  {
    id: "rus_task_refugees",
    nation: ["RUS"],
    office: "interior",
    type: "refugees",
    chapters: 2,
    when: all(inWar, months(6)),
    cooldown: 12,
  },
  // 정보부 looks at the enemy and the neutrals it can reach.
  {
    id: "rus_task_intel",
    nation: ["RUS"],
    office: "intelligence",
    type: "intel",
    pick: "country",
    from: ["DEU", "AUH", "OTT", "BGR", "ROU", "SWE"],
    chapters: 2,
    when: reign,
  },
];

// ---- Answers (답신): Russia's findings and courses ----

const f = (
  id: string,
  weight: 1 | 2 | 3,
  more: Partial<GwFindingRow> = {},
): GwFindingRow => ({ id, weight, ...more });
const c = (
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
  id: `rus_ans_${id}`,
  nation: ["RUS"],
  type,
  findings,
  courses,
  ...more,
});

const neutral = (tag: "ROU" | "BGR" | "GRC" | "ITA" | "OTT"): GwCond =>
  world({ is: "neutral", tag });

const ANSWERS: GwAnswerRow[] = [
  // 외무부 (Sazonov) on Romania: the price, the queen, the grain.
  ans(
    "envoy_rou",
    "envoy",
    [
      f("price", 3),
      f("queen", 2, { when: after("1914-11") }),
      f("grain", 1, { when: war }),
      f("leans_us", 2, { slots: { stance: ["leans_us"] } }),
      f("leans_them", 2, { slots: { stance: ["leans_them"] } }),
      f("bidding", 2, { slots: { bidders: ["bidding"] } }),
      f("decided", 3, {
        wrong: true,
        truth: world({ is: "entered", tag: "ROU" }),
      }),
    ],
    [
      c(
        "promise_land",
        ["bold", "gentle"],
        [trust("ROU", 1), ear("ministers", -1)],
        { then: ["gw_o_rou_transylvania"] },
      ),
      c(
        "kin_letter",
        ["gentle", "calm"],
        [trust("ROU", 1), ruler("family", 1, "rus_ans_kin_letter")],
        {
          when: after("1914-11"),
          then: ["rus_dept_kin_rou"],
          thenAfter: 1,
        },
      ),
      c("now_or_never", ["firm"], [trust("ROU", -1), ear("stavka", 1)], {
        when: war,
      }),
      c("wait_harvest", ["wait", "cheap"], [remember("rus_ans_rou_waited")], {
        wait: true,
      }),
    ],
    { topic: ["ROU"], office: "foreign", when: not(atWar("ROU")) },
  ),
  // Bulgaria: Ferdinand, Macedonia, and Serbia that won't give it.
  ans(
    "envoy_bgr",
    "envoy",
    [
      f("macedonia", 3),
      f("ferdinand", 2),
      f("radoslavov", 2, { when: war }),
      f("leans_them", 1, { slots: { stance: ["leans_them"] } }),
      f("brothers", 3, {
        wrong: true,
        truth: not(world({ is: "entered", tag: "BGR", side: "central" })),
      }),
    ],
    [
      c(
        "press_serbia",
        ["gentle", "bold"],
        [trust("BGR", 1), trust("SRB", -1)],
        { then: ["gw_o_bgr_macedonia"] },
      ),
      c(
        "brothers_call",
        ["calm", "cheap"],
        [trust("BGR", 1), opinion("press", 1)],
      ),
      c("warn_tsar", ["firm"], [trust("BGR", -1), ear("court", 1)]),
    ],
    { topic: ["BGR"], office: "foreign", when: not(atWar("BGR")) },
  ),
  // Greece: the King is the Kaiser's brother-in-law; Venizelos wants in.
  ans(
    "envoy_grc",
    "envoy",
    [
      f("king", 3),
      f("venizelos", 2),
      f("allies_land", 1, { when: after("1915-10") }),
    ],
    [
      c("kin_letter", ["gentle", "calm"], [trust("GRC", 1)], {
        then: ["rus_dept_kin_grc"],
        thenAfter: 1,
      }),
      c("back_venizelos", ["bold"], [trust("GRC", 1), ear("court", -1)]),
      c("leave_london", ["wait", "cheap"], [trust("GBR", 1)], { wait: true }),
    ],
    { topic: ["GRC"], office: "foreign", when: neutral("GRC") },
  ),
  // Italy: what Rome asks, and what it takes from Serbia.
  ans(
    "envoy_ita",
    "envoy",
    [
      f("dalmatia", 3),
      f("serbia_cries", 2),
      f("bidding", 2, { slots: { bidders: ["bidding"] } }),
    ],
    [
      c(
        "cut_dalmatia",
        ["gentle", "bold"],
        [trust("ITA", 1), trust("SRB", -1)],
        {
          then: ["gw_o_ita_london"],
        },
      ),
      c("hold_for_serbs", ["firm"], [trust("SRB", 1), trust("ITA", -1)]),
      c("let_london", ["wait", "cheap"], [trust("GBR", 1)]),
    ],
    { topic: ["ITA"], office: "foreign", when: all(war, neutral("ITA")) },
  ),
  // The Ottomans before the war: the two German ships, Enver.
  ans(
    "envoy_ott",
    "envoy",
    [
      f("ships", 3, { when: after("1914-08") }),
      f("enver", 2),
      f("straits_shut", 2, { when: war }),
      f("bluff", 2, {
        wrong: true,
        truth: neutral("OTT"),
      }),
    ],
    [
      c(
        "guarantee",
        ["gentle", "calm"],
        [trust("OTT", 1), opinion("press", -1)],
      ),
      c("warn_porte", ["firm"], [trust("OTT", -1), ear("stavka", 1)]),
      c("fleet_ready", ["bold"], [ear("stavka", 1), gauge("money", -1)], {
        then: ["rus_cs_goeben_hunt"],
      }),
    ],
    { topic: ["OTT"], office: "foreign", when: neutral("OTT") },
  ),
  // The Ottomans at war: Tsargrad and the Straits, the old dream.
  ans(
    "envoy_straits",
    "envoy",
    [f("claim", 3), f("allies_wary", 2), f("press_wants", 1)],
    [
      c("say_it", ["bold", "firm"], [opinion("press", 1), trust("GBR", -1)], {
        then: ["rus_wv_war_ott_straits"],
      }),
      c("carve_quiet", ["gentle", "calm"], [trust("GBR", 1), trust("FRA", 1)], {
        then: ["gw_d_carve_ottoman"],
      }),
      c("after_war", ["wait"], [remember("rus_ans_straits_later")]),
    ],
    { topic: ["OTT"], office: "foreign", when: atWar("OTT") },
  ),
  // The allies: what Paris and London want from us, what we want of them.
  ans(
    "envoy_ally",
    "envoy",
    [
      f("relief", 3, { when: war }),
      f("shells_owed", 2, { when: war }),
      f("gold", 2, { when: months(6) }),
      f("plain", 1),
    ],
    [
      c("promise_push", ["bold"], [trust("FRA", 1), ear("stavka", -1)], {
        then: ["gw_d_ally_summit"],
      }),
      c(
        "ask_shells",
        ["cheap", "firm"],
        [gauge("shells", 1), trust("GBR", -1)],
        {
          when: war,
          then: ["gw_d_ally_shells"],
        },
      ),
      c("ask_money", ["cheap"], [gauge("money", 1)], {
        then: ["gw_d_ally_money"],
        needs: [{ kind: "consent", tag: "GBR" }],
      }),
    ],
    { topic: ["FRA", "GBR"], office: "foreign" },
  ),
  // The enemy: a quiet word through the Danes, or none.
  ans(
    "envoy_enemy",
    "envoy",
    [
      f("danes", 2, { when: months(6) }),
      f("willy_wants", 2),
      f("allies_watch", 3),
      f("cracking", 3, {
        wrong: true,
        truth: world({ is: "peace_offered" }),
      }),
    ],
    [
      c("hear_them", ["gentle", "wait"], [ear("court", 1), trust("FRA", -1)], {
        when: months(6),
        then: ["gw_d_sounding"],
      }),
      c("no_word", ["firm"], [opinion("army", 1), trust("FRA", 1)]),
      c("tell_allies", ["calm"], [trust("GBR", 1), trust("FRA", 1)]),
    ],
    { topic: ["DEU", "AUH"], office: "foreign", when: war },
  ),
  // 스타프카 / 참모본부 on the German and Austrian front.
  ans(
    "front_east",
    "front",
    [
      f("shells_low", 3, { slots: { shells: ["low"] } }),
      f("shells_ok", 2, { slots: { shells: ["middling", "high"] } }),
      f("austrians", 2),
      f("rails", 2),
      f("line", 1, { slots: { line: ["*"] } }),
      f("germans_west", 3, {
        wrong: true,
        truth: not(
          world({
            is: "battle",
            theatre: "east",
            of: ["break", "advance"],
            by: "foe",
          }),
        ),
      }),
    ],
    [
      c(
        "carpathians",
        ["bold", "firm"],
        [ear("stavka", 1), gauge("shells", -1)],
        {
          front: "attack",
          then: ["rus_w_carpathians"],
        },
      ),
      c("help_france", ["bold"], [trust("FRA", 1), gauge("morale", -1)], {
        front: "attack",
        when: months(10),
        then: ["rus_w_naroch"],
      }),
      c("dig_in", ["calm", "cheap"], [gauge("shells", 1), ear("stavka", -1)], {
        front: "hold",
      }),
      c("fall_back", ["wait", "calm"], [gauge("morale", -1), ear("duma", -1)], {
        front: "shorten",
        slots: { shells: ["low"] },
        then: ["rus_hf_refugees"],
      }),
    ],
    { topic: ["east"], when: war },
  ),
  // The Caucasus: the snow, the passes, Erzurum.
  ans(
    "front_caucasus",
    "front",
    [
      f("snow", 3, { when: world({ is: "month", of: [11, 12, 1, 2, 3] }) }),
      f("yudenich", 2, { when: active("rus_yudenich") }),
      f("erzurum", 2),
      f("line", 1, { slots: { line: ["*"] } }),
    ],
    [
      c("winter_blow", ["bold"], [ear("stavka", 1), gauge("morale", -1)], {
        front: "attack",
        then: ["rus_w_caucasus_snow"],
      }),
      c("hold_passes", ["calm", "cheap"], [gauge("shells", 1)], {
        front: "hold",
      }),
      c("send_west", ["firm"], [ear("stavka", -1)], { front: "shift" }),
    ],
    { topic: ["caucasus"], when: atWar("OTT") },
  ),
  // 재무부 (Bark): the roubles, the drink money gone, London's gold.
  ans(
    "money",
    "money",
    [
      f("vodka_gone", 3, { when: war }),
      f("treasury_low", 3, { slots: { treasury: ["low"] } }),
      f("prices_up", 2, { slots: { prices: ["middling", "high"] } }),
      f("london_gold", 2, { when: months(6) }),
      f("peace_surplus", 2, { when: not(war) }),
    ],
    [
      c(
        "london_credit",
        ["cheap", "gentle"],
        [gauge("money", 1), trust("GBR", 1)],
        {
          when: war,
          then: ["rus_h_rubles"],
          needs: [{ kind: "consent", tag: "GBR" }],
        },
      ),
      c("war_loan", ["calm"], [gauge("money", 1), opinion("business", 1)], {
        when: war,
      }),
      c("print", ["bold"], [gauge("money", 2), gauge("bread", -1)], {
        when: war,
      }),
      c("vodka_back", ["cheap"], [gauge("money", 1), ear("court", -1)], {
        when: war,
        then: ["rus_c_vodka"],
      }),
      c(
        "rail_loan",
        ["bold", "gentle"],
        [gauge("money", -1), trust("FRA", 1)],
        {
          when: not(war),
          then: ["rus_y_arms_rail_loan"],
        },
      ),
    ],
  ),
  // 농업부 (Krivoshein): grain in the south, wagons stuck, the capitals.
  ans(
    "bread",
    "bread",
    [
      f("wagons", 3, { when: war }),
      f("south_full", 2),
      f("capital", 2, { slots: { bread: ["low", "middling"] } }),
      f("hoarders", 1, { when: months(10) }),
      f("plenty", 3, {
        wrong: true,
        truth: high("bread", 2),
      }),
    ],
    [
      c(
        "wagons_grain",
        ["calm", "gentle"],
        [gauge("bread", 1), gauge("shells", -1)],
        {
          when: war,
          then: ["rus_h_wagons"],
        },
      ),
      c(
        "fixed_price",
        ["firm", "cheap"],
        [gauge("bread", 1), opinion("business", -1)],
        {
          when: months(6),
          then: ["rus_h_grain_levy"],
          needs: [{ kind: "bill", law: "rus_grain" }],
        },
      ),
      c(
        "zemstvo",
        ["calm"],
        [gauge("bread", 1), ear("duma", 1), ear("court", -1)],
      ),
      c("let_market", ["wait", "cheap"], [remember("rus_ans_bread_let")], {
        wait: true,
      }),
    ],
  ),
  // 내무부: the streets, the factories, the deputies who speak for them.
  ans(
    "unrest",
    "unrest",
    [
      f("putilov", 3),
      f("agitators", 2, { slots: { agitators: ["*"] } }),
      f("strikes_high", 2, { slots: { strikes: ["high"] } }),
      f("barracks", 2, { when: months(18) }),
      f("germans_pay", 2, { wrong: true, truth: low("order", 1) }),
    ],
    [
      c(
        "arrest",
        ["firm"],
        [gauge("order", 1), opinion("workers", -1), opinion("parliament", -1)],
        {
          then: ["pr_rus_workers"],
        },
      ),
      c("watch", ["wait", "calm"], [ear("ministers", 1)], { wait: true }),
      c(
        "hear_workers",
        ["gentle", "calm"],
        [opinion("workers", 1), ear("court", -1)],
        {
          then: ["rus_lb_unions"],
        },
      ),
    ],
  ),
  // 해군부 (Grigorovich): the Black Sea and the Baltic.
  ans(
    "fleet",
    "fleet",
    [
      f("goeben", 3, { when: atWar("OTT") }),
      f("new_ship", 2, { when: after("1915-07") }),
      f("baltic_mines", 2),
      f("bosporus", 1, { when: atWar("OTT") }),
    ],
    [
      c("bosporus_plan", ["bold"], [ear("stavka", 1), gauge("money", -1)], {
        when: atWar("OTT"),
        then: ["rus_w_bosporus_plan"],
      }),
      c("hunt_goeben", ["firm", "bold"], [opinion("press", 1)], {
        when: atWar("OTT"),
        then: ["rus_cs_goeben_hunt"],
      }),
      c("mine_baltic", ["calm", "cheap"], [gauge("money", -1)], {
        then: ["rus_cs_baltic_mines"],
      }),
      c("keep_harbour", ["wait"], [remember("rus_ans_fleet_kept")], {
        wait: true,
      }),
    ],
  ),
  // 육군부: shells, rifles, the factories, the minister's own figures.
  ans(
    "arms",
    "arms",
    [
      f("famine", 3, { slots: { shells: ["low"] }, when: war }),
      f("putilov_slow", 2),
      f("archangel", 2, { when: war }),
      f("committees", 1, { when: months(8) }),
      f("depots_full", 3, { wrong: true, truth: high("shells", 2) }),
    ],
    [
      c(
        "state_works",
        ["firm", "bold"],
        [gauge("shells", 1), opinion("business", -1)],
        {
          then: ["rus_h_war_industry"],
        },
      ),
      c(
        "buy_abroad",
        ["cheap", "gentle"],
        [gauge("shells", 1), gauge("money", -1)],
        {
          when: war,
          then: ["rus_y_arms_price"],
          needs: [{ kind: "consent", tag: "GBR" }],
        },
      ),
      c(
        "committees",
        ["calm"],
        [gauge("shells", 1), ear("duma", 1), ear("court", -1)],
        {
          when: months(6),
          needs: [{ kind: "bill", law: "rus_councils" }],
        },
      ),
    ],
  ),
  // 육군부: the men, the second class, the borderlands.
  ans(
    "men",
    "men",
    [
      f("losses", 3, { when: months(6) }),
      f("second_class", 2, { when: months(10) }),
      f("asia_exempt", 2),
      f("officers", 2, { when: months(8) }),
    ],
    [
      c(
        "call_ratniki",
        ["firm", "bold"],
        [gauge("morale", -1), opinion("parliament", -1)],
        {
          when: months(10),
          needs: [{ kind: "bill", law: "rus_ratniki" }],
        },
      ),
      c("asia_labour", ["bold"], [gauge("shells", 1), gauge("order", -1)], {
        when: months(18),
        then: ["rus_cs_asia_decree"],
      }),
      c("depots_longer", ["calm"], [gauge("morale", 1), ear("stavka", -1)], {
        then: ["rus_w_depots"],
      }),
    ],
    { when: war },
  ),
  // 정보부 (Batyushin): the enemy's rails and wires, spies at home.
  ans(
    "intel",
    "intel",
    [
      f("rails", 3),
      f("wires", 2),
      f("spies_home", 2, { when: months(6) }),
      f("crack", 2, { wrong: true, truth: world({ is: "peace_offered" }) }),
    ],
    [
      c("more_men", ["bold", "cheap"], [gauge("money", -1)], {
        then: ["rus_spy_rail"],
      }),
      c(
        "spy_hunt",
        ["firm"],
        [gauge("order", 1), rumour(1), opinion("press", -1)],
        {
          then: ["rus_spy_hunt"],
        },
      ),
      c("false_word", ["calm"], [remember("rus_ans_intel_false")]),
    ],
    { topic: ["DEU", "AUH"], when: war },
  ),
  // 두마 대책 (각료회의): when to call the Duma, what to give it.
  ans(
    "duma",
    "duma",
    [
      f("budget", 2),
      f("rodzianko", 3, { when: active("rus_rodzianko") }),
      f("bloc", 3, { when: after("1915-08") }),
      f("court_says", 2),
      f("loyal", 2, {
        wrong: true,
        truth: { kind: "inst", inst: "duma", min: 3 },
      }),
    ],
    [
      c("call", ["calm", "gentle"], [ear("duma", 1), ear("court", -1)], {
        then: ["gov_rus_duma_2"],
      }),
      c(
        "prorogue",
        ["firm", "wait"],
        [ear("court", 1), ear("duma", -1), opinion("parliament", -1)],
      ),
      c(
        "trusted_man",
        ["gentle", "bold"],
        [ear("duma", 1), trustOf("rus_alexandra", -1)],
        {
          when: after("1915-08"),
          then: ["rus_h_bloc"],
        },
      ),
      c("not_yet", ["wait"], [remember("rus_ans_duma_wait")], { wait: true }),
    ],
    { office: "chancellor" },
  ),
  // 피난민 (내무부): the people driven east.
  ans(
    "refugees",
    "refugees",
    [
      f("roads", 3),
      f("army_drives", 2),
      f("typhus", 2, { when: months(10) }),
      f("tatiana", 1),
    ],
    [
      c(
        "committee",
        ["calm", "gentle"],
        [opinion("parliament", 1), gauge("money", -1)],
        {
          then: ["rus_h_refugees"],
        },
      ),
      c("stop_army", ["gentle"], [gauge("order", 1), ear("stavka", -1)]),
      c(
        "send_east",
        ["firm", "cheap"],
        [gauge("order", 1), opinion("workers", -1)],
        {
          then: ["rus_hf_refugees"],
        },
      ),
    ],
    { office: "interior", when: war },
  ),
];

// ---- Honours at their occasions (design §4) ----

const order = (
  id: string,
  rank: 1 | 2 | 3,
  pools: GwHonourOrder["pools"],
): GwHonourOrder => ({ id: `rus_ord_${id}`, nation: ["RUS"], rank, pools });

// Rank 3 is the highest on the list. St George's statute of 10 Aug 1913: the
// 1st and 2nd class by the Emperor himself; in this war no 1st class, four
// 2nd class, about sixty 3rd (ww196-facts.md, RUS).
const ORDERS: GwHonourOrder[] = [
  order("st_george_2", 3, ["generals"]),
  order("st_george_3", 2, ["generals"]),
  order("st_george_4", 1, ["generals"]),
  order("st_george_arms", 1, ["generals"]),
  order("st_george_cross", 1, ["soldier"]),
  order("st_andrew", 3, ["heads"]),
  order("nevsky", 3, ["heads", "generals"]),
  order("white_eagle", 2, ["heads", "officials", "generals"]),
  order("st_vladimir", 2, ["heads", "officials", "industry", "generals"]),
  order("st_anna", 1, ["officials", "industry"]),
  order("st_stanislaus", 1, ["officials", "industry"]),
  // A titular post goes on the list (design §4 "other gifts").
  order("council_seat", 3, ["heads"]),
];

const ord = (...ids: string[]) => ids.map((x) => `rus_ord_${x}`);

const HONOURS: GwHonourRow[] = [
  // New Year, 1 Jan O.S. = 14 Jan N.S.: the civil list from the court
  // ministry. (Unchecked whether the State Council list came that day: the
  // text says only 새해 서훈.)
  {
    id: "rus_hon_new_year",
    nation: ["RUS"],
    occasion: "date",
    day: "01-14",
    when: reign,
    pools: ["heads", "officials", "industry", "generals"],
    orders: ord(
      "st_andrew",
      "nevsky",
      "white_eagle",
      "st_vladimir",
      "st_anna",
      "st_stanislaus",
      "council_seat",
    ),
    from: ["court", "chancellor"],
  },
  // The order's feast, 26 Nov O.S. = 9 Dec N.S. (founded 1769): the St George
  // knights at the palace; the army's list.
  {
    id: "rus_hon_st_george_day",
    nation: ["RUS"],
    occasion: "date",
    day: "12-09",
    when: inWar,
    pools: ["generals", "soldier"],
    orders: ord(
      "st_george_3",
      "st_george_4",
      "st_george_arms",
      "st_george_cross",
    ),
    from: ["supreme_commander", "chief_of_staff"],
  },
  // After a victory: the front's St George list for the Tsar to confirm.
  {
    id: "rus_hon_victory",
    nation: ["RUS"],
    occasion: "victory",
    theatre: ["east", "caucasus"],
    when: reign,
    pools: ["generals", "soldier"],
    orders: ord(
      "st_george_2",
      "st_george_3",
      "st_george_4",
      "st_george_arms",
      "st_george_cross",
    ),
    from: ["supreme_commander", "chief_of_staff"],
  },
  // A soldier's deed in a battle: the St George Cross.
  {
    id: "rus_hon_deed",
    nation: ["RUS"],
    occasion: "deed",
    theatre: ["east", "caucasus"],
    when: reign,
    pools: ["soldier"],
    orders: ord("st_george_cross"),
    from: ["chief_of_staff"],
  },
  // Between lists: the war ministry or the Stavka asks for one man.
  {
    id: "rus_hon_petition",
    nation: ["RUS"],
    occasion: "petition",
    when: inWar,
    pools: ["generals", "heads", "industry"],
    orders: ord("st_george_4", "st_vladimir", "white_eagle"),
    from: ["war", "supreme_commander", "chief_of_staff"],
  },
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

// ---- Papers that stay (design §3: initiatives and act cards) ----

/**
 * A department's own paper (an initiative): its head brings it unasked when
 * the state calls for it. ww196: these were task products; they come by
 * themselves now, and some courses name them in `then`.
 */
const initiative = (
  id: string,
  office: "court" | "interior" | "foreign",
  kind: "proposal" | "report",
  tags: GwScene["tags"],
  when: GwCond,
  variants: GwVariant[],
  options: GwOption[] = [],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind,
  cast: { head: { office } },
  author: "head",
  salience: 4,
  tags,
  when,
  max: 2,
  variants,
  ...(options.length > 0 ? { options, fallback: options[0].id } : {}),
  ...more,
});

/** Read-only report the foreign office writes for a letter: tone advice. */
const kinAdvice = (
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  who: string,
): GwScene =>
  initiative(
    id,
    "foreign",
    "report",
    ["foreign"],
    when,
    [
      v("sly", character(role(who), "opportunist")),
      v("careful", character(role(who), "cautious")),
      v("hard", character(role(who), "hardline")),
      v("base"),
    ],
    [],
    {
      cast: { head: { office: "foreign" }, ...cast },
      stamp: "estimate",
      max: 1,
    },
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
  // #10 the privy purse: the court ministry's bundle of petitions.
  initiative(
    "rus_dept_purse",
    "court",
    "proposal",
    ["home"],
    all(reign, any(war, low("bread", 1))),
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
  initiative(
    "rus_dept_synod",
    "court",
    "proposal",
    ["home", "people"],
    all(inWar, months(10), active("rus_rasputin")),
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
    {
      cast: { head: { office: "court" }, empress: { person: "rus_alexandra" } },
      max: 1,
    },
  ),
  // #8 mercy: the case file and the families' petition.
  initiative(
    "rus_dept_mercy",
    "interior",
    "proposal",
    ["home", "people"],
    reign,
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
  // #2: the foreign office's draft advice for a cousin's letter. Marie is
  // queen only once Ferdinand is king (Carol I died 10 Oct 1914).
  kinAdvice(
    "rus_dept_kin_rou",
    all(reign, not(atWar("ROU")), neutral("ROU"), after("1914-11")),
    { queen: { person: "rou_marie" } },
    "queen",
  ),
  kinAdvice(
    "rus_dept_kin_grc",
    all(reign, not(atWar("GRC")), neutral("GRC")),
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
  answers: ANSWERS,
  honours: HONOURS,
  orders: ORDERS,
};
