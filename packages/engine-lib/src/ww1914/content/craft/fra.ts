// France's statecraft (ww157 shapes, CraftRows.ts; words in ./kit.ts). Text in
// resources/ww1914/ko/FRA.craft.json. Lane W7 (ww166-format.md). Inventors
// and the people of the labour scenes are pack-only (`fra_i_*`); cabinet
// people keep their ids. The colonial levy's cost in West Africa is a record
// card only (plan §11.3, §17.2): no option makes a levy harsher or pays for it.
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
  memory,
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
  FACTORY,
  footing,
  footingAt,
  inCharge,
  outsider,
  project,
  projectAt,
  short,
  shortage,
} from "./kit";

const NATION: GwScene["nation"] = ["FRA"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR_ON: GwStage[] = ["war"];

const war = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });
const trenches = world({
  is: "era",
  of: ["trenches", "material", "depth", "storm"],
});
/** The Germans stand inside France's north: the mines and mills behind them. */
const northLost = world({
  is: "front",
  theatre: "west",
  from: "hindenburg",
  to: "paris",
});
const uboats = world({ is: "uboat", min: 1 });
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
const britain = (delta: number): GwEffect => ({
  kind: "trust",
  tag: "GBR",
  delta,
});
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const westForce = (delta: number): GwEffect =>
  doWorld({ do: "force", tag: "FRA", theatre: "west", delta });
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
const munitions = orFavourite(office("munitions"), office("war"));
const labour = orFavourite({ person: "fra_jouhaux" }, { camp: "socialist" });

const opt = (id: string, effects: GwEffect[] = [], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };
const go = (id: string, next: string, stance: GwStance = "frank"): GwReply => ({
  id,
  stance,
  kind: "ask",
  tell: [],
  effects: [],
  next,
});

// ---- Inventions ----

export const FRA_INVENTIONS: readonly GwInventionRow[] = [
  {
    id: "fra_inv_helmet",
    tag: "FRA",
    inventor: "fra_i_adrian",
    opens: all(war, trenches),
    build: 2,
    trial: 70,
    ripe: 2,
    edge: { theatres: ["west"], defence: 6 },
    fielded: [gauge("morale", 1)],
    cast: { war: orFavourite(office("war")) },
    // Messimy talked of the uniform in July (fra_t_messimy_trousers, W1).
    variants: [{ id: "uniform", when: memory("k_mes_uniform") }],
  },
  {
    id: "fra_inv_xray",
    tag: "FRA",
    inventor: "fra_i_curie",
    opens: war,
    against: "army",
    price: 10,
    build: 2,
    trial: 65,
    ripe: 1,
    fielded: [men(2), gauge("morale", 1)],
    cast: { war: orFavourite(office("war")) },
  },
  {
    id: "fra_inv_tank",
    tag: "FRA",
    inventor: "fra_i_estienne",
    opens: all(war, trenches, warAge(18)),
    against: "army",
    price: 10,
    build: 4,
    trial: 50,
    ripe: 3,
    edge: { theatres: ["west"], attack: 10 },
    tech: "tanks",
    cast: {
      ren: outsider("fra_i_renault"),
      cos: orFavourite(office("chief_of_staff"), office("war")),
    },
  },
  {
    id: "fra_inv_sonar",
    tag: "FRA",
    inventor: "fra_i_langevin",
    opens: all(war, uboats),
    build: 5,
    trial: 40,
    ripe: 2,
    edge: { theatres: ["sea"], defence: 6 },
    fielded: [doWorld({ do: "shipping", delta: -1 })],
    cast: { navy: orFavourite(office("navy")) },
  },
  {
    id: "fra_inv_cipher",
    tag: "FRA",
    inventor: "fra_i_painvin",
    opens: all(war, warAge(30)),
    build: 2,
    trial: 45,
    ripe: 1,
    edge: { theatres: ["west"], defence: 8 },
    cast: { cos: orFavourite(office("chief_of_staff"), office("war")) },
  },
  {
    id: "fra_inv_spad",
    tag: "FRA",
    inventor: "fra_i_birkigt",
    opens: all(war, warAge(8)),
    build: 3,
    trial: 60,
    ripe: 2,
    edge: { theatres: ["west"], attack: 4, defence: 4 },
    cast: {
      bech: outsider("fra_i_bechereau"),
      war: orFavourite(office("war")),
    },
  },
];

