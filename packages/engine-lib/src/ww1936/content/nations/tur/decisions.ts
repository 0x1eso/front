// ww229 (design ww227 §5): Turkey's decisions, the straits under Montreux,
// the Sanjak, chromium and the east. Texts: ww1936.decision.<id>,
// ww1936.decision_desc.<id>. The P3 tur_hatay_question (decisions/national.ts)
// stays the way the Sanjak is handed over.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, fire, flag, not, T } from "../../helpers";

const STRAITS_OURS: Condition = all(flag("tur_straits_sovereign"), {
  kind: "owns_group",
  group: "turkish_straits",
});
/** A great war is on somewhere. */
const GREAT_WAR: Condition = any(
  { kind: "at_war" },
  { kind: "at_war", who: T("DEU") },
  { kind: "at_war", who: T("ITA") },
  { kind: "at_war", who: T("SUN") },
  { kind: "at_war", who: T("GBR") },
);

export const TUR_DECISIONS: readonly DecisionDef[] = [
  // ---- the straits ----
  {
    id: "tur_close_the_straits",
    category: "national",
    for: ["TUR"],
    visible: flag("tur_straits_sovereign"),
    available: all(
      STRAITS_OURS,
      GREAT_WAR,
      not({ kind: "has_spirit", id: "tur_straits_closed" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "add_spirit", id: "tur_straits_closed" },
      { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("ITA"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "tur_reopen_the_straits",
    category: "national",
    for: ["TUR"],
    visible: { kind: "has_spirit", id: "tur_straits_closed" },
    available: { kind: "has_spirit", id: "tur_straits_closed" },
    cost: { pp: 10 },
    cooldownDays: 90,
    effects: [
      { kind: "remove_spirit", id: "tur_straits_closed" },
      { kind: "opinion", who: T("SUN"), of: "self", value: 10, days: 365 },
    ],
    ai: {
      base: 2,
      mods: [{ if: { kind: "at_war" }, factor: 0 }],
    },
  },
  {
    id: "tur_levy_straits_dues",
    category: "economy",
    for: ["TUR"],
    visible: flag("tur_straits_sovereign"),
    available: all(
      STRAITS_OURS,
      not({ kind: "has_spirit", id: "tur_straits_dues" }),
    ),
    cost: { pp: 15 },
    effects: [
      { kind: "add_spirit", id: "tur_straits_dues", days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("SUN"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("ITA"), of: "self", value: -10, days: 365 },
    ],
    cooldownDays: 365,
    ai: { base: 3 },
  },
  {
    id: "tur_fortify_the_dardanelles",
    category: "military",
    for: ["TUR"],
    visible: flag("tur_straits_sovereign"),
    available: STRAITS_OURS,
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      {
        kind: "build",
        where: { group: "turkish_straits" },
        building: "coastal_fort",
        count: 1,
      },
      { kind: "fort", where: { group: "turkish_straits" }, amount: 1 },
    ],
    ai: { base: 4 },
  },
  // ---- the Sanjak of Alexandretta ----
  {
    id: "tur_hatay_joint_garrison",
    category: "diplomacy",
    for: ["TUR"],
    visible: flag("tur_hatay_raised"),
    available: all(
      flag("tur_hatay_raised"),
      { kind: "exists", who: T("FRA") },
      { kind: "owns_group", who: T("FRA"), group: "hatay" },
      not({ kind: "at_war_with", of: T("FRA") }),
      not({ kind: "flag", flag: "tur_hatay_garrisoned" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [fire("tur_hatay_garrison", T("FRA"))],
    ai: { base: 10 },
  },
  // ---- chromium ----
  {
    id: "tur_chromium_to_britain",
    category: "economy",
    for: ["TUR"],
    visible: flag("tur_chromium_trade_open"),
    available: all(
      flag("tur_chromium_trade_open"),
      { kind: "exists", who: T("GBR") },
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    cost: { pp: 10 },
    cooldownDays: 365,
    effects: [
      fire("tur_chromium_offer", T("GBR")),
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 8 },
  },
  {
    id: "tur_chromium_to_germany",
    category: "economy",
    for: ["TUR"],
    visible: flag("tur_chromium_trade_open"),
    available: all(
      flag("tur_chromium_trade_open"),
      { kind: "exists", who: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    cost: { pp: 10 },
    cooldownDays: 365,
    effects: [
      fire("tur_chromium_offer", T("DEU")),
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 6 },
  },
  // ---- the east and the reserves ----
  {
    id: "tur_eastern_pacification",
    category: "political",
    for: ["TUR"],
    visible: { kind: "has_spirit", id: "tur_eastern_unrest" },
    available: { kind: "has_spirit", id: "tur_eastern_unrest" },
    cost: { pp: 75 },
    days: 120,
    completeEffects: [
      { kind: "remove_spirit", id: "tur_eastern_unrest" },
      { kind: "infra", where: { group: "eastern_anatolia" }, amount: 1 },
    ],
    ai: { base: 5 },
  },
  {
    id: "tur_call_up_reserves",
    category: "military",
    for: ["TUR"],
    available: any({ kind: "at_war" }, { kind: "wt_ge", pct: 50 }),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", recruitablePct: 1 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 5 },
  },
];
