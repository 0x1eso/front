// RUS's schedule (원수의 일정) and aims (국가 목표); shapes in GwActs.ts.
// Words in resources/ww1914/ko/RUS.acts.json. The scenes they play are in
// scenes/rus_act.ts, with their text in RUS.act.json.
import type { GwAct, GwAim } from "@openfront/engine-api/ww1914/GwActs";
import {
  all,
  any,
  feud,
  GwCond,
  GwEffect,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

export { RUS_ACT_SCENES } from "../scenes/rus_act";

const war = world({ is: "war" });
const reign = world({ is: "regime", of: ["tsar", "crown"] });
const inWar = all(war, reign);
const date = (from?: string, to?: string): GwCond =>
  world({ is: "date", from, to });
const inst = (i: "court" | "stavka" | "duma" | "ministers", delta: number) =>
  ({ kind: "inst", inst: i, delta }) as GwEffect;
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });

const act = (
  id: string,
  kind: GwAct["kind"],
  scene: string,
  wait: number,
  more: Partial<GwAct> = {},
): GwAct => ({ id, nation: ["RUS"], kind, scene, wait, ...more });

const see = (
  fact: "force" | "shells" | "morale" | "mob",
  theatre?: "east" | "caucasus" | "sea",
): GwEffect =>
  doWorld(
    theatre === undefined
      ? { do: "inspect", fact, tag: "RUS" }
      : { do: "inspect", fact, tag: "RUS", theatre },
  );

const VISIT_REST = 8;
/** A visit steadies the streets where they had stirred (ww169). */
const calmed: GwEffect = {
  kind: "maybe",
  when: world({ is: "unrest", min: 1 }),
  then: [doWorld({ do: "calm", key: "visit_calmed" })],
};
const visit = (id: string, when: GwCond, effects: GwEffect[] = []): GwAct =>
  act(id, "visit", `${id}_s`, 0, { when, cooldown: VISIT_REST, effects });

const VISITS: GwAct[] = [
  visit("rus_a_v_putilov", reign, [see("shells")]),
  visit("rus_a_v_tula", reign, [see("shells")]),
  visit("rus_a_v_northwest", inWar, [see("force", "east")]),
  visit(
    "rus_a_v_galicia",
    all(
      inWar,
      world({ is: "front", theatre: "east", from: "oder", to: "east_prussia" }),
    ),
    [see("morale")],
  ),
  visit(
    "rus_a_v_caucasus",
    all(inWar, world({ is: "open", theatre: "caucasus" })),
    [see("force", "caucasus")],
  ),
  visit("rus_a_v_sevastopol", reign, [see("force", "sea")]),
  visit("rus_a_v_kronstadt", reign, [see("morale")]),
  visit("rus_a_v_hospital", inWar),
  visit(
    "rus_a_v_depots",
    all(inWar, world({ is: "war_months", own: true, min: 10 })),
    [
      see("morale"),
      {
        kind: "maybe",
        when: { kind: "secret", id: "rus_garrison_rotten" },
        then: [doWorld({ do: "reveal", id: "rus_garrison_rotten" })],
      },
    ],
  ),
  visit("rus_a_v_moscow", reign),
  visit("rus_a_v_volga", reign),
  visit(
    "rus_a_v_archangel",
    all(inWar, world({ is: "war_months", own: true, min: 5 })),
    [see("shells")],
  ),
  visit("rus_a_v_lavra", reign, [opinion("court", 1), calmed]),
  visit("rus_a_v_don", reign, [see("mob")]),
];

/** A list field whose options are stances: `tone_fits` reads them, the thread keeps them. */
const toneField = (who: string, tones: ("warm" | "frank" | "threat")[]) => ({
  id: "tone",
  options: tones.map((tone) => ({
    id: tone,
    effects: [
      {
        kind: "letter" as const,
        who: { person: who },
        tone,
      } satisfies GwEffect,
    ],
  })),
});

const atWarWith = (tag: "DEU" | "BGR"): GwCond => ({ kind: "at_war", tag });

