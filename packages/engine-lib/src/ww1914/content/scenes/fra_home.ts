import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwSecret,
  GwStage,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  byName,
  chose,
  decide,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReact,
  GwReply,
  GwReplyKind,
  GwScene,
  GwStance,
  GwVariant,
  holder,
  keepPromise,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { callPremier } from "./gov_fra";
import { period } from "./period";

/**
 * France, the share at home (lane W3 of ww166): the `fra_h_` scenes, the top
 * of the unrest ladder (`fra_h_top`, GW_HOME.FRA.top), the big scene of the
 * night the President may call Clemenceau (`fra_big_tiger`), the summoned
 * talks of Malvy, Briand, Clemenceau and Albert Thomas, and five visits.
 * Data only; the text is in resources/ww1914/ko/FRA.home.json. Plan:
 * ww166-plan-fra-scenes.md §7, §9 (W3), §10 (W3), §12-§13.
 *
 * The President names only the premier. Nothing here dismisses a minister on
 * his word: a resignation he takes goes to the premier (`dismiss` stands for
 * the premier accepting it), and pressing costs the premier's trust.
 */

const NATION: GwScene["nation"] = ["FRA"];
const who = role("who");

const CRISIS: GwStage[] = ["crisis"];
const CRISIS_ON: GwStage[] = ["crisis", "y1914"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR: GwStage[] = ["war"];
const ANY: GwStage[] = ["crisis", "y1914", "war"];
const AFTER: GwStage[] = ["war", "conference", "closing"];

const during = period;
const chapter = (min: number, max?: number): GwCond =>
  max === undefined ? { kind: "chapter", min } : { kind: "chapter", min, max };
const dates = (from?: string, to?: string): GwCond =>
  world({
    is: "date",
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });

const war: GwCond = { kind: "at_war", tag: "DEU" };
/** Joffre has his free hand (W1, fra_big_marne). */
const jf = flag("f_joffre_free");
/** The sacred union stands (its form of government, which sets f_union_sacree). */
const us = world({ is: "regime", of: ["fra_union"] });
/** Clemenceau's cabinet. */
const tiger = flag("f_pm_clemenceau");
const notTiger = not(tiger);
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const pm = (person: string) => holds("chancellor", person);
const active = (person: string): GwCond => ({ kind: "person_active", person });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
/** The seat has found this secret. */
const known = (id: GwSecret): GwCond => world({ is: "known", id });
/** This game holds the secret. */
const isTrue = (id: GwSecret): GwCond => ({ kind: "secret", id });
const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const instAt = (
  inst: GwInstitution,
  range: { min?: number; max?: number },
): GwCond => ({ kind: "inst", inst, ...range });
const gov = (id: string, min: number) => world({ is: "gov", id, min });
/** The cabinet wobbles: a threat row is warm. */
const shaky = any(gov("fra_chamber", 5), gov("fra_senate", 5));
/** The cabinet is going: a threat row is near its consultations. */
const fallen = any(gov("fra_chamber", 8), gov("fra_senate", 8), {
  kind: "office_empty",
  office: "chancellor",
});
/** The Tsar has gone. */
const revolution = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep"],
});
/** The north is held by the enemy. */
const westBack = world({ is: "front", theatre: "west", from: "hindenburg" });
const deepBack = world({ is: "front", theatre: "west", from: "somme" });
const manLow = world({ is: "manpower", max: 55 });
const unrestAt = (min: number) => world({ is: "unrest", min });
const promiseOpen = (person: string, key: string): GwCond => ({
  kind: "promise",
  who: byName(person),
  key,
  kept: false,
  broken: false,
});
const promiseKept = (person: string, key: string): GwCond => ({
  kind: "promise",
  who: byName(person),
  key,
  kept: true,
});

// ---- Effects ----

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const chamber = (d: number) => body("chamber", d);
const senate = (d: number) => body("senate", d);
const countersign = (d: number) => body("countersign", d);
const army = (d: number) => body("army", d);
const authority = (d: number) => doWorld({ do: "authority", delta: d });
const men = (d: number) => doWorld({ do: "manpower", delta: d });
const heat = (id: string, delta: number) =>
  doWorld({ do: "gov_heat", id, delta });
const beat = (id: string) => doWorld({ do: "gov_beaten", id });
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const person = (p: string, d: number) => trustOf(byName(p), d);
const pmTrust = (d: number) => trustOf({ office: "chancellor" }, d);
/** A seat secret becomes known, only if this game holds it. */
const learn = (id: GwSecret): GwEffect =>
  maybe(isTrue(id), doWorld({ do: "reveal", id }));
const appoint = (p: string, office: GwOffice): GwEffect => ({
  kind: "appoint",
  who: byName(p),
  office,
});

// ---- Builders ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };

/** A desk scene: France's, dealt once unless it has a cooldown. */
const scene = (
  s: Omit<GwScene, "nation" | "once"> & { once?: boolean },
): GwScene => ({
  nation: NATION,
  ...s,
  once: s.once ?? s.cooldown === undefined,
});

interface ReplyMore {
  effects?: GwEffect[];
  when?: GwCond;
  reacts?: GwReact[];
}
const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  more: ReplyMore = {},
): GwReply => ({
  id,
  stance,
  kind,
  tell: [],
  effects: more.effects ?? [],
  next,
  ...(more.when === undefined ? {} : { when: more.when }),
  ...(more.reacts === undefined ? {} : { reacts: more.reacts }),
});
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const mood = (...of: GwTemperament[]): GwCond => moody(who, ...of);
/** The door is shut: trust at the floor of what a talk can carry. */
const sour: GwCond = { kind: "person_trust", who, max: -2 };
const warmTo: GwCond = { kind: "person_trust", who, min: 1 };
const when_ = (
  c: GwCond,
  next: string | null,
  ...effects: GwEffect[]
): GwReact => ({ when: c, next, effects });

