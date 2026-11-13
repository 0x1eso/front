// ww193, ww196: what every seat's departments share. Lane C owns this file and
// resources/ww1914/ko/common.depts.json: the common answer rows of the nine
// task types (design ww195 §3), the stub scenes the desk papers ride on, the
// rival pairs, and the words every seat shares (department names, task types,
// questions, picks, stalls, slot words, the heads' voices by relation and by
// temperament).
//
// An answer row's findings and courses are text in `depts.answers.<row>`.
// Text naming a slot gates on it (`slots`). A course that moves a country
// reads the task's topic with `picked` (no act): the card's `dept.topic`.
// Seat rows (content/depts/<seat>.ts) come before these; a course id given
// twice keeps the first, so a seat row can replace a common course by id.
// The one-nation law rows below come before the common row of their type for
// the same reason: their course of the same id needs the seat's own bill.
//
// No common leans: Content.ts joins this file first and `leanRow` takes the
// first row that fits, so a common row would hide a seat's own. A department
// with no row of its seat leans by GW_DEPT_LEAN_DEFAULT (TaskRows.ts).
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAnswerRow,
  GwAnswerSlot,
  GwCourseRow,
  GwDeptContent,
  GwFindingRow,
  GwLean,
  GwNeed,
  GwTaskType,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  GW_PAPER_FORMS,
  GwPaperForm,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwBillAct } from "@openfront/engine-api/ww1914/GwLaw";
import type {
  GwPlace,
  GwPlaceGroup,
} from "@openfront/engine-api/ww1914/GwPlaces";
import {
  all,
  any,
  GwCond,
  GwEffect,
  GwScene,
  not,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  doWorld,
  GwWorldEffect,
  world,
} from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * ww196: the stub scene each desk paper form rides on (`card.paper`): the
 * engine fills it (Departments, Honours); its own text is only a fallback
 * title. Read-only, never dealt.
 */
function paperStub(form: GwPaperForm): GwScene {
  return {
    id: `gw_paper_${form}`,
    nation: [...GW_TAGS],
    kind: "report",
    cast: {},
    salience: 1,
    tags: ["home"],
    scheduledOnly: true,
    variants: [{ id: "base" }],
  };
}

/** ww196: the ww193 fallback reports (`gw_dept_<kind>`) are gone (§5). */
export const COMMON_DEPT_SCENES: readonly GwScene[] =
  GW_PAPER_FORMS.map(paperStub);

// ---- ww196: the answer rows of the nine common types ----

type Slots = Partial<Record<GwAnswerSlot, string[]>>;
type FindingMore = Omit<GwFindingRow, "id" | "weight">;
type CourseMore = Omit<GwCourseRow, "id" | "lean" | "effects">;
type Gauge = "shells" | "bread" | "money" | "morale" | "order";

const SEATS: GwTag[] = ["DEU", "GBR", "FRA", "RUS", "AUH"];
const head = role("head");

const f = (
  id: string,
  weight: number,
  more: FindingMore = {},
): GwFindingRow => ({ id, weight, ...more });
const c = (
  id: string,
  lean: GwLean[],
  effects: GwEffect[],
  more: CourseMore = {},
): GwCourseRow => ({ id, lean, effects, ...more });
/** The 기다린다 course an anxious head adds (`wait`). */
const waitCourse = (key: string): GwCourseRow =>
  c("wait", ["wait"], [remember(key)], { wait: true });
const on = (slots: Slots): FindingMore => ({ slots });

/**
 * ww201: where the production step takes a gauge, in the head's words, once
 * it has run (slot `<gauge>_trend`). Falling outweighs rising: a head brings
 * bad news first. Text `depts.answers.<row>.findings.<gauge>_<word>`.
 */
const trendFindings = (g: "shells" | "bread" | "money"): GwFindingRow[] => {
  const k = `${g}_trend` as const;
  return [
    f(`${g}_rising`, 2, on({ [k]: ["rising", "rising_fast"] })),
    f(`${g}_full`, 1, on({ [k]: ["full"] })),
    f(`${g}_steady`, 1, on({ [k]: ["steady"] })),
    f(`${g}_falling`, 2, on({ [k]: ["falling"] })),
    f(`${g}_falling_fast`, 3, on({ [k]: ["falling_fast"] })),
  ];
};

const gauge = (g: Gauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const army = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "army",
  delta,
});
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const act = (of: GwWorldEffect): GwEffect => doWorld(of);
const level = (g: Gauge, min?: number, max?: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});

const war: GwCond = world({ is: "war" });
const peace: GwCond = not(war);
const entente: GwCond = world({ is: "side", of: ["entente"] });
const central: GwCond = world({ is: "side", of: ["central"] });

/**
 * A row of one country (`topic`), for what reads that country: its price and
 * readiness, its gauges. `topic` takes a tag; a cond can't name the topic.
 * These rows come after the common row of their type, whose title and stage
 * lines they share, and add findings and courses of their own ids.
 */