// ---- The year's project ----

export const FRA_PROJECTS: readonly GwProjectRow[] = [
  {
    id: "fra_pj_voie",
    tag: "FRA",
    opens: all(war, trenches, warAge(12)),
    lead: orFavourite(office("war"), office("chief_of_staff")),
    odds: 55,
    start: [gauge("money", -1)],
    done: [westForce(1), gauge("morale", 1)],
    failed: [gauge("morale", -1)],
  },
  {
    id: "fra_pj_shells",
    tag: "FRA",
    opens: war,
    lead: munitions,
    odds: 50,
    start: [gauge("money", -1)],
    done: [gauge("shells", 1), opinion("business", 1)],
    failed: [opinion("press", -1)],
    terms: FACTORY,
  },
  {
    id: "fra_pj_loan",
    tag: "FRA",
    opens: all(war, warAge(10)),
    lead: orFavourite(office("finance")),
    odds: 60,
    start: [opinion("press", 1)],
    done: [gauge("money", 1), gauge("morale", 1)],
    failed: [opinion("business", -1)],
  },
  {
    id: "fra_pj_colonial",
    tag: "FRA",
    lead: orFavourite(office("war"), office("interior")),
    odds: 50,
    months: 3,
    start: [inst("chamber", -1)],
    done: [men(3)],
    failed: [opinion("parliament", -1)],
  },
  {
    id: "fra_pj_north",
    tag: "FRA",
    opens: all(war, northLost),
    lead: orFavourite(office("interior")),
    odds: 50,
    start: [gauge("money", -1)],
    done: [gauge("morale", 1), opinion("press", 1)],
    failed: [gauge("morale", -1)],
  },
  {
    id: "fra_pj_bread",
    tag: "FRA",
    opens: war,
    lead: orFavourite(office("agriculture"), office("interior")),
    odds: 55,
    start: [gauge("money", -1)],
    done: [gauge("bread", 1)],
    failed: [opinion("workers", -1)],
  },
];

// ---- Footing: to the war economy, to total mobilisation ----

export const FRA_FOOTING: GwFootingRow = {
  tag: "FRA",
  steps: [
    { scene: "fra_ft_war" },
    { scene: "fra_ft_total", opens: all(warAge(24), footingAt(1)) },
  ],
};

// ---- Shortages ----

export const FRA_SHORTAGES: readonly GwShortageRow[] = [
  {
    id: "coal",
    tag: "FRA",
    when: northLost,
    scene: "fra_sh_coal",
    drag: [
      { gauge: "shells", delta: -1, every: 4 },
      { gauge: "morale", delta: -1, every: 6, offset: 3 },
    ],
  },
  {
    id: "nitrates",
    tag: "FRA",
    when: any(uboats, warAge(10)),
    scene: "fra_sh_nitrates",
    drag: [{ gauge: "shells", delta: -1, every: 3 }],
  },
  {
    id: "fats",
    tag: "FRA",
    when: warAge(20),
    scene: "fra_sh_fats",
    drag: [{ gauge: "bread", delta: -1, every: 4, offset: 1 }],
  },
];

// ---- Scenes ----

const base = [{ id: "base" }];
type Place = NonNullable<GwScene["place"]>;
const at = (place?: Place): Partial<GwScene> =>
  place === undefined ? {} : { place };

/** A project chapter: the lead is cast as the person who came. */
const chapter = (
  id: string,
  options: GwOption[],
  cast: GwScene["cast"] = {},
  tags: GwScene["tags"] = ["war", "home"],
  place?: Place,
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
  ...at(place),
});

/** How it ended: a paper to read. */
const ending = (
  id: string,
  tags: GwScene["tags"] = ["war", "home"],
  place?: Place,
): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  scheduledOnly: true,
  once: true,
  salience: 6,
  tags,
  cast: { lead: inCharge },
  variants: base,
  ...at(place),
});

const push = project("push");
const slow = project("slow");

