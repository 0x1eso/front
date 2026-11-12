// ww196: GBR's departments (design ww195 §2-4). Lane W-GBR owns this file and
// resources/ww1914/ko/GBR.depts.json: the answer rows over the common types
// and Britain's own (`ireland`, `recruits`), the task rows that open or
// replace an office's offer, the honours and their occasions, leans, wants,
// and the department papers that stay (Casement #4, Windsor #11, the whips'
// note, the ceremonies' cards).
//
// An answer is the department's own (§2.1): findings from the posts and
// ledgers it keeps, and two or three courses, each with its case for and
// against in the department's words. `then` lays existing papers later, as
// the course's consequences, never as the answer. A course's text names no
// result; its effects show only after the pick.
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
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
  GwNeed,
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
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: ["GBR"] = ["GBR"];

const war: GwCond = { kind: "at_war", tag: "DEU" };
const notWar = not(world({ is: "war" }));
const months = (min: number): GwCond =>
  all(war, world({ is: "war_months", own: true, min }));
const early = (max: number): GwCond =>
  all(war, world({ is: "war_months", own: true, max }));
const neutral = (tag: GwTag): GwCond =>
  all(world({ is: "war" }), world({ is: "neutral", tag }));
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const conscripted = flag("f_gbr_conscript");
const rising = flag("f_gbr_rising");
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
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const pressure = (
  topic: "balkan" | "straits" | "colonial" | "ireland" | "naval" | "home",
  delta: number,
): GwEffect => ({ kind: "pressure", topic, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const offer = (tag: GwTag, value: number): GwEffect =>
  doWorld({ do: "offer", tag, value });
const readiness = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "readiness", tag, delta });
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
const blockade = (delta: number): GwEffect =>
  doWorld({ do: "blockade", delta });

// ---- Answers: findings and courses ----

type FindingMore = Omit<GwFindingRow, "id" | "weight">;
const f = (id: string, weight: number, more: FindingMore = {}) => ({
  id,
  weight,
  ...more,
});
type CourseMore = Omit<GwCourseRow, "id" | "lean" | "effects">;
const c = (
  id: string,
  lean: GwCourseRow["lean"],
  effects: GwEffect[],
  more: CourseMore = {},
): GwCourseRow => ({ id, lean, effects, ...more });
const money = (word: string): GwNeed => ({ kind: "money", word });
const divisions = (word: string): GwNeed => ({ kind: "divisions", word });
const consent = (tag: GwTag): GwNeed => ({ kind: "consent", tag });
const bill = (law: string): GwNeed => ({ kind: "bill", law });
const filled = (...slots: string[]) =>
  Object.fromEntries(slots.map((s) => [s, ["*"]]));

const answer = (
  id: string,
  type: GwAnswerRow["type"],
  findings: GwFindingRow[],
  courses: GwCourseRow[],
  more: Partial<Omit<GwAnswerRow, "id" | "nation" | "type">> = {},
): GwAnswerRow => ({
  id: `gbr_ans_${id}`,
  nation: NATION,
  type,
  ...more,
  findings,
  courses,
});