const NEUTRALS: GwTag[] = [
  "ITA",
  "OTT",
  "ROU",
  "BGR",
  "GRC",
  "USA",
  "JPN",
  "NLD",
  "SWE",
  "ESP",
  "DNK",
  "NOR",
  "CHE",
];
/** The other countries an envoy task may be about, while neutral. */
const OTHER_NEUTRALS: GwTag[] = (
  [...GW_TAGS.slice(0, GW_TAGS.indexOf("ALB") + 1), "CHN", "IRN"] as GwTag[]
).filter((t) => !NEUTRALS.includes(t));
const WATCHED: GwTag[] = [...SEATS, "ITA", "OTT", "BGR", "ROU", "USA"];

/** The country came in on the seat's side. */
const joinedUs = (tag: GwTag): GwCond =>
  any(
    all(entente, world({ is: "entered", tag, side: "entente" })),
    all(central, world({ is: "entered", tag, side: "central" })),
  );
const theirs = (tag: GwTag, g: Gauge, min?: number, max?: number): GwCond => ({
  kind: "nation_gauge",
  tag,
  gauge: g,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});

const NEUTRAL = ["neutral", "leans_us", "leans_them"];
const HOSTILE = ["enemy", "foe_side"];
const ANY = ["*"];

const money = (word: string): GwNeed => ({ kind: "money", word });
const person: GwNeed = { kind: "person" };
const divisions = (word: string): GwNeed => ({ kind: "divisions", word });
const bill = (law: string): GwNeed => ({ kind: "bill", law });

/**
 * 외교: {나라}에 대한 방침. Courses by stance (§3): a neutral's are in the
 * country rows below (its price moves), an ally's and an enemy's here.
 */
const ENVOY: GwAnswerRow = {
  id: "c_envoy",
  nation: SEATS,
  type: "envoy",
  question: "reach",
  findings: [
    f("neutral", 3, on({ stance: ["neutral"] })),
    f("leans_us", 3, on({ stance: ["leans_us"] })),
    f("leans_them", 3, on({ stance: ["leans_them"] })),
    f("ally", 3, on({ stance: ["ally"] })),
    f("enemy", 3, on({ stance: ["enemy"] })),
    f("foe_side", 3, on({ stance: ["foe_side"] })),
    f("ready_close", 3, on({ readiness: ["close"] })),
    f("ready_near", 2, on({ readiness: ["near"] })),
    f("ready_far", 2, on({ readiness: ["far"] })),
    f("bidders", 2, on({ bidders: ["bidding"] })),
    f("no_bidders", 1, on({ bidders: ["none"] })),
    f("asks_more", 2, on({ asks: ["more"] })),
    f("asks_matched", 1, on({ asks: ["matched"] })),
    f("ruler", 2, on({ ruler: ANY })),
    f("envoy", 2, on({ envoy: ANY })),
    f("sent", 2, on({ sent: ANY })),
    f("reach_sound", 1, on({ reach: ["sound"] })),
    f("reach_terms", 1, on({ reach: ["terms"] })),
    f("reach_sign", 1, on({ reach: ["sign"] })),
    f("ally_tired", 1, { slots: { stance: ["ally"] }, when: war }),
  ],
  courses: [
    // An ally.
    c(
      "help",
      ["gentle", "bold"],
      [gauge("money", -1), remember("c_envoy_help")],
      {
        slots: { stance: ["ally"] },
        needs: [money("much")],
      },
    ),
    c("press", ["firm"], [remember("c_envoy_pressed"), opinion("army", 1)], {
      slots: { stance: ["ally"] },
    }),
    c("apart", ["cheap"], [remember("c_envoy_apart")], {
      slots: { stance: ["ally"] },
    }),
    // An enemy, or a country of the other camp.
    c("feeler", ["gentle"], [opinion("army", -1), remember("c_envoy_feeler")], {
      slots: { stance: HOSTILE },
      needs: [person],
    }),
    c("via_neutral", ["calm", "cheap"], [remember("c_envoy_via_neutral")], {
      slots: { stance: HOSTILE },
      needs: [person],
    }),
    c("nothing", ["firm"], [opinion("army", 1)], {
      slots: { stance: HOSTILE },
    }),
    waitCourse("c_envoy_wait"),
  ],
};

/** A neutral's courses: its price and readiness move. Text `c_envoy_<tag>`. */
const envoyNeutral = (tag: GwTag): GwAnswerRow => ({
  id: `c_envoy_${tag.toLowerCase()}`,
  nation: SEATS.filter((s) => s !== tag),
  type: "envoy",
  topic: [tag],
  findings: [
    f("settled", 3, {
      wrong: true,
      slots: { stance: ["neutral", "leans_them"], bidders: ["bidding"] },
      truth: joinedUs(tag),
    }),
  ],
  courses: [
    c(
      "bid",
      ["bold"],
      [
        act({ do: "offer", tag, value: 3 }),
        act({ do: "readiness", tag, delta: 5 }),
      ],
      { slots: { stance: NEUTRAL }, needs: [money("much")] },
    ),
    c(
      "only_neutral",
      ["gentle", "calm"],
      [
        act({ do: "offer", tag, value: 1 }),
        act({ do: "readiness", tag, delta: -5 }),
      ],
      { slots: { stance: NEUTRAL } },
    ),
    c("scare", ["firm"], [temp(1), act({ do: "readiness", tag, delta: -5 })], {
      slots: { stance: NEUTRAL },
    }),
  ],
});

