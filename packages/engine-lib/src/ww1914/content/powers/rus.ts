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
//
// Phase 2 (ww169 XR): the harsh measures he could order (hostages, scorched
// earth, the Bolshevik deputies, the Central Asian labour draft) and the acts
// beyond the law: the two "서명 없이" forms, the election law by decree (3
// June 1907), abolishing the Duma, and field courts-martial for the rear.
// Each beyond row heats a threat or a plot through `heats`, never `gov_heat`.
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
import { cool, faction, grow, heat, under } from "../house/kit";

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
/** The Duma was abolished by the row beyond the law below. */
const abolished = flag("f_rus_duma_abolished");
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const gaugeAt = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  max: number,
): GwCond => ({ kind: "gauge", gauge: g, max });

export const RUS_POWERS: readonly GwPowerRow[] = [
  // ---- 전쟁과 평화 ----
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
    beyond: "rus_pw_peace_b",
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
      then: [reason("rus_pw_separate_split")],
      heats: [
        { id: "rus_pl_palace", by: 3 },
        { id: "rus_pl_generals", by: 2 },
      ],
      scene: "rus_pw_separate_bad",
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
    // What Stavka wanted: no one behind the lines it suspected of spying. The
    // price comes from the state's answers (the reactors) and the risk.
    effects: [
      inst("stavka", 1),
      { kind: "rumour", delta: -1 },
      { kind: "pressure", topic: "home", delta: 1 },
      reason("rus_pw_deport_done"),
    ],
    risk: {
      pct: 20,
      mods: [{ when: retreat, add: 20 }],
      then: [gauge("bread", -1), reason("rus_pw_rails")],
      scene: "rus_pw_deport_bad",
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
    beyond: "rus_pw_duma_close_b",
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
      then: [gauge("order", -1), reason("rus_pw_duma_street")],
      heats: [{ id: "rus_pl_palace", by: 2 }],
      scene: "rus_pw_duma_close_bad",
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
    opens: [
      { when: not(abolished), why: "abolished" },
      { when: not(sitting), why: "sitting" },
    ],
    needs: { office: "chancellor" },
    against: ["court"],
    tags: ["house_opened"],
    effects: [setFlag("f_gov_rus_session"), inst("duma", 1)],
    heats: [{ id: "rus_duma", by: -1 }],
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
    // No Duma left to trust a ministry (ww171).
    opens: [{ when: not(abolished), why: "abolished" }],
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
    ],
    heats: [{ id: "rus_court", by: -1 }],
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
      then: [gauge("order", -3), reason("rus_pw_troops_broke")],
      heats: [
        { id: "rus_pl_red", by: 2 },
        { id: "rus_court", by: 2 },
      ],
      scene: "rus_pw_troops_bad",
    },
    scene: "rus_pw_troops_r",
  },
  // ---- 군: harsh measures of war (phase 2) ----
  {
    // Stavka took hostages from the Jewish communities of the front zone
    // (1915): rabbis, merchants, elders, held against the town's loyalty.
    id: "rus_pw_hostages",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    cooldown: 6,
    tags: ["harsh_war"],
    // What the army wanted: a quiet front zone and fewer spies behind it. New
    // York's bankers read the names (money); the world answers by reactor.
    effects: [
      inst("stavka", 1),
      gauge("order", 1),
      { kind: "rumour", delta: -1 },
      gauge("money", -1),
      reason("rus_pw_hostages_done"),
    ],
    risk: {
      pct: 10,
      mods: [
        { when: retreat, add: 20 },
        { when: gaugeAt("order", 1), add: 10 },
      ],
      then: [
        gauge("order", -2),
        opinion("parliament", -1),
        reason("rus_pw_hostages_lost"),
      ],
      scene: "rus_pw_hostages_bad",
    },
    scene: "rus_pw_hostages_r",
  },
  {
    // The Great Retreat of 1915: crops and villages burnt behind the army,
    // the people driven east with it.
    id: "rus_pw_scorched",
    tag: "RUS",
    group: "army",
    kind: "lawful",
    shows: all(reigns, war),
    opens: [{ when: retreat, why: "no_retreat" }],
    once: true,
    authority: 5,
    tags: ["harsh_war"],
    effects: [
      {
        kind: "maybe",
        when: { kind: "at_war", tag: "DEU" },
        then: [
          doWorld({ do: "force", tag: "DEU", theatre: "east", delta: -1 }),
        ],
      },
      {
        kind: "maybe",
        when: not({ kind: "at_war", tag: "DEU" }),
        then: [
          doWorld({ do: "force", tag: "AUH", theatre: "east", delta: -1 }),
        ],
      },
      inst("stavka", 1),
      gauge("bread", -1),
      { kind: "pressure", topic: "home", delta: 1 },
      reason("rus_pw_scorched_done"),
    ],
    risk: {
      pct: 20,
      mods: [
        { when: gaugeAt("bread", 0), add: 20 },
        { when: gaugeAt("order", 1), add: 10 },
      ],
      then: [
        gauge("bread", -1),
        gauge("order", -1),
        reason("rus_pw_scorched_cities"),
      ],
      heats: [{ id: "rus_pl_red", by: 1 }],
      scene: "rus_pw_scorched_bad",
    },
    scene: "rus_pw_scorched_r",
  },
  // ---- 국내: harsh measures at home (phase 2) ----
  {
    // November 1914: the five Bolshevik deputies taken at a meeting, tried
    // in February 1915 and sent to Siberia for life. Petrovsky was one.
    id: "rus_pw_bolsheviks",
    tag: "RUS",
    group: "home",
    kind: "lawful",
    shows: reigns,
    opens: [{ when: faction("rus_bolsh", { of: ["in"] }), why: "bolsh_gone" }],
    once: true,
    authority: 5,
    tags: ["harsh_home", "arrests"],
    effects: [
      under("rus_bolsh"),
      heat("rus_sd", 1),
      heat("rus_trud", 1),
      opinion("parliament", -1),
      reason("rus_pw_bolsheviks_done"),
    ],
    scene: "rus_pw_bolsheviks_r",
  },
  {
    // The decree of 25 June 1916 (O.S.): the men of Turkestan and the Steppe,
    // never called before, drafted to dig behind the front. The revolt
    // followed within weeks.
    id: "rus_pw_labour_draft",
    tag: "RUS",
    group: "home",
    kind: "lawful",
    shows: all(reigns, war),
    once: true,
    authority: 5,
    tags: ["harsh_home", "decree"],
    effects: [
      doWorld({ do: "manpower", delta: 2 }),
      { kind: "pressure", topic: "home", delta: 1 },
      reason("rus_pw_labour_done"),
    ],
    risk: {
      pct: 30,
      mods: [
        { when: gaugeAt("order", 1), add: 15 },
        { when: unrest(1), add: 10 },
        { when: retreat, add: 10 },
      ],
      then: [
        gauge("order", -2),
        doWorld({ do: "manpower", delta: -1 }),
        inst("stavka", -1),
        reason("rus_pw_labour_rising"),
      ],
      scene: "rus_pw_labour_draft_bad",
    },
    scene: "rus_pw_labour_draft_r",
  },
  // ---- 법 밖의 일 (phase 2) ----
  {
    // The overture by the court's own envoy, past the foreign minister: no
    // minister's word stands behind it, and the allies hear of it late.
    id: "rus_pw_peace_b",
    tag: "RUS",
    group: "war",
    kind: "beyond",
    formOnly: true,
    opens: [{ when: not(flag("gw_talks_open")), why: "talks_open" }],
    authority: 10,
    tags: ["peace_white"],
    effects: [
      doWorld({ do: "talks" }),
      trust("FRA", -2),
      trust("GBR", -2),
      inst("ministers", -1),
      reason("rus_pw_peace_b_done"),
    ],
    heats: [{ id: "rus_cabinet", by: 2 }],
    risk: {
      pct: 20,
      mods: [
        { when: blocAt("parliament", { max: -1 }), add: 15 },
        { when: { kind: "rumour", min: 2 }, add: 20 },
        { when: blocAt("army", { max: -2 }), add: 10 },
      ],
      then: [
        opinion("press", -1),
        opinion("army", -1),
        { kind: "rumour", delta: 1 },
        heat("rus_bloc", 1),
        reason("rus_pw_peace_b_leak"),
      ],
      heats: [{ id: "rus_pl_palace", by: 2 }],
      scene: "rus_pw_peace_b_bad",
    },
    scene: "rus_pw_peace_b_r",
  },
  {
    // Art. 24 wants the chairman's or a minister's countersignature under a
    // decree of state; this one goes out with the space empty. The lawful
    // row's pick (recess or dissolution) still runs.
    id: "rus_pw_duma_close_b",
    tag: "RUS",
    group: "house",
    kind: "beyond",
    formOnly: true,
    opens: [{ when: sitting, why: "not_sitting" }],
    authority: 10,
    tags: ["house_closed", "decree"],
    effects: [
      { kind: "unflag", flag: "f_gov_rus_session" },
      inst("duma", -2),
      inst("ministers", -1),
      inst("court", 1),
      reason("rus_pw_duma_close_b_done"),
    ],
    heats: [
      { id: "rus_duma", by: 2 },
      { id: "rus_cabinet", by: 2 },
    ],
    risk: {
      pct: 20,
      mods: [
        { when: blocAt("parliament", { max: -2 }), add: 20 },
        { when: all(retreat, shellsLow), add: 20 },
        { when: unrest(2), add: 10 },
      ],
      then: [
        doWorld({ do: "leave", who: { office: "chancellor" } }),
        gauge("order", -1),
        heat("rus_kadets", 1),
        heat("rus_octob", 1),
        reason("rus_pw_duma_close_b_quit"),
      ],
      heats: [{ id: "rus_pl_palace", by: 2 }],
      scene: "rus_pw_duma_close_b_bad",
    },
    scene: "rus_pw_duma_close_b_r",
  },
  {
    // The 3 June 1907 precedent: the Duma dissolved and a new election law
    // issued by manifesto, though no law could pass without the Duma and the
    // State Council (Art. 86) and an Art. 87 decree couldn't touch it.
    id: "rus_pw_election_law",
    tag: "RUS",
    group: "house",
    kind: "beyond",
    shows: world({ is: "regime", of: ["tsar"] }),
    opens: [
      { when: not(abolished), why: "abolished" },
      { when: not(sitting), why: "sitting" },
    ],
    once: true,
    authority: 15,
    tags: ["decree"],
    effects: [
      inst("duma", -1),
      opinion("parliament", -2),
      opinion("workers", -1),
      opinion("court", 1),
      grow("rus_rights", 1),
      grow("rus_kadets", -1),
      grow("rus_trud", -1),
      heat("rus_kadets", 2),
      heat("rus_progress", 1),
      heat("rus_trud", 1),
      cool("rus_rights", 1),
      reason("rus_pw_election_law_done"),
    ],
    heats: [{ id: "rus_duma", by: 2 }],
    risk: {
      pct: 20,
      mods: [
        { when: unrest(2), add: 20 },
        { when: blocAt("workers", { max: -2 }), add: 15 },
        { when: gaugeAt("order", 1), add: 15 },
      ],
      then: [
        gauge("order", -1),
        heat("rus_bolsh", 1),
        heat("rus_sd", 1),
        reason("rus_pw_election_law_strike"),
      ],
      heats: [{ id: "rus_pl_red", by: 2 }],
      scene: "rus_pw_election_law_bad",
    },
    scene: "rus_pw_election_law_r",
  },
  {
    // The Duma came from the October Manifesto and the Fundamental Laws of
    // 1906; nothing in them lets the Tsar take it back.
    id: "rus_pw_abolish_duma",
    tag: "RUS",
    group: "house",
    kind: "beyond",
    shows: world({ is: "regime", of: ["tsar"] }),
    opens: [{ when: not(abolished), why: "abolished" }],
    once: true,
    authority: 20,
    tags: ["house_closed", "decree"],
    effects: [
      { kind: "unflag", flag: "f_gov_rus_session" },
      setFlag("f_rus_duma_abolished"),
      inst("duma", -3),
      inst("ministers", -1),
      inst("court", 1),
      opinion("parliament", -2),
      opinion("business", -1),
      trust("FRA", -1),
      trust("GBR", -1),
      trust("USA", -1),
      heat("rus_kadets", 2),
      heat("rus_octob", 2),
      heat("rus_progress", 2),
      heat("rus_bloc", 2),
      cool("rus_rights", 1),
      reason("rus_pw_abolish_done"),
      // The house's door (houses.ts RUS_DUMA_GONE): no chamber votes a law,
      // every bill and the budget go out by decree, the Duma's threat is over.
      reason("rus_pw_abolish_decree"),
    ],
    // The ministers now answer for everything alone.
    heats: [
      { id: "rus_cabinet", by: 2 },
      { id: "rus_court", by: 2 },
      { id: "rus_pl_palace", by: 3 },
    ],
    risk: {
      pct: 25,
      mods: [
        { when: gaugeAt("morale", 1), add: 20 },
        { when: unrest(2), add: 20 },
        { when: blocAt("army", { max: -2 }), add: 15 },
        { when: all(war, retreat), add: 10 },
      ],
      then: [
        gauge("order", -2),
        heat("rus_bolsh", 1),
        reason("rus_pw_abolish_garrison"),
      ],
      heats: [
        { id: "rus_pl_red", by: 2 },
        { id: "rus_pl_generals", by: 2 },
      ],
      scene: "rus_pw_abolish_duma_bad",
    },
    scene: "rus_pw_abolish_duma_r",
  },
  {
    // ww172: the abolition undone by his own manifesto, as he could. The
    // Fundamental Laws stand again: the State Council and the Duma are
    // convoked by imperial decree (Art. 98), the chairman countersigning
    // (Art. 24), and both sit at once. No camp is against it: it is the law
    // he swore to again.
    id: "rus_pw_restore_duma",
    tag: "RUS",
    group: "house",
    kind: "lawful",
    shows: all(reigns, abolished),
    needs: { office: "chancellor" },
    authority: 10,
    tags: ["house_opened"],
    effects: [
      { kind: "unflag", flag: "f_rus_duma_abolished" },
      setFlag("f_gov_rus_session"),
      inst("duma", 1),
      inst("court", -1),
      opinion("parliament", 1),
      cool("rus_kadets", 1),
      cool("rus_octob", 1),
      heat("rus_rights", 1),
      reason("rus_pw_restore_done"),
    ],
    scene: "rus_pw_restore_duma_r",
  },
  {
    // Field courts-martial: officers judging civilians, the sentence carried
    // out at once. Set up by an Art. 87 decree in August 1906, gone by April
    // 1907; brought back now for the rear, past the Duma.
    id: "rus_pw_field_courts",
    tag: "RUS",
    group: "home",
    kind: "beyond",
    shows: reigns,
    cooldown: 6,
    authority: 10,
    tags: ["harsh_home", "arrests", "decree"],
    effects: [
      gauge("order", 1),
      opinion("parliament", -1),
      heat("rus_kadets", 1),
      heat("rus_trud", 1),
      reason("rus_pw_field_courts_done"),
    ],
    heats: [{ id: "rus_duma", by: 2 }],
    risk: {
      pct: 15,
      mods: [
        { when: unrest(2), add: 20 },
        { when: gaugeAt("bread", 0), add: 15 },
        { when: blocAt("army", { max: -2 }), add: 10 },
      ],
      then: [
        gauge("order", -2),
        heat("rus_bolsh", 1),
        reason("rus_pw_field_courts_strike"),
      ],
      heats: [{ id: "rus_pl_red", by: 2 }],
      scene: "rus_pw_field_courts_bad",
    },
    scene: "rus_pw_field_courts_r",
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
  // Phase 2: the risk cards of the lawful rows, then the new rows' cards.
  card("rus_pw_separate_bad", ["war"]),
  card("rus_pw_deport_bad", ["home"]),
  card("rus_pw_duma_close_bad", ["home"]),
  card("rus_pw_troops_bad", ["home"]),
  card("rus_pw_hostages_r", ["war"]),
  card("rus_pw_hostages_bad", ["war"]),
  card("rus_pw_scorched_r", ["war"]),
  card("rus_pw_scorched_bad", ["war"]),
  card("rus_pw_bolsheviks_r", ["home"]),
  card("rus_pw_labour_draft_r", ["home"]),
  card("rus_pw_labour_draft_bad", ["home"]),
  card("rus_pw_peace_b_r", ["war"]),
  card("rus_pw_peace_b_bad", ["war"]),
  card("rus_pw_duma_close_b_r", ["home"]),
  card("rus_pw_duma_close_b_bad", ["home"]),
  card("rus_pw_election_law_r", ["home"]),
  card("rus_pw_election_law_bad", ["home"]),
  card("rus_pw_abolish_duma_r", ["home"]),
  card("rus_pw_abolish_duma_bad", ["home"]),
  card("rus_pw_restore_duma_r", ["home"]),
  card("rus_pw_field_courts_r", ["home"]),
  card("rus_pw_field_courts_bad", ["home"]),
];
