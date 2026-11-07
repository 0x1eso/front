import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「러시아」, the 전선 share: `rus_w_` scenes, the summoned talks of Alekseyev,
 * Brusilov, Polivanov and Guchkov, and five visits. Data only. Text is in
 * resources/ww1914/ko/RUS.front.json. Plan: ww135-plan-rus.md sections 5, 8, 9.
 */
export const RUS_FRONT_SCENES: readonly GwScene[] = [
  {
    id: "rus_w_ledger",
    nation: ["RUS"],
    kind: "ledger",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "chapter", min: 7 },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["war"],
    cooldown: 2,
    variants: [
      {
        id: "storm",
        when: { kind: "world", of: { is: "era", of: ["storm"] } },
      },
      {
        id: "depth_cmd",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "era", of: ["depth"] } },
            { kind: "world", of: { is: "command" } },
          ],
        },
      },
      {
        id: "depth",
        when: { kind: "world", of: { is: "era", of: ["depth"] } },
      },
      {
        id: "material_cmd2",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "era", of: ["material"] } },
            { kind: "world", of: { is: "command" } },
          ],
        },
      },
      {
        id: "material_cmd",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "era", of: ["material"] } },
            { kind: "world", of: { is: "command" } },
          ],
        },
      },
      {
        id: "material2",
        when: { kind: "world", of: { is: "era", of: ["material"] } },
      },
      {
        id: "material3",
        when: { kind: "world", of: { is: "era", of: ["material"] } },
      },
      {
        id: "material",
        when: { kind: "world", of: { is: "era", of: ["material"] } },
      },
      {
        id: "trenches_cmd2",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "era", of: ["trenches"] } },
            { kind: "world", of: { is: "command" } },
          ],
        },
      },
      {
        id: "trenches_cmd",
        when: {
          kind: "all",
          of: [
            { kind: "world", of: { is: "era", of: ["trenches"] } },
            { kind: "world", of: { is: "command" } },
          ],
        },
      },
      {
        id: "trenches2",
        when: { kind: "world", of: { is: "era", of: ["trenches"] } },
      },
      {
        id: "trenches3",
        when: { kind: "world", of: { is: "era", of: ["trenches"] } },
      },
      {
        id: "trenches",
        when: { kind: "world", of: { is: "era", of: ["trenches"] } },
      },
      { id: "base2" },
      { id: "base" },
    ],
    fallback: "sign_chief",
    options: [
      {
        id: "sign_chief",
        tell: ["trust:+1"],
        effects: [
          { kind: "world", of: { do: "sign_chief" } },
          { kind: "person_trust", who: { role: "cos" }, delta: 1 },
        ],
      },
      {
        id: "return_chief",
        screen: "fronts",
        tell: ["trust:-1", "stavka:-1"],
        effects: [
          { kind: "person_trust", who: { role: "cos" }, delta: -1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "remember", key: "m_rus_ledger_returned" },
        ],
      },
    ],
  },
  {
    id: "rus_w_sarikamish",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "open", theatre: "caucasus" } },
        { kind: "world", of: { is: "era", of: ["movement", "trenches"] } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: { is: "date", from: "1914-11", to: "1915-03" },
            },
            {
              kind: "world",
              of: { is: "date", from: "1915-11", to: "1916-03" },
            },
          ],
        },
      ],
    },
    cast: {},
    salience: 7,
    tags: ["war"],
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
            theatre: "caucasus",
            of: ["repelled"],
            by: "central",
          },
        },
      },
      {
        id: "lost",
        when: {
          kind: "world",
          of: {
            is: "battle",
            theatre: "caucasus",
            of: ["advance", "break"],
            by: "central",
          },
        },
      },
      { id: "tiflis" },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_carpathians",
    nation: ["RUS"],
    kind: "dispute",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", from: "1914-12", to: "1915-04" } },
        {
          kind: "not",
          of: {
            kind: "world",
            of: { is: "front", theatre: "east", from: "vistula" },
          },
        },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "thin", when: { kind: "gauge", gauge: "shells", max: 1 } },
      { id: "self", when: { kind: "world", of: { is: "command" } } },
      { id: "base" },
    ],
    fallback: "split",
    options: [
      {
        id: "split",
        tell: ["stavka:-1", "casualties_high"],
        effects: [
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: -1 },
          { kind: "remember", key: "m_rus_winter_split" },
        ],
      },
      {
        id: "over_the_pass",
        when: { kind: "any", of: [{ kind: "memory", key: "k_brus_pass" }] },
        tell: ["stavka:+1", "manpower:-5", "casualties_high"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -5 } },
          {
            kind: "world",
            of: { do: "force", tag: "AUH", theatre: "east", delta: -1 },
          },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: 1 },
        ],
      },
      {
        id: "back_to_prussia",
        when: { kind: "any", of: [{ kind: "memory", key: "k_danilov_nw" }] },
        tell: ["stavka:+1", "manpower:-3"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -3 } },
          {
            kind: "world",
            of: { do: "force", tag: "DEU", theatre: "east", delta: -1 },
          },
          { kind: "person_trust", who: { person: "rus_danilov" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_gorlice",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "era", of: ["trenches"] } },
        { kind: "world", of: { is: "date", from: "1915-03" } },
        { kind: "not", of: { kind: "seen", scene: "rus_w_berlin_road" } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "battle",
                theatre: "east",
                of: ["break"],
                by: "central",
              },
            },
            { kind: "gauge", gauge: "shells", max: 0 },
          ],
        },
      ],
    },
    cast: { cos: { office: "chief_of_staff" }, war: { office: "war" } },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "no_shells", when: { kind: "gauge", gauge: "shells", max: 0 } },
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      {
        id: "over_pass",
        when: {
          kind: "chose",
          scene: "rus_w_carpathians",
          pick: "over_the_pass",
        },
      },
      { id: "base" },
    ],
    fallback: "hold_ground",
    options: [
      {
        id: "hold_ground",
        tell: ["stavka:+1", "manpower:-8", "casualties_high"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -8 } },
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "remember", key: "m_rus_held_gorlice" },
        ],
      },
      {
        id: "fall_back",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_alek_retreat" },
            { kind: "memory", key: "k_nik_retreat" },
          ],
        },
        tell: ["manpower:+2", "morale:-1", "ministers:-1"],
        effects: [
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "inst", inst: "ministers", delta: -1 },
          { kind: "world", of: { do: "manpower", delta: 2 } },
        ],
      },
      {
        id: "trade_space",
        when: { kind: "any", of: [{ kind: "memory", key: "k_poli_space" }] },
        tell: ["manpower:+3", "duma:-1", "ministers:+1"],
        effects: [
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "world", of: { do: "manpower", delta: 3 } },
          { kind: "inst", inst: "duma", delta: -1 },
          { kind: "inst", inst: "ministers", delta: 1 },
          { kind: "remember", key: "m_rus_traded_space" },
        ],
      },
      {
        id: "shells_from_north",
        tell: ["stavka:-1", "shells:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: -1 },
          },
        ],
      },
    ],
  },
  {
    id: "rus_w_shell_famine",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "gauge", gauge: "shells", max: 1 },
        { kind: "world", of: { is: "era", of: ["trenches"] } },
      ],
    },
    cast: { war: { office: "war" }, pm: { office: "chancellor" } },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "not_him",
        when: {
          kind: "not",
          of: { kind: "holder", office: "war", person: "rus_sukhomlinov" },
        },
      },
      {
        id: "spy",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_sukh_wife" },
            { kind: "memory", key: "k_guch_myasoedov" },
          ],
        },
      },
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      { id: "base" },
    ],
    fallback: "keep_sukh",
    options: [
      {
        id: "keep_sukh",
        tell: ["court:+1", "duma:-2", "stavka:-1"],
        effects: [
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "inst", inst: "duma", delta: -2 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "remember", key: "m_rus_kept_war_minister" },
        ],
      },
      {
        id: "special_council",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_poli_council" },
            { kind: "memory", key: "k_rodz_shells" },
          ],
        },
        tell: ["duma:+2", "court:-1", "shells:+1"],
        effects: [
          { kind: "inst", inst: "duma", delta: 2 },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "flag", flag: "f_rus_special_council" },
          { kind: "remember", key: "m_rus_council" },
        ],
      },
      {
        id: "dismiss_sukh",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_sukh_wife" },
            { kind: "memory", key: "k_guch_myasoedov" },
          ],
        },
        tell: ["court:-1", "duma:+1", "stavka:+1", "leaves"],
        effects: [
          { kind: "dismiss", who: { role: "war" } },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "inst", inst: "duma", delta: 1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "remember", key: "m_rus_dismissed_war" },
        ],
      },
      {
        id: "call_industry",
        when: { kind: "any", of: [{ kind: "memory", key: "k_guch_wic" }] },
        tell: ["duma:+1", "court:-2", "shells:+1", "money:-1"],
        effects: [
          { kind: "inst", inst: "duma", delta: 1 },
          { kind: "inst", inst: "court", delta: -2 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "flag", flag: "f_rus_wic" },
        ],
      },
    ],
  },
  {
    id: "rus_w_warsaw",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: { is: "front", theatre: "east", from: "warsaw" },
            },
            { kind: "flag", flag: "w_warsaw_lost" },
          ],
        },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "fallen", when: { kind: "flag", flag: "w_warsaw_lost" } },
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      { id: "shells", when: { kind: "gauge", gauge: "shells", max: 0 } },
      { id: "base" },
    ],
    fallback: "hold_forts",
    options: [
      {
        id: "hold_forts",
        tell: ["court:+1", "manpower:-6", "casualties_high"],
        effects: [
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -6 } },
          { kind: "remember", key: "m_rus_held_forts" },
        ],
      },
      {
        id: "leave_all",
        when: { kind: "any", of: [{ kind: "memory", key: "k_alek_retreat" }] },
        tell: ["stavka:+1", "manpower:+3", "ministers:-1", "morale:-1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: 3 } },
          { kind: "inst", inst: "ministers", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "remember", key: "m_rus_left_forts" },
        ],
      },
      {
        id: "leave_poland_word",
        when: { kind: "any", of: [{ kind: "memory", key: "k_saz_poland" }] },
        tell: ["stavka:+1", "manpower:+2", "ally:+1", "court:-1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: 2 } },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "flag", flag: "f_rus_poland_word" },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "rus_w_record_front",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", from: "1915-06" } },
        {
          kind: "world",
          of: { is: "front", theatre: "east", from: "vistula" },
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["war"],
    once: true,
    stamp: "estimate",
    source: "press",
    variants: [{ id: "base" }],
  },
  {
    id: "rus_w_command",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "front", theatre: "east", from: "warsaw" } },
        { kind: "not", of: { kind: "world", of: { is: "command" } } },
        { kind: "not", of: { kind: "seen", scene: "rus_h_keys" } },
        {
          kind: "holder",
          office: "supreme_commander",
          person: "rus_nikolasha",
        },
      ],
    },
    cast: { war: { office: "war" }, pm: { office: "chancellor" } },
    salience: 9,
    tags: ["people"],
    once: true,
    variants: [
      { id: "fallen", when: { kind: "flag", flag: "w_warsaw_lost" } },
      { id: "no_shells", when: { kind: "gauge", gauge: "shells", max: 0 } },
      {
        id: "ministers_low",
        when: { kind: "inst", inst: "ministers", max: -1 },
      },
      { id: "base" },
    ],
    fallback: "keep_grand_duke",
    options: [
      {
        id: "keep_grand_duke",
        tell: ["court:-2", "ministers:+1"],
        effects: [
          { kind: "inst", inst: "court", delta: -2 },
          { kind: "inst", inst: "ministers", delta: 1 },
          { kind: "remember", key: "m_rus_kept_gd" },
        ],
      },
      {
        id: "self_command",
        tell: ["court:+2", "ministers:-3", "morale:+1", "duma:-1"],
        effects: [
          { kind: "world", of: { do: "personal_command", on: true } },
          { kind: "dismiss", who: { person: "rus_nikolasha" } },
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "chief_of_staff",
          },
          { kind: "inst", inst: "court", delta: 2 },
          { kind: "inst", inst: "ministers", delta: -3 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "inst", inst: "duma", delta: -1 },
          { kind: "flag", flag: "f_rus_took_command" },
        ],
      },
      {
        id: "alekseev_supreme",
        tell: ["morale:-1", "court:+1", "ministers:+1"],
        effects: [
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "supreme_commander",
          },
          { kind: "dismiss", who: { person: "rus_nikolasha" } },
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "inst", inst: "ministers", delta: 1 },
        ],
      },
      {
        id: "hear_ministers",
        when: { kind: "any", of: [{ kind: "memory", key: "k_poli_command" }] },
        tell: ["ministers:+2", "court:-2", "stavka:+1"],
        effects: [
          { kind: "inst", inst: "ministers", delta: 2 },
          { kind: "inst", inst: "court", delta: -2 },
          { kind: "inst", inst: "stavka", delta: 1 },
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "chief_of_staff",
          },
          { kind: "flag", flag: "f_rus_heard_ministers" },
        ],
      },
      {
        id: "self_with_her_letter",
        when: { kind: "any", of: [{ kind: "memory", key: "k_alex_self" }] },
        tell: ["court:+3", "ministers:-3", "duma:-2", "morale:+1"],
        effects: [
          { kind: "world", of: { do: "personal_command", on: true } },
          { kind: "dismiss", who: { person: "rus_nikolasha" } },
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "chief_of_staff",
          },
          { kind: "inst", inst: "court", delta: 3 },
          { kind: "inst", inst: "ministers", delta: -3 },
          { kind: "inst", inst: "duma", delta: -2 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "flag", flag: "f_rus_took_command" },
          { kind: "flag", flag: "f_rus_her_letter_shown" },
        ],
      },
      {
        id: "grand_duke_with_terms",
        when: { kind: "any", of: [{ kind: "memory", key: "k_nik_friend" }] },
        tell: ["court:-1", "stavka:+1", "morale:+1"],
        effects: [
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "chief_of_staff",
          },
          { kind: "person_trust", who: { person: "rus_nikolasha" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_naroch",
    nation: ["RUS"],
    kind: "dispute",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "entered", tag: "FRA" } },
        { kind: "trench", theatre: "west", min: 2 },
        { kind: "world", of: { is: "date", from: "1916-02", to: "1916-04" } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "thin", when: { kind: "gauge", gauge: "shells", max: 1 } },
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      { id: "base" },
    ],
    fallback: "attack_now",
    options: [
      {
        id: "attack_now",
        tell: ["ally:+2", "manpower:-7", "casualties_high", "stavka:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 2 },
          { kind: "world", of: { do: "manpower", delta: -7 } },
          { kind: "inst", inst: "stavka", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "DEU", theatre: "west", delta: -1 },
          },
          { kind: "remember", key: "m_rus_naroch_attack" },
        ],
      },
      {
        id: "wait_thaw",
        when: { kind: "any", of: [{ kind: "memory", key: "k_alek_mud" }] },
        tell: ["ally:-1", "stavka:+1", "shells:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
        ],
      },
      {
        id: "send_brigades",
        when: { kind: "any", of: [{ kind: "memory", key: "k_paleo_plea" }] },
        tell: ["ally:+1", "manpower:-2", "court:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -2 } },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "flag", flag: "f_rus_brigades_france" },
        ],
      },
    ],
  },
  {
    id: "rus_w_april_council",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "era", of: ["material"] } },
        { kind: "gauge", gauge: "shells", min: 1 },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "after_naroch",
        when: { kind: "chose", scene: "rus_w_naroch", pick: "attack_now" },
      },
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      {
        id: "no_brus",
        when: {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "rus_alekseev",
          },
        },
      },
      { id: "base" },
    ],
    fallback: "west_front",
    options: [
      {
        id: "west_front",
        tell: ["stavka:+1", "manpower:-4"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -4 } },
          { kind: "remember", key: "m_rus_west_main" },
        ],
      },
      {
        id: "brusilov_goes",
        when: { kind: "any", of: [{ kind: "memory", key: "k_brus_plan" }] },
        tell: ["stavka:+1", "manpower:-5", "court:-1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -5 } },
          { kind: "inst", inst: "court", delta: -1 },
          {
            kind: "world",
            of: {
              do: "command",
              who: { person: "rus_brusilov" },
              theatre: "east",
            },
          },
          {
            kind: "world",
            of: { do: "force", tag: "AUH", theatre: "east", delta: -2 },
          },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: 1 },
          { kind: "flag", flag: "f_rus_brusilov_goes" },
          { kind: "schedule", scene: "rus_w_lutsk", chapters: 2 },
        ],
      },
      {
        id: "all_hold",
        tell: ["ally:-2", "shells:+1", "stavka:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -2 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
        ],
      },
      {
        id: "both_fronts",
        when: { kind: "any", of: [{ kind: "memory", key: "k_evert_doubt" }] },
        tell: ["stavka:+2", "manpower:-8", "casualties_high"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 2 },
          { kind: "world", of: { do: "manpower", delta: -8 } },
          { kind: "person_trust", who: { person: "rus_evert" }, delta: 1 },
          {
            kind: "world",
            of: { do: "force", tag: "AUH", theatre: "east", delta: -1 },
          },
          {
            kind: "world",
            of: { do: "force", tag: "DEU", theatre: "east", delta: -1 },
          },
          { kind: "flag", flag: "f_rus_both_fronts" },
        ],
      },
    ],
  },
  {
    id: "rus_w_lutsk",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    cast: {},
    salience: 8,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    scheduledOnly: true,
    variants: [
      {
        id: "vienna",
        when: {
          kind: "all",
          of: [
            {
              kind: "world",
              of: {
                is: "battle",
                theatre: "east",
                of: ["break"],
                by: "entente",
              },
            },
            {
              kind: "world",
              of: { is: "force", tag: "AUH", theatre: "east", max: 1 },
            },
          ],
        },
      },
      {
        id: "break",
        when: {
          kind: "world",
          of: { is: "battle", theatre: "east", of: ["break"], by: "entente" },
        },
      },
      {
        id: "advance",
        when: {
          kind: "world",
          of: { is: "battle", theatre: "east", of: ["advance"], by: "entente" },
        },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_romania",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "entered", tag: "ROU" } },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" }, fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "falling",
        when: {
          kind: "any",
          of: [
            { kind: "world", of: { is: "out", tag: "ROU" } },
            {
              kind: "world",
              of: {
                is: "battle",
                theatre: "balkan",
                of: ["break"],
                by: "central",
              },
            },
          ],
        },
      },
      { id: "dead_treaty", when: { kind: "secret", id: "rou_treaty_dead" } },
      { id: "base" },
    ],
    fallback: "send_corps",
    options: [
      {
        id: "send_corps",
        tell: ["ally:+1", "manpower:-5", "stavka:-1"],
        effects: [
          { kind: "trust", tag: "ROU", delta: 1 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -5 } },
          { kind: "inst", inst: "stavka", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "balkan", delta: 1 },
          },
        ],
      },
      {
        id: "hold_moldavia",
        tell: ["stavka:+1", "ally:-1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "trust", tag: "ROU", delta: -1 },
          { kind: "remember", key: "m_rus_moldavia_line" },
        ],
      },
      {
        id: "blame_bucharest",
        tell: ["stavka:+1", "court:-1", "ally:-2"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "trust", tag: "ROU", delta: -2 },
          { kind: "trust", tag: "FRA", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_depots",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        {
          kind: "world",
          of: { is: "era", of: ["material", "depth", "storm"] },
        },
        { kind: "gauge", gauge: "order", max: 3 },
      ],
    },
    cast: { war: { office: "war" }, cos: { office: "chief_of_staff" } },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "rotten",
        when: {
          kind: "all",
          of: [
            { kind: "secret", id: "rus_garrison_rotten" },
            {
              kind: "world",
              of: { is: "regime", of: ["tsar", "crown", "regency"] },
            },
          ],
        },
      },
      {
        id: "prov",
        when: {
          kind: "world",
          of: { is: "regime", of: ["provisional", "rep"] },
        },
      },
      { id: "base" },
    ],
    fallback: "leave_them",
    options: [
      {
        id: "leave_them",
        tell: ["court:+1", "order:-1"],
        effects: [
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "remember", key: "m_rus_depots_left" },
        ],
      },
      {
        id: "thin_out",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_alek_garrison" },
            { kind: "memory", key: "k_brus_depots" },
          ],
        },
        tell: ["order:+1", "stavka:+1", "court:-1"],
        effects: [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "flag", flag: "f_rus_depots_thinned" },
        ],
      },
      {
        id: "guards_home",
        when: { kind: "any", of: [{ kind: "memory", key: "k_ker_depots" }] },
        tell: ["order:+1", "court:+1", "stavka:-2", "manpower:-2"],
        effects: [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -2 },
          { kind: "world", of: { do: "manpower", delta: -2 } },
          { kind: "flag", flag: "f_rus_guards_home" },
        ],
      },
    ],
  },
  {
    id: "rus_w_letters",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: { kind: "world", of: { is: "war" } },
    cast: {},
    salience: 5,
    tags: ["home", "tension_up"],
    cooldown: 6,
    stamp: "estimate",
    source: "staff",
    variants: [
      { id: "m0", when: { kind: "gauge", gauge: "morale", min: 0, max: 0 } },
      { id: "m1", when: { kind: "gauge", gauge: "morale", min: 1, max: 1 } },
      { id: "m2", when: { kind: "gauge", gauge: "morale", min: 2, max: 2 } },
      { id: "m3", when: { kind: "gauge", gauge: "morale", min: 3, max: 3 } },
      { id: "base2" },
      { id: "base3" },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_spring_promise",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "era", of: ["depth"] } },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" }, fm: { office: "foreign" } },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "crown",
        when: { kind: "world", of: { is: "regime", of: ["crown"] } },
      },
      { id: "thin", when: { kind: "gauge", gauge: "order", max: 1 } },
      { id: "base" },
    ],
    fallback: "keep_promise",
    options: [
      {
        id: "keep_promise",
        tell: ["ally:+2", "manpower:-6", "morale:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 2 },
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -6 } },
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "remember", key: "m_rus_spring_kept" },
        ],
      },
      {
        id: "delay_it",
        when: { kind: "any", of: [{ kind: "memory", key: "k_brus_after" }] },
        tell: ["ally:-1", "morale:+1", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "inst", inst: "stavka", delta: 1 },
        ],
      },
      {
        id: "limited_only",
        when: { kind: "any", of: [{ kind: "memory", key: "k_alek_sick" }] },
        tell: ["ally:-1", "manpower:-2", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -1 },
          { kind: "world", of: { do: "manpower", delta: -2 } },
          { kind: "inst", inst: "stavka", delta: 1 },
        ],
      },
      {
        id: "ask_allies_guns",
        tell: ["money:-1", "shells:+1", "ally:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_summer_line",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "era", of: ["depth", "storm"] } },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "unrest", min: 2 } },
            { kind: "world", of: { is: "regime", of: ["provisional"] } },
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
        id: "prov",
        when: { kind: "world", of: { is: "regime", of: ["provisional"] } },
      },
      { id: "rep", when: { kind: "world", of: { is: "regime", of: ["rep"] } } },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_przemysl",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", from: "1915-03", to: "1915-06" } },
        {
          kind: "not",
          of: {
            kind: "world",
            of: { is: "front", theatre: "east", from: "vistula" },
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
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_rifles",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "gauge", gauge: "shells", max: 1 },
        { kind: "world", of: { is: "era", of: ["trenches", "material"] } },
      ],
    },
    cast: { war: { office: "war" } },
    salience: 6,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "wounded",
        when: { kind: "world", of: { is: "casualties", min: 500 } },
      },
      { id: "base" },
    ],
    fallback: "wait_factories",
    options: [
      {
        id: "wait_factories",
        tell: ["morale:-1"],
        effects: [{ kind: "gauge", gauge: "morale", delta: -1 }],
      },
      {
        id: "buy_abroad",
        when: { kind: "any", of: [{ kind: "memory", key: "k_bark_gold" }] },
        tell: ["money:-1", "shells:+1", "ally:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "remember", key: "m_rus_rifles_abroad" },
        ],
      },
      {
        id: "captured_rifles",
        tell: ["stavka:+1", "manpower:-1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -1 } },
          { kind: "gauge", gauge: "morale", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_mogilev",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "command" } },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 7,
    tags: ["people"],
    cooldown: 8,
    variants: [
      {
        id: "heir",
        when: { kind: "chose", scene: "rus_h_heir_stavka", pick: "take_him" },
      },
      { id: "long", when: { kind: "inst", inst: "ministers", max: -2 } },
      { id: "base" },
    ],
    fallback: "sign_only",
    options: [
      {
        id: "sign_only",
        tell: ["stavka:+1", "trust:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "person_trust", who: { role: "cos" }, delta: 1 },
        ],
      },
      {
        id: "map_every_day",
        when: { kind: "any", of: [{ kind: "memory", key: "k_alek_terms" }] },
        tell: ["audiences:+1", "stavka:-1", "morale:+1"],
        effects: [
          { kind: "audiences", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
        ],
      },
      {
        id: "back_to_capital",
        tell: ["court:+1", "ministers:+1", "stavka:-1"],
        effects: [
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "inst", inst: "ministers", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "flag", flag: "f_rus_in_capital" },
          { kind: "schedule", scene: "rus_w_train_back", chapters: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_train_back",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    cast: { cos: { office: "chief_of_staff" } },
    salience: 5,
    tags: ["people"],
    once: true,
    scheduledOnly: true,
    variants: [{ id: "base" }],
    fallback: "go_back",
    options: [
      {
        id: "go_back",
        tell: ["stavka:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "unflag", flag: "f_rus_in_capital" },
        ],
      },
      {
        id: "stay_a_day",
        tell: ["court:+1", "stavka:-1"],
        effects: [
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "schedule", scene: "rus_w_train_back", chapters: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_evert_holds",
    nation: ["RUS"],
    kind: "dispute",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "seen", scene: "rus_w_lutsk" },
        { kind: "world", of: { is: "era", of: ["material"] } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "third_wire", when: { kind: "memory", key: "k_brus_reserves" } },
      { id: "base" },
    ],
    fallback: "wait_evert",
    options: [
      {
        id: "wait_evert",
        tell: ["stavka:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: -1 },
        ],
      },
      {
        id: "reserves_south",
        when: { kind: "any", of: [{ kind: "memory", key: "k_brus_reserves" }] },
        tell: ["stavka:-1", "manpower:-3"],
        effects: [
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "world", of: { do: "manpower", delta: -3 } },
          {
            kind: "world",
            of: { do: "force", tag: "AUH", theatre: "east", delta: -1 },
          },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: 1 },
          { kind: "person_trust", who: { person: "rus_evert" }, delta: -1 },
        ],
      },
      {
        id: "replace_evert",
        tell: ["court:-1", "stavka:+1", "morale:+1"],
        effects: [
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "person_trust", who: { person: "rus_evert" }, delta: -2 },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_kovel",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "seen", scene: "rus_w_lutsk" },
        { kind: "world", of: { is: "casualties", min: 300 } },
        { kind: "world", of: { is: "era", of: ["material"] } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "guards_there",
        when: {
          kind: "chose",
          scene: "rus_w_evert_holds",
          pick: "reserves_south",
        },
      },
      { id: "base" },
    ],
    fallback: "stop_now",
    options: [
      {
        id: "stop_now",
        tell: ["stavka:-1", "morale:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "remember", key: "m_rus_stopped_kovel" },
        ],
      },
      {
        id: "press_guard",
        tell: ["manpower:-8", "court:-1", "casualties_high", "stavka:+1"],
        effects: [
          { kind: "world", of: { do: "manpower", delta: -8 } },
          { kind: "inst", inst: "court", delta: -1 },
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "DEU", theatre: "east", delta: -1 },
          },
          { kind: "remember", key: "m_rus_guard_at_kovel" },
        ],
      },
      {
        id: "stop_with_word",
        when: { kind: "any", of: [{ kind: "memory", key: "k_brus_kovel" }] },
        tell: ["stavka:+1", "morale:+1", "manpower:-2"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -2 } },
          { kind: "person_trust", who: { person: "rus_brusilov" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rus_w_erzurum",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "world",
      of: { is: "front", theatre: "caucasus", from: "erzurum" },
    },
    cast: {},
    salience: 6,
    tags: ["war", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "snow",
        when: {
          kind: "chose",
          scene: "rus_w_caucasus_snow",
          pick: "go_in_snow",
        },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_w_caucasus_snow",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "open", theatre: "caucasus" } },
        { kind: "world", of: { is: "war" } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: { is: "date", from: "1915-10", to: "1916-02" },
            },
            {
              kind: "world",
              of: { is: "date", from: "1916-10", to: "1917-02" },
            },
          ],
        },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 6,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "after_sarikamish",
        when: { kind: "seen", scene: "rus_w_sarikamish" },
      },
      { id: "base" },
    ],
    fallback: "hold_passes",
    options: [
      {
        id: "hold_passes",
        tell: ["stavka:+1"],
        effects: [{ kind: "inst", inst: "stavka", delta: 1 }],
      },
      {
        id: "go_in_snow",
        when: { kind: "any", of: [{ kind: "memory", key: "k_yud_snow" }] },
        tell: ["manpower:-3", "morale:+1", "stavka:-1"],
        effects: [
          { kind: "world", of: { do: "manpower", delta: -3 } },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "caucasus", delta: 2 },
          },
          { kind: "remember", key: "m_rus_snow" },
        ],
      },
      {
        id: "coats_first",
        tell: ["money:-1", "morale:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "caucasus", delta: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "rus_w_bosporus_plan",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "gauge", gauge: "shells", min: 1 },
        { kind: "world", of: { is: "era", of: ["material", "depth"] } },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "open", theatre: "straits" } },
            { kind: "memory", key: "k_saz_straits" },
          ],
        },
      ],
    },
    cast: { navy: { office: "navy" } },
    salience: 6,
    tags: ["war"],
    once: true,
    variants: [
      {
        id: "allied_gone",
        when: {
          kind: "world",
          of: { is: "front", theatre: "straits", to: "dardanelles" },
        },
      },
      { id: "base" },
    ],
    fallback: "file_it",
    options: [
      {
        id: "file_it",
        tell: ["stavka:+1"],
        effects: [{ kind: "inst", inst: "stavka", delta: 1 }],
      },
      {
        id: "train_division",
        when: {
          kind: "any",
          of: [{ kind: "memory", key: "k_kolchak_bosporus" }],
        },
        tell: ["stavka:-1", "manpower:-2", "court:+1"],
        effects: [
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "world", of: { do: "manpower", delta: -2 } },
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "flag", flag: "f_bosporus_division" },
        ],
      },
      {
        id: "mines_only",
        tell: ["money:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          {
            kind: "world",
            of: { do: "force", tag: "OTT", theatre: "straits", delta: -1 },
          },
        ],
      },
    ],
  },
  {
    id: "rus_w_bosporus_landing",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "flag", flag: "f_bosporus_division" },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: { is: "front", theatre: "straits", from: "narrows" },
            },
            { kind: "world", of: { is: "out", tag: "OTT" } },
          ],
        },
      ],
    },
    cast: { navy: { office: "navy" }, cos: { office: "chief_of_staff" } },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "prov",
        when: {
          kind: "world",
          of: { is: "regime", of: ["provisional", "rep"] },
        },
      },
      {
        id: "allies_near",
        when: {
          kind: "world",
          of: { is: "front", theatre: "straits", from: "narrows" },
        },
      },
      { id: "base" },
    ],
    fallback: "land",
    options: [
      {
        id: "land",
        tell: ["court:+2", "duma:+1", "ally:-2", "manpower:-3"],
        effects: [
          { kind: "inst", inst: "court", delta: 2 },
          { kind: "inst", inst: "duma", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -2 },
          { kind: "world", of: { do: "manpower", delta: -3 } },
          {
            kind: "world",
            of: { do: "force", tag: "OTT", theatre: "straits", delta: -2 },
          },
          { kind: "flag", flag: "f_rus_bosporus_landed" },
        ],
      },
      {
        id: "wait_allies",
        tell: ["ally:+2", "court:-2"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "inst", inst: "court", delta: -2 },
        ],
      },
      {
        id: "forts_only",
        tell: ["ally:-1", "court:+1", "manpower:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "inst", inst: "court", delta: 1 },
          { kind: "world", of: { do: "manpower", delta: -1 } },
          {
            kind: "world",
            of: { do: "force", tag: "OTT", theatre: "straits", delta: -1 },
          },
        ],
      },
    ],
  },
  {
    id: "rus_w_berlin_road",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "front", theatre: "east", to: "oder" } },
        { kind: "not", of: { kind: "seen", scene: "rus_w_gorlice" } },
        {
          kind: "world",
          of: { is: "era", of: ["trenches", "material", "depth", "storm"] },
        },
      ],
    },
    cast: { cos: { office: "chief_of_staff" }, fm: { office: "foreign" } },
    salience: 7,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "cmd", when: { kind: "world", of: { is: "command" } } },
      { id: "base" },
    ],
    fallback: "press_on",
    options: [
      {
        id: "press_on",
        tell: ["stavka:+2", "manpower:-6", "casualties_high"],
        effects: [
          { kind: "inst", inst: "stavka", delta: 2 },
          { kind: "world", of: { do: "manpower", delta: -6 } },
          {
            kind: "world",
            of: { do: "force", tag: "DEU", theatre: "east", delta: -1 },
          },
        ],
      },
      {
        id: "offer_peace",
        tell: ["ministers:+1", "ally:-2", "stavka:-1", "talks"],
        effects: [
          { kind: "inst", inst: "ministers", delta: 1 },
          { kind: "trust", tag: "FRA", delta: -2 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "world", of: { do: "talks" } },
        ],
      },
      {
        id: "ask_paris",
        tell: ["ally:+1", "stavka:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "inst", inst: "stavka", delta: -1 },
          { kind: "remember", key: "m_rus_asked_paris" },
        ],
      },
    ],
  },
  {
    id: "rus_w_record_prisoners",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "seen", scene: "rus_h_wagons" },
        { kind: "world", of: { is: "date", from: "1916-12" } },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["home"],
    once: true,
    stamp: "estimate",
    source: "press",
    variants: [{ id: "base" }],
  },
  {
    id: "rus_w_riga",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "front", theatre: "east", from: "riga" } },
        { kind: "world", of: { is: "era", of: ["material", "depth"] } },
      ],
    },
    cast: {},
    salience: 6,
    tags: ["war", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "fallen",
        when: {
          kind: "world",
          of: { is: "front", theatre: "east", from: "dvina" },
        },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_t_alek_kiev",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 1, max: 5 },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "galicia",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "galicia",
            miss: "shut",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_alek_kiev" },
            ],
            next: "paper",
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
      galicia: {
        says: [
          {
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "yes",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_kiev" }],
            next: "rail",
          },
          {
            id: "rail",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "auh_rail_muddle" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "auh_rail_muddle" },
                  },
                ],
              },
            ],
            next: "rail",
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
      rail: {
        says: [
          { id: "yes", when: { kind: "secret", id: "auh_rail_muddle" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "thanks",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_alek_kiev" },
            ],
            next: null,
          },
        ],
      },
      paper: {
        says: [{ id: "base" }],
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
      shut: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "soft",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "galicia",
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
    id: "rus_t_alek_retreat",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "date", from: "1914-12", to: "1916-01" } },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: { is: "front", theatre: "east", from: "vistula" },
            },
            {
              kind: "world",
              of: {
                is: "battle",
                theatre: "east",
                of: ["break"],
                by: "central",
              },
            },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stub",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
          { id: "base" },
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
            id: "order",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "line",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["stubborn"],
                },
                next: "line",
                effects: [{ kind: "remember", key: "k_alek_retreat" }],
              },
            ],
            miss: "cold",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["ministers:-1"],
            effects: [
              { kind: "inst", inst: "ministers", delta: -1 },
              { kind: "remember", key: "k_alek_retreat" },
            ],
            next: "deal",
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
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_retreat" }],
            next: null,
          },
          {
            id: "people",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "people",
          },
          {
            id: "duke",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "duke",
          },
        ],
      },
      duke: {
        says: [
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: ["ministers:-1"],
            effects: [
              { kind: "remember", key: "k_alek_retreat" },
              { kind: "inst", inst: "ministers", delta: -1 },
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
      people: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_retreat" }],
            next: null,
          },
        ],
      },
      line: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "keep",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_retreat" }],
            next: null,
          },
          {
            id: "end",
            stance: "threat",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cold: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "deal",
            tell: ["ministers:-1"],
            effects: [
              { kind: "inst", inst: "ministers", delta: -1 },
              { kind: "remember", key: "k_alek_retreat" },
            ],
            next: "deal",
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alek_terms",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "date", from: "1915-02", to: "1916-02" } },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "command" } },
            {
              kind: "holder",
              office: "chief_of_staff",
              person: "rus_alekseev",
            },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
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
            id: "no",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "stiff",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_alek_terms" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_alek_no_leak",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "council_rules",
                    },
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "krivoshein_runs",
                    },
                  ],
                },
              },
            ],
            next: "promised",
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_alek_terms" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_alek_no_leak",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "council_rules",
                    },
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "krivoshein_runs",
                    },
                  ],
                },
              },
            ],
            next: "promised",
          },
          {
            id: "half",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_terms" }],
            next: null,
          },
          {
            id: "ivanov",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ivanov",
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
      ivanov: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_alek_terms" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_alek_no_leak",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "council_rules",
                    },
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "krivoshein_runs",
                    },
                  ],
                },
              },
            ],
            next: "promised",
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
            id: "stub",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rus_alek_closed" }],
            next: null,
          },
          {
            id: "sorry",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_alek_terms" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_alek_no_leak",
                chapters: 8,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "council_rules",
                    },
                    {
                      kind: "chose",
                      scene: "rus_h_keys",
                      pick: "krivoshein_runs",
                    },
                  ],
                },
              },
            ],
            next: "promised",
          },
        ],
      },
      promised: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_alek_mud",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", from: "1916-01", to: "1916-12" } },
      ],
    },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mud",
          },
          {
            id: "foe",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "deu_shell_stock_thin" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "deu_shell_stock_thin" },
                  },
                ],
              },
            ],
            next: "foe",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "mud",
            gain: [{ kind: "remember", key: "k_alek_mud" }],
            miss: "shut",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ally:-1"],
            effects: [
              { kind: "trust", tag: "FRA", delta: -1 },
              { kind: "remember", key: "k_alek_mud" },
            ],
            next: "deal",
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
      mud: {
        says: [
          {
            id: "w",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_mud" }],
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
      foe: {
        says: [
          { id: "yes", when: { kind: "secret", id: "deu_shell_stock_thin" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mud",
          },
          {
            id: "brus",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "brus",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      brus: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      deal: {
        says: [{ id: "base" }],
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
      shut: {
        says: [{ id: "base" }],
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
    id: "rus_t_alek_garrison",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "world", of: { is: "date", from: "1916-02" } },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "count" }, { id: "base" }],
    start: "open",
    starts: { count: "a_count" },
    nodes: {
      a_count: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rot",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_garrison" }],
            next: "deal",
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
            id: "prov",
            when: {
              kind: "world",
              of: { is: "regime", of: ["provisional", "rep"] },
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "rus_garrison_rotten" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "rus_garrison_rotten" },
                  },
                ],
              },
            ],
            next: "rot",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "plain",
            miss: "shut",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_alek_garrison" },
            ],
            next: "deal",
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
      rot: {
        says: [
          { id: "yes", when: { kind: "secret", id: "rus_garrison_rotten" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_garrison" }],
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
      plain: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "wait",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_garrison" }],
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      shut: {
        says: [{ id: "base" }],
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
    id: "rus_t_alek_sick",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "date", from: "1916-11", to: "1917-12" } },
        {
          kind: "world",
          of: { is: "regime", of: ["tsar", "crown", "regency"] },
        },
      ],
    },
    cast: { p: { person: "rus_alekseev" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "ill", when: { kind: "health", who: { role: "p" }, max: 1 } },
          { id: "base" },
        ],
        replies: [
          {
            id: "spring",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "spring",
          },
          {
            id: "who",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "rus_palace_plot" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "rus_palace_plot" },
                  },
                ],
              },
            ],
            next: "who",
          },
          {
            id: "stay",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "stay",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1"],
            effects: [
              { kind: "audiences", delta: -1 },
              { kind: "remember", key: "k_alek_sick" },
            ],
            next: "deal",
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
      spring: {
        says: [
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_alek_sick" }],
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
      who: {
        says: [
          { id: "yes", when: { kind: "secret", id: "rus_palace_plot" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "thanks",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -2 }],
            next: "stay",
          },
        ],
      },
      stay: {
        says: [{ id: "base" }],
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_cavalry",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 1, max: 7 },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "foe",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "dry",
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
            next: "foe",
            miss: "dry",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_brus_met" },
            ],
            next: "deal",
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
      foe: {
        says: [
          {
            id: "weak",
            when: {
              kind: "world",
              of: { is: "force", tag: "AUH", theatre: "east", max: 2 },
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "meet",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_met" }],
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
      dry: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "foe",
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_pass",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "world", of: { is: "date", from: "1914-12", to: "1915-04" } },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stub",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cost",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "push",
            tell: [],
            effects: [],
            next: "plan",
            gain: [{ kind: "remember", key: "k_brus_pass" }],
            miss: "dry",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: -1 },
              { kind: "remember", key: "k_brus_pass" },
            ],
            next: "deal",
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
      cost: {
        says: [
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_pass" }],
            next: null,
          },
          {
            id: "ivanov",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ivanov",
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
      ivanov: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              { kind: "remember", key: "k_brus_pass" },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      plan: {
        says: [{ id: "base" }],
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
      dry: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cost",
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_plan",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", to: "1916-12" } },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "date", from: "1916-01" } },
            {
              kind: "all",
              of: [
                { kind: "memory", key: "k_brus_met" },
                { kind: "world", of: { is: "date", from: "1915-10" } },
              ],
            },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "met", when: { kind: "memory", key: "k_brus_met" } },
          { id: "base" },
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
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "how",
            gain: [{ kind: "remember", key: "k_brus_plan" }],
            miss: "sting",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "sting",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: -1 },
              { kind: "remember", key: "k_brus_plan" },
            ],
            next: "deal",
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
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_plan" }],
            next: null,
          },
          {
            id: "evert",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "evert",
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
      evert: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_plan" }],
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
      sting: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "back",
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_reserves",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "chose",
      scene: "rus_w_april_council",
      pick: "brusilov_goes",
    },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_brus_reserves" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_brus_reserves",
                chapters: 4,
                keep: {
                  kind: "chose",
                  scene: "rus_w_evert_holds",
                  pick: "reserves_south",
                },
              },
            ],
            next: "promised",
          },
          {
            id: "kovel",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_kovel" }],
            next: "kovel",
          },
          {
            id: "wait",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wait",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "angry",
                effects: [],
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
      promised: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "kovel",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_kovel" }],
            next: "kovel",
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
      kovel: {
        says: [
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
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
      wait: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_brus_reserves" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_brus_reserves",
                chapters: 4,
                keep: {
                  kind: "chose",
                  scene: "rus_w_evert_holds",
                  pick: "reserves_south",
                },
              },
            ],
            next: "promised",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "reason", key: "rus_brus_hung_up" },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_depots",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "world", of: { is: "date", from: "1916-02", to: "1917-12" } },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "prov",
            when: {
              kind: "world",
              of: { is: "regime", of: ["provisional", "rep"] },
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fix",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fix",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "dry",
                effects: [],
              },
            ],
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "fix",
            gain: [{ kind: "remember", key: "k_brus_depots" }],
            miss: "dry",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_brus_depots" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_depots" }],
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
      dry: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fix",
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_brus_after",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "date", from: "1917-01" } },
        {
          kind: "any",
          of: [
            { kind: "world", of: { is: "unrest", min: 1 } },
            { kind: "world", of: { is: "regime", of: ["provisional", "rep"] } },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_brusilov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "prov",
            when: {
              kind: "world",
              of: { is: "regime", of: ["provisional", "rep"] },
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "state",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "state",
          },
          {
            id: "mine",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "mine",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "mine",
                effects: [{ kind: "mood", delta: -1 }],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ally:-1"],
            effects: [
              { kind: "trust", tag: "FRA", delta: -1 },
              { kind: "remember", key: "k_brus_after" },
              { kind: "remember", key: "k_brus_regime" },
            ],
            next: "deal",
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
      state: {
        says: [
          { id: "bad", when: { kind: "gauge", gauge: "morale", max: 1 } },
          { id: "ok", when: { kind: "gauge", gauge: "morale", min: 2 } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_after" }],
            next: null,
          },
          {
            id: "regime",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_brus_regime" }],
            next: "regime",
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
      regime: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
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
      mine: {
        says: [{ id: "base" }],
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_poli_books",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", to: "1916-01" } },
        {
          kind: "not",
          of: { kind: "holder", office: "war", person: "rus_polivanov" },
        },
      ],
    },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "sheet" }, { id: "base" }],
    start: "open",
    starts: { sheet: "p_sheet" },
    nodes: {
      p_sheet: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "book",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "books",
          },
          {
            id: "man",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "p_man",
          },
          {
            id: "read",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_books" }],
            next: "books",
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
      p_man: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              { kind: "remember", key: "k_poli_books" },
              { kind: "remember", key: "k_guch_door" },
            ],
            next: "p_who",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_books" }],
            next: null,
          },
        ],
      },
      p_who: {
        says: [{ id: "base" }],
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
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "books",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "books",
            gain: [{ kind: "remember", key: "k_poli_books" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_poli_books" },
            ],
            next: "deal",
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
      books: {
        says: [
          {
            id: "bad",
            when: {
              kind: "competence",
              who: { person: "rus_sukhomlinov" },
              field: "admin",
              max: 1,
            },
          },
          {
            id: "good",
            when: {
              kind: "competence",
              who: { person: "rus_sukhomlinov" },
              field: "admin",
              min: 2,
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_books" }],
            next: null,
          },
          {
            id: "rival",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rival",
          },
        ],
      },
      rival: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_books" }],
            next: null,
          },
          {
            id: "end2",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_poli_books" },
            ],
            next: null,
          },
        ],
      },
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_t_poli_duma",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 0, max: 5 },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
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
            id: "sharp",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "who",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "side",
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
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_guch_door" },
            ],
            next: "door",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "door",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_door" }],
            next: "door",
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
      side: {
        says: [{ id: "base" }],
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
      door: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_poli_space",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1914-12", to: "1916-01" } },
        {
          kind: "world",
          of: { is: "front", theatre: "east", from: "vistula" },
        },
      ],
    },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "price",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "soft",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: -1 },
              { kind: "remember", key: "k_poli_space" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_space" }],
            next: null,
          },
          {
            id: "people",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "people",
          },
        ],
      },
      people: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "remember", key: "k_poli_space" },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: null,
          },
        ],
      },
      soft: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_t_poli_council",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1914-12", to: "1916-01" } },
        { kind: "gauge", gauge: "shells", max: 1 },
      ],
    },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
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
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "what",
            gain: [{ kind: "remember", key: "k_poli_council" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:+1"],
            effects: [
              { kind: "inst", inst: "duma", delta: 1 },
              { kind: "remember", key: "k_poli_council" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_council" }],
            next: null,
          },
          {
            id: "before",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "before",
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
      before: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              { kind: "remember", key: "k_poli_council" },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_poli_command",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "not", of: { kind: "world", of: { is: "command" } } },
        { kind: "world", of: { is: "date", from: "1915-01", to: "1916-01" } },
        { kind: "world", of: { is: "front", theatre: "east", from: "warsaw" } },
      ],
    },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
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
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "stay",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "cun",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "ministers:+1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "inst", inst: "ministers", delta: 1 },
              { kind: "remember", key: "k_poli_command" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_command" }],
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
      stay: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_command" }],
            next: null,
          },
        ],
      },
      cun: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_poli_command" }],
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_poli_out",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1916-01", to: "1916-12" } },
        { kind: "holder", office: "war", person: "rus_polivanov" },
        { kind: "inst", inst: "court", min: 1 },
      ],
    },
    cast: { p: { person: "rus_polivanov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "next",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "next",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "wall",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["court:-1", "duma:+1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "inst", inst: "duma", delta: 1 },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_poli_stay",
                chapters: 12,
                keep: {
                  kind: "all",
                  of: [
                    { kind: "holder", office: "war", person: "rus_polivanov" },
                    { kind: "world", of: { is: "date", from: "1917-01" } },
                  ],
                },
              },
            ],
            next: "promised",
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
      next: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "thanks",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["court:-1", "duma:+1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "inst", inst: "duma", delta: 1 },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_poli_stay",
                chapters: 12,
                keep: {
                  kind: "all",
                  of: [
                    { kind: "holder", office: "war", person: "rus_polivanov" },
                    { kind: "world", of: { is: "date", from: "1917-01" } },
                  ],
                },
              },
            ],
            next: "promised",
          },
        ],
      },
      wall: {
        says: [{ id: "base" }],
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
      promised: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_guch_first",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "chapter", min: 1 },
        { kind: "world", of: { is: "date", to: "1916-01" } },
        {
          kind: "any",
          of: [
            { kind: "memory", key: "k_guch_door" },
            { kind: "seen", scene: "rus_w_shell_famine" },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_guch_met" },
            ],
            next: "army",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["court:-1", "trust:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_guch_met" },
            ],
            next: "edge",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "duma:+1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "inst", inst: "duma", delta: 1 },
              { kind: "remember", key: "k_guch_met" },
            ],
            next: "deal",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_guch_met" },
            ],
            next: null,
          },
        ],
      },
      army: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "edge",
          },
          {
            id: "mukden",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mukden",
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
      mukden: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "who",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "edge",
          },
        ],
      },
      edge: {
        says: [
          { id: "cand", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "wall",
            stance: "threat",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "reason", key: "rus_guch_family" },
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_guch_wic",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1915-04", to: "1916-01" } },
        { kind: "memory", key: "k_guch_met" },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "price",
            gain: [{ kind: "remember", key: "k_guch_wic" }],
            miss: "sneer",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "sneer",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:+1", "court:-1"],
            effects: [
              { kind: "inst", inst: "duma", delta: 1 },
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_guch_wic" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_wic" }],
            next: null,
          },
          {
            id: "poli",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "poli",
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
      poli: {
        says: [{ id: "base" }],
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
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_wic" }],
            next: null,
          },
        ],
      },
      sneer: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
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
      deal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_guch_myasoedov",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1915-03", to: "1916-01" } },
        { kind: "memory", key: "k_guch_met" },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "true",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "rus_myasoedov_spy" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "rus_myasoedov_spy" },
                  },
                ],
              },
            ],
            next: "truth",
          },
          {
            id: "min",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "min",
            gain: [{ kind: "remember", key: "k_guch_myasoedov" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:-1"],
            effects: [
              { kind: "inst", inst: "duma", delta: -1 },
              { kind: "remember", key: "k_guch_myasoedov" },
            ],
            next: "deal",
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
          { id: "yes", when: { kind: "secret", id: "rus_myasoedov_spy" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "min",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_myasoedov" }],
            next: "min",
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
      min: {
        says: [{ id: "base" }],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_t_guch_workers",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1915-08", to: "1917-01" } },
        { kind: "memory", key: "k_guch_met" },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "risk",
          },
          {
            id: "push",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "risk",
            gain: [{ kind: "remember", key: "k_guch_workers" }],
            miss: "sneer",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["court:-1", "order:+1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "gauge", gauge: "order", delta: 1 },
              { kind: "remember", key: "k_guch_workers" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_guch_workers",
                chapters: 8,
                keep: {
                  kind: "chose",
                  scene: "rus_h_war_industry",
                  pick: "workers_group",
                },
              },
            ],
            next: "promised",
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
      risk: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_workers" }],
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
      sneer: {
        says: [{ id: "base" }],
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
      promised: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_guch_letters",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1916-02", to: "1917-01" } },
        { kind: "memory", key: "k_guch_met" },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "plot",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: { kind: "secret", id: "rus_palace_plot" },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "rus_palace_plot" },
                  },
                ],
              },
            ],
            next: "plot",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "duma:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "inst", inst: "duma", delta: -1 },
            ],
            next: "edge",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: -1 },
              { kind: "remember", key: "m_rus_guch_burned" },
            ],
            next: "deal",
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
      plot: {
        says: [
          { id: "yes", when: { kind: "secret", id: "rus_palace_plot" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "side",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "side",
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
      side: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      edge: {
        says: [{ id: "base" }],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_t_guch_terms",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            { kind: "not", of: { kind: "world", of: { is: "command" } } },
            { kind: "flag", flag: "f_rus_in_capital" },
          ],
        },
        { kind: "world", of: { is: "date", from: "1917-01" } },
        { kind: "memory", key: "k_guch_met" },
        { kind: "world", of: { is: "unrest", min: 1 } },
        { kind: "world", of: { is: "regime", of: ["tsar", "crown"] } },
      ],
    },
    cast: { p: { person: "rus_guchkov" } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "boy",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "boy",
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            tell: ["trust:-2", "duma:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -2 },
              { kind: "inst", inst: "duma", delta: -1 },
            ],
            next: "edge",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              { kind: "inst", inst: "court", delta: -1 },
              { kind: "remember", key: "k_guch_terms" },
            ],
            next: "deal",
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
      boy: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "terms",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_guch_terms" }],
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
      edge: {
        says: [{ id: "base" }],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_v_danilov_map",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "chapter", min: 5 },
        { kind: "world", of: { is: "date", to: "1916-01" } },
      ],
    },
    cast: { p: { person: "rus_danilov" } },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "dates" }, { id: "base" }],
    start: "open",
    starts: { dates: "d_dates" },
    nodes: {
      d_dates: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "nw",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_danilov_nw" }],
            next: "deal",
          },
          {
            id: "sw",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "alek",
          },
          {
            id: "both",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "d_both",
          },
        ],
      },
      d_both: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rail",
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
            id: "st",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
          { id: "base" },
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
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "rail",
            gain: [{ kind: "remember", key: "k_danilov_nw" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_danilov_nw" },
            ],
            next: "deal",
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
      rail: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_danilov_nw" }],
            next: null,
          },
          {
            id: "alek",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "alek",
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
      alek: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_danilov_nw" }],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_v_yan_letter",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 9 },
        { kind: "world", of: { is: "date", to: "1916-01" } },
        { kind: "gauge", gauge: "shells", max: 1 },
      ],
    },
    cast: { p: { person: "rus_yanushkevich" } },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "hands" }, { id: "base" }],
    start: "open",
    starts: { hands: "y_hands" },
    nodes: {
      y_hands: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "took",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_yan_letter" }],
            next: null,
          },
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "y_none",
          },
        ],
      },
      y_none: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_yan_letter" }],
            next: null,
          },
        ],
      },
      open: {
        says: [
          {
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "num",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "num",
            gain: [{ kind: "remember", key: "k_yan_letter" }],
            miss: "shake",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: 1 },
              { kind: "remember", key: "k_yan_letter" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_yan_letter" }],
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "soft",
            stance: "warm",
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_v_yud_snow",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "open", theatre: "caucasus" } },
        { kind: "world", of: { is: "date", from: "1915-01", to: "1917-01" } },
      ],
    },
    cast: { p: { person: "rus_yudenich" } },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "st",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "snow",
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "snow",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "dry",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["money:-1"],
            effects: [
              { kind: "gauge", gauge: "money", delta: -1 },
              { kind: "remember", key: "k_yud_snow" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_yud_snow" }],
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
      dry: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_v_kolchak_bosporus",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: { kind: "world", of: { is: "date", from: "1916-02", to: "1917-12" } },
    cast: { p: { person: "rus_kolchak" } },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "date" }, { id: "base" }],
    start: "open",
    starts: { date: "k_date" },
    nodes: {
      k_date: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "pick",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_kolchak_bosporus" }],
            next: "deal",
          },
          {
            id: "why",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
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
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          { id: "base" },
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
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "how",
                effects: [{ kind: "mood", delta: 1 }],
              },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              { kind: "inst", inst: "stavka", delta: -1 },
              { kind: "remember", key: "k_kolchak_bosporus" },
            ],
            next: "deal",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_kolchak_bosporus" }],
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
      deal: {
        says: [{ id: "base" }],
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
    id: "rus_v_evert_doubt",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        { kind: "world", of: { is: "war" } },
        { kind: "world", of: { is: "date", from: "1916-01", to: "1916-12" } },
      ],
    },
    cast: { p: { person: "rus_evert" } },
    salience: 6,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "two_sheets" }, { id: "base" }],
    start: "open",
    starts: { two_sheets: "e_two" },
    nodes: {
      e_two: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "left",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [{ kind: "remember", key: "k_evert_doubt" }],
            next: "both",
          },
          {
            id: "right",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_evert_doubt" }],
            next: "deal",
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "both",
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
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "both",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "both",
            gain: [{ kind: "remember", key: "k_evert_doubt" }],
            miss: "stiff",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["shells:-1"],
            effects: [
              { kind: "gauge", gauge: "shells", delta: -1 },
              { kind: "remember", key: "k_evert_doubt" },
            ],
            next: "deal",
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
      both: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_evert_doubt" }],
            next: null,
          },
          {
            id: "brus",
            stance: "cold",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_evert_doubt" }],
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
      stiff: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "both",
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
      deal: {
        says: [{ id: "base" }],
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
];
