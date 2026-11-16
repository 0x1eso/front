// ww229: Romania's events. Triggered ones check the situation, never a day;
// the rest are fired by the tree (self = Romania). Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, flag, gflag, not, T } from "../../helpers";

export const ROU_EVENTS: EventDef[] = [
  {
    // The Legion's marches and work camps fill the villages.
    id: "rou_ev_codreanu_rise",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      not(flag("rou_legion_crushed")),
      { kind: "pop_ge", ideology: "fascist", pct: 20 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 180,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The governing party falls short of the bonus threshold.
    id: "rou_ev_hung_election",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(after("1937-06-01"), { kind: "ruling", ideology: "neutral" }),
    mtthDays: 150,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 4 },
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "c",
        ai: { base: 25 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by rou_crush_the_legion.
    id: "rou_ev_codreanu_trial",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "rou_codreanu_jailed" },
          { kind: "bop", amount: -150 },
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The Legion's revenge on the man who broke it.
    id: "rou_ev_minister_killed",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      flag("rou_codreanu_jailed"),
      { kind: "pop_ge", ideology: "fascist", pct: 8 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 365,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Poland falls; its government and gold reach the Romanian border.
    id: "rou_ev_polish_passage",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      exists("POL"),
      { kind: "at_war", who: T("POL") },
      { kind: "lost_vp_ge", who: T("POL"), pct: 50 },
      not({ kind: "at_war" }),
    ),
    mtthDays: 10,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("POL"), of: "self", value: -10, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
          mods: [{ if: flag("rou_bridgehead_plan"), factor: 200 }],
        },
        effects: [
          { kind: "opinion", who: T("FRA"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("POL"), of: "self", value: 25, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // Ploiești sells to both camps; both look at it on the map.
    id: "rou_ev_ploiesti_target",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      flag("rou_oil_deu"),
      any(flag("rou_oil_gbr"), flag("rou_oil_fra")),
    ),
    mtthDays: 90,
    picture: "factory",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        available: { kind: "pp_ge", amount: 30 },
        effects: [
          { kind: "pp", amount: -30 },
          {
            kind: "build",
            where: { group: "ploiesti" },
            building: "anti_air",
            count: 2,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "clear_flag", flag: "rou_oil_gbr" },
          { kind: "clear_flag", flag: "rou_oil_fra" },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
  {
    // Agents of a warring power plan to wreck the wells.
    id: "rou_ev_oil_saboteurs",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      flag("rou_oil_deu"),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war" }),
    ),
    mtthDays: 200,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "fuel", amount: -20000 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by rou_german_military_mission.
    id: "rou_ev_german_mission",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "rou_sp_german_instructors", days: 365 },
          { kind: "army_xp", amount: 15 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "army_xp", amount: 8 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The Vrancea earthquake shakes Moldavia and Bucharest.
    id: "rou_ev_earthquake",
    kind: "country",
    receivers: ["ROU"],
    trigger: after("1940-09-01"),
    mtthDays: 90,
    once: "game",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "pp_ge", amount: 40 },
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: -40 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    // The balance tips: the Legion takes the street.
    id: "rou_ev_legion_rising",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      { kind: "bop_range", tag: "ROU", band: 4 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 120,
    once: "never",
    cooldownDays: 365,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "bop", amount: -300 },
          { kind: "popularity", ideology: "fascist", pp: -6 },
          { kind: "stability", pct: -5 },
          { kind: "war_support", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
          mods: [
            {
              if: { kind: "pop_ge", ideology: "fascist", pct: 30 },
              factor: 300,
            },
          ],
        },
        effects: [{ kind: "civil_war", ideology: "fascist" }],
      },
    ],
  },
  {
    // After the Soviet ultimatum: who answers for the lost provinces?
    id: "rou_ev_bessarabia_grief",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      gflag("bessarabia_lost"),
      not({ kind: "owns_group", group: "bessarabia" }),
    ),
    mtthDays: 15,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: 150 },
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // After the Vienna award: the refugees from Cluj and Oradea.
    id: "rou_ev_transylvania_refugees",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      gflag("vienna_award_2_done"),
      not({ kind: "owns_group", group: "north_transylvania" }),
    ),
    mtthDays: 20,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: -30 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "manpower", recruitablePct: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: -20 },
          { kind: "research_bonus", branch: "industry", pct: 30, uses: 1 },
        ],
      },
    ],
  },
  {
    // The railway shops strike again.
    id: "rou_ev_railway_strike",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      { kind: "pop_ge", ideology: "communist", pct: 12 },
      not({ kind: "ruling", ideology: "communist" }),
      not({ kind: "at_war" }),
    ),
    mtthDays: 365,
    once: "never",
    cooldownDays: 720,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "communist", pp: -2 },
        ],
      },
      {
        id: "b",
        available: { kind: "pp_ge", amount: 30 },
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: -30 },
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "communist", pp: -1 },
        ],
      },
    ],
  },
  {
    // The peasants' debts from the slump years.
    id: "rou_ev_peasant_debts",
    kind: "country",
    receivers: ["ROU"],
    trigger: not({ kind: "at_war" }),
    mtthDays: 240,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "pp_ge", amount: 40 },
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: -40 },
          { kind: "stability", pct: 4 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
    ],
  },
  {
    // The king's companion and the court favourites in the papers.
    id: "rou_ev_court_scandal",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "has_spirit", id: "rou_sp_camarilla" },
    ),
    mtthDays: 400,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "bop", amount: 50 },
        ],
      },
      {
        id: "b",
        available: { kind: "pp_ge", amount: 50 },
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: -50 },
          { kind: "remove_spirit", id: "rou_sp_camarilla" },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // The Little Entente's chiefs of staff meet.
    id: "rou_ev_entente_summit",
    kind: "country",
    receivers: ["ROU"],
    trigger: all(flag("rou_entente_staff"), exists("CSK"), exists("YUG")),
    mtthDays: 200,
    picture: "table",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", of: T("CSK"), value: 15, days: 365 },
          { kind: "opinion", who: T("CSK"), of: "self", value: 15, days: 365 },
          { kind: "opinion", of: T("YUG"), value: 15, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 15, days: 365 },
          { kind: "army_xp", amount: 5 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [{ kind: "stability", pct: 1 }],
      },
    ],
  },
  {
    // Fired by rou_cairo_talks: the envoys hear the Allied terms.
    id: "rou_ev_cairo",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_flag", flag: "rou_armistice_ready" },
          { kind: "opinion", who: T("SUN"), of: "self", value: 15, days: 365 },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
];
