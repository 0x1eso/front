// World War 1936 P3 (spec §12, §17.5, §19.6): the history events that
// Germany, the United Kingdom and the Soviet Union do not receive, and the
// other side of every annexation chain (content lane K5).
//
// Who is who inside an event: self = the receiver, from = the sender (the
// decider or the event that fired it), so "the demanding country gains a war
// goal" is written as { who: "from", on: "self" }. Effects that can make the
// receiver vanish (annex, the last transfer_regions) come last, after the news,
// flags and tension of that option.
import { after, all, any, exists, fire, flag, gflag, not, T } from "../helpers";
import type { Condition, EventDef, OptionDef } from "../types";

/** Spec §5.4, the election mechanism: who holds a majority. */
const DEM_HOLDS: Condition = {
  kind: "pop_ge",
  ideology: "democratic",
  pct: 50,
};
const OTHER_WINS: Condition = any(
  { kind: "pop_ge", ideology: "communist", pct: 51 },
  { kind: "pop_ge", ideology: "fascist", pct: 51 },
  { kind: "pop_ge", ideology: "neutral", pct: 51 },
);
/** Options b-d of a United States election (a is the historical result). */
const US_ELECTION_OTHER: OptionDef[] = [
  {
    id: "b",
    available: all(not(DEM_HOLDS), OTHER_WINS),
    ai: { base: 70 },
    effects: [{ kind: "set_government", ideology: "largest_other" }],
  },
  {
    id: "c",
    available: all(not(DEM_HOLDS), OTHER_WINS),
    ai: { base: 30 },
    effects: [
      { kind: "stability", pct: -15 },
      { kind: "popularity", ideology: "democratic", pp: 5 },
      { kind: "elections", postponeDays: 365 },
    ],
  },
  {
    id: "d",
    available: all(not(DEM_HOLDS), not(OTHER_WINS)),
    ai: { base: 10 },
    effects: [{ kind: "stability", pct: -5 }],
  },
];
/** No war with anyone: annex is skipped otherwise (spec §17.2). */
const AT_PEACE: Condition = not({ kind: "at_war" });

