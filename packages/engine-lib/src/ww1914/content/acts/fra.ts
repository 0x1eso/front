import { gwFirstLine } from "@openfront/engine-api/ww1914/GreatWarTypes";
// France's schedule (원수의 일정) and aims (국가 목표); shapes in GwActs.ts.
// Text in resources/ww1914/ko/FRA.acts.json. Their scenes are in scenes/fra_act.ts.
// Lane W8 (ww166-format.md).
//
// The seat is the President of the Republic: he names the premier, presides
// over the Council of Ministers, writes, visits, persuades. Every act of his
// needs a minister's countersignature, so the schedule is about going and
// seeing, writing, asking and calling people in, never about signing orders.
// Options show no results before the pick (owner's rule): no `tell`.
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

import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { FRA_CEREMONY_SCENES } from "../depts/fra";
import { FRA_ACT_SCENES as SCHEDULE_SCENES } from "../scenes/fra_act";

/** The schedule's scenes, with ww193's ceremonies (written in depts/fra.ts). */
export const FRA_ACT_SCENES: readonly GwScene[] = [
  ...SCHEDULE_SCENES,
  ...FRA_CEREMONY_SCENES,
];

const NATION: GwAct["nation"] = ["FRA"];
const war = world({ is: "war" });
const atDeu: GwCond = { kind: "at_war", tag: "DEU" };
const notWar = not(war);
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const tiger = flag("f_pm_clemenceau");
const from = (min: string): GwCond => world({ is: "date", from: min });
const chapters = (min: number): GwCond => ({ kind: "chapter", min });
const active = (person: string): GwCond => ({ kind: "person_active", person });
const westNotPast = (line: string): GwCond =>
  world({ is: "front", theatre: "west", from: gwFirstLine("west"), to: line });
