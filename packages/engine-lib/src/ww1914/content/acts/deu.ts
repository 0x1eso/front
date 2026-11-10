// DEU's schedule (원수의 일정) and aims (국가 목표); shapes in GwActs.ts.
// Text in resources/ww1914/ko/DEU.acts.json; the scenes they play are in
// scenes/deu_act.ts.
import type {
  GwAct,
  GwActField,
  GwActOption,
  GwAim,
} from "@openfront/engine-api/ww1914/GwActs";
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
import { DEU_ACT_SCENES } from "../scenes/deu_act";

export { DEU_ACT_SCENES };

const war = world({ is: "war" });
const atWar = (tag: "RUS" | "FRA" | "GBR"): GwCond => ({ kind: "at_war", tag });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });

type Findable =
  | "deu_shell_stock_thin"
  | "deu_fleet_plan_oct"
  | "deu_food_books"
  | "rus_rail_ahead"
  | "deu_heir_ring"
  | "deu_table_wrong";

/** A secret that isn't in this game can't be found. */
const find = (id: Findable): GwEffect => ({
  kind: "maybe",
  when: { kind: "secret", id },
  then: [doWorld({ do: "reveal", id })],
});

const good = (who: string): GwCond => ({
  kind: "competence",
  who: role(who),
  field: "politics",
  min: 3,
});

/** A visit steadies the streets where they had stirred (ww169). */
const calmed: GwEffect = {
  kind: "maybe",
  when: world({ is: "unrest", min: 1 }),
  then: [doWorld({ do: "calm", key: "visit_calmed" })],
};

/** What the declared aim makes the people who care about it say of a talk. */
const aimSays = (aim: string, ...moves: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when: { kind: "aim", of: [aim] },
  then: moves,
});

const visit = (
  id: string,
  x: Omit<GwAct, "id" | "nation" | "kind" | "scene" | "wait">,
): GwAct => ({
  id,
  nation: ["DEU"],
  kind: "visit",
  scene: `${id}_v`,
  wait: 0,
  cooldown: 6,
  ...x,
});

const tones: GwActField = { id: "tone", tones: ["warm", "frank", "threat"] };
/** The letter joins the thread with this ruler, in the tone picked. */
const wrote: GwEffect = { kind: "letter", who: role("other") };

const speech = (
  id: string,
  x: Pick<GwAct, "stage" | "when">,
  on: GwActOption[],
): GwAct => ({
  id,
  nation: ["DEU"],
  kind: "speech",
  scene: `${id}_r`,
  wait: 0,
  cooldown: 5,
  fields: [{ id: "on", options: on }],
  ...x,
});

