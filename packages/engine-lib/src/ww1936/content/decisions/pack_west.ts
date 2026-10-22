// World War 1936 P6 — the decisions of the Spanish and Polish packs (spec
// §11.5, §11.6). Both are locked: a pack focus opens them (the focus
// spa_eastern_division opens spa_send_eastern_division, pol_uprising opens
// pol_order_uprising; Phase B renamed the decisions, because ids are unique
// across focuses and decisions). A decision without cooldownDays is taken
// once.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, not } from "../helpers";

export const PACK_WEST_DECISIONS: DecisionDef[] = [
  {
    // A volunteer division for the war against the Soviet Union, sent while
    // Spain itself stays out of the war (P5 volunteers).
    id: "spa_send_eastern_division",
    category: "military",
    for: ["ESN"],
    locked: true,
    available: all(
      { kind: "exists", who: T("DEU") },
      { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
      not({ kind: "at_war_with", of: T("SUN") }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "volunteers", to: T("DEU"), divisions: 1 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    // "Garrison fill under 50%" has no condition kind; high resistance in the
    // Warsaw group (P5 resistance_ge) stands in. P5 uprising: control goes
    // back to the fighting exile and the uprising divisions appear (lane
    // report, approximations).
    id: "pol_order_uprising",
    category: "military",
    for: ["POL"],
    locked: true,
    available: all(
      { kind: "is_exile" },
      { kind: "resistance_ge", group: "warsaw", pct: 50 },
    ),
    cost: { pp: 50 },
    effects: [{ kind: "uprising", group: "warsaw" }],
    ai: { base: 10 },
  },
];
