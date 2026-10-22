// World War 1936 P6 — decisions of the Latin American pack (lane K4). Texts:
// ww1936.decision.<id>, ww1936.decision_desc.<id>. In `available` and the
// effects, self = the deciding country. Data only (ContentPurity).
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../helpers";

export const PACK_WORLD_DECISIONS: DecisionDef[] = [
  {
    // Unlocked by lat_hemisphere_defense and the Rio conference. The request
    // goes to the leader of the American camp (pan_american, P5 usa tree) or,
    // when the United States leads none, to the Allies (as gen_join_allies).
    id: "lat_join_hemisphere",
    category: "diplomacy",
    for: [
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
    locked: true,
    available: all(
      not({ kind: "in_faction" }),
      any(
        { kind: "in_faction", who: T("USA") },
        { kind: "in_faction", who: T("GBR") },
      ),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "if",
        cond: { kind: "in_faction", who: T("USA") },
        then: [
          {
            kind: "fire_event",
            id: "gen_diplo_faction_request",
            to: { factionLeaderOf: T("USA") },
          },
        ],
        else: [
          {
            kind: "fire_event",
            id: "gen_diplo_faction_request",
            to: { factionLeaderOf: T("GBR") },
          },
        ],
      },
    ],
    ai: { base: 30 },
  },
  {
    // Unlocked by mex_squadron. Escuadrón 201 trained in Texas on P-47s and
    // flew from Luzon in 1945 beside US units. Mexico is at war by then, so
    // P5 volunteers (for countries not at war) cannot carry it: a year's
    // spirit and US relations instead (report: deviation).
    id: "mex_volunteer_squadron",
    category: "military",
    for: ["MEX"],
    locked: true,
    available: all(
      exists("USA"),
      any(
        { kind: "at_war_with", of: T("JPN") },
        { kind: "at_war_with", of: T("DEU") },
      ),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "add_spirit", id: "mex_squadron_201", days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 10 },
  },
];
