// World War 1936 P6 (spec §11.2–§11.4): the national spirits of the China
// packs — the Nationalist government (chn), the Communists (ccp) and the
// regional cliques (chw). Spirit ids never repeat a focus id. Stat keys are
// the P3–P6 WwStats names; where the spec names a modifier the mode has no
// key for, the nearest key stands in (lane K1 report, "approximations").
// Data only (tests/ww1936/ContentPurity).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_PACK_CHINA: SpiritDef[] = [
  // ---- chn ----
  // chn_foreign_advisors, 720 days: training -10%, planning speed +10%.
  {
    id: "chn_advisor_training",
    icon: "compass",
    stats: { trainPct: -10, planSpeedPct: 10 },
  },
  // chn_united_front: war support +10%, recruitable +5%.
  {
    id: "chn_anti_japan_solidarity",
    icon: "handshake",
    stats: { warSupportBp: 1000, recruitablePct: 5 },
  },
  // chn_chongqing: surrender threshold +5 points.
  { id: "chn_provisional_capital", icon: "tower", stats: { surrenderPp: 5 } },
  // chn_trade_space: surrender threshold +10 points, entrenchment +1.
  {
    id: "chn_protracted_war",
    icon: "shield",
    stats: { surrenderPp: 10, entrenchMax: 1 },
  },
  // chn_guerrilla_zones: resistance target +10 points in my occupied cores
  // (P5: the core holder's resistanceTargetPct counts there).
  {
    id: "chn_occupied_resistance",
    icon: "map",
    stats: { resistanceTargetPct: 10 },
  },
  // chn_war_tax: political power +10%.
  { id: "chn_war_finance", icon: "scales", stats: { ppGainPct: 10 } },
  // chn_officer_academy: army experience +0.1 a day.
  { id: "chn_officer_corps", icon: "medal", stats: { armyXpMilli: 100 } },

  // ---- ccp ----
  // ccp_party_school: political power +10%.
  { id: "ccp_cadre_training", icon: "document", stats: { ppGainPct: 10 } },
  // ccp_united_front: war support +10%.
  {
    id: "ccp_anti_japan_front",
    icon: "handshake",
    stats: { warSupportBp: 1000 },
  },
  // ccp_peoples_war: supply use -15%, defence +5% (the spec's "organisation
  // recovery kept while encircled" has no key: left out, see the report).
  {
    id: "ccp_guerrilla_doctrine",
    icon: "compass",
    stats: { supplyUsePct: -15, defensePct: 5 },
  },
  // ccp_mass_line: "ideology mission effect +25%" has no key; the
  // intelligence network growth key (intelPct) stands in.
  { id: "ccp_mass_work", icon: "megaphone", stats: { intelPct: 25 } },
  // ccp_militia: recruitable +10%.
  { id: "ccp_village_militia", icon: "fist", stats: { recruitablePct: 10 } },
  // ccp_captured_arms: capture +10 points (P5 capturePct).
  { id: "ccp_captured_weapons", icon: "infantry", stats: { capturePct: 10 } },

  // ---- chw ----
  // chw_mines: extraction +10%.
  { id: "chw_mining_drive", icon: "mine", stats: { extractionPct: 10 } },
  // chw_autonomy: stability +10% (the Nationalist integration event reads
  // this spirit and doubles the AI's refusal weight).
  { id: "chw_provincial_rule", icon: "flag", stats: { stabilityBp: 1000 } },
  // chw_officer_school: training -10%.
  { id: "chw_provincial_academy", icon: "medal", stats: { trainPct: -10 } },
  // chw_militia: recruitable +10%.
  { id: "chw_local_militia", icon: "fist", stats: { recruitablePct: 10 } },
  // chw_guangxi_model (Guangxi): recruitable +5%.
  { id: "chw_guangxi_levies", icon: "infantry", stats: { recruitablePct: 5 } },
  // chw_ma_cavalry (Ma clique): "cavalry attack +10%" has no key; attack
  // +5% for the whole army stands in (its army is mostly horsemen).
  { id: "chw_cavalry_tradition", icon: "sword", stats: { attackPct: 5 } },
  // chw_border_trade: trade cost -10%.
  { id: "chw_frontier_trade", icon: "globe", stats: { tradeCostPct: -10 } },
];
