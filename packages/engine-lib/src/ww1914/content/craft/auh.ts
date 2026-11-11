import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  decide,
  holder,
  inst_,
  role,
  schedule,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";
import {
  FACTORY,
  footing,
  footingAt,
  inCharge,
  outsider,
  project,
  shortage,
} from "./kit";

// AUH's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/AUH.craft.json. Inventors are pack-only people
// (auh_i_*). There is no joint interior minister: nothing here casts
// `interior`, and leads are offices the empire always fills.

const NATION: GwScene["nation"] = ["AUH"];
const base = { id: "base" };
const atWar = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });
const from = (ym: string): GwCond => world({ is: "date", from: ym });

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
const trustDeu = (delta: number): GwEffect => ({
  kind: "trust",
  tag: "DEU",
  delta,
});
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });
const lead = role("lead");
const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

// ---- Inventions ----

export const AUH_INVENTIONS: readonly GwInventionRow[] = [
  {
    // Hermann Pokorny read the Russian army's radio ciphers from autumn 1914.
    id: "auh_inv_codes",
    tag: "AUH",
    inventor: "auh_i_pokorny",
    opens: all(atWar, { kind: "at_war", tag: "RUS" }),
    build: 2,
    trial: 65,
    ripe: 2,
    edge: { theatres: ["east"], attack: 6, defence: 6 },
    cast: { cos: holder("chief_of_staff") },
  },
  {
    // Lohner's flying boats over the Adriatic, 1915.
    id: "auh_inv_lohner",
    tag: "AUH",
    inventor: "auh_i_lohner",
    opens: all(atWar, from("1915-01")),
    build: 2,
    trial: 60,
    ripe: 3,
    edge: { theatres: ["sea"], attack: 6, defence: 4 },
    cast: { navy: holder("navy") },
  },
  {
    // Ferdinand Porsche's Austro-Daimler M 17 "Goliath": iron wheels, no tyres.
    id: "auh_inv_goliath",
    tag: "AUH",
    inventor: "auh_i_porsche",
    opens: all(atWar, warAge(10)),
    build: 3,
    trial: 55,
    ripe: 3,
    edge: { theatres: ["italy", "balkan"], attack: 6 },
    solves: ["rubber"],
    cast: { war: holder("war") },
  },
  {
    // Lorenz Böhler's fracture ward at Bozen, 1916: first barred from it.
    id: "auh_inv_bohler",
    tag: "AUH",
    inventor: "auh_i_bohler",
    opens: all(atWar, from("1916-03")),
    against: "army",
    price: 10,
    build: 2,
    trial: 70,
    ripe: 2,
    fielded: [manpower(3), gauge("morale", 1)],
    cast: { war: holder("war") },
  },
  {
    // Günther Burstyn's motor gun of 1911, refused by Vienna and Berlin.
    id: "auh_inv_burstyn",
    tag: "AUH",
    inventor: "auh_i_burstyn",
    opens: all(atWar, warAge(18)),
    against: "army",
    price: 10,
    build: 4,
    trial: 35,
    ripe: 3,
    edge: { theatres: ["east", "italy"], attack: 8 },
    tech: "tanks",
    cast: { cos: holder("chief_of_staff") },
    variants: [
      { id: "heard", when: world({ is: "tech", id: "tanks", tag: "GBR" }) },
    ],
  },
  {
    // Žurovec's tethered rotor at Fischamend, 1917-18, with Petróczy behind it.
    id: "auh_inv_pkz",
    tag: "AUH",
    inventor: "auh_i_zurovec",
    opens: all(atWar, from("1917-03")),
    build: 3,
    trial: 30,
    ripe: 2,
    edge: { theatres: ["italy"], defence: 6 },
    cast: { petroczy: outsider("auh_i_petroczy") },
  },
];

// ---- The year's project ----

