// Great War 1914: GBR's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/GBR.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
//
// The seat is the Prime Minister, not the King: Britain's powers are the
// Crown's prerogative used on the cabinet's advice, and acts of Parliament.
// Checked on the web (lane WG, 2026-11-10): DORA's royal assent on 8 Aug 1914
// and its regulations by Order in Council; the Parliament Act 1911 leaves a
// bill lengthening a Parliament past five years outside its procedure, so the
// Lords could still throw one out; the Press Bureau of 6 Aug 1914 under
// F. E. Smith; general internment of enemy alien men announced 12-13 May
// 1915; martial law proclaimed in Dublin by Lord Wimborne on 25 Apr 1916; the
// contraband orders of 20 Aug and 29 Oct 1914 and the Order in Council of
// 11 Mar 1915 on all goods bound for Germany. From the design table (ww168
// B1.4, checked there): the Parliament and Registration Act of Jan 1916,
// Asquith at the War Office Mar-Aug 1914, the coalition of May 1915, Morley
// and Burns resigning in Aug 1914.
import type {
  GwCond,
  GwEffect,
  GwScene,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerOption, GwPowerRow, GwReactorRow } from "../../PowerRows";

// ---- small words ----

const flag = (f: string): GwCond => ({ kind: "flag", flag: f });
const not = (of: GwCond): GwCond => ({ kind: "not", of });
const all = (...of: GwCond[]): GwCond => ({ kind: "all", of });
const any = (...of: GwCond[]): GwCond => ({ kind: "any", of });
const setFlag = (f: string): GwEffect => ({ kind: "flag", flag: f });
const reason = (key: string, who?: GwWho): GwEffect =>
  who === undefined ? { kind: "reason", key } : { kind: "reason", key, who };