/** The same courses for a lesser neutral: nothing on the world's table. */
const ENVOY_OTHER: GwAnswerRow = {
  id: "c_envoy_other",
  nation: SEATS,
  type: "envoy",
  topic: OTHER_NEUTRALS,
  findings: [],
  courses: [
    c("bid", ["bold"], [gauge("money", -1), remember("c_envoy_bid")], {
      slots: { stance: NEUTRAL },
      needs: [money("little")],
    }),
    c("only_neutral", ["gentle", "calm"], [remember("c_envoy_neutral")], {
      slots: { stance: NEUTRAL },
    }),
    c("scare", ["firm"], [temp(1), remember("c_envoy_scare")], {
      slots: { stance: NEUTRAL },
    }),
  ],
};

/** 정보: {나라}의 속사정. What the other side hides; some of it is planted. */
const INTEL: GwAnswerRow = {
  id: "c_intel",
  nation: SEATS,
  type: "intel",
  question: "person",
  findings: [
    f("leans_them", 2, on({ stance: ["leans_them"] })),
    f("ruler", 1, on({ ruler: ANY })),
    f("sent", 2, on({ sent: ANY })),
    f("planted", 2),
    f("cut", 1),
  ],
  courses: [
    c("more_men", ["bold"], [gauge("money", -1), remember("c_intel_more")], {
      needs: [money("little")],
    }),
    c("plant", ["firm"], [remember("c_intel_plant")], { needs: [person] }),
    c("as_is", ["cheap", "calm"], [remember("c_intel_as_is")]),
    waitCourse("c_intel_wait"),
  ],
};

/** What the service finds of a watched country's state. Text `c_intel_<tag>`. */
const intelOf = (tag: GwTag): GwAnswerRow => ({
  id: `c_intel_${tag.toLowerCase()}`,
  nation: SEATS.filter((s) => s !== tag),
  type: "intel",
  topic: [tag],
  findings: [
    f("bread_short", 3, { when: theirs(tag, "bread", undefined, 1) }),
    f("bread_fine", 1, { when: theirs(tag, "bread", 2) }),
    f("morale_low", 3, { when: theirs(tag, "morale", undefined, 1) }),
    f("morale_fine", 1, { when: theirs(tag, "morale", 3) }),
    f("order_low", 2, { when: theirs(tag, "order", undefined, 1) }),
    f("shells_low", 2, {
      when: theirs(tag, "shells", undefined, 0),
      slots: { stance: ["enemy"] },
    }),
    f("talks", 3, {
      wrong: true,
      slots: { stance: ["enemy", "foe_side", "leans_them"] },
      truth: joinedUs(tag),
    }),
  ],
  courses: [],
});

/** 작전: {전선} 작전안, at war. The course fills the war paper's proposal. */
const FRONT: GwAnswerRow = {
  id: "c_front",
  nation: SEATS,
  type: "front",
  when: war,
  question: "person",
  findings: [
    f("line", 3, on({ line: ANY, enemy: ANY })),
    f("enemy", 2, on({ enemy: ANY })),
    f("commander", 2, on({ commander: ANY })),
    f("shells_low", 3, on({ shells: ["low"] })),
    f("shells_mid", 2, on({ shells: ["middling"] })),
    f("shells_high", 2, on({ shells: ["high"] })),
    f("tired", 2, { when: level("morale", undefined, 1) }),
    f("rails", 1),
    f("sent", 2, on({ sent: ANY })),
    f("shells_coming", 3, {
      wrong: true,
      slots: { shells: ["low"] },
      truth: level("shells", 2),
    }),
  ],
  courses: [
    c("attack", ["bold", "firm"], [remember("c_front_attack")], {
      front: "attack",
      needs: [divisions("many")],
    }),
    c("hold", ["calm", "cheap"], [remember("c_front_hold")], {
      front: "hold",
    }),
    c("shorten", ["gentle", "cheap"], [opinion("army", -1)], {
      front: "shorten",
    }),
    c("shift", ["bold"], [remember("c_front_shift")], {
      front: "shift",
      needs: [divisions("few")],
    }),
    waitCourse("c_front_wait"),
  ],
};

/** 작전: 전쟁 계획 점검, in peace. */
const FRONT_PEACE: GwAnswerRow = {
  id: "c_front_peace",
  nation: SEATS,
  type: "front",
  when: peace,
  question: "person",
  findings: [
    f("plan", 3),
    f("rigid", 2),
    f("commander", 2, on({ commander: ANY })),
    f("shells_low", 2, on({ shells: ["low"] })),
    f("shells_high", 1, on({ shells: ["high"] })),
    f("sent", 2, on({ sent: ANY })),
    f("short_war", 3, { wrong: true }),
  ],
  courses: [
    c("rails", ["bold"], [gauge("money", -1), army(1)], {
      needs: [money("much")],
    }),
    c("redraw", ["gentle", "calm"], [army(-1), temp(-1)]),
    c("keep", ["cheap", "firm"], [remember("c_front_keep")]),
    waitCourse("c_front_peace_wait"),
  ],
};

