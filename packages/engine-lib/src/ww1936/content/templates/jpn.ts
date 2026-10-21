// World War 1936 P5 — division templates Japanese focuses unlock (P2
// TemplateDef shape; name key ww1936.tpl.<id>). The tank division uses only
// what Japan fields from 1936 (light_tank_1, motorized_1, artillery_1,
// support_eq_1, engineer and recon techs). The garrison template needs the
// P5 military_police tech, which its focus grants before unlocking it.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_JPN: TemplateUnlockDef[] = [
  // jpn_tank_corps: the 1942 tank divisions (tank regiments with mobile
  // infantry and artillery). 8 battalions, width 17.
  {
    id: "jpn_tank_division",
    country: "JPN",
    battalions: [
      "light_armor",
      "light_armor",
      "light_armor",
      "light_armor",
      "motorized",
      "motorized",
      "motorized",
      "mot_artillery",
    ],
    support: ["engineer", "recon", "support_artillery"],
  },
  // jpn_garrison_units: 6 infantry + military police (spec §8.5), width 12.
  {
    id: "jpn_garrison_ii",
    country: "JPN",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
    ],
    support: ["military_police"],
  },
];