interface TalkMore {
  /** Chapters before the topic can come again; a once topic has none. */
  cd?: number;
  intro?: GwVariant[];
}

const talkBase = (
  id: string,
  whom: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore,
) => ({
  id,
  nation: NATION,
  kind: "talk" as const,
  stage,
  when,
  cast: { who: { person: whom } },
  tags: ["people" as const],
  who: "who",
  variants: more.intro ?? [v("base")],
  start: "open",
  nodes,
  ...(more.cd === undefined ? { once: true } : { cooldown: more.cd }),
});

/** A topic on the people screen. */
const talk = (
  id: string,
  whom: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, whom, stage, when, nodes, more),
  salience: 1,
  summon: true,
});

/** Someone comes to the desk. */
const visit = (
  id: string,
  whom: string,
  stage: GwStage[],
  when: GwCond,
  salience: number,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, whom, stage, when, nodes, more),
  salience,
});

/**
 * The common shape of a talk: an ask, a push, a deal and a way out at the
 * door; then what the person has to say (`hear`), a question more (`more`),
 * and a shut door (`shut`). `gift` is what the talk gives once it lands: a
 * key, a dig, a promise. `price` is what the deal costs. `moods` are the
 * person's tempers that give the opening its own line.
 */
interface StdTalk {
  gift: GwEffect[];
  price: GwEffect[];
  moods: GwTemperament[];
  /** The temper that gives way to a push. */
  yields?: GwTemperament;
  /** The temper a push shuts out. */
  bristles?: GwTemperament;
}
function std(t: StdTalk): Record<string, GwNode> {
  const opening = [...t.moods.map((m) => v(m, mood(m))), v("base")];
  return {
    open: node(
      opening,
      r("ask", "frank", "ask", "hear", { reacts: [when_(sour, "shut")] }),
      r("push", "cold", "push", "hear", {
        effects: [trustOf(who, -1)],
        reacts: [
          ...(t.bristles === undefined
            ? []
            : [when_(mood(t.bristles), "shut", trustOf(who, -1))]),
          ...(t.yields === undefined
            ? []
            : [when_(mood(t.yields), "hear", ...t.gift)]),
        ],
      }),
      r("deal", "warm", "deal", "hear", {
        effects: [...t.price, ...t.gift, trustOf(who, 1)],
      }),
      r("later", "cold", "leave", null),
    ),
    hear: node(
      [v("warm", warmTo), v("base")],
      r("take", "warm", "leave", null, { effects: t.gift }),
      r("more", "frank", "ask", "more"),
      r("drop", "cold", "leave", null),
    ),
    more: node(
      [v("base")],
      r("end", "warm", "leave", null, {
        effects: [...t.gift, trustOf(who, 1)],
      }),
      r("stop", "cold", "leave", null, { effects: t.gift }),
    ),
    shut: node([v("base")], r("end", "cold", "leave", null)),
  };
}

// ---- Shared lists ----

/** `fra_h_vacant`'s list: the office, the premier's first name, his second. */
const VACANCIES: readonly (readonly [GwOffice, string, string])[] = [
  ["war", "fra_millerand", "fra_gallieni"],
  ["munitions", "fra_thomas", "fra_loucheur"],
  ["foreign", "fra_delcasse", "fra_ribot"],
  ["interior", "fra_malvy", "fra_bourgeois"],
  ["finance", "fra_ribot", "fra_noulens"],
  ["navy", "fra_lacaze", "fra_augagneur"],
];
type VacancyRow = (typeof VACANCIES)[number];
const vacant = (office: GwOffice): GwCond =>
  office === "munitions"
    ? all({ kind: "office_empty", office }, dates("1915-05"))
    : { kind: "office_empty", office };
const offered = (row: VacancyRow): GwCond =>
  all(vacant(row[0]), active(row[1]), active(row[2]));
const anyEmpty = any(...VACANCIES.map(offered));
/** Fills the first office on the list that is open, and no other. */
const fillVacant = (pick: (row: VacancyRow) => string) =>
  VACANCIES.map((row, i) =>
    maybe(
      all(offered(row), ...VACANCIES.slice(0, i).map((x) => not(offered(x)))),
      appoint(pick(row), row[0]),
    ),
  );
const messimyBack = all(
  promiseOpen("fra_messimy", "p_mes_return"),
  vacant("war"),
  active("fra_messimy"),
);

/** The socialists are angry: a temper, a passport refused, the streets. */
const sfioAngry = any(
  world({ is: "faction_temper", id: "fra_sfio", min: 3 }),
  chose("fra_h_stockholm", "refuse"),
  unrestAt(2),
);
/** Caillaux's peace: the door his talk opens, or a war going very badly. */
const caillauxDoor = all(
  active("fra_caillaux"),
  not(flag("f_caillaux_arrested")),
  not(pm("fra_caillaux")),
  any(seen("fra_t_caillaux_peace"), world({ is: "score", max: -10 })),
);
const callable = (p: string) => all(active(p), not(pm(p)));

const anyOf = (...rules: GwCastRule[]): GwCastRule => ({
  any_of: rules as Extract<GwCastRule, { any_of: unknown }>["any_of"],
});
const factory = anyOf(holder("munitions"), holder("war"));

// ---- The big scene: the night of the call ----

