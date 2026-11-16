// ww229 (design ww227 §3, §5): Yugoslavia's events and decisions. Most
// events answer a focus; a few watch the world (Germany on the Karawanks,
// Italy in Albania, the Ustaše abroad, the peasants' debts, the exile).
// The decisions run the balance of power (Croats against the Serbian
// officers), the Bor copper and bauxite contracts, the Albanian claim and
// the Balkan federation. self = Yugoslavia unless an event says otherwise.
// Data only (ContentPurity).
import type {
  DecisionDef,
  EventDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, fire, not, T } from "../../helpers";

export const YUG_EVENTS: EventDef[] = [
  {
    // Fired by yug_dismiss_stojadinovic.
    id: "yug_stojadinovic_falls",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "remove_advisor", person: "yug_stojadinovic" },
          { kind: "add_advisor_candidate", person: "yug_cvetkovic" },
          { kind: "stability", pct: 3 },
          { kind: "bop", amount: 50 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "popularity", ideology: "fascist", pp: 3 },
        ],
      },
    ],
  },
  {
    // Fired by yug_king_comes_of_age.
    id: "yug_peter_comes_of_age",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_leader", person: "yug_peter_ii" },
          { kind: "remove_spirit", id: "yug_regency_council" },
          { kind: "war_support", pct: 8 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "stability", pct: 4 }],
      },
    ],
  },
  {
    // Fired by yug_zbor_volunteers.
    id: "yug_zbor_clashes",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by yug_free_elections_demand.
    id: "yug_election_results",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 5 },
          { kind: "bop", amount: 50 },
        ],
      },
    ],
  },
  {
    // Fired by yug_party_rebuilt.
    id: "yug_tito_returns",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "add_advisor_candidate", person: "yug_kardelj" },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by yug_concordat.
    id: "yug_concordat_crisis",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "bop", amount: -50 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "bop", amount: 100 },
        ],
      },
    ],
  },
  {
    // Fired by yug_talks_with_macek.
    id: "yug_maceks_terms",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by yug_serb_lands.
    id: "yug_serb_backlash",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "war_support", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by yug_italian_pact.
    id: "yug_ciano_visit",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "yug_ustase_restrained" },
          { kind: "opinion", who: T("ITA"), of: "self", value: 15, days: 730 },
          { kind: "opinion", who: T("FRA"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
  {
    // Fired by yug_bulgarian_friendship to Bulgaria (from = Yugoslavia).
    id: "yug_eternal_friendship",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: "from", value: 20, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 730 },
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
    // Fired by yug_german_clearing.
    id: "yug_clearing_offer",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "yug_clearing_trade" },
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 730 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: 20 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Germany takes Carinthia (the Anschluss or a war): a German border on the Karawanks.
    id: "yug_germany_on_the_karawanks",
    kind: "country",
    picture: "border",
    receivers: ["YUG"],
    trigger: all(exists("DEU"), {
      kind: "owns_group",
      who: T("DEU"),
      group: "yug_carinthia",
    }),
    mtthDays: 10,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "fort", where: { regions: [474] }, amount: 1 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", of: T("DEU"), value: 15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    // Italy takes Albania.
    id: "yug_albania_falls",
    kind: "country",
    picture: "map",
    receivers: ["YUG"],
    trigger: all(exists("ITA"), {
      kind: "owns_group",
      who: T("ITA"),
      group: "yug_albania",
    }),
    mtthDays: 10,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: T("ITA"), value: -20, days: 730 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "unlock_decision", id: "yug_claim_albania" }],
      },
    ],
  },
  {
    // The Ustaše in exile, trained in Italy, while Belgrade holds the Croats down.
    id: "yug_ustase_abroad",
    kind: "country",
    picture: "newspaper",
    receivers: ["YUG"],
    trigger: all(
      after("1936-06-01"),
      not({ kind: "flag", flag: "yug_ustase_restrained" }),
      any(
        { kind: "bop_range", tag: "YUG", band: 0 },
        { kind: "bop_range", tag: "YUG", band: 1 },
      ),
    ),
    mtthDays: 365,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "bop", amount: -50 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: 50 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
    ],
  },
  {
    // The peasants' debts after the slump.
    id: "yug_peasant_debts",
    kind: "country",
    picture: "factory",
    receivers: ["YUG"],
    trigger: after("1936-03-01"),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 4 },
          { kind: "pp", amount: -30 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    // In exile: whom the government backs at home.
    id: "yug_chetniks_or_partisans",
    kind: "country",
    picture: "column",
    receivers: ["YUG"],
    trigger: { kind: "is_exile" },
    mtthDays: 60,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "exile_legitimacy", pct: 5 },
          { kind: "popularity", ideology: "neutral", pp: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 5 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 20, days: 730 },
        ],
      },
    ],
  },
  {
    // Fired by yug_federation_offer to Bulgaria (from = Yugoslavia).
    id: "yug_federation_proposal",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        available: { kind: "ruling", ideology: "communist" },
        ai: {
          base: 40,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 50 }, factor: 200 },
          ],
        },
        effects: [
          { kind: "annex", who: "from", target: "self", units: "transfer" },
          {
            kind: "set_name",
            who: "from",
            key: "ww1936.rename.balkan_federation",
          },
        ],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
];

export const YUG_DECISIONS: DecisionDef[] = [
  {
    id: "yug_court_the_hss",
    category: "national",
    for: ["YUG"],
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: 100 },
      { kind: "popularity", ideology: "democratic", pp: 1 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "bop_range", tag: "YUG", band: 0 }, factor: 400 }],
    },
  },
  {
    id: "yug_reassure_officers",
    category: "national",
    for: ["YUG"],
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: -100 },
      { kind: "war_support", pct: 3 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "bop_range", tag: "YUG", band: 4 }, factor: 400 }],
    },
  },
  {
    id: "yug_slovene_autonomy",
    category: "political",
    for: ["YUG"],
    locked: true,
    cost: { pp: 50 },
    effects: [
      { kind: "bop", amount: 50 },
      { kind: "stability", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "yug_bor_to_germany",
    category: "economy",
    for: ["YUG"],
    locked: true,
    visible: not({ kind: "has_spirit", id: "yug_copper_exports" }),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "yug_copper_exports", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "yug_bor_to_allies",
    category: "economy",
    for: ["YUG"],
    locked: true,
    visible: not({ kind: "has_spirit", id: "yug_copper_exports" }),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "yug_copper_exports", days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 8 },
  },
  {
    id: "yug_bauxite_contract",
    category: "economy",
    for: ["YUG"],
    locked: true,
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "yug_bauxite_exports", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 8 },
  },
  {
    id: "yug_claim_albania",
    category: "annexation",
    for: ["YUG"],
    locked: true,
    available: all(not({ kind: "owns_group", group: "yug_albania" }), {
      kind: "exists",
      who: { ownerOf: "yug_albania" },
    }),
    cost: { pp: 50 },
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "yug_albania" },
        type: "claim",
        group: "yug_albania",
      },
    ],
    ai: { base: 3 },
  },
  {
    id: "yug_federation_offer",
    category: "diplomacy",
    for: ["YUG"],
    locked: true,
    target: {
      among: all(
        { kind: "tag", tag: "BGR" },
        { kind: "ruling", ideology: "communist" },
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    available: { kind: "ruling", ideology: "communist" },
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [fire("yug_federation_proposal", "target")],
    ai: { base: 10 },
  },
  {
    id: "yug_call_reserves",
    category: "military",
    for: ["YUG"],
    available: { kind: "at_war" },
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", amount: 25000 },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
];