const inspect = (
  fact: "force" | "shells" | "morale",
  tag: "FRA" | "DEU",
  theatre?: "west",
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
  bloc: "army" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const inst = (
  i: "chamber" | "senate" | "countersign" | "army",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const trust = (
  tag: "GBR" | "RUS" | "ITA" | "USA",
  delta: number,
): GwEffect => ({ kind: "trust", tag, delta });
const tones = (...t: ("warm" | "cold" | "threat" | "flatter" | "frank")[]) => ({
  id: "tone",
  tones: t,
});
/** A seat secret found on the way, when it is in this game. */
const reveal = (
  id: "fra_toul_verdun" | "fra_rubicon_papers" | "fra_bolo_money",
  when: GwCond,
): GwEffect =>
  maybe(all({ kind: "secret", id }, when), doWorld({ do: "reveal", id }));

/** A visit steadies the streets where they had stirred (ww169). */
const calmed = maybe(
  world({ is: "unrest", min: 1 }),
  doWorld({ do: "calm", key: "visit_calmed" }),
);
/** A contact abroad who can carry peace: the terms can ask a neutral to mediate. */
const mediator: GwEffect = { kind: "flag", flag: "gw_mediator" };
const thinks = (person: string, delta: number): GwEffect => ({
  kind: "person_trust",
  who: { person },
  delta,
});

// ---- 시찰: one entry a place ----

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
  visit("fra_a_verdun", undefined, [
    inspect("force", "FRA", "west"),
    inspect("morale", "FRA"),
  ]),
  visit("fra_a_reims", war, [opinion("press", 1), calmed]),
  visit("fra_a_creusot", undefined, [inspect("shells", "FRA")]),
  visit(
    "fra_a_refugees",
    all(war, world({ is: "war_months", own: true, min: 2 })),
  ),
  visit(
    "fra_a_colonial",
    all(war, world({ is: "war_months", own: true, min: 11 })),
    [inspect("morale", "FRA")],
  ),
  visit("fra_a_nancy", undefined, [inspect("morale", "FRA")]),
  visit("fra_a_dunkirk", war, [inspect("force", "FRA", "west")]),
  visit("fra_a_barleduc", undefined, [
    opinion("army", 1),
    maybe(war, {
      kind: "person_trust",
      who: { office: "chief_of_staff" },
      delta: 1,
    }),
    calmed,
  ]),
  visit("fra_a_sampigny", undefined, [opinion("press", 1), calmed]),
  visit(
    "fra_a_thann",
    all(
      war,
      world({ is: "war_months", own: true, min: 1 }),
      westNotPast("aisne"),
    ),
  ),
  visit(
    "fra_a_factory",
    all(war, world({ is: "war_months", own: true, min: 5 })),
    [inspect("shells", "FRA")],
  ),
  visit("fra_a_hospital", war, [inspect("morale", "FRA")]),
  visit("fra_a_bordeaux", war, [opinion("parliament", 1), calmed]),
  visit(
    "fra_a_chantilly",
    all(atDeu, world({ is: "war_months", own: true, min: 3 })),
    [
      inspect("morale", "FRA"),
      inspect("force", "FRA", "west"),
      inspect("force", "DEU", "west"),
    ],
  ),
];

// ---- 친서: to the cousins' thrones, and to two men of his own ----

const LETTERS: GwAct[] = [
  {
    id: "fra_a_l_georgie",
    nation: NATION,
    kind: "letter",
    scene: "fra_a_l_georgie_r",
    wait: 1,
    effects: [{ kind: "letter", who: role("king") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "visit" },
          { id: "solidarity", when: crisis },
          { id: "troops", when: war },
          { id: "command", when: all(war, from("1916-01")) },
        ],
      },
      tones("warm", "frank", "flatter"),
    ],
  },
  {
    id: "fra_a_l_nicky",
    nation: NATION,
    kind: "letter",
    scene: "fra_a_l_nicky_r",
    wait: 1,
    effects: [{ kind: "letter", who: role("tsar") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "visit" },
          { id: "mobilise", when: crisis },
          { id: "offensive", when: war },
          { id: "rifles", when: all(war, from("1915-03")) },
        ],
      },
      tones("warm", "frank", "cold"),
    ],
  },
  {
    id: "fra_a_l_wilson",
    nation: NATION,
    kind: "letter",
    when: all(war, not({ kind: "at_war", tag: "USA" })),
    scene: "fra_a_l_wilson_r",
    wait: 2,
    effects: [{ kind: "letter", who: role("pres") }],
    fields: [
      {
        id: "subject",
        options: [{ id: "loans" }, { id: "ships" }, { id: "peace" }],
      },
      tones("warm", "frank", "flatter"),
    ],
  },
  {
    id: "fra_a_l_alfonso",
    nation: NATION,
    kind: "letter",
    when: war,
    scene: "fra_a_l_alfonso_r",
    wait: 2,
    effects: [{ kind: "letter", who: role("king") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "prisoners" },
          { id: "civilians", when: chapters(8) },
          { id: "peace" },
        ],
      },
      tones("warm", "flatter", "frank"),
    ],
  },
  {
    id: "fra_a_l_chief",
    nation: NATION,
    kind: "letter",
    when: all(war, not({ kind: "office_empty", office: "chief_of_staff" })),
    scene: "fra_a_l_chief_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "deputies" },
          { id: "losses" },
          { id: "leave", when: from("1915-01") },
        ],
      },
      tones("warm", "frank", "cold"),
    ],
  },
  {
    id: "fra_a_l_tiger",
    nation: NATION,
    kind: "letter",
    when: all(active("fra_clemenceau"), not(tiger)),
    scene: "fra_a_l_tiger_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "old" },
          { id: "paper", when: war },
          { id: "commission", when: all(war, from("1915-01")) },
        ],
      },
      tones("frank", "cold", "flatter"),
    ],
  },
];

// ---- 지시: the Council, an inquiry, an envoy, people called in ----

const attend = { id: "attend", people: "cabinet", count: 2 } as const;

