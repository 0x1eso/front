// ww229: Sweden's events. Texts ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. Inside a fired
// event self is the receiver and from the sender. No event waits for a
// calendar day: each one fires when its situation arises (the AI judges it).
// Effects that can make a country vanish (annex) come last.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, done, exists, flag, not, T } from "../../helpers";

export const SWE_EVENTS: readonly EventDef[] = [
  {
    // The defence vote splits the cabinet; the Farmers' League minds the
    // shop over a summer, then the Social Democrats come back in coalition.
    id: "swe_holiday_cabinet",
    kind: "country",
    picture: "table",
    receivers: ["SWE"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      not(done("swe_four_party_cabinet")),
    ),
    mtthDays: 150,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: 3 },
          { kind: "add_advisor_candidate", person: "swe_pehrsson_bramstorp" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by swe_saltsjobaden: the unions and the employers at the hotel.
    id: "swe_saltsjobaden_talks",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "add_spirit", id: "swe_labour_peace" },
          { kind: "popularity", ideology: "communist", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    // A Germany that rearms wants more ore than the contracts give.
    id: "swe_german_ore_demand",
    kind: "country",
    picture: "factory",
    receivers: ["SWE"],
    trigger: all(
      exists("DEU"),
      { kind: "ruling", who: T("DEU"), ideology: "fascist" },
      not({ kind: "at_war_with", of: T("DEU") }),
      done("swe_ore_diplomacy"),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: flag("swe_ore_embargoed"), factor: 0 }],
        },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
          { kind: "pp", amount: 25 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // At war with Germany, Britain wants to buy up the ore or ship it west.
    id: "swe_british_purchase",
    kind: "country",
    picture: "document",
    receivers: ["SWE"],
    trigger: all(
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("GBR") }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          { kind: "convoys", amount: 40 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Finland is attacked from the east and asks Stockholm for help.
    id: "swe_finland_appeal",
    kind: "country",
    picture: "map",
    receivers: ["SWE"],
    trigger: all(
      exists("FIN"),
      { kind: "at_war_with", who: T("FIN"), of: T("SUN") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "unlock_decision", id: "swe_volunteer_corps" },
          { kind: "unlock_decision", id: "swe_arms_to_finland" },
          { kind: "opinion", who: T("FIN"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: {
          base: 10,
          mods: [
            { if: done("swe_finland_alliance"), factor: 800 },
            { if: { kind: "ruling", ideology: "communist" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("FIN"), of: "self", value: 35, days: 511 },
          { kind: "join_war", of: T("FIN") },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("FIN"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // The Allies ask for passage through Narvik and Kiruna "to help Finland".
    id: "swe_allied_passage",
    kind: "country",
    picture: "border",
    receivers: ["SWE"],
    trigger: all(
      { kind: "at_war_with", who: T("FIN"), of: T("SUN") },
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war", who: "self" }),
      not({ kind: "same_faction", of: T("GBR") }),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "access", of: T("GBR") },
          { kind: "access", of: T("FRA") },
          { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -30, days: 511 },
        ],
      },
    ],
  },
  {
    // Germany at war in the east asks to move a division from Norway to
    // Finland by Swedish rail.
    id: "swe_midsummer_crisis",
    kind: "country",
    picture: "column",
    receivers: ["SWE"],
    trigger: all(
      { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
      { kind: "controls_capital_of", who: T("DEU"), of: T("NOR") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 30,
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
          { kind: "stability", pct: -4 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -25, days: 511 },
          { kind: "war_support", pct: 5 },
          { kind: "tension", pct: 2 },
        ],
      },
    ],
  },
  {
    // Norway falls; refugees and soldiers cross the long border.
    id: "swe_norwegian_refugees",
    kind: "country",
    picture: "border",
    receivers: ["SWE"],
    trigger: all(
      { kind: "controls_capital_of", who: T("DEU"), of: T("NOR") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 45,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", who: T("NOR"), of: "self", value: 20, days: 511 },
          { kind: "unlock_decision", id: "swe_train_police_troops" },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "opinion", who: T("NOR"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 5, days: 365 },
        ],
      },
    ],
  },
  {
    // Denmark under occupation: its Jews are warned of arrest and the
    // fishing boats wait on the Sound.
    id: "swe_danish_rescue",
    kind: "country",
    picture: "map",
    receivers: ["SWE"],
    trigger: all(
      { kind: "controls_capital_of", who: T("DEU"), of: T("DNK") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 5, days: 365 },
        ],
      },
    ],
  },
  {
    // Saboteurs of a communist network blow up ore trains to Germany.
    id: "swe_ore_train_sabotage",
    kind: "country",
    picture: "factory",
    receivers: ["SWE"],
    trigger: all(
      { kind: "at_war", who: T("DEU") },
      { kind: "pop_ge", ideology: "communist", pct: 5 },
      not({ kind: "ruling", ideology: "communist" }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 240,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Three destroyers blow up at their anchorage while the navy stands
    // ready: accident or sabotage?
    id: "swe_anchorage_explosion",
    kind: "country",
    picture: "newspaper",
    receivers: ["SWE"],
    trigger: any(
      { kind: "has_spirit", id: "swe_readiness_reinforced" },
      { kind: "has_spirit", id: "swe_readiness_full" },
    ),
    mtthDays: 540,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "research_bonus", branch: "naval", pct: 50, uses: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "stability", pct: -1 },
          { kind: "popularity", ideology: "fascist", pp: 1 },
        ],
      },
    ],
  },
  {
    // Buyers from half the world queue at Karlskoga for Bofors guns.
    id: "swe_bofors_buyers",
    kind: "country",
    picture: "factory",
    receivers: ["SWE"],
    trigger: done("swe_bofors_works"),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "opinion", of: "all", value: 5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "opinion", who: T("FIN"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: 25 },
        ],
      },
      {
        id: "c",
        ai: {
          base: 25,
          mods: [{ if: { kind: "at_war" }, factor: 400 }],
        },
        effects: [{ kind: "equipment", type: "anti_air", gen: 1, count: 200 }],
      },
    ],
  },
  {
    // Fired by swe_saab_founded: who pays for the aircraft works.
    id: "swe_saab_founding",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [{ kind: "research_bonus", branch: "air", pct: 50, uses: 1 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: -25 },
          { kind: "build", where: { best: 1 }, building: "air_base", count: 1 },
        ],
      },
    ],
  },
  {
    // Fired by the union focuses and swe_propose_union to a Nordic
    // neighbour: join Sweden in one state, or not.
    id: "swe_union_offer",
    kind: "country",
    picture: "document",
    once: "never",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: {
          base: 20,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 300 },
            { if: { kind: "same_faction", of: "from" }, factor: 200 },
            { if: { kind: "at_war", who: "self" }, factor: 200 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 50 }, factor: 150 },
            { if: { kind: "threat_ge", of: T("SUN"), pct: 50 }, factor: 150 },
            { if: { kind: "is_human" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "swe_union_grew" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "fire_event", id: "swe_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // Fired back to Sweden by a neighbour that said no.
    id: "swe_union_refused",
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
    // Fired by swe_courtyard_memory: the king speaks to the farmers again.
    id: "swe_crown_speech",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "popularity", ideology: "democratic", pp: 2 }],
      },
    ],
  },
  {
    // Fired by swe_lindholm_movement: a torchlight march in Stockholm.
    id: "swe_torch_march",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Fired by swe_adalen_remembered: the march for the dead of 1931.
    id: "swe_adalen_march",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "popularity", ideology: "communist", pp: -1 },
        ],
      },
    ],
  },
  {
    // Germany fights the Soviet Union and America at once: a Swedish
    // diplomat could hand out protective passports in Budapest.
    id: "swe_budapest_mission",
    kind: "country",
    picture: "document",
    receivers: ["SWE"],
    trigger: all(
      exists("HUN"),
      { kind: "ruling", who: T("DEU"), ideology: "fascist" },
      { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
      { kind: "at_war_with", who: T("DEU"), of: T("USA") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    mtthDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 511 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "pp", amount: 25 }],
      },
    ],
  },
];