const TIGER: GwScene = {
  id: "fra_big_tiger",
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["people", "tension_up"],
  stage: WAR,
  when: all(war, dates("1917-07"), fallen, notTiger, active("fra_painleve")),
  cast: {
    chamber: anyOf({ person: "fra_deschanel" }, { favourite: true }),
    senate: anyOf({ person: "fra_dubost" }, { favourite: true }),
    leader: anyOf(
      { person: "fra_renaudel" },
      { person: "fra_barthou" },
      { favourite: true },
    ),
  },
  who: "chamber",
  start: "n1",
  variants: [v("terms", memory("k_cle_terms")), v("base")],
  nodes: {
    n1: {
      says: [v("again", memory("k_gov_fra_consulted")), v("base")],
      replies: [
        decide("hear_chamber", "n2"),
        decide("ask_tiger", "n2", [remember("k_tiger_asked")]),
      ],
    },
    n2: {
      who: "senate",
      says: [v("commission", seen("fra_t_clemenceau_commission")), v("base")],
      replies: [decide("hear_senate", "n3")],
    },
    n3: {
      who: "leader",
      says: [v("sfio_out", flag("f_sfio_out")), v("base")],
      replies: [decide("hear_leader", "n4")],
    },
    n4: {
      alone: true,
      fallback: "painleve_again",
      says: [v("asked", memory("k_tiger_asked")), v("base")],
      replies: [
        decide("painleve_again", null, [
          maybe(not(pm("fra_painleve")), ...callPremier("painleve")),
          maybe(
            pm("fra_painleve"),
            chamber(-1),
            beat("fra_chamber"),
            beat("fra_senate"),
            reason("fra_h_tiger_renewed"),
          ),
          remember("m_tiger_passed"),
        ]),
        decide("call_clemenceau", null, [
          ...callPremier("clemenceau"),
          keepPromise(byName("fra_clemenceau"), "p_cle_free_hand"),
          remember("m_tiger_called"),
        ]),
        {
          ...decide("briand_back", null, [
            ...callPremier("briand"),
            remember("m_tiger_passed"),
          ]),
          when: all(memory("k_bri_back"), callable("fra_briand")),
        },
        {
          ...decide("caillaux_peace", null, [
            ...callPremier("caillaux"),
            remember("m_tiger_passed"),
          ]),
          when: caillauxDoor,
        },
      ],
    },
  },
};

// ---- The top of the ladder ----

const TOP: GwScene = {
  id: "fra_h_top",
  nation: NATION,
  kind: "crisis",
  stage: WAR,
  // The ladder lays it on the desk (GW_HOME.FRA.top); the desk can too.
  when: all(
    unrestAt(4),
    world({ is: "regime", of: ["fra_republic", "fra_union", "fra_tiger"] }),
  ),
  once: true,
  cast: { chancellor: holder("chancellor") },
  salience: 9,
  tags: ["home", "tension_up"],
  variants: [v("tiger", tiger), v("union", us), v("base")],
  fallback: "next_regime",
  options: [
    o(
      "next_regime",
      [doWorld({ do: "next_regime" }), reason("fra_h_top_peace")],
      world({
        is: "regime",
        of: ["fra_republic", "fra_union", "fra_tiger"],
      }),
    ),
    o("appeal", [
      gauge("order", 1),
      gauge("morale", 1),
      authority(-10),
      chamber(1),
      reason("fra_h_top_appeal"),
    ]),
    o("resign", [doWorld({ do: "close_seat" })]),
  ],
};

