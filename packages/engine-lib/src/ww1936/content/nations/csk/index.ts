// ww229 (design ww227): Czechoslovakia's national content, tier A. The tree
// is in focuses.ts, the events in events.ts, the decisions in decisions.ts,
// spirits and people in people.ts, generals and equipment in core.ts.
// How: /home/eser/dev/ww229-format.md. Data only (ContentPurity).
import type { NationDef } from "../types";
import { CSK_DECISIONS } from "./decisions";
import { CSK_EVENTS } from "./events";
import { CSK_BRANCHES, CSK_FLAGS, CSK_FOCUSES, CSK_PATH } from "./focuses";
import { CSK_PERSONS, CSK_SPIRITS } from "./people";

export const NATION_CSK: NationDef = {
  tag: "CSK",
  tier: "A",
  sheet: {
    situation:
      "A parliamentary democracy under Beneš with the arms industry of central Europe (Škoda, ČKD, Zbrojovka Brno), allied to France, the Soviet Union and the Little Entente. Three million Sudeten Germans, a Hungarian minority and Slovak autonomists pull at the state; Germany presses on three sides and the border is being fortified.",
    startSpirits: [
      "csk_skoda_arsenal",
      "csk_nationalities",
      "csk_island_of_democracy",
    ],
    dilemmas: [
      {
        branchPoint: "csk_bp_course",
        note: "Keep the Castle's parliamentary democracy, or a government of national unity (history: democracy until Munich).",
      },
      {
        branchPoint: "csk_bp_alliance",
        note: "Rely on Paris and London, or on Moscow (history: the West).",
      },
      {
        branchPoint: "csk_bp_munich",
        note: "In the Sudeten crisis trust the alliances, or prepare to fight alone (history: trusted, then yielded).",
      },
      {
        branchPoint: "csk_bp_slovak",
        note: "One Czechoslovak nation run from Prague, or Slovak home rule (history: centralism until the Žilina agreement).",
      },
    ],
    mechanism:
      "Border fortifications in three levels (decisions, spirits csk_forts_1..3) and the Sudeten crisis chain: Henlein's demands, asking the allies for a guarantee, the May mobilisation, then fight or yield; Škoda arms sales as decisions.",
    patrons: ["FRA", "SUN", "GBR"],
    rivals: ["DEU", "HUN", "POL"],
    unions: ["AUT", "HUN"],
    claims: [],
    people: [
      "csk_hodza",
      "csk_sramek",
      "csk_beran",
      "csk_hacha",
      "csk_syrovy_p",
      "csk_gottwald",
      "csk_zapotocky",
      "csk_gajda",
      "csk_stribrny",
      "csk_krofta",
      "csk_jan_masaryk",
      "csk_machnik",
      "csk_englis",
      "csk_moravec",
      "csk_krejci_adv",
      "csk_husarek",
      "csk_loevenstein",
      "csk_bata",
      "csk_heyrovsky",
      "csk_fajfr",
      "csk_krejci",
      "csk_syrovy",
      "csk_vojcechovsky",
      "csk_prchala",
      "csk_viest",
    ],
    equipment: [
      "csk_vz24",
      "csk_zb26",
      "csk_tatra_t82",
      "csk_lt35",
      "csk_tancik_vz33",
      "csk_lt38",
      "csk_100_vz30",
      "csk_150_vz37",
      "csk_47_vz36",
      "csk_avia_b534",
      "csk_letov_s328",
      "csk_aero_mb200",
      "csk_avia_b71",
    ],
  },
  character: {
    lean: "status_quo",
    patrons: ["FRA", "SUN"],
    routeBias: { communist: 1, fascist: 1, neutral: 2 },
  },
  politics: {
    spirits: [
      "csk_skoda_arsenal",
      "csk_nationalities",
      "csk_island_of_democracy",
    ],
    leaders: {
      democratic: "leader_csk",
      communist: "csk_gottwald",
      fascist: "csk_gajda",
      neutral: "csk_beran",
    },
  },
  focuses: CSK_FOCUSES,
  path: CSK_PATH,
  branchPoints: CSK_BRANCHES,
  events: CSK_EVENTS,
  decisions: CSK_DECISIONS,
  spirits: CSK_SPIRITS,
  persons: CSK_PERSONS,
  flags: CSK_FLAGS,
  groups: [],
  claims: [],
  templates: [
    // csk_border_regiments: the border infantry that held the fortified
    // line, with its own guns (minors start with towed artillery only).
    {
      id: "csk_border_division",
      country: "CSK",
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
      support: [],
    },
    // csk_rapid_divisions: horse and guns; tanks join once the tank techs come.
    {
      id: "csk_rapid_division",
      country: "CSK",
      battalions: [
        "cavalry",
        "cavalry",
        "cavalry",
        "cavalry",
        "artillery",
        "artillery",
      ],
      support: [],
    },
  ],
  aliases: {},
  dropped: [],
};
