import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwStage,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwReply,
  GwScene,
  GwStance,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  decide,
  flag,
  not,
  role,
  setFlag,
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
  short,
  shortage,
} from "./kit";

// GBR's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/GBR.craft.json. Inventors and the people of the labour
// scenes are pack-only (`gbr_i_*`); Hankey keeps his cabinet id.

const NATION: GwScene["nation"] = ["GBR"];
const Y14_ON: GwStage[] = ["y1914", "war"];

const war = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });
const shipping = (min: number): GwCond => world({ is: "shipping", min });
const trenches = world({
  is: "era",
  of: ["trenches", "material", "depth", "storm"],
});
const workersAt = (max: number): GwCond => ({
  kind: "bloc",
  bloc: "workers",
  max,
});

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const ifShort = (id: Parameters<typeof short>[0]): GwEffect => ({
  kind: "maybe",
  when: short(id),
  then: [shortage(id, false)],
});
const lead = role("lead");

/** A cast role that always finds someone: the office, else the favourite. */
type OneRule = Exclude<GwCastRule, { any_of: unknown }>;
const office = (o: GwOffice): OneRule => ({ office: o });
const orFavourite = (...rules: OneRule[]): GwCastRule => ({
  any_of: [...rules, { favourite: true }],
});
const munitions = orFavourite(office("munitions"), office("finance"));
const labour = orFavourite({ person: "gbr_henderson" }, { camp: "labour" });

const opt = (id: string, effects: GwEffect[] = []): GwOption => ({
  id,
  tell: [],
  effects,
});
const go = (id: string, next: string, stance: GwStance = "frank"): GwReply => ({
  id,
  stance,
  kind: "ask",
  tell: [],
  effects: [],
  next,
});

// ---- Inventions ----

export const GBR_INVENTIONS: readonly GwInventionRow[] = [
  {
    id: "gbr_inv_tank",
    tag: "GBR",
    inventor: "gbr_i_swinton",
    opens: all(war, trenches),
    against: "army",
    price: 10,
    build: 4,
    trial: 55,
    ripe: 3,
    edge: { theatres: ["west"], attack: 10 },
    tech: "tanks",
    cast: { navy: orFavourite(office("navy")) },
  },
  {
    id: "gbr_inv_stokes",
    tag: "GBR",
    inventor: "gbr_i_stokes",
    opens: all(war, trenches, warAge(4)),
    against: "army",
    price: 10,
    build: 2,
    trial: 65,
    ripe: 2,
    edge: { theatres: ["west"], attack: 5, defence: 3 },
  },
  {
    id: "gbr_inv_acetone",
    tag: "GBR",
    inventor: "gbr_i_weizmann",
    opens: all(war, warAge(5)),
    build: 3,
    trial: 60,
    ripe: 1,
    fielded: [gauge("shells", 1)],
    cast: { fin: munitions },
  },
  {
    id: "gbr_inv_sound",
    tag: "GBR",
    inventor: "gbr_i_bragg",
    opens: all(war, trenches, warAge(8)),
    build: 3,
    trial: 55,
    ripe: 3,
    edge: { theatres: ["west"], attack: 4, defence: 4 },
    tech: "predicted_fire",
  },
  {
    id: "gbr_inv_hydro",
    tag: "GBR",
    inventor: "gbr_i_rutherford",
    opens: all(war, shipping(1)),
    build: 4,
    trial: 45,
    ripe: 2,
    edge: { theatres: ["sea"], defence: 6 },
    fielded: [doWorld({ do: "shipping", delta: -1 })],
  },
  {
    id: "gbr_inv_convoy",
    tag: "GBR",
    inventor: "gbr_hankey",
    opens: all(war, shipping(4)),
    build: 2,
    trial: 60,
    ripe: 1,
    edge: { theatres: ["sea"], defence: 8 },
    tech: "convoys",
    fielded: [doWorld({ do: "shipping", delta: -2 })],
    cast: { sea: orFavourite(office("sea_lord"), office("navy")) },
  },
];

// ---- The year's project ----

