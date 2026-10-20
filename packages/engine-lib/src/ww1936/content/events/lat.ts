// World War 1936 P6 — Latin American pack events (spec §11.13). Option
// `self` is the receiver. People are named by office only (spec §24-2).
// Data only (ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, any, not } from "../helpers";

export const LAT_EVENTS: EventDef[] = [
  {
    // The Third Meeting of Foreign Ministers, Rio de Janeiro, 1942-01-15 to
    // 01-28: it recommended breaking relations with the Axis. Argentina and
    // Chile held out (Chile broke in January 1943, Argentina in January
    // 1944), so neither option is the history option: the AI weights decide.
    id: "lat_rio_conference",
    kind: "country",
    picture: "table",
    date: {
      on: "1942-01-15",
      to: [
        "MEX",
        "GTM",
        "HND",
        "SLV",
        "NIC",
        "CRI",
        "PAN",
        "CUB",
        "HTI",
        "DOM",
        "COL",
        "VEN",
        "ECU",
        "PER",
        "BOL",
        "BRA",
        "PRY",
        "URY",
        "ARG",
        "CHL",
      ],
    },
    trigger: any(
      { kind: "at_war_with", who: T("USA"), of: T("JPN") },
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
    ),
    options: [
      {
        id: "a",
        available: not({ kind: "same_faction", of: T("DEU") }),
        ai: {
          base: 80,
          mods: [
            { if: { kind: "tag", tag: "ARG" }, factor: 10 },
            { if: { kind: "tag", tag: "CHL" }, factor: 20 },
          ],
        },
        effects: [
          { kind: "opinion", of: T("DEU"), value: -30, days: 365 },
          { kind: "opinion", of: T("ITA"), value: -30, days: 365 },
          { kind: "opinion", of: T("JPN"), value: -30, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
          { kind: "unlock_decision", id: "lat_join_hemisphere" },
        ],
      },
      {
        id: "b",
        ai: {
          base: 20,
          mods: [
            { if: { kind: "tag", tag: "ARG" }, factor: 400 },
            { if: { kind: "tag", tag: "CHL" }, factor: 300 },
          ],
        },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // 1938-03-18: the expropriation decree after the companies refused the
    // labour award the Supreme Court had upheld on 1938-03-01. Britain broke
    // off relations on 1938-05-13/20; the companies organised a boycott.
    id: "mex_oil_crisis",
    kind: "country",
    picture: "newspaper",
    date: { on: "1938-03-18", to: ["MEX"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: 5 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -30, days: 365 },
          { kind: "add_spirit", id: "mex_oil_boycott", days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "pp", amount: -25 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // The first echelon of the FEB sailed from Rio de Janeiro on 1944-07-02
    // aboard the USS General W. A. Mann and landed at Naples on 1944-07-16.
    id: "bra_feb_departure",
    kind: "country",
    picture: "column",
    date: { on: "1944-07-02", to: ["BRA"] },
    trigger: any(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "at_war_with", of: T("ITA") },
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "unlock_template", template: "bra_feb_division" },
          { kind: "add_spirit", id: "bra_feb_veterans", days: 365 },
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "stability", pct: 3 }],
      },
    ],
  },
];
