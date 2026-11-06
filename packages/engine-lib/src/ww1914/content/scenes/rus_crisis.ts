import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「러시아」, the 1914 share: the `rus_c_` scenes, the summoned talks of Sazonov,
 * Sukhomlinov, the Grand Duke and Goremykin, and six visits. Data only; the
 * text is in resources/ww1914/ko/RUS.crisis.json. Plan: ww135-plan-rus.md
 * sections 4, 8, 9.
 *
 * The stand-ins below are what lane Y has on `w135-world` and this branch
 * lacks. Each is one definition: replace it here when the merge brings the
 * real one, and every scene follows.
 */

/** Month from a "YYYY-MM", as a `full` chapter. Only for the stand-in below. */
const fullChapter = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  const months = (y - 1915) * 12 + (m - 1);
  return months < 0 ? 6 + Math.max(0, months + 5) : 11 + months;
};

/** Becomes `{ kind: "world", of: { is: "date", from, to } }`. */
const date = (from?: string, to?: string): GwCond => ({
  kind: "chapter",
  ...(from === undefined ? {} : { min: fullChapter(from) }),
  ...(to === undefined ? {} : { max: fullChapter(to) + 1 }),
});

type Ear = "court" | "stavka" | "duma" | "ministers";

/** Becomes `{ kind: "inst", inst: i, delta }`. */
const ear = (i: Ear, delta: number): GwEffect => ({
  kind: "flag",
  flag: `f_ear_${i}_${delta < 0 ? "down" : "up"}`,
});

/** Becomes `{ kind: "inst", inst: i, ...range }`. */
const earAt = (i: Ear, _range: { min?: number; max?: number }): GwCond => ({
  kind: "flag",
  flag: `f_ear_${i}_down`,
});

/** Becomes `{ kind: "world", of: { is: "command" } }`. */
const cmd: GwCond = { kind: "flag", flag: "f_rus_self_command" };

/** Becomes `{ kind: "world", of: { do: "personal_command", on: true } }`. */
const selfCommand: GwEffect = { kind: "flag", flag: "f_rus_self_command" };

/** Plan section 2: ministers are seen in the capital. */
const atDesk: GwCond = {
  kind: "any",
  of: [
    { kind: "not", of: cmd },
    { kind: "flag", flag: "f_rus_in_capital" },
  ],
};

