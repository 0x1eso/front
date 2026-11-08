import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  decide,
  holder,
  inst_,
  role,
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
  footing,
  footingAt,
  inCharge,
  outsider,
  project,
  short,
  shortage,
} from "./kit";

// RUS's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/RUS.craft.json. Russia's war economy is the one whose
// factories weren't there: shells come slowly, bread goes fast.

const atWar = world({ is: "war" });
const age = (min: number): GwCond => world({ is: "war_age", min });
const dug = world({
  is: "era",
  of: ["trenches", "material", "depth", "storm"],
});
const throne = world({ is: "regime", of: ["tsar", "crown", "regency"] });
const turksIn = world({ is: "entered", tag: "OTT", side: "central" });
const g = (gauge: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
const o = (id: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});
const push = project("push");
const slow = project("slow");

export const RUS_INVENTIONS: readonly GwInventionRow[] = [
  {
    id: "rus_inv_muromets",
    tag: "RUS",
    inventor: "rus_i_sikorsky",
    opens: atWar,
    against: "stavka",
    price: 10,
    build: 2,
    trial: 65,
    ripe: 2,
    edge: { theatres: ["east"], attack: 4 },
    cast: { sandro: outsider("rus_sandro") },
  },
  {
    id: "rus_inv_mask",
    tag: "RUS",
    inventor: "rus_i_zelinsky",
    opens: all(atWar, dug),
    against: "court",
    price: 10,
    build: 2,
    trial: 70,
    ripe: 1,
    edge: { theatres: ["east"], defence: 6 },
    cast: { prince: outsider("rus_i_oldenburg") },
  },
  {
    id: "rus_inv_explosives",
    tag: "RUS",
    inventor: "rus_i_ipatiev",
    opens: all(atWar, any(short("nitrates"), age(8))),
    against: "ministers",
    price: 10,
    build: 3,
    trial: 70,
    ripe: 1,
    solves: ["nitrates"],
    fielded: [g("shells", 1)],
    cast: { war: holder("war") },
    variants: [{ id: "short", when: short("nitrates") }],
  },
  {
    id: "rus_inv_tsar_tank",
    tag: "RUS",
    inventor: "rus_i_lebedenko",
    opens: all(atWar, dug, age(6)),
    against: "stavka",
    price: 10,
    build: 3,
    trial: 25,
    ripe: 2,
    edge: { theatres: ["east"], attack: 8 },
    tech: "tanks",
  },
  {
    id: "rus_inv_avtomat",
    tag: "RUS",
    inventor: "rus_i_fyodorov",
    opens: all(atWar, age(12)),
    against: "ministers",
    price: 10,
    build: 3,
    trial: 55,
    ripe: 2,
    edge: { theatres: ["east"], attack: 6 },
    tech: "assault_groups",
    cast: { war: holder("war") },
  },
  {
    id: "rus_inv_rubber",
    tag: "RUS",
    inventor: "rus_i_ostromislensky",
    opens: all(atWar, short("rubber")),
    build: 4,
    trial: 40,
    ripe: 1,
    solves: ["rubber"],
  },
];

export const RUS_PROJECTS: readonly GwProjectRow[] = [
  {
    id: "rus_pj_murmansk",
    tag: "RUS",
    opens: atWar,
    lead: { any_of: [{ person: "rus_trepov" }, { office: "chancellor" }] },
    odds: 50,
    start: [g("money", -1)],
    done: [g("shells", 1), shortage("rubber", false)],
    failed: [g("money", -1)],
  },
  {
    id: "rus_pj_shellworks",
    tag: "RUS",
    opens: atWar,
    lead: holder("war"),
    odds: 45,
    start: [g("money", -1), opinion("business", -1)],
    done: [g("shells", 1), inst_("stavka", 1)],
    failed: [inst_("ministers", -1)],
  },
  {
    id: "rus_pj_grain",
    tag: "RUS",
    opens: atWar,
    lead: { any_of: [{ office: "agriculture" }, { office: "interior" }] },
    odds: 50,
    aims: ["rus_aim_bread"],
    start: [inst_("stavka", -1)],
    done: [g("bread", 1), opinion("workers", 1)],
    failed: [opinion("workers", -1)],
  },
  {
    id: "rus_pj_schools",
    tag: "RUS",
    lead: { any_of: [{ person: "rus_lvov" }, { office: "chancellor" }] },
    odds: 60,
    aims: ["rus_aim_trust"],
    start: [g("money", -1), opinion("parliament", 1)],
    done: [inst_("duma", 1), opinion("press", 1)],
    failed: [inst_("duma", -1)],
  },
  {
    id: "rus_pj_bosphorus",
    tag: "RUS",
    opens: turksIn,
    lead: holder("navy"),
    odds: 35,
    aims: ["rus_aim_tsargrad"],
    start: [inst_("stavka", -1)],
    done: [
      doWorld({ do: "force", tag: "RUS", theatre: "straits", delta: 1 }),
      opinion("press", 1),
    ],
    failed: [g("morale", -1)],
  },
  {
    id: "rus_pj_land",
    tag: "RUS",
    lead: { any_of: [{ office: "agriculture" }, { office: "chancellor" }] },
    odds: 50,
    aims: ["rus_aim_bread"],
    start: [inst_("court", -1)],
    done: [g("bread", 1), g("order", 1)],
    failed: [inst_("duma", -1)],
  },
];

