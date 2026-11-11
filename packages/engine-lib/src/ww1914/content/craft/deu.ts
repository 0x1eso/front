import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  chose,
  decide,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  holder,
  not,
  reason,
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
  invented,
  outsider,
  project,
  shortage,
} from "./kit";

// DEU's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/DEU.craft.json. Inventors and union people are pack-only
// (`deu_i_*`), cast with `outsider`. Nothing here shows a result before the
// pick: no tells; reason lines and the next paper say what happened.

const NATION: GwScene["nation"] = ["DEU"];

// ---- Words ----

const war = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });
const blockade = (min: number): GwCond => world({ is: "blockade", min });
const atGbr: GwCond = { kind: "at_war", tag: "GBR" };
const dugIn = world({
  is: "era",
  of: ["trenches", "material", "depth", "storm"],
});
const workers = (max: number): GwCond => ({
  kind: "bloc",
  bloc: "workers",
  max,
});

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
const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const force = (theatre: GwTheatre, delta: number): GwEffect =>
  doWorld({ do: "force", tag: "DEU", theatre, delta });
const trustTag = (tag: "AUH" | "OTT", delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});

const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

const lead = role("lead");
/** That person if they are about, else whoever holds the office. */
const person = (id: string, office: GwOffice): GwCastRule => ({
  any_of: [{ person: id }, { office }],
});

// ---- Inventions ----

export const DEU_INVENTIONS: readonly GwInventionRow[] = [
  {
    id: "deu_inv_gas",
    tag: "DEU",
    inventor: "deu_i_haber",
    opens: all(war, dugIn),
    against: "army",
    price: 10,
    build: 3,
    trial: 60,
    ripe: 3,
    edge: { theatres: ["west"], attack: 8 },
    tech: "gas_heavy",
    cast: { cos: holder("chief_of_staff") },
  },
  {
    id: "deu_inv_nitric",
    tag: "DEU",
    inventor: "deu_i_bosch",
    opens: all(war, any(blockade(1), atGbr)),
    build: 3,
    trial: 70,
    ripe: 0,
    solves: ["nitrates"],
    cast: { fin: holder("finance") },
  },
  {
    id: "deu_inv_fokker",
    tag: "DEU",
    inventor: "deu_i_fokker",
    opens: all(war, warAge(6)),
    against: "army",
    price: 10,
    build: 2,
    trial: 65,
    ripe: 2,
    edge: { theatres: ["west"], attack: 3, defence: 6 },
    cast: { war: holder("war") },
  },
  {
    id: "deu_inv_rubber",
    tag: "DEU",
    inventor: "deu_i_hofmann",
    opens: all(war, any(warAge(10), world({ is: "shortage", id: "rubber" }))),
    build: 4,
    trial: 45,
    ripe: 0,
    solves: ["rubber"],
    cast: { war: holder("war") },
  },
  {
    id: "deu_inv_storm",
    tag: "DEU",
    inventor: "deu_i_rohr",
    opens: all(war, warAge(10), dugIn),
    against: "army",
    price: 10,
    build: 3,
    trial: 65,
    ripe: 3,
    edge: { theatres: ["west", "east"], attack: 6, defence: 2 },
    tech: "assault_groups",
    cast: { cos: holder("chief_of_staff") },
  },
  {
    id: "deu_inv_cargo",
    tag: "DEU",
    inventor: "deu_i_lohmann",
    opens: all(
      war,
      atGbr,
      blockade(2),
      warAge(12),
      not(world({ is: "entered", tag: "USA" })),
    ),
    build: 4,
    trial: 55,
    ripe: 0,
    fielded: [
      doWorld({ do: "blockade", delta: -1 }),
      opinion("business", 1),
      reason("cr_deu_cargo_through"),
    ],
    cast: { navy: holder("navy") },
  },
];

// ---- The year's project ----

