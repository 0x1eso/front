// ww229 (design ww227): CHN's national content, tier A. The tree, path and
// branch points are in focuses.ts, the rest in its own file; core.ts holds
// the generals, the equipment and the start arms. The old pack (focus/chn.ts)
// stays for the ids other content names: its four clique focuses are aliased
// to this tree's, and its events, decisions, spirits and templates are used
// from here. Data only.
import type { NationDef } from "../types";
import { CHN_DECISIONS } from "./decisions";
import { CHN_EVENTS } from "./events";
import { CHN_BRANCH_POINTS, CHN_FOCUSES, CHN_PATH } from "./focuses";
import { CHN_PERSONS } from "./people";
import { CHN_SPIRITS } from "./spirits";

export const NATION_CHN: NationDef = {
  tag: "CHN",
  tier: "A",
  sheet: {
    situation:
      "The Nationalist government in Nanjing has ruled the Yangtze valley for ten years, building banks, railways and a German-trained core of the army, while provincial cliques hold the southwest and the northwest and the Communists have escaped to Shaanxi. Japan holds Manchuria and presses on the northern provinces. The state is a one-party tutelage under Chiang Kai-shek, rich in men and poor in industry.",
    startSpirits: [
      "chn_warlords",
      "chn_sp_nanjing_decade",
      "chn_sp_personal_armies",
      "chn_sp_vast_peasantry",
    ],
    dilemmas: [
      {
        branchPoint: "chn_front_course",
        note: "Stop the civil war and front with the Communists, or finish them first; history: the united front.",
      },
      {
        branchPoint: "chn_regime_course",
        note: "Rule through the Military Affairs Commission or through the party machine; history: the Commission.",
      },
      {
        branchPoint: "chn_economy_course",
        note: "Heavy industry in the interior or light industry first; history: the heavy-industry plan.",
      },
      {
        branchPoint: "chn_foreign_course",
        note: "The Soviet pact or holding on to Germany; history: the Soviet pact, the Germans left.",
      },
      {
        branchPoint: "chn_war_course",
        note: "Fight at Shanghai or hold the northern plain; history: Shanghai.",
      },
      {
        branchPoint: "chn_dyke_course",
        note: "Break the Yellow River dykes or spare them; history: broken.",
      },
    ],
    mechanism:
      "The existing centre-provinces balance of power (bop_chn_*), worked by focuses, two band events and the provincial armies decision; plus the united front's three states (uneasy, working, broken) worked by events and decisions, and the tungsten trade with Germany or America.",
    patrons: ["DEU", "SUN", "USA"],
    rivals: ["JPN", "MCK", "CCP"],
    unions: [],
    claims: [
      "manchuria",
      "kwantung",
      "taiwan",
      "chn_outer_mongolia",
      "chn_tibet",
      "chn_tuva",
    ],
    people: [
      "chn_kong_xiangxi",
      "chn_song_ziwen",
      "chn_chen_lifu",
      "chn_dai_li",
      "chn_weng_wenhao",
      "chn_yu_dawei",
      "chn_falkenhausen",
      "chn_xu_yongchang",
      "chn_he_yingqin_chief",
      "chn_chen_cheng_chief",
      "chn_zhou_zhirou",
      "chn_chennault",
      "chn_chen_shaokuan",
      "chn_sun_fo",
      "chn_zhang_junmai",
      "chn_hu_shih",
      "chn_wang_jingwei",
      "chn_he_zhonghan",
      "chn_zhou_fohai",
      "chn_song_qingling",
      "chn_li_jishen",
      "wei_lihuang",
      "tang_enbo",
      "hu_zongnan",
      "zhang_fakui",
      "gu_zhutong",
      "sun_liren",
    ],
    equipment: [
      "chn_hanyang88",
      "chn_zhongzheng",
      "chn_type26_lmg",
      "chn_pak36",
      "chn_bofors_75_mtn",
      "chn_sfh18",
      "chn_flak30",
      "chn_vickers_mk_e",
      "chn_hawk3",
      "chn_hawk75m",
      "chn_gamma_2e",
      "chn_ning_hai",
      "chn_chao_ho",
      "deu_pz1_b",
      "deu_sdkfz222",
      "ita_cv33",
      "ita_cr32",
      "sun_t26_33",
      "sun_i16",
      "sun_sb2",
    ],
  },
  character: {
    lean: "status_quo",
    patrons: ["DEU", "SUN", "USA"],
    routeBias: { democratic: 1, fascist: 2, communist: 1 },
  },
  politics: {
    spirits: [
      "chn_warlords",
      "chn_sp_nanjing_decade",
      "chn_sp_personal_armies",
      "chn_sp_vast_peasantry",
    ],
    leaders: {
      democratic: "chn_sun_fo",
      communist: "chn_song_qingling",
      fascist: "chn_wang_jingwei",
      neutral: "leader_chn",
    },
  },
  focuses: CHN_FOCUSES,
  path: CHN_PATH,
  branchPoints: CHN_BRANCH_POINTS,
  events: CHN_EVENTS,
  decisions: CHN_DECISIONS,
  spirits: CHN_SPIRITS,
  persons: CHN_PERSONS,
  flags: [],
  groups: [
    // regions: Hunan, Jiangxi (the tungsten and antimony country)
    { id: "chn_tungsten", regions: [846, 847], owner1936: "CHN" },
    // regions: Guizhou, Sichuan, Chongqing (the great rear)
    { id: "chn_great_rear", regions: [856, 795, 825], owner1936: "CHN" },
    // regions: Hebei, Beijing, Hebei 2, Shandong
    { id: "chn_north_china", regions: [589, 630, 648, 710], owner1936: "CHN" },
    // regions: the whole Mongolian People's Republic
    {
      id: "chn_outer_mongolia",
      regions: [
        331, 358, 367, 370, 373, 381, 382, 392, 400, 402, 411, 442, 443, 445,
        456, 465, 470, 517,
      ],
      owner1936: "MNG",
    },
    // regions: Xizang (C), Xizang (SE)
    { id: "chn_tibet", regions: [753, 817], owner1936: "TIB" },
    // regions: Tuva
    { id: "chn_tuva", regions: [299], owner1936: "TTU" },
  ],
  claims: [],
  templates: [
    // chn_model_divisions: the German-trained reorganised divisions, with
    // their own artillery, anti-tank guns and signals.
    {
      id: "chn_tpl_model_division",
      country: "CHN",
      battalions: [
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "artillery",
        "artillery",
        "anti_tank",
      ],
      support: ["engineer", "recon", "signal"],
    },
  ],
  aliases: {
    chn_integrate_guangxi: "chn_guangxi_terms",
    chn_integrate_yunnan: "chn_yunnan_terms",
    chn_integrate_shanxi: "chn_shanxi_terms",
    chn_integrate_northwest: "chn_northwest_terms",
  },
  dropped: [],
};
