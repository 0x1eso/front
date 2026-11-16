// ww229: Canada's events. Texts ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. Inside a fired
// event self is the receiver and from the sender. No event waits for a
// calendar day: each one fires when its situation arises (the AI judges it).
// The older dated can_conscription_crisis (events/dom.ts) still fires on
// its own; these follow the conscription question as the game plays it.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, done, exists, flag, not, T } from "../../helpers";

const AT_WAR_DEU: Condition = { kind: "at_war_with", of: T("DEU") };
const PLEDGE_GONE: Condition = any(
  { kind: "has_spirit", id: "can_pledge_released" },
  { kind: "has_spirit", id: "can_overseas_conscription" },
);
const AUTONOMY_5: Effect = {
  kind: "if",
  cond: { kind: "is_subject" },
  then: [{ kind: "autonomy", pct: 5 }],
};
/** The draft goes overseas: the step the decision can_overseas_draft also takes. */
const DRAFT_OVERSEAS: readonly Effect[] = [
  {
    kind: "swap_spirit",
    from: "can_pledge_released",
    to: "can_overseas_conscription",
  },
  { kind: "manpower", amount: 16000 },
  { kind: "stability", pct: -6 },
  { kind: "add_spirit", id: "can_quebec_unrest", days: 256 },
];

export const CAN_EVENTS: readonly EventDef[] = [
  {
    // Fired by can_relief_camps_closed: the camp men who rode the freights.
    id: "can_on_to_ottawa",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: -25 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "popularity", ideology: "communist", pp: 2 },
        ],
      },
    ],
  },
  {
    // Fired by can_padlock_act: Quebec's law against "communist propaganda".
    id: "can_padlock_law",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "popularity", ideology: "neutral", pp: -3 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The auto workers of Oshawa strike for their own industrial union.
    id: "can_oshawa_strike",
    kind: "country",
    picture: "factory",
    receivers: ["CAN"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      done("can_consumer_factories"),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "pp", amount: -20 },
        ],
      },
    ],
  },
  {
    // Alberta's Social Credit banking laws come before Ottawa.
    id: "can_alberta_disallowance",
    kind: "country",
    picture: "document",
    receivers: ["CAN"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      not({ kind: "at_war" }),
    ),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: -2 },
          { kind: "stability", pct: -1 },
          { kind: "pp", amount: 25 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // Fired by can_welcome_the_king.
    id: "can_royal_tour",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: 4 },
          { kind: "war_support", pct: 2 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // Britain is at war with Germany; Canada's Parliament has not voted yet.
    id: "can_war_vote",
    kind: "country",
    picture: "newspaper",
    receivers: ["CAN"],
    trigger: all(
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not(AT_WAR_DEU),
      not(done("can_stay_out")),
      not(done("can_own_declaration")),
    ),
    mtthDays: 10,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "declare_war", on: T("DEU") },
        ],
      },
      {
        id: "b",
        ai: {
          base: 10,
          mods: [
            { if: { kind: "ruling", ideology: "democratic" }, factor: 30 },
          ],
        },
        effects: [
          AUTONOMY_5,
          { kind: "opinion", who: T("GBR"), of: "self", value: -30, days: 365 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by can_air_training_plan: who pays, and whose squadrons.
    id: "can_bcatp_agreement",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "add_spirit", id: "can_bcatp" },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          { kind: "pp", amount: -25 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "add_spirit", id: "can_rcaf_squadrons" },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by can_ogdensburg_board.
    id: "can_ogdensburg",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 30, days: 511 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by can_hyde_park_deal: the dollar shortage.
    id: "can_hyde_park",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "add_spirit", id: "can_hyde_park_dollars", days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // Fired by can_plebiscite: the country votes on releasing the
    // government from its pledge; French Canada votes no.
    id: "can_plebiscite_result",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          {
            kind: "swap_spirit",
            from: "can_home_defence_draft",
            to: "can_pledge_released",
          },
          { kind: "stability", pct: -3 },
          { kind: "add_spirit", id: "can_quebec_unrest", days: 180 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // After the plebiscite a new Quebec party runs against conscription.
    id: "can_bloc_populaire",
    kind: "country",
    picture: "crowd",
    receivers: ["CAN"],
    trigger: PLEDGE_GONE,
    mtthDays: 150,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 4 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: -2 },
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -40 },
        ],
      },
    ],
  },
  {
    // Britain asks for two battalions to stiffen a Pacific garrison.
    id: "can_hong_kong_battalions",
    kind: "country",
    picture: "map",
    receivers: ["CAN"],
    trigger: all(
      AT_WAR_DEU,
      exists("JPN"),
      exists("GBR"),
      not({ kind: "at_war_with", of: T("JPN") }),
      { kind: "threat_ge", of: T("JPN"), pct: 30 },
    ),
    mtthDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "army_xp", amount: 3 },
          { kind: "war_support", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The army in England has waited for years; a raid is offered.
    id: "can_dieppe_raid",
    kind: "country",
    picture: "column",
    receivers: ["CAN"],
    trigger: all(
      AT_WAR_DEU,
      { kind: "war_days_ge", days: 900 },
      done("can_first_division_sails"),
    ),
    mtthDays: 200,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 55 },
        effects: [
          { kind: "army_xp", amount: 15 },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 45 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
          { kind: "war_support", pct: -1 },
        ],
      },
    ],
  },
  {
    // Home-defence conscripts on the Pacific coast refuse to go overseas.
    id: "can_terrace_mutiny",
    kind: "country",
    picture: "crowd",
    receivers: ["CAN"],
    trigger: { kind: "has_spirit", id: "can_overseas_conscription" },
    mtthDays: 60,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [{ kind: "stability", pct: -3 }],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // The infantry runs short; the defence minister demands the draft.
    id: "can_ralston_crisis",
    kind: "country",
    picture: "table",
    receivers: ["CAN"],
    trigger: all(
      { kind: "has_spirit", id: "can_pledge_released" },
      { kind: "at_war" },
      { kind: "war_days_ge", days: 1100 },
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "set_flag", flag: "can_volunteer_drive_tried" },
          { kind: "add_advisor_candidate", person: "can_mcnaughton_minister" },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: DRAFT_OVERSEAS,
      },
    ],
  },
  {
    // The allied leaders meet at the Citadel.
    id: "can_quebec_conference",
    kind: "country",
    picture: "table",
    receivers: ["CAN"],
    trigger: all(
      AT_WAR_DEU,
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("GBR") }),
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    mtthDays: 400,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // A cipher clerk of the Soviet embassy walks out with the files.
    id: "can_gouzenko_affair",
    kind: "country",
    picture: "document",
    receivers: ["CAN"],
    trigger: all(
      exists("SUN"),
      not({ kind: "ruling", ideology: "communist" }),
      not({ kind: "at_war_with", of: T("SUN") }),
      done("can_external_affairs"),
      { kind: "war_days_ge", days: 1200 },
    ),
    mtthDays: 500,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("SUN"), of: "self", value: -30, days: 511 },
          { kind: "popularity", ideology: "communist", pp: -4 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired to Britain by can_newfoundland_confederation. Self is Britain,
    // from Canada.
    id: "can_newfoundland_offer",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        ai: {
          base: 40,
          mods: [{ if: { kind: "at_war" }, factor: 150 }],
        },
        effects: [
          { kind: "fire_event", id: "can_newfoundland_joins", to: T("CAN") },
          {
            kind: "transfer_regions",
            group: "can_newfoundland",
            to: T("CAN"),
            core: true,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("CAN"), of: "self", value: -15, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired to Canada when Britain agrees.
    id: "can_newfoundland_joins",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        ai: { base: 100 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: 50 },
        ],
      },
    ],
  },
  {
    // Quebec's premier calls a snap election against the war effort.
    id: "can_duplessis_election",
    kind: "country",
    picture: "newspaper",
    receivers: ["CAN"],
    trigger: all(AT_WAR_DEU, { kind: "ruling", ideology: "democratic" }),
    mtthDays: 45,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: -4 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 4 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The social democrats lead the polls in the middle of the war.
    id: "can_ccf_breakthrough",
    kind: "country",
    picture: "newspaper",
    receivers: ["CAN"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      { kind: "at_war" },
      { kind: "war_days_ge", days: 900 },
      not(flag("can_ccf_answered")),
    ),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "can_ccf_answered" },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "set_flag", flag: "can_ccf_answered" },
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
];
