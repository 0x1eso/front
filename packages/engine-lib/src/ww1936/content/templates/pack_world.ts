// World War 1936 P6 — division templates the Latin American, Dominion and
// new-state packs unlock (P2 TemplateDef shape: at most 10 battalions and 4
// support companies). Only battalions every country has from its 1936 techs
// (infantry, artillery_1) and no support companies, which minors may lack.
// Names: ww1936.tpl.<id>. Data only (ContentPurity).
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_PACK_WORLD: TemplateUnlockDef[] = [
  // bra_expeditionary, bra_feb_departure: the FEB's 1st Expeditionary
  // Infantry Division, a triangular division on the US model.
  {
    id: "bra_feb_division",
    country: "BRA",
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
    support: [],
  },
  // dom_volunteer_force, nzl_division, zaf_east_africa: three brigades of
  // infantry and three field artillery regiments, in a 10-battalion frame.
  {
    id: "dom_infantry_division",
    country: "any",
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
    support: [],
  },
  // new_army, new_state_proclaimed b: the generic minor division (P2
  // startTemplates, dev ≤ 2), nine infantry battalions.
  {
    id: "new_infantry_division",
    country: "any",
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
    ],
    support: [],
  },
];