export const GBR_PROJECTS: readonly GwProjectRow[] = [
  {
    id: "gbr_pj_oil",
    tag: "GBR",
    lead: orFavourite(office("navy")),
    odds: 60,
    aims: ["gbr_aim_sea"],
    start: [gauge("money", -1)],
    done: [doWorld({ do: "blockade", delta: 1 }), opinion("business", 1)],
    failed: [opinion("parliament", -1)],
  },
  {
    id: "gbr_pj_gretna",
    tag: "GBR",
    opens: war,
    lead: munitions,
    odds: 50,
    aims: ["gbr_aim_win"],
    start: [gauge("money", -1)],
    done: [gauge("shells", 1), opinion("workers", 1)],
    failed: [opinion("press", -1)],
    terms: FACTORY,
  },
  {
    id: "gbr_pj_ireland",
    tag: "GBR",
    opens: not(flag("f_ireland_settled")),
    lead: orFavourite(office("ireland")),
    odds: 35,
    aims: ["gbr_aim_ireland"],
    months: 3,
    start: [inst("irish", 1)],
    done: [setFlag("f_ireland_settled"), inst("irish", 1)],
    failed: [inst("irish", -1)],
  },
  {
    id: "gbr_pj_empire",
    tag: "GBR",
    opens: all(war, warAge(12)),
    lead: orFavourite(office("foreign")),
    odds: 55,
    aims: ["gbr_aim_win"],
    start: [inst("cabinet", -1)],
    done: [men(3), opinion("press", 1)],
    failed: [opinion("parliament", -1)],
  },
  {
    id: "gbr_pj_vote",
    tag: "GBR",
    opens: all(war, warAge(18)),
    lead: orFavourite(office("interior")),
    odds: 50,
    aims: ["gbr_aim_liberal"],
    start: [inst("opposition", 1)],
    done: [opinion("workers", 1), gauge("order", 1)],
    failed: [opinion("workers", -1)],
  },
  {
    id: "gbr_pj_plough",
    tag: "GBR",
    opens: all(war, shipping(3)),
    lead: orFavourite({ camp: "unionist" }, office("interior")),
    odds: 55,
    aims: ["gbr_aim_sea", "gbr_aim_win"],
    start: [gauge("money", -1)],
    done: [gauge("bread", 1)],
    failed: [opinion("business", -1)],
  },
];

// ---- Footing: to the war economy, to total mobilisation ----

export const GBR_FOOTING: GwFootingRow = {
  tag: "GBR",
  steps: [
    { scene: "gbr_ft_war" },
    { scene: "gbr_ft_total", opens: all(warAge(12), footingAt(1)) },
  ],
};

// ---- Shortages ----

export const GBR_SHORTAGES: readonly GwShortageRow[] = [
  {
    id: "nitrates",
    tag: "GBR",
    when: shipping(3),
    scene: "gbr_sh_nitrates",
    drag: [{ gauge: "shells", delta: -1, every: 3 }],
  },
  {
    id: "copper",
    tag: "GBR",
    when: warAge(14),
    scene: "gbr_sh_copper",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 2 }],
  },
  {
    id: "fats",
    tag: "GBR",
    when: shipping(5),
    scene: "gbr_sh_fats",
    drag: [{ gauge: "bread", delta: -1, every: 4, offset: 1 }],
  },
];

// ---- Scenes ----

const base = [{ id: "base" }];

/** A project chapter: the lead is cast as the person who came. */
const chapter = (
  id: string,
  options: GwOption[],
  cast: GwScene["cast"] = {},
  tags: GwScene["tags"] = ["home"],
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  scheduledOnly: true,
  once: true,
  salience: 6,
  tags,
  cast: { lead: inCharge, ...cast },
  variants: base,
  fallback: options[0].id,
  options,
});

/** How it ended: a paper to read. */
const ending = (id: string, tags: GwScene["tags"] = ["home"]): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  scheduledOnly: true,
  once: true,
  salience: 6,
  tags,
  cast: { lead: inCharge },
  variants: base,
});

const push = project("push");
const slow = project("slow");