export const WORLD_EVENTS: EventDef[] = [
  // ---- 1936 ----
  {
    id: "esr_popular_front",
    kind: "country",
    picture: "crowd",
    date: { on: "1936-02-16", to: ["ESR"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 5 },
          { kind: "war_support", who: T("ESN"), pct: 5 },
        ],
      },
    ],
  },
  {
    // Japanese leaders after this day are shown by title only.
    id: "jpn_february_incident",
    kind: "country",
    picture: "column",
    date: { on: "1936-02-26", to: ["JPN"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: -10 },
          { kind: "popularity", ideology: "fascist", pp: 5 },
          { kind: "set_leader", person: "title:jpn_prime_minister" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 15 },
          { kind: "stability", pct: -20 },
          { kind: "set_leader", person: "title:jpn_prime_minister" },
        ],
      },
    ],
  },
  {
    // Fired by the German focus deu_rhineland (from = Germany).
    id: "fra_rhineland_response",
    kind: "country",
    picture: "border",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: 10 },
          { kind: "pp", amount: -50 },
          fire("deu_rhineland_bluff", "from"),
        ],
      },
    ],
  },
  {
    // The engine fires it on France's first election day (1936-04-26) in
    // place of gen_election (spec §5.4: <tag>_election_<year>).
    id: "fra_election_1936",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_leader", person: "fra_blum" },
          { kind: "popularity", ideology: "communist", pp: 5 },
          { kind: "add_spirit", id: "fra_forty_hours", days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 5 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    id: "ita_addis_ababa",
    kind: "country",
    picture: "map",
    receivers: ["ITA"],
    trigger: all(
      { kind: "at_war_with", of: T("ETH") },
      { kind: "controls_group", group: "addis_ababa" },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_addis_ababa" },
          { kind: "set_gflag", flag: "ethiopia_annexed" },
          { kind: "remove_spirit", id: "ita_abyssinia" },
          { kind: "tension", pct: 5 },
          { kind: "end_war", of: T("ETH") },
          { kind: "annex", target: T("ETH"), units: "disband", core: false },
        ],
      },
    ],
  },
  {
    id: "ita_sanctions_lifted",
    kind: "country",
    picture: "document",
    date: { on: "1936-07-15", to: ["ITA"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "remove_spirit", id: "ita_sanctions" }],
      },
    ],
  },
  {
    // The war itself is the P0 safety beat of 1936-07-17.
    id: "esp_civil_war",
    kind: "news",
    picture: "newspaper",
    receivers: ["ESN"],
    trigger: all(after("1936-07-01"), { kind: "at_war_with", of: T("ESR") }),
    once: "game",
    // Final balance (P5 Spain targets): the rising's recruits (the Army of
    // Africa's levies, the Carlist and Falangist militias). Without them
    // the Nationalists ran out of manpower by mid-1938 in most games.
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [{ kind: "manpower", amount: 100_000 }],
      },
    ],
  },
  {
    // Fired by the German focus deu_rome_berlin (from = Germany).
    id: "ita_rome_berlin_axis",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        // P5 (K1's ita_axis_course focus flag): Italy on the Axis course
        // accepts twice as readily.
        ai: {
          base: 70,
          mods: [
            { if: { kind: "flag", flag: "ita_axis_course" }, factor: 200 },
          ],
        },
        effects: [
          { kind: "add_spirit", id: "ita_axis_bond" },
          { kind: "add_spirit", who: "from", id: "ita_axis_bond" },
          { kind: "opinion", of: "from", value: 50, days: 3650 },
          { kind: "opinion", who: "from", of: "self", value: 50, days: 3650 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: "from", value: -20, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 730 },
        ],
      },
    ],
  },
  {
    // Engine election event (spec §5.4): same mechanism as gen_election.
    id: "usa_election_1936",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: DEM_HOLDS,
        ai: { base: 100 },
        effects: [{ kind: "stability", pct: 5 }],
      },
      ...US_ELECTION_OTHER,
    ],
  },
  {
    // Fired by the German focus deu_anti_comintern (from = Germany).
    id: "jpn_anti_comintern",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: "from", value: 40, days: 3650 },
          { kind: "opinion", who: "from", of: "self", value: 40, days: 3650 },
          { kind: "popularity", ideology: "communist", pp: -5 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_xian_incident",
    kind: "country",
    picture: "table",
    date: { on: "1936-12-12", to: ["CHN"] },
    trigger: exists("CCP"),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "nap", of: T("CCP") },
          { kind: "war_support", pct: 10 },
          { kind: "war_support", who: T("CCP"), pct: 10 },
        ],
      },
      {
        id: "b",
        available: not({ kind: "nap_with", of: T("CCP") }),
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "declare_war", on: T("CCP"), goal: "conquer" },
        ],
      },
    ],
  },
  // ---- 1937 ----
  {
    // The war itself is the P0 safety beat of 1937-07-07.
    id: "jpn_marco_polo_bridge",
    kind: "news",
    picture: "newspaper",
    receivers: ["JPN"],
    trigger: all(after("1937-07-01"), { kind: "at_war_with", of: T("CHN") }),
    once: "game",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    // Fired by the Soviet focus sun_china_treaty (from = Soviet Union).
    id: "chn_soviet_treaty",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "nap", of: T("SUN") },
          { kind: "opinion", of: T("SUN"), value: 30, days: 3650 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 30, days: 3650 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "usa_quarantine_speech",
    kind: "country",
    picture: "crowd",
    date: { on: "1937-10-05", to: ["USA"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "war_support", pct: 3 }],
      },
    ],
  },
  {
    // Spec §9.2: the 1937 downturn eases the starting depression spirit.
    id: "usa_recession_1937",
    kind: "country",
    picture: "factory",
    date: { on: "1937-10-19", to: ["USA"] },
    trigger: { kind: "has_spirit", id: "usa_depression" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          {
            kind: "swap_spirit",
            from: "usa_depression",
            to: "usa_depression_eased",
          },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "pp", amount: 25 },
        ],
      },
    ],
  },
  {
    id: "ita_anti_comintern",
    kind: "country",
    picture: "document",
    receivers: ["ITA"],
    trigger: all(
      after("1937-11-06"),
      { kind: "focus_done", who: T("DEU"), id: "deu_anti_comintern" },
      exists("JPN"),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("DEU"), value: 20, days: 3650 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 3650 },
          { kind: "opinion", of: T("JPN"), value: 20, days: 3650 },
          { kind: "opinion", who: T("JPN"), of: "self", value: 20, days: 3650 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "ita_leaves_league",
    kind: "country",
    picture: "document",
    date: { on: "1937-12-11", to: ["ITA"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "tension", pct: 1 },
          {
            kind: "opinion",
            who: T("GBR"),
            of: "self",
            value: -20,
            days: 1825,
          },
          {
            kind: "opinion",
            who: T("FRA"),
            of: "self",
            value: -20,
            days: 1825,
          },
        ],
      },
    ],
  },
  // ---- 1938 ----
  {
    // Spec §20.3. Fired by deu_demand_austria (from = Germany).
    id: "aut_berlin_ultimatum",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    historyPct: 95,
    humanDefault: "b",
    aiDelayDays: [1, 1],
    options: [
      {
        id: "a",
        history: true,
        available: AT_PEACE,
        ai: { base: 50 },
        effects: [
          { kind: "news", id: "news_anschluss" },
          { kind: "set_gflag", flag: "anschluss_done" },
          { kind: "tension", who: "from", pct: 6 },
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
        ai: { base: 50 },
        effects: [fire("deu_austria_refused", "from")],
      },
    ],
  },
  {
    id: "fra_daladier",
    kind: "country",
    picture: "table",
    date: { on: "1938-04-10", to: ["FRA"] },
    trigger: { kind: "ruling", ideology: "democratic" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "set_leader", person: "fra_daladier" },
          {
            kind: "if",
            cond: { kind: "has_spirit", id: "fra_divided" },
            then: [
              {
                kind: "swap_spirit",
                from: "fra_divided",
                to: "fra_divided_half",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // Fired by deu_demand_sudeten to the Allied leader, or to a major that
    // guarantees Czechoslovakia (from = Germany).
    id: "gen_munich_conference",
    kind: "country",
    picture: "table",
    once: "game",
    timeoutSec: 30,
    historyPct: 95,
    aiDelayDays: [14, 14],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 40, mods: [{ if: flag("gbr_appeasing"), factor: 300 }] },
        effects: [fire("csk_munich_dictate", T("CSK"))],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [
          { kind: "guarantee", of: T("CSK") },
          fire("deu_sudeten_refused", "from"),
        ],
      },
    ],
  },
  {
    // From the conference host, or straight from Germany when nobody hosts.
    id: "csk_munich_dictate",
    kind: "country",
    picture: "map",
    once: "game",
    timeoutSec: 30,
    historyPct: 90,
    aiDelayDays: [1, 1],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_munich" },
          { kind: "set_gflag", flag: "munich_done" },
          { kind: "set_gflag", flag: "sudeten_transferred" },
          { kind: "tension", who: T("DEU"), pct: 8 },
          {
            kind: "transfer_regions",
            group: "sudetenland",
            to: T("DEU"),
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 10 },
          fire("deu_sudeten_refused", T("DEU")),
        ],
      },
    ],
  },
  {
    // Fired by pol_zaolzie_ultimatum (from = Poland).
    id: "csk_zaolzie_ultimatum",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    aiDelayDays: [2, 2],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_gflag", flag: "zaolzie_done" },
          { kind: "tension", who: "from", pct: 1 },
          {
            kind: "transfer_regions",
            group: "zaolzie",
            to: "from",
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "zaolzie",
          },
        ],
      },
    ],
  },
  {
    // Fired by the German event deu_vienna_award_1 (from = Germany).
    id: "csk_vienna_award_notice",
    kind: "country",
    picture: "map",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vienna_award_1" },
          { kind: "set_gflag", flag: "vienna_award_1_done" },
          { kind: "tension", who: T("HUN"), pct: 1 },
          {
            kind: "transfer_regions",
            group: "south_slovakia",
            to: T("HUN"),
            core: true,
          },
        ],
      },
    ],
  },
  {
    id: "tur_ataturk_dies",
    kind: "country",
    picture: "crowd",
    date: { on: "1938-11-10", to: ["TUR"] },
    trigger: { kind: "leader", person: "leader_tur" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "set_leader", person: "tur_inonu" },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  // ---- 1939 ----
  {
    // Fired by deu_demand_bohemia (from = Germany). Accepting ends the
    // country: every remaining region changes hands, the last ones last.
    id: "csk_prague_ultimatum",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    historyPct: 90,
    humanDefault: "b",
    aiDelayDays: [1, 1],
    options: [
      {
        id: "a",
        history: true,
        available: AT_PEACE,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_prague" },
          { kind: "set_gflag", flag: "prague_done" },
          { kind: "tension", who: "from", pct: 10 },
          fire("gbr_prague_shock", T("GBR")),
          {
            kind: "if",
            cond: exists("HUN"),
            then: [
              {
                kind: "transfer_regions",
                group: "carpathian_ruthenia",
                to: T("HUN"),
                core: true,
              },
            ],
          },
          {
            kind: "transfer_regions",
            group: "carpathian_ruthenia",
            to: T("DEU"),
          },
          { kind: "transfer_regions", group: "south_slovakia", to: T("DEU") },
          {
            kind: "transfer_regions",
            group: "sudetenland",
            to: T("DEU"),
            core: true,
          },
          { kind: "transfer_regions", group: "slovakia", to: T("DEU") },
          { kind: "transfer_regions", group: "bohemia_moravia", to: T("DEU") },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 15 },
          { kind: "war_goal", who: "from", on: "self", type: "conquer" },
        ],
      },
    ],
  },
  {
    // Fired by deu_demand_memel (from = Germany).
    id: "ltu_memel_ultimatum",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    historyPct: 95,
    aiDelayDays: [2, 2],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_memel" },
          { kind: "set_gflag", flag: "memel_done" },
          { kind: "tension", who: "from", pct: 2 },
          { kind: "transfer_regions", group: "memel", to: "from", core: true },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 5 },
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "memel",
          },
        ],
      },
    ],
  },
  {
    // Fired by deu_demand_danzig (from = Germany). The refusal is history.
    id: "pol_danzig_demand",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    historyPct: 95,
    aiDelayDays: [5, 5],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 10 },
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "polish_corridor",
          },
        ],
      },
      {
        id: "b",
        available: all(exists("DZG"), not({ kind: "at_war", who: T("DZG") })),
        ai: { base: 30 },
        effects: [
          { kind: "news", id: "news_danzig" },
          { kind: "set_gflag", flag: "danzig_done" },
          { kind: "stability", pct: -15 },
          {
            kind: "annex",
            who: "from",
            target: T("DZG"),
            units: "transfer",
            core: true,
          },
        ],
      },
    ],
  },
  {
    // Fired by the German focus deu_polish_alignment (from = Germany).
    // An alternative path: no history option.
    id: "pol_danzig_bargain",
    kind: "country",
    picture: "table",
    once: "game",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        available: all(exists("DZG"), not({ kind: "at_war", who: T("DZG") })),
        ai: { base: 50 },
        effects: [
          { kind: "news", id: "news_danzig" },
          { kind: "set_gflag", flag: "danzig_done" },
          { kind: "stability", pct: -10 },
          { kind: "access", of: "from" },
          { kind: "opinion", of: "from", value: 30, days: 1825 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 1825 },
          {
            kind: "annex",
            who: "from",
            target: T("DZG"),
            units: "transfer",
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: "from", of: "self", value: -30, days: 730 },
        ],
      },
    ],
  },
  {
    // Fired by gbr_guarantee_poland and gbr_guarantee_romania_greece
    // (from = United Kingdom): France joins whichever guarantee was given.
    id: "fra_joins_guarantee",
    kind: "country",
    picture: "document",
    once: "never",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          {
            kind: "if",
            cond: all(
              {
                kind: "decision_taken",
                who: "from",
                id: "gbr_guarantee_poland",
              },
              not({ kind: "guarantees", of: T("POL") }),
            ),
            then: [{ kind: "guarantee", of: T("POL") }],
          },
          {
            kind: "if",
            cond: {
              kind: "decision_taken",
              who: "from",
              id: "gbr_guarantee_romania_greece",
            },
            then: [
              { kind: "guarantee", of: T("ROU") },
              { kind: "guarantee", of: T("GRC") },
            ],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The war itself is the P0 safety beat of 1939-04-07.
    id: "ita_albania",
    kind: "news",
    picture: "newspaper",
    receivers: ["ITA"],
    trigger: all(after("1939-04-01"), { kind: "at_war_with", of: T("ALB") }),
    once: "game",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    // Fired by the German focus deu_pact_of_steel and by the 1939-05-22 beat.
    id: "ita_pact_of_steel",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          exists("DEU"),
          not({ kind: "at_war_with", of: T("DEU") }),
        ),
        ai: { base: 70 },
        effects: [
          { kind: "set_gflag", flag: "pact_of_steel" },
          { kind: "opinion", of: T("DEU"), value: 30, days: 3650 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 30, days: 3650 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 730 },
        ],
      },
    ],
  },
  {
    // With the German diplomacy beat of the same day as a fallback.
    id: "dnk_german_treaty",
    kind: "country",
    picture: "document",
    date: { on: "1939-05-31", to: ["DNK"] },
    trigger: all(
      exists("DEU"),
      { kind: "is_ai", who: T("DEU") },
      not({ kind: "nap_with", of: T("DEU") }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [{ kind: "nap", of: T("DEU") }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by tur_hatay_question (from = Turkey).
    id: "fra_hatay_cession",
    kind: "country",
    picture: "map",
    once: "game",
    timeoutSec: 30,
    aiDelayDays: [6, 6],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_hatay" },
          { kind: "set_gflag", flag: "hatay_done" },
          { kind: "tension", who: "from", pct: 1 },
          { kind: "transfer_regions", group: "hatay", to: "from", core: true },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -30, days: 730 },
        ],
      },
    ],
  },
  {
    // Fired by sun_baltic_bases for each Baltic state (from = Soviet Union).
    // Lithuania also receives Vilnius when the Soviet Union holds it.
    id: "bal_mutual_assistance",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "access", of: "from" },
          {
            kind: "if",
            cond: { kind: "tag", tag: "LTU" },
            then: [
              {
                kind: "transfer_regions",
                who: "from",
                group: "vilnius",
                to: "self",
                core: true,
              },
            ],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: "from", of: "self", value: -30, days: 730 },
        ],
      },
    ],
  },
  {
    // Fired by sun_demand_karelia (from = Soviet Union). The refusal is history.
    id: "fin_soviet_demands",
    kind: "country",
    picture: "map",
    once: "game",
    timeoutSec: 30,
    historyPct: 95,
    aiDelayDays: [30, 30],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 10 },
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "karelian_isthmus",
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -10 },
          { kind: "transfer_regions", group: "karelian_isthmus", to: "from" },
        ],
      },
    ],
  },
  {
    // A world news line when the Winter War starts; marks the Soviet Union
    // (winter_war_fought) and opens its peace offer.
    id: "fin_winter_war_flag",
    kind: "news",
    picture: "column",
    receivers: ["FIN"],
    trigger: { kind: "at_war_with", of: T("SUN") },
    once: "game",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "set_flag", who: T("SUN"), flag: "winter_war_fought" },
          {
            kind: "unlock_decision",
            who: T("SUN"),
            id: "sun_offer_finnish_peace",
          },
        ],
      },
    ],
  },
  // ---- 1940 ----
  {
    // Fired by sun_offer_finnish_peace (from = Soviet Union).
    id: "fin_moscow_peace",
    kind: "country",
    picture: "table",
    once: "game",
    timeoutSec: 30,
    aiDelayDays: [4, 4],
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "at_war_with", of: "from" },
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_moscow_peace" },
          { kind: "set_gflag", flag: "moscow_peace_done" },
          { kind: "transfer_regions", group: "karelian_isthmus", to: "from" },
          { kind: "transfer_regions", group: "ladoga_karelia", to: "from" },
          { kind: "transfer_regions", group: "salla", to: "from" },
          { kind: "end_war", of: "from" },
        ],
      },
      { id: "b", ai: { base: 30 }, effects: [{ kind: "stability", pct: -5 }] },
    ],
  },
  {
    // Fired by sun_baltic_ultimatum for each Baltic state (from = Soviet Union).
    id: "bal_soviet_ultimatum",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    historyPct: 95,
    humanDefault: "b",
    aiDelayDays: [1, 1],
    options: [
      {
        id: "a",
        history: true,
        available: AT_PEACE,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_baltics" },
          { kind: "set_gflag", flag: "baltics_annexed" },
          { kind: "tension", who: "from", pct: 2 },
          {
            kind: "annex",
            who: "from",
            target: "self",
            units: "disband",
            core: false,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 10 },
          { kind: "war_goal", who: "from", on: "self", type: "conquer" },
        ],
      },
    ],
  },
  {
    // Fired by sun_demand_bessarabia (from = Soviet Union).
    id: "rou_bessarabia_ultimatum",
    kind: "country",
    picture: "document",
    once: "game",
    timeoutSec: 30,
    aiDelayDays: [2, 2],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_bessarabia" },
          { kind: "set_gflag", flag: "bessarabia_lost" },
          { kind: "tension", who: "from", pct: 2 },
          { kind: "transfer_regions", group: "bessarabia", to: "from" },
          { kind: "transfer_regions", group: "north_bukovina", to: "from" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 10 },
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "bessarabia",
          },
        ],
      },
    ],
  },
  {
    // Fired by the German event deu_vienna_award_2 (from = Germany).
    id: "rou_vienna_award_notice",
    kind: "country",
    picture: "map",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vienna_award_2" },
          { kind: "set_gflag", flag: "vienna_award_2_done" },
          { kind: "stability", pct: -5 },
          { kind: "tension", who: T("HUN"), pct: 1 },
          {
            kind: "transfer_regions",
            group: "north_transylvania",
            to: T("HUN"),
            core: true,
          },
        ],
      },
    ],
  },
  {
    // Fired by gbr_destroyers_for_bases (from = United Kingdom).
    id: "usa_destroyers_for_bases",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          {
            kind: "if",
            cond: { kind: "has_spirit", id: "usa_isolation" },
            then: [
              {
                kind: "swap_spirit",
                from: "usa_isolation",
                to: "usa_isolation_cracked",
              },
            ],
          },
          { kind: "ships", who: T("GBR"), cls: "dd", gen: 1, count: 50 },
          { kind: "opinion", of: T("GBR"), value: 30, days: 3650 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 3650 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The leader is shown by title only (spec §8.4; title:rou_conducator).
    id: "rou_antonescu",
    kind: "country",
    picture: "crowd",
    date: { on: "1940-09-06", to: ["ROU"] },
    trigger: any(
      gflag("bessarabia_lost"),
      not({ kind: "owns_group", group: "bessarabia" }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "set_government", ideology: "fascist" },
          { kind: "set_leader", person: "title:rou_conducator" },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // Fired by bgr_demand_dobruja (from = Bulgaria).
    id: "rou_dobruja",
    kind: "country",
    picture: "map",
    once: "game",
    timeoutSec: 30,
    aiDelayDays: [17, 17],
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_dobruja" },
          { kind: "set_gflag", flag: "dobruja_done" },
          { kind: "tension", who: "from", pct: 1 },
          {
            kind: "transfer_regions",
            group: "south_dobruja",
            to: "from",
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "south_dobruja",
          },
        ],
      },
    ],
  },
  {
    id: "jpn_imperial_rule_assistance",
    kind: "country",
    picture: "crowd",
    date: { on: "1940-10-12", to: ["JPN"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "set_government", ideology: "fascist" },
          { kind: "stability", pct: 5 },
        ],
      },
    ],
  },
  {
    // Engine election event (spec §5.4).
    id: "usa_election_1940",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: DEM_HOLDS,
        ai: { base: 100 },
        effects: [{ kind: "stability", pct: 3 }],
      },
      ...US_ELECTION_OTHER,
    ],
  },
  // ---- 1941 ----
  {
    id: "usa_lend_lease_act",
    kind: "country",
    picture: "document",
    date: { on: "1941-03-11", to: ["USA"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_spirit", id: "usa_isolation" },
          { kind: "remove_spirit", id: "usa_isolation_cracked" },
          { kind: "remove_spirit", id: "usa_depression" },
          { kind: "remove_spirit", id: "usa_depression_eased" },
          { kind: "set_flag", flag: "lend_lease" },
          { kind: "opinion", of: T("GBR"), value: 30, days: 3650 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 3650 },
        ],
      },
    ],
  },
  {
    // Fired by deu_invite_balkans for Yugoslavia and by the 1941-03-25 beat.
    id: "yug_tripartite",
    kind: "country",
    picture: "table",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        available: all(exists("DEU"), { kind: "in_faction", who: T("DEU") }),
        ai: { base: 70 },
        effects: [
          { kind: "join_faction", of: T("DEU") },
          fire("yug_belgrade_coup", "self", 2),
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -30, days: 730 },
        ],
      },
    ],
  },
  {
    id: "yug_belgrade_coup",
    kind: "country",
    picture: "crowd",
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "news", id: "news_belgrade_coup" },
          { kind: "leave_faction" },
          { kind: "set_leader", person: "yug_peter_ii" },
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -100,
            days: 3650,
          },
          { kind: "war_goal", who: T("DEU"), on: "self", type: "conquer" },
        ],
      },
      { id: "b", ai: { base: 40 }, effects: [{ kind: "stability", pct: -10 }] },
    ],
  },
  {
    // Fired by the Soviet focus sun_japan_neutrality (from = Soviet Union).
    id: "jpn_soviet_neutrality",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "nap", of: T("SUN") },
          { kind: "opinion", of: T("SUN"), value: 20, days: 1825 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 20, days: 1825 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "usa_atlantic_charter",
    kind: "country",
    picture: "table",
    date: { on: "1941-08-14", to: ["USA"] },
    trigger: exists("GBR"),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", of: T("GBR"), value: 20, days: 3650 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 3650 },
        ],
      },
    ],
  },
  {
    // When Japan goes to war with the United States, however it happens.
    id: "usa_pearl_harbor",
    kind: "country",
    picture: "column",
    receivers: ["USA"],
    trigger: { kind: "at_war_with", of: T("JPN") },
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_pearl_harbor" },
          { kind: "remove_spirit", id: "usa_isolation" },
          { kind: "remove_spirit", id: "usa_isolation_cracked" },
          { kind: "war_support", pct: 30 },
          fire("usa_united_nations", "self", 25),
        ],
      },
    ],
  },
  // ---- 1942-1945 ----
  {
    // From usa_pearl_harbor (25 days later) or the 1942-01-01 beat.
    id: "usa_united_nations",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "at_war" },
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_united_nations" },
          { kind: "join_faction", of: T("GBR") },
          {
            kind: "if",
            cond: all(exists("CHN"), { kind: "is_ai", who: T("CHN") }),
            then: [{ kind: "join_faction", who: T("CHN"), of: T("GBR") }],
          },
        ],
      },
      {
        id: "b",
        available: not({ kind: "at_war" }),
        ai: { base: 10 },
        effects: [],
      },
    ],
  },
  {
    // Engine election event (spec §5.4).
    id: "usa_election_1944",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: DEM_HOLDS,
        ai: { base: 100 },
        effects: [{ kind: "stability", pct: 3 }],
      },
      ...US_ELECTION_OTHER,
    ],
  },
  {
    id: "usa_roosevelt_dies",
    kind: "country",
    picture: "crowd",
    date: { on: "1945-04-12", to: ["USA"] },
    trigger: { kind: "leader", person: "leader_usa" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "set_leader", person: "usa_truman" }],
      },
    ],
  },
  // ---- Ends of starting spirits (spec §9.2) ----
  {
    id: "usa_isolation_strained",
    kind: "country",
    picture: "newspaper",
    receivers: ["USA"],
    trigger: all(
      { kind: "has_spirit", id: "usa_isolation" },
      { kind: "wt_ge", pct: 60 },
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          {
            kind: "swap_spirit",
            from: "usa_isolation",
            to: "usa_isolation_cracked",
          },
        ],
      },
    ],
  },
  {
    id: "usa_isolation_ends",
    kind: "country",
    picture: "newspaper",
    receivers: ["USA"],
    trigger: all(
      any(
        { kind: "has_spirit", id: "usa_isolation" },
        { kind: "has_spirit", id: "usa_isolation_cracked" },
      ),
      any(
        { kind: "wt_ge", pct: 90 },
        all({ kind: "at_war" }, not({ kind: "at_war_with", of: T("JPN") })),
      ),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_spirit", id: "usa_isolation" },
          { kind: "remove_spirit", id: "usa_isolation_cracked" },
          { kind: "war_support", pct: 10 },
        ],
      },
    ],
  },
  {
    id: "fra_wartime_unity",
    kind: "country",
    picture: "crowd",
    receivers: ["FRA"],
    trigger: all(
      any(
        { kind: "has_spirit", id: "fra_divided" },
        { kind: "has_spirit", id: "fra_divided_half" },
      ),
      { kind: "war_days_ge", days: 365 },
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_spirit", id: "fra_divided" },
          { kind: "remove_spirit", id: "fra_divided_half" },
        ],
      },
    ],
  },
  {
    id: "esp_civil_war_won",
    kind: "country",
    picture: "crowd",
    receivers: ["ESN", "ESR"],
    trigger: all(
      { kind: "has_spirit", id: "esp_civil_war_nation" },
      any(
        { kind: "capitulated", who: T("ESR") },
        not(exists("ESR")),
        { kind: "capitulated", who: T("ESN") },
        not(exists("ESN")),
      ),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_spirit", id: "esp_civil_war_nation" },
          { kind: "stability", pct: 5 },
        ],
      },
    ],
  },
];
