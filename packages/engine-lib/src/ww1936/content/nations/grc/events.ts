// ww229: Greece's events. Triggered ones check the situation, never a day;
// the rest are fired by the tree (self = Greece). Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, before, exists, flag, not, T } from "../../helpers";

export const GRC_EVENTS: EventDef[] = [
  {
    // The old statesman dies in exile; both camps claim his memory.
    id: "grc_ev_venizelos_dies",
    kind: "country",
    receivers: ["GRC"],
    trigger: before("1937-01-01"),
    mtthDays: 90,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "bop", amount: 50 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 1 },
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The caretaker premier dies; the king picks his deputy.
    id: "grc_ev_caretaker_dies",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      before("1937-01-01"),
      { kind: "ruling", ideology: "neutral" },
      not(flag("grc_metaxas_pm")),
    ),
    mtthDays: 90,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "grc_metaxas_pm" },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "bop", amount: -100 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "set_flag", flag: "grc_metaxas_pm" },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "bop", amount: 50 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The unions call a general strike after the Thessaloniki shootings.
    id: "grc_ev_general_strike",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "pop_ge", ideology: "communist", pct: 5 },
      before("1938-01-01"),
    ),
    mtthDays: 150,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "bop", amount: 50 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Venizelist Crete rises against the regime (also fired by the tree).
    id: "grc_ev_chania_revolt",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      any(
        { kind: "bop_range", tag: "GRC", band: 3 },
        { kind: "bop_range", tag: "GRC", band: 4 },
      ),
    ),
    mtthDays: 180,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by grc_balkan_pact: the Entente's council meets.
    id: "grc_ev_balkan_summit",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("TUR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("ROU"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "opinion", who: T("BGR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // A Bulgarian patrol crosses into Thrace.
    id: "grc_ev_border_incident",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(exists("BGR"), not({ kind: "at_war_with", of: T("BGR") }), {
      kind: "wt_ge",
      pct: 15,
    }),
    mtthDays: 540,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "fort", where: { borderWith: T("BGR"), n: 1 }, amount: 1 },
          { kind: "war_support", pct: 2 },
          { kind: "opinion", of: T("BGR"), value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", of: T("BGR"), value: 15, days: 365 },
          { kind: "opinion", who: T("BGR"), of: "self", value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    // The islanders of the Dodecanese under Italian rule.
    id: "grc_ev_dodecanese_greeks",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(exists("ITA"), {
      kind: "owns_group",
      who: T("ITA"),
      group: "dodecanese",
    }),
    mtthDays: 400,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "stability", pct: 1 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 4 },
          { kind: "opinion", who: T("ITA"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // The regime's island exiles fill up; families petition the palace.
    id: "grc_ev_island_exiles",
    kind: "country",
    receivers: ["GRC"],
    trigger: { kind: "has_spirit", id: "grc_sp_island_exile" },
    mtthDays: 120,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "remove_spirit", id: "grc_sp_island_exile" },
          { kind: "bop", amount: 50 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // Germany buys the whole leaf crop in blocked marks.
    id: "grc_ev_tobacco_harvest",
    kind: "country",
    receivers: ["GRC"],
    trigger: flag("grc_tobacco_deu"),
    mtthDays: 200,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 10 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // An unknown submarine torpedoes the old cruiser off Tinos.
    id: "grc_ev_elli_torpedoed",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      exists("ITA"),
      not({ kind: "at_war_with", of: T("ITA") }),
      { kind: "wt_ge", pct: 40 },
      after("1939-01-01"),
    ),
    mtthDays: 365,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 6 },
          { kind: "opinion", of: T("ITA"), value: -30, days: 365 },
          { kind: "opinion", who: T("ITA"), of: "self", value: -30, days: 365 },
        ],
      },
    ],
  },
  {
    // Rome's ultimatum: free passage for its army, or war.
    id: "grc_ev_ultimatum",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      { kind: "at_war_with", of: T("ITA") },
      not(flag("grc_ultimatum_answered")),
    ),
    mtthDays: 3,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "set_flag", flag: "grc_ultimatum_answered" },
          { kind: "war_support", pct: 8 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [
          { kind: "set_flag", flag: "grc_ultimatum_answered" },
          { kind: "war_support", pct: -5 },
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "fascist", pp: 3 },
        ],
      },
    ],
  },
  {
    // The dictator dies in the middle of the war.
    id: "grc_ev_dictator_dies",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      after("1940-06-01"),
      { kind: "ruling", ideology: "neutral" },
      flag("grc_fourth_august"),
    ),
    mtthDays: 240,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // Fired by grc_accept_british_expedition: the corps lands at Piraeus.
    id: "grc_ev_expedition_lands",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "army_xp", amount: 10 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // The northern armies are cut off; their generals talk of terms.
    id: "grc_ev_army_surrender",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "lost_vp_ge", pct: 40 },
      not(flag("grc_army_surrendered")),
    ),
    mtthDays: 20,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_flag", flag: "grc_army_surrendered" },
          { kind: "war_support", pct: -10 },
          { kind: "stability", pct: -5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "set_flag", flag: "grc_army_surrendered" },
          { kind: "war_support", pct: 5 },
          { kind: "army_xp", amount: 5 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // The king and the government leave the mainland.
    id: "grc_ev_king_leaves",
    kind: "country",
    receivers: ["GRC"],
    trigger: { kind: "is_exile" },
    mtthDays: 5,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "exile_legitimacy", pct: 5 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", of: T("GBR"), value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
        ],
      },
    ],
  },
  {
    // Requisitions and the blockade empty the cities' bread.
    id: "grc_ev_great_famine",
    kind: "country",
    receivers: ["GRC"],
    trigger: any(
      { kind: "is_exile" },
      all({ kind: "at_war" }, { kind: "lost_vp_ge", pct: 60 }),
    ),
    mtthDays: 180,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "grc_sp_great_famine", days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "grc_sp_great_famine", days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
    ],
  },
  {
    // The party founds a national liberation front in occupied Athens.
    id: "grc_ev_liberation_front",
    kind: "country",
    receivers: ["GRC"],
    trigger: all(
      any(
        { kind: "is_exile" },
        not({ kind: "controls_capital_of", of: "self" }),
      ),
      { kind: "pop_ge", ideology: "communist", pct: 5 },
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 120,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_flag", flag: "grc_eam" },
          { kind: "popularity", ideology: "communist", pp: 4 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
];