export const DEU_ACTS: readonly GwAct[] = [
  // 시찰
  visit("deu_a_krupp", {
    effects: [
      doWorld({ do: "inspect", fact: "shells", tag: "DEU" }),
      find("deu_shell_stock_thin"),
    ],
  }),
  visit("deu_a_fleet", {
    effects: [
      doWorld({ do: "inspect", fact: "morale", tag: "DEU" }),
      {
        kind: "maybe",
        when: world({ is: "date", from: "1918-06" }),
        then: [find("deu_fleet_plan_oct")],
      },
    ],
  }),
  visit("deu_a_west", {
    when: atWar("FRA"),
    effects: [
      doWorld({ do: "inspect", fact: "force", tag: "FRA", theatre: "west" }),
    ],
  }),
  visit("deu_a_east", {
    when: atWar("RUS"),
    effects: [
      doWorld({ do: "inspect", fact: "force", tag: "RUS", theatre: "east" }),
    ],
  }),
  visit("deu_a_hospital", { when: war }),
  visit("deu_a_ruhr", {
    effects: [doWorld({ do: "inspect", fact: "morale", tag: "DEU" })],
  }),
  visit("deu_a_hamburg", { effects: [opinion("business", 1), calmed] }),
  visit("deu_a_market", { when: war, effects: [find("deu_food_books")] }),
  visit("deu_a_alsace", {}),
  visit("deu_a_prussia", { effects: [opinion("army", 1), calmed] }),
  visit("deu_a_zeppelin", { effects: [opinion("press", 1), calmed] }),
  visit("deu_a_staff", {
    // Russia's timetable matters until the seat's war is a few months old.
    when: any(
      not(atWar("RUS")),
      world({ is: "war_months", own: true, max: 4 }),
    ),
    effects: [
      doWorld({ do: "inspect", fact: "mob", tag: "RUS" }),
      find("rus_rail_ahead"),
    ],
  }),
  visit("deu_a_heir", {
    when: all(war, { kind: "person_active", person: "deu_heir" }),
    effects: [find("deu_heir_ring")],
  }),
  visit("deu_a_oppau", { when: war }),

  // 친서
  {
    id: "deu_a_nicky",
    nation: ["DEU"],
    kind: "letter",
    scene: "deu_a_nicky_r",
    effects: [wrote],
    wait: 1,
    cooldown: 4,
    fields: [
      {
        id: "subject",
        options: [
          { id: "serbia", when: not(war) },
          { id: "family" },
          { id: "peace", when: war },
        ],
      },
      tones,
    ],
  },
  {
    id: "deu_a_georgie",
    nation: ["DEU"],
    kind: "letter",
    scene: "deu_a_georgie_r",
    effects: [wrote],
    wait: 1,
    cooldown: 4,
    fields: [
      {
        id: "subject",
        options: [
          { id: "fleet" },
          { id: "family" },
          { id: "prisoners", when: war },
        ],
      },
      tones,
    ],
  },
  {
    id: "deu_a_vienna",
    nation: ["DEU"],
    kind: "letter",
    scene: "deu_a_vienna_r",
    effects: [wrote],
    wait: 1,
    cooldown: 4,
    fields: [
      {
        id: "subject",
        options: [{ id: "rome" }, { id: "bread" }, { id: "peace", when: war }],
      },
      tones,
    ],
  },
  {
    id: "deu_a_wilson",
    nation: ["DEU"],
    kind: "letter",
    when: all(war, world({ is: "neutral", tag: "USA" })),
    scene: "deu_a_wilson_r",
    effects: [wrote],
    wait: 2,
    cooldown: 5,
    fields: [
      { id: "subject", options: [{ id: "peace" }, { id: "uboat" }] },
      tones,
    ],
  },
  {
    id: "deu_a_to_chan",
    nation: ["DEU"],
    kind: "letter",
    scene: "deu_a_to_chan_r",
    wait: 1,
    cooldown: 5,
    fields: [
      { id: "subject", options: [{ id: "trust" }, { id: "truth" }] },
      { id: "tone", tones: ["warm", "cold", "frank"] },
    ],
  },
  {
    id: "deu_a_to_haase",
    nation: ["DEU"],
    kind: "letter",
    when: { kind: "person_active", person: "deu_haase" },
    scene: "deu_a_to_haase_r",
    wait: 1,
    once: true,
    fields: [
      { id: "subject", options: [{ id: "credits" }, { id: "bread" }] },
      { id: "tone", tones: ["warm", "cold", "frank"] },
    ],
  },

  // 칙령과 지시
  {
    id: "deu_a_inquiry",
    nation: ["DEU"],
    kind: "order",
    scene: "deu_a_inquiry_r",
    wait: 1,
    fields: [
      {
        id: "subject",
        options: [
          {
            id: "shells",
            effects: [
              doWorld({ do: "inspect", fact: "shells", tag: "DEU" }),
              find("deu_shell_stock_thin"),
            ],
          },
          { id: "bread", when: war, effects: [find("deu_food_books")] },
          {
            id: "tonnage",
            when: all(war, atWar("GBR")),
            effects: [find("deu_table_wrong")],
          },
          { id: "wounded", when: war },
        ],
      },
    ],
  },
  {
    id: "deu_a_envoy",
    nation: ["DEU"],
    kind: "order",
    scene: "deu_a_envoy_r",
    wait: 1,
    cooldown: 4,
    fields: [
      { id: "envoy", people: "own" },
      {
        id: "where",
        options: [
          {
            id: "rome",
            effects: [
              {
                kind: "maybe",
                when: good("envoy"),
                then: [doWorld({ do: "readiness", tag: "ITA", delta: -5 })],
              },
            ],
          },
          {
            id: "stamboul",
            effects: [
              {
                kind: "maybe",
                when: good("envoy"),
                then: [doWorld({ do: "readiness", tag: "OTT", delta: 5 })],
              },
            ],
          },
          {
            id: "vienna",
            effects: [
              {
                kind: "maybe",
                when: good("envoy"),
                then: [{ kind: "trust", tag: "AUH", delta: 1 }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "deu_a_council",
    nation: ["DEU"],
    kind: "order",
    scene: "deu_a_council_r",
    wait: 1,
    fields: [
      {
        id: "agenda",
        options: [{ id: "food" }, { id: "shells" }, { id: "front", when: war }],
      },
      { id: "attend", people: "cabinet", count: 2 },
    ],
  },
  {
    id: "deu_a_crown",
    nation: ["DEU"],
    kind: "order",
    stage: ["crisis"],
    scene: "deu_a_crown_r",
    wait: 1,
    cooldown: 2,
    fields: [
      { id: "agenda", options: [{ id: "russia" }, { id: "britain" }] },
      { id: "attend", people: "cabinet", count: 3 },
    ],
  },
  {
    id: "deu_a_aimtalk",
    nation: ["DEU"],
    kind: "order",
    when: {
      kind: "aim",
      of: [
        "deu_aim_peace",
        "deu_aim_win",
        "deu_aim_mitteleuropa",
        "deu_aim_east",
        "deu_aim_sea",
        "deu_aim_home",
        "deu_aim_crown",
      ],
    },
    scene: "deu_a_aimtalk_r",
    wait: 1,
    cooldown: 6,
    effects: [
      aimSays("deu_aim_peace", opinion("workers", 1), opinion("army", -1)),
      aimSays("deu_aim_win", opinion("army", 1)),
      aimSays("deu_aim_mitteleuropa", opinion("business", 1)),
      aimSays("deu_aim_east", opinion("army", 1), opinion("court", 1)),
      aimSays("deu_aim_sea", opinion("business", 1), opinion("press", 1)),
      aimSays(
        "deu_aim_home",
        opinion("parliament", 1),
        opinion("workers", 1),
        opinion("court", -1),
      ),
      aimSays("deu_aim_crown", opinion("court", 1), opinion("parliament", -1)),
    ],
  },
  {
    id: "deu_a_table",
    nation: ["DEU"],
    kind: "order",
    when: all(war, { kind: "gauge", gauge: "bread", max: 2 }),
    once: true,
    scene: "deu_a_table_r",
    wait: 1,
    tell: ["morale:+1", "opinion:+1", "opinion:-1"],
    effects: [
      { kind: "gauge", gauge: "morale", delta: 1 },
      opinion("workers", 1),
      opinion("court", -1),
    ],
  },
  {
    id: "deu_a_amnesty",
    nation: ["DEU"],
    kind: "order",
    when: war,
    once: true,
    scene: "deu_a_amnesty_r",
    wait: 1,
    fields: [
      {
        id: "who",
        options: [
          {
            id: "editors",
            effects: [opinion("press", 1), opinion("army", -1)],
            tell: ["opinion:+1", "opinion:-1"],
          },
          {
            id: "strikers",
            effects: [opinion("workers", 2), opinion("army", -1)],
            tell: ["opinion:+2", "opinion:-1"],
          },
        ],
      },
    ],
  },
  {
    id: "deu_a_franchise",
    nation: ["DEU"],
    kind: "order",
    when: not(flag("f_franchise_word")),
    once: true,
    scene: "deu_a_franchise_r",
    wait: 1,
    tell: ["reichstag:+1", "opinion:-1"],
    effects: [
      { kind: "flag", flag: "f_franchise_word" },
      { kind: "inst", inst: "reichstag", delta: 1 },
      opinion("court", -1),
    ],
  },

  // 연설
  speech(
    "deu_a_sp_balcony",
    // Peace or the sword: before the seat's war, or in its first months.
    { when: any(not(war), world({ is: "war_months", own: true, max: 3 })) },
    [
      {
        id: "peace",
        effects: [opinion("workers", 1), opinion("army", -1)],
        tell: ["opinion:+1", "opinion:-1"],
      },
      {
        id: "sword",
        effects: [
          opinion("press", 1),
          opinion("army", 1),
          { kind: "temp", delta: 1 },
        ],
        tell: ["opinion:+1", "opinion:+1", "temp:+1"],
      },
    ],
  ),
  speech("deu_a_sp_reichstag", {}, [
    {
      id: "vote",
      effects: [opinion("parliament", 1), opinion("court", -1)],
      tell: ["opinion:+1", "opinion:-1"],
    },
    {
      id: "bread",
      when: war,
      effects: [opinion("workers", 1), rumour(-1)],
      tell: ["opinion:+1"],
    },
    { id: "unity", effects: [opinion("parliament", 1)], tell: ["opinion:+1"] },
  ]),
  speech("deu_a_sp_krupp", { when: war }, [
    {
      id: "shells",
      effects: [{ kind: "gauge", gauge: "shells", delta: 1 }],
      tell: ["shells:+1"],
    },
    {
      id: "win",
      effects: [opinion("business", 1), opinion("workers", -1)],
      tell: ["opinion:+1", "opinion:-1"],
    },
    {
      id: "peace",
      effects: [opinion("workers", 1), opinion("army", -1)],
      tell: ["opinion:+1", "opinion:-1"],
    },
  ]),
  speech("deu_a_sp_troops", { when: war }, [
    { id: "hold", effects: [opinion("army", 1)], tell: ["opinion:+1"] },
    {
      id: "home",
      effects: [
        { kind: "gauge", gauge: "morale", delta: 1 },
        opinion("army", -1),
        rumour(1),
      ],
      tell: ["morale:+1", "opinion:-1"],
    },
  ]),
  speech("deu_a_sp_dom", { when: war }, [
    {
      id: "victory",
      effects: [opinion("court", 1), opinion("press", 1)],
      tell: ["opinion:+1", "opinion:+1"],
    },
    {
      id: "dead",
      effects: [{ kind: "gauge", gauge: "morale", delta: 1 }, rumour(-1)],
      tell: ["morale:+1"],
    },
  ]),
  speech("deu_a_sp_kiel", {}, [
    { id: "fleet", effects: [opinion("army", 1)], tell: ["opinion:+1"] },
    {
      id: "bread",
      when: war,
      effects: [
        { kind: "gauge", gauge: "order", delta: 1 },
        opinion("army", -1),
      ],
      tell: ["order:+1", "opinion:-1"],
    },
  ]),

  // 뒷공작
  {
    id: "deu_a_leak",
    nation: ["DEU"],
    kind: "intrigue",
    scene: "deu_a_leak_r",
    wait: 1,
    fields: [{ id: "target", people: "cabinet" }],
    effects: [rumour(1)],
    caught: { pct: 30, scene: "deu_a_leak_out", wait: 2 },
  },
  {
    id: "deu_a_set_on",
    nation: ["DEU"],
    kind: "intrigue",
    scene: "deu_a_set_on_r",
    wait: 1,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [feud(role("a"), role("b"))],
    caught: { pct: 30, scene: "deu_a_set_on_out", wait: 2 },
  },
  {
    id: "deu_a_copenhagen",
    nation: ["DEU"],
    kind: "intrigue",
    when: all(atWar("RUS"), world({ is: "war_months", own: true, min: 2 })),
    once: true,
    scene: "deu_a_copenhagen_r",
    wait: 2,
    effects: [{ kind: "flag", flag: "f_denmark_channel" }],
    caught: { pct: 35, scene: "deu_a_copenhagen_out", wait: 3 },
  },
  {
    id: "deu_a_guelph",
    nation: ["DEU"],
    kind: "intrigue",
    when: war,
    cooldown: 6,
    scene: "deu_a_guelph_r",
    wait: 2,
    fields: [
      {
        id: "where",
        options: [
          {
            id: "paris",
            effects: [{ kind: "gauge", gauge: "money", delta: -1 }],
            tell: ["money:-1"],
          },
          {
            id: "newyork",
            effects: [
              { kind: "gauge", gauge: "money", delta: -1 },
              doWorld({ do: "readiness", tag: "USA", delta: -3 }),
            ],
            tell: ["money:-1"],
          },
        ],
      },
    ],
    caught: { pct: 30, scene: "deu_a_guelph_out", wait: 3 },
  },
  {
    id: "deu_a_watch",
    nation: ["DEU"],
    kind: "intrigue",
    when: { kind: "person_active", person: "deu_heir" },
    once: true,
    scene: "deu_a_watch_r",
    wait: 2,
    effects: [find("deu_heir_ring")],
    caught: { pct: 25, scene: "deu_a_watch_out", wait: 3 },
  },
  {
    id: "deu_a_rebels",
    nation: ["DEU"],
    kind: "intrigue",
    when: war,
    cooldown: 8,
    scene: "deu_a_rebels_r",
    wait: 2,
    fields: [
      {
        id: "where",
        options: [
          {
            id: "ireland",
            when: atWar("GBR"),
            effects: [
              doWorld({ do: "stir", tag: "GBR", delta: 1 }),
              { kind: "pressure", topic: "ireland", delta: 1 },
            ],
          },
          {
            id: "russia",
            when: atWar("RUS"),
            effects: [doWorld({ do: "stir", tag: "RUS", delta: 1 })],
          },
          {
            id: "india",
            effects: [doWorld({ do: "stir", tag: "GBR", delta: 1 })],
          },
        ],
      },
    ],
    caught: { pct: 30, scene: "deu_a_rebels_out", wait: 3 },
  },
];

const empire = world({ is: "regime", of: ["empire"] });

export const DEU_AIMS: readonly GwAim[] = [
  {
    id: "deu_aim_peace",
    nation: ["DEU"],
    when: not(war),
    met: not(war),
    tasks: ["deu_no_great_war", "deu_keep_britain_out", "deu_chancellor_stays"],
  },
  {
    id: "deu_aim_win",
    nation: ["DEU"],
    met: all(
      any(
        world({ is: "peace_side", of: ["won"] }),
        world({ is: "front", theatre: "west", from: "marne" }),
      ),
      empire,
    ),
    tasks: [
      "deu_paris_by_winter",
      "deu_east_prussia_holds",
      "deu_shells_in_store",
    ],
    dropped: [opinion("army", -1)],
  },
  {
    id: "deu_aim_mitteleuropa",
    nation: ["DEU"],
    met: all(not(world({ is: "out", tag: "AUH" })), {
      kind: "trust",
      tag: "AUH",
      min: 1,
    }),
    tasks: [
      "deu_vienna_stands",
      "deu_bread_for_the_winter",
      "deu_east_settled",
    ],
    dropped: [{ kind: "trust", tag: "AUH", delta: -1 }],
  },
  {
    id: "deu_aim_east",
    nation: ["DEU"],
    met: world({ is: "out", tag: "RUS" }),
    tasks: ["deu_east_prussia_holds", "deu_east_settled", "deu_vienna_stands"],
  },
  {
    id: "deu_aim_sea",
    nation: ["DEU"],
    met: all(
      not(world({ is: "entered", tag: "USA", side: "entente" })),
      world({ is: "uboat", max: 1 }),
    ),
    tasks: [
      "deu_keep_britain_out",
      "deu_uboat_never",
      "deu_small_butcher_bill",
    ],
    dropped: [opinion("business", -1)],
  },
  {
    id: "deu_aim_home",
    nation: ["DEU"],
    met: any(
      flag("f_easter_given"),
      flag("f_peace_bill"),
      flag("f_july_pledge"),
    ),
    tasks: [
      "deu_franchise_given",
      "deu_quiet_streets",
      "deu_reichstag_with_you",
    ],
    dropped: [opinion("workers", -1), opinion("parliament", -1)],
  },
  {
    id: "deu_aim_crown",
    nation: ["DEU"],
    met: all(empire, { kind: "inst", inst: "army", max: 2 }),
    tasks: [
      "deu_kaiser_stays",
      "deu_master_of_the_army",
      "deu_chancellor_stays",
    ],
  },
];
