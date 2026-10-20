// World War 1936 P6 (spec §3.5): the doctrines an AI country picks on its
// first day with the historical AI on. Seven majors from the spec table, then
// one row per AI leaning (P1 §12.1) for every other country.
//
// `gd` is [land, naval, air]; `sub` is one sub-doctrine per track in
// DOCTRINE_TRACKS order (infantry, armor, support, surface, escort, carrier,
// fighter, bomber, naval_air). The leaning rows' sub-doctrines are this
// lane's choice (the spec names their grand doctrines only). The naval
// grand doctrine of a leaning row applies only to a country with a coast and
// at least 3 dockyards (spec §3.5); the doctrine lane applies that rule.
import type { StartDoctrineDef } from "@openfront/engine-api/ww1936/DepthTypes";

export const START_DOCTRINES: readonly StartDoctrineDef[] = [
  {
    tag: "DEU",
    gd: ["gd_mobile", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: [
      "inf_elastic",
      "arm_breakthrough",
      "sup_deep_ops",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_support",
      "air_escort",
      "air_ground_attack",
      "air_maritime_strike",
    ],
  },
  {
    tag: "SUN",
    gd: ["gd_mass", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: [
      "inf_mass_mob",
      "arm_mech",
      "sup_deep_ops",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_support",
      "air_interceptor",
      "air_ground_attack",
      "air_maritime_patrol",
    ],
  },
  {
    tag: "GBR",
    gd: ["gd_firepower", "gd_fleet_in_being", "gd_strategic_destruction"],
    sub: [
      "inf_elastic",
      "arm_inf_support",
      "sup_artillery",
      "nav_battleline",
      "nav_convoy_escort",
      "nav_carrier_support",
      "air_interceptor",
      "air_strategic_campaign",
      "air_maritime_patrol",
    ],
  },
  {
    tag: "FRA",
    gd: ["gd_battleplan", "gd_fleet_in_being", "gd_operational_integrity"],
    sub: [
      "inf_elastic",
      "arm_inf_support",
      "sup_entrenched",
      "nav_battleline",
      "nav_convoy_escort",
      "nav_carrier_support",
      "air_interceptor",
      "air_ground_attack",
      "air_maritime_patrol",
    ],
  },
  {
    tag: "USA",
    gd: ["gd_firepower", "gd_base_strike", "gd_strategic_destruction"],
    sub: [
      "inf_assault",
      "arm_mech",
      "sup_artillery",
      "nav_cruiser",
      "nav_convoy_escort",
      "nav_carrier_force",
      "air_escort",
      "air_strategic_campaign",
      "air_maritime_strike",
    ],
  },
  {
    tag: "ITA",
    gd: ["gd_battleplan", "gd_fleet_in_being", "gd_battlefield_support"],
    sub: [
      "inf_elastic",
      "arm_mech",
      "sup_artillery",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_support",
      "air_escort",
      "air_ground_attack",
      "air_maritime_strike",
    ],
  },
  {
    tag: "JPN",
    gd: ["gd_mass", "gd_base_strike", "gd_operational_integrity"],
    sub: [
      "inf_assault",
      "arm_inf_support",
      "sup_deep_ops",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_force",
      "air_escort",
      "air_ground_attack",
      "air_maritime_strike",
    ],
  },
  // ---- every other country, by AI leaning ----
  {
    tag: "@aggressor",
    gd: ["gd_mobile", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: [
      "inf_assault",
      "arm_breakthrough",
      "sup_deep_ops",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_support",
      "air_escort",
      "air_ground_attack",
      "air_maritime_strike",
    ],
  },
  {
    tag: "@democracy",
    gd: ["gd_battleplan", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: [
      "inf_elastic",
      "arm_inf_support",
      "sup_entrenched",
      "nav_cruiser",
      "nav_convoy_escort",
      "nav_carrier_support",
      "air_interceptor",
      "air_ground_attack",
      "air_maritime_patrol",
    ],
  },
  {
    tag: "@minor",
    gd: ["gd_mass", "gd_trade_interdiction", "gd_battlefield_support"],
    sub: [
      "inf_mass_mob",
      "arm_inf_support",
      "sup_entrenched",
      "nav_cruiser",
      "nav_wolfpack",
      "nav_carrier_support",
      "air_interceptor",
      "air_ground_attack",
      "air_maritime_patrol",
    ],
  },
];