const PROJECT_SCENES: GwScene[] = [
  // Anglo-Persian oil: the fleet's fuel from a company the state half owns.
  chapter("gbr_pj_oil_prep", [
    opt("buy_half", [push, gauge("money", -1)]),
    opt("contract", [trustOf(lead, -1)]),
  ]),
  chapter(
    "gbr_pj_oil_opp",
    [
      opt("face_house", [push, inst("commons", -1)]),
      opt("share_shell", [slow, opinion("business", 1)]),
    ],
    { foe: orFavourite({ camp: "unionist" }) },
  ),
  chapter("gbr_pj_oil_exec", [
    opt("guard_pipe", [push, men(-1)]),
    opt("trust_company", [slow]),
  ]),
  ending("gbr_pj_oil_done"),
  ending("gbr_pj_oil_fail"),
  // Gretna: a cordite town built from a bare field on the border.
  chapter(
    "gbr_pj_gretna_prep",
    [
      opt("whole_town", [push, gauge("money", -1)]),
      opt("huts", [opinion("workers", -1)]),
    ],
    {},
    ["war"],
  ),
  chapter(
    "gbr_pj_gretna_opp",
    [
      opt("women_in", [push, opinion("workers", -1)]),
      opt("wait_men", [slow, opinion("workers", 1)]),
    ],
    { lab: labour },
    ["war"],
  ),
  chapter(
    "gbr_pj_gretna_exec",
    [opt("full_speed", [push, gauge("order", -1)]), opt("safety", [slow])],
    {},
    ["war"],
  ),
  ending("gbr_pj_gretna_done", ["war"]),
  ending("gbr_pj_gretna_fail", ["war"]),
  // The Irish Convention: Irishmen in one room to write their own settlement.
  chapter("gbr_pj_ireland_prep", [
    opt("all_parties", [push, inst("opposition", 1)]),
    opt("moderates", [slow, inst("irish", 1)]),
  ]),
  chapter(
    "gbr_pj_ireland_opp",
    [
      opt("press_ulster", [push, inst("opposition", 1)]),
      opt("leave_ulster", [slow, inst("irish", -1)]),
    ],
    { foe: orFavourite({ person: "gbr_carson" }, { camp: "unionist" }) },
  ),
  chapter("gbr_pj_ireland_exec", [
    opt("sign_now", [push, inst("cabinet", -1)]),
    opt("more_time", [slow, inst("irish", 1)]),
  ]),
  ending("gbr_pj_ireland_done"),
  ending("gbr_pj_ireland_fail"),
  // The Imperial War Cabinet: the dominions' prime ministers at the table.
  chapter(
    "gbr_pj_empire_prep",
    [opt("full_seats", [push, inst("cabinet", -1)]), opt("guests", [slow])],
    {},
    ["foreign"],
  ),
  chapter(
    "gbr_pj_empire_opp",
    [
      opt("promise_say", [push, inst("opposition", -1)]),
      opt("keep_london", [slow, inst("opposition", 1)]),
    ],
    {},
    ["foreign"],
  ),
  chapter(
    "gbr_pj_empire_exec",
    [opt("open_papers", [push, trustOf(lead, 1)]), opt("war_only", [slow])],
    {},
    ["foreign"],
  ),
  ending("gbr_pj_empire_done", ["foreign"]),
  ending("gbr_pj_empire_fail", ["foreign"]),
  // The franchise: every man who serves, and women for the first time.
  chapter("gbr_pj_vote_prep", [
    opt("speaker", [push, inst("opposition", 1)]),
    opt("cabinet_bill", [slow, inst("cabinet", 1)]),
  ]),
  chapter(
    "gbr_pj_vote_opp",
    [
      opt("women_too", [push, opinion("parliament", -1)]),
      opt("men_first", [slow, opinion("workers", -1)]),
    ],
    { foe: orFavourite({ camp: "unionist" }) },
  ),
  chapter("gbr_pj_vote_exec", [
    opt("free_vote", [push]),
    opt("whip", [slow, inst("commons", -1)]),
  ]),
  ending("gbr_pj_vote_done"),
  ending("gbr_pj_vote_fail"),
  // The plough campaign: grass back to wheat, at a price the state guarantees.
  chapter(
    "gbr_pj_plough_prep",
    [opt("guarantee", [push, gauge("money", -1)]), opt("ask_farmers", [slow])],
    {},
    ["war"],
  ),
  chapter(
    "gbr_pj_plough_opp",
    [
      opt("wage_floor", [push, opinion("business", -1), opinion("workers", 1)]),
      opt("no_wage", [slow, opinion("workers", -1)]),
    ],
    {},
    ["war"],
  ),
  chapter(
    "gbr_pj_plough_exec",
    [
      opt("land_army", [push, men(-1)]),
      opt("soldiers_home", [push, men(-2)]),
      opt("as_is", [slow]),
    ],
    {},
    ["war"],
  ),
  ending("gbr_pj_plough_done", ["war"]),
  ending("gbr_pj_plough_fail", ["war"]),
];

