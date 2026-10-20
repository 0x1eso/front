// World War 1936 P6 — Balkan pack events (spec §11.13; content lane K3).
// Texts are ww1936.event_title.<id>, ww1936.event_desc.<id> and
// ww1936.event_opt.<id>.<option>.
//
// Not here because P3/P5 already hold the same history (spec §11.13): the
// Belgrade coup (P3 yug_belgrade_coup), Romania's change of sides on
// 1944-08-23 (P5 rou_august_coup) and Bulgaria's on 1944-09-09 (P5
// bgr_fatherland_front).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, exists, not, T } from "../helpers";

export const BAL_EVENTS: readonly EventDef[] = [
  {
    // 1938-02-10: the king dismisses the cabinet and rules by decree; the new
    // constitution follows by plebiscite on 1938-02-24 (promulgated 02-27).
    id: "bal_royal_dictatorship",
    kind: "country",
    picture: "crowd",
    date: { on: "1938-02-10", to: ["ROU"] },
    trigger: { kind: "ruling", ideology: "neutral" },
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "elections", suspend: true },
          { kind: "popularity", ideology: "neutral", pp: 10 },
          { kind: "popularity", ideology: "fascist", pp: -5 },
          { kind: "stability", pct: 5 },
          { kind: "pp", amount: 50 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 5 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // 1938-07-31: Bulgaria and the Balkan Entente sign at Salonika. The
    // military clauses of the Treaty of Neuilly are set aside; Bulgaria
    // renounces force against its neighbours.
    id: "bal_salonika_agreement",
    kind: "country",
    picture: "table",
    date: { on: "1938-07-31", to: ["BGR"] },
    trigger: all(exists("GRC"), exists("YUG"), exists("ROU")),
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "army_xp", amount: 15 },
          { kind: "opinion", of: T("GRC"), value: 15, days: 365 },
          { kind: "opinion", who: T("GRC"), of: "self", value: 15, days: 365 },
          { kind: "opinion", of: T("YUG"), value: 15, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: 15, days: 365 },
          { kind: "opinion", of: T("ROU"), value: 15, days: 365 },
          { kind: "opinion", who: T("ROU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", of: T("TUR"), value: 15, days: 365 },
          { kind: "opinion", who: T("TUR"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("GRC"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("YUG"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("ROU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // 1940-10-28, about 03:00: the Italian minister hands the Greek prime
    // minister an ultimatum with a three-hour limit; it is refused. The P0
    // beat of the same day declares the war.
    id: "bal_greek_no",
    kind: "country",
    picture: "document",
    date: { on: "1940-10-28", to: ["GRC"] },
    trigger: all(exists("ITA"), not({ kind: "same_faction", of: T("ITA") })),
    timeoutSec: 30,
    historyPct: 95,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 90 },
        effects: [
          { kind: "war_support", pct: 15 },
          { kind: "stability", pct: 5 },
        ],
      },
      {
        id: "b",
        available: not({ kind: "at_war_with", of: T("ITA") }),
        ai: { base: 10 },
        effects: [
          { kind: "access", of: T("ITA") },
          { kind: "stability", pct: -10 },
          { kind: "war_support", pct: -10 },
        ],
      },
    ],
  },
  {
    // Fired by bal_pact (to the Entente partners) and bal_western_tilt (to
    // Britain and France); from = the country asking. Several senders may ask
    // the same country, so it can come again.
    id: "bal_guarantee_request",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 20,
    options: [
      {
        id: "a",
        ai: {
          base: 50,
          mods: [
            {
              if: { kind: "opinion_ge", of: "from", value: 30 },
              factor: 150,
            },
            { if: { kind: "at_war_with", of: "from" }, factor: 0 },
          ],
        },
        effects: [{ kind: "guarantee", of: "from" }],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
];
