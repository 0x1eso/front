import type { GwInstitution } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「오스트리아-헝가리」, the realm share: the auh_h_ scenes, the talks of Tisza,
 * Burián, Kramář and Adler, and five visits. Data only; the text is in
 * resources/ww1914/ko/AUH.realm.json. Plan: ww135-plan-auh.md §6, §8, §9.
 *
 * The stand-ins below are what plan §2 asks for and this branch lacks. Each is
 * one line to change when the world lane lands; nothing further down names
 * the thing it stands for.
 */

/** Plan's `hungary`. Lane Y's list spells it "hungary". */
const HUNGARY: GwInstitution = "countersign";
/** Plan's `nations`. Lane Y's list spells it "nationalities". */
const NATIONS: GwInstitution = "reichstag";

/** `FJ`, `K`, `FFT`: plan §0. Lane Y has `regime` for the first two. */
const KARL: GwCond = { kind: "flag", flag: "w_auh_karl" };
const OLD_EMPEROR: GwCond = { kind: "not", of: KARL };
const FF_THRONE: GwCond = { kind: "flag", flag: "w_auh_ff_throne" };

/** Plan's `동부 밀림`: wants `world battle` with `by`. Until then, our score says who gave ground. */
const EAST_SLIPPING: GwCond = {
  kind: "all",
  of: [
    {
      kind: "world",
      of: { is: "battle", theatre: "east", of: ["advance", "break"] },
    },
    { kind: "world", of: { is: "score", max: 0 } },
  ],
};

/**
 * Plan's secrets `auh_hun_grain_hidden` and `auh_czech_regiments_sound`, not in
 * GW_SECRETS here: something rolled once a game and hidden stands in. Finding
 * one sets `f_auh_found_grain` or `f_auh_found_czechs`, `reveal` when they land.
 */
const GRAIN_HIDDEN: GwCond = {
  kind: "competence",
  who: { person: "auh_tisza" },
  field: "admin",
  min: 2,
};
const CZECHS_SOUND: GwCond = {
  kind: "competence",
  who: { person: "auh_kramar" },
  field: "politics",
  min: 2,
};

/** Plan's `berlin` scale, by its fallback: flags f_auh_debt_1..3. */
const flagged = (n: number): GwCond => ({
  kind: "flag",
  flag: `f_auh_debt_${n}`,
});
const IN_DEBT = flagged(1);
const DEBT_UP: GwEffect[] = [
  {
    kind: "maybe",
    when: flagged(2),
    then: [{ kind: "flag", flag: "f_auh_debt_3" }],
  },
  {
    kind: "maybe",
    when: flagged(1),
    then: [{ kind: "flag", flag: "f_auh_debt_2" }],
  },
  { kind: "flag", flag: "f_auh_debt_1" },
];
const DEBT_DOWN: GwEffect[] = [
  {
    kind: "maybe",
    when: {
      kind: "all",
      of: [
        { kind: "not", of: flagged(2) },
        { kind: "not", of: flagged(3) },
      ],
    },
    then: [{ kind: "unflag", flag: "f_auh_debt_1" }],
  },
  {
    kind: "maybe",
    when: { kind: "not", of: flagged(3) },
    then: [{ kind: "unflag", flag: "f_auh_debt_2" }],
  },
  { kind: "unflag", flag: "f_auh_debt_3" },
];

/** Plan §0's periods, as `full` chapters. World `date` replaces this. */
const PERIODS = {
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
} as const;
const during = (
  from: keyof typeof PERIODS,
  to: keyof typeof PERIODS,
): GwCond => ({
  kind: "chapter",
  min: PERIODS[from][0],
  max: PERIODS[to][1],
});

