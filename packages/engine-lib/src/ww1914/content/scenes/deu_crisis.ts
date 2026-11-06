import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「독일 1914년」, the crisis share: the deu_c_ scenes and the talks of Jagow,
 * Zimmermann, Lichnowsky, Pourtalès and Tschirschky. Data only; the text is in
 * resources/ww1914/ko/DEU.crisis.json.
 */
export const DEU_CRISIS_SCENES: readonly GwScene[] = [
  {
    id: "deu_c_kiel_wire",
    nation: ["DEU"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 0 },
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
      ],
    },
    cast: { court: { office: "court" } },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "failed", when: { kind: "opening", of: ["sarajevo_failed"] } },
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_first_words",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 0 },
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "failed", when: { kind: "opening", of: ["sarajevo_failed"] } },
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
    fallback: "condole",
    options: [
      {
        id: "condole",
        tell: [],
        effects: [{ kind: "reason", key: "c_first_words_r1" }],
      },
      {
        id: "go_vienna",
        tell: ["auh:+1", "temp:+1", "countersign:-1", "chancellor:-1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "inst", inst: "countersign", delta: -1 },
          { kind: "flag", flag: "f_went_vienna" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "send_prince",
        tell: ["auh:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "flag", flag: "f_sent_prince" },
        ],
      },
      {
        id: "ask_vienna",
        when: { kind: "memory", key: "k_tsch_air" },
        tell: ["auh:+1", "fm:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "flag", flag: "f_asked_vienna" },
          { kind: "person_trust", who: { role: "fm" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_blank_cheque",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        {
          kind: "all",
          of: [
            { kind: "crisis", topic: "balkan" },
            {
              kind: "any",
              of: [
                {
                  kind: "all",
                  of: [
                    { kind: "chapter", min: 1, max: 1 },
                    {
                      kind: "not",
                      of: { kind: "opening", of: ["sarajevo_delayed"] },
                    },
                  ],
                },
                {
                  kind: "all",
                  of: [
                    { kind: "chapter", min: 2, max: 2 },
                    { kind: "opening", of: ["sarajevo_delayed"] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    cast: {
      chancellor: { office: "chancellor" },
      cos: { office: "chief_of_staff" },
      war: { office: "war" },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "margin", when: { kind: "flag", flag: "f_margin_now" } },
      { id: "went", when: { kind: "flag", flag: "f_went_vienna" } },
      { id: "delayed", when: { kind: "opening", of: ["sarajevo_delayed"] } },
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
    fallback: "delay",
    options: [
      {
        id: "delay",
        tell: ["army:-1", "auh:-1", "delay:2"],
        effects: [
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "delay", days: 2 },
          { kind: "flag", flag: "f_cheque_delayed" },
        ],
      },
      {
        id: "back_full",
        tell: ["army:+1", "auh:+2", "temp:+2", "chancellor:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "AUH", delta: 2 },
          { kind: "temp", delta: 2 },
          { kind: "flag", flag: "f_cheque_full" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "term_limit",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_beth_deadline" },
            { kind: "memory", key: "k_hoyos_deadline" },
          ],
        },
        tell: ["auh:+1", "temp:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_cheque_limit" },
        ],
      },
      {
        id: "no_annex",
        when: { kind: "memory", key: "k_tsch_annex" },
        tell: ["auh:-1", "rus:+1", "temp:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_cheque_no_annex" },
        ],
      },
      {
        id: "italy_first",
        when: { kind: "memory", key: "k_jagow_italy" },
        tell: ["auh:-1", "ita:+2", "temp:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "trust", tag: "ITA", delta: 2 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_cheque_italy" },
        ],
      },
      {
        id: "ask_london",
        when: { kind: "memory", key: "k_lich_grey" },
        tell: ["gbr:+1", "auh:-1", "delay:3", "army:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "delay", days: 3 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_cheque_london" },
        ],
      },
    ],
  },
  {
    id: "deu_c_cruise",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 2 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, court: { office: "court" } },
    salience: 8,
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      { id: "full", when: { kind: "flag", flag: "f_cheque_full" } },
      { id: "limit", when: { kind: "flag", flag: "f_cheque_limit" } },
      { id: "delayed", when: { kind: "flag", flag: "f_cheque_delayed" } },
      { id: "base" },
    ],
    fallback: "sail",
    options: [
      {
        id: "sail",
        tell: ["temp:-1", "countersign:+1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "flag", flag: "f_cruise_sailed" },
          { kind: "inst", inst: "countersign", delta: 1 },
        ],
      },
      {
        id: "stay",
        tell: ["temp:+1", "chancellor:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_cruise_stayed" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "wire_ship",
        when: { kind: "memory", key: "k_muller_cruise" },
        tell: ["temp:-1", "court:+1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "flag", flag: "f_cruise_sailed" },
          { kind: "flag", flag: "f_cruise_wired" },
          { kind: "person_trust", who: { role: "court" }, delta: 1 },
        ],
      },
      {
        id: "recall_staff",
        when: { kind: "memory", key: "k_moltke_window" },
        tell: ["temp:+1", "army:+1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "flag", flag: "f_cruise_sailed" },
          { kind: "flag", flag: "f_staff_recalled" },
        ],
      },
    ],
  },
  {
    id: "deu_c_ultimatum_text",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 2 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {
      fm: { office: "foreign" },
      amb_vienna: { office: "ambassador_vienna" },
    },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "no_annex", when: { kind: "flag", flag: "f_cheque_no_annex" } },
      { id: "limit", when: { kind: "flag", flag: "f_cheque_limit" } },
      {
        id: "sea",
        when: {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_cruise_sailed" },
            { kind: "not", of: { kind: "flag", flag: "f_cruise_wired" } },
          ],
        },
      },
      { id: "base" },
    ],
    fallback: "not_read",
    options: [
      {
        id: "not_read",
        tell: ["auh:+1", "temp:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_text_unread" },
        ],
      },
      {
        id: "demand_draft",
        when: { kind: "memory", key: "k_tsch_draft" },
        tell: ["auh:-1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "flag", flag: "f_text_read" },
        ],
      },
      {
        id: "soften",
        when: { kind: "memory", key: "k_jagow_text" },
        tell: ["auh:-2", "temp:-2", "army:-1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: -2 },
          { kind: "temp", delta: -2 },
          { kind: "flag", flag: "f_text_softened" },
          { kind: "inst", inst: "army", delta: -1 },
        ],
      },
      {
        id: "hurry",
        when: { kind: "memory", key: "k_zimm_speed" },
        tell: ["auh:+1", "temp:+2", "army:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "temp", delta: 2 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "flag", flag: "f_text_hurried" },
        ],
      },
    ],
  },
  {
    id: "deu_c_serbian_reply",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" }, chancellor: { office: "chancellor" } },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "soft", when: { kind: "flag", flag: "f_text_softened" } },
      {
        id: "sea",
        when: {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_cruise_sailed" },
            { kind: "not", of: { kind: "flag", flag: "f_cruise_wired" } },
          ],
        },
      },
      { id: "reject", when: { kind: "flag", flag: "f_text_hurried" } },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      {
        id: "wait",
        tell: ["temp:+1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_reply_waited" },
        ],
      },
      {
        id: "press_war",
        tell: ["temp:+2", "army:+1", "auh:+1", "gbr:-1", "chancellor:-1"],
        effects: [
          { kind: "temp", delta: 2 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "flag", flag: "f_reply_pressed" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "halt_belgrade",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_beth_halt" },
            { kind: "memory", key: "k_tsch_halt" },
          ],
        },
        tell: ["temp:-2", "auh:-1", "gbr:+1", "rus:+1", "army:-1"],
        effects: [
          { kind: "temp", delta: -2 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_halt_belgrade" },
        ],
      },
      {
        id: "mediate",
        when: { kind: "memory", key: "k_lich_conf" },
        tell: ["temp:-3", "gbr:+2", "auh:-2", "army:-1"],
        effects: [
          { kind: "temp", delta: -3 },
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "trust", tag: "AUH", delta: -2 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_mediate" },
        ],
      },
    ],
  },
  {
    id: "deu_c_nicky",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        {
          kind: "all",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "temp", min: 5 },
          ],
        },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "halt", when: { kind: "flag", flag: "f_halt_belgrade" } },
      { id: "cold", when: { kind: "trust", tag: "RUS", max: -1 } },
      {
        id: "sea",
        when: {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_cruise_sailed" },
            { kind: "not", of: { kind: "flag", flag: "f_cruise_wired" } },
          ],
        },
      },
      { id: "base" },
    ],
    fallback: "firm",
    options: [
      {
        id: "firm",
        tell: ["temp:+1", "rus:-1", "army:+1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "flag", flag: "f_nicky_firm" },
        ],
      },
      {
        id: "warm",
        tell: ["temp:-1", "rus:+1", "army:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_nicky_warm" },
        ],
      },
      {
        id: "no_wire",
        tell: ["temp:+1", "rus:-2"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -2 },
          { kind: "flag", flag: "f_nicky_silent" },
        ],
      },
      {
        id: "accept_hague",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_pour_tsar" },
            { kind: "memory", key: "k_nicky_hague" },
          ],
        },
        tell: ["temp:-3", "rus:+2", "auh:-2", "army:-2", "fm:+1"],
        effects: [
          { kind: "temp", delta: -3 },
          { kind: "trust", tag: "RUS", delta: 2 },
          { kind: "trust", tag: "AUH", delta: -2 },
          { kind: "inst", inst: "army", delta: -2 },
          { kind: "flag", flag: "f_hague" },
          { kind: "person_trust", who: { role: "fm" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_kriegsgefahr",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        {
          kind: "all",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "temp", min: 6 },
          ],
        },
      ],
    },
    cast: {
      chancellor: { office: "chancellor" },
      cos: { office: "chief_of_staff" },
    },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "conrad", when: { kind: "inst", inst: "countersign", max: -1 } },
      { id: "hague", when: { kind: "flag", flag: "f_hague" } },
      { id: "halt", when: { kind: "flag", flag: "f_halt_belgrade" } },
      { id: "base" },
    ],
    fallback: "wait_day",
    options: [
      {
        id: "wait_day",
        tell: ["army:-1", "delay:1"],
        effects: [
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "delay", days: 1 },
          { kind: "flag", flag: "f_kg_waited" },
        ],
      },
      {
        id: "sign_now",
        tell: ["army:+2", "temp:+2", "countersign:-1", "chancellor:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 2 },
          { kind: "temp", delta: 2 },
          { kind: "inst", inst: "countersign", delta: -1 },
          { kind: "flag", flag: "f_kg_signed" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "wait_chancellor",
        when: { kind: "memory", key: "k_beth_countersign" },
        tell: [
          "countersign:+2",
          "army:-1",
          "temp:+1",
          "chancellor:+1",
          "cos:-1",
        ],
        effects: [
          { kind: "inst", inst: "countersign", delta: 2 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_kg_signed" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: 1 },
          { kind: "person_trust", who: { role: "cos" }, delta: -1 },
        ],
      },
      {
        id: "overrule_cos",
        when: { kind: "memory", key: "k_falk_on_moltke" },
        tell: ["army:-2", "countersign:+2", "temp:-1", "cos:-2"],
        effects: [
          { kind: "inst", inst: "army", delta: -2 },
          { kind: "inst", inst: "countersign", delta: 2 },
          { kind: "temp", delta: -1 },
          { kind: "person_trust", who: { role: "cos" }, delta: -2 },
          { kind: "flag", flag: "f_cos_overruled" },
        ],
      },
    ],
  },
  {
    id: "deu_c_mobilise",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        {
          kind: "all",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "temp", min: 6 },
            { kind: "not", of: { kind: "flag", flag: "f_west_plan" } },
            { kind: "not", of: { kind: "flag", flag: "f_east_first" } },
          ],
        },
      ],
    },
    cast: {
      cos: { office: "chief_of_staff" },
      chancellor: { office: "chancellor" },
      navy: { office: "navy" },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    cooldown: 1,
    variants: [
      { id: "waited", when: { kind: "flag", flag: "f_mob_waited" } },
      { id: "hague", when: { kind: "flag", flag: "f_hague" } },
      {
        id: "rus_partial",
        when: {
          kind: "all",
          of: [
            { kind: "trust", tag: "RUS", min: 1 },
            { kind: "flag", flag: "f_nicky_warm" },
          ],
        },
      },
      { id: "full", when: { kind: "flag", flag: "f_cheque_full" } },
      { id: "base" },
    ],
    fallback: "wait_day",
    options: [
      {
        id: "wait_day",
        tell: ["delay:1", "army:-1"],
        effects: [
          { kind: "delay", days: 1 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_mob_waited" },
          { kind: "reason", key: "c_mobilise_r1" },
        ],
      },
      {
        id: "west_plan",
        tell: ["army:+2", "temp:+3", "gbr:-1", "cos:+1", "chancellor:-1"],
        effects: [
          { kind: "flag", flag: "f_west_plan" },
          { kind: "inst", inst: "army", delta: 2 },
          { kind: "temp", delta: 3 },
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "person_trust", who: { role: "cos" }, delta: 1 },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "east_first",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_moltke_east" },
            { kind: "memory", key: "k_lud_rail" },
          ],
        },
        tell: ["army:-2", "temp:+2", "gbr:+1", "fra:+1", "cos:-2"],
        effects: [
          { kind: "flag", flag: "f_east_first" },
          { kind: "inst", inst: "army", delta: -2 },
          { kind: "temp", delta: 2 },
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "person_trust", who: { role: "cos" }, delta: -2 },
          { kind: "pride", who: { role: "cos" }, delta: -1 },
        ],
      },
      {
        id: "liege_first",
        when: { kind: "memory", key: "k_lud_liege" },
        tell: [
          "army:+3",
          "temp:+3",
          "gbr:-2",
          "countersign:-1",
          "chancellor:-1",
        ],
        effects: [
          { kind: "flag", flag: "f_west_plan" },
          { kind: "flag", flag: "f_liege_first" },
          { kind: "inst", inst: "army", delta: 3 },
          { kind: "temp", delta: 3 },
          { kind: "trust", tag: "GBR", delta: -2 },
          { kind: "inst", inst: "countersign", delta: -1 },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "last_wire",
        when: { kind: "memory", key: "k_nicky_trust" },
        tell: ["delay:1", "temp:-2", "rus:+1", "army:-1", "cos:-1"],
        effects: [
          { kind: "flag", flag: "f_last_wire" },
          { kind: "delay", days: 1 },
          { kind: "temp", delta: -2 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "person_trust", who: { role: "cos" }, delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_belgium_note",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 6 },
        { kind: "flag", flag: "f_west_plan" },
      ],
    },
    cast: {
      cos: { office: "chief_of_staff" },
      fm: { office: "foreign" },
      chancellor: { office: "chancellor" },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "albert", when: { kind: "memory", key: "k_albert_letter" } },
      { id: "goschen", when: { kind: "memory", key: "k_goschen_warn" } },
      { id: "liege", when: { kind: "flag", flag: "f_liege_first" } },
      { id: "base" },
    ],
    fallback: "send",
    options: [
      {
        id: "send",
        tell: ["army:+1", "temp:+1", "gbr:-2", "bel:-3"],
        effects: [
          { kind: "flag", flag: "f_belgium_sent" },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -2 },
          { kind: "trust", tag: "BEL", delta: -3 },
        ],
      },
      {
        id: "lux_only",
        when: { kind: "memory", key: "k_goschen_warn" },
        tell: ["army:-3", "gbr:+2", "cos:-2", "delay:3"],
        effects: [
          { kind: "flag", flag: "f_lux_only" },
          { kind: "inst", inst: "army", delta: -3 },
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "person_trust", who: { role: "cos" }, delta: -2 },
          { kind: "delay", days: 3 },
        ],
      },
      {
        id: "pay_for_passage",
        when: { kind: "memory", key: "k_moltke_liege" },
        tell: ["gbr:-1", "bel:-2", "money:-1"],
        effects: [
          { kind: "flag", flag: "f_belgium_sent" },
          { kind: "flag", flag: "f_paid_offer" },
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "trust", tag: "BEL", delta: -2 },
          { kind: "gauge", gauge: "money", delta: -1 },
        ],
      },
      {
        id: "letter_to_king",
        when: { kind: "memory", key: "k_albert_letter" },
        tell: ["delay:1", "army:-1", "gbr:-1", "bel:-1"],
        effects: [
          { kind: "flag", flag: "f_belgium_sent" },
          { kind: "flag", flag: "f_king_letter" },
          { kind: "delay", days: 1 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "trust", tag: "BEL", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_war_speech",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 6 },
        {
          kind: "any",
          of: [
            { kind: "at_war", tag: "RUS" },
            { kind: "at_war", tag: "FRA" },
          ],
        },
      ],
    },
    cast: {
      chancellor: { office: "chancellor" },
      interior: { office: "interior" },
      finance: { office: "finance" },
    },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      { id: "belgium", when: { kind: "flag", flag: "f_belgium_sent" } },
      { id: "gbr", when: { kind: "at_war", tag: "GBR" } },
      { id: "east", when: { kind: "flag", flag: "f_east_first" } },
      { id: "base" },
    ],
    fallback: "plain_speech",
    options: [
      {
        id: "plain_speech",
        tell: ["reichstag:+1", "money:+1"],
        effects: [
          { kind: "inst", inst: "reichstag", delta: 1 },
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "flag", flag: "f_plain_speech" },
        ],
      },
      {
        id: "emergency_law",
        when: { kind: "memory", key: "k_delb_enabling" },
        tell: [
          "reichstag:-1",
          "order:+1",
          "bread:+1",
          "money:+1",
          "interior:+1",
        ],
        effects: [
          { kind: "inst", inst: "reichstag", delta: -1 },
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "gauge", gauge: "bread", delta: 1 },
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "flag", flag: "f_enabling_law" },
          { kind: "person_trust", who: { role: "interior" }, delta: 1 },
        ],
      },
      {
        id: "franchise_word",
        when: { kind: "memory", key: "k_delb_franchise" },
        tell: ["reichstag:+2", "army:-1", "morale:+1"],
        effects: [
          { kind: "inst", inst: "reichstag", delta: 2 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "flag", flag: "f_franchise_word" },
        ],
      },
      {
        id: "pledge_haase",
        when: { kind: "memory", key: "k_haase_promise" },
        tell: ["reichstag:+2", "army:-1", "order:+1"],
        effects: [
          {
            kind: "keep_promise",
            who: { person: "deu_haase" },
            key: "k_haase_promise",
          },
          { kind: "inst", inst: "reichstag", delta: 2 },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "flag", flag: "f_pledged_haase" },
          { kind: "gauge", gauge: "order", delta: 1 },
        ],
      },
      {
        id: "loan_and_tax",
        when: { kind: "memory", key: "k_kuhn_loan" },
        tell: ["money:+2", "reichstag:+1", "finance:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: 2 },
          { kind: "inst", inst: "reichstag", delta: 1 },
          { kind: "person_trust", who: { role: "finance" }, delta: 1 },
          { kind: "flag", flag: "f_war_tax" },
        ],
      },
    ],
  },
  {
    id: "deu_t_tsch_air",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 0, max: 1 },
    cast: { p: { person: "deu_tschirschky" } },
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "shrug",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 1 },
                next: "inside",
                effects: [{ kind: "remember", key: "k_tsch_air" }],
              },
            ],
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "inside",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "sour",
                effects: [{ kind: "reason", key: "t_tsch_air_r1" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "tsch_read",
                chapters: 3,
              },
              { kind: "remember", key: "k_tsch_air" },
            ],
            next: "inside",
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
      shrug: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_tsch_air" }],
            next: "inside",
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
      inside: {
        says: [
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "thanks",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "lich",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_lich",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "on_lich",
                effects: [
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
            ],
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
      sour: {
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
      on_lich: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
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
    id: "deu_t_tsch_annex",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 1 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_tschirschky" } },
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
            next: "split",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "split",
                effects: [{ kind: "remember", key: "k_tsch_annex" }],
              },
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "split",
                effects: [{ kind: "remember", key: "k_tsch_annex" }],
              },
            ],
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "auh:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "trust", tag: "AUH", delta: -1 },
            ],
            next: "forced",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "forced",
                effects: [{ kind: "remember", key: "k_tsch_annex" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "tsch_annex_credit",
                chapters: 3,
              },
              { kind: "remember", key: "k_tsch_annex" },
            ],
            next: "split",
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
      split: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "use",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "conrad",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_conrad",
          },
          {
            id: "hard",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      forced: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_tsch_annex_r1" }],
            next: null,
          },
        ],
      },
      on_conrad: {
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
    id: "deu_t_tsch_berchtold",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 1, max: 3 },
    cast: { p: { person: "deu_tschirschky" } },
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
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lever",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "lever",
                effects: [{ kind: "remember", key: "k_tsch_berchtold" }],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lever",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "lever",
                effects: [
                  { kind: "remember", key: "k_tsch_berchtold" },
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "thin",
                effects: [{ kind: "reason", key: "t_tsch_berchtold_r1" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "tsch_channel",
                chapters: 3,
              },
              { kind: "remember", key: "k_tsch_berchtold" },
            ],
            next: "lever",
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
      lever: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "good",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "hoyos",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_hoyos",
          },
          {
            id: "mean",
            stance: "cold",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      thin: {
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
      on_hoyos: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
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
    id: "deu_t_tsch_draft",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 2 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_tschirschky" } },
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
            next: "how",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "how",
                effects: [{ kind: "remember", key: "k_tsch_draft" }],
              },
            ],
          },
          {
            id: "order",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "auh:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "trust", tag: "AUH", delta: -1 },
            ],
            next: "how",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "sting",
                effects: [{ kind: "reason", key: "t_tsch_draft_r1" }],
              },
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "how",
                effects: [{ kind: "remember", key: "k_tsch_draft" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "tsch_draft_cover",
                chapters: 2,
              },
              { kind: "remember", key: "k_tsch_draft" },
            ],
            next: "how",
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
      how: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "jagow",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_jagow",
          },
          {
            id: "all",
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
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "yes",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_tsch_draft" }],
            next: null,
          },
        ],
      },
      on_jagow: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "reason", key: "t_tsch_draft_r2" },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_tsch_halt",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_tschirschky" } },
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "place",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "place",
                effects: [{ kind: "remember", key: "k_tsch_halt" }],
              },
            ],
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "place",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "mock",
                effects: [{ kind: "reason", key: "t_tsch_halt_r1" }],
              },
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "place",
                effects: [{ kind: "remember", key: "k_tsch_halt" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "tsch_home",
                chapters: 4,
              },
              { kind: "remember", key: "k_tsch_halt" },
            ],
            next: "place",
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
      place: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "beth",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_beth",
          },
          {
            id: "late",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      mock: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
          {
            id: "soft",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_tsch_halt" },
            ],
            next: null,
          },
        ],
      },
      on_beth: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
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
    id: "deu_t_tsch_galicia",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7, max: 9 },
        { kind: "at_war", tag: "RUS" },
      ],
    },
    cast: { p: { person: "deu_tschirschky" } },
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
            next: "numbers",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "numbers",
                effects: [{ kind: "remember", key: "k_tsch_galicia" }],
              },
            ],
          },
          {
            id: "blame",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "blame",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "numbers",
                effects: [
                  { kind: "remember", key: "k_tsch_galicia" },
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
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
                kind: "promise",
                who: { role: "p" },
                key: "tsch_corps",
                chapters: 3,
              },
              { kind: "remember", key: "k_tsch_galicia" },
            ],
            next: "numbers",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_tsch_galicia_r1" }],
            next: null,
          },
        ],
      },
      numbers: {
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
            id: "conrad",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_conrad",
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
      blame: {
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
      on_conrad: {
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
          {
            id: "end2",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_jagow_italy",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 1, max: 3 },
    cast: { p: { person: "deu_jagow" } },
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
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
            next: "seven",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "seven",
                effects: [{ kind: "remember", key: "k_jagow_italy" }],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "push",
            tell: [],
            effects: [],
            next: "seven",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "thin",
                effects: [{ kind: "reason", key: "t_jagow_italy_r1" }],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "seven",
                effects: [
                  { kind: "remember", key: "k_jagow_italy" },
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
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
                kind: "promise",
                who: { role: "p" },
                key: "jagow_rome_letter",
                chapters: 3,
              },
              { kind: "remember", key: "k_jagow_italy" },
            ],
            next: "seven",
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
      seven: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "zimm",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_zimm",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "on_zimm",
                effects: [
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
            ],
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
      thin: {
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
      on_zimm: {
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
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_jagow_text",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_jagow" } },
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
            next: "clause",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "clause",
                effects: [{ kind: "remember", key: "k_jagow_text" }],
              },
            ],
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "clause",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "clause",
                effects: [{ kind: "remember", key: "k_jagow_text" }],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "freeze",
                effects: [{ kind: "reason", key: "t_jagow_text_r1" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "jagow_text_cover",
                chapters: 2,
              },
              { kind: "remember", key: "k_jagow_text" },
            ],
            next: "clause",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      clause: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "zimm",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_zimm",
          },
          {
            id: "hm",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      freeze: {
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
          {
            id: "soft",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_jagow_text" }],
            next: "clause",
          },
        ],
      },
      on_zimm: {
        says: [
          {
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          { id: "base" },
        ],
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
    },
  },
  {
    id: "deu_t_zimm_speed",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_zimmermann" } },
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
            id: "ask",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "days",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "days",
                effects: [{ kind: "remember", key: "k_zimm_speed" }],
              },
            ],
          },
          {
            id: "flat",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "days",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "days",
                effects: [
                  { kind: "remember", key: "k_zimm_speed" },
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
            ],
          },
          {
            id: "doubt",
            stance: "frank",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "laugh",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "zimm_speed_credit",
                chapters: 2,
              },
            ],
            next: "days",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_zimm_speed" }],
            next: null,
          },
          {
            id: "beth",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_beth",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "on_beth",
                effects: [
                  {
                    kind: "person_trust",
                    who: { person: "deu_bethmann" },
                    delta: -1,
                  },
                  { kind: "reason", key: "t_zimm_speed_r1" },
                ],
              },
            ],
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
      laugh: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
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
      on_beth: {
        says: [
          {
            id: "cun",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
          },
          { id: "base" },
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
    id: "deu_t_lich_grey",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 0, max: 2 },
    cast: { p: { person: "deu_lichnowsky" } },
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
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
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
            next: "man",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "man",
                effects: [{ kind: "remember", key: "k_lich_grey" }],
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "hedge",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["stubborn"],
                },
                next: "man",
                effects: [{ kind: "remember", key: "k_lich_grey" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "lich_read",
                chapters: 4,
              },
              { kind: "remember", key: "k_lich_grey" },
            ],
            next: "man",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              { kind: "reason", key: "t_lich_grey_r1" },
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
            ],
            next: null,
          },
        ],
      },
      man: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "tirp",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_tirp",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "on_tirp",
                effects: [
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
            ],
          },
          {
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      hedge: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "try",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_lich_grey" },
            ],
            next: "man",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      on_tirp: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
          {
            id: "end2",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_lich_conf",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_lichnowsky" } },
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
            next: "hand",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "hand",
                effects: [{ kind: "remember", key: "k_lich_conf" }],
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "hand",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "stung",
                effects: [{ kind: "reason", key: "t_lich_conf_r1" }],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["stubborn"],
                },
                next: "hand",
                effects: [{ kind: "remember", key: "k_lich_conf" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "lich_answer",
                chapters: 2,
              },
              { kind: "remember", key: "k_lich_conf" },
            ],
            next: "hand",
          },
          {
            id: "leave",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      hand: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "jagow",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_jagow",
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
      stung: {
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
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_lich_conf" }],
            next: "hand",
          },
        ],
      },
      on_jagow: {
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
    },
  },
  {
    id: "deu_t_pour_tsar",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_pourtales" } },
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
            next: "tsar",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "tsar",
                effects: [{ kind: "remember", key: "k_pour_tsar" }],
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "tsar",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "broke",
                effects: [{ kind: "reason", key: "t_pour_tsar_r1" }],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "tsar",
                effects: [{ kind: "remember", key: "k_pour_tsar" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "pour_cover",
                chapters: 3,
              },
              { kind: "remember", key: "k_pour_tsar" },
            ],
            next: "tsar",
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
      tsar: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "grand",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_grand",
          },
          {
            id: "hard",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      broke: {
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
            id: "hard",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      on_grand: {
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
    },
  },
  {
    id: "deu_t_jagow_russia",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 3 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "opening", of: ["no_sarajevo"] },
          ],
        },
      ],
    },
    cast: { p: { person: "deu_jagow" } },
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
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
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
            next: "source",
            reacts: [
              {
                when: {
                  kind: "any",
                  of: [
                    { kind: "temperament", who: { role: "p" }, of: ["weary"] },
                    {
                      kind: "temperament",
                      who: { role: "p" },
                      of: ["anxious"],
                    },
                  ],
                },
                next: "source",
                effects: [{ kind: "remember", key: "heard_jagow_on_pour" }],
              },
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 1 },
                next: "source",
                effects: [{ kind: "remember", key: "heard_jagow_on_pour" }],
              },
            ],
          },
          {
            id: "rail",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rail",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "pale",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "own",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "jagow_russia_cover",
                chapters: 3,
              },
            ],
            next: "rail",
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
      source: {
        says: [
          {
            id: "weak",
            when: { kind: "source_band", source: "embassy_petersburg", max: 1 },
          },
          {
            id: "strong",
            when: { kind: "source_band", source: "embassy_petersburg", min: 3 },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "more",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: "rail",
          },
          {
            id: "moltke",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_moltke",
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
      rail: {
        says: [
          { id: "secret", when: { kind: "secret", id: "rus_rail_ahead" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "tell",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "keep",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      pale: {
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
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_jagow_russia_r1" }],
            next: null,
          },
        ],
      },
      own: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      on_moltke: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "heard_jagow_on_moltke" }],
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
    id: "deu_t_jagow_london",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: { kind: "chapter", min: 3, max: 8 },
    cast: { p: { person: "deu_jagow" } },
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
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
            next: "why",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "why",
                effects: [{ kind: "remember", key: "k_jagow_doubt" }],
              },
            ],
          },
          {
            id: "needle",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "stiff",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "why",
                effects: [{ kind: "remember", key: "k_jagow_doubt" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "jagow_london_two",
                chapters: 3,
              },
              { kind: "remember", key: "k_jagow_london" },
            ],
            next: "after",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "after",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_jagow_london" }],
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "tirp",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_tirp",
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
      stiff: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_jagow_london_r1" }],
            next: null,
          },
          {
            id: "sorry",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
        ],
      },
      on_tirp: {
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
    id: "deu_t_jagow_tired",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        { kind: "temp", min: 6 },
      ],
    },
    cast: { p: { person: "deu_jagow" } },
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
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          {
            id: "cold",
            when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
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
            next: "truth",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "truth",
                effects: [],
              },
            ],
          },
          {
            id: "order",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "sleep",
            reacts: [
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "stiff",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "jagow_resign",
                chapters: 4,
              },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: "thanks",
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
      truth: {
        says: [
          {
            id: "frail",
            when: { kind: "health", who: { person: "deu_jagow" }, max: 1 },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "zimm",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "zimm",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      zimm: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "heard_jagow_on_zimm" }],
            next: null,
          },
        ],
      },
      sleep: {
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
        ],
      },
      stiff: {
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
      thanks: {
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
    id: "deu_t_jagow_poland",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: { kind: "chapter", min: 6, max: 9 },
    cast: { p: { person: "deu_jagow" } },
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
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
            next: "view",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "view",
                effects: [{ kind: "remember", key: "k_jagow_poland" }],
              },
            ],
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "view",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "worry",
                effects: [],
              },
              {
                when: { kind: "temperament", who: { role: "p" }, of: ["cold"] },
                next: "view",
                effects: [{ kind: "remember", key: "k_jagow_poland" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "jagow_poland_first",
                chapters: 3,
              },
              { kind: "remember", key: "k_jagow_poland" },
            ],
            next: "view",
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
      view: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "mil",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_mil",
          },
          {
            id: "hm",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      worry: {
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
      on_mil: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
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
    },
  },
  {
    id: "deu_t_zimm_hoyos",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 1 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_zimmermann" } },
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
            next: "odds",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "odds",
                effects: [{ kind: "remember", key: "heard_zimm_odds" }],
              },
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 1 },
                next: "odds",
                effects: [{ kind: "remember", key: "heard_zimm_odds" }],
              },
            ],
          },
          {
            id: "vienna",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "vienna",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "wiggle",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "bold",
                effects: [{ kind: "reason", key: "t_zimm_hoyos_r1" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "zimm_hoyos_cover",
                chapters: 2,
              },
            ],
            next: "vienna",
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
      odds: {
        says: [
          {
            id: "straight",
            when: { kind: "candid", who: { person: "deu_zimmermann" } },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "v",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "vienna",
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
      vienna: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "tisza",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "heard_tisza_unasked" }],
            next: null,
          },
          {
            id: "jagow",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_jagow",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "on_jagow",
                effects: [
                  {
                    kind: "person_trust",
                    who: { person: "deu_jagow" },
                    delta: -1,
                  },
                ],
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
      wiggle: {
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
      bold: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
          {
            id: "ok",
            stance: "flatter",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      on_jagow: {
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
            id: "end2",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_zimm_serbia",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 3 },
        {
          kind: "any",
          of: [
            { kind: "opening", of: ["sarajevo_failed"] },
            { kind: "crisis", topic: "balkan" },
          ],
        },
      ],
    },
    cast: { p: { person: "deu_zimmermann" } },
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
            next: "knew",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "knew",
                effects: [{ kind: "remember", key: "k_zimm_serbia" }],
              },
            ],
          },
          {
            id: "use",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "use",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "use",
                effects: [{ kind: "remember", key: "k_zimm_serbia" }],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "brag",
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
                kind: "promise",
                who: { role: "p" },
                key: "zimm_net",
                chapters: 3,
              },
              { kind: "remember", key: "k_zimm_serbia" },
            ],
            next: "use",
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
      knew: {
        says: [{ id: "base" }],
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
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      use: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "lich",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_lich",
          },
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      brag: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_zimm_serbia" }],
            next: null,
          },
          {
            id: "no",
            stance: "threat",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      on_lich: {
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
    id: "deu_t_zimm_ottoman",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 1, max: 5 },
    cast: { p: { person: "deu_zimmermann" } },
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
            id: "ask",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "price",
                effects: [{ kind: "remember", key: "k_zimm_ottoman" }],
              },
            ],
          },
          {
            id: "doubt",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "grand",
          },
          {
            id: "press",
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
                  of: ["arrogant"],
                },
                next: "rise",
                effects: [],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "price",
                effects: [{ kind: "remember", key: "k_zimm_ottoman" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "zimm_bosporus",
                chapters: 3,
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "enver",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_enver",
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
      grand: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "p",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_zimm_ottoman" }],
            next: "price",
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
      rise: {
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
      on_enver: {
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
    id: "deu_t_zimm_irish",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7, max: 9 },
        { kind: "at_war", tag: "GBR" },
      ],
    },
    cast: { p: { person: "deu_zimmermann" } },
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
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "what",
                effects: [{ kind: "remember", key: "k_zimm_irish" }],
              },
            ],
          },
          {
            id: "doubt",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "spy",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "what",
                effects: [{ kind: "remember", key: "k_zimm_irish" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "zimm_no_name",
                chapters: 3,
              },
              { kind: "remember", key: "k_zimm_irish" },
            ],
            next: "what",
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
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "lich",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_lich",
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
      spy: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      on_lich: {
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
    id: "deu_t_zimm_usa",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 8, max: 10 },
        { kind: "at_war", tag: "GBR" },
      ],
    },
    cast: { p: { person: "deu_zimmermann" } },
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
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "line",
                effects: [{ kind: "remember", key: "k_zimm_usa" }],
              },
            ],
          },
          {
            id: "needle",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "bluff",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "line",
                effects: [{ kind: "remember", key: "k_zimm_usa" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "zimm_bernstorff",
                chapters: 3,
              },
              { kind: "remember", key: "k_zimm_usa" },
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "tirp",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_tirp",
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
      bluff: {
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
      on_tirp: {
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
    id: "deu_t_lich_unread",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 3, max: 4 },
    cast: { p: { person: "deu_lichnowsky" } },
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
            id: "anx",
            when: { kind: "temperament", who: { role: "p" }, of: ["anxious"] },
          },
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
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
            next: "cut",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "cut",
                effects: [{ kind: "remember", key: "k_lich_unread" }],
              },
            ],
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "hurt",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["stubborn"],
                },
                next: "cut",
                effects: [{ kind: "remember", key: "k_lich_unread" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "lich_raw",
                chapters: 3,
              },
              { kind: "remember", key: "k_lich_unread" },
            ],
            next: "cut",
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
      cut: {
        says: [
          {
            id: "weak",
            when: { kind: "source_band", source: "embassy_london", max: 1 },
          },
          {
            id: "strong",
            when: { kind: "source_band", source: "embassy_london", min: 3 },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "trust",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "source", source: "embassy_london", right: true },
            ],
            next: null,
          },
          {
            id: "tsch",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_tsch",
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
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_lich_unread" }],
            next: "cut",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_lich_unread_r1" }],
            next: null,
          },
        ],
      },
      on_tsch: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
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
    id: "deu_t_lich_warn",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        {
          kind: "all",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "temp", min: 5 },
          ],
        },
      ],
    },
    cast: { p: { person: "deu_lichnowsky" } },
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
            next: "cab_read",
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "formal",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "cab_read",
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
                kind: "promise",
                who: { role: "p" },
                key: "lich_circulate",
                chapters: 2,
              },
            ],
            next: "cab_read",
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
      cab_read: {
        says: [
          { id: "split", when: { kind: "trust", tag: "GBR", min: 1 } },
          { id: "base" },
        ],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "heard_lich_cabinet" }],
            next: null,
          },
          {
            id: "beth",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_beth",
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
      formal: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_lich_warn_r1" }],
            next: null,
          },
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "cab_read",
          },
        ],
      },
      on_beth: {
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
    },
  },
  {
    id: "deu_t_lich_offer",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "at_war", tag: "RUS" },
            { kind: "at_war", tag: "FRA" },
          ],
        },
      ],
    },
    cast: { p: { person: "deu_lichnowsky" } },
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
            next: "exact",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "exact",
                effects: [{ kind: "remember", key: "k_lich_offer" }],
              },
            ],
          },
          {
            id: "seize",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "exact",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "exact",
                effects: [
                  { kind: "remember", key: "k_lich_offer" },
                  { kind: "person_trust", who: { role: "p" }, delta: 1 },
                ],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "doubt",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "lich_no_recall",
                chapters: 3,
              },
              { kind: "remember", key: "k_lich_offer" },
            ],
            next: "exact",
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
      exact: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "moltke",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_moltke",
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
      doubt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "calm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_lich_offer" }],
            next: "exact",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      on_moltke: {
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
    },
  },
  {
    id: "deu_t_lich_farewell",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    when: { kind: "chapter", min: 5, max: 10 },
    cast: { p: { person: "deu_lichnowsky" } },
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
          { id: "gbr", when: { kind: "at_war", tag: "GBR" } },
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
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
            next: "seen",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "seen",
                effects: [{ kind: "remember", key: "k_lich_farewell" }],
              },
            ],
          },
          {
            id: "blame",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "bitter",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["stubborn"],
                },
                next: "bitter",
                effects: [],
              },
            ],
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "lich_channel",
                chapters: 4,
              },
              { kind: "remember", key: "k_lich_farewell" },
            ],
            next: "seen",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      seen: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "zimm",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_ministry",
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
      bitter: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_lich_farewell" },
            ],
            next: "seen",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_lich_farewell_r1" }],
            next: null,
          },
        ],
      },
      on_ministry: {
        says: [
          {
            id: "arr",
            when: { kind: "temperament", who: { role: "p" }, of: ["arrogant"] },
          },
          { id: "base" },
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
            effects: [{ kind: "remember", key: "told_lich_silent" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "deu_t_pour_sazonov",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 0, max: 2 },
    cast: { p: { person: "deu_pourtales" } },
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
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
            next: "face",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "rumour",
                effects: [],
              },
            ],
          },
          {
            id: "rail",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wrong",
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "numb",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "numb",
                effects: [{ kind: "reason", key: "t_pour_sazonov_r1" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "pour_attache",
                chapters: 3,
              },
            ],
            next: "rumour",
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
      face: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rumour",
          },
          {
            id: "moltke",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_moltke",
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
      rumour: {
        says: [
          { id: "secret", when: { kind: "secret", id: "rus_rail_ahead" } },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "heard_rus_rail" }],
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
      wrong: {
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
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      numb: {
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
      on_moltke: {
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
    id: "deu_t_pour_mobil",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: { kind: "chapter", min: 3, max: 4 },
    cast: { p: { person: "deu_pourtales" } },
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
            next: "honest",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "honest",
                effects: [{ kind: "remember", key: "heard_pour_doubt" }],
              },
            ],
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "plain",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "shaken",
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
                kind: "promise",
                who: { role: "p" },
                key: "pour_recheck",
                chapters: 1,
              },
            ],
            next: "honest",
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
      honest: {
        says: [
          {
            id: "weak",
            when: { kind: "source_band", source: "embassy_petersburg", max: 1 },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "att",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_att",
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
      plain: {
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
      shaken: {
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
            id: "cold",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      on_att: {
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
    },
  },
  {
    id: "deu_t_pour_direct",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_pourtales" } },
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
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
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
            next: "vienna",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: 0 },
                next: "vienna",
                effects: [{ kind: "remember", key: "k_pour_direct" }],
              },
            ],
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "vienna",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["anxious"],
                },
                next: "hurt",
                effects: [],
              },
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "vienna",
                effects: [{ kind: "remember", key: "k_pour_direct" }],
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
                kind: "promise",
                who: { role: "p" },
                key: "pour_vienna_word",
                chapters: 2,
              },
              { kind: "remember", key: "k_pour_direct" },
            ],
            next: "vienna",
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
      vienna: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "berch",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_berch",
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
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_pour_direct" },
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
      on_berch: {
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
    },
  },
  {
    id: "deu_t_pour_note",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "at_war", tag: "RUS" },
          ],
        },
      ],
    },
    cast: { p: { person: "deu_pourtales" } },
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
            next: "two",
          },
          {
            id: "press",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "obey",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "obey",
                effects: [],
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
                kind: "promise",
                who: { role: "p" },
                key: "pour_three_times",
                chapters: 1,
              },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: "thanks",
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
      two: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "wire",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              { kind: "schedule", scene: "deu_v_nicholas_wire", chapters: 1 },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: null,
          },
          {
            id: "min",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_ministry",
          },
          {
            id: "fix",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "t_pour_note_r1" }],
            next: null,
          },
        ],
      },
      obey: {
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
          {
            id: "soft",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      thanks: {
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
      on_ministry: {
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
    },
  },
  {
    id: "deu_t_pour_home",
    nation: ["DEU"],
    kind: "talk",
    stage: ["y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 6, max: 10 },
        { kind: "at_war", tag: "RUS" },
      ],
    },
    cast: { p: { person: "deu_pourtales" } },
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
            id: "weary",
            when: {
              kind: "all",
              of: [
                { kind: "temperament", who: { role: "p" }, of: ["weary"] },
                { kind: "chapter", min: 7, max: 10 },
              ],
            },
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
            next: "friends",
            reacts: [
              {
                when: { kind: "person_trust", who: { role: "p" }, min: -1 },
                next: "friends",
                effects: [{ kind: "remember", key: "k_pour_home" }],
              },
            ],
          },
          {
            id: "blame",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "broken",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "promise",
                who: { role: "p" },
                key: "pour_use",
                chapters: 4,
              },
              { kind: "remember", key: "k_pour_home" },
            ],
            next: "friends",
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      friends: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "moltke",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "on_moltke",
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
      broken: {
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
            effects: [{ kind: "reason", key: "t_pour_home_r1" }],
            next: null,
          },
        ],
      },
      on_moltke: {
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
    },
  },
  {
    id: "deu_c_margin",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 1 },
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
      ],
    },
    cast: { amb_vienna: { office: "ambassador_vienna" } },
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
    fallback: "write_nothing",
    options: [
      { id: "write_nothing", tell: [], effects: [] },
      {
        id: "now_or_never",
        tell: ["temp:+2", "army:+1", "auh:+1", "amb_vienna:-1"],
        effects: [
          { kind: "flag", flag: "f_margin_now" },
          { kind: "temp", delta: 2 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "person_trust", who: { role: "amb_vienna" }, delta: -1 },
        ],
      },
      {
        id: "calm_him",
        tell: ["temp:-1", "auh:-1", "amb_vienna:+1"],
        effects: [
          { kind: "flag", flag: "f_margin_calm" },
          { kind: "temp", delta: -1 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "person_trust", who: { role: "amb_vienna" }, delta: 1 },
        ],
      },
      {
        id: "ask_what",
        when: { kind: "memory", key: "k_tsch_air" },
        tell: ["amb_vienna:+1"],
        effects: [
          { kind: "flag", flag: "f_margin_ask" },
          { kind: "person_trust", who: { role: "amb_vienna" }, delta: 1 },
          {
            kind: "keep_promise",
            who: { person: "deu_tschirschky" },
            key: "tsch_read",
          },
        ],
      },
    ],
  },
  {
    id: "deu_c_press_serbia",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 1 },
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "unconfirmed",
    source: "press",
    variants: [
      {
        id: "cross",
        when: {
          kind: "any",
          of: [
            { kind: "flag", flag: "f_went_vienna" },
            { kind: "flag", flag: "f_asked_vienna" },
          ],
        },
      },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_quiet_june",
    nation: ["DEU"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 0 },
        { kind: "opening", of: ["no_sarajevo"] },
      ],
    },
    cast: { court: { office: "court" } },
    salience: 8,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "balkan", when: { kind: "pressure", topic: "balkan", min: 3 } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_kiel_squadron",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 1 },
        {
          kind: "any",
          of: [
            { kind: "opening", of: ["no_sarajevo"] },
            { kind: "opening", of: ["sarajevo_delayed"] },
          ],
        },
      ],
    },
    cast: { navy: { office: "navy" }, court: { office: "court" } },
    salience: 6,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "tense", when: { kind: "pressure", topic: "naval", min: 3 } },
      { id: "base" },
    ],
    fallback: "correct",
    options: [
      { id: "correct", tell: [], effects: [] },
      {
        id: "fete",
        tell: ["gbr:+1", "navy:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "person_trust", who: { role: "navy" }, delta: -1 },
          { kind: "pressure", topic: "naval", delta: -1 },
        ],
      },
      {
        id: "naval_talk",
        when: { kind: "memory", key: "k_tirp_fleet" },
        tell: ["gbr:+1", "navy:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "pressure", topic: "naval", delta: -1 },
          { kind: "flag", flag: "f_naval_hint" },
          { kind: "person_trust", who: { role: "navy" }, delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_delayed_visit",
    nation: ["DEU"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 0 },
        { kind: "opening", of: ["sarajevo_delayed"] },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [{ id: "base" }],
  },
  {
    id: "deu_c_ff_alive",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        { kind: "opening", of: ["sarajevo_survived"] },
      ],
    },
    cast: { amb_vienna: { office: "ambassador_vienna" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "hoyos", when: { kind: "seen", scene: "deu_c_blank_cheque" } },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      { id: "wait", tell: [], effects: [] },
      {
        id: "back_hawks",
        tell: ["temp:+2", "auh:+1", "army:+1"],
        effects: [
          { kind: "temp", delta: 2 },
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "flag", flag: "f_ff_betrayed" },
        ],
      },
      {
        id: "back_archduke",
        when: { kind: "memory", key: "k_tsch_berchtold" },
        tell: ["temp:-2", "auh:-1", "army:-1"],
        effects: [
          { kind: "temp", delta: -2 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "flag", flag: "f_ff_backed" },
          { kind: "inst", inst: "army", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_failed_plot",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        { kind: "opening", of: ["sarajevo_failed"] },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "sent", when: { kind: "flag", flag: "f_sent_prince" } },
      { id: "base" },
    ],
    fallback: "let_vienna",
    options: [
      {
        id: "let_vienna",
        tell: ["temp:+1"],
        effects: [{ kind: "temp", delta: 1 }],
      },
      {
        id: "press_belgrade",
        tell: ["temp:+1", "auh:+1", "rus:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
        ],
      },
      {
        id: "hush",
        when: { kind: "memory", key: "k_zimm_serbia" },
        tell: ["temp:-2", "auh:-1"],
        effects: [
          { kind: "temp", delta: -2 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "flag", flag: "f_serbia_hushed" },
          {
            kind: "keep_promise",
            who: { person: "deu_zimmermann" },
            key: "zimm_net",
          },
        ],
      },
    ],
  },
  {
    id: "deu_c_potsdam",
    nation: ["DEU"],
    kind: "dispute",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        { kind: "seen", scene: "deu_c_blank_cheque" },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, war: { office: "war" } },
    salience: 6,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "full", when: { kind: "flag", flag: "f_cheque_full" } },
      { id: "base" },
    ],
    fallback: "no_prep",
    options: [
      {
        id: "no_prep",
        tell: ["army:-1", "temp:-1", "chancellor:+1"],
        effects: [
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "temp", delta: -1 },
          { kind: "person_trust", who: { role: "chancellor" }, delta: 1 },
        ],
      },
      {
        id: "quiet_prep",
        when: { kind: "memory", key: "k_falk_ready" },
        tell: ["army:+1", "temp:+1", "shells:+1", "war:+1", "chancellor:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "temp", delta: 1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          { kind: "flag", flag: "f_quiet_prep" },
          { kind: "person_trust", who: { role: "war" }, delta: 1 },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
      {
        id: "recall_cos",
        when: { kind: "memory", key: "k_moltke_window" },
        tell: ["army:+2", "temp:+2", "chancellor:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 2 },
          { kind: "temp", delta: 2 },
          { kind: "flag", flag: "f_staff_recalled" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_baghdad",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 3 },
        { kind: "not", of: { kind: "crisis", topic: "balkan" } },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, fm: { office: "foreign" } },
    salience: 5,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "naval", when: { kind: "pressure", topic: "colonial", min: 3 } },
      { id: "base" },
    ],
    fallback: "hold",
    options: [
      { id: "hold", tell: [], effects: [] },
      {
        id: "sign",
        tell: ["gbr:+1", "temp:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "temp", delta: -1 },
          { kind: "pressure", topic: "colonial", delta: -1 },
          { kind: "flag", flag: "f_baghdad_signed" },
        ],
      },
      {
        id: "colonies_too",
        when: { kind: "memory", key: "k_lich_grey" },
        tell: ["gbr:+2", "temp:-1", "money:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "temp", delta: -1 },
          { kind: "pressure", topic: "colonial", delta: -2 },
          { kind: "flag", flag: "f_baghdad_signed" },
          { kind: "gauge", gauge: "money", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_albania",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 3 },
        {
          kind: "all",
          of: [
            { kind: "opening", of: ["no_sarajevo"] },
            { kind: "pressure", topic: "balkan", min: 0 },
          ],
        },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "serb", when: { kind: "pressure", topic: "balkan", min: 5 } },
      { id: "base" },
    ],
    fallback: "restrain",
    options: [
      {
        id: "restrain",
        tell: ["temp:-1", "auh:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "pressure", topic: "balkan", delta: -1 },
        ],
      },
      {
        id: "back_vienna",
        tell: ["temp:+1", "auh:+1", "rus:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
          { kind: "pressure", topic: "balkan", delta: 1 },
        ],
      },
      {
        id: "joint_note",
        when: { kind: "memory", key: "k_tsch_berchtold" },
        tell: ["auh:+1"],
        effects: [
          { kind: "trust", tag: "AUH", delta: 1 },
          { kind: "pressure", topic: "balkan", delta: -2 },
          {
            kind: "keep_promise",
            who: { person: "deu_tschirschky" },
            key: "tsch_channel",
          },
        ],
      },
    ],
  },
  {
    id: "deu_c_liman",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 3 },
        {
          kind: "all",
          of: [
            { kind: "opening", of: ["no_sarajevo"] },
            { kind: "pressure", topic: "straits", min: 0 },
          ],
        },
      ],
    },
    cast: { fm: { office: "foreign" }, war: { office: "war" } },
    salience: 6,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "ships", when: { kind: "pressure", topic: "straits", min: 5 } },
      { id: "base" },
    ],
    fallback: "keep",
    options: [
      {
        id: "keep",
        tell: ["army:+1", "rus:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
        ],
      },
      {
        id: "recall",
        tell: ["army:-1", "rus:+1", "ott:-2"],
        effects: [
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "trust", tag: "OTT", delta: -2 },
          { kind: "pressure", topic: "straits", delta: -2 },
        ],
      },
      {
        id: "trade_title",
        when: { kind: "memory", key: "k_zimm_ottoman" },
        tell: ["rus:+1"],
        effects: [
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "pressure", topic: "straits", delta: -1 },
          { kind: "flag", flag: "f_liman_traded" },
        ],
      },
    ],
  },
  {
    id: "deu_c_tisza_turn",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 2 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "embassy_vienna",
    variants: [
      { id: "full", when: { kind: "flag", flag: "f_cheque_full" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_bucharest",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["foreign"],
    once: true,
    stamp: "unconfirmed",
    source: "embassy_vienna",
    variants: [
      { id: "dead", when: { kind: "secret", id: "rou_treaty_dead" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_grain_buy",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: { kind: "chapter", min: 2, max: 4 },
    cast: { interior: { office: "interior" }, finance: { office: "finance" } },
    salience: 5,
    tags: ["home"],
    once: true,
    variants: [{ id: "hot", when: { kind: "temp", min: 5 } }, { id: "base" }],
    fallback: "leave",
    options: [
      { id: "leave", tell: [], effects: [] },
      {
        id: "buy_rotterdam",
        when: { kind: "memory", key: "k_delb_grain" },
        tell: ["bread:+1", "money:-1", "temp:+1", "interior:+1"],
        effects: [
          { kind: "gauge", gauge: "bread", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "temp", delta: 1 },
          { kind: "person_trust", who: { role: "interior" }, delta: 1 },
          { kind: "flag", flag: "f_grain_bought" },
        ],
      },
      {
        id: "quiet_contract",
        when: { kind: "memory", key: "k_kuhn_ballin" },
        tell: ["bread:+1", "money:-1"],
        effects: [
          { kind: "gauge", gauge: "bread", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "flag", flag: "f_grain_bought" },
          { kind: "flag", flag: "f_ballin_contract" },
        ],
      },
    ],
  },
  {
    id: "deu_c_ulster",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "pressure", topic: "ireland", min: 2 },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["foreign", "tension_down"],
    once: true,
    stamp: "unconfirmed",
    source: "embassy_london",
    variants: [
      { id: "hot", when: { kind: "pressure", topic: "ireland", min: 4 } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_ultimatum_out",
    nation: ["DEU"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "soft", when: { kind: "flag", flag: "f_text_softened" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_four_powers",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {
      fm: { office: "foreign" },
      amb_london: { office: "ambassador_london" },
    },
    salience: 7,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "read", when: { kind: "flag", flag: "f_text_read" } },
      { id: "base" },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["gbr:-1", "temp:+1", "amb_london:-1", "auh:+1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "temp", delta: 1 },
          { kind: "person_trust", who: { role: "amb_london" }, delta: -1 },
          { kind: "trust", tag: "AUH", delta: 1 },
        ],
      },
      {
        id: "accept",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_lich_conf" },
            { kind: "memory", key: "k_goschen_conf" },
          ],
        },
        tell: ["gbr:+2", "auh:-2", "temp:-2", "army:-1", "amb_london:+1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "trust", tag: "AUH", delta: -2 },
          { kind: "temp", delta: -2 },
          { kind: "flag", flag: "f_conference_on" },
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "person_trust", who: { role: "amb_london" }, delta: 1 },
          {
            kind: "keep_promise",
            who: { person: "deu_lichnowsky" },
            key: "lich_answer",
          },
        ],
      },
      {
        id: "direct_talks",
        when: { kind: "memory", key: "k_pour_direct" },
        tell: ["gbr:+1", "rus:+1", "temp:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "trust", tag: "RUS", delta: 1 },
          { kind: "temp", delta: -1 },
          { kind: "flag", flag: "f_direct_talks" },
          {
            kind: "keep_promise",
            who: { person: "deu_pourtales" },
            key: "pour_vienna_word",
          },
        ],
      },
      {
        id: "pass_to_vienna",
        tell: ["gbr:-1", "temp:-1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: -1 },
          { kind: "temp", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_poincare_visit",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "unconfirmed",
    source: "embassy_petersburg",
    variants: [
      { id: "left", when: { kind: "flag", flag: "f_cheque_limit" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_italy",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "secret", when: { kind: "secret", id: "ita_fra_understanding" } },
      { id: "base" },
    ],
    fallback: "ignore",
    options: [
      {
        id: "ignore",
        tell: ["ita:-1"],
        effects: [{ kind: "trust", tag: "ITA", delta: -1 }],
      },
      { id: "general_words", tell: [], effects: [] },
      {
        id: "press_trentino",
        when: { kind: "memory", key: "k_jagow_italy" },
        tell: ["ita:+2", "auh:-2"],
        effects: [
          { kind: "trust", tag: "ITA", delta: 2 },
          { kind: "trust", tag: "AUH", delta: -2 },
          { kind: "flag", flag: "f_trentino_pressed" },
          {
            kind: "keep_promise",
            who: { person: "deu_jagow" },
            key: "jagow_rome_letter",
          },
        ],
      },
    ],
  },
  {
    id: "deu_c_stock_market",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "temp", min: 4 },
      ],
    },
    cast: {},
    salience: 3,
    tags: ["home", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [{ id: "hot", when: { kind: "temp", min: 7 } }, { id: "base" }],
  },
  {
    id: "deu_c_naval_holiday",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "not", of: { kind: "crisis", topic: "balkan" } },
      ],
    },
    cast: { navy: { office: "navy" }, chancellor: { office: "chancellor" } },
    salience: 5,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: [
      { id: "baghdad", when: { kind: "flag", flag: "f_baghdad_signed" } },
      { id: "base" },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: ["navy:+1", "gbr:-1"],
        effects: [
          { kind: "person_trust", who: { role: "navy" }, delta: 1 },
          { kind: "pressure", topic: "naval", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -1 },
        ],
      },
      { id: "study", tell: [], effects: [] },
      {
        id: "accept_talks",
        when: { kind: "memory", key: "k_muller_tirpitz" },
        tell: ["gbr:+2", "money:+1", "navy:-2", "chancellor:+1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "pressure", topic: "naval", delta: -2 },
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "person_trust", who: { role: "navy" }, delta: -2 },
          { kind: "flag", flag: "f_naval_talks" },
          { kind: "person_trust", who: { role: "chancellor" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_manoeuvres",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "not", of: { kind: "crisis", topic: "balkan" } },
      ],
    },
    cast: { cos: { office: "chief_of_staff" }, war: { office: "war" } },
    salience: 4,
    tags: ["war"],
    once: true,
    variants: [
      { id: "again", when: { kind: "seen", scene: "deu_c_naval_holiday" } },
      { id: "base" },
    ],
    fallback: "west_plan",
    options: [
      {
        id: "west_plan",
        tell: ["army:+1"],
        effects: [
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "flag", flag: "f_autumn_west" },
        ],
      },
      {
        id: "small",
        tell: ["army:-1", "money:+1"],
        effects: [
          { kind: "inst", inst: "army", delta: -1 },
          { kind: "gauge", gauge: "money", delta: 1 },
        ],
      },
      {
        id: "east_exercise",
        when: { kind: "memory", key: "k_hind_masuria" },
        tell: ["army:+1", "rus:-1"],
        effects: [
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
          { kind: "flag", flag: "f_autumn_east" },
        ],
      },
    ],
  },
  {
    id: "deu_c_war_on_serbia",
    nation: ["DEU"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "halt", when: { kind: "flag", flag: "f_halt_belgrade" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_rus_report",
    nation: ["DEU"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {},
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "unconfirmed",
    source: "embassy_petersburg",
    variants: [
      { id: "rail", when: { kind: "secret", id: "rus_rail_ahead" } },
      { id: "base" },
    ],
  },
  {
    id: "deu_c_ottoman_treaty",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "at_war", tag: "RUS" },
            { kind: "at_war", tag: "FRA" },
          ],
        },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "late", when: { kind: "secret", id: "ott_fleet_late" } },
      { id: "base" },
    ],
    fallback: "hold",
    options: [
      { id: "hold", tell: [], effects: [] },
      {
        id: "sign",
        tell: ["ott:+2", "money:-1"],
        effects: [
          { kind: "flag", flag: "f_ottoman_signed" },
          { kind: "trust", tag: "OTT", delta: 2 },
          { kind: "gauge", gauge: "money", delta: -1 },
        ],
      },
      {
        id: "sign_ships",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_tirp_goeben" },
            { kind: "memory", key: "k_enver_goeben" },
          ],
        },
        tell: ["ott:+3", "army:+1", "rus:-1"],
        effects: [
          { kind: "flag", flag: "f_ottoman_signed" },
          { kind: "flag", flag: "f_goeben_straits" },
          { kind: "trust", tag: "OTT", delta: 3 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "RUS", delta: -1 },
        ],
      },
      {
        id: "haggle",
        when: { kind: "memory", key: "k_zimm_ottoman" },
        tell: ["ott:+1", "delay:2"],
        effects: [
          { kind: "flag", flag: "f_ottoman_signed" },
          { kind: "trust", tag: "OTT", delta: 1 },
          { kind: "delay", days: 2 },
        ],
      },
    ],
  },
  {
    id: "deu_c_gold",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        { kind: "temp", min: 6 },
      ],
    },
    cast: { finance: { office: "finance" } },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "war_tower",
        when: {
          kind: "any",
          of: [
            { kind: "flag", flag: "f_kg_signed" },
            { kind: "flag", flag: "f_cheque_full" },
          ],
        },
      },
      { id: "base" },
    ],
    fallback: "suspend",
    options: [
      {
        id: "suspend",
        tell: ["order:+1", "money:+1"],
        effects: [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "flag", flag: "f_gold_suspended" },
        ],
      },
      {
        id: "hold_gold",
        tell: ["money:-1", "temp:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "temp", delta: -1 },
        ],
      },
      {
        id: "open_chest",
        when: { kind: "memory", key: "k_kuhn_chest" },
        tell: ["money:+2", "temp:+1", "finance:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: 2 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_chest_opened" },
          { kind: "person_trust", who: { role: "finance" }, delta: 1 },
        ],
      },
    ],
  },
  {
    id: "deu_c_lichnowsky_offer",
    nation: ["DEU"],
    kind: "crisis",
    stage: ["crisis", "y1914"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 6 },
        {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_west_plan" },
            { kind: "not", of: { kind: "at_war", tag: "GBR" } },
          ],
        },
      ],
    },
    cast: {
      amb_london: { office: "ambassador_london" },
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
    },
    salience: 8,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "read",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_lich_unread" },
            { kind: "memory", key: "k_lich_offer" },
          ],
        },
      },
      { id: "base" },
    ],
    fallback: "confirm_first",
    options: [
      { id: "confirm_first", tell: [], effects: [] },
      {
        id: "ignore",
        tell: ["amb_london:-1", "army:+1", "gbr:-1"],
        effects: [
          { kind: "person_trust", who: { role: "amb_london" }, delta: -1 },
          { kind: "inst", inst: "army", delta: 1 },
          { kind: "trust", tag: "GBR", delta: -1 },
        ],
      },
      {
        id: "halt_west",
        when: { kind: "memory", key: "k_lich_offer" },
        tell: ["army:-3", "gbr:+2", "temp:-2", "cos:-2", "delay:1"],
        effects: [
          { kind: "inst", inst: "army", delta: -3 },
          { kind: "trust", tag: "GBR", delta: 2 },
          { kind: "temp", delta: -2 },
          { kind: "person_trust", who: { role: "cos" }, delta: -2 },
          { kind: "flag", flag: "f_halted_west" },
          { kind: "delay", days: 1 },
        ],
      },
      {
        id: "king_to_king",
        when: { kind: "memory", key: "k_muller_george" },
        tell: ["gbr:+1", "court:+1"],
        effects: [
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "flag", flag: "f_king_wire" },
          { kind: "person_trust", who: { role: "court" }, delta: 1 },
        ],
      },
    ],
  },
];
