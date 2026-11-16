// ww229 (design ww227 §3, §5): Hungary's events. Texts: ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. self = the
// receiver; "from" = the country whose focus or decision fired it. No date
// events: each one waits for its situation (hoi-history-as-flavor).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, done, exists, not, T } from "../../helpers";

const OWNS_SLOVAKIA: Condition = {
  kind: "owns_group",
  group: "south_slovakia",
};
const OWNS_RUTHENIA: Condition = {
  kind: "owns_group",
  group: "carpathian_ruthenia",
};
const OWNS_TRANSYLVANIA: Condition = {
  kind: "owns_group",
  group: "north_transylvania",
};

export const HUN_EVENTS: readonly EventDef[] = [
  // ---- the regency's politics ----
  {
    id: "hun_gombos_dies",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(done("hun_national_work_plan"), {
      kind: "ruling",
      ideology: "neutral",
    }),
    mtthDays: 90,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "stability", pct: -2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    id: "hun_bled_agreement",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("CSK"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("ROU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("CSK"), of: "self", value: -15, days: 365 },
          { kind: "tension", pct: 1 },
        ],
      },
    ],
  },
  {
    id: "hun_arrow_cross_rally",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      { kind: "pop_ge", ideology: "fascist", pct: 25 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 120,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -5 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    id: "hun_szalasi_trial",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    id: "hun_horthy_succession",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    id: "hun_landless_peasants",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      { kind: "has_spirit", id: "hun_landed_estates" },
      not({ kind: "stability_ge", pct: 45 }),
    ),
    mtthDays: 180,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 40 },
        effects: [
          { kind: "remove_spirit", id: "hun_landed_estates" },
          { kind: "pp", amount: -60 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    id: "hun_otto_letter",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "opinion", who: T("AUT"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 40 },
        effects: [{ kind: "stability", pct: 2 }],
      },
    ],
  },
  // ---- the Trianon revision: the staged spirit ----
  {
    id: "hun_first_lands_return",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      { kind: "has_spirit", id: "hun_trianon_wound" },
      any(OWNS_SLOVAKIA, OWNS_RUTHENIA, OWNS_TRANSYLVANIA),
    ),
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_trianon_wound",
            to: "hun_revision_begun",
          },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_trianon_wound",
            to: "hun_revision_begun",
          },
          { kind: "pp", amount: 40 },
        ],
      },
    ],
  },
  {
    id: "hun_second_lands_return",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      { kind: "has_spirit", id: "hun_revision_begun" },
      any(
        all(OWNS_SLOVAKIA, OWNS_RUTHENIA),
        all(OWNS_SLOVAKIA, OWNS_TRANSYLVANIA),
        all(OWNS_RUTHENIA, OWNS_TRANSYLVANIA),
      ),
    ),
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_revision_begun",
            to: "hun_revision_advancing",
          },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_revision_begun",
            to: "hun_revision_advancing",
          },
          { kind: "pp", amount: 40 },
        ],
      },
    ],
  },
  {
    id: "hun_revision_complete",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      { kind: "has_spirit", id: "hun_revision_advancing" },
      OWNS_SLOVAKIA,
      OWNS_RUTHENIA,
      OWNS_TRANSYLVANIA,
    ),
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_revision_advancing",
            to: "hun_revision_fulfilled",
          },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "swap_spirit",
            from: "hun_revision_advancing",
            to: "hun_revision_fulfilled",
          },
          { kind: "pp", amount: 50 },
        ],
      },
    ],
  },
  // ---- the revision's patrons (received by Rome and Berlin) ----
  {
    id: "hun_rome_answers",
    kind: "country",
    once: "never",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", who: "from", flag: "hun_rome_backing" },
          { kind: "opinion", who: "from", of: "self", value: 15, days: 365 },
          { kind: "opinion", of: "from", value: 10, days: 365 },
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
    id: "hun_berlin_answers",
    kind: "country",
    once: "never",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: { kind: "tag", tag: "DEU" }, factor: 100 }],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "hun_berlin_backing" },
          { kind: "opinion", who: "from", of: "self", value: 15, days: 365 },
          { kind: "opinion", of: "from", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  // ---- the Danubian federation (received by Austria or Czechoslovakia) ----
  {
    id: "hun_danube_offer",
    kind: "country",
    once: "never",
    picture: "map",
    options: [
      {
        id: "a",
        ai: {
          base: 5,
          mods: [
            { if: { kind: "threat_ge", of: T("DEU"), pct: 60 }, factor: 400 },
            { if: { kind: "at_war" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_gflag", flag: "danubian_federation_formed" },
          {
            kind: "set_name",
            who: "from",
            key: "ww1936.rename.danubian_federation",
          },
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
        ai: { base: 95 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "fire_event", id: "hun_danube_refused", to: "from" },
        ],
      },
    ],
  },
  {
    id: "hun_danube_refused",
    kind: "country",
    once: "never",
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  // ---- economy ----
  {
    id: "hun_maort_oil",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          {
            kind: "resource",
            where: { regions: [464] },
            res: "oil",
            amount: 2,
          },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          {
            kind: "build",
            where: { regions: [464] },
            building: "fuel_silo",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "hun_flags_of_1848",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 15, days: 365 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
          { kind: "popularity", ideology: "neutral", pp: 1 },
        ],
      },
    ],
  },
  // ---- the war ----
  {
    id: "hun_teleki_dilemma",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      done("hun_eternal_friendship"),
      exists("DEU"),
      exists("YUG"),
      { kind: "at_war_with", who: T("DEU"), of: T("YUG") },
      not({ kind: "at_war_with", of: T("YUG") }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
          { kind: "declare_war", on: T("YUG") },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -25, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    id: "hun_kassa_bombing",
    kind: "country",
    receivers: ["HUN"],
    trigger: all(
      exists("SUN"),
      exists("DEU"),
      { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
      { kind: "same_faction", of: T("DEU") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    mtthDays: 30,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "declare_war", on: T("SUN") },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    id: "hun_talks_discovered",
    kind: "country",
    once: "never",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 5, days: 365 },
        ],
      },
    ],
  },
];