/** The two footing steps, each a big scene the country tab calls. */
const FOOTING_SCENES: GwScene[] = [
  {
    id: "gbr_ft_war",
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["war", "home"],
    cast: { mun: munitions, lab: labour },
    who: "mun",
    start: "n1",
    variants: base,
    nodes: {
      n1: {
        alone: true,
        says: [
          { id: "again", when: { kind: "seen", scene: "gbr_ft_war" } },
          { id: "base" },
        ],
        replies: [decide("open", "n2")],
      },
      n2: {
        who: "mun",
        says: base,
        replies: [go("ask_men", "n3"), go("ask_owners", "n3", "cold")],
      },
      n3: {
        who: "lab",
        says: base,
        replies: [go("ask_terms", "n4", "warm")],
      },
      n4: {
        who: "mun",
        fallback: "wait",
        says: base,
        replies: [
          decide("raise", null, [footing(1)]),
          decide("raise_deal", null, [
            footing(1),
            opinion("workers", 1),
            opinion("business", -1),
          ]),
          decide("wait", null),
        ],
      },
    },
  },
  {
    id: "gbr_ft_total",
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["war", "home"],
    cast: {
      mun: munitions,
      cos: orFavourite(office("chief_of_staff"), office("war")),
      lab: labour,
    },
    who: "mun",
    start: "n1",
    variants: base,
    nodes: {
      n1: {
        alone: true,
        says: [
          { id: "again", when: { kind: "seen", scene: "gbr_ft_total" } },
          { id: "base" },
        ],
        replies: [decide("open", "n2")],
      },
      n2: {
        who: "cos",
        says: base,
        replies: [go("ask_how_many", "n3", "cold")],
      },
      n3: {
        who: "mun",
        says: base,
        replies: [go("ask_state", "n4")],
      },
      n4: {
        who: "lab",
        says: base,
        replies: [go("ask_price", "n5", "warm"), go("hard", "n5", "threat")],
      },
      n5: {
        who: "mun",
        fallback: "wait",
        says: base,
        replies: [
          decide("raise", null, [footing(2)]),
          decide("raise_men", null, [
            footing(2),
            men(3),
            opinion("workers", -1),
          ]),
          decide("wait", null),
        ],
      },
    },
  },
];

const event = (
  id: string,
  options: GwOption[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  once: true,
  salience: 6,
  tags: ["war", "home"],
  cast: {},
  variants: base,
  fallback: options[options.length - 1].id,
  options,
  ...more,
});

