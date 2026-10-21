// World War 1936 P4 — the national spirits the P3 focuses gain once P4's
// navy and air values are real (spec §16.4; the "// ---- p4 ----" section
// as its own file, P3 plan decision 31). The focus each comes from is named
// above it; the focus edits themselves are plan Task 13 Step 7.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_P4: SpiritDef[] = [
  // deu_dispersal: bomb damage taken -15%
  { id: "p4_dispersal", icon: "factory", stats: { bombDamageTakenPct: -15 } },
  // deu_dive_bombers: close air support +10%
  { id: "p4_dive_bombing", icon: "bomber", stats: { casPct: 10 } },
  // deu_uboats: submarine attack +10%, convoy raiding +15%
  {
    id: "p4_uboat_priority",
    icon: "submarine",
    stats: { subAttackPct: 10, convoyRaidPct: 15 },
  },
  // deu_battle_fleet: navy attack +5%, positioning +5%
  {
    id: "p4_high_seas_fleet",
    icon: "ship",
    stats: { navyAttackPct: 5, positioningPct: 5 },
  },
  // gbr_fighter_command: air defence +5%
  { id: "p4_fighter_command", icon: "plane", stats: { airDefensePct: 5 } },
  // gbr_bomber_command: strategic bombing +10%
  { id: "p4_bomber_command", icon: "bomber", stats: { stratBombPct: 10 } },
  // gbr_convoy_system: convoy escort +25% (the focus also gives 100 convoys)
  { id: "p4_convoy_system", icon: "shield", stats: { convoyEscortPct: 25 } },
  // gbr_fleet_air_arm: naval strike +10%
  { id: "p4_fleet_air_arm", icon: "carrier", stats: { navalStrikePct: 10 } },
  // sun_ground_attack: close air support +10%
  { id: "p4_shturmovik", icon: "plane", stats: { casPct: 10 } },
  // sun_submarines: submarine attack +10%
  { id: "p4_submarine_fleet", icon: "submarine", stats: { subAttackPct: 10 } },
];