export const RUS_FOOTING: GwFootingRow | null = {
  tag: "RUS",
  steps: [
    {
      scene: "rus_ft_war",
      // The factories weren't there: shells come slower than elsewhere.
      terms: [
        { gauge: "shells", delta: 1, every: 4 },
        { gauge: "bread", delta: -1, every: 6, offset: 2 },
      ],
    },
    {
      scene: "rus_ft_total",
      opens: all(atWar, age(12), footingAt(1)),
      // Men and horses off the fields: bread goes fast.
      terms: [
        { gauge: "shells", delta: 1, every: 3 },
        { gauge: "bread", delta: -1, every: 3, offset: 1 },
        { gauge: "order", delta: -1, every: 5, offset: 2 },
      ],
    },
  ],
};

export const RUS_SHORTAGES: readonly GwShortageRow[] = [
  {
    id: "nitrates",
    tag: "RUS",
    // The Straits shut, the Baltic shut, the White Sea frozen half the year.
    when: any(turksIn, age(8)),
    scene: "rus_sh_nitrates",
    drag: [{ gauge: "shells", delta: -1, every: 3 }],
  },
  {
    id: "rubber",
    tag: "RUS",
    when: age(6),
    scene: "rus_sh_rubber",
    drag: [{ gauge: "morale", delta: -1, every: 6, offset: 2 }],
  },
  {
    id: "copper",
    tag: "RUS",
    when: age(10),
    scene: "rus_sh_copper",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 1 }],
  },
  {
    id: "fats",
    tag: "RUS",
    when: all(age(14), { kind: "gauge", gauge: "bread", max: 1 }),
    scene: "rus_sh_fats",
    drag: [{ gauge: "order", delta: -1, every: 4, offset: 2 }],
  },
];

// ---- Scene shapes ----

/** A project's chapter: the last option is what a timer takes. */
const chapter = (
  id: string,
  cast: Readonly<Record<string, GwCastRule>>,
  options: GwOption[],
  tags: GwScene["tags"] = ["home"],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  scheduledOnly: true,
  once: true,
  salience: 6,
  tags,
  cast: { lead: inCharge, ...cast },
  variants: [{ id: "base" }],
  fallback: options[options.length - 1].id,
  options,
});

const outcome = (id: string, tags: GwScene["tags"] = ["home"]): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "wire",
  scheduledOnly: true,
  once: true,
  salience: 6,
  tags,
  cast: { lead: inCharge },
  variants: [{ id: "base" }],
});

const shortagePaper = (
  id: string,
  cast: Readonly<Record<string, GwCastRule>>,
  options: GwOption[],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  scheduledOnly: true,
  once: true,
  salience: 7,
  tags: ["war", "home"],
  cast,
  variants: [{ id: "base" }],
  fallback: "wait",
  options,
});

const labour = (
  id: string,
  when: GwCond,
  cast: Readonly<Record<string, GwCastRule>>,
  options: GwOption[],
  fallback: string,
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  stage: ["war"],
  when: all(throne, footingAt(1), when),
  once: true,
  salience: 5,
  tags: ["home"],
  cast,
  variants: [{ id: "base" }],
  fallback,
  options,
});

const ask = (id: string, next: string, stance: "frank" | "cold") => ({
  id,
  stance,
  kind: "ask" as const,
  tell: [],
  effects: [],
  next,
});

const interior: GwCastRule = {
  any_of: [{ office: "interior" }, { office: "chancellor" }],
};
const agriculture: GwCastRule = {
  any_of: [{ office: "agriculture" }, { office: "finance" }],
};

