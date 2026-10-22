// World War 1936 P5 — the events Italy receives (spec §19.2 rows 4, 29, 32
// and 35, and the alternative Grand Council vote of the focus
// ita_grand_council_check). Option `self` is the receiver, `from` the sender.
// The 1943-07-25 and 1943-09-08 history beats (K5) fire ita_grand_council and
// ita_armistice without checking a trigger, so their historical options are
// guarded by `available` and their other options do nothing when the
// situation did not come about. Germany's side (deu_italy_betrayal,
// deu_social_republic) is K5's.
// The marshal who headed the 1943 government is shown by his office only
// (title:ita_military_premier, see persons/ita.ts).
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, flag, T } from "../helpers";

/** Spec §19.2 #29: still beside Germany, and the Allies in Sicily or a tenth of the victory points lost. */
export const GRAND_COUNCIL_CRISIS: Condition = all(
  { kind: "same_faction", of: T("DEU") },
  any(
    {
      kind: "occupied_by",
      group: "sicily",
      of: { factionLeaderOf: T("GBR") },
    },
    { kind: "occupied_by", group: "sicily", of: T("USA") },
    // Final balance: 10 → 35. Italy's African colonies hold 12 of its 51
    // points, so losing two of them (or Ethiopia's counter-attack) ran the
    // crisis and the armistice in 1939–41 in most games; 35% is all of
    // Africa and a mainland city, as by July 1943 (Sicily, above, holds
    // no points of its own).
    { kind: "lost_vp_ge", pct: 35 },
  ),
);

export const ITA_EVENTS: EventDef[] = [
  {
    // Spec §19.2 #4 (1940-06-24): the armistice of Villa Incisa.
    id: "ita_alpine_armistice",
    kind: "country",
    picture: "border",
    receivers: ["ITA"],
    trigger: all(
      { kind: "capitulated", who: T("FRA") },
      { kind: "at_war" },
      any(
        { kind: "at_war_with", of: T("FRA") },
        { kind: "same_faction", of: T("DEU") },
      ),
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "ita_news_alpine_armistice" },
          // Italy takes the zone from its own border inward (plan decision 26).
          {
            kind: "occupation_zone",
            group: "france_italian_zone",
            seize: true,
          },
        ],
      },
    ],
  },
  {
    // Spec §19.2 #29 (1943-07-25), also the history beat of that day.
    id: "ita_grand_council",
    kind: "country",
    picture: "table",
    receivers: ["ITA"],
    trigger: GRAND_COUNCIL_CRISIS,
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        available: GRAND_COUNCIL_CRISIS,
        ai: { base: 90 },
        effects: [
          { kind: "set_government", ideology: "neutral" },
          { kind: "set_leader", person: "title:ita_military_premier" },
          { kind: "stability", pct: -10 },
          { kind: "set_flag", flag: "ita_july_25" },
          { kind: "news", id: "ita_news_grand_council" },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [
          {
            kind: "if",
            cond: GRAND_COUNCIL_CRISIS,
            then: [
              { kind: "stability", pct: -10 },
              { kind: "war_support", pct: -10 },
            ],
          },
        ],
      },
    ],
  },
  {
    // Spec §19.2 #32 (1943-09-08): Cassibile, signed 09-03, announced 09-08.
    id: "ita_armistice",
    kind: "country",
    picture: "document",
    receivers: ["ITA"],
    trigger: all(
      flag("ita_july_25"),
      { kind: "days_since_flag_ge", flag: "ita_july_25", days: 45 },
      { kind: "same_faction", of: T("DEU") },
    ),
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        available: flag("ita_july_25"),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "ita_news_armistice" },
          { kind: "add_spirit", id: "ita_cobelligerent_prep", days: 35 },
          {
            kind: "fire_event",
            id: "deu_italy_betrayal",
            to: T("DEU"),
            days: 1,
          },
          { kind: "fire_event", id: "ita_cobelligerence", days: 35 },
          { kind: "separate_peace", with: "all" },
          { kind: "leave_faction" },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [
          {
            kind: "if",
            cond: flag("ita_july_25"),
            then: [
              { kind: "war_support", pct: -10 },
              { kind: "stability", pct: -5 },
            ],
          },
        ],
      },
    ],
  },
  {
    // Spec §19.2 #35 (1943-10-13), 35 days after ita_armistice.
    id: "ita_cobelligerence",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_spirit", id: "ita_cobelligerent_prep" },
          { kind: "news", id: "ita_news_cobelligerence" },
          { kind: "join_war", of: T("DEU") },
          {
            kind: "opinion",
            of: { factionLeaderOf: T("GBR") },
            value: 30,
            days: 365,
          },
          {
            kind: "opinion",
            who: { factionLeaderOf: T("GBR") },
            of: "self",
            value: 30,
            days: 365,
          },
          { kind: "opinion", of: T("USA"), value: 30, days: 365 },
          {
            kind: "opinion",
            who: T("USA"),
            of: "self",
            value: 30,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    // From the focus ita_grand_council_check (spec §18.2).
    id: "ita_mussolini_restrained",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          {
            kind: "random_list",
            options: [
              {
                weight: 70,
                effects: [
                  { kind: "set_government", ideology: "neutral" },
                  { kind: "set_leader", person: "title:ita_military_premier" },
                  { kind: "news", id: "ita_news_restrained" },
                ],
              },
              {
                weight: 30,
                effects: [
                  { kind: "stability", pct: -15 },
                  { kind: "set_flag", flag: "restraint_failed" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
