// Great War 1914: RUS's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/RUS.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
//
// Nicholas II under the Fundamental State Laws of 23 April 1906 (checked in
// the Svod text): war, peace and treaties are his (Art. 13); he is the supreme
// leader of the army and navy (Art. 14); he names and dismisses ministers
// (Art. 17; the people tab does that); his decrees of state carry the
// chairman's or a minister's countersignature (Art. 24); he sets the Duma's
// sessions and breaks (Art. 99) and can dissolve it before its five years
// (Art. 105); with no contingent law in time he calls up last year's number
// (Art. 119). No house votes on any of these: the Duma could only ask
// questions (Art. 108). Article 87 decrees are the bills tab's way round
// (houses.ts), so no row here.
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  not,
  reason,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";
import { cool, heat, heatPlot } from "../house/kit";

/** Nicholas still reigns: his own rule, or with a ministry the Duma trusts. */
const reigns = world({ is: "regime", of: ["tsar", "crown"] });
const war = world({ is: "war" });
/** The Duma sits (gov.ts and the rows below set it). */
const sitting = flag("f_gov_rus_session");
const mob = (o: { min?: number; max?: number }): GwCond =>
  world({ is: "mob", tag: "RUS", ...o });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const inst = (
  i: "court" | "stavka" | "duma" | "ministers",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const trust = (tag: "FRA" | "GBR" | "USA", delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const govHeat = (id: string, delta: number): GwEffect =>
  doWorld({ do: "gov_heat", id, delta });
const active = (person: string): GwCond => ({ kind: "person_active", person });
const appoint = (person: string): GwEffect => ({
  kind: "appoint",
  who: { person },
  office: "supreme_commander",
});
const blocAt = (
  bloc: "army" | "court" | "parliament" | "workers",
  o: { min?: number; max?: number },
): GwCond => ({ kind: "bloc", bloc, ...o });
// A risk that came true, or the pick taken, shows as a reason line: the
// content check doesn't see a memory a power row writes, so the cards don't
// read one.
const retreat = world({ is: "front", theatre: "east", from: "vistula" });
const shellsLow: GwCond = { kind: "gauge", gauge: "shells", max: 0 };

export const RUS_POWERS: readonly GwPowerRow[] = [
  // ---- 전쟁과 평화 ----
  {
    // Art. 13. Before the general war: against Vienna or Berlin. The cascade
    // of 1914 follows whoever is named (the `declare` effect closes the chain).
    id: "rus_pw_war",
    tag: "RUS",
    group: "war",
    kind: "lawful",
    shows: reigns,
    opens: [{ when: not(war), why: "war_on" }],
    authority: 10,
    once: true,
    target: {
      kind: "country",
      of: [
        { id: "AUH", effects: [doWorld({ do: "declare", tag: "AUH" })] },
        { id: "DEU", effects: [doWorld({ do: "declare", tag: "DEU" })] },
      ],
    },
    tags: ["war_offensive"],
    effects: [
      // With no crisis to point to, Paris and London were never asked.
      {
        kind: "maybe",
        when: { kind: "temp", max: 4 },
        then: [
          trust("FRA", -1),
          trust("GBR", -1),
          opinion("parliament", -1),
          reason("rus_pw_war_unasked"),
        ],
      },
    ],
    scene: "rus_pw_war_r",
  },
  {
    // Art. 13. The Straits are Russia's own aim.
    id: "rus_pw_war_ott",
    tag: "RUS",
    group: "war",
    kind: "lawful",
    shows: all(reigns, war),
    opens: [
      { when: world({ is: "neutral", tag: "OTT" }), why: "ott_not_neutral" },
    ],
    authority: 5,
    once: true,
    tags: ["war_offensive"],
    effects: [
      doWorld({ do: "declare", tag: "OTT" }),
      { kind: "pressure", topic: "straits", delta: 1 },
    ],
    scene: "rus_pw_war_ott_r",
  },
  {
    // Mobilisation by imperial order: the districts facing Austria, or the
    // whole empire.
    id: "rus_pw_mobilise",
    tag: "RUS",
    group: "war",
    kind: "lawful",
    shows: reigns,
    opens: [
      { when: not(war), why: "war_on" },
      { when: mob({ max: 1 }), why: "mobilised" },
    ],
    fields: [
      {
        id: "how",
        options: [
          {
            id: "partial",
            when: mob({ max: 0 }),
            effects: [
              doWorld({ do: "mobilize", tag: "RUS", level: 1 }),
              { kind: "temp", delta: 1 },
            ],
          },
          {
            id: "general",
            effects: [
              doWorld({ do: "mobilize", tag: "RUS", level: 2 }),
              { kind: "temp", delta: 2 },
              inst("stavka", 1),
            ],
          },
        ],
      },
    ],
    tags: ["mobilise"],
    effects: [],
    scene: "rus_pw_mobilise_r",
  },
  {
    id: "rus_pw_stand_down",
    tag: "RUS",
    group: "war",
    kind: "lawful",
    shows: reigns,
    opens: [
      { when: not(war), why: "war_on" },
      { when: mob({ min: 1 }), why: "not_mobilised" },
    ],
    authority: 5,
    tags: ["stand_down"],
    effects: [
      doWorld({ do: "stand_down", tag: "RUS", level: 0 }),
      { kind: "temp", delta: -1 },
      inst("stavka", -1),
      trust("FRA", -1),
    ],
    scene: "rus_pw_stand_down_r",
  },
  {
    // Art. 13: peace is his. The overture goes through the foreign minister;
    // the 5 September 1914 declaration bound London, Paris and Petrograd to
    // no separate peace, so the allies take it ill.
    id: "rus_pw_peace",
    tag: "RUS",
    group: "war",
    kind: "lawful",
    shows: all(reigns, war),
    opens: [{ when: not(flag("gw_talks_open")), why: "talks_open" }],
    needs: { office: "foreign" },
    against: ["duma"],
    authority: 5,
    cooldown: 4,
    tags: ["peace_white"],
    effects: [doWorld({ do: "talks" }), trust("FRA", -1), trust("GBR", -1)],
    scene: "rus_pw_peace_r",
  },
  {
    // Art. 13 allows it; the London declaration and custom don't. Only once
    // Berlin's feeler is known.
    id: "rus_pw_separate",
    tag: "RUS",
    group: "war",
    kind: "custom",
    shows: all(reigns, war),
    opens: [
      {
        when: world({ is: "known", id: "rus_german_feeler" }),
        why: "no_word",
      },
    ],
    needs: { office: "foreign" },
    against: ["duma"],
    authority: 15,
    once: true,
    tags: ["peace_separate", "alliance_broken"],
    // The allies first: once out of the war Russia has none to answer
    // the reactors.
    effects: [
      trust("FRA", -2),
      trust("GBR", -2),
      opinion("parliament", -1),
      heat("rus_bloc", 1),
      heat("rus_kadets", 1),
      doWorld({ do: "separate_peace" }),
    ],
    risk: {
      pct: 25,
      mods: [
        { when: blocAt("court", { max: -1 }), add: 20 },
        { when: blocAt("army", { max: -2 }), add: 20 },
      ],
      then: [
        heatPlot("rus_pl_palace", 3),
        heatPlot("rus_pl_generals", 2),
        reason("rus_pw_separate_split"),
      ],
    },
    scene: "rus_pw_separate_r",
  },
  // ---- 군 ----
  {
    // Art. 14. Nobody had to sign it; eight ministers wrote against it.
    id: "rus_pw_command",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    opens: [{ when: not(world({ is: "command" })), why: "in_command" }],
    authority: 10,
    once: true,
    tags: ["command_self"],
    effects: [
      doWorld({ do: "personal_command", on: true }),
      { kind: "dismiss", who: { office: "supreme_commander" } },
      {
        kind: "maybe",
        when: active("rus_alekseev"),
        then: [
          {
            kind: "appoint",
            who: { person: "rus_alekseev" },
            office: "chief_of_staff",
          },
        ],
      },
      inst("court", 2),
      inst("ministers", -2),
      inst("duma", -1),
      setFlag("f_rus_took_command"),
      { kind: "drop_card", scene: "rus_w_command" },
    ],
    scene: "rus_pw_command_r",
  },
  {
    // Art. 14 the other way: he names a Supreme Commander and goes home.
    id: "rus_pw_command_give",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    opens: [{ when: world({ is: "command" }), why: "not_in_command" }],
    authority: 5,
    cooldown: 6,
    target: {
      kind: "option",
      of: [
        { id: "alekseev", effects: [appoint("rus_alekseev")] },
        {
          id: "brusilov",
          when: active("rus_brusilov"),
          effects: [appoint("rus_brusilov")],
        },
        {
          id: "nikolasha",
          when: active("rus_nikolasha"),
          effects: [appoint("rus_nikolasha"), inst("court", -1)],
        },
      ],
    },
    tags: [],
    effects: [
      doWorld({ do: "personal_command", on: false }),
      inst("stavka", 1),
      inst("ministers", 1),
      inst("court", -1),
    ],
    scene: "rus_pw_command_give_r",
  },
  {
    // Art. 119: with no contingent law passed in time, last year's number
    // is called up by decree.
    id: "rus_pw_recruits",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    authority: 5,
    cooldown: 6,
    tags: ["decree"],
    effects: [
      doWorld({ do: "manpower", delta: 3 }),
      opinion("workers", -1),
      { kind: "pressure", topic: "home", delta: 1 },
    ],
    scene: "rus_pw_recruits_r",
  },
  {
    // Stavka's expulsions from the front zones (Kovno and Courland, spring
    // 1915), and the German colonists of the west.
    id: "rus_pw_deport",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    cooldown: 4,
    fields: [
      {
        id: "whom",
        options: [
          {
            id: "jews",
            effects: [trust("USA", -1), trust("GBR", -1), gauge("money", -1)],
          },
          {
            id: "germans",
            effects: [gauge("bread", -1), opinion("business", -1)],
          },
        ],
      },
    ],
    tags: ["harsh_war", "harsh_home"],
    effects: [
      inst("stavka", 1),
      gauge("order", -1),
      opinion("press", -1),
      { kind: "pressure", topic: "home", delta: 1 },
    ],
    risk: {
      pct: 20,
      mods: [{ when: retreat, add: 20 }],
      then: [gauge("bread", -1), reason("rus_pw_rails")],
    },
    scene: "rus_pw_deport_r",
  },
  // ---- 의회 ----
  {
    // Art. 99 (a break in the session) or Art. 105 (dissolution, new
    // elections). A decree of state: the chairman countersigns (Art. 24).
    id: "rus_pw_duma_close",
    tag: "RUS",
    group: "house",
    kind: "lawful",
    shows: reigns,
    opens: [{ when: sitting, why: "not_sitting" }],
    needs: { office: "chancellor" },
    against: ["duma"],
    authority: 5,
    fields: [
      {
        id: "how",
        options: [
          { id: "recess" },
          {
            id: "dissolve",
            tags: ["dissolve"],
            effects: [
              inst("duma", -1),
              opinion("parliament", -1),
              heat("rus_kadets", 1),
              heat("rus_octob", 1),
              reason("rus_pw_dissolved"),
            ],
          },
        ],
      },
    ],
    tags: ["house_closed"],
    effects: [
      { kind: "unflag", flag: "f_gov_rus_session" },
      inst("duma", -1),
      inst("court", 1),
    ],
    risk: {
      pct: 0,
      mods: [{ when: all(retreat, shellsLow), add: 30 }],
      then: [
        heatPlot("rus_pl_palace", 2),
        gauge("order", -1),
        reason("rus_pw_duma_street"),
      ],
    },
    scene: "rus_pw_duma_close_r",
  },
  {
    // Art. 99: the session opens by his decree, the chairman countersigning.
    id: "rus_pw_duma_open",
    tag: "RUS",
    group: "house",
    kind: "lawful",
    shows: reigns,
    opens: [{ when: not(sitting), why: "sitting" }],
    needs: { office: "chancellor" },
    against: ["court"],
    tags: ["house_opened"],
    effects: [
      setFlag("f_gov_rus_session"),
      inst("duma", 1),
      govHeat("rus_duma", -1),
    ],
    scene: "rus_pw_duma_open_r",
  },
  // ---- 내각 ----
  {
    // The Progressive Bloc's demand: lawful, since he names whom he likes,
    // and against everything autocracy meant.
    id: "rus_pw_confidence",
    tag: "RUS",
    group: "cabinet",
    kind: "custom",
    shows: world({ is: "regime", of: ["tsar"] }),
    authority: 10,
    once: true,
    tags: ["coalition", "cabinet_change"],
    effects: [
      doWorld({ do: "regime", to: "crown" }),
      heat("rus_circle", 1),
      cool("rus_bloc", 1),
    ],
    scene: "rus_pw_confidence_r",
  },
  {
    // His own household: nobody's signature, nobody's business but his.
    id: "rus_pw_favourite",
    tag: "RUS",
    group: "cabinet",
    kind: "lawful",
    shows: reigns,
    authority: 5,
    cooldown: 6,
    target: {
      kind: "option",
      of: [
        {
          id: "rasputin",
          when: active("rus_rasputin"),
          effects: [
            heat("rus_circle", 2),
            cool("rus_octob", 1),
            opinion("parliament", 1),
            reason("rus_pw_rasputin_sent"),
          ],
        },
        {
          id: "empress",
          effects: [
            heat("rus_circle", 1),
            inst("ministers", 1),
            opinion("parliament", 1),
          ],
        },
      ],
    },
    tags: [],
    effects: [
      inst("court", -1),
      { kind: "ruler", side: "family", delta: -1, key: "rus_pw_household" },
      govHeat("rus_court", -1),
    ],
    scene: "rus_pw_favourite_r",
  },
  // ---- 국내 ----
  {
    // The garrison and the Cossacks against the capital's crowds: it went
    // the way the garrison was.
    id: "rus_pw_troops",
    tag: "RUS",
    group: "home",
    kind: "lawful",
    shows: reigns,
    opens: [
      {
        when: any(world({ is: "unrest", min: 1 }), {
          kind: "gauge",
          gauge: "order",
          max: 2,
        }),
        why: "streets_quiet",
      },
    ],
    authority: 5,
    tags: ["harsh_home", "arrests"],
    effects: [gauge("order", 1), opinion("workers", -2)],
    risk: {
      pct: 10,
      mods: [
        { when: { kind: "gauge", gauge: "morale", max: 1 }, add: 25 },
        { when: world({ is: "unrest", min: 2 }), add: 20 },
        { when: blocAt("army", { max: -2 }), add: 20 },
        { when: { kind: "gauge", gauge: "bread", max: 0 }, add: 15 },
      ],
      then: [
        gauge("order", -3),
        heatPlot("rus_pl_red", 2),
        govHeat("rus_court", 2),
        reason("rus_pw_troops_broke"),
      ],
    },
    scene: "rus_pw_troops_r",
  },
];

/** RUS's own reactors, on top of GW_REACTORS (`nation: "RUS"`). */
export const RUS_REACTORS: readonly GwReactorRow[] = [
  // The court and the Rights are glad of every closed Duma.
  {
    tag: "house_closed",
    nation: "RUS",
    actor: "people",
    of: ["court"],
    delta: 1,
    key: "rus_pw_r_court_glad",
  },
  // The letter of the eight ministers, August 1915.
  {
    tag: "command_self",
    nation: "RUS",
    actor: "cabinet",
    of: ["duma"],
    delta: -1,
    key: "rus_pw_r_ministers",
  },
  // The Kadets and the Progressives raise the expulsions in the Duma.
  {
    tag: "harsh_war",
    nation: "RUS",
    actor: "factions",
    of: ["parliament"],
    delta: -1,
    key: "rus_pw_r_kadets",
  },
  // A ministry the Duma trusts: the Empress's circle and the Rights take it ill.
  {
    tag: "coalition",
    nation: "RUS",
    actor: "people",
    of: ["court"],
    delta: -1,
    key: "rus_pw_r_court_cold",
  },
  {
    tag: "coalition",
    nation: "RUS",
    actor: "factions",
    of: ["court"],
    delta: -1,
    key: "rus_pw_r_rights",
  },
  // A separate peace: the papers call it treason.
  {
    tag: "peace_separate",
    nation: "RUS",
    actor: "people",
    of: ["press"],
    delta: -1,
    key: "rus_pw_r_treason",
  },
];

/** The result card: silent, laid at once, no options. */
const card = (
  id: string,
  tags: GwScene["tags"],
  variants: GwScene["variants"] = [{ id: "base" }],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags,
  variants,
});

/** Result cards and other scenes the rows call. */
export const RUS_POWER_SCENES: readonly GwScene[] = [
  card("rus_pw_war_r", ["war"]),
  card("rus_pw_war_ott_r", ["war"]),
  card(
    "rus_pw_mobilise_r",
    ["war"],
    [{ id: "general", when: mob({ min: 2 }) }, { id: "base" }],
  ),
  card("rus_pw_stand_down_r", ["war"]),
  card("rus_pw_peace_r", ["war"]),
  card("rus_pw_separate_r", ["war"]),
  card("rus_pw_command_r", ["war"]),
  card("rus_pw_command_give_r", ["war"]),
  card("rus_pw_recruits_r", ["home"]),
  card("rus_pw_deport_r", ["home"]),
  card("rus_pw_duma_close_r", ["home"]),
  card("rus_pw_duma_open_r", ["home"]),
  card("rus_pw_confidence_r", ["home"]),
  card("rus_pw_favourite_r", ["people"]),
  card("rus_pw_troops_r", ["home"]),
];
