// World War 1936 P6 — division templates the Balkan and Nordic pack focuses
// unlock (P2 TemplateDef shape; name key ww1936.tpl.<id>). Minor countries
// start with inf_eq_1, support_eq_1 and artillery_1 only (P1 spec §11), so
// these use mountain battalions (the focus grants mountaineers first),
// cavalry and towed artillery, and no support companies, and the unlock never
// fails on a missing tech.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_PACK_NORTH: readonly TemplateUnlockDef[] = [
  // bal_mountain_troops: a mountain division with its mountain-gun
  // battalions, 8 battalions, width 18.
  {
    id: "bal_mountain_division",
    country: "any",
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
    support: [],
  },
  // hun_mobile_corps: a mobile brigade of horse and guns, 5 battalions,
  // width 11. Motorised battalions wait for motorized_1.
  {
    id: "hun_mobile_brigade",
    country: "HUN",
    battalions: ["cavalry", "cavalry", "cavalry", "cavalry", "artillery"],
    support: [],
  },
  // nor_ski_troops: six ski battalions (spec §11.9: "mountain 6"), width 12.
  {
    id: "nor_ski_division",
    country: "any",
    battalions: [
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
    ],
    support: [],
  },
];