export const AUH_PROJECTS: readonly GwProjectRow[] = [
  {
    // The Bosnian lines were narrow gauge; the link to the coast was argued for years.
    id: "auh_pj_rail",
    tag: "AUH",
    lead: holder("finance"),
    odds: 50,
    aims: ["auh_aim_serbia"],
    start: [gauge("money", -1), inst_("hungary", -1)],
    done: [
      doWorld({ do: "force", tag: "AUH", theatre: "balkan", delta: 1 }),
      opinion("business", 1),
    ],
    failed: [opinion("business", -1)],
  },
  {
    // The joint food committee of 1917 under General Landwehr.
    id: "auh_pj_food",
    tag: "AUH",
    opens: all(atWar, warAge(6)),
    lead: { any_of: [{ person: "auh_landwehr" }, { office: "war" }] },
    odds: 45,
    aims: ["auh_aim_bread"],
    start: [inst_("hungary", -1)],
    done: [gauge("bread", 1), opinion("workers", 1)],
    failed: [opinion("workers", -1)],
  },
  {
    id: "auh_pj_shells",
    tag: "AUH",
    opens: atWar,
    lead: holder("war"),
    odds: 55,
    aims: ["auh_aim_own"],
    start: [gauge("money", -1), opinion("business", 1)],
    done: [gauge("shells", 1), inst_("berlin", -1)],
    terms: FACTORY,
  },
  {
    id: "auh_pj_loan",
    tag: "AUH",
    opens: atWar,
    lead: holder("finance"),
    odds: 60,
    start: [opinion("press", 1)],
    done: [gauge("money", 1)],
    failed: [opinion("business", -1)],
  },
  {
    // The Reichsrat, shut in March 1914, met again in May 1917.
    id: "auh_pj_reichsrat",
    tag: "AUH",
    lead: holder("chancellor"),
    odds: 50,
    aims: ["auh_aim_nations"],
    start: [opinion("parliament", 1), opinion("court", -1)],
    done: [inst_("nations", 1), opinion("workers", 1)],
    failed: [inst_("nations", -1)],
  },
  {
    // The Austro-Polish solution, after Warsaw fell in August 1915.
    id: "auh_pj_poland",
    tag: "AUH",
    opens: all(atWar, world({ is: "front", theatre: "east", from: "warsaw" })),
    lead: holder("foreign"),
    odds: 40,
    aims: ["auh_aim_nations", "auh_aim_own"],
    start: [trustDeu(-1)],
    done: [manpower(3), inst_("berlin", -1)],
    failed: [inst_("berlin", 1)],
  },
];

// ---- Footing ----

export const AUH_FOOTING: GwFootingRow | null = {
  tag: "AUH",
  steps: [
    { scene: "auh_ft_war" },
    { scene: "auh_ft_total", opens: all(warAge(12), footingAt(1)) },
  ],
};

// ---- Shortages ----

export const AUH_SHORTAGES: readonly GwShortageRow[] = [
  {
    id: "nitrates",
    tag: "AUH",
    when: world({ is: "blockade", min: 2 }),
    scene: "auh_sh_nitrates",
    drag: [{ gauge: "shells", delta: -1, every: 3 }],
  },
  {
    id: "rubber",
    tag: "AUH",
    when: all(warAge(6), world({ is: "blockade", min: 1 })),
    scene: "auh_sh_rubber",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 1 }],
  },
  {
    id: "fats",
    tag: "AUH",
    when: all(warAge(10), world({ is: "blockade", min: 3 })),
    scene: "auh_sh_fats",
    drag: [
      { gauge: "bread", delta: -1, every: 4, offset: 2 },
      { gauge: "order", delta: -1, every: 6, offset: 3 },
    ],
  },
  {
    id: "copper",
    tag: "AUH",
    when: warAge(14),
    scene: "auh_sh_copper",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 2 }],
  },
];

// ---- Scenes ----

const sched = { nation: NATION, scheduledOnly: true, once: true } as const;

/** A project chapter: a proposal with the man in charge. */
const chapter = (
  id: string,
  cast: Record<string, GwCastRule>,
  options: GwOption[],
  tags: GwScene["tags"] = ["home"],
): GwScene => ({
  ...sched,
  id,
  kind: "proposal",
  salience: 6,
  tags,
  cast: { lead: inCharge, ...cast },
  variants: [base],
  fallback: options[options.length - 1].id,
  options,
});

