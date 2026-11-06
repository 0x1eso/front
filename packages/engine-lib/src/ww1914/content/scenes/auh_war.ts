import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「오스트리아-헝가리」, the war share: `auh_w_` scenes, the summoned talks of
 * Conrad, Krobatin, Boroević and Bolfras, and five visits. Data only. Text is
 * in resources/ww1914/ko/AUH.war.json. Plan: ww135-plan-auh.md sections 5, 8, 9.
 *
 * The stand-ins below are what plan section 2 asks lane Y for and this branch
 * lacks. Each is one definition: replace it here when the real one lands, and
 * every scene follows.
 */

/** Plan section 0's periods, as `full` chapters. Becomes world `date`. */
const PERIODS: Readonly<Record<string, readonly [number, number]>> = {
  C: [0, 5],
  "14": [6, 10],
  "15a": [11, 17],
  "15b": [18, 22],
  "16a": [23, 29],
  "16b": [30, 35],
  "17a": [36, 41],
  "17b": [42, 47],
  "18a": [48, 53],
  "18b": [54, 59],
};
const during = (from: string, to: string): GwCond => ({
  kind: "chapter",
  min: PERIODS[from][0],
  max: PERIODS[to][1],
});

/** The Russians pushed us last. Becomes world `battle` with `by: "entente"`. */
const eastPushed: GwCond = {
  kind: "any",
  of: [
    { kind: "world", of: { is: "front", theatre: "east", to: "oder" } },
    {
      kind: "all",
      of: [
        {
          kind: "world",
          of: { is: "battle", theatre: "east", of: ["advance", "break"] },
        },
        { kind: "world", of: { is: "score", max: 0 } },
      ],
    },
  ],
};

/** Plan's flag ladder for the debt to Berlin. Becomes `inst: "berlin"`. */
const debtFlag = (n: number) => `f_auh_debt_${n}`;
const debtAt = (n: number): GwCond => ({ kind: "flag", flag: debtFlag(n) });
const always: GwCond = { kind: "all", of: [] };
const debt = (delta: 1 | -1): GwEffect => {
  const step = (n: number): GwEffect =>
    delta > 0
      ? {
          kind: "maybe",
          when: {
            kind: "all",
            of: [
              ...(n > 1 ? [debtAt(n - 1)] : []),
              { kind: "not", of: debtAt(n) },
            ],
          },
          then: [{ kind: "flag", flag: debtFlag(n) }],
        }
      : {
          kind: "maybe",
          when: {
            kind: "all",
            of: [
              debtAt(n),
              ...(n < 3 ? [{ kind: "not", of: debtAt(n + 1) } as GwCond] : []),
            ],
          },
          then: [{ kind: "unflag", flag: debtFlag(n) }],
        };
  // Top step first, so one call moves the ladder by one.
  return { kind: "maybe", when: always, then: [step(3), step(2), step(1)] };
};

/** Become `inst: "hungary"` and `inst: "nations"`. */
const hungary = (delta: number): GwEffect => ({
  kind: "flag",
  flag: delta < 0 ? "f_auh_hungary_down" : "f_auh_hungary_up",
});
const nations = (delta: number): GwEffect => ({
  kind: "flag",
  flag: delta < 0 ? "f_auh_nations_down" : "f_auh_nations_up",
});

/** Becomes world `reveal` once GW_SECRETS holds the plan's new ids. */
const reveal = (id: string): GwEffect => ({
  kind: "flag",
  flag: `f_known_${id}`,
});

/** Becomes world `sign_chief` (on w130-gw, not on this branch). */
const signChief: GwEffect = { kind: "flag", flag: "f_auh_chief_signed" };