/** 재정: 전쟁 비용. */
const MONEY: GwAnswerRow = {
  id: "c_money",
  nation: SEATS,
  type: "money",
  when: war,
  findings: [
    f("treasury_low", 3, on({ treasury: ["low"] })),
    f("treasury_mid", 2, on({ treasury: ["middling"] })),
    f("treasury_high", 2, on({ treasury: ["high"] })),
    f("prices_high", 3, on({ prices: ["high"] })),
    f("prices_mid", 2, on({ prices: ["middling"] })),
    f("prices_low", 1, on({ prices: ["low"] })),
    f("lenders", 2),
    f("abroad", 1),
    ...trendFindings("money"),
    f("taxes_in", 3, {
      wrong: true,
      slots: { treasury: ["low"] },
      truth: level("money", 2),
    }),
  ],
  courses: [
    c("loan", ["calm"], [gauge("money", 1), opinion("business", 1)]),
    c(
      "tax",
      ["firm"],
      [gauge("money", 1), opinion("business", -1), opinion("workers", -1)],
    ),
    c("print", ["cheap", "bold"], [gauge("money", 1), gauge("order", -1)]),
    c("foreign", ["gentle"], [gauge("money", 1), remember("c_money_foreign")]),
    waitCourse("c_money_wait"),
  ],
};

/** 재정: 예산, in peace. */
const BUDGET: GwAnswerRow = {
  id: "c_budget",
  nation: SEATS,
  type: "money",
  when: peace,
  findings: [
    f("treasury_low", 3, on({ treasury: ["low"] })),
    f("treasury_mid", 2, on({ treasury: ["middling"] })),
    f("treasury_high", 2, on({ treasury: ["high"] })),
    f("services", 2),
    f("prices_high", 2, on({ prices: ["high"] })),
    ...trendFindings("money"),
  ],
  courses: [
    c("balance", ["cheap", "calm"], [gauge("money", 1), army(-1)]),
    c("arm", ["bold", "firm"], [gauge("money", -1), army(1), temp(1)]),
    c("tax", ["gentle"], [gauge("money", 1), opinion("business", -1)]),
    waitCourse("c_budget_wait"),
  ],
};

/** 식량: 빵과 물가. */
const BREAD: GwAnswerRow = {
  id: "c_bread",
  nation: SEATS,
  type: "bread",
  question: "money",
  findings: [
    f("bread_low", 3, on({ bread: ["low"] })),
    f("bread_mid", 2, on({ bread: ["middling"] })),
    f("bread_high", 1, on({ bread: ["high"] })),
    f("prices_high", 3, on({ prices: ["high"] })),
    f("prices_mid", 2, on({ prices: ["middling"] })),
    f("black", 2, on({ bread: ["low", "middling"], prices: ["high"] })),
    f("farms", 2, { when: war }),
    f("spend_ample", 1, on({ spend: ["ample"] })),
    f("spend_thrift", 1, on({ spend: ["thrift"] })),
    ...trendFindings("bread"),
    f("hoarders", 3, {
      wrong: true,
      slots: { bread: ["low"] },
      truth: level("bread", 2),
    }),
  ],
  courses: [
    c(
      "ration",
      ["firm", "calm"],
      [gauge("bread", 1), gauge("morale", -1), opinion("business", -1)],
    ),
    c(
      "cap",
      ["gentle"],
      [gauge("order", 1), opinion("workers", 1), opinion("business", -1)],
    ),
    c("buy", ["bold"], [gauge("money", -1), gauge("bread", 1)], {
      needs: [money("much")],
    }),
    c("leave", ["cheap"], [opinion("business", 1)]),
    waitCourse("c_bread_wait"),
  ],
};

/** 치안: 불온 동향. */
const UNREST: GwAnswerRow = {
  id: "c_unrest",
  nation: SEATS,
  type: "unrest",
  findings: [
    f("strikes_high", 3, on({ strikes: ["high"] })),
    f("strikes_mid", 2, on({ strikes: ["middling"] })),
    f("strikes_low", 1, on({ strikes: ["low"] })),
    f("order_low", 3, on({ order: ["low"] })),
    f("agitators", 2, on({ agitators: ANY })),
    f("barracks", 2, { when: all(war, level("morale", undefined, 1)) }),
    f("press", 1),
    f("foreign_money", 3, {
      wrong: true,
      slots: { strikes: ["middling", "high"] },
      truth: level("order", 3),
    }),
  ],
  courses: [
    c(
      "arrest",
      ["firm"],
      [gauge("order", 1), opinion("workers", -1), opinion("press", -1)],
    ),
    c("watch", ["calm", "cheap"], [remember("c_unrest_watch")]),
    c("hear", ["gentle"], [gauge("money", -1), act({ do: "calm" })], {
      needs: [money("little")],
    }),
    waitCourse("c_unrest_wait"),
  ],
};