const ORDERS: GwAct[] = [
  {
    id: "fra_a_o_council",
    nation: NATION,
    kind: "order",
    scene: "fra_a_o_council_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [
          { id: "army_law", when: notWar },
          { id: "front", when: war },
          { id: "money" },
          { id: "bread", when: war },
        ],
      },
      attend,
    ],
  },
  {
    id: "fra_a_o_inquiry",
    nation: NATION,
    kind: "order",
    scene: "fra_a_o_inquiry_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          { id: "forts" },
          { id: "shells", effects: [inspect("shells", "FRA")] },
          {
            id: "cipher",
            when: any(crisis, war),
            effects: [reveal("fra_toul_verdun", war)],
          },
          {
            id: "papers",
            when: all(war, from("1915-07")),
            effects: [reveal("fra_bolo_money", from("1916-07"))],
          },
        ],
      },
    ],
  },
  {
    id: "fra_a_o_envoy",
    nation: NATION,
    kind: "order",
    when: any(war, crisis),
    scene: "fra_a_o_envoy_r",
    wait: 2,
    fields: [
      { id: "envoy", people: "own" },
      {
        id: "where",
        options: [
          { id: "london", effects: [trust("GBR", 1)] },
          { id: "petrograd", effects: [trust("RUS", 1)] },
          { id: "rome", effects: [trust("ITA", 1)] },
          {
            id: "washington",
            when: from("1915-01"),
            effects: [trust("USA", 1)],
          },
        ],
      },
    ],
  },
  {
    id: "fra_a_o_presidents",
    nation: NATION,
    kind: "order",
    cooldown: 5,
    when: all(active("fra_deschanel"), active("fra_dubost")),
    scene: "fra_a_o_presidents_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [
          { id: "mood" },
          { id: "secret_sitting", when: all(war, from("1915-07")) },
          { id: "next_premier" },
        ],
      },
    ],
  },
  {
    id: "fra_a_o_mission",
    nation: NATION,
    kind: "order",
    when: all(war, world({ is: "war_months", own: true, min: 2 })),
    scene: "fra_a_o_mission_r",
    wait: 1,
    fields: [
      {
        id: "who",
        options: [{ id: "commission" }, { id: "rapporteur" }],
      },
    ],
  },
  {
    id: "fra_a_o_dinner",
    nation: NATION,
    kind: "order",
    cooldown: 5,
    scene: "fra_a_o_dinner_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [{ id: "nothing" }, { id: "union", when: war }, { id: "law" }],
      },
      attend,
    ],
  },
  {
    id: "fra_a_o_premier",
    nation: NATION,
    kind: "order",
    cooldown: 4,
    when: not({ kind: "office_empty", office: "chancellor" }),
    scene: "fra_a_o_premier_r",
    wait: 0,
    fields: [
      {
        id: "agenda",
        options: [
          { id: "week" },
          { id: "minister" },
          { id: "front", when: war },
        ],
      },
    ],
  },
  {
    id: "fra_a_o_pardons",
    nation: NATION,
    kind: "order",
    when: all(war, world({ is: "war_months", own: true, min: 5 })),
    scene: "fra_a_o_pardons_r",
    wait: 1,
    fields: [
      {
        id: "how",
        options: [{ id: "each_file" }, { id: "commute" }],
      },
    ],
  },
];

// ---- 연설: where, and on what ----

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
  speech("fra_a_s_message", undefined, [
    {
      id: "place",
      options: [
        { id: "chamber", effects: [opinion("parliament", 1)] },
        { id: "senate", effects: [inst("senate", 1)] },
      ],
    },
    {
      id: "on",
      options: [
        { id: "union", when: war },
        { id: "army_law", when: notWar },
        { id: "right" },
      ],
    },
  ]),
  speech("fra_a_s_july14", undefined, [
    {
      id: "place",
      options: [
        { id: "longchamp", effects: [opinion("army", 1)] },
        { id: "invalides", effects: [opinion("press", 1)] },
      ],
    },
    {
      id: "on",
      options: [{ id: "army" }, { id: "dead", when: war }, { id: "republic" }],
    },
  ]),
  speech("fra_a_s_sorbonne", undefined, [
    {
      id: "place",
      options: [
        { id: "sorbonne", effects: [opinion("press", 1)] },
        { id: "town_hall", effects: [opinion("workers", 1)] },
      ],
    },
    {
      id: "on",
      options: [{ id: "right" }, { id: "allies", when: war }, { id: "youth" }],
    },
  ]),
  speech(
    "fra_a_s_thann",
    all(
      war,
      world({ is: "war_months", own: true, min: 1 }),
      westNotPast("aisne"),
    ),
    [
      {
        id: "place",
        options: [
          { id: "thann", effects: [gauge("morale", 1)] },
          { id: "belfort", effects: [opinion("army", 1)] },
        ],
      },
      {
        id: "on",
        options: [{ id: "return" }, { id: "schools" }],
      },
    ],
  ),
  speech("fra_a_s_nancy", undefined, [
    {
      id: "place",
      options: [
        { id: "nancy", effects: [gauge("morale", 1)] },
        { id: "bar_le_duc", effects: [opinion("parliament", 1)] },
      ],
    },
    {
      id: "on",
      options: [{ id: "lorraine" }, { id: "endure", when: war }],
    },
  ]),
  speech("fra_a_s_strasbourg", world({ is: "armistice" }), [
    {
      id: "place",
      options: [
        { id: "strasbourg", effects: [opinion("press", 1)] },
        { id: "metz", effects: [opinion("army", 1)] },
      ],
    },
    {
      id: "on",
      options: [{ id: "return" }, { id: "dead" }],
    },
  ]),
];

