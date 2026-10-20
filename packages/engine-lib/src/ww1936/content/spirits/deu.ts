// World War 1936 P3 — German national spirits from focuses (spec §19.8, 9)
// plus one carrier for the machine-tools focus's efficiency cap (spec
// §19.3). The starting spirits deu_rhineland_dmz and deu_rearmament are
// K6's (spirits/start.ts). Stability and war support are in bp.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_DEU: SpiritDef[] = [
  // deu_four_year_plan
  {
    id: "deu_fyp_economy",
    icon: "document",
    stats: { milConstructionPct: 10, consumerGoodsPp: -2, rsIndustryPct: 10 },
  },
  // deu_autobahn
  { id: "deu_highway_works", icon: "road", stats: { civConstructionPct: 5 } },
  // deu_war_production (replaces deu_rearmament)
  {
    id: "deu_wartime_output",
    icon: "factory_mil",
    stats: { outputPct: 10, consumerGoodsPp: -3 },
  },
  // deu_tech_mobilization
  { id: "deu_tech_drive", icon: "research", stats: { researchPct: 10 } },
  // deu_wehrmacht
  {
    id: "deu_conscription_back",
    icon: "infantry",
    stats: { recruitablePct: 5 },
  },
  // deu_combined_arms
  {
    id: "deu_combined_doctrine",
    icon: "artillery",
    stats: { breakthroughPct: 5 },
  },
  // deu_infantry: training time -10% (plan Task 1 Step 7, trainPct)
  {
    id: "deu_replacement_system",
    icon: "infantry",
    stats: { trainPct: -10 },
  },
  // deu_staff_college
  {
    id: "deu_war_academy",
    icon: "map",
    stats: { planSpeedPct: 10, generalXpPct: 15 },
  },
  // deu_army_misgivings: stability -5%, army experience +0.1 a day
  {
    id: "deu_generals_doubt",
    icon: "medal",
    stats: { stabilityBp: -500, armyXpMilli: 100 },
  },
  // deu_machine_tools: efficiency cap +10%
  { id: "deu_standard_tools", icon: "industry", stats: { effCapBp: 1000 } },
];
