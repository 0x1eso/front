// ww229 (design ww227 §5): Czechoslovakia's decisions. The mechanism: three
// levels of border fortification (spirits csk_forts_1..3, each a decision
// the fortification focuses unlock), the call for the allies' guarantee,
// general mobilisation, Škoda's arms sales and the Danube union offers.
// Data only (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";

const AT_PEACE: Condition = not({ kind: "at_war" });
const NO_FORTS: Condition = all(
  not({ kind: "has_spirit", id: "csk_forts_1" }),
  not({ kind: "has_spirit", id: "csk_forts_2" }),
  not({ kind: "has_spirit", id: "csk_forts_3" }),
);

export const CSK_DECISIONS: DecisionDef[] = [
  // ---------------------------------------------------------------- forts
  {
    id: "csk_forts_light",
    category: "military",
    for: ["CSK"],
    locked: true,
    available: NO_FORTS,
    cost: { pp: 50 },
    days: 90,
    completeEffects: [
      { kind: "add_spirit", id: "csk_forts_1" },
      { kind: "fort", where: { borderWith: T("DEU"), n: 3 }, amount: 1 },
    ],
    ai: { base: 30 },
  },
  {
    id: "csk_forts_heavy",
    category: "military",
    for: ["CSK"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "csk_forts_1" },
      { kind: "owns_group", group: "sudetenland" },
    ),
    cost: { pp: 75 },
    days: 120,
    completeEffects: [
      { kind: "swap_spirit", from: "csk_forts_1", to: "csk_forts_2" },
      { kind: "fort", where: { group: "sudetenland" }, amount: 1 },
    ],
    ai: { base: 25 },
  },
  {
    id: "csk_forts_complete",
    category: "military",
    for: ["CSK"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "csk_forts_2" },
      { kind: "owns_group", group: "sudetenland" },
    ),
    cost: { pp: 100 },
    days: 150,
    completeEffects: [
      { kind: "swap_spirit", from: "csk_forts_2", to: "csk_forts_3" },
      { kind: "fort", where: { group: "sudetenland" }, amount: 1 },
      { kind: "fort", where: { borderWith: T("HUN"), n: 2 }, amount: 1 },
    ],
    ai: { base: 20 },
  },
  // ---------------------------------------------------------------- the allies
  {
    id: "csk_ask_france",
    category: "diplomacy",
    for: ["CSK"],
    available: all(
      exists("FRA"),
      not({ kind: "guaranteed_by", of: T("FRA") }),
      not({ kind: "at_war_with", of: T("FRA") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "csk_ally_request", to: T("FRA") }],
    ai: {
      base: 10,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },
  {
    id: "csk_ask_britain",
    category: "diplomacy",
    for: ["CSK"],
    available: all(
      exists("GBR"),
      not({ kind: "guaranteed_by", of: T("GBR") }),
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "csk_ally_request", to: T("GBR") }],
    ai: {
      base: 5,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },
  {
    id: "csk_ask_moscow",
    category: "diplomacy",
    for: ["CSK"],
    available: all(
      exists("SUN"),
      not({ kind: "guaranteed_by", of: T("SUN") }),
      not({ kind: "at_war_with", of: T("SUN") }),
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "csk_ally_request", to: T("SUN") }],
    ai: {
      base: 5,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },
  {
    id: "csk_general_mobilisation",
    category: "military",
    for: ["CSK"],
    locked: true,
    available: all(
      not({ kind: "has_spirit", id: "csk_mobilised" }),
      any(
        { kind: "at_war" },
        { kind: "threat_ge", of: T("DEU"), pct: 50 },
        { kind: "justifying_on", who: T("DEU"), of: "self" },
      ),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "add_spirit", id: "csk_mobilised", days: 180 },
      { kind: "manpower", amount: 50000 },
    ],
    ai: { base: 30 },
  },
  // ---------------------------------------------------------------- Škoda
  {
    id: "csk_skoda_sale_rou",
    category: "economy",
    for: ["CSK"],
    locked: true,
    available: all(
      exists("ROU"),
      AT_PEACE,
      not({ kind: "at_war", who: T("ROU") }),
    ),
    cooldownDays: 365,
    effects: [
      {
        kind: "send_equipment",
        to: T("ROU"),
        type: "light_tank",
        count: 30,
        item: "csk_lt35",
      },
      { kind: "pp", amount: 35 },
      { kind: "opinion", who: T("ROU"), of: "self", value: 20, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "csk_skoda_sale_yug",
    category: "economy",
    for: ["CSK"],
    locked: true,
    available: all(
      exists("YUG"),
      AT_PEACE,
      not({ kind: "at_war", who: T("YUG") }),
    ),
    cooldownDays: 365,
    effects: [
      {
        kind: "send_equipment",
        to: T("YUG"),
        type: "artillery",
        count: 60,
        item: "csk_100_vz30",
      },
      { kind: "pp", amount: 35 },
      { kind: "opinion", who: T("YUG"), of: "self", value: 20, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "csk_skoda_sale_abroad",
    category: "economy",
    for: ["CSK"],
    locked: true,
    available: AT_PEACE,
    cost: { equipment: ["infantry_equipment", 1000] },
    cooldownDays: 365,
    effects: [
      { kind: "pp", amount: 40 },
      { kind: "research_bonus", branch: "infantry", pct: 30, uses: 1 },
    ],
    ai: { base: 8 },
  },
  {
    id: "csk_move_industry_east",
    category: "economy",
    for: ["CSK"],
    locked: true,
    available: { kind: "owns_group", group: "slovakia" },
    cost: { pp: 50 },
    days: 60,
    completeEffects: [
      {
        kind: "move_buildings",
        from: { regions: [361] },
        to: { regions: [410] },
        building: "mil",
        count: 2,
      },
    ],
    ai: {
      base: 2,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 60 }, factor: 500 }],
    },
  },
  // ---------------------------------------------------------------- the Danube
  {
    id: "csk_danube_union_aut",
    category: "annexation",
    for: ["CSK"],
    locked: true,
    available: all(
      exists("AUT"),
      not({ kind: "at_war_with", of: T("AUT") }),
      not({ kind: "in_faction", who: T("AUT") }),
      { kind: "opinion_ge", who: T("AUT"), of: "self", value: 30 },
    ),
    cost: { pp: 100 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "csk_danube_offer", to: T("AUT") }],
    ai: { base: 10 },
  },
  {
    id: "csk_danube_union_hun",
    category: "annexation",
    for: ["CSK"],
    locked: true,
    available: all(
      exists("HUN"),
      not({ kind: "at_war_with", of: T("HUN") }),
      not({ kind: "in_faction", who: T("HUN") }),
      { kind: "opinion_ge", who: T("HUN"), of: "self", value: 30 },
    ),
    cost: { pp: 100 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "csk_danube_offer", to: T("HUN") }],
    ai: { base: 10 },
  },
];