const LETTERS: GwAct[] = [
  act("rus_a_l_willy", "letter", "rus_a_l_willy_r", 1, {
    when: all(reign, not(atWarWith("DEU"))),
    cooldown: 2,
    fields: [
      {
        id: "subject",
        options: [
          { id: "serbia" },
          { id: "mobilise" },
          {
            id: "hague",
            tell: ["temp:-1"],
            effects: [{ kind: "temp", delta: -1 }],
          },
        ],
      },
      toneField("deu_wilhelm", ["warm", "frank", "threat"]),
    ],
  }),
  act("rus_a_l_georgie", "letter", "rus_a_l_georgie_r", 1, {
    when: reign,
    fields: [
      {
        id: "subject",
        options: [
          { id: "persia" },
          { id: "guns", when: war },
          { id: "family" },
        ],
      },
      toneField("gbr_george_v", ["warm", "frank", "threat"]),
    ],
  }),
  act("rus_a_l_poincare", "letter", "rus_a_l_poincare_r", 1, {
    when: reign,
    effects: [{ kind: "letter", who: role("pres") }],
    fields: [
      {
        id: "subject",
        options: [
          { id: "offensive", when: war },
          { id: "loan" },
          { id: "alliance" },
        ],
      },
    ],
  }),
  act("rus_a_l_ferdinand", "letter", "rus_a_l_ferdinand_r", 1, {
    when: all(
      reign,
      not(atWarWith("BGR")),
      world({ is: "neutral", tag: "BGR" }),
    ),
    effects: [{ kind: "letter", who: role("tsar_bg") }],
    fields: [
      { id: "subject", options: [{ id: "brothers" }, { id: "macedonia" }] },
    ],
  }),
  act("rus_a_l_subject", "letter", "rus_a_l_subject_r", 1, {
    when: reign,
    cooldown: 2,
    fields: [
      { id: "to", people: "cabinet" },
      { id: "subject", options: [{ id: "thanks" }, { id: "truth" }] },
      { id: "tone", tones: ["warm", "frank", "threat"] },
    ],
  }),
  act("rus_a_l_mother", "letter", "rus_a_l_mother_r", 2, {
    when: inWar,
    fields: [
      {
        id: "whom",
        options: [
          { id: "widow", tell: ["morale:+1"], effects: [gauge("morale", 1)] },
          { id: "elder" },
          { id: "boy" },
        ],
      },
    ],
  }),
];

const ORDERS: GwAct[] = [
  act("rus_a_o_council", "order", "rus_a_o_council_s", 1, {
    when: reign,
    fields: [
      {
        id: "agenda",
        options: [{ id: "bread" }, { id: "shells" }, { id: "duma" }],
      },
      { id: "attend", people: "cabinet", count: 2 },
    ],
  }),
  act("rus_a_o_figures", "order", "rus_a_o_figures_s", 1, {
    when: reign,
    cooldown: 4,
    effects: [see("shells")],
    fields: [
      {
        id: "subject",
        options: [{ id: "shells" }, { id: "bread" }, { id: "rails" }],
      },
    ],
  }),
  act("rus_a_o_envoy", "order", "rus_a_o_envoy_s", 2, {
    when: reign,
    cooldown: 5,
    fields: [
      { id: "envoy", people: "own" },
      {
        id: "where",
        options: [
          {
            id: "paris",
            tell: ["fra:+1"],
            effects: [{ kind: "trust", tag: "FRA", delta: 1 }],
          },
          {
            id: "london",
            tell: ["gbr:+1"],
            effects: [{ kind: "trust", tag: "GBR", delta: 1 }],
          },
          { id: "bucharest" },
        ],
      },
    ],
  }),
  act("rus_a_o_aide", "order", "rus_a_o_aide_s", 1, {
    when: inWar,
    cooldown: 4,
    fields: [
      {
        id: "front",
        options: [
          { id: "northwest", effects: [see("force", "east")] },
          { id: "southwest", effects: [see("morale")] },
          { id: "caucasus", effects: [see("force", "caucasus")] },
        ],
      },
    ],
  }),
  act("rus_a_o_family", "order", "rus_a_o_family_s", 0, {
    when: reign,
    cooldown: 6,
    fields: [
      {
        id: "guest",
        options: [{ id: "mother" }, { id: "michael" }, { id: "nikolasha" }],
      },
      { id: "agenda", options: [{ id: "friend" }, { id: "family" }] },
    ],
  }),
  act("rus_a_o_generals", "order", "rus_a_o_generals_s", 1, {
    when: inWar,
    fields: [
      {
        id: "agenda",
        options: [{ id: "south" }, { id: "north" }, { id: "caucasus" }],
      },
      { id: "attend", people: "cabinet", count: 2 },
    ],
  }),
  act("rus_a_o_pension", "order", "rus_a_o_pension_s", 1, {
    when: all(inWar, world({ is: "war_months", own: true, min: 2 })),
    once: true,
    fields: [
      {
        id: "who_pays",
        options: [
          {
            id: "treasury",
            tell: ["money:-1", "morale:+1"],
            effects: [gauge("money", -1), gauge("morale", 1)],
          },
          {
            id: "church",
            tell: ["morale:+1", "court:-1"],
            effects: [gauge("morale", 1), inst("court", -1)],
          },
          {
            id: "zemstvo",
            tell: ["duma:+1", "morale:+1", "ministers:-1"],
            effects: [
              inst("duma", 1),
              gauge("morale", 1),
              inst("ministers", -1),
            ],
          },
        ],
      },
    ],
  }),
  act("rus_a_o_censor", "order", "rus_a_o_censor_s", 1, {
    when: all(inWar, reign),
    cooldown: 5,
    fields: [
      {
        id: "order",
        options: [
          { id: "ease", tell: ["censor:-1"], effects: [censor(-1)] },
          { id: "tighten", tell: ["censor:+1"], effects: [censor(1)] },
        ],
      },
    ],
  }),
];

