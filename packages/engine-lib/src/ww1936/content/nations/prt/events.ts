// ww229: Portugal's events. Texts ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. Inside a fired
// event self is the receiver and from the sender. No event waits for a
// calendar day: each one fires when its situation arises (the AI judges it).
// Effects that can make a country vanish (annex) come last.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, done, exists, flag, not, T } from "../../helpers";

export const PRT_EVENTS: readonly EventDef[] = [
  {
    // Sailors on the Tagus seize two sloops and a destroyer to sail for the
    // Spanish Republic; the forts open fire.
    id: "prt_sailors_revolt",
    kind: "country",
    picture: "crowd",
    receivers: ["PRT"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      exists("ESN"),
      exists("ESR"),
      { kind: "at_war_with", who: T("ESN"), of: T("ESR") },
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "navy_xp", amount: -5 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by prt_pvde: a penal camp on the Cape Verde islands.
    id: "prt_tarrafal",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
    ],
  },
  {
    // Republicans fleeing the Nationalists cross the Guadiana.
    id: "prt_border_refugees",
    kind: "country",
    picture: "border",
    receivers: ["PRT"],
    trigger: all(
      exists("ESN"),
      exists("ESR"),
      { kind: "at_war_with", who: T("ESN"), of: T("ESR") },
      not({ kind: "at_war" }),
    ),
    mtthDays: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: { kind: "ruling", ideology: "democratic" }, factor: 0 }],
        },
        effects: [
          { kind: "opinion", who: T("ESN"), of: "self", value: 15, days: 365 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "opinion", who: T("ESN"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("ESR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // A bomb under the road to Mass misses the President of the Council.
    id: "prt_salazar_bomb",
    kind: "country",
    picture: "newspaper",
    receivers: ["PRT"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "leader", person: "leader_prt" },
      done("prt_which_portugal"),
    ),
    mtthDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // Fired by prt_double_centenary: eight centuries of the nation by the
    // Tagus at Belém, while Europe burns.
    id: "prt_world_exhibition",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "pp", amount: -25 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "pp", amount: 40 }],
      },
    ],
  },
  {
    // France falls; the consul in Bordeaux signs visas for everyone at his
    // door against Lisbon's orders.
    id: "prt_bordeaux_visas",
    kind: "country",
    picture: "document",
    receivers: ["PRT"],
    trigger: all(
      exists("FRA"),
      { kind: "controls_capital_of", who: T("DEU"), of: T("FRA") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 20,
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: { kind: "ruling", ideology: "democratic" }, factor: 0 }],
        },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Deep in a long war, London asks its oldest ally for the Azores.
    id: "prt_alliance_invoked",
    kind: "country",
    picture: "table",
    receivers: ["PRT"],
    trigger: all(
      exists("GBR"),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      { kind: "war_days_ge", who: T("GBR"), days: 700 },
      not(flag("prt_azores_leased")),
      not({ kind: "at_war_with", of: T("GBR") }),
      not({ kind: "same_faction", of: T("DEU") }),
    ),
    mtthDays: 90,
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [
            { if: done("prt_azores_closed"), factor: 30 },
            { if: { kind: "ruling", ideology: "fascist" }, factor: 20 },
          ],
        },
        effects: [
          { kind: "set_flag", flag: "prt_azores_leased" },
          { kind: "access", of: T("GBR") },
          { kind: "add_spirit", id: "prt_atlantic_bases" },
          { kind: "equipment", type: "fighter", gen: 2, count: 30 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 511 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -20, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // With the British already on Terceira, Washington wants a field of its
    // own on Santa Maria.
    id: "prt_american_bases",
    kind: "country",
    picture: "map",
    receivers: ["PRT"],
    trigger: all(
      flag("prt_azores_leased"),
      not(flag("prt_azores_us")),
      exists("USA"),
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "prt_azores_us" },
          { kind: "access", of: T("USA") },
          { kind: "opinion", who: T("USA"), of: "self", value: 25, days: 365 },
          { kind: "equipment", type: "transport_plane", gen: 1, count: 10 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Berlin protests the bases and hints at what its submarines could do.
    id: "prt_german_protest",
    kind: "country",
    picture: "newspaper",
    receivers: ["PRT"],
    trigger: all(
      flag("prt_azores_leased"),
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: -25 },
        ],
      },
    ],
  },
  {
    // The price of wolfram multiplies; peasants dig by night and smugglers
    // run ore across the border.
    id: "prt_wolfram_price",
    kind: "country",
    picture: "factory",
    receivers: ["PRT"],
    trigger: all(done("prt_wolfram_board"), exists("DEU"), exists("GBR"), {
      kind: "at_war_with",
      who: T("DEU"),
      of: T("GBR"),
    }),
    mtthDays: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 60 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "prt_wolfram_rush", days: 365 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // London and Washington demand that every ton stops going to Germany.
    id: "prt_wolfram_ultimatum",
    kind: "country",
    picture: "table",
    receivers: ["PRT"],
    trigger: all(
      done("prt_wolfram_board"),
      not(flag("prt_wolfram_embargoed")),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "same_faction", of: T("DEU") }),
    ),
    mtthDays: 180,
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 10 }],
        },
        effects: [
          { kind: "set_flag", flag: "prt_wolfram_embargoed" },
          { kind: "remove_spirit", id: "prt_german_contracts" },
          { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -25, days: 365 },
          { kind: "embargo", on: T("DEU") },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
  {
    // Allied troops land on Timor to deny it to Japan, without asking.
    id: "prt_timor_landing",
    kind: "country",
    picture: "map",
    receivers: ["PRT"],
    trigger: all(
      exists("JPN"),
      any(
        { kind: "at_war_with", who: T("JPN"), of: T("GBR") },
        { kind: "at_war_with", who: T("JPN"), of: T("USA") },
      ),
      { kind: "owns_group", group: "prt_timor" },
      not({ kind: "at_war_with", of: T("JPN") }),
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("JPN"), of: "self", value: 10, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // Burgos signs with Berlin: Portugal's one land border now faces the Axis.
    id: "prt_spain_joins_axis",
    kind: "country",
    picture: "border",
    receivers: ["PRT"],
    trigger: all(
      exists("ESN"),
      exists("DEU"),
      { kind: "same_faction", who: T("ESN"), of: T("DEU") },
      not({ kind: "same_faction", of: T("DEU") }),
    ),
    mtthDays: 20,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "add_spirit", id: "prt_legion_mobilised", days: 180 },
          { kind: "fort", where: { borderWith: T("ESN"), n: 2 }, amount: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("ESN"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The two dictators meet in Seville to keep the peninsula out of the war.
    id: "prt_iberian_meeting",
    kind: "country",
    picture: "table",
    receivers: ["PRT"],
    trigger: all(
      done("prt_iberian_bloc"),
      exists("ESN"),
      { kind: "at_war", who: T("DEU") },
      not({ kind: "at_war_with", of: T("ESN") }),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("ESN"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
          mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 300 }],
        },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
    ],
  },
  {
    // Fired by prt_union_offer and prt_propose_union to Spain: one crown or
    // one republic for the whole peninsula, or not.
    id: "prt_iberian_union_offer",
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
            { if: { kind: "is_human" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "prt_union_grew" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 85 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "fire_event", id: "prt_iberian_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // Fired back to Portugal by a Spain that said no.
    id: "prt_iberian_union_refused",
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
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: "from", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by prt_integralist_heritage: the old Integralist writers speak
    // of a king again.
    id: "prt_integralist_revival",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "pp", amount: 30 }],
      },
    ],
  },
  {
    // Fired by prt_kingdom_restored: the Duke of Braganza comes home.
    id: "prt_king_returns",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: -3 },
          { kind: "popularity", ideology: "neutral", pp: 3 },
        ],
      },
    ],
  },
  {
    // Fired by prt_preto_returns: the blue shirts march again in Lisbon.
    id: "prt_preto_rally",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 1 },
          { kind: "pp", amount: 25 },
        ],
      },
    ],
  },
  {
    // Fired by prt_reviralho: the exiles of Paris and Madrid come back.
    id: "prt_exiles_return",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 1 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by prt_avante: the clandestine paper reaches the factories.
    id: "prt_avante_press",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 1 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
];
