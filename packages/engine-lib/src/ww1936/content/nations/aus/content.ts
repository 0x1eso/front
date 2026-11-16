// ww229 (design ww227): AUS's national events, decisions, spirits, people, flags, groups and templates. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  DecisionDef,
  EventDef,
  PersonDef,
  RegionGroupDef,
  SpiritDef,
  TemplateUnlockDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const AUS_SPIRITS: readonly SpiritDef[] = [
  {
    id: "aus_depression_scars",
    icon: "industry",
    stats: {
      stabilityBp: -300,
      outputPct: -5,
    },
  },
  {
    id: "aus_slow_recovery",
    icon: "industry",
    stats: {
      outputPct: -2,
    },
  },
  {
    id: "aus_singapore_strategy",
    icon: "ship",
    stats: {
      fortConstructionPct: -15,
      enemyJustifyTimePct: 10,
    },
  },
  {
    id: "aus_tyranny_of_distance",
    icon: "compass",
    stats: {
      enemyJustifyTimePct: 20,
      supplyUsePct: 10,
    },
  },
  {
    id: "aus_citizen_militia",
    icon: "infantry",
    stats: {
      recruitablePct: 2,
      attackPct: -5,
    },
  },
  {
    id: "aus_trained_militia",
    icon: "infantry",
    stats: {
      recruitablePct: 2,
      defensePct: 3,
    },
  },
  {
    id: "aus_labor_program",
    icon: "handshake",
    stats: {
      stabilityBp: 300,
      civConstructionPct: 5,
    },
  },
  {
    id: "aus_uniform_taxation",
    icon: "scales",
    stats: {
      ppGainPct: 5,
      outputPct: 3,
    },
  },
  {
    id: "aus_national_government",
    icon: "shield",
    stats: {
      stabilityBp: 300,
      warSupportBp: 300,
    },
  },
  {
    id: "aus_war_cabinet",
    icon: "medal",
    stats: {
      stabilityBp: 300,
      warSupportBp: 500,
    },
  },
  {
    id: "aus_crown_rule",
    icon: "crown",
    stats: {
      stabilityBp: 500,
      ppGainPct: 5,
    },
  },
  {
    id: "aus_empire_trade",
    icon: "wheat",
    stats: {
      outputPct: 3,
      stabilityBp: 200,
    },
  },
  {
    id: "aus_sp_pacific_power",
    icon: "star_plain",
    stats: {
      warSupportBp: 300,
      navyAttackPct: 3,
    },
  },
  {
    id: "aus_steel_mills",
    icon: "steel",
    stats: {
      milConstructionPct: 5,
      civConstructionPct: 5,
    },
  },
  {
    id: "aus_munitions_directorate",
    icon: "factory_mil",
    stats: {
      milConstructionPct: 10,
      outputPct: 3,
    },
  },
  {
    id: "aus_aif_spirit",
    icon: "flag",
    stats: {
      attackPct: 4,
      orgPct: 3,
    },
  },
  {
    id: "aus_tobruk_defence",
    icon: "fort",
    stats: {
      defensePct: 5,
      entrenchSpeedPct: 10,
    },
  },
  {
    id: "aus_set_piece",
    icon: "sword",
    stats: {
      attackPct: 3,
      breakthroughPct: 5,
    },
  },
  {
    id: "aus_jungle_craft",
    icon: "map",
    stats: {
      infDefensePct: 5,
      infAttackPct: 3,
    },
  },
  {
    id: "aus_sp_independent_companies",
    icon: "sword",
    stats: {
      reconPct: 10,
      infAttackPct: 2,
    },
  },
  {
    id: "aus_northern_watch",
    icon: "tower",
    stats: {
      reconPct: 10,
      navalDetectPct: 5,
    },
  },
  {
    id: "aus_coastwatch",
    icon: "radio",
    stats: {
      navalDetectPct: 10,
      airDetectPct: 5,
    },
  },
  {
    id: "aus_sp_graving_dock",
    icon: "factory",
    stats: {
      repairPct: 15,
    },
  },
  {
    id: "aus_two_oceans",
    icon: "ship",
    stats: {
      navyAttackPct: 3,
      navyDefensePct: 3,
    },
  },
  {
    id: "aus_air_training",
    icon: "plane",
    stats: {
      airLossCutPct: 6,
    },
  },
  {
    id: "aus_raaf_overseas",
    icon: "plane",
    stats: {
      airAttackPct: 3,
    },
  },
  {
    id: "aus_tactical_air",
    icon: "bomber",
    stats: {
      casPct: 5,
      airAttackPct: 2,
    },
  },
  {
    id: "aus_sp_allied_base",
    icon: "globe",
    stats: {
      reinforcePct: 10,
      warSupportBp: 300,
    },
  },
  {
    id: "aus_total_war",
    icon: "factory_mil",
    stats: {
      outputPct: 5,
      milConstructionPct: 5,
      stabilityBp: -300,
    },
  },
  {
    id: "aus_empire_first_1",
    icon: "ship",
    stats: {
      navyAttackPct: 3,
      enemyJustifyTimePct: 5,
    },
  },
  {
    id: "aus_empire_first_2",
    icon: "ship",
    stats: {
      navyAttackPct: 3,
      attackPct: 3,
    },
  },
  {
    id: "aus_empire_first_3",
    icon: "ship",
    stats: {
      navyAttackPct: 3,
      attackPct: 3,
      outputPct: 3,
    },
  },
  {
    id: "aus_pacific_first_1",
    icon: "fort",
    stats: {
      defensePct: 3,
      fortConstructionPct: 10,
    },
  },
  {
    id: "aus_pacific_first_2",
    icon: "fort",
    stats: {
      defensePct: 3,
      fortConstructionPct: 10,
      airAttackPct: 3,
    },
  },
  {
    id: "aus_pacific_first_3",
    icon: "fort",
    stats: {
      defensePct: 5,
      airAttackPct: 3,
      reinforcePct: 10,
    },
  },
  {
    id: "aus_austerity",
    icon: "scales",
    stats: {
      milConstructionPct: 5,
      stabilityBp: -300,
    },
  },
  {
    id: "aus_militia_called_up",
    icon: "infantry",
    stats: {
      recruitablePct: 3,
      outputPct: -3,
    },
  },
  {
    id: "aus_vdc",
    icon: "shield",
    stats: {
      coupResistPct: 10,
      defensePct: 2,
    },
  },
  {
    id: "aus_wool_contract",
    icon: "wheat",
    stats: {
      outputPct: 3,
    },
  },
];

