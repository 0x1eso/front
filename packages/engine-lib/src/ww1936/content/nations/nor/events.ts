// ww229: Norway's events. Texts ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. Inside a fired
// event self is the receiver and from the sender. No event waits for a
// calendar day: each one fires when its situation arises (the AI judges it).
// Effects that can make a country vanish (annex) come last.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, done, exists, flag, not, T } from "../../helpers";

/** Britain and Germany at war, Norway still out of it. */
const WAR_AROUND: Condition = all(
  exists("GBR"),
  exists("DEU"),
  { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
  not({ kind: "at_war" }),
);

export const NOR_EVENTS: readonly EventDef[] = [
  {
    // Fired by nor_defence_debate: the Storting votes on the defence budget.
    id: "nor_defence_vote",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: -20 },
          { kind: "army_xp", amount: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // The Farmers' Party wants its price for the crisis compromise.
    id: "nor_farmers_price",
    kind: "country",
    picture: "crowd",
    receivers: ["NOR"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      { kind: "has_spirit", id: "nor_crisis_pact" },
    ),
    mtthDays: 200,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: -30 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "remove_spirit", id: "nor_crisis_pact" },
          { kind: "pp", amount: 40 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // An exiled revolutionary lives near Oslo, and Moscow is angry.
    id: "nor_trotsky_asylum",
    kind: "country",
    picture: "newspaper",
    receivers: ["NOR"],
    trigger: all(exists("SUN"), { kind: "ruling", ideology: "democratic" }),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: 10, days: 365 },
          { kind: "popularity", ideology: "communist", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          {
            kind: "opinion",
            who: T("SUN"),
            of: "self",
            value: -20,
            days: 365,
          },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
    ],
  },
  {
    // The radical circle around its journal breaks up; its members knock
    // on Labour's door.
    id: "nor_mot_dag_dissolves",
    kind: "country",
    picture: "document",
    receivers: ["NOR"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      not(done("nor_red_course")),
    ),
    mtthDays: 250,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Nasjonal Samling stands for the Storting.
    id: "nor_ns_at_the_polls",
    kind: "country",
    picture: "crowd",
    receivers: ["NOR"],
    trigger: not({ kind: "ruling", ideology: "fascist" }),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
          mods: [{ if: done("nor_ns_course"), factor: 20 }],
        },
        effects: [{ kind: "popularity", ideology: "fascist", pp: -3 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // A German supply ship with British prisoners hides in a fjord; a
    // British destroyer follows it in.
    id: "nor_prison_ship",
    kind: "country",
    picture: "border",
    receivers: ["NOR"],
    trigger: WAR_AROUND,
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
          mods: [{ if: flag("nor_western_leaning"), factor: 300 }],
        },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -20,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    // Britain lays mines in Norwegian waters to stop the ore ships.
    id: "nor_mined_waters",
    kind: "country",
    picture: "map",
    receivers: ["NOR"],
    trigger: all(WAR_AROUND, {
      kind: "war_days_ge",
      who: T("GBR"),
      days: 180,
    }),
    mtthDays: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "war_support", pct: 3 },
          {
            kind: "opinion",
            who: T("GBR"),
            of: "self",
            value: -10,
            days: 365,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "war_support", pct: 5 },
          {
            kind: "opinion",
            who: T("GBR"),
            of: "self",
            value: -25,
            days: 365,
          },
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "c",
        ai: {
          base: 25,
          mods: [{ if: flag("nor_western_leaning"), factor: 300 }],
        },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -25,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    // Warships come up the Oslofjord at night; the old fortress guns wait.
    id: "nor_fjord_at_dawn",
    kind: "country",
    picture: "border",
    receivers: ["NOR"],
    trigger: all(exists("DEU"), { kind: "at_war_with", of: T("DEU") }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "army_xp", amount: 10 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // The invader in Oslo demands a new government under its own man.
    id: "nor_the_demands",
    kind: "country",
    picture: "document",
    receivers: ["NOR"],
    trigger: all(
      exists("DEU"),
      { kind: "at_war_with", of: T("DEU") },
      { kind: "controls_capital_of", who: T("DEU"), of: "self" },
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 80,
          mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 10 }],
        },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: -10 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
        ],
      },
    ],
  },
  {
    // The central bank's gold must leave before the enemy reaches it.
    id: "nor_bank_gold",
    kind: "country",
    picture: "column",
    receivers: ["NOR"],
    trigger: all(
      { kind: "at_war" },
      { kind: "war_days_ge", days: 7 },
      not({ kind: "is_exile" }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: 60 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: 20 },
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  {
    // A German chemical firm asks for more heavy water than Vemork sells.
    id: "nor_heavy_water_order",
    kind: "country",
    picture: "factory",
    receivers: ["NOR"],
    trigger: all(
      done("nor_heavy_water_plant"),
      exists("DEU"),
      { kind: "ruling", who: T("DEU"), ideology: "fascist" },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 200,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: flag("nor_water_east"), factor: 20 }],
        },
        effects: [
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -10,
            days: 365,
          },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          {
            kind: "opinion",
            who: T("FRA"),
            of: "self",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    // Soviet miners dig coal on Svalbard under the archipelago's treaty.
    id: "nor_svalbard_miners",
    kind: "country",
    picture: "factory",
    receivers: ["NOR"],
    trigger: all(exists("SUN"), not({ kind: "at_war" })),
    mtthDays: 400,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: 5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          {
            kind: "opinion",
            who: T("SUN"),
            of: "self",
            value: -10,
            days: 365,
          },
          { kind: "pp", amount: 15 },
        ],
      },
    ],
  },
  {
    // Finland is attacked from the east and asks for help.
    id: "nor_finland_appeal",
    kind: "country",
    picture: "crowd",
    receivers: ["NOR"],
    trigger: all(
      exists("FIN"),
      { kind: "at_war_with", who: T("SUN"), of: T("FIN") },
      not({ kind: "at_war" }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          {
            kind: "send_equipment",
            to: T("FIN"),
            type: "infantry_equipment",
            count: 500,
          },
          { kind: "opinion", who: T("FIN"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
          mods: [{ if: flag("nor_western_leaning"), factor: 300 }],
        },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
          {
            kind: "opinion",
            who: T("SUN"),
            of: "self",
            value: -20,
            days: 365,
          },
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -15,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    // The homeland is lost and a thousand ships are at sea: where do they
    // sail? The government orders them to allied ports.
    id: "nor_ships_at_sea",
    kind: "country",
    picture: "map",
    receivers: ["NOR"],
    trigger: all({ kind: "at_war" }, not(flag("nor_nortraship")), {
      any: [
        { kind: "is_exile" },
        { kind: "controls_capital_of", who: T("DEU"), of: "self" },
      ],
    }),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 85 },
        effects: [
          { kind: "set_flag", flag: "nor_nortraship" },
          { kind: "add_spirit", id: "nor_nortraship_spirit" },
          {
            kind: "if",
            cond: all(
              exists("GBR"),
              not({ kind: "at_war_with", of: T("GBR") }),
            ),
            then: [
              {
                kind: "send_equipment",
                to: T("GBR"),
                type: "convoy",
                count: 40,
              },
            ],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 15 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // Under occupation the teachers refuse to join the new party's union.
    id: "nor_teachers_refuse",
    kind: "country",
    picture: "crowd",
    receivers: ["NOR"],
    trigger: all(exists("DEU"), {
      kind: "controls_capital_of",
      who: T("DEU"),
      of: "self",
    }),
    mtthDays: 200,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by nor_ask_guarantee to Britain: guarantee Norway, or not.
    id: "nor_guarantee_request",
    kind: "country",
    picture: "document",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: {
          base: 50,
          mods: [
            { if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 200 },
          ],
        },
        effects: [
          { kind: "guarantee", of: "from" },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by nor_propose_union to Denmark or Iceland: one realm again.
    id: "nor_union_offer",
    kind: "country",
    picture: "document",
    once: "never",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: {
          base: 15,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 300 },
            { if: { kind: "same_faction", of: "from" }, factor: 200 },
            { if: { kind: "at_war", who: "self" }, factor: 200 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 50 }, factor: 150 },
            { if: { kind: "is_human" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "nor_union_grew" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 85 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "fire_event", id: "nor_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // Fired back to Norway by a neighbour that said no.
    id: "nor_union_refused",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 80 },
        effects: [{ kind: "stability", pct: -1 }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "opinion", of: "from", value: -15, days: 365 },
        ],
      },
    ],
  },
];