export const AUH_WAR_SCENES: readonly GwScene[] = [
  {
    id: "auh_w_ledger_1914",
    nation: ["AUH"],
    kind: "ledger",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "world",
          of: {
            is: "war",
          },
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
    cooldown: 1,
    variants: [
      {
        id: "south_lost",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "balkan",
            of: ["repelled"],
          },
        },
      },
      {
        id: "north_thin",
        when: eastPushed,
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
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          signChief,
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
            key: "m_auh_returned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_ledger_1915",
    nation: ["AUH"],
    kind: "ledger",
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
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
    cooldown: 1,
    variants: [
      {
        id: "three",
        when: {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
      },
      {
        id: "guests",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "auh_w_german_command",
              pick: "accept_terms",
            },
            debtAt(1),
          ],
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
        id: "base",
      },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          signChief,
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
            key: "m_auh_returned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_ledger_1916",
    nation: ["AUH"],
    kind: "ledger",
    when: {
      kind: "all",
      of: [
        during("16a", "16b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
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
    cooldown: 1,
    variants: [
      {
        id: "after_east",
        when: {
          kind: "seen",
          scene: "auh_w_brusilov",
        },
      },
      {
        id: "tyrol",
        when: {
          kind: "chose",
          scene: "auh_w_tyrol_strike",
          pick: "strike",
        },
      },
      {
        id: "romania",
        when: {
          kind: "world",
          of: {
            is: "entered",
            tag: "ROU",
          },
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
          signChief,
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
            key: "m_auh_returned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_ledger_1917",
    nation: ["AUH"],
    kind: "ledger",
    when: {
      kind: "all",
      of: [
        during("17a", "17b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
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
    cooldown: 1,
    variants: [
      {
        id: "east_gone",
        when: {
          kind: "world",
          of: {
            is: "out",
            tag: "RUS",
          },
        },
      },
      {
        id: "new_chief",
        when: {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "auh_conrad",
          },
        },
      },
      {
        id: "no_men",
        when: {
          kind: "world",
          of: {
            is: "manpower",
            max: 30,
          },
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
          signChief,
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
            key: "m_auh_returned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_ledger_1918",
    nation: ["AUH"],
    kind: "ledger",
    when: {
      kind: "all",
      of: [
        during("18a", "18b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
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
    cooldown: 1,
    variants: [
      {
        id: "boots",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      },
      {
        id: "east_free",
        when: {
          kind: "world",
          of: {
            is: "out",
            tag: "RUS",
          },
        },
      },
      {
        id: "falling",
        when: {
          kind: "world",
          of: {
            is: "score",
            max: -10,
          },
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
          signChief,
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
            key: "m_auh_returned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_cer",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "at_war",
          tag: "SRB",
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "won",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "balkan",
            of: ["advance", "break"],
          },
        },
      },
      {
        id: "lost",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "balkan",
            of: ["repelled"],
          },
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_galicia_plan",
    nation: ["AUH"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "at_war",
          tag: "RUS",
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "redl",
        when: {
          kind: "secret",
          id: "auh_redl_plans",
        },
      },
      {
        id: "south",
        when: {
          kind: "chose",
          scene: "auh_c_b_staffel",
          pick: "south_first",
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
        tell: ["army:+1", "casualties_high"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -3,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_east_attack",
          },
        ],
      },
      {
        id: "wait_on_san",
        when: {
          kind: "memory",
          key: "k_bor_san",
        },
        tell: ["army:-1", "cos:-1", "casualties_low"],
        effects: [
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
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_east_wait",
          },
        ],
      },
      {
        id: "ask_berlin_date",
        when: {
          kind: "memory",
          key: "k_con_moltke",
        },
        tell: ["deu:-1", "delay:7"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "delay",
            days: 7,
          },
          {
            kind: "world",
            of: {
              do: "report",
              fact: "force",
              tag: "DEU",
              theatre: "east",
              source: "attache",
            },
          },
          {
            kind: "flag",
            flag: "f_auh_asked_date",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_lemberg",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        eastPushed,
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
        id: "after_wait",
        when: {
          kind: "chose",
          scene: "auh_w_galicia_plan",
          pick: "wait_on_san",
        },
      },
      {
        id: "after_attack",
        when: {
          kind: "chose",
          scene: "auh_w_galicia_plan",
          pick: "attack",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "fall_back_san",
    options: [
      {
        id: "fall_back_san",
        tell: ["morale:-1", "casualties_low"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_auh_san",
          },
        ],
      },
      {
        id: "hold_lemberg",
        tell: ["army:+1", "casualties_high"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -5,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_retake_lemberg",
          },
        ],
      },
      {
        id: "call_germans",
        when: {
          kind: "memory",
          key: "k_con_moltke",
        },
        tell: ["berlin:+1", "deu:+1", "army:-1"],
        effects: [
          debt(1),
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "remember",
            key: "k_called_germans_1914",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_potiorek",
    nation: ["AUH"],
    kind: "audience",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "at_war",
          tag: "SRB",
        },
        {
          kind: "world",
          of: {
            is: "battle",
            theatre: "balkan",
            of: ["repelled"],
          },
        },
      ],
    },
    cast: {
      foreign: {
        office: "foreign",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 7,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "belgrade",
        when: {
          kind: "world",
          of: {
            is: "front",
            theatre: "balkan",
            from: "belgrade",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "keep_him",
    options: [
      {
        id: "keep_him",
        tell: ["cos:-1", "morale:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "remember",
            key: "m_auh_kept_potiorek",
          },
        ],
      },
      {
        id: "relieve",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_bil_potiorek",
            },
            {
              kind: "memory",
              key: "k_bol_names",
            },
          ],
        },
        tell: ["cos:+1", "army:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_potiorek",
            },
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_auh_potiorek_out",
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "balkan",
              delta: 1,
            },
          },
          {
            kind: "reason",
            key: "auhw_potiorek_out",
          },
        ],
      },
      {
        id: "eugen_with_watch",
        when: {
          kind: "memory",
          key: "k_bol_names",
        },
        tell: ["trust:+1", "cos:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              person: "auh_bolfras",
            },
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
            flag: "f_auh_potiorek_out",
          },
          {
            kind: "flag",
            flag: "f_auh_eugen_south",
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "balkan",
              delta: 1,
            },
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_belgrade_fest",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "world",
          of: {
            is: "front",
            theatre: "balkan",
            from: "belgrade",
          },
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "gone",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "balkan",
            of: ["repelled"],
          },
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_przemysl",
    nation: ["AUH"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        eastPushed,
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "second",
        when: {
          kind: "seen",
          scene: "auh_w_lemberg",
        },
      },
      {
        id: "fat",
        when: {
          kind: "gauge",
          gauge: "bread",
          min: 2,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "relieve_it",
    options: [
      {
        id: "relieve_it",
        tell: ["hungary:+1", "casualties_high"],
        effects: [
          hungary(1),
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -4,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_relieve_fort",
          },
        ],
      },
      {
        id: "let_it_stand",
        when: {
          kind: "memory",
          key: "k_bor_przemysl",
        },
        tell: ["morale:-1", "hungary:-1", "casualties_low"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          hungary(-1),
          {
            kind: "flag",
            flag: "f_auh_fort_alone",
          },
        ],
      },
      {
        id: "break_out",
        when: {
          kind: "memory",
          key: "k_bor_przemysl",
        },
        tell: ["army:-1", "morale:-1"],
        effects: [
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
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: 2,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_fort_out",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_carpathian",
    nation: ["AUH"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        {
          kind: "seen",
          scene: "auh_w_przemysl",
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
        id: "snow",
        when: {
          kind: "chose",
          scene: "auh_w_przemysl",
          pick: "relieve_it",
        },
      },
      {
        id: "fort_out",
        when: {
          kind: "chose",
          scene: "auh_w_przemysl",
          pick: "break_out",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "push_on",
    options: [
      {
        id: "push_on",
        tell: ["army:+1", "casualties_high", "morale:-1"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -8,
            },
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_carpathian_push",
          },
        ],
      },
      {
        id: "hold_passes",
        when: {
          kind: "memory",
          key: "k_bor_san",
        },
        tell: ["cos:-1", "casualties_low"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -2,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_carpathian_hold",
          },
        ],
      },
      {
        id: "ask_germans",
        when: {
          kind: "memory",
          key: "k_con_germans",
        },
        tell: ["berlin:+1", "cos:-1", "deu:+1"],
        effects: [
          debt(1),
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_south_army",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_german_command",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        {
          kind: "any",
          of: [
            debtAt(1),
            {
              kind: "memory",
              key: "k_falk_terms",
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
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "after_falk",
        when: {
          kind: "memory",
          key: "k_falk_terms",
        },
      },
      {
        id: "fort_fell",
        when: {
          kind: "flag",
          flag: "f_auh_relieve_fort",
        },
      },
      {
        id: "cold",
        when: {
          kind: "trust",
          tag: "DEU",
          max: 0,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "accept_terms",
    options: [
      {
        id: "accept_terms",
        tell: ["berlin:+1", "cos:-2", "deu:+1"],
        effects: [
          debt(1),
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -2,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "DEU",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "reason",
            key: "auhw_german_command",
          },
        ],
      },
      {
        id: "keep_command",
        when: {
          kind: "memory",
          key: "k_con_germans",
        },
        tell: ["berlin:-1", "deu:-2", "army:+1"],
        effects: [
          debt(-1),
          {
            kind: "trust",
            tag: "DEU",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_kept_command",
          },
        ],
      },
      {
        id: "share_staff",
        when: {
          kind: "memory",
          key: "k_falk_terms",
        },
        tell: ["berlin:+1", "cos:-1"],
        effects: [
          debt(1),
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_shared_staff",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_italy_war",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
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
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "refused",
        when: {
          kind: "chose",
          scene: "auh_h_italy_offer",
          pick: "refuse",
        },
      },
      {
        id: "early",
        when: during("15a", "15a"),
      },
      {
        id: "base",
      },
    ],
    fallback: "isonzo_line",
    options: [
      {
        id: "isonzo_line",
        tell: ["casualties_low", "shells:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_isonzo_line",
          },
        ],
      },
      {
        id: "hold_trentino",
        tell: ["cos:+1", "army:+1", "casualties_high"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -3,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_trentino_first",
          },
        ],
      },
      {
        id: "boroevic_to_isonzo",
        when: {
          kind: "memory",
          key: "k_bor_isonzo",
        },
        tell: ["cos:-1", "morale:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "command",
              who: {
                person: "auh_boroevic",
              },
              theatre: "italy",
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_boroevic_isonzo",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_serbia_again",
    nation: ["AUH"],
    kind: "dispute",
    when: {
      kind: "all",
      of: [
        during("15b", "15b"),
        {
          kind: "at_war",
          tag: "SRB",
        },
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "out",
              tag: "SRB",
            },
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "entered",
                tag: "BGR",
              },
            },
            debtAt(2),
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
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "bulgaria",
        when: {
          kind: "world",
          of: {
            is: "entered",
            tag: "BGR",
          },
        },
      },
      {
        id: "debt",
        when: debtAt(2),
      },
      {
        id: "base",
      },
    ],
    fallback: "under_mackensen",
    options: [
      {
        id: "under_mackensen",
        tell: ["berlin:+1", "cos:-1", "deu:+1"],
        effects: [
          debt(1),
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "balkan",
              delta: 2,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_under_mackensen",
          },
        ],
      },
      {
        id: "own_army",
        tell: ["army:+1", "deu:-1", "casualties_high"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -4,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "balkan",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_own_serbia",
          },
        ],
      },
      {
        id: "let_bulgaria_lead",
        tell: ["cos:-1", "morale:-1", "casualties_low"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "trust",
            tag: "BGR",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_bgr_lead",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_lovcen",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("15b", "16a"),
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "out",
                tag: "SRB",
              },
            },
            {
              kind: "world",
              of: {
                is: "front",
                theatre: "balkan",
                from: "nis",
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
        id: "navy",
        when: {
          kind: "flag",
          flag: "f_auh_fleet_raid",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_tyrol_strike",
    nation: ["AUH"],
    kind: "dispute",
    when: {
      kind: "all",
      of: [
        during("16a", "16a"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
        {
          kind: "at_war",
          tag: "RUS",
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
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "told_no",
        when: {
          kind: "memory",
          key: "k_bol_conrad",
        },
      },
      {
        id: "karl",
        when: {
          kind: "memory",
          key: "k_karl_xx",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "no_strike",
    options: [
      {
        id: "no_strike",
        tell: ["cos:-2", "casualties_low"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_no_strike",
          },
        ],
      },
      {
        id: "strike",
        when: {
          kind: "memory",
          key: "k_con_tyrol",
        },
        tell: ["cos:+2", "deu:-1", "casualties_high"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 2,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 2,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -2,
            },
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -5,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_tyrol_strike",
          },
        ],
      },
      {
        id: "tell_berlin",
        when: {
          kind: "memory",
          key: "k_bol_conrad",
        },
        tell: ["deu:+1", "cos:-1", "delay:14"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
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
            kind: "delay",
            days: 14,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_tyrol_told",
          },
        ],
      },
      {
        id: "xx_corps_with_heir",
        when: {
          kind: "memory",
          key: "k_karl_xx",
        },
        tell: ["cos:+1", "morale:+1", "casualties_high"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 2,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -2,
            },
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -5,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_tyrol_strike",
          },
          {
            kind: "flag",
            flag: "f_auh_heir_xx",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_brusilov",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("16a", "16b"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        eastPushed,
        {
          kind: "world",
          of: {
            is: "war_age",
            min: 12,
          },
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
        id: "after_strike",
        when: {
          kind: "chose",
          scene: "auh_w_tyrol_strike",
          pick: "strike",
        },
      },
      {
        id: "thin_czech",
        when: {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "f_auh_nations_down",
            },
            {
              kind: "secret",
              id: "auh_czech_regiments_sound",
            },
          ],
        },
      },
      {
        id: "debt_high",
        when: debtAt(2),
      },
      {
        id: "base",
      },
    ],
    fallback: "call_germans",
    options: [
      {
        id: "call_germans",
        tell: ["berlin:+1", "cos:-1", "deu:+1"],
        effects: [
          debt(1),
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 2,
            },
          },
          {
            kind: "reason",
            key: "auhw_brusilov_germans",
          },
        ],
      },
      {
        id: "strip_italy",
        tell: ["berlin:-1", "army:+1", "casualties_high"],
        effects: [
          debt(-1),
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: -2,
            },
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -4,
            },
          },
        ],
      },
      {
        id: "fall_back_far",
        when: {
          kind: "memory",
          key: "k_krob_men",
        },
        tell: ["morale:-1", "casualties_low", "nations:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          nations(-1),
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_long_retreat",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_one_command",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("16b", "16b"),
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "auh_w_brusilov",
            },
            {
              kind: "world",
              of: {
                is: "entered",
                tag: "ROU",
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
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "romania",
        when: {
          kind: "world",
          of: {
            is: "entered",
            tag: "ROU",
          },
        },
      },
      {
        id: "east_only",
        when: {
          kind: "seen",
          scene: "auh_w_brusilov",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "sign",
    options: [
      {
        id: "sign",
        tell: ["berlin:+1", "deu:+1", "cos:-1"],
        effects: [
          debt(1),
          {
            kind: "trust",
            tag: "DEU",
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
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "reason",
            key: "auhw_one_command",
          },
        ],
      },
      {
        id: "sign_with_clause",
        when: {
          kind: "memory",
          key: "k_falk_terms",
        },
        tell: ["berlin:+1", "deu:-1"],
        effects: [
          debt(1),
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_veto_clause",
          },
        ],
      },
      {
        id: "refuse",
        when: {
          kind: "memory",
          key: "k_bol_heir",
        },
        tell: ["berlin:-1", "deu:-2", "army:+1"],
        effects: [
          debt(-1),
          {
            kind: "trust",
            tag: "DEU",
            delta: -2,
          },
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: -1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_no_one_command",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_romania_in",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("16b", "16b"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ROU",
          },
        },
      ],
    },
    cast: {
      hun_pm: {
        office: "hun_pm",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "words_only",
        when: {
          kind: "chose",
          scene: "auh_h_romania_offer",
          pick: "words_only",
        },
      },
      {
        id: "paid",
        when: {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "auh_h_romania_offer",
              pick: "bukovina_slice",
            },
            {
              kind: "chose",
              scene: "auh_h_romania_offer",
              pick: "cultural_rights",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "carpathian_line",
    options: [
      {
        id: "carpathian_line",
        tell: ["hungary:-1", "casualties_low"],
        effects: [
          hungary(-1),
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_carp_line",
          },
        ],
      },
      {
        id: "send_arz",
        when: {
          kind: "memory",
          key: "k_cz_price",
        },
        tell: ["hungary:+1", "trust:+1"],
        effects: [
          hungary(1),
          {
            kind: "world",
            of: {
              do: "command",
              who: {
                person: "auh_arz",
              },
              theatre: "east",
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_arz",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "strip_italy",
        tell: ["hungary:+1", "casualties_high"],
        effects: [
          hungary(1),
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "east",
              delta: 1,
            },
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: -1,
            },
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
    id: "auh_w_fleet_out",
    nation: ["AUH"],
    kind: "dispute",
    when: {
      kind: "all",
      of: [
        during("15a", "17b"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
      ],
    },
    cast: {
      navy: {
        office: "navy",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 6,
    tags: ["war"],
    cooldown: 8,
    variants: [
      {
        id: "blockade",
        when: {
          kind: "chose",
          scene: "auh_w_fleet_out",
          pick: "bar_the_strait",
        },
      },
      {
        id: "raided",
        when: {
          kind: "chose",
          scene: "auh_w_fleet_out",
          pick: "raid_coast",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "stay_in_pola",
    options: [
      {
        id: "stay_in_pola",
        tell: ["cos:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_fleet_in",
          },
        ],
      },
      {
        id: "raid_coast",
        tell: ["morale:+1", "shells:-1", "navy:-1"],
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
            kind: "person_trust",
            who: {
              role: "navy",
            },
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_fleet_raid",
          },
        ],
      },
      {
        id: "bar_the_strait",
        tell: ["deu:+1", "shells:-1"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_strait_raid",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_regiments",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("15a", "18a"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["war", "tension_up"],
    cooldown: 6,
    stamp: "unconfirmed",
    source: "staff",
    variants: [
      {
        id: "corrected",
        when: {
          kind: "flag",
          flag: "f_known_auh_czech_regiments_sound",
        },
      },
      {
        id: "fear",
        when: {
          kind: "flag",
          flag: "f_auh_nations_down",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_lists",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("14", "18b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    cooldown: 4,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "long",
        when: {
          kind: "world",
          of: {
            is: "casualties",
            min: 800,
          },
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_record_serbia",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "chapter",
          min: 7,
        },
        {
          kind: "at_war",
          tag: "SRB",
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["war"],
    once: true,
    stamp: "estimate",
    source: "press",
    variants: [
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_record_galicia",
    nation: ["AUH"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["war"],
    once: true,
    stamp: "estimate",
    source: "press",
    variants: [
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_w_caporetto",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("17b", "17b"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "out",
                tag: "RUS",
              },
            },
            {
              kind: "world",
              of: {
                is: "battle",
                theatre: "italy",
                of: ["stalemate"],
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
      foreign: {
        office: "foreign",
      },
    },
    salience: 8,
    tags: ["war", "tension_down"],
    once: true,
    variants: [
      {
        id: "eleventh",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "italy",
            of: ["stalemate"],
          },
        },
      },
      {
        id: "east_quiet",
        when: {
          kind: "world",
          of: {
            is: "out",
            tag: "RUS",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "ask_germans",
    options: [
      {
        id: "ask_germans",
        tell: ["berlin:+1", "deu:+1", "morale:+1"],
        effects: [
          debt(1),
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 2,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_caporetto",
          },
        ],
      },
      {
        id: "alone_small",
        tell: ["casualties_low", "army:-1"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_small_push",
          },
        ],
      },
      {
        id: "karl_at_front",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_karl_front",
            },
            {
              kind: "flag",
              flag: "w_auh_karl",
            },
          ],
        },
        tell: ["morale:+2", "berlin:+1"],
        effects: [
          debt(1),
          {
            kind: "gauge",
            gauge: "morale",
            delta: 2,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 2,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_caporetto",
          },
          {
            kind: "flag",
            flag: "f_auh_karl_front",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_piave",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("18a", "18a"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
        {
          kind: "world",
          of: {
            is: "front",
            theatre: "italy",
            from: "piave",
          },
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "hungry",
        when: {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      },
      {
        id: "no_conrad",
        when: {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "auh_conrad",
          },
        },
      },
      {
        id: "cold_arm",
        when: debtAt(2),
      },
      {
        id: "base",
      },
    ],
    fallback: "both_prongs",
    options: [
      {
        id: "both_prongs",
        tell: ["deu:+1", "casualties_high", "shells:-1"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -8,
            },
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_piave_both",
          },
        ],
      },
      {
        id: "conrad_only",
        when: {
          kind: "memory",
          key: "k_con_piave",
        },
        tell: ["casualties_high", "trust:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -6,
            },
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_boroevic",
            },
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_piave_conrad",
          },
        ],
      },
      {
        id: "boroevic_only",
        when: {
          kind: "memory",
          key: "k_bor_piave",
        },
        tell: ["casualties_high", "trust:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -6,
            },
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_conrad",
            },
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_piave_boroevic",
          },
        ],
      },
      {
        id: "no_attack",
        when: {
          kind: "memory",
          key: "k_bor_piave",
        },
        tell: ["berlin:+1", "deu:-2", "casualties_low", "bread"],
        effects: [
          debt(1),
          {
            kind: "trust",
            tag: "DEU",
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_no_piave",
          },
        ],
      },
    ],
  },
  {
    id: "auh_w_last_line",
    nation: ["AUH"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        during("18b", "18b"),
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
                is: "score",
                max: -20,
              },
            },
            {
              kind: "world",
              of: {
                is: "manpower",
                max: 20,
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
        id: "hungary",
        when: {
          kind: "any",
          of: [
            {
              kind: "flag",
              flag: "f_auh_hungary_down",
            },
          ],
        },
      },
      {
        id: "balkan",
        when: {
          kind: "world",
          of: {
            is: "out",
            tag: "BGR",
          },
        },
      },
      {
        id: "refuse",
        when: {
          kind: "world",
          of: {
            is: "unrest",
            min: 3,
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_where_you_are",
    options: [
      {
        id: "hold_where_you_are",
        tell: ["army:+1", "casualties_high", "nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          nations(-1),
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -3,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_stand_fast",
          },
        ],
      },
      {
        id: "let_hungarians_go",
        tell: ["hungary:+1", "army:-2", "morale:-1"],
        effects: [
          hungary(1),
          {
            kind: "inst",
            inst: "army",
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: -1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_hungarians_home",
          },
        ],
      },
      {
        id: "withdraw_whole",
        when: {
          kind: "memory",
          key: "k_krob_tyrol",
        },
        tell: ["morale:-1", "casualties_low", "cos:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "force",
              tag: "AUH",
              theatre: "italy",
              delta: 1,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_ordered_withdrawal",
          },
        ],
      },
    ],
  },
  {
    id: "auh_t_con_wait",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("C", "C"),
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_conrad",
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
            id: "arr",
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
            id: "sit",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lose",
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
                next: "lose",
                effects: [
                  {
                    kind: "remember",
                    key: "k_con_wait",
                  },
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
            gain: [
              {
                kind: "remember",
                key: "k_con_wait",
              },
            ],
            miss: "stand",
          },
          {
            id: "order",
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
            next: "stand",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "lose",
                effects: [
                  {
                    kind: "remember",
                    key: "k_con_wait",
                  },
                ],
              },
            ],
          },
          {
            id: "trade",
            stance: "frank",
            kind: "deal",
            tell: ["army:+1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "army",
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_con_wait",
              },
            ],
            next: "paper",
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
      lose: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "why",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "paper",
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
      stand: {
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
      paper: {
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
    },
  },
  {
    id: "auh_t_con_moltke",
    nation: ["AUH"],
    kind: "talk",
    when: during("C", "14"),
    cast: {
      who: {
        person: "auh_conrad",
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
            id: "wartime",
            when: {
              kind: "world",
              of: {
                is: "war",
              },
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
                    key: "k_con_moltke",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_con_moltke",
              },
            ],
            miss: "pride",
          },
          {
            id: "doubt",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "paper",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "pride",
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
            id: "swap",
            stance: "warm",
            kind: "deal",
            tell: ["deu:-1", "trust:+1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_con_moltke",
              },
              {
                kind: "world",
                of: {
                  do: "report",
                  fact: "force",
                  tag: "DEU",
                  theatre: "east",
                  source: "attache",
                },
              },
            ],
            next: "count",
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
      count: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
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
            id: "note",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            gain: [
              {
                kind: "remember",
                key: "k_con_moltke",
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
      pride: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "soothe",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
            gain: [
              {
                kind: "remember",
                key: "k_con_moltke",
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
    id: "auh_t_con_gina",
    nation: ["AUH"],
    kind: "talk",
    when: during("14", "15b"),
    cast: {
      who: {
        person: "auh_conrad",
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
              kind: "health",
              who: {
                role: "who",
              },
              max: 1,
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
            id: "who",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "gina",
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
            ],
            gain: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
          {
            id: "scold",
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
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "cold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "cold",
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
            id: "promise",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "con_gina",
                chapters: 6,
                keep: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 0,
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "lonely",
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
      gina: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "promise2",
            stance: "frank",
            kind: "deal",
            tell: ["promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "con_gina",
                chapters: 6,
                keep: {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  min: 0,
                },
              },
            ],
            next: "lonely",
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
      lonely: {
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
    },
  },
  {
    id: "auh_t_con_germans",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_conrad",
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
            id: "arr",
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
            id: "limit",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
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
                    key: "k_con_germans",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_con_germans",
              },
            ],
            miss: "rant",
          },
          {
            id: "swallow",
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
            next: "rant",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["anxious"],
                },
                next: "line",
                effects: [
                  {
                    kind: "remember",
                    key: "k_con_germans",
                  },
                ],
              },
            ],
          },
          {
            id: "back",
            stance: "flatter",
            kind: "deal",
            tell: ["deu:-1", "trust:+1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_con_germans",
              },
            ],
            next: "line",
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
      line: {
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
      rant: {
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
    id: "auh_t_con_tyrol",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("15b", "16a"),
        {
          kind: "world",
          of: {
            is: "entered",
            tag: "ITA",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_conrad",
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
            id: "arr",
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
            id: "hear",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
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
                    key: "k_con_tyrol",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_con_tyrol",
              },
            ],
            miss: "numbers",
          },
          {
            id: "east",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "east",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "snap",
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
            id: "half",
            stance: "frank",
            kind: "deal",
            tell: ["deu:+1", "trust:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_con_tyrol",
              },
            ],
            next: "numbers",
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
      numbers: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
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
      east: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "rem",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
            gain: [
              {
                kind: "remember",
                key: "k_con_tyrol",
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
      secret: {
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
      snap: {
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
    id: "auh_t_con_piave",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("17a", "18a"),
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "auh_conrad",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_conrad",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            id: "plan",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "heir",
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
                    key: "k_con_piave",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_con_piave",
              },
            ],
            miss: "bitter",
          },
          {
            id: "k_more",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            next: "heir",
            gain: [
              {
                kind: "remember",
                key: "k_con_piave",
              },
            ],
          },
          {
            id: "old",
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
              {
                kind: "pride",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
            next: "bitter",
          },
          {
            id: "give",
            stance: "flatter",
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
                kind: "person_trust",
                who: {
                  person: "auh_boroevic",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_con_piave",
              },
            ],
            next: "heir",
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
      heir: {
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
      bitter: {
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
    id: "auh_t_krob_harvest",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("C", "C"),
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_krobatin",
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
                    key: "k_krob_harvest",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_harvest",
              },
            ],
            miss: "table",
          },
          {
            id: "now",
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
            next: "table",
          },
          {
            id: "budget",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "money:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "gauge",
                gauge: "money",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_krob_harvest",
              },
            ],
            next: "quiet",
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
      quiet: {
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
      table: {
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
    id: "auh_t_krob_rail",
    nation: ["AUH"],
    kind: "talk",
    when: during("C", "C"),
    cast: {
      who: {
        person: "auh_krobatin",
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
            id: "both",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "muddle",
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
                next: "muddle",
                effects: [
                  {
                    kind: "remember",
                    key: "k_krob_rail",
                  },
                  {
                    kind: "world",
                    of: {
                      do: "reveal",
                      id: "auh_rail_muddle",
                    },
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_rail",
              },
            ],
            miss: "paper",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "paper",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "muddle",
                effects: [
                  {
                    kind: "remember",
                    key: "k_krob_rail",
                  },
                ],
              },
            ],
          },
          {
            id: "give",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "money",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_krob_rail",
              },
              {
                kind: "world",
                of: {
                  do: "reveal",
                  id: "auh_rail_muddle",
                },
              },
            ],
            next: "muddle",
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
      muddle: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
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
            stance: "cold",
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
    },
  },
  {
    id: "auh_t_krob_shells",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_krobatin",
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
            id: "low",
            when: {
              kind: "gauge",
              gauge: "shells",
              max: 1,
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
            id: "who",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "plant",
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
                    key: "k_krob_shells",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_shells",
              },
            ],
            miss: "budget",
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
            next: "budget",
          },
          {
            id: "contract",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "krob_contracts",
                chapters: 6,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "auh_h_shell_output",
                    },
                    {
                      kind: "gauge",
                      gauge: "shells",
                      min: 2,
                    },
                  ],
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_krob_shells",
              },
            ],
            next: "plant",
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
      plant: {
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
      budget: {
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
    id: "auh_t_krob_lang",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("15a", "16b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_krobatin",
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
            id: "fear",
            when: {
              kind: "flag",
              flag: "f_auh_nations_down",
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
            id: "fix",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fix",
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
                    key: "k_krob_lang",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_lang",
              },
            ],
            miss: "cost",
          },
          {
            id: "order",
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
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "fix",
                effects: [
                  {
                    kind: "remember",
                    key: "k_krob_lang",
                  },
                ],
              },
            ],
          },
          {
            id: "swap",
            stance: "frank",
            kind: "deal",
            tell: ["army:-1", "nations:+1"],
            effects: [
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
              nations(1),
              {
                kind: "remember",
                key: "k_krob_lang",
              },
            ],
            next: "fix",
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
      fix: {
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
    id: "auh_t_krob_men",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("16a", "17a"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_krobatin",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "save",
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
                    key: "k_krob_men",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_men",
              },
            ],
            miss: "table",
          },
          {
            id: "k_ask",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            next: "save",
            gain: [
              {
                kind: "remember",
                key: "k_krob_men",
              },
            ],
          },
          {
            id: "more",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "order:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "order",
                delta: -1,
              },
              {
                kind: "world",
                of: {
                  do: "manpower",
                  delta: 3,
                },
              },
            ],
            next: "table",
          },
          {
            id: "swap",
            stance: "frank",
            kind: "deal",
            tell: ["shells:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "shells",
                delta: -1,
              },
              {
                kind: "world",
                of: {
                  do: "manpower",
                  delta: 4,
                },
              },
              {
                kind: "remember",
                key: "k_krob_men",
              },
            ],
            next: "save",
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
      save: {
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
      table: {
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
    id: "auh_t_krob_tyrol",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("17b", "18b"),
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "war",
            person: "auh_krobatin",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_krobatin",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            next: "note",
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
                    key: "k_krob_tyrol",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_krob_tyrol",
              },
            ],
            miss: "short",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "short",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "note",
                effects: [
                  {
                    kind: "remember",
                    key: "k_krob_tyrol",
                  },
                ],
              },
            ],
          },
          {
            id: "give",
            stance: "warm",
            kind: "deal",
            tell: ["shells:-1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "shells",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_krob_tyrol",
              },
            ],
            next: "note",
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
      note: {
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
      short: {
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
    id: "auh_t_bor_san",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "14"),
        {
          kind: "at_war",
          tag: "RUS",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            id: "arr",
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
            next: "give",
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
                    key: "k_bor_san",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_san",
              },
            ],
            miss: "hq",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "hq",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "give",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bor_san",
                  },
                ],
              },
            ],
          },
          {
            id: "boots",
            stance: "warm",
            kind: "deal",
            tell: ["shells:-1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "shells",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bor_san",
              },
            ],
            next: "give",
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
      give: {
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
      hq: {
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
    id: "auh_t_bor_przemysl",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            id: "arr",
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
            next: "price",
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
                    key: "k_bor_przemysl",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_przemysl",
              },
            ],
            miss: "stone",
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
                  of: ["arrogant"],
                },
                next: "stone",
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
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "money",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bor_przemysl",
              },
            ],
            next: "price",
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
      price: {
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
      stone: {
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
    id: "auh_t_bor_isonzo",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "entered",
                tag: "ITA",
              },
            },
            {
              kind: "all",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "world",
                    of: {
                      is: "entered",
                      tag: "ITA",
                    },
                  },
                },
                {
                  kind: "trust",
                  tag: "ITA",
                  max: 0,
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hold",
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
                    key: "k_bor_isonzo",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_isonzo",
              },
            ],
            miss: "curt",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "curt",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "hold",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bor_isonzo",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["shells:-1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "shells",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bor_isonzo",
              },
            ],
            next: "hold",
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
      hold: {
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
      curt: {
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
    id: "auh_t_bor_socks",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("16a", "17b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
            },
          },
          {
            id: "arr",
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
            next: "czech",
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
                next: "czech",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bor_socks",
                  },
                  reveal("auh_czech_regiments_sound"),
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_socks",
              },
            ],
            miss: "boots",
          },
          {
            id: "k_ask",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            next: "czech",
            gain: [
              {
                kind: "remember",
                key: "k_bor_socks",
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "boots",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["stubborn"],
                },
                next: "boots",
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
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "bor_boots",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "gauge",
                      gauge: "shells",
                      min: 2,
                    },
                    {
                      kind: "chose",
                      scene: "auh_h_factory_law",
                    },
                    {
                      kind: "chose",
                      scene: "auh_h_food_committee",
                      pick: "real_powers",
                    },
                  ],
                },
                back: "auh_v_bor_promise",
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "czech",
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
      czech: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      boots: {
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
    },
  },
  {
    id: "auh_t_bor_piave",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("17b", "18a"),
        {
          kind: "world",
          of: {
            is: "front",
            theatre: "italy",
            from: "piave",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stay",
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
                    key: "k_bor_piave",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_piave",
              },
            ],
            miss: "curt",
          },
          {
            id: "k_ask",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            next: "stay",
            gain: [
              {
                kind: "remember",
                key: "k_bor_piave",
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
            next: "curt",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["bread:-1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "bread",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bor_piave",
              },
            ],
            next: "stay",
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
      stay: {
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
      curt: {
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
    id: "auh_t_bor_vienna",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("18b", "18b"),
        {
          kind: "world",
          of: {
            is: "score",
            max: -15,
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_boroevic",
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
            id: "arr",
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
                effects: [
                  {
                    kind: "remember",
                    key: "k_bor_vienna",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bor_vienna",
              },
            ],
            miss: "line",
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "line",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["arrogant"],
                },
                next: "line",
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
            id: "hold",
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
                key: "k_bor_vienna",
              },
            ],
            next: "what",
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
            id: "end",
            stance: "frank",
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
    id: "auh_t_bol_days",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("C", "14"),
        {
          kind: "not",
          of: {
            kind: "flag",
            flag: "w_auh_karl",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "health",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tired",
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
            ],
            miss: "fold",
          },
          {
            id: "line",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "queue",
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
            ],
            miss: "fold",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "fold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["weary"],
                },
                next: "queue",
                effects: [],
              },
            ],
          },
          {
            id: "swap",
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
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "queue",
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
      tired: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      queue: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "who",
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
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fold: {
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
    },
  },
  {
    id: "auh_t_bol_halt",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("C", "C"),
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "day",
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
                    key: "k_bol_halt",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bol_halt",
              },
            ],
            miss: "fold",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "fold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "day",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bol_halt",
                  },
                ],
              },
            ],
          },
          {
            id: "swap",
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
                key: "k_bol_halt",
              },
            ],
            next: "day",
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
      day: {
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
      fold: {
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
    id: "auh_t_bol_names",
    nation: ["AUH"],
    kind: "talk",
    when: during("14", "16a"),
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "south",
            when: {
              kind: "all",
              of: [
                {
                  kind: "at_war",
                  tag: "SRB",
                },
                {
                  kind: "not",
                  of: {
                    kind: "flag",
                    flag: "f_auh_potiorek_out",
                  },
                },
              ],
            },
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
            id: "field",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "field",
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
                    key: "k_bol_names",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bol_names",
              },
            ],
            miss: "fold",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "fold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "field",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bol_names",
                  },
                ],
              },
            ],
          },
          {
            id: "swap",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "cos:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_bol_names",
              },
            ],
            next: "field",
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
      field: {
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
      fold: {
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
    id: "auh_t_bol_staff",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "15b"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "trust",
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
                next: "redl",
                effects: [reveal("auh_redl_plans")],
              },
            ],
            miss: "fold",
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
            next: "fold",
          },
          {
            id: "swap",
            stance: "warm",
            kind: "deal",
            tell: ["cos:-1", "trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "source",
                source: "staff",
                right: false,
              },
            ],
            next: "redl",
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
      trust: {
        says: [
          {
            id: "good",
            when: {
              kind: "source_band",
              source: "staff",
              min: 3,
            },
          },
          {
            id: "bad",
            when: {
              kind: "source_band",
              source: "staff",
              max: 1,
            },
          },
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
            next: "redl",
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
      redl: {
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
      fold: {
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
    },
  },
  {
    id: "auh_t_bol_conrad",
    nation: ["AUH"],
    kind: "talk",
    when: during("15a", "17a"),
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "k",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
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
            id: "read",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tells",
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
                    key: "k_bol_conrad",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bol_conrad",
              },
            ],
            miss: "fold",
          },
          {
            id: "k_read",
            stance: "warm",
            kind: "ask",
            when: {
              kind: "flag",
              flag: "w_auh_karl",
            },
            tell: [],
            effects: [],
            next: "tells",
            gain: [
              {
                kind: "remember",
                key: "k_bol_conrad",
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
            next: "fold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["weary"],
                },
                next: "tells",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bol_conrad",
                  },
                ],
              },
            ],
          },
          {
            id: "swap",
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
                key: "k_bol_conrad",
              },
            ],
            next: "tells",
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
      tells: {
        says: [
          {
            id: "bad",
            when: {
              kind: "competence",
              who: {
                person: "auh_conrad",
              },
              field: "war",
              max: 1,
            },
          },
          {
            id: "good",
            when: {
              kind: "competence",
              who: {
                person: "auh_conrad",
              },
              field: "war",
              min: 3,
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
      fold: {
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
    id: "auh_t_bol_heir",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
        {
          kind: "not",
          of: {
            kind: "flag",
            flag: "w_auh_karl",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "auh_bolfras",
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
            id: "ask",
            stance: "frank",
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
                    key: "k_bol_heir",
                  },
                ],
              },
            ],
            gain: [
              {
                kind: "remember",
                key: "k_bol_heir",
              },
            ],
            miss: "fold",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "fold",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "who",
                  },
                  of: ["cold"],
                },
                next: "gap",
                effects: [
                  {
                    kind: "remember",
                    key: "k_bol_heir",
                  },
                ],
              },
            ],
          },
          {
            id: "swap",
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
                key: "k_bol_heir",
              },
              {
                kind: "flag",
                flag: "f_auh_heir_reads",
              },
            ],
            next: "gap",
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
      gap: {
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
      fold: {
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
    id: "auh_v_falk_terms",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "at_war",
          tag: "RUS",
        },
        eastPushed,
      ],
    },
    cast: {
      who: {
        person: "deu_falkenhayn",
      },
    },
    salience: 7,
    tags: ["war", "foreign"],
    once: true,
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
            id: "hi_debt",
            when: debtAt(1),
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
            next: "terms",
            gain: [
              {
                kind: "remember",
                key: "k_falk_terms",
              },
            ],
            miss: "smooth",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["deu:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
            ],
            next: "smooth",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["berlin:+1", "deu:+1"],
            effects: [
              debt(1),
              {
                kind: "trust",
                tag: "DEU",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_falk_terms",
              },
            ],
            next: "terms",
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
      terms: {
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
      smooth: {
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
    id: "auh_v_lud_grain",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("17b", "18b"),
        {
          kind: "world",
          of: {
            is: "out",
            tag: "RUS",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 7,
    tags: ["foreign", "home"],
    once: true,
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
        replies: [
          {
            id: "ask",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
            miss: "shout",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["deu:-1", "bread:+1", "berlin:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "bread",
                delta: 1,
              },
              debt(-1),
            ],
            next: "shout",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["berlin:+1", "morale:+1"],
            effects: [
              debt(1),
              {
                kind: "gauge",
                gauge: "morale",
                delta: 1,
              },
            ],
            next: "numbers",
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
      numbers: {
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
      shout: {
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
    id: "auh_v_conrad_resign",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "17a"),
        {
          kind: "person_trust",
          who: {
            role: "who",
          },
          max: -2,
        },
        {
          kind: "holder",
          office: "chief_of_staff",
          person: "auh_conrad",
        },
      ],
    },
    cast: {
      who: {
        person: "auh_conrad",
      },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
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
            id: "arr",
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
            stance: "warm",
            kind: "ask",
            tell: ["cos:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
            next: "stay",
            miss: "stay",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["leaves", "army:-2"],
            effects: [
              {
                kind: "world",
                of: {
                  do: "letter",
                  who: {
                    role: "who",
                  },
                },
              },
              {
                kind: "world",
                of: {
                  do: "leave",
                  who: {
                    role: "who",
                  },
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -2,
              },
            ],
            next: "gone",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "army:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "inst",
                inst: "army",
                delta: 1,
              },
              {
                kind: "flag",
                flag: "f_auh_sign_next",
              },
            ],
            next: "stay",
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
      stay: {
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
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_v_night_court",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("14", "17a"),
        {
          kind: "not",
          of: {
            kind: "flag",
            flag: "w_auh_karl",
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "gauge",
              gauge: "order",
              max: 2,
            },
            {
              kind: "temp",
              min: 8,
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "auh_bolfras",
      },
    },
    salience: 6,
    tags: ["people", "home"],
    cooldown: 6,
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
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
            miss: "worst",
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
            next: "done",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "order:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "gauge",
                gauge: "order",
                delta: 1,
              },
            ],
            next: "worst",
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
      worst: {
        says: [
          {
            id: "bread",
            when: {
              kind: "gauge",
              gauge: "bread",
              max: 1,
            },
          },
          {
            id: "hot",
            when: {
              kind: "temp",
              min: 8,
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
      done: {
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
    id: "auh_v_night_court_k",
    nation: ["AUH"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        during("16b", "18b"),
        {
          kind: "flag",
          flag: "w_auh_karl",
        },
        {
          kind: "any",
          of: [
            {
              kind: "gauge",
              gauge: "order",
              max: 2,
            },
            {
              kind: "temp",
              min: 8,
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "auh_zita",
      },
    },
    salience: 6,
    tags: ["people", "home"],
    cooldown: 6,
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
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "worst",
            miss: "worst",
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
            next: "done",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "order:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "gauge",
                gauge: "order",
                delta: 1,
              },
            ],
            next: "worst",
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
      worst: {
        says: [
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
      done: {
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
    id: "auh_v_bor_promise",
    nation: ["AUH"],
    kind: "talk",
    when: during("16a", "18a"),
    cast: {
      who: {
        called: true,
      },
    },
    salience: 8,
    tags: ["people", "war"],
    once: true,
    scheduledOnly: true,
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
            id: "arr",
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
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: ["morale:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "morale",
                delta: 1,
              },
            ],
            next: "needs",
            miss: "needs",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "morale:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "morale",
                delta: -1,
              },
            ],
            next: "line",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1", "morale:+1", "trust:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "money",
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
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "keep_promise",
                who: {
                  person: "auh_boroevic",
                },
                key: "bor_boots",
              },
            ],
            next: "needs",
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
      needs: {
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
      line: {
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
];
