// World War 1936 P6 (spec §11.2–§11.4): division templates the China pack
// focuses unlock (P2 TemplateDef shape; name key ww1936.tpl.<id>). P2 allows
// at most 10 battalions (WW_MAX_BATTALIONS), so the spec's 9 infantry + 2
// artillery becomes 8 + 2, and the expeditionary 9 + 2 + 1 becomes 7 + 2 + 1
// (lane K1 report, "deviations"). Support companies only where the spec
// lists them (engineer: engineer_company, recon: recon_company).
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_PACK_CHINA: TemplateUnlockDef[] = [
  // chn_central_army: the trained divisions of the central army. Width 22.
  {
    id: "chn_trained_division",
    country: "CHN",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
      "artillery",
    ],
    support: ["engineer"],
  },
  // chn_expeditionary: the divisions sent to Burma. Width 21.
  {
    id: "chn_expeditionary_division",
    country: "CHN",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
      "artillery",
      "anti_tank",
    ],
    support: ["engineer", "recon"],
  },
  // ccp_eighth_route: light divisions for mobile war behind the lines. Width 14.
  {
    id: "ccp_guerrilla_division",
    country: "CCP",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "cavalry",
    ],
    support: [],
  },
  // ccp_field_armies: regular field divisions. Width 22.
  {
    id: "ccp_field_army_division",
    country: "CCP",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
      "artillery",
    ],
    support: [],
  },
  // chw_ma_cavalry (Ma clique): a cavalry brigade. Width 8.
  {
    id: "chw_cavalry_brigade",
    country: "XBM",
    battalions: ["cavalry", "cavalry", "cavalry", "cavalry"],
    support: [],
  },
];