/** It got done: read and put away. */
const done = (id: string): GwScene => ({
  ...sched,
  id,
  kind: "wire",
  salience: 6,
  tags: ["home"],
  cast: { lead: inCharge },
  variants: [base],
});

/** It failed: what becomes of the man in charge. */
const failed = (id: string): GwScene =>
  chapter(id, {}, [
    opt("rebuke", [trustOf(lead, -1), { kind: "pride", who: lead, delta: -1 }]),
    opt("keep", [trustOf(lead, 1)]),
  ]);

const PROJECT_SCENES: GwScene[] = [
  // The Bosnian railway
  chapter("auh_pj_rail_prep", { hun_pm: holder("hun_pm") }, [
    opt("coast", [project("push"), inst_("hungary", -1)]),
    opt("hungarian_line", [project("slow"), inst_("hungary", 1)]),
  ]),
  chapter("auh_pj_rail_opp", { cos: holder("chief_of_staff") }, [
    opt("rails_first", [project("push"), trustOf(role("cos"), -1)]),
    opt("lend_men", [project("slow"), manpower(-1)]),
  ]),
  chapter("auh_pj_rail_exec", {}, [
    opt("pay_more", [project("push"), gauge("money", -1)]),
    opt("as_planned", []),
  ]),
  done("auh_pj_rail_done"),
  failed("auh_pj_rail_fail"),
  // The food committee
  chapter("auh_pj_food_prep", { hun_pm: holder("hun_pm") }, [
    opt("powers", [project("push"), inst_("hungary", -1)]),
    opt("advice", [project("slow"), trustOf(role("hun_pm"), 1)]),
  ]),
  chapter("auh_pj_food_opp", { hun_pm: holder("hun_pm") }, [
    opt("lists_open", [project("push"), inst_("hungary", -1)]),
    opt("drop", [project("drop")]),
    opt("trust_budapest", [project("slow"), inst_("hungary", 1)]),
  ]),
  chapter("auh_pj_food_exec", { cos: holder("chief_of_staff") }, [
    opt("cities_first", [project("push"), trustOf(role("cos"), -1)]),
    opt("army_first", [project("slow"), opinion("army", 1)]),
  ]),
  done("auh_pj_food_done"),
  failed("auh_pj_food_fail"),
  // The shell works
  chapter("auh_pj_shells_prep", { finance: holder("finance") }, [
    opt("new_works", [project("push"), gauge("money", -1)]),
    opt("more_shifts", [project("slow"), opinion("workers", -1)]),
  ]),
  chapter(
    "auh_pj_shells_opp",
    { fm: holder("foreign") },
    [
      opt("own_steel", [project("push"), trustDeu(-1)]),
      opt("german_steel", [project("slow"), inst_("berlin", 1)]),
    ],
    ["home", "foreign"],
  ),
  chapter("auh_pj_shells_exec", {}, [
    opt("women_in", [project("push"), opinion("workers", 1), manpower(1)]),
    opt("soldiers_back", [project("push"), manpower(-2)]),
    opt("as_is", []),
  ]),
  done("auh_pj_shells_done"),
  failed("auh_pj_shells_fail"),
  // The war loan
  chapter("auh_pj_loan_prep", {}, [
    opt("posters", [project("push"), censor(1)]),
    opt("banks", [opinion("business", 1)]),
  ]),
  chapter("auh_pj_loan_opp", { hun_pm: holder("hun_pm") }, [
    opt("one_loan", [project("push"), inst_("hungary", -1)]),
    opt("two_loans", [project("slow"), inst_("hungary", 1)]),
  ]),
  chapter("auh_pj_loan_exec", {}, [
    opt("small_bonds", [project("push"), opinion("workers", 1)]),
    opt("big_names", [opinion("court", 1)]),
  ]),
  done("auh_pj_loan_done"),
  failed("auh_pj_loan_fail"),
  // The Reichsrat
  chapter("auh_pj_reichsrat_prep", { court: holder("court") }, [
    opt("date_set", [project("push"), trustOf(role("court"), -1)]),
    opt("quietly", [project("slow")]),
  ]),
  chapter("auh_pj_reichsrat_opp", { foe: { camp: "hard" } }, [
    opt("open_anyway", [project("push"), trustOf(role("foe"), -1)]),
    opt("drop", [project("drop"), trustOf(role("foe"), 1)]),
    opt("censor_stays", [project("slow"), censor(1)]),
  ]),
  chapter("auh_pj_reichsrat_exec", {}, [
    opt("amnesty", [project("push"), inst_("nations", 1), opinion("army", -1)]),
    opt("throne_speech", [opinion("court", 1)]),
  ]),
  done("auh_pj_reichsrat_done"),
  failed("auh_pj_reichsrat_fail"),
  // Poland
  chapter(
    "auh_pj_poland_prep",
    { finance: holder("finance") },
    [
      opt("galicia_too", [
        project("push"),
        inst_("nations", 1),
        inst_("hungary", -1),
      ]),
      opt("kingdom_only", []),
    ],
    ["foreign"],
  ),
  chapter(
    "auh_pj_poland_opp",
    { cos: holder("chief_of_staff") },
    [
      opt("stand_firm", [project("push"), trustDeu(-1)]),
      opt("share", [project("slow"), inst_("berlin", 1)]),
    ],
    ["foreign"],
  ),
  chapter(
    "auh_pj_poland_exec",
    {},
    [
      opt("regency", [project("push"), opinion("court", -1)]),
      opt("legions", [project("push"), manpower(-1), inst_("army", -1)]),
      opt("wait", []),
    ],
    ["foreign"],
  ),
  done("auh_pj_poland_done"),
  failed("auh_pj_poland_fail"),
];

