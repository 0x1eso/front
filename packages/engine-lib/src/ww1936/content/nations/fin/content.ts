// ww229 (design ww227): FIN's national events, decisions, spirits, people, flags, groups and templates. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  DecisionDef,
  EventDef,
  PersonDef,
  RegionGroupDef,
  SpiritDef,
  TemplateUnlockDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const FIN_SPIRITS: readonly SpiritDef[] = [
  {
    id: "fin_scars_of_1918",
    icon: "flag",
    stats: {
      stabilityBp: -500,
    },
  },
  {
    id: "fin_scars_fading",
    icon: "dove",
    stats: {
      stabilityBp: -200,
    },
  },
  {
    id: "fin_civil_guards",
    icon: "infantry",
    stats: {
      recruitablePct: 10,
      coupResistPct: 10,
    },
  },
  {
    id: "fin_empty_arsenal",
    icon: "artillery",
    stats: {
      attackPct: -5,
    },
  },
  {
    id: "fin_neutral_north",
    icon: "tower",
    stats: {
      enemyJustifyTimePct: 25,
    },
  },
  {
    id: "fin_labour_peace",
    icon: "handshake",
    stats: {
      stabilityBp: 500,
      outputPct: 3,
    },
  },
  {
    id: "fin_democratic_unity",
    icon: "shield",
    stats: {
      stabilityBp: 300,
      warSupportBp: 300,
    },
  },
  {
    id: "fin_patriotic_state",
    icon: "eagle_plain",
    stats: {
      warSupportBp: 800,
      stabilityBp: -300,
      recruitablePct: 3,
    },
  },
  {
    id: "fin_peoples_democracy",
    icon: "star_plain",
    stats: {
      stabilityBp: -300,
      outputPct: 5,
    },
  },
  {
    id: "fin_marshal_rule",
    icon: "medal",
    stats: {
      stabilityBp: 500,
      warSupportBp: 500,
      coupResistPct: 20,
    },
  },
  {
    id: "fin_crown_restored",
    icon: "crown",
    stats: {
      stabilityBp: 800,
      ppGainPct: 5,
    },
  },
  {
    id: "fin_paasikivi_course",
    icon: "dove",
    stats: {
      enemyJustifyTimePct: 30,
      warSupportBp: -500,
    },
  },
  {
    id: "fin_brotherhood_in_arms",
    icon: "sword",
    stats: {
      attackPct: 3,
      orgPct: 3,
    },
  },
  {
    id: "fin_western_sympathy",
    icon: "handshake",
    stats: {
      enemyJustifyTimePct: 20,
      stabilityBp: 200,
    },
  },
  {
    id: "fin_timber_trade",
    icon: "ship",
    stats: {
      tradeCostPct: 10,
    },
  },
  {
    id: "fin_power_grid",
    icon: "industry",
    stats: {
      civConstructionPct: 5,
    },
  },
  {
    id: "fin_gengas",
    icon: "oil",
    stats: {
      fuelUsePct: -10,
    },
  },
  {
    id: "fin_isthmus_line_1",
    icon: "fort",
    stats: {
      defensePct: 2,
    },
  },
  {
    id: "fin_isthmus_line_2",
    icon: "fort",
    stats: {
      defensePct: 4,
    },
  },
  {
    id: "fin_isthmus_line_3",
    icon: "fort",
    stats: {
      defensePct: 6,
      entrenchMax: 1,
    },
  },
  {
    id: "fin_motti_spirit",
    icon: "sword",
    stats: {
      defensePct: 3,
      recoveryPct: 5,
    },
  },
  {
    id: "fin_sisu_spirit",
    icon: "medal",
    stats: {
      orgPct: 5,
      warSupportBp: 300,
    },
  },
  {
    id: "fin_forest_war",
    icon: "compass",
    stats: {
      defensePct: 2,
      attackPct: 2,
    },
  },
  {
    id: "fin_guards_called",
    icon: "infantry",
    stats: {
      recruitablePct: 4,
      warSupportBp: 500,
    },
  },
  {
    id: "fin_lotta_spirit",
    icon: "shield",
    stats: {
      supplyUsePct: -5,
      recoveryPct: 3,
    },
  },
  {
    id: "fin_winter_war_spirit",
    icon: "flag",
    stats: {
      stabilityBp: 1000,
      warSupportBp: 1500,
      defensePct: 10,
    },
  },
  {
    id: "fin_karelian_evacuees",
    icon: "map",
    stats: {
      stabilityBp: -500,
      manpowerGrowthPct: 5,
    },
  },
  {
    id: "fin_home_front_spirit",
    icon: "factory",
    stats: {
      consumerGoodsPp: -3,
      stabilityBp: 300,
    },
  },
  {
    id: "fin_captured_arms",
    icon: "tank",
    stats: {
      capturePct: 20,
    },
  },
  {
    id: "fin_mine_barrages",
    icon: "ship",
    stats: {
      navyDefensePct: 5,
    },
  },
  {
    id: "fin_parvi_formation",
    icon: "plane",
    stats: {
      airAttackPct: 5,
      fighterAgilityPct: 3,
    },
  },
];

