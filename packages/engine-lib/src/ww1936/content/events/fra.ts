// World War 1936 P5 — the France and Vichy chain (spec §19.2 rows 3, 5–9,
// 20, 24–27, 40 and their chains) and the regime crisis of the strong
// executive branch. Military and diplomatic facts only (spec §19.2 end):
// Vichy's heads of state and of government appear as titles, and no
// option rewards or stages the regime's repression.
//
// Who is who: self = the receiver, from = the sender. Rows the spec marks
// "beat" are fired for an AI receiver by the endgame lane's history beats;
// their triggers start with any(is_human, not historical_ai) so that a human
// receiver, or a game without the historical AI, gets them from the
// situation instead. Effects that can take land away come after the news.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, after, all, any, gflag, not } from "../helpers";

export const FRA_EVENTS: EventDef[] = [
  // #3, 1940-06-22: France has fallen and Germany holds Paris; the Vichy
  // slot is still asleep.
  {
    id: "deu_compiegne_armistice",
    kind: "country",
    picture: "document",
    receivers: ["DEU"],
    trigger: all(
      { kind: "capitulated", who: T("FRA") },
      { kind: "controls_capital_of", of: T("FRA") },
      { kind: "country_state", tag: "VIC", state: "dormant" },
    ),
    once: "game",
    historyPct: 95,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 95 },
        effects: [
          { kind: "news", id: "news_vic_state" },
          {
            kind: "create_state",
            tag: "VIC",
            regions: [
              "france_free_zone",
              "french_north_africa",
              "french_west_africa",
              "french_equatorial_africa",
              "levant",
              "indochina",
              "madagascar",
            ],
            from: T("FRA"),
            overlord: "self",
            level: "puppet",
            neutral: true,
            ideology: "neutral",
          },
          { kind: "transfer_ships", who: T("FRA"), to: T("VIC"), pct: 85 },
          { kind: "exile_legitimacy", who: T("FRA"), pct: -10 },
        ],
      },
      // The whole country stays under occupation.
      { id: "b", ai: { base: 5 }, effects: [] },
    ],
  },
  // #5, 1940-07-03 (beat): Vichy exists and still has ships.
  {
    id: "gbr_mers_el_kebir",
    kind: "country",
    picture: "map",
    receivers: ["GBR"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      after("1940-07-03"),
      { kind: "country_state", tag: "VIC", state: "active" },
      { kind: "navy_size", who: T("VIC"), min: 1 },
    ),
    once: "game",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_vic_mers_el_kebir" },
          { kind: "scuttle_fleet", who: T("VIC"), pct: 20 },
          { kind: "opinion", who: T("VIC"), of: "self", value: -60, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "fire_event", id: "vic_fleet_ultimatum", to: T("VIC") },
        ],
      },
    ],
  },
  // Chain of #5 (from = Britain). Refusing ends as the attack did.
  {
    id: "vic_fleet_ultimatum",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: { base: 20 },
        effects: [{ kind: "transfer_ships", to: "from", pct: 10 }],
      },
      {
        id: "b",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_vic_mers_el_kebir" },
          { kind: "scuttle_fleet", pct: 20 },
          { kind: "opinion", of: "from", value: -60, days: 365 },
        ],
      },
    ],
  },
  // #6, 1940-07-10: checked on Vichy's first days.
  {
    id: "vic_full_powers",
    kind: "country",
    picture: "table",
    receivers: ["VIC"],
    trigger: { kind: "exists" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vic_full_powers" },
          { kind: "set_government", ideology: "neutral" },
          { kind: "set_leader", person: "title:vic_head_of_state" },
          { kind: "stability", pct: 10 },
          { kind: "add_spirit", id: "vic_state_regime" },
        ],
      },
    ],
  },
  // #7, 1940-08-26 (beat; fra_rally_the_empire fires it too): French
  // Equatorial Africa joins the exile government.
  {
    id: "fra_free_french_africa",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_fra_free_french_africa" },
          { kind: "exile_legitimacy", pct: 10 },
          {
            kind: "transfer_regions",
            who: T("VIC"),
            group: "french_equatorial_africa",
            to: "self",
          },
        ],
      },
    ],
  },
  // #8, 1940-09-22: fired by the Japanese decision
  // jpn_demand_indochina_access (from = Japan).
  {
    id: "vic_japanese_demand",
    kind: "country",
    picture: "document",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [{ kind: "access", of: "from" }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          {
            kind: "war_goal",
            who: "from",
            on: "self",
            type: "claim",
            group: "indochina",
          },
        ],
      },
    ],
  },
  // #9, 1940-09-23: an exiled France that holds Equatorial Africa borders
  // West Africa (Chad and Niger). "Forces touching the group" has no
  // condition kind; the exile's African base stands in for it.
  {
    id: "vic_dakar",
    kind: "country",
    picture: "map",
    receivers: ["VIC"],
    trigger: all(
      after("1940-09-23"),
      { kind: "is_exile", who: T("FRA") },
      {
        kind: "controls_group",
        who: T("FRA"),
        group: "french_equatorial_africa",
      },
      { kind: "owns_group", group: "french_west_africa" },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_vic_dakar" },
          { kind: "war_support", pct: 5 },
          { kind: "opinion", of: T("GBR"), value: -20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          {
            kind: "transfer_regions",
            group: "french_west_africa",
            to: T("FRA"),
          },
        ],
      },
    ],
  },
  // #20, 1941-07-14: at war with Britain and losing the Levant. "Half of
  // the group lost" has no condition kind: one region taken and a month of
  // war stand in for it.
  {
    id: "vic_levant_armistice",
    kind: "country",
    picture: "table",
    receivers: ["VIC"],
    trigger: all(
      { kind: "at_war_with", of: T("GBR") },
      any(
        { kind: "occupied_by", group: "levant", of: T("GBR") },
        { kind: "occupied_by", group: "levant", of: T("FRA") },
      ),
      { kind: "war_days_ge", days: 30 },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vic_levant" },
          { kind: "end_war", of: T("GBR") },
          { kind: "transfer_regions", group: "levant", to: T("FRA") },
        ],
      },
    ],
  },
  // #24, 1942-11-06: at war with Britain, which has landed on Madagascar
  // ("most of the island" stands in as a British-held region after three
  // months of war).
  {
    id: "vic_madagascar_armistice",
    kind: "country",
    picture: "table",
    receivers: ["VIC"],
    trigger: all(
      { kind: "at_war_with", of: T("GBR") },
      { kind: "occupied_by", group: "madagascar", of: T("GBR") },
      { kind: "war_days_ge", days: 90 },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vic_madagascar" },
          { kind: "transfer_regions", group: "madagascar", to: T("FRA") },
        ],
      },
    ],
  },
  // #25, 1942-11-08 (beat): the Allies are ashore in French North Africa.
  {
    id: "vic_torch",
    kind: "country",
    picture: "map",
    receivers: ["VIC"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      any(
        {
          kind: "occupied_by",
          group: "french_north_africa",
          of: { factionLeaderOf: T("GBR") },
        },
        { kind: "occupied_by", group: "french_north_africa", of: T("USA") },
      ),
    ),
    once: "game",
    timeoutSec: 30,
    historyPct: 80,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "news", id: "news_vic_torch" },
          { kind: "set_gflag", flag: "vic_torch_done" },
          { kind: "end_war", of: T("USA") },
          { kind: "end_war", of: T("GBR") },
          {
            kind: "transfer_regions",
            group: "french_north_africa",
            to: T("FRA"),
          },
          {
            kind: "transfer_regions",
            group: "french_west_africa",
            to: T("FRA"),
          },
          {
            kind: "divisions",
            who: T("FRA"),
            template: "fra_colonial_ii",
            count: 4,
            where: { group: "french_north_africa" },
          },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "set_gflag", flag: "vic_torch_done" },
          { kind: "war_support", pct: 5 },
        ],
      },
    ],
  },
  // #26, 1942-11-11 (beat): after the landings, Germany occupies the free
  // zone and Italy Corsica; Vichy loses its neutrality.
  {
    id: "deu_case_anton",
    kind: "country",
    picture: "column",
    receivers: ["DEU"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      gflag("vic_torch_done"),
      { kind: "country_state", tag: "VIC", state: "active" },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_vic_case_anton" },
          { kind: "occupation_zone", group: "france_free_zone", seize: true },
          {
            kind: "occupation_zone",
            who: T("ITA"),
            group: "corsica",
            seize: true,
          },
          {
            kind: "make_subject",
            target: T("VIC"),
            level: "integrated",
            neutral: false,
          },
          { kind: "fire_event", id: "vic_toulon", to: T("VIC"), days: 16 },
        ],
      },
    ],
  },
  // #27, 1942-11-27: fired by deu_case_anton.
  {
    id: "vic_toulon",
    kind: "country",
    picture: "map",
    timeoutSec: 30,
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_vic_toulon" },
          { kind: "scuttle_fleet", pct: 100 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "transfer_ships", to: T("FRA"), pct: 100 }],
      },
    ],
  },
  // Chain: 1942-04-18, a constitutional act creates a head of government
  // under the head of state (both titles, spec §19.5).
  {
    id: "vic_head_of_government",
    kind: "country",
    picture: "document",
    date: { on: "1942-04-18", to: ["VIC"] },
    trigger: { kind: "ruling", ideology: "neutral" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "set_leader", person: "title:vic_prime_minister" },
          { kind: "stability", pct: -5 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  // #40, 1944-08-19 (beat): the exile government, Paris still held by the
  // enemy. "Allies touching Paris" has no condition kind; the date after the
  // landings stands in for it.
  {
    id: "fra_paris_uprising",
    kind: "country",
    picture: "crowd",
    receivers: ["FRA"],
    trigger: all(
      any({ kind: "is_human" }, not({ kind: "historical_ai" })),
      { kind: "is_exile" },
      after("1944-08-19"),
      not({ kind: "controls_group", group: "paris" }),
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_fra_paris_uprising" },
          { kind: "uprising", group: "paris" },
        ],
      },
    ],
  },
  // Fired by fra_leagues_in_government: the regime gives way to an
  // authoritarian government, or the left rises.
  {
    id: "fra_regime_crisis",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 10 },
        effects: [
          {
            kind: "random_list",
            options: [
              {
                weight: 60,
                effects: [{ kind: "set_government", ideology: "neutral" }],
              },
              {
                weight: 40,
                effects: [{ kind: "civil_war", ideology: "communist" }],
              },
            ],
          },
        ],
      },
    ],
  },
];
