import {
  type GwGauge,
  type GwInstitution,
  type GwIssue,
  type GwOffice,
  type GwSecret,
  type GwStage,
  type GwTemperament,
  type GwTheatre,
  type GwTopic,
  gwFirstLine,
  gwLastLine,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  byName,
  byOffice,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwReact,
  GwScene,
  GwWho,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Britain, the world share: the `gbr_f_` scenes, the summoned talks of McKenna,
 * Balfour, Hankey and Churchill, five visits, and the ten endings. Data only;
 * the text is in resources/ww1914/ko/GBR.world.json. Plan: ww135-plan-gbr.md
 * sections 8, 9, 10, 14.
 */

const NATION: GwScene["nation"] = ["GBR"];
const who = role("who");

const CRISIS: GwStage[] = ["crisis"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR: GwStage[] = ["war"];

/** Whole months since the war began; `own`: since the seat's country came in. */
const warMonths = (min?: number, max?: number, own = false): GwCond => ({
  kind: "world",
  of: {
    is: "war_months",
    ...(own ? { own } : {}),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  },
});

const ch = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});

// ---- The state of the world ----

const warOn: GwCond = { kind: "at_war", tag: "DEU" };
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const fighting = (tag: GwTag): GwCond =>
  world({ is: "entered", tag, side: "entente" });
const isOut = (tag: GwTag): GwCond => world({ is: "out", tag });
const usaIn = fighting("USA");
const usaOut = not(usaIn);
const lg = flag("f_pm_lg");
const co = flag("f_coalition");
const belg = world({ is: "plan", of: ["west"] });
const east1 = world({ is: "plan", of: ["east"] });
const noSarajevo: GwCond = { kind: "opening", of: ["no_sarajevo"] };

/** The Continent fights and Britain stays out. */
const neutral = all(
  world({ is: "neutral", tag: "GBR" }),
  world({ is: "entered", tag: "FRA" }),
);
/** The ultimatum is still on the table: nobody has settled for neutrality yet. */
const entryOpen = all(
  any(belg, flag("f_stand_france")),
  not(flag("f_ult_lapsed")),
  not(flag("f_neutral_declared")),
);
/** The crisis closed without a great war. */
const peace = all(
  not(world({ is: "war" })),
  world({ is: "chain_end", of: ["compromise", "humiliation", "fizzled"] }),
);
/** Russia's order gone. */
const russiaBroke = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep", "soviet"],
});
/** The enemy is asking. */
const askedPeace = any(isOut("DEU"), world({ is: "armistice" }));
/** ww187: France is falling now, not only once (WorldFlags.flagNow). */
const franceFalling = world({ is: "flag_now", flag: "w_france_falling" });
/** The table would carry it. */
const votes = (issue: GwIssue): GwCond => world({ is: "votes", issue, min: 0 });
const exists = (id: GwSecret): GwCond => ({ kind: "secret", id });

const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const gaugeOver = (gauge: GwGauge, min: number): GwCond => ({
  kind: "gauge",
  gauge,
  min,
});
const open = (theatre: GwTheatre): GwCond => world({ is: "open", theatre });
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const pressure = (topic: GwTopic, min: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
});
const score = (min?: number, max?: number): GwCond =>
  world({ is: "score", min, max });
const casualties = (min: number): GwCond => world({ is: "casualties", min });
const front = (theatre: GwTheatre, from?: string, to?: string): GwCond =>
  world({
    is: "front",
    theatre,
    from: from ?? gwFirstLine(theatre),
    to: to ?? gwLastLine(theatre),
  });
const trenchMin = (theatre: GwTheatre, min: number): GwCond => ({
  kind: "trench",
  theatre,
  min,
});
const nationTrustMin = (tag: GwTag, min: number): GwCond => ({
  kind: "trust",
  tag,
  min,
});
const nationTrustMax = (tag: GwTag, max: number): GwCond => ({
  kind: "trust",
  tag,
  max,
});
const foreignLosses = (): GwCond => world({ is: "war_age", min: 18 });
const promiseBroken = (w: GwWho, key: string): GwCond => ({
  kind: "promise",
  who: w,
  key,
  broken: true,
});
/** At least `n` of the country's four pledges are out (plan section 11). */
const pledges = (n: number): GwCond => {
  const keys = ["m_mecca", "m_france_map", "m_zion", "m_russia_straits"];
  const pick = (from: number, left: number): GwCond[] =>
    left === 0
      ? [all()]
      : keys
          .slice(from)
          .flatMap((k, i) =>
            pick(from + i + 1, left - 1).map((rest) => all(memory(k), rest)),
          );
  return any(...pick(0, n));
};

// ---- Prices ----

const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const delay = (days: number): GwEffect => ({ kind: "delay", days });
const audiences = (delta: number): GwEffect => ({ kind: "audiences", delta });
const pride = (w: GwWho, delta: number): GwEffect => ({
  kind: "pride",
  who: w,
  delta,
});
const readiness = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "readiness", tag, delta });

/** The table, the House, the opposition, the Irish. */
const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const cabinet = (d: number) => body("cabinet", d);
const commons = (d: number) => body("commons", d);
const opposition = (d: number) => body("opposition", d);
const irish = (d: number) => body("irish", d);

/** A word said to a person on an issue: the count reads `v_<issue>`. */
const vote = (issue: string, w: GwWho, weight: number): GwEffect => ({
  kind: "remember",
  key: `v_${issue}`,
  who: w,
  weight,
});

const reveal = (id: GwSecret): GwEffect => doWorld({ do: "reveal", id });
const knows = (id: GwSecret): GwCond => world({ is: "known", id });

// ---- Talks ----

const shut: GwCond = { kind: "person_trust", who, max: -2 };
const close: GwCond = { kind: "person_trust", who, min: 2 };
const ifMood = (
  next: string | null,
  effects: GwEffect[],
  ...of: GwTemperament[]
): GwReact => ({ when: moody(who, ...of), next, effects });
const ifTrust = (
  min: number,
  next: string | null,
  effects: GwEffect[],
): GwReact => ({ when: { kind: "person_trust", who, min }, next, effects });
const ifCold = (next: string | null, effects: GwEffect[] = []): GwReact => ({
  when: shut,
  next,
  effects,
});
const ifThen = (
  when: GwCond,
  next: string | null,
  effects: GwEffect[] = [],
): GwReact => ({ when, next, effects });

