// World War 1936 P5 — American decisions (spec §19.3). The 1941-07-26,
// 1941-08-01 and 1942-01-01 history beats (K5) take them; usa_oil_embargo
// is unlocked by Japan's second Indochina demand (K2, jpn_south_indochina)
// and usa_volunteer_air_group by the focus usa_china_aid.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, exists, not } from "../helpers";

export const USA_DECISIONS: DecisionDef[] = [
  {
    // Every government in exile of the deciding country's faction.
    id: "usa_recognize_exiles",
    category: "diplomacy",
    for: ["USA"],
    available: { kind: "in_faction" },
    cost: { pp: 25 },
    effects: [{ kind: "exile_legitimacy", pct: 5, scope: "faction_exiles" }],
    ai: { base: 10 },
  },
  {
    id: "usa_volunteer_air_group",
    category: "military",
    for: ["USA"],
    locked: true,
    available: all(exists("CHN"), not({ kind: "at_war_with", of: T("JPN") })),
    cost: { pp: 25 },
    effects: [{ kind: "volunteers", to: T("CHN"), planes: 100 }],
    ai: { base: 10 },
  },
  {
    id: "usa_oil_embargo",
    category: "economy",
    for: ["USA"],
    locked: true,
    available: all(exists("JPN"), not({ kind: "at_war_with", of: T("JPN") })),
    cost: { pp: 0 },
    effects: [
      { kind: "embargo", on: T("JPN") },
      { kind: "war_support", who: T("JPN"), pct: 5 },
      { kind: "opinion", who: T("JPN"), of: "self", value: -50, days: 365 },
    ],
    ai: { base: 10 },
  },
];