export const AUS_PERSONS: readonly PersonDef[] = [
  {
    id: "aus_menzies",
    nameKey: "ww1936.person.aus_menzies",
    country: "AUS",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["orator"],
    },
    leaderTraits: ["party_boss"],
    ideology: "democratic",
    source:
      "en.wikipedia Robert Menzies: Attorney-General 1935-39, Prime Minister (UAP) 1939-41, resigned in 1941",
  },
  {
    id: "aus_curtin",
    nameKey: "ww1936.person.aus_curtin",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    until: "1945-07-05",
    source:
      "en.wikipedia John Curtin: Labor leader from 1935, Prime Minister 1941-45, died in office 1945",
  },
  {
    id: "aus_page",
    nameKey: "ww1936.person.aus_page",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia Earle Page: Country Party leader 1921-39, caretaker Prime Minister after Lyons' death in 1939",
  },
  {
    id: "aus_chifley",
    nameKey: "ww1936.person.aus_chifley",
    country: "AUS",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["planner"],
    },
    leaderTraits: ["new_dealer"],
    ideology: "democratic",
    source:
      "en.wikipedia Ben Chifley: Treasurer 1941-49 and Minister for Post-war Reconstruction, Prime Minister 1945-49",
  },
  {
    id: "aus_miles",
    nameKey: "ww1936.person.aus_miles",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Jack Miles (communist): general secretary of the Communist Party of Australia 1931-48",
  },
  {
    id: "aus_sharkey",
    nameKey: "ww1936.person.aus_sharkey",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Lance Sharkey: CPA leader from 1930 with Miles, editor of the Workers' Weekly, general secretary 1948-65",
  },
  {
    id: "aus_campbell",
    nameKey: "ww1936.person.aus_campbell",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Eric Campbell (New Guard): Sydney solicitor, founder and leader of the New Guard 1931-35, Centre Party",
  },
  {
    id: "aus_stephensen",
    nameKey: "ww1936.person.aus_stephensen",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "en.wikipedia Percy Stephensen: publisher of The Publicist 1936-42, founder of the Australia First Movement 1941, interned 1942-45",
  },
  {
    id: "aus_hughes",
    nameKey: "ww1936.person.aus_hughes",
    country: "AUS",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["hawk"],
    },
    leaderTraits: ["strongman"],
    ideology: "neutral",
    source:
      "en.wikipedia Billy Hughes: Prime Minister 1915-23, minister in the Lyons and Menzies ministries (External Affairs 1937-39, Attorney-General 1939-41)",
  },
  {
    id: "aus_lang",
    nameKey: "ww1936.person.aus_lang",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["popular_front"],
    ideology: "neutral",
    source:
      "en.wikipedia Jack Lang: Premier of New South Wales 1925-27 and 1930-32, dismissed by the Governor 1932, leader of Lang Labor",
  },
  {
    id: "aus_gloucester",
    nameKey: "ww1936.person.aus_gloucester",
    country: "AUS",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Prince Henry, Duke of Gloucester: brother of George VI, Governor-General of Australia 1945-47",
  },
  {
    id: "aus_casey",
    nameKey: "ww1936.person.aus_casey",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["fiscal_hawk"],
    },
    source:
      "en.wikipedia Richard Casey, Baron Casey: Treasurer 1935-39, first Australian Minister to the United States 1940-42",
  },
  {
    id: "aus_evatt",
    nameKey: "ww1936.person.aus_evatt",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["diplomat"],
    },
    source:
      "en.wikipedia H. V. Evatt: High Court justice 1930-40, Attorney-General and Minister for External Affairs 1941-49",
  },
  {
    id: "aus_calwell",
    nameKey: "ww1936.person.aus_calwell",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["propagandist"],
    },
    source:
      "en.wikipedia Arthur Calwell: Minister for Information 1943-49, clashed with the newspapers over censorship",
  },
  {
    id: "aus_lewis",
    nameKey: "ww1936.person.aus_lewis",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_production"],
    },
    source:
      "en.wikipedia Essington Lewis: managing director of BHP, Director-General of Munitions 1940-45 and of Aircraft Production 1942-45",
  },
  {
    id: "aus_dedman",
    nameKey: "ww1936.person.aus_dedman",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_resources"],
    },
    source:
      "en.wikipedia John Dedman: Minister for War Organisation of Industry 1941-45, known for austerity and rationing",
  },
  {
    id: "aus_rivett",
    nameKey: "ww1936.person.aus_rivett",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "research",
      traits: ["rs_science"],
    },
    source:
      "en.wikipedia David Rivett: chief executive officer of the CSIR 1927-49, organised wartime scientific research",
  },
  {
    id: "aus_wackett",
    nameKey: "ww1936.person.aus_wackett",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "research",
      traits: ["rs_aircraft"],
    },
    source:
      "en.wikipedia Lawrence Wackett: general manager of the Commonwealth Aircraft Corporation from 1936, Wirraway and Boomerang",
  },
  {
    id: "aus_shedden",
    nameKey: "ww1936.person.aus_shedden",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "staff",
      traits: ["staff_planner"],
    },
    source:
      "en.wikipedia Frederick Shedden: Secretary of the Department of Defence 1937-56, secretary of the War Cabinet",
  },
  {
    id: "aus_blamey",
    nameKey: "ww1936.person.aus_blamey",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "army_chief",
      traits: ["chief_organizer"],
    },
    alsoGeneral: "blamey",
    source:
      "en.wikipedia Thomas Blamey: GOC Second AIF 1939, Commander-in-Chief Australian Military Forces 1942-45",
  },
  {
    id: "aus_lavarack",
    nameKey: "ww1936.person.aus_lavarack",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "army_chief",
      traits: ["chief_defense"],
    },
    source:
      "en.wikipedia John Lavarack: Chief of the General Staff 1935-39, later commander of the 7th Division and First Army",
  },
  {
    id: "aus_sturdee",
    nameKey: "ww1936.person.aus_sturdee",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "staff",
      traits: ["staff_logistics"],
    },
    source:
      "en.wikipedia Vernon Sturdee: Chief of the General Staff 1940-42 and 1945-50",
  },
  {
    id: "aus_colvin",
    nameKey: "ww1936.person.aus_colvin",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "navy_chief",
      traits: ["nc_fleet_battle"],
    },
    source:
      "en.wikipedia Ragnar Colvin: Royal Navy admiral lent as Chief of the Naval Staff of the RAN 1937-41",
  },
  {
    id: "aus_collins",
    nameKey: "ww1936.person.aus_collins",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "navy_chief",
      traits: ["nc_raider"],
    },
    source:
      "en.wikipedia John Collins (RAN officer): captain of HMAS Sydney at Cape Spada 1940, commodore of the Australian Squadron 1944",
  },
  {
    id: "aus_williams",
    nameKey: "ww1936.person.aus_williams",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "air_chief",
      traits: ["ac_air_defense"],
    },
    source:
      "en.wikipedia Richard Williams (RAAF officer): Chief of the Air Staff for most of 1922-39, called the father of the RAAF",
  },
  {
    id: "aus_bostock",
    nameKey: "ww1936.person.aus_bostock",
    country: "AUS",
    roles: ["advisor"],
    advisor: {
      slot: "air_chief",
      traits: ["ac_ground"],
    },
    source:
      "en.wikipedia William Bostock: Air Officer Commanding RAAF Command 1942-45, ran the air war in New Guinea",
  },
];