export const GBR_WORLD_SCENES: readonly GwScene[] = [
  {
    id: "gbr_f_contraband",
    nation: NATION,
    kind: "crisis",
    when: all(warOn, world({ is: "war_months", own: true, min: 1, max: 2 })),
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 8,
    tags: ["foreign"],
    variants: [
      { id: "spring", when: memory("k_spring_cotton") },
      { id: "loans", when: world({ is: "thread", id: "us_loans" }) },
      { id: "base" },
    ],
    fallback: "declaration",
    options: [
      {
        id: "declaration",
        tell: ["usa:+1", "navy:-1"],
        effects: [
          nation("USA", 1),
          trustOf(role("navy"), -1),
          setFlag("f_list_soft"),
        ],
      },
      {
        id: "tighten",
        tell: ["usa:-1", "fm:-1", "navy:+1"],
        effects: [
          nation("USA", -1),
          trustOf(role("fm"), -1),
          trustOf(role("navy"), 1),
          setFlag("f_list_tight"),
          reason("wd_list_tight"),
        ],
      },
      {
        id: "pay_for_cotton",
        when: memory("k_spring_cotton"),
        tell: ["money:-1", "usa:+1"],
        effects: [
          gauge("money", -1),
          nation("USA", 1),
          setFlag("f_cotton_paid"),
          reason("wd_cotton_paid"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_blockade",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 5, max: 11 }),
      open("sea"),
    ),
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [
      { id: "tight", when: chose("gbr_f_contraband", "tighten") },
      { id: "soft", when: chose("gbr_f_contraband", "declaration") },
      { id: "base" },
    ],
    fallback: "full_order",
    options: [
      {
        id: "full_order",
        tell: ["usa:-1", "fra:+1", "navy:+1"],
        effects: [
          nation("USA", -1),
          nation("FRA", 1),
          trustOf(role("navy"), 1),
          setFlag("f_full_blockade"),
          reason("wd_full_order"),
        ],
      },
      {
        id: "half_order",
        tell: ["usa:+1", "navy:-1"],
        effects: [
          nation("USA", 1),
          trustOf(role("navy"), -1),
          setFlag("f_half_blockade"),
        ],
      },
      {
        id: "ask_washington",
        tell: ["delay:14", "usa:+1", "fra:-1"],
        effects: [
          delay(14),
          nation("USA", 1),
          nation("FRA", -1),
          setFlag("f_asked_washington"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_dollars",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 23, max: 29 }),
      gaugeAt("money", 1),
    ),
    cast: { fin: { office: "finance" }, cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      { id: "cliff", when: knows("usa_credit_cliff") },
      { id: "morgan_own", when: chose("gbr_f_morgan", "own_agents") },
      { id: "lg", when: lg },
      { id: "base" },
    ],
    fallback: "buy_on",
    options: [
      {
        id: "buy_on",
        tell: ["fin:-1", "shells:+1"],
        effects: [
          trustOf(role("fin"), -1),
          gauge("shells", 1),
          setFlag("f_bought_on"),
        ],
      },
      {
        id: "sell_securities",
        when: memory("k_mck_dollars"),
        tell: ["money:+1", "fin:+1", "opposition:+1"],
        effects: [
          gauge("money", 1),
          trustOf(role("fin"), 1),
          opposition(1),
          setFlag("f_sold_securities"),
          reason("wd_securities"),
        ],
      },
      {
        id: "war_loan",
        when: memory("k_law_loan"),
        tell: ["money:+1", "commons:+1", "order:-1"],
        effects: [
          gauge("money", 1),
          commons(1),
          gauge("order", -1),
          setFlag("f_big_loan"),
        ],
      },
      {
        id: "cut_orders",
        tell: ["money:+1", "shells:-1", "fra:-1", "cos:-1"],
        effects: [
          gauge("money", 1),
          gauge("shells", -1),
          nation("FRA", -1),
          trustOf(role("cos"), -1),
          setFlag("f_cut_orders"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_peace_notes",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 23, max: 35 })),
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      { id: "house", when: chose("gbr_f_house", "initial") },
      { id: "lg", when: lg },
      { id: "behind", when: score(undefined, -10) },
      { id: "base" },
    ],
    fallback: "reject",
    options: [
      {
        id: "reject",
        tell: ["fra:+1", "usa:-1"],
        effects: [
          nation("FRA", 1),
          nation("USA", -1),
          setFlag("f_notes_rejected"),
        ],
      },
      {
        id: "ask_terms",
        tell: ["usa:+1", "fra:-1", "rus:-1", "cabinet:-1"],
        effects: [
          nation("USA", 1),
          nation("FRA", -1),
          nation("RUS", -1),
          cabinet(-1),
          setFlag("f_asked_terms"),
          reason("wd_asked_terms"),
        ],
      },
      {
        id: "state_aims",
        tell: ["usa:+1", "fra:+1"],
        effects: [nation("USA", 1), nation("FRA", 1), setFlag("f_stated_aims")],
      },
    ],
  },
  {
    id: "gbr_f_zimmermann",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 29, max: 35 }),
      usaOut,
      exists("deu_zimmermann_wire"),
    ),
    cast: {
      fm: { office: "foreign" },
      navy: { office: "navy" },
      hall: { person: "gbr_hall" },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    variants: [
      { id: "known", when: memory("k_hall_wire") },
      { id: "lg", when: lg },
      { id: "base" },
    ],
    fallback: "hold_it",
    options: [
      {
        id: "hold_it",
        tell: ["navy:+1"],
        effects: [
          trustOf(role("navy"), 1),
          setFlag("f_wire_held"),
          reason("wd_wire_held"),
        ],
      },
      {
        id: "give_washington",
        when: memory("k_hall_wire"),
        tell: ["usa:+2", "fm:+1"],
        effects: [
          nation("USA", 2),
          trustOf(role("fm"), 1),
          setFlag("f_wire_given"),
          readiness("USA", 25),
          reason("wd_wire_given"),
        ],
      },
      {
        id: "leak_press",
        tell: ["usa:+1", "navy:-1", "morale:+1"],
        effects: [
          nation("USA", 1),
          trustOf(role("navy"), -1),
          gauge("morale", 1),
          setFlag("f_wire_leaked"),
          readiness("USA", 10),
        ],
      },
    ],
  },
  {
    id: "gbr_f_armistice",
    nation: NATION,
    kind: "crisis",
    stage: ["war", "conference", "closing"],
    when: all(warOn, askedPeace),
    cast: {
      fm: { office: "foreign" },
      cos: { office: "chief_of_staff" },
      navy: { office: "navy" },
    },
    salience: 9,
    tags: ["foreign", "tension_down"],
    variants: [
      { id: "rhine", when: all(front("west", undefined, "liege"), usaIn) },
      { id: "france_soil", when: front("west", "hindenburg") },
      { id: "no_america", when: not(usaIn) },
      { id: "base" },
    ],
    fallback: "stiff_terms",
    options: [
      {
        id: "stiff_terms",
        tell: ["fra:+1", "usa:-1", "temp:-1"],
        effects: [
          nation("FRA", 1),
          nation("USA", -1),
          temp(-1),
          setFlag("f_stiff_armistice"),
        ],
      },
      {
        id: "soft_terms",
        tell: ["usa:+1", "fra:-1", "casualties_low"],
        effects: [
          nation("USA", 1),
          nation("FRA", -1),
          setFlag("f_soft_armistice"),
          reason("wd_soft_terms"),
        ],
      },
      {
        id: "peace_table",
        when: memory("k_han_peace"),
        tell: ["fra:+1", "fm:+1"],
        effects: [
          nation("FRA", 1),
          trustOf(role("fm"), 1),
          setFlag("f_table_ready"),
          reason("wd_table_ready"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_conference",
    nation: NATION,
    kind: "ledger",
    stage: ["war", "conference", "closing"],
    when: any(
      seen("gbr_f_armistice"),
      chose("gbr_f_neutral_mediate", "call_conference"),
    ),
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 9,
    tags: ["foreign"],
    variants: [
      { id: "crowded", when: pledges(3) },
      { id: "two", when: pledges(2) },
      { id: "one", when: pledges(1) },
      { id: "base" },
    ],
    fallback: "sign_all",
    options: [
      {
        id: "sign_all",
        tell: ["fra:+1", "money:-1"],
        effects: [
          nation("FRA", 1),
          gauge("money", -1),
          setFlag("f_signed_all"),
          reason("wd_signed_all"),
        ],
      },
      {
        id: "drop_one",
        tell: ["fra:-1", "fm:+1"],
        effects: [
          nation("FRA", -1),
          trustOf(role("fm"), 1),
          setFlag("f_dropped_one"),
          reason("wd_dropped_one"),
        ],
      },
      {
        id: "keep_mine",
        tell: ["fra:-2", "usa:-1", "navy:+1"],
        effects: [
          nation("FRA", -2),
          nation("USA", -1),
          trustOf(role("navy"), 1),
          setFlag("f_kept_mine"),
        ],
      },
    ],
  },
  {
    id: "gbr_t_mckenna_lg",
    nation: NATION,
    kind: "talk",
    stage: CRISIS,
    when: all(ch(0, 5), not(lg)),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: false,
    cooldown: 6,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "stubborn", when: moody(who, "stubborn") },
          { id: "hot", when: { kind: "temp", min: 5 } },
          { id: "base" },
        ],
        replies: [
          {
            id: "side",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "side",
            reacts: [ifCold("wall")],
            gain: [remember("k_mck_table_seen")],
          },
          {
            id: "count",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            reacts: [
              ifMood("count", [remember("m_table_count")], "cold", "stubborn"),
            ],
            miss: "wall",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "wall",
            reacts: [ifTrust(2, "side", [])],
          },
          {
            id: "share",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "audiences:-1"],
            effects: [
              trustOf(who, 1),
              audiences(-1),
              remember("m_table_count"),
            ],
            next: "count",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      side: {
        says: [{ id: "close", when: close }, { id: "base" }],
        replies: [
          {
            id: "count",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      count: {
        says: [{ id: "hot", when: { kind: "temp", min: 5 } }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_mckenna_police",
    nation: NATION,
    kind: "talk",
    stage: CRISIS,
    when: ch(0, 3),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "shut", when: shut },
          { id: "cold", when: moody(who, "cold") },
          { id: "base" },
        ],
        replies: [
          {
            id: "show",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
            gain: [remember("k_mck_police")],
            miss: "evade",
          },
          {
            id: "trust",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
            reacts: [ifMood("evade", [], "cold")],
            gain: [remember("k_mck_police")],
          },
          {
            id: "order",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "evade",
            reacts: [ifMood("numbers", [remember("k_mck_police")], "stubborn")],
          },
          {
            id: "guard",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [trustOf(who, 1), remember("k_mck_police")],
            next: "numbers",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      numbers: {
        says: [{ id: "hot", when: pressure("ireland", 3) }, { id: "base" }],
        replies: [
          {
            id: "south",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "south",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      south: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      evade: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_mckenna_duties",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 5, max: 17 })),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "fin", when: holds("finance", "gbr_mckenna") },
          { id: "base" },
        ],
        replies: [
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "party",
            gain: [remember("k_mck_duties")],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "party",
            reacts: [ifMood("sour", [], "cold")],
            gain: [remember("k_mck_duties")],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [remember("k_mck_duties")],
            next: "party",
            reacts: [
              ifThen({ kind: "pride", who: who, min: 4 }, "sour", [
                pride(who, 1),
              ]),
            ],
          },
          {
            id: "cover",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "commons:-1"],
            effects: [trustOf(who, 1), commons(-1), remember("k_mck_duties")],
            next: "party",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [remember("mck_duties_refused")],
            next: null,
          },
        ],
      },
      party: {
        says: [{ id: "co", when: co }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sour: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_mckenna_army",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 11, max: 23 })),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "stubborn", when: moody(who, "stubborn") },
          { id: "base" },
        ],
        replies: [
          {
            id: "what",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "limit",
            gain: [remember("k_mck_army")],
            miss: "wall",
          },
          {
            id: "law",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "resign",
            reacts: [ifCold("wall")],
          },
          {
            id: "force",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [trustOf(who, -1), vote("conscription", who, 1)],
            next: "resign",
            reacts: [ifMood("wall", [pride(who, 1)], "stubborn")],
          },
          {
            id: "trade",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "cabinet:+1"],
            effects: [
              trustOf(who, 1),
              cabinet(1),
              remember("k_mck_army"),
              vote("conscription", who, 1),
            ],
            next: "limit",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      limit: {
        says: [{ id: "cold", when: moody(who, "cold") }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      resign: {
        says: [{ id: "close", when: close }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_mckenna_dollars",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 17, max: 29 })),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "money", when: gaugeAt("money", 1) },
          { id: "cold", when: moody(who, "cold") },
          { id: "base" },
        ],
        replies: [
          {
            id: "see",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cliff",
            reacts: [ifCold("evade")],
            gain: [remember("k_mck_dollars"), reveal("usa_credit_cliff")],
            miss: "evade",
          },
          {
            id: "read",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cliff",
            gain: [remember("k_mck_dollars"), reveal("usa_credit_cliff")],
            miss: "evade",
          },
          {
            id: "take",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [trustOf(who, -1)],
            next: "evade",
          },
          {
            id: "secret",
            stance: "warm",
            kind: "deal",
            tell: ["cabinet:-1", "trust:+1"],
            effects: [
              cabinet(-1),
              trustOf(who, 1),
              remember("k_mck_dollars"),
              reveal("usa_credit_cliff"),
            ],
            next: "cliff",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cliff: {
        says: [{ id: "lg", when: lg }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      evade: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_mckenna_stand",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 23, max: 29 }),
      co,
      not(lg),
    ),
    cast: { who: { person: "gbr_mckenna" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "shut", when: shut },
          { id: "stubborn", when: moody(who, "stubborn") },
          { id: "base" },
        ],
        replies: [
          {
            id: "who",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            reacts: [ifCold("wall")],
            gain: [remember("m_lg_circle")],
          },
          {
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            gain: [remember("k_mck_stand")],
          },
          {
            id: "rally",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "cabinet:+1"],
            effects: [trustOf(who, 1), cabinet(1), remember("k_mck_stand")],
            next: "how",
          },
          {
            id: "doubt",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "wall",
            reacts: [ifMood("how", [remember("k_mck_stand")], "cold")],
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "how",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            gain: [remember("k_mck_stand")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      how: {
        says: [{ id: "close", when: close }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_cid",
    nation: NATION,
    kind: "talk",
    stage: CRISIS,
    when: ch(0, 4),
    cast: { who: { person: "gbr_balfour" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "cold", when: moody(who, "cold") },
          { id: "cunning", when: moody(who, "cunning") },
          { id: "base" },
        ],
        replies: [
          {
            id: "thick",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "thick",
            reacts: [ifThen(moody(who, "cunning"), "fence", [])],
            gain: [remember("k_bal_cid")],
          },
          {
            id: "cold",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "thick",
            gain: [remember("k_bal_cid")],
            miss: "fence",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fence",
            reacts: [ifMood("thick", [remember("k_bal_cid")], "weary")],
          },
          {
            id: "pact",
            stance: "warm",
            kind: "deal",
            tell: ["opposition:-1", "trust:+1"],
            effects: [opposition(-1), trustOf(who, 1), remember("k_bal_cid")],
            next: "thick",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      thick: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "mean",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mean",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      mean: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_admiralty",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 5, max: 17 })),
    cast: { who: { person: "gbr_balfour" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "fisher", when: seen("gbr_w_fisher_out") },
          { id: "base" },
        ],
        replies: [
          {
            id: "will",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "will",
            reacts: [ifCold("fence")],
            gain: [remember("k_bal_admiralty")],
          },
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: ["promise", "opposition:-1"],
            effects: [
              opposition(-1),
              remember("k_bal_admiralty"),
              remember("m_bal_seat"),
            ],
            next: "will",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "fence",
            reacts: [ifMood("will", [remember("k_bal_admiralty")], "cold")],
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      will: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "chu",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "chu",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      chu: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_communique",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 17, max: 29 }),
      seen("gbr_w_jutland"),
    ),
    cast: { who: { person: "gbr_balfour" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "navy", when: holds("navy", "gbr_balfour") },
          { id: "base" },
        ],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            gain: [remember("k_bal_communique")],
          },
          {
            id: "fix",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [remember("k_bal_communique")],
            next: "who",
            reacts: [ifMood("fence", [], "cunning")],
          },
          {
            id: "praise",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fence",
            reacts: [ifMood("who", [remember("k_bal_communique")], "weary")],
          },
          {
            id: "share",
            stance: "warm",
            kind: "deal",
            tell: ["commons:+1", "trust:+1"],
            effects: [
              commons(1),
              trustOf(who, 1),
              remember("k_bal_communique"),
            ],
            next: "who",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_mission",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(world({ is: "war_months", min: 29, max: 35 }), usaIn),
    cast: { who: { person: "gbr_balfour" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "fm", when: holds("foreign", "gbr_balfour") },
          { id: "weary", when: moody(who, "weary") },
          { id: "base" },
        ],
        replies: [
          {
            id: "aim",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "aims",
            reacts: [ifCold("fence")],
            gain: [remember("k_bal_mission")],
          },
          {
            id: "treaties",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "aims",
            gain: [remember("k_bal_mission")],
            miss: "fence",
          },
          {
            id: "send",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "fence",
          },
          {
            id: "grant",
            stance: "warm",
            kind: "deal",
            tell: ["usa:+1", "trust:+1"],
            effects: [
              nation("USA", 1),
              trustOf(who, 1),
              remember("k_bal_mission"),
            ],
            next: "aims",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      aims: {
        says: [{ id: "close", when: close }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_zion",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", own: true, min: 29, max: 41 }),
      atWar("OTT"),
    ),
    cast: { who: { person: "gbr_balfour" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "fm", when: holds("foreign", "gbr_balfour") },
          { id: "base" },
        ],
        replies: [
          {
            id: "use",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "use",
            gain: [remember("k_bal_zion")],
            miss: "fence",
          },
          {
            id: "you",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "belief",
            reacts: [
              ifThen(moody(who, "cunning"), "use", [remember("k_bal_zion")]),
            ],
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "fence",
          },
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "cabinet:-1"],
            effects: [trustOf(who, 1), cabinet(-1), remember("k_bal_zion")],
            next: "use",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [remember("bal_asked_who_lives")],
            next: null,
          },
        ],
      },
      belief: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "use",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "use",
            gain: [remember("k_bal_zion")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      use: {
        says: [{ id: "mecca", when: memory("m_mecca") }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_balfour_old",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(world({ is: "war_months", min: 11, max: 47 }), any(co, lg)),
    cast: {
      who: { person: "gbr_balfour" },
      cos: { office: "chief_of_staff" },
      fin: { office: "finance" },
    },
    salience: 3,
    tags: ["people"],
    once: false,
    cooldown: 10,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "lg", when: lg },
          { id: "cunning", when: moody(who, "cunning") },
          { id: "base" },
        ],
        replies: [
          {
            id: "cos",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cos",
            reacts: [ifCold("fence")],
          },
          {
            id: "fin",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fin",
            reacts: [ifCold("fence")],
          },
          {
            id: "me",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "me",
            reacts: [ifMood("fence", [], "cunning")],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [trustOf(who, 1)],
            next: "cos",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cos: {
        says: [
          {
            id: "high",
            when: {
              kind: "competence",
              who: { role: "cos" },
              field: "war",
              min: 3,
            },
          },
          {
            id: "low",
            when: {
              kind: "competence",
              who: { role: "cos" },
              field: "war",
              max: 1,
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fin: {
        says: [
          {
            id: "high",
            when: {
              kind: "competence",
              who: { role: "fin" },
              field: "admin",
              min: 3,
            },
          },
          {
            id: "low",
            when: {
              kind: "competence",
              who: { role: "fin" },
              field: "admin",
              max: 1,
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      me: {
        says: [{ id: "lg", when: lg }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fence: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_boxing",
    nation: NATION,
    kind: "talk",
    stage: Y14_ON,
    when: all(
      warOn,
      all(
        world({ is: "war_months", own: true, min: 3 }),
        world({ is: "war_months", own: true, max: 11 }),
      ),
    ),
    cast: { who: { person: "gbr_hankey" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [{ id: "cunning", when: moody(who, "cunning") }, { id: "base" }],
        replies: [
          {
            id: "where",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "turk",
            gain: [remember("k_han_boxing")],
            miss: "paper",
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "readers",
            reacts: [ifMood("paper", [], "cunning")],
          },
          {
            id: "praise",
            stance: "flatter",
            kind: "push",
            tell: [],
            effects: [],
            next: "paper",
            reacts: [ifMood("turk", [remember("k_han_boxing")], "cold")],
          },
          {
            id: "table",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [trustOf(who, 1), remember("k_han_boxing")],
            next: "turk",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      turk: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      readers: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "where",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "turk",
            gain: [remember("k_han_boxing")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      paper: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_minutes",
    nation: NATION,
    kind: "talk",
    stage: Y14_ON,
    when: warMonths(undefined, 29, true),
    cast: { who: { person: "gbr_hankey" } },
    salience: 3,
    tags: ["people"],
    once: false,
    cooldown: 8,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "lg", when: lg },
          { id: "after", when: world({ is: "date", from: "1915-12" }) },
          { id: "cold", when: moody(who, "cold") },
          { id: "base" },
        ],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
            gain: [remember("k_han_minutes")],
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "sore",
            reacts: [ifMood("what", [remember("k_han_minutes")], "cunning")],
          },
          {
            id: "who",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            reacts: [ifCold("sore")],
          },
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "cabinet:-1"],
            effects: [trustOf(who, 1), cabinet(-1), remember("k_han_minutes")],
            next: "what",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      what: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [
          { id: "fisher", when: holds("sea_lord", "gbr_fisher") },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sore: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_landship",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 5, max: 23 })),
    cast: { who: { person: "gbr_hankey" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "chu", when: holds("navy", "gbr_churchill") },
          { id: "base" },
        ],
        replies: [
          {
            id: "when",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
            gain: [remember("k_han_landship")],
            miss: "shrug",
          },
          {
            id: "war",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "army",
          },
          {
            id: "order",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "shrug",
          },
          {
            id: "fund",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1", "trust:+1"],
            effects: [
              gauge("money", -1),
              trustOf(who, 1),
              remember("k_han_landship"),
            ],
            next: "when",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      when: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      army: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "when",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
            gain: [remember("k_han_landship")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      shrug: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_truth",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 11 })),
    cast: { who: { person: "gbr_hankey" }, cos: { office: "chief_of_staff" } },
    salience: 3,
    tags: ["people"],
    once: false,
    cooldown: 8,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "shut", when: shut },
          { id: "money", when: gaugeAt("money", 1) },
          { id: "bread", when: gaugeAt("bread", 1) },
          { id: "shells", when: gaugeAt("shells", 1) },
          { id: "base" },
        ],
        replies: [
          {
            id: "today",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
            reacts: [ifCold("sore")],
          },
          {
            id: "hidden",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hidden",
            reacts: [
              ifThen(
                all(open("straits"), world({ is: "date", to: "1916-05" })),
                "hidden",
                [reveal("ott_forts_short")],
              ),
            ],
            miss: "sore",
          },
          {
            id: "chief",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "chief",
            reacts: [ifCold("sore")],
          },
          {
            id: "rest",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [trustOf(who, 1)],
            next: "worst",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      worst: {
        says: [
          { id: "casualties", when: casualties(500) },
          {
            id: "straits",
            when: all(open("straits"), world({ is: "date", to: "1916-05" })),
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hidden",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hidden: {
        says: [
          {
            id: "forts",
            when: all(open("straits"), world({ is: "date", to: "1916-05" })),
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      chief: {
        says: [
          {
            id: "low",
            when: {
              kind: "competence",
              who: { role: "cos" },
              field: "war",
              max: 1,
            },
          },
          {
            id: "high",
            when: {
              kind: "competence",
              who: { role: "cos" },
              field: "war",
              min: 3,
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sore: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_convoy",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 29, max: 35 }),
      seen("gbr_w_shipping"),
    ),
    cast: { who: { person: "gbr_hankey" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [{ id: "lg", when: lg }, { id: "base" }],
        replies: [
          {
            id: "show",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            gain: [remember("k_han_convoy"), reveal("gbr_sailings_count")],
            miss: "guard",
          },
          {
            id: "name",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "name",
          },
          {
            id: "order",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "guard",
            reacts: [
              ifMood(
                "count",
                [remember("k_han_convoy"), reveal("gbr_sailings_count")],
                "cold",
              ),
            ],
          },
          {
            id: "cover",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "navy:-1"],
            effects: [
              trustOf(who, 1),
              trustOf(byOffice("navy"), -1),
              remember("k_han_convoy"),
              reveal("gbr_sailings_count"),
            ],
            next: "count",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      count: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      name: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "show",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            gain: [remember("k_han_convoy"), reveal("gbr_sailings_count")],
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      guard: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_hankey_peace",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 41 })),
    cast: { who: { person: "gbr_hankey" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "winning", when: score(20) },
          { id: "cold", when: moody(who, "cold") },
          { id: "base" },
        ],
        replies: [
          {
            id: "show",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plan",
            gain: [remember("k_han_peace")],
            miss: "shut",
          },
          {
            id: "early",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "shut",
            reacts: [ifMood("plan", [remember("k_han_peace")], "cunning")],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "shut",
            reacts: [ifTrust(2, "plan", [remember("k_han_peace")])],
          },
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [trustOf(who, 1), remember("k_han_peace")],
            next: "plan",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      plan: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      shut: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_fleet",
    nation: NATION,
    kind: "talk",
    stage: CRISIS,
    when: ch(2, 4),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "hot", when: { kind: "temp", min: 4 } },
          { id: "anxious", when: moody(who, "anxious") },
          { id: "base" },
        ],
        replies: [
          {
            id: "plan",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plan",
            gain: [remember("k_chu_fleet")],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plan",
            reacts: [
              ifMood(
                "plan",
                [remember("k_chu_fleet"), pride(who, 1)],
                "arrogant",
              ),
            ],
            miss: "hurt",
          },
          {
            id: "hold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "hurt",
            reacts: [ifMood("plan", [remember("k_chu_fleet")], "stubborn")],
          },
          {
            id: "word",
            stance: "warm",
            kind: "deal",
            tell: ["navy:+1", "cabinet:-1"],
            effects: [trustOf(who, 1), cabinet(-1), remember("k_chu_fleet")],
            next: "plan",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      plan: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_antwerp",
    nation: NATION,
    kind: "talk",
    when: all(warOn, world({ is: "war_months", own: true, min: 1, max: 2 })),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "lost", when: front("west", "aisne") },
          { id: "anxious", when: moody(who, "anxious") },
          { id: "base" },
        ],
        replies: [
          {
            id: "how",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            gain: [remember("k_chu_antwerp")],
            miss: "hurt",
          },
          {
            id: "mad",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "hurt",
            reacts: [ifMood("how", [remember("k_chu_antwerp")], "stubborn")],
          },
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["navy:+1", "cabinet:-1"],
            effects: [trustOf(who, 1), cabinet(-1), remember("k_chu_antwerp")],
            next: "how",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            reacts: [
              ifMood(
                "how",
                [remember("k_chu_antwerp"), pride(who, 1)],
                "arrogant",
              ),
            ],
            miss: "hurt",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      how: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_straits",
    nation: NATION,
    kind: "talk",
    stage: Y14_ON,
    when: all(
      warOn,
      all(
        world({ is: "war_months", own: true, min: 4 }),
        world({ is: "war_months", own: true, max: 11 }),
      ),
    ),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "arrogant", when: moody(who, "arrogant") },
          { id: "base" },
        ],
        replies: [
          {
            id: "ships",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ships",
            gain: [remember("k_chu_straits")],
            miss: "hurt",
          },
          {
            id: "fisher",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fisher",
          },
          {
            id: "cool",
            stance: "threat",
            kind: "push",
            tell: ["navy:-1"],
            effects: [trustOf(who, -1), vote("straits", who, -1)],
            next: "hurt",
          },
          {
            id: "back",
            stance: "warm",
            kind: "deal",
            tell: ["navy:+1"],
            effects: [
              trustOf(who, 1),
              remember("k_chu_straits"),
              vote("straits", who, 1),
            ],
            next: "ships",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ships: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "no_men",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "no_men",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      no_men: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fisher: {
        says: [
          { id: "fisher", when: holds("sea_lord", "gbr_fisher") },
          { id: "base" },
        ],
        replies: [
          {
            id: "ships",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ships",
            gain: [remember("k_chu_straits")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_fisher",
    nation: NATION,
    kind: "talk",
    stage: Y14_ON,
    when: all(
      warOn,
      all(
        world({ is: "war_months", own: true, min: 2 }),
        world({ is: "war_months", own: true, max: 11 }),
      ),
    ),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "in", when: holds("sea_lord", "gbr_fisher") },
          { id: "base" },
        ],
        replies: [
          {
            id: "can",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "two",
            gain: [remember("k_chu_fisher")],
          },
          {
            id: "king",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "king",
            reacts: [ifCold("hurt")],
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: ["navy:-1"],
            effects: [trustOf(who, -1)],
            next: "hurt",
            reacts: [ifMood("two", [remember("k_chu_fisher")], "stubborn")],
          },
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "navy:+1"],
            effects: [
              trustOf(byOffice("court"), -1),
              trustOf(who, 1),
              remember("k_chu_fisher"),
            ],
            next: "two",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      two: {
        says: [
          { id: "in", when: holds("sea_lord", "gbr_fisher") },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      king: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_trenches",
    // ww187: what its text takes for granted.
    assumes: { line: { straits: ["dardanelles", "constantinople"] } },
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 11, max: 23 }),
      not(holds("navy", "gbr_churchill")),
      // ww187: "the Gallipoli numbers": the army went ashore.
      flag("f_landed"),
    ),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "anxious", when: moody(who, "anxious") },
          { id: "arrogant", when: moody(who, "arrogant") },
          { id: "base" },
        ],
        replies: [
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
            reacts: [ifCold("hurt")],
          },
          {
            id: "stay",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "stay",
            reacts: [ifMood("why", [], "stubborn")],
          },
          {
            id: "back",
            stance: "warm",
            kind: "deal",
            tell: ["promise", "navy:+1"],
            effects: [
              trustOf(who, 1),
              promise(who, "p_chu_back", 14, { keep: seen("gbr_h_vacant") }),
            ],
            next: "promise",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [remember("chu_let_go")],
            next: null,
          },
        ],
      },
      why: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "warm",
            kind: "deal",
            tell: ["promise", "navy:+1"],
            effects: [
              trustOf(who, 1),
              promise(who, "p_chu_back", 14, { keep: seen("gbr_h_vacant") }),
            ],
            next: "promise",
          },
        ],
      },
      stay: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      promise: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_t_churchill_back",
    // ww187: what its text takes for granted.
    assumes: { line: { straits: ["dardanelles", "constantinople"] } },
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 23, max: 41 }),
      not(holds("navy", "gbr_churchill")),
    ),
    cast: { who: { person: "gbr_churchill" } },
    salience: 3,
    tags: ["people"],
    once: false,
    cooldown: 8,
    variants: [{ id: "lg", when: lg }, { id: "base" }],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "shut", when: shut },
          { id: "broke", when: promiseBroken(who, "p_chu_back") },
          { id: "lg", when: lg },
          { id: "stubborn", when: moody(who, "stubborn") },
          { id: "anxious", when: moody(who, "anxious") },
          { id: "base" },
        ],
        replies: [
          {
            id: "where",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "where",
            gain: [remember("k_chu_back")],
            miss: "wait",
          },
          {
            id: "law",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "law",
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: ["navy:-1"],
            effects: [trustOf(who, -1)],
            next: "wait",
          },
          {
            id: "try",
            stance: "warm",
            kind: "deal",
            tell: ["navy:+1", "opposition:+1"],
            effects: [trustOf(who, 1), opposition(1), remember("k_chu_back")],
            next: "where",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      where: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      law: {
        says: [{ id: "co", when: co }, { id: "base" }],
        replies: [
          {
            id: "where",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "where",
            gain: [remember("k_chu_back")],
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wait: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_v_spring_rice_warn",
    nation: NATION,
    kind: "talk",
    stage: Y14_ON,
    when: all(
      warOn,
      usaOut,
      all(
        world({ is: "war_months", own: true, min: 1 }),
        world({ is: "war_months", own: true, max: 23 }),
      ),
    ),
    cast: { who: { person: "gbr_spring_rice" } },
    salience: 6,
    tags: ["people"],
    once: false,
    cooldown: 10,
    variants: [{ id: "base" }],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "money", when: gaugeAt("money", 1) },
          { id: "weary", when: moody(who, "weary") },
          { id: "anxious", when: moody(who, "anxious") },
          { id: "base" },
        ],
        replies: [
          {
            id: "cotton",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cotton",
            reacts: [
              ifThen(gaugeAt("money", 1), "cotton", [
                remember("k_spring_cotton"),
                reveal("usa_credit_cliff"),
              ]),
            ],
            gain: [remember("k_spring_cotton")],
            miss: "gloom",
          },
          {
            id: "wilson",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wilson",
          },
          {
            id: "calm",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "usa:+1"],
            effects: [
              trustOf(who, 1),
              nation("USA", 1),
              remember("k_spring_cotton"),
            ],
            next: "cotton",
          },
          {
            id: "short",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "gloom",
            reacts: [ifMood("cotton", [remember("k_spring_cotton")], "weary")],
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cotton: {
        says: [{ id: "money", when: gaugeAt("money", 1) }, { id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wilson: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "cotton",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cotton",
            gain: [remember("k_spring_cotton")],
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      gloom: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_v_buchanan_warn",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(world({ is: "war_months", min: 23, max: 35 }), fighting("RUS")),
    cast: { who: { person: "gbr_buchanan" } },
    salience: 6,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "fall", when: isOut("RUS") },
          { id: "weary", when: moody(who, "weary") },
          { id: "anxious", when: moody(who, "anxious") },
          { id: "base" },
        ],
        replies: [
          {
            id: "tsar",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tsar",
            gain: [remember("k_buch_tsar")],
            miss: "formal",
          },
          {
            id: "king",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tsar",
            gain: [remember("k_buch_tsar")],
            miss: "formal",
          },
          {
            id: "courage",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              trustOf(byOffice("court"), -1),
              trustOf(who, 1),
              remember("k_buch_tsar"),
            ],
            next: "tsar",
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "formal",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tsar: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      formal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_v_bertie_paris",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 29, max: 41 })),
    cast: { who: { person: "gbr_bertie" } },
    salience: 6,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "cold", when: moody(who, "cold") },
          { id: "arrogant", when: moody(who, "arrogant") },
          { id: "base" },
        ],
        replies: [
          {
            id: "buy",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "army",
            gain: [remember("k_bertie_paris"), reveal("fra_army_refusals")],
            miss: "salon",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "army",
            reacts: [ifMood("salon", [], "cold")],
            gain: [remember("k_bertie_paris"), reveal("fra_army_refusals")],
          },
          {
            id: "rude",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "salon",
          },
          {
            id: "swap",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "fra:-1"],
            effects: [
              trustOf(who, 1),
              nation("FRA", -1),
              remember("k_bertie_paris"),
              reveal("fra_army_refusals"),
            ],
            next: "army",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      army: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "how",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      how: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      salon: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_v_milner_doullens",
    nation: NATION,
    kind: "talk",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 41, max: 47 }),
      seen("gbr_w_march"),
    ),
    cast: { who: { person: "gbr_milner" } },
    salience: 7,
    tags: ["people"],
    once: true,
    variants: [{ id: "base" }],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "stubborn", when: moody(who, "stubborn") },
          { id: "cold", when: moody(who, "cold") },
          { id: "base" },
        ],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            gain: [remember("k_milner_foch")],
          },
          {
            id: "flag",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "flag",
            gain: [remember("k_milner_foch")],
            miss: "flat",
          },
          {
            id: "sign",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "fra:+1"],
            effects: [
              trustOf(who, 1),
              nation("FRA", 1),
              remember("k_milner_foch"),
            ],
            next: "who",
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [trustOf(who, -1)],
            next: "flat",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      flag: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      flat: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_v_stamfordham_note",
    nation: NATION,
    kind: "talk",
    cast: { who: { person: "gbr_stamfordham" } },
    salience: 6,
    tags: ["people"],
    variants: [{ id: "base" }],
    scheduledOnly: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "cold", when: moody(who, "cold") },
          { id: "weary", when: moody(who, "weary") },
          { id: "base" },
        ],
        replies: [
          {
            id: "sorry",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ok",
            gain: [
              trustOf(who, 1),
              trustOf(byName("gbr_george_v"), 1),
              reason("wd_king_mended"),
            ],
          },
          {
            id: "explain",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ok",
            gain: [
              trustOf(byName("gbr_george_v"), 1),
              reason("wd_king_mended"),
            ],
            miss: "cool",
          },
          {
            id: "audience",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "court:+1"],
            effects: [
              audiences(-1),
              trustOf(byName("gbr_george_v"), 1),
              trustOf(who, 1),
            ],
            next: "ok",
          },
          {
            id: "rights",
            stance: "cold",
            kind: "push",
            tell: ["court:-1"],
            effects: [
              trustOf(byName("gbr_george_v"), -1),
              remember("king_warn_refused"),
            ],
            next: "cool",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ok: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cool: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "gbr_f_morgan",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 5, max: 11 })),
    cast: { fin: { office: "finance" }, war: { office: "war" } },
    salience: 6,
    tags: ["home"],
    variants: [{ id: "chaos", when: gaugeAt("shells", 1) }, { id: "base" }],
    fallback: "sign_morgan",
    options: [
      {
        id: "sign_morgan",
        tell: ["money:+1", "war:-1"],
        effects: [
          gauge("money", 1),
          trustOf(role("war"), -1),
          setFlag("f_morgan_agent"),
        ],
      },
      {
        id: "own_agents",
        tell: ["war:+1", "money:-1"],
        effects: [
          trustOf(role("war"), 1),
          gauge("money", -1),
          setFlag("f_own_agents"),
        ],
      },
      {
        id: "duties",
        when: memory("k_mck_duties"),
        tell: ["money:+1", "fin:+1", "commons:-1"],
        effects: [
          gauge("money", 1),
          trustOf(role("fin"), 1),
          commons(-1),
          setFlag("f_luxury_duties"),
          reason("wd_luxury_duties"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_straits_promise",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(
      world({ is: "war_months", min: 5, max: 11 }),
      any(open("straits"), fighting("RUS")),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    variants: [
      { id: "ships", when: all(open("straits")) },
      { id: "cold", when: nationTrustMax("RUS", 0) },
      { id: "base" },
    ],
    fallback: "promise",
    options: [
      {
        id: "promise",
        tell: ["rus:+2", "fra:-1"],
        effects: [
          nation("RUS", 2),
          nation("FRA", -1),
          remember("m_russia_straits"),
          setFlag("f_promised_straits"),
          reason("wd_russia_straits"),
        ],
      },
      {
        id: "half_word",
        tell: ["rus:+1", "fm:+1"],
        effects: [
          nation("RUS", 1),
          trustOf(role("fm"), 1),
          setFlag("f_half_straits"),
        ],
      },
      {
        id: "refuse",
        tell: ["rus:-2", "cabinet:+1"],
        effects: [nation("RUS", -2), cabinet(1), setFlag("f_refused_straits")],
      },
    ],
  },
  {
    id: "gbr_f_mcmahon",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(
      atWar("OTT"),
      world({ is: "war_months", own: true, min: 11, max: 17 }),
    ),
    cast: { fm: { office: "foreign" }, war: { office: "war" } },
    salience: 7,
    tags: ["foreign"],
    variants: [{ id: "straits", when: open("straits") }, { id: "base" }],
    fallback: "vague_lines",
    options: [
      {
        id: "vague_lines",
        tell: ["ott:-1"],
        effects: [
          nation("OTT", -1),
          remember("m_mecca"),
          setFlag("f_mecca_vague"),
        ],
      },
      {
        id: "clear_lines",
        tell: ["ott:-1", "fra:-1", "fm:-1"],
        effects: [
          nation("OTT", -1),
          nation("FRA", -1),
          trustOf(role("fm"), -1),
          remember("m_mecca"),
          setFlag("f_mecca_clear"),
          reason("wd_mecca_clear"),
        ],
      },
      {
        id: "no_letter",
        tell: ["fra:+1"],
        effects: [nation("FRA", 1), setFlag("f_no_mecca")],
      },
    ],
  },
  {
    id: "gbr_f_sykes_picot",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(
      atWar("OTT"),
      world({ is: "war_months", own: true, min: 17, max: 23 }),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    variants: [
      { id: "clear", when: chose("gbr_f_mcmahon", "clear_lines") },
      { id: "vague", when: chose("gbr_f_mcmahon", "vague_lines") },
      { id: "base" },
    ],
    fallback: "sign",
    options: [
      {
        id: "sign",
        tell: ["fra:+2"],
        effects: [
          nation("FRA", 2),
          remember("m_france_map"),
          setFlag("f_map_signed"),
        ],
      },
      {
        id: "soften",
        tell: ["fra:+1", "fm:-1"],
        effects: [
          nation("FRA", 1),
          trustOf(role("fm"), -1),
          remember("m_france_map"),
          setFlag("f_map_soft"),
        ],
      },
      {
        id: "tell_mecca",
        tell: ["fra:-1", "ott:+1"],
        effects: [
          nation("FRA", -1),
          nation("OTT", 1),
          setFlag("f_told_mecca"),
          reason("wd_told_mecca"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_house",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 17, max: 23 }),
      usaOut,
    ),
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign", "tension_down"],
    variants: [{ id: "known", when: memory("k_grey_house") }, { id: "base" }],
    fallback: "polite_no",
    options: [
      {
        id: "polite_no",
        tell: ["usa:-1", "fra:+1"],
        effects: [
          nation("USA", -1),
          nation("FRA", 1),
          setFlag("f_house_declined"),
        ],
      },
      {
        id: "initial",
        when: memory("k_grey_house"),
        tell: ["usa:+1", "fm:+1", "cabinet:-1"],
        effects: [
          nation("USA", 1),
          trustOf(role("fm"), 1),
          cabinet(-1),
          setFlag("f_house_initialled"),
          readiness("USA", 10),
          reason("wd_house_initial"),
        ],
      },
      {
        id: "ask_cabinet",
        tell: ["delay:7", "cabinet:+1"],
        effects: [delay(7), cabinet(1), setFlag("f_house_to_cabinet")],
      },
    ],
  },
  {
    id: "gbr_f_russia_mission",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(
      atWar("DEU"),
      world({ is: "war_months", own: true, min: 17, max: 23 }),
      holds("war", "gbr_kitchener"),
      fighting("RUS"),
    ),
    cast: { war: { office: "war" }, fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign"],
    variants: [
      { id: "lean", when: seen("gbr_t_kitchener_silence") },
      { id: "base" },
    ],
    fallback: "stay",
    options: [
      {
        id: "stay",
        tell: ["war:-1"],
        effects: [trustOf(role("war"), -1), setFlag("f_kit_stayed")],
      },
      {
        id: "send",
        tell: ["rus:+1", "war:+1"],
        effects: [
          nation("RUS", 1),
          trustOf(role("war"), 1),
          setFlag("f_kit_sent"),
        ],
      },
      {
        id: "send_other",
        when: memory("k_kit_russia"),
        tell: ["rus:+1"],
        effects: [
          nation("RUS", 1),
          setFlag("f_other_mission"),
          reason("wd_other_mission"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_tsar",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(world({ is: "war_months", min: 29, max: 35 }), russiaBroke),
    cast: { fm: { office: "foreign" }, court: { office: "court" } },
    salience: 8,
    tags: ["foreign"],
    variants: [
      { id: "warned", when: memory("k_buch_tsar") },
      { id: "lg", when: lg },
      { id: "base" },
    ],
    fallback: "withdraw_offer",
    options: [
      {
        id: "withdraw_offer",
        tell: ["court:+1", "order:+1", "rus:-1"],
        effects: [
          trustOf(role("court"), 1),
          gauge("order", 1),
          nation("RUS", -1),
          setFlag("f_tsar_refused"),
          reason("wd_tsar_refused"),
        ],
      },
      {
        id: "offer_stands",
        tell: ["court:-1", "order:-1", "fm:+1"],
        effects: [
          trustOf(role("court"), -1),
          gauge("order", -1),
          trustOf(role("fm"), 1),
          setFlag("f_tsar_offer_stands"),
          schedule("gbr_f_tsar_lands", 3),
        ],
      },
      {
        id: "ask_paris",
        when: memory("k_king_tsar"),
        tell: ["fra:-1", "court:+1"],
        effects: [
          nation("FRA", -1),
          trustOf(role("court"), 1),
          setFlag("f_tsar_paris"),
        ],
      },
      {
        id: "warn_early",
        when: memory("k_buch_tsar"),
        tell: ["court:+1", "fm:+1"],
        effects: [
          trustOf(role("court"), 1),
          trustOf(role("fm"), 1),
          setFlag("f_tsar_warned"),
          reason("wd_tsar_warned"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_tsar_lands",
    nation: NATION,
    kind: "report",
    stage: WAR,
    when: chose("gbr_f_tsar", "offer_stands"),
    cast: { court: { office: "court" } },
    salience: 5,
    tags: ["foreign", "tension_down"],
    stamp: "confirmed",
    source: "press",
    variants: [{ id: "order", when: gaugeAt("order", 2) }, { id: "base" }],
  },
  {
    id: "gbr_f_russia_falls",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(world({ is: "war_months", min: 35, max: 47 }), isOut("RUS")),
    cast: { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    salience: 7,
    tags: ["foreign"],
    variants: [
      { id: "west_bad", when: front("west", "somme") },
      { id: "tsar", when: chose("gbr_f_tsar", "withdraw_offer") },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      {
        id: "wait",
        tell: ["cos:+1"],
        effects: [trustOf(role("cos"), 1), setFlag("f_russia_wait")],
      },
      {
        id: "recognise",
        tell: ["fra:-1", "order:+1"],
        effects: [
          nation("FRA", -1),
          gauge("order", 1),
          setFlag("f_russia_recognised"),
        ],
      },
      {
        id: "send_mission",
        tell: ["money:-1", "fra:+1", "cos:-1"],
        effects: [
          gauge("money", -1),
          nation("FRA", 1),
          trustOf(role("cos"), -1),
          setFlag("f_russia_mission_sent"),
          reason("wd_russia_mission"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_palestine",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(
      atWar("OTT"),
      world({ is: "war_months", own: true, min: 35, max: 41 }),
    ),
    cast: { fm: { office: "foreign" }, montagu: { person: "gbr_montagu" } },
    salience: 7,
    tags: ["foreign"],
    variants: [
      { id: "both", when: all(memory("m_mecca"), memory("m_france_map")) },
      { id: "mecca", when: memory("m_mecca") },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      {
        id: "wait",
        tell: ["cabinet:+1"],
        effects: [cabinet(1), setFlag("f_zion_wait")],
      },
      {
        id: "sign",
        when: memory("k_bal_zion"),
        tell: ["fm:+1", "usa:+1", "cabinet:-1"],
        effects: [
          trustOf(role("fm"), 1),
          nation("USA", 1),
          cabinet(-1),
          remember("m_zion"),
          setFlag("f_zion_signed"),
          reason("wd_zion_signed"),
        ],
      },
      {
        id: "softer_words",
        tell: ["cabinet:+1", "fm:-1"],
        effects: [
          cabinet(1),
          trustOf(role("fm"), -1),
          remember("m_zion"),
          setFlag("f_zion_soft"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_india",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 35, max: 41 })),
    cast: { fm: { office: "foreign" }, montagu: { person: "gbr_montagu" } },
    salience: 6,
    tags: ["foreign"],
    variants: [{ id: "loss", when: open("mesopotamia") }, { id: "base" }],
    fallback: "hold",
    options: [
      {
        id: "hold",
        tell: ["cabinet:+1", "order:-1"],
        effects: [cabinet(1), gauge("order", -1), setFlag("f_india_hold")],
      },
      {
        id: "self_government",
        tell: ["cabinet:-1", "usa:+1"],
        effects: [
          cabinet(-1),
          nation("USA", 1),
          setFlag("f_india_promised"),
          reason("wd_india_words"),
        ],
      },
      {
        id: "wider_council",
        tell: ["order:+1"],
        effects: [gauge("order", 1), setFlag("f_india_council")],
      },
    ],
  },
  {
    id: "gbr_f_vienna_feeler",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(
      warOn,
      world({ is: "war_months", own: true, min: 29, max: 47 }),
      not(isOut("AUH")),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign", "tension_down"],
    variants: [{ id: "talk", when: nationTrustMin("AUH", 0) }, { id: "base" }],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["ita:+1"],
        effects: [nation("ITA", 1), setFlag("f_vienna_refused")],
      },
      {
        id: "listen",
        tell: ["fm:+1", "ita:-1"],
        effects: [
          trustOf(role("fm"), 1),
          nation("ITA", -1),
          setFlag("f_vienna_heard"),
        ],
      },
      {
        id: "offer_terms",
        when: nationTrustMin("AUH", 0),
        tell: ["auh:+2", "ita:-2", "fra:-1"],
        effects: [
          nation("AUH", 2),
          nation("ITA", -2),
          nation("FRA", -1),
          setFlag("f_vienna_offer"),
          reason("wd_vienna_offer"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_war_aims",
    nation: NATION,
    kind: "proposal",
    stage: WAR,
    when: all(warOn, world({ is: "war_months", own: true, min: 41, max: 47 })),
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign", "tension_down"],
    variants: [
      { id: "written", when: chose("gbr_f_peace_notes", "state_aims") },
      { id: "bolshevik", when: isOut("RUS") },
      { id: "base" },
    ],
    fallback: "old_aims",
    options: [
      {
        id: "old_aims",
        tell: ["fra:+1", "order:-1"],
        effects: [nation("FRA", 1), gauge("order", -1), setFlag("f_aims_old")],
      },
      {
        id: "moderate_aims",
        tell: ["order:+1", "fra:-1", "auh:+1"],
        effects: [
          gauge("order", 1),
          nation("FRA", -1),
          nation("AUH", 1),
          setFlag("f_aims_moderate"),
          reason("wd_aims_moderate"),
        ],
      },
      {
        id: "american_line",
        when: memory("k_bal_mission"),
        tell: ["usa:+1", "order:+1"],
        effects: [
          nation("USA", 1),
          gauge("order", 1),
          setFlag("f_aims_american"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_neutral_line",
    nation: NATION,
    kind: "crisis",
    stage: Y14_ON,
    when: all(neutral, warMonths(undefined, 4), not(entryOpen)),
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 9,
    tags: ["foreign"],
    variants: [
      { id: "belg", when: belg },
      { id: "east1", when: east1 },
      { id: "base" },
    ],
    fallback: "coast_guard",
    options: [
      {
        id: "coast_guard",
        tell: ["fra:+1", "deu:-1"],
        effects: [
          nation("FRA", 1),
          nation("DEU", -1),
          setFlag("f_coast_guard"),
          reason("wd_coast_guard"),
        ],
      },
      {
        id: "full_neutral",
        tell: ["fra:-3", "deu:+1", "fm:-2"],
        effects: [
          nation("FRA", -3),
          nation("DEU", 1),
          trustOf(role("fm"), -2),
          setFlag("f_full_neutral"),
        ],
      },
      {
        id: "armed_mediator",
        tell: ["fra:-1", "deu:-1", "navy:+1", "money:-1"],
        effects: [
          nation("FRA", -1),
          nation("DEU", -1),
          trustOf(role("navy"), 1),
          gauge("money", -1),
          setFlag("f_armed_mediator"),
          reason("wd_armed_mediator"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_neutral_trade",
    nation: NATION,
    kind: "proposal",
    stage: Y14_ON,
    when: all(neutral, warMonths(2, 23)),
    cast: { fin: { office: "finance" } },
    salience: 7,
    tags: ["home"],
    once: false,
    cooldown: 6,
    variants: [
      { id: "rich", when: gaugeOver("money", 3) },
      { id: "angry", when: nationTrustMax("FRA", -2) },
      { id: "base" },
    ],
    fallback: "both_sides",
    options: [
      {
        id: "both_sides",
        tell: ["money:+1", "fra:-1"],
        effects: [
          gauge("money", 1),
          nation("FRA", -1),
          setFlag("f_trade_both"),
        ],
      },
      {
        id: "entente_only",
        tell: ["fra:+1", "deu:-1", "money:+1"],
        effects: [
          nation("FRA", 1),
          nation("DEU", -1),
          gauge("money", 1),
          setFlag("f_trade_entente"),
          reason("wd_trade_entente"),
        ],
      },
      {
        id: "nobody",
        tell: ["money:-1", "order:-1"],
        effects: [
          gauge("money", -1),
          gauge("order", -1),
          setFlag("f_trade_nobody"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_neutral_mediate",
    nation: NATION,
    kind: "crisis",
    stage: WAR,
    when: all(neutral, world({ is: "war_months", min: 5, max: 41 })),
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      { id: "ruin", when: foreignLosses() },
      { id: "trench", when: trenchMin("west", 2) },
      { id: "base" },
    ],
    fallback: "call_conference",
    options: [
      {
        id: "call_conference",
        tell: ["temp:-1", "fra:-1", "deu:+1"],
        effects: [
          temp(-1),
          nation("FRA", -1),
          nation("DEU", 1),
          setFlag("f_london_conference"),
          reason("wd_london_conference"),
        ],
      },
      { id: "wait", tell: [], effects: [setFlag("f_mediate_wait")] },
      {
        id: "press_berlin",
        tell: ["deu:-2", "fra:+1", "temp:+1"],
        effects: [
          nation("DEU", -2),
          nation("FRA", 1),
          temp(1),
          setFlag("f_pressed_berlin"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_late_entry",
    nation: NATION,
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      neutral,
      warMonths(2, 23),
      any(franceFalling, belg),
      world({ is: "war_age", min: 3 }),
    ),
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: false,
    cooldown: 6,
    variants: [
      {
        id: "armed",
        when: all(chose("gbr_f_neutral_line", "armed_mediator"), franceFalling),
      },
      { id: "falling", when: franceFalling },
      { id: "base" },
    ],
    fallback: "stay_out",
    options: [
      {
        id: "stay_out",
        tell: ["fra:-2", "cabinet:+1"],
        effects: [nation("FRA", -2), cabinet(1), setFlag("f_stayed_out")],
      },
      {
        id: "enter_now",
        when: votes("entry"),
        tell: ["fra:+3", "cabinet:-2", "temp:+2"],
        effects: [
          nation("FRA", 3),
          cabinet(-2),
          temp(2),
          setFlag("f_late_entry"),
          doWorld({ do: "declare", tag: "DEU" }),
          reason("wd_late_entry"),
        ],
      },
      {
        id: "ultimatum_first",
        when: not(flag("f_late_ultimatum")),
        tell: ["deu:-2", "fra:+1"],
        effects: [
          nation("DEU", -2),
          nation("FRA", 1),
          setFlag("f_late_ultimatum"),
          schedule("gbr_f_late_entry", 1),
        ],
      },
    ],
  },
  {
    id: "gbr_f_peace_summer",
    nation: NATION,
    kind: "crisis",
    when: all(
      peace,
      world({ is: "peace_months", max: 4 }),
      world({ is: "peace_months", max: 4 }),
    ),
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_down"],
    // ww190 §2: fewer repeats.
    cooldown: 4,
    variants: [
      { id: "humbled", when: world({ is: "chain_end", of: ["humiliation"] }) },
      { id: "base" },
    ],
    fallback: "hold_line",
    options: [
      {
        id: "hold_line",
        tell: ["temp:-1"],
        effects: [temp(-1), setFlag("f_summer_hold")],
      },
      {
        id: "press_vienna",
        tell: ["auh:-1", "rus:+1", "temp:-1"],
        effects: [
          nation("AUH", -1),
          nation("RUS", 1),
          temp(-1),
          setFlag("f_summer_vienna"),
        ],
      },
      {
        id: "colonies_talk",
        tell: ["deu:+2", "fra:-1"],
        effects: [
          nation("DEU", 2),
          nation("FRA", -1),
          setFlag("f_summer_colonies"),
          reason("wd_summer_colonies"),
        ],
      },
    ],
  },
  {
    id: "gbr_f_peace_ulster",
    nation: NATION,
    kind: "crisis",
    stage: Y14_ON,
    // A few months after a crisis closed in peace; with no shot at all, the
    // autumn session (the text's season) with no crisis running.
    when: any(
      all(peace, { kind: "world", of: { is: "peace_months", min: 1, max: 5 } }),
      all(noSarajevo, not({ kind: "world", of: { is: "chain" } }), {
        kind: "world",
        of: { is: "month", of: [9, 10, 11] },
      }),
    ),
    cast: {
      irl: { any_of: [{ office: "ireland" }, { office: "foreign" }] },
      fm: { office: "foreign" },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    // ww190 §2: fewer repeats.
    cooldown: 4,
    variants: [
      // A quiet summer: no crisis has come and gone.
      { id: "n", when: all(noSarajevo, not(peace)) },
      { id: "rifles", when: pressure("ireland", 4) },
      { id: "base" },
    ],
    fallback: "amend_again",
    options: [
      {
        id: "amend_again",
        tell: ["irish:-1", "cabinet:+1"],
        effects: [irish(-1), cabinet(1), setFlag("f_amend_again")],
      },
      {
        id: "election",
        tell: ["commons:-1", "opposition:+1"],
        effects: [
          commons(-1),
          opposition(1),
          setFlag("f_ulster_election"),
          reason("wd_ulster_election"),
        ],
      },
      {
        id: "county_vote",
        when: memory("k_red_counties"),
        tell: ["irish:+1", "opposition:-1", "cabinet:-1"],
        effects: [
          irish(1),
          opposition(-1),
          cabinet(-1),
          setFlag("f_ireland_settled"),
          reason("wd_county_vote"),
        ],
      },
    ],
  },
  // ---- ww190 §6: the neutral great power, courted and mediating ----
  {
    id: "gbr_nt_offer_central",
    nation: NATION,
    kind: "audience",
    when: all(neutral, world({ is: "courted", side: "central", min: 1 })),
    cast: {
      amb: { office: "ambassador_london", tag: "DEU" },
      fm: { office: "foreign" },
    },
    salience: 7,
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
    variants: [
      {
        id: "losing",
        when: world({ is: "courted", side: "central", min: 2 }),
      },
      { id: "base" },
    ],
    fallback: "polite",
    options: [
      {
        id: "polite",
        tell: [],
        effects: [
          nation("DEU", 1),
          nation("FRA", -1),
          reason("gbr_nt_offer_central_polite"),
        ],
      },
      {
        id: "refuse",
        tell: [],
        effects: [nation("DEU", -1), reason("gbr_nt_offer_central_refuse")],
      },
      {
        id: "mediate",
        when: not(world({ is: "mediating" })),
        tell: [],
        effects: [
          doWorld({ do: "mediate" }),
          reason("gbr_nt_offer_central_mediate"),
        ],
      },
    ],
  },
  {
    id: "gbr_nt_offer_entente",
    nation: NATION,
    kind: "audience",
    when: all(neutral, world({ is: "courted", side: "entente", min: 1 })),
    cast: {
      amb: { office: "ambassador_london", tag: "FRA" },
      fm: { office: "foreign" },
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    cooldown: 3,
    max: 2,
    variants: [{ id: "falling", when: franceFalling }, { id: "base" }],
    fallback: "not_yet",
    options: [
      {
        id: "come_in",
        tell: [],
        effects: [
          doWorld({ do: "join", side: "entente" }),
          reason("gbr_nt_offer_entente_come_in"),
        ],
      },
      {
        id: "not_yet",
        tell: [],
        effects: [nation("FRA", -1), reason("gbr_nt_offer_entente_not_yet")],
      },
      {
        id: "the_coast",
        tell: [],
        effects: [
          nation("FRA", 1),
          nation("DEU", -1),
          temp(1),
          reason("gbr_nt_offer_entente_the_coast"),
        ],
      },
    ],
  },
  {
    id: "gbr_nt_envoy",
    nation: NATION,
    kind: "proposal",
    when: all(neutral, warMonths(6), not(world({ is: "mediating" }))),
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign", "tension_down"],
    cooldown: 6,
    variants: [
      { id: "courted", when: world({ is: "courted", min: 2 }) },
      { id: "base" },
    ],
    fallback: "not_yet",
    options: [
      {
        id: "send",
        tell: [],
        effects: [doWorld({ do: "mediate" }), reason("gbr_nt_envoy_send")],
      },
      {
        id: "not_yet",
        tell: [],
        effects: [reason("gbr_nt_envoy_not_yet")],
      },
    ],
  },
  {
    id: "gbr_nt_mediating",
    nation: NATION,
    kind: "wire",
    when: all(neutral, world({ is: "mediating" })),
    cast: { fm: { office: "foreign" } },
    salience: 5,
    tags: ["foreign"],
    cooldown: 3,
    variants: [{ id: "base" }],
  },
  {
    id: "gbr_nt_arms_orders",
    nation: NATION,
    kind: "proposal",
    when: all(neutral, warMonths(4)),
    cast: { fin: { office: "finance" } },
    salience: 5,
    tags: ["home", "foreign"],
    cooldown: 3,
    max: 3,
    variants: [{ id: "rich", when: gaugeOver("money", 3) }, { id: "base" }],
    fallback: "licence",
    options: [
      {
        id: "sell",
        tell: [],
        effects: [
          doWorld({ do: "budget_item", item: "treasury", pct: 5 }),
          nation("FRA", -1),
          nation("DEU", -1),
          reason("gbr_nt_arms_orders_sell"),
        ],
      },
      {
        id: "licence",
        tell: [],
        effects: [
          doWorld({ do: "budget_item", item: "treasury", pct: 3 }),
          nation("FRA", 1),
          nation("DEU", -1),
          reason("gbr_nt_arms_orders_licence"),
        ],
      },
      {
        id: "ban",
        tell: [],
        effects: [
          { kind: "opinion", bloc: "business", delta: -1 },
          nation("DEU", 1),
          reason("gbr_nt_arms_orders_ban"),
        ],
      },
    ],
  },
];
