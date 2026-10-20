// World War 1936 P3 — events Britain and the Dominions receive (spec §19.6
// rows 1, 14, 16, 24, 33, 45, 47, 48, 53, 68, 76) and the events the
// British focuses fire. The AI timing of gbr_chamberlain and gbr_churchill
// is a history beat (K5); their triggers fire them for a human Britain, or
// with historical AI off, on or after the historical day. Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, after, all, any, flag, not } from "../helpers";

export const GBR_EVENTS: EventDef[] = [
  // 1936-01-20: George V dies, Edward VIII succeeds.
  {
    id: "gbr_new_king",
    kind: "country",
    date: { on: "1936-01-20", to: ["GBR"] },
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "set_flag", flag: "edward_viii" },
        ],
      },
    ],
  },
  // 1936-12-11: the abdication crisis.
  {
    id: "gbr_abdication",
    kind: "country",
    date: { on: "1936-12-11", to: ["GBR"] },
    trigger: flag("edward_viii"),
    timeoutSec: 30,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "clear_flag", flag: "edward_viii" },
          { kind: "fire_event", id: "gbr_abdication_settled", days: 30 },
          { kind: "news", id: "news_gbr_abdication" },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [
          { kind: "set_leader", person: "gbr_churchill" },
          { kind: "add_spirit", id: "gbr_kings_party", days: 365 },
          { kind: "set_flag", flag: "kings_party" },
        ],
      },
    ],
  },
  // 30 days after the abdication: the world flag the crown focus needs.
  {
    id: "gbr_abdication_settled",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "set_gflag", flag: "abdication_resolved" }],
      },
    ],
  },
  // 1937-05-28: Baldwin retires (beat for the AI).
  {
    id: "gbr_chamberlain",
    kind: "country",
    receivers: ["GBR"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      after("1937-05-28"),
      { kind: "leader", person: "leader_gbr" },
    ),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "set_leader", person: "gbr_chamberlain" }],
      },
    ],
  },
  // 1938-02-20: Eden resigns over the talks with Italy.
  {
    id: "gbr_eden_resigns",
    kind: "country",
    date: { on: "1938-02-20", to: ["GBR"] },
    trigger: { kind: "leader", person: "gbr_chamberlain" },
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_advisor", person: "gbr_eden" },
          { kind: "add_advisor_candidate", person: "gbr_halifax" },
        ],
      },
    ],
  },
  // 1940-12-22: Halifax goes to Washington, Eden returns.
  {
    id: "gbr_eden_returns",
    kind: "country",
    date: { on: "1940-12-22", to: ["GBR"] },
    trigger: { kind: "ruling", ideology: "democratic" },
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "add_advisor_candidate", person: "gbr_eden" }],
      },
    ],
  },
  // 1939-03-15: fired by Czechoslovakia's Prague ultimatum (K5).
  {
    id: "gbr_prague_shock",
    kind: "country",
    timeoutSec: 30,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          {
            kind: "swap_spirit",
            from: "gbr_peace_mood",
            to: "gbr_no_more_concessions",
          },
          { kind: "remove_spirit", id: "gbr_peace_policy" },
          { kind: "clear_flag", flag: "gbr_appeasing" },
        ],
      },
    ],
  },
  // Fired by the Soviet Union when it refuses the German pact (K4,
  // sun_mr_pact_offer). from = the Soviet Union.
  {
    id: "gbr_soviet_alliance_offer",
    kind: "country",
    timeoutSec: 30,
    picture: "table",
    options: [
      {
        id: "a",
        ai: {
          base: 40,
          mods: [
            {
              if: { kind: "has_spirit", id: "gbr_no_more_concessions" },
              factor: 200,
            },
          ],
        },
        effects: [
          { kind: "nap", of: "from" },
          { kind: "opinion", of: "from", value: 30, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: 30, days: 365 },
          { kind: "invite", of: "from" },
        ],
      },
      {
        id: "b",
        ai: {
          base: 60,
          mods: [
            { if: { kind: "has_spirit", id: "gbr_peace_policy" }, factor: 150 },
          ],
        },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  // Received by the Soviet Union, fired by gbr_collective_security and
  // gbr_soviet_agreement (either may come after a refusal, so it repeats).
  // self = the Soviet Union, from = Britain.
  {
    id: "gbr_soviet_overture",
    kind: "country",
    once: "never",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 50,
          mods: [{ if: { kind: "at_war_with", of: T("DEU") }, factor: 300 }],
        },
        effects: [
          { kind: "nap", of: "from" },
          {
            kind: "if",
            cond: { kind: "at_war_with", of: T("DEU") },
            then: [
              { kind: "access", of: "from" },
              { kind: "access", who: "from", of: "self" },
            ],
          },
          { kind: "opinion", of: "from", value: 30, days: 365 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 50,
          mods: [{ if: { kind: "nap_with", of: T("DEU") }, factor: 300 }],
        },
        effects: [{ kind: "opinion", of: "from", value: -10, days: 180 }],
      },
    ],
  },
  // 1940-05-10: Chamberlain falls (beat for the AI).
  {
    id: "gbr_churchill",
    kind: "country",
    receivers: ["GBR"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      after("1940-05-10"),
      { kind: "at_war_with", of: T("DEU") },
      { kind: "leader", person: "gbr_chamberlain" },
    ),
    timeoutSec: 30,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "set_leader", person: "gbr_churchill" },
          { kind: "war_support", pct: 10 },
          {
            kind: "if",
            cond: not({ kind: "has_spirit", id: "gbr_war_coalition" }),
            then: [{ kind: "add_spirit", id: "gbr_war_coalition" }],
          },
          { kind: "news", id: "news_gbr_churchill" },
        ],
      },
    ],
  },
  // 1941-07-12: the Anglo-Soviet Agreement, signed in Moscow.
  {
    id: "gbr_anglo_soviet_agreement",
    kind: "country",
    date: { on: "1941-07-12", to: ["GBR"] },
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
      not({ kind: "nap_with", of: T("SUN") }),
    ),
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "nap", of: T("SUN") },
          { kind: "access", of: T("SUN") },
          { kind: "access", who: T("SUN"), of: "self" },
          { kind: "opinion", of: T("SUN"), value: 40, days: 730 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 40, days: 730 },
          { kind: "news", id: "news_gbr_anglo_soviet" },
        ],
      },
    ],
  },
  // 1945-07-26: the first general election in ten years (also an engine
  // election event, plan Task 1 Step 15 ENGINE_EVENTS).
  {
    id: "gbr_election_1945",
    kind: "country",
    date: { on: "1945-07-26", to: ["GBR"] },
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      any(not({ kind: "at_war_with", of: T("DEU") }), {
        kind: "capitulated",
        who: T("DEU"),
      }),
    ),
    timeoutSec: 30,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_leader", person: "gbr_attlee" },
          { kind: "remove_spirit", id: "gbr_war_coalition" },
          { kind: "elections", suspend: false },
          { kind: "clear_flag", flag: "elections_suspended" },
          { kind: "news", id: "news_gbr_election_1945" },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "remove_spirit", id: "gbr_war_coalition" },
          { kind: "elections", suspend: false },
          { kind: "clear_flag", flag: "elections_suspended" },
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  // Fired by gbr_labour_partnership.
  {
    id: "gbr_attlee_government",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 10 },
        effects: [{ kind: "set_leader", person: "gbr_attlee" }],
      },
    ],
  },
  // 1939-09-04: South Africa's parliament votes; Smuts declares war on
  // 09-06 (the AI's two-day delay).
  {
    id: "zaf_parliament_vote",
    kind: "country",
    date: { on: "1939-09-04", to: ["ZAF"] },
    trigger: all(
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    timeoutSec: 30,
    aiDelayDays: [2, 2],
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "join_war", of: T("DEU") },
          { kind: "set_leader", person: "zaf_smuts" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "war_support", pct: -10 }],
      },
    ],
  },
  // 1939-09-10: Canada declares war in its own name.
  {
    id: "can_parliament_decides",
    kind: "country",
    date: { on: "1939-09-10", to: ["CAN"] },
    trigger: all(
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "join_war", of: T("DEU") }],
      },
    ],
  },
];
