// World War 1936 P5 — division templates American focuses unlock (P2
// TemplateDef shape: at most 10 battalions and 4 support companies). Every
// battalion and support company here is open to the United States with its
// 1936 techs (P1 major techs, P2 engineer/recon/marines).
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_USA: TemplateUnlockDef[] = [
  // usa_army_expansion: the leaner triangular division (three regiments)
  // that replaced the square division from 1939.
  {
    id: "usa_infantry_ii",
    country: "USA",
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
    support: ["engineer", "recon", "support_artillery"],
  },
  // usa_armored_force: tank battalions with motorised infantry and
  // motorised guns.
  {
    id: "usa_armored_division",
    country: "USA",
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
    support: ["engineer", "recon"],
  },
  // usa_marine_corps: a Marine division of three regiments with its guns.
  {
    id: "usa_marine_division",
    country: "USA",
    battalions: [
      "marine",
      "marine",
      "marine",
      "marine",
      "marine",
      "marine",
      "marine",
      "artillery",
      "artillery",
    ],
    support: ["engineer", "recon"],
  },
];
