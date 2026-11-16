// ww229 (design ww227): MCK's national events, decisions, spirits, people, flags, groups and templates. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  DecisionDef,
  EventDef,
  PersonDef,
  RegionGroupDef,
  SpiritDef,
  TemplateUnlockDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const MCK_SPIRITS: readonly SpiritDef[] = [
  {
    id: "mck_kwantung_grip_iron",
    icon: "chain_broken",
    stats: {
      ppGainPct: -15,
      autonomyGainPct: -50,
      coupResistPct: 20,
    },
  },
  {
    id: "mck_kwantung_grip_guidance",
    icon: "chain_broken",
    stats: {
      ppGainPct: -10,
      autonomyGainPct: -25,
      coupResistPct: 10,
    },
  },
  {
    id: "mck_kwantung_grip_loosened",
    icon: "chain_broken",
    stats: {
      ppGainPct: -5,
      stabilityBp: -200,
    },
  },
  {
    id: "mck_state_of_its_own",
    icon: "crown",
    stats: {
      ppGainPct: 5,
      stabilityBp: 200,
    },
  },
  {
    id: "mck_five_races",
    icon: "scales",
    stats: {
      stabilityBp: -300,
    },
  },
  {
    id: "mck_five_races_preached",
    icon: "megaphone",
    stats: {
      stabilityBp: -100,
      warSupportBp: 200,
    },
  },
  {
    id: "mck_bandit_war",
    icon: "fist",
    stats: {
      stabilityBp: -200,
      ppGainPct: -5,
    },
  },
  {
    id: "mck_bandits_contained",
    icon: "shield",
    stats: {
      stabilityBp: 100,
    },
  },
  {
    id: "mck_railway_domain",
    icon: "rail",
    stats: {
      railSpeedPct: 10,
      constructionPct: 5,
    },
  },
  {
    id: "mck_concordia_state",
    icon: "flag",
    stats: {
      stabilityBp: 300,
      warSupportBp: 300,
    },
  },
  {
    id: "mck_concordia_total",
    icon: "flag",
    stats: {
      stabilityBp: 300,
      warSupportBp: 500,
      recruitablePct: 2,
    },
  },
  {
    id: "mck_five_year_plan",
    icon: "industry",
    stats: {
      civConstructionPct: 10,
      milConstructionPct: 10,
    },
  },
  {
    id: "mck_plan_quotas",
    icon: "industry",
    stats: {
      civConstructionPct: 5,
      milConstructionPct: 15,
      consumerGoodsPp: -2,
    },
  },
  {
    id: "mck_settlers",
    icon: "road",
    stats: {
      manpowerGrowthPct: 5,
      stabilityBp: -200,
    },
  },
  {
    id: "mck_grain_deliveries",
    icon: "wheat",
    stats: {
      stabilityBp: -300,
      consumerGoodsPp: -2,
    },
  },
  {
    id: "mck_national_service",
    icon: "infantry",
    stats: {
      manpowerGrowthPct: 10,
      trainPct: 5,
    },
  },
  {
    id: "mck_border_watch",
    icon: "shield",
    stats: {
      defensePct: 5,
      fortConstructionPct: 20,
    },
  },
  {
    id: "mck_khalkha_lesson",
    icon: "tank",
    stats: {
      atHardPct: 10,
      defensePct: 3,
    },
  },
  {
    id: "mck_river_fleet",
    icon: "ship",
    stats: {
      riverPenaltyCutPct: 20,
    },
  },
  {
    id: "mck_qing_mandate",
    icon: "crown",
    stats: {
      stabilityBp: 500,
      coupResistPct: 10,
      warSupportBp: 200,
    },
  },
  {
    id: "mck_qing_empire",
    icon: "crown",
    stats: {
      stabilityBp: 700,
      warSupportBp: 300,
      ppGainPct: 5,
    },
  },
  {
    id: "mck_banner_revival",
    icon: "flag",
    stats: {
      warSupportBp: 300,
      attackPct: 3,
    },
  },
  {
    id: "mck_junta_order",
    icon: "medal",
    stats: {
      attackPct: 5,
      stabilityBp: -200,
      warSupportBp: 300,
    },
  },
  {
    id: "mck_northeast_restored",
    icon: "dove",
    stats: {
      stabilityBp: 300,
      recruitablePct: 2,
    },
  },
  {
    id: "mck_mountain_war",
    icon: "star_plain",
    stats: {
      defensePct: 10,
      supplyUsePct: -10,
    },
  },
  {
    id: "mck_rear_base",
    icon: "factory",
    stats: {
      outputPct: 5,
      stabilityBp: -200,
    },
  },
  {
    id: "mck_home_guard",
    icon: "shield",
    stats: {
      defensePct: 5,
      warSupportBp: 200,
    },
  },
];