export const AUH_REALM_SCENES: readonly GwScene[] = [
  {
    id: "auh_h_quota",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["y1914"],
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
      finance: {
        office: "finance",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "sour",
        when: {
          kind: "inst",
          inst: HUNGARY,
          max: -1,
        },
      },
      {
        id: "serbia_only",
        when: {
          kind: "not",
          of: {
            kind: "at_war",
            tag: "RUS",
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "usual_split",
    options: [
      {
        id: "usual_split",
        tell: ["money:-1", "hungary:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "remember",
            key: "auh_quota_kept",
          },
        ],
      },
      {
        id: "more_from_hungary",
        when: {
          kind: "memory",
          key: "k_bil_bill",
        },
        tell: ["money:+1", "hungary:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "bank_notes",
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
          {
            kind: "remember",
            key: "auh_bank_notes",
          },
          {
            kind: "person_trust",
            who: {
              role: "finance",
            },
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_shell_output",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["y1914", "war"],
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
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
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "east",
        when: EAST_SLIPPING,
      },
      {
        id: "south",
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
    fallback: "contracts",
    options: [
      {
        id: "contracts",
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
        ],
      },
      {
        id: "army_runs_plants",
        when: {
          kind: "memory",
          key: "k_krob_shells",
        },
        tell: ["shells:+1", "order:-1", "war:+1"],
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
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_plants_army",
          },
        ],
      },
      {
        id: "ask_krupp",
        tell: ["shells:+1", "berlin:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "shells",
            delta: 1,
          },
          ...DEBT_UP,
          {
            kind: "remember",
            key: "auh_krupp_shells",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_bread_cards",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
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
      chancellor: {
        office: "chancellor",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "riot",
        when: {
          kind: "world",
          of: {
            is: "unrest",
            min: 1,
          },
        },
      },
      {
        id: "sour",
        when: {
          kind: "inst",
          inst: HUNGARY,
          max: -1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "cards_in_austria",
    options: [
      {
        id: "cards_in_austria",
        tell: ["bread:+1", "hungary:+1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_cards_austria",
          },
        ],
      },
      {
        id: "cards_everywhere",
        when: {
          kind: "memory",
          key: "k_stu_grain",
        },
        tell: ["bread:+1", "order:+1", "hungary:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
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
          {
            kind: "remember",
            key: "auh_price_cap",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_grain_border",
    nation: ["AUH"],
    kind: "dispute",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "17b"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
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
      hun_pm: {
        office: "hun_pm",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    cooldown: 6,
    variants: [
      {
        id: "karolyi",
        when: {
          kind: "holder",
          office: "hun_pm",
          person: "auh_karolyi",
        },
      },
      {
        id: "wekerle",
        when: {
          kind: "holder",
          office: "hun_pm",
          person: "auh_wekerle",
        },
      },
      {
        id: "exposed",
        when: {
          kind: "flag",
          flag: "f_auh_found_grain",
        },
      },
      {
        id: "again",
        when: {
          kind: "chose",
          scene: "auh_h_grain_border",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "ask_nicely",
    options: [
      {
        id: "ask_nicely",
        tell: ["bread:+1", "hungary:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
        ],
      },
      {
        id: "trade_for_it",
        when: {
          kind: "memory",
          key: "k_tisza_grain",
        },
        tell: ["bread:+1", "money:-1", "hungary:+1", "berlin:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          ...DEBT_DOWN,
          {
            kind: "keep_promise",
            who: {
              person: "auh_tisza",
            },
            key: "tisza_grain",
          },
          {
            kind: "remember",
            key: "auh_grain_traded",
          },
        ],
      },
      {
        id: "order_it",
        when: {
          kind: "memory",
          key: "k_stu_grain",
        },
        tell: ["bread:+2", "hungary:-3", "hun_pm:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 2,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -3,
          },
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "auh_grain_ordered",
          },
        ],
      },
      {
        id: "expose_stocks",
        when: {
          kind: "memory",
          key: "k_land_days",
        },
        tell: ["hungary:-2", "order:+1"],
        effects: [
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "maybe",
            when: GRAIN_HIDDEN,
            then: [
              {
                kind: "gauge",
                gauge: "bread",
                delta: 2,
              },
              {
                kind: "flag",
                flag: "f_auh_found_grain",
              },
              {
                kind: "reason",
                key: "h_grain_exposed_r1",
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "not",
              of: GRAIN_HIDDEN,
            },
            then: [
              {
                kind: "gauge",
                gauge: "bread",
                delta: 1,
              },
              {
                kind: "reason",
                key: "h_grain_exposed_r2",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_refugees",
    nation: ["AUH"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "all",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            EAST_SLIPPING,
          ],
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["home"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "second",
        when: during("15b", "15b"),
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_h_italy_offer",
    nation: ["AUH"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
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
              kind: "at_war",
              tag: "RUS",
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      hun_pm: {
        office: "hun_pm",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "berlin",
        when: {
          kind: "all",
          of: [
            IN_DEBT,
            {
              kind: "chose",
              scene: "auh_w_german_command",
            },
          ],
        },
      },
      {
        id: "slipping",
        when: EAST_SLIPPING,
      },
      {
        id: "known",
        when: {
          kind: "world",
          of: {
            is: "known",
            id: "ita_fra_understanding",
          },
        },
      },
      {
        id: "sold_rumour",
        when: {
          kind: "any",
          of: [
            {
              kind: "pressure",
              topic: "balkan",
              min: 4,
            },
            {
              kind: "gauge",
              gauge: "morale",
              max: 2,
            },
          ],
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
        tell: ["ita:-1", "hun_pm:+1", "cos:+1"],
        effects: [
          {
            kind: "trust",
            tag: "ITA",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
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
            kind: "world",
            of: {
              do: "readiness",
              tag: "ITA",
              delta: 15,
            },
          },
        ],
      },
      {
        id: "after_the_war",
        when: {
          kind: "memory",
          key: "k_bur_rome",
        },
        tell: ["ita:+1", "hungary:-1"],
        effects: [
          {
            kind: "trust",
            tag: "ITA",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "offer",
              tag: "ITA",
              value: 3,
            },
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ITA",
              delta: -15,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_trentino_promised",
          },
        ],
      },
      {
        id: "hand_over_now",
        when: {
          kind: "memory",
          key: "k_ber_trentino",
        },
        tell: ["ita:+2", "hungary:-2", "cos:-2"],
        effects: [
          {
            kind: "trust",
            tag: "ITA",
            delta: 2,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
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
              do: "offer",
              tag: "ITA",
              value: 5,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_trentino_sold",
          },
          {
            kind: "world",
            of: {
              do: "letter",
              who: {
                role: "cos",
              },
            },
          },
          {
            kind: "maybe",
            when: {
              kind: "not",
              of: {
                kind: "secret",
                id: "ita_fra_understanding",
              },
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "readiness",
                  tag: "ITA",
                  delta: -60,
                },
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "secret",
              id: "ita_fra_understanding",
            },
            then: [
              {
                kind: "world",
                of: {
                  do: "readiness",
                  tag: "ITA",
                  delta: -25,
                },
              },
              {
                kind: "reason",
                key: "h_italy_sold_r1",
              },
            ],
          },
        ],
      },
      {
        id: "ask_berlin_pay",
        tell: ["ita:+1", "berlin:+1"],
        effects: [
          {
            kind: "trust",
            tag: "ITA",
            delta: 1,
          },
          ...DEBT_UP,
          {
            kind: "world",
            of: {
              do: "offer",
              tag: "ITA",
              value: 2,
            },
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ITA",
              delta: -10,
            },
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_romania_offer",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["y1914", "war"],
    when: {
      kind: "all",
      of: [
        during("14", "16a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "entered",
                  tag: "ROU",
                },
              },
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 7,
    tags: ["foreign"],
    cooldown: 6,
    variants: [
      {
        id: "dead",
        when: {
          kind: "all",
          of: [
            {
              kind: "secret",
              id: "rou_treaty_dead",
            },
            {
              kind: "world",
              of: {
                is: "known",
                id: "rou_treaty_dead",
              },
            },
          ],
        },
      },
      {
        id: "king_gone",
        when: {
          kind: "chapter",
          min: 9,
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
        tell: ["rou:+1"],
        effects: [
          {
            kind: "trust",
            tag: "ROU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "offer",
              tag: "ROU",
              value: 1,
            },
          },
        ],
      },
      {
        id: "bukovina_slice",
        when: {
          kind: "memory",
          key: "k_cz_king",
        },
        tell: ["rou:+2", "nations:-1"],
        effects: [
          {
            kind: "trust",
            tag: "ROU",
            delta: 2,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "offer",
              tag: "ROU",
              value: 3,
            },
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ROU",
              delta: -25,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_bukovina_offered",
          },
        ],
      },
      {
        id: "cultural_rights",
        when: {
          kind: "memory",
          key: "k_tisza_romania",
        },
        tell: ["rou:+1", "nations:+1", "hungary:-1"],
        effects: [
          {
            kind: "trust",
            tag: "ROU",
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "offer",
              tag: "ROU",
              value: 2,
            },
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ROU",
              delta: -15,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_rou_rights",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_transylvania",
    nation: ["AUH"],
    kind: "dispute",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "16a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            {
              kind: "pressure",
              topic: "balkan",
              min: 2,
            },
          ],
        },
      ],
    },
    cast: {
      hun_pm: {
        office: "hun_pm",
      },
      fm: {
        office: "foreign",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "rights",
        when: {
          kind: "flag",
          flag: "f_auh_rou_rights",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "nothing",
    options: [
      {
        id: "nothing",
        tell: ["hungary:+1", "nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
        ],
      },
      {
        id: "schools_and_church",
        when: {
          kind: "memory",
          key: "k_tisza_romania",
        },
        tell: ["nations:+1", "hungary:-1", "rou:+1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "trust",
            tag: "ROU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ROU",
              delta: -10,
            },
          },
          {
            kind: "flag",
            flag: "f_auh_rou_rights",
          },
        ],
      },
      {
        id: "autonomy_word",
        when: {
          kind: "memory",
          key: "k_cz_price",
        },
        tell: ["nations:+2", "hungary:-3", "rou:+1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 2,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -3,
          },
          {
            kind: "trust",
            tag: "ROU",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "readiness",
              tag: "ROU",
              delta: -20,
            },
          },
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
            delta: -1,
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_poland_crown",
    nation: ["AUH"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
        {
          kind: "all",
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
              kind: "not",
              of: {
                kind: "chose",
                scene: "auh_h_poland_crown",
                pick: "claim_for_house",
              },
            },
            {
              kind: "not",
              of: {
                kind: "chose",
                scene: "auh_h_poland_crown",
                pick: "trade_with_berlin",
              },
            },
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      finance: {
        office: "finance",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 8,
    tags: ["foreign"],
    cooldown: 8,
    variants: [
      {
        id: "german_no",
        when: {
          kind: "any",
          of: [
            {
              kind: "trust",
              tag: "DEU",
              max: -1,
            },
            during("16a", "16b"),
          ],
        },
      },
      {
        id: "rejected",
        when: {
          kind: "chose",
          scene: "auh_h_poland_crown",
        },
      },
      {
        id: "trade",
        when: IN_DEBT,
      },
      {
        id: "base",
      },
    ],
    fallback: "leave_to_later",
    options: [
      {
        id: "leave_to_later",
        tell: ["hun_pm:+1", "nations:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_poland_left",
          },
        ],
      },
      {
        id: "claim_for_house",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_bil_crown",
            },
            {
              kind: "memory",
              key: "k_bil_poland",
            },
          ],
        },
        tell: ["nations:+2", "hungary:-2", "deu:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 2,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_bilinski",
            },
            key: "bil_galicia",
          },
          {
            kind: "flag",
            flag: "f_auh_poland_claimed",
          },
        ],
      },
      {
        id: "trade_with_berlin",
        when: {
          kind: "memory",
          key: "k_bur_poland",
        },
        tell: ["deu:+1", "nations:-1", "berlin:-1"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          ...DEBT_DOWN,
          {
            kind: "keep_promise",
            who: {
              person: "auh_bilinski",
            },
            key: "bil_galicia",
          },
          {
            kind: "flag",
            flag: "f_auh_poland_traded",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_nov_act",
    nation: ["AUH"],
    kind: "wire",
    stage: ["war"],
    when: during("16b", "16b"),
    cast: {},
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "claimed",
        when: {
          kind: "chose",
          scene: "auh_h_poland_crown",
          pick: "claim_for_house",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_h_legion_oath",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "17b"),
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "auh_h_nov_act",
            },
            {
              kind: "memory",
              key: "k_pil_terms",
            },
          ],
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      fm: {
        office: "foreign",
      },
    },
    salience: 6,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "terms",
        when: {
          kind: "memory",
          key: "k_pil_terms",
        },
      },
      {
        id: "german_army",
        when: IN_DEBT,
      },
      {
        id: "base",
      },
    ],
    fallback: "hand_to_germans",
    options: [
      {
        id: "hand_to_germans",
        tell: ["berlin:-1", "nations:-1"],
        effects: [
          ...DEBT_DOWN,
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_legions_handed",
          },
        ],
      },
      {
        id: "own_oath",
        when: {
          kind: "memory",
          key: "k_pil_terms",
        },
        tell: ["nations:+1", "deu:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_oath_own",
          },
        ],
      },
      {
        id: "let_him_go",
        tell: ["nations:-1", "cos:+1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
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
            kind: "remember",
            key: "auh_legions_scattered",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_bohemia_rule",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["y1914", "war"],
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
      chancellor: {
        office: "chancellor",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "after_28",
        when: {
          kind: "seen",
          scene: "auh_h_regiment28",
        },
      },
      {
        id: "thun",
        when: during("15a", "15a"),
      },
      {
        id: "base",
      },
    ],
    fallback: "let_army",
    options: [
      {
        id: "let_army",
        tell: ["cos:+1", "chancellor:-1", "nations:-2", "order:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_bohemia_army",
          },
        ],
      },
      {
        id: "civil_stays",
        when: {
          kind: "memory",
          key: "k_stu_bohemia",
        },
        tell: ["chancellor:+1", "cos:-1", "nations:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
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
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_bohemia_civil",
          },
        ],
      },
      {
        id: "one_governor",
        tell: ["nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_coudenhove",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_kramar_arrest",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      war: {
        office: "war",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "promised",
        when: {
          kind: "promise",
          who: {
            person: "auh_kramar",
          },
          key: "kra_word",
        },
      },
      {
        id: "slipping",
        when: EAST_SLIPPING,
      },
      {
        id: "base",
      },
    ],
    fallback: "leave_to_court",
    options: [
      {
        id: "leave_to_court",
        tell: ["war:+1", "nations:-2"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -2,
          },
          {
            kind: "remember",
            key: "auh_kramar_arrested",
          },
          {
            kind: "flag",
            flag: "f_auh_kramar_held",
          },
        ],
      },
      {
        id: "watch_only",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kra_word",
            },
            {
              kind: "memory",
              key: "k_stu_bohemia",
            },
          ],
        },
        tell: ["war:-1", "nations:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_kramar",
            },
            key: "kra_word",
          },
          {
            kind: "remember",
            key: "auh_kramar_watched",
          },
        ],
      },
      {
        id: "ask_him_first",
        tell: ["war:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_kramar_asked",
          },
          {
            kind: "schedule",
            scene: "auh_h_kramar_again",
            chapters: 3,
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_kramar_again",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    cast: {
      chancellor: {
        office: "chancellor",
      },
      war: {
        office: "war",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    scheduledOnly: true,
    variants: [
      {
        id: "base",
      },
    ],
    fallback: "file_it",
    options: [
      {
        id: "file_it",
        tell: ["war:-1", "nations:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_kramar",
            },
            key: "kra_word",
          },
        ],
      },
      {
        id: "to_court_now",
        tell: ["war:+1", "nations:-2"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_auh_kramar_held",
          },
        ],
      },
      {
        id: "send_to_prague",
        tell: ["nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_kramar_bound",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_kramar_verdict",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16a", "16b"),
        {
          kind: "flag",
          flag: "f_auh_kramar_held",
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      court: {
        office: "court",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "second_look",
        when: {
          kind: "memory",
          key: "k_kra_prison",
        },
      },
      {
        id: "lost_war",
        when: EAST_SLIPPING,
      },
      {
        id: "base",
      },
    ],
    fallback: "commute",
    options: [
      {
        id: "commute",
        tell: ["nations:+1", "war:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              office: "war",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_kramar_commuted",
          },
        ],
      },
      {
        id: "hold_for_later",
        when: {
          kind: "memory",
          key: "k_kra_prison",
        },
        tell: ["nations:+1", "cos:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
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
            key: "auh_kramar_held_over",
          },
        ],
      },
      {
        id: "pardon_now",
        when: {
          kind: "memory",
          key: "k_kra_prison",
        },
        tell: ["nations:+3", "war:-2", "cos:-2"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 3,
          },
          {
            kind: "person_trust",
            who: {
              office: "war",
            },
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              office: "chief_of_staff",
            },
            delta: -2,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_kramar",
            },
            key: "kra_word",
          },
          {
            kind: "remember",
            key: "auh_kramar_pardoned",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_regiment28",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "all",
          of: [
            {
              kind: "at_war",
              tag: "RUS",
            },
            {
              kind: "inst",
              inst: NATIONS,
              max: 0,
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
    salience: 6,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "found",
        when: {
          kind: "flag",
          flag: "f_auh_found_czechs",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "strike_it_off",
    options: [
      {
        id: "strike_it_off",
        tell: ["cos:+1", "nations:-2"],
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
            inst: NATIONS,
            delta: -2,
          },
          {
            kind: "flag",
            flag: "f_auh_ir28_struck",
          },
          {
            kind: "maybe",
            when: CZECHS_SOUND,
            then: [
              {
                kind: "reason",
                key: "h_regiment_r1",
              },
            ],
          },
        ],
      },
      {
        id: "inquire_first",
        when: {
          kind: "memory",
          key: "k_kra_regiment",
        },
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
            kind: "flag",
            flag: "f_auh_found_czechs",
          },
          {
            kind: "maybe",
            when: CZECHS_SOUND,
            then: [
              {
                kind: "inst",
                inst: NATIONS,
                delta: 1,
              },
              {
                kind: "reason",
                key: "h_regiment_r2",
              },
            ],
          },
          {
            kind: "maybe",
            when: {
              kind: "not",
              of: CZECHS_SOUND,
            },
            then: [
              {
                kind: "reason",
                key: "h_regiment_r3",
              },
            ],
          },
        ],
      },
      {
        id: "keep_the_colours",
        when: {
          kind: "memory",
          key: "k_kra_regiment",
        },
        tell: ["cos:-2", "nations:+1", "morale:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -2,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_ir28_kept",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_language_order",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            {
              kind: "inst",
              inst: NATIONS,
              max: 0,
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
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "reserve",
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
    fallback: "as_it_is",
    options: [
      {
        id: "as_it_is",
        tell: ["cos:+1", "morale:-1"],
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
        ],
      },
      {
        id: "mother_tongue_officers",
        when: {
          kind: "memory",
          key: "k_krob_lang",
        },
        tell: ["nations:+2", "cos:-1", "morale:+1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 2,
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
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_officers_tongue",
          },
        ],
      },
      {
        id: "interpreters",
        tell: ["morale:+1", "manpower:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "morale",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: -2,
            },
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_factory_law",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
        {
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
                is: "unrest",
                min: 0,
              },
            },
          ],
        },
      ],
    },
    cast: {
      war: {
        office: "war",
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
        id: "strike",
        when: {
          kind: "world",
          of: {
            is: "unrest",
            min: 1,
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "army_rule",
    options: [
      {
        id: "army_rule",
        tell: ["shells:+1", "order:-1"],
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
            kind: "keep_promise",
            who: {
              person: "auh_boroevic",
            },
            key: "bor_boots",
          },
        ],
      },
      {
        id: "complaints_board",
        when: {
          kind: "memory",
          key: "k_adl_factory",
        },
        tell: ["order:+1", "war:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_boroevic",
            },
            key: "bor_boots",
          },
          {
            kind: "flag",
            flag: "f_auh_complaints_board",
          },
        ],
      },
      {
        id: "pay_bonus",
        tell: ["order:+1", "money:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
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
    id: "auh_h_manpower",
    nation: ["AUH"],
    kind: "dispute",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16a", "17a"),
        {
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
                is: "manpower",
                max: 40,
              },
            },
          ],
        },
      ],
    },
    cast: {
      war: {
        office: "war",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "low",
        when: {
          kind: "world",
          of: {
            is: "manpower",
            max: 25,
          },
        },
      },
      {
        id: "sour",
        when: {
          kind: "inst",
          inst: HUNGARY,
          max: -1,
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "call_older",
    options: [
      {
        id: "call_older",
        tell: ["manpower:+10", "bread:-1", "hungary:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: 10,
            },
          },
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_called_older",
          },
        ],
      },
      {
        id: "exempt_harvest",
        when: {
          kind: "memory",
          key: "k_krob_men",
        },
        tell: ["manpower:+5", "hungary:+1", "war:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: 5,
            },
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "war",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "call_only_austria",
        tell: ["manpower:+5", "hungary:+1", "nations:-2", "order:-1"],
        effects: [
          {
            kind: "world",
            of: {
              do: "manpower",
              delta: 5,
            },
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -2,
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
    id: "auh_h_mitteleuropa",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "17b"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            IN_DEBT,
          ],
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 7,
    tags: ["foreign"],
    cooldown: 8,
    variants: [
      {
        id: "traded",
        when: {
          kind: "flag",
          flag: "f_auh_poland_traded",
        },
      },
      {
        id: "naumann",
        when: during("15b", "15b"),
      },
      {
        id: "base",
      },
    ],
    fallback: "study",
    options: [
      {
        id: "study",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "auh_zoll_studied",
          },
        ],
      },
      {
        id: "sign_customs",
        tell: ["berlin:+1", "money:+1", "shells:+1", "hungary:-1"],
        effects: [
          ...DEBT_UP,
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
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_customs_signed",
          },
        ],
      },
      {
        id: "refuse",
        when: {
          kind: "memory",
          key: "k_hoyos_zoll",
        },
        tell: ["deu:-2", "hungary:+1"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: -2,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_karolyi",
            },
            key: "kar_peace",
          },
          {
            kind: "remember",
            key: "auh_zoll_refused",
          },
        ],
      },
      {
        id: "slow_walk",
        when: {
          kind: "memory",
          key: "k_hoyos_zoll",
        },
        tell: ["deu:-1"],
        effects: [
          {
            kind: "trust",
            tag: "DEU",
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_zoll_slowed",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_serbia_rule",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
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
    cast: {
      fm: {
        office: "foreign",
      },
      hun_pm: {
        office: "hun_pm",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "sworn",
        when: {
          kind: "chose",
          scene: "auh_c_no_annex",
          pick: "swear",
        },
      },
      {
        id: "no_oath",
        when: {
          kind: "chose",
          scene: "auh_c_no_annex",
          pick: "keep_open",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "occupation",
    options: [
      {
        id: "occupation",
        tell: ["hun_pm:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "hun_pm",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "auh_serbia_held",
          },
        ],
      },
      {
        id: "annex_part",
        tell: ["cos:+1", "hungary:-3", "nations:-1", "rus:-1"],
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
            inst: HUNGARY,
            delta: -3,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "trust",
            tag: "RUS",
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_serbia_annexed",
          },
        ],
      },
      {
        id: "restore_small",
        when: {
          kind: "memory",
          key: "k_bur_serbia",
        },
        tell: ["cos:-1", "hungary:+1", "nations:+1"],
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
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_serbia_small",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_reichsrat_call",
    nation: ["AUH"],
    kind: "dispute",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            OLD_EMPEROR,
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
    salience: 8,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "promised",
        when: {
          kind: "promise",
          who: {
            person: "auh_adler",
          },
          key: "adl_open",
        },
      },
      {
        id: "unrest",
        when: {
          kind: "world",
          of: {
            is: "unrest",
            min: 1,
          },
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "stay_shut",
    options: [
      {
        id: "stay_shut",
        tell: ["chancellor:+1", "nations:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_reichsrat_shut",
          },
        ],
      },
      {
        id: "open_it",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_stu_open",
            },
            {
              kind: "memory",
              key: "k_adl_open",
            },
          ],
        },
        tell: ["nations:+2", "order:-1", "chancellor:-2"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -2,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_sturgkh",
            },
            key: "stu_open",
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_adler",
            },
            key: "adl_open",
          },
          {
            kind: "flag",
            flag: "f_auh_reichsrat_open",
          },
          {
            kind: "flag",
            flag: "f_auh_sign_austria",
          },
        ],
      },
      {
        id: "open_delegations",
        tell: ["nations:+1", "hungary:-1"],
        effects: [
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_delegations_called",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_sturgkh_shot",
    nation: ["AUH"],
    kind: "report",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "16b"),
        {
          kind: "flag",
          flag: "w_auh_sturgkh_shot",
        },
      ],
    },
    cast: {},
    salience: 8,
    tags: ["home", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      {
        id: "opened",
        when: {
          kind: "flag",
          flag: "f_auh_reichsrat_open",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "auh_h_adler_trial",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "17a"),
        {
          kind: "seen",
          scene: "auh_h_sturgkh_shot",
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "son",
        when: {
          kind: "memory",
          key: "k_adl_son",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "open_court",
    options: [
      {
        id: "open_court",
        tell: ["order:-1", "nations:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 1,
          },
          {
            kind: "remember",
            key: "auh_adler_open",
          },
        ],
      },
      {
        id: "closed_court",
        tell: ["order:+1", "nations:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_adler_closed",
          },
        ],
      },
      {
        id: "spare_him",
        when: {
          kind: "memory",
          key: "k_adl_son",
        },
        tell: ["order:+1", "chancellor:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_adler",
            },
            delta: 2,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "remember",
            key: "auh_adler_spared",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_strike_1",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "18b"),
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
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 7,
    tags: ["home", "tension_up"],
    cooldown: 6,
    variants: [
      {
        id: "again",
        when: {
          kind: "chose",
          scene: "auh_h_strike_1",
        },
      },
      {
        id: "shells",
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
    fallback: "promise_flour",
    options: [
      {
        id: "promise_flour",
        tell: ["bread:-1", "order:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
        ],
      },
      {
        id: "army_in_plants",
        tell: ["shells:+1", "order:-1"],
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
            kind: "remember",
            key: "auh_strike_army",
          },
        ],
      },
      {
        id: "talk_to_party",
        when: {
          kind: "memory",
          key: "k_adl_pulse",
        },
        tell: ["order:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "person_trust",
            who: {
              person: "auh_adler",
            },
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_party_called",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_riots_2",
    nation: ["AUH"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "18b"),
        {
          kind: "world",
          of: {
            is: "unrest",
            min: 2,
          },
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
      hun_pm: {
        office: "hun_pm",
      },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    cooldown: 6,
    variants: [
      {
        id: "hungary",
        when: {
          kind: "inst",
          inst: HUNGARY,
          max: -2,
        },
      },
      {
        id: "again",
        when: {
          kind: "chose",
          scene: "auh_h_riots_2",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "open_stores",
    options: [
      {
        id: "open_stores",
        tell: ["bread:-1", "order:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
        ],
      },
      {
        id: "hungary_must_send",
        tell: ["bread:+1", "hungary:-2", "order:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
        ],
      },
      {
        id: "talk_to_party",
        when: {
          kind: "memory",
          key: "k_adl_strike",
        },
        tell: ["order:+1", "chancellor:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -1,
          },
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
          {
            kind: "flag",
            flag: "f_auh_party_called",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_unrest_3",
    nation: ["AUH"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("17a", "18b"),
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
      war: {
        office: "war",
      },
      cos: {
        office: "chief_of_staff",
      },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    cooldown: 6,
    variants: [
      {
        id: "returned",
        when: {
          kind: "world",
          of: {
            is: "out",
            tag: "RUS",
          },
        },
      },
      {
        id: "again",
        when: {
          kind: "chose",
          scene: "auh_h_unrest_3",
        },
      },
      {
        id: "base",
      },
    ],
    fallback: "hold_garrison",
    options: [
      {
        id: "hold_garrison",
        tell: ["bread:-1", "morale:-1"],
        effects: [
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
          {
            kind: "world",
            of: {
              do: "calm",
            },
          },
        ],
      },
      {
        id: "send_home_units",
        tell: ["order:+1", "nations:-2", "shells:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -2,
          },
          {
            kind: "gauge",
            gauge: "shells",
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_units_swapped",
          },
        ],
      },
      {
        id: "national_units",
        when: {
          kind: "memory",
          key: "k_krob_lang",
        },
        tell: ["order:+1", "nations:+2", "cos:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: 2,
          },
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
              do: "calm",
            },
          },
          {
            kind: "flag",
            flag: "f_auh_national_units",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_food_committee",
    nation: ["AUH"],
    kind: "proposal",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("17a", "18a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
            },
            {
              kind: "gauge",
              gauge: "bread",
              max: 1,
            },
            KARL,
          ],
        },
      ],
    },
    cast: {
      hun_pm: {
        office: "hun_pm",
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
        id: "tisza",
        when: {
          kind: "holder",
          office: "hun_pm",
          person: "auh_tisza",
        },
      },
      {
        id: "empty",
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
    fallback: "advice_only",
    options: [
      {
        id: "advice_only",
        tell: ["hungary:+1"],
        effects: [
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
        ],
      },
      {
        id: "real_powers",
        when: {
          kind: "memory",
          key: "k_land_days",
        },
        tell: ["bread:+1", "order:+1", "hungary:-2"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "keep_promise",
            who: {
              person: "auh_boroevic",
            },
            key: "bor_boots",
          },
          {
            kind: "flag",
            flag: "f_auh_food_powers",
          },
        ],
      },
      {
        id: "army_requisition",
        tell: ["bread:+1", "hungary:-1", "order:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "bread",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -1,
          },
          {
            kind: "gauge",
            gauge: "order",
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_grain_requisition",
          },
        ],
      },
    ],
  },
  {
    id: "auh_h_peace_ausgleich",
    nation: ["AUH"],
    kind: "crisis",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16a", "17b"),
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "war",
            },
          },
        },
      ],
    },
    cast: {
      hun_pm: {
        office: "hun_pm",
      },
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 8,
    tags: ["home", "tension_up"],
    once: true,
    variants: [
      {
        id: "ff",
        when: {
          kind: "opening",
          of: ["sarajevo_survived", "sarajevo_failed", "no_sarajevo"],
        },
      },
      {
        id: "karl",
        when: KARL,
      },
      {
        id: "base",
      },
    ],
    fallback: "renew_as_is",
    options: [
      {
        id: "renew_as_is",
        tell: ["hungary:+1", "chancellor:-1"],
        effects: [
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "auh_ausgleich_renewed",
          },
        ],
      },
      {
        id: "raise_quota",
        when: {
          kind: "memory",
          key: "k_koer_quota",
        },
        tell: ["money:+1", "hungary:-2", "chancellor:+1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "inst",
            inst: HUNGARY,
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: 1,
          },
          {
            kind: "flag",
            flag: "f_auh_quota_raised",
          },
        ],
      },
      {
        id: "ten_years_more",
        when: {
          kind: "memory",
          key: "k_tisza_terms",
        },
        tell: ["hungary:+2", "nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: HUNGARY,
            delta: 2,
          },
          {
            kind: "inst",
            inst: NATIONS,
            delta: -1,
          },
          {
            kind: "flag",
            flag: "f_auh_ausgleich_ten",
          },
        ],
      },
    ],
  },
  {
    id: "auh_t_tisza_terms",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis"],
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
      p: {
        person: "auh_tisza",
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
            next: "terms",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "lecture",
                effects: [],
              },
            ],
          },
          {
            id: "press",
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
                    kind: "inst",
                    inst: HUNGARY,
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_tisza_terms_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["cos:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "auh_no_land_offered",
              },
              {
                kind: "mood",
                delta: 1,
              },
            ],
            next: "terms",
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
      lecture: {
        says: [
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
            next: "terms",
          },
          {
            id: "cut",
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
      terms: {
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
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_terms",
              },
            ],
            next: "noted",
          },
          {
            id: "trade",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [],
            next: "haggle",
          },
          {
            id: "on_conrad",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_conrad",
          },
          {
            id: "no",
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
      haggle: {
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
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_terms",
              },
            ],
            next: "noted",
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
      noted: {
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
      on_conrad: {
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
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_terms",
              },
            ],
            next: "noted",
          },
          {
            id: "enough",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_terms",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_t_tisza_wait",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis"],
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
      p: {
        person: "auh_tisza",
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
            next: "why",
          },
          {
            id: "fear",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "mood",
                delta: 1,
              },
            ],
            next: "close",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "pity",
                effects: [],
              },
            ],
          },
          {
            id: "sting",
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
            next: "answer",
            gain: [
              {
                kind: "remember",
                key: "k_tisza_wait",
              },
            ],
            miss: "stiff",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["delay:7"],
            effects: [
              {
                kind: "delay",
                days: 7,
              },
              {
                kind: "remember",
                key: "k_tisza_wait",
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_wait",
              },
            ],
            next: "done",
          },
          {
            id: "on_ber",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_ber",
          },
          {
            id: "berlin",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "berlin",
          },
        ],
      },
      berlin: {
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
                kind: "remember",
                key: "k_tisza_wait",
              },
            ],
            next: null,
          },
        ],
      },
      close: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
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
              {
                kind: "remember",
                key: "k_tisza_wait",
              },
            ],
            next: null,
          },
        ],
      },
      pity: {
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
                key: "t_tisza_wait_r1",
              },
            ],
            next: null,
          },
        ],
      },
      answer: {
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      on_ber: {
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
            id: "enough",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_wait",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_t_tisza_romania",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: during("C", "15b"),
    cast: {
      p: {
        person: "auh_tisza",
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
            id: "war",
            when: {
              kind: "world",
              of: {
                is: "war",
              },
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
            next: "want",
          },
          {
            id: "press",
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
            next: "narrow",
            gain: [
              {
                kind: "remember",
                key: "k_tisza_romania",
              },
            ],
            miss: "stiff",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:+1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_tisza_romania",
              },
            ],
            next: "want",
          },
          {
            id: "rome",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "flat",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "want",
                effects: [
                  {
                    kind: "mood",
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
      want: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_romania",
              },
            ],
            next: "limit",
          },
          {
            id: "on_karolyi",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_karolyi",
          },
          {
            id: "more",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
        ],
      },
      limit: {
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
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      narrow: {
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
      flat: {
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
            effects: [],
            next: null,
          },
        ],
      },
      on_karolyi: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_romania",
              },
            ],
            next: "limit",
          },
          {
            id: "enough",
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
    id: "auh_t_tisza_grain",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "17a"),
        {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "war",
              },
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
      p: {
        person: "auh_tisza",
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
            id: "karl",
            when: KARL,
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stock",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "stock_true",
                effects: [],
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
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
            ],
            next: "offended",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["cold"],
                },
                next: "stock",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "tisza_grain",
                chapters: 6,
                keep: {
                  kind: "chose",
                  scene: "auh_h_grain_border",
                  pick: "trade_for_it",
                },
                back: "auh_v_tisza_promise",
              },
              {
                kind: "remember",
                key: "k_tisza_grain",
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
      stock: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hedge",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_grain",
              },
            ],
            next: null,
          },
        ],
      },
      stock_true: {
        says: [
          {
            id: "hidden",
            when: GRAIN_HIDDEN,
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "thanks",
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
              {
                kind: "remember",
                key: "k_tisza_grain",
              },
              {
                kind: "maybe",
                when: GRAIN_HIDDEN,
                then: [
                  {
                    kind: "flag",
                    flag: "f_auh_found_grain",
                  },
                ],
              },
            ],
            next: "trade",
          },
          {
            id: "use",
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
              {
                kind: "remember",
                key: "k_tisza_grain",
              },
              {
                kind: "maybe",
                when: GRAIN_HIDDEN,
                then: [
                  {
                    kind: "flag",
                    flag: "f_auh_found_grain",
                  },
                ],
              },
            ],
            next: "offended",
          },
        ],
      },
      hedge: {
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
                kind: "remember",
                key: "k_tisza_grain",
              },
            ],
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
            id: "on_vienna",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_vienna",
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
      trade: {
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
      offended: {
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
      on_vienna: {
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
            id: "enough",
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
    id: "auh_t_tisza_oath",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: during("16a", "17a"),
    cast: {
      p: {
        person: "auh_tisza",
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
            id: "ff",
            when: FF_THRONE,
          },
          {
            id: "karl",
            when: KARL,
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
            id: "hard",
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
            next: "threat_back",
            gain: [
              {
                kind: "remember",
                key: "k_tisza_oath",
              },
            ],
            miss: "stiff",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_tisza_oath",
              },
            ],
            next: "clause",
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "know",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_oath",
              },
            ],
            next: "plain",
          },
          {
            id: "on_koerber",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_koerber",
          },
          {
            id: "clause2",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_oath",
              },
            ],
            next: "before",
          },
        ],
      },
      before: {
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
      clause: {
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
      threat_back: {
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
            effects: [],
            next: null,
          },
        ],
      },
      on_koerber: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "before",
          },
          {
            id: "enough",
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
    id: "auh_t_tisza_franchise",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [during("16b", "17b"), KARL],
    },
    cast: {
      p: {
        person: "auh_tisza",
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
            next: "reason",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_tisza_franchise",
              },
            ],
            next: "medal",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -2,
              },
            ],
            next: "door",
            gain: [
              {
                kind: "remember",
                key: "k_tisza_franchise",
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
      reason: {
        says: [
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
                key: "k_tisza_franchise",
              },
            ],
            next: "stand",
          },
          {
            id: "on_karolyi",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_karolyi",
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
      stand: {
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
      medal: {
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
      door: {
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
      on_karolyi: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_franchise",
              },
            ],
            next: "stand",
          },
          {
            id: "enough",
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
    id: "auh_t_bur_between",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis"],
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
      p: {
        person: "auh_burian",
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
          },
          {
            id: "press",
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
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "formal",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:+1"],
            effects: [
              {
                kind: "audiences",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bur_tisza",
              },
              {
                kind: "remember",
                key: "auh_burian_between",
              },
            ],
            next: "how",
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
            id: "grain",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_tisza",
              },
            ],
            next: "grain",
          },
          {
            id: "on_ber",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_ber",
          },
          {
            id: "temper",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "temper",
          },
        ],
      },
      formal: {
        says: [
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
      grain: {
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
      temper: {
        says: [
          {
            id: "stub",
            when: {
              kind: "temperament",
              who: {
                person: "auh_tisza",
              },
              of: ["stubborn"],
            },
          },
          {
            id: "arr",
            when: {
              kind: "temperament",
              who: {
                person: "auh_tisza",
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_tisza",
              },
            ],
            next: null,
          },
        ],
      },
      on_ber: {
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
            id: "enough",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_tisza",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_t_bur_rome",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15a"),
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
      ],
    },
    cast: {
      p: {
        person: "auh_burian",
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
            next: "time",
          },
          {
            id: "real",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "real",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "truth",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["hungary:+1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bur_rome",
              },
            ],
            next: "time",
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
      time: {
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
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_rome",
              },
            ],
            next: "write",
          },
          {
            id: "on_conrad",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_conrad",
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
      real: {
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
      truth: {
        says: [
          {
            id: "known",
            when: {
              kind: "secret",
              id: "ita_fra_understanding",
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
              {
                kind: "remember",
                key: "k_bur_rome",
              },
              {
                kind: "maybe",
                when: {
                  kind: "secret",
                  id: "ita_fra_understanding",
                },
                then: [
                  {
                    kind: "world",
                    of: {
                      do: "reveal",
                      id: "ita_fra_understanding",
                    },
                  },
                ],
              },
            ],
            next: null,
          },
        ],
      },
      write: {
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
      on_conrad: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_rome",
              },
            ],
            next: "write",
          },
          {
            id: "enough",
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
    id: "auh_t_bur_serbia",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
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
    cast: {
      p: {
        person: "auh_burian",
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
            id: "sworn",
            when: {
              kind: "chose",
              scene: "auh_c_no_annex",
              pick: "swear",
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
            next: "alive",
          },
          {
            id: "cut",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "oneline",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "protest",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["cos:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_bur_serbia",
              },
            ],
            next: "alive",
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
      alive: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_serbia",
              },
            ],
            next: "end1",
          },
          {
            id: "on_tisza",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_tisza",
          },
          {
            id: "russia",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "russia",
          },
        ],
      },
      russia: {
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
            effects: [
              {
                kind: "remember",
                key: "k_bur_serbia",
              },
            ],
            next: null,
          },
        ],
      },
      oneline: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "more",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "alive",
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
      protest: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "more",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "alive",
          },
        ],
      },
      end1: {
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
      on_tisza: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "enough",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_serbia",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_t_bur_poland",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "16b"),
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
      p: {
        person: "auh_burian",
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
            next: "get",
          },
          {
            id: "hard",
            stance: "cold",
            kind: "push",
            tell: ["deu:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
            ],
            next: "hard",
            gain: [
              {
                kind: "remember",
                key: "k_bur_poland",
              },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["hun_pm:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "hun_pm",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bur_poland",
              },
            ],
            next: "get",
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
      get: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_poland",
              },
            ],
            next: "poles",
          },
          {
            id: "on_czernin",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_czernin",
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
      poles: {
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
      hard: {
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
      on_czernin: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_poland",
              },
            ],
            next: "poles",
          },
          {
            id: "enough",
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
    id: "auh_t_bur_peace",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: during("16b", "18a"),
    cast: {
      p: {
        person: "auh_burian",
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
            id: "karl",
            when: KARL,
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
            next: "accept",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "honest",
                effects: [],
              },
            ],
          },
          {
            id: "soft",
            stance: "warm",
            kind: "push",
            tell: ["deu:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
            ],
            next: "line",
            gain: [
              {
                kind: "remember",
                key: "k_bur_peace",
              },
            ],
            miss: "no_word",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["deu:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_bur_peace",
              },
            ],
            next: "secret",
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
      accept: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "on_czernin",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_czernin",
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
      honest: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_peace",
              },
            ],
            next: "line",
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
      secret: {
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
      no_word: {
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
      on_czernin: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
          },
          {
            id: "enough",
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
    id: "auh_t_bur_wilson",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("18a", "18b"),
        {
          kind: "world",
          of: {
            is: "score",
            max: -10,
          },
        },
      ],
    },
    cast: {
      p: {
        person: "auh_burian",
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
            next: "remain",
          },
          {
            id: "fast",
            stance: "cold",
            kind: "push",
            tell: ["deu:-1"],
            effects: [
              {
                kind: "trust",
                tag: "DEU",
                delta: -1,
              },
            ],
            next: "fast",
            gain: [
              {
                kind: "remember",
                key: "k_bur_wilson",
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
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_bur_wilson",
              },
            ],
            next: "remain",
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
      remain: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bur_wilson",
              },
            ],
            next: "note",
          },
          {
            id: "on_andrassy",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_andrassy",
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
      fast: {
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
      on_andrassy: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "note",
          },
          {
            id: "enough",
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
    id: "auh_t_kra_first",
    nation: ["AUH"],
    kind: "talk",
    stage: ["y1914"],
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
      p: {
        person: "auh_kramar",
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
            next: "song",
          },
          {
            id: "warn",
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
            next: "rebuff",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "rebuff",
                effects: [
                  {
                    kind: "remember",
                    key: "k_kra_met",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["nations:+1", "war:-1"],
            effects: [
              {
                kind: "inst",
                inst: NATIONS,
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  office: "war",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kra_met",
              },
            ],
            next: "open_door",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "flat",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "open_door",
                effects: [
                  {
                    kind: "remember",
                    key: "k_kra_met",
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
      song: {
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
            id: "tell",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_met",
              },
              {
                kind: "mood",
                delta: 1,
              },
            ],
            next: "open_door",
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
      open_door: {
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
      flat: {
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
            next: "song",
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
      rebuff: {
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
    id: "auh_t_kra_word",
    nation: ["AUH"],
    kind: "talk",
    stage: ["y1914", "war"],
    when: {
      kind: "all",
      of: [
        during("14", "15a"),
        {
          kind: "memory",
          key: "k_kra_met",
        },
      ],
    },
    cast: {
      p: {
        person: "auh_kramar",
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
            id: "arrested",
            when: {
              kind: "flag",
              flag: "f_auh_kramar_held",
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
            next: "empire",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "truth",
                effects: [],
              },
            ],
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
            next: "stone",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "kra_word",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "auh_h_kramar_arrest",
                      pick: "watch_only",
                    },
                    {
                      kind: "chose",
                      scene: "auh_h_kramar_again",
                      pick: "file_it",
                    },
                    {
                      kind: "chose",
                      scene: "auh_h_kramar_verdict",
                      pick: "pardon_now",
                    },
                  ],
                },
                back: "auh_v_kra_promise",
              },
              {
                kind: "remember",
                key: "k_kra_word",
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
      empire: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "truth",
          },
          {
            id: "on_sturgkh",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_sturgkh",
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
      truth: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_word",
              },
            ],
            next: "end1",
          },
          {
            id: "anger",
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
              {
                kind: "remember",
                key: "k_kra_word",
              },
            ],
            next: null,
          },
        ],
      },
      end1: {
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
      on_sturgkh: {
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
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "truth",
          },
          {
            id: "enough",
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
    id: "auh_t_kra_regiment",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15a", "15b"),
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_kra_met",
            },
            {
              kind: "seen",
              scene: "auh_h_regiment28",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "auh_kramar",
      },
    },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "held",
        when: {
          kind: "flag",
          flag: "f_auh_kramar_held",
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
            next: "snow",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "letters",
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
                  role: "p",
                },
                delta: -1,
              },
            ],
            next: "accused",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["arrogant"],
                },
                next: "accused",
                effects: [
                  {
                    kind: "inst",
                    inst: NATIONS,
                    delta: -1,
                  },
                  {
                    kind: "reason",
                    key: "t_kra_regiment_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["cos:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kra_regiment",
              },
            ],
            next: "letters",
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
      snow: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_regiment",
              },
            ],
            next: "end1",
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
      letters: {
        says: [
          {
            id: "sound",
            when: CZECHS_SOUND,
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
              {
                kind: "remember",
                key: "k_kra_regiment",
              },
              {
                kind: "maybe",
                when: CZECHS_SOUND,
                then: [
                  {
                    kind: "flag",
                    flag: "f_auh_found_czechs",
                  },
                ],
              },
            ],
            next: null,
          },
        ],
      },
      accused: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "snow",
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
      end1: {
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
    id: "auh_t_kra_prison",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("15b", "17a"),
        {
          kind: "flag",
          flag: "f_auh_kramar_held",
        },
      ],
    },
    cast: {
      p: {
        person: "auh_kramar",
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
            next: "same",
          },
          {
            id: "cold",
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
            next: "refuse",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "refuse",
                effects: [
                  {
                    kind: "reason",
                    key: "t_kra_prison_r1",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["war:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "war",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kra_prison",
              },
            ],
            next: "hand",
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
      same: {
        says: [
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
                key: "k_kra_prison",
              },
            ],
            next: "hand",
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
      hand: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "on_rasin",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_rasin",
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
      refuse: {
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
            effects: [
              {
                kind: "remember",
                key: "k_kra_prison",
              },
            ],
            next: "hand",
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
      on_rasin: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "enough",
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
    id: "auh_t_kra_amnesty",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [during("16b", "17b"), KARL],
    },
    cast: {
      p: {
        person: "auh_kramar",
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
            id: "free",
            when: {
              kind: "any",
              of: [
                {
                  kind: "not",
                  of: {
                    kind: "flag",
                    flag: "f_auh_kramar_held",
                  },
                },
                {
                  kind: "chose",
                  scene: "auh_h_kramar_verdict",
                  pick: "pardon_now",
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "after",
          },
          {
            id: "cond",
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
            next: "no_paper",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["cos:-1", "nations:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chief_of_staff",
                },
                delta: -1,
              },
              {
                kind: "inst",
                inst: NATIONS,
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_kra_amnesty",
              },
            ],
            next: "all",
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
      after: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_amnesty",
              },
            ],
            next: "all",
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
      all: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "on_army",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_army",
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
      no_paper: {
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
      on_army: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "enough",
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
    id: "auh_t_kra_crown",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: during("17a", "18b"),
    cast: {
      p: {
        person: "auh_kramar",
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
            id: "late",
            when: {
              kind: "world",
              of: {
                is: "score",
                max: -15,
              },
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
            id: "press",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "germans",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kra_crown",
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
      crown: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_crown",
              },
            ],
            next: "price",
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
      germans: {
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
            effects: [
              {
                kind: "remember",
                key: "k_kra_crown",
              },
            ],
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
            id: "on_korosec",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_korosec",
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
      on_korosec: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "enough",
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
    id: "auh_t_adl_pulse",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: during("C", "14"),
    cast: {
      p: {
        person: "auh_adler",
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
            id: "war",
            when: {
              kind: "world",
              of: {
                is: "war",
              },
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
            next: "pulse",
          },
          {
            id: "cold",
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
            next: "no",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["chancellor:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chancellor",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_pulse",
              },
            ],
            next: "pulse",
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
      pulse: {
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
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_pulse",
              },
            ],
            next: "figure",
          },
          {
            id: "on_chancellor",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_chancellor",
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
      figure: {
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
      no: {
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
      on_chancellor: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_pulse",
              },
            ],
            next: "figure",
          },
          {
            id: "enough",
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
    id: "auh_t_adl_factory",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
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
      p: {
        person: "auh_adler",
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
            next: "cure",
          },
          {
            id: "cold",
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
            next: "wait",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["weary"],
                },
                next: "wait",
                effects: [
                  {
                    kind: "remember",
                    key: "k_adl_factory",
                  },
                ],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["war:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "war",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_factory",
              },
            ],
            next: "cure",
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
      cure: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_factory",
              },
            ],
            next: "table",
          },
          {
            id: "on_krobatin",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_krobatin",
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
      table: {
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
      wait: {
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
      on_krobatin: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_factory",
              },
            ],
            next: "table",
          },
          {
            id: "enough",
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
    id: "auh_t_adl_open",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [during("15b", "16b"), OLD_EMPEROR],
    },
    cast: {
      p: {
        person: "auh_adler",
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
            next: "first",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "sarcasm",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["weary"],
                },
                next: "first",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["promise"],
            effects: [
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "adl_open",
                chapters: 12,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "auh_h_reichsrat_call",
                      pick: "open_it",
                    },
                    {
                      kind: "seen",
                      scene: "auh_k_reichsrat_opens",
                    },
                  ],
                },
                back: "auh_v_adl_promise",
              },
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
            next: "first",
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
      first: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "son",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
            next: "son",
          },
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
            next: "budget",
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
      sarcasm: {
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
    id: "auh_t_adl_son",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "17a"),
        {
          kind: "flag",
          flag: "w_auh_sturgkh_shot",
        },
      ],
    },
    cast: {
      p: {
        person: "auh_adler",
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
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "broken",
            reacts: [
              {
                when: KARL,
                next: "karl",
                effects: [],
              },
            ],
          },
          {
            id: "frank",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["chancellor:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chancellor",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_son",
              },
            ],
            next: "sign",
          },
          {
            id: "cold",
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
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_son",
              },
            ],
            next: "sign",
          },
          {
            id: "stop",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      karl: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_son",
              },
            ],
            next: "sign",
          },
          {
            id: "stop",
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
              {
                kind: "remember",
                key: "k_adl_son",
              },
            ],
            next: null,
          },
        ],
      },
      sign: {
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
    id: "auh_t_adl_strike",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("17a", "18a"),
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
        person: "auh_adler",
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
          },
          {
            id: "hard",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -2,
              },
            ],
            next: "refuse",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["weary"],
                },
                next: "weary",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["bread:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "bread",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_strike",
              },
            ],
            next: "how",
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
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_strike",
              },
            ],
            next: "note",
          },
          {
            id: "on_party",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_party",
          },
          {
            id: "peace",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_strike",
              },
            ],
            next: "peace",
          },
        ],
      },
      peace: {
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
      refuse: {
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
      weary: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
          },
        ],
      },
      on_party: {
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
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "note",
          },
          {
            id: "enough",
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
    id: "auh_t_adl_after",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [during("17a", "18b"), KARL],
    },
    cast: {
      p: {
        person: "auh_adler",
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
            id: "late",
            when: {
              kind: "world",
              of: {
                is: "score",
                max: -15,
              },
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
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "no",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: {
                    role: "p",
                  },
                  of: ["stubborn"],
                },
                next: "plain",
                effects: [],
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
                kind: "person_trust",
                who: {
                  office: "court",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_after",
              },
            ],
            next: "after",
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
      after: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "take",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_after",
              },
            ],
            next: "seat",
          },
          {
            id: "on_germany",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_germany",
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
      seat: {
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
      no: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
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
      plain: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "after",
          },
        ],
      },
      on_germany: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "seat",
          },
          {
            id: "enough",
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
    id: "auh_v_tisza_resign",
    nation: ["AUH"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        during("C", "17a"),
        {
          kind: "all",
          of: [
            {
              kind: "inst",
              inst: HUNGARY,
              max: -2,
            },
            {
              kind: "holder",
              office: "hun_pm",
              person: "auh_tisza",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "auh_tisza",
      },
    },
    salience: 7,
    tags: ["people", "home"],
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
            id: "keep",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:+1", "chancellor:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  office: "chancellor",
                },
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
                kind: "world",
                of: {
                  do: "keep",
                  who: {
                    role: "p",
                  },
                },
              },
            ],
            next: "stay",
          },
          {
            id: "take",
            stance: "cold",
            kind: "leave",
            tell: ["hungary:-1", "leaves"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "world",
                of: {
                  do: "leave",
                  who: {
                    role: "p",
                  },
                },
              },
              {
                kind: "remember",
                key: "auh_tisza_let_go",
              },
            ],
            next: null,
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -2,
              },
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
            ],
            next: "duel",
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
            id: "keep2",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:+1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "world",
                of: {
                  do: "keep",
                  who: {
                    role: "p",
                  },
                },
              },
            ],
            next: "stay",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: ["hungary:-1", "leaves"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "world",
                of: {
                  do: "leave",
                  who: {
                    role: "p",
                  },
                },
              },
              {
                kind: "remember",
                key: "auh_tisza_let_go",
              },
            ],
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
      duel: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep3",
            stance: "frank",
            kind: "deal",
            tell: ["hungary:+1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
              {
                kind: "world",
                of: {
                  do: "keep",
                  who: {
                    role: "p",
                  },
                },
              },
            ],
            next: "stay",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: ["hungary:-1", "leaves"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "world",
                of: {
                  do: "leave",
                  who: {
                    role: "p",
                  },
                },
              },
              {
                kind: "remember",
                key: "auh_tisza_let_go",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "auh_v_tisza_promise",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    cast: {
      p: {
        called: true,
      },
    },
    salience: 7,
    tags: ["people", "home"],
    once: true,
    scheduledOnly: true,
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
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mend",
          },
          {
            id: "late",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1", "hungary:+1"],
            effects: [
              {
                kind: "gauge",
                gauge: "money",
                delta: -1,
              },
              {
                kind: "inst",
                inst: HUNGARY,
                delta: 1,
              },
            ],
            next: "mend",
          },
          {
            id: "deny",
            stance: "cold",
            kind: "push",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "bread",
                delta: -1,
              },
            ],
            next: "close",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      mend: {
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
      close: {
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
    id: "auh_v_kra_promise",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    cast: {
      p: {
        called: true,
      },
    },
    salience: 7,
    tags: ["people", "home"],
    once: true,
    scheduledOnly: true,
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
            id: "sorry",
            stance: "warm",
            kind: "deal",
            tell: ["war:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "war",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_kra_prison",
              },
            ],
            next: "hand",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["nations:-1", "trust:-1"],
            effects: [
              {
                kind: "inst",
                inst: NATIONS,
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
            next: "gone",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["nations:-1"],
            effects: [
              {
                kind: "inst",
                inst: NATIONS,
                delta: -1,
              },
            ],
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
            id: "hand2",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kra_prison",
              },
            ],
            next: "hand",
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
      hand: {
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
    id: "auh_v_adl_promise",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    cast: {
      p: {
        called: true,
      },
    },
    salience: 7,
    tags: ["people", "home"],
    once: true,
    scheduledOnly: true,
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
            next: "party",
          },
          {
            id: "sorry",
            stance: "warm",
            kind: "deal",
            tell: ["chancellor:-1", "order:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chancellor",
                },
                delta: -1,
              },
              {
                kind: "gauge",
                gauge: "order",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
            next: "date",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["order:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "order",
                delta: -1,
              },
              {
                kind: "inst",
                inst: NATIONS,
                delta: -1,
              },
            ],
            next: "gone",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["order:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "order",
                delta: -1,
              },
            ],
            next: null,
          },
        ],
      },
      party: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "date2",
            stance: "warm",
            kind: "deal",
            tell: ["chancellor:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  office: "chancellor",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
            next: "date",
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
      date: {
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
    id: "auh_v_land_days",
    nation: ["AUH"],
    kind: "talk",
    stage: ["war"],
    when: {
      kind: "all",
      of: [
        during("16b", "18a"),
        {
          kind: "gauge",
          gauge: "bread",
          max: 1,
        },
      ],
    },
    cast: {
      p: {
        person: "auh_landwehr",
      },
    },
    salience: 7,
    tags: ["people", "home"],
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
            id: "empty",
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
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stores",
            reacts: [
              {
                when: {
                  kind: "candid",
                  who: {
                    role: "p",
                  },
                },
                next: "count",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["hungary:-1"],
            effects: [
              {
                kind: "inst",
                inst: HUNGARY,
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_land_days",
              },
            ],
            next: "count",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["order:-1"],
            effects: [
              {
                kind: "gauge",
                gauge: "order",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_land_days",
              },
            ],
            next: "ration",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_land_days",
              },
            ],
            next: null,
          },
        ],
      },
      stores: {
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
                kind: "remember",
                key: "k_land_days",
              },
            ],
            next: null,
          },
        ],
      },
      count: {
        says: [
          {
            id: "hidden",
            when: GRAIN_HIDDEN,
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
              {
                kind: "remember",
                key: "k_land_days",
              },
              {
                kind: "maybe",
                when: GRAIN_HIDDEN,
                then: [
                  {
                    kind: "flag",
                    flag: "f_auh_found_grain",
                  },
                ],
              },
            ],
            next: null,
          },
        ],
      },
      ration: {
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
