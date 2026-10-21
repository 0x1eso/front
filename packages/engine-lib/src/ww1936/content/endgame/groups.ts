// World War 1936 P5 (spec §19.6): the region groups of the endgame chains,
// the peace conference table and the claims (content lane K5). Region ids come
// from resources/maps/world1936/scenario.json (v2: names and positions);
// owner1936 is the 1936 owner of every listed region. The scenario regions are
// coarse, so a group is the nearest set of whole regions. Groups used together
// in one chain or one peace-table row do not overlap.
//
// corsica, dodecanese, pacific_mandates and oahu use the restored islands of
// map v3 (region ids from 1343). laos_cambodia_west, slovenia_north and
// backa_baranja cannot be cut out of the coarse regions and have no group;
// porkkala uses a stand-in.
//
// korea_north, korea_south and taiwan appear only in the peace table and the
// claims (spec §18.1-2, plan decision 32).
import type { RegionGroupDef } from "../types";

export const REGION_GROUPS_P5: RegionGroupDef[] = [
  // ---- Poland (the 1939-09-28 treaty line, the German annexation decree of 1939-10-08) ----
  // regions: Pomeranian, Kuyavian-Pomeranian, Greater Poland, Łódź, Silesian, Masovian, Lublin, Świętokrzyskie, Subcarpathian, Lesser Poland (west of the 1939-09-28 line: the annexed lands and the General Government (Danzig is its own DZG region))
  {
    id: "poland_german_zone",
    regions: [272, 297, 308, 327, 355, 309, 328, 347, 360, 366],
    owner1936: "POL",
  },
  // regions: Pomeranian, Kuyavian-Pomeranian, Greater Poland, Łódź, Silesian (Danzig-West Prussia, Wartheland and East Upper Silesia; Zichenau lies in the Masovian region with Warsaw and stays in the General Government)
  {
    id: "poland_german_annexed",
    regions: [272, 297, 308, 327, 355],
    owner1936: "POL",
  },
  // regions: Masovian, Lublin, Świętokrzyskie, Subcarpathian, Lesser Poland
  {
    id: "poland_general_government",
    regions: [309, 328, 347, 360, 366],
    owner1936: "POL",
  },
  // regions: Brasław, Nowogródek, Grodno, Podlachian, Polesie, Volhynia, Równe, Lwów, Tarnopol, Stanisławów (east of the line; Wilno is the P3 group vilnius (passed to Lithuania in 1939), so it is left out)
  {
    id: "poland_soviet_zone",
    regions: [254, 268, 269, 284, 311, 333, 334, 362, 372, 391],
    owner1936: "POL",
  },
  // regions: Masovian
  { id: "warsaw", regions: [309], owner1936: "POL" },
  // ---- Germany 1945 (the zone protocol of 1944-09-12 / 1945, the Potsdam lines) ----
  // regions: Mecklenburg-Vorpommern, Berlin, Sachsen-Anhalt, Thüringen, Sachsen (Berlin itself was split into four sectors; the region lies inside the Soviet zone)
  {
    id: "de_soviet_zone",
    regions: [275, 306, 315, 339, 340],
    owner1936: "DEU",
  },
  // regions: Hessen, Bayern, Baden-Württemberg (southern Baden and Württemberg went to the French zone; the region holds Stuttgart (US))
  { id: "de_us_zone", regions: [338, 363, 386], owner1936: "DEU" },
  // regions: Hamburg, Niedersachsen, Nordrhein-Westfalen
  { id: "de_uk_zone", regions: [267, 294, 322], owner1936: "DEU" },
  // regions: Rheinland-Pfalz (the Palatinate, Rhine Hesse and the left bank)
  { id: "de_fr_zone", regions: [356], owner1936: "DEU" },
  // regions: Pomerania, Neumark, Lower Silesia, Upper Silesia (Farther Pomerania, the Neumark and Silesia)
  {
    id: "german_east_of_oder",
    regions: [271, 314, 335, 352],
    owner1936: "DEU",
  },
  // regions: East Prussia (Königsberg)
  { id: "east_prussia_north", regions: [263], owner1936: "DEU" },
  // regions: Allenstein (Masuria and Ermland)
  { id: "east_prussia_south", regions: [280], owner1936: "DEU" },
  // ---- France (the 1940-06-22 demarcation line; the regions follow their main city) ----
  // regions: Moselle, Doubs (Moselle; the Doubs region holds Strasbourg, Colmar and Mulhouse)
  { id: "alsace_lorraine", regions: [390, 403], owner1936: "FRA" },
  // regions: Pas-de-Calais, Meuse, Seine-Maritime, Marne, Orne, Eure, Paris, Côtes-d'Armor, Finistère, Haute-Marne, Vosges, Sarthe, Côte-d'Or, Loiret, Maine-et-Loire, Saône-et-Loire, Indre, Gironde, Landes (the north and the Atlantic coast to the Spanish border, without Alsace-Lorraine)
  {
    id: "france_occupied_zone",
    regions: [
      353, 376, 378, 379, 387, 389, 396, 412, 415, 417, 419, 421, 423, 425, 439,
      446, 457, 505, 527,
    ],
    owner1936: "FRA",
  },
  // regions: Rhône, Ain, Charente, Dordogne, Puy-de-Dôme, Savoie, Ardèche, Alpes-de-Haute-Provence, Aveyron, Bouches-du-Rhône, Gers, Pyrénées (the unoccupied south, without the Italian zone)
  {
    id: "france_free_zone",
    regions: [469, 477, 481, 483, 484, 497, 509, 511, 524, 528, 536, 549],
    owner1936: "FRA",
  },
  // regions: Alpes-Maritimes (Menton and Nice)
  { id: "france_italian_zone", regions: [531], owner1936: "FRA" },
  // regions: (none) (EMPTY: Corsica is not on the v2 map; it needs the restored island (map v3, id >= 1343))
  { id: "corsica", regions: [1367], owner1936: "FRA" },
  // regions: Paris
  { id: "paris", regions: [396], owner1936: "FRA" },
  // regions: Pas-de-Calais, Meuse, Marne (Nord, the Ardennes and the Meuse)
  { id: "belgian_border_fr", regions: [353, 376, 379], owner1936: "FRA" },
  // regions: Savoie, Alpes-de-Haute-Provence, Alpes-Maritimes
  { id: "italy_alpine_border_fr", regions: [497, 511, 531], owner1936: "FRA" },
  // regions: Pas-de-Calais, Moselle (the northern coalfield and Lorraine iron)
  { id: "nord_lorraine", regions: [353, 390], owner1936: "FRA" },
  // regions: Dordogne, Gironde, Landes, Gers
  { id: "southwest_france", regions: [483, 505, 527, 536], owner1936: "FRA" },
  // regions: El Bayadh (Oran and Mers-el-Kébir)
  { id: "oran", regions: [747], owner1936: "FRA" },
  // regions: Tunis, Alger, El Bayadh, Grand Casablanca, Béchar, Adrar, Tamanghasset (Tunisia, Algeria and the Moroccan protectorate)
  {
    id: "french_north_africa",
    regions: [725, 733, 747, 787, 822, 834, 857],
    owner1936: "FRA",
  },
  // regions: Tiris Zemmour, Timbuktu, Dakar, Agadez, Hodh ech Chargui, Gao, Niamey, Littoral, Koulikoro, Lagunes, Dubréka (with Togo)
  {
    id: "french_west_africa",
    regions: [881, 904, 908, 916, 922, 936, 969, 1002, 1006, 1010, 1030],
    owner1936: "FRA",
  },
  // regions: Borkou, Ennedi, Fort-Lamy, Haute-Kotto, Bangui, Estuaire, Brazzaville (with Cameroon (Douala and Yaoundé lie in the Estuaire region))
  {
    id: "french_equatorial_africa",
    regions: [917, 940, 989, 1047, 1074, 1091, 1111],
    owner1936: "FRA",
  },
  // regions: Aleppo (the whole Levant mandate is one region)
  { id: "levant", regions: [729], owner1936: "FRA" },
  // regions: Ha Noi, Saigon
  { id: "indochina", regions: [918, 988], owner1936: "FRA" },
  // regions: Analamanga
  { id: "madagascar", regions: [1196], owner1936: "FRA" },
  // ---- Italy and the Balkans ----
  // regions: Bozen, Brescia, Udine, Trento, Milano, Turin, Bologna, Cuneo, Modena, Tuscany (north of Rome: the area the Social Republic held in 1943-1944)
  {
    id: "italy_north",
    regions: [462, 472, 473, 478, 482, 494, 502, 515, 518, 532],
    owner1936: "ITA",
  },
  // regions: Bozen, Brescia, Turin, Cuneo (the French, Swiss and German frontier)
  {
    id: "italy_alpine_border",
    regions: [462, 472, 494, 515],
    owner1936: "ITA",
  },
  // regions: Bozen, Trento (South Tyrol and Trentino)
  { id: "brenner", regions: [462, 478], owner1936: "ITA" },
  // regions: Milano, Turin, Bologna, Modena
  { id: "po_valley", regions: [482, 494, 502, 518], owner1936: "ITA" },
  // regions: Palermo
  { id: "sicily", regions: [697], owner1936: "ITA" },
  // regions: Udine (the Udine region holds Trieste, Pula and the Julian March)
  { id: "istria", regions: [473], owner1936: "ITA" },
  // regions: (none) (EMPTY: the islands are not on the v2 map; they need the restored islands (map v3, id >= 1343))
  { id: "dodecanese", regions: [1362, 1363], owner1936: "ITA" },
  // regions: Tripolitania, Ajdabiya, Al Jufrah, Murzuq, Al Kufrah
  { id: "libya", regions: [809, 812, 849, 884, 885], owner1936: "ITA" },
  // regions: Tripolitania
  { id: "libya_tripoli", regions: [809], owner1936: "ITA" },
  // regions: Cairo, Al Bahr al Ahmar, Al Wadi at Jadid (the protectorate was folded into the United Kingdom (P0))
  { id: "egypt", regions: [767, 854, 875], owner1936: "GBR" },
  // regions: Ljubljana (Ljubljana with Sušak)
  { id: "ljubljana", regions: [474], owner1936: "YUG" },
  // regions: Zadarska (the Zadar hinterland with Šibenik; Split lies in the West Bosnia region)
  { id: "dalmatia", regions: [516], owner1936: "YUG" },
  // regions: Sisacko-Moslavacka, Grad Zagreb, Banja Luka, Sremski, Sarajevo, West Bosnia (the 1941 state with Bosnia, Herzegovina and Srem)
  { id: "croatia", regions: [467, 471, 498, 506, 525, 529], owner1936: "YUG" },
  // regions: Podgorica (with the Bay of Kotor)
  { id: "montenegro", regions: [557], owner1936: "YUG" },
  // regions: Skopje, Prilep
  { id: "vardar_macedonia", regions: [569, 583], owner1936: "YUG" },
  // regions: Thessalia, Ipeiros, Stereá Elláda (Thessaly, Epirus and Central Greece)
  { id: "greece_italian", regions: [631, 650, 680], owner1936: "GRC" },
  // regions: Kentriki Makedonia, Attiki (Thessaloniki, Athens and Piraeus)
  { id: "greece_german", regions: [614, 707], owner1936: "GRC" },
  // regions: Anatoliki Makedonia kai Thraki
  { id: "greek_thrace", regions: [606], owner1936: "GRC" },
  // regions: Prešov (Martin, Ružomberok and the Tatra side; Banská Bystrica lies in the region Hungary takes in the P3 Vienna Award chain)
  { id: "central_slovakia", regions: [388], owner1936: "CSK" },
  // regions: Nordjylland, Midtjylland, Hovedstaden, Syddanmark (without Greenland)
  { id: "denmark", regions: [212, 234, 249, 252], owner1936: "DNK" },
  // ---- Northern and eastern Europe, Iran ----
  // regions: Petsamo (same region as the P3 group salla; never used together with it)
  { id: "petsamo", regions: [89], owner1936: "FIN" },
  // regions: Finland Proper (STAND-IN: Porkkala lies in the Uusimaa region with Helsinki; the neighbouring Finland Proper region stands in so the lease does not take the capital)
  { id: "porkkala", regions: [169], owner1936: "FIN" },
  // regions: Norðurland eystra, Vestfirðir, Norðurland vestra, Austurland, Reykjavík, Suðurland
  { id: "iceland", regions: [115, 116, 120, 122, 125, 132], owner1936: "ISL" },
  // regions: West Azarbaijan, Ardebil, East Azarbaijan, Gilan, North Khorasan, Golestan, Semnan, Zanjan, Mazandaran, Qazvin (the 1941 Soviet limit Ushnu-Zanjan-Qazvin-Babol-Semnan-Shahrud; Mashhad was left out)
  {
    id: "iran_north",
    regions: [664, 665, 690, 705, 709, 713, 727, 731, 742, 744],
    owner1936: "IRN",
  },
  // regions: Hamadan, Markazi, Kermanshah, Lorestan, Ilam, Khuzestan, Bushehr (south-west of Khanaqin-Kermanshah-Khorramabad-Bandar Dilam, with Hamadan and Sultanabad)
  {
    id: "iran_south",
    regions: [769, 770, 777, 793, 797, 810, 842],
    owner1936: "IRN",
  },
  // ---- Asia and the Pacific ----
  // regions: Chahar (Chahar; Suiyuan is a Shanxi clique region and cannot share the group)
  { id: "inner_mongolia", regions: [493], owner1936: "CHN" },
  // regions: Hebei, Beijing, Hebei 2, Shandong, Jiangsu, Anhui, Shanghai (Hebei, Beijing, Shandong, Jiangsu, Anhui and Shanghai)
  {
    id: "east_china_occupied",
    regions: [589, 630, 648, 710, 783, 789, 837],
    owner1936: "CHN",
  },
  // regions: Heilongjiang, Hsingan, Jilin
  { id: "manchukuo_soviet_border", regions: [303, 313, 486], owner1936: "MCK" },
  // regions: Heilongjiang, Hsingan, Jilin, Liaoning, Jehol (Manchukuo with Jehol)
  { id: "manchuria", regions: [303, 313, 486, 553, 578], owner1936: "MCK" },
  // regions: Kwantung
  { id: "kwantung", regions: [666], owner1936: "JPN" },
  // regions: Taiwan
  { id: "taiwan", regions: [901], owner1936: "JPN" },
  // regions: Hamgyŏng-bukto, Ryanggang, Chagang-do, Hamgyŏng-namdo, P'yŏngan-namdo, P'yŏngyang (north of 38 N)
  {
    id: "korea_north",
    regions: [563, 598, 604, 622, 639, 686],
    owner1936: "JPN",
  },
  // regions: Keijō (Seoul), Gangwon, North Chungcheong, North Gyeongsang, South Jeolla (south of 38 N; the Keijo region's centre is at 38.2 N because it reaches into Hwanghae, but Seoul (37.6 N) lay south of the 1945 line)
  { id: "korea_south", regions: [679, 701, 732, 734, 761], owner1936: "JPN" },
  // regions: Hokkaidō, Akita, Iwate, Yamagata, Nagano, Fukushima, Fukui, Tochigi, Gifu, Hiroshima, Tokyo, Ōsaka, Hyōgo, Kōchi, Kumamoto, Miyazaki, Iwo Jima, Okinawa, Nagasaki (map v5)
  {
    id: "japan_home",
    regions: [
      508, 612, 649, 691, 703, 716, 723, 735, 754, 757, 758, 766, 772, 791, 800,
      801, 1354, 1355, 1369,
    ],
    owner1936: "JPN",
  },
  // regions: Karafuto
  { id: "south_sakhalin", regions: [383], owner1936: "JPN" },
  // regions: Northern Kurils, Southern Kurils
  { id: "kurils", regions: [357, 492], owner1936: "JPN" },
  // regions: (none) (EMPTY: the mandated islands are not on the v2 map; they need the restored islands (map v3, id >= 1343))
  { id: "pacific_mandates", regions: [1350, 1351, 1352], owner1936: "JPN" },
  // regions: Philippines
  { id: "philippines", regions: [945], owner1936: "USA" },
  // regions: Kachin, Sagaing, Shan, Chin, Mandalay, Magway, Rakhine, Kayin, Bago, Yangon, Tanintharyi
  {
    id: "burma",
    regions: [864, 880, 912, 913, 915, 924, 939, 956, 960, 975, 1011],
    owner1936: "RAJ",
  },
  // regions: Malaya (with Singapore (same region as the P3 group singapore))
  { id: "malaya", regions: [1087], owner1936: "GBR" },
  // regions: Batavia, Papua Barat, Kalimantan Timur, Papua, Dutch Timor
  {
    id: "dutch_east_indies",
    regions: [1094, 1106, 1108, 1137, 1179],
    owner1936: "NLD",
  },
  // regions: Oahu (restored island, map v3)
  { id: "oahu", regions: [1344], owner1936: "USA" },
  // ---- The Americas ----
  // regions: Kentucky, Tennessee, Alabama (the Tennessee Valley Authority area)
  { id: "tennessee", regions: [689, 745, 785], owner1936: "USA" },
  // regions: Michigan, Wisconsin, Michigan 2, Illinois, Ohio, Indiana
  {
    id: "great_lakes",
    regions: [452, 463, 500, 579, 599, 605],
    owner1936: "USA",
  },
  // regions: Panama (the Canal Zone lies in the Panama region)
  { id: "panama_canal", regions: [1067], owner1936: "PAN" },
  // regions: Bahamas, Jamaica, British Guiana (the 1940 destroyers-for-bases sites on this map)
  { id: "caribbean_bases", regions: [887, 970, 972], owner1936: "GBR" },
  // regions: New York, Virginia (New York and Hampton Roads)
  { id: "us_east_coast", regions: [520, 673], owner1936: "USA" },
  // regions: Washington, California (Puget Sound and California)
  { id: "us_west_coast", regions: [406, 592], owner1936: "USA" },
];
