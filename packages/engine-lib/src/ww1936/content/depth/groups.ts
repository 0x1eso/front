// World War 1936 P6 (Phase B): the region groups the focus packs asked for
// (the K1–K4 lanes' "K5 request" lines). Region ids come from
// resources/maps/world1936/scenario.json (v5); owner1936 is the 1936 owner
// of every listed region. The scenario regions are coarse, so a group is the
// nearest set of whole regions. No group holds a Korean or Taiwanese region
// (spec §24-3).
import type { RegionGroupDef } from "../types";

export const REGION_GROUPS_P6: RegionGroupDef[] = [
  // ---- China (K1) ----
  // regions: Jiangsu, Shanghai, Anhui (the v2 map has no Zhejiang region:
  // Hangzhou, Ningbo and Wenzhou lie inside 837 "Shanghai")
  { id: "jiangsu_zhejiang", regions: [783, 837, 789], owner1936: "CHN" },
  // regions: Shanghai, Jiangsu
  { id: "yangtze_estuary", regions: [837, 783], owner1936: "CHN" },
  // regions: Hebei, Beijing, Hebei 2, Shandong, Jiangsu, Shanghai, Fujian, Guangdong
  {
    id: "china_east_coast",
    regions: [589, 630, 648, 710, 783, 837, 868, 897],
    owner1936: "CHN",
  },
  // regions: Sichuan, Chongqing
  { id: "sichuan", regions: [795, 825], owner1936: "CHN" },
  // regions: Guangdong, Hunan, Hubei
  { id: "canton_hankou_line", regions: [897, 846, 808], owner1936: "CHN" },
  // regions: Yunnan
  { id: "yunnan", regions: [855], owner1936: "YUN" },
  // regions: Guangxi
  { id: "guangxi", regions: [893], owner1936: "GXC" },
  // regions: Shanxi, Suiyuan
  { id: "shanxi_suiyuan", regions: [638, 562], owner1936: "SXI" },
  // regions: Alxa, Ningxia, Qinghai
  { id: "ma_northwest", regions: [574, 683, 685], owner1936: "XBM" },
  // regions: Xinjiang (N), Xinjiang (SW), Xinjiang (C)
  { id: "xinjiang", regions: [399, 551, 552], owner1936: "SIK" },

  // ---- Spain, Poland, Turkey (K2) ----
  // regions: Madrid
  { id: "madrid", regions: [617], owner1936: "ESR" },
  // regions: Barcelona, Lérida
  { id: "catalonia", regions: [581, 568], owner1936: "ESR" },
  // regions: Spanish Morocco
  { id: "spanish_morocco", regions: [764], owner1936: "ESN" },
  // regions: Gibraltar (P3's malta_gibraltar would take Malta along)
  { id: "gibraltar", regions: [759], owner1936: "GBR" },
  // regions: Grand Casablanca (P5's french_north_africa is Algeria and Tunisia too)
  { id: "french_morocco", regions: [787], owner1936: "FRA" },
  // regions: La Coruña (Ferrol, Vigo, Santiago; its tungsten)
  { id: "spanish_galicia", regions: [544], owner1936: "ESN" },
  // regions: Świętokrzyskie, Subcarpathian, Lublin (the Central Industrial District)
  { id: "sandomierz", regions: [347, 360, 328], owner1936: "POL" },
  // regions: Silesian
  { id: "polish_silesia", regions: [355], owner1936: "POL" },
  // regions: Pomeranian
  { id: "gdynia", regions: [272], owner1936: "POL" },
  // regions: Istanbul, Balikesir (the Bosporus and both Dardanelles shores)
  { id: "turkish_straits", regions: [590, 637], owner1936: "TUR" },
  // regions: Istanbul (Edirne lies inside it)
  { id: "east_thrace", regions: [590], owner1936: "TUR" },
  // regions: Sivas, Erzincan, Erzurum, Kars, Malatya, Diyarbakir (the eastern railway)
  {
    id: "eastern_anatolia",
    regions: [644, 624, 632, 608, 688, 698],
    owner1936: "TUR",
  },
  // regions: Sakarya (Karabük and Zonguldak)
  { id: "karabuk", regions: [600], owner1936: "TUR" },
  // regions: Malatya (the Elazığ–Guleman chromium mines)
  { id: "malatya", regions: [688], owner1936: "TUR" },

  // ---- the Balkans and the North (K3) ----
  // regions: Prahova
  { id: "ploiesti", regions: [507], owner1936: "ROU" },
  // regions: Banja Luka, Sarajevo, West Bosnia
  { id: "bosnia", regions: [498, 525, 529], owner1936: "YUG" },
  // regions: Anatoliki Makedonia kai Thraki, Kentriki Makedonia
  { id: "greek_macedonia", regions: [606, 614], owner1936: "GRC" },
  // regions: Hovedstaden (Zealand on this map)
  { id: "zealand", regions: [249], owner1936: "DNK" },
  // regions: Norrbotten (Kiruna and Gällivare)
  { id: "norrbotten", regions: [97], owner1936: "SWE" },

  // ---- Latin America and the Dominions (K4) ----
  // regions: Zulia
  { id: "maracaibo", regions: [1040], owner1936: "VEN" },
  // regions: Northwest Territories (E) (Great Bear Lake, map v5 uranium 3)
  { id: "port_radium", regions: [105], owner1936: "CAN" },
  // regions: Northern Territory (N)
  { id: "darwin", regions: [1194], owner1936: "AUS" },
  // regions: Auckland
  { id: "auckland", regions: [1306], owner1936: "NZL" },
];
