// ww229 (design ww227): Finland's national content, tier A. The tree
// (focuses.ts) and the rest (content.ts) are data only; core.ts holds the
// generals, the catalogue and the start arms.
//
// Mechanism (design §5, "Winter War preparation"): the Isthmus line is
// built in three decision stages (fin_dec_line_1..3), each a staged spirit
// (fin_isthmus_line_1..3) and a fort level on the Karelian Isthmus; the
// Civil Guard is a start spirit, a peace-time exercise decision and a call-up
// decision when the Soviet threat or a war comes; motti, sisu and the spirit
// of the Winter War are focus and event spirits.
import type { NationDef } from "../types";
import {
  FIN_DECISIONS,
  FIN_EVENTS,
  FIN_FLAGS,
  FIN_GROUPS,
  FIN_PERSONS,
  FIN_SPIRITS,
  FIN_TEMPLATES,
} from "./content";
import { FIN_BRANCH_POINTS, FIN_FOCUSES, FIN_PATH } from "./focuses";

export const NATION_FIN: NationDef = {
  tag: "FIN",
  tier: "A",
  sheet: {
    situation:
      "A parliamentary republic eighteen years old, still divided by the civil war of 1918, with a large Civil Guard and an army short of guns and shells. Leningrad lies thirty kilometres from the border on the Karelian Isthmus; Finland looks to the Nordic states and the League, and later to Germany.",
    startSpirits: [
      "fin_scars_of_1918",
      "fin_civil_guards",
      "fin_empty_arsenal",
      "fin_neutral_north",
    ],
    dilemmas: [
      {
        branchPoint: "fin_bp_course",
        note: "Red-earth coalition of Agrarians and Social Democrats (history), the IKL's road, or the Marshal's government?",
      },
      {
        branchPoint: "fin_bp_bases",
        note: "Refuse the Soviet demands for bases and border changes (history) or lease the outer islands?",
      },
      {
        branchPoint: "fin_bp_ally",
        note: "Co-belligerence with Germany (history) or staking everything on the Western democracies?",
      },
      {
        branchPoint: "fin_bp_border",
        note: "Cross the old border into East Karelia (history) or halt at the 1939 frontier?",
      },
      {
        branchPoint: "fin_bp_endgame",
        note: "A separate peace with Moscow (history) or fighting on beside Germany?",
      },
    ],
    mechanism:
      "Winter War preparation: the Isthmus line in three staged decisions, the Civil Guard call-up, motti, sisu and the spirit of the Winter War.",
    patrons: ["DEU", "GBR"],
    rivals: ["SUN"],
    unions: ["EST", "SWE"],
    claims: ["karelian_isthmus", "ladoga_karelia", "fin_east_karelia"],
    people: [
      "fin_kallio",
      "fin_stahlberg",
      "fin_ryti",
      "fin_kuusinen",
      "fin_antikainen",
      "fin_annala",
      "fin_simojoki",
      "fin_mannerheim_regent",
      "fin_paasikivi",
      "fin_tanner",
      "fin_holsti",
      "fin_erkko",
      "fin_kekkonen",
      "fin_walden",
      "fin_virtanen",
      "fin_osterman",
      "fin_heinrichs",
      "fin_malmberg",
      "fin_lundqvist",
      "fin_valve",
      "ohquist",
      "hagglund",
      "talvela",
      "wallenius",
      "airo",
      "oesch",
    ],
    equipment: [
      "fin_m28_30",
      "fin_suomi_kp31",
      "fin_ls26",
      "fin_m39",
      "fin_37pstk36",
      "fin_lahti_l39",
      "fin_fokker_dxxi",
      "fin_vl_myrsky",
      "fin_vainamoinen_class",
      "fin_vetehinen_class",
      "fin_vesikko",
      "fra_ft17",
      "gbr_blenheim_iv",
    ],
  },
  // Neutral with a Nordic lean; Germany and Britain the patrons it looks to.
  // The fascist road is the likeliest deviation (IKL), the others possible.
  character: {
    lean: "neutral",
    patrons: ["DEU", "GBR"],
    routeBias: { fascist: 1, neutral: 1, communist: 1, democratic: 1 },
  },
  politics: {
    spirits: [
      "fin_scars_of_1918",
      "fin_civil_guards",
      "fin_empty_arsenal",
      "fin_neutral_north",
    ],
    leaders: {
      democratic: "leader_fin",
      communist: "fin_kuusinen",
      fascist: "fin_annala",
      neutral: "fin_mannerheim_regent",
    },
  },
  focuses: FIN_FOCUSES,
  path: FIN_PATH,
  branchPoints: FIN_BRANCH_POINTS,
  events: FIN_EVENTS,
  decisions: FIN_DECISIONS,
  spirits: FIN_SPIRITS,
  persons: FIN_PERSONS,
  flags: FIN_FLAGS,
  groups: FIN_GROUPS,
  claims: [],
  templates: FIN_TEMPLATES,
  aliases: {},
  dropped: [],
};