const PROJECT_SCENES: GwScene[] = [
  // The Voie sacrée: the one road from Bar-le-Duc to Verdun, for lorries only.
  chapter(
    "fra_pj_voie_prep",
    [opt("road_only", [push]), opt("share_road", [slow])],
    { doumenc: outsider("fra_i_doumenc") },
    ["war"],
    "bar_le_duc",
  ),
  chapter(
    "fra_pj_voie_opp",
    [
      opt("take_lorries", [push, opinion("business", -1)]),
      opt("borrow_lorries", [slow]),
    ],
    {},
    ["war"],
    "bar_le_duc",
  ),
  chapter(
    "fra_pj_voie_exec",
    [
      opt("stone_crews", [push, men(-1)]),
      // Pétain's road, from his talk (fra_t_petain_verdun, W2).
      opt("petain_way", [push, trustOf(lead, 1)], memory("k_pet_road")),
      opt("as_it_goes", [slow]),
    ],
    {},
    ["war"],
    "verdun",
  ),
  ending("fra_pj_voie_done", ["war"], "verdun"),
  ending("fra_pj_voie_fail", ["war"], "verdun"),
  // Citroën's shell works on the Javel market gardens.
  chapter(
    "fra_pj_shells_prep",
    [
      opt("advance", [push, gauge("money", -1)]),
      opt("pay_per_shell", [trustOf(lead, -1)]),
    ],
    { cit: outsider("fra_i_citroen") },
    ["war", "home"],
    "paris",
  ),
  chapter(
    "fra_pj_shells_opp",
    [
      opt("steel_to_javel", [push, opinion("business", -1)]),
      opt("share_steel", [slow, opinion("business", 1)]),
    ],
    { cit: outsider("fra_i_citroen") },
    ["war", "home"],
    "paris",
  ),
  chapter(
    "fra_pj_shells_exec",
    [
      opt("three_shifts", [push, opinion("workers", -1)]),
      opt("two_shifts", [slow, opinion("workers", 1)]),
    ],
    {},
    ["war", "home"],
    "paris",
  ),
  ending("fra_pj_shells_done", ["war", "home"], "paris"),
  ending("fra_pj_shells_fail", ["war", "home"], "paris"),
  // The defence loan: a rente sold to every saver in the country.
  chapter(
    "fra_pj_loan_prep",
    [opt("perpetual", [push]), opt("short_bonds", [slow])],
    {},
    ["home"],
  ),
  chapter(
    "fra_pj_loan_opp",
    [
      opt("banks_sell", [push, opinion("workers", -1)]),
      opt("tax_first", [slow, opinion("workers", 1), opinion("business", -1)]),
    ],
    { left: labour },
    ["home"],
  ),
  chapter(
    "fra_pj_loan_exec",
    [opt("gold_drive", [push, opinion("press", 1)]), opt("quiet_sale", [slow])],
    {},
    ["home"],
  ),
  ending("fra_pj_loan_done", ["home"]),
  ending("fra_pj_loan_fail", ["home"]),
  // Recruitment in West Africa, on Diagne's terms or the governors'.
  chapter(
    "fra_pj_colonial_prep",
    [
      opt("diagne_terms", [push, inst("chamber", -1)]),
      opt("governors_only", [slow]),
    ],
    { dia: outsider("fra_i_diagne") },
    ["home", "people"],
    "dakar",
  ),
  chapter(
    "fra_pj_colonial_opp",
    [
      opt("back_deputy", [push, trustOf(lead, -1)]),
      opt("hear_governor", [slow]),
    ],
    { dia: outsider("fra_i_diagne") },
    ["home", "people"],
    "dakar",
  ),
  chapter(
    "fra_pj_colonial_exec",
    [
      opt("terms_in_law", [push, inst("chamber", -1)]),
      opt("terms_in_letter", [slow]),
    ],
    { dia: outsider("fra_i_diagne") },
    ["home", "people"],
    "dakar",
  ),
  ending("fra_pj_colonial_done", ["home", "people"], "dakar"),
  ending("fra_pj_colonial_fail", ["home", "people"], "dakar"),
  // Food for the occupied north, carried in by a neutral commission.
  chapter(
    "fra_pj_north_prep",
    [
      opt("pay_commission", [push, gauge("money", -1)]),
      opt("ask_allies", [slow]),
    ],
    {},
    ["war", "home"],
    "lille",
  ),
  chapter(
    "fra_pj_north_opp",
    [
      opt("guarantees", [push, inst("army", -1)]),
      opt("army_view", [slow, inst("army", 1)]),
    ],
    { cos: orFavourite(office("chief_of_staff"), office("war")) },
    ["war", "home"],
    "lille",
  ),
  chapter(
    "fra_pj_north_exec",
    [opt("evian", [push, gauge("money", -1)]), opt("food_only", [slow])],
    {},
    ["war", "home"],
    "lille",
  ),
  ending("fra_pj_north_done", ["war", "home"], "lille"),
  ending("fra_pj_north_fail", ["war", "home"], "lille"),
  // Bread: the state buying the wheat the empty fields can't give.
  chapter(
    "fra_pj_bread_prep",
    [opt("state_buys", [push, gauge("money", -1)]), opt("millers_buy", [slow])],
    {},
    ["home"],
  ),
  chapter(
    "fra_pj_bread_opp",
    [
      opt("set_price", [push, opinion("parliament", -1)]),
      opt("farm_price", [slow, opinion("parliament", 1)]),
    ],
    { farm: orFavourite(office("agriculture"), { camp: "radical" }) },
    ["home"],
  ),
  chapter(
    "fra_pj_bread_exec",
    [
      opt("pool_london", [push, britain(1)]),
      opt("own_ships", [slow, gauge("money", -1)]),
    ],
    {},
    ["home", "foreign"],
  ),
  ending("fra_pj_bread_done", ["home"]),
  ending("fra_pj_bread_fail", ["home"]),
];

