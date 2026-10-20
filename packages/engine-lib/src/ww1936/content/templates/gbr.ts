// World War 1936 P3 — division templates British focuses unlock (P2
// TemplateDef shape; every battalion and support company here is open to
// Britain with its 1936 techs, so the P2 template check passes).
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_GBR: TemplateUnlockDef[] = [
  // gbr_bef: three brigades of infantry with their field artillery.
  {
    id: "gbr_infantry_div_ii",
    country: "GBR",
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
      "artillery",
    ],
    support: ["engineer", "recon", "support_anti_air"],
  },
  // gbr_mechanisation: lorried infantry and towed guns.
  {
    id: "gbr_motor_div",
    country: "GBR",
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
    support: ["engineer", "recon"],
  },
  // gbr_armoured_division: light and cruiser tank regiments with a support
  // group of motor infantry and guns.
  {
    id: "gbr_armoured_div",
    country: "GBR",
    battalions: [
      "light_armor",
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
    support: ["engineer", "recon"],
  },
];