// ---- Footing: two big scenes ----

const say = (
  id: string,
  stance: GwReply["stance"],
  next: string | null,
): GwReply => ({ id, stance, kind: "ask", tell: [], effects: [], next });

const node = (
  who: string | null,
  replies: GwReply[],
  fallback?: string,
): GwNode => ({
  says: [base],
  replies,
  ...(who === null ? { alone: true } : { who }),
  ...(fallback === undefined ? {} : { fallback }),
});

const bigFooting = (
  id: string,
  cast: Record<string, GwCastRule>,
  who: string,
  nodes: Record<string, GwNode>,
): GwScene => ({
  ...sched,
  id,
  kind: "talk",
  big: true,
  salience: 9,
  tags: ["war", "home"],
  cast,
  who,
  start: "n1",
  variants: [base],
  nodes,
});

const FOOTING_SCENES: GwScene[] = [
  bigFooting(
    "auh_ft_war",
    {
      war: holder("war"),
      hun_pm: holder("hun_pm"),
      finance: holder("finance"),
    },
    "war",
    {
      n1: node("war", [say("how", "frank", "n2"), say("cost", "cold", "n2")]),
      n2: node("hun_pm", [
        say("grain", "frank", "n3"),
        say("hear", "warm", "n3"),
      ]),
      n3: node("finance", [say("money", "cold", "n4")]),
      n4: node(null, [decide("think", "n5")]),
      n5: node(
        "war",
        [
          decide("raise", null, [footing(1), opinion("business", 1)]),
          decide("half", null, [
            footing(1),
            inst_("hungary", 1),
            gauge("shells", -1),
          ]),
          decide("wait", null),
        ],
        "wait",
      ),
    },
  ),
  bigFooting(
    "auh_ft_total",
    {
      cos: holder("chief_of_staff"),
      chancellor: holder("chancellor"),
      hun_pm: holder("hun_pm"),
    },
    "cos",
    {
      n1: node("cos", [
        say("ages", "frank", "n2"),
        say("enough", "cold", "n2"),
      ]),
      n2: node("chancellor", [
        say("cities", "frank", "n3"),
        say("decree", "cold", "n3"),
      ]),
      n3: node("hun_pm", [say("harvest", "warm", "n4")]),
      n4: node(null, [decide("night", "n5")]),
      n5: node(
        "cos",
        [
          decide("raise", null, [footing(2), opinion("workers", -1)]),
          decide("raise_harvest", null, [
            footing(2),
            inst_("hungary", 1),
            manpower(-2),
          ]),
          decide("wait", null),
        ],
        "wait",
      ),
    },
  ),
];

