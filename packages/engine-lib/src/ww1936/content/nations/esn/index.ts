// ww229 (design ww227): Nationalist Spain's national content, tier A. The
// tree is focuses.ts; events, decisions, spirits and people sit beside it;
// generals, the balance of power and the equipment are core.ts. How:
// /home/eser/dev/ww229-format.md. Data only (ContentPurity).
import type { NationDef } from "../types";
import { ESN_DECISIONS } from "./decisions";
import { ESN_EVENTS } from "./events";
import { ESN_FOCUSES } from "./focuses";
import { ESN_PERSONS } from "./people";
import { ESN_SPIRITS } from "./spirits";

export const NATION_ESN: NationDef = {
  tag: "ESN",
  tier: "A",
  sheet: {
    situation:
      "The army's rising of summer 1936 failed in Madrid and Barcelona and became a civil war. The Nationalist zone holds the agrarian west and north, Morocco, the islands and the Army of Africa, but almost no industry; Italy and Germany supply arms for ore and favours. Its coalition (army, Falange, Carlists, monarchists, the Church) agrees on winning and on little else.",
    startSpirits: [
      "esp_civil_war_nation",
      "esn_african_veterans",
      "esn_agrarian_rear",
    ],
    dilemmas: [
      {
        branchPoint: "esn_bp_unification",
        note: "Force Falange and Carlists into one state party, or let the Falange stand alone? History: the Decree of Unification.",
      },
      {
        branchPoint: "esn_bp_crown",
        note: "Keep power with the head of state for life, or open the way to a restoration (Alfonsine or Carlist)? History: the Caudillo's state, a kingdom without a king.",
      },
      {
        branchPoint: "esn_bp_economy",
        note: "Rebuild by autarky or with foreign capital? History: autarky and the INI.",
      },
      {
        branchPoint: "esn_bp_iberia",
        note: "Partner Portugal or seek to absorb it? History: the Iberian Pact and Bloc.",
      },
      {
        branchPoint: "esn_bp_war",
        note: "Name a price and stay out, or enter the war beside the Axis? History: non-belligerence, then neutrality.",
      },
    ],
    mechanism:
      "Balance of power Falange (−) ↔ Traditionalists (+), five banded spirits, three decisions and four events moving it; ends with another ruling ideology.",
    patrons: ["DEU", "ITA"],
    rivals: ["ESR", "SUN", "FRA", "GBR"],
    unions: ["PRT"],
    claims: ["gibraltar", "french_morocco", "esn_oranie"],
    people: [
      "esn_gil_robles",
      "esn_monzon",
      "esn_javier_borbon_parma",
      "esn_serrano_suner",
      "esn_fal_conde",
      "esn_gomez_jordana",
      "esn_carrero_blanco",
      "esn_hedilla",
      "esn_suanzes",
      "esn_carceller",
      "esn_ibanez_martin",
      "esn_davila_chief",
      "esn_vigon",
      "esn_kindelan",
      "esn_moreno",
      "esn_yague",
      "esn_queipo",
      "esn_davila",
      "esn_aranda",
      "esn_solchaga",
      "esn_munoz_grandes",
    ],
    equipment: [
      "esn_mauser_1893",
      "esn_mauser_1943",
      "esn_vickers_105_11",
      "esn_schneider_155_13",
      "esn_88_56_ft",
      "esn_verdeja_1",
      "esn_ha132l",
      "esn_churruca",
      "esn_almirante_cervera",
      "esn_canarias",
      "esn_espana",
      "esn_clase_c",
      "deu_pz1_b",
      "ita_cv33",
      "ita_cr32",
      "deu_he51",
      "deu_ju52",
    ],
  },
  // Franco's Spain sold its entry into the war dearly and stayed out: an
  // opportunist more than a revisionist. The monarchist routes are the
  // likeliest departure.
  character: {
    lean: "opportunist",
    patrons: ["DEU", "ITA"],
    routeBias: { fascist: 3, neutral: 2, democratic: 1, communist: 1 },
  },
  politics: {
    spirits: [
      "esp_civil_war_nation",
      "esn_african_veterans",
      "esn_agrarian_rear",
    ],
    leaders: {
      democratic: "esn_gil_robles",
      communist: "esn_monzon",
      fascist: "leader_esn",
      neutral: "esn_juan_de_borbon",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  focuses: ESN_FOCUSES,
  path: [
    "esn_national_rising",
    "esn_army_of_africa",
    "esn_strait_airlift",
    "esn_navarre_requetes",
    "esn_falange_militias",
    "esn_junta_defense",
    "esn_foreign_aid",
    "esn_generalissimo",
    "esn_war_economy",
    "esn_seville_arsenal",
    "esn_unification_decree",
    "esn_condor_cooperation",
    "esn_northern_campaign",
    "esn_national_aviation",
    "esn_burgos_administration",
    "esn_labour_charter",
    "esn_recognition",
    "esn_rear_workshops",
    "esn_aragon_offensive",
    "esn_ferrol_yards",
    "esn_canarias",
    "esn_first_government",
    "esn_army_reform",
    "esn_legion",
    "esn_final_offensive",
    "esn_lisbon_friendship",
    "esn_axis_course",
    "esn_anti_comintern",
    "esn_roads_and_rails",
    "esn_devastated_regions",
    "esn_iberian_bloc",
    "esn_church_and_state",
    "esn_holy_see",
    "esn_africanist_dream",
    "esn_hendaye_price",
    "esn_non_belligerence",
    "esn_tangier",
    "esn_wolfram_mines",
    "esn_wolfram_both_ways",
    "esn_autarky_policy",
    "esn_blue_division",
    "esn_research_council",
    "esn_ini",
    "esn_falange_youth",
    "esn_cortes_law",
    "esn_infantry_arms",
    "esn_artillery_parks",
    "esn_war_doctrine",
    "esn_air_command",
    "esn_hispano_licence",
    "esn_air_bases",
    "esn_strict_neutrality",
    "esn_regulares",
    "esn_army_school",
    "esn_provisional_officers",
    "esn_standing_army",
    "esn_pyrenees_line",
    "esn_balearic_base",
    "esn_submarines",
    "esn_destroyers",
    "esn_succession_question",
    "esn_succession_law",
    "esn_caudillo_state",
    "esn_allied_overture",
    "esn_shale_oil",
    "esn_reservoirs",
    "esn_aerospace_institute",
    "esn_second_research",
    "esn_hispanidad",
    "esn_verdeja",
    "esn_armoured_division",
    "esn_bomber_wing",
    "esn_air_academy",
    "esn_naval_plan",
    "esn_atlantic_islands",
    "esn_spanish_messerschmitt",
    "esn_trubia_works",
    "esn_asturian_mines",
    "esn_strait_batteries",
  ],
  branchPoints: [
    {
      id: "esn_bp_unification",
      historical: "esn_unification_decree",
      alternatives: ["esn_falange_autonomy"],
      political: true,
    },
    {
      id: "esn_bp_crown",
      historical: "esn_caudillo_state",
      alternatives: ["esn_juan_correspondence", "esn_comunion_tradicionalista"],
      political: true,
    },
    {
      id: "esn_bp_economy",
      historical: "esn_autarky_policy",
      alternatives: ["esn_foreign_capital"],
      political: false,
    },
    {
      id: "esn_bp_iberia",
      historical: "esn_iberian_bloc",
      alternatives: ["esn_one_peninsula"],
      political: false,
    },
    {
      id: "esn_bp_war",
      historical: "esn_non_belligerence",
      alternatives: ["esn_enter_the_war"],
      political: true,
    },
  ],
  events: ESN_EVENTS,
  decisions: ESN_DECISIONS,
  spirits: ESN_SPIRITS,
  persons: ESN_PERSONS,
  flags: [
    "esn_axis_course",
    "esn_high_price",
    "esn_imperial_claims",
    "esn_iberian_idea",
  ],
  groups: [
    // regions: Sevilla (the Seville arsenal, the Strait's northern shore)
    { id: "esn_andalusia", regions: [695], owner1936: "ESN" },
    // regions: Asturias (coal, the Trubia and Oviedo works)
    { id: "esn_asturias", regions: [546], owner1936: "ESR" },
    // regions: Baleares
    { id: "esn_balearics", regions: [660], owner1936: "ESN" },
    // regions: Canary Islands
    { id: "esn_canaries", regions: [1361], owner1936: "ESN" },
    // regions: Ciudad Real (the Puertollano shale)
    { id: "esn_la_mancha", regions: [667], owner1936: "ESR" },
    // regions: El Bayadh (western Algeria, the Oran hinterland)
    { id: "esn_oranie", regions: [747], owner1936: "FRA" },
    // regions: Lisboa
    { id: "esn_lisbon", regions: [646], owner1936: "PRT" },
  ],
  claims: ["gibraltar"],
  templates: [
    // esn_falange_militias: Falange and other party militia columns, rifle
    // battalions with one battery (width 15).
    {
      id: "esn_militia_column",
      country: "ESN",
      battalions: [
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "artillery",
      ],
      support: [],
    },
    // esn_legion (the national unit): Legion banderas grouped as a
    // division, with their own guns, engineers and scouts (width 20).
    {
      id: "esn_legion_division",
      country: "ESN",
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
      support: ["engineer", "recon"],
    },
  ],
  // The old spa pack's spa_foreign_volunteers raises the AI weight of
  // spa_aid_request's volunteer answer (events/spa.ts).
  aliases: { spa_foreign_volunteers: "esn_foreign_aid" },
  dropped: [],
};
