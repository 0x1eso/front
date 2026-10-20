// World War 1936 P6 — Dominions pack events (spec §11.13). Option `self` is
// the receiver. People are named by office only (spec §24-2): the
// Australian and Canadian prime ministers are "the Prime Minister".
// Data only (ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T } from "../helpers";

export const DOM_EVENTS: EventDef[] = [
  {
    // Australia adopted the Statute of Westminster by an act assented on
    // 1942-10-09, backdated to 1939-09-03; New Zealand did so in 1947. The
    // focus dom_westminster fires it for Australia and New Zealand too.
    id: "dom_statute_debate",
    kind: "country",
    picture: "document",
    date: { on: "1942-10-09", to: ["AUS"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          {
            kind: "if",
            cond: { kind: "is_subject" },
            then: [{ kind: "autonomy", pct: 5 }],
          },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "pp", amount: 25 },
        ],
      },
    ],
  },
  {
    // 1944-11-22: the order-in-council sending 16,000 home-defence (NRMA)
    // conscripts overseas, after the infantry reinforcement shortage.
    id: "can_conscription_crisis",
    kind: "country",
    picture: "crowd",
    date: { on: "1944-11-22", to: ["CAN"] },
    trigger: { kind: "at_war_with", of: T("DEU") },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "manpower", amount: 16000 },
          { kind: "stability", pct: -10 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: -5 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // 1941-12-27: the Prime Minister's New Year article "The Task Ahead" in
    // the Melbourne Herald, turning Australia toward the United States.
    id: "aus_curtin_appeal",
    kind: "country",
    picture: "newspaper",
    date: { on: "1941-12-27", to: ["AUS"] },
    trigger: { kind: "at_war_with", of: T("JPN") },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 30, days: 365 },
          { kind: "opinion", of: T("USA"), value: 30, days: 365 },
          {
            kind: "if",
            cond: { kind: "is_subject" },
            then: [{ kind: "autonomy", pct: 5 }],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
    ],
  },
];
