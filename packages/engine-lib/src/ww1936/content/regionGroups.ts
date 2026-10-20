// World War 1936 P3 (spec §17.8): named sets of scenario regions for the
// annexation chains, claims and a few focuses. Region ids come from
// resources/maps/world1936/scenario.json (names and positions); owner1936 is
// the 1936 owner of every listed region (RegionGroups.test.ts). The scenario
// regions are coarse, so several groups are the nearest whole region rather
// than the exact historical line. No group covers Korea or Taiwan.
import type { RegionGroupDef } from "./types";

export const REGION_GROUPS: RegionGroupDef[] = [
  // regions: Nordrhein-Westfalen, Rheinland-Pfalz (the left bank and the 50 km strip east of the Rhine)
  { id: "rhineland", regions: [322, 356], owner1936: "DEU" },
  // regions: Ústecký (northern Bohemia: Liberec, Karlovy Vary, Cheb, Trutnov)
  { id: "sudetenland", regions: [354], owner1936: "CSK" },
  // regions: Prague, Jihomoravský, Moravskoslezský, Jihočeský
  { id: "bohemia_moravia", regions: [361, 368, 371, 384], owner1936: "CSK" },
  // regions: Prešov, Bratislavský
  { id: "slovakia", regions: [388, 414], owner1936: "CSK" },
  // regions: Banskobystrický (holds Košice, Lučenec and Rožňava)
  { id: "south_slovakia", regions: [410], owner1936: "CSK" },
  // regions: Subcarpathian Ruthenia
  { id: "carpathian_ruthenia", regions: [405], owner1936: "CSK" },
  // regions: Moravskoslezský (Czech Cieszyn Silesia; also part of bohemia_moravia)
  { id: "zaolzie", regions: [371], owner1936: "CSK" },
  // regions: Klaipėda
  { id: "memel", regions: [242], owner1936: "LTU" },
  // regions: Danzig
  { id: "danzig", regions: [278], owner1936: "DZG" },
  // regions: Pomeranian, Kuyavian-Pomeranian (the Pomorze corridor to the sea)
  { id: "polish_corridor", regions: [272, 297], owner1936: "POL" },
  // regions: Wilno
  { id: "vilnius", regions: [257], owner1936: "POL" },
  // regions: Viipuri
  { id: "karelian_isthmus", regions: [164], owner1936: "FIN" },
  // regions: Ladoga Karelia
  { id: "ladoga_karelia", regions: [151], owner1936: "FIN" },
  // regions: Petsamo (the northern cessions of 1940; Salla itself lies in the much larger Lapland region)
  { id: "salla", regions: [89], owner1936: "FIN" },
  // regions: Ungheni, Chişinău, Southern Bessarabia
  { id: "bessarabia", regions: [422, 437, 479], owner1936: "ROU" },
  // regions: Suceava (holds Chernivtsi, Hertsa and Khotyn)
  { id: "north_bukovina", regions: [418], owner1936: "ROU" },
  // regions: Maramures, Bihor, Mures (Satu Mare, Oradea, Cluj, Târgu Mureș)
  { id: "north_transylvania", regions: [435, 449, 450], owner1936: "ROU" },
  // regions: Tulcea (all of Dobruja is one region: Dobrich, Balchik, Constanța)
  { id: "south_dobruja", regions: [510], owner1936: "ROU" },
  // regions: Hatay (map v3 splits it out of Aleppo)
  { id: "hatay", regions: [1368], owner1936: "FRA" },
  // regions: Nordrhein-Westfalen, Rheinland-Pfalz, Baden-Württemberg
  { id: "french_border_de", regions: [322, 356, 386], owner1936: "DEU" },
  // regions: Leningrad, Pskov, Vitebsk, City of Minsk, Gomel, Zhytomyr, Khmel'nyts'kyy, Vinnytsya, Odessa
  {
    id: "stalin_line",
    regions: [163, 200, 247, 277, 312, 341, 364, 385, 429],
    owner1936: "SUN",
  },
  // regions: Sverdlovsk, Perm', Udmurt, Omsk, Novosibirsk, Kemerovo, Tatarstan, Bashkortostan, Chelyabinsk, Kuybyshev
  {
    id: "ural_industry",
    regions: [158, 160, 204, 205, 224, 237, 238, 241, 246, 270],
    owner1936: "SUN",
  },
  // regions: Leningrad, Moskva, City of Minsk, Kiev City, Kharkiv, Rostov, Voroshilovgrad, Stalino, Dnipropetrovs'k, Zaporizhzhya
  {
    id: "soviet_west_industry",
    regions: [163, 253, 277, 344, 369, 375, 380, 395, 397, 431],
    owner1936: "SUN",
  },
  // regions: Chita, Buryat, Amur, Khabarovsk (S), Sakhalin, Yevrey, Primor'ye
  {
    id: "far_east_soviet",
    regions: [206, 225, 227, 251, 283, 393, 424],
    owner1936: "SUN",
  },
  // regions: Addis Ababa
  { id: "addis_ababa", regions: [1056], owner1936: "ETH" },
  // regions: Singapore (map v3 splits it out of Malaya)
  { id: "singapore", regions: [1366], owner1936: "GBR" },
  // regions: Malta (map v3), Gibraltar
  { id: "malta_gibraltar", regions: [1343, 759], owner1936: "GBR" },
];
