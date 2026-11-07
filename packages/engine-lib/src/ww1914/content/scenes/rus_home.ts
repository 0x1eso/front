import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「러시아」, the court and country share (plan: ww135-plan-rus.md §6, §8, §9):
 * the rus_h_ scenes, the talks of Alexandra, Rasputin, Krivoshein and Bark, and
 * the visits of Fredericks, Maria, Samarin, Kokovtsov and Lvov. Data only; the
 * text is in resources/ww1914/ko/RUS.home.json.
 */
export const RUS_HOME_SCENES: readonly GwScene[] = [
  {
    id: "rus_h_roster",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 0,
      max: 0,
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      court: {
        office: "court",
      },
    },
    salience: 9,
    tags: ["people"],
    once: true,
    stamp: "confirmed",
    variants: [
      {
        id: "no_shot",
        when: {
          kind: "opening",
          of: ["no_sarajevo"],
        },
      },
      {
        id: "one_page",
        when: {
          kind: "temperament",
          who: {
            role: "chancellor",
          },
          of: ["weary"],
        },
      },
      { id: "three_inks" },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_h_diary",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "world",
      of: {
        is: "regime",
        of: ["tsar", "crown"],
      },
    },
    cast: {},
    salience: 3,
    tags: ["home", "tension_down"],
    cooldown: 6,
    stamp: "confirmed",
    variants: [
      {
        id: "after_friend",
        when: {
          kind: "seen",
          scene: "rus_r_friend_dead",
        },
      },
      {
        id: "bleed",
        when: {
          kind: "seen",
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
        id: "bread",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      },
      {
        id: "retreat",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "east",
            from: "vistula",
          },
        },
      },
      {
        id: "war_early",
        when: {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1914-12",
          },
        },
      },
      { id: "duma2", when: { kind: "inst", inst: "duma", max: -1 } },
      { id: "duma3", when: { kind: "inst", inst: "duma", max: -1 } },
      {
        id: "duma",
        when: {
          kind: "inst",
          inst: "duma",
          max: -1,
        },
      },
      { id: "plain1" },
      { id: "plain2" },
      { id: "plain3" },
      { id: "plain4" },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_h_wife_letter",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "command",
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
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
          },
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["people"],
    cooldown: 3,
    variants: [
      {
        id: "broke_list",
        when: {
          kind: "memory",
          key: "broke_p_alex_list",
        },
      },
      {
        id: "polivanov",
        when: {
          kind: "holder",
          office: "war",
          person: "rus_polivanov",
        },
      },
      {
        id: "duma_up",
        when: {
          kind: "inst",
          inst: "duma",
          min: 1,
        },
      },
      {
        id: "bread",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      },
      {
        id: "alek",
        when: {
          kind: "inst",
          inst: "stavka",
          min: 1,
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_h_keys",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "command",
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
              kind: "seen",
              scene: "rus_w_command",
            },
            {
              kind: "chose",
              scene: "rus_c_supreme",
              pick: "self_command",
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 9,
    tags: ["people", "home"],
    once: true,
    variants: [
      {
        id: "early",
        when: {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1915-01",
          },
        },
      },
      {
        id: "alek_terms",
        when: {
          kind: "memory",
          key: "k_alek_terms",
        },
      },
      {
        id: "after_letter",
        when: {
          kind: "seen",
          scene: "rus_h_ministers_letter",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "council_rules",
    options: [
      {
        id: "council_rules",
        tell: ["ministers:+1", "court:-1"],
        effects: [
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
            kind: "flag",
            flag: "f_council_rules",
          },
        ],
      },
      {
        id: "give_her_keys",
        when: {
          kind: "memory",
          key: "k_alex_list",
        },
        tell: ["court:+2", "ministers:-2", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_her_keys",
          },
        ],
      },
      {
        id: "krivoshein_runs",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_kriv_premier",
            },
            {
              kind: "in_office",
              who: {
                person: "rus_krivoshein",
              },
            },
          ],
        },
        tell: ["ministers:+1", "duma:+1", "court:-2"],
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
            delta: -2,
          },
          {
            kind: "appoint",
            who: {
              person: "rus_krivoshein",
            },
            office: "chancellor",
          },
          {
            kind: "flag",
            flag: "f_kriv_runs",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_friend_comes",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "person_trust",
          who: {
            person: "rus_alexandra",
          },
          min: 0,
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    cooldown: 6,
    variants: [
      {
        id: "wounded",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "war" } },
            {
              kind: "flag",
              flag: "f_ras_wounded",
            },
            {
              kind: "world",
              of: {
                is: "date",
                from: "1914-08",
                to: "1914-12",
              },
            },
          ],
        },
      },
      {
        id: "boy_well",
        when: {
          kind: "memory",
          key: "k_ras_boy",
        },
      },
      { id: "talk_town2", when: { kind: "inst", inst: "duma", max: 0 } },
      { id: "talk_town3", when: { kind: "inst", inst: "duma", max: 0 } },
      {
        id: "talk_town",
        when: {
          kind: "inst",
          inst: "duma",
          max: 0,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "quietly",
    options: [
      {
        id: "quietly",
        tell: ["court:+1", "duma:-1", "trust:+1"],
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
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "ras_in_palace",
          },
        ],
      },
      {
        id: "keep_away",
        when: {
          kind: "memory",
          key: "k_nik_friend",
        },
        tell: ["court:-2", "stavka:+1", "trust:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -1,
          },
          {
            kind: "reason",
            key: "rus_h_friend_kept_out",
          },
        ],
      },
      {
        id: "once_more_only",
        when: {
          kind: "memory",
          key: "k_ras_boy",
        },
        tell: ["court:+1", "trust:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_rasputin",
            },
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_ras_only_boy",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_friend_file",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-05",
            to: "1915-12",
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
          kind: "seen",
          scene: "rus_h_friend_comes",
        },
        {
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
      ],
    },
    cast: {
      interior: {
        office: "interior",
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
    stamp: "unconfirmed",
    source: "agents",
    variants: [
      {
        id: "samarin",
        when: {
          kind: "memory",
          key: "k_samarin_file",
        },
      },
      {
        id: "heard_rodz",
        when: {
          kind: "memory",
          key: "k_rodz_file",
        },
      },
      { id: "thick" },
      {
        id: "base",
      },
    ],
    fallback: "burn_it",
    options: [
      {
        id: "burn_it",
        tell: ["court:+1", "ministers:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "remember",
            key: "file_burned",
          },
        ],
      },
      {
        id: "read_it",
        tell: ["ministers:+1"],
        effects: [
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_file_read",
          },
        ],
      },
      {
        id: "fire_the_author",
        tell: ["court:+2", "duma:-1", "ministers:-1"],
        effects: [
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
          {
            kind: "source",
            source: "agents",
            right: false,
          },
          {
            kind: "reason",
            key: "rus_h_file_author_out",
          },
        ],
      },
      {
        id: "show_her",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_samarin_file",
            },
            {
              kind: "memory",
              key: "k_rodz_file",
            },
          ],
        },
        tell: ["court:-2", "duma:+1", "trust:-2"],
        effects: [
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
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_file_shown",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_heir_bleed",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
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
              kind: "chose",
              scene: "rus_h_heir_stavka",
              pick: "take_him",
            },
            {
              kind: "chose",
              scene: "rus_h_heir_stavka",
              pick: "one_week",
            },
            {
              kind: "flag",
              flag: "f_friend_exiled",
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    cooldown: 12,
    variants: [
      {
        id: "he_returns",
        when: {
          kind: "memory",
          key: "broke_p_ras_leave",
        },
      },
      {
        id: "exiled",
        when: {
          kind: "flag",
          flag: "f_friend_exiled",
        },
      },
      {
        id: "train",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_h_heir_stavka",
              pick: "take_him",
            },
            {
              kind: "chose",
              scene: "rus_h_heir_stavka",
              pick: "one_week",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "back_to_her",
    options: [
      {
        id: "back_to_her",
        tell: ["audiences:-1", "court:+1", "ministers:-1", "heir"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
        ],
      },
      {
        id: "wire_friend",
        when: {
          kind: "memory",
          key: "k_alex_friend",
        },
        tell: ["court:+2", "duma:-1", "trust:+1", "heir"],
        effects: [
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
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: 1,
          },
          {
            kind: "maybe",
            when: {
              kind: "flag",
              flag: "f_friend_exiled",
            },
            then: [
              {
                kind: "unflag",
                flag: "f_friend_exiled",
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
              {
                kind: "reason",
                key: "rus_h_friend_recalled",
              },
            ],
          },
        ],
      },
      {
        id: "doctors_only",
        tell: ["ministers:+1", "court:-1", "trust:-1"],
        effects: [
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
    ],
  },
  {
    id: "rus_h_bloc",
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
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-06",
            to: "1915-12",
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
                is: "front",
                theatre: "east",
                from: "vistula",
              },
            },
            {
              kind: "seen",
              scene: "rus_w_shell_famine",
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      agriculture: {
        office: "agriculture",
      },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "kriv_inside",
        when: {
          kind: "memory",
          key: "k_kriv_bloc",
        },
      },
      {
        id: "rodz_broken",
        when: {
          kind: "memory",
          key: "broke_p_rodz_session",
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
        id: "court_high",
        when: {
          kind: "inst",
          inst: "court",
          min: 2,
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
          {
            kind: "remember",
            key: "bloc_prorogued",
          },
        ],
      },
      {
        id: "talk_only",
        tell: ["ministers:+1", "court:-1"],
        effects: [
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
            kind: "flag",
            flag: "f_bloc_talks",
          },
        ],
      },
      {
        id: "confidence",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kriv_bloc",
            },
            {
              kind: "memory",
              key: "k_mil_bloc",
            },
            {
              kind: "memory",
              key: "k_rodz_bloc",
            },
          ],
        },
        tell: [
          "duma:+2",
          "court:-3",
          "ministers:+1",
          "trust:-2",
          "regime_change",
        ],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -3,
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
            kind: "world",
            of: {
              do: "regime",
              to: "crown",
            },
          },
          {
            kind: "maybe",
            when: {
              kind: "in_office",
              who: {
                person: "rus_krivoshein",
              },
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
                kind: "in_office",
                who: {
                  person: "rus_krivoshein",
                },
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
      {
        id: "prorogue_soft",
        when: {
          kind: "memory",
          key: "k_gor_prorogue",
        },
        tell: ["duma:-1", "ministers:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_duma_date_given",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_ministers_letter",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "command",
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
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_w_command",
            },
            {
              kind: "seen",
              scene: "rus_h_keys",
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      fm: {
        office: "foreign",
      },
    },
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "kriv_runs",
        when: {
          kind: "flag",
          flag: "f_kriv_runs",
        },
      },
      {
        id: "her_keys",
        when: {
          kind: "flag",
          flag: "f_her_keys",
        },
      },
      {
        id: "after_lost",
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
        id: "base",
      },
    ],
    fallback: "ignore",
    options: [
      {
        id: "ignore",
        tell: ["ministers:-1"],
        effects: [
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "remember",
            key: "letter_ignored",
          },
        ],
      },
      {
        id: "dismiss_signers",
        tell: ["court:+2", "ministers:-3", "duma:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -3,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "maybe",
            when: {
              kind: "all",
              of: [
                {
                  kind: "in_office",
                  who: {
                    person: "rus_krivoshein",
                  },
                },
                {
                  kind: "not",
                  of: {
                    kind: "flag",
                    flag: "f_kriv_runs",
                  },
                },
              ],
            },
            then: [
              {
                kind: "dismiss",
                who: {
                  person: "rus_krivoshein",
                },
              },
            ],
          },
          {
            kind: "reason",
            key: "rus_h_signers_out",
          },
        ],
      },
      {
        id: "keep_them",
        when: {
          kind: "memory",
          key: "k_gor_letter",
        },
        tell: ["ministers:+1", "court:-1"],
        effects: [
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
            kind: "flag",
            flag: "f_letter_kept",
          },
        ],
      },
      {
        id: "swap_goremykin",
        when: {
          kind: "holder",
          office: "chancellor",
          person: "rus_goremykin",
        },
        tell: ["ministers:+2", "court:-2"],
        effects: [
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
          {
            kind: "dismiss",
            who: {
              role: "chancellor",
            },
          },
          {
            kind: "maybe",
            when: {
              kind: "promise",
              who: {
                person: "rus_goremykin",
              },
              key: "p_gor_release",
            },
            then: [
              {
                kind: "keep_promise",
                who: {
                  person: "rus_goremykin",
                },
                key: "p_gor_release",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_leapfrog",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
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
          kind: "person_trust",
          who: {
            role: "rival",
          },
          max: -2,
        },
      ],
    },
    cast: {
      rival: {
        rival: true,
      },
      court: {
        office: "court",
      },
    },
    salience: 7,
    tags: ["people"],
    cooldown: 4,
    variants: [
      {
        id: "her_list",
        when: {
          kind: "memory",
          key: "k_alex_list",
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
      { id: "duma_low2", when: { kind: "inst", inst: "duma", max: -1 } },
      { id: "duma_low3", when: { kind: "inst", inst: "duma", max: -1 } },
      {
        id: "duma_low",
        when: {
          kind: "inst",
          inst: "duma",
          max: -1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "court_name",
    options: [
      {
        id: "court_name",
        tell: ["court:+1", "duma:-1"],
        effects: [
          {
            kind: "dismiss",
            who: {
              role: "rival",
            },
          },
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
              flag: "f_leap_court_1",
            },
            then: [
              {
                kind: "flag",
                flag: "f_leap_court_2",
              },
            ],
          },
          {
            kind: "flag",
            flag: "f_leap_court_1",
          },
          {
            kind: "remember",
            key: "leap_court",
          },
        ],
      },
      {
        id: "duma_name",
        tell: ["duma:+1", "court:-1", "trust:-1"],
        effects: [
          {
            kind: "dismiss",
            who: {
              role: "rival",
            },
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
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "leap_duma",
          },
        ],
      },
      {
        id: "leave_empty",
        when: {
          kind: "memory",
          key: "k_alex_list",
        },
        tell: ["ministers:-1"],
        effects: [
          {
            kind: "dismiss",
            who: {
              role: "rival",
            },
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_leap_empty",
          },
        ],
      },
      {
        id: "keep_him",
        tell: ["trust:+1", "court:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "rival",
            },
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
    id: "rus_h_wagons",
    nation: ["RUS"],
    kind: "proposal",
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
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1917-12",
          },
        },
        {
          kind: "gauge",
          gauge: "bread",
          max: 2,
        },
      ],
    },
    cast: {
      agriculture: {
        office: "agriculture",
      },
      war: {
        office: "war",
      },
    },
    salience: 9,
    tags: ["home"],
    cooldown: 6,
    variants: [
      {
        id: "ras_said",
        when: {
          kind: "memory",
          key: "k_ras_wagons",
        },
      },
      {
        id: "kriv_math",
        when: {
          kind: "memory",
          key: "k_kriv_rail",
        },
      },
      {
        id: "empty_shops",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 0,
        },
      },
      {
        id: "winter",
        when: {
          kind: "all",
          of: [
            {
              kind: "gauge",
              gauge: "bread",
              max: 1,
            },
            {
              kind: "any",
              of: [
                {
                  kind: "world",
                  of: {
                    is: "date",
                    from: "1915-11",
                    to: "1916-03",
                  },
                },
                {
                  kind: "world",
                  of: {
                    is: "date",
                    from: "1916-11",
                    to: "1917-03",
                  },
                },
                {
                  kind: "world",
                  of: {
                    is: "date",
                    from: "1917-11",
                    to: "1918-03",
                  },
                },
              ],
            },
          ],
        },
      },
      { id: "sacks" },
      {
        id: "base",
      },
    ],
    fallback: "army_first",
    options: [
      {
        id: "army_first",
        tell: ["stavka:+1", "bread:-1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "capital_first",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kriv_rail",
            },
            {
              kind: "memory",
              key: "k_ras_wagons",
            },
            {
              kind: "memory",
              key: "k_rodz_wagons",
            },
          ],
        },
        tell: ["bread:+1", "stavka:-1", "shells:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "maybe",
            when: {
              kind: "memory",
              key: "k_ras_wagons",
            },
            then: [
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
          },
          {
            kind: "flag",
            flag: "f_wagons_capital",
          },
        ],
      },
      {
        id: "murmansk_rails",
        when: {
          kind: "memory",
          key: "k_bark_gold",
        },
        tell: ["money:-1", "ministers:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_murmansk_rails",
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_grain_levy",
    nation: ["RUS"],
    kind: "proposal",
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
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1917-12",
          },
        },
        {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      ],
    },
    cast: {
      agriculture: {
        office: "agriculture",
      },
      interior: {
        office: "interior",
      },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    cooldown: 8,
    variants: [
      {
        id: "proto",
        when: {
          kind: "memory",
          key: "k_proto_bread",
        },
      },
      {
        id: "cold_villages",
        when: {
          kind: "gauge",
          gauge: "morale",
          max: 2,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "price_cap",
    options: [
      {
        id: "price_cap",
        tell: ["bread:-1", "ministers:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
        ],
      },
      {
        id: "levy",
        tell: ["bread:+1", "morale:-1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_grain_levy",
          },
        ],
      },
      {
        id: "levy_under_interior",
        when: {
          kind: "memory",
          key: "k_proto_bread",
        },
        tell: ["court:+1", "ministers:-1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_grain_interior",
          },
        ],
      },
      {
        id: "pay_in_goods",
        when: {
          kind: "memory",
          key: "k_kriv_land",
        },
        tell: ["bread:+1", "shells:-1", "duma:+1"],
        effects: [
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
            inst: "duma",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_rubles",
    nation: ["RUS"],
    kind: "proposal",
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
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
          },
        },
        {
          kind: "gauge",
          gauge: "money",
          max: 1,
        },
      ],
    },
    cast: {
      finance: {
        office: "finance",
      },
    },
    salience: 7,
    tags: ["home"],
    cooldown: 8,
    variants: [
      {
        id: "vodka",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_c_vodka",
              pick: "whole_war",
            },
            {
              kind: "chose",
              scene: "rus_c_vodka",
              pick: "whole_war_tax",
            },
          ],
        },
      },
      {
        id: "credit",
        when: {
          kind: "memory",
          key: "k_bark_credit",
        },
      },
      {
        id: "tax",
        when: {
          kind: "memory",
          key: "k_bark_paper",
        },
      },
      { id: "notes" },
      {
        id: "base",
      },
    ],
    fallback: "print",
    options: [
      {
        id: "print",
        tell: ["money:+1", "bread:-1", "morale:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
        ],
      },
      {
        id: "gold_to_london",
        when: {
          kind: "memory",
          key: "k_bark_gold",
        },
        tell: ["money:+2", "ministers:+1", "court:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
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
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_gold_sent",
          },
        ],
      },
      {
        id: "income_tax",
        when: {
          kind: "memory",
          key: "k_bark_paper",
        },
        tell: ["money:+1", "duma:+1", "court:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
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
        id: "london_terms",
        when: {
          kind: "memory",
          key: "k_bark_credit",
        },
        tell: ["money:+1", "shells:+1", "stavka:-1", "ally:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_straits_note",
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
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
          },
        },
        {
          kind: "at_war",
          tag: "OTT",
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "open",
                theatre: "straits",
              },
            },
            {
              kind: "memory",
              key: "k_saz_straits",
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "gallipoli2",
        when: { kind: "world", of: { is: "open", theatre: "straits" } },
      },
      {
        id: "gallipoli",
        when: {
          kind: "world",
          of: {
            is: "open",
            theatre: "straits",
          },
        },
      },
      {
        id: "with_duma",
        when: {
          kind: "memory",
          key: "k_mil_straits",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "ask_gently",
    options: [
      {
        id: "ask_gently",
        tell: ["ally:+1", "ministers:+1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
        ],
      },
      {
        id: "demand_paper",
        when: {
          kind: "memory",
          key: "k_saz_straits",
        },
        tell: ["ally:-1", "stavka:+1", "ministers:+1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_straits_paper",
          },
        ],
      },
      {
        id: "with_duma",
        when: {
          kind: "memory",
          key: "k_mil_straits",
        },
        tell: ["duma:+2", "court:-1", "ally:-1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_straits_paper",
          },
          {
            kind: "flag",
            flag: "f_straits_public",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_peace_programme",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "war",
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1915-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      war: {
        office: "war",
      },
      finance: {
        office: "finance",
      },
    },
    salience: 8,
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      {
        id: "let_go",
        when: {
          kind: "chose",
          scene: "rus_c_council",
          pick: "let_go",
        },
      },
      {
        id: "kriv",
        when: {
          kind: "memory",
          key: "k_kriv_rail",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "full_programme",
    options: [
      {
        id: "full_programme",
        tell: ["stavka:+2", "money:-1", "shells:+1", "temp:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 2,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "temp",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_peace_programme",
          },
        ],
      },
      {
        id: "rails_first",
        when: {
          kind: "memory",
          key: "k_kriv_rail",
        },
        tell: ["stavka:-1", "ministers:+1", "bread:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_peace_programme",
          },
        ],
      },
      {
        id: "cut_for_schools",
        tell: ["stavka:-2", "duma:+2", "morale:+1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_peace_schools",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_friend_exile",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "inst",
          inst: "court",
          max: 1,
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_ras_gone",
            },
            {
              kind: "all",
              of: [
                {
                  kind: "memory",
                  key: "k_kok_friend",
                },
                {
                  kind: "memory",
                  key: "k_maria_plea",
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      {
        id: "he_agreed",
        when: {
          kind: "memory",
          key: "k_ras_gone",
        },
      },
      {
        id: "mother",
        when: {
          kind: "memory",
          key: "k_maria_plea",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "send_home",
    options: [
      {
        id: "send_home",
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
            flag: "f_friend_exiled",
          },
          {
            kind: "keep_promise",
            who: {
              person: "rus_rasputin",
            },
            key: "p_ras_leave",
          },
          {
            kind: "reason",
            key: "rus_h_friend_sent_home",
          },
        ],
      },
      {
        id: "half_way",
        tell: ["court:-1", "duma:+1", "trust:-1"],
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
              person: "rus_rasputin",
            },
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_ras_moscow",
          },
        ],
      },
      {
        id: "tear_ticket",
        tell: ["court:+2", "duma:-2", "trust:+1"],
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
            kind: "person_trust",
            who: {
              person: "rus_alexandra",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "ticket_torn",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_heir_stavka",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "command",
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
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
          },
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 6,
    tags: ["people", "tension_down"],
    once: true,
    variants: [
      {
        id: "after_bad",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "east",
            from: "warsaw",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "stay_with_mother",
    options: [
      {
        id: "stay_with_mother",
        tell: ["court:+1", "heir"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
        ],
      },
      {
        id: "take_him",
        tell: ["morale:+1", "stavka:+1", "court:-1", "trust:-1", "heir"],
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
        id: "one_week",
        tell: ["stavka:+1", "heir"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_mother",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["people", "tension_down"],
    cooldown: 6,
    variants: [
      {
        id: "after_friend",
        when: {
          kind: "seen",
          scene: "rus_r_friend_dead",
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
      { id: "easter" },
      { id: "short_note" },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_h_land_word",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1915-01",
            to: "1917-12",
          },
        },
        {
          kind: "memory",
          key: "k_kriv_land",
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
              gauge: "morale",
              max: 2,
            },
          ],
        },
      ],
    },
    cast: {
      agriculture: {
        office: "agriculture",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "kriv_gone",
        when: {
          kind: "not",
          of: {
            kind: "in_office",
            who: {
              person: "rus_krivoshein",
            },
          },
        },
      },
      {
        id: "morale",
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
    fallback: "not_now",
    options: [
      {
        id: "not_now",
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
        ],
      },
      {
        id: "sign_word",
        tell: ["morale:+2", "court:-2", "duma:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 2,
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
            kind: "flag",
            flag: "f_land_word",
          },
          {
            kind: "reason",
            key: "rus_h_land_signed",
          },
        ],
      },
      {
        id: "widows_first",
        tell: ["morale:+1", "ministers:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_land_widows",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_poland_charter",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1916-01",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "front",
            theatre: "east",
            from: "vistula",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_saz_poland",
            },
            {
              kind: "memory",
              key: "k_mil_poland",
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "promised",
        when: {
          kind: "memory",
          key: "k_saz_poland",
        },
      },
      {
        id: "kadets",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_mil_poland",
            },
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "east",
                from: "warsaw",
              },
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "shelve",
    options: [
      {
        id: "shelve",
        tell: ["court:+1", "ministers:-1", "ally:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: -1,
          },
        ],
      },
      {
        id: "charter",
        tell: ["ally:+1", "court:-1", "duma:+1"],
        effects: [
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
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_poland_charter",
          },
        ],
      },
      {
        id: "crown_of_poland",
        when: {
          kind: "memory",
          key: "k_mil_poland",
        },
        tell: ["ally:+2", "duma:+2", "court:-2", "stavka:-1"],
        effects: [
          {
            kind: "trust",
            tag: "FRA",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_poland_charter",
          },
          {
            kind: "flag",
            flag: "f_poland_crown",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_refugees",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1915-01",
            to: "1915-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "front",
            theatre: "east",
            from: "vistula",
          },
        },
      ],
    },
    cast: {
      interior: {
        office: "interior",
      },
      agriculture: {
        office: "agriculture",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "kriv",
        when: {
          kind: "memory",
          key: "k_kriv_refugees",
        },
      },
      { id: "station" },
      {
        id: "base",
      },
    ],
    fallback: "tatiana_committee",
    options: [
      {
        id: "tatiana_committee",
        tell: ["court:+1", "money:-1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "zemstvo_runs",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_lvov_zemgor",
            },
            {
              kind: "memory",
              key: "k_kriv_refugees",
            },
          ],
        },
        tell: ["duma:+2", "court:-1", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_zemstvo_refugees",
          },
        ],
      },
      {
        id: "army_keeps",
        tell: ["stavka:+1", "ministers:-1", "morale:-1"],
        effects: [
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
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
    id: "rus_h_record_turkestan",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1916-09",
            to: "1917-03",
          },
        },
      ],
    },
    cast: {},
    salience: 4,
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
    id: "rus_h_zemgor",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1914-08",
            to: "1915-12",
          },
        },
      ],
    },
    cast: {
      interior: {
        office: "interior",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "lvov",
        when: {
          kind: "memory",
          key: "k_lvov_zemgor",
        },
      },
      { id: "tea" },
      {
        id: "base",
      },
    ],
    fallback: "allow_narrow",
    options: [
      {
        id: "allow_narrow",
        tell: ["morale:+1", "ministers:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
        ],
      },
      {
        id: "allow_wide",
        when: {
          kind: "memory",
          key: "k_lvov_zemgor",
        },
        tell: ["morale:+1", "order:+1", "duma:+2", "court:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_zemgor_wide",
          },
        ],
      },
      {
        id: "refuse",
        tell: ["court:+1", "duma:-1", "morale:-1"],
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
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_war_industry",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1915-01",
            to: "1916-12",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_guch_wic",
            },
            {
              kind: "seen",
              scene: "rus_w_shell_famine",
            },
          ],
        },
      ],
    },
    cast: {
      war: {
        office: "war",
      },
      interior: {
        office: "interior",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "workers",
        when: {
          kind: "memory",
          key: "k_guch_workers",
        },
      },
      {
        id: "guchkov",
        when: {
          kind: "memory",
          key: "k_guch_wic",
        },
      },
      { id: "moscow" },
      {
        id: "base",
      },
    ],
    fallback: "under_ministry",
    options: [
      {
        id: "under_ministry",
        tell: ["shells:+1", "ministers:+1", "duma:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
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
        id: "free_hand",
        when: {
          kind: "memory",
          key: "k_guch_wic",
        },
        tell: ["shells:+2", "duma:+1", "court:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_wic_free",
          },
        ],
      },
      {
        id: "workers_group",
        when: {
          kind: "memory",
          key: "k_guch_workers",
        },
        tell: ["order:+1", "shells:+1", "court:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_wic_workers",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_moscow_riot",
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
            of: ["tsar", "crown"],
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
            is: "date",
            from: "1915-01",
            to: "1915-12",
          },
        },
        {
          kind: "gauge",
          gauge: "morale",
          max: 3,
        },
      ],
    },
    cast: {
      interior: {
        office: "interior",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "rodz",
        when: {
          kind: "memory",
          key: "k_rodz_friend",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "order_back",
    options: [
      {
        id: "order_back",
        tell: ["order:+1", "ministers:+1", "morale:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "ministers",
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
        id: "purge_names",
        tell: ["morale:+1", "court:-2", "ministers:-1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "public_inquiry",
        when: {
          kind: "memory",
          key: "k_rodz_friend",
        },
        tell: ["duma:+2", "court:-1", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_moscow_inquiry",
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_peace_duma",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "war",
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "let_go",
        when: {
          kind: "chose",
          scene: "rus_c_council",
          pick: "let_go",
        },
      },
      {
        id: "promised",
        when: {
          kind: "memory",
          key: "k_rodz_session",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "as_before",
    options: [
      {
        id: "as_before",
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
        ],
      },
      {
        id: "reform_word",
        when: {
          kind: "memory",
          key: "k_rodz_session",
        },
        tell: ["duma:+2", "court:-1", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_peace_reform",
          },
        ],
      },
      {
        id: "dissolve",
        tell: ["duma:-3", "court:+1", "stavka:+1", "order:-1"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: -3,
          },
          {
            kind: "inst",
            inst: "court",
            delta: 1,
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
        ],
      },
    ],
  },
  {
    id: "rus_h_peace_straits",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "war",
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
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
              kind: "pressure",
              topic: "straits",
              min: 5,
            },
            {
              kind: "pressure",
              topic: "balkan",
              min: 5,
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      navy: {
        office: "navy",
      },
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "let_go",
        when: {
          kind: "chose",
          scene: "rus_c_council",
          pick: "let_go",
        },
      },
      {
        id: "straits",
        when: {
          kind: "pressure",
          topic: "straits",
          min: 5,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "restrain",
    options: [
      {
        id: "restrain",
        tell: ["temp:-1", "duma:-1", "stavka:-1"],
        effects: [
          {
            kind: "temp",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "pressure",
            topic: "balkan",
            delta: -1,
          },
        ],
      },
      {
        id: "back_slavs",
        tell: ["temp:+2", "duma:+1", "stavka:+1", "morale:+1"],
        effects: [
          {
            kind: "temp",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "duma",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "stavka",
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
        id: "call_conference",
        when: {
          kind: "memory",
          key: "k_saz_limit",
        },
        tell: ["temp:-2", "ministers:+1", "ally:+1"],
        effects: [
          {
            kind: "temp",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "ministers",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "pressure",
            topic: "straits",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "rus_h_peace_heir",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "war",
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 7,
    tags: ["people", "tension_down"],
    once: true,
    variants: [
      {
        id: "boy_well",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_c_heir_fall",
              pick: "stay_night",
            },
            {
              kind: "memory",
              key: "k_alex_friend",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "gilliard_stays",
    options: [
      {
        id: "gilliard_stays",
        tell: ["court:+1", "heir"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
        ],
      },
      {
        id: "send_to_regiment",
        tell: ["stavka:+1", "court:-1", "trust:-1", "heir"],
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
        id: "tutor_from_duma",
        when: {
          kind: "memory",
          key: "k_mil_met",
        },
        tell: ["duma:+2", "court:-2", "heir"],
        effects: [
          {
            kind: "inst",
            inst: "duma",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_heir_tutor",
          },
        ],
      },
    ],
  },
  {
    id: "rus_t_alex_boy",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 0,
          max: 3,
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
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
            id: "hurt",
            when: {
              kind: "seen",
              scene: "rus_c_heir_fall",
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
            id: "doctors",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "doctors",
          },
          {
            id: "stay",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "heir"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
            ],
            next: "him",
          },
          {
            id: "firm",
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
            next: "him",
            miss: "shut",
          },
          {
            id: "ladies",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ladies",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      doctors: {
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
            id: "him",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "him",
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
      him: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "court:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_alex_friend",
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "think",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "secret",
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
      secret: {
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
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_friend",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ladies: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mine",
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
          {
            id: "him",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "him",
          },
        ],
      },
      shut: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_alex_boy_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alex_wire",
    nation: ["RUS"],
    kind: "talk",
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
              kind: "crisis",
              topic: "balkan",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_c_willy" } },
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
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
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "sazonov",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "what",
            miss: "wound",
          },
          {
            id: "paris",
            stance: "cold",
            kind: "ask",
            when: {
              kind: "seen",
              scene: "rus_c_poincare",
            },
            tell: [],
            effects: [],
            next: "paris",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "trust:+1"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_alex_wire",
              },
            ],
            next: "draft",
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "hague",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_wire",
              },
            ],
            next: null,
          },
          {
            id: "doubt",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "doubt",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      paris: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
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
      doubt: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_wire",
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
      draft: {
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
        ],
      },
      wound: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "no",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_alex_wire_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alex_self",
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
                is: "date",
                from: "1915-01",
                to: "1915-12",
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
              kind: "holder",
              office: "supreme_commander",
              person: "rus_nikolasha",
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_w_command" } },
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
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
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "fair",
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
            next: "wound",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "fear",
                effects: [
                  {
                    kind: "mood",
                    delta: 1,
                  },
                ],
              },
            ],
            miss: "wound",
          },
          {
            id: "hear",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "ward",
            stance: "frank",
            kind: "ask",
            when: {
              kind: "memory",
              key: "alex_nurse_heard",
            },
            tell: [],
            effects: [],
            next: "ward",
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
            id: "want",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
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
      fear: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "want",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      want: {
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
            stance: "frank",
            kind: "deal",
            tell: ["court:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_alex_self",
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "cost",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "capital",
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
      ward: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "want",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      capital: {
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
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_self",
              },
            ],
            next: null,
          },
          {
            id: "no",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wound: {
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
                kind: "reason",
                key: "rus_h_t_alex_self_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alex_list",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "command",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
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
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
          },
          {
            id: "promise",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_alex_list",
                chapters: 10,
                keep: {
                  kind: "flag",
                  flag: "f_leap_court_2",
                },
                back: "rus_h_wife_letter",
              },
              {
                kind: "remember",
                key: "k_alex_list",
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
            next: "glad",
          },
          {
            id: "one",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "one",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "cold",
                effects: [
                  {
                    kind: "mood",
                    delta: -1,
                  },
                ],
              },
            ],
            miss: "cold",
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
      how: {
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
            id: "trust",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_list",
              },
            ],
            next: null,
          },
          {
            id: "name",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "old",
          },
          {
            id: "rodz",
            stance: "cold",
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
          },
        ],
      },
      old: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_list",
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
                kind: "reason",
                key: "rus_h_t_alex_list_r1",
              },
            ],
            next: null,
          },
        ],
      },
      rodz: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "trust2",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_list",
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
      one: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_alex_list",
              },
            ],
            next: null,
          },
        ],
      },
      glad: {
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
        ],
      },
      cold: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_alex_list_r2",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alex_nurse",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1916-12",
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
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
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
            id: "officers",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "officers",
          },
          {
            id: "sit",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "morale:+1", "trust:+1"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "morale",
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
            next: "glad",
          },
          {
            id: "rest",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "work",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["anxious"],
                },
                next: "girls",
                effects: [
                  {
                    kind: "mood",
                    delta: 1,
                  },
                ],
              },
            ],
            miss: "work",
          },
          {
            id: "girls",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "girls",
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
      officers: {
        says: [
          {
            id: "low",
            when: {
              kind: "gauge",
              gauge: "morale",
              max: 2,
            },
          },
          {
            id: "high",
            when: {
              kind: "gauge",
              gauge: "morale",
              min: 4,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "true",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stavka",
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
      girls: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "kind",
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
          {
            id: "officers",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "officers",
          },
        ],
      },
      stavka: {
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
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "alex_nurse_heard",
              },
            ],
            next: null,
          },
        ],
      },
      work: {
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
        ],
      },
      glad: {
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
        ],
      },
    },
  },
  {
    id: "rus_t_alex_after",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
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
          kind: "seen",
          scene: "rus_r_friend_dead",
        },
      ],
    },
    cast: {
      p: {
        person: "rus_alexandra",
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
            id: "sit",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "trust:+1", "heir"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_alex_after",
              },
            ],
            next: "sits",
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "firm",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "want",
            miss: "gone",
          },
          {
            id: "doctors",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "paper",
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
      want: {
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
            kind: "deal",
            tell: ["court:+1", "duma:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_alex_after",
              },
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
            ],
            next: "after",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sits: {
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
        ],
      },
      paper: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "let",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_alex_after",
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
      after: {
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
        ],
      },
      gone: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_alex_after_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ras_wire",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 2,
              max: 5,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "flag",
              flag: "f_ras_wounded",
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_c_general_mob" } },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
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
            id: "wea",
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
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "keep",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "court:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ras_wire",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
            next: "keep",
          },
          {
            id: "knife",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "knife",
          },
          {
            id: "shut",
            stance: "threat",
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
            next: "shut",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["weary"],
                },
                next: "why",
                effects: [
                  {
                    kind: "mood",
                    delta: 1,
                  },
                  {
                    kind: "reason",
                    key: "rus_h_t_ras_wire_r2",
                  },
                ],
              },
            ],
            miss: "shut",
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
      why: {
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
            id: "keep",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ras_wire",
              },
            ],
            next: "keep",
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
      knife: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "why",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
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
      keep: {
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
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      shut: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_ras_wire_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ras_boy",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1915-12",
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "asleep" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { asleep: "r_asleep" },
    nodes: {
      r_asleep: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "me",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "r_me",
          },
          {
            id: "in",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_ras_boy" }],
            next: "room",
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
      r_me: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "sit",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_ras_boy" }],
            next: "r_sit",
          },
          {
            id: "stand",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      r_sit: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
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
            id: "wea",
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
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
          },
          {
            id: "let",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "duma:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_ras_boy",
              },
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
            ],
            next: "room",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            gain: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            miss: "laugh",
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
      how: {
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
            id: "let",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ras_boy",
              },
            ],
            next: "room",
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
      room: {
        says: [
          {
            id: "wea",
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
            id: "mean",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mean",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      mean: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_ras_boy_r1",
              },
            ],
            next: null,
          },
        ],
      },
      laugh: {
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
        ],
      },
    },
  },
  {
    id: "rus_t_ras_war",
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
                is: "date",
                from: "1914-08",
                to: "1915-12",
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
              kind: "all",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "seen",
                    scene: "rus_r_friend_dead",
                  },
                },
                {
                  kind: "not",
                  of: {
                    kind: "flag",
                    flag: "f_friend_exiled",
                  },
                },
              ],
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_r_stockholm" } },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "cmd",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      { id: "line" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { line: "r_line" },
    nodes: {
      r_line: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "land",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
          },
          {
            id: "straits",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "hush",
          },
          {
            id: "none",
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
            id: "after_lost",
            when: {
              kind: "world",
              of: {
                is: "front",
                theatre: "east",
                from: "vistula",
              },
            },
          },
          {
            id: "wea",
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
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
          },
          {
            id: "hush",
            stance: "threat",
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
            next: "hush",
            miss: "hush",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ras_peace",
              },
            ],
            next: "when",
          },
          {
            id: "nik",
            stance: "frank",
            kind: "ask",
            when: {
              kind: "holder",
              office: "supreme_commander",
              person: "rus_nikolasha",
            },
            tell: [],
            effects: [],
            next: "nik",
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
      when: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: ["court:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_ras_peace",
              },
              {
                kind: "inst",
                inst: "court",
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
      nik: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "how",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hush: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_ras_war_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ras_minister",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "read" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { read: "r_read" },
    nodes: {
      r_read: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "read",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "names",
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "r_no",
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
      r_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "smile",
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
            id: "names",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "names",
          },
          {
            id: "buy",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "ras_gave_names",
              },
            ],
            next: "names",
            gain: [
              {
                kind: "mood",
                delta: 1,
              },
            ],
          },
          {
            id: "warn",
            stance: "threat",
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
            next: "smile",
            miss: "smile",
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
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
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
      who: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "ras_warned_names",
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
          },
        ],
      },
      smile: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_ras_minister_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ras_bread",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
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
            id: "wea",
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
            id: "math",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "math",
          },
          {
            id: "take",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "ministers:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_ras_wagons",
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: -1,
              },
            ],
            next: "pleased",
          },
          {
            id: "scorn",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "math",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cunning"],
                },
                next: "scorn",
                effects: [
                  {
                    kind: "mood",
                    delta: -1,
                  },
                ],
              },
            ],
            miss: "scorn",
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
      math: {
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
            id: "take",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_ras_wagons",
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
      pleased: {
        says: [
          {
            id: "wea",
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
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      scorn: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_ras_bread_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_ras_leave",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "inst",
              inst: "court",
              max: 1,
            },
            {
              kind: "memory",
              key: "k_maria_plea",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_rasputin",
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
            id: "wea",
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
            id: "say",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "price",
            miss: "stare",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_ras_leave",
                chapters: 8,
                keep: {
                  kind: "chose",
                  scene: "rus_h_friend_exile",
                  pick: "send_home",
                },
                back: "rus_h_heir_bleed",
              },
              {
                kind: "remember",
                key: "k_ras_gone",
              },
            ],
            next: "agreed",
          },
          {
            id: "threat",
            stance: "threat",
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
            next: "stare",
            miss: "stare",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      price: {
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
            id: "yes",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_ras_leave",
                chapters: 8,
                keep: {
                  kind: "chose",
                  scene: "rus_h_friend_exile",
                  pick: "send_home",
                },
                back: "rus_h_heir_bleed",
              },
              {
                kind: "remember",
                key: "k_ras_gone",
              },
            ],
            next: "agreed",
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
      agreed: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "saw",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      saw: {
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
        ],
      },
      stare: {
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
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "reason",
                key: "rus_h_t_ras_leave_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_kriv_notready",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 1,
              max: 4,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_c_regent_plea" } },
      ],
    },
    cast: {
      p: {
        person: "rus_krivoshein",
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
            next: "think",
            miss: "other",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "think",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "p",
                  },
                  min: 2,
                },
                next: "think",
                effects: [
                  {
                    kind: "remember",
                    key: "k_kriv_notready",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "mood",
                delta: 1,
              },
            ],
            miss: "other",
          },
          {
            id: "firm",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "numbers",
          },
          {
            id: "sukh",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sukh",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_kriv_notready",
              },
            ],
            next: "think",
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
      sukh: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "pride",
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
      other: {
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
            id: "again",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      numbers: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_notready",
              },
            ],
            next: "serb",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_notready",
              },
            ],
            next: null,
          },
        ],
      },
      think: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_notready",
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
                kind: "reason",
                key: "rus_h_t_kriv_notready_r1",
              },
            ],
            next: null,
          },
        ],
      },
      serb: {
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
        ],
      },
    },
  },
  {
    id: "rus_t_kriv_rail",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1915-12",
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
        person: "rus_krivoshein",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      { id: "pencil" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { pencil: "k_pencil" },
    nodes: {
      k_pencil: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "high",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [],
            next: "k_high",
          },
          {
            id: "low",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "k_low",
          },
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      k_high: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "mark",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_kriv_rail" }],
            next: null,
          },
        ],
      },
      k_low: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "mark",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_kriv_rail" }],
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
            id: "line",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
          {
            id: "hard",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "army",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cunning"],
                },
                next: "line",
                effects: [
                  {
                    kind: "mood",
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "rus_h_t_kriv_rail_r2",
                  },
                ],
              },
            ],
            miss: "army",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["audiences:-1", "ministers:+1"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kriv_rail",
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
            id: "go",
            stance: "warm",
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_rail",
              },
            ],
            next: null,
          },
          {
            id: "more",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "empty",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      empty: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_rail",
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
      army: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_kriv_rail_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_kriv_bloc",
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
                is: "date",
                from: "1915-01",
                to: "1915-12",
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
        { kind: "not", of: { kind: "seen", scene: "rus_h_bloc" } },
      ],
    },
    cast: {
      p: {
        person: "rus_krivoshein",
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
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
            miss: "shy",
          },
          {
            id: "warn",
            stance: "threat",
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
            next: "shy",
            miss: "shy",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["duma:+1", "court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_bloc",
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
            next: "bridge",
          },
          {
            id: "gor",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "gor",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      want: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_bloc",
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
      gor: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "want",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      shy: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_kriv_bloc_r1",
              },
            ],
            next: null,
          },
        ],
      },
      bridge: {
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
    id: "rus_t_kriv_land",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
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
        person: "rus_krivoshein",
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
            id: "price",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
          },
          {
            id: "promise",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_kriv_land",
                chapters: 12,
                keep: {
                  kind: "chose",
                  scene: "rus_h_land_word",
                  pick: "sign_word",
                },
              },
              {
                kind: "remember",
                key: "k_kriv_land",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "after",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
            miss: "bow",
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
      price: {
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
            id: "mark",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_land",
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
      after: {
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
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      bow: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_kriv_land_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_kriv_refugees",
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
                is: "date",
                from: "1915-01",
                to: "1915-12",
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
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "east",
                from: "vistula",
              },
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_h_refugees" } },
      ],
    },
    cast: {
      p: {
        person: "rus_krivoshein",
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
            id: "stop",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stop",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:+1", "stavka:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_refugees",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "stavka",
                delta: -1,
              },
            ],
            next: "plan",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "edge",
            miss: "edge",
          },
          {
            id: "yan",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "yan",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stop: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_refugees",
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
      yan: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_refugees",
              },
            ],
            next: "plan",
          },
          {
            id: "end",
            stance: "warm",
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      edge: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_kriv_refugees_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_kriv_premier",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
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
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "chancellor",
            person: "rus_krivoshein",
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_krivoshein",
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
            id: "straight",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "terms",
            miss: "evade",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "evade",
            miss: "evade",
          },
          {
            id: "her",
            stance: "cold",
            kind: "ask",
            when: {
              kind: "memory",
              key: "k_alex_list",
            },
            tell: [],
            effects: [],
            next: "her",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_kriv_chair",
                chapters: 12,
                keep: {
                  kind: "holder",
                  office: "chancellor",
                  person: "rus_krivoshein",
                },
              },
              {
                kind: "remember",
                key: "k_kriv_premier",
              },
            ],
            next: "terms",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      terms: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_premier",
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_kriv_premier_r1",
              },
            ],
            next: null,
          },
        ],
      },
      her: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sit",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kriv_premier",
              },
            ],
            next: "terms",
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
      evade: {
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
        ],
      },
    },
  },
  {
    id: "rus_t_bark_berlin",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 1,
              max: 4,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
            {
              kind: "crisis",
              topic: "balkan",
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_c_council" } },
      ],
    },
    cast: {
      p: {
        person: "rus_bark",
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
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "read",
          },
          {
            id: "now",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "move",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cold"],
                },
                next: null,
                effects: [
                  {
                    kind: "remember",
                    key: "k_bark_berlin",
                  },
                  {
                    kind: "reason",
                    key: "rus_h_t_bark_berlin_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_berlin",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "read",
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
      read: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_berlin",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      move: {
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
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_berlin",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_bark_vodka",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 5,
              max: 6,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
        { kind: "not", of: { kind: "seen", scene: "rus_c_vodka" } },
      ],
    },
    cast: {
      p: {
        person: "rus_bark",
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
            id: "fill",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fill",
          },
          {
            id: "moral",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "fill",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cold"],
                },
                next: "thin",
                effects: [
                  {
                    kind: "mood",
                    delta: -1,
                  },
                ],
              },
            ],
            miss: "thin",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["ministers:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_vodka",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
            ],
            next: "fill",
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
      fill: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_vodka",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      thin: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_bark_vodka_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_bark_credit",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-11",
            to: "1915-12",
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
        person: "rus_bark",
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
            id: "worst",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
          },
          {
            id: "refuse",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "calm",
            miss: "calm",
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
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["ministers:+1", "ally:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_credit",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
              {
                kind: "trust",
                tag: "GBR",
                delta: 1,
              },
            ],
            next: "go_london",
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
      worst: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_credit",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      calm: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
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
      go_london: {
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
            id: "end",
            stance: "warm",
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
    id: "rus_t_bark_gold",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
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
        person: "rus_bark",
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
            id: "how",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            miss: "how",
          },
          {
            id: "hold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "hold",
          },
          {
            id: "kriv",
            stance: "cold",
            kind: "ask",
            when: {
              kind: "memory",
              key: "k_kriv_rail",
            },
            tell: [],
            effects: [],
            next: "kriv",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_gold",
              },
              {
                kind: "gauge",
                gauge: "money",
                delta: -1,
              },
              {
                kind: "flag",
                flag: "f_rails_ordered",
              },
            ],
            next: "rails",
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
      how: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_gold",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      kriv: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "rails",
            stance: "frank",
            kind: "deal",
            tell: ["ministers:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_gold",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: 1,
              },
            ],
            next: "rails",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hold: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_bark_gold_r1",
              },
            ],
            next: null,
          },
        ],
      },
      rails: {
        says: [
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
        ],
      },
    },
  },
  {
    id: "rus_t_bark_paper",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-12",
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
        {
          kind: "gauge",
          gauge: "money",
          max: 1,
        },
      ],
    },
    cast: {
      p: {
        person: "rus_bark",
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
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "promise",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "p_bark_tax",
                chapters: 10,
                keep: {
                  kind: "chose",
                  scene: "rus_h_rubles",
                  pick: "income_tax",
                },
              },
              {
                kind: "remember",
                key: "k_bark_paper",
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "after",
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: ["money:+1", "morale:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "money",
                delta: 1,
              },
              {
                kind: "gauge",
                gauge: "morale",
                delta: -1,
              },
            ],
            next: "later",
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
            id: "mark",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_paper",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      later: {
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
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_bark_paper_r1",
              },
            ],
            next: null,
          },
        ],
      },
      after: {
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
    id: "rus_t_bark_stockholm",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
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
        person: "rus_bark",
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
            id: "real",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "open_q",
            reacts: [
              {
                when: {
                  kind: "all",
                  of: [
                    {
                      kind: "secret",
                      id: "rus_german_feeler",
                    },
                    {
                      kind: "candid",
                      who: {
                        role: "p",
                      },
                    },
                  ],
                },
                next: "real",
                effects: [
                  {
                    kind: "world",
                    of: {
                      do: "reveal",
                      id: "rus_german_feeler",
                    },
                  },
                  {
                    kind: "remember",
                    key: "k_bark_stockholm",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["ministers:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_bark_stockholm",
              },
              {
                kind: "inst",
                inst: "ministers",
                delta: -1,
              },
            ],
            next: "open_q",
          },
          {
            id: "burn",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "burn",
          },
          {
            id: "ras",
            stance: "cold",
            kind: "ask",
            when: {
              kind: "memory",
              key: "k_ras_peace",
            },
            tell: [],
            effects: [],
            next: "ras",
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
      real: {
        says: [
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
        ],
      },
      open_q: {
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
            id: "mark",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_stockholm",
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
      ras: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bark_stockholm",
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
      burn: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_t_bark_stockholm_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_fred_list",
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
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-07",
            to: "1916-12",
          },
        },
        {
          kind: "chapter",
          min: 2,
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 5,
    tags: ["people"],
    cooldown: 8,
    who: "p",
    variants: [
      { id: "old_list" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { old_list: "f_old" },
    nodes: {
      f_old: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "kind",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "f_sit",
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
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
      f_sit: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
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
      open: {
        says: [
          {
            id: "wea",
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
            id: "who",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "health",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "health",
          },
          {
            id: "father",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "father",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "audiences:+1", "court:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "audiences",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
            ],
            next: "pleased",
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
      who: {
        says: [
          {
            id: "duma_low",
            when: {
              kind: "inst",
              inst: "duma",
              max: 0,
            },
          },
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
                key: "fred_doorway",
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
      health: {
        says: [
          {
            id: "proto",
            when: {
              kind: "health",
              who: {
                person: "rus_protopopov",
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
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      father: {
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
        ],
      },
      pleased: {
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
        ],
      },
    },
  },
  {
    id: "rus_v_maria_kiev",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
            to: "1916-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_rodz_friend",
            },
            {
              kind: "inst",
              inst: "court",
              min: 2,
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_maria",
      },
    },
    salience: 7,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [
      {
        id: "cmd",
        when: {
          kind: "world",
          of: {
            is: "command",
          },
        },
      },
      { id: "boy_first" },
      { id: "short" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: {
      short: "m_short",
      boy_first: "m_boy",
    },
    nodes: {
      m_short: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ras",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "heard",
          },
          {
            id: "wife",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "wall",
          },
          {
            id: "crown",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_maria_plea" }],
            next: "after",
          },
        ],
      },
      m_boy: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "know",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "heard",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_maria_plea" }],
            next: "after",
          },
          {
            id: "go",
            stance: "warm",
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
            next: "heard",
          },
          {
            id: "wife",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "heard",
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
                    kind: "mood",
                    delta: -1,
                  },
                ],
              },
            ],
            miss: "wall",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_maria_plea",
              },
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
            next: "after",
          },
          {
            id: "boy",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "boy",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      heard: {
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
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_maria_plea",
              },
            ],
            next: "after",
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
      after: {
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
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      boy: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "deal2",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_maria_plea",
              },
            ],
            next: "after",
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_v_maria_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_samarin_file",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
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
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            },
          ],
        },
        {
          kind: "seen",
          scene: "rus_h_friend_comes",
        },
      ],
    },
    cast: {
      p: {
        person: "rus_samarin",
      },
    },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [
      { id: "asks" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { asks: "s_asks" },
    nodes: {
      s_asks: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "yes",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "s_yes",
          },
          {
            id: "no",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "moscow",
          },
          {
            id: "dont",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "moscow",
          },
          {
            id: "hit",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "stands",
          },
        ],
      },
      s_yes: {
        says: [{ id: "base" }],
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
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "moscow",
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
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "moscow",
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_samarin_file",
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
            next: "moscow",
          },
          {
            id: "warn",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "stands",
            miss: "stands",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      moscow: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_samarin_file",
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
      stands: {
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
            tell: ["duma:+1", "court:+1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "reason",
                key: "rus_h_v_samarin_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_kok_numbers",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1915-12",
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
        person: "rus_kokovtsov",
      },
    },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [
      { id: "page" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { page: "k_page" },
    nodes: {
      k_page: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "read",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
          },
          {
            id: "how",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "k_how",
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
      k_how: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_kok_friend" }],
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
            id: "num",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kok_friend",
              },
            ],
            next: "numbers",
          },
          {
            id: "hit",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [],
            next: "stiff",
            miss: "stiff",
          },
          {
            id: "mother",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "memory",
              key: "k_maria_plea",
            },
            tell: [],
            effects: [],
            next: "mother",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      numbers: {
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
            id: "mark",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kok_friend",
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
      mother: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "mark2",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kok_friend",
              },
            ],
            next: "numbers",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stiff: {
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
            effects: [
              {
                kind: "reason",
                key: "rus_h_v_kok_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_lvov_train",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1915-12",
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
      ],
    },
    cast: {
      p: {
        person: "rus_lvov",
      },
    },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [
      { id: "stretcher" },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: { stretcher: "l_str" },
    nodes: {
      l_str: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "press",
            stance: "warm",
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
            effects: [{ kind: "remember", key: "k_lvov_zemgor" }],
            next: "what",
          },
          {
            id: "warn",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "plain",
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
            tell: ["duma:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lvov_zemgor",
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
            ],
            next: "what",
          },
          {
            id: "warn",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "plain",
            miss: "plain",
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
      what: {
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
            id: "mark",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_lvov_zemgor",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      plain: {
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
                kind: "reason",
                key: "rus_h_v_lvov_r1",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
];