export const FIN_PERSONS: readonly PersonDef[] = [
  {
    id: "fin_kallio",
    nameKey: "ww1936.person.fin_kallio",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Kyösti Kallio + fi.wikipedia: Agrarian, prime minister four times, president 1937-03-01..1940-12-19",
  },
  {
    id: "fin_stahlberg",
    nameKey: "ww1936.person.fin_stahlberg",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia Kaarlo Juho Ståhlberg: first president 1919-25, author of the 1919 constitution, candidate 1931 and 1937",
  },
  {
    id: "fin_ryti",
    nameKey: "ww1936.person.fin_ryti",
    country: "FIN",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["fiscal_hawk"],
    },
    leaderTraits: ["war_leader"],
    source:
      "en.wikipedia Risto Ryti: governor of the Bank of Finland 1923-40, prime minister 1939-40, president 1940-44",
  },
  {
    id: "fin_kuusinen",
    nameKey: "ww1936.person.fin_kuusinen",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Otto Wille Kuusinen: Comintern secretary in Moscow, head of the Terijoki government 1939",
  },
  {
    id: "fin_antikainen",
    nameKey: "ww1936.person.fin_antikainen",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Toivo Antikainen: Red Guard veteran, arrested 1934, life sentence, released 1944",
  },
  {
    id: "fin_annala",
    nameKey: "ww1936.person.fin_annala",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "en.wikipedia Vilho Annala + fi.wikipedia: chairman of the Patriotic People's Movement (IKL) 1932-44",
  },
  {
    id: "fin_simojoki",
    nameKey: "ww1936.person.fin_simojoki",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    until: "1940-01-25",
    source:
      "en.wikipedia Elias Simojoki + fi.wikipedia: IKL deputy, leader of the Blue-and-Black youth, killed in action 1940-01-25",
  },
  {
    id: "fin_mannerheim_regent",
    nameKey: "ww1936.person.fin_mannerheim_regent",
    country: "FIN",
    roles: ["leader"],
    leaderTraits: ["generalissimo"],
    ideology: "neutral",
    alsoGeneral: "mannerheim",
    source:
      "en.wikipedia Carl Gustaf Emil Mannerheim: regent 1918-19, field marshal, chairman of the Defence Council 1931-39",
  },
  {
    id: "fin_paasikivi",
    nameKey: "ww1936.person.fin_paasikivi",
    country: "FIN",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["conciliator"],
    },
    leaderTraits: ["peace_negotiator"],
    source:
      "en.wikipedia Juho Kusti Paasikivi: monarchist prime minister 1918, envoy to Stockholm 1936-39, negotiator in Moscow 1939",
  },
  {
    id: "fin_tanner",
    nameKey: "ww1936.person.fin_tanner",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["labour_organizer"],
    },
    source:
      "en.wikipedia Väinö Tanner: Social Democratic chairman, finance minister 1937-39, foreign minister 1939-40",
  },
  {
    id: "fin_holsti",
    nameKey: "ww1936.person.fin_holsti",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["diplomat"],
    },
    source:
      "en.wikipedia Rudolf Holsti: foreign minister 1919-22 and 1936-38, League of Nations policy",
  },
  {
    id: "fin_erkko",
    nameKey: "ww1936.person.fin_erkko",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["hawk"],
    },
    source:
      "en.wikipedia Eljas Erkko: foreign minister 1938-39, the hard line in the Moscow talks",
  },
  {
    id: "fin_kekkonen",
    nameKey: "ww1936.person.fin_kekkonen",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["security_chief"],
    },
    source:
      "en.wikipedia Urho Kekkonen: interior minister 1937-39, tried to dissolve the IKL in 1938",
  },
  {
    id: "fin_walden",
    nameKey: "ww1936.person.fin_walden",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_production"],
    },
    source:
      "en.wikipedia Rudolf Walden: head of United Paper Mills, minister of defence 1940-44",
  },
  {
    id: "fin_virtanen",
    nameKey: "ww1936.person.fin_virtanen",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "research",
      traits: ["rs_science"],
    },
    source:
      "en.wikipedia Artturi Ilmari Virtanen: biochemist, AIV fodder method, Nobel Prize in Chemistry 1945",
  },
  {
    id: "fin_osterman",
    nameKey: "ww1936.person.fin_osterman",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "army_chief",
      traits: ["chief_defense"],
    },
    alsoGeneral: "osterman",
    source:
      "en.wikipedia Hugo Österman: commander of the army 1933-39, Isthmus Army 1939-40",
  },
  {
    id: "fin_heinrichs",
    nameKey: "ww1936.person.fin_heinrichs",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "staff",
      traits: ["staff_planner"],
    },
    alsoGeneral: "heinrichs",
    source:
      "en.wikipedia Erik Heinrichs: Isthmus Army 1940, chief of the general staff 1940-45",
  },
  {
    id: "fin_malmberg",
    nameKey: "ww1936.person.fin_malmberg",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "staff",
      traits: ["staff_training"],
    },
    source: "en.wikipedia Lauri Malmberg: commander of the Civil Guard 1921-44",
  },
  {
    id: "fin_lundqvist",
    nameKey: "ww1936.person.fin_lundqvist",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "air_chief",
      traits: ["ac_air_defense"],
    },
    source:
      "en.wikipedia Jarl Lundqvist: commander of the Finnish Air Force 1932-45",
  },
  {
    id: "fin_valve",
    nameKey: "ww1936.person.fin_valve",
    country: "FIN",
    roles: ["advisor"],
    advisor: {
      slot: "navy_chief",
      traits: ["nc_escort"],
    },
    source: "en.wikipedia Väinö Valve: commander of the navy 1933-45",
  },
];

