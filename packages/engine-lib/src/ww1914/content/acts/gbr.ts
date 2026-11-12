// GBR's schedule (원수의 일정) and aims (국가 목표); shapes in GwActs.ts.
// Text in resources/ww1914/ko/GBR.acts.json. Their scenes are in scenes/gbr_act.ts.
import type { GwAct, GwAim } from "@openfront/engine-api/ww1914/GwActs";
import {
  all,
  any,
  feud,
  flag,
  GwCond,
  GwEffect,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

export { GBR_ACT_SCENES } from "../scenes/gbr_act";

const NATION: GwAct["nation"] = ["GBR"];
const war = world({ is: "war" });
const atDeu: GwCond = { kind: "at_war", tag: "DEU" };
const notWar = not(war);
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const notLg = not(flag("f_pm_lg"));
const from = (min: string): GwCond => world({ is: "date", from: min });
const seenScene = (scene: string): GwCond => ({ kind: "seen", scene });
const inspect = (
  fact: "force" | "shells" | "morale",
  tag: "GBR" | "DEU",
  theatre?: "west" | "sea",
): GwEffect =>
  doWorld(
    theatre === undefined
      ? { do: "inspect", fact, tag }
      : { do: "inspect", fact, tag, theatre },
  );
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
/** Plotting for an Irish rising found out early: the heat comes down. */
const irishCooled: GwEffect = { kind: "pressure", topic: "ireland", delta: -1 };
const inst = (
  i: "commons" | "opposition" | "cabinet" | "irish",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const tones = (...t: ("warm" | "cold" | "threat" | "flatter" | "frank")[]) => ({
  id: "tone",
  tones: t,
});

const visit = (
  id: string,
  when: GwCond | undefined,
  effects: GwEffect[] = [],
): GwAct => ({
  id,
  nation: NATION,
  kind: "visit",
  ...(when === undefined ? {} : { when }),
  cooldown: 8,
  scene: `${id}_v`,
  wait: 0,
  effects,
});

const VISITS: GwAct[] = [
  visit("gbr_a_fleet", undefined, [inspect("force", "GBR", "sea")]),
  visit("gbr_a_woolwich", undefined, [inspect("shells", "GBR")]),
  visit("gbr_a_clyde", undefined),
  visit("gbr_a_gq", atDeu, [
    inspect("morale", "GBR"),
    inspect("force", "GBR", "west"),
    inspect("force", "DEU", "west"),
  ]),
  visit("gbr_a_netley", war, [inspect("morale", "GBR")]),
  visit("gbr_a_dublin", undefined),
  visit("gbr_a_belfast", all(notWar, not(flag("f_home_rule_lives")))),
  visit("gbr_a_city", undefined),
  visit(
    "gbr_a_room40",
    all(atDeu, world({ is: "war_months", own: true, min: 2 })),
    [
      maybe(
        all({ kind: "secret", id: "deu_zimmermann_wire" }, from("1917-01")),
        doWorld({ do: "reveal", id: "deu_zimmermann_wire" }),
      ),
    ],
  ),
  visit("gbr_a_dover", all(war, world({ is: "uboat", min: 1 })), [
    inspect("force", "GBR", "sea"),
  ]),
  visit("gbr_a_liverpool", war, [
    maybe(
      all({ kind: "secret", id: "gbr_sailings_count" }, from("1917-01")),
      doWorld({ do: "reveal", id: "gbr_sailings_count" }),
    ),
  ]),
  visit("gbr_a_salisbury", atDeu, [inspect("force", "GBR", "west")]),
  visit(
    "gbr_a_gretna",
    all(war, world({ is: "war_months", own: true, min: 20 })),
    [inspect("shells", "GBR")],
  ),
  visit("gbr_a_seat", undefined, [inspect("morale", "GBR")]),
];

const LETTERS: GwAct[] = [
  {
    id: "gbr_a_l_nicky",
    nation: NATION,
    kind: "letter",
    scene: "gbr_a_l_nicky_r",
    wait: 1,
    effects: [{ kind: "letter", who: role("tsar") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "family" },
          { id: "mobilise", when: crisis },
          { id: "straits", when: all(war, from("1915-01")) },
          { id: "shells", when: war },
        ],
      },
      tones("warm", "frank", "cold"),
    ],
  },
  {
    id: "gbr_a_l_willy",
    nation: NATION,
    kind: "letter",
    when: not(atDeu),
    scene: "gbr_a_l_willy_r",
    wait: 1,
    effects: [{ kind: "letter", who: role("kaiser") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "fleet" },
          { id: "serbia", when: crisis },
          { id: "belgium", when: crisis },
        ],
      },
      tones("warm", "frank", "threat"),
    ],
  },
  {
    id: "gbr_a_l_wilson",
    nation: NATION,
    kind: "letter",
    when: all(war, not({ kind: "at_war", tag: "USA" })),
    scene: "gbr_a_l_wilson_r",
    effects: [{ kind: "letter", who: role("pres") }],
    wait: 2,
    fields: [
      {
        id: "subject",
        options: [{ id: "cotton" }, { id: "loans" }, { id: "peace" }],
      },
      tones("warm", "frank", "flatter"),
    ],
  },
  {
    id: "gbr_a_l_poincare",
    nation: NATION,
    kind: "letter",
    when: any(crisis, war),
    scene: "gbr_a_l_poincare_r",
    effects: [{ kind: "letter", who: role("pres") }],
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "coast" },
          { id: "divisions", when: war },
          { id: "command", when: all(war, from("1916-01")) },
        ],
      },
      tones("warm", "frank", "cold"),
    ],
  },
  {
    id: "gbr_a_l_redmond",
    nation: NATION,
    kind: "letter",
    scene: "gbr_a_l_redmond_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "counties" },
          { id: "division", when: war },
          { id: "amnesty", when: seenScene("gbr_h_easter") },
        ],
      },
      tones("warm", "frank", "flatter"),
    ],
  },
  {
    id: "gbr_a_l_carson",
    nation: NATION,
    kind: "letter",
    scene: "gbr_a_l_carson_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "line" },
          { id: "rifles", when: notWar },
          { id: "office", when: war },
        ],
      },
      tones("frank", "cold", "threat"),
    ],
  },
];

