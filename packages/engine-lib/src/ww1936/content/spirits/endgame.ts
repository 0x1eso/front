// World War 1936 P5 (spec §6.4, §10.4, §19.1, §19.4): the generic endgame
// spirits of content lane K5.
import type { SpiritDef } from "../types";

export const SPIRITS_ENDGAME: SpiritDef[] = [
  {
    // The peace conference's "disarm" demand (spec §6.4), 1,095 days.
    id: "gen_arms_limit",
    icon: "chain_broken",
    stats: { outputPct: -50 },
    rules: [{ maxDivisions: 12 }, "no_naval_build"],
  },
  {
    // The Non-Intervention Committee (spec §19.1): no volunteers or
    // lend-lease for either side in Spain.
    id: "gen_non_intervention",
    icon: "dove",
    stats: {},
    rules: [{ noAidTo: ["ESR", "ESN"] }],
  },
  {
    // A government in exile holds no elections (spec §10.4).
    id: "gen_exile_no_elections",
    icon: "ballot",
    hidden: true,
    stats: {},
    rules: ["no_elections"],
  },
  {
    // gen_exile_resistance: occupied cores of the exile resist more.
    id: "gen_resistance_support",
    icon: "fist",
    stats: { resistanceTargetPct: 15 },
  },
  {
    // gen_partisan_support: occupied cores of an active country resist more.
    id: "gen_partisan_support_spirit",
    icon: "sword",
    stats: { resistanceTargetPct: 10 },
  },
];