export const FIN_EVENTS: readonly EventDef[] = [
  {
    id: "fin_ev_red_earth",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 3,
          },
          {
            kind: "stability",
            pct: 3,
          },
          {
            kind: "add_advisor_candidate",
            person: "fin_tanner",
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 2,
          },
          {
            kind: "stability",
            pct: -2,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_presidential_election",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_kallio",
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 15,
        },
        effects: [
          {
            kind: "war_support",
            pct: 3,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 2,
          },
        ],
      },
      {
        id: "c",
        ai: {
          base: 15,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_stahlberg",
          },
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 3,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_ikl_ban",
    kind: "country",
    picture: "document",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -2,
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -6,
          },
          {
            kind: "stability",
            pct: -4,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_aland_proposal",
    kind: "country",
    picture: "map",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "opinion",
            of: "from",
            value: 25,
            days: 365,
          },
          {
            kind: "set_flag",
            flag: "fin_aland_joint",
            who: "from",
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "set_flag",
            flag: "fin_aland_refused",
            who: "from",
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_aland_moscow",
    kind: "country",
    picture: "document",
    receivers: ["FIN"],
    trigger: {
      all: [
        {
          kind: "flag",
          flag: "fin_aland_joint",
        },
        {
          kind: "exists",
          who: {
            tag: "SUN",
          },
        },
      ],
    },
    mtthDays: 30,
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "opinion",
            of: "self",
            value: -25,
            days: 365,
            who: {
              tag: "SUN",
            },
          },
          {
            kind: "build",
            where: {
              regions: [169],
            },
            building: "coastal_fort",
            count: 1,
          },
          {
            kind: "war_support",
            pct: 3,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "opinion",
            of: "self",
            value: 10,
            days: 365,
            who: {
              tag: "SUN",
            },
          },
          {
            kind: "stability",
            pct: -2,
          },
          {
            kind: "clear_flag",
            flag: "fin_aland_joint",
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_quiet_envoy",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "opinion",
            of: {
              tag: "SUN",
            },
            value: 5,
            days: 365,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 25,
        },
        effects: [
          {
            kind: "set_flag",
            flag: "fin_talks_open",
          },
          {
            kind: "opinion",
            of: "self",
            value: 15,
            days: 365,
            who: {
              tag: "SUN",
            },
          },
          {
            kind: "war_support",
            pct: -3,
          },
        ],
      },
      {
        id: "c",
        ai: {
          base: 15,
        },
        effects: [
          {
            kind: "war_support",
            pct: 5,
          },
          {
            kind: "opinion",
            of: "self",
            value: -10,
            days: 365,
            who: {
              tag: "SUN",
            },
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_volunteer_call",
    kind: "country",
    picture: "column",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "volunteers",
            to: "from",
            divisions: 1,
          },
          {
            kind: "opinion",
            of: "from",
            value: 20,
            days: 365,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 45,
        },
        effects: [
          {
            kind: "send_equipment",
            to: "from",
            type: "infantry_equipment",
            count: 2000,
          },
          {
            kind: "opinion",
            of: "from",
            value: 10,
            days: 365,
          },
        ],
      },
      {
        id: "c",
        ai: {
          base: 15,
        },
        effects: [
          {
            kind: "opinion",
            of: "from",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_winter_war",
    kind: "country",
    picture: "column",
    receivers: ["FIN"],
    trigger: {
      kind: "at_war_with",
      of: {
        tag: "SUN",
      },
    },
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 1,
        },
        effects: [
          {
            kind: "add_spirit",
            id: "fin_winter_war_spirit",
            days: 365,
          },
          {
            kind: "set_flag",
            flag: "fin_winter_war_fought",
          },
          {
            kind: "unlock_decision",
            id: "fin_dec_call_civil_guards",
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_motti_victory",
    kind: "country",
    picture: "map",
    receivers: ["FIN"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
        },
        {
          kind: "war_days_ge",
          days: 30,
        },
        {
          kind: "has_spirit",
          id: "fin_motti_spirit",
        },
      ],
    },
    mtthDays: 30,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "army_xp",
            amount: 15,
          },
          {
            kind: "war_support",
            pct: 5,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "equipment",
            type: "artillery",
            gen: 1,
            count: 20,
          },
          {
            kind: "equipment",
            type: "light_tank",
            gen: 1,
            count: 10,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_western_aid",
    kind: "country",
    picture: "newspaper",
    receivers: ["FIN"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
        },
        {
          kind: "flag",
          flag: "fin_winter_war_fought",
        },
      ],
    },
    mtthDays: 45,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "equipment",
            type: "fighter",
            gen: 1,
            count: 30,
          },
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 3000,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "opinion",
            of: {
              tag: "GBR",
            },
            value: 20,
            days: 365,
          },
          {
            kind: "opinion",
            of: {
              tag: "FRA",
            },
            value: 20,
            days: 365,
          },
          {
            kind: "war_support",
            pct: 5,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_transit_request",
    kind: "country",
    picture: "border",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: 25,
            days: 365,
          },
          {
            kind: "opinion",
            of: "self",
            value: 25,
            days: 365,
            who: {
              tag: "DEU",
            },
          },
          {
            kind: "equipment",
            type: "artillery",
            gen: 1,
            count: 30,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: -20,
            days: 365,
          },
          {
            kind: "opinion",
            of: {
              tag: "GBR",
            },
            value: 15,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_nickel_dispute",
    kind: "country",
    picture: "factory",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "pp",
            amount: 40,
          },
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: 20,
            days: 365,
          },
          {
            kind: "opinion",
            of: {
              tag: "GBR",
            },
            value: -10,
            days: 365,
          },
          {
            kind: "set_flag",
            flag: "fin_nickel_sold",
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "pp",
            amount: 25,
          },
          {
            kind: "opinion",
            of: {
              tag: "GBR",
            },
            value: 20,
            days: 365,
          },
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: -10,
            days: 365,
          },
          {
            kind: "set_flag",
            flag: "fin_nickel_sold",
          },
        ],
      },
      {
        id: "c",
        ai: {
          base: 10,
        },
        effects: [
          {
            kind: "pp",
            amount: 10,
          },
          {
            kind: "stability",
            pct: 2,
          },
          {
            kind: "set_flag",
            flag: "fin_nickel_sold",
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_karelian_refugees",
    kind: "country",
    picture: "crowd",
    receivers: ["FIN"],
    trigger: {
      all: [
        {
          kind: "flag",
          flag: "fin_winter_war_fought",
        },
        {
          not: {
            kind: "owns_group",
            group: "karelian_isthmus",
          },
        },
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
    mtthDays: 20,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "if",
            cond: {
              not: {
                kind: "has_spirit",
                id: "fin_karelian_evacuees",
              },
            },
            then: [
              {
                kind: "add_spirit",
                id: "fin_karelian_evacuees",
              },
            ],
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
        },
        effects: [
          {
            kind: "stability",
            pct: -8,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_kingdom_offer",
    kind: "country",
    picture: "document",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "set_flag",
            flag: "fin_regency_paasikivi",
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 4,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: 15,
            days: 365,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 3,
          },
        ],
      },
      {
        id: "c",
        ai: {
          base: 10,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "neutral",
            pp: -3,
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_red_cells",
    kind: "country",
    picture: "newspaper",
    receivers: ["FIN"],
    trigger: {
      all: [
        {
          kind: "pop_ge",
          ideology: "communist",
          pct: 12,
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 90,
    once: "country",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "communist",
            pp: -4,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "communist",
            pp: -1,
          },
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 1,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_peasant_march",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 4,
          },
          {
            kind: "stability",
            pct: -3,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -2,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_lotta_drive",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "pp",
            amount: 25,
          },
          {
            kind: "equipment",
            type: "anti_air",
            gen: 1,
            count: 10,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "equipment",
            type: "support_equipment",
            gen: 1,
            count: 200,
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_estonia_union_offer",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 15,
          mods: [
            {
              if: {
                kind: "threat_ge",
                of: {
                  tag: "SUN",
                },
                pct: 50,
              },
              factor: 300,
            },
            {
              if: {
                kind: "opinion_ge",
                of: "from",
                value: 50,
              },
              factor: 200,
            },
          ],
        },
        effects: [
          {
            kind: "set_flag",
            flag: "fin_estonia_agreed",
            who: "from",
          },
          {
            kind: "opinion",
            of: "from",
            value: 30,
            days: 365,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "opinion",
            of: "from",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_new_order_leader",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_annala",
          },
        ],
      },
      {
        id: "b",
        available: {
          kind: "date_lt",
          date: "1940-01-25",
        },
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_simojoki",
          },
          {
            kind: "war_support",
            pct: 5,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_red_government",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_kuusinen",
          },
          {
            kind: "opinion",
            of: {
              tag: "SUN",
            },
            value: 20,
            days: 365,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "set_leader",
            person: "fin_antikainen",
          },
          {
            kind: "stability",
            pct: 3,
          },
        ],
      },
    ],
  },
  {
    id: "fin_ev_armistice_terms",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "separate_peace",
            with: {
              tag: "SUN",
            },
          },
          {
            kind: "stability",
            pct: -5,
          },
          {
            kind: "set_flag",
            flag: "fin_left_the_war",
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
        },
        effects: [
          {
            kind: "war_support",
            pct: 5,
          },
          {
            kind: "stability",
            pct: -3,
          },
        ],
      },
    ],
  },
];

