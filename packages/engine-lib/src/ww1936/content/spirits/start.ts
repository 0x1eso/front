// World War 1936 P3 (spec §9.2): the starting national spirits (lane K6).
// Names and texts: ww1936.spirit.<id>, ww1936.spirit_desc.<id>. Values are
// the spec table's; COUNTRY_POLITICS (countries.ts) hands them out.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_START: readonly SpiritDef[] = [
  // Germany. Versailles arts. 42-44 and Locarno (1925) kept the Rhineland free of troops and forts.
  {
    id: "deu_rhineland_dmz",
    icon: "fort",
    stats: {},
    rules: [{ dmz: "rhineland" }],
  },
  // Conscription restored on 1935-03-16.
  {
    id: "deu_rearmament",
    icon: "factory_mil",
    stats: { milConstructionPct: 15, consumerGoodsPp: 3 },
  },
  // Italy. The invasion of Ethiopia began on 1935-10-03; League sanctions applied from 1935-11-18.
  {
    id: "ita_abyssinia",
    icon: "map",
    stats: { warSupportBp: 1000, consumerGoodsPp: 5 },
  },
  {
    id: "ita_sanctions",
    icon: "scales",
    stats: { tradeCostPct: -25, stabilityBp: -500 },
  },
  // Japan.
  {
    id: "jpn_service_rivalry",
    icon: "compass",
    stats: { ppGainPct: -10, researchPct: -5 },
  },
  // United Kingdom.
  {
    id: "gbr_peace_mood",
    icon: "dove",
    stats: { warSupportBp: -1000, conscriptionCostPct: 50 },
  },
  {
    id: "gbr_empire",
    icon: "globe",
    stats: { nonCoreManpowerPp: 5, ppGainPct: 5 },
  },
  // France. The "classes creuses": the small cohorts born 1915-1919 reach call-up age in 1935-1939.
  {
    id: "fra_divided",
    icon: "chain_broken",
    stats: { stabilityBp: -1000, ppGainPct: -15 },
  },
  {
    id: "fra_defensive_mind",
    icon: "fort",
    stats: { defensePct: 5, attackPct: -5, fortConstructionPct: 25 },
  },
  { id: "fra_hollow_years", icon: "infantry", stats: { recruitablePct: -10 } },
  // United States. The first Neutrality Act passed on 1935-08-31.
  {
    id: "usa_depression",
    icon: "factory",
    stats: { consumerGoodsPp: 10, stabilityBp: -1000 },
  },
  {
    id: "usa_isolation",
    icon: "shield",
    stats: { warSupportBp: -1500 },
    rules: ["no_faction", "no_justify"],
  },
  // Soviet Union. The second five-year plan ran 1933-1937.
  {
    id: "sun_five_year_plans",
    icon: "industry",
    stats: {
      milConstructionPct: 10,
      civConstructionPct: 10,
      consumerGoodsPp: 5,
    },
  },
  // China.
  {
    id: "chn_warlords",
    icon: "flag",
    stats: { ppGainPct: -20, stabilityBp: -1000 },
  },
  // Both Spains (the id differs from the news event esp_civil_war).
  {
    id: "esp_civil_war_nation",
    icon: "fist",
    stats: { warSupportBp: 1500, outputPct: -10 },
  },
  // Poland.
  {
    id: "pol_between",
    icon: "shield",
    stats: { warSupportBp: 1000, fortConstructionPct: 25 },
  },
  // Switzerland and Sweden.
  {
    id: "gen_armed_neutrality",
    icon: "tower",
    stats: { defensePct: 10, enemyJustifyTimePct: 50 },
  },
];
