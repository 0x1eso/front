// Great War 1914: DEU's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/DEU.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
//
// Wilhelm II's lawful powers as German Emperor and King of Prussia (design
// ww168 B1.1), under the Reich constitution of 1871: Art. 11 (war with the
// Bundesrat's consent unless attacked, peace, treaties, envoys), Art. 12 and
// 26 (convene, adjourn: 30 days, once a session), Art. 15 (the Chancellor),
// Art. 17 (the Chancellor's countersignature), Art. 24 (dissolution by a
// Bundesrat resolution; the Reichstag of January 1912, its term stretched by
// the laws of 16 Oct 1916, 23 Jul 1917, 18 Jul 1918), Art. 63 (command),
// Art. 68 (the state of war under the Prussian siege law of 4 Jun 1851; the
// protective custody law of 4 Dec 1916). Prussia's three-class franchise is
// the King's to propose (the Easter message, 7 Apr 1917; the July message,
// 11 Jul 1917).
//
// Phase 2 (ww169 XD): what he could order beyond the law, and the harsh
// measures. Standalone: governing without a budget (the Prussian conflict of
// 1862-66, closed by the indemnity law of 14 Sep 1866) and a Reichstag
// franchise by decree (Art. 20 sets universal, direct, secret elections; Art.
// 78 lets 14 Bundesrat votes block any change). "서명 없이" forms of
// mobilisation, war, dissolution and the OHL's rule: past the Chancellor's
// countersignature (Art. 17), and the form runs no procedure, so past the
// Bundesrat too. Harsh measures: reprisals on villages (Dinant, 23 Aug 1914;
// Louvain, from 25 Aug 1914), the occupied land's courts-martial (Cavell,
// shot 12 Oct 1915; in Jan 1916 the Kaiser reserved women's death sentences
// to himself), the fleet's courts-martial (Reichpietsch and Köbis, shot 5 Sep
// 1917), strikers drafted and plants put under the army (Berlin, 31 Jan
// 1918), British civilian men interned at Ruhleben (decree of 6 Nov 1914).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { any, flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";