export const MCK_START_SPIRITS: readonly string[] = [
  "mck_kwantung_grip_iron",
  "mck_five_races",
  "mck_bandit_war",
  "mck_railway_domain",
];

export const MCK_PERSONS: readonly PersonDef[] = [
  {
    id: "mck_zhang_jinghui",
    nameKey: "ww1936.person.mck_zhang_jinghui",
    country: "MCK",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["administrator"],
    },
    leaderTraits: ["caretaker"],
    ideology: "fascist",
    source:
      "en.wikipedia Zhang Jinghui: a Fengtian clique general, prime minister of Manchukuo 1935-45 (from memory)",
  },
  {
    id: "mck_puyi_qing",
    nameKey: "ww1936.person.mck_puyi_qing",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Puyi: the Xuantong Emperor of the Qing 1908-12, briefly restored 1917, Kangde Emperor of Manchukuo 1934-45",
  },
  {
    id: "mck_zheng_xiaoxu",
    nameKey: "ww1936.person.mck_zheng_xiaoxu",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    until: "1938-03-28",
    source:
      "en.wikipedia Zheng Xiaoxu: Qing loyalist, calligrapher, first prime minister of Manchukuo 1932-35, died 1938-03-28",
  },
  {
    id: "mck_zhang_haipeng",
    nameKey: "ww1936.person.mck_zhang_haipeng",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "neutral",
    alsoGeneral: "mck_zhang_haipeng",
    source:
      "en.wikipedia Manchukuo Imperial Army: Zhang Haipeng led about 42,000 Manchukuo troops into Rehe in 1933 and later the 5th District Army at Chengde",
  },
  {
    id: "mck_zhang_xueliang",
    nameKey: "ww1936.person.mck_zhang_xueliang",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Zhang Xueliang: the 'Young Marshal', ruler of the Northeast until 1931, Xi'an Incident 1936, then under arrest for decades",
  },
  {
    id: "mck_ma_zhanshan",
    nameKey: "ww1936.person.mck_ma_zhanshan",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Ma Zhanshan: resisted at the Nenjiang bridge 1931, briefly Manchukuo's war minister in 1932, then deserted to fight Japan again",
  },
  {
    id: "mck_zhou_baozhong",
    nameKey: "ww1936.person.mck_zhou_baozhong",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Zhou Baozhong: commander in the Northeast Anti-Japanese United Army (2nd Route Army), later in the Soviet 88th Brigade",
  },
  {
    id: "mck_yang_jingyu",
    nameKey: "ww1936.person.mck_yang_jingyu",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["war_leader"],
    ideology: "communist",
    until: "1940-02-23",
    source:
      "en.wikipedia Yang Jingyu: commander of the 1st Route Army of the Northeast Anti-Japanese United Army, killed in Mengjiang county 1940-02-23",
  },
  {
    id: "mck_zhao_shangzhi",
    nameKey: "ww1936.person.mck_zhao_shangzhi",
    country: "MCK",
    roles: ["leader"],
    leaderTraits: ["popular_front"],
    ideology: "communist",
    until: "1942-02-12",
    source:
      "en.wikipedia Zhao Shangzhi: founder of partisan units in northern Manchuria, United Army commander, killed 1942-02-12",
  },
  {
    id: "mck_zang_shiyi",
    nameKey: "ww1936.person.mck_zang_shiyi",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["conciliator"],
    },
    source:
      "en.wikipedia Zang Shiyi: governor of Fengtian province, then speaker of the Privy Council of Manchukuo from 1935 (from memory)",
  },
  {
    id: "mck_xi_qia",
    nameKey: "ww1936.person.mck_xi_qia",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["party_ideologue"],
    },
    source:
      "en.wikipedia Xi Qia (Aisin-Gioro Xiqia): Qing clansman, handed Jilin to the Japanese in 1931, minister of finance, then of the imperial household (from memory)",
  },
  {
    id: "mck_hoshino_naoki",
    nameKey: "ww1936.person.mck_hoshino_naoki",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["fiscal_hawk"],
    },
    until: "1940-07-22",
    source:
      "en.wikipedia Naoki Hoshino: Japanese finance official in Manchukuo from 1932, head of the General Affairs Board 1936-40, then in the Konoe cabinet",
  },
  {
    id: "mck_kishi_nobusuke",
    nameKey: "ww1936.person.mck_kishi_nobusuke",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_production"],
    },
    from: "1936-10-01",
    until: "1939-10-31",
    source:
      "en.wikipedia Nobusuke Kishi: vice-minister of industry in Manchukuo from 1936, shaped the five-year industrial plan, back in Japan 1939",
  },
  {
    id: "mck_ayukawa",
    nameKey: "ww1936.person.mck_ayukawa",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_resources"],
    },
    from: "1937-12-01",
    until: "1942-12-31",
    source:
      "en.wikipedia Yoshisuke Aikawa (Ayukawa): founder of Nissan, moved it to Manchuria as Manchuria Heavy Industries Development (Mangyo) from 1937, president until 1942",
  },
  {
    id: "mck_amakasu",
    nameKey: "ww1936.person.mck_amakasu",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["propagandist"],
    },
    source:
      "en.wikipedia Masahiko Amakasu: former military policeman, Concordia Association official, head of the Manchukuo Film Association from 1939",
  },
  {
    id: "mck_furumi_tadayuki",
    nameKey: "ww1936.person.mck_furumi_tadayuki",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["administrator"],
    },
    source:
      "ja.wikipedia 古海忠之 (from memory): Japanese finance official in Manchukuo, deputy head of the General Affairs Board in the war years",
  },
  {
    id: "mck_xie_jieshi",
    nameKey: "ww1936.person.mck_xie_jieshi",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["diplomat"],
    },
    source:
      "en.wikipedia Xie Jieshi: first foreign minister of Manchukuo 1932-35, then envoy to Japan (from memory)",
  },
  {
    id: "mck_yu_zhishan_adv",
    nameKey: "ww1936.person.mck_yu_zhishan_adv",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "army_chief",
      traits: ["chief_defense"],
    },
    alsoGeneral: "mck_yu_zhishan",
    source:
      "en.wikipedia Manchukuo Imperial Army: Yu Zhishan commanded the 1st District Army at Fengtian (12,321 men in 1934); later minister of military affairs (from memory)",
  },
  {
    id: "mck_ganjuurjab_adv",
    nameKey: "ww1936.person.mck_ganjuurjab_adv",
    country: "MCK",
    roles: ["advisor"],
    advisor: {
      slot: "staff",
      traits: ["staff_training"],
    },
    alsoGeneral: "mck_ganjuurjab",
    source:
      "en.wikipedia Ganjuurjab: Mongol officer, son of Babojab, Mongol troops in Inner Mongolia 1930s, later a Manchukuo general (from memory)",
  },
];

