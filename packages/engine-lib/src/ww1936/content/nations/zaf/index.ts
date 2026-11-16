// ww229 (design ww227): South Africa's national content, tier A. The tree
// is in focuses.ts, the rest beside it; how: /home/eser/dev/ww229-format.md.
// Mechanism: the Smuts-Hertzog balance of power of the Fusion government
// (core.ts, decisions.ts), the war vote of the base content and the Africa
// oath; a Greater South Africa and an Afrikaner republic as the big
// alternative courses.
import type { NationDef } from "../types";
import { ZAF_DECISIONS } from "./decisions";
import { ZAF_EVENTS } from "./events";
import { ZAF_BRANCH_POINTS, ZAF_FOCUSES, ZAF_PATH } from "./focuses";
import { ZAF_PERSONS } from "./people";
import { ZAF_SPIRITS, ZAF_START_SPIRITS } from "./spirits";

export const NATION_ZAF: NationDef = {
  tag: "ZAF",
  tier: "A",
  sheet: {
    situation:
      "A self-governing dominion since the Statute of Westminster and its own Status Act, ruled by the Fusion United Party of Hertzog and Smuts. Malan's Purified Nationalists, and later the Ossewabrandwag, pull Afrikaner opinion away from the Empire, while Rand gold pays for everything. The Defence Force is small, the army is closed to most of the population, and a war in Europe will split Parliament.",
    startSpirits: ZAF_START_SPIRITS,
    dilemmas: [
      {
        branchPoint: "zaf_ob_question",
        note: "Bar civil servants and soldiers from the Ossewabrandwag or leave the movements alone (history: barred, leaders interned).",
      },
      {
        branchPoint: "zaf_protectorates",
        note: "Wait on the High Commission Territories or demand their transfer from London (history: asked, waited, never got them).",
      },
      {
        branchPoint: "zaf_south_west",
        note: "Govern South West Africa as a League mandate or annex it as a fifth province (history: kept as a mandate, run as a province in practice).",
      },
      {
        branchPoint: "zaf_industry_course",
        note: "State industry (ISCOR, ESCOM) or let the mining houses build (history: the state corporations).",
      },
      {
        branchPoint: "zaf_service_oath",
        note: "Volunteers under the Africa oath or a conscription bill (history: volunteers only).",
      },
    ],
    mechanism:
      "The Fusion balance of power between Smuts's Commonwealth wing and Hertzog's nationalists (five banded spirits, speeches and compromises, the centenary trek and the war vote move it); the closed army that only the Corps or a new government open; a Greater South Africa by offers to London and Lisbon.",
    patrons: ["GBR"],
    rivals: ["DEU", "ITA"],
    unions: [],
    claims: ["zaf_hct"],
    people: [
      "zaf_hofmeyr",
      "zaf_reitz",
      "zaf_te_water",
      "zaf_malan",
      "zaf_havenga",
      "zaf_strijdom",
      "zaf_van_rensburg",
      "zaf_pirow",
      "zaf_weichardt",
      "zaf_kotane",
      "zaf_andrews",
      "zaf_dadoo",
      "zaf_van_der_bijl",
      "zaf_oppenheimer",
      "zaf_schonland",
      "zaf_van_ryneveld",
      "zaf_brink",
      "zaf_pienaar",
      "zaf_de_villiers",
      "zaf_klopper",
      "zaf_poole",
    ],
    equipment: [
      "zaf_mh_mk1",
      "zaf_mh_mk2",
      "zaf_mh_mk3",
      "zaf_mh_mk4",
      "zaf_hartbees",
      "zaf_loch_frigate",
      "gbr_hurricane_i",
    ],
  },
  character: {
    lean: "client",
    patrons: ["GBR"],
    routeBias: { neutral: 2, fascist: 1, communist: 1, democratic: 1 },
  },
  politics: {
    spirits: ZAF_START_SPIRITS,
    leaders: {
      democratic: "leader_zaf",
      communist: "zaf_kotane",
      fascist: "zaf_weichardt",
      neutral: "zaf_malan",
    },
  },
  focuses: ZAF_FOCUSES,
  path: ZAF_PATH,
  branchPoints: ZAF_BRANCH_POINTS,
  events: ZAF_EVENTS,
  decisions: ZAF_DECISIONS,
  spirits: ZAF_SPIRITS,
  persons: ZAF_PERSONS,
  flags: [
    "zaf_greater_union",
    "zaf_hct_demanded",
    "zaf_ob_active",
    "zaf_ob_banned",
    "zaf_ob_tolerated",
    "zaf_pirow_tour",
    "zaf_swa_mandate",
    "zaf_swa_province",
  ],
  groups: [
    // Witwatersrand: Gauteng
    {
      id: "zaf_witwatersrand",
      regions: [1264],
      owner1936: "ZAF",
    },
    // the Cape peninsula and Simon's Town: Western Cape
    {
      id: "zaf_cape",
      regions: [1291],
      owner1936: "ZAF",
    },
    // Durban: KwaZulu-Natal
    {
      id: "zaf_natal",
      regions: [1275],
      owner1936: "ZAF",
    },
    // the South West Africa mandate: Khomas, Karas
    {
      id: "zaf_swa",
      regions: [1220, 1254],
      owner1936: "ZAF",
    },
    // the High Commission Territories: Bechuanaland, Basutoland, Swaziland
    {
      id: "zaf_hct",
      regions: [1225, 1285, 1270],
      owner1936: "GBR",
    },
    // Southern Rhodesia
    {
      id: "zaf_rhodesia",
      regions: [1213],
      owner1936: "GBR",
    },
    // Lourenço Marques and Delagoa Bay
    {
      id: "zaf_delagoa",
      regions: [1208],
      owner1936: "PRT",
    },
  ],
  claims: [],
  templates: [
    // The South African infantry division: motorised brigades with their own
    // guns, anti-tank guns and armoured cars.
    {
      id: "zaf_infantry_division",
      country: "ZAF",
      battalions: [
        "motorized",
        "motorized",
        "motorized",
        "motorized",
        "motorized",
        "motorized",
        "mot_artillery",
        "mot_artillery",
        "anti_tank",
        "light_armor",
      ],
      support: [],
    },
    // The 6th South African Armoured Division of the Italian campaign.
    {
      id: "zaf_armoured_division",
      country: "ZAF",
      battalions: [
        "medium_armor",
        "medium_armor",
        "medium_armor",
        "motorized",
        "motorized",
        "motorized",
        "mot_artillery",
        "mot_artillery",
      ],
      support: [],
    },
  ],
  aliases: {},
  dropped: [],
};
