// ww229 (design ww227): Republican Spain's national content, tier A. The
// tree is focusesWar.ts, focusesState.ts, focusesEcon.ts and
// focusesWorld.ts; events, decisions, spirits and people sit beside it;
// generals, the balance of power and the equipment are core.ts. How:
// /home/eser/dev/ww229-format.md. Data only (ContentPurity).
import type { NationDef } from "../types";
import { ESR_DECISIONS } from "./decisions";
import { ESR_EVENTS_AID } from "./eventsAid";
import { ESR_EVENTS_POLITICS } from "./eventsPolitics";
import { ESR_FOCUSES_ECON } from "./focusesEcon";
import { ESR_FOCUSES_STATE } from "./focusesState";
import { ESR_FOCUSES_WAR } from "./focusesWar";
import { ESR_FOCUSES_WORLD } from "./focusesWorld";
import { ESR_PATH } from "./path";
import { ESR_PERSONS } from "./people";
import { ESR_SPIRITS } from "./spirits";

const START_SPIRITS = [
  "esp_civil_war_nation",
  "esr_gold_reserve",
  "esr_industrial_cities",
  "esr_revolutionary_rear",
  "esr_divided_officers",
];

export const NATION_ESR: NationDef = {
  tag: "ESR",
  tier: "A",
  sheet: {
    situation:
      "The Popular Front governs a country in turmoil; when the army rises in summer 1936 the Republic keeps Madrid, Barcelona, Valencia, the northern coast, the industry, most of the fleet and the gold, but loses most of its officers, and the workers' parties and unions arm themselves and make their own revolution. Britain and France choose non-intervention; only the Soviet Union, paid in gold, and Mexico send arms. Its coalition (republicans, socialists, Communists, anarchists, Catalan and Basque nationalists) fights the Nationalists and argues over war or revolution.",
    startSpirits: START_SPIRITS,
    dilemmas: [
      {
        branchPoint: "esr_bp_army",
        note: "Turn the militias into a regular army of mixed brigades, or keep the revolutionary columns? History: the Popular Army.",
      },
      {
        branchPoint: "esr_bp_power",
        note: "A unity government of all the Popular Front, or the Communists' line, or the anarchists' revolution? History: the unity governments of Largo Caballero and Negrín.",
      },
      {
        branchPoint: "esr_bp_gold",
        note: "Send the gold to Moscow for Soviet arms, or to Paris for what the market will sell? History: Moscow.",
      },
      {
        branchPoint: "esr_bp_industry",
        note: "Leave the factories to the workers' committees, or put them under the state? History: collectivisation, with the Generalitat's war industries commission.",
      },
      {
        branchPoint: "esr_bp_resist",
        note: "Resist to the end hoping for a European war, or seek a negotiated peace? History: Negrín resisted, the officers' council broke away at the end.",
      },
      {
        branchPoint: "esr_bp_brigades",
        note: "Send the International Brigades home to win London and Paris, or keep them? History: they were withdrawn.",
      },
    ],
    mechanism:
      "Balance of power PCE (−) ↔ CNT-FAI (+), five banded spirits, three decisions and five events moving it; ends with another ruling ideology. Second: the gold, spent once on Moscow or Paris, opens the arms deliveries and purchases.",
    patrons: ["SUN", "FRA", "MEX"],
    rivals: ["ESN", "ITA", "DEU"],
    unions: ["PRT"],
    claims: ["esr_baleares", "esr_portugal"],
    people: [
      "esr_negrin",
      "esr_prieto",
      "esr_ibarruri",
      "esr_garcia_oliver",
      "esr_casado",
      "esr_besteiro",
      "esr_largo_caballero",
      "esr_montseny",
      "esr_alvarez_del_vayo",
      "esr_tarradellas",
      "esr_herrera",
      "esr_rojo_chief",
      "esr_matallana",
      "esr_cordon",
      "esr_hidalgo_de_cisneros",
      "esr_buiza",
      "esr_rojo",
      "esr_modesto",
      "esr_lister",
      "esr_hernandez_saravia",
      "esr_mera",
      "esr_casado_gen",
    ],
    equipment: [
      "esr_mauser_1893",
      "esr_naranjero",
      "esr_vickers_105_11",
      "esr_schneider_155_13",
      "esr_nid52",
      "esr_i15_chato",
      "esr_breguet_19",
      "esr_vildebeest",
      "esr_churruca",
      "esr_mendez_nunez",
      "esr_libertad",
      "esr_jaime_i",
      "esr_clase_c",
      "fra_ft17",
      "sun_t26_33",
      "sun_bt5",
      "sun_i16",
      "sun_sb2",
    ],
  },
  // A Republic defending what it has; its Communists are the likeliest
  // departure, then the officers' peace. The fascist route is for players.
  character: {
    lean: "status_quo",
    patrons: ["SUN", "FRA"],
    routeBias: { communist: 2, neutral: 1, fascist: 0, democratic: 1 },
  },
  politics: {
    spirits: START_SPIRITS,
    leaders: {
      democratic: "leader_esr",
      communist: "esr_diaz",
      fascist: "title:leader_fascist",
      neutral: "esr_casado",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  focuses: [
    ...ESR_FOCUSES_WAR,
    ...ESR_FOCUSES_STATE,
    ...ESR_FOCUSES_ECON,
    ...ESR_FOCUSES_WORLD,
  ],
  path: ESR_PATH,
  branchPoints: [
    {
      id: "esr_bp_army",
      historical: "esr_popular_army",
      alternatives: ["esr_revolutionary_militias"],
      political: false,
    },
    {
      id: "esr_bp_power",
      historical: "esr_unity_government",
      alternatives: ["esr_pce_course", "esr_cnt_course"],
      political: true,
    },
    {
      id: "esr_bp_gold",
      historical: "esr_gold_to_moscow",
      alternatives: ["esr_gold_to_paris"],
      political: false,
    },
    {
      id: "esr_bp_industry",
      historical: "esr_collectivised_works",
      alternatives: ["esr_state_factories"],
      political: false,
    },
    {
      id: "esr_bp_resist",
      historical: "esr_resist_to_win",
      alternatives: ["esr_peace_party"],
      political: true,
    },
    {
      id: "esr_bp_brigades",
      historical: "esr_farewell_brigades",
      alternatives: ["esr_keep_brigades"],
      political: false,
    },
  ],
  events: [...ESR_EVENTS_AID, ...ESR_EVENTS_POLITICS],
  decisions: ESR_DECISIONS,
  spirits: ESR_SPIRITS,
  persons: ESR_PERSONS,
  flags: ["esr_soviet_gold", "esr_paris_gold"],
  groups: [
    // regions: Asturias (the northern zone: coal, the Trubia works)
    { id: "esr_north", regions: [546], owner1936: "ESR" },
    // regions: Valencia (the Levante, the government's seat from late 1936)
    { id: "esr_levante", regions: [659], owner1936: "ESR" },
    // regions: Murcia (Cartagena, the fleet's base and arsenal)
    { id: "esr_cartagena", regions: [696], owner1936: "ESR" },
    // regions: Ciudad Real (the Almadén mercury mines)
    { id: "esr_almaden", regions: [667], owner1936: "ESR" },
    // regions: Baleares (Mallorca, held by the Nationalists)
    { id: "esr_baleares", regions: [660], owner1936: "ESN" },
    // regions: Lisboa, Viseu, Bragança, Évora, Beja
    {
      id: "esr_portugal",
      regions: [646, 587, 596, 661, 708],
      owner1936: "PRT",
    },
  ],
  claims: [],
  templates: [
    // esr_arm_the_people, esr_revolutionary_militias: the party and union
    // columns, rifle battalions with one battery (width 15).
    {
      id: "esr_militia_column",
      country: "ESR",
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
    // esr_albacete_base (the national unit): an International Brigade
    // division, volunteer battalions with their own guns, engineers and
    // scouts (width 20).
    {
      id: "esr_international_brigade",
      country: "ESR",
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
  aliases: { spa_foreign_volunteers: "esr_appeal_abroad" },
  dropped: [],
};