const SHORTAGE_SCENES: GwScene[] = [
  event(
    "gbr_sh_nitrates",
    [
      opt("charter", [shortage("nitrates", false), gauge("money", -1)]),
      opt("ships_first", [shortage("nitrates", false), gauge("bread", -1)]),
      opt("bear_it"),
    ],
    { scheduledOnly: true, cast: { sea: orFavourite(office("navy")) } },
  ),
  event(
    "gbr_sh_copper",
    [
      opt("sell_shares", [shortage("copper", false), gauge("money", -1)]),
      opt("salvage", [shortage("copper", false), gauge("morale", -1)]),
      opt("bear_it"),
    ],
    { scheduledOnly: true, cast: { fin: orFavourite(office("finance")) } },
  ),
  event(
    "gbr_sh_fats",
    [
      opt("ration", [shortage("fats", false), gauge("order", -1)]),
      opt("market", [opinion("workers", -1)]),
    ],
    { scheduledOnly: true, cast: { home: orFavourite(office("interior")) } },
  ),
  // Trade with the neutrals: buying what Germany would buy.
  event(
    "gbr_sh_neutral",
    [
      opt("buy_all", [
        gauge("money", -1),
        doWorld({ do: "blockade", delta: 1 }),
        ifShort("fats"),
      ]),
      opt("coal_lever", [doWorld({ do: "blockade", delta: 1 })]),
      opt("let_trade"),
    ],
    {
      stage: Y14_ON,
      when: all(war, any(short("fats"), world({ is: "blockade", min: 3 }))),
      cast: { fm: orFavourite(office("foreign")) },
      tags: ["war", "foreign"],
    },
  ),
  // Dollars: everything America sells is paid in them.
  event(
    "gbr_sh_dollars",
    [
      opt("morgan", [
        gauge("money", 1),
        { kind: "trust", tag: "USA", delta: 1 },
        ifShort("copper"),
      ]),
      opt("gold", [ifShort("copper"), opinion("business", -1)]),
      opt("cut_orders", [gauge("shells", -1), gauge("money", 1)]),
    ],
    {
      stage: Y14_ON,
      when: all(war, warAge(20)),
      cast: { fin: orFavourite(office("finance")) },
      tags: ["war", "foreign"],
    },
  ),
];

const LABOUR_SCENES: GwScene[] = [
  // Women into the shell shops.
  event(
    "gbr_lb_women",
    [
      opt("equal_rate", [opinion("workers", 1), opinion("business", -1)]),
      opt("open_doors", [men(2), opinion("workers", -1)]),
      opt("slow"),
    ],
    {
      kind: "audience",
      stage: Y14_ON,
      when: all(footingAt(1), warAge(4)),
      cast: { who: outsider("gbr_i_pankhurst"), lab: labour },
      tags: ["home", "people"],
    },
  ),
  // The South Wales coalfield: the fleet's coal.
  event(
    "gbr_lb_coal",
    [
      opt("go_cardiff", [opinion("workers", 1), gauge("money", -1)]),
      opt("enforce_act", [opinion("workers", -2), gauge("order", -1)]),
      opt("take_mines", [opinion("business", -1), opinion("workers", 1)]),
    ],
    {
      stage: Y14_ON,
      when: all(footingAt(1), warAge(8)),
      cast: { mun: munitions, lab: labour },
    },
  ),
  // The Clyde: rents, shop stewards, dilution.
  event(
    "gbr_lb_clyde",
    [
      opt("rent_act", [opinion("workers", 1), opinion("business", -1)]),
      opt("deport", [opinion("workers", -1), gauge("order", 1)]),
      opt("go_glasgow", [trustOf(role("mun"), 1)]),
    ],
    {
      stage: Y14_ON,
      when: all(footingAt(1), workersAt(-1)),
      cast: {
        mun: munitions,
        steward: outsider("gbr_i_kirkwood"),
        tenant: outsider("gbr_i_barbour"),
      },
    },
  ),
  // The May strikes: the engineers come out.
  event(
    "gbr_lb_may",
    [
      opt("inquiry", [opinion("workers", 1), gauge("shells", -1)]),
      opt("arrest", [opinion("workers", -2), gauge("order", -1)]),
      opt("card_back", [opinion("workers", 1), men(-2)]),
    ],
    {
      stage: Y14_ON,
      when: all(footingAt(2), any(workersAt(-2), warAge(30))),
      cast: { mun: munitions, lab: labour },
    },
  ),
];

/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const GBR_CRAFT_SCENES: readonly GwScene[] = [
  ...PROJECT_SCENES,
  ...FOOTING_SCENES,
  ...SHORTAGE_SCENES,
  ...LABOUR_SCENES,
];