const speech = (
  id: string,
  when: GwCond,
  fields: GwAct["fields"],
  cooldown = 6,
): GwAct => act(id, "speech", `${id}_s`, 0, { when, cooldown, fields });

const SPEECHES: GwAct[] = [
  speech(
    "rus_a_s_duma",
    reign,
    [
      {
        id: "place",
        options: [
          {
            id: "hall",
            tell: ["opinion:+1"],
            effects: [opinion("parliament", 1)],
          },
          {
            id: "rostrum",
            tell: ["duma:+2", "court:-1"],
            effects: [inst("duma", 2), inst("court", -1)],
          },
        ],
      },
      { id: "on", options: [{ id: "unity" }, { id: "trust" }] },
    ],
    20,
  ),
  speech("rus_a_s_kremlin", reign, [
    {
      id: "on",
      options: [
        {
          id: "war",
          when: war,
          tell: ["morale:+1"],
          effects: [gauge("morale", 1)],
        },
        {
          id: "bread",
          tell: ["opinion:+1"],
          effects: [opinion("business", 1)],
        },
      ],
    },
  ]),
  speech("rus_a_s_review", reign, [
    {
      id: "place",
      options: [
        { id: "guards", tell: ["opinion:+1"], effects: [opinion("army", 1)] },
        { id: "reserves", tell: ["morale:+1"], effects: [gauge("morale", 1)] },
      ],
    },
    { id: "on", options: [{ id: "thanks" }, { id: "duty" }] },
  ]),
  speech("rus_a_s_workers", reign, [
    {
      id: "on",
      options: [
        {
          id: "wages",
          tell: ["opinion:+1", "court:-1"],
          effects: [opinion("workers", 1), inst("court", -1)],
        },
        { id: "duty", tell: ["opinion:+1"], effects: [opinion("business", 1)] },
      ],
    },
  ]),
  speech("rus_a_s_zemstvo", reign, [
    {
      id: "on",
      options: [
        {
          id: "thanks",
          tell: ["duma:+1", "ministers:-1"],
          effects: [inst("duma", 1), inst("ministers", -1)],
        },
        {
          id: "limits",
          tell: ["court:+1", "duma:-1"],
          effects: [inst("court", 1), inst("duma", -1)],
        },
      ],
    },
  ]),
  speech("rus_a_s_cathedral", inWar, [
    {
      id: "on",
      options: [
        { id: "dead", tell: ["morale:+1"], effects: [gauge("morale", 1)] },
        { id: "victory", tell: ["opinion:+1"], effects: [opinion("court", 1)] },
      ],
    },
  ]),
];

