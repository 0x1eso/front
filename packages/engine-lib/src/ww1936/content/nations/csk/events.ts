// ww229 (design ww227 §5): Czechoslovakia's events. The Sudeten chain
// (Henlein's demands, the allies asked, the May mobilisation, the British
// mediator, the aftermath of the Munich dictate the base content holds in
// csk_munich_dictate), the Slovak demands, Škoda's foreign orders, the
// fortifications, the union offers of the Danube route and the war years.
// No event waits on an exact date: each waits on a condition and a mean
// time. self = Czechoslovakia unless the comment names the receiver.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  T,
  after,
  all,
  any,
  done,
  exists,
  flag,
  gflag,
  not,
} from "../../helpers";

export const CSK_EVENTS: EventDef[] = [
  // ---------------------------------------------------------------- Sudeten
  {
    // The Sudeten German Party's demands (the Karlsbad programme).
    id: "csk_henlein_demands",
    kind: "country",
    picture: "crowd",
    receivers: ["CSK"],
    trigger: all(
      done("csk_sudeten_question"),
      exists("DEU"),
      { kind: "ruling", who: T("DEU"), ideology: "fascist" },
      { kind: "owns_group", group: "sudetenland" },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 120,
    historyPct: 80,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "fascist", pp: -3 },
          { kind: "set_flag", flag: "csk_statute_offered" },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
      {
        id: "c",
        available: exists("FRA"),
        ai: { base: 25 },
        effects: [
          { kind: "fire_event", id: "csk_ally_request", to: T("FRA") },
          { kind: "pp", amount: -25 },
        ],
      },
    ],
  },
  {
    // Received by an ally Prague turns to (FRA, GBR or SUN); from = CSK.
    id: "csk_ally_request",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 30,
    aiDelayDays: [7, 14],
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: {
          base: 40,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 40 }, factor: 200 },
            { if: flag("gbr_appeasing"), factor: 30 },
            {
              if: { kind: "threat_ge", of: T("DEU"), pct: 50 },
              factor: 150,
            },
          ],
        },
        effects: [
          { kind: "guarantee", of: "from" },
          { kind: "opinion", of: "from", value: 15, days: 365 },
          { kind: "fire_event", id: "csk_ally_promise", to: "from" },
        ],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [{ kind: "fire_event", id: "csk_ally_refusal", to: "from" }],
      },
    ],
  },
  {
    // The ally's answer: a guarantee (from = the ally).
    id: "csk_ally_promise",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: 2 },
          { kind: "opinion", of: "from", value: 20, days: 365 },
        ],
      },
    ],
  },
  {
    // The ally's answer: words only (from = the ally).
    id: "csk_ally_refusal",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "war_support", pct: -3 },
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "opinion", of: "from", value: -15, days: 365 },
          { kind: "set_flag", flag: "csk_allies_refused" },
        ],
      },
    ],
  },
  {
    // The May crisis: rumours of German troops on the border.
    id: "csk_may_crisis",
    kind: "country",
    picture: "column",
    receivers: ["CSK"],
    trigger: all(
      exists("DEU"),
      { kind: "owns_group", group: "sudetenland" },
      not({ kind: "at_war" }),
      any(
        { kind: "justifying_on", who: T("DEU"), of: "self" },
        { kind: "has_war_goal_on", who: T("DEU"), of: "self" },
        { kind: "threat_ge", of: T("DEU"), pct: 60 },
      ),
    ),
    mtthDays: 30,
    historyPct: 80,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "csk_partial_mobilisation", days: 120 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // A British mediator comes to Prague (the Runciman mission).
    id: "csk_runciman_mission",
    kind: "country",
    picture: "table",
    receivers: ["CSK"],
    trigger: all(
      flag("csk_statute_offered"),
      exists("GBR"),
      { kind: "owns_group", group: "sudetenland" },
      not({ kind: "at_war" }),
    ),
    mtthDays: 90,
    historyPct: 80,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "war_support", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The Sudeten German Party outgrows every other party.
    id: "csk_sdp_growth",
    kind: "country",
    picture: "crowd",
    receivers: ["CSK"],
    trigger: all(
      { kind: "pop_ge", ideology: "fascist", pct: 15 },
      not({ kind: "ruling", ideology: "fascist" }),
      { kind: "owns_group", group: "sudetenland" },
    ),
    mtthDays: 90,
    options: [
      {
        id: "a",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -6 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // After the borderland is handed over (csk_munich_dictate, option a).
    id: "csk_after_munich",
    kind: "country",
    picture: "map",
    receivers: ["CSK"],
    trigger: all(
      gflag("sudeten_transferred"),
      not({ kind: "owns_group", group: "sudetenland" }),
    ),
    mtthDays: 7,
    historyPct: 85,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 10 },
          { kind: "war_support", pct: -10 },
          {
            kind: "if",
            cond: { kind: "has_spirit", id: "csk_forts_3" },
            then: [
              { kind: "swap_spirit", from: "csk_forts_3", to: "csk_forts_1" },
            ],
            else: [
              {
                kind: "if",
                cond: { kind: "has_spirit", id: "csk_forts_2" },
                then: [
                  {
                    kind: "swap_spirit",
                    from: "csk_forts_2",
                    to: "csk_forts_1",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: -5 },
          { kind: "popularity", ideology: "democratic", pp: 3 },
        ],
      },
    ],
  },
  {
    // The president leaves office after the borderland is lost.
    id: "csk_benes_resigns",
    kind: "country",
    picture: "newspaper",
    receivers: ["CSK"],
    trigger: all(gflag("sudeten_transferred"), {
      kind: "leader",
      person: "leader_csk",
    }),
    mtthDays: 20,
    historyPct: 85,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 8 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // Hlinka's party demands home rule for Slovakia.
    id: "csk_slovak_demands",
    kind: "country",
    picture: "crowd",
    receivers: ["CSK"],
    trigger: all(
      done("csk_slovak_question"),
      not({ kind: "has_spirit", id: "csk_slovak_autonomy" }),
      any(gflag("sudeten_transferred"), {
        kind: "has_spirit",
        id: "csk_centralism",
      }),
    ),
    mtthDays: 150,
    historyPct: 70,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "csk_slovak_autonomy" },
          {
            kind: "if",
            cond: { kind: "has_spirit", id: "csk_centralism" },
            then: [{ kind: "remove_spirit", id: "csk_centralism" }],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // Budapest asks for the Magyar south of Slovakia (the Komárno talks).
    id: "csk_hungarian_demands",
    kind: "country",
    picture: "border",
    receivers: ["CSK"],
    trigger: all(
      gflag("sudeten_transferred"),
      exists("HUN"),
      { kind: "owns_group", group: "south_slovakia" },
      not({ kind: "at_war_with", of: T("HUN") }),
    ),
    mtthDays: 30,
    historyPct: 70,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("HUN"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("HUN"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- the nation
  {
    // The founder dies.
    id: "csk_masaryk_dies",
    kind: "country",
    picture: "crowd",
    receivers: ["CSK"],
    trigger: after("1937-01-01"),
    mtthDays: 240,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
    ],
  },
  {
    // A foreign order reaches the Škoda Works.
    id: "csk_skoda_order",
    kind: "country",
    picture: "factory",
    receivers: ["CSK"],
    trigger: all(done("csk_skoda_export"), not({ kind: "at_war" })),
    mtthDays: 180,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "add_spirit", id: "csk_export_orders", days: 180 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "equipment", type: "artillery", gen: 1, count: 60 },
          { kind: "army_xp", amount: 5 },
        ],
      },
    ],
  },
  {
    // The army's light tank trials end.
    id: "csk_tank_trials",
    kind: "country",
    picture: "factory",
    receivers: ["CSK"],
    trigger: done("csk_lt38_competition"),
    mtthDays: 60,
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "has_tech", tech: "light_tank_2" },
        ai: { base: 70 },
        effects: [{ kind: "equipment", type: "light_tank", gen: 2, count: 50 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: 80 },
          { kind: "research_bonus", branch: "armour", pct: 30, uses: 1 },
        ],
      },
    ],
  },
  {
    // Foreign officers tour the border fortifications.
    id: "csk_fortress_tour",
    kind: "country",
    picture: "border",
    receivers: ["CSK"],
    trigger: any(
      { kind: "has_spirit", id: "csk_forts_2" },
      { kind: "has_spirit", id: "csk_forts_3" },
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("FRA"), of: "self", value: 15, days: 365 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "army_xp", amount: 10 }],
      },
    ],
  },
  {
    // Czechoslovak fighters at the international flying meeting.
    id: "csk_air_meeting",
    kind: "country",
    picture: "newspaper",
    receivers: ["CSK"],
    trigger: all(done("csk_avia_fighters"), not({ kind: "at_war" })),
    mtthDays: 150,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "add_spirit", id: "csk_aviation_pride", days: 240 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "research_bonus", branch: "air", pct: 30, uses: 1 }],
      },
    ],
  },
  {
    // The army stands on the border, alone if need be.
    id: "csk_fight_alone",
    kind: "country",
    picture: "column",
    receivers: ["CSK"],
    trigger: all(flag("csk_will_fight"), { kind: "at_war_with", of: T("DEU") }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "add_spirit", id: "csk_defiance", days: 180 },
          { kind: "war_support", pct: 7 },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- the Danube
  {
    // Received by AUT or HUN, fired by csk_danube_union_* (from = CSK).
    id: "csk_danube_offer",
    kind: "country",
    picture: "table",
    once: "never",
    timeoutSec: 30,
    humanDefault: "b",
    aiDelayDays: [7, 14],
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: {
          base: 5,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 400 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 60 }, factor: 200 },
            { if: { kind: "is_major" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "csk_danube_joined" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [{ kind: "fire_event", id: "csk_danube_refused", to: "from" }],
      },
    ],
  },
  {
    // The answer from Vienna or Budapest: no (from = the refuser).
    id: "csk_danube_refused",
    kind: "country",
    picture: "document",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: "from", value: -15, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        available: not({ kind: "at_war" }),
        ai: { base: 30 },
        effects: [{ kind: "war_goal", on: "from", type: "conquer" }],
      },
    ],
  },
  // ---------------------------------------------------------------- the war
  {
    // The exiles send parachutists home (Operation Anthropoid).
    id: "csk_parachutists",
    kind: "country",
    picture: "document",
    receivers: ["CSK"],
    trigger: all(
      done("csk_government_in_exile"),
      not({ kind: "controls_group", group: "bohemia_moravia" }),
    ),
    mtthDays: 365,
    historyPct: 70,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "resistance", group: "bohemia_moravia", pct: 15 },
          { kind: "exile_legitimacy", pct: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "resistance", group: "bohemia_moravia", pct: 5 }],
      },
    ],
  },
];