// ---- 뒷공작: found out, the price comes on top ----

const INTRIGUES: GwAct[] = [
  {
    id: "fra_a_i_leak",
    nation: NATION,
    kind: "intrigue",
    scene: "fra_a_i_leak_r",
    wait: 1,
    effects: [rumour(1)],
    fields: [
      {
        id: "what",
        options: [
          { id: "army_law", when: notWar },
          { id: "premier" },
          { id: "gqg", when: war },
        ],
      },
    ],
    caught: { pct: 30, scene: "fra_a_i_leak_out", wait: 2 },
  },
  {
    id: "fra_a_i_police",
    nation: NATION,
    kind: "intrigue",
    scene: "fra_a_i_police_r",
    wait: 1,
    fields: [
      {
        id: "who",
        options: [
          {
            id: "caillaux",
            when: active("fra_caillaux"),
            effects: [reveal("fra_rubicon_papers", from("1916-07"))],
          },
          { id: "clemenceau", when: active("fra_clemenceau") },
          { id: "left" },
        ],
      },
    ],
    caught: { pct: 35, scene: "fra_a_i_police_out", wait: 2 },
  },
  {
    id: "fra_a_i_set_on",
    nation: NATION,
    kind: "intrigue",
    scene: "fra_a_i_set_on_r",
    wait: 1,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [feud(role("a"), role("b"))],
    caught: { pct: 35, scene: "fra_a_i_set_on_out", wait: 2 },
  },
  {
    id: "fra_a_i_sound",
    nation: NATION,
    kind: "intrigue",
    scene: "fra_a_i_sound_r",
    wait: 1,
    fields: [
      {
        id: "who",
        options: [
          // Sounded for the next government, the man takes it as a mark of favour.
          {
            id: "briand",
            when: all(active("fra_briand"), not(flag("f_pm_briand"))),
            effects: [thinks("fra_briand", 1)],
          },
          {
            id: "ribot",
            when: all(active("fra_ribot"), not(flag("f_pm_ribot"))),
            effects: [thinks("fra_ribot", 1)],
          },
          { id: "barthou", effects: [thinks("fra_barthou", 1)] },
        ],
      },
    ],
    caught: { pct: 30, scene: "fra_a_i_sound_out", wait: 2 },
  },
  {
    id: "fra_a_i_general",
    nation: NATION,
    kind: "intrigue",
    when: all(war, world({ is: "war_months", own: true, min: 1 })),
    scene: "fra_a_i_general_r",
    wait: 1,
    fields: [
      {
        id: "who",
        options: [
          {
            id: "castelnau",
            when: active("fra_castelnau"),
            effects: [
              doWorld({ do: "file", who: { person: "fra_castelnau" } }),
            ],
          },
          {
            id: "foch",
            when: active("fra_foch"),
            effects: [doWorld({ do: "file", who: { person: "fra_foch" } })],
          },
          {
            id: "army_doctor",
            effects: [doWorld({ do: "inspect", fact: "morale", tag: "FRA" })],
          },
        ],
      },
    ],
    caught: { pct: 30, scene: "fra_a_i_general_out", wait: 2 },
  },
  {
    id: "fra_a_i_geneva",
    nation: NATION,
    kind: "intrigue",
    when: war,
    scene: "fra_a_i_geneva_r",
    wait: 2,
    fields: [
      {
        id: "where",
        options: [{ id: "geneva" }, { id: "madrid" }, { id: "berne" }],
      },
    ],
    effects: [mediator],
    caught: { pct: 20, scene: "fra_a_i_geneva_out", wait: 3 },
  },
];

// ---- 의식 (ww193): the order's grand master, the review, the Invalides ----

const paris = world({ is: "held", place: "paris", by: "us" });

