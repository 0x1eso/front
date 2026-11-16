// ww229 (design ww227): CCP's national content, tier A. The tree is in
// focuses.ts (politics and the united front, with the path and the branch
// points) and focuses2.ts (the war, the army, the economy, intelligence and
// the world outside); the rest in its own file; core.ts holds the
// generals, the equipment and the start arms. Data only.
import type { NationDef } from "../types";
import { CCP_DECISIONS } from "./decisions";
import { CCP_EVENTS } from "./events";
import { CCP_BRANCH_POINTS, CCP_FOCUSES, CCP_PATH } from "./focuses";
import { CCP_FOCUSES_WAR } from "./focuses2";
import { CCP_PERSONS } from "./people";
import { CCP_SPIRITS } from "./spirits";

export const NATION_CCP: NationDef = {
  tag: "CCP",
  tier: "A",
  sheet: {
    situation:
      "The Red Army has just ended the Long March in the loess hills of northern Shaanxi: a few tens of thousands of hardened men, one poor region, and a party whose leaders quarrelled on the way. Nanking's armies and the Northeastern Army surround it, Japan presses on North China, and Moscow wants a united front against Japan. Mao Zedong leads the party in fact, but Zhang Guotao's rival centre and the Comintern's men in Moscow still contest the line.",
    startSpirits: [
      "ccp_sp_long_march_scars",
      "ccp_sp_poor_border_region",
      "ccp_sp_iron_discipline",
      "ccp_sp_rival_centres",
    ],
    dilemmas: [
      {
        branchPoint: "ccp_front_course",
        note: "A second united front with Nanking or no truce with Chiang; history: the united front after Xi'an.",
      },
      {
        branchPoint: "ccp_party_course",
        note: "Mao's sinified line or the Comintern's line brought by Wang Ming; history: Mao's line, settled at the 1938 plenum.",
      },
      {
        branchPoint: "ccp_war_course",
        note: "Independent guerrilla war in the mountains or mobile war with big units; history: guerrilla war first (Luochuan).",
      },
      {
        branchPoint: "ccp_land_course",
        note: "Reduce rent and interest to keep the landlords in the front, or take the land now; history: rent reduction until 1946.",
      },
      {
        branchPoint: "ccp_aid_course",
        note: "Self-reliance in the Border Region or a supply road from the Soviets through Xinjiang; history: self-reliance.",
      },
      {
        branchPoint: "ccp_screening_course",
        note: "Let the security campaign run or screen with care; history: the 1943 rescue campaign, then an apology.",
      },
    ],
    mechanism:
      "The base-area network: four bases behind the Japanese lines (Shanxi-Chahar-Hebei, Taihang, Shandong, central China), each a once-only decision while Japan holds part of the land; each raises resistance there and the network's stage spirit (four stages), and the network opens a recurring campaign decision. Plus the Kwantung arsenals: the Japanese tank and fighter held as designs from the start come as stock when Manchuria falls.",
    patrons: ["SUN"],
    rivals: ["CHN", "JPN", "MCK", "XBM"],
    unions: [],
    claims: ["ccp_shaan_gan"],
    people: [
      "ccp_zhang_wentian",
      "ccp_wang_ming",
      "ccp_zhou_enlai",
      "ccp_liu_shaoqi",
      "ccp_kang_sheng",
      "ccp_bo_gu",
      "ccp_chen_yun",
      "ccp_li_fuchun",
      "ccp_xu_teli",
      "ccp_zhu_de_chief",
      "ccp_peng_dehuai_chief",
      "ccp_ye_jianying",
      "ccp_liu_bocheng_theorist",
      "ccp_song_qingling",
      "ccp_zhang_lan",
      "ccp_zhang_xueliang",
      "ccp_yang_hucheng",
      "ccp_zhang_guotao",
      "ccp_chen_changhao",
      "peng_dehuai",
      "nie_rongzhen",
      "xu_xiangqian",
      "chen_yi",
      "su_yu",
      "ye_ting",
    ],
    equipment: ["ccp_balu_rifle", "jpn_type97_chiha", "jpn_ki43_2"],
  },
  character: {
    lean: "revisionist",
    patrons: ["SUN"],
    routeBias: { democratic: 1, neutral: 1, fascist: 0 },
  },
  politics: {
    spirits: [
      "ccp_sp_long_march_scars",
      "ccp_sp_poor_border_region",
      "ccp_sp_iron_discipline",
      "ccp_sp_rival_centres",
    ],
    leaders: {
      democratic: "ccp_song_qingling",
      communist: "leader_ccp",
      fascist: "ccp_zhang_guotao",
      neutral: "ccp_zhang_xueliang",
    },
  },
  focuses: [...CCP_FOCUSES, ...CCP_FOCUSES_WAR],
  path: CCP_PATH,
  branchPoints: CCP_BRANCH_POINTS,
  events: CCP_EVENTS,
  decisions: CCP_DECISIONS,
  spirits: CCP_SPIRITS,
  persons: CCP_PERSONS,
  flags: [
    "ccp_base_jin_cha_ji",
    "ccp_base_taihang",
    "ccp_base_shandong",
    "ccp_base_central_china",
    "ccp_kwantung_arms",
  ],
  groups: [
    // regions: Chahar, Hebei, Beijing, Hebei 2 (the Shanxi-Chahar-Hebei base's plain side)
    { id: "ccp_jin_cha_ji", regions: [493, 589, 630, 648], owner1936: "CHN" },
    // regions: Shandong
    { id: "ccp_shandong", regions: [710], owner1936: "CHN" },
    // regions: Jiangsu, Anhui (the New Fourth Army's ground)
    { id: "ccp_central_china", regions: [783, 789], owner1936: "CHN" },
    // regions: Shaanxi, Gansu (the Border Region's surroundings)
    { id: "ccp_shaan_gan", regions: [670, 573], owner1936: "CHN" },
  ],
  claims: ["ccp_shaan_gan"],
  templates: [
    // ccp_main_force_regiments, the national unit: a main-force brigade of
    // the Eighth Route Army, light infantry with a cavalry screen and a few
    // mountain guns (width 18).
    {
      id: "ccp_tpl_main_force",
      country: "CCP",
      battalions: [
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "infantry",
        "cavalry",
        "artillery",
      ],
      support: ["recon", "engineer"],
    },
    // ccp_hui_detachment: a Hui cavalry detachment for the plains.
    {
      id: "ccp_tpl_hui_cavalry",
      country: "CCP",
      battalions: ["cavalry", "cavalry", "cavalry", "cavalry"],
      support: ["recon"],
    },
  ],
  aliases: {
    ccp_yanan: "ccp_shaanbei_refuge",
    ccp_united_front: "ccp_second_united_front",
    ccp_independent: "ccp_no_truce",
    ccp_eighth_route: "ccp_eighth_route_army",
    ccp_new_fourth: "ccp_new_fourth_army",
    ccp_base_areas: "ccp_into_the_mountains",
    ccp_peoples_war: "ccp_protracted_war",
    ccp_hundred_regiments: "ccp_hundred_regiments_offensive",
    ccp_production: "ccp_great_production",
    ccp_cave_arsenals: "ccp_cave_workshops",
    ccp_mass_line: "ccp_sinified_marxism",
    ccp_moscow_link: "ccp_radio_to_moscow",
    ccp_cadres: "ccp_kangda",
    ccp_militia: "ccp_self_defence_corps",
    ccp_rear_intel: "ccp_social_affairs",
    ccp_field_armies: "ccp_field_armies_formed",
    ccp_captured_arms: "ccp_arms_from_the_enemy",
    ccp_party_congress: "ccp_seventh_congress",
    ccp_northeast: "ccp_go_north",
    ccp_new_china: "ccp_war_for_china",
    ccp_rent_reduction: "ccp_rent_reduction_policy",
    ccp_party_school: "ccp_central_party_school",
  },
  dropped: [],
};