const PROJECT_SCENES: readonly GwScene[] = [
  // Murmansk: a railway through the swamps to the sea that doesn't freeze.
  chapter("rus_pj_murmansk_prep", { fin: holder("finance") }, [
    o("rails_abroad", push, g("money", -1)),
    o("old_rails", push, inst_("stavka", -1)),
    o("as_is"),
  ]),
  chapter("rus_pj_murmansk_opp", { foe: holder("war") }, [
    o("hold", push, trustOf(role("foe"), -1)),
    o("share", slow, trustOf(role("foe"), 1)),
  ]),
  chapter("rus_pj_murmansk_exec", {}, [
    o("winter", push, g("morale", -1)),
    o("spring"),
  ]),
  outcome("rus_pj_murmansk_done"),
  outcome("rus_pj_murmansk_fail"),
  // The state's own shell works, where the factories weren't.
  chapter(
    "rus_pj_shellworks_prep",
    { fin: holder("finance") },
    [
      o("buy_machines", push, g("money", -1)),
      o("take_engineers", push, opinion("business", -1)),
      o("as_is"),
    ],
    ["war"],
  ),
  chapter(
    "rus_pj_shellworks_opp",
    { foe: { any_of: [{ person: "rus_guchkov" }, { camp: "duma" }] } },
    [
      o("hold", push, opinion("business", -1)),
      o("split", slow, opinion("business", 1)),
    ],
    ["war"],
  ),
  chapter(
    "rus_pj_shellworks_exec",
    {},
    [o("three_shifts", push, opinion("workers", -1)), o("two_shifts")],
    ["war"],
  ),
  outcome("rus_pj_shellworks_done", ["war"]),
  outcome("rus_pj_shellworks_fail", ["war"]),
  // Grain wagons to the capitals.
  chapter("rus_pj_grain_prep", { chief: holder("chief_of_staff") }, [
    o("army_wagons", push, inst_("stavka", -1), trustOf(role("chief"), -1)),
    o("buy_wagons", push, g("money", -1)),
    o("as_is"),
  ]),
  chapter("rus_pj_grain_opp", {}, [
    o("overrule", push, doWorld({ do: "authority", delta: -5 })),
    o("shares"),
  ]),
  chapter("rus_pj_grain_exec", {}, [
    o("night_trains", push, inst_("stavka", -1)),
    o("timetable"),
  ]),
  outcome("rus_pj_grain_done"),
  outcome("rus_pj_grain_fail"),
  // A school in every village.
  chapter("rus_pj_schools_prep", { fin: holder("finance") }, [
    o("teachers_first", push, g("money", -1)),
    o("as_is"),
  ]),
  chapter("rus_pj_schools_opp", { foe: { camp: "court" } }, [
    o("hold", push, inst_("court", -1), trustOf(role("foe"), -1)),
    o("give_church", slow, inst_("court", 1)),
  ]),
  chapter("rus_pj_schools_exec", {}, [
    o("open_all", push, g("money", -1)),
    o("open_ready"),
  ]),
  outcome("rus_pj_schools_done"),
  outcome("rus_pj_schools_fail"),
  // A landing at the Bosphorus.
  chapter(
    "rus_pj_bosphorus_prep",
    { chief: holder("chief_of_staff") },
    [
      o("ask_corps", push, inst_("stavka", -1), trustOf(role("chief"), -1)),
      o("fleet_first"),
    ],
    ["war"],
  ),
  chapter(
    "rus_pj_bosphorus_opp",
    { foe: holder("chief_of_staff") },
    [
      o("hold", push, trustOf(role("foe"), -1)),
      o("defer", slow, trustOf(role("foe"), 1)),
    ],
    ["war"],
  ),
  chapter(
    "rus_pj_bosphorus_exec",
    {},
    [o("on_the_day", push, inst_("stavka", -1)), o("wait_weather")],
    ["war"],
  ),
  outcome("rus_pj_bosphorus_done", ["war"]),
  outcome("rus_pj_bosphorus_fail", ["war"]),
  // The peasants' strips made one field.
  chapter("rus_pj_land_prep", {}, [
    o("more_surveyors", push, g("money", -1)),
    o("as_is"),
  ]),
  chapter(
    "rus_pj_land_opp",
    { foe: { any_of: [{ person: "rus_kerensky" }, { camp: "duma" }] } },
    [o("hold", push, inst_("duma", -1)), o("ease", slow, inst_("duma", 1))],
  ),
  chapter("rus_pj_land_exec", {}, [
    o("before_sowing", push, g("order", -1)),
    o("after_harvest"),
  ]),
  outcome("rus_pj_land_done"),
  outcome("rus_pj_land_fail"),
];