/** 해군: 함대 운용, at war. */
const FLEET: GwAnswerRow = {
  id: "c_fleet",
  nation: SEATS,
  type: "fleet",
  when: war,
  findings: [
    f("fleet_high", 3, on({ fleet: ["high"] })),
    f("fleet_mid", 2, on({ fleet: ["middling"] })),
    f("fleet_low", 3, on({ fleet: ["low"] })),
    f("blockade_high", 2, on({ blockade: ["high"] })),
    f("blockade_mid", 2, on({ blockade: ["middling"] })),
    f("blockade_low", 1, on({ blockade: ["low"] })),
    f("uboats", 2, { when: world({ is: "uboat", min: 1 }) }),
    f("coal", 1),
    f("mines", 1),
    f("weak_foe", 3, { wrong: true, slots: { fleet: ["low"] } }),
  ],
  courses: [
    c("sortie", ["bold"], [gauge("money", -1), opinion("press", 1)]),
    c("guard", ["calm", "cheap"], [remember("c_fleet_guard")]),
    c("tighten", ["firm"], [act({ do: "blockade", delta: 1 })], {
      when: entente,
    }),
    // DEU's U-boat war is its own row (W-DEU); here only the word.
    c("subs", ["firm", "bold"], [remember("c_fleet_subs")], {
      when: not(entente),
    }),
    waitCourse("c_fleet_wait"),
  ],
};

/** 해군: 건함, in peace. */
const BUILD: GwAnswerRow = {
  id: "c_build",
  nation: SEATS,
  type: "fleet",
  when: peace,
  findings: [
    f("fleet_high", 2, on({ fleet: ["high"] })),
    f("fleet_mid", 2, on({ fleet: ["middling"] })),
    f("fleet_low", 2, on({ fleet: ["low"] })),
    f("yards", 2),
    f("treasury_low", 2, on({ treasury: ["low"] })),
    f("race", 1),
  ],
  courses: [
    c("more", ["bold", "firm"], [gauge("money", -1), temp(1)], {
      needs: [money("much")],
    }),
    c("as_planned", ["calm"], [remember("c_build_planned")]),
    c("fewer", ["cheap", "gentle"], [gauge("money", 1), temp(-1)]),
    waitCourse("c_build_wait"),
  ],
};

/** 군수: 포탄과 무기, at war. */
const ARMS: GwAnswerRow = {
  id: "c_arms",
  nation: SEATS,
  type: "arms",
  when: war,
  question: "money",
  findings: [
    f("shells_low", 3, on({ shells: ["low"] })),
    f("shells_mid", 2, on({ shells: ["middling"] })),
    f("shells_high", 1, on({ shells: ["high"] })),
    f("skilled", 2),
    f("strikes", 2, on({ strikes: ["middling", "high"] })),
    f("spend_ample", 1, on({ spend: ["ample"] })),
    f("spend_thrift", 1, on({ spend: ["thrift"] })),
    ...trendFindings("shells"),
    f("wasted", 3, {
      wrong: true,
      slots: { shells: ["low"] },
      truth: level("shells", 2),
    }),
  ],
  courses: [
    c(
      "state",
      ["firm", "bold"],
      [gauge("shells", 1), gauge("money", -1), opinion("business", -1)],
    ),
    c(
      "owners",
      ["gentle", "calm"],
      [
        gauge("shells", 1),
        gauge("money", -1),
        opinion("business", 1),
        opinion("workers", -1),
      ],
    ),
    // Buying abroad: not through the blockade.
    c("buy", ["bold"], [gauge("money", -1), gauge("shells", 1)], {
      when: not(central),
      needs: [money("much")],
    }),
    c(
      "skilled_back",
      ["cheap"],
      [
        gauge("shells", 1),
        act({ do: "manpower", delta: -2 }),
        opinion("army", -1),
      ],
    ),
    waitCourse("c_arms_wait"),
  ],
};

/** 병무: 병력 보충, at war. */
const MEN: GwAnswerRow = {
  id: "c_men",
  nation: SEATS,
  type: "men",
  when: war,
  findings: [
    f("men_low", 3, { when: world({ is: "manpower", max: 15 }) }),
    f("men_mid", 2, { when: world({ is: "manpower", min: 16, max: 40 }) }),
    f("men_high", 1, { when: world({ is: "manpower", min: 41 }) }),
    f("exempt", 2),
    f("women", 1),
    f("tired", 2, { when: level("morale", undefined, 1) }),
    f("enough", 3, {
      wrong: true,
      when: world({ is: "manpower", max: 15 }),
      truth: world({ is: "manpower", min: 30 }),
    }),
  ],
  courses: [
    c(
      "class",
      ["firm", "bold"],
      [act({ do: "manpower", delta: 3 }), gauge("morale", -1)],
    ),
    c(
      "exempt",
      ["calm"],
      [
        act({ do: "manpower", delta: 2 }),
        gauge("shells", -1),
        opinion("business", -1),
      ],
    ),
    c(
      "women",
      ["gentle", "cheap"],
      [act({ do: "manpower", delta: 1 }), opinion("workers", 1)],
    ),
    waitCourse("c_men_wait"),
  ],
};

/** 병무: the colonies' men (FRA, GBR). */
const MEN_COLONIES: GwAnswerRow = {
  id: "c_men_colonies",
  nation: ["FRA", "GBR"],
  type: "men",
  when: war,
  findings: [f("colonies", 1)],
  courses: [
    c(
      "colonial",
      ["bold", "cheap"],
      [act({ do: "manpower", delta: 2 }), opinion("press", -1)],
    ),
  ],
};

// ---- ww199: 외교: {나라}의 처분 (the `settle` task) ----
//
// The engine gives this task to the foreign office the moment a table opens
// with the seat among the winners; the topic is the beaten country. Each
// course paints a plan on the land the seat holds (Fate.settlePlan); the seat
// can still change it place by place before the table. The country rows come
// first: their `wide` course (new states) leads where a state can be founded,
// and the general staff's `strip` stays last, for the rival head to bring.