const attend = { id: "attend", people: "cabinet", count: 2 } as const;

const ORDERS: GwAct[] = [
  {
    id: "gbr_a_o_inquiry",
    nation: NATION,
    kind: "order",
    scene: "gbr_a_o_inquiry_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "rifles" },
          { id: "shells", effects: [inspect("shells", "GBR")] },
          { id: "bread", when: war },
          { id: "recruits", when: war },
        ],
      },
    ],
  },
  {
    id: "gbr_a_o_commission",
    nation: NATION,
    kind: "order",
    once: true,
    when: all(war, world({ is: "war_months", own: true, min: 11 })),
    scene: "gbr_a_o_commission_r",
    wait: 2,
    fields: [
      {
        id: "subject",
        options: [
          { id: "shells" },
          { id: "straits", when: world({ is: "open", theatre: "straits" }) },
          { id: "kut", when: world({ is: "open", theatre: "mesopotamia" }) },
        ],
      },
    ],
  },
  {
    id: "gbr_a_o_cid",
    nation: NATION,
    kind: "order",
    when: notWar,
    scene: "gbr_a_o_cid_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [{ id: "belgium" }, { id: "war_book" }, { id: "invasion" }],
      },
      attend,
    ],
  },
  {
    id: "gbr_a_o_council",
    nation: NATION,
    kind: "order",
    when: atDeu,
    scene: "gbr_a_o_council_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [{ id: "west" }, { id: "east" }, { id: "sea" }],
      },
      attend,
    ],
  },
  {
    id: "gbr_a_o_dinner",
    nation: NATION,
    kind: "order",
    cooldown: 5,
    scene: "gbr_a_o_dinner_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [
          { id: "nothing" },
          { id: "ireland" },
          { id: "war", when: war },
        ],
      },
      attend,
    ],
  },
  {
    id: "gbr_a_o_envoy",
    nation: NATION,
    kind: "order",
    when: any(war, crisis),
    scene: "gbr_a_o_envoy_r",
    wait: 2,
    fields: [
      { id: "envoy", people: "own" },
      {
        id: "where",
        options: [
          { id: "paris", effects: [{ kind: "trust", tag: "FRA", delta: 1 }] },
          {
            id: "washington",
            effects: [{ kind: "trust", tag: "USA", delta: 1 }],
          },
          { id: "rome", effects: [{ kind: "trust", tag: "ITA", delta: 1 }] },
        ],
      },
    ],
  },
  {
    id: "gbr_a_o_minutes",
    nation: NATION,
    kind: "order",
    once: true,
    when: all(notLg, { kind: "person_active", person: "gbr_hankey" }),
    scene: "gbr_a_o_minutes_r",
    wait: 1,
    tell: ["cabinet:-1"],
    effects: [inst("cabinet", -1), { kind: "remember", key: "k_han_minutes" }],
    fields: [
      {
        id: "how",
        options: [{ id: "book" }, { id: "conclusions" }],
      },
    ],
  },
  {
    id: "gbr_a_o_editors",
    nation: NATION,
    kind: "order",
    when: war,
    scene: "gbr_a_o_editors_r",
    wait: 1,
    tell: ["opinion:+1"],
    effects: [opinion("press", 1)],
    fields: [
      {
        id: "on",
        options: [{ id: "lists" }, { id: "censor" }, { id: "recruiting" }],
      },
    ],
  },
];

