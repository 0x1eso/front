// World War 1936 P5 — division templates Italian focuses unlock (P2
// TemplateDef shape; name key ww1936.tpl.<id>). Only battalions and support
// companies Italy fields from 1936 (inf_eq_1, artillery_1, motorized_1,
// light_tank_1, anti_air_1, mountaineers, engineer and recon companies —
// P1 spec §11, P2 spec §4.6), so the unlock never fails on a missing tech.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_ITA: TemplateUnlockDef[] = [
  // ita_alpini: two Alpini regiments and a mountain artillery regiment,
  // 8 battalions, width 18.
  {
    id: "ita_alpini_ii",
    country: "ITA",
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
  // ita_armoured_divisions: a tank regiment, a Bersaglieri regiment and a
  // motorised artillery regiment (the 1939 Ariete pattern), 9 battalions,
  // width 20.
  {
    id: "ita_armoured_division",
    country: "ITA",
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
    support: ["engineer", "recon", "support_anti_air"],
  },
  // ita_motorised_divisions: two trucked infantry regiments and their
  // artillery (the Trento and Trieste pattern), 8 battalions, width 18.
  {
    id: "ita_motorised_division",
    country: "ITA",
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
];
