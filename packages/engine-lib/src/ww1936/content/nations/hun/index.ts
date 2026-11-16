// ww229 (design ww227): HUN's national content, tier A. How:
// /home/eser/dev/ww229-format.md. The tree is in focuses.ts, the rest in
// this folder's files; all data only.
import type { NationDef } from "../types";
import { HUN_DECISIONS } from "./decisions";
import { HUN_EVENTS } from "./events";
import { HUN_BRANCH_POINTS, HUN_FOCUSES, HUN_PATH } from "./focuses";
import { HUN_PERSONS } from "./persons";
import { HUN_SPIRITS } from "./spirits";

export const NATION_HUN: NationDef = {
  tag: "HUN",
  tier: "A",
  sheet: {
    situation:
      "A kingdom without a king under Regent Horthy, governed by the Party of National Unity; Trianon left two thirds of the old kingdom's land and a third of the Magyars outside the border. The army is held to treaty limits, the countryside to great estates, and every party measures itself by how fast it can win the lost lands back.",
    startSpirits: [
      "hun_trianon_wound",
      "hun_army_limits",
      "hun_regency",
      "hun_landed_estates",
    ],
    dilemmas: [
      {
        branchPoint: "hun_bp_course",
        note: "Regency's middle course, the right-radical turn or the Habsburg legitimists; history kept the regency.",
      },
      {
        branchPoint: "hun_bp_arrow_cross",
        note: "Jail Szálasi or bring the Arrow Cross into play; Szálasi was jailed in 1938.",
      },
      {
        branchPoint: "hun_bp_alignment",
        note: "Follow Rome and Berlin or reinsure with London; Hungary followed the Axis.",
      },
      {
        branchPoint: "hun_bp_revision",
        note: "Revision by arbitration or by arms; the Vienna Awards came by arbitration.",
      },
      {
        branchPoint: "hun_bp_yugoslavia",
        note: "Eternal friendship with Belgrade or contacts with Croat separatists; the treaty was signed, then broken.",
      },
      {
        branchPoint: "hun_bp_war",
        note: "March east with Germany or stay armed and neutral; Hungary marched after Kassa.",
      },
      {
        branchPoint: "hun_bp_endgame",
        note: "Kállay's seesaw toward the West or total commitment; Kállay sought a way out.",
      },
    ],
    mechanism:
      "Trianon revision: the Revision League, asking Rome or Berlin to back the claims, arbitration or claim war goals on south Slovakia, Carpathian Ruthenia and north Transylvania, each regained land moving a staged spirit (wound, begun, advancing, fulfilled); plus a Danubian federation offered to Austria and Czechoslovakia.",
    patrons: ["ITA", "DEU"],
    rivals: ["CSK", "ROU", "YUG"],
    unions: ["AUT", "CSK"],
    claims: ["south_slovakia", "carpathian_ruthenia", "north_transylvania"],
    people: [
      "hun_daranyi",
      "hun_teleki",
      "hun_kallay",
      "hun_bethlen",
      "hun_kanya",
      "hun_csaky",
      "hun_keresztes_fischer",
      "hun_otto",
      "hun_szalasi",
      "hun_imredy",
      "hun_bajcsy_zsilinszky",
      "hun_tildy",
      "hun_eckhardt",
      "hun_rakosi",
      "hun_gero",
      "hun_werth",
      "hun_szombathelyi",
      "hun_ujszaszy",
      "hun_chorin",
      "hun_bay",
      "hun_jany",
      "hun_miklos",
      "hun_lakatos",
      "hun_veress",
    ],
    equipment: [
      "hun_csaba",
      "hun_toldi_i",
      "hun_toldi_iia",
      "hun_turan_i",
      "hun_turan_ii",
      "hun_nimrod",
      "hun_zrinyi_ii",
      "hun_wm21",
      "hun_heja",
      "hun_me210ca",
      "hun_35m_rifle",
      "hun_39m_kiraly",
      "hun_botond",
      "hun_36m_40mm",
      "ita_cv33",
      "ita_cr32",
    ],
  },
  // Design §8: revisionist, Rome first; the fascist and the restoration
  // (neutral legitimist) routes are the likely ways out of history.
  character: {
    lean: "revisionist",
    patrons: ["ITA", "DEU"],
    routeBias: { fascist: 3, neutral: 2, democratic: 1, communist: 1 },
  },
  politics: {
    spirits: [
      "hun_trianon_wound",
      "hun_army_limits",
      "hun_regency",
      "hun_landed_estates",
    ],
    leaders: {
      democratic: "hun_bajcsy_zsilinszky",
      communist: "hun_rakosi",
      fascist: "hun_szalasi",
      neutral: "leader_hun",
    },
  },
  focuses: HUN_FOCUSES,
  path: HUN_PATH,
  branchPoints: HUN_BRANCH_POINTS,
  events: HUN_EVENTS,
  decisions: HUN_DECISIONS,
  spirits: HUN_SPIRITS,
  persons: HUN_PERSONS,
  flags: [
    "hun_rome_backing",
    "hun_berlin_backing",
    "hun_secret_talks",
    "hun_ustasa_contacts",
    "hun_habsburg_crowned",
    "danubian_federation_formed",
  ],
  groups: [],
  claims: [],
  templates: [
    // hun_rapid_corps: a brigade of the Rapid Corps (Gyorshadtest): motorised
    // and bicycle infantry, a Toldi company and motorised guns, 5 battalions.
    {
      id: "hun_rapid_corps_brigade",
      country: "HUN",
      battalions: [
        "motorized",
        "motorized",
        "motorized",
        "light_armor",
        "mot_artillery",
      ],
      support: ["recon"],
    },
  ],
  factionNames: [{ id: "danubian", creators: ["HUN", "AUT", "CSK"] }],
  aliases: {},
  dropped: [],
};
