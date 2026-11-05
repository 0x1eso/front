// World War 1936 ww91 N3: the seven majors' sea and air character, one
// spirit each from day 0 (`nat_<tag>_sea_air`), plus two with a story:
// `nat_usa_mk14` (the Mark 14 torpedo's duds, lifted by usa_submarine_campaign)
// and `nat_ita_decima` (frogmen, from ita_human_torpedo). Texts:
// ww1936.spirit.<id>, ww1936.spirit_desc.<id>.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_NAT_SEA_AIR: readonly SpiritDef[] = [
  {
    id: "nat_deu_sea_air",
    icon: "submarine",
    stats: {
      wolfPackPct: 15,
      encryptPct: -15,
      casPct: 15,
      airRangePct: -10,
      stratBombPct: -15,
      navalPatrolPct: -15,
    },
  },
  {
    id: "nat_sun_sea_air",
    icon: "bomber",
    stats: { casPct: 10, mioCostPct_air_light: -10, wingStartXpMilli: -120 },
  },
  {
    id: "nat_usa_sea_air",
    icon: "carrier",
    stats: {
      carrierRepairPct: 30,
      wingRookieXpMilli: 100,
      wingXpCapMilli: -201,
    },
  },
  {
    id: "nat_gbr_sea_air",
    icon: "radar",
    stats: {
      depthChargePct: 10,
      decryptPct: 15,
      carrierDeckPct: -20,
      nightBombBp: 1500,
      stratBombPct: -10,
    },
  },
  {
    id: "nat_fra_sea_air",
    icon: "ship",
    stats: { screenAttackPct: 15, depthChargePct: -15, sortieEffPct: -20 },
  },
  {
    id: "nat_jpn_sea_air",
    icon: "carrier",
    stats: {
      wingStartXpMilli: 250,
      wingRookieXpMilli: -60,
      airRangePct: 15,
      airDefensePct: -15,
      convoyEscortPct: -25,
      depthChargePct: -15,
      navalDetectPct: -10,
    },
  },
  {
    id: "nat_ita_sea_air",
    icon: "ship",
    stats: {
      torpedoPct: 10,
      navalDetectPct: -20,
      navalStrikePct: 10,
      fuelCapPct: -20,
      fighterAgilityPct: 10,
      fighterAttackPct: -10,
    },
  },
  { id: "nat_usa_mk14", icon: "submarine", stats: { subTorpedoPct: -25 } },
  { id: "nat_ita_decima", icon: "submarine", stats: { harborRaidPm: 150 } },
];

/** The day-0 spirit of each major's sea and air character (countries.ts). */
export const NAT_SEA_AIR_START: Readonly<Record<string, readonly string[]>> = {
  DEU: ["nat_deu_sea_air"],
  SUN: ["nat_sun_sea_air"],
  USA: ["nat_usa_sea_air", "nat_usa_mk14"],
  GBR: ["nat_gbr_sea_air"],
  FRA: ["nat_fra_sea_air"],
  JPN: ["nat_jpn_sea_air"],
  ITA: ["nat_ita_sea_air"],
};