const ANSWERS: GwAnswerRow[] = [
  // ---- envoy: the Foreign Office's reading of a country ----
  answer(
    "usa",
    "envoy",
    [
      f("notes", 3, { when: war }),
      f("orders", 3, { when: war }),
      f("house", 2, { when: war, slots: filled("envoy") }),
      f("irish", 1),
      f("peace", 2, { when: notWar }),
      f("coming", 2, {
        wrong: true,
        when: war,
        truth: world({ is: "entered", tag: "USA" }),
      }),
    ],
    [
      c("ease", ["gentle", "calm"], [trust("USA", 1), blockade(-1)], {
        when: war,
      }),
      c("dollars", ["bold"], [gauge("money", 1), trust("USA", 1)], {
        when: war,
        needs: [money("loan")],
        then: ["gw_o_usa_loans"],
      }),
      c("hold_line", ["firm"], [trust("USA", -1), blockade(1)], {
        when: war,
      }),
      c("arbitrate", ["gentle", "calm"], [trust("USA", 1)], {
        when: notWar,
      }),
      c("note_wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["USA"], question: "person" },
  ),
  answer(
    "italy",
    "envoy",
    [
      f("price_more", 3, { slots: { asks: ["more"] } }),
      f("price_met", 3, { slots: { asks: ["matched"] } }),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("ready", 2, { slots: { readiness: ["close", "near"] } }),
      f("not_ready", 2, { slots: { readiness: ["far"] } }),
      f("sonnino", 1),
      f("certain", 2, {
        wrong: true,
        truth: world({ is: "entered", tag: "ITA", side: "entente" }),
      }),
    ],
    [
      c("pay_all", ["bold"], [offer("ITA", 4), trust("RUS", -1)], {
        needs: [consent("RUS")],
        then: ["gw_o_ita_london"],
      }),
      c("haggle", ["cheap", "gentle"], [offer("ITA", 3)], {
        then: ["gw_o_ita_asks"],
      }),
      c("let_rome", ["wait", "calm"], [], { wait: true }),
    ],
    { topic: ["ITA"], when: neutral("ITA"), question: "reach" },
  ),
  answer(
    "romania",
    "envoy",
    [
      f("transylvania", 3),
      f("bratianu", 2, { slots: filled("ruler") }),
      f("grain", 2),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("not_ready", 1, { slots: { readiness: ["far"] } }),
      f("ready", 1, { slots: { readiness: ["close"] } }),
      f("sure", 2, {
        wrong: true,
        truth: world({ is: "entered", tag: "ROU", side: "entente" }),
      }),
    ],
    [
      c("promise", ["bold"], [offer("ROU", 4), readiness("ROU", 1)], {
        needs: [consent("RUS")],
        then: ["gw_o_rou_transylvania"],
      }),
      c("buy_grain", ["cheap", "gentle"], [gauge("money", -1)]),
      c("wait_front", ["wait", "calm"], [], {
        wait: true,
        then: ["gw_o_rou_moment"],
        thenAfter: 3,
      }),
    ],
    { topic: ["ROU"], when: neutral("ROU"), question: "reach" },
  ),
  answer(
    "bulgaria",
    "envoy",
    [
      f("macedonia", 3),
      f("fox", 2, { slots: filled("ruler") }),
      f("serbs_no", 2),
      f("bidders", 2, { slots: { bidders: ["bidding"] } }),
      f("leans_them", 1, { slots: { stance: ["leans_them"] } }),
      f("bought", 2, {
        wrong: true,
        truth: not(world({ is: "entered", tag: "BGR", side: "central" })),
      }),
    ],
    [
      c("press_serbs", ["bold", "firm"], [offer("BGR", 3), trust("SRB", -1)], {
        then: ["gw_o_bgr_macedonia"],
      }),
      c("loan_sofia", ["cheap"], [offer("BGR", 2), gauge("money", -1)]),
      c("let_go", ["wait", "calm"], [], { wait: true }),
    ],
    { topic: ["BGR"], when: neutral("BGR"), question: "money" },
  ),
  answer(
    "greece",
    "envoy",
    [
      f("two_heads", 3),
      f("king", 2, { slots: filled("ruler") }),
      f("salonika", 2, { when: world({ is: "open", theatre: "balkan" }) }),
      f("smyrna", 1),
      f("ready", 1, { slots: { readiness: ["close", "near"] } }),
      f("venizelos_holds", 2, { wrong: true }),
    ],
    [
      c("smyrna_offer", ["bold"], [offer("GRC", 3), readiness("GRC", 1)], {
        then: ["gw_o_grc_salonika"],
      }),
      c("back_venizelos", ["firm"], [readiness("GRC", 1), trust("GRC", -1)], {
        then: ["gw_o_grc_king"],
        thenAfter: 3,
      }),
      c("leave_athens", ["gentle", "wait"], [], { wait: true }),
    ],
    { topic: ["GRC"], when: neutral("GRC"), question: "reach" },
  ),
  answer(
    "turkey",
    "envoy",
    [
      f("ships", 3, { when: early(2) }),
      f("enver", 3),
      f("goeben", 2),
      f("mallet", 1),
      f("cheap_peace", 2, { wrong: true, truth: not(atWar("OTT")) }),
    ],
    [
      c(
        "pay_ships",
        ["gentle", "cheap"],
        [offer("OTT", 2), gauge("money", -1)],
      ),
      c("fleet_gate", ["firm"], [readiness("OTT", -1), pressure("straits", 1)]),
      c("watch", ["wait", "calm"], [], { wait: true }),
    ],
    { topic: ["OTT"], when: neutral("OTT") },
  ),
  answer(
    "turkey_war",
    "envoy",
    [
      f("hussein", 3),
      f("germans", 2),
      f("arab_officers", 2),
      f("india", 1),
      f("revolt_soon", 2, { wrong: true }),
    ],
    [
      c(
        "mecca",
        ["bold"],
        [gauge("money", -1), remember("k_gbr_hussein_promise")],
        { then: ["gbr_f_mcmahon"] },
      ),
      c("neutrals", ["gentle", "calm"], [rumour(1)], {
        then: ["gw_d_sounding"],
        thenAfter: 3,
      }),
      c("nothing", ["firm", "wait"], [], { wait: true }),
    ],
    { topic: ["OTT"], when: atWar("OTT") },
  ),
  answer(
    "france",
    "envoy",
    [
      f("joffre_asks", 3, { when: war }),
      f("bertie", 2, { slots: filled("envoy") }),
      f("ports", 2, { when: early(12) }),
      f("losses", 2, { when: months(12) }),
      f("entente", 2, { when: notWar }),
      f("france_breaks", 2, { wrong: true, when: war }),
    ],
    [
      c("help", ["gentle", "bold"], [trust("FRA", 1), opinion("army", -1)], {
        when: war,
        needs: [{ kind: "divisions", word: "some" }],
      }),
      c("press_paris", ["firm"], [trust("FRA", -1)], { when: war }),
      c(
        "own_road",
        ["cheap", "calm"],
        [trust("FRA", -1), pressure("straits", 1)],
        { when: war },
      ),
      c("staff_talks", ["firm", "bold"], [trust("FRA", 1), trust("DEU", -1)], {
        when: notWar,
      }),
      c("free_hands", ["gentle", "calm"], [trust("FRA", -1)], {
        when: notWar,
      }),
      c("hear_paris", ["wait"], [], { wait: true }),
    ],
    { topic: ["FRA"], question: "person" },
  ),
  answer(
    "russia",
    "envoy",
    [
      f("shells_short", 3, { when: war }),
      f("buchanan", 2, { slots: filled("envoy") }),
      f("archangel", 2, { when: war }),
      f("straits_wish", 2, { when: war }),
      f("court", 1),
      f("persia", 2, { when: notWar }),
      f("russia_holds", 2, {
        wrong: true,
        when: months(18),
        truth: not(world({ is: "out", tag: "RUS" })),
      }),
    ],
    [
      c("credit", ["gentle", "bold"], [trust("RUS", 1), gauge("money", -1)], {
        when: war,
        needs: [money("much")],
        then: ["gw_d_ally_money"],
      }),
      c("press_offensive", ["firm"], [trust("RUS", -1)], { when: war }),
      c("constantinople", ["bold"], [trust("RUS", 1), pressure("straits", 1)], {
        when: war,
      }),
      c("persia_deal", ["gentle", "calm"], [trust("RUS", 1)], {
        when: notWar,
      }),
      c("keep_distance", ["cheap", "wait"], [], { wait: true }),
    ],
    { topic: ["RUS"] },
  ),
  answer(
    "germany",
    "envoy",
    [
      f("navy_law", 3, { when: notWar }),
      f("haldane", 2, { when: notWar }),
      f("goschen", 1, { when: notWar }),
      f("no_terms", 3, { when: war }),
      f("belgium", 2, { when: war }),
      f("neutral_men", 1, { when: war }),
      f("soft_berlin", 2, { wrong: true, when: war }),
    ],
    [
      c("holiday", ["gentle"], [trust("DEU", 1), pressure("naval", -1)], {
        when: notWar,
        then: ["gbr_y_talk_offer"],
      }),
      c(
        "outbuild",
        ["firm", "bold"],
        [trust("DEU", -1), pressure("naval", 1)],
        { when: notWar, needs: [bill("gbr_navy_estimates")] },
      ),
      c("sound_neutral", ["gentle", "calm"], [rumour(1)], {
        when: war,
        then: ["gw_d_sounding"],
      }),
      c("no_talk", ["firm"], [opinion("press", 1)], { when: war }),
      c("berlin_wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["DEU"], question: "reach" },
  ),
  answer(
    "austria",
    "envoy",
    [
      f("old_man", 2, { slots: filled("ruler") }),
      f("tired", 3, { when: months(12) }),
      f("nations", 2),
      f("berlin_holds", 2, { when: war }),
      f("deal_near", 2, { wrong: true, when: war }),
    ],
    [
      c("feeler", ["gentle", "bold"], [rumour(1), trust("ITA", -1)], {
        when: war,
        then: ["gbr_f_vienna_feeler"],
      }),
      c("nations_card", ["firm"], [trust("AUH", -1)], { when: war }),
      c("vienna_quiet", ["wait", "calm"], [], { wait: true }),
    ],
    { topic: ["AUH"], question: "reach" },
  ),

  // ---- front: the General Staff's (or the War Office's) plan ----
  answer(
    "west",
    "front",
    [
      f("ridges", 3, { when: war }),
      f("shells_low", 3, { when: war, slots: { shells: ["low"] } }),
      f("shells_ok", 2, {
        when: war,
        slots: { shells: ["middling", "high"] },
      }),
      f("commander", 2, { when: war, slots: filled("commander") }),
      f("line", 2, { when: war, slots: filled("line") }),
      f("french_ask", 2, { when: war }),
      f("raw_armies", 1, { when: early(18) }),
      f("six_divisions", 3, { when: notWar }),
      f("belgium_road", 2, { when: notWar }),
      f("reserves_gone", 2, { wrong: true, when: war }),
    ],
    [
      c("attack", ["bold", "firm"], [gauge("shells", -1), opinion("army", 1)], {
        when: war,
        front: "attack",
        needs: [divisions("many")],
      }),
      c("hold", ["calm", "cheap"], [opinion("army", -1)], {
        when: war,
        front: "hold",
      }),
      c(
        "east_instead",
        ["gentle"],
        [opinion("army", -1), pressure("straits", 1)],
        { when: war, front: "shift" },
      ),
      c("with_france", ["firm", "bold"], [trust("FRA", 1)], { when: notWar }),
      c("navy_only", ["cheap", "gentle"], [trust("FRA", -1)], {
        when: notWar,
      }),
      c("west_wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["west"] },
  ),
  answer(
    "straits",
    "front",
    [
      f("forts", 3),
      f("mines", 3),
      f("dig_in", 2, { when: months(7) }),
      f("commander", 2, { slots: filled("commander") }),
      f("fisher_no", 2, { when: early(10) }),
      f("one_push", 2, { wrong: true }),
    ],
    [
      c("ships_only", ["cheap", "bold"], [pressure("straits", 1)], {
        front: "attack",
        then: ["gbr_w_naval_only"],
      }),
      c("land", ["bold", "firm"], [gauge("shells", -1), opinion("army", 1)], {
        front: "attack",
        needs: [divisions("some")],
        then: ["gbr_w_landing"],
      }),
      c(
        "leave",
        ["calm", "gentle"],
        [opinion("press", -1), pressure("straits", -1)],
        { front: "shorten" },
      ),
      c("straits_wait", ["wait"], [], { wait: true }),
    ],
    { topic: ["straits"], when: war },
  ),
  answer(
    "mesopotamia",
    "front",
    [
      f("river", 3),
      f("india", 2),
      f("heat", 2),
      f("commander", 1, { slots: filled("commander") }),
      f("baghdad_open", 2, { wrong: true }),
    ],
    [
      c("baghdad", ["bold"], [opinion("press", 1), gauge("money", -1)], {
        front: "attack",
        then: ["gbr_w_baghdad_road"],
      }),
      c("basra", ["calm", "cheap"], [], { front: "hold" }),
      c("boats_first", ["gentle", "wait"], [gauge("money", -1)], {
        wait: true,
        front: "hold",
      }),
    ],
    { topic: ["mesopotamia"], when: war },
  ),
  answer(
    "palestine",
    "front",
    [
      f("canal", 3),
      f("water", 2),
      f("arabs", 2, { when: atWar("OTT") }),
      f("commander", 1, { slots: filled("commander") }),
      f("gaza_weak", 2, { wrong: true }),
    ],
    [
      c("jerusalem", ["bold"], [opinion("press", 1), opinion("army", -1)], {
        front: "attack",
        then: ["gbr_w_jerusalem"],
      }),
      c("canal_hold", ["calm", "cheap"], [], { front: "hold" }),
      c("send_west", ["firm"], [opinion("army", 1)], { front: "shift" }),
    ],
    { topic: ["palestine"], when: war },
  ),
  answer(
    "salonika",
    "front",
    [
      f("fever", 3),
      f("french_want", 2),
      f("commander", 1, { slots: filled("commander") }),
      f("bulgars_dug", 2),
      f("serbs_rally", 2, { wrong: true }),
    ],
    [
      c(
        "reinforce",
        ["gentle", "bold"],
        [trust("FRA", 1), opinion("army", -1)],
        { front: "attack", needs: [consent("FRA")], then: ["gbr_w_salonika"] },
      ),
      c("camp", ["calm", "cheap"], [], { front: "hold" }),
      c("pull_out", ["firm"], [trust("FRA", -1), opinion("army", 1)], {
        front: "shorten",
      }),
    ],
    { topic: ["balkan"], when: war },
  ),
  answer(
    "colonies",
    "front",
    [
      f("bush", 3),
      f("dominions", 2),
      f("porters", 2),
      f("lettow", 2, { wrong: true }),
    ],
    [
      c("smuts", ["bold"], [gauge("money", -1), opinion("press", 1)], {
        front: "attack",
      }),
      c("hold_ports", ["calm", "cheap"], [], { front: "hold" }),
      c("leave_africa", ["firm"], [opinion("army", 1)], { front: "shift" }),
    ],
    { topic: ["colonies"], when: war },
  ),

  // ---- money: the Treasury ----
  answer(
    "money",
    "money",
    [
      f("treasury_low", 3, { slots: { treasury: ["low"] } }),
      f("treasury_ok", 2, { slots: { treasury: ["middling", "high"] } }),
      f("dollar", 3, { when: war }),
      f("morgan", 2, { when: war }),
      f("prices_high", 2, { slots: { prices: ["high"] } }),
      f("income_tax", 1, { when: war }),
      f("budget_1914", 3, { when: notWar }),
      f("navy_bill", 2, { when: notWar }),
      f("short_war", 2, { wrong: true, when: early(8) }),
    ],
    [
      c(
        "war_loan",
        ["calm", "bold"],
        [gauge("money", 1), opinion("business", 1)],
        { when: war },
      ),
      c("tax", ["firm", "cheap"], [gauge("money", 1), opinion("workers", -1)], {
        when: war,
      }),
      c("print", ["bold"], [gauge("money", 1), gauge("order", -1)], {
        when: war,
      }),
      c("america_loan", ["gentle"], [gauge("money", 1), trust("USA", 1)], {
        when: war,
        needs: [money("loan")],
        then: ["gbr_f_morgan"],
      }),
      c(
        "cut_navy",
        ["cheap", "gentle"],
        [gauge("money", 1), pressure("naval", 1)],
        { when: notWar },
      ),
      c(
        "supertax",
        ["bold", "firm"],
        [gauge("money", 1), opinion("business", -1)],
        { when: notWar },
      ),
      c("money_wait", ["wait", "calm"], [], { wait: true }),
    ],
    { question: "money" },
  ),

  // ---- bread: the Home Office ----
  answer(
    "bread",
    "bread",
    [
      f("imports", 3),
      f("bread_low", 3, { slots: { bread: ["low"] } }),
      f("prices_high", 2, { slots: { prices: ["high", "middling"] } }),
      f("uboats", 2, { when: world({ is: "uboat", min: 1 }) }),
      f("queues", 2, { when: months(28) }),
      f("harvest", 1),
      f("plenty", 2, { wrong: true }),
    ],
    [
      c("ration", ["firm"], [gauge("bread", 1), opinion("workers", -1)], {
        when: months(12),
        needs: [bill("gbr_food")],
        then: ["gbr_h_food"],
      }),
      c(
        "cap",
        ["gentle", "calm"],
        [opinion("workers", 1), opinion("business", -1)],
      ),
      c("buy_wheat", ["bold"], [gauge("bread", 1), gauge("money", -1)], {
        needs: [money("much")],
      }),
      c("market", ["cheap", "wait"], [], { wait: true }),
    ],
    { when: war, question: "money" },
  ),

  // ---- unrest: the Home Office and the police ----
  answer(
    "unrest",
    "unrest",
    [
      f("strikes_high", 3, { slots: { strikes: ["high"] } }),
      f("strikes_low", 2, { slots: { strikes: ["low", "middling"] } }),
      f("agitators", 2, { slots: filled("agitators") }),
      f("clyde", 2, { when: war }),
      f("rents", 2, { when: early(18) }),
      f("miners", 2),
      f("ulster", 2, { when: notWar }),
      f("plot", 2, { wrong: true }),
    ],
    [
      c("arrest", ["firm"], [gauge("order", 1), opinion("workers", -1)]),
      c("watch", ["calm", "cheap"], [rumour(-1)]),
      c(
        "rents_act",
        ["gentle"],
        [opinion("workers", 1), opinion("business", -1)],
        { when: war, needs: [bill("gbr_rent")], then: ["gbr_h_rents"] },
      ),
      c(
        "meet_unions",
        ["gentle", "bold"],
        [opinion("workers", 1), gauge("money", -1)],
        { when: war, then: ["gbr_h_unions"] },
      ),
    ],
  ),

  // ---- fleet: the Admiralty ----
  answer(
    "fleet",
    "fleet",
    [
      f("ahead", 3, { slots: { fleet: ["high"] } }),
      f("thin", 3, { slots: { fleet: ["low", "middling"] } }),
      f("blockade_tight", 2, { when: war, slots: { blockade: ["high"] } }),
      f("blockade_loose", 2, {
        when: war,
        slots: { blockade: ["low", "middling"] },
      }),
      f("jellicoe", 2, { when: war }),
      f("uboats", 2, { when: world({ is: "uboat", min: 1 }) }),
      f("coal", 1),
      f("dreadnoughts", 3, { when: notWar }),
      f("hiding", 2, { wrong: true, when: war }),
    ],
    [
      c("sortie", ["bold"], [opinion("press", 1), pressure("naval", 1)], {
        when: war,
      }),
      c("guard", ["calm", "wait"], [], { when: war }),
      c("tighten", ["firm"], [blockade(1), trust("USA", -1)], {
        when: war,
        then: ["gw_o_usa_loans"],
        thenAfter: 3,
      }),
      c(
        "convoys",
        ["gentle", "cheap"],
        [doWorld({ do: "shipping", delta: 1 })],
        { when: all(war, world({ is: "uboat", min: 1 })) },
      ),
      c("build", ["bold", "firm"], [gauge("money", -1), pressure("naval", 1)], {
        when: notWar,
        needs: [bill("gbr_navy_estimates")],
        then: ["gbr_y_arms_bill"],
      }),
      c("holiday", ["gentle", "cheap"], [pressure("naval", -1)], {
        when: notWar,
      }),
      c("fleet_wait", ["wait"], [], { wait: true }),
    ],
  ),

  // ---- arms: Munitions (else the War Office) ----
  answer(
    "arms",
    "arms",
    [
      f("shells_low", 3, { slots: { shells: ["low"] } }),
      f("shells_ok", 2, { slots: { shells: ["middling", "high"] } }),
      f("fuses", 3),
      f("skilled", 2),
      f("women", 2, { when: months(10) }),
      f("america", 1),
      f("acetone", 1),
      f("enough", 2, { wrong: true }),
    ],
    [
      c(
        "state",
        ["firm", "bold"],
        [gauge("shells", 1), opinion("business", -1)],
        { needs: [bill("gbr_munitions")], then: ["gbr_hf_women_shells"] },
      ),
      c("owners", ["calm", "cheap"], [opinion("business", 1)]),
      c("buy", ["bold"], [gauge("shells", 1), gauge("money", -1)], {
        needs: [money("loan")],
      }),
      c("men_back", ["gentle"], [gauge("shells", 1), manpower(-2)]),
    ],
    { when: war },
  ),

  // ---- men (after conscription) and recruits (before it): the War Office ----
  answer(
    "men",
    "men",
    [
      f("losses", 3),
      f("tribunals", 2),
      f("exempt", 2),
      f("ireland", 1),
      f("dominions", 1),
      f("plenty", 2, { wrong: true }),
    ],
    [
      c("next_class", ["firm"], [manpower(3), opinion("workers", -1)]),
      c("comb_out", ["bold"], [manpower(2), gauge("shells", -1)]),
      c("women_work", ["gentle", "calm"], [gauge("shells", 1)], {
        then: ["gbr_hf_women_shells"],
      }),
      c("empire", ["cheap"], [manpower(1)]),
    ],
    { when: conscripted },
  ),
  answer(
    "recruits",
    "recruits",
    [
      f("falling", 3, { when: months(8) }),
      f("rush", 3, { when: early(6) }),
      f("register", 2),
      f("married", 2, { when: months(10) }),
      f("cabinet_split", 2),
      f("enough", 2, { wrong: true }),
    ],
    [
      c("derby", ["calm", "gentle"], [manpower(2), opinion("press", 1)], {
        then: ["gbr_w_manpower"],
      }),
      c("compel", ["firm", "bold"], [manpower(3), inst("cabinet", -1)], {
        when: months(9),
        needs: [bill("gbr_conscription")],
      }),
      c("posters", ["cheap", "gentle"], [manpower(1)], {
        then: ["gbr_w_new_armies"],
      }),
      c("recruits_wait", ["wait"], [], { wait: true }),
    ],
    { when: not(conscripted) },
  ),

  // ---- intel: MO5 and the code breakers ----
  answer(
    "intel_germany",
    "intel",
    [
      f("room40", 3, { when: war }),
      f("spies_held", 2, { when: war }),
      f("train_watch", 2, { when: months(12) }),
      f("navy_secrets", 2, { when: notWar }),
      f("invasion", 2, { wrong: true }),
    ],
    [
      c("more_men", ["bold"], [gauge("money", -1)], {
        then: ["gbr_a_spy_read"],
        thenAfter: 3,
      }),
      c("feed_false", ["firm"], [rumour(1)], { when: war }),
      c("as_is", ["calm", "cheap"], [], { wait: true }),
    ],
    { topic: ["DEU"] },
  ),
  answer(
    "intel_home",
    "intel",
    [
      f("aliens", 2),
      f("press_fever", 2, { when: war }),
      f("letters", 1),
      f("neutral_ports", 2, { when: war }),
      f("everywhere", 2, { wrong: true }),
    ],
    [
      c("intern", ["firm"], [gauge("order", 1), rumour(-1)], {
        when: war,
        then: ["gbr_y_inc_spy"],
      }),
      c("quiet_watch", ["calm", "cheap"], []),
      c("double", ["bold"], [rumour(1)], {
        when: war,
        then: ["gw_d_double_agent"],
        thenAfter: 3,
      }),
    ],
  ),

  // ---- ireland: the Irish Office ----
  answer(
    "ireland",
    "ireland",
    [
      f("ulster_guns", 3, { when: not(rising) }),
      f("split", 2, { when: all(war, not(rising)) }),
      f("redmond", 2, { when: not(rising) }),
      f("plotters", 2, { when: all(war, not(rising)) }),
      f("executions", 3, { when: rising }),
      f("sinn_fein", 3, { when: rising }),
      f("draft_fear", 2, { when: all(rising, months(30)) }),
      f("quiet", 2, { wrong: true, truth: not(rising) }),
    ],
    [
      c(
        "talks",
        ["gentle", "calm"],
        [inst("irish", 1), pressure("ireland", -1)],
        { then: ["gbr_h_ireland_talks"] },
      ),
      c(
        "arrest",
        ["firm"],
        [gauge("order", 1), inst("irish", -1), pressure("ireland", 1)],
      ),
      c("home_rule_now", ["bold"], [inst("irish", 1), inst("opposition", -1)], {
        when: not(rising),
        needs: [bill("gbr_home_rule")],
      }),
      c("release", ["gentle"], [inst("irish", 1), opinion("press", -1)], {
        when: rising,
      }),
      c("ireland_wait", ["wait"], [], { wait: true }),
    ],
    { question: "person" },
  ),
];

// ---- Tasks: Britain's own types, and where a common one opens later ----

const TASKS: GwTaskRow[] = [
  // The Irish Office: Home Rule, the Volunteers, after a rising Sinn Féin.
  {
    id: "gbr_task_ireland",
    nation: NATION,
    office: "ireland",
    type: "ireland",
    chapters: 2,
    cooldown: 3,
  },
  // Until conscription the War Office argues about men; after, it finds them.
  {
    id: "gbr_task_recruits",
    nation: NATION,
    office: "war",
    type: "recruits",
    chapters: 2,
    when: all(war, not(conscripted)),
  },
  {
    id: "gbr_task_men",
    nation: NATION,
    office: "war",
    type: "men",
    chapters: 2,
    when: conscripted,
  },
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
  // Stamfordham found the name Windsor; the court dislikes the whips' names.
  lean("court", "wait", {
    gbr_dept_windsor: "house_and_titles",
    gbr_dept_honours: "no_names",
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

// ---- Honours (§4): the Crown's lists, drawn by the PM ----

const order = (
  id: string,
  rank: number,
  pools: GwHonourOrder["pools"],
  from?: string,
): GwHonourOrder => ({
  id: `gbr_ho_${id}`,
  nation: NATION,
  rank,
  pools,
  ...(from === undefined ? {} : { from }),
});

const ORDERS: GwHonourOrder[] = [
  order("peerage", 3, ["generals", "heads", "industry"]),
  order("bath", 2, ["generals", "heads", "officials"]),
  order("privy", 2, ["heads", "officials"]),
  order("baronet", 2, ["industry"]),
  order("stmichael", 2, ["officials"]),
  order("knight", 1, ["industry", "officials"]),
  order("vc", 3, ["soldier"]),
  // The Military Cross, instituted 28 Dec 1914.
  order("mc", 1, ["soldier"], "1914-12-28"),
  // The Order of the British Empire, founded 4 Jun 1917.
  order("obe", 1, ["industry", "officials"], "1917-06-04"),
];

const occasion = (
  id: string,
  kind: GwHonourRow["occasion"],
  pools: GwHonourRow["pools"],
  orders: string[],
  from: GwOffice[],
  more: Partial<GwHonourRow> = {},
): GwHonourRow => ({
  id: `gbr_oc_${id}`,
  nation: NATION,
  occasion: kind,
  pools,
  orders: orders.map((x) => `gbr_ho_${x}`),
  from,
  ...more,
});

const LISTS = ["peerage", "bath", "privy", "baronet", "stmichael", "knight"];

const HONOURS: GwHonourRow[] = [
  // The New Year list and the King's Birthday list (3 June); in the war both
  // carry a field list "for services in the field" from 1915.
  occasion(
    "new_year",
    "date",
    ["heads", "industry", "officials"],
    [...LISTS, "obe"],
    ["finance", "foreign", "interior", "munitions"],
    { day: "01-01" },
  ),
  occasion(
    "birthday",
    "date",
    ["heads", "industry", "officials"],
    [...LISTS, "obe"],
    ["finance", "foreign", "interior", "munitions"],
    { day: "06-03" },
  ),
  occasion(
    "field_new_year",
    "date",
    ["generals", "soldier"],
    ["bath", "peerage", "mc"],
    ["war", "chief_of_staff", "navy"],
    { day: "01-01", since: "1915-01-01", when: war },
  ),
  occasion(
    "field_birthday",
    "date",
    ["generals", "soldier"],
    ["bath", "peerage", "mc"],
    ["war", "chief_of_staff", "navy"],
    { day: "06-03", since: "1915-01-01", when: war },
  ),
  // A Victoria Cross after a deed: the King invests it himself.
  occasion("vc", "deed", ["soldier"], ["vc", "mc"], ["war", "chief_of_staff"], {
    when: war,
  }),
  // A won battle: the general's Bath, a peerage at the war's turn.
  occasion(
    "victory",
    "victory",
    ["generals"],
    ["bath", "peerage"],
    ["war", "chief_of_staff", "navy"],
    { when: war },
  ),
  // Between lists: Munitions or the Admiralty asks for its own man.
  occasion(
    "petition",
    "petition",
    ["industry", "generals", "heads"],
    ["knight", "baronet", "bath", "obe"],
    ["munitions", "navy", "sea_lord", "war"],
    { when: war },
  ),
];

// ---- Papers that stay ----

/** A department's paper of its own: it comes to the desk with its chip. */
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
  // ww196: the honours list itself comes at its occasion (Honours.ts); what
  // stays of #1 is the Chief Whip's note beside it: the party's names.
  paper(
    "gbr_dept_honours",
    { court: holder("court") },
    {
      author: "court",
      tags: ["home", "people"],
      salience: 5,
      cooldown: 4,
      max: 6,
      when: world({ is: "month", of: [12, 5] }),
      variants: [v("lg", flag("f_pm_lg")), v("war", war), v("base")],
      fallback: "few_names",
      options: [
        o(
          "fund_names",
          ["commons:+1"],
          [inst("commons", 1), rumour(1), remember("k_gbr_fund_honours")],
        ),
        o(
          "few_names",
          ["commons:+1", "opinion:-1"],
          [inst("commons", 1), opinion("press", -1)],
        ),
        o(
          "no_names",
          ["opinion:+1", "commons:-1"],
          [opinion("press", 1), inst("commons", -1), trustOf(king, 1)],
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
      when: all(war, rising),
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
            trust("USA", 1),
            inst("opposition", 1),
            pressure("ireland", -1),
          ],
        ),
        o(
          "hang",
          ["irish:-1", "usa:-1"],
          [inst("irish", -1), trust("USA", -1), pressure("ireland", 1)],
        ),
        o(
          "hang_diaries",
          ["irish:-1"],
          [
            inst("irish", -1),
            pressure("ireland", 1),
            rumour(1),
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
  answers: ANSWERS,
  honours: HONOURS,
  orders: ORDERS,
};