export const FRA_HOME_SCENES: readonly GwScene[] = [
  // ---- 1915 ----
  scene({
    id: "fra_h_army_commission",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("15a", "16a"), jf),
    cast: { war: holder("war") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("known", memory("k_jof_deputies")),
      v("shells", gaugeAt("shells", 1)),
      v("base"),
    ],
    fallback: "allow",
    options: [
      o("allow", [
        senate(1),
        army(-1),
        person("fra_joffre", -1),
        setFlag("f_commission_front"),
        reason("fra_h_commission_allowed"),
      ]),
      o(
        "refuse",
        [army(1), senate(-1), person("fra_joffre", 1), heat("fra_senate", 2)],
        memory("k_jof_deputies"),
      ),
      o("president_carries", [
        senate(1),
        authority(-5),
        setFlag("f_president_carries"),
        reason("fra_h_president_carries"),
      ]),
    ],
  }),
  scene({
    id: "fra_h_embusques",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a", "15b")),
    cast: { war: holder("war") },
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [v("short", world({ is: "manpower", max: 60 })), v("base")],
    fallback: "back_bill",
    options: [
      o("back_bill", [
        chamber(1),
        army(-1),
        men(3),
        setFlag("f_dalbiez_backed"),
        reason("fra_h_embusques_bill"),
      ]),
      o("quiet", [chamber(-1), gauge("morale", -1)]),
      o("army_lists", [army(1), chamber(-1), men(2)]),
    ],
  }),
  scene({
    id: "fra_h_refugees",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a", "15b"), westBack),
    cast: { interior: holder("interior") },
    salience: 6,
    tags: ["home"],
    variants: [v("deep", deepBack), v("base")],
    fallback: "allowance",
    options: [
      o("allowance", [
        gauge("money", -1),
        gauge("order", 1),
        reason("fra_h_refugee_allowance"),
      ]),
      o("camps_only", [gauge("morale", -1)]),
      o("towns_pay", [chamber(-1), senate(1)]),
    ],
  }),
  scene({
    id: "fra_h_thann",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a", "15b")),
    cast: { interior: holder("interior") },
    salience: 6,
    tags: ["home", "tension_down"],
    variants: [v("near", deepBack), v("base")],
    fallback: "army_rule",
    options: [
      o("army_rule", [army(1)]),
      o("civil_admin", [chamber(1), army(-1), setFlag("f_thann_civil")]),
      o("president_visits", [
        gauge("morale", 1),
        authority(-5),
        setFlag("f_thann_visit"),
        reason("fra_h_thann_visit"),
      ]),
    ],
  }),
  scene({
    id: "fra_h_canard",
    kind: "wire",
    stage: WAR,
    when: all(war, during("15b", "16a")),
    cast: {},
    salience: 4,
    tags: ["home", "tension_down"],
    variants: [v("base")],
  }),
  scene({
    id: "fra_h_viviani_tired",
    kind: "proposal",
    stage: WAR,
    when: all(war, pm("fra_viviani"), during("15b")),
    cast: { chancellor: holder("chancellor") },
    salience: 7,
    tags: ["people"],
    variants: [
      v("promised", promiseOpen("fra_viviani", "p_viv_rest")),
      v("weary", moody({ role: "chancellor" }, "weary", "anxious")),
      v("base"),
    ],
    fallback: "hold_him",
    options: [
      o("hold_him", [
        person("fra_viviani", -1),
        chamber(-1),
        reason("fra_h_viviani_held"),
      ]),
      o("let_him_rest", [
        keepPromise(byName("fra_viviani"), "p_viv_rest"),
        person("fra_viviani", 1),
        heat("fra_chamber", 3),
        reason("fra_h_viviani_rest"),
      ]),
      o(
        "sound_briand",
        [
          person("fra_viviani", -1),
          person("fra_briand", 1),
          heat("fra_chamber", 4),
          remember("m_briand_sounded"),
        ],
        memory("k_bri_ready"),
      ),
    ],
  }),
  scene({
    id: "fra_h_letters_front",
    kind: "report",
    stage: WAR,
    when: all(war, dates("1915-01")),
    cast: {},
    salience: 6,
    cooldown: 6,
    tags: ["home"],
    stamp: "estimate",
    source: "agents",
    variants: [
      v(
        "refusals",
        any(known("fra_army_refusals"), dates("1917-05", "1917-08")),
      ),
      v("hungry", gaugeAt("bread", 1)),
      v("winter", world({ is: "war_age", min: 16 })),
      v("base"),
    ],
  }),
  // ---- The first winter (ww166 fix): Oct 1914 - Feb 1915 ----
  scene({
    id: "fra_h_first_winter",
    kind: "proposal",
    stage: Y14_ON,
    when: all(
      war,
      dates("1914-11", "1915-02"),
      world({ is: "in_war", min: 2 }),
    ),
    cast: { war: holder("war") },
    salience: 6,
    tags: ["home", "war"],
    variants: [v("base")],
    fallback: "public_appeal",
    options: [
      o("public_appeal", [gauge("morale", 1), reason("fra_h_winter_appeal")]),
      o("state_orders", [gauge("money", -1), army(1)]),
      o("army_alone", [army(1), gauge("morale", -1)]),
    ],
  }),
  scene({
    id: "fra_h_army_post",
    kind: "proposal",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "in_war", min: 2, max: 6 }),
      dates(undefined, "1915-06"),
    ),
    cast: { war: holder("war") },
    salience: 6,
    tags: ["home"],
    variants: [v("base")],
    fallback: "more_post",
    options: [
      o("more_post", [gauge("morale", 1), men(-1)]),
      o("open_letters", [gauge("order", 1), gauge("morale", -1)]),
      o("leave_it", [chamber(-1)]),
    ],
  }),
  scene({
    id: "fra_h_coal_cities",
    kind: "proposal",
    stage: Y14_ON,
    when: all(war, westBack, dates("1914-11", "1915-03")),
    cast: { interior: holder("interior") },
    salience: 6,
    tags: ["home"],
    variants: [v("base")],
    fallback: "cap_price",
    options: [
      o("cap_price", [
        gauge("order", 1),
        gauge("money", -1),
        reason("fra_h_coal_capped"),
      ]),
      o("imports", [gauge("money", -1), gauge("morale", 1)]),
      o("market", [gauge("order", -1)]),
    ],
  }),
  scene({
    id: "fra_h_caillaux_back",
    kind: "wire",
    stage: Y14_ON,
    when: all(not(war), chapter(9), dates(undefined, "1915-02")),
    cast: {},
    salience: 4,
    tags: ["home"],
    variants: [v("base")],
  }),
  // ---- 1916 ----
  scene({
    id: "fra_h_secret_committee",
    kind: "crisis",
    stage: WAR,
    when: all(war, dates("1916-01", "1917-12"), instAt("chamber", { max: 0 })),
    cast: { chancellor: holder("chancellor") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("briand", pm("fra_briand")),
      v("verdun", world({ is: "battle", theatre: "west", of: ["repelled"] })),
      v("base"),
    ],
    fallback: "allow",
    options: [
      o("allow", [
        chamber(2),
        army(-1),
        heat("fra_chamber", -3),
        setFlag("f_secret_committee"),
        reason("fra_h_secret_allowed"),
      ]),
      o("refuse", [chamber(-2), army(1), heat("fra_chamber", 2)]),
      o(
        "pm_speaks",
        [chamber(1), pmTrust(1), heat("fra_chamber", -2)],
        memory("k_bri_chamber"),
      ),
    ],
  }),
  scene({
    id: "fra_h_women",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15b", "16b"), world({ is: "footing", min: 1 })),
    cast: { works: factory },
    salience: 6,
    tags: ["home"],
    variants: [v("thomas", holds("munitions", "fra_thomas")), v("base")],
    fallback: "low_rate",
    options: [
      o("equal_rate", [gauge("money", -1), gauge("order", 1), chamber(1)]),
      o("low_rate", [gauge("shells", 1), gauge("order", -1)]),
      o(
        "nurseries",
        [
          gauge("shells", 1),
          gauge("money", -1),
          gauge("order", 1),
          reason("fra_h_nurseries"),
        ],
        memory("k_tho_women"),
      ),
    ],
  }),
  scene({
    id: "fra_h_bread",
    kind: "proposal",
    stage: WAR,
    when: all(war, dates("1916-07"), gaugeAt("bread", 1)),
    cast: { interior: holder("interior") },
    salience: 7,
    tags: ["home"],
    variants: [v("dry", gaugeAt("bread", 0)), v("base")],
    fallback: "price_cap",
    options: [
      o("price_cap", [
        gauge("order", 1),
        gauge("money", -1),
        reason("fra_h_bread_capped"),
      ]),
      o("mixed_flour", [gauge("bread", 1), gauge("morale", -1)]),
      o("market", [gauge("bread", 1), gauge("order", -1), chamber(-1)]),
    ],
  }),
  scene({
    id: "fra_h_colonial_workers",
    kind: "proposal",
    stage: WAR,
    when: all(war, dates("1915-10", "1917-06"), manLow),
    cast: { interior: holder("interior") },
    salience: 6,
    tags: ["home"],
    variants: [v("base")],
    fallback: "bring",
    options: [
      o("bring", [men(3), gauge("shells", 1), reason("fra_h_workers_came")]),
      o("limit", [men(1)]),
      o("contracts_only", [men(2), gauge("money", -1), chamber(1)]),
    ],
  }),
  // ---- 1917 ----
  scene({
    id: "fra_h_bonnet_rouge",
    kind: "crisis",
    stage: WAR,
    when: all(war, dates("1917-01", "1917-09")),
    cast: { interior: holder("interior") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("known", known("fra_bolo_money")),
      v("daudet", memory("k_dau_letter")),
      v("base"),
    ],
    fallback: "let_it_be",
    options: [
      o("let_it_be", [heat("fra_senate", 2), reason("fra_h_bonnet_left")]),
      o(
        "investigate",
        [
          senate(1),
          person("fra_malvy", -2),
          setFlag("f_bonnet_probe"),
          learn("fra_bolo_money"),
          reason("fra_h_bonnet_probe"),
        ],
        memory("k_cle_attack"),
      ),
      o("close_paper", [
        chamber(-1),
        senate(1),
        setFlag("f_bonnet_closed"),
        censor(1),
      ]),
    ],
  }),
  scene({
    id: "fra_h_strikes",
    kind: "crisis",
    stage: WAR,
    when: all(war, dates("1917-03", "1917-09"), unrestAt(1)),
    cast: { works: factory, interior: holder("interior") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("midinettes", dates("1917-05", "1917-06")),
      v("mutiny", seen("fra_big_mutiny")),
      v("base"),
    ],
    fallback: "concede",
    options: [
      o("concede", [
        gauge("money", -1),
        gauge("order", 1),
        reason("fra_h_strike_conceded"),
      ]),
      o(
        "arbitration",
        [
          gauge("order", 1),
          gauge("shells", 1),
          chamber(1),
          reason("fra_h_strike_arbitration"),
        ],
        memory("k_tho_unions"),
      ),
      o("firm", [gauge("shells", 1), gauge("order", -1), chamber(-1)]),
    ],
  }),
  scene({
    id: "fra_h_stockholm",
    kind: "crisis",
    stage: WAR,
    when: all(war, revolution, dates("1917-04", "1917-09")),
    cast: { foreign: holder("foreign") },
    salience: 8,
    tags: ["foreign", "tension_up"],
    variants: [v("thomas", seen("fra_t_thomas_russia")), v("base")],
    fallback: "refuse",
    options: [
      o("refuse", [army(1), chamber(-1), reason("fra_h_stockholm_refused")]),
      o(
        "allow",
        [
          chamber(1),
          army(-1),
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          setFlag("f_stockholm_allowed"),
          reason("fra_h_stockholm_allowed"),
        ],
        memory("k_tho_russia"),
      ),
      o("delay", [chamber(-1)]),
    ],
  }),
  scene({
    id: "fra_h_sfio_leaves",
    kind: "crisis",
    stage: WAR,
    when: all(war, us, dates("1917-07"), sfioAngry),
    cast: { chancellor: holder("chancellor") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("stockholm", chose("fra_h_stockholm", "refuse")),
      v("streets", unrestAt(2)),
      v("base"),
    ],
    fallback: "let_go",
    options: [
      o("let_go", [
        setFlag("f_sfio_out"),
        unflag("f_union_sacree"),
        maybe(
          world({ is: "regime", of: ["fra_union"] }),
          doWorld({ do: "regime", to: "fra_republic" }),
        ),
        chamber(-1),
        reason("fra_h_sfio_out"),
      ]),
      o(
        "offer_post",
        [
          person("fra_thomas", 1),
          chamber(1),
          gauge("money", -1),
          setFlag("f_sfio_kept"),
          reason("fra_h_sfio_kept"),
        ],
        memory("k_tho_stay"),
      ),
      o("plead", [
        authority(-5),
        heat("fra_chamber", 2),
        setFlag("f_sfio_pleaded"),
      ]),
    ],
  }),
  scene({
    id: "fra_h_malvy_fall",
    kind: "crisis",
    stage: WAR,
    when: all(
      holds("interior", "fra_malvy"),
      seen("fra_h_bonnet_rouge"),
      dates("1917-07"),
    ),
    cast: { chancellor: holder("chancellor"), interior: holder("interior") },
    salience: 9,
    tags: ["people", "tension_up"],
    variants: [
      v("known", known("fra_bolo_money")),
      v("probe", flag("f_bonnet_probe")),
      v("base"),
    ],
    fallback: "defend",
    options: [
      o("defend", [
        person("fra_malvy", 1),
        senate(-2),
        heat("fra_senate", 3),
        reason("fra_h_malvy_defended"),
      ]),
      o(
        "ask_resign",
        [
          person("fra_malvy", -1),
          senate(1),
          { kind: "dismiss", who: byName("fra_malvy") },
          heat("fra_chamber", 2),
          reason("fra_h_malvy_resigned"),
        ],
        memory("k_mal_files"),
      ),
      o("inquiry", [
        senate(1),
        heat("fra_senate", -2),
        setFlag("f_malvy_inquiry"),
      ]),
    ],
  }),
  scene({
    id: "fra_h_bolo",
    kind: "report",
    stage: WAR,
    when: all(seen("fra_h_bonnet_rouge"), dates("1917-09")),
    cast: {},
    salience: 7,
    tags: ["home"],
    stamp: "confirmed",
    source: "press",
    variants: [
      v("after", dates("1918-05")),
      v("trial", dates("1918-02")),
      v("base"),
    ],
  }),
  scene({
    id: "fra_h_humbert",
    kind: "crisis",
    stage: WAR,
    when: all(seen("fra_h_bolo"), dates("1917-10", "1918-06")),
    cast: { chancellor: holder("chancellor") },
    salience: 7,
    tags: ["home"],
    variants: [v("known", known("fra_bolo_money")), v("base")],
    fallback: "wait",
    options: [
      o("wait", []),
      o("ask_senate", [senate(1), setFlag("f_humbert_senate")]),
      o("word_to_pm", [
        pmTrust(1),
        countersign(-1),
        remember("m_humbert_word"),
      ]),
    ],
  }),
  TIGER,
  // ---- 1918 ----
  scene({
    id: "fra_h_caillaux_arrest",
    kind: "crisis",
    stage: WAR,
    when: all(
      any(tiger, seen("fra_h_bolo")),
      dates("1917-12", "1918-06"),
      active("fra_caillaux"),
      not(pm("fra_caillaux")),
    ),
    cast: { chancellor: holder("chancellor") },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [
      v("known", known("fra_rubicon_papers")),
      v("tiger", tiger),
      v("base"),
    ],
    fallback: "let_justice",
    options: [
      o("let_justice", [
        setFlag("f_caillaux_arrested"),
        chamber(1),
        reason("fra_h_caillaux_arrested"),
      ]),
      o("ask_delay", [pmTrust(-1), countersign(-1), heat("fra_elysee", 1)]),
      o(
        "warn_him",
        [
          person("fra_caillaux", 1),
          pmTrust(-2),
          setFlag("f_caillaux_warned"),
          setFlag("f_caillaux_arrested"),
          reason("fra_h_caillaux_warned"),
        ],
        memory("k_cai_warned"),
      ),
    ],
  }),
  scene({
    id: "fra_h_tiger_watch",
    kind: "wire",
    stage: WAR,
    when: all(tiger, dates("1918-01")),
    cast: { chancellor: holder("chancellor") },
    salience: 6,
    cooldown: 4,
    tags: ["people"],
    variants: [
      v("mandel", memory("k_man_tiger")),
      v("kept", promiseKept("fra_clemenceau", "p_cle_free_hand")),
      v("base"),
    ],
  }),
  scene({
    id: "fra_h_rations",
    kind: "proposal",
    stage: WAR,
    when: all(war, dates("1917-10"), gaugeAt("bread", 0)),
    cast: { interior: holder("interior") },
    salience: 7,
    tags: ["home"],
    variants: [v("base")],
    fallback: "cards",
    options: [
      o("cards", [
        gauge("bread", 1),
        gauge("morale", -1),
        reason("fra_h_cards"),
      ]),
      o("no_cards", [gauge("order", -1), chamber(1)]),
      o("mayors_choose", [senate(1), gauge("order", -1)]),
    ],
  }),
  scene({
    id: "fra_h_brion",
    kind: "report",
    stage: WAR,
    when: all(war, dates("1918-03", "1918-08")),
    cast: {},
    salience: 5,
    tags: ["home"],
    stamp: "confirmed",
    source: "press",
    variants: [v("base")],
  }),
  scene({
    id: "fra_h_flu",
    kind: "report",
    stage: AFTER,
    when: dates("1918-07", "1918-12"),
    cast: {},
    salience: 6,
    tags: ["home"],
    stamp: "estimate",
    source: "press",
    variants: [v("war", war), v("base")],
  }),
  scene({
    id: "fra_h_vacant",
    kind: "audience",
    stage: Y14_ON,
    when: all(chapter(6), anyEmpty),
    cast: { chancellor: holder("chancellor") },
    salience: 7,
    cooldown: 4,
    tags: ["people"],
    variants: [
      v("war_seat", offered(VACANCIES[0])),
      v("munitions", offered(VACANCIES[1])),
      v("foreign", offered(VACANCIES[2])),
      v("interior", offered(VACANCIES[3])),
      v("finance", offered(VACANCIES[4])),
      v("base"),
    ],
    fallback: "first_name",
    options: [
      o("first_name", [...fillVacant((x) => x[1])]),
      o("second_name", [...fillVacant((x) => x[2]), pmTrust(-1)]),
      o(
        "press_own",
        [
          appoint("fra_messimy", "war"),
          keepPromise(byName("fra_messimy"), "p_mes_return"),
          pmTrust(-1),
          countersign(-1),
          reason("fra_h_messimy_back"),
        ],
        messimyBack,
      ),
    ],
  }),
  scene({
    id: "fra_h_strasbourg",
    kind: "proposal",
    stage: AFTER,
    when: all(
      world({ is: "armistice" }),
      world({ is: "front", theatre: "west", to: "liege" }),
      dates("1918-10"),
    ),
    cast: { chancellor: holder("chancellor") },
    salience: 8,
    tags: ["home", "tension_down"],
    variants: [v("tiger", tiger), v("base")],
    fallback: "together",
    options: [
      o("together", [
        gauge("morale", 1),
        pmTrust(1),
        reason("fra_h_strasbourg"),
      ]),
      o("president_first", [gauge("morale", 1), pmTrust(-1), authority(5)]),
      o("pm_first", [pmTrust(2), authority(-5)]),
    ],
  }),
  scene({
    id: "fra_h_homme_enchaine",
    kind: "wire",
    stage: Y14_ON,
    when: all(
      seen("fra_c_censorship"),
      not(chose("fra_c_censorship", "spare_clemenceau")),
      chapter(7, 9),
    ),
    cast: {},
    salience: 5,
    tags: ["home"],
    variants: [v("bordeaux", flag("f_gov_bordeaux")), v("base")],
  }),
  TOP,

  // ---- Talks: Malvy ----
  talk(
    "fra_t_malvy_police",
    "fra_malvy",
    CRISIS,
    chapter(0, 5),
    std({
      gift: [remember("k_mal_police")],
      price: [countersign(-1)],
      moods: ["cunning", "anxious"],
      yields: "anxious",
    }),
  ),
  talk(
    "fra_t_malvy_cgt",
    "fra_malvy",
    CRISIS_ON,
    all(chapter(4, 6), { kind: "crisis", topic: "balkan" }),
    std({
      gift: [remember("k_carnet_soft")],
      price: [army(-1)],
      moods: ["cunning", "anxious"],
      bristles: "anxious",
    }),
  ),
  talk(
    "fra_t_malvy_weekly",
    "fra_malvy",
    Y14_ON,
    all(
      holds("interior", "fra_malvy"),
      chapter(6),
      dates(undefined, "1917-06"),
    ),
    std({
      gift: [remember("k_mal_weekly")],
      price: [gauge("money", -1)],
      moods: ["cunning"],
      yields: "cunning",
    }),
    {
      cd: 6,
      intro: [
        v("strikes", unrestAt(1)),
        v("again", seen("fra_t_malvy_weekly")),
        v("base"),
      ],
    },
  ),
  talk(
    "fra_t_malvy_papers",
    "fra_malvy",
    WAR,
    all(war, during("15b", "17a")),
    std({
      gift: [
        learn("fra_bolo_money"),
        learn("fra_rubicon_papers"),
        remember("k_mal_papers"),
      ],
      price: [person("fra_caillaux", -1)],
      moods: ["cunning", "anxious"],
      bristles: "cunning",
    }),
  ),
  talk(
    "fra_t_malvy_files",
    "fra_malvy",
    WAR,
    all(seen("fra_h_bonnet_rouge"), during("17a", "17b")),
    std({
      gift: [remember("k_mal_files")],
      price: [senate(-1)],
      moods: ["anxious"],
      yields: "anxious",
    }),
  ),
  talk(
    "fra_t_malvy_friend",
    "fra_malvy",
    Y14_ON,
    all(war, chapter(6), dates(undefined, "1917-12")),
    std({
      gift: [
        promise(byName("fra_malvy"), "p_mal_watch", 10, {
          keep: any(
            chose("fra_h_bonnet_rouge", "let_it_be"),
            chose("fra_h_bonnet_rouge", "close_paper"),
          ),
        }),
      ],
      price: [senate(-1)],
      moods: ["cunning"],
      yields: "cunning",
    }),
  ),
  // ---- Talks: Briand ----
  talk(
    "fra_t_briand_ready",
    "fra_briand",
    Y14_ON,
    all(war, chapter(8), dates(undefined, "1915-12"), not(pm("fra_briand"))),
    std({
      gift: [remember("k_bri_ready")],
      price: [person("fra_viviani", -1)],
      moods: ["cunning", "weary"],
      yields: "cunning",
    }),
  ),
  talk(
    "fra_t_briand_chamber",
    "fra_briand",
    WAR,
    all(pm("fra_briand"), during("15b", "17a")),
    std({
      gift: [remember("k_bri_chamber")],
      price: [chamber(-1)],
      moods: ["weary"],
      yields: "weary",
    }),
  ),
  talk(
    "fra_t_briand_orient",
    "fra_briand",
    WAR,
    all(war, during("15b", "16b")),
    std({
      gift: [remember("k_bri_orient")],
      price: [person("fra_joffre", -1)],
      moods: ["cunning"],
      bristles: "weary",
    }),
  ),
  talk(
    "fra_t_briand_lancken",
    "fra_briand",
    WAR,
    all(seen("fra_f_lancken"), during("17b", "18a")),
    std({
      gift: [remember("k_bri_lancken")],
      price: [person("fra_ribot", -1)],
      moods: ["cunning", "weary"],
      bristles: "cunning",
    }),
  ),
  talk(
    "fra_t_briand_back",
    "fra_briand",
    WAR,
    all(war, not(pm("fra_briand")), during("17a", "18b")),
    std({
      gift: [remember("k_bri_back")],
      price: [pmTrust(-1)],
      moods: ["cunning", "weary"],
      yields: "cunning",
    }),
    { cd: 8 },
  ),
  talk(
    "fra_t_briand_cello",
    "fra_briand",
    ANY,
    chapter(0),
    std({
      gift: [remember("k_bri_count")],
      price: [],
      moods: ["weary"],
      yields: "weary",
    }),
    {
      cd: 10,
      intro: [
        v("pm", pm("fra_briand")),
        v("again", seen("fra_t_briand_cello")),
        v("base"),
      ],
    },
  ),
  // ---- Talks: Clemenceau ----
  talk(
    "fra_t_clemenceau_paper",
    "fra_clemenceau",
    Y14_ON,
    // Before the censorship paper (W1's fra_c_censorship, chapters 6-8): the
    // key it opens is what lets that paper spare his paper.
    all(war, chapter(6, 8)),
    std({
      gift: [remember("k_cle_paper")],
      price: [censor(-1)],
      moods: ["arrogant", "stubborn"],
      bristles: "arrogant",
    }),
  ),
  talk(
    "fra_t_clemenceau_commission",
    "fra_clemenceau",
    WAR,
    all(war, notTiger, during("15a", "17b")),
    std({
      gift: [remember("k_cle_commission")],
      price: [army(-1)],
      moods: ["arrogant", "stubborn"],
      bristles: "stubborn",
    }),
  ),
  talk(
    "fra_t_clemenceau_attack",
    "fra_clemenceau",
    WAR,
    all(war, notTiger, during("17a", "17b")),
    std({
      gift: [remember("k_cle_attack")],
      price: [person("fra_malvy", -1)],
      moods: ["arrogant"],
      yields: "stubborn",
    }),
  ),
  talk(
    "fra_t_clemenceau_terms",
    "fra_clemenceau",
    WAR,
    all(war, notTiger, dates("1917-07"), any(fallen, shaky)),
    std({
      gift: [
        remember("k_cle_terms"),
        promise(byName("fra_clemenceau"), "p_cle_free_hand", 6, {
          keep: tiger,
        }),
      ],
      price: [authority(-5)],
      moods: ["arrogant", "stubborn"],
      bristles: "arrogant",
    }),
  ),
  talk(
    "fra_t_clemenceau_old",
    "fra_clemenceau",
    ANY,
    all(notTiger, dates(undefined, "1917-12")),
    std({
      gift: [remember("k_cle_1913")],
      price: [],
      moods: ["arrogant"],
      bristles: "stubborn",
    }),
    { cd: 10, intro: [v("again", seen("fra_t_clemenceau_old")), v("base")] },
  ),
  talk(
    "fra_t_clemenceau_tiger",
    "fra_clemenceau",
    WAR,
    all(tiger, during("18a", "18b")),
    std({
      gift: [remember("k_cle_word")],
      price: [authority(-5)],
      moods: ["arrogant", "stubborn"],
      bristles: "arrogant",
    }),
  ),
  // ---- Talks: Albert Thomas ----
  talk(
    "fra_t_thomas_shells",
    "fra_thomas",
    Y14_ON,
    all(war, chapter(8), dates(undefined, "1915-12")),
    std({
      gift: [remember("k_tho_shells")],
      price: [gauge("money", -1)],
      moods: ["cunning", "stubborn"],
      yields: "cunning",
    }),
  ),
  talk(
    "fra_t_thomas_women",
    "fra_thomas",
    WAR,
    all(holds("munitions", "fra_thomas"), during("15b", "16b")),
    std({
      gift: [remember("k_tho_women")],
      price: [gauge("money", -1)],
      moods: ["stubborn"],
      yields: "cunning",
    }),
  ),
  talk(
    "fra_t_thomas_unions",
    "fra_thomas",
    WAR,
    all(war, during("16b", "17a")),
    std({
      gift: [remember("k_tho_unions")],
      price: [army(-1)],
      moods: ["cunning", "stubborn"],
      bristles: "stubborn",
    }),
  ),
  talk(
    "fra_t_thomas_russia",
    "fra_thomas",
    WAR,
    all(war, revolution, during("17a", "17b")),
    std({
      gift: [remember("k_tho_russia")],
      price: [person("fra_ribot", -1)],
      moods: ["stubborn"],
      yields: "cunning",
    }),
  ),
  talk(
    "fra_t_thomas_stay",
    "fra_thomas",
    WAR,
    all(us, war, during("17b")),
    std({
      gift: [remember("k_tho_stay")],
      price: [chamber(-1)],
      moods: ["cunning", "stubborn"],
      bristles: "stubborn",
    }),
  ),
  talk(
    "fra_t_thomas_party",
    "fra_thomas",
    WAR,
    all(war, during("15a", "17b")),
    std({
      gift: [remember("k_tho_party")],
      price: [],
      moods: ["stubborn"],
      yields: "cunning",
    }),
    { cd: 8 },
  ),
  // ---- Visits ----
  visit(
    "fra_v_deschanel_chamber",
    "fra_deschanel",
    Y14_ON,
    all(chapter(6), shaky),
    6,
    std({
      gift: [remember("k_des_chamber")],
      price: [authority(-5)],
      moods: ["anxious"],
      yields: "anxious",
    }),
  ),
  visit(
    "fra_v_dubost_senate",
    "fra_dubost",
    Y14_ON,
    all(chapter(6), shaky),
    6,
    std({
      gift: [remember("k_dub_senate")],
      price: [senate(1), chamber(-1)],
      moods: ["stubborn", "weary"],
      bristles: "stubborn",
    }),
  ),
  visit(
    "fra_v_barres_alsace",
    "fra_barres",
    WAR,
    war,
    5,
    std({
      gift: [remember("k_bar_right")],
      price: [chamber(-1)],
      moods: ["arrogant", "stubborn"],
      bristles: "arrogant",
    }),
    { cd: 10 },
  ),
  visit(
    "fra_v_daudet_accuse",
    "fra_daudet",
    WAR,
    all(war, during("16b", "17b")),
    6,
    std({
      gift: [remember("k_dau_letter")],
      price: [person("fra_malvy", -1)],
      moods: ["arrogant", "cunning"],
      yields: "arrogant",
    }),
  ),
  visit(
    "fra_v_mandel_tiger",
    "fra_mandel",
    WAR,
    tiger,
    6,
    std({
      gift: [remember("k_man_tiger")],
      price: [authority(-5)],
      moods: ["cold"],
      yields: "cunning",
    }),
  ),
];