export const FIN_DECISIONS: readonly DecisionDef[] = [
  {
    id: "fin_dec_line_1",
    category: "military",
    for: ["FIN"],
    available: {
      kind: "owns_group",
      group: "karelian_isthmus",
    },
    cost: {
      pp: 50,
    },
    days: 70,
    completeEffects: [
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
      {
        kind: "add_spirit",
        id: "fin_isthmus_line_1",
      },
      {
        kind: "unlock_decision",
        id: "fin_dec_line_2",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "fin_dec_line_2",
    category: "military",
    for: ["FIN"],
    available: {
      all: [
        {
          kind: "owns_group",
          group: "karelian_isthmus",
        },
        {
          kind: "has_spirit",
          id: "fin_isthmus_line_1",
        },
      ],
    },
    cost: {
      pp: 75,
    },
    days: 70,
    completeEffects: [
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
      {
        kind: "swap_spirit",
        from: "fin_isthmus_line_1",
        to: "fin_isthmus_line_2",
      },
      {
        kind: "unlock_decision",
        id: "fin_dec_line_3",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "fin_dec_line_3",
    category: "military",
    for: ["FIN"],
    available: {
      all: [
        {
          kind: "owns_group",
          group: "karelian_isthmus",
        },
        {
          kind: "has_spirit",
          id: "fin_isthmus_line_2",
        },
      ],
    },
    cost: {
      pp: 100,
    },
    days: 105,
    completeEffects: [
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
      {
        kind: "swap_spirit",
        from: "fin_isthmus_line_2",
        to: "fin_isthmus_line_3",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "fin_dec_call_civil_guards",
    category: "military",
    for: ["FIN"],
    available: {
      all: [
        {
          not: {
            kind: "has_spirit",
            id: "fin_guards_called",
          },
        },
        {
          any: [
            {
              kind: "at_war",
            },
            {
              kind: "threat_ge",
              of: {
                tag: "SUN",
              },
              pct: 50,
            },
          ],
        },
      ],
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "add_spirit",
        id: "fin_guards_called",
        days: 180,
      },
      {
        kind: "manpower",
        recruitablePct: 2,
      },
    ],
    ai: {
      base: 10,
      mods: [
        {
          if: {
            not: {
              kind: "at_war",
            },
          },
          factor: 30,
        },
      ],
    },
    locked: true,
  },
  {
    id: "fin_dec_guard_exercises",
    category: "military",
    for: ["FIN"],
    available: {
      not: {
        kind: "at_war",
      },
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 180,
    effects: [
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 5,
    },
    locked: true,
  },
  {
    id: "fin_dec_swedish_volunteers",
    category: "diplomacy",
    for: ["FIN"],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          kind: "exists",
          who: {
            tag: "SWE",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "SWE",
            },
          },
        },
      ],
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_volunteer_call",
        to: {
          tag: "SWE",
        },
      },
    ],
    ai: {
      base: 20,
    },
    locked: true,
  },
  {
    id: "fin_dec_resettle_karelians",
    category: "economy",
    for: ["FIN"],
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "fin_karelian_evacuees",
        },
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
    cost: {
      pp: 50,
    },
    days: 105,
    completeEffects: [
      {
        kind: "remove_spirit",
        id: "fin_karelian_evacuees",
      },
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: {
      base: 15,
    },
    locked: true,
  },
  {
    id: "fin_dec_nickel_concession",
    category: "economy",
    for: ["FIN"],
    visible: {
      not: {
        kind: "flag",
        flag: "fin_nickel_sold",
      },
    },
    available: {
      all: [
        {
          kind: "owns_group",
          group: "petsamo",
        },
        {
          not: {
            kind: "flag",
            flag: "fin_nickel_sold",
          },
        },
      ],
    },
    cost: {
      pp: 25,
    },
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_nickel_dispute",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "fin_dec_estonian_union",
    category: "diplomacy",
    for: ["FIN"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "EST",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "EST",
            },
          },
        },
        {
          not: {
            kind: "flag",
            flag: "fin_estonia_asked",
          },
        },
        {
          kind: "opinion_ge",
          of: {
            tag: "EST",
          },
          value: 30,
        },
      ],
    },
    cost: {
      pp: 50,
    },
    effects: [
      {
        kind: "set_flag",
        flag: "fin_estonia_asked",
      },
      {
        kind: "fire_event",
        id: "fin_ev_estonia_union_offer",
        to: {
          tag: "EST",
        },
      },
    ],
    ai: {
      base: 5,
    },
    locked: true,
  },
  {
    id: "fin_dec_proclaim_union",
    category: "annexation",
    for: ["FIN"],
    visible: {
      kind: "flag",
      flag: "fin_estonia_agreed",
    },
    available: {
      all: [
        {
          kind: "flag",
          flag: "fin_estonia_agreed",
        },
        {
          kind: "exists",
          who: {
            tag: "EST",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "EST",
            },
          },
        },
      ],
    },
    cost: {
      pp: 100,
    },
    effects: [
      {
        kind: "annex",
        target: {
          tag: "EST",
        },
        units: "transfer",
        core: true,
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: {
      base: 30,
    },
  },
  {
    id: "fin_dec_buy_arms_abroad",
    category: "military",
    for: ["FIN"],
    cost: {
      pp: 50,
    },
    cooldownDays: 180,
    effects: [
      {
        kind: "equipment",
        type: "artillery",
        gen: 1,
        count: 30,
      },
      {
        kind: "equipment",
        type: "anti_air",
        gen: 1,
        count: 20,
      },
    ],
    ai: {
      base: 5,
      mods: [
        {
          if: {
            kind: "threat_ge",
            of: {
              tag: "SUN",
            },
            pct: 40,
          },
          factor: 300,
        },
      ],
    },
  },
];

export const FIN_FLAGS: readonly string[] = [
  "fin_aland_joint",
  "fin_aland_refused",
  "fin_talks_open",
  "fin_refused_bases",
  "fin_islands_leased",
  "fin_soviet_treaty",
  "fin_nordic_talks",
  "fin_winter_war_fought",
  "fin_nickel_sold",
  "fin_estonia_asked",
  "fin_estonia_agreed",
  "fin_left_the_war",
  "fin_old_border",
  "fin_regency_paasikivi",
];

export const FIN_GROUPS: readonly RegionGroupDef[] = [
  {
    id: "fin_east_karelia",
    regions: [114],
    owner1936: "SUN",
  },
];

export const FIN_TEMPLATES: readonly TemplateUnlockDef[] = [
  {
    id: "fin_ski_brigade",
    country: "FIN",
    battalions: ["mountain", "mountain", "mountain", "mountain", "artillery"],
    support: [],
  },
];
