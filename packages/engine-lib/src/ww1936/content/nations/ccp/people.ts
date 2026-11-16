// ww229: the Chinese Communists' people. Mao Zedong is the P0 leader_ccp
// (persons/leaders.ts). The party's men carry the communist ideology, so
// they serve only a communist government; the other roads have their own
// leaders. Zhu De and Liu Bocheng are P2 generals already, Peng Dehuai is
// this lane's (core.ts). Dates: `from` inclusive, `until` exclusive. Data
// only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CCP_PERSONS: PersonDef[] = [
  // ---- communist: the party ----
  {
    id: "ccp_zhang_wentian",
    nameKey: "ww1936.person.ccp_zhang_wentian",
    country: "CCP",
    roles: ["leader", "advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["party_boss"],
    source:
      "General secretary of the party (Luo Fu) from the Zunyi conference until 1943, then party historian and Northeast cadre: en.wikipedia Zhang Wentian",
  },
  {
    id: "ccp_wang_ming",
    nameKey: "ww1936.person.ccp_wang_ming",
    country: "CCP",
    roles: ["leader", "advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["party_ideologue"] },
    leaderTraits: ["party_boss"],
    from: "1937-11-29",
    source:
      "Comintern delegate in Moscow, flew back to Yan'an at the end of November 1937 and led the Yangtze Bureau in Wuhan: en.wikipedia Wang Ming",
  },
  {
    id: "ccp_zhou_enlai",
    nameKey: "ww1936.person.ccp_zhou_enlai",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "The party's negotiator at Xi'an in 1936 and its representative in Wuhan and Chongqing through the war: en.wikipedia Zhou Enlai",
  },
  {
    id: "ccp_liu_shaoqi",
    nameKey: "ww1936.person.ccp_liu_shaoqi",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["labour_organizer"] },
    source:
      "Labour organiser of the 1920s (Anyuan), head of the North China Bureau from 1936, author of How to Be a Good Communist (1939): en.wikipedia Liu Shaoqi",
  },
  {
    id: "ccp_kang_sheng",
    nameKey: "ww1936.person.ccp_kang_sheng",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["security_chief"] },
    from: "1937-11-29",
    source:
      "Returned from Moscow with Wang Ming in November 1937, head of the Social Affairs Department (security and intelligence) and of the 1943 rescue campaign: en.wikipedia Kang Sheng",
  },
  {
    id: "ccp_bo_gu",
    nameKey: "ww1936.person.ccp_bo_gu",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "Party leader before Zunyi, director of the Liberation Daily and Xinhua from 1941, died in an air crash in April 1946: en.wikipedia Bo Gu",
  },
  {
    id: "ccp_chen_yun",
    nameKey: "ww1936.person.ccp_chen_yun",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1937-11-29",
    source:
      "Back from Moscow in late 1937, head of the Organisation Department, then of the Northwest finance and economy office (1944): en.wikipedia Chen Yun",
  },
  {
    id: "ccp_li_fuchun",
    nameKey: "ww1936.person.ccp_li_fuchun",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "Long March veteran, head of the Central Committee's Finance and Economy Department in Yan'an during the production drive: en.wikipedia Li Fuchun",
  },
  {
    id: "ccp_xu_teli",
    nameKey: "ww1936.person.ccp_xu_teli",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Educator, Mao's teacher in Changsha, president of the Yan'an Natural Sciences Institute from 1940: en.wikipedia Xu Teli",
  },
  {
    id: "ccp_zhu_de_chief",
    nameKey: "ww1936.person.ccp_zhu_de_chief",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "zhu_de",
    source:
      "Commander-in-chief of the Red Army, then of the Eighth Route Army (18th Group Army) from 1937: en.wikipedia Zhu De",
  },
  {
    id: "ccp_peng_dehuai_chief",
    nameKey: "ww1936.person.ccp_peng_dehuai_chief",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    alsoGeneral: "peng_dehuai",
    source:
      "Deputy commander of the Eighth Route Army, planned the Hundred Regiments Offensive of 1940: en.wikipedia Peng Dehuai",
  },
  {
    id: "ccp_ye_jianying",
    nameKey: "ww1936.person.ccp_ye_jianying",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "staff", traits: ["staff_planner"] },
    source:
      "Chief of staff of the Eighth Route Army (18th Group Army) from 1937, chief of staff in Yan'an through the war: en.wikipedia Ye Jianying",
  },
  {
    id: "ccp_liu_bocheng_theorist",
    nameKey: "ww1936.person.ccp_liu_bocheng_theorist",
    country: "CCP",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "staff", traits: ["theorist_land"] },
    alsoGeneral: "liu_bocheng",
    source:
      "Frunze Academy graduate (1930), translator of Soviet field manuals, commander of the 129th Division: en.wikipedia Liu Bocheng",
  },

  // ---- democratic: the coalition road ----
  {
    id: "ccp_song_qingling",
    nameKey: "ww1936.person.ccp_song_qingling",
    country: "CCP",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["popular_front"],
    source:
      "Sun Yat-sen's widow, leader of the China League for Civil Rights and the China Defence League (1938), ally of the Communists in the united front: en.wikipedia Soong Ching-ling",
  },
  {
    id: "ccp_zhang_lan",
    nameKey: "ww1936.person.ccp_zhang_lan",
    country: "CCP",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    source:
      "Sichuan educator and constitutionalist, chairman of the China Democratic League from 1941: en.wikipedia Zhang Lan",
  },

  // ---- non-aligned: the northwest alliance ----
  {
    id: "ccp_zhang_xueliang",
    nameKey: "ww1936.person.ccp_zhang_xueliang",
    country: "CCP",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["generalissimo"],
    source:
      "The Young Marshal, commander of the Northeastern Army at Xi'an, secret truce with the Red Army in 1936, seized Chiang Kai-shek in December 1936: en.wikipedia Zhang Xueliang",
  },
  {
    id: "ccp_yang_hucheng",
    nameKey: "ww1936.person.ccp_yang_hucheng",
    country: "CCP",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["strongman"],
    source:
      "Commander of the Seventeenth Route Army (the Northwestern Army) and Pacification Commissioner of Shaanxi, Zhang Xueliang's partner at Xi'an: en.wikipedia Yang Hucheng",
  },

  // ---- fascist: the Fourth Front Army's commanders ----
  {
    id: "ccp_zhang_guotao",
    nameKey: "ww1936.person.ccp_zhang_guotao",
    country: "CCP",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "Founding member, chairman of the Fourth Front Army's rival central committee (1935-36), left Yan'an for the Nationalists in April 1938: en.wikipedia Zhang Guotao",
  },
  {
    id: "ccp_chen_changhao",
    nameKey: "ww1936.person.ccp_chen_changhao",
    country: "CCP",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["party_boss"],
    source:
      "Political commissar of the Fourth Front Army and of the Western Route Army destroyed in the Hexi Corridor (1936-37): en.wikipedia Chen Changhao",
  },
];