/** The seat's country holds land of `from` (in `group`, or `place`). */
const holdsOf = (
  from: GwTag,
  where: { group?: GwPlaceGroup[]; place?: GwPlace[] } = {},
): GwCond => world({ is: "land_taken", from, ...where });
/** A country fights on the seat's side. */
const withUs = (tag: GwTag): GwCond => joinedUs(tag);

/** 넓게 묶는다: states where a row is open on the seat's side, the rest held long. */
const wide = (side: GwCond): GwCourseRow =>
  c("wide", ["bold"], [remember("c_settle_wide")], {
    when: side,
    settle: "wide",
  });

/** A beaten country's own findings, and its `wide` where states can rise. */
const settleOf = (
  tag: GwTag,
  findings: GwFindingRow[],
  side?: GwCond,
): GwAnswerRow => ({
  id: `c_settle_${tag.toLowerCase()}`,
  nation: SEATS.filter((s) => s !== tag),
  type: "settle",
  topic: [tag],
  findings,
  courses: side === undefined ? [] : [wide(side)],
});

const SETTLE_RUS = settleOf(
  "RUS",
  [
    f("poland", 3, { when: holdsOf("RUS", { group: ["russian_poland"] }) }),
    f("baltic", 2, { when: holdsOf("RUS", { group: ["baltic"] }) }),
    f("ukraine", 3, { when: holdsOf("RUS", { group: ["ukraine"] }) }),
    f("caucasus", 2, { when: all(central, withUs("OTT")) }),
    f("reds", 1),
  ],
  central,
);
const SETTLE_ROU = settleOf("ROU", [
  f("oil", 3, { when: holdsOf("ROU", { place: ["ploesti"] }) }),
  f("dobruja", 2, { when: all(central, withUs("BGR")) }),
  f("king", 2, on({ ruler: ANY })),
  f("grain", 1),
]);
const SETTLE_SRB = settleOf(
  "SRB",
  [
    f("held", 3, { when: holdsOf("SRB", { group: ["serbia"] }) }),
    f("macedonia", 2, { when: all(central, withUs("BGR")) }),
    f("army_out", 2),
    f("hills", 1),
  ],
  central,
);
const SETTLE_BEL = settleOf(
  "BEL",
  [
    f("flemish", 3, { when: holdsOf("BEL", { group: ["flanders"] }) }),
    f("watched", 2, { when: not(world({ is: "entered", tag: "USA" })) }),
    f("king", 2),
    f("ports", 1, { when: holdsOf("BEL", { group: ["flanders"] }) }),
  ],
  central,
);
const SETTLE_ALB = settleOf(
  "ALB",
  [
    f("wied", 2),
    f("valona", 2, { when: all(entente, withUs("ITA")) }),
    f("clans", 1),
  ],
  any(central, entente),
);
const SETTLE_AUH = settleOf(
  "AUH",
  [
    f("council", 3, { when: holdsOf("AUH", { group: ["bohemia"] }) }),
    f("italy", 2, { when: all(entente, withUs("ITA")) }),
    f("romania", 2, { when: all(entente, withUs("ROU")) }),
    f("crown", 1, on({ ruler: ANY })),
  ],
  entente,
);
const SETTLE_OTT = settleOf(
  "OTT",
  [
    f("hussein", 3, { when: holdsOf("OTT", { group: ["hejaz"] }) }),
    f("shares", 2, { when: entente }),
    f("straits", 2, { when: holdsOf("OTT", { group: ["straits"] }) }),
    f("arabs", 1),
  ],
  entente,
);
const SETTLE_DEU = settleOf(
  "DEU",
  [
    f("rhine", 3, { when: holdsOf("DEU", { group: ["rhineland"] }) }),
    f("alsace", 2, { when: all(entente, withUs("FRA")) }),
    f("colonies", 2, { when: holdsOf("DEU", { group: ["colonies"] }) }),
    f("kaiser", 1, on({ ruler: ANY })),
  ],
  entente,
);
const SETTLE_FRA = settleOf("FRA", [
  f("briey", 3, { when: holdsOf("FRA", { group: ["western_front"] }) }),
  f("paris", 2, { when: holdsOf("FRA", { place: ["paris"] }) }),
  f("colonies", 1),
]);

/**
 * 외교: {나라}의 처분, any beaten country. Courses (design ww198 §1.2): 좁게
 * 끝낸다, 전쟁이 끝날 때까지 군정, 속국으로 둔다, and last the general
 * staff's 국경 띠 (firm), which the rival head brings when it is left over.
 */