// ---- Shortages: their events ----

/** A shortage event. Putting up with it brings the paper back in a while. */
const shortageScene = (
  id: string,
  cast: Record<string, GwCastRule>,
  options: GwOption[],
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  scheduledOnly: true,
  salience: 7,
  tags: ["war", "home"],
  cast,
  variants: [base],
  fallback: "endure",
  options: [...options, opt("endure", [schedule(id, 4)])],
});

const SHORTAGE_SCENES: GwScene[] = [
  shortageScene(
    "auh_sh_nitrates",
    { war: holder("war"), fm: holder("foreign") },
    [
      opt("buy_berlin", [shortage("nitrates", false), inst_("berlin", 1)]),
      opt("own_works", [shortage("nitrates", false), gauge("money", -1)]),
    ],
  ),
  shortageScene("auh_sh_rubber", { war: holder("war") }, [
    opt("bicycles", [shortage("rubber", false), opinion("workers", -1)]),
    opt("smuggle", [shortage("rubber", false), gauge("money", -1)]),
  ]),
  shortageScene(
    "auh_sh_fats",
    { hun_pm: holder("hun_pm"), chancellor: holder("chancellor") },
    [
      opt("fat_cards", [shortage("fats", false), gauge("morale", -1)]),
      opt("hungary_pigs", [shortage("fats", false), inst_("hungary", -1)]),
    ],
  ),
  shortageScene(
    "auh_sh_copper",
    { war: holder("war"), court: holder("court") },
    [
      opt("bells", [shortage("copper", false), opinion("court", -1)]),
      opt("households", [shortage("copper", false), gauge("morale", -1)]),
    ],
  ),
];

// ---- Labour ----

const LABOUR_SCENES: GwScene[] = [
  {
    id: "auh_lb_women",
    nation: NATION,
    kind: "proposal",
    when: all(footingAt(1), warAge(8)),
    once: true,
    salience: 6,
    tags: ["home"],
    cast: { war: holder("war") },
    variants: [base],
    fallback: "as_is",
    options: [
      opt("same_pay", [opinion("workers", 1), manpower(2), gauge("money", -1)]),
      opt("nurseries", [opinion("workers", 1), manpower(1)]),
      opt("as_is", [manpower(1), opinion("workers", -1)]),
    ],
  },
  {
    id: "auh_lb_union",
    nation: NATION,
    kind: "proposal",
    when: all(footingAt(1), { kind: "bloc", bloc: "workers", max: -1 }),
    once: true,
    salience: 6,
    tags: ["home"],
    cast: {
      speaker: { any_of: [{ person: "auh_adler" }, { office: "chancellor" }] },
      war: holder("war"),
    },
    variants: [base],
    fallback: "military_law",
    options: [
      opt("commissions", [opinion("workers", 1), opinion("army", -1)]),
      opt("wages", [opinion("workers", 1), gauge("money", -1)]),
      opt("military_law", [opinion("army", 1), opinion("workers", -1)]),
    ],
  },
  {
    id: "auh_lb_strike",
    nation: NATION,
    kind: "proposal",
    when: all(
      footingAt(1),
      { kind: "bloc", bloc: "workers", max: -2 },
      { kind: "gauge", gauge: "bread", max: 1 },
    ),
    once: true,
    salience: 8,
    tags: ["home"],
    cast: { chancellor: holder("chancellor"), war: holder("war") },
    variants: [base],
    fallback: "flour",
    options: [
      opt("councils", [
        opinion("workers", 2),
        gauge("shells", -1),
        inst_("army", -1),
      ]),
      opt("flour", [opinion("workers", 1), gauge("bread", -1)]),
      opt("leaders_up", [
        opinion("workers", -2),
        gauge("order", -1),
        manpower(1),
      ]),
    ],
  },
];

/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const AUH_CRAFT_SCENES: readonly GwScene[] = [
  ...PROJECT_SCENES,
  ...FOOTING_SCENES,
  ...SHORTAGE_SCENES,
  ...LABOUR_SCENES,
];
