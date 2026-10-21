// World War 1936 P5 — the Japanese decision (spec §19.3): demand access to
// French Indochina from Vichy (or from France while there is no Vichy).
// The first time it sends Vichy's vic_japanese_demand (K3, the northern
// occupation of 1940-09-22), the second time jpn_south_indochina (the
// southern occupation of 1941-07-28). History beats take it on those days
// (K5); the 180-day cooldown lets the second beat through.
// Inside a targeted decision: self = the decider, "target" = the candidate.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, flag, not } from "../helpers";

export const JPN_DECISIONS: DecisionDef[] = [
  {
    id: "jpn_demand_indochina_access",
    category: "diplomacy",
    for: ["JPN"],
    // Opened by the focus jpn_indochina_bases.
    locked: true,
    available: not(flag("jpn_indochina_south")),
    target: {
      among: all(
        { kind: "exists" },
        any(
          { kind: "tag", tag: "VIC" },
          all(
            { kind: "tag", tag: "FRA" },
            not({ kind: "country_state", tag: "VIC", state: "active" }),
          ),
        ),
      ),
    },
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "if",
        cond: flag("jpn_indochina_north"),
        then: [
          { kind: "fire_event", id: "jpn_south_indochina", to: "target" },
          { kind: "set_flag", flag: "jpn_indochina_south" },
        ],
        else: [
          { kind: "fire_event", id: "vic_japanese_demand", to: "target" },
          { kind: "set_flag", flag: "jpn_indochina_north" },
        ],
      },
    ],
    ai: { base: 10 },
  },
];
