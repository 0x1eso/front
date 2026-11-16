// ww229 (design ww227): Yugoslavia's national content, tier A. The tree is
// in focuses.ts, events and decisions in events.ts, spirits, people, the
// mountain division and the claimed region groups in people.ts; generals,
// the balance of power, the catalogue and the start arms in core.ts.
import type { NationDef } from "../types";
import { YUG_DECISIONS, YUG_EVENTS } from "./events";
import { YUG_BRANCHES, YUG_FOCUSES, YUG_PATH } from "./focuses";
import { YUG_GROUPS, YUG_PERSONS, YUG_SPIRITS, YUG_TEMPLATES } from "./people";

export const NATION_YUG: NationDef = {
  tag: "YUG",
  tier: "A",
  sheet: {
    situation:
      "A kingdom of Serbs, Croats and Slovenes ruled by Prince Paul's regency for the boy king Peter II, with Stojadinović's Radical Union in office. The Croat Peasant Party boycotts Belgrade's centralism; the economy is peasant, the mines (Bor copper, Bosnian bauxite and iron) are wanted by every great power. France's old ally drifts toward Rome and Berlin.",
    startSpirits: [
      "yug_regency_council",
      "yug_croat_discontent",
      "yug_peasant_economy",
      "yug_salonika_veterans",
    ],
    dilemmas: [
      {
        branchPoint: "yug_premier",
        note: "Keep Stojadinović and his Vođa style, or let the regent dismiss him (history: dismissed, Cvetković).",
      },
      {
        branchPoint: "yug_croats",
        note: "Bargain with Maček or rule the Croats from Belgrade (history: the Sporazum and the Banovina of Croatia).",
      },
      {
        branchPoint: "yug_alignment",
        note: "Lean to Italy and Germany or stay with France and the Little Entente (history: the Italian pact and German trade).",
      },
      {
        branchPoint: "yug_pact",
        note: "Sign the Tripartite Pact or stay armed and neutral (history: signed, then the officers' coup).",
      },
      {
        branchPoint: "yug_defence",
        note: "Defend every border or fall back on the Bosnian mountains (history: the cordon, broken in days).",
      },
      {
        branchPoint: "yug_fighters",
        note: "Buy Messerschmitts and Hurricanes or build the IK-3 at home (history: bought abroad).",
      },
    ],
    mechanism:
      "Balance of power: Serb centralism against Croat autonomy; bands give unrest or concord, the Sporazum road and the iron hand move it, and it ends when another ideology rules.",
    patrons: ["FRA", "GBR", "ITA", "DEU"],
    rivals: ["ITA", "HUN", "BGR", "ALB"],
    unions: ["BGR"],
    claims: ["istria", "yug_zara", "yug_albania", "yug_salonika"],
    people: [
      "yug_stojadinovic",
      "yug_cvetkovic",
      "yug_subasic",
      "yug_grol",
      "yug_tito",
      "yug_kardelj",
      "yug_ljotic",
      "yug_korosec",
      "yug_cincar_markovic",
      "yug_acimovic",
      "yug_vajfert",
      "yug_milankovic",
      "yug_nedic_adv",
      "yug_pesic_adv",
      "yug_simovic_adv",
      "yug_polic",
      "yug_nedic",
      "yug_pesic",
      "yug_kalafatovic",
      "yug_maric",
      "yug_mihailovic",
    ],
    equipment: [
      "yug_m24",
      "yug_zb30j",
      "yug_fury_ii",
      "yug_ik2",
      "yug_ik3",
      "yug_potez25",
      "yug_do17k",
      "yug_blenheim_i",
      "yug_dubrovnik",
      "yug_beograd",
      "yug_hrabri",
      "yug_osvetnik",
      "fra_ft17",
      "gbr_hurricane_i",
    ],
  },
  character: {
    lean: "status_quo",
    patrons: ["FRA", "GBR"],
    routeBias: { democratic: 1, communist: 2, fascist: 1 },
  },
  politics: {
    spirits: [
      "yug_regency_council",
      "yug_croat_discontent",
      "yug_peasant_economy",
      "yug_salonika_veterans",
    ],
    leaders: {
      democratic: "yug_macek",
      communist: "yug_tito",
      fascist: "yug_ljotic",
      neutral: "leader_yug",
    },
  },
  focuses: YUG_FOCUSES,
  path: YUG_PATH,
  branchPoints: YUG_BRANCHES,
  events: YUG_EVENTS,
  decisions: YUG_DECISIONS,
  spirits: YUG_SPIRITS,
  persons: YUG_PERSONS,
  flags: ["yug_gold_saved", "yug_ustase_restrained"],
  groups: YUG_GROUPS,
  claims: ["yug_zara"],
  templates: YUG_TEMPLATES,
  aliases: {},
  dropped: [],
};
