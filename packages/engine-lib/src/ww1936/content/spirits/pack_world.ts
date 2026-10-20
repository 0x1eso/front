// World War 1936 P6 — national spirits of the Latin American, Dominion and
// new-state packs (lane K4, spec §11.10–§11.12). Stability in bp (100 = 1
// point), experience in milli a day. Data only (ContentPurity).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_PACK_WORLD: SpiritDef[] = [
  // ---- Latin America ----
  // lat_third_way: "안정도 +5%, 정당화 받는 시간 +25%"
  {
    id: "lat_independent_course",
    icon: "compass",
    stats: { stabilityBp: 500, enemyJustifyTimePct: 25 },
  },
  // lat_rubber without rubber regions: "무역 비용 −5%"
  { id: "lat_rubber_trade", icon: "globe", stats: { tradeCostPct: -5 } },
  // lat_export_boom: "무역 비용 −10%"
  { id: "lat_export_trade", icon: "globe", stats: { tradeCostPct: -10 } },
  // arg_neutrality: "정당화 받는 시간 +50%, 무역 비용 −10%"
  {
    id: "arg_neutral_course",
    icon: "dove",
    stats: { enemyJustifyTimePct: 50, tradeCostPct: -10 },
  },
  // mex_oil_crisis a (365 days): the companies' boycott
  { id: "mex_oil_boycott", icon: "oil", stats: { tradeCostPct: 10 } },
  // bra_feb_departure a (365 days)
  {
    id: "bra_feb_veterans",
    icon: "medal",
    stats: { armyXpMilli: 100, generalXpPct: 10 },
  },
  // mex_volunteer_squadron (365 days)
  {
    id: "mex_squadron_201",
    icon: "plane",
    stats: { airAttackPct: 5, airXpMilli: 100 },
  },

  // ---- Dominions ----
  // dom_air_training (100 days): 0.3 air experience a day = +30
  { id: "dom_air_training_scheme", icon: "plane", stats: { airXpMilli: 300 } },
  // dom_war_economy: "산출 +5%"
  { id: "dom_wartime_output", icon: "factory", stats: { outputPct: 5 } },
  // dom_minerals: "채굴 +10%"
  { id: "dom_mining_drive", icon: "mine", stats: { extractionPct: 10 } },
  // aus_jungle_training: "정글 공격 +15%" — no jungle key; the forest and
  // jungle terrain key (report: approximation)
  { id: "aus_jungle_warfare", icon: "map", stats: { forestDefensePct: 15 } },
  // nzl_coastwatchers: "바다 탐지 +10%, 해군 정보 +10%p" — no naval
  // intelligence key; the intelligence key (report: approximation)
  {
    id: "nzl_coastwatch",
    icon: "radio",
    stats: { navalDetectPct: 10, intelPct: 10 },
  },

  // ---- New states ----
  // new_economy: "무역 비용 −10%"
  { id: "new_trade_terms", icon: "scales", stats: { tradeCostPct: -10 } },
];
