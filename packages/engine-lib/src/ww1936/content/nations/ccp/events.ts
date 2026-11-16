// ww229: the Chinese Communists' national events. Most wait on a situation
// (a focus, the war with Japan, the Nationalists' mood) rather than a date;
// the P6 pack's date events (ccp_long_march_end, ccp_new_fourth_clash) still
// fire beside them. self = the receiver, from = the sender of a fired one.
// Event numbers are not tripled. Data only.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, after, all, done, exists, not } from "../../helpers";

const WAR_JPN: Condition = { kind: "at_war_with", of: T("JPN") };
const TRUCE_CHN: Condition = all(exists("CHN"), {
  kind: "nap_with",
  of: T("CHN"),
});
const RULES_COM: Condition = { kind: "ruling", ideology: "communist" };

export const CCP_EVENTS: EventDef[] = [
  // ---- the first year ----
  {
    // Part of the joined armies crosses the Yellow River for the west.
    id: "ccp_ev_western_route",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(after("1936-09-01"), done("ccp_three_armies_meet")),
    mtthDays: 60,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_western_route_lost", days: 365 },
          { kind: "army_xp", amount: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // The Generalissimo, freed at Xi'an, has promised to stop the war.
    id: "ccp_ev_after_xian",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      after("1936-12-01"),
      TRUCE_CHN,
      not(done("ccp_second_united_front")),
      not(done("ccp_no_truce")),
    ),
    mtthDays: 20,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("CHN"), value: 20, days: 730 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "fort", where: "capital", amount: 1 },
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: T("CHN"), value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The Comintern's delegate flies in from Moscow.
    id: "ccp_ev_wang_ming_returns",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      after("1937-10-01"),
      RULES_COM,
      not(done("ccp_comintern_line")),
      { kind: "ruling", who: T("SUN"), ideology: "communist" },
    ),
    mtthDays: 60,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("SUN"), value: 15, days: 365 },
          { kind: "stability", pct: -2 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: T("SUN"), value: -10, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The plenum that settles who speaks for the party.
    id: "ccp_ev_plenum",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(after("1938-06-01"), done("ccp_mao_line"), RULES_COM),
    mtthDays: 90,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", of: T("SUN"), value: 10, days: 365 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
    ],
  },

  // ---- the war ----
  {
    // A Canadian surgeon reaches the front with a medical team.
    id: "ccp_ev_bethune",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(after("1938-01-01"), WAR_JPN),
    mtthDays: 120,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_bethune_teams", days: 720 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "research_bonus", branch: "support", pct: 30, uses: 1 },
        ],
      },
    ],
  },
  {
    // Nationalist and Communist units clash behind the Japanese lines.
    id: "ccp_ev_friction_behind_lines",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(after("1939-01-01"), WAR_JPN, TRUCE_CHN),
    mtthDays: 300,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "army_xp", amount: 5 },
          { kind: "opinion", of: T("CHN"), value: -20, days: 365 },
          { kind: "opinion", who: T("CHN"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", of: T("CHN"), value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Chongqing closes the roads into the Border Region.
    id: "ccp_ev_blockade",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      after("1939-06-01"),
      TRUCE_CHN,
      done("ccp_unity_and_struggle"),
    ),
    mtthDays: 200,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_blockade" },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_blockade", days: 365 },
          { kind: "opinion", of: T("CHN"), value: -15, days: 365 },
          { kind: "pp", amount: -25 },
        ],
      },
    ],
  },
  {
    // The occupier answers the offensive by burning the base villages.
    id: "ccp_ev_three_alls",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(done("ccp_hundred_regiments_offensive"), WAR_JPN),
    mtthDays: 120,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_three_alls", days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "ccp_sp_three_alls", days: 180 },
          { kind: "manpower", amount: -6000 },
          { kind: "army_xp", amount: 8 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // Ma Bufang's Muslim cavalry rides along the western border.
    id: "ccp_ev_ma_cavalry",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      exists("XBM"),
      { kind: "neighbor_of", of: T("XBM") },
      not({ kind: "at_war_with", of: T("XBM") }),
    ),
    mtthDays: 500,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "fort", where: { borderWith: T("XBM"), n: 1 }, amount: 1 },
          { kind: "army_xp", amount: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", of: T("XBM"), value: 15, days: 365 },
          { kind: "pp", amount: -15 },
        ],
      },
    ],
  },
  {
    // The Border Region's soldiers and cadres bring in their own harvest.
    id: "ccp_ev_first_harvest",
    kind: "country",
    receivers: ["CCP"],
    trigger: done("ccp_great_production"),
    mtthDays: 200,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "stability", pct: 3 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 300,
          },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The security campaign finds spies everywhere; most of them are not.
    id: "ccp_ev_rescue_excess",
    kind: "country",
    receivers: ["CCP"],
    trigger: done("ccp_rescue_campaign"),
    mtthDays: 90,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "remove_spirit", id: "ccp_sp_rescue_fear" },
          { kind: "popularity", ideology: "communist", pp: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    // Fired by ccp_korean_volunteers.
    id: "ccp_ev_korean_volunteers",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "manpower", amount: 3000 },
          { kind: "army_xp", amount: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "intel_network", on: T("JPN"), pm: 60 },
          { kind: "resistance", group: "manchuria", pct: 5 },
        ],
      },
    ],
  },
  {
    // Fired by ccp_dixie_mission: American officers land at Yan'an.
    id: "ccp_ev_dixie_mission",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 730 },
          { kind: "research_bonus", branch: "electronics", pct: 25, uses: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 5, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // The Soviet armies roll into Manchuria: who reaches the arsenals first?
    id: "ccp_ev_soviets_in_manchuria",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(exists("SUN"), {
      kind: "occupied_by",
      group: "manchuria",
      of: T("SUN"),
    }),
    mtthDays: 20,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "unlock_decision", id: "ccp_dec_kwantung_arsenals" },
          { kind: "manpower", amount: 8000 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", of: T("SUN"), value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Japan is beaten; the Generalissimo invites the chairman to talk.
    id: "ccp_ev_chongqing_invitation",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      { kind: "capitulated", who: T("JPN") },
      exists("CHN"),
      not({ kind: "at_war_with", of: T("CHN") }),
    ),
    mtthDays: 30,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("CHN"), value: 20, days: 365 },
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_goal", on: T("CHN"), type: "conquer" },
          { kind: "war_support", pct: 4 },
        ],
      },
    ],
  },
  {
    // The truce after the talks breaks down over the north.
    id: "ccp_ev_truce_breaks",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(
      { kind: "capitulated", who: T("JPN") },
      TRUCE_CHN,
      RULES_COM,
      after("1946-01-01"),
    ),
    mtthDays: 150,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "break_nap", of: T("CHN") },
          { kind: "remove_spirit", id: "ccp_anti_japan_front" },
          { kind: "war_goal", on: T("CHN"), type: "conquer" },
          { kind: "war_support", pct: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", of: T("CHN"), value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by ccp_northwest_council: the generals and the party at one table.
    id: "ccp_ev_northwest_council",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "manpower", amount: 5000 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
    ],
  },
  {
    // Out of power, the party's cells still meet in the villages.
    id: "ccp_ev_party_underground",
    kind: "country",
    receivers: ["CCP"],
    trigger: all(not(RULES_COM), {
      kind: "pop_ge",
      ideology: "communist",
      pct: 20,
    }),
    mtthDays: 240,
    once: "never",
    cooldownDays: 365,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
];
