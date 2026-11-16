// ww229 MR1 (design ww227 §7): the minors' moves that Germany, Italy and the
// Soviet Union answer, read from the minors' own flags and focuses (their
// folders under nations/, as they are). Checked on the major (self).
import { all, any, gflag, not, T } from "../helpers";
import type { Condition } from "../types";

/** Hungary formed the Danubian Federation (hun_danube_offer). */
export const DANUBE_HUN: Condition = gflag("danubian_federation_formed");
/** Czechoslovakia formed its Danubian federation (csk_danubian_federation). */
export const DANUBE_CSK: Condition = gflag("csk_danube_formed");
/** Otto von Habsburg crowned in Budapest (hun_crown_otto). */
export const HABSBURG: Condition = {
  kind: "flag",
  who: T("HUN"),
  flag: "hun_habsburg_crowned",
};
/** The Little Entente made a real alliance: Romania or Czechoslovakia founded it. */
export const ENTENTE_ROU: Condition = gflag("rou_entente_bloc_formed");
export const ENTENTE_CSK: Condition = {
  kind: "focus_done",
  who: T("CSK"),
  id: "csk_little_entente",
};
export const ENTENTE: Condition = any(ENTENTE_ROU, ENTENTE_CSK);
/** The Balkan Entente made a real alliance: Greece, Turkey or Yugoslavia founded it. */
export const BALKAN_GRC: Condition = gflag("grc_balkan_bloc_formed");
export const BALKAN_TUR: Condition = {
  kind: "focus_done",
  who: T("TUR"),
  id: "tur_balkan_alliance",
};
export const BALKAN_YUG: Condition = {
  kind: "focus_done",
  who: T("YUG"),
  id: "yug_balkan_bloc",
};
export const BALKAN_BLOC: Condition = any(BALKAN_GRC, BALKAN_TUR, BALKAN_YUG);
/** Poland's Intermarium pact, or its union with Lithuania. */
export const INTERMARIUM: Condition = any(
  { kind: "focus_done", who: T("POL"), id: "pol_intermarium_pact" },
  { kind: "flag", who: T("POL"), flag: "pol_union_done" },
);
/** A Nordic defence union, and which country founded it. */
export const NORDIC: Condition = gflag("nordic_union_formed");
export const NORDIC_FIN: Condition = {
  kind: "flag",
  who: T("FIN"),
  flag: "nor_union_founder",
};
export const NORDIC_SWE: Condition = {
  kind: "flag",
  who: T("SWE"),
  flag: "nor_union_founder",
};
/** Sweden stopped its iron ore to Germany (swe_ore_embargo). */
export const ORE_EMBARGO: Condition = {
  kind: "flag",
  who: T("SWE"),
  flag: "swe_ore_embargoed",
};
/** Norway's heavy water goes west (nor_water_to_france). */
export const WATER_WEST: Condition = {
  kind: "flag",
  who: T("NOR"),
  flag: "nor_water_west",
};
/** Finland refused the Soviet bases (fin_refuse_the_bases). */
export const FIN_REFUSED: Condition = {
  kind: "flag",
  who: T("FIN"),
  flag: "fin_refused_bases",
};
/** Romania's oil goes to Britain or France and not to Germany. */
export const ROU_OIL_WEST: Condition = all(
  any(
    { kind: "flag", who: T("ROU"), flag: "rou_oil_gbr" },
    { kind: "flag", who: T("ROU"), flag: "rou_oil_fra" },
  ),
  not({ kind: "flag", who: T("ROU"), flag: "rou_oil_deu" }),
);
/** Turkey closed the straits (tur_close_the_straits). */
export const STRAITS_CLOSED: Condition = {
  kind: "has_spirit",
  who: T("TUR"),
  id: "tur_straits_closed",
};
/** Turkey offers its chromium (tur_chromium_diplomacy). */
export const TUR_CHROME: Condition = {
  kind: "flag",
  who: T("TUR"),
  flag: "tur_chromium_trade_open",
};
/** Romania under an Iron Guard government. */
export const IRON_GUARD: Condition = {
  kind: "ruling",
  who: T("ROU"),
  ideology: "fascist",
};
/** A communist Yugoslavia or Bulgaria (the Balkan Federation's road). */
export const RED_YUG: Condition = {
  kind: "ruling",
  who: T("YUG"),
  ideology: "communist",
};
export const RED_BGR: Condition = {
  kind: "ruling",
  who: T("BGR"),
  ideology: "communist",
};
export const RED_BALKANS: Condition = any(RED_YUG, RED_BGR);

/** Germany's Danubian question opens. */
export const DEU_DANUBE_OPEN: Condition = any(
  DANUBE_HUN,
  DANUBE_CSK,
  HABSBURG,
  ENTENTE,
);
/** Germany's northern ore question opens. */
export const DEU_NORTH_OPEN: Condition = any(ORE_EMBARGO, NORDIC, WATER_WEST);
/** Germany's south-eastern oil and chromium question opens. */
export const DEU_SOUTHEAST_OPEN: Condition = any(
  ROU_OIL_WEST,
  TUR_CHROME,
  IRON_GUARD,
  STRAITS_CLOSED,
);
/** Italy's Balkan sphere opens. */
export const ITA_BALKAN_OPEN: Condition = any(
  BALKAN_BLOC,
  RED_BALKANS,
  ENTENTE,
  IRON_GUARD,
);
/** Italy's Danubian ties (the Rome Protocols) open. */
export const ITA_DANUBE_OPEN: Condition = any(DANUBE_HUN, HABSBURG);
/** Italy's oil question opens. */
export const ITA_OIL_OPEN: Condition = any(ROU_OIL_WEST, STRAITS_CLOSED);
/** The Soviet Union's Baltic security opens. */
export const SUN_BALTIC_OPEN: Condition = any(
  NORDIC,
  INTERMARIUM,
  FIN_REFUSED,
  { kind: "ruling", who: T("FIN"), ideology: "fascist" },
);
/** The Soviet Union's straits question opens. */
export const SUN_STRAITS_OPEN: Condition = any(STRAITS_CLOSED, BALKAN_TUR);
/** The Soviet Union's Balkan comrades open. */
export const SUN_COMRADES_OPEN: Condition = any(RED_BALKANS, DANUBE_CSK);