export const MCK_EVENTS: readonly EventDef[] = [
  {
    id: "mck_ev_vice_ministers",
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
            kind: "stability",
            pct: 2,
          },
          {
            kind: "autonomy",
            pct: -3,
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
            kind: "autonomy",
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
    id: "mck_ev_kwantung_reacts",
    kind: "country",
    picture: "column",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "subject_of",
          of: {
            tag: "JPN",
          },
        },
        {
          kind: "flag",
          flag: "control_tightened",
        },
        {
          any: [
            {
              kind: "has_spirit",
              id: "mck_kwantung_grip_guidance",
            },
            {
              kind: "has_spirit",
              id: "mck_kwantung_grip_loosened",
            },
          ],
        },
      ],
    },
    mtthDays: 30,
    once: "never",
    cooldownDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "if",
            cond: {
              kind: "has_spirit",
              id: "mck_kwantung_grip_loosened",
            },
            then: [
              {
                kind: "swap_spirit",
                from: "mck_kwantung_grip_loosened",
                to: "mck_kwantung_grip_guidance",
              },
            ],
            else: [
              {
                kind: "swap_spirit",
                from: "mck_kwantung_grip_guidance",
                to: "mck_kwantung_grip_iron",
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
          base: 30,
        },
        effects: [
          {
            kind: "war_support",
            pct: 2,
          },
          {
            kind: "stability",
            pct: -3,
          },
          {
            kind: "set_flag",
            flag: "mck_kwantung_rebuffed",
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_imperial_rescript",
    kind: "country",
    picture: "crowd",
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
            kind: "popularity",
            ideology: "fascist",
            pp: 3,
          },
          {
            kind: "stability",
            pct: -3,
          },
          {
            kind: "opinion",
            of: {
              tag: "JPN",
            },
            value: 15,
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
            kind: "popularity",
            ideology: "neutral",
            pp: 4,
          },
          {
            kind: "autonomy",
            pct: 3,
          },
          {
            kind: "set_flag",
            flag: "mck_refused_shrine",
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_settler_plan",
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
            kind: "add_spirit",
            id: "mck_settlers",
          },
          {
            kind: "opinion",
            of: {
              tag: "JPN",
            },
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
            pct: -1,
          },
          {
            kind: "autonomy",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_border_clash",
    kind: "country",
    picture: "border",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1937-06-01",
        },
        {
          kind: "exists",
          who: {
            tag: "SUN",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "SUN",
            },
          },
        },
        {
          kind: "owns_group",
          group: "manchukuo_soviet_border",
        },
        {
          kind: "focus_done",
          id: "mck_soviet_border",
        },
      ],
    },
    mtthDays: 300,
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
            kind: "army_xp",
            amount: 10,
          },
          {
            kind: "war_support",
            pct: 3,
          },
          {
            kind: "autonomy",
            pct: -3,
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
              tag: "SUN",
            },
            value: 10,
            days: 365,
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
    id: "mck_ev_concordia_congress",
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
            kind: "popularity",
            ideology: "fascist",
            pp: 3,
          },
          {
            kind: "add_advisor_candidate",
            person: "mck_amakasu",
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
            pct: 3,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 2,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_mangyo_founded",
    kind: "country",
    picture: "factory",
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
            kind: "add_advisor_candidate",
            person: "mck_ayukawa",
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
      },
      {
        id: "b",
        ai: {
          base: 25,
        },
        effects: [
          {
            kind: "pp",
            amount: 30,
          },
          {
            kind: "autonomy",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_guerrilla_raid",
    kind: "country",
    picture: "column",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "has_spirit",
          id: "mck_bandit_war",
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 300,
    once: "never",
    cooldownDays: 365,
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
            amount: 5,
          },
          {
            kind: "stability",
            pct: 1,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: -1,
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
            kind: "pp",
            amount: -20,
          },
          {
            kind: "stability",
            pct: -1,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: 1,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_partisan_commander_falls",
    kind: "country",
    picture: "newspaper",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1939-06-01",
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
        {
          any: [
            {
              kind: "has_spirit",
              id: "mck_bandits_contained",
            },
            {
              kind: "focus_done",
              id: "mck_kando_special_unit",
            },
          ],
        },
      ],
    },
    mtthDays: 365,
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
            pp: -3,
          },
          {
            kind: "stability",
            pct: 3,
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
    id: "mck_ev_court_intrigue",
    kind: "country",
    picture: "table",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 3,
          },
          {
            kind: "autonomy",
            pct: 2,
          },
          {
            kind: "set_flag",
            flag: "mck_court_plot",
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
            kind: "stability",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_tokyo_answers_qing",
    kind: "country",
    picture: "document",
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
            of: {
              tag: "MCK",
            },
            value: 10,
            days: 365,
          },
          {
            kind: "autonomy",
            pct: 10,
            who: {
              tag: "MCK",
            },
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
            kind: "set_flag",
            flag: "control_tightened",
            days: 180,
            who: {
              tag: "MCK",
            },
          },
          {
            kind: "opinion",
            of: {
              tag: "MCK",
            },
            value: -20,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_young_marshal_message",
    kind: "country",
    picture: "newspaper",
    once: "game",
    options: [
      {
        id: "a",
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 3,
          },
          {
            kind: "stability",
            pct: -2,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "democratic",
            pp: -1,
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
    id: "mck_ev_china_at_war",
    kind: "country",
    picture: "newspaper",
    receivers: ["MCK"],
    trigger: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
      who: {
        tag: "CHN",
      },
    },
    mtthDays: 20,
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
            kind: "war_support",
            pct: 3,
          },
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 2,
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
            ideology: "democratic",
            pp: 2,
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
    ],
  },
  {
    id: "mck_ev_kwantung_thins",
    kind: "country",
    picture: "column",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "subject_of",
          of: {
            tag: "JPN",
          },
        },
        {
          kind: "at_war_with",
          of: {
            tag: "USA",
          },
          who: {
            tag: "JPN",
          },
        },
        {
          kind: "date_ge",
          date: "1942-06-01",
        },
      ],
    },
    mtthDays: 180,
    once: "country",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "autonomy",
            pct: 10,
          },
          {
            kind: "if",
            cond: {
              kind: "has_spirit",
              id: "mck_kwantung_grip_iron",
            },
            then: [
              {
                kind: "swap_spirit",
                from: "mck_kwantung_grip_iron",
                to: "mck_kwantung_grip_guidance",
              },
            ],
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
            kind: "army_xp",
            amount: 10,
          },
          {
            kind: "manpower",
            amount: 20000,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_soviet_storm",
    kind: "country",
    picture: "column",
    receivers: ["MCK"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
        },
        {
          kind: "lost_vp_ge",
          pct: 15,
        },
      ],
    },
    mtthDays: 10,
    once: "country",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "fort",
            where: {
              regions: [486],
            },
            amount: 1,
          },
          {
            kind: "war_support",
            pct: -3,
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
            kind: "stability",
            pct: -5,
          },
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 3,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: 3,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_recognition",
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
            of: {
              tag: "ITA",
            },
            value: 15,
            days: 365,
          },
          {
            kind: "opinion",
            of: {
              tag: "DEU",
            },
            value: 15,
            days: 365,
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
            kind: "pp",
            amount: 30,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_jpn_loyalty_question",
    kind: "country",
    picture: "document",
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
            kind: "autonomy",
            pct: 5,
            who: {
              tag: "MCK",
            },
          },
          {
            kind: "opinion",
            of: {
              tag: "MCK",
            },
            value: 10,
            days: 365,
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
            flag: "control_tightened",
            days: 180,
            who: {
              tag: "MCK",
            },
          },
          {
            kind: "opinion",
            of: {
              tag: "MCK",
            },
            value: -15,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "mck_ev_qing_proclaimed",
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
            kind: "popularity",
            ideology: "neutral",
            pp: 3,
          },
          {
            kind: "stability",
            pct: 3,
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
            kind: "stability",
            pct: 2,
          },
          {
            kind: "war_support",
            pct: 2,
          },
        ],
      },
    ],
  },
];

