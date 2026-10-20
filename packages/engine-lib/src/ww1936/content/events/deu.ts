// World War 1936 P3 — the events Germany receives (spec §19.6 rows 9, 23,
// 31, 39, 46, 56, 60, 72 and the German side of the §17.5 chains), plus the
// Tripartite signing card that Italy and Japan receive from the German
// decision. Option `self` is the receiver, `from` the sender.
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, gflag, not, T } from "../helpers";

export const DEU_EVENTS: EventDef[] = [
  {
    id: "deu_olympics",
    kind: "country",
    date: { on: "1936-08-01", to: ["DEU"] },
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: 25 },
        ],
      },
    ],
  },
  {
    // The Blomberg–Fritsch crisis; only while the 1936 regime still rules.
    id: "deu_army_command",
    kind: "country",
    date: { on: "1938-02-04", to: ["DEU"] },
    trigger: { kind: "ruling", ideology: "fascist" },
    timeoutSec: 30,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "remove_advisor", person: "deu_blomberg" },
          { kind: "remove_advisor", person: "deu_fritsch" },
          { kind: "add_advisor_candidate", person: "deu_brauchitsch" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "popularity", ideology: "neutral", pp: 5 },
        ],
      },
    ],
  },
  {
    // Sent by Hungary's hun_request_arbitration (K5). The ceding country runs
    // the transfer: csk_vienna_award_notice (K5).
    id: "deu_vienna_award_1",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "fire_event", id: "csk_vienna_award_notice", to: T("CSK") },
          { kind: "opinion", of: "from", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "opinion", of: "from", value: -20, days: 365 }],
      },
    ],
  },
  {
    // History beat 1939-04-28 (K5) after Poland refuses pol_danzig_demand.
    id: "deu_renounce_polish_pact",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "break_nap", of: T("POL") }],
      },
    ],
  },
  {
    id: "deu_poland",
    kind: "news",
    receivers: ["DEU"],
    trigger: { kind: "at_war_with", of: T("POL") },
    picture: "column",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    // Sent by Hungary's hun_request_transylvania (K5); Romania runs the
    // transfer in rou_vienna_award_notice (K5).
    id: "deu_vienna_award_2",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "fire_event", id: "rou_vienna_award_notice", to: T("ROU") },
          { kind: "opinion", of: "from", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "opinion", of: "from", value: -20, days: 365 }],
      },
    ],
  },
  {
    // Received by Italy and Japan from the German deu_sign_tripartite (K5).
    id: "deu_tripartite_signing",
    kind: "country",
    timeoutSec: 30,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          {
            kind: "if",
            cond: not(gflag("tripartite")),
            then: [{ kind: "news", id: "deu_news_tripartite" }],
          },
          { kind: "set_gflag", flag: "tripartite" },
          {
            kind: "if",
            cond: { kind: "tag", tag: "JPN" },
            then: [{ kind: "popularity", ideology: "fascist", pp: 10 }],
          },
          { kind: "opinion", of: "from", value: 30, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "opinion", of: "from", value: -30, days: 365 }],
      },
    ],
  },
  {
    id: "deu_july_plot",
    kind: "country",
    receivers: ["DEU"],
    trigger: all(
      { kind: "at_war_with", of: T("SUN") },
      { kind: "ruling", ideology: "fascist" },
      after("1944-07-20"),
    ),
    historyPct: 95,
    timeoutSec: 30,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [{ kind: "stability", pct: -5 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "set_government", ideology: "neutral" },
          { kind: "set_leader", person: "deu_beck" },
          { kind: "stability", pct: -30 },
          { kind: "war_support", pct: -30 },
          { kind: "leave_faction" },
          { kind: "news", id: "deu_news_july_plot" },
        ],
      },
    ],
  },

  // ---- inside the chains (spec §17.5) ----
  {
    // France mobilized in fra_rhineland_response (K5); self = Germany.
    id: "deu_rhineland_bluff",
    kind: "country",
    timeoutSec: 30,
    picture: "border",
    options: [
      {
        id: "a",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: -100 },
          { kind: "stability", pct: -10 },
          { kind: "add_spirit", id: "deu_rhineland_dmz" },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 70 },
        effects: [
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "rhineland",
          },
        ],
      },
    ],
  },
  {
    // Austria refused aut_berlin_ultimatum (K5); from = Austria.
    id: "deu_austria_refused",
    kind: "country",
    historyPct: 80,
    timeoutSec: 30,
    humanDefault: "b",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "war_goal", on: "from", type: "conquer" },
          { kind: "declare_war", on: "from", goal: "conquer" },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: -50 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // From gen_munich_conference (the guarantor stood by Czechoslovakia) or
    // csk_munich_dictate (Czechoslovakia fights alone), both K5.
    id: "deu_sudeten_refused",
    kind: "country",
    historyPct: 30,
    timeoutSec: 30,
    humanDefault: "b",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 30 },
        effects: [
          {
            kind: "war_goal",
            on: T("CSK"),
            type: "claim",
            group: "sudetenland",
          },
          { kind: "declare_war", on: T("CSK"), goal: "claim" },
        ],
      },
      {
        id: "b",
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: -75 },
          { kind: "stability", pct: -10 },
        ],
      },
    ],
  },
  {
    // From the focus deu_september_plan.
    id: "deu_september_coup",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          {
            kind: "random_list",
            options: [
              {
                weight: 70,
                effects: [
                  { kind: "set_government", ideology: "neutral" },
                  { kind: "set_leader", person: "deu_beck" },
                  { kind: "news", id: "deu_news_coup" },
                ],
              },
              {
                weight: 30,
                effects: [
                  { kind: "stability", pct: -15 },
                  { kind: "set_flag", flag: "coup_failed" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // The Soviet Union proposed first (sun_propose_pact, K5); from = SUN.
    id: "deu_mr_pact_offer",
    kind: "country",
    timeoutSec: 30,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "nap", of: "from" },
          { kind: "set_gflag", flag: "mr_secret_protocol" },
          { kind: "tension", pct: 3 },
          { kind: "news", id: "news_mr_pact" },
          { kind: "opinion", of: "from", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "opinion", of: "from", value: -20, days: 365 }],
      },
    ],
  },
];