const FOOTING_SCENES: readonly GwScene[] = [
  {
    id: "rus_ft_war",
    nation: ["RUS"],
    kind: "talk",
    big: true,
    scheduledOnly: true,
    once: true,
    salience: 8,
    tags: ["war", "home"],
    cast: {
      war: holder("war"),
      fin: holder("finance"),
      pm: holder("chancellor"),
    },
    who: "war",
    start: "n1",
    variants: [{ id: "base" }],
    nodes: {
      n1: { says: [{ id: "base" }], replies: [ask("owners", "n2", "frank")] },
      n2: {
        who: "fin",
        says: [{ id: "base" }],
        replies: [ask("other_way", "n3", "cold")],
      },
      n3: {
        alone: true,
        says: [{ id: "base" }],
        replies: [decide("call", "n4")],
      },
      n4: {
        who: "pm",
        fallback: "wait",
        says: [{ id: "base" }],
        replies: [decide("raise", null, [footing(1)]), decide("wait", null)],
      },
    },
  },
  {
    id: "rus_ft_total",
    nation: ["RUS"],
    kind: "talk",
    big: true,
    scheduledOnly: true,
    once: true,
    salience: 9,
    tags: ["war", "home"],
    cast: {
      chief: holder("chief_of_staff"),
      agr: agriculture,
      int: interior,
    },
    who: "chief",
    start: "n1",
    variants: [{ id: "base" }],
    nodes: {
      n1: { says: [{ id: "base" }], replies: [ask("fields", "n2", "frank")] },
      n2: {
        who: "agr",
        says: [{ id: "base" }],
        replies: [ask("capital", "n3", "cold")],
      },
      n3: {
        who: "int",
        says: [{ id: "base" }],
        replies: [ask("streets", "n4", "frank")],
      },
      n4: {
        alone: true,
        says: [{ id: "base" }],
        replies: [decide("call", "n5")],
      },
      n5: {
        who: "chief",
        fallback: "wait",
        says: [{ id: "base" }],
        replies: [decide("raise", null, [footing(2)]), decide("wait", null)],
      },
    },
  },
];

const SHORTAGE_SCENES: readonly GwScene[] = [
  shortagePaper(
    "rus_sh_nitrates",
    { war: holder("war"), fin: holder("finance") },
    [
      o("vladivostok", shortage("nitrates", false), g("money", -1)),
      o("mines", shortage("nitrates", false), opinion("business", -1)),
      o("wait"),
    ],
  ),
  shortagePaper(
    "rus_sh_rubber",
    { war: holder("war"), fm: holder("foreign") },
    [
      o("london", shortage("rubber", false), g("money", -1)),
      o("seize", shortage("rubber", false), opinion("business", -1)),
      o("wait"),
    ],
  ),
  shortagePaper(
    "rus_sh_copper",
    { war: holder("war"), fin: holder("finance") },
    [
      o("buy_us", shortage("copper", false), g("money", -1)),
      o("collect", shortage("copper", false), g("order", -1)),
      o("wait"),
    ],
  ),
  shortagePaper("rus_sh_fats", { agr: agriculture, int: interior }, [
    o("meatless", shortage("fats", false), g("morale", -1)),
    o("price", shortage("fats", false), opinion("business", -1)),
    o("wait"),
  ]),
];

const LABOUR_SCENES: readonly GwScene[] = [
  labour(
    "rus_lb_women",
    age(8),
    { war: holder("war"), int: interior },
    [
      o("night", opinion("workers", -1), manpower(2)),
      o("same_pay", opinion("workers", 1), opinion("business", -1)),
      o("owners"),
    ],
    "owners",
  ),
  labour(
    "rus_lb_unions",
    all(age(4), { kind: "bloc", bloc: "workers", max: 0 }),
    { int: interior, war: holder("war") },
    [
      o("open", opinion("workers", 2), inst_("court", -1)),
      o("watched", opinion("workers", 1)),
      o("refuse", opinion("workers", -1), inst_("court", 1)),
    ],
    "watched",
  ),
  labour(
    "rus_lb_strike",
    all(age(6), { kind: "bloc", bloc: "workers", max: -1 }),
    { war: holder("war"), int: interior },
    [
      o(
        "sequester",
        opinion("workers", 1),
        opinion("business", -1),
        g("money", -1),
      ),
      o("draft", opinion("workers", -2), manpower(1)),
      o("table", opinion("workers", 1), g("shells", -1)),
    ],
    "table",
  ),
  labour(
    "rus_lb_prices",
    all(age(10), { kind: "gauge", gauge: "bread", max: 1 }),
    { fin: holder("finance"), int: interior },
    [
      o("canteens", opinion("workers", 1), g("bread", -1)),
      o("bonus", opinion("workers", 1), g("money", -1)),
      o("market", opinion("workers", -1)),
    ],
    "market",
  ),
];

/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const RUS_CRAFT_SCENES: readonly GwScene[] = [
  ...PROJECT_SCENES,
  ...FOOTING_SCENES,
  ...SHORTAGE_SCENES,
  ...LABOUR_SCENES,
];
