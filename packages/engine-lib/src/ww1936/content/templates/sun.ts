// World War 1936 P3 — Soviet division templates that focuses unlock
// (lane K4). P2 TemplateDef shape: battalion and support ids, at most 10
// battalions and 4 support companies; names are ww1936.tpl.<id>.
import type { TemplateUnlockDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TEMPLATES_SUN = [
  {
    // sun_rkka_expansion: the 1939-pattern rifle division.
    id: "sun_rifle_ii",
    country: "SUN",
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
    support: ["engineer", "recon"],
  },
  {
    // sun_mech_corps: the 1940 tank division of a mechanized corps.
    id: "sun_tank_division",
    country: "SUN",
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
    support: ["engineer", "recon"],
  },
  {
    // sun_guards: a Guards rifle division, heavier in artillery.
    id: "sun_guards_rifle",
    country: "SUN",
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
    support: ["engineer", "recon"],
  },
] satisfies TemplateUnlockDef[];
