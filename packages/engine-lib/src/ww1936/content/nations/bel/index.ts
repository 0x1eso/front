// ww229 (design ww227): BEL's national content, tier A. The tree, path and
// branch points are in focuses.ts, the rest in its own file; core.ts holds
// the generals, the language balance of power and the equipment. Data only.
import type { NationDef } from "../types";
import { BEL_DECISIONS } from "./decisions";
import { BEL_EVENTS } from "./events";
import { BEL_BRANCH_POINTS, BEL_FOCUSES, BEL_PATH } from "./focuses";
import { BEL_PERSONS } from "./people";
import { BEL_SPIRITS } from "./spirits";

export const NATION_BEL: NationDef = {
  tag: "BEL",
  tier: "A",
  sheet: {
    situation:
      "A young King and a three-party government of Catholics, Liberals and Socialists rule a country recovering from the slump after the franc's devaluation. Rex and the Flemish nationalists break through at the polls while the language question divides north and south. Belgium sits on the road between France and Germany and must choose between its French alliance and a policy of independence, with forts, canals and a large army of reservists.",
    startSpirits: [
      "bel_sp_three_parties",
      "bel_sp_franc_recovery",
      "bel_sp_short_service",
    ],
    dilemmas: [
      {
        branchPoint: "bel_foreign_course",
        note: "Leave the French military accord for a policy of independence, or keep it; history: independence, with Locarno's guarantee kept.",
      },
      {
        branchPoint: "bel_language_course",
        note: "Each region its own language or a unitary bilingual state; history: the language laws, Dutch in Flanders.",
      },
      {
        branchPoint: "bel_rex_answer",
        note: "Meet Rex at the ballot box with one joint candidate or disarm the party militias; history: the joint candidate in the Brussels by-election.",
      },
      {
        branchPoint: "bel_economy_course",
        note: "Van Zeeland's banker's recovery or de Man's Plan of Labour; history: the recovery office.",
      },
      {
        branchPoint: "bel_defence_course",
        note: "Hold the Albert Canal and leave the Ardennes to delaying troops, or defend the Ardennes border; history: the canal.",
      },
    ],
    mechanism:
      "The language balance of power, francophone against Flemish (bands from a French-speaking state to Flemish ascendancy), worked by language focuses, two decisions and grievance events; plus the guarantors' chain (independence, asking London and Paris, calling the Allies in).",
    patrons: ["GBR", "FRA"],
    rivals: ["DEU"],
    unions: ["NLD", "LUX"],
    claims: [],
    people: [
      "bel_van_zeeland",
      "bel_spaak",
      "bel_pierlot",
      "bel_huysmans",
      "bel_degrelle",
      "bel_de_clercq",
      "bel_van_severen",
      "bel_borms",
      "bel_lahaut",
      "bel_lalmand",
      "bel_leopold_iii",
      "bel_de_man",
      "bel_gutt",
      "bel_van_den_bergen",
      "bel_michiels",
      "bel_van_overstraeten",
      "bel_denis",
      "bel_galopin",
      "bel_sengier",
      "bel_lemaitre",
      "bel_gen_van_den_bergen",
      "bel_gen_michiels",
      "bel_gen_van_overstraeten",
      "bel_gen_keyaerts",
      "bel_gen_gilliaert",
    ],
    equipment: [
      "bel_t15",
      "bel_t13_b3",
      "bel_acg1",
      "bel_firefly_iim",
      "bel_renard_r36",
      "bel_fox_vi",
      "bel_renard_r31",
      "bel_mauser_m1935",
      "bel_fn_model_d",
      "bel_frc_47",
      "bel_frc_76",
      "gbr_battle",
    ],
  },
  character: {
    lean: "neutral",
    patrons: ["GBR", "FRA"],
    routeBias: { fascist: 2, communist: 1, neutral: 1 },
  },
  politics: {
    popularity: [64, 6, 15, 15],
    spirits: [
      "bel_sp_three_parties",
      "bel_sp_franc_recovery",
      "bel_sp_short_service",
    ],
    leaders: {
      democratic: "leader_bel",
      communist: "bel_lahaut",
      fascist: "bel_degrelle",
      neutral: "bel_leopold_iii",
    },
  },
  focuses: BEL_FOCUSES,
  path: BEL_PATH,
  branchPoints: BEL_BRANCH_POINTS,
  events: BEL_EVENTS,
  decisions: BEL_DECISIONS,
  spirits: BEL_SPIRITS,
  persons: BEL_PERSONS,
  flags: ["bel_allies_called", "bel_lowlands_joined", "bel_ore_in_new_york"],
  groups: [
    // The Belgian Congo and Ruanda-Urundi: Orientale, Équateur, Usumbura,
    // Léopoldville, Katanga.
    {
      id: "bel_congo",
      regions: [1100, 1103, 1127, 1138, 1158],
      owner1936: "BEL",
    },
  ],
  claims: [],
  templates: [
    // bel_chasseurs_ardennais: the Ardennes light infantry with its
    // anti-tank guns and engineers (width about 20).
    {
      id: "bel_tpl_chasseurs_ardennais",
      country: "BEL",
      battalions: [
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "anti_tank",
        "artillery",
      ],
      support: ["engineer", "recon"],
    },
  ],
  aliases: {},
  dropped: [],
};
