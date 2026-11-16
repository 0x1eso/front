// ww229: Mexico's events. Triggered ones check the situation, never a day;
// the rest are fired by the tree (self = the receiver, from = Mexico when
// another country receives one). Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, flag, not, T } from "../../helpers";

export const MEX_EVENTS: EventDef[] = [
  // ---- the Maximato ends ----
  {
    // Fired by mex_exile_calles.
    id: "mex_ev_calles_exiled",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "remove_spirit", id: "mex_sp_revolutionary_generals" },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "fascist", pp: 1 },
        ],
      },
    ],
  },
  {
    // The Gold Shirts fight the workers' columns in the capital's square.
    id: "mex_ev_gold_shirts",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      not(flag("mex_calles_truce")),
    ),
    mtthDays: 300,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -3 },
          { kind: "stability", pct: -1 },
          { kind: "set_flag", flag: "mex_gold_shirts_banned" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "popularity", ideology: "communist", pp: 1 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by mex_socialist_education: the teachers in the villages.
    id: "mex_ev_cristero_embers",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "mex_sp_cristero_embers", days: 365 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "remove_spirit", id: "mex_sp_socialist_school" },
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "fascist", pp: -1 },
        ],
      },
    ],
  },
  // ---- the exile in Coyoacán ----
  {
    // The painter asks the president to take in the exiled revolutionary.
    id: "mex_ev_trotsky_asylum",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(after("1936-10-01"), { kind: "ruling", ideology: "neutral" }),
    mtthDays: 150,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "mex_trotsky_here" },
          { kind: "opinion", who: T("SUN"), of: "self", value: -20, days: 730 },
          { kind: "popularity", ideology: "communist", pp: -1 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The exile's house is attacked; the second assassin succeeds.
    id: "mex_ev_coyoacan",
    kind: "country",
    receivers: ["MEX"],
    trigger: flag("mex_trotsky_here"),
    mtthDays: 900,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("SUN"), value: -20, days: 365 },
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -1 },
          { kind: "clear_flag", flag: "mex_trotsky_here" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "clear_flag", flag: "mex_trotsky_here" },
        ],
      },
    ],
  },
  // ---- the oil ----
  {
    // Fired by mex_labour_award: the companies refuse the arbitration award.
    id: "mex_ev_companies_refuse",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "set_flag", flag: "mex_decree_ready" },
          { kind: "war_support", pct: 2 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // To Britain, fired by mex_expropriation: El Águila was Shell's.
    id: "mex_ev_oil_gbr",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: "from", value: -30, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 730 },
          { kind: "set_flag", who: "from", flag: "mex_gbr_broke" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "pp", amount: 10 },
        ],
      },
    ],
  },
  {
    // To the United States, fired by mex_expropriation: the Good Neighbour
    // tested by Standard Oil's lobby.
    id: "mex_ev_oil_usa",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", of: "from", value: -30, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: -25, days: 730 },
          { kind: "war_support", who: "from", pct: 3 },
        ],
      },
    ],
  },
  {
    // No tankers, no spare parts, no buyers in London or New York.
    id: "mex_ev_tankers_idle",
    kind: "country",
    receivers: ["MEX"],
    trigger: { kind: "has_spirit", id: "mex_sp_oil_boycotted" },
    mtthDays: 90,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "unlock_decision", id: "mex_barter_oil_deu" },
          { kind: "unlock_decision", id: "mex_barter_oil_ita" },
          { kind: "unlock_decision", id: "mex_barter_oil_jpn" },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: 2 },
          { kind: "fuel", amount: 5000 },
        ],
      },
    ],
  },
  {
    // Washington notices the oil going to the Axis.
    id: "mex_ev_washington_frowns",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(
      any(flag("mex_oil_deu"), flag("mex_oil_ita"), flag("mex_oil_jpn")),
      not(flag("mex_oil_settled")),
      exists("USA"),
    ),
    mtthDays: 120,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "lock_decision", id: "mex_barter_oil_deu" },
          { kind: "lock_decision", id: "mex_barter_oil_ita" },
          { kind: "lock_decision", id: "mex_barter_oil_jpn" },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    // To the United States, fired by mex_oil_settlement: compensation in
    // instalments, set by a mixed commission.
    id: "mex_ev_oil_settlement",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
          mods: [{ if: { kind: "at_war" }, factor: 200 }],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "mex_oil_settled" },
          { kind: "opinion", of: "from", value: 20, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 730 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "pp", who: "from", amount: 20 },
        ],
      },
    ],
  },
  // ---- the caudillo of San Luis Potosí ----
  {
    // The last general's revolt: Cedillo's agrarian colonists take up arms.
    id: "mex_ev_cedillo_revolt",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(
      { kind: "focus_done", id: "mex_expropriation" },
      { kind: "ruling", ideology: "neutral" },
    ),
    mtthDays: 150,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "army_xp", amount: 5 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "remove_spirit", id: "mex_sp_revolutionary_generals" },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "neutral", pp: -2 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
    ],
  },
  // ---- the world's exiles ----
  {
    // Fired by mex_refuge_for_exiles: the refugee ships reach Veracruz.
    id: "mex_ev_sinaia",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "add_spirit", id: "mex_sp_refuge" },
          { kind: "popularity", ideology: "communist", pp: 1 },
          { kind: "popularity", ideology: "fascist", pp: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "research_bonus", branch: "industry", pct: 30, uses: 1 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  // ---- the succession ----
  {
    // The 1940 vote: the party's machine against Almazán's crowds.
    id: "mex_ev_disputed_election",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(
      after("1940-01-01"),
      { kind: "ruling", ideology: "neutral" },
      { kind: "focus_done", id: "mex_the_succession" },
    ),
    mtthDays: 150,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 7 },
          { kind: "popularity", ideology: "neutral", pp: -4 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  // ---- the war ----
  {
    // A Mexican tanker is sunk in the Gulf by a German submarine.
    id: "mex_ev_potrero_del_llano",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(
      exists("USA"),
      exists("DEU"),
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
      not({ kind: "same_faction", of: T("DEU") }),
    ),
    mtthDays: 90,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
          mods: [{ if: { kind: "opinion_ge", of: T("USA"), value: 0 }, factor: 150 }],
        },
        effects: [
          { kind: "war_support", pct: 6 },
          // join_war: into the war against `of`.
          { kind: "join_war", of: T("DEU") },
          { kind: "unlock_decision", id: "lat_join_hemisphere" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: T("DEU"), value: -25, days: 365 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // Submarines off Baja California: the Pacific coast needs a command.
    id: "mex_ev_pacific_alarm",
    kind: "country",
    receivers: ["MEX"],
    trigger: all(exists("JPN"), { kind: "at_war_with", of: T("JPN") }),
    mtthDays: 60,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "fort", where: { regions: [815, 865, 819] }, amount: 1 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "access", of: T("USA") },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
        ],
      },
    ],
  },
  // ---- the lost north (ahistorical) ----
  {
    // To the United States, fired by mex_claim_the_lost_north.
    id: "mex_ev_north_claim",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "opinion", of: "from", value: -40, days: 730 },
          { kind: "war_goal", on: "from", type: "topple" },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 40 },
        effects: [
          { kind: "opinion", of: "from", value: -15, days: 365 },
          { kind: "pp", amount: 10 },
        ],
      },
    ],
  },
  // ---- the isthmus (ahistorical) ----
  {
    // To a Central American republic, fired by mex_isthmus_union_offer.
    id: "mex_ev_isthmus_offer",
    kind: "country",
    once: "never",
    picture: "map",
    options: [
      {
        id: "a",
        ai: {
          base: 5,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 50 }, factor: 400 },
            { if: { kind: "at_war" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_gflag", flag: "mex_isthmus_union_formed" },
          {
            kind: "annex",
            who: "from",
            target: "self",
            units: "transfer",
            core: true,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 95 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
];
