// ww229: Bulgaria's events. Triggered ones check the situation (a date
// floor at most, never a day); the rest are fired by the tree and the
// decisions. The three "regained" events move the lost-lands stage spirit:
// national catastrophes -> one land -> two -> San Stefano. Data only.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, flag, gflag, not, T } from "../../helpers";

const LAND_A: Condition = flag("bgr_land_dobruja");
const LAND_B: Condition = flag("bgr_land_macedonia");
const LAND_C: Condition = flag("bgr_land_thrace");

/** Re-set the lost-lands stage from the regained-land flags. */
const LAND_STAGE: Effect[] = [
  { kind: "remove_spirit", id: "bgr_sp_national_catastrophes" },
  { kind: "remove_spirit", id: "bgr_sp_lands_one" },
  { kind: "remove_spirit", id: "bgr_sp_lands_two" },
  {
    kind: "if",
    cond: all(LAND_A, LAND_B, LAND_C),
    then: [{ kind: "add_spirit", id: "bgr_sp_san_stefano" }],
    else: [
      {
        kind: "if",
        cond: any(
          all(LAND_A, LAND_B),
          all(LAND_A, LAND_C),
          all(LAND_B, LAND_C),
        ),
        then: [{ kind: "add_spirit", id: "bgr_sp_lands_two" }],
        else: [{ kind: "add_spirit", id: "bgr_sp_lands_one" }],
      },
    ],
  },
];

