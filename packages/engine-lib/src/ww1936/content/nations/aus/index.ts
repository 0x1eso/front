// ww229 (design ww227): Australia's national content, tier A. The tree
// (focuses.ts) and the rest (content.ts) are data only; core.ts holds the
// generals, the catalogue and the start arms.
//
// Mechanism (design §5, "Pacific first"): two ladders of decisions with
// staged spirits. Empire First (aus_dec_empire_1..3: cruisers for the
// Empire, divisions for the Middle East, the arsenal of the south) opens
// from trusting Singapore or standing with the Empire; Pacific First
// (aus_dec_pacific_1..3: northern bases, the American partnership, Allied
// headquarters) from self-reliance or looking to America. The top of one
// ladder closes the first step of the other. Around them: the Militia that
// may not serve overseas (a start spirit, a call-up decision and the
// overseas-service focus), the Second AIF, and the recall of the divisions
// when Japan strikes.
import type { NationDef } from "../types";
import {
  AUS_DECISIONS,
  AUS_EVENTS,
  AUS_FLAGS,
  AUS_GROUPS,
  AUS_PERSONS,
  AUS_SPIRITS,
  AUS_TEMPLATES,
} from "./content";
import { AUS_BRANCH_POINTS, AUS_FOCUSES, AUS_PATH } from "./focuses";

export const NATION_AUS: NationDef = {
  tag: "AUS",
  tier: "A",
  sheet: {
    situation:
      "A federal dominion of under seven million, still climbing out of the Depression, governed by the Lyons coalition. Its defence rests on the Singapore strategy and a British fleet half a world away; the Militia may not serve overseas, and Japan is both its second customer and its great fear.",
    startSpirits: [
      "aus_depression_scars",
      "aus_singapore_strategy",
      "aus_tyranny_of_distance",
      "aus_citizen_militia",
    ],
    dilemmas: [
      {
        branchPoint: "aus_bp_government",
        note: "The UAP-Country coalition carries on (history), Labor reunites early, or a national government above the parties?",
      },
      {
        branchPoint: "aus_bp_singapore",
        note: "Trust Singapore and the Main Fleet (history) or build for self-reliance at home?",
      },
      {
        branchPoint: "aus_bp_aif",
        note: "Raise the Second AIF for service abroad (history) or keep every trained man at home?",
      },
      {
        branchPoint: "aus_bp_ally",
        note: "Look to America (history) or stand together with the Empire?",
      },
      {
        branchPoint: "aus_bp_recall",
        note: "Bring the divisions home when Japan strikes (history) or let them go to Burma?",
      },
    ],
    mechanism:
      "Empire First or Pacific First: two three-step decision ladders with staged spirits; the Militia's home-service limit, its call-up and the overseas-service act.",
    patrons: ["GBR", "USA"],
    rivals: ["JPN"],
    unions: ["NZL"],
    claims: ["aus_timor", "aus_dutch_new_guinea", "aus_new_caledonia"],
    people: [
      "aus_menzies",
      "aus_curtin",
      "aus_page",
      "aus_chifley",
      "aus_miles",
      "aus_sharkey",
      "aus_campbell",
      "aus_stephensen",
      "aus_hughes",
      "aus_lang",
      "aus_gloucester",
      "aus_casey",
      "aus_evatt",
      "aus_calwell",
      "aus_lewis",
      "aus_dedman",
      "aus_rivett",
      "aus_wackett",
      "aus_shedden",
      "aus_blamey",
      "aus_lavarack",
      "aus_sturdee",
      "aus_colvin",
      "aus_collins",
      "aus_williams",
      "aus_bostock",
      "blamey",
      "morshead",
      "mackay",
      "vasey",
      "rowell",
      "bennett",
    ],
    equipment: [
      "aus_lithgow_smle",
      "aus_lithgow_bren",
      "aus_owen_gun",
      "aus_2pdr_at",
      "aus_25pdr_short",
      "aus_lp2_carrier",
      "aus_sentinel_ac1",
      "aus_wirraway",
      "aus_boomerang",
      "aus_dap_beaufort",
      "aus_dap_beaufighter",
      "aus_bathurst_class",
      "aus_tribal_class",
      "gbr_lt_mk6b",
    ],
  },
  // A dominion that looks to Britain first and to America when Japan comes.
  // A strong labour movement makes the communist road possible; the New
  // Guard and the crown loyalists stay fringe unless the country breaks.
  character: {
    lean: "client",
    patrons: ["GBR", "USA"],
    routeBias: { democratic: 1, communist: 1, fascist: 1, neutral: 1 },
  },
  politics: {
    spirits: [
      "aus_depression_scars",
      "aus_singapore_strategy",
      "aus_tyranny_of_distance",
      "aus_citizen_militia",
    ],
    leaders: {
      democratic: "leader_aus",
      communist: "aus_miles",
      fascist: "aus_campbell",
      neutral: "aus_hughes",
    },
  },
  focuses: AUS_FOCUSES,
  path: AUS_PATH,
  branchPoints: AUS_BRANCH_POINTS,
  events: AUS_EVENTS,
  decisions: AUS_DECISIONS,
  spirits: AUS_SPIRITS,
  persons: AUS_PERSONS,
  flags: AUS_FLAGS,
  groups: AUS_GROUPS,
  claims: [],
  templates: AUS_TEMPLATES,
  aliases: {},
  dropped: [],
};