export const AUS_EVENTS: readonly EventDef[] = [
  {
    id: "aus_ev_westminster",
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
            kind: "opinion",
            who: {
              tag: "GBR",
            },
            of: "self",
            value: 10,
            days: 365,
          },
          {
            kind: "pp",
            amount: 25,
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
            kind: "if",
            cond: {
              all: [
                {
                  kind: "is_subject",
                },
                {
                  not: {
                    kind: "flag",
                    flag: "gbr_crown_control",
                  },
                },
              ],
            },
            then: [
              {
                kind: "autonomy",
                pct: 5,
              },
            ],
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
    id: "aus_ev_trade_diversion",
    kind: "country",
    picture: "factory",
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
            who: {
              tag: "JPN",
            },
            of: "self",
            value: -15,
            days: 365,
          },
          {
            kind: "opinion",
            who: {
              tag: "GBR",
            },
            of: "self",
            value: 10,
            days: 365,
          },
          {
            kind: "stability",
            pct: -2,
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
            who: {
              tag: "JPN",
            },
            of: "self",
            value: 15,
            days: 365,
          },
          {
            kind: "opinion",
            who: {
              tag: "GBR",
            },
            of: "self",
            value: -5,
            days: 365,
          },
          {
            kind: "pp",
            amount: 20,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_lyons_succession",
    kind: "country",
    picture: "crowd",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "focus_done",
          id: "aus_uap_coalition",
        },
        {
          kind: "ruling",
          ideology: "democratic",
        },
        {
          kind: "leader",
          person: "leader_aus",
        },
      ],
    },
    mtthDays: 365,
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
            person: "aus_menzies",
          },
          {
            kind: "stability",
            pct: -2,
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
            kind: "set_leader",
            person: "aus_page",
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
    id: "aus_ev_curtin_government",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 75,
        },
        available: {
          kind: "ruling",
          ideology: "democratic",
        },
        effects: [
          {
            kind: "set_leader",
            person: "aus_curtin",
          },
          {
            kind: "add_spirit",
            id: "aus_war_cabinet",
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
          base: 25,
        },
        effects: [
          {
            kind: "stability",
            pct: -2,
          },
          {
            kind: "war_support",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_dalfram",
    kind: "country",
    picture: "crowd",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          who: {
            tag: "JPN",
          },
          of: {
            tag: "CHN",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "JPN",
            },
          },
        },
      ],
    },
    mtthDays: 120,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 65,
        },
        effects: [
          {
            kind: "opinion",
            who: {
              tag: "JPN",
            },
            of: "self",
            value: 10,
            days: 365,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: 2,
          },
          {
            kind: "stability",
            pct: -2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 35,
        },
        effects: [
          {
            kind: "opinion",
            who: {
              tag: "JPN",
            },
            of: "self",
            value: -15,
            days: 365,
          },
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 2,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_convoy_sails",
    kind: "country",
    picture: "map",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 75,
        },
        effects: [
          {
            kind: "army_xp",
            amount: 10,
          },
          {
            kind: "opinion",
            who: {
              tag: "GBR",
            },
            of: "self",
            value: 10,
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
            kind: "stability",
            pct: 2,
          },
          {
            kind: "war_support",
            pct: -2,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_sydney_lost",
    kind: "country",
    picture: "newspaper",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "DEU",
          },
        },
        {
          kind: "war_days_ge",
          days: 600,
        },
      ],
    },
    mtthDays: 300,
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
            kind: "stability",
            pct: 2,
          },
          {
            kind: "war_support",
            pct: -3,
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
            kind: "war_support",
            pct: 3,
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
    id: "aus_ev_darwin_bombed",
    kind: "country",
    picture: "border",
    receivers: ["AUS"],
    trigger: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
    },
    mtthDays: 60,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 75,
        },
        effects: [
          {
            kind: "war_support",
            pct: 5,
          },
          {
            kind: "fort",
            where: {
              group: "darwin",
            },
            amount: 1,
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
            kind: "war_support",
            pct: -3,
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
    id: "aus_ev_harbour_raid",
    kind: "country",
    picture: "newspaper",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "JPN",
          },
        },
        {
          kind: "war_days_ge",
          days: 120,
        },
      ],
    },
    mtthDays: 120,
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
            kind: "build",
            where: {
              regions: [1283],
            },
            building: "coastal_fort",
            count: 1,
          },
          {
            kind: "war_support",
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
            kind: "war_support",
            pct: 3,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_tasman_union",
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
                kind: "opinion_ge",
                of: "from",
                value: 60,
              },
              factor: 3,
            },
            {
              if: {
                kind: "at_war_with",
                of: {
                  tag: "JPN",
                },
              },
              factor: 2,
            },
          ],
        },
        effects: [
          {
            kind: "set_flag",
            flag: "aus_nzl_agreed",
            who: "from",
          },
          {
            kind: "stability",
            pct: -3,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 85,
        },
        effects: [
          {
            kind: "opinion",
            who: "from",
            of: "self",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_brisbane_line",
    kind: "country",
    picture: "map",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 65,
        },
        effects: [
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 35,
        },
        effects: [
          {
            kind: "war_support",
            pct: -3,
          },
          {
            kind: "fort",
            where: {
              regions: [1283],
            },
            amount: 1,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_new_guard_rally",
    kind: "country",
    picture: "crowd",
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
            kind: "popularity",
            ideology: "fascist",
            pp: -3,
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
          base: 40,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 3,
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
    id: "aus_ev_cpa_ban",
    kind: "country",
    picture: "document",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "DEU",
          },
        },
        {
          kind: "ruling",
          ideology: "democratic",
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "JPN",
            },
          },
        },
      ],
    },
    mtthDays: 150,
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
            ideology: "communist",
            pp: -3,
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
            pp: 2,
          },
          {
            kind: "stability",
            pct: -1,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_australia_first_arrests",
    kind: "country",
    picture: "newspaper",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "JPN",
          },
        },
        {
          not: {
            kind: "ruling",
            ideology: "fascist",
          },
        },
      ],
    },
    mtthDays: 150,
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
            pp: -3,
          },
          {
            kind: "stability",
            pct: -1,
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
            pp: 1,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_coal_strike",
    kind: "country",
    picture: "factory",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 365,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 65,
        },
        effects: [
          {
            kind: "stability",
            pct: -2,
          },
          {
            kind: "war_support",
            pct: -1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 35,
        },
        effects: [
          {
            kind: "war_support",
            pct: 2,
          },
          {
            kind: "stability",
            pct: -4,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: 2,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_look_to_america",
    kind: "country",
    picture: "newspaper",
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
            who: {
              tag: "USA",
            },
            of: "self",
            value: 15,
            days: 365,
          },
          {
            kind: "opinion",
            who: {
              tag: "GBR",
            },
            of: "self",
            value: -10,
            days: 365,
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
            who: {
              tag: "GBR",
            },
            of: "self",
            value: 10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "aus_ev_cowra",
    kind: "country",
    picture: "border",
    receivers: ["AUS"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "JPN",
          },
        },
        {
          kind: "war_days_ge",
          days: 900,
        },
      ],
    },
    mtthDays: 200,
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
            kind: "stability",
            pct: -1,
          },
          {
            kind: "war_support",
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
            kind: "stability",
            pct: 1,
          },
          {
            kind: "war_support",
            pct: -1,
          },
        ],
      },
    ],
  },
];

