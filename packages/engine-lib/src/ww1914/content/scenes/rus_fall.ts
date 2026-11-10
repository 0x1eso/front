import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「러시아」, the fall share (plan: ww135-plan-rus.md §7, §8, §9): the rus_r_
 * scenes, the talks of Rodzianko, Milyukov, Kerensky and Protopopov, and the
 * visits of Buchanan, Michael, Chkheidze and Kornilov. Data only; the text is
 * in resources/ww1914/ko/RUS.fall.json. Reads the world's `regime`, `era`,
 * `date` and `command` conditions (branch w135-world).
 */
export const RUS_FALL_SCENES: readonly GwScene[] = [
  {
    id: "rus_r_sturmer",
    nation: ["RUS"],
    kind: "audience",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "office_empty",
              office: "chancellor",
            },
            {
              kind: "holder",
              office: "chancellor",
              person: "rus_goremykin",
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
      rival: {
        rival: true,
      },
    },
    salience: 8,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "promised",
        when: {
          kind: "promise",
          who: {
            person: "rus_goremykin",
          },
          key: "p_gor_release",
        },
      },
      {
        id: "letter",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sturmer",
    options: [
      {
        id: "sturmer",
        tell: ["court:+2", "ministers:-1", "duma:-1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_sturmer",
            },
            office: "chancellor",
          },
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_sturmer_named",
          },
        ],
      },
      {
        id: "kokovtsov_back",
        tell: ["ministers:+2", "court:-2"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_kokovtsov",
            },
            office: "chancellor",
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
        ],
      },
      {
        id: "krivoshein_at_last",
        when: {
          kind: "memory",
          key: "k_kriv_premier",
        },
        tell: ["duma:+2", "ministers:+1", "court:-2"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_krivoshein",
            },
            office: "chancellor",
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_protopopov",
    nation: ["RUS"],
    kind: "audience",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "interior",
            person: "rus_protopopov",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "office_empty",
              office: "interior",
            },
            {
              kind: "person_trust",
              who: {
                office: "interior",
              },
              max: 0,
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "stockholm",
        when: {
          kind: "memory",
          key: "k_proto_stockholm",
        },
      },
      {
        id: "letter",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "appoint",
    options: [
      {
        id: "appoint",
        tell: ["court:+2", "duma:-1", "ministers:-1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_protopopov",
            },
            office: "interior",
          },
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
        ],
      },
      {
        id: "another_name",
        tell: ["ministers:+1", "court:-1", "trust:-1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_shcherbatov",
            },
            office: "interior",
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "ask_duma_first",
        when: {
          kind: "memory",
          key: "k_proto_ready",
        },
        tell: ["duma:+1", "court:-1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "rus_protopopov",
            },
            office: "interior",
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_proto_with_duma",
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_stockholm",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_proto_stockholm",
            },
            {
              kind: "memory",
              key: "k_bark_stockholm",
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        any_of: [
          {
            office: "foreign",
          },
          {
            office: "chancellor",
          },
        ],
      },
    },
    salience: 7,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      {
        id: "both",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_proto_stockholm",
            },
            {
              kind: "memory",
              key: "k_bark_stockholm",
            },
          ],
        },
      },
      {
        id: "banker",
        when: {
          kind: "memory",
          key: "k_bark_stockholm",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "bury_it",
    options: [
      {
        id: "bury_it",
        tell: [],
        effects: [
          {
            kind: "reason",
            key: "r_stockholm_bury",
          },
        ],
      },
      {
        id: "hear_more",
        tell: ["ally:-1"],
        effects: [
          {
            kind: "trust",
            tag: "FRA",
            delta: -1,
          },
          {
            kind: "maybe",
            when: {
              kind: "secret",
              id: "rus_german_feeler",
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "reveal",
                  id: "rus_german_feeler",
                },
              },
              {
                kind: "reason",
                key: "r_stockholm_real",
              },
            ],
          },
        ],
      },
      {
        id: "tell_allies",
        tell: ["ally:+2", "court:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "separate_talks",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_ras_peace",
            },
            {
              kind: "memory",
              key: "k_witte_peace",
            },
          ],
        },
        tell: ["stavka:-2", "ally:-4", "talks", "ends_war"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "talks",
            },
          },
          {
            kind: "maybe",
            when: {
              kind: "secret",
              id: "rus_german_feeler",
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "separate_peace",
                },
              },
              {
                kind: "reason",
                key: "r_stockholm_signed",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_treason",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
          ],
        },
        { kind: "world", of: { is: "war_months", own: true, min: 22 } },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "inst",
          inst: "duma",
          max: 0,
        },
      ],
    },
    cast: {
      chancellor: {
        any_of: [
          {
            office: "chancellor",
          },
          {
            office: "foreign",
          },
        ],
      },
      interior: {
        any_of: [
          {
            office: "interior",
          },
          {
            office: "chancellor",
          },
        ],
      },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "heard",
        when: {
          kind: "memory",
          key: "k_mil_speech",
        },
      },
      {
        id: "sturmer",
        when: {
          kind: "holder",
          office: "chancellor",
          person: "rus_sturmer",
        },
      },
      {
        id: "minister",
        when: {
          kind: "holder",
          office: "chancellor",
          person: "rus_krivoshein",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "prorogue",
    options: [
      {
        id: "prorogue",
        tell: ["court:+1", "duma:-2", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "drop_sturmer",
        tell: ["court:-1", "duma:+1"],
        effects: [
          {
            kind: "dismiss",
            who: {
              role: "chancellor",
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
        ],
      },
      {
        id: "answer_in_duma",
        when: {
          kind: "memory",
          key: "k_mil_speech",
        },
        tell: ["ministers:+1", "duma:+1", "court:-1"],
        effects: [
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "free_sukh",
        when: {
          kind: "memory",
          key: "k_proto_free",
        },
        tell: ["court:+2", "duma:-2", "morale:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_friend_dead",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "flag",
            flag: "f_friend_exiled",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        { kind: "world", of: { is: "war_months", min: 26 } },
        {
          kind: "any",
          of: [
            {
              kind: "inst",
              inst: "court",
              min: 0,
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
      interior: {
        any_of: [
          {
            office: "interior",
          },
          {
            office: "chancellor",
          },
        ],
      },
      friend: {
        person: "rus_rasputin",
      },
    },
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "boy",
        when: {
          kind: "chose",
          scene: "rus_h_heir_bleed",
        },
      },
      {
        id: "cmd",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      {
        id: "hungry",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "exile_quietly",
    options: [
      {
        id: "exile_quietly",
        tell: ["court:-1", "duma:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "passes",
              who: {
                role: "friend",
              },
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_dmitri_sent",
          },
        ],
      },
      {
        id: "full_trial",
        tell: ["court:+2", "duma:-2", "order:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "passes",
              who: {
                role: "friend",
              },
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "let_it_lie",
        tell: ["court:-2", "duma:+1", "trust:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "passes",
              who: {
                role: "friend",
              },
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "comfort_her",
        when: {
          kind: "memory",
          key: "k_alex_after",
        },
        tell: ["court:+2", "audiences:-1", "trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "passes",
              who: {
                role: "friend",
              },
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_family_letter",
    nation: ["RUS"],
    kind: "dispute",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_r_friend_dead",
            },
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "dmitri",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_r_friend_dead",
              pick: "exile_quietly",
            },
            {
              kind: "chose",
              scene: "rus_r_friend_dead",
              pick: "full_trial",
            },
          ],
        },
      },
      {
        id: "no_friend",
        when: {
          kind: "flag",
          flag: "f_friend_exiled",
        },
      },
      { id: "visitors" },
      {
        id: "base",
      },
    ],
    fallback: "send_them_away",
    options: [
      {
        id: "send_them_away",
        tell: ["court:+1", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_family_sent_away",
          },
        ],
      },
      {
        id: "hear_them",
        when: {
          kind: "memory",
          key: "k_michael_ready",
        },
        tell: ["court:-1", "duma:+1", "ministers:+1", "trust:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "send_her_to_crimea",
        when: {
          kind: "memory",
          key: "k_maria_plea",
        },
        tell: ["court:-3", "duma:+2", "ministers:+1", "trust:-2"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: -3,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_her_in_crimea",
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_plot",
    nation: ["RUS"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        { kind: "world", of: { is: "war_months", min: 27 } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "secret",
              id: "rus_palace_plot",
            },
            {
              kind: "inst",
              inst: "duma",
              max: 0,
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["people", "tension_up"],
    once: true,
    stamp: "unconfirmed",
    source: "agents",
    variants: [
      {
        id: "dated",
        when: {
          kind: "all",
          of: [
            {
              kind: "secret",
              id: "rus_palace_plot",
            },
            {
              kind: "world",
              of: {
                is: "known",
                id: "rus_palace_plot",
              },
            },
          ],
        },
      },
      {
        id: "guards",
        when: {
          kind: "secret",
          id: "rus_palace_plot",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_r_trust",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "inst",
          inst: "duma",
          max: 1,
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
          ],
        },
        {
          kind: "not",
          of: {
            kind: "flag",
            flag: "f_trust_refused_3",
          },
        },
      ],
    },
    cast: {
      chancellor: {
        any_of: [
          {
            office: "chancellor",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 9,
    tags: ["home"],
    cooldown: 6,
    variants: [
      {
        id: "third",
        when: {
          kind: "flag",
          flag: "f_trust_refused_2",
        },
      },
      {
        id: "second",
        when: {
          kind: "flag",
          flag: "f_trust_refused_1",
        },
      },
      {
        id: "buchanan",
        when: {
          kind: "memory",
          key: "k_buchanan_warn",
        },
      },
      {
        id: "rodz",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_rodz_last",
            },
            {
              kind: "memory",
              key: "k_rodz_bread",
            },
          ],
        },
      },
      { id: "memo" },
      {
        id: "base",
      },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["court:+1", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "maybe",
            when: {
              kind: "flag",
              flag: "f_trust_refused_2",
            },
            then: [
              {
                kind: "flag",
                flag: "f_trust_refused_3",
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "flag",
              flag: "f_trust_refused_1",
            },
            then: [
              {
                kind: "flag",
                flag: "f_trust_refused_2",
              },
            ],
          },
          {
            kind: "flag",
            flag: "f_trust_refused_1",
          },
        ],
      },
      {
        id: "half_cabinet",
        when: {
          kind: "memory",
          key: "k_rodz_bread",
        },
        tell: ["ministers:+1", "duma:+1", "court:-1"],
        effects: [
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "grant",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_rodz_last",
            },
            {
              kind: "memory",
              key: "k_buchanan_warn",
            },
          ],
        },
        tell: ["order:+1", "court:-2", "regime_change"],
        effects: [
          {
            kind: "world",
            of: {
              do: "regime",
              to: "crown",
            },
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "maybe",
            when: {
              kind: "memory",
              key: "k_kriv_premier",
            },
            then: [
              {
                kind: "appoint",
                who: {
                  person: "rus_krivoshein",
                },
                office: "chancellor",
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "not",
              of: {
                kind: "memory",
                key: "k_kriv_premier",
              },
            },
            then: [
              {
                kind: "appoint",
                who: {
                  person: "rus_lvov",
                },
                office: "chancellor",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_allied_mission",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "date",
                from: "1917-01",
                to: "1917-03",
              },
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        any_of: [
          {
            office: "foreign",
          },
          {
            office: "chancellor",
          },
        ],
      },
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
        ],
      },
    },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "no_shells",
        when: {
          kind: "gauge",
          gauge: "shells",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "show_all",
    options: [
      {
        id: "show_all",
        tell: ["ally:+2", "stavka:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
      {
        id: "ask_guns",
        tell: ["shells:+1", "ally:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
        ],
      },
      {
        id: "ask_about_trust",
        when: {
          kind: "memory",
          key: "k_buchanan_warn",
        },
        tell: ["ally:+1", "duma:+1", "court:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_queue",
    nation: ["RUS"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "gauge",
              gauge: "bread",
              max: 1,
            },
            {
              kind: "gauge",
              gauge: "order",
              max: 2,
            },
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "era",
                    of: ["depth"],
                  },
                },
                {
                  kind: "world",
                  of: {
                    is: "era",
                    of: ["material"],
                  },
                },
                {
                  kind: "world",
                  of: {
                    is: "era",
                    of: ["storm"],
                  },
                },
              ],
            },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["home", "tension_up"],
    cooldown: 5,
    stamp: "estimate",
    source: "agents",
    variants: [
      {
        id: "vyborg",
      },
      {
        id: "narva",
      },
      { id: "tram" },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_r_capital",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        { kind: "world", of: { is: "war_months", min: 18 } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 2,
              },
            },
            {
              kind: "gauge",
              gauge: "order",
              max: 0,
            },
          ],
        },
        {
          kind: "not",
          of: {
            kind: "all",
            of: [
              {
                kind: "chose",
                scene: "rus_w_depots",
                pick: "thin_out",
              },
              {
                kind: "memory",
                key: "k_rodz_wagons",
              },
            ],
          },
        },
      ],
    },
    cast: {
      interior: {
        any_of: [
          {
            office: "interior",
          },
          {
            office: "war",
          },
          {
            office: "foreign",
          },
        ],
      },
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "thinned",
        when: {
          kind: "chose",
          scene: "rus_w_depots",
          pick: "thin_out",
        },
      },
      {
        id: "cmd",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      {
        id: "rotten",
        when: {
          kind: "all",
          of: [
            {
              kind: "secret",
              id: "rus_garrison_rotten",
            },
            {
              kind: "any",
              of: [
                {
                  kind: "memory",
                  key: "k_alek_garrison",
                },
                {
                  kind: "memory",
                  key: "k_ker_depots",
                },
              ],
            },
          ],
        },
      },
      {
        id: "court_low",
        when: {
          kind: "inst",
          inst: "court",
          max: -1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "bread_first",
    options: [
      {
        id: "bread_first",
        tell: ["order:+1", "bread:+1", "shells:-1", "stavka:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
      {
        id: "drop_proto",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_proto_police",
            },
            {
              kind: "holder",
              office: "interior",
              person: "rus_protopopov",
            },
          ],
        },
        tell: ["order:+1", "court:-1", "duma:+1"],
        effects: [
          {
            kind: "dismiss",
            who: {
              role: "interior",
            },
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
        ],
      },
      {
        id: "cabinet_now",
        when: {
          kind: "memory",
          key: "k_rodz_last",
        },
        tell: ["order:+1", "court:-2", "regime_change"],
        effects: [
          {
            kind: "world",
            of: {
              do: "regime",
              to: "crown",
            },
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_cabinet_in_time",
          },
        ],
      },
      {
        id: "go_to_capital",
        tell: ["court:+1", "stavka:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "personal_command",
              on: false,
            },
          },
          {
            kind: "flag",
            flag: "f_tsar_to_capital",
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_record_capital",
    nation: ["RUS"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "seen",
      scene: "rus_r_capital",
    },
    cast: {},
    salience: 8,
    tags: ["home"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_r_capital_after",
    nation: ["RUS"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        { kind: "seen", scene: "rus_r_capital" },
        { kind: "not", of: { kind: "seen", scene: "rus_r_train" } },
        { kind: "world", of: { is: "unrest", max: 2 } },
      ],
    },
    cast: {},
    salience: 8,
    tags: ["home", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "agents",
    variants: [
      {
        id: "bread",
        when: { kind: "chose", scene: "rus_r_capital", pick: "bread_first" },
      },
      {
        id: "cabinet",
        when: { kind: "chose", scene: "rus_r_capital", pick: "cabinet_now" },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_r_train",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "world",
          of: {
            is: "unrest",
            min: 3,
          },
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
    },
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "to_capital",
        when: {
          kind: "chose",
          scene: "rus_r_capital",
          pick: "go_to_capital",
        },
      },
      {
        id: "no_news",
        when: {
          kind: "inst",
          inst: "stavka",
          max: 0,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "go_on_to_capital",
    options: [
      {
        id: "go_on_to_capital",
        tell: ["court:+1", "stavka:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
      {
        id: "to_ruzsky",
        tell: ["stavka:+1", "court:-1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "to_army",
        when: {
          kind: "memory",
          key: "k_brus_after",
        },
        tell: ["stavka:+2", "court:-1", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_tsar_to_army",
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_poll",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "seen",
          scene: "rus_r_train",
        },
      ],
    },
    cast: {
      cos: {
        any_of: [
          {
            office: "chief_of_staff",
          },
          {
            office: "supreme_commander",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 9,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "army",
        when: {
          kind: "chose",
          scene: "rus_r_train",
          pick: "to_army",
        },
      },
      {
        id: "kept_out",
        when: {
          kind: "chose",
          scene: "rus_r_train",
          pick: "go_on_to_capital",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "read_them",
    options: [
      {
        id: "read_them",
        tell: ["stavka:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "schedule",
            scene: "rus_r_abdication",
            chapters: 1,
          },
        ],
      },
      {
        id: "call_michael",
        when: {
          kind: "memory",
          key: "k_michael_ready",
        },
        tell: ["duma:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_asked_michael",
          },
          {
            kind: "schedule",
            scene: "rus_r_abdication",
            chapters: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_abdication",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown", "regency"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 4,
              },
            },
            {
              kind: "all",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "regime",
                    of: ["tsar"],
                  },
                },
                {
                  kind: "seen",
                  scene: "rus_r_poll",
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        any_of: [
          {
            office: "court",
          },
          {
            office: "chancellor",
          },
        ],
      },
      cos: {
        any_of: [
          {
            office: "chief_of_staff",
          },
          {
            office: "supreme_commander",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 9,
    tags: ["people"],
    cooldown: 1,
    variants: [
      {
        id: "again",
        when: {
          kind: "chose",
          scene: "rus_r_abdication",
          pick: "refuse_and_fight",
        },
      },
      {
        id: "regency",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["regency"],
          },
        },
      },
      {
        id: "crown",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["crown"],
          },
        },
      },
      {
        id: "guch",
        when: {
          kind: "memory",
          key: "k_guch_terms",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "for_michael",
    options: [
      {
        id: "for_michael",
        tell: ["regime_change"],
        effects: [
          { kind: "world", of: { do: "personal_command", on: false } },

          {
            kind: "world",
            of: {
              do: "next_regime",
            },
          },
          {
            kind: "remember",
            key: "k_abdicated",
          },
        ],
      },
      {
        id: "for_alexei",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_guch_terms",
            },
            {
              kind: "not",
              of: {
                kind: "chose",
                scene: "rus_r_abdication",
                pick: "refuse_and_fight",
              },
            },
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["regency"],
                },
              },
            },
          ],
        },
        tell: ["court:-1", "regime_change", "heir"],
        effects: [
          { kind: "world", of: { do: "personal_command", on: false } },

          {
            kind: "world",
            of: {
              do: "regime",
              to: "regency",
            },
          },
          {
            kind: "remember",
            key: "k_abdicated",
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "close_memoir",
        when: {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_abdication",
            pick: "refuse_and_fight",
          },
        },
        tell: ["ends_game"],
        effects: [
          {
            kind: "world",
            of: {
              do: "close_seat",
            },
          },
        ],
      },
      {
        id: "refuse_and_fight",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_brus_after",
            },
            {
              kind: "not",
              of: {
                kind: "chose",
                scene: "rus_r_abdication",
                pick: "refuse_and_fight",
              },
            },
          ],
        },
        tell: ["order:+1", "stavka:-2"],
        effects: [
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -2,
          },
          {
            kind: "schedule",
            scene: "rus_r_abdication",
            chapters: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_dual_power",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "world",
      of: {
        is: "regime",
        of: ["provisional"],
      },
    },
    cast: {
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "michael",
        when: {
          kind: "chose",
          scene: "rus_r_abdication",
          pick: "for_michael",
        },
      },
      {
        id: "regency_gone",
        when: {
          kind: "all",
          of: [
            {
              kind: "chose",
              scene: "rus_r_abdication",
              pick: "for_alexei",
            },
            {
              kind: "chose",
              scene: "rus_r_abdication",
              pick: "for_michael",
            },
          ],
        },
      },
      {
        id: "soviet_grown",
        when: {
          kind: "inst",
          inst: "soviet",
          min: 2,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "live_with_it",
    options: [
      {
        id: "live_with_it",
        tell: ["soviet:+1", "stavka:-1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
      {
        id: "answer_order",
        when: {
          kind: "memory",
          key: "k_chkh_order",
        },
        tell: ["stavka:+1", "soviet:-1", "morale:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
        ],
      },
      {
        id: "share_cabinet",
        when: {
          kind: "memory",
          key: "k_ker_justice",
        },
        tell: ["soviet:+2", "duma:-1", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_old_master",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "chose",
          scene: "rus_r_abdication",
        },
      ],
    },
    cast: {
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 8,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "soviet",
        when: {
          kind: "inst",
          inst: "soviet",
          min: 2,
        },
      },
      {
        id: "britain",
        when: {
          kind: "memory",
          key: "k_buchanan_warn",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "tsarskoe",
    options: [
      {
        id: "tsarskoe",
        tell: ["soviet:+1", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
        ],
      },
      {
        id: "to_england",
        when: {
          kind: "memory",
          key: "k_buchanan_warn",
        },
        tell: ["soviet:-2", "ally:+1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_family_to_england",
          },
        ],
      },
      {
        id: "tobolsk",
        when: {
          kind: "memory",
          key: "k_ker_justice",
        },
        tell: ["soviet:+1", "stavka:-1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_family_tobolsk",
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_aims_note",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional"],
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "seen",
          scene: "rus_r_dual_power",
        },
      ],
    },
    cast: {
      fm: {
        any_of: [
          {
            office: "foreign",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "milyukov",
        when: {
          kind: "holder",
          office: "foreign",
          person: "rus_milyukov",
        },
      },
      {
        id: "paper",
        when: {
          kind: "chose",
          scene: "rus_h_straits_note",
        },
      },
      {
        id: "soviet",
        when: {
          kind: "inst",
          inst: "soviet",
          min: 2,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_aims",
    options: [
      {
        id: "hold_aims",
        tell: ["ally:+2", "soviet:+1", "order:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "drop_straits",
        tell: ["soviet:-1", "order:+1", "ally:-3"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_dropped_straits",
          },
          {
            kind: "maybe",
            when: {
              kind: "holder",
              office: "foreign",
              person: "rus_milyukov",
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "letter",
                  who: {
                    role: "fm",
                  },
                },
              },
            ],
          },
        ],
      },
      {
        id: "keep_note",
        when: {
          kind: "memory",
          key: "k_mil_note",
        },
        tell: ["ally:+1", "duma:+1"],
        effects: [
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_sealed_train",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional"],
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "w_german_offer",
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        any_of: [
          {
            office: "foreign",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "heard",
        when: {
          kind: "flag",
          flag: "w_german_offer",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "let_in",
    options: [
      {
        id: "let_in",
        tell: ["soviet:+1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "arrest_at_border",
        when: {
          kind: "memory",
          key: "k_ker_justice",
        },
        tell: ["soviet:-2", "stavka:+1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_lenin_held",
          },
        ],
      },
      {
        id: "ask_allies",
        tell: ["ally:+1", "soviet:+1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_offensive",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_dual_power",
            within: 2,
          },
        },
      ],
    },
    cast: {
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
      cos: {
        any_of: [
          {
            office: "chief_of_staff",
          },
          {
            office: "supreme_commander",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "land",
        when: {
          kind: "chose",
          scene: "rus_h_land_word",
          pick: "sign_word",
        },
      },
      {
        id: "kerensky",
        when: {
          kind: "holder",
          office: "war",
          person: "rus_kerensky",
        },
      },
      {
        id: "low",
        when: {
          kind: "gauge",
          gauge: "morale",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "go_with_speech",
    options: [
      {
        id: "go_with_speech",
        tell: ["ally:+3", "soviet:-1", "morale:-1"],
        effects: [
          {
            kind: "trust",
            tag: "FRA",
            delta: 2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "RUS",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
        ],
      },
      {
        id: "defend_only",
        when: {
          kind: "memory",
          key: "k_brus_regime",
        },
        tell: ["ally:-3", "soviet:+1", "morale:+1"],
        effects: [
          {
            kind: "trust",
            tag: "FRA",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
        ],
      },
      {
        id: "kerensky_tours",
        when: {
          kind: "memory",
          key: "k_ker_front",
        },
        tell: ["morale:+1", "ally:+1", "stavka:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_july",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_r_offensive",
            },
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 2,
              },
            },
          ],
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_offensive",
            within: 1,
          },
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_dual_power",
            within: 2,
          },
        },
      ],
    },
    cast: {
      interior: {
        any_of: [
          {
            office: "interior",
          },
          {
            office: "war",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "held",
        when: {
          kind: "flag",
          flag: "f_lenin_held",
        },
      },
      {
        id: "bread",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 0,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "publish_papers",
    options: [
      {
        id: "publish_papers",
        tell: ["order:+1", "soviet:-2", "duma:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
        ],
      },
      {
        id: "hold_back",
        tell: ["duma:+1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "broaden_cabinet",
        when: {
          kind: "memory",
          key: "k_ker_last",
        },
        tell: ["order:+1", "soviet:+1", "duma:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_kornilov",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "seen",
          scene: "rus_r_july",
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_july",
            within: 2,
          },
        },
      ],
    },
    cast: {
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
      k: {
        person: "rus_kornilov",
      },
    },
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "deal",
        when: {
          kind: "memory",
          key: "k_kornilov_deal",
        },
      },
      {
        id: "riga",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "east",
            from: "riga",
          },
        },
      },
      {
        id: "rep",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["rep"],
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "call_him_traitor",
    options: [
      {
        id: "call_him_traitor",
        tell: ["soviet:+2", "stavka:-3", "trust:-2"],
        effects: [
          {
            kind: "inst",
            inst: "soviet",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -3,
          },
          {
            kind: "maybe",
            when: {
              kind: "holder",
              office: "war",
              person: "rus_kerensky",
            },
            then: [
              {
                kind: "gauge",
                gauge: "morale",
                delta: -1,
              },
            ],
          },
          {
            kind: "person_trust",
            who: {
              role: "k",
            },
            delta: -2,
          },
        ],
      },
      {
        id: "make_terms",
        when: {
          kind: "memory",
          key: "k_kornilov_deal",
        },
        tell: ["stavka:+2", "soviet:-2", "order:+1", "trust:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "k",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "step_aside",
        tell: ["ends_game"],
        effects: [
          {
            kind: "flag",
            flag: "f_rus_civil_war",
          },
          {
            kind: "world",
            of: {
              do: "close_seat",
            },
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_assembly",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_dual_power",
            within: 3,
          },
        },
      ],
    },
    cast: {
      interior: {
        any_of: [
          {
            office: "interior",
          },
          {
            office: "war",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 8,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "land",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_h_land_word",
              pick: "sign_word",
            },
            {
              kind: "inst",
              inst: "soviet",
              min: 3,
            },
          ],
        },
      },
      {
        id: "after",
        when: {
          kind: "seen",
          scene: "rus_r_kornilov",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "wait_for_peace",
    options: [
      {
        id: "wait_for_peace",
        tell: ["duma:+1", "soviet:+1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "call_now",
        tell: ["soviet:+1", "stavka:-1", "regime_change"],
        effects: [
          {
            kind: "world",
            of: {
              do: "regime",
              to: "rep",
            },
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
        ],
      },
      {
        id: "land_now",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kriv_land",
            },
            {
              kind: "memory",
              key: "k_ker_last",
            },
          ],
        },
        tell: ["order:+1", "morale:+1", "manpower:-3", "regime_change"],
        effects: [
          {
            kind: "world",
            of: {
              do: "regime",
              to: "rep",
            },
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -3,
            },
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_october",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "world",
          of: {
            is: "unrest",
            min: 2,
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
        {
          kind: "not",
          of: {
            kind: "chose",
            scene: "rus_r_kornilov",
            within: 2,
          },
        },
      ],
    },
    cast: {
      war: {
        any_of: [
          {
            office: "war",
          },
          {
            office: "chief_of_staff",
          },
          {
            office: "foreign",
          },
        ],
      },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "kornilov_terms",
        when: {
          kind: "chose",
          scene: "rus_r_kornilov",
          pick: "make_terms",
        },
      },
      {
        id: "rep",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["rep"],
          },
        },
      },
      {
        id: "soviet",
        when: {
          kind: "inst",
          inst: "soviet",
          min: 3,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "front_troops",
    options: [
      {
        id: "front_troops",
        tell: ["ends_game"],
        effects: [
          {
            kind: "maybe",
            when: {
              kind: "inst",
              inst: "stavka",
              min: -1,
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "calm",
                },
              },
              {
                kind: "inst",
                inst: "soviet",
                delta: -2,
              },
              {
                kind: "reason",
                key: "r_october_held",
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "inst",
              inst: "stavka",
              max: -2,
            },
            then: [
              {
                kind: "reason",
                key: "r_october_lost",
              },
              {
                kind: "world",
                of: {
                  do: "close_seat",
                },
              },
            ],
          },
        ],
      },
      {
        id: "leave_for_front",
        tell: ["ends_game"],
        effects: [
          {
            kind: "flag",
            flag: "f_rus_civil_war",
          },
          {
            kind: "world",
            of: {
              do: "close_seat",
            },
          },
        ],
      },
      {
        id: "share_power",
        when: {
          kind: "memory",
          key: "k_ker_last",
        },
        tell: ["order:+1", "soviet:+2", "stavka:-2"],
        effects: [
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "inst",
            inst: "soviet",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -2,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_brest",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "w_german_offer",
            },
            {
              kind: "world",
              of: {
                is: "score",
                max: -15,
              },
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        any_of: [
          {
            office: "foreign",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 9,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "tsar",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
      },
      {
        id: "crown",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["crown", "regency"],
          },
        },
      },
      {
        id: "new",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["ally:+2", "morale:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
        ],
      },
      {
        id: "sign_terms",
        tell: ["ally:-5", "ends_war"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -3,
          },
          {
            kind: "world",
            of: {
              do: "separate_peace",
            },
          },
        ],
      },
      {
        id: "stall",
        when: {
          kind: "memory",
          key: "k_mil_note",
        },
        tell: ["stavka:-1", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_r_crown_war",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["crown", "regency"],
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        any_of: [
          {
            office: "chancellor",
          },
          {
            office: "foreign",
          },
        ],
      },
      cos: {
        any_of: [
          {
            office: "chief_of_staff",
          },
          {
            office: "supreme_commander",
          },
          {
            office: "war",
          },
        ],
      },
    },
    salience: 8,
    tags: ["war"],
    cooldown: 8,
    variants: [
      {
        id: "regency_storm",
        when: {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["regency"],
              },
            },
            {
              kind: "world",
              of: {
                is: "era",
                of: ["storm"],
              },
            },
          ],
        },
      },
      {
        id: "regency",
        when: {
          kind: "world",
          of: {
            is: "regime",
            of: ["regency"],
          },
        },
      },
      {
        id: "storm",
        when: {
          kind: "world",
          of: {
            is: "era",
            of: ["storm"],
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_what_they_bring",
    options: [
      {
        id: "sign_what_they_bring",
        tell: ["duma:+1", "ministers:+1", "court:-1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
        ],
      },
      {
        id: "tour_the_front",
        tell: ["morale:+1", "stavka:+1", "duma:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
        ],
      },
      {
        id: "ask_for_straits",
        when: {
          kind: "memory",
          key: "k_mil_straits",
        },
        tell: ["duma:+1", "ally:-1", "morale:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_t_rodz_session",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 3,
              max: 5,
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "count" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { count: "r_count" },
    nodes: {
      r_count: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_rodz_session" }],
            next: "thanks",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: "hurt",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "what",
                effects: [],
              },
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "hurt",
                effects: [
                  {
                    kind: "reason",
                    key: "t_rodz_session_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_session",
              },
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_rodz_session",
                chapters: 4,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "rus_c_balcony",
                      pick: "duma_day",
                    },
                    {
                      kind: "chose",
                      scene: "rus_h_peace_duma",
                      pick: "reform_word",
                    },
                  ],
                },
              },
            ],
            next: "thanks",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      what: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "good",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_session",
              },
            ],
            next: "gor",
          },
          {
            id: "doubt",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "gor",
            gain: [
              {
                kind: "remember",
                key: "k_rodz_session",
              },
            ],
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      gor: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "thanks",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "sharp",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hurt: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "soft",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      thanks: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "end2",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_rodz_friend",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "era",
              of: ["material", "depth", "storm"],
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "loud" },
      { id: "asks" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: {
      asks: "r_asks",
      loud: "r_loud",
    },
    nodes: {
      r_asks: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "no",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "file",
          },
          {
            id: "maybe",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "file",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      r_loud: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "sit",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "file",
          },
          {
            id: "hold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "r_low",
          },
        ],
      },
      r_low: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "open",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "file",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "file",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "file",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["court:-1", "duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "bargain",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["court:-1", "trust:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_rodz_friend_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
      file: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_friend",
              },
            ],
            next: "boy",
          },
          {
            id: "keep",
            stance: "cold",
            kind: "push",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_file",
              },
              {
                kind: "remember",
                key: "k_rodz_friend",
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "boy",
          },
          {
            id: "stop",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_friend",
              },
            ],
            next: null,
          },
        ],
      },
      bargain: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "read",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "file",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_friend",
              },
            ],
            next: null,
          },
        ],
      },
      boy: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_rodz_shells",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["trenches"],
              },
            },
            {
              kind: "gauge",
              gauge: "shells",
              max: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_w_shell_famine" } },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plan",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "plan",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: 1,
                  },
                  {
                    kind: "reason",
                    key: "t_rodz_shells_r2",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:+1", "ministers:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_rodz_shells",
              },
            ],
            next: "plan",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "plan",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plan",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      plan: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_shells",
              },
            ],
            next: null,
          },
          {
            id: "hm",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_rodz_shells_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "rus_t_rodz_bloc",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["trenches"],
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_h_bloc" } },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "names",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "back",
            miss: "back",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_bloc",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
            ],
            next: "names",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      names: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_bloc",
              },
            ],
            next: null,
          },
          {
            id: "gor",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "chair",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      chair: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_bloc",
              },
            ],
            next: null,
          },
          {
            id: "laugh",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_bloc",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      back: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "names",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_rodz_bread",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material", "depth", "storm"],
          },
        },
        {
          kind: "gauge",
          gauge: "bread",
          max: 2,
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rail",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_bread",
              },
            ],
            next: "rail",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["ministers:-1"],
            effects: [
              {
                kind: "inst",
                inst: "ministers",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_rodz_bread",
              },
            ],
            next: "rail",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      rail: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "num",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_wagons",
              },
            ],
            next: "end",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "end",
                effects: [
                  {
                    kind: "remember",
                    key: "k_rodz_wagons",
                  },
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "proto",
            stance: "frank",
            kind: "ask",
            when: {
              kind: "holder",
              office: "interior",
              person: "rus_protopopov",
            },
            tell: [],
            effects: [],
            next: "deputy",
          },
          {
            id: "stop",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      deputy: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "num",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_wagons",
              },
            ],
            next: "end",
          },
          {
            id: "sharp",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      end: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "ok2",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_rodz_last",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["depth", "storm"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
            {
              kind: "gauge",
              gauge: "order",
              max: 1,
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rodzianko",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hear",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "hear",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: 1,
                  },
                  {
                    kind: "reason",
                    key: "t_rodz_last_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "short",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: "cut",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_last",
              },
            ],
            next: "hear",
          },
          {
            id: "leave",
            stance: "threat",
            kind: "leave",
            tell: ["trust:-1", "duma:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      hear: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_last",
              },
            ],
            next: null,
          },
          {
            id: "her",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "her",
          },
          {
            id: "doubt",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      her: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_last",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "rage",
            stance: "threat",
            kind: "leave",
            tell: ["duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      cut: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "stay",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_rodz_last",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_first",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["movement", "trenches"],
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "seen",
                  scene: "rus_h_bloc",
                },
                {
                  kind: "memory",
                  key: "k_rodz_session",
                },
              ],
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_h_peace_heir" } },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "three" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { three: "m_three" },
    nodes: {
      m_three: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "alive",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "law",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_mil_met" }],
            next: "law",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "law",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "law",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cold"],
                },
                next: "chill",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_mil_met",
              },
            ],
            next: "law",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      law: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "good",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_mil_met",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "ker",
            stance: "frank",
            kind: "ask",
            when: {
              kind: "memory",
              key: "k_ker_met",
            },
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_met",
              },
            ],
            next: "rival",
          },
          {
            id: "sharp",
            stance: "threat",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_mil_met",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      rival: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      chill: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "law",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_straits",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["trenches"],
          },
        },
        {
          kind: "memory",
          key: "k_mil_met",
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "allies",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "cost",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "allies",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["duma:+1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_mil_straits",
              },
            ],
            next: "allies",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "allies",
                effects: [
                  {
                    kind: "reason",
                    key: "t_mil_straits_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      allies: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_straits",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cost: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "allies",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_bloc",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["trenches"],
              },
            },
            {
              kind: "memory",
              key: "k_mil_met",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_h_bloc" } },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "line",
            miss: "line",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:+1", "court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_mil_bloc",
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "line",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cold"],
                },
                next: "line",
                effects: [
                  {
                    kind: "reason",
                    key: "t_mil_bloc_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      why: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "good",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_bloc",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      line: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_bloc",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_poland",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "memory",
              key: "k_mil_met",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_h_poland_charter" } },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "crown",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "crown",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_mil_poland",
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "crown",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      crown: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_poland",
              },
            ],
            next: null,
          },
          {
            id: "saz",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "saz",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      saz: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_poland",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: null,
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_mil_poland_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_speech",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "memory",
              key: "k_mil_met",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
            {
              kind: "inst",
              inst: "duma",
              max: 0,
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_r_treason" } },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
            gain: [
              {
                kind: "remember",
                key: "k_mil_speech",
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "line",
            miss: "dare",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["ministers:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_mil_speech",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
            ],
            next: "line",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_mil_speech_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
      line: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "heard",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_speech",
              },
            ],
            next: null,
          },
          {
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_speech",
              },
            ],
            next: null,
          },
        ],
      },
      dare: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_mil_note",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["depth", "storm"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_milyukov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "third",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "third",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "wall",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_note",
              },
            ],
            next: "third",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      third: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_mil_note",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cold"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "third",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_first",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "era",
              of: ["depth", "storm"],
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_rodz_session",
            },
            {
              kind: "seen",
              scene: "rus_h_bloc",
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "count" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { count: "k_count" },
    nodes: {
      k_count: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "know",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lena",
          },
          {
            id: "dont",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_ker_met" }],
            next: "lena",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: ["court:-1", "duma:+1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "lena",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "lena",
                effects: [
                  {
                    kind: "reason",
                    key: "t_ker_first_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: ["court:-1", "duma:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
            ],
            next: "lena",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["court:-1", "duma:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_ker_met",
              },
            ],
            next: "lena",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["court:-1", "duma:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      lena: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_met",
              },
            ],
            next: null,
          },
          {
            id: "cut",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_met",
              },
            ],
            next: "stage",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "stage",
                effects: [
                  {
                    kind: "remember",
                    key: "k_ker_met",
                  },
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
        ],
      },
      stage: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_amnesty",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "all",
              of: [
                {
                  kind: "chapter",
                  min: 3,
                  max: 5,
                },
                {
                  kind: "memory",
                  key: "k_ker_met",
                },
                {
                  kind: "any",
                  of: [
                    {
                      kind: "not",
                      of: {
                        kind: "world",
                        of: {
                          is: "command",
                        },
                      },
                    },
                    {
                      kind: "flag",
                      flag: "f_rus_in_capital",
                    },
                  ],
                },
              ],
            },
            { kind: "not", of: { kind: "seen", scene: "rus_c_balcony" } },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "angry",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "who",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_amnesty",
              },
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_ker_amnesty",
                chapters: 4,
                keep: {
                  kind: "chose",
                  scene: "rus_c_balcony",
                  pick: "amnesty",
                },
              },
            ],
            next: "who",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "who",
                effects: [
                  {
                    kind: "reason",
                    key: "t_ker_amnesty_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_amnesty",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      angry: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_depots",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material", "depth", "storm"],
              },
            },
            {
              kind: "memory",
              key: "k_ker_met",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_w_depots" } },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "truth",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "truth",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["order:+1", "court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_depots",
              },
              {
                kind: "gauge",
                gauge: "order",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "truth",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      truth: {
        says: [
          {
            id: "rotten",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "secret",
                  id: "rus_garrison_rotten",
                },
              ],
            },
          },
          {
            id: "sound",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "not",
                  of: {
                    kind: "secret",
                    id: "rus_garrison_rotten",
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_depots",
              },
              {
                kind: "maybe",
                when: {
                  kind: "all",
                  of: [
                    {
                      kind: "candid",
                      who: {
                        role: "p",
                      },
                    },
                    {
                      kind: "secret",
                      id: "rus_garrison_rotten",
                    },
                  ],
                },
                then: [
                  {
                    kind: "world",
                    of: {
                      do: "reveal",
                      id: "rus_garrison_rotten",
                    },
                  },
                ],
              },
            ],
            next: null,
          },
          {
            id: "mil",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "prof",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      prof: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_depots",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_justice",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "old",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "soviet",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["soviet:+1", "duma:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_justice",
              },
              {
                kind: "inst",
                inst: "soviet",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "soviet",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      old: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_justice",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      soviet: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_justice",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: null,
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_ker_justice_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_front",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth", "storm"],
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["provisional", "rep"],
              },
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_r_offensive" } },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "after",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "after",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["morale:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_front",
              },
              {
                kind: "gauge",
                gauge: "morale",
                delta: 1,
              },
            ],
            next: "after",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      after: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_front",
              },
            ],
            next: null,
          },
          {
            id: "off",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "officers",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      officers: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_front",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: null,
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_ker_front_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ker_last",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["depth", "storm"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "world",
          of: {
            is: "unrest",
            min: 1,
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kerensky",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "land",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "land",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["soviet:+1", "duma:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_last",
              },
              {
                kind: "inst",
                inst: "soviet",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "land",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_ker_last_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
      land: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ker_last",
              },
            ],
            next: null,
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "alone",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      alone: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ker_last",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_stockholm",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material"],
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "flag",
              flag: "f_rus_in_capital",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "room",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cunning"],
                },
                next: "fog",
                effects: [
                  {
                    kind: "reason",
                    key: "t_proto_stockholm_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "room",
            miss: "fog",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_proto_stockholm",
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
            ],
            next: "room",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      room: {
        says: [
          {
            id: "real",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "secret",
                  id: "rus_german_feeler",
                },
              ],
            },
          },
          {
            id: "empty",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "not",
                  of: {
                    kind: "secret",
                    id: "rus_german_feeler",
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_stockholm",
              },
              {
                kind: "maybe",
                when: {
                  kind: "all",
                  of: [
                    {
                      kind: "candid",
                      who: {
                        role: "p",
                      },
                    },
                    {
                      kind: "secret",
                      id: "rus_german_feeler",
                    },
                  ],
                },
                then: [
                  {
                    kind: "world",
                    of: {
                      do: "reveal",
                      id: "rus_german_feeler",
                    },
                  },
                ],
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_stockholm",
              },
            ],
            next: null,
          },
        ],
      },
      fog: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "room",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_ready",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material"],
              },
            },
            {
              kind: "seen",
              scene: "rus_r_sturmer",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "not",
              of: {
                kind: "holder",
                office: "interior",
                person: "rus_protopopov",
              },
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_r_protopopov" } },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "police",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "police",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_ready",
              },
            ],
            next: "police",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      police: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_ready",
              },
            ],
            next: null,
          },
          {
            id: "rodz",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rodz",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_proto_ready_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
      rodz: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_ready",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_free",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "all",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "era",
                    of: ["material"],
                  },
                },
                {
                  kind: "holder",
                  office: "interior",
                  person: "rus_protopopov",
                },
                {
                  kind: "any",
                  of: [
                    {
                      kind: "not",
                      of: {
                        kind: "world",
                        of: {
                          is: "command",
                        },
                      },
                    },
                    {
                      kind: "flag",
                      flag: "f_rus_in_capital",
                    },
                  ],
                },
              ],
            },
            { kind: "not", of: { kind: "seen", scene: "rus_r_treason" } },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "why",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "fog",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_free",
              },
            ],
            next: "why",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      why: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_free",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fog: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_bread",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["material", "depth"],
              },
            },
            {
              kind: "holder",
              office: "interior",
              person: "rus_protopopov",
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "num",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "num",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_bread",
              },
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_proto_bread",
                chapters: 5,
                keep: {
                  kind: "chose",
                  scene: "rus_h_grain_levy",
                  pick: "levy_under_interior",
                },
              },
            ],
            next: "num",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      num: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_bread",
              },
            ],
            next: null,
          },
          {
            id: "agri",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "agri",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      agri: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_bread",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_police",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "all",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "era",
                    of: ["depth", "storm"],
                  },
                },
                {
                  kind: "holder",
                  office: "interior",
                  person: "rus_protopopov",
                },
                {
                  kind: "any",
                  of: [
                    {
                      kind: "not",
                      of: {
                        kind: "world",
                        of: {
                          is: "command",
                        },
                      },
                    },
                    {
                      kind: "flag",
                      flag: "f_rus_in_capital",
                    },
                  ],
                },
              ],
            },
            { kind: "not", of: { kind: "seen", scene: "rus_r_capital" } },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "src",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "plan",
            miss: "fog",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_police",
              },
            ],
            next: "plan",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      src: {
        says: [
          {
            id: "bad",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "source_band",
                  source: "agents",
                  max: 1,
                },
              ],
            },
          },
          {
            id: "good",
            when: {
              kind: "all",
              of: [
                {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                {
                  kind: "source_band",
                  source: "agents",
                  min: 2,
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "plan",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_police",
              },
            ],
            next: "plan",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      plan: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_police",
              },
            ],
            next: null,
          },
          {
            id: "ok2",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_proto_police",
              },
            ],
            next: null,
          },
        ],
      },
      fog: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "src",
          },
        ],
      },
    },
  },
  {
    id: "rus_t_proto_spirits",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "era",
                of: ["depth", "storm"],
              },
            },
            {
              kind: "holder",
              office: "interior",
              person: "rus_protopopov",
            },
            {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "command",
                    },
                  },
                },
                {
                  kind: "flag",
                  flag: "f_rus_in_capital",
                },
              ],
            },
          ],
        },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: {
      p: {
        person: "rus_protopopov",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "sick",
            when: {
              kind: "health",
              who: {
                role: "p",
              },
              max: 1,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "doc",
          },
          {
            id: "push",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "doc",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cunning"],
                },
                next: "doc",
                effects: [
                  {
                    kind: "reason",
                    key: "t_proto_spirits_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "doc",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "doc",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      doc: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "sick",
            when: {
              kind: "health",
              who: {
                role: "p",
              },
              max: 1,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "out",
            stance: "cold",
            kind: "push",
            tell: ["court:-1", "duma:+1"],
            effects: [
              {
                kind: "dismiss",
                who: {
                  role: "p",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "her",
          },
          {
            id: "stay",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      her: {
        says: [
          {
            id: "cun",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "out",
            stance: "cold",
            kind: "push",
            tell: ["court:-2", "duma:+1"],
            effects: [
              {
                kind: "dismiss",
                who: {
                  role: "p",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -2,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "stay",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_buchanan_last",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material", "depth"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "inst",
          inst: "duma",
          max: 0,
        },
      ],
    },
    cast: {
      p: {
        person: "gbr_buchanan",
      },
    },
    salience: 7,
    tags: ["foreign"],
    once: true,
    who: "p",
    variants: [
      { id: "asks" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { asks: "b_asks" },
    nodes: {
      b_asks: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "none",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wall",
          },
          {
            id: "reports",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "wall",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wall",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "wall",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "wall",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_buchanan_warn",
              },
            ],
            next: "wall",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sharp",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "last",
          },
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_buchanan_warn",
              },
            ],
            next: null,
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "london",
          },
          {
            id: "end",
            stance: "threat",
            kind: "leave",
            tell: ["ally:-1"],
            effects: [
              {
                kind: "trust",
                tag: "GBR",
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      london: {
        says: [
          {
            id: "trust",
            when: {
              kind: "person_trust",
              who: {
                role: "p",
              },
              min: 1,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_buchanan_warn",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      last: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_buchanan_warn",
              },
            ],
            next: null,
          },
          {
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_buchanan_warn",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_michael_ready",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "era",
            of: ["material", "depth"],
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
            {
              kind: "seen",
              scene: "rus_r_friend_dead",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_michael",
      },
    },
    salience: 7,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [
      { id: "wife" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { wife: "m_wife" },
    nodes: {
      m_wife: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_michael_ready" }],
            next: "wife",
          },
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "names",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["weary"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "names",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "names",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_michael_ready",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "wife",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["weary"],
                },
                next: null,
                effects: [
                  {
                    kind: "reason",
                    key: "t_michael_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
      names: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["anxious"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ready",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_michael_ready",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wife: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "end2",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_chkh_order",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "world",
      of: {
        is: "regime",
        of: ["provisional"],
      },
    },
    cast: {
      p: {
        person: "rus_chkheidze",
      },
    },
    salience: 8,
    tags: ["home"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rule",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["soviet:-1"],
            effects: [
              {
                kind: "inst",
                inst: "soviet",
                delta: -1,
              },
            ],
            next: "rule",
            miss: "wall",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["soviet:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_chkh_order",
              },
              {
                kind: "inst",
                inst: "soviet",
                delta: 1,
              },
            ],
            next: "rule",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      rule: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["weary"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_chkh_order",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wall: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rule",
          },
        ],
      },
    },
  },
  {
    id: "rus_v_kornilov_plan",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["provisional", "rep"],
          },
        },
        {
          kind: "world",
          of: {
            is: "era",
            of: ["depth", "storm"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kornilov",
      },
    },
    salience: 7,
    tags: ["war"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["stavka:+1", "soviet:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_kornilov_deal",
              },
              {
                kind: "inst",
                inst: "stavka",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "soviet",
                delta: -1,
              },
            ],
            next: "who",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kornilov_deal",
              },
            ],
            next: null,
          },
          {
            id: "brus",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "brus",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      brus: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kornilov_deal",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: null,
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "p",
                    },
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_kornilov_r1",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
];