const SETTLE: GwAnswerRow = {
  id: "c_settle",
  nation: SEATS,
  type: "settle",
  question: "person",
  findings: [
    f("ruler", 2, on({ ruler: ANY })),
    f("sent", 2, on({ sent: ANY })),
    f("resist", 3, { when: world({ is: "resist", min: 2 }) }),
    f("us_watch", 2, { when: not(world({ is: "entered", tag: "USA" })) }),
    f("us_in", 1, { when: world({ is: "entered", tag: "USA" }) }),
    f("war_on", 2, { when: war }),
    f("tired", 1, { when: level("morale", undefined, 1) }),
  ],
  courses: [
    c(
      "narrow",
      ["gentle", "calm"],
      [opinion("army", -1), remember("c_settle_narrow")],
      { settle: "narrow" },
    ),
    c("hold", ["wait"], [remember("c_settle_hold")], { settle: "hold" }),
    c("vassal", ["cheap", "bold"], [remember("c_settle_vassal")], {
      settle: "vassal",
    }),
    c("strip", ["firm"], [opinion("army", 1), remember("c_settle_strip")], {
      settle: "strip",
    }),
    waitCourse("c_settle_wait"),
  ],
};

/** The settle rows: the country rows first (their `wide` leads), then the common. */
const SETTLE_ROWS: readonly GwAnswerRow[] = [
  SETTLE_RUS,
  SETTLE_ROU,
  SETTLE_SRB,
  SETTLE_BEL,
  SETTLE_ALB,
  SETTLE_AUH,
  SETTLE_OTT,
  SETTLE_DEU,
  SETTLE_FRA,
  SETTLE,
];

// ---- ww203: 표 계산 (the `count` task) ----
//
// The agenda gives this task to the seat's counting office (order
// `bill_count`); it is never offered. The topic is the bill's law id. The
// engine fills `tally` (the paper's overall word, GW_LAW_OUTLOOKS) and `swing`
// (the wavering factions), and writes the word on each faction into the
// bill's paper itself: these findings are the head's summary of it. Every
// course acts on the task's bill (`bill_topic`).

const onBill = (a: GwBillAct): GwEffect => act({ do: "bill_topic", act: a });

/**
 * 공통: {법안} 표 계산. A weak head may swear nobody wavers (the wrong
 * finding, only where somebody does). Courses: 표결에 부친다 always; 거둬들인다
 * when short or blocked; 흔들리는 쪽을 붙잡는다 when somebody wavers;
 * 수정안을 받는다 when it is close.
 */
const COUNT: GwAnswerRow = {
  id: "c_count",
  nation: SEATS,
  type: "count",
  findings: [
    f("easy", 3, on({ tally: ["easy"] })),
    f("tight", 3, on({ tally: ["tight"] })),
    f("short", 3, on({ tally: ["short"] })),
    f("blocked", 3, on({ tally: ["blocked"] })),
    f("swing", 2, on({ swing: ANY })),
    f("price", 1, on({ swing: ANY })),
    f("whips", 1),
    f("all_firm", 2, { wrong: true, ...on({ swing: ANY }) }),
  ],
  courses: [
    c("vote", ["bold", "firm"], [onBill("vote")]),
    c("withdraw", ["calm", "cheap"], [onBill("withdraw")], {
      slots: { tally: ["short", "blocked"] },
    }),
    c("work", ["gentle", "calm"], [onBill("work")], { slots: { swing: ANY } }),
    c("amend", ["gentle", "cheap"], [onBill("amend")], {
      slots: { tally: ["tight", "short"] },
    }),
    waitCourse("c_count_wait"),
  ],
};

// ---- ww207: 민심 동향 (the `poll` task) ----
//
// The interior office reads the communities. The engine (S1) fills `winner`
// (the faction that would win an election now), `rising` and `falling`
// (faction ids), `hot` (the communities at temper 2+) and `due` (the chamber
// whose election comes next). A weak head may swear nobody is up in arms.

/**
 * 공통: 민심 동향. Courses: 들끓는 쪽의 말을 들어 준다 and 집회에 경찰을 붙인다
 * when a community is hot; 결과를 신문에 흘린다; 덮어 둔다.
 */
const POLL: GwAnswerRow = {
  id: "c_poll",
  nation: SEATS,
  type: "poll",
  findings: [
    f("winner", 3, on({ winner: ANY })),
    f("hot", 3, on({ hot: ANY })),
    f("rising", 2, on({ rising: ANY })),
    f("falling", 2, on({ falling: ANY })),
    f("due", 2, on({ due: ANY })),
    f("bread", 1),
    f("all_quiet", 2, { wrong: true, ...on({ hot: ANY }) }),
  ],
  courses: [
    c("heed", ["gentle"], [gauge("money", -1), act({ do: "calm" })], {
      slots: { hot: ANY },
      needs: [money("little")],
    }),
    c(
      "police",
      ["firm"],
      [gauge("order", 1), opinion("workers", -1), opinion("press", -1)],
      { slots: { hot: ANY } },
    ),
    c("papers", ["bold"], [opinion("press", 1), remember("c_poll_papers")], {
      slots: { winner: ANY },
    }),
    c("keep", ["calm", "cheap"], [remember("c_poll_keep")]),
    waitCourse("c_poll_wait"),
  ],
};

/**
 * A course by law, at war: the seat's own bill (lawDraftCard) in place of the
 * common course of that id. Text `depts.answers.c_<type>_law_<tag>`.
 */
interface LawCourse {
  readonly type: GwTaskType;
  readonly tag: GwTag;
  readonly course: string;
  readonly law: string;
  readonly lean: GwLean[];
}