export const AUS_DECISIONS: readonly DecisionDef[] = [
  {
    id: "aus_dec_empire_1",
    category: "military",
    for: ["AUS"],
    available: {
      not: {
        kind: "has_spirit",
        id: "aus_pacific_first_3",
      },
    },
    cost: {
      pp: 50,
    },
    days: 70,
    completeEffects: [
      {
        kind: "add_spirit",
        id: "aus_empire_first_1",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_empire_2",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_empire_2",
    category: "military",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "aus_empire_first_1",
        },
        {
          kind: "at_war",
          who: {
            tag: "GBR",
          },
        },
      ],
    },
    cost: {
      pp: 75,
    },
    days: 70,
    completeEffects: [
      {
        kind: "swap_spirit",
        from: "aus_empire_first_1",
        to: "aus_empire_first_2",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_empire_3",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_empire_3",
    category: "military",
    for: ["AUS"],
    available: {
      kind: "has_spirit",
      id: "aus_empire_first_2",
    },
    cost: {
      pp: 100,
    },
    days: 105,
    completeEffects: [
      {
        kind: "swap_spirit",
        from: "aus_empire_first_2",
        to: "aus_empire_first_3",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 15,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_pacific_1",
    category: "military",
    for: ["AUS"],
    available: {
      not: {
        kind: "has_spirit",
        id: "aus_empire_first_3",
      },
    },
    cost: {
      pp: 50,
    },
    days: 70,
    completeEffects: [
      {
        kind: "add_spirit",
        id: "aus_pacific_first_1",
      },
      {
        kind: "fort",
        where: {
          group: "darwin",
        },
        amount: 1,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_pacific_2",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_pacific_2",
    category: "diplomacy",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "aus_pacific_first_1",
        },
        {
          kind: "exists",
          who: {
            tag: "USA",
          },
        },
      ],
    },
    cost: {
      pp: 75,
    },
    days: 70,
    completeEffects: [
      {
        kind: "swap_spirit",
        from: "aus_pacific_first_1",
        to: "aus_pacific_first_2",
      },
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 20,
        days: 365,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_pacific_3",
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_pacific_3",
    category: "military",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "aus_pacific_first_2",
        },
        {
          kind: "at_war_with",
          of: {
            tag: "JPN",
          },
        },
      ],
    },
    cost: {
      pp: 100,
    },
    days: 105,
    completeEffects: [
      {
        kind: "swap_spirit",
        from: "aus_pacific_first_2",
        to: "aus_pacific_first_3",
      },
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 20,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "aus_dec_austerity",
    category: "economy",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "has_spirit",
            id: "aus_austerity",
          },
        },
      ],
    },
    cost: {
      pp: 50,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "add_spirit",
        id: "aus_austerity",
        days: 365,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "aus_dec_call_up_militia",
    category: "military",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "has_spirit",
            id: "aus_militia_called_up",
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
        kind: "add_spirit",
        id: "aus_militia_called_up",
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_dec_vdc",
    category: "military",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "has_spirit",
            id: "aus_vdc",
          },
        },
      ],
    },
    cost: {
      pp: 25,
    },
    effects: [
      {
        kind: "add_spirit",
        id: "aus_vdc",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_dec_tasman_union",
    category: "diplomacy",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "NZL",
          },
        },
        {
          not: {
            kind: "flag",
            flag: "aus_nzl_agreed",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "NZL",
            },
          },
        },
      ],
    },
    cost: {
      pp: 50,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "fire_event",
        id: "aus_ev_tasman_union",
        to: {
          tag: "NZL",
        },
      },
    ],
    ai: {
      base: 5,
    },
    locked: true,
  },
  {
    id: "aus_dec_wool_purchase",
    category: "economy",
    for: ["AUS"],
    available: {
      all: [
        {
          kind: "at_war",
          who: {
            tag: "GBR",
          },
        },
        {
          not: {
            kind: "flag",
            flag: "aus_wool_sold",
          },
        },
      ],
    },
    cost: {
      pp: 10,
    },
    effects: [
      {
        kind: "set_flag",
        flag: "aus_wool_sold",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "add_spirit",
        id: "aus_wool_contract",
      },
    ],
    ai: {
      base: 10,
    },
  },
];

export const AUS_FLAGS: readonly string[] = [
  "aus_uap_years",
  "aus_singapore_trusted",
  "aus_anzac_pact",
  "aus_near_north",
  "aus_nzl_agreed",
  "aus_wool_sold",
];

export const AUS_GROUPS: readonly RegionGroupDef[] = [
  {
    id: "aus_new_guinea",
    regions: [1142],
    owner1936: "AUS",
  },
  {
    id: "aus_timor",
    regions: [1174],
    owner1936: "PRT",
  },
  {
    id: "aus_dutch_new_guinea",
    regions: [1106, 1137],
    owner1936: "NLD",
  },
  {
    id: "aus_new_caledonia",
    regions: [1234],
    owner1936: "FRA",
  },
];

export const AUS_TEMPLATES: readonly TemplateUnlockDef[] = [
  {
    id: "aus_jungle_division",
    country: "AUS",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
    ],
    support: ["engineer", "recon"],
  },
];
