// World War 1936 P3 (spec §19.8): national spirits given by the world events
// (content lane K5). Values follow the event table in spec §19.6.
import type { SpiritDef } from "../types";

export const SPIRITS_WORLD: SpiritDef[] = [
  // Italy and Germany: the Rome-Berlin Axis (research +3%).
  { id: "ita_axis_bond", stats: { researchPct: 3 }, icon: "handshake" },
  // France, 365 days after the 1936 election: output -5%, stability +5%.
  {
    id: "fra_forty_hours",
    stats: { outputPct: -5, stabilityBp: 500 },
    icon: "factory",
  },
  // France under Daladier: half of fra_divided (stability -10%, PP -15%).
  {
    id: "fra_divided_half",
    stats: { stabilityBp: -500, ppGainPct: -7 },
    icon: "ballot",
  },
  // United States after the destroyers deal: war support -8%, still no faction.
  {
    id: "usa_isolation_cracked",
    stats: { warSupportBp: -800 },
    icon: "chain_broken",
    rules: ["no_faction", "no_lend_lease"],
  },
  // United States after the 1937 recession: half of usa_depression.
  {
    id: "usa_depression_eased",
    stats: { consumerGoodsPp: 5, stabilityBp: -500 },
    icon: "industry",
  },
];