const CEREMONIES: GwAct[] = [
  {
    // #1, #12: the President pins the Légion on men, flags and cities.
    id: "fra_a_c_investiture",
    nation: NATION,
    kind: "ceremony",
    when: all(war, world({ is: "war_months", own: true, min: 3 })),
    cooldown: 6,
    scene: "fra_a_c_investiture_r",
    wait: 0,
    effects: [opinion("army", 1)],
    fields: [
      {
        id: "where",
        options: [
          { id: "front", effects: [gauge("morale", 1)] },
          {
            id: "city",
            when: world({ is: "war_months", own: true, min: 18 }),
            effects: [opinion("press", 1), calmed],
          },
          { id: "elysee", when: paris, effects: [inst("countersign", 1)] },
        ],
      },
    ],
  },
  {
    id: "fra_a_c_review",
    nation: NATION,
    kind: "ceremony",
    when: all(war, paris),
    cooldown: 8,
    scene: "fra_a_c_review_r",
    wait: 0,
    effects: [opinion("press", 1)],
    fields: [
      {
        id: "who",
        options: [
          { id: "own", effects: [opinion("army", 1)] },
          {
            id: "allies",
            when: any(
              world({ is: "entered", tag: "GBR", side: "entente" }),
              world({ is: "entered", tag: "USA", side: "entente" }),
            ),
            effects: [
              maybe(
                world({ is: "entered", tag: "USA", side: "entente" }),
                trust("USA", 1),
              ),
              maybe(
                world({ is: "entered", tag: "GBR", side: "entente" }),
                trust("GBR", 1),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fra_a_c_invalides",
    nation: NATION,
    kind: "ceremony",
    when: all(war, paris, world({ is: "war_months", own: true, min: 10 })),
    cooldown: 10,
    scene: "fra_a_c_invalides_r",
    wait: 0,
    effects: [gauge("morale", 1), opinion("parliament", 1), calmed],
  },
];

/** ww193: the far visits are trips (two of the time, the room shut). */
const TRIPS = new Set(["fra_a_thann", "fra_a_dunkirk"]);

export const FRA_ACTS: readonly GwAct[] = [
  ...VISITS.map((a) => (TRIPS.has(a.id) ? { ...a, trip: true } : a)),
  ...LETTERS,
  ...ORDERS,
  ...SPEECHES,
  ...INTRIGUES,
  ...CEREMONIES,
];

// ---- 국가 목표: what the President could say France is fighting for ----

const aim = (
  id: string,
  met: GwCond,
  tasks: string[],
  dropped: GwEffect[],
): GwAim => ({ id, nation: NATION, met, tasks, dropped });
const won = world({ is: "peace_side", of: ["won"] });

/** Mandate ids are lane W5's (`GW_MANDATES.FRA`, plan §11.1). */
export const FRA_AIMS: readonly GwAim[] = [
  aim(
    "fra_aim_alsace",
    any(won, westNotPast("rhine")),
    ["fra_alsace", "fra_paris_held", "fra_union_kept"],
    [inst("chamber", -1)],
  ),
  aim(
    "fra_aim_rhine",
    all(won, westNotPast("rhine")),
    ["fra_rhine", "fra_alsace", "fra_america_in"],
    [opinion("army", -1)],
  ),
  aim(
    "fra_aim_guarantee",
    all(
      world({ is: "entered", tag: "GBR", side: "entente" }),
      world({ is: "entered", tag: "USA", side: "entente" }),
    ),
    ["fra_britain_in", "fra_america_in", "fra_money_left"],
    [inst("countersign", -1)],
  ),
  aim(
    "fra_aim_levant",
    any(
      world({
        is: "front",
        theatre: "palestine",
        from: "damascus",
        to: "damascus",
      }),
      all(won, world({ is: "entered", tag: "OTT" })),
    ),
    ["fra_britain_in", "fra_money_left", "fra_small_list"],
    [inst("senate", -1)],
  ),
  aim(
    "fra_aim_reparations",
    all(won, westNotPast("hindenburg")),
    ["fra_money_left", "fra_bread", "fra_quiet_shops"],
    [inst("chamber", -1)],
  ),
  aim(
    "fra_aim_peace",
    any(notWar, all(world({ is: "armistice" }), not(from("1917-07")))),
    ["fra_small_list", "fra_bread", "fra_president_heard"],
    [opinion("army", -1), inst("chamber", 1)],
  ),
];