// ---- Words used only here ----
const act = (of: GwWorldEffect): GwEffect => ({ kind: "world", of });
const empire: GwCond = world({ is: "regime", of: ["empire"] });
const war: GwCond = world({ is: "war" });
const crisis: GwCond = world({ is: "chain" });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const neutral = (tag: GwTag): GwCond => world({ is: "neutral", tag });
const recent = (key: string): GwCond => ({ kind: "memory", key, within: 0 });
const remember = (key: string): GwEffect => ({ kind: "remember", key });
const setFlag = (f: string): GwEffect => ({ kind: "flag", flag: f });
const inst = (
  i: "army" | "reichstag" | "countersign",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const america = (delta: number): GwEffect =>
  act({ do: "readiness", tag: "USA", delta });
const heat = (id: string, delta = 1): GwEffect =>
  act({ do: "faction", id, delta });
const grow = (id: string, delta: number): GwEffect =>
  act({ do: "faction_grow", id, delta });
const officeTrust = (
  office: "chancellor" | "chief_of_staff" | "navy",
  delta: number,
): GwEffect => ({ kind: "person_trust", who: { office }, delta });
const conscience = (key: string): GwEffect => ({
  kind: "ruler",
  side: "conscience",
  delta: -1,
  key,
});
const reason = (key: string): GwEffect => ({ kind: "reason", key });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const roll = (key: string, pct: number, ...then: GwEffect[]): GwEffect => ({
  kind: "roll",
  key,
  pct,
  then,
});
const SIEGE = "f_deu_siege";
/** The bills an adjournment puts off a chapter, if one is before the house. */
const DEU_BILLS = [
  "deu_censor",
  "deu_bread_cards",
  "deu_food_office",
  "deu_strike_ban",
  "deu_aux",
  "deu_unions",
  "deu_jesuits",
  "deu_three_class",
  "deu_alsace",
  "deu_peace_res",
  "deu_take_back",
  "deu_parl_gov",
  "deu_war_aims",
];
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const lowGauge = (g: "bread" | "order", max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const instAtMost = (i: "reichstag" | "countersign", max: number): GwCond => ({
  kind: "inst",
  inst: i,
  max,
});
const chancellorCold: GwCond = {
  kind: "person_trust",
  who: { office: "chancellor" },
  max: -1,
};
const streets: GwCond = world({ is: "unrest", min: 2 });
const longWar: GwCond = world({ is: "war_age", min: 24 });
/** The Chancellor writes that he cannot stay (he may still be kept). */
const chancellorLetter: GwEffect = act({
  do: "letter",
  who: { office: "chancellor" },
});
/** The election after a dissolution, by the state the country is in. */
const ELECTION: readonly GwEffect[] = [
  maybe(
    world({ is: "score", min: 20 }),
    grow("deu_cons", 1),
    grow("deu_natlib", 1),
    grow("deu_spd", -1),
  ),
  maybe(
    world({ is: "score", max: -10 }),
    grow("deu_spd", 1),
    grow("deu_progress", 1),
    grow("deu_cons", -1),
  ),
  maybe({ kind: "bloc", bloc: "workers", max: -2 }, grow("deu_uspd", 1)),
  maybe(not(war), grow("deu_spd", 1)),
];
const putOff = (law: string): GwEffect =>
  maybe(
    world({ is: "law", id: law, of: ["persuade", "vote"] }),
    act({ do: "law_hold", law }),
  );

/** A country war can be declared on: only while it stands outside. Option
 * ids are lower case (pack keys and picks), the tag in lower case. */
const at = (tag: GwTag, effects: GwEffect[]) => ({
  id: tag.toLowerCase(),
  when: neutral(tag),
  effects,
});

export const DEU_POWERS: readonly GwPowerRow[] = [
  // ---- 전쟁과 평화 ----
  {
    id: "deu_pw_mobilise",
    tag: "DEU",
    group: "war",
    kind: "lawful",
    shows: empire,
    opens: [{ when: not(war), why: "at_war" }],
    needs: { office: "chancellor" },
    beyond: "deu_pw_mobilise_b",
    authority: 10,
    target: {
      kind: "option",
      of: [
        {
          id: "danger",
          when: world({ is: "mob", tag: "DEU", max: 0 }),
          effects: [act({ do: "mobilize", tag: "DEU", level: 1 })],
          tags: ["mobilise"],
        },
        {
          id: "general",
          effects: [
            act({ do: "mobilize", tag: "DEU", level: 2 }),
            { kind: "temp", delta: 2 },
            inst("army", 1),
            // The neighbours' general staffs read the same posters.
            act({ do: "mobilize", tag: "FRA", level: 1 }),
            act({ do: "mobilize", tag: "RUS", level: 1 }),
          ],
          tags: ["mobilise"],
        },
        {
          id: "stand_down",
          when: world({ is: "mob", tag: "DEU", min: 1 }),
          effects: [
            act({ do: "stand_down", tag: "DEU", level: 0 }),
            { kind: "temp", delta: -1 },
            inst("army", -1),
          ],
          tags: ["stand_down"],
        },
      ],
    },
    tags: [],
    effects: [{ kind: "temp", delta: 1 }],
    scene: "deu_pw_mobilise_r",
  },
  {
    id: "deu_pw_ultimatum",
    tag: "DEU",
    group: "war",
    kind: "lawful",
    shows: empire,
    opens: [{ when: any(crisis, war), why: "no_cause" }],
    needs: { office: "chancellor" },
    authority: 5,
    cooldown: 3,
    fields: [
      {
        id: "to",
        options: [
          {
            id: "rus",
            when: neutral("RUS"),
            effects: [trust("RUS", -2), { kind: "temp", delta: 2 }],
          },
          {
            id: "fra",
            when: neutral("FRA"),
            effects: [trust("FRA", -2), { kind: "temp", delta: 1 }],
          },
          {
            id: "bel",
            when: neutral("BEL"),
            effects: [
              trust("BEL", -2),
              trust("GBR", -1),
              act({ do: "readiness", tag: "BEL", delta: 10 }),
            ],
          },
        ],
      },
    ],
    tags: ["ultimatum"],
    effects: [],
    scene: "deu_pw_ultimatum_r",
  },
  {
    id: "deu_pw_declare",
    tag: "DEU",
    group: "war",
    kind: "lawful",
    shows: empire,
    opens: [{ when: any(crisis, war), why: "no_cause" }],
    // Art. 11: the Bundesrat, where Prussia's bloc nearly always carries it.
    // The attacked case needs no consent; one row can't tell the two apart.
    needs: {
      office: "chancellor",
      house: { houses: ["bundesrat"], stance: { deu_south: 1 }, lean: 1 },
    },
    beyond: "deu_pw_declare_b",
    authority: 15,
    fields: [
      {
        // A field, not a target: every country here can close.
        id: "on",
        options: (
          [
            "RUS",
            "FRA",
            "BEL",
            "GBR",
            "SRB",
            "ITA",
            "ROU",
            "PRT",
            "USA",
          ] as const
        ).map((t) => at(t, [act({ do: "declare", tag: t })])),
      },
    ],
    tags: ["war_offensive"],
    effects: [],
    scene: "deu_pw_declare_r",
  },
  {
    id: "deu_pw_peace",
    tag: "DEU",
    group: "war",
    kind: "lawful",
    shows: empire,
    opens: [{ when: war, why: "peace" }],
    needs: { office: "chancellor" },
    against: ["hard"],
    authority: 10,
    cooldown: 4,
    fields: [
      {
        id: "how",
        options: [
          {
            id: "note",
            effects: [remember("k_deu_pw_peace_note"), america(-3)],
            tags: ["peace_white"],
          },
          { id: "quiet" },
        ],
      },
    ],
    tags: [],
    effects: [act({ do: "talks" })],
    scene: "deu_pw_peace_r",
  },

  // ---- 군 ----
  {
    id: "deu_pw_command",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: war, why: "peace" }],
    authority: 10,
    cooldown: 4,
    fields: [
      {
        id: "way",
        options: [
          {
            id: "take",
            when: not(world({ is: "command" })),
            effects: [act({ do: "personal_command", on: true })],
            tags: ["command_self"],
          },
          {
            id: "give",
            when: world({ is: "command" }),
            effects: [
              act({ do: "personal_command", on: false }),
              officeTrust("chief_of_staff", 1),
            ],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_command_r",
  },
  {
    id: "deu_pw_uboat",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: atWar("GBR"), why: "not_at_war_gbr" }],
    authority: 10,
    cooldown: 3,
    fields: [
      {
        id: "level",
        options: [
          {
            id: "prize",
            when: world({ is: "uboat", min: 1 }),
            effects: [
              act({ do: "uboat", level: 0 }),
              america(-10),
              officeTrust("navy", -1),
            ],
          },
          {
            id: "zone",
            when: any(
              world({ is: "uboat", max: 0 }),
              world({ is: "uboat", min: 2 }),
            ),
            effects: [act({ do: "uboat", level: 1 }), america(8)],
            tags: ["harsh_war"],
          },
          {
            id: "open",
            when: world({ is: "uboat", max: 1 }),
            effects: [
              act({ do: "uboat", level: 2 }),
              america(25),
              officeTrust("navy", 1),
              officeTrust("chancellor", -1),
            ],
            tags: ["harsh_war"],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_uboat_r",
  },
  {
    id: "deu_pw_means",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: war, why: "peace" }],
    authority: 10,
    cooldown: 3,
    fields: [
      {
        id: "what",
        options: [
          {
            id: "gas",
            when: not(flag("f_deu_gas")),
            effects: [
              setFlag("f_deu_gas"),
              remember("k_deu_pw_gas"),
              act({ do: "force", tag: "DEU", theatre: "west", delta: 1 }),
              conscience("deu_pw_conscience_gas"),
              // They answer in kind, sooner or later.
              roll(
                "deu_pw_gas_answer",
                60,
                act({ do: "force", tag: "FRA", theatre: "west", delta: 1 }),
                act({ do: "force", tag: "GBR", theatre: "west", delta: 1 }),
                reason("deu_pw_gas_answered"),
              ),
            ],
            tags: ["harsh_war"],
          },
          {
            id: "airships",
            when: atWar("GBR"),
            effects: [
              setFlag("f_deu_air_raids"),
              { kind: "opinion", bloc: "press", delta: 1 },
              america(3),
              roll(
                "deu_pw_air_home",
                50,
                act({ do: "force", tag: "GBR", theatre: "west", delta: -1 }),
                reason("deu_pw_air_kept_home"),
              ),
            ],
            tags: ["harsh_war"],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_means_r",
  },
  {
    id: "deu_pw_occupied",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: atWar("BEL"), why: "no_occupied" }],
    authority: 5,
    cooldown: 4,
    fields: [
      {
        id: "what",
        options: [
          {
            id: "deport",
            effects: [
              remember("k_deu_pw_deport"),
              act({ do: "manpower", delta: 4 }),
              america(5),
              trust("ITA", -1),
              conscience("deu_pw_conscience_deport"),
            ],
            tags: ["harsh_war"],
          },
          {
            id: "hostages",
            // The towns answer for the railways: fewer men guard them.
            effects: [
              remember("k_deu_pw_hostages"),
              inst("army", 1),
              act({ do: "manpower", delta: 1 }),
              america(3),
              conscience("deu_pw_conscience_hostages"),
            ],
            tags: ["harsh_war"],
          },
          {
            id: "relief",
            effects: [america(-3), inst("army", -1)],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_occupied_r",
  },
  {
    id: "deu_pw_ohl",
    tag: "DEU",
    group: "army",
    kind: "custom",
    shows: empire,
    opens: [{ when: war, why: "peace" }],
    needs: { office: "chancellor" },
    against: ["civil", "moderate"],
    beyond: "deu_pw_ohl_b",
    once: true,
    tags: ["army_over_civil"],
    // From now the Chief of Staff signs for war and the army (GW_SIGN_FOR).
    effects: [
      setFlag("f_deu_ohl_rule"),
      inst("army", 2),
      inst("countersign", -1),
      officeTrust("chief_of_staff", 1),
      // The man who signed it has signed his office away.
      officeTrust("chancellor", -1),
      reason("deu_pw_ohl_signs"),
    ],
    // The majority reads the same signatures.
    risk: {
      pct: 30,
      mods: [{ when: world({ is: "war_age", min: 24 }), add: 20 }],
      then: [reason("deu_pw_ohl_noticed")],
      heats: [{ id: "deu_parliament", by: 1 }],
      scene: "deu_pw_ohl_bad",
    },
    scene: "deu_pw_ohl_r",
  },

  // ---- 의회 ----
  {
    id: "deu_pw_adjourn",
    tag: "DEU",
    group: "house",
    kind: "lawful",
    shows: empire,
    needs: { office: "chancellor" },
    authority: 10,
    // Art. 26: once a session without its consent.
    cooldown: 6,
    tags: ["house_closed"],
    effects: [inst("reichstag", -1), ...DEU_BILLS.map(putOff)],
    scene: "deu_pw_adjourn_r",
  },
  {
    id: "deu_pw_dissolve",
    tag: "DEU",
    group: "house",
    kind: "lawful",
    shows: empire,
    needs: {
      office: "chancellor",
      house: { houses: ["bundesrat"], stance: { deu_south: 0 }, lean: 1 },
    },
    against: ["moderate"],
    beyond: "deu_pw_dissolve_b",
    authority: 20,
    cooldown: 12,
    tags: ["dissolve"],
    effects: [...ELECTION],
    scene: "deu_pw_dissolve_r",
  },
  {
    id: "deu_pw_franchise",
    tag: "DEU",
    group: "house",
    kind: "lawful",
    shows: empire,
    opens: [
      {
        when: not(world({ is: "law", id: "deu_three_class", of: ["force"] })),
        why: "done",
      },
    ],
    needs: { office: "chancellor" },
    against: ["hard"],
    authority: 10,
    cooldown: 6,
    fields: [
      {
        id: "how",
        options: [
          {
            id: "promise",
            effects: [
              setFlag("f_franchise_word"),
              remember("k_deu_pw_franchise_promise"),
            ],
          },
          {
            id: "equal",
            effects: [
              setFlag("f_franchise_word"),
              setFlag("f_franchise_draft"),
              act({ do: "law_start", law: "deu_three_class", origin: "seat" }),
              heat("deu_cons", 1),
            ],
          },
        ],
      },
    ],
    tags: ["franchise"],
    effects: [],
    scene: "deu_pw_franchise_r",
  },

  // ---- 내각 ----
  {
    id: "deu_pw_majority",
    tag: "DEU",
    group: "cabinet",
    kind: "custom",
    shows: empire,
    needs: { office: "chancellor" },
    against: ["hard"],
    authority: 15,
    once: true,
    tags: ["coalition", "cabinet_change"],
    effects: [setFlag("f_deu_party_men"), inst("reichstag", 1)],
    risk: {
      pct: 30,
      mods: [{ when: flag("f_deu_ohl_rule"), add: 30 }],
      then: [reason("deu_pw_majority_army")],
      heats: [{ id: "deu_pl_army", by: 2 }],
      scene: "deu_pw_majority_bad",
    },
    scene: "deu_pw_majority_r",
  },

  // ---- 국내 ----
  {
    id: "deu_pw_siege",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    shows: empire,
    opens: [{ when: not(flag(SIEGE)), why: "already" }],
    needs: { office: "chancellor" },
    authority: 10,
    once: true,
    tags: ["army_over_civil", "press_gag"],
    effects: [
      setFlag(SIEGE),
      { kind: "censor", delta: 1 },
      inst("army", 1),
      inst("reichstag", -1),
    ],
    scene: "deu_pw_siege_r",
  },
  {
    id: "deu_pw_custody",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    shows: empire,
    opens: [{ when: flag(SIEGE), why: "no_siege" }],
    authority: 5,
    cooldown: 3,
    fields: [
      {
        id: "who",
        options: [
          {
            id: "strike",
            effects: [
              remember("k_deu_pw_custody_strike"),
              { kind: "gauge", gauge: "order", delta: 1 },
            ],
          },
          {
            id: "leaflets",
            effects: [{ kind: "rumour", delta: -1 }, heat("deu_uspd", 1)],
          },
        ],
      },
    ],
    tags: ["arrests", "harsh_home"],
    effects: [],
    // A protest strike, as after Liebknecht's arrest in 1916.
    risk: {
      pct: 20,
      mods: [{ when: { kind: "gauge", gauge: "bread", max: 1 }, add: 20 }],
      then: [
        { kind: "gauge", gauge: "order", delta: -2 },
        reason("deu_pw_custody_strike"),
      ],
      scene: "deu_pw_custody_bad",
    },
    scene: "deu_pw_custody_r",
  },
  // ---- 군: harsh measures (phase 2) ----
  {
    // Dinant, 23 Aug 1914; Louvain, from 25 Aug. The army called it the law
    // of war against francs-tireurs; Hague Art. 50 forbids collective penalty.
    id: "deu_pw_reprisal",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: atWar("BEL"), why: "no_occupied" }],
    authority: 5,
    cooldown: 4,
    fields: [
      {
        id: "how",
        options: [
          { id: "shoot" },
          {
            id: "burn",
            effects: [
              remember("k_deu_pw_reprisal_burn"),
              { kind: "opinion", bloc: "press", delta: -1 },
              america(3),
            ],
          },
        ],
      },
    ],
    tags: ["harsh_war"],
    // The rear goes quiet: fewer men guard the railways.
    effects: [inst("army", 1), act({ do: "manpower", delta: 1 })],
    risk: {
      pct: 40,
      mods: [{ when: neutral("USA"), add: 10 }],
      then: [america(5), trust("ITA", -1), reason("deu_pw_reprisal_abroad")],
      scene: "deu_pw_reprisal_bad",
    },
    scene: "deu_pw_reprisal_r",
  },
  {
    // Cavell, shot 12 Oct 1915 in Brussels after a court-martial (war treason,
    // RStGB §90). In January 1916 the Kaiser kept women's sentences to himself.
    id: "deu_pw_courtmartial",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [{ when: atWar("BEL"), why: "no_occupied" }],
    cooldown: 6,
    fields: [
      {
        id: "word",
        options: [
          {
            id: "confirm",
            effects: [
              remember("k_deu_pw_court_shot"),
              inst("army", 1),
              america(6),
              // The posters in London use her face.
              roll(
                "deu_pw_court_poster",
                50,
                act({ do: "force", tag: "GBR", theatre: "west", delta: 1 }),
                reason("deu_pw_court_recruits"),
              ),
            ],
            tags: ["harsh_war"],
          },
          {
            id: "spare",
            effects: [inst("army", -1), america(-2)],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_courtmartial_r",
  },
  {
    // Reichpietsch and Köbis, sentenced at Wilhelmshaven on 26 Aug 1917 and
    // shot at the Wahner Heide on 5 Sep; three others had theirs commuted.
    id: "deu_pw_fleet",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    shows: empire,
    opens: [
      { when: atWar("GBR"), why: "not_at_war_gbr" },
      { when: longWar, why: "fleet_quiet" },
    ],
    cooldown: 6,
    fields: [
      {
        id: "word",
        options: [
          {
            id: "shoot",
            effects: [
              remember("k_deu_pw_fleet_shot"),
              officeTrust("navy", 1),
              heat("deu_uspd", 2),
              roll(
                "deu_pw_fleet_below",
                40,
                heat("deu_spartacus", 1),
                gauge("morale", -1),
                reason("deu_pw_fleet_below"),
              ),
            ],
            tags: ["harsh_home"],
          },
          {
            id: "spare",
            effects: [officeTrust("navy", -1), inst("army", -1)],
          },
        ],
      },
    ],
    tags: [],
    effects: [],
    scene: "deu_pw_fleet_r",
  },

  // ---- 국내: harsh measures (phase 2) ----
  {
    // Berlin, 31 Jan 1918: the tightened state of siege, the struck plants
    // under the army, back by 4 Feb or arrest and call-up.
    id: "deu_pw_strikers",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    shows: empire,
    opens: [{ when: flag(SIEGE), why: "no_siege" }],
    authority: 10,
    cooldown: 6,
    tags: ["harsh_home", "arrests"],
    effects: [
      act({ do: "manpower", delta: 2 }),
      gauge("shells", 1),
      heat("deu_spd", 1),
      heat("deu_uspd", 2),
    ],
    // The men sent to the trenches take the strike's talk with them.
    risk: {
      pct: 30,
      mods: [
        { when: lowGauge("bread", 1), add: 20 },
        { when: streets, add: 15 },
      ],
      then: [
        gauge("order", -1),
        gauge("morale", -1),
        reason("deu_pw_strikers_trenches"),
      ],
      heats: [{ id: "deu_pl_red", by: 3 }],
      scene: "deu_pw_strikers_bad",
    },
    scene: "deu_pw_strikers_r",
  },
  {
    // The decree of 6 Nov 1914: British men of 17 to 55 to the Ruhleben
    // racecourse, as an answer to Britain's internment of Germans.
    id: "deu_pw_intern",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    shows: empire,
    opens: [{ when: atWar("GBR"), why: "not_at_war_gbr" }],
    authority: 5,
    once: true,
    tags: ["harsh_war"],
    effects: [
      { kind: "rumour", delta: -1 },
      { kind: "opinion", bloc: "court", delta: 1 },
      america(2),
    ],
    scene: "deu_pw_intern_r",
  },

  // ---- 법 밖의 일 (phase 2) ----
  {
    // The Prussian conflict: four budgets spent without a vote, 1862-66.
    id: "deu_pw_nobudget",
    tag: "DEU",
    group: "house",
    kind: "beyond",
    shows: empire,
    authority: 15,
    cooldown: 12,
    tags: ["decree", "house_closed"],
    // The year's budget goes without the Reichstag's vote (GW_BUDGET_DECREE,
    // spent by the budget it carries).
    effects: [
      setFlag("f_deu_no_budget"),
      reason("deu_pw_nobudget_done"),
      gauge("money", 1),
      inst("reichstag", -2),
      heat("deu_natlib", 1),
    ],
    heats: [{ id: "deu_parliament", by: 3 }],
    risk: {
      pct: 25,
      mods: [
        { when: instAtMost("reichstag", -2), add: 15 },
        { when: longWar, add: 10 },
      ],
      then: [gauge("money", -2), reason("deu_pw_nobudget_bonds")],
      heats: [{ id: "deu_pl_red", by: 3 }],
      scene: "deu_pw_nobudget_bad",
    },
    scene: "deu_pw_nobudget_r",
  },
  {
    // A Staatsstreich: Art. 20's franchise changed by decree, not by Art. 78.
    id: "deu_pw_coup",
    tag: "DEU",
    group: "house",
    kind: "beyond",
    shows: empire,
    once: true,
    authority: 25,
    tags: ["decree", "house_closed", "harsh_home"],
    effects: [
      setFlag("f_deu_franchise_coup"),
      inst("reichstag", -3),
      grow("deu_spd", -1),
      grow("deu_cons", 1),
      heat("deu_spd", 2),
      heat("deu_centre", 1),
      heat("deu_south", 1),
      gauge("order", -1),
    ],
    heats: [
      { id: "deu_parliament", by: 4 },
      { id: "deu_chancellor", by: 2 },
    ],
    // The general strike the SPD always said it would call.
    risk: {
      pct: 35,
      mods: [
        { when: war, add: 10 },
        { when: lowGauge("bread", 1), add: 20 },
        { when: lowGauge("order", 1), add: 15 },
      ],
      then: [
        gauge("order", -2),
        heat("deu_uspd", 2),
        reason("deu_pw_coup_strike"),
      ],
      heats: [{ id: "deu_pl_red", by: 4 }],
      scene: "deu_pw_coup_bad",
    },
    scene: "deu_pw_coup_r",
  },
  {
    // Past the Chancellor: the order goes out with no countersignature.
    id: "deu_pw_mobilise_b",
    tag: "DEU",
    group: "war",
    kind: "beyond",
    formOnly: true,
    authority: 10,
    tags: ["decree"],
    effects: [inst("countersign", -1), { kind: "temp", delta: 1 }],
    heats: [{ id: "deu_chancellor", by: 2 }],
    risk: {
      pct: 20,
      mods: [{ when: chancellorCold, add: 20 }],
      then: [chancellorLetter, reason("deu_pw_unsigned_letter")],
      scene: "deu_pw_mobilise_b_bad",
    },
    scene: "deu_pw_mobilise_b_r",
  },
  {
    // Past the Chancellor and the Bundesrat both (Art. 11, Art. 17).
    id: "deu_pw_declare_b",
    tag: "DEU",
    group: "war",
    kind: "beyond",
    formOnly: true,
    authority: 15,
    tags: ["war_offensive", "decree"],
    effects: [inst("countersign", -1), heat("deu_south", 1)],
    heats: [{ id: "deu_chancellor", by: 3 }],
    risk: {
      pct: 25,
      mods: [
        { when: chancellorCold, add: 15 },
        { when: not(war), add: 10 },
      ],
      then: [
        chancellorLetter,
        heat("deu_south", 1),
        reason("deu_pw_declare_b_states"),
      ],
      heats: [{ id: "deu_parliament", by: 2 }],
      scene: "deu_pw_declare_b_bad",
    },
    scene: "deu_pw_declare_b_r",
  },
  {
    // The decree past the Chancellor: the OHL's rule with no one's name on it.
    id: "deu_pw_ohl_b",
    tag: "DEU",
    group: "army",
    kind: "beyond",
    formOnly: true,
    once: true,
    tags: ["army_over_civil"],
    effects: [
      setFlag("f_deu_ohl_rule"),
      inst("army", 2),
      inst("countersign", -2),
      officeTrust("chief_of_staff", 1),
      reason("deu_pw_ohl_signs"),
    ],
    heats: [{ id: "deu_chancellor", by: 3 }],
    risk: {
      pct: 30,
      mods: [{ when: longWar, add: 20 }],
      then: [chancellorLetter, reason("deu_pw_unsigned_letter")],
      heats: [{ id: "deu_parliament", by: 2 }],
      scene: "deu_pw_ohl_b_bad",
    },
    scene: "deu_pw_ohl_b_r",
  },
  {
    // Art. 24 asks for a Bundesrat resolution; there is none.
    id: "deu_pw_dissolve_b",
    tag: "DEU",
    group: "house",
    kind: "beyond",
    formOnly: true,
    authority: 20,
    cooldown: 12,
    tags: ["dissolve", "decree"],
    effects: [
      ...ELECTION,
      inst("reichstag", -1),
      inst("countersign", -1),
      heat("deu_south", 1),
    ],
    heats: [
      { id: "deu_parliament", by: 3 },
      { id: "deu_chancellor", by: 2 },
    ],
    risk: {
      pct: 30,
      mods: [
        { when: war, add: 10 },
        { when: instAtMost("countersign", -2), add: 15 },
      ],
      then: [
        heat("deu_south", 2),
        inst("reichstag", -1),
        reason("deu_pw_dissolve_b_states"),
      ],
      heats: [{ id: "deu_parliament", by: 2 }],
      scene: "deu_pw_dissolve_b_bad",
    },
    scene: "deu_pw_dissolve_b_r",
  },
];

/** DEU's own reactors, on top of GW_REACTORS (`nation: "DEU"`). */
export const DEU_REACTORS: readonly GwReactorRow[] = [
  // The Centre and the Progressives speak for the occupied and the neutrals.
  {
    tag: "harsh_war",
    nation: "DEU",
    actor: "factions",
    of: ["parliament"],
    delta: -1,
  },
  // A war election heats the SPD.
  {
    tag: "dissolve",
    nation: "DEU",
    actor: "factions",
    of: ["workers"],
    delta: -1,
    by: war,
  },
  {
    tag: "franchise",
    nation: "DEU",
    actor: "factions",
    of: ["workers"],
    delta: 1,
  },
  // The OHL, the Conservatives and the Pan-Germans against a peace offer.
  {
    tag: "peace_white",
    nation: "DEU",
    actor: "factions",
    of: ["army", "court"],
    delta: -1,
    by: war,
  },
  {
    tag: "coalition",
    nation: "DEU",
    actor: "factions",
    of: ["parliament", "workers"],
    delta: 1,
  },
  {
    tag: "coalition",
    nation: "DEU",
    actor: "factions",
    of: ["army"],
    delta: -1,
  },
  // The Chief of Staff and the Emperor at his map table.
  {
    tag: "command_self",
    nation: "DEU",
    actor: "other",
    delta: -1,
    key: "deu_react_cos_command",
    does: [officeTrust("chief_of_staff", -1)],
  },
  // Rome, still neutral and courted by both sides, reads the same reports.
  // (No NLD in the sim: a `who: ["NLD"]` row would answer nothing.)
  {
    tag: "harsh_war",
    nation: "DEU",
    actor: "neutrals",
    who: ["ITA"],
    delta: -1,
    key: "deu_react_rome",
  },
  // The south German kingdoms keep their own rights in the Bundesrat.
  {
    tag: "decree",
    nation: "DEU",
    actor: "other",
    delta: -1,
    key: "deu_react_south_decree",
    does: [heat("deu_south", 1)],
  },
];

// ---- Result cards ----
const card = (
  id: string,
  variants: GwVariant[] = [{ id: "base" }],
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["home"],
  variants,
});

/** Result cards and other scenes the rows call. */
export const DEU_POWER_SCENES: readonly GwScene[] = [
  card("deu_pw_mobilise_r", [
    { id: "general", when: world({ is: "mob", tag: "DEU", min: 2 }) },
    { id: "stand", when: world({ is: "mob", tag: "DEU", max: 0 }) },
    { id: "base" },
  ]),
  card("deu_pw_ultimatum_r"),
  card("deu_pw_declare_r"),
  card("deu_pw_peace_r", [
    { id: "note", when: recent("k_deu_pw_peace_note") },
    { id: "base" },
  ]),
  card("deu_pw_command_r", [
    { id: "take", when: world({ is: "command" }) },
    { id: "base" },
  ]),
  card("deu_pw_uboat_r", [
    { id: "open", when: world({ is: "uboat", min: 2 }) },
    { id: "zone", when: world({ is: "uboat", min: 1, max: 1 }) },
    { id: "base" },
  ]),
  card("deu_pw_means_r", [
    { id: "gas", when: recent("k_deu_pw_gas") },
    { id: "base" },
  ]),
  card("deu_pw_occupied_r", [
    { id: "deport", when: recent("k_deu_pw_deport") },
    { id: "hostages", when: recent("k_deu_pw_hostages") },
    { id: "base" },
  ]),
  card("deu_pw_ohl_r"),
  card("deu_pw_adjourn_r"),
  card("deu_pw_dissolve_r", [{ id: "war", when: war }, { id: "base" }]),
  card("deu_pw_franchise_r", [
    { id: "promise", when: recent("k_deu_pw_franchise_promise") },
    { id: "base" },
  ]),
  card("deu_pw_majority_r"),
  card("deu_pw_siege_r"),
  card("deu_pw_custody_r", [
    { id: "strike", when: recent("k_deu_pw_custody_strike") },
    { id: "base" },
  ]),
  // Phase 2: what went wrong, the harsh measures, the acts beyond the law.
  card("deu_pw_ohl_bad"),
  card("deu_pw_majority_bad"),
  card("deu_pw_custody_bad"),
  card("deu_pw_reprisal_r", [
    { id: "burn", when: recent("k_deu_pw_reprisal_burn") },
    { id: "base" },
  ]),
  card("deu_pw_reprisal_bad", [
    { id: "burn", when: recent("k_deu_pw_reprisal_burn") },
    { id: "base" },
  ]),
  card("deu_pw_courtmartial_r", [
    { id: "shot", when: recent("k_deu_pw_court_shot") },
    { id: "base" },
  ]),
  card("deu_pw_fleet_r", [
    { id: "shot", when: recent("k_deu_pw_fleet_shot") },
    { id: "base" },
  ]),
  card("deu_pw_strikers_r"),
  card("deu_pw_strikers_bad"),
  card("deu_pw_intern_r"),
  card("deu_pw_nobudget_r"),
  card("deu_pw_nobudget_bad"),
  card("deu_pw_coup_r"),
  card("deu_pw_coup_bad"),
  card("deu_pw_mobilise_b_r", [
    { id: "general", when: world({ is: "mob", tag: "DEU", min: 2 }) },
    { id: "stand", when: world({ is: "mob", tag: "DEU", max: 0 }) },
    { id: "base" },
  ]),
  card("deu_pw_mobilise_b_bad"),
  card("deu_pw_declare_b_r"),
  card("deu_pw_declare_b_bad"),
  card("deu_pw_ohl_b_r"),
  card("deu_pw_ohl_b_bad"),
  card("deu_pw_dissolve_b_r", [{ id: "war", when: war }, { id: "base" }]),
  card("deu_pw_dissolve_b_bad"),
];
