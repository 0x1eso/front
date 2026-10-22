// World War 1936 P6 — division templates the Spanish and Polish pack focuses
// unlock or raise (P2 TemplateDef shape, names ww1936.tpl.<id>). Every
// battalion here is open to the country with its 1936 techs (inf_eq_1,
// support_eq_1, artillery_1; Poland also motorized_1), except the Polish
// light tanks, which pol_armored_brigades grants (light_tank_1) before it
// unlocks the brigade. No special battalions (no specialRoom). Widths stay
// under 40.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_PACK_WEST: TemplateUnlockDef[] = [
  // spa_popular_army, spa_international_brigades: the Republic's division of
  // mixed brigades, rifle battalions with their own batteries (width 18).
  {
    id: "spa_mixed_brigades",
    country: "ESR",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
      "artillery",
    ],
    support: ["support_artillery"],
  },
  // spa_army_of_africa: six infantry battalions, a cavalry squadron group and
  // a battery (width 17, spec §11.5).
  {
    id: "spa_africa_division",
    country: "ESN",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "cavalry",
      "artillery",
    ],
    support: [],
  },
  // spa_navarre_volunteers: the Navarrese volunteer brigades as a division
  // (width 17).
  {
    id: "spa_navarre_brigades",
    country: "ESN",
    battalions: [
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "infantry",
      "artillery",
    ],
    support: [],
  },
  // pol_armored_brigades: cavalry and motor rifles with a light tank
  // battalion and a field battery (width 15).
  {
    id: "pol_armored_cavalry",
    country: "POL",
    battalions: [
      "cavalry",
      "cavalry",
      "cavalry",
      "motorized",
      "motorized",
      "light_armor",
      "artillery",
    ],
    support: ["support_artillery"],
  },
  // pol_forces_west, pol_eastern_army: the infantry division of the army in
  // exile (width 20).
  {
    id: "pol_exile_infantry",
    country: "POL",
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
    ],
    support: ["support_artillery"],
  },
];