/** The two footing steps, each a big scene the country tab calls. */
const FOOTING_SCENES: GwScene[] = [
  {
    id: "fra_ft_war",
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["war", "home"],
    cast: {
      war: orFavourite(office("war")),
      fin: orFavourite(office("finance")),
      lab: labour,
    },
    who: "war",
    start: "n1",
    variants: base,
    nodes: {
      n1: {
        alone: true,
        says: [
          { id: "again", when: { kind: "seen", scene: "fra_ft_war" } },
          // The government went south (fra_big_bordeaux, W1).
          { id: "bordeaux", when: flag("f_gov_bordeaux") },
          { id: "base" },
        ],
        replies: [decide("open", "n2")],
      },
      n2: {
        who: "war",
        says: base,
        replies: [go("ask_arsenals", "n3", "cold"), go("ask_makers", "n3")],
      },
      n3: {
        who: "fin",
        says: base,
        replies: [go("ask_money", "n4")],
      },
      n4: {
        who: "lab",
        says: base,
        replies: [
          go("ask_hands", "n5", "warm"),
          go("ask_strikes", "n5", "cold"),
        ],
      },
      n5: {
        who: "war",
        fallback: "wait",
        says: base,
        replies: [
          decide("raise", null, [footing(1)]),
          decide("raise_hands", null, [
            footing(1),
            men(-2),
            opinion("workers", 1),
          ]),
          decide("wait", null),
        ],
      },
    },
  },
  {
    id: "fra_ft_total",
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
          { id: "again", when: { kind: "seen", scene: "fra_ft_total" } },
          { id: "base" },
        ],
        replies: [decide("open", "n2")],
      },
      n2: {
        who: "cos",
        says: base,
        replies: [go("ask_what", "n3", "cold")],
      },
      n3: {
        who: "mun",
        says: base,
        replies: [go("ask_how", "n4"), go("ask_allies", "n4", "cold")],
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
          decide("raise_terms", null, [
            footing(2),
            opinion("workers", 1),
            opinion("business", -1),
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
    "fra_sh_coal",
    [
      opt("buy_british", [shortage("coal", false), gauge("money", -1)]),
      opt("dig_south", [shortage("coal", false), opinion("workers", -1)]),
      opt("bear_it"),
    ],
    {
      scheduledOnly: true,
      cast: { mun: munitions, fin: orFavourite(office("finance")) },
    },
  ),
  event(
    "fra_sh_nitrates",
    [
      opt("chile_ships", [shortage("nitrates", false), gauge("money", -1)]),
      opt("ships_first", [shortage("nitrates", false), gauge("bread", -1)]),
      opt("bear_it"),
    ],
    {
      scheduledOnly: true,
      cast: { mun: munitions, navy: orFavourite(office("navy")) },
    },
  ),
  event(
    "fra_sh_fats",
    [
      opt("margarine", [shortage("fats", false), opinion("business", -1)]),
      opt("market", [opinion("workers", -1)]),
    ],
    {
      scheduledOnly: true,
      cast: {
        home: orFavourite(office("interior")),
        farm: orFavourite(office("agriculture"), office("interior")),
      },
    },
  ),
  // Freight: the coal and the nitrate both come in someone else's hulls.
  event(
    "fra_sh_freight",
    [
      opt("charter_neutrals", [
        gauge("money", -1),
        ifShort("coal"),
        ifShort("nitrates"),
      ]),
      opt("ask_london", [britain(-1), ifShort("coal")]),
      opt("cut_imports", [gauge("bread", -1)]),
    ],
    {
      stage: WAR_ON,
      when: all(war, warAge(14), any(short("coal"), short("nitrates"))),
      cast: {
        fin: orFavourite(office("finance")),
        navy: orFavourite(office("navy")),
      },
      tags: ["war", "foreign"],
      place: "brest",
    },
  ),
];

/** The cost of the levy in West Africa: a record card, read and closed. */
const RECORD_SCENES: GwScene[] = [
  {
    id: "fra_pj_colonial_record",
    nation: NATION,
    kind: "report",
    stage: WAR_ON,
    when: all(
      war,
      warAge(15),
      any(
        projectAt("fra_pj_colonial", "prep", "opp", "exec", "done", "failed"),
        warAge(18),
      ),
    ),
    once: true,
    salience: 5,
    tags: ["war", "people"],
    cast: {},
    stamp: "estimate",
    place: "dakar",
    variants: base,
  },
];

const LABOUR_SCENES: GwScene[] = [
  // Women into the shell shops, and the old ban on their night work.
  event(
    "fra_lb_night",
    [
      opt("night_rules", [men(1), opinion("workers", 1)]),
      opt("night_free", [gauge("shells", 1), opinion("workers", -1)]),
      opt("day_only"),
    ],
    {
      kind: "audience",
      stage: Y14_ON,
      when: all(footingAt(1), warAge(6)),
      cast: { mun: munitions, lab: labour },
      tags: ["home", "people"],
    },
  ),
  // The seamstresses who sew the army's coats at home, by the piece.
  event(
    "fra_lb_homework",
    [
      opt("floor_rate", [
        opinion("workers", 1),
        opinion("business", -1),
        inst("chamber", 1),
      ]),
      opt("army_rate", [opinion("workers", 1), gauge("money", -1)]),
      opt("leave_it", [opinion("workers", -1)]),
    ],
    {
      stage: Y14_ON,
      when: all(war, warAge(8)),
      cast: { home: orFavourite(office("interior")), lab: labour },
      tags: ["home", "people"],
      place: "paris",
    },
  ),
  // The Loire: the metalworkers of Saint-Étienne come out against the war.
  event(
    "fra_lb_loire",
    [
      opt("arbitrate", [opinion("workers", 1), gauge("shells", -1)]),
      opt("call_up", [opinion("workers", -2), gauge("order", 1)]),
      opt("hear_them", [opinion("workers", 1), gauge("order", -1)]),
    ],
    {
      stage: Y14_ON,
      when: all(footingAt(1), any(workersAt(-2), warAge(40))),
      cast: {
        mun: munitions,
        home: orFavourite(office("interior")),
        lab: labour,
      },
      tags: ["home", "people"],
    },
  ),
];

/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const FRA_CRAFT_SCENES: readonly GwScene[] = [
  ...PROJECT_SCENES,
  ...FOOTING_SCENES,
  ...SHORTAGE_SCENES,
  ...RECORD_SCENES,
  ...LABOUR_SCENES,
];
