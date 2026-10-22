// World War 1936 P3 — the 15 generic events (spec §19.6 end), any country.
// The engine fires gen_election, gen_regime_crisis, gen_guarantee_called,
// gen_call_to_arms, the four gen_diplo_* requests, gen_coup_done and
// gen_justified_against itself (ENGINE_EVENTS, plan Task 1 Step 15).
// Texts: ww1936.event_title.<id>, ww1936.event_desc.<id>, ww1936.event_opt.<id>.<opt>.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, not } from "../helpers";

/** Another ideology holds more than half the vote (spec §5.4). */
const OTHER_MAJORITY: Condition = any(
  { kind: "pop_ge", ideology: "communist", pct: 51 },
  { kind: "pop_ge", ideology: "fascist", pct: 51 },
  { kind: "pop_ge", ideology: "neutral", pct: 51 },
);
const DEM_MAJORITY: Condition = {
  kind: "pop_ge",
  ideology: "democratic",
  pct: 50,
};
const CALM: Condition = { kind: "stability_ge", pct: 50 };

export const GENERIC_EVENTS: EventDef[] = [
  // ---- government ----
  {
    id: "gen_election",
    kind: "country",
    once: "never",
    picture: "crowd",
    options: [
      {
        id: "a",
        available: DEM_MAJORITY,
        effects: [{ kind: "stability", pct: 3 }],
        ai: { base: 100 },
      },
      {
        id: "b",
        available: all(not(DEM_MAJORITY), OTHER_MAJORITY),
        effects: [{ kind: "set_government", ideology: "largest_other" }],
        ai: { base: 70 },
      },
      {
        id: "c",
        available: all(not(DEM_MAJORITY), OTHER_MAJORITY),
        effects: [
          { kind: "stability", pct: -15 },
          { kind: "popularity", ideology: "democratic", pp: 5 },
          { kind: "elections", postponeDays: 365 },
        ],
        ai: { base: 30 },
      },
      {
        id: "d",
        available: all(not(OTHER_MAJORITY), not(DEM_MAJORITY)),
        effects: [{ kind: "stability", pct: -5 }],
        ai: { base: 100 },
      },
    ],
  },
  {
    id: "gen_government_shift",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        effects: [{ kind: "set_government", ideology: "largest_other" }],
        ai: { base: 70 },
      },
      { id: "b", effects: [{ kind: "stability", pct: -5 }], ai: { base: 30 } },
    ],
  },
  {
    id: "gen_regime_crisis",
    kind: "country",
    once: "never",
    picture: "crowd",
    options: [
      {
        id: "a",
        effects: [
          { kind: "set_government", ideology: "largest_other" },
          { kind: "stability", pct: -10 },
        ],
        ai: { base: 40, mods: [{ if: CALM, factor: 50 }] },
      },
      {
        id: "b",
        available: { kind: "stability_ge", pct: 25 },
        effects: [
          { kind: "popularity", ideology: "largest_other", pp: -15 },
          { kind: "stability", pct: -15 },
          { kind: "war_support", pct: -5 },
        ],
        ai: { base: 60, mods: [{ if: CALM, factor: 133 }] },
      },
      {
        id: "c",
        available: not({ kind: "stability_ge", pct: 25 }),
        effects: [{ kind: "civil_war", ideology: "largest_other" }],
        // P5 balance (Task 18): 60 → 20 (2–6 civil wars a game with the
        // historical AI off; target 0–3).
        ai: { base: 20 },
      },
    ],
  },
  // ---- war and alliances (from = the country that calls, target = the enemy) ----
  {
    id: "gen_guarantee_called",
    kind: "country",
    once: "never",
    aiDelayDays: [2, 2],
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        available: not({ kind: "same_faction", of: "target" }),
        effects: [{ kind: "join_war", of: "target" }],
        ai: { base: 85 },
      },
      {
        id: "b",
        effects: [
          { kind: "stability", pct: -10 },
          { kind: "war_support", pct: -5 },
          { kind: "end_guarantee", of: "from" },
          { kind: "opinion", of: "all", value: -20, days: 180 },
        ],
        ai: { base: 15 },
      },
    ],
  },
  {
    id: "gen_call_to_arms",
    kind: "country",
    once: "never",
    picture: "column",
    options: [
      {
        id: "a",
        effects: [{ kind: "join_war", of: "target" }],
        ai: { base: 80 },
      },
      {
        id: "b",
        effects: [
          { kind: "opinion", of: "from", value: -30, days: 180 },
          { kind: "stability", pct: -2 },
        ],
        ai: { base: 20 },
      },
    ],
  },
  // ---- diplomatic requests (the engine picks the AI answer by its acceptance score) ----
  {
    id: "gen_diplo_faction_invite",
    kind: "country",
    once: "never",
    timeoutSec: 20,
    picture: "table",
    options: [
      {
        id: "a",
        effects: [{ kind: "join_faction", of: "from" }],
        ai: { base: 50 },
      },
      { id: "b", effects: [], ai: { base: 50 } },
    ],
  },
  {
    id: "gen_diplo_faction_request",
    kind: "country",
    once: "never",
    timeoutSec: 20,
    picture: "table",
    options: [
      {
        id: "a",
        effects: [{ kind: "join_faction", who: "from", of: "self" }],
        ai: { base: 50 },
      },
      { id: "b", effects: [], ai: { base: 50 } },
    ],
  },
  {
    id: "gen_diplo_nap",
    kind: "country",
    once: "never",
    timeoutSec: 20,
    picture: "table",
    options: [
      { id: "a", effects: [{ kind: "nap", of: "from" }], ai: { base: 50 } },
      {
        id: "b",
        effects: [{ kind: "opinion", of: "from", value: -10, days: 180 }],
        ai: { base: 50 },
      },
    ],
  },
  {
    id: "gen_diplo_access",
    kind: "country",
    once: "never",
    timeoutSec: 20,
    picture: "map",
    options: [
      { id: "a", effects: [{ kind: "access", of: "from" }], ai: { base: 50 } },
      { id: "b", effects: [], ai: { base: 50 } },
    ],
  },
  {
    id: "gen_coup_done",
    kind: "country",
    once: "never",
    picture: "newspaper",
    options: [{ id: "a", effects: [], ai: { base: 1 } }],
  },
  // ---- unrest (checked every 5th day for every country) ----
  {
    id: "gen_strike",
    kind: "country",
    receivers: "any",
    trigger: not({ kind: "stability_ge", pct: 30 }),
    mtthDays: 180,
    once: "never",
    cooldownDays: 180,
    picture: "factory",
    options: [
      {
        id: "a",
        effects: [{ kind: "add_spirit", id: "gen_strike_losses", days: 60 }],
        ai: { base: 50 },
      },
      { id: "b", effects: [{ kind: "pp", amount: -50 }], ai: { base: 50 } },
    ],
  },
  {
    id: "gen_unrest",
    kind: "country",
    receivers: "any",
    trigger: not({ kind: "stability_ge", pct: 20 }),
    mtthDays: 240,
    once: "never",
    cooldownDays: 240,
    picture: "crowd",
    options: [
      { id: "a", effects: [{ kind: "stability", pct: -5 }], ai: { base: 30 } },
      {
        id: "b",
        effects: [{ kind: "take_decision", id: "gen_martial_law" }],
        ai: { base: 70 },
      },
    ],
  },
  {
    id: "gen_peace_movement",
    kind: "country",
    receivers: "any",
    trigger: all({ kind: "at_war" }, not({ kind: "ws_ge", pct: 20 })),
    mtthDays: 120,
    once: "never",
    cooldownDays: 120,
    picture: "crowd",
    options: [
      { id: "a", effects: [{ kind: "stability", pct: -10 }], ai: { base: 50 } },
      {
        id: "b",
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "pp", amount: -50 },
        ],
        ai: { base: 50 },
      },
    ],
  },
  {
    id: "gen_war_weariness",
    kind: "country",
    receivers: "any",
    // Spec: the casualty line at -20% or worse; no casualty condition kind, so lost victory points stand in (plan decision).
    trigger: all({ kind: "at_war" }, { kind: "lost_vp_ge", pct: 20 }),
    mtthDays: 180,
    once: "never",
    cooldownDays: 180,
    picture: "newspaper",
    options: [
      {
        id: "a",
        effects: [{ kind: "war_support", pct: -5 }],
        ai: { base: 50 },
      },
      { id: "b", effects: [{ kind: "pp", amount: -75 }], ai: { base: 50 } },
    ],
  },
  // ---- told at the start of a justification against us ----
  {
    id: "gen_justified_against",
    kind: "country",
    once: "never",
    picture: "border",
    options: [
      {
        id: "a",
        effects: [{ kind: "take_decision", id: "gen_fortify_border" }],
        ai: { base: 1 },
      },
    ],
  },
];