const inst = (
  i: "cabinet" | "commons" | "opposition" | "irish",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const trustIn = (person: string, delta: number): GwEffect => ({
  kind: "person_trust",
  who: { person },
  delta,
});
const nation = (tag: "USA" | "FRA", delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const heat = (id: string, delta: number): GwEffect =>
  doWorld({ do: "faction", id, delta });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const leans = (camp: "civil" | "military"): GwCond => ({
  kind: "leans",
  who: { role: "target" },
  camp,
});
const lawAt = (id: string): GwCond =>
  world({ is: "law", id, of: ["persuade", "vote"] });
const offer = (tag: "ITA" | "ROU" | "GRC" | "BGR"): GwEffect[] => [
  doWorld({ do: "offer", tag, value: 3 }),
  doWorld({ do: "readiness", tag, delta: 5 }),
];

const war = world({ is: "war" });
const inWar = world({ is: "side", of: ["entente", "central"] });
const neutralSeat = world({ is: "side", of: ["neutral"] });
const rising = flag("f_gbr_rising");
const forced: GwCond = { kind: "memory", key: "m_gbr_pw_hr_force", within: 0 };

/** A cabinet office the Prime Minister fills, as a field option. */
const office = (
  id:
    | "foreign"
    | "finance"
    | "navy"
    | "interior"
    | "war"
    | "ireland"
    | "munitions",
  fit: GwCond,
  when?: GwCond,
): GwPowerOption => ({
  id,
  ...(when === undefined ? {} : { when }),
  effects: [
    maybe(fit, { kind: "appoint", who: { role: "target" }, office: id }),
    maybe(not(fit), reason("gbr_pw_not_minister", { role: "target" })),
  ],
});

/** The Commons on a government bill of the Liberal years. */
const LIBERAL_BILL = {
  gbr_liberals: 1,
  gbr_rebels: 1,
  gbr_lg: 1,
  gbr_unionists: -1,
  gbr_uwc: -1,
  gbr_labour: 1,
  gbr_ilp: 1,
  gbr_irish: 1,
  gbr_sinn_fein: -1,
} as const;

export const GBR_POWERS: readonly GwPowerRow[] = [
  // 전쟁과 평화 -------------------------------------------------------------
  {
    // War by the Crown's prerogative, on the cabinet's advice (convention).
    id: "gbr_pw_war",
    tag: "GBR",
    group: "war",
    kind: "lawful",
    opens: [
      { when: neutralSeat, why: "in_war" },
      { when: world({ is: "entered", tag: "DEU" }), why: "no_war" },
    ],
    once: true,
    needs: { council: "entry" },
    authority: 10,
    fields: [
      {
        id: "grounds",
        options: [
          {
            id: "belgium",
            when: world({ is: "plan", of: ["west"] }),
            tags: ["war_defensive"],
            effects: [reason("gbr_pw_war_belgium")],
          },
          {
            id: "france",
            tags: ["war_offensive"],
            effects: [reason("gbr_pw_war_france")],
          },
        ],
      },
    ],
    tags: [],
    effects: [
      doWorld({ do: "declare", tag: "DEU" }),
      nation("FRA", 2),
      { kind: "drop_card", scene: "gbr_c_ultimatum" },
      { kind: "drop_card", scene: "gw_gbr_entry" },
      { kind: "drop_card", scene: "gbr_f_neutral_line" },
    ],
    // The cabinet's peace men (Morley and Burns went in August 1914).
    risk: {
      pct: 25,
      mods: [
        { when: { kind: "inst", inst: "cabinet", max: -1 }, add: 25 },
        { when: not(world({ is: "plan", of: ["west"] })), add: 20 },
      ],
      then: [
        heat("gbr_rebels", 1),
        trustIn("gbr_morley", -2),
        trustIn("gbr_simon", -1),
        maybe(
          { kind: "person_trust", who: { office: "finance" }, max: -1 },
          doWorld({ do: "letter", who: { office: "finance" } }),
        ),
        reason("gbr_pw_peace_men"),
      ],
    },
    scene: "gbr_pw_war_r",
  },
  {
    // A peace feeler is the Foreign Office's, on the cabinet's word.
    id: "gbr_pw_talks",
    tag: "GBR",
    group: "war",
    kind: "lawful",
    opens: [{ when: all(war, inWar), why: "no_war" }],
    needs: { office: "foreign", council: "peace_talks" },
    against: ["hard"],
    authority: 5,
    cooldown: 4,
    tags: ["peace_white"],
    effects: [doWorld({ do: "talks" })],
    scene: "gbr_pw_talks_r",
  },
  {
    // Blockade by Order in Council, the Admiralty carrying it out.
    id: "gbr_pw_blockade",
    tag: "GBR",
    group: "war",
    kind: "lawful",
    opens: [{ when: { kind: "at_war", tag: "DEU" }, why: "no_war" }],
    needs: { office: "navy" },
    authority: 5,
    cooldown: 4,
    fields: [
      {
        id: "reach",
        options: [
          {
            id: "contraband",
            effects: [
              doWorld({ do: "blockade", delta: 1 }),
              reason("gbr_pw_contraband"),
            ],
          },
          {
            id: "all_goods",
            tags: ["harsh_war"],
            effects: [
              doWorld({ do: "blockade", delta: 2 }),
              nation("USA", -1),
              doWorld({ do: "readiness", tag: "USA", delta: -5 }),
              reason("gbr_pw_all_goods"),
            ],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "gbr_pw_blockade_r",
  },
  // 동맹과 조약 -------------------------------------------------------------
  {
    // A treaty by prerogative: terms for a neutral (London, April 1915).
    id: "gbr_pw_terms",
    tag: "GBR",
    group: "treaty",
    kind: "lawful",
    opens: [{ when: inWar, why: "neutral" }],
    needs: { office: "foreign" },
    authority: 5,
    cooldown: 3,
    target: {
      kind: "country",
      of: [
        { id: "ITA", effects: offer("ITA") },
        {
          id: "ROU",
          when: world({ is: "neutral", tag: "ROU" }),
          effects: offer("ROU"),
        },
        {
          id: "GRC",
          when: world({ is: "neutral", tag: "GRC" }),
          effects: offer("GRC"),
        },
        {
          id: "BGR",
          when: world({ is: "neutral", tag: "BGR" }),
          effects: offer("BGR"),
        },
      ],
    },
    tags: ["treaty"],
    effects: [],
    scene: "gbr_pw_terms_r",
  },
  // 군 ----------------------------------------------------------------------
  {
    // Asquith held the War Office himself from March to August 1914.
    id: "gbr_pw_war_office",
    tag: "GBR",
    group: "army",
    kind: "lawful",
    opens: [{ when: { kind: "office_empty", office: "war" }, why: "filled" }],
    authority: 5,
    tags: ["cabinet_change"],
    effects: [
      { kind: "appoint", who: { person: "gbr_asquith" }, office: "war" },
    ],
    scene: "gbr_pw_war_office_r",
  },
  // 의회 --------------------------------------------------------------------
  {
    // The Prime Minister advises a dissolution; the King grants it.
    id: "gbr_pw_dissolve",
    tag: "GBR",
    group: "house",
    kind: "lawful",
    opens: [
      { when: world({ is: "date", from: "1915-01" }), why: "early" },
      {
        when: all(
          not(flag("f_gov_writ")),
          not(flag("f_gbr_war_election")),
          not(flag("f_gov_new_parliament")),
        ),
        why: "called",
      },
      { when: not(flag("f_gbr_parliament_extended")), why: "extended" },
    ],
    needs: { office: "court" },
    authority: 10,
    once: true,
    tags: ["dissolve"],
    effects: [
      setFlag("f_gov_writ"),
      doWorld({ do: "gov_heat", id: "gbr_election", delta: 1 }),
    ],
    scene: "gbr_pw_dissolve_r",
  },
  {
    // A bill to lengthen this Parliament (Jan 1916). The Parliament Act
    // leaves such a bill outside its procedure, so the Lords can still throw
    // it out: the peers' consent stands for that veto (the Lords' count only
    // delays a bill, House.ts).
    id: "gbr_pw_extend",
    tag: "GBR",
    group: "house",
    kind: "lawful",
    opens: [
      { when: war, why: "peace" },
      { when: world({ is: "date", from: "1915-07" }), why: "early" },
      { when: not(flag("f_gbr_parliament_extended")), why: "extended" },
      {
        when: all(not(flag("f_gov_writ")), not(flag("f_gbr_war_election"))),
        why: "called",
      },
    ],
    needs: {
      consent: "gbr_peers",
      house: {
        houses: ["commons"],
        stance: {
          gbr_liberals: 1,
          gbr_rebels: 0,
          gbr_lg: 1,
          gbr_unionists: 1,
          gbr_uwc: 1,
          gbr_labour: 1,
          gbr_ilp: -1,
          gbr_irish: 0,
          gbr_sinn_fein: -1,
        },
      },
    },
    authority: 5,
    once: true,
    tags: [],
    effects: [
      setFlag("f_gbr_parliament_extended"),
      doWorld({ do: "gov_beaten", id: "gbr_election" }),
    ],
    failed: [inst("commons", -1)],
    scene: "gbr_pw_extend_r",
  },
  {
    // Ask the King to promise enough peers to carry a bill (1910-11).
    id: "gbr_pw_peers",
    tag: "GBR",
    group: "house",
    kind: "custom",
    opens: [
      {
        when: any(lawAt("gbr_home_rule"), lawAt("gbr_franchise")),
        why: "no_bill",
      },
    ],
    needs: { office: "court" },
    authority: 15,
    cooldown: 8,
    tags: [],
    effects: [
      maybe(
        lawAt("gbr_home_rule"),
        doWorld({ do: "law_support", law: "gbr_home_rule", delta: 2 }),
      ),
      maybe(
        lawAt("gbr_franchise"),
        doWorld({ do: "law_support", law: "gbr_franchise", delta: 2 }),
      ),
      heat("gbr_peers", 2),
      heat("gbr_unionists", 1),
      opinion("court", -1),
      reason("gbr_pw_peers_word"),
    ],
    scene: "gbr_pw_peers_r",
  },
  // 내각 --------------------------------------------------------------------
  {
    // The King appoints on the Prime Minister's advice: a form, no signature.
    id: "gbr_pw_appoint",
    tag: "GBR",
    group: "cabinet",
    kind: "lawful",
    target: { kind: "person", people: "own" },
    authority: 5,
    cooldown: 1,
    fields: [
      {
        id: "office",
        options: [
          office("foreign", leans("civil")),
          office("finance", leans("civil")),
          office("navy", leans("civil")),
          office("interior", leans("civil")),
          office("war", any(leans("civil"), leans("military"))),
          office("ireland", leans("civil")),
          office("munitions", leans("civil"), flag("f_gbr_munitions_ministry")),
        ],
      },
    ],
    tags: ["cabinet_change"],
    effects: [],
    scene: "gbr_pw_appoint_r",
  },
  {
    id: "gbr_pw_dismiss",
    tag: "GBR",
    group: "cabinet",
    kind: "lawful",
    target: {
      kind: "person",
      people: "cabinet",
      offices: [
        "foreign",
        "finance",
        "navy",
        "interior",
        "war",
        "ireland",
        "munitions",
        "chief_of_staff",
        "sea_lord",
        "ambassador_paris",
        "ambassador_petersburg",
        "ambassador_washington",
      ],
    },
    cooldown: 1,
    tags: ["cabinet_change"],
    effects: [{ kind: "dismiss", who: { role: "target" } }],
    scene: "gbr_pw_dismiss_r",
  },
  {
    // The coalition of May 1915: the party leaders agree, the terms are his.
    id: "gbr_pw_coalition",
    tag: "GBR",
    group: "cabinet",
    kind: "lawful",
    shows: world({ is: "regime", of: ["liberal"] }),
    opens: [{ when: war, why: "peace" }],
    needs: { consent: "gbr_unionists" },
    authority: 10,
    once: true,
    fields: [
      {
        id: "terms",
        options: [
          {
            id: "admiralty",
            effects: [
              {
                kind: "appoint",
                who: { person: "gbr_balfour" },
                office: "navy",
              },
              trustIn("gbr_churchill", -2),
              inst("opposition", 1),
            ],
          },
          {
            id: "haldane",
            effects: [
              trustIn("gbr_haldane", -2),
              inst("opposition", 1),
              reason("gbr_pw_haldane_out"),
            ],
          },
          {
            id: "keep_posts",
            effects: [inst("opposition", -1), inst("cabinet", 1)],
          },
        ],
      },
      {
        id: "labour",
        options: [
          {
            id: "in",
            effects: [
              setFlag("f_gbr_labour_in"),
              trustIn("gbr_henderson", 1),
              opinion("workers", 1),
            ],
          },
          { id: "out", effects: [trustIn("gbr_henderson", -1)] },
        ],
      },
    ],
    tags: ["coalition", "cabinet_change"],
    effects: [
      doWorld({ do: "regime", to: "coalition" }),
      setFlag("f_coalition"),
      inst("cabinet", -1),
      inst("commons", 1),
    ],
    scene: "gbr_pw_coalition_r",
  },
  // 국내 --------------------------------------------------------------------
  {
    // Home Rule: on the statute book and suspended (Sep 1914), amended for
    // Ulster, or carried with the army behind it (the Curragh, Mar 1914).
    id: "gbr_pw_home_rule",
    tag: "GBR",
    group: "home",
    kind: "lawful",
    opens: [
      {
        when: all(not(flag("f_home_rule_lives")), not(flag("f_act_suspended"))),
        why: "settled",
      },
    ],
    needs: {
      office: "ireland",
      house: { houses: ["commons"], stance: LIBERAL_BILL },
    },
    authority: 10,
    once: true,
    target: {
      kind: "option",
      of: [
        {
          id: "suspend",
          when: war,
          effects: [
            setFlag("f_act_suspended"),
            inst("irish", 1),
            inst("opposition", 1),
            reason("gbr_pw_hr_suspend"),
          ],
        },
        {
          id: "ulster_out",
          effects: [
            setFlag("f_amend_county"),
            inst("irish", -1),
            inst("opposition", 1),
            trustIn("gbr_carson", 1),
            trustIn("gbr_redmond", -1),
            reason("gbr_pw_hr_ulster"),
          ],
        },
        {
          id: "force",
          tags: ["harsh_home"],
          effects: [
            inst("irish", 2),
            inst("opposition", -2),
            opinion("army", -1),
            { kind: "pressure", topic: "ireland", delta: 1 },
            trustIn("gbr_redmond", 1),
            trustIn("gbr_carson", -2),
            { kind: "remember", key: "m_gbr_pw_hr_force" },
            reason("gbr_pw_hr_force"),
          ],
        },
      ],
    },
    tags: [],
    effects: [],
    // Officers who would rather resign than march on Ulster.
    risk: {
      pct: 0,
      mods: [
        { when: forced, add: 45 },
        {
          when: all(forced, { kind: "bloc", bloc: "army", max: -1 }),
          add: 20,
        },
      ],
      then: [
        heat("gbr_generals", 2),
        { kind: "pride", who: { office: "chief_of_staff" }, delta: -1 },
        doWorld({ do: "gov_heat", id: "gbr_table", delta: 1 }),
        reason("gbr_pw_curragh"),
      ],
    },
    scene: "gbr_pw_home_rule_r",
  },
  {
    // Martial law through the Lord Lieutenant and the army (Dublin, Apr 1916).
    id: "gbr_pw_martial_ireland",
    tag: "GBR",
    group: "home",
    kind: "lawful",
    opens: [
      {
        when: any(rising, { kind: "pressure", topic: "ireland", min: 4 }),
        why: "quiet",
      },
    ],
    authority: 10,
    once: true,
    fields: [
      {
        id: "leaders",
        options: [
          {
            id: "courts_martial",
            when: rising,
            tags: ["harsh_home"],
            effects: [
              doWorld({ do: "faction_grow", id: "gbr_sinn_fein", delta: 1 }),
              inst("irish", -2),
              nation("USA", -1),
              reason("gbr_pw_shot"),
            ],
          },
          {
            id: "few",
            when: rising,
            effects: [inst("irish", -1), reason("gbr_pw_few_shot")],
          },
          {
            id: "civil_courts",
            effects: [
              inst("irish", 1),
              inst("opposition", -1),
              setFlag("f_gbr_courts_stopped"),
              reason("gbr_pw_civil_courts"),
            ],
          },
        ],
      },
    ],
    tags: ["arrests"],
    effects: [
      { kind: "gauge", gauge: "order", delta: 1 },
      { kind: "pressure", topic: "ireland", delta: -1 },
      inst("irish", -1),
    ],
    scene: "gbr_pw_martial_ireland_r",
  },
  {
    // The Aliens Restriction Act (Aug 1914); general internment (May 1915).
    id: "gbr_pw_aliens",
    tag: "GBR",
    group: "home",
    kind: "lawful",
    opens: [{ when: war, why: "peace" }],
    authority: 5,
    cooldown: 6,
    fields: [
      {
        id: "how",
        options: [
          {
            id: "register",
            effects: [
              { kind: "rumour", delta: -1 },
              reason("gbr_pw_registered"),
            ],
          },
          {
            id: "intern",
            tags: ["arrests"],
            effects: [
              { kind: "gauge", gauge: "order", delta: 1 },
              opinion("press", 1),
              reason("gbr_pw_interned"),
            ],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "gbr_pw_aliens_r",
  },
  {
    // The Press Bureau, set up on 6 Aug 1914.
    id: "gbr_pw_press_bureau",
    tag: "GBR",
    group: "home",
    kind: "lawful",
    opens: [
      { when: war, why: "peace" },
      { when: { kind: "censor", max: 1 }, why: "strict" },
    ],
    authority: 5,
    cooldown: 6,
    tags: ["press_gag"],
    effects: [
      { kind: "censor", delta: 1 },
      { kind: "rumour", delta: -1 },
    ],
    scene: "gbr_pw_press_bureau_r",
  },
];

/** GBR's own reactors, on top of GW_REACTORS (`nation: "GBR"`). */
export const GBR_REACTORS: readonly GwReactorRow[] = [
  // The Liberal peace men answer any war Britain enters, whatever the grounds.
  {
    tag: "war_defensive",
    nation: "GBR",
    actor: "other",
    delta: -1,
    key: "gbr_react_peace_men",
    does: [heat("gbr_rebels", 1), heat("gbr_ilp", 1)],
  },
  {
    tag: "war_offensive",
    nation: "GBR",
    actor: "other",
    delta: -1,
    key: "gbr_react_peace_men",
    does: [heat("gbr_rebels", 2), heat("gbr_ilp", 1)],
  },
  // A coalition heats the Liberal back benches and cools the Unionists.
  {
    tag: "coalition",
    nation: "GBR",
    actor: "other",
    delta: -1,
    key: "gbr_react_coalition",
    does: [heat("gbr_liberals", 1), heat("gbr_unionists", -1)],
  },
  // A war election splits the Liberals.
  {
    tag: "dissolve",
    nation: "GBR",
    actor: "other",
    by: war,
    delta: -1,
    key: "gbr_react_war_election",
    does: [heat("gbr_liberals", 1), heat("gbr_labour", 1)],
  },
  // Liberal ministers mind arrests without trial.
  {
    tag: "arrests",
    nation: "GBR",
    actor: "cabinet",
    of: ["liberal"],
    delta: -1,
  },
];

// ---- result cards ----

const card = (
  id: string,
  tags: GwScene["tags"],
  variants: GwScene["variants"] = [{ id: "base" }],
  cast: GwScene["cast"] = {},
): GwScene => ({
  id,
  nation: ["GBR"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast,
  salience: 0,
  tags,
  variants,
});
const called: GwScene["cast"] = { target: { called: true } };

/** Result cards and other scenes the rows call. */
export const GBR_POWER_SCENES: readonly GwScene[] = [
  card("gbr_pw_war_r", ["war", "foreign"]),
  card("gbr_pw_talks_r", ["foreign", "tension_down"]),
  card("gbr_pw_blockade_r", ["war"]),
  card("gbr_pw_terms_r", ["foreign"]),
  card("gbr_pw_war_office_r", ["war"]),
  card(
    "gbr_pw_dissolve_r",
    ["home"],
    [{ id: "war", when: war }, { id: "base" }],
  ),
  card("gbr_pw_extend_r", ["home"]),
  card("gbr_pw_peers_r", ["home"]),
  card("gbr_pw_appoint_r", ["people"], [{ id: "base" }], called),
  card("gbr_pw_dismiss_r", ["people"], [{ id: "base" }], called),
  card(
    "gbr_pw_coalition_r",
    ["home"],
    [{ id: "labour", when: flag("f_gbr_labour_in") }, { id: "base" }],
  ),
  card(
    "gbr_pw_home_rule_r",
    ["home"],
    [{ id: "suspended", when: flag("f_act_suspended") }, { id: "base" }],
  ),
  card(
    "gbr_pw_martial_ireland_r",
    ["home"],
    [{ id: "rising", when: rising }, { id: "base" }],
  ),
  card("gbr_pw_aliens_r", ["home"]),
  card("gbr_pw_press_bureau_r", ["home"]),
];