const INTRIGUES: GwAct[] = [
  act("rus_a_i_mail", "intrigue", "rus_a_i_mail_s", 1, {
    when: reign,
    fields: [{ id: "who", people: "cabinet" }],
    // What the opened letters held goes to the police's file on him.
    effects: [doWorld({ do: "file", who: { role: "t" } })],
    caught: { pct: 25, scene: "rus_a_i_mail_out", wait: 2 },
  }),
  act("rus_a_i_set_on", "intrigue", "rus_a_i_set_on_s", 1, {
    when: reign,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [feud(role("a"), role("b"))],
    caught: { pct: 30, scene: "rus_a_i_set_on_out", wait: 2 },
  }),
  act("rus_a_i_rumour", "intrigue", "rus_a_i_rumour_s", 1, {
    when: inWar,
    effects: [rumour(1)],
    fields: [
      {
        id: "which",
        options: [
          { id: "offensive", effects: [opinion("army", 1)] },
          {
            id: "duma",
            effects: [opinion("parliament", -1), opinion("court", 1)],
          },
          { id: "peace", effects: [opinion("workers", 1)] },
        ],
      },
    ],
    caught: { pct: 30, scene: "rus_a_i_rumour_out", wait: 2 },
  }),
  act("rus_a_i_agent", "intrigue", "rus_a_i_agent_s", 2, {
    when: reign,
    cooldown: 5,
    fields: [
      {
        id: "where",
        options: [
          { id: "duma" },
          { id: "factory" },
          {
            id: "club",
            when: date("1915-06"),
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "rus_palace_plot" },
                then: [doWorld({ do: "reveal", id: "rus_palace_plot" })],
              },
            ],
          },
        ],
      },
    ],
    caught: { pct: 25, scene: "rus_a_i_agent_out", wait: 2 },
  }),
  act("rus_a_i_paper", "intrigue", "rus_a_i_paper_s", 1, {
    when: reign,
    cooldown: 6,
    tell: ["money:-1", "opinion:+1"],
    effects: [gauge("money", -1), opinion("press", 1)],
    fields: [{ id: "which", options: [{ id: "nv" }, { id: "wire" }] }],
    caught: { pct: 35, scene: "rus_a_i_paper_out", wait: 3 },
  }),
  act("rus_a_i_feeler", "intrigue", "rus_a_i_feeler_s", 2, {
    when: all(inWar, world({ is: "war_months", own: true, min: 7 })),
    cooldown: 8,
    effects: [
      {
        kind: "maybe",
        when: { kind: "secret", id: "rus_german_feeler" },
        then: [doWorld({ do: "reveal", id: "rus_german_feeler" })],
      },
    ],
    caught: { pct: 20, scene: "rus_a_i_feeler_out", wait: 2 },
  }),
];

export const RUS_ACTS: readonly GwAct[] = [
  ...VISITS,
  ...LETTERS,
  ...ORDERS,
  ...SPEECHES,
  ...INTRIGUES,
];

const inPeace = not(war);
const duma = (min: number): GwCond => ({ kind: "inst", inst: "duma", min });
const crown = world({ is: "regime", of: ["crown"] });

const aim = (
  id: string,
  met: GwCond,
  tasks: string[],
  more: Partial<GwAim> = {},
): GwAim => ({ id, nation: ["RUS"], met, tasks, ...more });

export const RUS_AIMS: readonly GwAim[] = [
  aim("rus_aim_peace", inPeace, ["rus_no_great_war", "rus_duma_sits"], {
    when: inPeace,
    dropped: [inst("ministers", -1)],
  }),
  aim(
    "rus_aim_serbia",
    all(
      not(world({ is: "out", tag: "SRB" })),
      world({ is: "front", theatre: "east", from: "oder", to: "east_prussia" }),
    ),
    ["rus_serbia_stands", "rus_galicia_held"],
    { dropped: [inst("stavka", -1)] },
  ),
  aim(
    "rus_aim_tsargrad",
    any(
      { kind: "chose", scene: "rus_h_straits_note" },
      world({
        is: "front",
        theatre: "straits",
        from: "narrows",
        to: "constantinople",
      }),
    ),
    ["rus_straits_paper", "rus_army_is_mine"],
    { dropped: [inst("duma", -1)] },
  ),
  aim(
    "rus_aim_throne",
    world({ is: "regime", of: ["tsar"] }),
    ["rus_heir_succeeds", "rus_army_is_mine", "rus_four_ears"],
    { dropped: [inst("court", -2)] },
  ),
  aim(
    "rus_aim_trust",
    any(crown, all(duma(1), { kind: "inst", inst: "ministers", min: 0 })),
    ["rus_duma_sits", "rus_four_ears"],
    { dropped: [inst("duma", -2)] },
  ),
  aim(
    "rus_aim_bread",
    all(
      { kind: "gauge", gauge: "bread", min: 1 },
      world({ is: "unrest", max: 0 }),
    ),
    ["rus_bread_in_capital", "rus_streets_quiet", "rus_small_lists"],
    { dropped: [gauge("order", -1)] },
  ),
];