export const DEU_PROJECTS: readonly GwProjectRow[] = [
  {
    id: "deu_pj_baghdad",
    tag: "DEU",
    opens: any(not(war), world({ is: "entered", tag: "OTT", side: "central" })),
    lead: {
      any_of: [
        { person: "deu_helfferich" },
        { office: "foreign" },
        { office: "chancellor" },
      ],
    },
    odds: 45,
    aims: ["deu_aim_mitteleuropa"],
    start: [gauge("money", -1)],
    done: [trustTag("OTT", 1), opinion("business", 1)],
    failed: [trustTag("OTT", -1)],
  },
  {
    id: "deu_pj_kitchens",
    tag: "DEU",
    opens: all(war, warAge(6)),
    lead: { any_of: [{ office: "interior" }, { office: "chancellor" }] },
    odds: 55,
    aims: ["deu_aim_home"],
    start: [gauge("money", -1)],
    done: [gauge("bread", 1), opinion("workers", 1)],
    failed: [opinion("workers", -1)],
  },
  {
    id: "deu_pj_science",
    tag: "DEU",
    lead: {
      any_of: [
        { office: "finance" },
        { office: "interior" },
        { office: "chancellor" },
      ],
    },
    odds: 55,
    aims: ["deu_aim_crown"],
    start: [gauge("money", -1), opinion("business", 1)],
    done: [gauge("shells", 1), opinion("court", 1)],
  },
  {
    id: "deu_pj_mitteleuropa",
    tag: "DEU",
    opens: not(world({ is: "out", tag: "AUH" })),
    lead: { any_of: [{ office: "foreign" }, { office: "chancellor" }] },
    odds: 40,
    aims: ["deu_aim_mitteleuropa"],
    start: [opinion("business", 1)],
    done: [trustTag("AUH", 1), opinion("business", 1)],
    failed: [trustTag("AUH", -1)],
  },
  {
    id: "deu_pj_power",
    tag: "DEU",
    opens: war,
    lead: {
      any_of: [
        { person: "deu_rathenau" },
        { office: "interior" },
        { office: "chancellor" },
      ],
    },
    odds: 50,
    aims: ["deu_aim_win"],
    start: [gauge("money", -1)],
    done: [gauge("shells", 1)],
    terms: FACTORY,
  },
  {
    id: "deu_pj_air",
    tag: "DEU",
    opens: all(war, warAge(12)),
    lead: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
    odds: 50,
    aims: ["deu_aim_win", "deu_aim_east"],
    start: [gauge("money", -1), opinion("army", 1)],
    done: [force("west", 1)],
    failed: [opinion("army", -1)],
  },
];

/** One chapter of a project: a paper the person in charge brings. */
const pj = (
  id: string,
  options: GwOption[],
  cast: Record<string, GwCastRule> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  scheduledOnly: true,
  salience: 6,
  tags: ["home"],
  cast: { lead: inCharge, ...cast },
  variants: [{ id: "base" }],
  fallback: options[options.length - 1].id,
  options,
});

/** How it went, read only. */
const pjDone = (id: string): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  scheduledOnly: true,
  salience: 6,
  tags: ["home"],
  cast: { lead: inCharge },
  variants: [{ id: "base" }],
});

/** It failed: the person in charge answers for it, or the seat stands by him. */
const pjFail = (id: string): GwScene =>
  pj(id, [
    opt("blame", [trustOf(lead, -2), reason("cr_deu_pj_blame", lead)]),
    opt("stand", [trustOf(lead, 1), reason("cr_deu_pj_stand", lead)]),
  ]);

const push = project("push");
const slow = project("slow");