export const RUS_CRISIS_SCENES: readonly GwScene[] = [
  {
    id: "rus_c_door",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis"],
    when: { kind: "chapter", min: 0, max: 0 },
    cast: { court: { office: "court" } },
    salience: 9,
    tags: ["people"],
    once: true,
    variants: [
      {
        id: "no_shot",
        when: { kind: "opening", of: ["no_sarajevo", "sarajevo_delayed"] },
      },
      {
        id: "grazed",
        when: { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
      },
      { id: "base" },
    ],
    fallback: "family_first",
    options: [
      {
        id: "family_first",
        tell: ["court:+1", "ministers:-1"],
        effects: [
          ear("court", 1),
          ear("ministers", -1),
          { kind: "flag", flag: "f_door_family" },
        ],
      },
      {
        id: "ministers_first",
        tell: ["ministers:+1", "court:-1"],
        effects: [
          ear("ministers", 1),
          ear("court", -1),
          { kind: "flag", flag: "f_door_ministers" },
        ],
      },
      {
        id: "generals_first",
        tell: ["stavka:+1", "duma:-1"],
        effects: [
          ear("stavka", 1),
          ear("duma", -1),
          { kind: "flag", flag: "f_door_generals" },
        ],
      },
      {
        id: "rodzianko_first",
        tell: ["duma:+1", "court:-1"],
        effects: [
          ear("duma", 1),
          ear("court", -1),
          { kind: "flag", flag: "f_door_rodzianko" },
        ],
      },
    ],
  },
  {
    id: "rus_c_skerries",
    nation: ["RUS"],
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
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "failed", when: { kind: "opening", of: ["sarajevo_failed"] } },
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_quiet_june",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 0 },
        { kind: "opening", of: ["no_sarajevo", "sarajevo_delayed"] },
      ],
    },
    cast: { court: { office: "court" } },
    salience: 8,
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      { id: "delayed", when: { kind: "opening", of: ["sarajevo_delayed"] } },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_heir_fall",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis"],
    when: { kind: "chapter", min: 1, max: 2 },
    cast: { court: { office: "court" } },
    salience: 8,
    tags: ["people"],
    once: true,
    variants: [
      { id: "waiting_list", when: { kind: "flag", flag: "f_door_ministers" } },
      { id: "pencil_line", when: { kind: "flag", flag: "f_door_family" } },
      { id: "base" },
    ],
    fallback: "stay_night",
    options: [
      {
        id: "stay_night",
        tell: ["audiences:-1", "heir", "court:+1"],
        effects: [
          { kind: "audiences", delta: -1 },
          ear("court", 1),
          { kind: "flag", flag: "f_heir_night" },
        ],
      },
      {
        id: "doctors_only",
        tell: ["court:-1"],
        effects: [ear("court", -1), { kind: "flag", flag: "f_heir_doctors" }],
      },
      {
        id: "wire_friend",
        when: { kind: "memory", key: "k_alex_friend" },
        tell: ["court:+2", "duma:-1"],
        effects: [
          ear("court", 2),
          ear("duma", -1),
          { kind: "flag", flag: "f_heir_friend" },
        ],
      },
      {
        id: "back_to_desk",
        tell: ["ministers:+1", "court:-2"],
        effects: [
          ear("ministers", 1),
          ear("court", -2),
          { kind: "flag", flag: "f_heir_desk" },
        ],
      },
    ],
  },
  {
    id: "rus_c_pokrovskoe",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis"],
    when: { kind: "chapter", min: 2, max: 3 },
    cast: {
      chancellor: { office: "chancellor" },
      interior: { office: "interior" },
    },
    salience: 8,
    tags: ["people", "tension_up"],
    once: true,
    variants: [
      { id: "answered", when: { kind: "flag", flag: "f_heir_friend" } },
      { id: "night", when: { kind: "flag", flag: "f_heir_night" } },
      { id: "base" },
    ],
    fallback: "send_doctor",
    options: [
      {
        id: "send_doctor",
        tell: ["court:+1", "duma:-1"],
        effects: [
          ear("court", 1),
          ear("duma", -1),
          { kind: "flag", flag: "f_ras_wounded" },
          { kind: "flag", flag: "f_ras_doctor" },
        ],
      },
      {
        id: "send_police",
        tell: ["ministers:+1", "court:-1"],
        effects: [
          ear("ministers", 1),
          ear("court", -1),
          { kind: "flag", flag: "f_ras_wounded" },
          { kind: "flag", flag: "f_ras_police" },
        ],
      },
      {
        id: "say_nothing",
        tell: ["duma:+1", "court:-1"],
        effects: [
          ear("duma", 1),
          ear("court", -1),
          { kind: "flag", flag: "f_ras_wounded" },
          { kind: "flag", flag: "f_ras_silent" },
        ],
      },
    ],
  },
  {
    id: "rus_c_poincare",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 4 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "hint", when: { kind: "memory", key: "k_paleo_hint" } },
      {
        id: "after_night",
        when: {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_heir_night" },
            { kind: "flag", flag: "f_ras_wounded" },
          ],
        },
      },
      {
        id: "grazed",
        when: { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
      },
      { id: "base" },
    ],
    fallback: "firm_toast",
    options: [
      {
        id: "firm_toast",
        tell: ["fra:+2", "temp:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 2 },
          { kind: "temp", delta: 1 },
          { kind: "flag", flag: "f_firm_toast" },
        ],
      },
      {
        id: "warm_only",
        tell: ["fra:-1", "court:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -1 },
          ear("court", 1),
          { kind: "flag", flag: "f_warm_toast" },
        ],
      },
      {
        id: "ask_limit",
        when: { kind: "memory", key: "k_saz_paris" },
        tell: ["fra:+1", "ministers:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 1 },
          ear("ministers", 1),
          { kind: "flag", flag: "f_limit_asked" },
        ],
      },
      {
        id: "ask_about_vienna",
        when: { kind: "memory", key: "k_paleo_hint" },
        tell: ["fra:+1", "temp:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "temp", delta: -1 },
          { kind: "flag", flag: "f_vienna_asked" },
        ],
      },
    ],
  },
  {
    id: "rus_c_ultimatum_out",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 7 },
        { kind: "flag", flag: "w_ultimatum_out" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "warned",
        when: {
          kind: "chose",
          scene: "rus_c_odd_opening",
          pick: "word_to_vienna",
        },
      },
      { id: "no_hartwig", when: { kind: "seen", scene: "rus_c_hartwig" } },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_council",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 7 },
        { kind: "flag", flag: "w_ultimatum_out" },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: {
      chancellor: { office: "chancellor" },
      fm: { office: "foreign" },
      war: { office: "war" },
      agri: { office: "agriculture" },
    },
    salience: 9,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      {
        id: "no_friend",
        when: {
          kind: "all",
          of: [
            { kind: "flag", flag: "f_ras_wounded" },
            { kind: "flag", flag: "f_heir_desk" },
          ],
        },
      },
      {
        id: "ministers_heard",
        when: { kind: "flag", flag: "f_door_ministers" },
      },
      {
        id: "grazed",
        when: { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
      },
      {
        id: "rodzianko_heard",
        when: { kind: "flag", flag: "f_door_rodzianko" },
      },
      { id: "base" },
    ],
    fallback: "stand_firm",
    options: [
      {
        id: "stand_firm",
        tell: ["temp:+1", "stavka:+1", "court:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          ear("stavka", 1),
          ear("court", -1),
          { kind: "flag", flag: "f_stand_firm" },
        ],
      },
      {
        id: "advise_belgrade",
        tell: ["ministers:+1", "stavka:-1"],
        effects: [
          ear("ministers", 1),
          ear("stavka", -1),
          { kind: "flag", flag: "f_advised_belgrade" },
        ],
      },
      {
        id: "ask_delay",
        when: { kind: "memory", key: "k_saz_delay" },
        tell: ["delay:2", "temp:-1", "stavka:-1"],
        effects: [
          { kind: "delay", days: 2 },
          { kind: "temp", delta: -1 },
          ear("stavka", -1),
          { kind: "world", of: { do: "hold" } },
          { kind: "flag", flag: "f_asked_delay" },
        ],
      },
      {
        id: "gold_home",
        when: { kind: "memory", key: "k_bark_berlin" },
        tell: ["money:+1", "temp:+1", "ministers:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: 1 },
          { kind: "temp", delta: 1 },
          ear("ministers", 1),
          { kind: "trust", tag: "DEU", delta: -1 },
          { kind: "flag", flag: "f_gold_home" },
        ],
      },
      {
        id: "let_go",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_durnovo_memo" },
            { kind: "memory", key: "k_witte_peace" },
          ],
        },
        tell: ["temp:-3", "srb:-3", "stavka:-2", "duma:-2", "court:+1"],
        effects: [
          { kind: "world", of: { do: "aside" } },
          { kind: "temp", delta: -3 },
          { kind: "trust", tag: "SRB", delta: -3 },
          ear("stavka", -2),
          ear("duma", -2),
          ear("court", 1),
          { kind: "flag", flag: "f_let_go" },
        ],
      },
    ],
  },
  {
    id: "rus_c_prep_period",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 6 },
        { kind: "crisis", topic: "balkan" },
        { kind: "temp", min: 4 },
        { kind: "seen", scene: "rus_c_council" },
      ],
    },
    cast: { war: { office: "war" }, cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["war"],
    once: true,
    variants: [
      { id: "firm", when: { kind: "flag", flag: "f_stand_firm" } },
      { id: "delayed", when: { kind: "flag", flag: "f_asked_delay" } },
      { id: "toast", when: { kind: "flag", flag: "f_firm_toast" } },
      { id: "base" },
    ],
    fallback: "hold",
    options: [
      {
        id: "hold",
        tell: ["temp:-1", "stavka:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          ear("stavka", -1),
          { kind: "flag", flag: "f_prep_held" },
        ],
      },
      {
        id: "sign_prep",
        tell: ["temp:+2", "stavka:+1", "deu:-1"],
        effects: [
          { kind: "temp", delta: 2 },
          ear("stavka", 1),
          { kind: "trust", tag: "DEU", delta: -1 },
          { kind: "flag", flag: "f_prep_signed" },
        ],
      },
      {
        id: "quiet_prep",
        when: { kind: "memory", key: "k_sukh_quiet" },
        tell: ["temp:+1", "stavka:+1", "ministers:-1"],
        effects: [
          { kind: "temp", delta: 1 },
          ear("stavka", 1),
          ear("ministers", -1),
          { kind: "flag", flag: "f_prep_quiet" },
        ],
      },
    ],
  },
  {
    id: "rus_c_willy",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 6 },
        { kind: "crisis", topic: "balkan" },
        { kind: "temp", min: 5 },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "prep_read", when: { kind: "flag", flag: "f_prep_signed" } },
      { id: "told", when: { kind: "seen", scene: "rus_v_pourtales_tears" } },
      { id: "cold", when: { kind: "trust", tag: "DEU", max: -1 } },
      { id: "base" },
    ],
    fallback: "firm",
    options: [
      {
        id: "firm",
        tell: ["deu:-1", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "DEU", delta: -1 },
          ear("stavka", 1),
          { kind: "flag", flag: "f_wire_firm" },
        ],
      },
      {
        id: "warm",
        tell: ["deu:+1", "temp:-1", "stavka:-1"],
        effects: [
          { kind: "trust", tag: "DEU", delta: 1 },
          { kind: "temp", delta: -1 },
          ear("stavka", -1),
          { kind: "flag", flag: "f_wire_warm" },
        ],
      },
      {
        id: "no_wire",
        tell: ["deu:-2", "ministers:+1"],
        effects: [
          { kind: "trust", tag: "DEU", delta: -2 },
          ear("ministers", 1),
          { kind: "flag", flag: "f_wire_none" },
        ],
      },
      {
        id: "hague",
        when: { kind: "memory", key: "k_alex_wire" },
        tell: ["temp:-1", "court:+1"],
        effects: [
          { kind: "temp", delta: -1 },
          ear("court", 1),
          { kind: "flag", flag: "f_wire_hague" },
        ],
      },
    ],
  },
  {
    id: "rus_c_partial",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 6 },
        { kind: "crisis", topic: "balkan" },
        {
          kind: "any",
          of: [
            { kind: "flag", flag: "w_aut_at_war" },
            { kind: "temp", min: 6 },
          ],
        },
      ],
    },
    cast: {
      war: { office: "war" },
      cos: { office: "chief_of_staff" },
      fm: { office: "foreign" },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "rails_true",
        when: {
          kind: "all",
          of: [
            { kind: "memory", key: "k_sukh_partial" },
            { kind: "secret", id: "rus_rail_ahead" },
          ],
        },
      },
      {
        id: "rails_false",
        when: {
          kind: "all",
          of: [
            { kind: "memory", key: "k_sukh_partial" },
            { kind: "not", of: { kind: "secret", id: "rus_rail_ahead" } },
          ],
        },
      },
      { id: "prep_signed", when: { kind: "flag", flag: "f_prep_signed" } },
      { id: "belgrade", when: { kind: "flag", flag: "w_aut_at_war" } },
      { id: "base" },
    ],
    fallback: "partial",
    options: [
      {
        id: "partial",
        tell: ["temp:+1", "stavka:-1"],
        effects: [
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 1 } },
          { kind: "temp", delta: 1 },
          ear("stavka", -1),
          { kind: "flag", flag: "f_partial" },
          {
            kind: "maybe",
            when: { kind: "not", of: { kind: "secret", id: "rus_rail_ahead" } },
            then: [
              { kind: "flag", flag: "f_partial_muddle" },
              { kind: "gauge", gauge: "order", delta: -1 },
            ],
          },
        ],
      },
      {
        id: "no_mob",
        tell: ["temp:-1", "stavka:-2", "ministers:+1"],
        effects: [
          { kind: "temp", delta: -1 },
          ear("stavka", -2),
          ear("ministers", 1),
          { kind: "flag", flag: "f_no_mob" },
        ],
      },
      {
        id: "general_now",
        tell: ["temp:+2", "stavka:+2", "deu:-2"],
        effects: [
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 2 } },
          { kind: "temp", delta: 2 },
          ear("stavka", 2),
          { kind: "trust", tag: "DEU", delta: -2 },
          { kind: "flag", flag: "f_rus_general" },
        ],
      },
      {
        id: "ask_railmen",
        when: { kind: "memory", key: "k_sukh_partial" },
        tell: ["temp:+1", "trust:-1"],
        effects: [
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 1 } },
          { kind: "temp", delta: 1 },
          { kind: "person_trust", who: { role: "war" }, delta: -1 },
          { kind: "flag", flag: "f_partial" },
          { kind: "flag", flag: "f_railmen" },
          {
            kind: "maybe",
            when: { kind: "secret", id: "rus_rail_ahead" },
            then: [
              { kind: "world", of: { do: "reveal", id: "rus_rail_ahead" } },
            ],
          },
          {
            kind: "maybe",
            when: { kind: "not", of: { kind: "secret", id: "rus_rail_ahead" } },
            then: [{ kind: "flag", flag: "f_partial_muddle" }],
          },
        ],
      },
    ],
  },
  {
    id: "rus_c_general_mob",
    nation: ["RUS"],
    kind: "crisis",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 6 },
        { kind: "crisis", topic: "balkan" },
        { kind: "temp", min: 6 },
        { kind: "not", of: { kind: "flag", flag: "f_rus_general" } },
        {
          kind: "any",
          of: [
            { kind: "seen", scene: "rus_c_partial" },
            { kind: "temp", min: 8 },
          ],
        },
      ],
    },
    cast: {
      fm: { office: "foreign" },
      war: { office: "war" },
      cos: { office: "chief_of_staff" },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      {
        id: "waited",
        when: { kind: "chose", scene: "rus_c_general_mob", pick: "wait_day" },
      },
      { id: "muddle", when: { kind: "flag", flag: "f_partial_muddle" } },
      {
        id: "germans",
        when: { kind: "world", of: { is: "mob", tag: "DEU", min: 1 } },
      },
      { id: "no_wire", when: { kind: "flag", flag: "f_wire_none" } },
      { id: "base" },
    ],
    fallback: "wait_day",
    options: [
      {
        id: "wait_day",
        tell: ["delay:1", "stavka:-1"],
        effects: [
          { kind: "delay", days: 1 },
          ear("stavka", -1),
          {
            kind: "maybe",
            when: { kind: "chapter", max: 4 },
            then: [
              { kind: "schedule", scene: "rus_c_general_mob", chapters: 1 },
            ],
          },
          { kind: "reason", key: "rc_mob_wait" },
        ],
      },
      {
        id: "sign",
        tell: ["temp:+3", "stavka:+2", "deu:-2", "fra:+1"],
        effects: [
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 2 } },
          { kind: "temp", delta: 3 },
          ear("stavka", 2),
          { kind: "trust", tag: "DEU", delta: -2 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "flag", flag: "f_rus_general" },
        ],
      },
      {
        id: "sign_and_wire",
        when: { kind: "memory", key: "k_willy_trust" },
        tell: ["temp:+2", "stavka:+1", "deu:-1"],
        effects: [
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 2 } },
          { kind: "temp", delta: 2 },
          ear("stavka", 1),
          { kind: "trust", tag: "DEU", delta: -1 },
          { kind: "flag", flag: "f_rus_general" },
          { kind: "flag", flag: "f_mob_wired" },
        ],
      },
      {
        id: "tear_up",
        when: { kind: "memory", key: "k_ras_wire" },
        tell: ["temp:-2", "stavka:-3", "court:+1"],
        effects: [
          { kind: "temp", delta: -2 },
          ear("stavka", -3),
          ear("court", 1),
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 1 } },
          { kind: "flag", flag: "f_mob_torn" },
        ],
      },
    ],
  },
  {
    id: "rus_c_cancel_night",
    nation: ["RUS"],
    kind: "dispute",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 6 },
        {
          kind: "any",
          of: [
            { kind: "chose", scene: "rus_c_general_mob", pick: "sign" },
            { kind: "chose", scene: "rus_c_partial", pick: "general_now" },
          ],
        },
        { kind: "memory", key: "k_willy_trust" },
      ],
    },
    cast: { fm: { office: "foreign" }, war: { office: "war" } },
    salience: 8,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "cold_wire", when: { kind: "trust", tag: "DEU", max: -2 } },
      { id: "night_wired", when: { kind: "flag", flag: "f_mob_wired" } },
      { id: "base" },
    ],
    fallback: "let_stand",
    options: [
      {
        id: "let_stand",
        tell: ["stavka:+1", "deu:-1"],
        effects: [
          ear("stavka", 1),
          { kind: "trust", tag: "DEU", delta: -1 },
          { kind: "flag", flag: "f_let_stand" },
        ],
      },
      {
        id: "recall_order",
        tell: ["temp:-1", "stavka:-2", "order:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          ear("stavka", -2),
          { kind: "gauge", gauge: "order", delta: -1 },
          { kind: "flag", flag: "f_mob_recalled" },
          { kind: "world", of: { do: "mobilize", tag: "RUS", level: 1 } },
          { kind: "unflag", flag: "f_rus_general" },
        ],
      },
    ],
  },
  {
    id: "rus_c_declaration",
    nation: ["RUS"],
    kind: "wire",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
        {
          kind: "any",
          of: [
            { kind: "at_war", tag: "DEU" },
            { kind: "at_war", tag: "AUH" },
          ],
        },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 9,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "general", when: { kind: "flag", flag: "f_rus_general" } },
      {
        id: "unsigned",
        when: { kind: "not", of: { kind: "flag", flag: "f_rus_general" } },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_balcony",
    nation: ["RUS"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: {
      chancellor: { office: "chancellor" },
      interior: { office: "interior" },
    },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "after_torn",
        when: {
          kind: "any",
          of: [
            { kind: "flag", flag: "f_mob_torn" },
            { kind: "flag", flag: "f_no_mob" },
          ],
        },
      },
      { id: "rodzianko", when: { kind: "flag", flag: "f_door_rodzianko" } },
      { id: "base" },
    ],
    fallback: "manifesto",
    options: [
      {
        id: "manifesto",
        tell: ["morale:+1", "court:+1", "duma:-1"],
        effects: [
          { kind: "gauge", gauge: "morale", delta: 1 },
          ear("court", 1),
          ear("duma", -1),
          { kind: "flag", flag: "f_manifesto" },
        ],
      },
      {
        id: "oath_1812",
        tell: ["morale:+2", "stavka:+1", "ministers:-1"],
        effects: [
          { kind: "gauge", gauge: "morale", delta: 2 },
          ear("stavka", 1),
          ear("ministers", -1),
          { kind: "flag", flag: "f_oath_1812" },
        ],
      },
      {
        id: "duma_day",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_rodz_session" },
            { kind: "memory", key: "k_gor_duma" },
          ],
        },
        tell: ["duma:+2", "morale:+1", "court:-1"],
        effects: [
          ear("duma", 2),
          { kind: "gauge", gauge: "morale", delta: 1 },
          ear("court", -1),
          { kind: "flag", flag: "f_duma_day" },
        ],
      },
      {
        id: "amnesty",
        when: { kind: "memory", key: "k_ker_amnesty" },
        tell: ["duma:+1", "morale:+1", "order:-1", "court:-1"],
        effects: [
          ear("duma", 1),
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "gauge", gauge: "order", delta: -1 },
          ear("court", -1),
          { kind: "flag", flag: "f_amnesty" },
        ],
      },
    ],
  },
  {
    id: "rus_c_supreme",
    nation: ["RUS"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, war: { office: "war" } },
    salience: 9,
    tags: ["people", "war"],
    once: true,
    variants: [
      { id: "generals", when: { kind: "flag", flag: "f_door_generals" } },
      { id: "night", when: { kind: "flag", flag: "f_heir_night" } },
      { id: "court_near", when: { kind: "flag", flag: "f_door_family" } },
      { id: "base" },
    ],
    fallback: "grand_duke",
    options: [
      {
        id: "grand_duke",
        tell: ["stavka:+2", "court:-1", "morale:+1"],
        effects: [
          {
            kind: "appoint",
            who: { person: "rus_nikolasha" },
            office: "supreme_commander",
          },
          ear("stavka", 2),
          ear("court", -1),
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "flag", flag: "f_nik_commands" },
        ],
      },
      {
        id: "self_command",
        tell: ["court:+2", "ministers:-2", "morale:+1"],
        effects: [
          selfCommand,
          ear("court", 2),
          ear("ministers", -2),
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "flag", flag: "f_self_1914" },
        ],
      },
      {
        id: "sukhomlinov",
        when: { kind: "memory", key: "k_sukh_self" },
        tell: ["court:+1", "stavka:-2"],
        effects: [
          {
            kind: "appoint",
            who: { person: "rus_sukhomlinov" },
            office: "supreme_commander",
          },
          ear("court", 1),
          ear("stavka", -2),
          { kind: "flag", flag: "f_sukh_commands" },
        ],
      },
      {
        id: "limit_powers",
        when: { kind: "memory", key: "k_nik_powers" },
        tell: ["stavka:+1", "ministers:+1"],
        effects: [
          {
            kind: "appoint",
            who: { person: "rus_nikolasha" },
            office: "supreme_commander",
          },
          ear("stavka", 1),
          ear("ministers", 1),
          { kind: "flag", flag: "f_nik_commands" },
          { kind: "flag", flag: "f_nik_limited" },
        ],
      },
    ],
  },
  {
    id: "rus_c_both_fronts",
    nation: ["RUS"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
        { kind: "at_war", tag: "DEU" },
      ],
    },
    cast: { cos: { office: "chief_of_staff" } },
    salience: 9,
    tags: ["war", "tension_up"],
    once: true,
    variants: [
      { id: "plea", when: { kind: "memory", key: "k_paleo_plea" } },
      { id: "self", when: cmd },
      {
        id: "nik",
        when: {
          kind: "holder",
          office: "supreme_commander",
          person: "rus_nikolasha",
        },
      },
      { id: "base" },
    ],
    fallback: "both",
    options: [
      {
        id: "both",
        tell: ["fra:+2", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 2 },
          ear("stavka", 1),
          { kind: "flag", flag: "f_both_fronts" },
        ],
      },
      {
        id: "prussia_first",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_nik_prussia" },
            { kind: "memory", key: "k_paleo_plea" },
          ],
        },
        tell: ["fra:+2", "stavka:+1", "ministers:-1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: 2 },
          ear("stavka", 1),
          ear("ministers", -1),
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "flag", flag: "f_prussia_first" },
        ],
      },
      {
        id: "galicia_first",
        when: { kind: "memory", key: "k_alek_kiev" },
        tell: ["fra:-2", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -2 },
          ear("stavka", 1),
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "flag", flag: "f_galicia_first" },
        ],
      },
      {
        id: "wait_mob",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_sukh_ready" },
            { kind: "memory", key: "k_danilov_nw" },
          ],
        },
        tell: ["fra:-3", "stavka:-1", "ministers:+1"],
        effects: [
          { kind: "trust", tag: "FRA", delta: -3 },
          ear("stavka", -1),
          ear("ministers", 1),
          {
            kind: "world",
            of: { do: "force", tag: "RUS", theatre: "east", delta: 1 },
          },
          { kind: "flag", flag: "f_waited_mob" },
        ],
      },
    ],
  },
  {
    id: "rus_c_vodka",
    nation: ["RUS"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7, max: 9 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: {
      finance: { office: "finance" },
      chancellor: { office: "chancellor" },
    },
    salience: 8,
    tags: ["home"],
    once: true,
    variants: [
      { id: "bark", when: { kind: "memory", key: "k_bark_vodka" } },
      { id: "self", when: cmd },
      { id: "base" },
    ],
    fallback: "mob_only",
    options: [
      {
        id: "mob_only",
        tell: ["ministers:+1"],
        effects: [
          ear("ministers", 1),
          { kind: "flag", flag: "f_vodka_mob_only" },
        ],
      },
      {
        id: "whole_war",
        tell: ["order:+1", "morale:+1", "money:-2"],
        effects: [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -2 },
          { kind: "flag", flag: "f_vodka_war" },
        ],
      },
      {
        id: "whole_war_tax",
        when: { kind: "memory", key: "k_bark_vodka" },
        tell: ["order:+1", "money:-1", "duma:-1"],
        effects: [
          { kind: "gauge", gauge: "order", delta: 1 },
          { kind: "gauge", gauge: "money", delta: -1 },
          ear("duma", -1),
          { kind: "flag", flag: "f_vodka_war" },
          { kind: "flag", flag: "f_vodka_tax" },
        ],
      },
    ],
  },
  {
    id: "rus_c_first_battles",
    nation: ["RUS"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7, max: 9 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: {},
    salience: 8,
    tags: ["war"],
    once: true,
    stamp: "confirmed",
    source: "staff",
    variants: [
      { id: "tannenberg", when: { kind: "flag", flag: "w_tannenberg" } },
      { id: "east_luck", when: { kind: "flag", flag: "w_bad_luck_east" } },
      { id: "galicia", when: { kind: "flag", flag: "f_galicia_first" } },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_ottoman",
    nation: ["RUS"],
    kind: "crisis",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7 },
        date(undefined, "1915-06"),
        { kind: "world", of: { is: "entered", tag: "OTT" } },
      ],
    },
    cast: { fm: { office: "foreign" }, navy: { office: "navy" } },
    salience: 7,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "fleet_late", when: { kind: "secret", id: "ott_fleet_late" } },
      { id: "shells_low", when: { kind: "gauge", gauge: "shells", max: 1 } },
      { id: "base" },
    ],
    fallback: "declare",
    options: [
      {
        id: "declare",
        tell: ["straits:+1", "morale:+1", "court:+1"],
        effects: [
          { kind: "world", of: { do: "declare", tag: "OTT" } },
          { kind: "pressure", topic: "straits", delta: 1 },
          { kind: "gauge", gauge: "morale", delta: 1 },
          ear("court", 1),
          { kind: "flag", flag: "f_ott_declared" },
        ],
      },
      {
        id: "ask_allies",
        tell: ["gbr:+1", "fra:+1", "delay:3"],
        effects: [
          { kind: "world", of: { do: "declare", tag: "OTT" } },
          { kind: "trust", tag: "GBR", delta: 1 },
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "delay", days: 3 },
          { kind: "flag", flag: "f_ott_asked" },
        ],
      },
      {
        id: "name_the_prize",
        when: { kind: "memory", key: "k_buchanan_line" },
        tell: ["straits:+2", "gbr:-1", "ministers:+1"],
        effects: [
          { kind: "world", of: { do: "declare", tag: "OTT" } },
          { kind: "pressure", topic: "straits", delta: 2 },
          { kind: "trust", tag: "GBR", delta: -1 },
          ear("ministers", 1),
          { kind: "flag", flag: "f_straits_named" },
        ],
      },
    ],
  },
  {
    id: "rus_c_first_shells",
    nation: ["RUS"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 9, max: 14 },
        { kind: "world", of: { is: "war" } },
        { kind: "gauge", gauge: "shells", max: 1 },
      ],
    },
    cast: { war: { office: "war" }, cos: { office: "chief_of_staff" } },
    salience: 8,
    tags: ["war"],
    once: true,
    variants: [
      { id: "letter", when: { kind: "memory", key: "k_yan_letter" } },
      { id: "books", when: { kind: "memory", key: "k_poli_books" } },
      {
        id: "candid",
        when: {
          kind: "all",
          of: [
            { kind: "memory", key: "k_sukh_shells" },
            { kind: "not", of: { kind: "memory", key: "k_yan_letter" } },
          ],
        },
      },
      { id: "base" },
    ],
    fallback: "ration",
    options: [
      {
        id: "ration",
        tell: ["shells:+1", "stavka:-1"],
        effects: [
          { kind: "gauge", gauge: "shells", delta: 1 },
          ear("stavka", -1),
          { kind: "flag", flag: "f_shells_ration" },
        ],
      },
      {
        id: "order_abroad",
        when: { kind: "memory", key: "k_bark_credit" },
        tell: ["money:-1", "shells:+1", "ministers:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -1 },
          { kind: "gauge", gauge: "shells", delta: 1 },
          ear("ministers", 1),
          { kind: "flag", flag: "f_shells_abroad" },
        ],
      },
      {
        id: "open_books",
        when: {
          kind: "any",
          of: [
            { kind: "memory", key: "k_poli_books" },
            { kind: "memory", key: "k_sukh_shells" },
          ],
        },
        tell: ["ministers:+1", "court:-1", "duma:+1"],
        effects: [
          ear("ministers", 1),
          ear("court", -1),
          ear("duma", 1),
          { kind: "flag", flag: "f_books_open" },
        ],
      },
      {
        id: "ask_stavka",
        when: { kind: "memory", key: "k_yan_letter" },
        tell: ["stavka:+1", "trust:-1"],
        effects: [
          ear("stavka", 1),
          { kind: "person_trust", who: { role: "war" }, delta: -1 },
          { kind: "flag", flag: "f_asked_stavka" },
        ],
      },
    ],
  },
  {
    id: "rus_c_closing",
    nation: ["RUS"],
    kind: "ledger",
    stage: ["closing"],
    when: { kind: "chapter", max: 11 },
    cast: { chancellor: { office: "chancellor" } },
    salience: 9,
    tags: ["home"],
    once: true,
    variants: [
      { id: "abandoned", when: { kind: "flag", flag: "f_let_go" } },
      {
        id: "peace",
        when: { kind: "not", of: { kind: "world", of: { is: "war" } } },
      },
      { id: "ahead", when: { kind: "flag", flag: "w_bad_luck_east" } },
      { id: "tannenberg", when: { kind: "flag", flag: "w_tannenberg" } },
      { id: "base" },
    ],
    fallback: "close_year",
    options: [
      {
        id: "close_year",
        tell: [],
        effects: [{ kind: "flag", flag: "f_closed_1914" }],
      },
    ],
  },
  {
    id: "rus_c_odd_opening",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "survived", when: { kind: "opening", of: ["sarajevo_survived"] } },
      { id: "base" },
    ],
    fallback: "watch",
    options: [
      {
        id: "watch",
        tell: ["ministers:+1"],
        effects: [
          ear("ministers", 1),
          { kind: "flag", flag: "f_opening_watched" },
        ],
      },
      {
        id: "warn_belgrade",
        tell: ["temp:-1", "srb:-1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "trust", tag: "SRB", delta: -1 },
          { kind: "flag", flag: "f_opening_warned" },
        ],
      },
      {
        id: "word_to_vienna",
        when: { kind: "memory", key: "k_saz_limit" },
        tell: ["temp:+1", "stavka:+1"],
        effects: [
          { kind: "temp", delta: 1 },
          ear("stavka", 1),
          { kind: "flag", flag: "f_opening_word" },
        ],
      },
      {
        id: "ask_attache",
        when: { kind: "memory", key: "k_saz_attache" },
        tell: ["stavka:-1", "ministers:+1"],
        effects: [
          {
            kind: "maybe",
            when: { kind: "secret", id: "srb_officers_plot" },
            then: [
              { kind: "world", of: { do: "reveal", id: "srb_officers_plot" } },
            ],
          },
          ear("stavka", -1),
          ear("ministers", 1),
          { kind: "flag", flag: "f_attache_read" },
        ],
      },
    ],
  },
  {
    id: "rus_c_hartwig",
    nation: ["RUS"],
    kind: "report",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 1, max: 2 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
          ],
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["foreign", "tension_up"],
    once: true,
    stamp: "confirmed",
    source: "attache",
    variants: [
      {
        id: "grazed",
        when: { kind: "opening", of: ["sarajevo_survived", "sarajevo_failed"] },
      },
      { id: "base" },
    ],
  },
  {
    id: "rus_c_regent_plea",
    nation: ["RUS"],
    kind: "proposal",
    stage: ["crisis"],
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "flag", flag: "w_ultimatum_out" },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { fm: { office: "foreign" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "advised", when: { kind: "flag", flag: "f_advised_belgrade" } },
      { id: "base" },
    ],
    fallback: "kind_words",
    options: [
      {
        id: "kind_words",
        tell: ["srb:+1"],
        effects: [
          { kind: "trust", tag: "SRB", delta: 1 },
          { kind: "flag", flag: "f_regent_kind" },
        ],
      },
      {
        id: "promise_help",
        tell: ["srb:+2", "temp:+1", "stavka:+1"],
        effects: [
          { kind: "trust", tag: "SRB", delta: 2 },
          { kind: "temp", delta: 1 },
          ear("stavka", 1),
          { kind: "flag", flag: "f_regent_promised" },
        ],
      },
      {
        id: "advise_accept",
        when: { kind: "memory", key: "k_kriv_notready" },
        tell: ["temp:-1", "srb:-2", "ministers:+1"],
        effects: [
          { kind: "temp", delta: -1 },
          { kind: "trust", tag: "SRB", delta: -2 },
          ear("ministers", 1),
          { kind: "flag", flag: "f_regent_accept" },
        ],
      },
    ],
  },
  {
    id: "rus_c_poland_word",
    nation: ["RUS"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 6, max: 8 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { fm: { office: "foreign" }, chancellor: { office: "chancellor" } },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "self",
        when: {
          kind: "not",
          of: {
            kind: "holder",
            office: "supreme_commander",
            person: "rus_nikolasha",
          },
        },
      },
      { id: "base" },
    ],
    fallback: "let_it_stand",
    options: [
      {
        id: "let_it_stand",
        tell: ["ministers:-1", "fra:+1"],
        effects: [
          ear("ministers", -1),
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "pressure", topic: "poland", delta: 1 },
          { kind: "flag", flag: "f_poland_word" },
        ],
      },
      {
        id: "strike_it",
        tell: ["ministers:+1", "stavka:-1", "morale:-1"],
        effects: [
          ear("ministers", 1),
          ear("stavka", -1),
          { kind: "gauge", gauge: "morale", delta: -1 },
          { kind: "flag", flag: "f_poland_struck" },
        ],
      },
      {
        id: "widen_it",
        when: { kind: "memory", key: "k_nik_sisters" },
        tell: ["duma:+1", "ministers:-2", "court:-1", "fra:+1"],
        effects: [
          ear("duma", 1),
          ear("ministers", -2),
          ear("court", -1),
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "pressure", topic: "poland", delta: 2 },
          { kind: "flag", flag: "f_poland_word" },
          { kind: "flag", flag: "f_poland_wide" },
        ],
      },
    ],
  },
  {
    id: "rus_c_rename",
    nation: ["RUS"],
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 7, max: 9 },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { chancellor: { office: "chancellor" }, court: { office: "court" } },
    salience: 4,
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      { id: "after_loss", when: { kind: "flag", flag: "w_tannenberg" } },
      { id: "base" },
    ],
    fallback: "keep_name",
    options: [
      { id: "keep_name", tell: ["court:+1"], effects: [ear("court", 1)] },
      {
        id: "petrograd",
        tell: ["morale:+1"],
        effects: [
          { kind: "gauge", gauge: "morale", delta: 1 },
          { kind: "flag", flag: "f_petrograd" },
        ],
      },
    ],
  },
  {
    id: "rus_c_pourtales_gone",
    nation: ["RUS"],
    kind: "report",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 6, max: 9 },
        { kind: "world", of: { is: "war" } },
        { kind: "seen", scene: "rus_c_declaration" },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["foreign", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      { id: "wire_warm", when: { kind: "flag", flag: "f_wire_warm" } },
      { id: "base" },
    ],
  },
  {
    id: "rus_t_sazonov_limit",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 0, max: 2 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "opening", of: ["no_sarajevo", "sarajevo_delayed"] },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "shut",
            when: { kind: "person_trust", who: { role: "p" }, max: -2 },
          },
          {
            id: "near",
            when: { kind: "person_trust", who: { role: "p" }, min: 2 },
          },
          {
            id: "anxious",
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
            next: "vienna",
          },
          {
            id: "line",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "line",
            gain: [{ kind: "remember", key: "k_saz_limit" }],
            miss: "flush",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["ministers:+1", "court:-1"],
            effects: [
              ear("ministers", 1),
              ear("court", -1),
              { kind: "remember", key: "k_saz_limit" },
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: "line",
          },
          {
            id: "rival",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sukh",
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
      sukh: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "go_on",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_saz_limit" }],
            next: "line",
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
        says: [
          {
            id: "good",
            when: { kind: "source_band", source: "embassy_vienna", min: 2 },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "go_on",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "line",
            gain: [{ kind: "remember", key: "k_saz_limit" }],
            miss: "flush",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "keep",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
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
      flush: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "calm",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              { kind: "remember", key: "k_saz_limit" },
              { kind: "mood", delta: 1 },
            ],
            next: "line",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_saz_flush" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_sazonov_attache",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 1, max: 3 },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "stubborn",
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
            next: "guess",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["stavka:-1"],
            effects: [
              ear("stavka", -1),
              { kind: "remember", key: "k_saz_attache" },
            ],
            next: "demand",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "stavka:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              ear("stavka", -1),
              { kind: "remember", key: "k_saz_attache" },
            ],
            next: "guess",
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
      guess: {
        says: [
          {
            id: "plot",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "secret", id: "srb_officers_plot" },
              ],
            },
          },
          { id: "no_plot", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "use",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_saz_attache" }],
            next: null,
          },
          {
            id: "bury",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "flag", flag: "f_saz_buried_letter" }],
            next: null,
          },
        ],
      },
      demand: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_saz_attache" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_sazonov_paris",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "anxious",
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
            next: "london",
          },
          {
            id: "yes",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "text",
            gain: [{ kind: "remember", key: "k_saz_paris" }],
            miss: "text2",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["trust:+1", "fra:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "trust", tag: "FRA", delta: 1 },
              { kind: "remember", key: "k_saz_paris" },
            ],
            next: "text",
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
      london: {
        says: [
          {
            id: "talks",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "secret", id: "anglo_russian_naval_talks" },
              ],
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: {
                  kind: "all",
                  of: [
                    { kind: "candid", who: { role: "p" } },
                    { kind: "secret", id: "anglo_russian_naval_talks" },
                  ],
                },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "anglo_russian_naval_talks" },
                  },
                ],
              },
              { kind: "remember", key: "k_saz_paris" },
            ],
            next: "text",
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
      text: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "good",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
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
      text2: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "fine",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_saz_paris" }],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_saz_paris" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_sazonov_delay",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "flag", flag: "w_ultimatum_out" },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "stubborn",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
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
            next: "who",
            gain: [{ kind: "remember", key: "k_saz_delay" }],
            miss: "who_not",
          },
          {
            id: "order",
            stance: "cold",
            kind: "push",
            tell: ["temp:-1"],
            effects: [
              { kind: "temp", delta: -1 },
              { kind: "remember", key: "k_saz_delay" },
            ],
            next: "order",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1", "stavka:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              ear("stavka", -1),
              { kind: "remember", key: "k_saz_delay" },
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "do",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "doubt",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_saz_asked_army", who: { role: "p" } },
            ],
            next: null,
          },
        ],
      },
      who_not: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_saz_delay" }],
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
      order: {
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
    id: "rus_t_sazonov_straits",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [date("1914-11", "1915-12"), { kind: "at_war", tag: "OTT" }, atDesk],
    },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "anxious",
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
            next: "rome",
          },
          {
            id: "yes",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "paper",
            gain: [{ kind: "remember", key: "k_saz_straits" }],
            miss: "wait",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["ministers:+1", "stavka:-1"],
            effects: [
              ear("ministers", 1),
              ear("stavka", -1),
              { kind: "pride", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_saz_straits" },
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
      rome: {
        says: [
          {
            id: "ita",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "secret", id: "ita_fra_understanding" },
              ],
            },
          },
          {
            id: "fleet",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "secret", id: "ott_fleet_late" },
              ],
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "maybe",
                when: {
                  kind: "all",
                  of: [
                    { kind: "candid", who: { role: "p" } },
                    { kind: "secret", id: "ita_fra_understanding" },
                  ],
                },
                then: [
                  {
                    kind: "world",
                    of: { do: "reveal", id: "ita_fra_understanding" },
                  },
                ],
              },
              { kind: "remember", key: "k_saz_straits" },
            ],
            next: "paper",
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
      paper: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
          {
            id: "cool",
            stance: "cold",
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
            id: "firm",
            stance: "frank",
            kind: "ask",
            tell: ["trust:-1"],
            effects: [
              { kind: "remember", key: "k_saz_straits" },
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
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
    id: "rus_t_sazonov_poland",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1916-12"),
        {
          kind: "world",
          of: { is: "front", theatre: "east", from: "vistula" },
        },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_sazonov" } },
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
            id: "stubborn",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
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
            gain: [{ kind: "remember", key: "k_saz_poland" }],
            miss: "alone",
          },
          {
            id: "deal",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_saz_poland" },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_saz_poland",
                chapters: 8,
                keep: {
                  kind: "chose",
                  scene: "rus_h_poland_charter",
                  pick: "charter",
                },
              },
            ],
            next: "promise",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "ministers:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("ministers", -1),
            ],
            next: "hurt",
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
      friends: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "cool",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      alone: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "warm",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              { kind: "remember", key: "k_saz_poland" },
              { kind: "mood", delta: 1 },
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
      promise: {
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
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_saz_poland" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_sukh_ready",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 0, max: 3 },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "shut",
            when: { kind: "person_trust", who: { role: "p" }, max: -2 },
          },
          {
            id: "cunning",
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
            next: "numbers",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "numbers",
            gain: [
              { kind: "remember", key: "k_sukh_ready" },
              { kind: "mood", delta: 1 },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:-1", "money:-1"],
            effects: [
              ear("ministers", -1),
              { kind: "gauge", gauge: "money", delta: -1 },
              { kind: "remember", key: "k_sukh_ready" },
            ],
            next: "table",
          },
          {
            id: "rival",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "poli",
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
      poli: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "more",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_sukh_ready" },
            ],
            next: "table",
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
            id: "low",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                {
                  kind: "competence",
                  who: { role: "p" },
                  field: "admin",
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
                { kind: "candid", who: { role: "p" } },
                {
                  kind: "competence",
                  who: { role: "p" },
                  field: "admin",
                  min: 2,
                },
              ],
            },
          },
          { id: "base" },
        ],
        replies: [
          {
            id: "more",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_sukh_ready" },
            ],
            next: "table",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["cunning"],
                },
                next: "table",
                effects: [{ kind: "remember", key: "k_sukh_ready" }],
              },
            ],
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
      table: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "frank",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_sukh_paris" }],
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
    },
  },
  {
    id: "rus_t_sukh_partial",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "near",
            when: { kind: "person_trust", who: { role: "p" }, min: 2 },
          },
          {
            id: "arrogant",
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
            next: "rails",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rails",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "joke",
                effects: [{ kind: "pride", who: { role: "p" }, delta: -1 }],
              },
            ],
            gain: [{ kind: "remember", key: "k_sukh_partial" }],
            miss: "joke",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["stavka:+1"],
            effects: [
              ear("stavka", 1),
              { kind: "pride", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_sukh_partial" },
            ],
            next: "rails",
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
      rails: {
        says: [
          {
            id: "yes",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "secret", id: "rus_rail_ahead" },
              ],
            },
          },
          { id: "no", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              { kind: "remember", key: "k_sukh_partial" },
              {
                kind: "maybe",
                when: {
                  kind: "all",
                  of: [
                    { kind: "candid", who: { role: "p" } },
                    { kind: "secret", id: "rus_rail_ahead" },
                  ],
                },
                then: [
                  { kind: "world", of: { do: "reveal", id: "rus_rail_ahead" } },
                ],
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
      joke: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "flat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_sukh_partial" },
              { kind: "reason", key: "rc_sukh_partial" },
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
    id: "rus_t_sukh_quiet",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 5 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "cunning",
            when: { kind: "temperament", who: { role: "p" }, of: ["cunning"] },
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
            next: "how",
            gain: [{ kind: "remember", key: "k_sukh_quiet" }],
            miss: "how_not",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "how",
            gain: [{ kind: "remember", key: "k_sukh_quiet" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:-1", "trust:+1"],
            effects: [
              ear("ministers", -1),
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_sukh_quiet" },
            ],
            next: "how",
          },
          {
            id: "leave",
            stance: "frank",
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
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "doubt",
            stance: "frank",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      how_not: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "press",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_sukh_quiet" }],
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
    id: "rus_t_sukh_self",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 8 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "world", of: { is: "war" } },
          ],
        },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "arrogant",
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
            next: "wants",
            gain: [{ kind: "remember", key: "k_sukh_self" }],
            miss: "denies",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wants",
            gain: [{ kind: "remember", key: "k_sukh_self" }],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1", "court:+1"],
            effects: [
              ear("stavka", -1),
              ear("court", 1),
              { kind: "remember", key: "k_sukh_self" },
            ],
            next: "wants",
          },
          {
            id: "rival",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "nik",
          },
          {
            id: "leave",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      nik: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_sukh_self" }],
            next: "wants",
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
      wants: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "laugh",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
            next: null,
          },
        ],
      },
      denies: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "press",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              { kind: "remember", key: "k_sukh_self" },
              { kind: "reason", key: "rc_sukh_self" },
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
    id: "rus_t_sukh_shells",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 8 },
        date(undefined, "1915-12"),
        { kind: "world", of: { is: "war" } },
        { kind: "holder", office: "war", person: "rus_sukhomlinov" },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "shut",
            when: { kind: "person_trust", who: { role: "p" }, max: -2 },
          },
          {
            id: "arrogant",
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
            next: "split",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "court:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("court", -1),
              { kind: "remember", key: "k_sukh_shells" },
            ],
            next: "fear",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:-1"],
            effects: [
              ear("stavka", -1),
              { kind: "remember", key: "k_sukh_shells" },
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
        says: [
          { id: "truth", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_sukh_shells" }],
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
      fear: {
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
    id: "rus_t_sukh_wife",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        { kind: "holder", office: "war", person: "rus_sukhomlinov" },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_sukhomlinov" } },
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
            id: "cunning",
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
            effects: [
              {
                kind: "roll",
                key: "rus_myasoedov",
                pct: 50,
                then: [{ kind: "flag", flag: "f_rus_myasoedov_true" }],
              },
            ],
            next: "spy",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              ear("court", -1),
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_sukh_wife" },
            ],
            next: "papers",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_sukh_wife" },
            ],
            next: "cover",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["arrogant"],
                },
                next: "cover",
                effects: [
                  { kind: "pride", who: { role: "p" }, delta: -1 },
                  { kind: "remember", key: "k_sukh_wife" },
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
      spy: {
        says: [
          {
            id: "yes",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "flag", flag: "f_rus_myasoedov_true" },
              ],
            },
          },
          { id: "no", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_sukh_wife" }],
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
      papers: {
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
      cover: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_sukh_wife" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_nik_sisters",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 0, max: 7 },
    cast: { p: { person: "rus_nikolasha" } },
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
            id: "shut",
            when: { kind: "person_trust", who: { role: "p" }, max: -2 },
          },
          {
            id: "near",
            when: { kind: "person_trust", who: { role: "p" }, min: 2 },
          },
          {
            id: "arrogant",
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
            next: "table",
            gain: [{ kind: "remember", key: "k_nik_sisters" }],
            miss: "hunt",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "court:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("court", 1),
            ],
            next: "hurt",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "hurt",
                effects: [{ kind: "remember", key: "k_nik_sisters" }],
              },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              ear("stavka", 1),
              ear("court", -1),
              { kind: "pride", who: { role: "p" }, delta: 1 },
              { kind: "remember", key: "k_nik_sisters" },
            ],
            next: "table",
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
      table: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
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
      hunt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_sisters" }],
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
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_nik_sisters" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_nik_powers",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
        { kind: "not", of: { kind: "seen", scene: "rus_c_supreme" } },
      ],
    },
    cast: { p: { person: "rus_nikolasha" } },
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
            id: "stubborn",
            when: { kind: "temperament", who: { role: "p" }, of: ["stubborn"] },
          },
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
            next: "gap",
            gain: [{ kind: "remember", key: "k_nik_powers" }],
            miss: "gap_no",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:+1", "stavka:-1"],
            effects: [
              ear("ministers", 1),
              ear("stavka", -1),
              { kind: "remember", key: "k_nik_powers" },
            ],
            next: "gap",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "push",
            tell: ["stavka:+1"],
            effects: [ear("stavka", 1)],
            next: "wear",
          },
          {
            id: "rival",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sukh",
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
      sukh: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_powers" }],
            next: "gap",
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
      gap: {
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
            id: "doubt",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: null,
          },
        ],
      },
      gap_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_powers" }],
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
      wear: {
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
    id: "rus_t_nik_prussia",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
        { kind: "at_war", tag: "DEU" },
      ],
    },
    cast: { p: { person: "rus_nikolasha" } },
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
            id: "arrogant",
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
            next: "days",
            gain: [{ kind: "remember", key: "k_nik_prussia" }],
            miss: "days_no",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "days",
            gain: [
              { kind: "remember", key: "k_nik_prussia" },
              { kind: "mood", delta: 1 },
            ],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["fra:+1", "stavka:+1"],
            effects: [
              { kind: "trust", tag: "FRA", delta: 1 },
              ear("stavka", 1),
              { kind: "remember", key: "k_nik_prussia" },
            ],
            next: "days",
          },
          {
            id: "rival",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "dan",
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
      dan: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_prussia" }],
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
      days: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
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
      days_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_prussia" }],
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
    id: "rus_t_nik_friend",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        {
          kind: "holder",
          office: "supreme_commander",
          person: "rus_nikolasha",
        },
      ],
    },
    cast: { p: { person: "rus_nikolasha" } },
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
            id: "stubborn",
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
            next: "why",
            gain: [{ kind: "remember", key: "k_nik_friend" }],
            miss: "icon",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "stavka:+1"],
            effects: [
              ear("court", -1),
              ear("stavka", 1),
              { kind: "remember", key: "k_nik_friend" },
            ],
            next: "why",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1", "stavka:-1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("stavka", -1),
              { kind: "remember", key: "k_nik_friend" },
            ],
            next: "cold",
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
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: 1 }],
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
      icon: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_nik_friend" }],
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
      cold: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_nik_friend" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_nik_retreat",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        {
          kind: "world",
          of: { is: "front", theatre: "east", from: "vistula" },
        },
        {
          kind: "holder",
          office: "supreme_commander",
          person: "rus_nikolasha",
        },
      ],
    },
    cast: { p: { person: "rus_nikolasha" } },
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
          {
            id: "stubborn",
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
            next: "how",
            gain: [{ kind: "remember", key: "k_nik_retreat" }],
            miss: "tears",
          },
          {
            id: "hold",
            stance: "cold",
            kind: "push",
            tell: ["stavka:-1", "morale:+1"],
            effects: [
              ear("stavka", -1),
              { kind: "gauge", gauge: "morale", delta: 1 },
            ],
            next: "hold",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              ear("stavka", 1),
              ear("court", -1),
              { kind: "remember", key: "k_nik_retreat" },
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
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tears: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "sit",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              { kind: "remember", key: "k_nik_retreat" },
              { kind: "mood", delta: 1 },
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_nik_hold" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_nik_caucasus",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", undefined),
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "supreme_commander",
            person: "rus_nikolasha",
          },
        },
        { kind: "world", of: { is: "war" } },
      ],
    },
    cast: { p: { person: "rus_nikolasha" } },
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
            next: "army",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["stavka:+1", "court:-1"],
            effects: [
              ear("stavka", 1),
              ear("court", -1),
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_nik_return",
                chapters: 12,
                keep: {
                  kind: "any",
                  of: [
                    {
                      kind: "holder",
                      office: "supreme_commander",
                      person: "rus_nikolasha",
                    },
                    { kind: "seen", scene: "rus_r_abdication" },
                  ],
                },
              },
            ],
            next: "dealt",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "wound",
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
      army: {
        says: [
          {
            id: "low",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "gauge", gauge: "morale", max: 2 },
              ],
            },
          },
          { id: "high", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
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
      dealt: {
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
      wound: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_nik_wound" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_gor_nothing",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 0, max: 2 },
    cast: { p: { person: "rus_goremykin" } },
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
            id: "near",
            when: { kind: "person_trust", who: { role: "p" }, min: 2 },
          },
          {
            id: "weary",
            when: { kind: "temperament", who: { role: "p" }, of: ["weary"] },
          },
          {
            id: "stubborn",
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
            next: "minds",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "minds",
            gain: [{ kind: "mood", delta: 1 }],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["ministers:-1", "court:+1"],
            effects: [
              ear("ministers", -1),
              ear("court", 1),
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              { kind: "mood", delta: 1 },
            ],
            next: "minds",
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
      minds: {
        says: [
          { id: "open", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wish",
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
      wish: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_nothing" }],
            next: null,
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
    },
  },
  {
    id: "rus_t_gor_duma",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "all", of: [{ kind: "chapter", min: 1, max: 7 }, atDesk] },
    cast: { p: { person: "rus_goremykin" } },
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
            id: "stubborn",
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
            next: "use",
            gain: [{ kind: "remember", key: "k_gor_duma" }],
            miss: "use_no",
          },
          {
            id: "order",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "duma:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("duma", 1),
              { kind: "remember", key: "k_gor_duma" },
            ],
            next: "day",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1", "court:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              ear("court", 1),
              { kind: "remember", key: "k_gor_duma" },
            ],
            next: "day",
          },
          {
            id: "rival",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "rodz",
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
      rodz: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_duma" }],
            next: "day",
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
      use: {
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
      use_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_duma" }],
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
      day: {
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
    },
  },
  {
    id: "rus_t_gor_kriv",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [{ kind: "chapter", min: 3 }, date(undefined, "1915-12"), atDesk],
    },
    cast: { p: { person: "rus_goremykin" } },
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
            next: "line",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "ministers:-1"],
            effects: [
              ear("court", 1),
              ear("ministers", -1),
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
            ],
            next: "line",
          },
          {
            id: "push",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "jealous",
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: { role: "p" },
                  of: ["weary"],
                },
                next: "line",
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
      line: {
        says: [
          { id: "open", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "note",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_kriv" }],
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
      jealous: {
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
    id: "rus_t_gor_bloc",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        {
          kind: "any",
          of: [
            { kind: "seen", scene: "rus_h_bloc" },
            earAt("duma", { max: 0 }),
          ],
        },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_goremykin" } },
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
            id: "stubborn",
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
            next: "street",
            gain: [{ kind: "remember", key: "k_gor_prorogue" }],
            miss: "street_no",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["duma:+1", "trust:-1"],
            effects: [
              ear("duma", 1),
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              { kind: "remember", key: "k_gor_prorogue" },
            ],
            next: "soft",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "push",
            tell: ["court:+1"],
            effects: [
              ear("court", 1),
              { kind: "remember", key: "k_gor_prorogue" },
            ],
            next: "soft",
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
      street: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
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
      street_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_prorogue" }],
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
      soft: {
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
    },
  },
  {
    id: "rus_t_gor_coffin",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        {
          kind: "any",
          of: [
            { kind: "health", who: { role: "p" }, max: 1 },
            earAt("ministers", { max: -1 }),
          ],
        },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_goremykin" } },
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
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: 1 },
              {
                kind: "promise",
                who: { role: "p" },
                key: "p_gor_release",
                chapters: 8,
                keep: { kind: "chose", scene: "rus_r_sturmer" },
                back: "rus_t_gor_coffin",
              },
            ],
            next: "release",
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "after",
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "court:+1"],
            effects: [
              { kind: "person_trust", who: { role: "p" }, delta: -1 },
              ear("court", 1),
            ],
            next: "stay",
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
      release: {
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
      stay: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_gor_stay" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_t_gor_letter",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        date("1915-01", "1915-12"),
        { kind: "seen", scene: "rus_w_command" },
        atDesk,
      ],
    },
    cast: { p: { person: "rus_goremykin" } },
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
            id: "stubborn",
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
            next: "names",
            gain: [{ kind: "remember", key: "k_gor_letter" }],
            miss: "names_no",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:+1", "court:-1"],
            effects: [
              ear("ministers", 1),
              ear("court", -1),
              { kind: "remember", key: "k_gor_letter" },
            ],
            next: "keep",
          },
          {
            id: "threat",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "hurt",
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
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
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
      names_no: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_gor_letter" }],
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
      keep: {
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
      hurt: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_gor_letter" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_durnovo_memo",
    nation: ["RUS"],
    kind: "talk",
    when: { kind: "chapter", min: 1, max: 3 },
    cast: { p: { person: "rus_durnovo" } },
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
            next: "steps",
            gain: [{ kind: "remember", key: "k_durnovo_memo" }],
            miss: "steps_cold",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:-1", "court:+1"],
            effects: [
              ear("ministers", -1),
              ear("court", 1),
              { kind: "remember", key: "k_durnovo_memo" },
            ],
            next: "steps",
          },
          {
            id: "flat",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [{ kind: "person_trust", who: { role: "p" }, delta: -1 }],
            next: "friend",
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
      steps: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_durnovo" }],
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
      steps_cold: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_durnovo_memo" }],
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
      friend: {
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
    id: "rus_v_witte_warn",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 3, max: 6 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "world", of: { is: "war" } },
          ],
        },
      ],
    },
    cast: { p: { person: "rus_witte" } },
    salience: 7,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "arrogant",
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
            next: "price",
            gain: [{ kind: "remember", key: "k_witte_peace" }],
            miss: "insult",
          },
          {
            id: "flatter",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "price",
            gain: [
              { kind: "remember", key: "k_witte_peace" },
              { kind: "mood", delta: 1 },
            ],
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["ministers:-1", "stavka:-1"],
            effects: [
              ear("ministers", -1),
              ear("stavka", -1),
              { kind: "remember", key: "k_witte_peace" },
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
      insult: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_witte_peace" }],
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
    id: "rus_v_paleo_toast",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 2, max: 3 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "fra_paleologue" } },
    salience: 7,
    tags: ["people"],
    once: true,
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
            next: "hint",
            gain: [{ kind: "remember", key: "k_paleo_hint" }],
            miss: "lit",
          },
          {
            id: "warm",
            stance: "flatter",
            kind: "ask",
            tell: [],
            effects: [],
            next: "lit",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["fra:+1"],
            effects: [
              { kind: "trust", tag: "FRA", delta: 1 },
              { kind: "remember", key: "k_paleo_hint" },
            ],
            next: "hint",
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
      hint: {
        says: [
          {
            id: "good",
            when: { kind: "source_band", source: "embassy_paris", min: 2 },
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
      lit: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "note",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_paleo_hint" }],
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
    id: "rus_v_paleo_plea",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 5, max: 8 },
        { kind: "world", of: { is: "war" } },
        { kind: "at_war", tag: "DEU" },
      ],
    },
    cast: { p: { person: "fra_paleologue" } },
    salience: 7,
    tags: ["people"],
    once: true,
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
            next: "paris",
            gain: [{ kind: "remember", key: "k_paleo_plea" }],
            miss: "tears",
          },
          {
            id: "deal",
            stance: "warm",
            kind: "deal",
            tell: ["fra:+2", "ministers:-1"],
            effects: [
              { kind: "trust", tag: "FRA", delta: 2 },
              ear("ministers", -1),
              { kind: "remember", key: "k_paleo_plea" },
            ],
            next: "paris",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: ["fra:-1"],
            effects: [{ kind: "trust", tag: "FRA", delta: -1 }],
            next: "cold",
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
      paris: {
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
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tears: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ok",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [{ kind: "remember", key: "k_paleo_plea" }],
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
      cold: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [{ kind: "reason", key: "rc_paleo_cold" }],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_v_buchanan_july",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 8 },
        {
          kind: "any",
          of: [
            { kind: "crisis", topic: "balkan" },
            { kind: "at_war", tag: "OTT" },
          ],
        },
      ],
    },
    cast: { p: { person: "gbr_buchanan" } },
    salience: 7,
    tags: ["people"],
    once: true,
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
            next: "cabinet",
            gain: [{ kind: "remember", key: "k_buchanan_line" }],
            miss: "correct",
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["gbr:+1"],
            effects: [
              { kind: "trust", tag: "GBR", delta: 1 },
              { kind: "remember", key: "k_buchanan_line" },
            ],
            next: "cabinet",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["gbr:-1"],
            effects: [
              { kind: "trust", tag: "GBR", delta: -1 },
              { kind: "remember", key: "k_buchanan_line" },
            ],
            next: "correct",
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
      cabinet: {
        says: [
          {
            id: "in",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "world", of: { is: "lean", tag: "GBR", min: 1 } },
              ],
            },
          },
          { id: "out", when: { kind: "candid", who: { role: "p" } } },
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
      correct: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [{ kind: "remember", key: "k_buchanan_line" }],
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
    id: "rus_v_pourtales_tears",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "chapter", min: 4, max: 5 },
        { kind: "crisis", topic: "balkan" },
      ],
    },
    cast: { p: { person: "deu_pourtales" } },
    salience: 7,
    tags: ["people"],
    once: true,
    who: "p",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          { id: "low", when: { kind: "trust", tag: "DEU", max: -1 } },
          { id: "base" },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "berlin",
          },
          {
            id: "warm",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "willy",
            reacts: [
              {
                when: { kind: "trust", tag: "DEU", min: 1 },
                next: "willy",
                effects: [{ kind: "remember", key: "k_willy_trust" }],
              },
            ],
            gain: [{ kind: "remember", key: "k_willy_trust" }],
          },
          {
            id: "deal",
            stance: "flatter",
            kind: "deal",
            tell: ["deu:+1", "stavka:-1"],
            effects: [
              { kind: "trust", tag: "DEU", delta: 1 },
              ear("stavka", -1),
              { kind: "remember", key: "k_willy_trust" },
            ],
            next: "willy",
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
      berlin: {
        says: [
          {
            id: "moving",
            when: {
              kind: "all",
              of: [
                { kind: "candid", who: { role: "p" } },
                { kind: "world", of: { is: "mob", tag: "DEU", min: 1 } },
              ],
            },
          },
          { id: "still", when: { kind: "candid", who: { role: "p" } } },
          { id: "base" },
        ],
        replies: [
          {
            id: "again",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "willy",
            gain: [{ kind: "remember", key: "k_willy_trust" }],
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
      willy: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["deu:+1"],
            effects: [{ kind: "trust", tag: "DEU", delta: 1 }],
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
];