export const MCK_DECISIONS: readonly DecisionDef[] = [
  {
    id: "mck_dec_native_officials",
    category: "political",
    for: ["MCK"],
    visible: {
      kind: "is_subject",
    },
    available: {
      all: [
        {
          kind: "is_subject",
        },
        {
          not: {
            kind: "flag",
            flag: "control_tightened",
          },
        },
      ],
    },
    cost: {
      pp: 50,
    },
    cooldownDays: 180,
    days: 70,
    completeEffects: [
      {
        kind: "autonomy",
        pct: 5,
      },
      {
        kind: "stability",
        pct: 1,
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "mck_dec_loosen_grip_1",
    category: "political",
    for: ["MCK"],
    visible: {
      kind: "has_spirit",
      id: "mck_kwantung_grip_iron",
    },
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "mck_kwantung_grip_iron",
        },
        {
          kind: "autonomy_ge",
          pct: 40,
        },
      ],
    },
    cost: {
      pp: 75,
    },
    effects: [
      {
        kind: "swap_spirit",
        from: "mck_kwantung_grip_iron",
        to: "mck_kwantung_grip_guidance",
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: -10,
        days: 365,
      },
    ],
    ai: {
      base: 20,
    },
  },
  {
    id: "mck_dec_loosen_grip_2",
    category: "political",
    for: ["MCK"],
    visible: {
      kind: "has_spirit",
      id: "mck_kwantung_grip_guidance",
    },
    available: {
      all: [
        {
          kind: "has_spirit",
          id: "mck_kwantung_grip_guidance",
        },
        {
          kind: "autonomy_ge",
          pct: 70,
        },
      ],
    },
    cost: {
      pp: 100,
    },
    effects: [
      {
        kind: "swap_spirit",
        from: "mck_kwantung_grip_guidance",
        to: "mck_kwantung_grip_loosened",
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: -10,
        days: 365,
      },
    ],
    ai: {
      base: 20,
    },
  },
  {
    id: "mck_dec_grain_quota",
    category: "economy",
    for: ["MCK"],
    cooldownDays: 365,
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "stability",
        pct: -2,
      },
      {
        kind: "autonomy",
        pct: -2,
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: {
      base: 5,
    },
    locked: true,
  },
  {
    id: "mck_dec_collective_hamlets",
    category: "military",
    for: ["MCK"],
    available: {
      kind: "has_spirit",
      id: "mck_bandit_war",
    },
    cost: {
      pp: 50,
    },
    days: 105,
    completeEffects: [
      {
        kind: "swap_spirit",
        from: "mck_bandit_war",
        to: "mck_bandits_contained",
      },
      {
        kind: "popularity",
        ideology: "communist",
        pp: -3,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_dec_xingan_levy",
    category: "military",
    for: ["MCK"],
    available: {
      all: [
        {
          kind: "focus_done",
          id: "mck_xingan_army",
        },
        {
          kind: "owns_group",
          group: "manchukuo_soviet_border",
        },
      ],
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "divisions",
        template: "mck_tpl_xingan_cavalry",
        count: 1,
        where: {
          regions: [313],
        },
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "mck_dec_qing_heartland",
    category: "annexation",
    for: ["MCK"],
    available: {
      all: [
        {
          kind: "ruling",
          ideology: "neutral",
        },
        {
          kind: "has_spirit",
          id: "mck_qing_mandate",
        },
        {
          not: {
            kind: "is_subject",
          },
        },
        {
          kind: "exists",
          who: {
            tag: "CHN",
          },
        },
        {
          not: {
            kind: "has_war_goal_on",
            of: {
              tag: "CHN",
            },
          },
        },
      ],
    },
    cost: {
      pp: 50,
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          tag: "CHN",
        },
        type: "claim",
        group: "mck_qing_heartland",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_dec_concordia_rally",
    category: "political",
    for: ["MCK"],
    available: {
      kind: "ruling",
      ideology: "fascist",
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 180,
    effects: [
      {
        kind: "war_support",
        pct: 2,
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 2,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "mck_dec_sell_soybeans",
    category: "economy",
    for: ["MCK"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "DEU",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "DEU",
            },
          },
        },
      ],
    },
    cooldownDays: 365,
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
        kind: "pp",
        amount: 15,
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
  {
    id: "mck_dec_shale_oil",
    category: "economy",
    for: ["MCK"],
    cost: {
      pp: 75,
    },
    days: 105,
    completeEffects: [
      {
        kind: "resource",
        where: {
          regions: [553],
        },
        res: "oil",
        amount: 1,
      },
      {
        kind: "build",
        where: {
          regions: [553],
        },
        building: "synthetic_refinery",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
    locked: true,
  },
];

export const MCK_FLAGS: readonly string[] = [
  "mck_refused_shrine",
  "mck_court_plot",
  "mck_kwantung_rebuffed",
];

export const MCK_GROUPS: readonly RegionGroupDef[] = [
  {
    id: "mck_qing_heartland",
    regions: [589, 630, 648],
    owner1936: "CHN",
  },
];

export const MCK_TEMPLATES: readonly TemplateUnlockDef[] = [
  {
    id: "mck_tpl_xingan_cavalry",
    country: "MCK",
    battalions: ["cavalry", "cavalry", "cavalry", "cavalry", "artillery"],
    support: [],
  },
  {
    id: "mck_tpl_asano_brigade",
    country: "MCK",
    battalions: ["infantry", "infantry", "infantry", "infantry", "artillery"],
    support: [],
  },
];