const LAW_COURSES: readonly LawCourse[] = [
  // 배급: the seat's food law.
  ...(
    [
      ["DEU", "deu_bread_cards"],
      ["GBR", "gbr_food"],
      ["FRA", "fra_law_supply_decrees"],
      ["RUS", "rus_grain"],
      ["AUH", "auh_food"],
    ] as const
  ).map(
    ([tag, law]): LawCourse => ({
      type: "bread",
      tag,
      course: "ration",
      law,
      lean: ["firm", "calm"],
    }),
  ),
  // 나라가 맡는다: the factories under the state.
  ...(
    [
      ["DEU", "deu_aux"],
      ["GBR", "gbr_munitions"],
      ["RUS", "rus_factories"],
      ["AUH", "auh_factories"],
    ] as const
  ).map(
    ([tag, law]): LawCourse => ({
      type: "arms",
      tag,
      course: "state",
      law,
      lean: ["firm", "bold"],
    }),
  ),
  // 병력: the next men by law.
  {
    type: "men",
    tag: "FRA",
    course: "exempt",
    law: "fra_law_dalbiez",
    lean: ["calm"],
  },
  {
    type: "men",
    tag: "RUS",
    course: "class",
    law: "rus_ratniki",
    lean: ["firm", "bold"],
  },
  {
    type: "men",
    tag: "AUH",
    course: "class",
    law: "auh_landsturm",
    lean: ["firm", "bold"],
  },
  // 단속: the emergency law.
  ...(
    [
      ["DEU", "deu_strike_ban"],
      ["GBR", "gbr_dora"],
      ["FRA", "fra_law_siege"],
    ] as const
  ).map(
    ([tag, law]): LawCourse => ({
      type: "unrest",
      tag,
      course: "ban",
      law,
      lean: ["firm"],
    }),
  ),
  // 세금: the income tax.
  {
    type: "money",
    tag: "FRA",
    course: "tax",
    law: "fra_law_income_tax",
    lean: ["firm"],
  },
];

/** The law row's id: `c_<type>_law_<tag>`. */
export const commonLawRowId = (type: GwTaskType, tag: GwTag): string =>
  `c_${type}_law_${tag.toLowerCase()}`;

const LAW_ROWS: GwAnswerRow[] = LAW_COURSES.map((l) => ({
  id: commonLawRowId(l.type, l.tag),
  nation: [l.tag],
  type: l.type,
  when: war,
  findings: [],
  courses: [
    c(l.course, l.lean, [remember(`c_${l.type}_law`), trustOf(head, 1)], {
      needs: [bill(l.law)],
    }),
  ],
}));

/**
 * The common answer rows: the one-nation law rows first (their course wins
 * by id), the country rows after their type's row (they share its title).
 */
export const COMMON_ANSWERS: readonly GwAnswerRow[] = [
  ...LAW_ROWS,
  ENVOY,
  ...NEUTRALS.map(envoyNeutral),
  ENVOY_OTHER,
  INTEL,
  ...WATCHED.map(intelOf),
  FRONT,
  FRONT_PEACE,
  MONEY,
  BUDGET,
  BREAD,
  UNREST,
  FLEET,
  BUILD,
  ARMS,
  MEN,
  MEN_COLONIES,
  ...SETTLE_ROWS,
  COUNT,
  POLL,
];

export const COMMON_DEPTS: GwDeptContent = {
  answers: COMMON_ANSWERS,
  // Design §4.8: whose head comes with a counter-paper. Several rows may name
  // one office: each row is its own pairing, with its own tags.
  rivals: [
    // ww193 merge: rows about named papers come first; on those the heads
    // need not be at odds. DEU #3: the general staff answers the plan to
    // dissolve the Prussian house with its own paper.
    {
      office: "chancellor",
      against: ["chief_of_staff"],
      papers: ["deu_dept_landtag"],
      counter: "deu_dept_landtag_ohl",
    },
    {
      office: "interior",
      against: ["chief_of_staff"],
      papers: ["deu_dept_landtag"],
      counter: "deu_dept_landtag_ohl",
    },
    // GBR #4: the intelligence head's line on Casement (the diaries) is
    // marked beside the Home Office's.
    {
      office: "interior",
      against: ["intelligence"],
      papers: ["gbr_dept_casement"],
    },
    // The diplomats against the soldiers, both ways.
    { office: "foreign", against: ["chief_of_staff", "supreme_commander"] },
    { office: "chief_of_staff", against: ["foreign"] },
    // A supreme commander against the war ministry that supplies him, and the
    // diplomats who promise what his front must hold.
    { office: "supreme_commander", against: ["war", "foreign"] },
    // The fleet against the army's share, the purse and its own sea lords.
    { office: "navy", against: ["war", "finance", "sea_lord"] },
    // Order at home: the police and the army over strikes and the streets.
    { office: "interior", against: ["war"], tags: ["home"] },
    // Munitions against the war ministry it took the shells from.
    { office: "munitions", against: ["war"] },
    // The government against the soldiers over the war's own papers.
    { office: "chancellor", against: ["chief_of_staff"], tags: ["war"] },
    // Whatever spends, the treasury has a word on it.
    { office: "finance", cost: true },
    // Vienna and Budapest.
    { office: "hun_pm", against: ["chancellor"] },
    { office: "chancellor", against: ["hun_pm"] },
  ],
};