export const BGR_EVENTS: EventDef[] = [
  {
    // The Military League's leader stands trial after the failed coup.
    id: "bgr_ev_velchev_trial",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "date_lt", date: "1938-01-01" },
    ),
    mtthDays: 120,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // A chamber elected without parties, yet the opposition gets in.
    id: "bgr_ev_partyless_chamber",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(after("1937-06-01"), { kind: "ruling", ideology: "neutral" }),
    mtthDays: 240,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The Macedonian organisation's factions settle scores in Sofia.
    id: "bgr_ev_imro_feud",
    kind: "country",
    receivers: ["BGR"],
    trigger: flag("bgr_imro_tool"),
    mtthDays: 240,
    once: "never",
    cooldownDays: 720,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "war_support", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by bgr_dec_macedonian_bands to the holder of Macedonia (from = Bulgaria).
    id: "bgr_ev_border_incident",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", of: "from", value: -20, days: 365 },
          { kind: "tension", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "fort", where: { borderWith: "from", n: 1 }, amount: 1 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by bgr_dec_seek_award to Berlin or Rome (from = Bulgaria).
    id: "bgr_ev_award_request",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 50,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 30 }, factor: 200 },
          ],
        },
        effects: [
          { kind: "set_gflag", flag: "bgr_award_backed" },
          { kind: "opinion", of: "from", value: 15, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: 25, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
  {
    // A great power has promised to back the revision.
    id: "bgr_ev_award_backed",
    kind: "country",
    receivers: ["BGR"],
    trigger: gflag("bgr_award_backed"),
    mtthDays: 5,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 100 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "war_support", pct: 3 },
          { kind: "unlock_decision", id: "bgr_dec_claim_macedonia" },
          { kind: "unlock_decision", id: "bgr_dec_claim_thrace" },
        ],
      },
    ],
  },
  {
    id: "bgr_ev_dobruja_regained",
    kind: "country",
    receivers: ["BGR"],
    trigger: all({ kind: "owns_group", group: "south_dobruja" }, not(LAND_A)),
    mtthDays: 5,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 100 },
        effects: [
          { kind: "set_flag", flag: "bgr_land_dobruja" },
          ...LAND_STAGE,
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  {
    id: "bgr_ev_macedonia_regained",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      { kind: "owns_group", group: "vardar_macedonia" },
      not(LAND_B),
    ),
    mtthDays: 5,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 100 },
        effects: [
          { kind: "set_flag", flag: "bgr_land_macedonia" },
          ...LAND_STAGE,
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    id: "bgr_ev_thrace_regained",
    kind: "country",
    receivers: ["BGR"],
    trigger: all({ kind: "owns_group", group: "greek_thrace" }, not(LAND_C)),
    mtthDays: 5,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 100 },
        effects: [
          { kind: "set_flag", flag: "bgr_land_thrace" },
          ...LAND_STAGE,
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // A Soviet envoy offers a pact of mutual assistance while Europe burns.
    id: "bgr_ev_sobolev_mission",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      exists("SUN"),
      { kind: "at_war", who: T("DEU") },
      not({ kind: "at_war" }),
      not({ kind: "in_faction" }),
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 180,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "nap", of: T("SUN") },
          { kind: "add_spirit", id: "bgr_sp_soviet_friendship" },
          { kind: "opinion", who: T("SUN"), of: "self", value: 30, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // The German army asks to cross Bulgaria toward Greece and Yugoslavia.
    id: "bgr_ev_german_transit",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not({ kind: "has_access_from", who: T("DEU"), of: "self" }),
      any(
        { kind: "at_war_with", who: T("DEU"), of: T("GRC") },
        { kind: "at_war_with", who: T("DEU"), of: T("YUG") },
        { kind: "at_war_with", who: T("ITA"), of: T("GRC") },
      ),
    ),
    mtthDays: 30,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "access", of: T("DEU") },
          { kind: "opinion", who: T("DEU"), of: "self", value: 25, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -30, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // The Axis asks its new member for a declaration against the Western powers.
    id: "bgr_ev_symbolic_war",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      { kind: "same_faction", of: T("DEU") },
      exists("GBR"),
      { kind: "at_war_with", who: T("DEU"), of: T("GBR") },
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    mtthDays: 60,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "declare_war", on: T("GBR") },
          { kind: "add_spirit", id: "bgr_sp_symbolic_war" },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -25, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The Legions' leader is shot at his door by a partisan cell.
    id: "bgr_ev_lukov_shot",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      after("1942-06-01"),
      not({ kind: "ruling", ideology: "fascist" }),
      not({ kind: "ruling", ideology: "communist" }),
      { kind: "pop_ge", ideology: "communist", pct: 8 },
    ),
    mtthDays: 365,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "popularity", ideology: "fascist", pp: -1 },
        ],
      },
    ],
  },
  {
    // The Tsar dies suddenly after a hard meeting abroad; his son is a child.
    id: "bgr_ev_tsar_dies",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(
      after("1943-06-01"),
      { kind: "ruling", ideology: "neutral" },
      { kind: "leader", person: "leader_bgr" },
    ),
    mtthDays: 150,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "remove_spirit", id: "bgr_sp_tsars_personal_rule" },
          { kind: "remove_spirit", id: "bgr_sp_tsars_firm_rule" },
          { kind: "add_spirit", id: "bgr_sp_regency" },
          {
            kind: "if",
            cond: flag("bgr_regency_prepared"),
            then: [{ kind: "stability", pct: -2 }],
            else: [{ kind: "stability", pct: -5 }],
          },
          { kind: "set_leader", person: "bgr_filov" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "remove_spirit", id: "bgr_sp_tsars_personal_rule" },
          { kind: "remove_spirit", id: "bgr_sp_tsars_firm_rule" },
          { kind: "add_spirit", id: "bgr_sp_regency" },
          { kind: "popularity", ideology: "democratic", pp: 4 },
          { kind: "popularity", ideology: "neutral", pp: -3 },
          { kind: "set_leader", person: "bgr_bagryanov" },
        ],
      },
    ],
  },
  {
    // The deputy speaker's letter and the deputies' protest against the deportations.
    id: "bgr_ev_peshev_letter",
    kind: "country",
    receivers: ["BGR"],
    trigger: all(after("1943-01-01"), { kind: "same_faction", of: T("DEU") }),
    mtthDays: 120,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
          { kind: "add_advisor_candidate", person: "bgr_peshev" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 5, days: 365 },
        ],
      },
    ],
  },
  {
    // Allied bombers over the capital.
    id: "bgr_ev_sofia_bombed",
    kind: "country",
    receivers: ["BGR"],
    trigger: any(
      { kind: "at_war_with", of: T("GBR") },
      { kind: "at_war_with", of: T("USA") },
    ),
    mtthDays: 240,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: -4 },
          { kind: "add_spirit", id: "bgr_sp_sofia_shelters", days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "stability", pct: -4 },
        ],
      },
    ],
  },
  {
    // Fired by bgr_feelers_in_cairo: an envoy meets the Allies in Cairo.
    id: "bgr_ev_cairo_talks",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "set_flag", flag: "bgr_armistice_ready" },
          { kind: "war_support", pct: -5 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by bgr_dec_federation_offer to Yugoslavia (from = Bulgaria).
    id: "bgr_ev_federation_proposal",
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
            key: "ww1936.rename.bgr_south_slav_federation",
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