const PROJECT_SCENES: GwScene[] = [
  // 바그다드 철도의 굴
  pj(
    "deu_pj_baghdad_prep",
    [
      opt("sappers", [push, men(-1), reason("cr_deu_bg_sappers")]),
      opt("bank", [push, gauge("money", -1), reason("cr_deu_bg_bank")]),
      opt("plain", []),
    ],
    { fin: holder("finance") },
  ),
  pj(
    "deu_pj_baghdad_opp",
    [
      opt("hold", [push, inst("army", -1), reason("cr_deu_bg_cars")]),
      opt("bend", [slow, inst("army", 1)]),
    ],
    { cos: holder("chief_of_staff") },
  ),
  pj("deu_pj_baghdad_exec", [
    opt("single", [push, reason("cr_deu_bg_single")]),
    opt("lined", []),
  ]),
  pjDone("deu_pj_baghdad_done"),
  pjFail("deu_pj_baghdad_fail"),
  // 공동 부엌
  pj("deu_pj_kitchens_prep", [
    opt("army_carts", [push, inst("army", -1), reason("cr_deu_kt_carts")]),
    opt("treasury", [push, gauge("money", -1)]),
    opt("towns", [opinion("parliament", 1)]),
  ]),
  pj(
    "deu_pj_kitchens_opp",
    [
      opt("free", [push, opinion("business", -1), reason("cr_deu_kt_free")]),
      opt("card", [slow, opinion("business", 1)]),
    ],
    { fin: holder("finance") },
  ),
  pj("deu_pj_kitchens_exec", [
    opt("gates", [push, gauge("money", -1), reason("cr_deu_kt_gates")]),
    opt("same", []),
  ]),
  pjDone("deu_pj_kitchens_done"),
  pjFail("deu_pj_kitchens_fail"),
  // 전쟁 과학 재단
  pj("deu_pj_science_prep", [
    opt("crown", [push, opinion("court", 1), reason("cr_deu_sc_crown")]),
    opt("donors", [opinion("business", 1)]),
    opt("treasury", [push, gauge("money", -1)]),
  ]),
  pj(
    "deu_pj_science_opp",
    [
      opt("professors", [push, inst("army", -1), reason("cr_deu_sc_profs")]),
      opt("ordnance", [slow, inst("army", 1)]),
    ],
    { war: holder("war") },
  ),
  pj("deu_pj_science_exec", [
    opt("secret", [push, opinion("press", -1)]),
    opt("open", [opinion("press", 1)]),
  ]),
  pjDone("deu_pj_science_done"),
  pjFail("deu_pj_science_fail"),
  // 중부 유럽 관세 동맹
  pj(
    "deu_pj_mitteleuropa_prep",
    [
      opt("whole", [
        push,
        opinion("parliament", -1),
        reason("cr_deu_me_whole"),
      ]),
      opt("steps", []),
    ],
    { amb: holder("ambassador_vienna") },
  ),
  pj("deu_pj_mitteleuropa_opp", [
    opt("hold", [push, trustTag("AUH", -1), reason("cr_deu_me_hold")]),
    opt("bend", [slow, trustTag("AUH", 1)]),
  ]),
  pj("deu_pj_mitteleuropa_exec", [
    opt("sign", [push]),
    opt("vote", [slow, inst("reichstag", 1), reason("cr_deu_me_vote")]),
  ]),
  pjDone("deu_pj_mitteleuropa_done"),
  pjFail("deu_pj_mitteleuropa_fail"),
  // 갈탄 발전소
  pj(
    "deu_pj_power_prep",
    [
      opt("steel", [push, gauge("shells", -1), reason("cr_deu_pw_steel")]),
      opt("queue", []),
    ],
    { war: holder("war") },
  ),
  pj("deu_pj_power_opp", [
    opt("private", [
      push,
      opinion("business", 1),
      opinion("workers", -1),
      reason("cr_deu_pw_private"),
    ]),
    opt("reich", [slow, opinion("parliament", 1), reason("cr_deu_pw_reich")]),
  ]),
  pj("deu_pj_power_exec", [
    opt("shifts", [push, opinion("workers", -1)]),
    opt("steady", []),
  ]),
  pjDone("deu_pj_power_done"),
  pjFail("deu_pj_power_fail"),
  // 항공대 두 배
  pj("deu_pj_air_prep", [
    opt("fitters", [push, men(-1), reason("cr_deu_air_fitters")]),
    opt("same", []),
  ]),
  pj(
    "deu_pj_air_opp",
    [
      opt("air", [push, reason("cr_deu_air_first")]),
      opt("boats", [slow, reason("cr_deu_air_boats")]),
    ],
    { navy: holder("navy") },
  ),
  pj("deu_pj_air_exec", [
    opt("schools", [push, gauge("money", -1)]),
    opt("same", []),
  ]),
  pjDone("deu_pj_air_done"),
  pjFail("deu_pj_air_fail"),
];

// ---- Footing ----

export const DEU_FOOTING: GwFootingRow | null = {
  tag: "DEU",
  steps: [
    { scene: "deu_ft_war" },
    { scene: "deu_ft_total", opens: all(warAge(12), footingAt(1)) },
  ],
};

const ask = (id: string, next: string | null) => ({
  id,
  stance: "frank" as const,
  kind: "ask" as const,
  tell: [],
  effects: [],
  next,
});

const silent = (id: string): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["tension_down"],
  variants: [{ id: "base" }],
});

