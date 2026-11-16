// ww229: Nationalist China's people: leaders for every ideology (Chiang
// Kai-shek is the P0 leader_chn) and the advisors of the government. A
// person with an ideology serves only under it. Dates: `from` inclusive,
// `until` exclusive. Data only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CHN_PERSONS: PersonDef[] = [
  {
    id: "chn_kong_xiangxi",
    nameKey: "ww1936.person.chn_kong_xiangxi",
    country: "CHN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    leaderTraits: ["caretaker"],
    source:
      "Minister of Finance 1933-1944 and President of the Executive Yuan 1938-1939: en.wikipedia H. H. Kung",
  },
  {
    id: "chn_song_ziwen",
    nameKey: "ww1936.person.chn_song_ziwen",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "Former finance minister; head of the Bank of China, envoy for loans in Washington from 1940, foreign minister 1942: en.wikipedia T. V. Soong",
  },
  {
    id: "chn_chen_lifu",
    nameKey: "ww1936.person.chn_chen_lifu",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "Leader with his brother of the CC Clique, head of the party Organisation Department, Minister of Education 1938-1944: en.wikipedia Chen Lifu",
  },
  {
    id: "chn_dai_li",
    nameKey: "ww1936.person.chn_dai_li",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    source:
      "Head of the special services of the Blue Shirts' society, then of the Military Statistics Bureau (Juntong) from 1938: en.wikipedia Dai Li",
  },
  {
    id: "chn_weng_wenhao",
    nameKey: "ww1936.person.chn_weng_wenhao",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "Geologist; secretary-general of the Executive Yuan from 1935, head of the National Resources Commission and Minister of Economic Affairs from 1938: en.wikipedia Wong Wen-hao",
  },
  {
    id: "chn_yu_dawei",
    nameKey: "ww1936.person.chn_yu_dawei",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Harvard-trained mathematician, director of the Ordnance Department 1933-1944: en.wikipedia Yu Ta-wei",
  },
  {
    id: "chn_falkenhausen",
    nameKey: "ww1936.person.chn_falkenhausen",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_training"] },
    until: "1938-07-05",
    source:
      "Head of the German military mission in China 1934 until his recall in mid-1938: en.wikipedia Alexander von Falkenhausen (leaving date from memory)",
  },
  {
    id: "chn_xu_yongchang",
    nameKey: "ww1936.person.chn_xu_yongchang",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    source:
      "Director of military operations of the Military Affairs Commission through the war; signed the Japanese surrender for China in 1945: en.wikipedia Xu Yongchang",
  },
  {
    id: "chn_he_yingqin_chief",
    nameKey: "ww1936.person.chn_he_yingqin_chief",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "he_yingqin",
    source:
      "Minister of War 1930-1944, chief of the general staff from 1938: en.wikipedia He Yingqin",
  },
  {
    id: "chn_chen_cheng_chief",
    nameKey: "ww1936.person.chn_chen_cheng_chief",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "chen_cheng",
    source:
      "Commander at Shanghai and Wuhan, then of the 6th War Area and the Expeditionary Force: en.wikipedia Chen Cheng",
  },
  {
    id: "chn_zhou_zhirou",
    nameKey: "ww1936.person.chn_zhou_zhirou",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "Head of the Central Aviation School at Jianqiao, commander of the air force in the war: en.wikipedia Zhou Zhirou",
  },
  {
    id: "chn_chennault",
    nameKey: "ww1936.person.chn_chennault",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    from: "1937-06-01",
    locked: true,
    source:
      "Retired US Army Air Corps captain, air adviser to the Chinese government from mid-1937, leader of the American Volunteer Group: en.wikipedia Claire Lee Chennault (arrival month from memory)",
  },
  {
    id: "chn_chen_shaokuan",
    nameKey: "ww1936.person.chn_chen_shaokuan",
    country: "CHN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_dockyard"] },
    source:
      "Commander-in-chief of the Chinese navy through the 1930s and the war: en.wikipedia Chen Shaokuan",
  },
  {
    id: "chn_sun_fo",
    nameKey: "ww1936.person.chn_sun_fo",
    country: "CHN",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    source:
      "Son of Sun Yat-sen, President of the Legislative Yuan from 1932, chief author of the 1936 draft constitution: en.wikipedia Sun Fo",
  },
  {
    id: "chn_zhang_junmai",
    nameKey: "ww1936.person.chn_zhang_junmai",
    country: "CHN",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["orator"] },
    leaderTraits: ["reformer"],
    source:
      "Founder of the National Socialist Party of China (a constitutionalist party), later a founder of the Democratic League and drafter of the 1946 constitution: en.wikipedia Carsun Chang",
  },
  {
    id: "chn_hu_shih",
    nameKey: "ww1936.person.chn_hu_shih",
    country: "CHN",
    roles: ["advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "Liberal scholar of the New Culture Movement, ambassador to the United States 1938-1942: en.wikipedia Hu Shih",
  },
  {
    id: "chn_wang_jingwei",
    nameKey: "ww1936.person.chn_wang_jingwei",
    country: "CHN",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["peace_negotiator"],
    until: "1944-11-10",
    source:
      "Vice-chairman of the Kuomintang, left Chongqing in 1938 and headed the Japanese-sponsored government in Nanjing from 1940 until his death in 1944: en.wikipedia Wang Jingwei",
  },
  {
    id: "chn_he_zhonghan",
    nameKey: "ww1936.person.chn_he_zhonghan",
    country: "CHN",
    roles: ["leader", "advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["propagandist"] },
    leaderTraits: ["strongman"],
    source:
      "Whampoa graduate, a founder and secretary of the Blue Shirts' Society for Vigorous Practice: en.wikipedia Blue Shirts Society; zh.wikipedia 贺衷寒",
  },
  {
    id: "chn_zhou_fohai",
    nameKey: "ww1936.person.chn_zhou_fohai",
    country: "CHN",
    roles: ["advisor"],
    ideology: "fascist",
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "Kuomintang propaganda official who followed Wang Jingwei and became finance minister of his Nanjing government: en.wikipedia Zhou Fohai",
  },
  {
    id: "chn_song_qingling",
    nameKey: "ww1936.person.chn_song_qingling",
    country: "CHN",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["popular_front"],
    source:
      "Widow of Sun Yat-sen, leader of the Kuomintang left and of the China League for Civil Rights: en.wikipedia Soong Ching-ling",
  },
  {
    id: "chn_li_jishen",
    nameKey: "ww1936.person.chn_li_jishen",
    country: "CHN",
    roles: ["leader", "advisor"],
    ideology: "communist",
    advisor: { slot: "army_chief", traits: ["chief_maneuver"] },
    leaderTraits: ["strongman"],
    source:
      "General, chairman of the Fujian People's Government of 1933, later founder of the Revolutionary Committee of the Kuomintang: en.wikipedia Li Jishen",
  },
];