const speech = (
  id: string,
  when: GwCond | undefined,
  fields: GwAct["fields"],
): GwAct => ({
  id,
  nation: NATION,
  kind: "speech",
  ...(when === undefined ? {} : { when }),
  cooldown: 5,
  scene: `${id}_r`,
  wait: 0,
  fields,
});

const SPEECHES: GwAct[] = [
  speech("gbr_a_s_commons", undefined, [
    {
      id: "place",
      options: [
        {
          id: "questions",
          effects: [opinion("parliament", 1)],
          tell: ["opinion:+1"],
        },
        {
          id: "adjournment",
          effects: [inst("commons", 1)],
          tell: ["commons:+1"],
        },
      ],
    },
    {
      id: "on",
      options: [{ id: "ireland" }, { id: "war", when: war }, { id: "money" }],
    },
  ]),
  speech("gbr_a_s_guildhall", undefined, [
    {
      id: "place",
      options: [
        {
          id: "guildhall",
          effects: [opinion("business", 1)],
          tell: ["opinion:+1"],
        },
        {
          id: "mansion_house",
          effects: [opinion("press", 1)],
          tell: ["opinion:+1"],
        },
      ],
    },
    {
      id: "on",
      options: [
        { id: "belgium", when: atDeu },
        { id: "money" },
        { id: "peace" },
      ],
    },
  ]),
  speech("gbr_a_s_recruit", atDeu, [
    {
      id: "place",
      options: [
        {
          id: "edinburgh",
          effects: [{ kind: "gauge", gauge: "morale", delta: 1 }],
          tell: ["morale:+1"],
        },
        {
          id: "cardiff",
          effects: [opinion("workers", 1)],
          tell: ["opinion:+1"],
        },
        {
          id: "dublin",
          when: not(seenScene("gbr_h_easter")),
          effects: [inst("irish", 1)],
          tell: ["irish:+1"],
        },
      ],
    },
    {
      id: "on",
      options: [{ id: "men" }, { id: "small_nations" }],
    },
  ]),
  speech("gbr_a_s_ireland", notWar, [
    {
      id: "place",
      options: [
        { id: "dublin", effects: [inst("irish", 1)], tell: ["irish:+1"] },
        {
          id: "belfast",
          effects: [inst("opposition", -1)],
          tell: ["opposition:-1"],
        },
      ],
    },
    {
      id: "on",
      options: [{ id: "law" }, { id: "deal" }],
    },
  ]),
  speech("gbr_a_s_seat", undefined, [
    {
      id: "place",
      options: [
        {
          id: "hall",
          effects: [opinion("parliament", 1)],
          tell: ["opinion:+1"],
        },
        {
          id: "market",
          effects: [opinion("workers", 1)],
          tell: ["opinion:+1"],
        },
      ],
    },
    {
      id: "on",
      options: [{ id: "bread" }, { id: "lists", when: war }, { id: "after" }],
    },
  ]),
  speech("gbr_a_s_labour", war, [
    {
      id: "place",
      options: [
        { id: "clyde", effects: [opinion("workers", 1)], tell: ["opinion:+1"] },
        { id: "tuc", effects: [opinion("workers", 1)], tell: ["opinion:+1"] },
      ],
    },
    {
      id: "on",
      options: [{ id: "dilution" }, { id: "rents" }, { id: "draft" }],
    },
  ]),
];