const FOOTING_SCENES: GwScene[] = [
  {
    id: "deu_ft_war",
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 8,
    tags: ["war", "home"],
    cast: {
      war: holder("war"),
      raw: person("deu_rathenau", "interior"),
      fin: holder("finance"),
    },
    who: "war",
    start: "n1",
    variants: [{ id: "base" }],
    after: [
      { scene: "deu_ft_war_up", when: chose("deu_ft_war", "raise") },
      { scene: "deu_ft_war_wait" },
    ],
    nodes: {
      n1: {
        says: [{ id: "office", when: flag("f_raw_office") }, { id: "base" }],
        replies: [ask("who_buys", "n2")],
      },
      n2: {
        who: "raw",
        says: [{ id: "base" }],
        replies: [ask("owners", "n3")],
      },
      n3: {
        who: "fin",
        says: [{ id: "base" }],
        replies: [ask("price", "n4")],
      },
      n4: {
        alone: true,
        fallback: "wait",
        says: [{ id: "base" }],
        replies: [decide("raise", null, [footing(1)]), decide("wait", null)],
      },
    },
  },
  silent("deu_ft_war_up"),
  silent("deu_ft_war_wait"),
  {
    id: "deu_ft_total",
    nation: NATION,
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["war", "home"],
    cast: {
      cos: holder("chief_of_staff"),
      chan: holder("chancellor"),
      lab: person("deu_groener", "war"),
    },
    who: "cos",
    start: "n1",
    variants: [{ id: "base" }],
    after: [
      { scene: "deu_ft_total_up", when: chose("deu_ft_total", "raise") },
      { scene: "deu_ft_total_wait" },
    ],
    nodes: {
      n1: {
        says: [{ id: "base" }],
        replies: [ask("by_when", "n2")],
      },
      n2: {
        who: "chan",
        says: [{ id: "base" }],
        replies: [ask("unions", "n3")],
      },
      n3: {
        who: "lab",
        says: [{ id: "angry", when: workers(-2) }, { id: "base" }],
        replies: [ask("can_it", "n4")],
      },
      n4: {
        alone: true,
        fallback: "wait",
        says: [{ id: "base" }],
        replies: [decide("raise", null, [footing(2)]), decide("wait", null)],
      },
    },
  },
  silent("deu_ft_total_up"),
  silent("deu_ft_total_wait"),
];

// ---- Shortages ----

export const DEU_SHORTAGES: readonly GwShortageRow[] = [
  {
    id: "nitrates",
    tag: "DEU",
    when: all(atGbr, blockade(2)),
    scene: "deu_sh_nitrates",
    drag: [{ gauge: "shells", delta: -1, every: 3 }],
  },
  {
    id: "rubber",
    tag: "DEU",
    when: all(atGbr, blockade(3), warAge(6)),
    scene: "deu_sh_rubber",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 2 }],
  },
  {
    id: "copper",
    tag: "DEU",
    when: all(atGbr, blockade(2), warAge(10)),
    scene: "deu_sh_copper",
    drag: [{ gauge: "shells", delta: -1, every: 4, offset: 1 }],
  },
  {
    id: "fats",
    tag: "DEU",
    when: all(atGbr, blockade(3), warAge(14)),
    scene: "deu_sh_fats",
    drag: [
      { gauge: "bread", delta: -1, every: 5, offset: 2 },
      { gauge: "order", delta: -1, every: 6, offset: 4 },
    ],
  },
];

const sh = (
  id: string,
  cast: Record<string, GwCastRule>,
  options: GwOption[],
  variants: GwVariant[] = [{ id: "base" }],
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  scheduledOnly: true,
  salience: 7,
  tags: ["war", "home"],
  cast,
  variants,
  fallback: options[options.length - 1].id,
  options,
});

const rawMan = person("deu_rathenau", "interior");

