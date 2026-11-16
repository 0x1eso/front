// ww229 (design ww227): Portugal's national content, tier A. The tree is in
// focuses.ts, the rest in its own files; this one holds the data sheet, the
// AI character, the history path, the branch points and the small tables.
// How: /home/eser/dev/ww229-format.md. Data only.
import type { NationDef } from "../types";
import { PRT_DECISIONS } from "./decisions";
import { PRT_EVENTS } from "./events";
import { PRT_FOCUSES } from "./focuses";
import { PRT_PERSONS } from "./people";
import { PRT_SPIRITS } from "./spirits";

export const NATION_PRT: NationDef = {
  tag: "PRT",
  tier: "A",
  sheet: {
    situation:
      "Salazar's New State, three years into the 1933 constitution, has balanced the budget of a poor rural country and silenced its parties. Next door Spain falls into civil war; behind Lisbon lie the Atlantic islands, an empire across three continents and the alliance with England, and under the northern hills the wolfram every army will soon want.",
    startSpirits: [
      "prt_estado_novo",
      "prt_salazar_finances",
      "prt_rural_country",
      "prt_oldest_alliance",
    ],
    dilemmas: [
      {
        branchPoint: "prt_bp_politics",
        note: "Which Portugal: the New State (history), the restored crown, the blue shirts, the republic or the communists?",
      },
      {
        branchPoint: "prt_bp_spain",
        note: "The Spanish war: quiet help to Franco and the Viriatos (history), or strict non-intervention.",
      },
      {
        branchPoint: "prt_bp_iberia",
        note: "Spain after the war: the Iberian pact and bloc (history), or an Iberian union.",
      },
      {
        branchPoint: "prt_bp_wolfram",
        note: "Whom the wolfram goes to: both sides at the highest price (history), or the Allies alone.",
      },
      {
        branchPoint: "prt_bp_azores",
        note: "The Azores: leased to the Allies under the old alliance (history), or closed and armed.",
      },
    ],
    mechanism:
      "Wolfram and the islands: yearly wolfram contracts with Germany or the Allies, an embargo when the Allies insist, and the Azores either leased to Britain and America for arms and goodwill or fortified against all comers.",
    patrons: ["GBR"],
    rivals: ["ESR", "DEU"],
    unions: ["ESN", "ESR"],
    claims: ["prt_olivenca"],
    people: [
      "prt_carmona",
      "prt_duarte_nuno",
      "prt_santos_costa",
      "prt_ferro",
      "prt_duarte_pacheco",
      "prt_alfredo_da_silva",
      "prt_lourenco",
      "prt_armindo_monteiro",
      "prt_teotonio_pereira",
      "prt_caetano",
      "prt_ortins_bettencourt",
      "prt_delgado",
      "prt_egas_moniz",
      "prt_monsaraz",
      "prt_norton_de_matos",
      "prt_bernardino_machado",
      "prt_antonio_sergio",
      "prt_bento_goncalves",
      "prt_cunhal",
      "prt_g_carmona",
      "prt_g_norton_de_matos",
      "prt_craveiro_lopes",
      "prt_botelho_moniz",
      "prt_g_delgado",
    ],
    equipment: [
      "prt_vouga_class",
      "prt_goncalo_velho_class",
      "prt_afonso_de_albuquerque_class",
      "prt_delfim_class",
      "prt_m904_vergueiro",
      "prt_m937_mauser",
      "prt_m938_dreyse",
      "prt_m917_schneider",
      "prt_m943_obus",
      "gbr_gladiator_i",
      "deu_ju52",
      "ita_ba65",
    ],
  },
  character: {
    lean: "neutral",
    patrons: ["GBR"],
    routeBias: { neutral: 1, fascist: 1, democratic: 1, communist: 1 },
  },
  politics: {
    spirits: [
      "prt_estado_novo",
      "prt_salazar_finances",
      "prt_rural_country",
      "prt_oldest_alliance",
    ],
    leaders: {
      democratic: "prt_norton_de_matos",
      communist: "prt_bento_goncalves",
      fascist: "prt_rolao_preto",
      neutral: "leader_prt",
    },
  },
  focuses: PRT_FOCUSES,
  path: [
    "prt_financial_dictatorship",
    "prt_sound_money",
    "prt_wolfram_mines",
    "prt_army_reorganisation",
    "prt_constitution_1933",
    "prt_god_country_family",
    "prt_which_portugal",
    "prt_estado_novo_course",
    "prt_spanish_war",
    "prt_aid_nationalists",
    "prt_public_works",
    "prt_oldest_alliance_renewed",
    "prt_national_union",
    "prt_spn_propaganda",
    "prt_corporative_state",
    "prt_naval_programme",
    "prt_military_aviation",
    "prt_reconstitution_law",
    "prt_industrial_conditioning",
    "prt_colonial_act",
    "prt_pvde",
    "prt_portuguese_legion",
    "prt_german_orders",
    "prt_british_mission",
    "prt_new_rifles",
    "prt_field_artillery",
    "prt_vouga_destroyers",
    "prt_delfim_submarines",
    "prt_iberian_pact",
    "prt_panasqueira",
    "prt_northern_concessions",
    "prt_wolfram_board",
    "prt_cuf_barreiro",
    "prt_national_roads",
    "prt_port_of_lisbon",
    "prt_double_centenary",
    "prt_gladiator_squadron",
    "prt_junkers_squadron",
    "prt_alfeite_arsenal",
    "prt_lisbon_defences",
    "prt_collaborating_neutrality",
    "prt_cacadores",
    "prt_universities",
    "prt_angola_plan",
    "prt_mozambique_ports",
    "prt_estado_novo_endures",
    "prt_iberian_bloc",
    "prt_wolfram_both_sides",
    "prt_lisbon_crossroads",
    "prt_islands_question",
    "prt_wolfram_fortunes",
    "prt_emergency_economy",
    "prt_staff_school",
    "prt_mobilisation_law",
    "prt_ota_air_base",
    "prt_electrification",
    "prt_braco_de_prata",
    "prt_fomento_plan",
    "prt_technical_institute",
    "prt_high_culture",
    "prt_colonial_sloops",
    "prt_coastal_batteries",
    "prt_atlantic_patrol",
    "prt_azores_to_allies",
    "prt_lajes_field",
    "prt_air_arm",
    "prt_modern_fighters",
    "prt_benguela_railway",
    "prt_far_provinces",
    "prt_overseas_provinces",
    "prt_frontier_forts",
    "prt_colonial_battalions",
    "prt_army_of_the_empire",
    "prt_neutral_to_the_end",
    "prt_industrial_reorganisation",
    "prt_colonial_settlement",
    "prt_lusitanian_world",
  ],
  branchPoints: [
    {
      id: "prt_bp_politics",
      historical: "prt_estado_novo_course",
      alternatives: [
        "prt_crown_course",
        "prt_blue_shirts",
        "prt_republic_course",
        "prt_red_course",
      ],
      political: true,
    },
    {
      id: "prt_bp_spain",
      historical: "prt_aid_nationalists",
      alternatives: ["prt_strict_non_intervention"],
      political: false,
    },
    {
      id: "prt_bp_iberia",
      historical: "prt_iberian_pact",
      alternatives: ["prt_iberian_union_idea"],
      political: false,
    },
    {
      id: "prt_bp_wolfram",
      historical: "prt_wolfram_both_sides",
      alternatives: ["prt_wolfram_to_allies"],
      political: false,
    },
    {
      id: "prt_bp_azores",
      historical: "prt_azores_to_allies",
      alternatives: ["prt_azores_closed"],
      political: false,
    },
  ],
  events: PRT_EVENTS,
  decisions: PRT_DECISIONS,
  spirits: PRT_SPIRITS,
  persons: PRT_PERSONS,
  // prt_azores_leased: the Azores leased to Britain; prt_azores_us: to
  // America too; prt_wolfram_embargoed: no more wolfram to Germany;
  // prt_union_grew: Spain joined the union (prt_iberian_union_offer);
  // prt_azores_government: the plan to govern from the islands.
  flags: [
    "prt_azores_leased",
    "prt_azores_us",
    "prt_wolfram_embargoed",
    "prt_union_grew",
    "prt_azores_government",
  ],
  groups: [
    // regions: Viseu, Bragança, Lisboa, Évora, Beja (the mainland)
    {
      id: "prt_mainland",
      regions: [587, 596, 646, 661, 708],
      owner1936: "PRT",
    },
    // regions: Viseu, Bragança (the wolfram country of Beira and Trás-os-Montes)
    { id: "prt_north", regions: [587, 596], owner1936: "PRT" },
    // regions: Azores
    { id: "prt_azores", regions: [1359], owner1936: "PRT" },
    // regions: Azores, Madeira
    { id: "prt_atlantic_islands", regions: [1359, 1360], owner1936: "PRT" },
    // regions: Cabinda, Luanda, Cunene, Cuando Cubango
    {
      id: "prt_angola",
      regions: [1154, 1163, 1175, 1191],
      owner1936: "PRT",
    },
    // regions: Niassa, Lourenço Marques
    { id: "prt_mozambique", regions: [1189, 1208], owner1936: "PRT" },
    // regions: Macau, Goa, Portuguese Timor
    { id: "prt_asia", regions: [931, 1004, 1174], owner1936: "PRT" },
    // regions: Portuguese Timor
    { id: "prt_timor", regions: [1174], owner1936: "PRT" },
    // regions: Badajoz (holds Olivenza, Portuguese until 1801)
    { id: "prt_olivenca", regions: [674], owner1936: "ESR" },
  ],
  claims: ["prt_olivenca"],
  templates: [
    // prt_cacadores: the national unit, a brigade of caçadores (light
    // infantry) with its battery.
    {
      id: "prt_cacadores_brigade",
      country: "PRT",
      battalions: [
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "artillery",
      ],
      support: [],
    },
    // prt_colonial_battalions: an expeditionary column for Africa.
    {
      id: "prt_colonial_column",
      country: "PRT",
      battalions: ["infantry", "infantry", "infantry", "infantry"],
      support: [],
    },
    // The island garrisons of the Azores and Madeira.
    {
      id: "prt_island_regiment",
      country: "PRT",
      battalions: ["infantry", "infantry", "infantry", "artillery"],
      support: [],
    },
  ],
  aliases: {},
  dropped: [],
};