const INTRIGUES: GwAct[] = [
  {
    id: "gbr_a_i_leak",
    nation: NATION,
    kind: "intrigue",
    scene: "gbr_a_i_leak_r",
    wait: 1,
    effects: [rumour(1)],
    fields: [
      {
        id: "what",
        options: [
          { id: "carson" },
          { id: "war_office", when: war },
          { id: "unionists" },
        ],
      },
    ],
    caught: { pct: 30, scene: "gbr_a_i_leak_out", wait: 2 },
  },
  {
    id: "gbr_a_i_set_on",
    nation: NATION,
    kind: "intrigue",
    scene: "gbr_a_i_set_on_r",
    wait: 1,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [feud(role("a"), role("b"))],
    caught: { pct: 35, scene: "gbr_a_i_set_on_out", wait: 2 },
  },
  {
    id: "gbr_a_i_whips",
    nation: NATION,
    kind: "intrigue",
    scene: "gbr_a_i_whips_r",
    wait: 1,
    tell: ["commons:+1"],
    effects: [inst("commons", 1)],
    fields: [
      {
        id: "offer",
        options: [{ id: "peerage" }, { id: "post" }],
      },
    ],
    caught: { pct: 25, scene: "gbr_a_i_whips_out", wait: 2 },
  },
  {
    id: "gbr_a_i_agents",
    nation: NATION,
    kind: "intrigue",
    when: war,
    scene: "gbr_a_i_agents_r",
    wait: 2,
    fields: [
      {
        id: "where",
        options: [
          // Irish-American money for a rising, watched at the docks.
          { id: "newyork", effects: [irishCooled] },
          {
            id: "geneva",
            effects: [
              doWorld({
                do: "report",
                fact: "morale",
                tag: "DEU",
                source: "agents",
              }),
            ],
          },
          {
            id: "petrograd",
            when: world({ is: "entered", tag: "RUS", side: "entente" }),
            effects: [
              doWorld({
                do: "report",
                fact: "morale",
                tag: "RUS",
                source: "agents",
              }),
            ],
          },
        ],
      },
    ],
    caught: { pct: 20, scene: "gbr_a_i_agents_out", wait: 3 },
  },
  {
    id: "gbr_a_i_castle",
    nation: NATION,
    kind: "intrigue",
    scene: "gbr_a_i_castle_r",
    wait: 1,
    fields: [
      {
        id: "where",
        options: [{ id: "belfast" }, { id: "dublin" }],
      },
    ],
    effects: [irishCooled],
    caught: { pct: 30, scene: "gbr_a_i_castle_out", wait: 2 },
  },
  {
    id: "gbr_a_i_press",
    nation: NATION,
    kind: "intrigue",
    when: war,
    scene: "gbr_a_i_press_r",
    wait: 1,
    tell: ["opinion:+1"],
    effects: [opinion("press", 1)],
    fields: [
      {
        id: "how",
        options: [{ id: "feed" }, { id: "buy" }, { id: "warn" }],
      },
    ],
    caught: { pct: 40, scene: "gbr_a_i_press_out", wait: 2 },
  },
];

export const GBR_ACTS: readonly GwAct[] = [
  ...VISITS,
  ...LETTERS,
  ...ORDERS,
  ...SPEECHES,
  ...INTRIGUES,
];

const aim = (
  id: string,
  met: GwCond,
  tasks: string[],
  dropped: GwEffect[],
  when?: GwCond,
): GwAim => ({
  id,
  nation: NATION,
  ...(when === undefined ? {} : { when }),
  met,
  tasks,
  dropped,
});

export const GBR_AIMS: readonly GwAim[] = [
  aim(
    "gbr_aim_belgium",
    any(
      world({ is: "front", theatre: "west", from: "rhine", to: "liege" }),
      not(world({ is: "entered", tag: "BEL" })),
    ),
    ["gbr_belgium_restored", "gbr_sea_kept", "gbr_america_in"],
    [inst("commons", -1)],
  ),
  aim(
    "gbr_aim_win",
    world({ is: "peace_side", of: ["won"] }),
    ["gbr_america_in", "gbr_belgium_restored", "gbr_bread"],
    [inst("opposition", 1)],
  ),
  aim(
    "gbr_aim_sea",
    all(
      world({ is: "front", theatre: "sea", from: "blockade", to: "north_sea" }),
      {
        kind: "gauge",
        gauge: "money",
        min: 1,
      },
    ),
    ["gbr_sea_kept", "gbr_money_left", "gbr_bread"],
    [inst("opposition", 1)],
  ),
  aim(
    "gbr_aim_peace",
    world({ is: "neutral", tag: "GBR" }),
    ["gbr_no_war", "gbr_money_left", "gbr_bread"],
    [inst("cabinet", -1)],
    not(atDeu),
  ),
  aim(
    "gbr_aim_ireland",
    any(flag("f_home_rule_lives"), flag("f_ireland_settled")),
    ["gbr_ireland_settled", "gbr_quiet_shops", "gbr_cabinet_whole"],
    [inst("irish", -2)],
  ),
  aim(
    "gbr_aim_liberal",
    all(not(flag("f_gbr_conscript")), not(flag("f_pm_lg"))),
    ["gbr_no_draft", "gbr_keep_the_chair", "gbr_small_list"],
    [inst("cabinet", -1)],
  ),
];