const SHORTAGE_SCENES: GwScene[] = [
  sh(
    "deu_sh_nitrates",
    { war: holder("war"), raw: rawMan },
    [
      opt("air", [
        shortage("nitrates", false),
        gauge("money", -1),
        reason("cr_deu_nit_plants"),
      ]),
      opt("fields", [
        shortage("nitrates", false),
        gauge("bread", -1),
        reason("cr_deu_nit_fields"),
      ]),
      opt("antwerp", [gauge("shells", 1), reason("cr_deu_nit_antwerp")]),
      opt("stores", []),
    ],
    [
      {
        id: "bosch",
        when: invented("deu_inv_nitric", "building", "ready", "failed"),
      },
      { id: "office", when: flag("f_raw_office") },
      { id: "base" },
    ],
  ),
  sh("deu_sh_rubber", { war: holder("war"), raw: rawMan }, [
    opt("tyres", [
      shortage("rubber", false),
      gauge("order", -1),
      reason("cr_deu_rub_tyres"),
    ]),
    opt("neutrals", [
      shortage("rubber", false),
      gauge("money", -1),
      reason("cr_deu_rub_neutrals"),
    ]),
    opt("iron_wheels", []),
  ]),
  sh("deu_sh_copper", { war: holder("war"), interior: holder("interior") }, [
    opt("bells", [
      shortage("copper", false),
      schedule("deu_sh_bells", 2),
      reason("cr_deu_cu_bells"),
    ]),
    opt("sweden", [
      shortage("copper", false),
      gauge("money", -1),
      reason("cr_deu_cu_sweden"),
    ]),
    opt("zinc", [reason("cr_deu_cu_zinc")]),
  ]),
  {
    id: "deu_sh_bells",
    nation: NATION,
    kind: "proposal",
    scheduledOnly: true,
    once: true,
    salience: 5,
    tags: ["home"],
    cast: { interior: holder("interior"), court: holder("court") },
    variants: [{ id: "base" }],
    fallback: "old_spared",
    options: [
      opt("all_bells", [gauge("shells", 1), opinion("court", -1)]),
      opt("old_spared", [reason("cr_deu_cu_spared")]),
    ],
  },
  sh("deu_sh_fats", { interior: holder("interior"), raw: rawMan }, [
    opt("dutch", [
      shortage("fats", false),
      gauge("money", -1),
      reason("cr_deu_fat_dutch"),
    ]),
    opt("glycerine", [gauge("shells", 1), reason("cr_deu_fat_sugar")]),
    opt("stones", [opinion("press", 1)]),
  ]),
];

// ---- Labour ----

const labour = (
  id: string,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  options: GwOption[],
  variants: GwVariant[] = [{ id: "base" }],
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  stage: ["war"],
  when,
  once: true,
  salience: 7,
  tags: ["home"],
  cast,
  variants,
  fallback: options[options.length - 1].id,
  options,
});

const LABOUR_SCENES: GwScene[] = [
  labour(
    "deu_lb_truce",
    all(war, footingAt(1)),
    { legien: outsider("deu_i_legien"), interior: holder("interior") },
    [
      opt("boards", [
        opinion("workers", 1),
        opinion("business", -1),
        reason("cr_deu_lb_boards"),
      ]),
      opt("thanks", [opinion("workers", -1)]),
    ],
  ),
  labour(
    "deu_lb_stewards",
    all(footingAt(1), workers(-1), warAge(8)),
    { mueller: outsider("deu_i_rmueller"), interior: holder("interior") },
    [
      opt("call_up", [
        men(1),
        opinion("workers", -1),
        { kind: "rumour", delta: 1 },
        reason("cr_deu_lb_call_up"),
      ]),
      opt("hear", [opinion("workers", 1), inst("army", -1)]),
      opt("watch", []),
    ],
    [{ id: "hard", when: workers(-3) }, { id: "base" }],
  ),
  labour(
    "deu_lb_women",
    footingAt(2),
    { lueders: outsider("deu_i_lueders"), war: holder("war") },
    [
      opt("nights", [
        gauge("shells", -1),
        opinion("workers", 1),
        reason("cr_deu_lb_nights"),
      ]),
      opt("creches", [men(2), gauge("money", -1), reason("cr_deu_lb_creches")]),
      opt("as_is", []),
    ],
    [{ id: "office", when: flag("f_women_office") }, { id: "base" }],
  ),
  labour(
    "deu_lb_reclaim",
    all(footingAt(1), warAge(14)),
    { cos: holder("chief_of_staff"), war: holder("war") },
    [
      opt("to_front", [men(3), gauge("shells", -1), reason("cr_deu_lb_front")]),
      opt("to_lathes", [
        men(-2),
        gauge("shells", 1),
        inst("army", -1),
        reason("cr_deu_lb_lathes"),
      ]),
      opt("half", []),
    ],
  ),
];

/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const DEU_CRAFT_SCENES: readonly GwScene[] = [
  ...PROJECT_SCENES,
  ...FOOTING_SCENES,
  ...SHORTAGE_SCENES,
  ...LABOUR_SCENES,
];
