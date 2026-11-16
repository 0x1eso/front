// ww229: Poland's national events. Most wait on a situation (a focus, the
// balance of power, a neighbour's move) rather than a date; the P6 pack's
// date events (pol_beck_speech, pol_pyry_meeting, pol_exile_forces) still
// fire beside them. self = the receiver, from = the sender of a fired one.
// Event numbers are not tripled. Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, after, all, any, done, not } from "../../helpers";

export const POL_EVENTS: EventDef[] = [
  // ---- the ruling camp ----
  {
    // The President and the Marshal: two courts in one camp.
    id: "pol_ev_castle_and_marshal",
    kind: "country",
    receivers: ["POL"],
    trigger: all(done("pol_rydz_second_person"), {
      kind: "ruling",
      ideology: "neutral",
    }),
    mtthDays: 60,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  {
    // The villages stop selling to the towns.
    id: "pol_ev_peasant_strike",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      after("1937-01-01"),
      { kind: "ruling", ideology: "neutral" },
      { kind: "pop_ge", ideology: "democratic", pct: 12 },
    ),
    mtthDays: 360,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: 80 },
          { kind: "stability", pct: -3 },
          { kind: "add_spirit", id: "pol_sp_village_boycott", days: 120 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: -80 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Fired by pol_morges_front.
    id: "pol_ev_morges_meeting",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Moscow's Comintern dissolves the Polish party.
    id: "pol_ev_kpp_dissolved",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      after("1937-06-01"),
      { kind: "ruling", who: T("SUN"), ideology: "communist" },
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 400,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [{ kind: "popularity", ideology: "communist", pp: -3 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -1 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Street fights of the national radicals' squads.
    id: "pol_ev_falanga_brawls",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "pop_ge", ideology: "fascist", pct: 10 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 300,
    once: "never",
    cooldownDays: 365,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: -1 },
          { kind: "bop", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The balance of power at its right end: the camp governs alone.
    id: "pol_ev_colonels_alone",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "bop_range", tag: "POL", band: 4 },
      { kind: "ruling", ideology: "neutral" },
    ),
    mtthDays: 120,
    once: "never",
    cooldownDays: 365,
    picture: "document",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // The balance of power at its left end: the opposition is at the door.
    id: "pol_ev_opposition_at_door",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "bop_range", tag: "POL", band: 0 },
      { kind: "ruling", ideology: "neutral" },
    ),
    mtthDays: 120,
    once: "never",
    cooldownDays: 365,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 4 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },

  // ---- the economy and the bureau ----
  {
    id: "pol_ev_first_steel",
    kind: "country",
    receivers: ["POL"],
    trigger: done("pol_stalowa_wola"),
    mtthDays: 90,
    picture: "factory",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [{ kind: "pp", amount: 40 }],
      },
    ],
  },
  {
    // The bureau's bombs read the German keys again.
    id: "pol_ev_bomb_built",
    kind: "country",
    receivers: ["POL"],
    trigger: done("pol_cryptologic_bomb"),
    mtthDays: 60,
    picture: "document",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [{ kind: "decrypt", on: T("DEU"), pm: 100 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "research_bonus", branch: "electronics", pct: 50, uses: 1 },
        ],
      },
    ],
  },

  // ---- neighbours ----
  {
    // Fired by pol_kaunas_note to Lithuania: open relations or not.
    id: "pol_ev_kaunas_note",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: "from", value: 10, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: 15, days: 365 },
          { kind: "set_flag", who: "from", flag: "pol_ltu_relations" },
          { kind: "fire_event", id: "pol_ev_kaunas_accepts", to: "from" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
          { kind: "fire_event", id: "pol_ev_kaunas_refuses", to: "from" },
        ],
      },
    ],
  },
  {
    id: "pol_ev_kaunas_accepts",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 1 },
        ],
      },
    ],
  },
  {
    id: "pol_ev_kaunas_refuses",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [{ kind: "stability", pct: -1 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_goal", on: "from", type: "conquer" },
          { kind: "tension", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by pol_jagiellonian_offer to Lithuania: a union of the two crowns' heirs.
    id: "pol_ev_union_offer",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: {
          base: 10,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 50 }, factor: 400 },
            { if: { kind: "same_faction", of: "from" }, factor: 300 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "pol_union_done" },
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
        ai: { base: 90 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "fire_event", id: "pol_ev_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    id: "pol_ev_union_refused",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        ai: { base: 80 },
        effects: [{ kind: "stability", pct: 1 }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_goal", on: "from", type: "conquer" },
          { kind: "tension", pct: 3 },
        ],
      },
    ],
  },
  {
    // Danzig's Senate (the Nazi party rules it) against Polish customs officers.
    id: "pol_ev_danzig_customs",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "exists", who: T("DZG") },
      { kind: "exists", who: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
      after("1937-01-01"),
    ),
    mtthDays: 500,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
          { kind: "tension", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Hungary takes Carpathian Ruthenia: the two countries touch.
    id: "pol_ev_hungarian_border",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "exists", who: T("HUN") },
      { kind: "owns_group", who: T("HUN"), group: "carpathian_ruthenia" },
    ),
    mtthDays: 30,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("HUN"), value: 15, days: 365 },
          { kind: "opinion", who: T("HUN"), of: "self", value: 15, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "stability", pct: 1 }],
      },
    ],
  },
  {
    // Ukrainian nationalists against the state; the governor's answer.
    id: "pol_ev_volhynia_unrest",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "has_spirit", id: "pol_sp_borderland_tension" },
      not({ kind: "stability_ge", pct: 40 }),
    ),
    mtthDays: 240,
    once: "never",
    cooldownDays: 365,
    picture: "border",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "neutral", pp: 1 },
          { kind: "pp", amount: -30 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "remove_spirit", id: "pol_sp_borderland_tension" },
        ],
      },
    ],
  },

  // ---- before and during the war ----
  {
    // London and Paris ask for calm while the Germans mass on the border.
    id: "pol_ev_mobilisation_advice",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "exists", who: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
      { kind: "threat_ge", of: T("DEU"), pct: 40 },
      any(
        { kind: "guaranteed_by", of: T("GBR") },
        { kind: "guaranteed_by", of: T("FRA") },
      ),
    ),
    mtthDays: 60,
    picture: "column",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "manpower", amount: 20000 },
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: -3 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 180 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "war_support", pct: -2 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 180 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 180 },
        ],
      },
    ],
  },
  {
    // Fired by pol_dec_evacuate_gold: where the reserve goes.
    id: "pol_ev_gold_route",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "exists", who: T("FRA") },
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "pol_sp_gold_abroad" },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        available: { kind: "exists", who: T("GBR") },
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "pol_sp_gold_abroad" },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "c",
        available: not(
          any(
            { kind: "exists", who: T("FRA") },
            { kind: "exists", who: T("GBR") },
          ),
        ),
        ai: { base: 1 },
        effects: [{ kind: "pp", amount: 50 }],
      },
    ],
  },
  {
    // The Soviet Union, at war with Germany, frees Polish prisoners for an army.
    id: "pol_ev_eastern_amnesty",
    kind: "country",
    receivers: ["POL"],
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    mtthDays: 60,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          {
            kind: "divisions",
            template: "pol_exile_infantry",
            count: 2,
            where: "capital",
          },
          { kind: "manpower", amount: 20000 },
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
];
