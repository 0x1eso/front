import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「독일 1914년」, the war share: `deu_w_` scenes and the summoned talks of
 * Moltke, Falkenhayn, Hindenburg, Ludendorff and Tirpitz. Data only. Text is in
 * resources/ww1914/ko/DEU.war.json. Plan: ww131-scene-plan.md sections 5 and 7.
 */
export const DEU_WAR_SCENES: readonly GwScene[] = [
  {
    id: "deu_w_ledger_aug",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 6,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "thin",
        when: {
          kind: "gauge",
          gauge: "shells",
          max: 1,
        },
      },
      {
        id: "gbr",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "sign_chief",
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_returned_aug",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_ledger_sep",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 7,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "stopped",
        when: {
          kind: "flag",
          flag: "w_marne_stopped",
        },
      },
      {
        id: "ret",
        when: {
          kind: "memory",
          key: "m_returned_aug",
        },
      },
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "near",
        when: {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "west",
                from: "somme",
              },
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "w_marne_stopped",
              },
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "sign_chief",
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_returned_sep",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_ledger_oct",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 8,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "pair",
        when: {
          kind: "flag",
          flag: "f_east_pair",
        },
      },
      {
        id: "sea",
        when: {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "west",
                from: "liege",
              },
            },
            {
              kind: "at_war",
              tag: "GBR",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "sign_chief",
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_returned_oct",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_ledger_nov",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 9,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "ypres",
        when: {
          kind: "flag",
          flag: "f_ypres_attack",
        },
      },
      {
        id: "thin",
        when: {
          kind: "gauge",
          gauge: "shells",
          max: 1,
        },
      },
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "sign_chief",
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_returned_nov",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_ledger_dec",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 10,
          max: 10,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "uchi",
        when: {
          kind: "flag",
          flag: "f_corps_east",
        },
      },
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "trench",
        when: {
          kind: "trench",
          theatre: "west",
          min: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "sign_chief",
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_returned_dec",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_closing",
    nation: ["DEU"],
    kind: "ledger",
    stage: ["closing"],
    when: {
      kind: "chapter",
      min: 11,
      max: 11,
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "late",
        when: {
          kind: "all",
          of: [
            { kind: "chapter", min: 11 },
            {
              kind: "any",
              of: [
                { kind: "at_war", tag: "RUS" },
                { kind: "at_war", tag: "FRA" },
              ],
            },
            { kind: "not", of: { kind: "flag", flag: "w_summer_war" } },
          ],
        },
      },
      {
        id: "peace",
        when: {
          kind: "not",
          of: {
            kind: "any",
            of: [
              {
                kind: "at_war",
                tag: "RUS",
              },
              {
                kind: "at_war",
                tag: "FRA",
              },
            ],
          },
        },
      },
      {
        id: "worn",
        when: {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "any",
              of: [
                {
                  kind: "gauge",
                  gauge: "morale",
                  max: 1,
                },
                {
                  kind: "gauge",
                  gauge: "order",
                  max: 1,
                },
              ],
            },
          ],
        },
      },
      {
        id: "east",
        when: {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "flag",
              flag: "f_east_first",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "close_year",
    options: [
      {
        id: "close_year",
        tell: [],
        effects: [],
      },
    ],
  },
  {
    id: "deu_w_east_relief",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 6,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      war: {
        office: "war",
      },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "rominten",
        when: {
          kind: "flag",
          flag: "w_bad_luck_east",
        },
      },
      {
        id: "refugee",
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
    fallback: "send_two",
    options: [
      {
        id: "send_two",
        tell: ["morale:+1", "army:+1", "shells:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_east_two_corps",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
        ],
      },
      {
        id: "send_none",
        when: {
          kind: "memory",
          key: "k_lud_east",
        },
        tell: ["morale:-1", "trust:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_east_no_corps",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "send_one",
        when: {
          kind: "memory",
          key: "k_moltke_nerves",
        },
        tell: ["trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_east_one_corps",
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_marne_order",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 7,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "west",
                from: "liege",
              },
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "corps",
        when: {
          kind: "flag",
          flag: "f_east_two_corps",
        },
      },
      {
        id: "gap",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "thin",
        when: {
          kind: "gauge",
          gauge: "shells",
          max: 1,
        },
      },
      {
        id: "nerve",
        when: {
          kind: "temperament",
          who: {
            role: "cos",
          },
          of: ["anxious"],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "approve",
    options: [
      {
        id: "approve",
        tell: ["morale:-1", "army:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_marne_retreat",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
      {
        id: "hold_line",
        tell: ["shells:-1", "army:+1", "trust:-1", "casualties_high"],
        effects: [
          {
            kind: "flag",
            flag: "f_marne_hold",
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "reason",
            key: "war_marne_hold",
          },
        ],
      },
      {
        id: "go_to_front",
        when: {
          kind: "memory",
          key: "k_moltke_nerves",
        },
        tell: ["morale:+1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_marne_went_front",
          },
          {
            kind: "flag",
            flag: "f_marne_retreat",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "m_marne_front",
          },
          {
            kind: "reason",
            key: "war_marne_front",
          },
        ],
      },
      {
        id: "limit_retreat",
        when: {
          kind: "memory",
          key: "k_heir_west",
        },
        tell: ["shells:-1", "trust:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_marne_limited",
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_new_chief",
    nation: ["DEU"],
    kind: "audience",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 8,
        },
        {
          kind: "all",
          of: [
            {
              kind: "holder",
              office: "chief_of_staff",
              person: "deu_moltke",
            },
            {
              kind: "flag",
              flag: "w_marne_stopped",
            },
          ],
        },
      ],
    },
    cast: {
      war: {
        office: "war",
      },
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "front",
        when: {
          kind: "memory",
          key: "m_marne_front",
        },
      },
      {
        id: "hold",
        when: {
          kind: "flag",
          flag: "f_marne_hold",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "falkenhayn",
    options: [
      {
        id: "falkenhayn",
        tell: ["trust:-2", "trust:+2", "army:+1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "deu_falkenhayn",
            },
            office: "chief_of_staff",
          },
          {
            kind: "appoint",
            who: {
              person: "deu_wild",
            },
            office: "war",
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_moltke",
            },
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_falkenhayn",
            },
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_chief_changed",
          },
        ],
      },
      {
        id: "keep_moltke",
        tell: ["trust:+2", "army:-2"],
        effects: [
          {
            kind: "person_trust",
            who: {
              person: "deu_moltke",
            },
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -2,
          },
          {
            kind: "remember",
            key: "m_kept_moltke",
          },
        ],
      },
      {
        id: "east_pair",
        when: {
          kind: "memory",
          key: "k_hind_ludendorff",
        },
        tell: ["trust:-1", "trust:-2", "morale:+2"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "deu_hindenburg",
            },
            office: "chief_of_staff",
          },
          {
            kind: "flag",
            flag: "f_chief_changed",
          },
          {
            kind: "flag",
            flag: "f_east_pair",
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_moltke",
            },
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_falkenhayn",
            },
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 2,
          },
          {
            kind: "remember",
            key: "m_east_pair",
          },
        ],
      },
      {
        id: "moltke_in_name",
        when: {
          kind: "memory",
          key: "k_muller_moltke",
        },
        tell: ["trust:+1", "trust:+1"],
        effects: [
          {
            kind: "appoint",
            who: {
              person: "deu_falkenhayn",
            },
            office: "chief_of_staff",
          },
          {
            kind: "appoint",
            who: {
              person: "deu_wild",
            },
            office: "war",
          },
          {
            kind: "flag",
            flag: "f_chief_changed",
          },
          {
            kind: "flag",
            flag: "f_moltke_in_name",
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_moltke",
            },
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_falkenhayn",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "m_moltke_in_name",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_war_aims",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 7,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      foreign: {
        office: "foreign",
      },
    },
    salience: 8,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "stopped",
        when: {
          kind: "flag",
          flag: "w_marne_stopped",
        },
      },
      {
        id: "paris",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "west",
            from: "somme",
          },
        },
      },
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_secret",
    options: [
      {
        id: "hold_secret",
        tell: ["reichstag:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_aims_secret",
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: 1,
          },
        ],
      },
      {
        id: "sign_full",
        tell: ["army:+2", "reichstag:-2", "countersign:-1", "temp:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_aims_full",
          },
          {
            kind: "inst",
            inst: "army",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: -1,
          },
          {
            kind: "temp",
            delta: 1,
          },
          {
            kind: "pressure",
            topic: "poland",
            delta: 1,
          },
        ],
      },
      {
        id: "limit_aims",
        when: {
          kind: "memory",
          key: "k_beth_aims",
        },
        tell: ["countersign:+2", "army:-1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_aims_limited",
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "no_annex_belgium",
        when: {
          kind: "memory",
          key: "k_haase_belgium",
        },
        tell: ["reichstag:+2", "army:-2", "gbr:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_no_annex_belgium",
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "deu_haase",
            },
            key: "k_haase_belgium",
          },
        ],
      },
      {
        id: "poland_clause",
        when: {
          kind: "memory",
          key: "k_jagow_poland",
        },
        tell: ["auh:-1", "army:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_aims_poland",
          },
          {
            kind: "pressure",
            topic: "poland",
            delta: 2,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_shell_crisis",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 8,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "gauge",
              gauge: "shells",
              max: 1,
            },
          ],
        },
      ],
    },
    cast: {
      war: {
        office: "war",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "hold",
        when: {
          kind: "flag",
          flag: "f_marne_hold",
        },
      },
      {
        id: "empty",
        when: {
          kind: "gauge",
          gauge: "shells",
          max: 0,
        },
      },
      {
        id: "blockade",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "office",
        when: {
          kind: "flag",
          flag: "f_raw_office",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "ration",
    options: [
      {
        id: "ration",
        tell: ["shells:+1", "army:-1", "morale:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
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
        id: "cut_west",
        tell: ["shells:+1", "trust:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_shells_cut_west",
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_cut_west",
          },
        ],
      },
      {
        id: "nitrate_plants",
        when: {
          kind: "memory",
          key: "k_kuhn_rathenau",
        },
        tell: ["shells:+1", "money:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_nitrate_plants",
          },
          {
            kind: "remember",
            key: "m_nitrate",
          },
          {
            kind: "reason",
            key: "war_nitrate",
          },
        ],
      },
      {
        id: "ask_krupp",
        when: {
          kind: "memory",
          key: "k_falk_shells",
        },
        tell: ["shells:+2", "money:-1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 2,
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
          {
            kind: "flag",
            flag: "f_krupp_deal",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_separate_peace",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 9,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      {
        id: "aims",
        when: {
          kind: "flag",
          flag: "f_aims_full",
        },
      },
      {
        id: "falk",
        when: {
          kind: "all",
          of: [
            {
              kind: "holder",
              office: "chief_of_staff",
              person: "deu_falkenhayn",
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      },
      {
        id: "east",
        when: {
          kind: "flag",
          flag: "f_east_first",
        },
      },
      {
        id: "line",
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
        id: "base",
      },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["army:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_no_russian_peace",
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
        ],
      },
      {
        id: "sound_russia",
        when: {
          kind: "memory",
          key: "k_falk_peace",
        },
        tell: ["temp:-1", "army:-1", "trust:+1", "rus:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_sounding_russia",
          },
          {
            kind: "temp",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: 1,
          },
        ],
      },
      {
        id: "denmark_channel",
        when: {
          kind: "memory",
          key: "k_muller_denmark",
        },
        tell: ["rus:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_denmark_channel",
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: 1,
          },
          {
            kind: "remember",
            key: "m_andersen",
          },
        ],
      },
      {
        id: "via_pourtales",
        when: {
          kind: "memory",
          key: "k_pour_home",
        },
        tell: ["rus:+1", "auh:-1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_pourtales_channel",
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_pourtales",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "via_london",
        when: {
          kind: "memory",
          key: "k_lich_farewell",
        },
        tell: ["gbr:+1", "trust:+1", "army:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_london_channel",
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              person: "deu_lichnowsky",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_prittwitz",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 7,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "hoffmann",
        when: {
          kind: "temperament",
          who: {
            role: "cos",
          },
          of: ["anxious"],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "recall_old_general",
    options: [
      {
        id: "recall_old_general",
        tell: ["morale:+1", "army:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_prittwitz_out",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_east_new_old_man",
          },
        ],
      },
      {
        id: "keep",
        tell: ["morale:-1", "trust:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_prittwitz_kept",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "recall_pair",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_hind_ready",
            },
            {
              kind: "memory",
              key: "k_lud_bill",
            },
          ],
        },
        tell: ["morale:+1", "army:+1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_prittwitz_out",
          },
          {
            kind: "flag",
            flag: "f_east_pair_sent",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "m_pair_sent",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_east_broken",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 8,
        },
        {
          kind: "flag",
          flag: "w_bad_luck_east",
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "inside",
        when: {
          kind: "at_war",
          tag: "RUS",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_vistula",
    options: [
      {
        id: "hold_vistula",
        tell: ["morale:-1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_east_vistula",
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
        ],
      },
      {
        id: "strip_west",
        tell: ["morale:+1", "shells:-1", "army:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_west_stripped",
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
      {
        id: "ask_vienna",
        tell: ["auh:-1"],
        effects: [
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_asked_vienna_east",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_raw_materials",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 6,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
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
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "blockade",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "leave_market",
    options: [
      {
        id: "leave_market",
        tell: ["money:+1", "shells:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
        ],
      },
      {
        id: "raw_office",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kuhn_rathenau",
            },
            {
              kind: "memory",
              key: "k_falk_shells",
            },
          ],
        },
        tell: ["shells:+1", "money:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_raw_office",
          },
          {
            kind: "remember",
            key: "m_raw_office",
          },
          {
            kind: "reason",
            key: "war_raw_office",
          },
        ],
      },
      {
        id: "army_seize",
        tell: ["shells:+1", "order:-1", "reichstag:-1", "army:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_first_loan",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 8,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      finance: {
        office: "finance",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "loose",
        when: {
          kind: "gauge",
          gauge: "money",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "bonds",
    options: [
      {
        id: "bonds",
        tell: ["money:+2", "morale:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_loan_bonds",
          },
        ],
      },
      {
        id: "bonds_and_tax",
        when: {
          kind: "memory",
          key: "k_kuhn_bonds",
        },
        tell: ["money:+2", "reichstag:+1", "army:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_loan_tax",
          },
          {
            kind: "reason",
            key: "war_loan_tax",
          },
        ],
      },
      {
        id: "small_issue",
        tell: ["money:+1", "reichstag:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_ypres_boys",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 8,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      war: {
        office: "war",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "fall",
        when: {
          kind: "flag",
          flag: "f_marne_retreat",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "attack",
    options: [
      {
        id: "attack",
        tell: ["army:+1", "morale:-1", "shells:-1", "casualties_high"],
        effects: [
          {
            kind: "flag",
            flag: "f_ypres_attack",
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
        ],
      },
      {
        id: "wait_guns",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_ypres_wait",
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "pull_back",
        when: {
          kind: "memory",
          key: "k_falk_ypres",
        },
        tell: ["army:-2", "morale:+1", "trust:-1", "casualties_low"],
        effects: [
          {
            kind: "flag",
            flag: "f_ypres_pulled",
          },
          {
            kind: "inst",
            inst: "army",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "reason",
            key: "war_ypres_pulled",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_fleet_out",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 8,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      navy: {
        office: "navy",
      },
      court: {
        office: "court",
      },
    },
    salience: 7,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "bight",
        when: {
          kind: "flag",
          flag: "f_tirpitz_command",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "stay_port",
    options: [
      {
        id: "stay_port",
        tell: [],
        effects: [
          {
            kind: "flag",
            flag: "f_fleet_port",
          },
          {
            kind: "pride",
            who: {
              role: "navy",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "sortie",
        when: {
          kind: "memory",
          key: "k_tirp_britain",
        },
        tell: ["morale:+1", "trust:+1", "trust:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_fleet_sortie",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "court",
            },
            delta: -1,
          },
          {
            kind: "reason",
            key: "war_fleet_sortie",
          },
        ],
      },
      {
        id: "raid_coast",
        when: {
          kind: "memory",
          key: "k_tirp_command",
        },
        tell: ["morale:+1", "gbr:-1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_coast_raid",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_sub_note",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 10,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      navy: {
        office: "navy",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "raid",
        when: {
          kind: "flag",
          flag: "f_coast_raid",
        },
      },
      {
        id: "u9",
        when: {
          kind: "flag",
          flag: "f_fleet_port",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold",
    options: [
      {
        id: "hold",
        tell: ["countersign:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_no_zone",
          },
          {
            kind: "pride",
            who: {
              role: "navy",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: 1,
          },
        ],
      },
      {
        id: "study",
        when: {
          kind: "memory",
          key: "k_zimm_usa",
        },
        tell: ["usa:+1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_zone_study",
          },
          {
            kind: "world",
            of: {
              do: "uboat",
              level: 1,
            },
          },
          {
            kind: "trust",
            tag: "USA",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "declare_zone",
        when: {
          kind: "memory",
          key: "k_tirp_sub",
        },
        tell: ["usa:-2", "countersign:-2", "army:+1", "morale:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_zone_declared",
          },
          {
            kind: "world",
            of: {
              do: "uboat",
              level: 2,
            },
          },
          {
            kind: "trust",
            tag: "USA",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "reason",
            key: "war_zone_declared",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_bread_cards",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 10,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "gauge",
              gauge: "bread",
              max: 2,
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
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "kbrot",
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
    fallback: "market",
    options: [
      {
        id: "market",
        tell: ["money:+1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
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
        id: "price_cap",
        tell: ["order:+1", "bread:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
        ],
      },
      {
        id: "ration_cards",
        when: {
          kind: "memory",
          key: "k_delb_bread",
        },
        tell: ["bread:+1", "morale:-1", "order:+1"],
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
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_bread_cards",
          },
          {
            kind: "reason",
            key: "war_bread_cards",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_east_west",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 9,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "lodz",
        when: {
          kind: "flag",
          flag: "w_tannenberg",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "west_again",
    options: [
      {
        id: "west_again",
        tell: ["shells:-1", "trust:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_corps_west",
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "east_corps",
        when: {
          kind: "memory",
          key: "k_hind_falk",
        },
        tell: ["morale:+1", "trust:-1", "auh:+1"],
        effects: [
          {
            kind: "flag",
            flag: "f_corps_east",
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: 1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "deu_hindenburg",
            },
            key: "hind_east_command",
          },
        ],
      },
      {
        id: "split",
        when: {
          kind: "memory",
          key: "k_lud_politics",
        },
        tell: ["trust:-1", "army:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_corps_split",
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_conrad_help",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 9,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "at_war",
              tag: "RUS",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      amb: {
        office: "ambassador_vienna",
      },
    },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "asked",
        when: {
          kind: "memory",
          key: "m_asked_vienna_east",
        },
      },
      {
        id: "cry",
        when: {
          kind: "trust",
          tag: "AUH",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "words_only",
    options: [
      {
        id: "words_only",
        tell: ["auh:-1"],
        effects: [
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
        ],
      },
      {
        id: "send_corps",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_tsch_galicia",
            },
            {
              kind: "memory",
              key: "k_conrad_cry",
            },
          ],
        },
        tell: ["auh:+2", "trust:-1", "shells:-1"],
        effects: [
          {
            kind: "trust",
            tag: "AUH",
            delta: 2,
          },
          {
            kind: "flag",
            flag: "f_ninth_army",
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
        ],
      },
      {
        id: "joint_command",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_conrad_winter" },
            { kind: "memory", key: "k_conrad_cry" },
          ],
        },
        tell: ["auh:-1", "army:+1"],
        effects: [
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_joint_command",
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "reason",
            key: "war_joint_command",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_revolution_policy",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 9,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      foreign: {
        office: "foreign",
      },
    },
    salience: 5,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "jihad",
        when: {
          kind: "flag",
          flag: "f_ottoman_signed",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "decline",
    options: [
      {
        id: "decline",
        tell: [],
        effects: [
          {
            kind: "flag",
            flag: "f_no_subversion",
          },
        ],
      },
      {
        id: "back_rebels",
        when: {
          kind: "memory",
          key: "k_zimm_irish",
        },
        tell: ["money:-1", "usa:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_back_rebels",
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "pressure",
            topic: "ireland",
            delta: 2,
          },
          {
            kind: "trust",
            tag: "USA",
            delta: -1,
          },
          {
            kind: "reason",
            key: "war_back_rebels",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_second_credit",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 10,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      interior: {
        office: "interior",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "aims",
        when: {
          kind: "flag",
          flag: "f_aims_full",
        },
      },
      {
        id: "broke",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "broke_k_haase_promise",
            },
            {
              kind: "inst",
              inst: "reichstag",
              max: -2,
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "call_vote",
    options: [
      {
        id: "call_vote",
        tell: ["money:+2", "reichstag:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_credit_voted",
          },
        ],
      },
      {
        id: "offer_word",
        when: {
          kind: "memory",
          key: "k_haase_second",
        },
        tell: ["money:+2", "reichstag:+1", "army:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_credit_word",
          },
          {
            kind: "keep_promise",
            who: {
              person: "deu_haase",
            },
            key: "k_haase_second",
          },
        ],
      },
      {
        id: "delay_vote",
        tell: ["reichstag:+1", "money:-1"],
        effects: [
          {
            kind: "inst",
            inst: "reichstag",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_east_first",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 7,
        },
        {
          kind: "flag",
          flag: "f_east_first",
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      war: {
        office: "war",
      },
    },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "franco",
        when: {
          kind: "at_war",
          tag: "FRA",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "push_warsaw",
    options: [
      {
        id: "push_warsaw",
        tell: ["morale:+1", "army:+1", "shells:-1", "rus:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: -1,
          },
        ],
      },
      {
        id: "hold_line",
        tell: ["temp:-1", "countersign:+1", "trust:-1"],
        effects: [
          {
            kind: "temp",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_east_held",
          },
        ],
      },
      {
        id: "offer_paris",
        when: {
          kind: "memory",
          key: "k_cambon_read",
        },
        tell: ["fra:+1", "army:-1"],
        effects: [
          {
            kind: "flag",
            flag: "f_offer_paris",
          },
          {
            kind: "trust",
            tag: "FRA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_offer_paris",
          },
          {
            kind: "reason",
            key: "war_offer_paris",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_gbr_neutral",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 9,
        },
        {
          kind: "all",
          of: [
            {
              kind: "at_war",
              tag: "FRA",
            },
            {
              kind: "not",
              of: {
                kind: "at_war",
                tag: "GBR",
              },
            },
          ],
        },
      ],
    },
    cast: {
      foreign: {
        office: "foreign",
      },
      navy: {
        office: "navy",
      },
    },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "naval",
        when: {
          kind: "pressure",
          topic: "naval",
          min: 3,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "no_price",
    options: [
      {
        id: "no_price",
        tell: ["gbr:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: -1,
          },
          {
            kind: "pride",
            who: {
              role: "navy",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "fleet_stays",
        tell: ["gbr:+2", "army:-1", "trust:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_fleet_stays",
          },
        ],
      },
      {
        id: "colonies_word",
        when: {
          kind: "memory",
          key: "k_lich_farewell",
        },
        tell: ["gbr:+2", "reichstag:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 2,
          },
          {
            kind: "pressure",
            topic: "colonial",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_colonies_word",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_peace_conference",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: { is: "chain_end", of: ["compromise", "humiliation"] },
        },
        {
          kind: "chapter",
          min: 6,
          max: 8,
        },
        {
          kind: "not",
          of: {
            kind: "any",
            of: [
              {
                kind: "at_war",
                tag: "RUS",
              },
              {
                kind: "at_war",
                tag: "FRA",
              },
            ],
          },
        },
      ],
    },
    cast: {
      foreign: {
        office: "foreign",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      {
        id: "aut",
        when: {
          kind: "trust",
          tag: "AUH",
          max: 1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_line",
    options: [
      {
        id: "hold_line",
        tell: ["temp:-1", "gbr:+1", "auh:-1"],
        effects: [
          {
            kind: "temp",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
        ],
      },
      {
        id: "press_vienna",
        tell: ["auh:+1", "temp:+1", "rus:-1"],
        effects: [
          {
            kind: "trust",
            tag: "AUH",
            delta: 1,
          },
          {
            kind: "temp",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: -1,
          },
          {
            kind: "pressure",
            topic: "balkan",
            delta: 1,
          },
        ],
      },
      {
        id: "trade_colonies",
        when: {
          kind: "memory",
          key: "k_jagow_london",
        },
        tell: ["gbr:+2", "army:-1"],
        effects: [
          {
            kind: "trust",
            tag: "GBR",
            delta: 2,
          },
          {
            kind: "pressure",
            topic: "colonial",
            delta: -1,
          },
          {
            kind: "pressure",
            topic: "naval",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_london_trade",
          },
          {
            kind: "reason",
            key: "war_london_trade",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_peace_arms",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 9,
        },
        {
          kind: "not",
          of: {
            kind: "any",
            of: [
              {
                kind: "at_war",
                tag: "RUS",
              },
              {
                kind: "at_war",
                tag: "FRA",
              },
            ],
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
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "hot",
        when: {
          kind: "temp",
          min: 5,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "small_bill",
    options: [
      {
        id: "small_bill",
        tell: ["money:-1", "army:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
      {
        id: "full_bill",
        tell: ["money:-2", "army:+2", "reichstag:-1", "temp:+1", "rus:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "reichstag",
            delta: -1,
          },
          {
            kind: "temp",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: -1,
          },
        ],
      },
      {
        id: "naval_cut",
        when: {
          kind: "memory",
          key: "k_kuhn_navy",
        },
        tell: ["money:-1", "army:+1", "gbr:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "pressure",
            topic: "naval",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_naval_cut",
          },
          {
            kind: "reason",
            key: "war_naval_cut",
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_peace_spark",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 10,
        },
        {
          kind: "all",
          of: [
            {
              kind: "not",
              of: {
                kind: "any",
                of: [
                  {
                    kind: "at_war",
                    tag: "RUS",
                  },
                  {
                    kind: "at_war",
                    tag: "FRA",
                  },
                ],
              },
            },
            {
              kind: "any",
              of: [
                { kind: "crisis", topic: "balkan" },
                { kind: "crisis", topic: "straits" },
                { kind: "crisis", topic: "colonial" },
                {
                  kind: "pressure",
                  topic: "balkan",
                  min: 5,
                },
                {
                  kind: "pressure",
                  topic: "straits",
                  min: 5,
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      foreign: {
        office: "foreign",
      },
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "colonial", when: { kind: "crisis", topic: "colonial" } },
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
        tell: ["temp:-2", "auh:-1", "army:-1"],
        effects: [
          {
            kind: "temp",
            delta: -2,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
      {
        id: "back_ally",
        tell: ["temp:+3", "auh:+2", "army:+2"],
        effects: [
          {
            kind: "temp",
            delta: 3,
          },
          {
            kind: "trust",
            tag: "AUH",
            delta: 2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 2,
          },
          {
            kind: "flag",
            flag: "f_late_spark_backed",
          },
        ],
      },
      {
        id: "call_conference",
        tell: ["temp:-1", "gbr:+1", "countersign:+1"],
        effects: [
          {
            kind: "temp",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "GBR",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "countersign",
            delta: 1,
          },
        ],
      },
    ],
  },
  {
    id: "deu_w_liege",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 6,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "late",
        when: {
          kind: "secret",
          id: "bel_forts_strong",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_tannenberg",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 7,
        },
        {
          kind: "flag",
          flag: "w_tannenberg",
        },
      ],
    },
    cast: {},
    salience: 8,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "pair",
        when: {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "f_east_pair_sent",
            },
            {
              kind: "flag",
              flag: "f_prittwitz_out",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_louvain_record",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 7,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["war"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "neutral",
        when: {
          kind: "not",
          of: {
            kind: "at_war",
            tag: "GBR",
          },
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_lists",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 9,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    cooldown: 2,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "ypres",
        when: {
          kind: "flag",
          flag: "f_ypres_attack",
        },
      },
      {
        id: "long",
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
  },
  {
    id: "deu_w_antwerp",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 8,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "british",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_ottoman_in",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 8,
        },
        {
          kind: "flag",
          flag: "f_ottoman_signed",
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "embassy_vienna",
    variants: [
      {
        id: "ships",
        when: {
          kind: "secret",
          id: "ott_fleet_late",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_blockade",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 10,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    cooldown: 2,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "bread",
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
  },
  {
    id: "deu_w_christmas",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 10,
          max: 10,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "british",
        when: {
          kind: "at_war",
          tag: "GBR",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_west_quiet",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 8,
        },
        {
          kind: "all",
          of: [
            {
              kind: "flag",
              flag: "f_east_first",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["war"],
    once: true,
    stamp: "estimate",
    source: "staff",
    variants: [
      {
        id: "late",
        when: {
          kind: "chapter",
          min: 7,
          max: 8,
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_w_gbr_breaks",
    nation: ["DEU"],
    kind: "report",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 10,
        },
        {
          kind: "all",
          of: [
            {
              kind: "at_war",
              tag: "GBR",
            },
            {
              kind: "seen",
              scene: "deu_w_gbr_neutral",
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "embassy_london",
    variants: [
      {
        id: "belgium",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "west",
            from: "hindenburg",
          },
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "deu_t_moltke_cure",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 0,
      max: 2,
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            id: "ask_doctor",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "heart",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_moltke_ill",
                  },
                ],
              },
            ],
          },
          {
            id: "push_stay",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "stay",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["weary"],
                },
                next: "go",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal_go",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "go",
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
      heart: {
        says: [
          {
            id: "frail",
            when: { kind: "health", who: { person: "deu_moltke" }, max: 1 },
          },
          {
            id: "sound",
            when: { kind: "health", who: { person: "deu_moltke" }, min: 3 },
          },
          {
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "who_knows",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "m_moltke_ill",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "who",
          },
          {
            id: "keep_secret",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "m_moltke_ill",
              },
            ],
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
            id: "thanks",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "ask_chief",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_heir_named",
              },
            ],
            next: "next_man",
          },
        ],
      },
      next_man: {
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
      stay: {
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
                kind: "flag",
                flag: "f_moltke_stayed",
              },
            ],
            next: null,
          },
        ],
      },
      go: {
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
      closed: {
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
      trusted: {
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
    id: "deu_t_moltke_window",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 1,
      max: 3,
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "ask_when",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "when",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_window",
                  },
                ],
              },
            ],
          },
          {
            id: "push_now",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "doubt",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "when",
                effects: [],
              },
            ],
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "doubt",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_window",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "moltke_bill",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_moltke_window",
              },
            ],
            next: "dealt",
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
      when: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "take",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_window",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "doubt_him",
            stance: "cold",
            kind: "ask",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_window",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "doubt",
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
            id: "soft",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_window",
              },
            ],
            next: null,
          },
          {
            id: "cold_end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_moltke_east",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 3,
          max: 4,
        },
        {
          kind: "all",
          of: [
            {
              kind: "crisis",
              topic: "balkan",
            },
            {
              kind: "temp",
              min: 4,
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            id: "uncle",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -2,
              },
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "uncle",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["weary"],
                },
                next: "broken",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "ask_rail",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rail",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_east",
                  },
                ],
              },
            ],
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "half",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_east",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "moltke_east_blame",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_moltke_east",
              },
            ],
            next: "dealt",
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
      uncle: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "half",
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
      broken: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_east",
              },
            ],
            next: "half",
          },
        ],
      },
      rail: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then_can",
            stance: "frank",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_east",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "half",
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
      half: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_east",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_moltke_liege",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 4,
          max: 5,
        },
        {
          kind: "any",
          of: [
            {
              kind: "crisis",
              topic: "balkan",
            },
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "ask_pay",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "pay",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_liege",
                  },
                ],
              },
            ],
          },
          {
            id: "push_without",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "without",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "pay",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "ask_quiet",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "treaty",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_liege",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "moltke_belgium_name",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_moltke_liege",
              },
            ],
            next: "dealt",
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
      pay: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_liege",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      without: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "soften",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "pay",
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
      treaty: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then_pay",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "pay",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_moltke_nerves",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 6,
          max: 7,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "letters",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_nerves",
                  },
                ],
              },
            ],
          },
          {
            id: "what",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "orders",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "shake",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "frank",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "letters",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_moltke_nerves",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "moltke_aide",
                chapters: 1,
              },
              {
                kind: "remember",
                key: "k_moltke_nerves",
              },
            ],
            next: "dealt",
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
      letters: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "share",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_nerves",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "ask",
          },
          {
            id: "stiffen",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "orders",
          },
        ],
      },
      orders: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_nerves",
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
      shake: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "see",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_moltke_nerves",
              },
            ],
            next: "ask",
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      ask: {
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_moltke_after",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 10,
        },
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "deu_moltke",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "books",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_moltke_said_east",
                  },
                ],
              },
            ],
          },
          {
            id: "ask_succ",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "succ",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_moltke_said_east",
                  },
                ],
              },
            ],
          },
          {
            id: "blame",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -2,
              },
            ],
            next: "owe",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["weary"],
                },
                next: "succ",
                effects: [],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "moltke_name",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "m_moltke_said_east",
              },
            ],
            next: "dealt",
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
      books: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "succ",
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
      owe: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what_answer",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "succ",
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
      succ: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "door",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "m_moltke_said_east",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_falk_ready",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 1,
      max: 3,
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["cold"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "ask_quiet",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "quiet",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_ready",
                  },
                ],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "dodge",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_ready",
                  },
                ],
              },
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "quiet",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "dodge",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "quiet",
                effects: [],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "falk_work",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_falk_ready",
              },
            ],
            next: "dealt",
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
      dodge: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "straight",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "quiet",
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
      quiet: {
        says: [
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "take",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_ready",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_falk_moltke",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 3,
      max: 4,
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "more",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plain",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_on_moltke",
                  },
                ],
              },
            ],
          },
          {
            id: "ill",
            stance: "frank",
            kind: "ask",
            when: {
              kind: "memory",
              key: "m_moltke_ill",
            },
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "ill",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_on_moltke",
                  },
                ],
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "cool",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cunning"],
                },
                next: "plain",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "falk_remembered",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_falk_on_moltke",
              },
            ],
            next: "dealt",
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
      plain: {
        says: [
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_on_moltke",
              },
            ],
            next: null,
          },
          {
            id: "pay",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
          },
        ],
      },
      ill: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_on_moltke",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      cool: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plain",
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
      price: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_on_moltke",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_falk_shells",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 5,
          max: 7,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["cold"],
            },
          },
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "num",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_shells",
                  },
                ],
              },
            ],
          },
          {
            id: "blame",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "back",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "num",
                effects: [],
              },
            ],
          },
          {
            id: "help",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "krupp",
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
      num: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_shells",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      back: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "num",
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
      krupp: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_shells",
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
      closed: {
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
      trusted: {
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
    id: "deu_t_falk_chief",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "chapter",
      min: 7,
      max: 9,
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "why",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_chief",
                  },
                ],
              },
            ],
          },
          {
            id: "warn",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "split",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "bristle",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "why",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "cool",
                effects: [],
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
      why: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_chief",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "name",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_chief",
              },
            ],
            next: "name",
          },
        ],
      },
      split: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "see",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_chief",
              },
            ],
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
      bristle: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "calm",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "why",
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      cool: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "frank",
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
      name: {
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
      closed: {
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
      trusted: {
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
    id: "deu_t_falk_ypres",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 9,
        },
        {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "at_war",
                  tag: "RUS",
                },
                {
                  kind: "at_war",
                  tag: "FRA",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "flag",
                flag: "f_east_first",
              },
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["cold"],
            },
          },
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "plain",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_ypres",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "wall",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "plain",
                effects: [],
              },
            ],
          },
          {
            id: "bargain",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [],
            next: "guns",
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
      plain: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_ypres",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      wall: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take_it",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "plain",
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      guns: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_ypres",
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
      closed: {
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
      trusted: {
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
    id: "deu_t_falk_peace",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 9,
          max: 10,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["cold"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "how",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_peace",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -2,
              },
            ],
            next: "plain",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "resign",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
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
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "how",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_falk_peace",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "falk_seat",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_falk_peace",
              },
            ],
            next: "dealt",
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
      how: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_falk_peace",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: null,
          },
          {
            id: "vienna",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_falk_peace",
              },
            ],
            next: "vienna",
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
            id: "then",
            stance: "cold",
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
            effects: [],
            next: null,
          },
        ],
      },
      resign: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hold",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "how",
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      vienna: {
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_hind_letter",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "chapter",
      min: 0,
      max: 6,
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "ground",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_ready",
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
            next: "age",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "ground",
                effects: [],
              },
            ],
          },
          {
            id: "promise",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_hind_ready",
              },
            ],
            next: "ready",
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
      ground: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_hind_ready",
              },
            ],
            next: "ready",
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
      age: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "laugh",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_hind_ready",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "ready",
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
      ready: {
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
      closed: {
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
      trusted: {
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
    id: "deu_t_hind_masuria",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "chapter",
      min: 2,
      max: 6,
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            next: "lakes",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_masuria",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "stone",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "stone",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "hunt",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "hunt",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_masuria",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "hind_exercise",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_hind_masuria",
              },
            ],
            next: "dealt",
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
      lakes: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_hind_masuria",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
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
      stone: {
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
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "lakes",
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
      hunt: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lakes",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_hind_ludendorff",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 8,
        },
        {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "w_tannenberg",
            },
            {
              kind: "memory",
              key: "k_hind_ready",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            next: "two",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_ludendorff",
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
            next: "two",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "wall",
                effects: [
                  {
                    kind: "person_trust",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
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
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "night",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_ludendorff",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "hind_keep_lud",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_hind_ludendorff",
              },
            ],
            next: "dealt",
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
      two: {
        says: [
          {
            id: "cold",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_hind_ludendorff",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "fit",
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
      night: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_hind_ludendorff",
              },
            ],
            next: "fit",
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
        ],
      },
      fit: {
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_hind_victory",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 7,
          max: 9,
        },
        {
          kind: "flag",
          flag: "w_tannenberg",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            next: "whose",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_victory",
                  },
                ],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "cool",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "dry",
                effects: [],
              },
            ],
          },
          {
            id: "warn",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "dry",
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
      whose: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_hind_victory",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
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
      cool: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "whose",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "whose",
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
      dry: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fair",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "whose",
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
      closed: {
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
      trusted: {
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
    id: "deu_t_hind_falk",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 9,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_hind_falk",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "hold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "hold",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
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
            effects: [],
            next: "half",
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
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_hind_falk",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      hold: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_hind_falk",
              },
            ],
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
      half: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_hind_falk",
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
      closed: {
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
      trusted: {
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
    id: "deu_t_hind_baton",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "chapter",
      min: 9,
      max: 10,
    },
    cast: {
      who: {
        person: "deu_hindenburg",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            id: "promise",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "hind_east_command",
                chapters: 2,
              },
            ],
            next: "pledged",
          },
          {
            id: "ask",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [],
              },
            ],
          },
          {
            id: "delay",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "patient",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "patient",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
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
      what: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "promise",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "hind_east_command",
                chapters: 2,
              },
            ],
            next: "pledged",
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
      pledged: {
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
      patient: {
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
      closed: {
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
      trusted: {
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
    id: "deu_t_lud_bill",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 0,
      max: 3,
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "gap",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_bill",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "loud",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "gap",
                effects: [],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "gap",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_bill",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "lud_return",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_lud_bill",
              },
            ],
            next: "dealt",
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
      gap: {
        says: [
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_bill",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "use",
          },
          {
            id: "doubt",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_lud_bill",
              },
            ],
            next: "use",
          },
        ],
      },
      loud: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "gap",
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
      use: {
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_lud_rail",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 3,
          max: 4,
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "days",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_rail",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "high",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "days",
                effects: [],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "days",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_rail",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "lud_rail_post",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_lud_rail",
              },
            ],
            next: "dealt",
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
      days: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_rail",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      high: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "days",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_lud_liege",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 3,
          max: 4,
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
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
            next: "how",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_liege",
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
            next: "how",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "chest",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "ask_go",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "go",
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
      how: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_liege",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
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
            effects: [
              {
                kind: "remember",
                key: "k_lud_liege",
              },
            ],
            next: "cost",
          },
        ],
      },
      chest: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
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
            effects: [],
            next: null,
          },
        ],
      },
      go: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_liege",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
        ],
      },
      closed: {
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
      trusted: {
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
    id: "deu_t_lud_east",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 5,
          max: 6,
        },
        {
          kind: "any",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "at_war",
              tag: "FRA",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sum",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_east",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "sharp",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "sum",
                effects: [],
              },
            ],
          },
          {
            id: "offer",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "sum",
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
      sum: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_east",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      sharp: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fair",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sum",
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
      closed: {
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
      trusted: {
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
    id: "deu_t_lud_nerves",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "chapter",
      min: 7,
      max: 8,
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["anxious"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "measure",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_staff_measured",
                  },
                ],
              },
            ],
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
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "man",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_staff_measured",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "man",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "measure",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "flatter",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "lud_honour",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "m_staff_measured",
              },
            ],
            next: "dealt",
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
      measure: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "m_staff_measured",
              },
              {
                kind: "source",
                source: "staff",
                right: true,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
                kind: "remember",
                key: "m_staff_measured",
              },
            ],
            next: null,
          },
        ],
      },
      man: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "measure",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_lud_politics",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "chapter",
      min: 8,
      max: 10,
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_politics",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -2,
              },
            ],
            next: "stop",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "who",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: -1,
                  },
                ],
              },
            ],
          },
          {
            id: "hear",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "want",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_lud_politics",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "lud_ear",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_lud_politics",
              },
            ],
            next: "dealt",
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
      who: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_lud_politics",
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
      stop: {
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
      want: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_lud_politics",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_fleet",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 0,
      max: 2,
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "year",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_fleet",
                  },
                ],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "year",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_fleet",
                  },
                ],
              },
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cunning"],
                },
                next: "side",
                effects: [],
              },
            ],
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
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "side",
          },
          {
            id: "deal_it",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_budget",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_tirp_fleet",
              },
            ],
            next: "dealt",
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
      year: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_tirp_fleet",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
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
      side: {
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
            next: "year",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_britain",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "chapter",
      min: 1,
      max: 8,
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["arrogant"],
            },
          },
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "far",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_britain",
                  },
                ],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "far",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_britain",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "blame",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cunning"],
                },
                next: "far",
                effects: [],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_direct",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_tirp_britain",
              },
            ],
            next: "dealt",
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
      far: {
        says: [
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_tirp_britain",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      blame: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "far",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_goeben",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "chapter",
      min: 3,
      max: 5,
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            next: "port",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_goeben",
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
            next: "price",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "price",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
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
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "port",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_goeben",
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_share",
                chapters: 2,
              },
              {
                kind: "remember",
                key: "k_tirp_goeben",
              },
            ],
            next: "dealt",
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
      port: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_tirp_goeben",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      price: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "port",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_command",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 5,
          max: 8,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
                role: "who",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "son",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "son",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_command",
                  },
                ],
              },
            ],
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "want",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_command",
                  },
                ],
              },
            ],
          },
          {
            id: "refuse",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "resign",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "resign",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_review",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_tirp_command",
              },
            ],
            next: "dealt",
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
      son: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "then",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_tirp_command",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      resign: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "soft",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_sub",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        {
          kind: "chapter",
          min: 8,
          max: 10,
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_sub",
                  },
                ],
              },
            ],
          },
          {
            id: "law",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "law",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "k_tirp_sub",
                  },
                ],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "count",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cunning"],
                },
                next: "dodge",
                effects: [
                  {
                    kind: "pride",
                    who: {
                      role: "who",
                    },
                    delta: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "deal_it",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_uboats",
                chapters: 3,
              },
              {
                kind: "remember",
                key: "k_tirp_sub",
              },
            ],
            next: "dealt",
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
      count: {
        says: [
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "key",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "remember",
                key: "k_tirp_sub",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
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
      law: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hmm",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
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
      dodge: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
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
      closed: {
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
      trusted: {
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
      dealt: {
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
    id: "deu_t_tirp_chancellor",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "chapter",
      min: 8,
      max: 10,
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 1,
    tags: ["people"],
    once: true,
    summon: true,
    who: "who",
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
            id: "cunn",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
            },
          },
          {
            id: "arro",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "who",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_tirp_camp",
                  },
                ],
              },
            ],
          },
          {
            id: "open",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "env",
            reacts: [
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -2,
                },
                next: "closed",
                effects: [],
              },
              {
                when: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 2,
                },
                next: "trusted",
                effects: [
                  {
                    kind: "remember",
                    key: "m_tirp_camp",
                  },
                ],
              },
            ],
          },
          {
            id: "silence",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_silent",
                chapters: 3,
              },
            ],
            next: "deal",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
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
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "m_tirp_camp",
              },
            ],
            next: null,
          },
          {
            id: "silence",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "m_tirp_camp",
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "tirp_silent",
                chapters: 3,
              },
            ],
            next: "deal",
          },
        ],
      },
      env: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "who2",
            stance: "cold",
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
            effects: [
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      deal: {
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
      closed: {
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
      trusted: {
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
];
