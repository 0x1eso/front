// World War 1936 P5 — division templates French focuses unlock (P2
// TemplateDef shape). Every battalion and support company here is open to
// France with its 1936 techs (inf_eq_1, support_eq_1, artillery_1,
// motorized_1, light_tank_1, anti_tank_1, engineer_company, recon_company),
// so the P2 template check passes; the mountain battalion needs
// mountaineers, which fra_alpine_troops grants before it unlocks the
// template. Widths stay under 40.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_FRA: TemplateUnlockDef[] = [
  // fra_army_reorganisation: the 1936 division with its own anti-tank
  // battalion and anti-tank company (width 28).
  {
    id: "fra_infantry_ii",
    country: "FRA",
    battalions: [
      "infantry",
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
      "artillery",
      "anti_tank",
    ],
    support: ["engineer", "recon", "support_anti_tank"],
  },
  // fra_motorised_divisions: the lorried infantry division (width 19).
  {
    id: "fra_motorised_division",
    country: "FRA",
    battalions: [
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "motorized",
      "mot_artillery",
      "mot_artillery",
      "anti_tank",
    ],
    support: ["engineer", "recon"],
  },
  // fra_armoured_corps: tank battalions with motor infantry and guns
  // (width 24).
  {
    id: "fra_armoured_ii",
    country: "FRA",
    battalions: [
      "light_armor",
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
  // fra_alpine_troops: mountain battalions with pack guns (width 18).
  {
    id: "fra_mountain_division",
    country: "FRA",
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
  // fra_colonial_divisions: the colonial division made a full field
  // division (width 24).
  {
    id: "fra_colonial_ii",
    country: "FRA",
    battalions: [
      "infantry",
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
    support: ["engineer", "recon"],
  },
];
