// World War 1936 P3 — division templates German focuses unlock (P2
// TemplateDef shape; name key ww1936.tpl.<id>). Only battalions and support
// companies Germany can field from 1936 (light tanks, motorized_1,
// artillery_1, anti_tank_1, anti_air_1, engineer, recon and mountaineer
// techs), so the unlock never fails on a missing tech.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_DEU: TemplateUnlockDef[] = [
  // deu_panzer_arm: 9 battalions, width 20.
  {
    id: "deu_panzer_ii",
    country: "DEU",
    battalions: [
      "light_armor",
      "light_armor",
      "light_armor",
      "light_armor",
      "motorized",
      "motorized",
      "motorized",
      "mot_artillery",
      "mot_artillery",
    ],
    support: ["engineer", "recon", "support_anti_tank", "support_anti_air"],
  },
  // deu_motorized: 8 battalions, width 18.
  {
    id: "deu_motorized_div",
    country: "DEU",
    battalions: [
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "mot_artillery",
      "mot_artillery",
    ],
    support: ["engineer", "recon", "support_anti_tank"],
  },
  // deu_mountain: 8 battalions, width 18.
  {
    id: "deu_mountain_ii",
    country: "DEU",
    battalions: [
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "artillery",
      "artillery",
    ],
    support: ["engineer", "recon"],
  },
];
