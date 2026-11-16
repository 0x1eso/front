// ww229: Norway's leaders and advisors (names ww1936.person.<id>). Johan
// Nygaardsvold is the P0 leader leader_nor (persons/leaders.ts) and is not
// repeated. History is a loose guide: an office holder of 1939-1945 may
// serve from the start. The generals of the same people are CORE_NOR rows
// (alsoGeneral). Facts from memory of the en.wikipedia articles named.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NOR_PERSONS: readonly PersonDef[] = [
  // ---- democratic ----
  {
    id: "nor_koht",
    nameKey: "ww1936.person.nor_koht",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    source:
      "en.wikipedia Halvdan Koht: historian, Labour Minister of Foreign Affairs 1935-1941",
  },
  {
    id: "nor_trygve_lie",
    nameKey: "ww1936.person.nor_trygve_lie",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Trygve Lie: Labour Minister of Justice 1935-1939, Minister of Foreign Affairs in exile 1941-1946, first UN Secretary-General",
  },
  {
    id: "nor_hambro",
    nameKey: "ww1936.person.nor_hambro",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia C. J. Hambro: Conservative, President of the Storting 1926-1945, organised the Storting's escape from Oslo in April 1940",
  },
  {
    id: "nor_gerhardsen",
    nameKey: "ww1936.person.nor_gerhardsen",
    country: "NOR",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Einar Gerhardsen: Labour, Oslo city leader, imprisoned at Sachsenhausen, Prime Minister 1945-1951",
  },
  {
    id: "nor_torp",
    nameKey: "ww1936.person.nor_torp",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "democratic",
    source:
      "en.wikipedia Oscar Torp: Labour Party chairman 1923-1945, minister in the Nygaardsvold cabinet, Prime Minister 1951-1955",
  },
  // ---- non-aligned (the crown and the men above parties) ----
  {
    id: "nor_haakon_vii",
    nameKey: "ww1936.person.nor_haakon_vii",
    country: "NOR",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Haakon VII: King of Norway 1905-1957, refused the German demands at Nybergsund in April 1940",
  },
  {
    id: "nor_hundseid",
    nameKey: "ww1936.person.nor_hundseid",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    source:
      "en.wikipedia Jens Hundseid: Farmers' Party, Prime Minister 1932-1933",
  },
  {
    id: "nor_paal_berg",
    nameKey: "ww1936.person.nor_paal_berg",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    source:
      "en.wikipedia Paal Berg: Chief Justice of the Supreme Court 1929-1946, later head of the Home Front leadership",
  },
  // ---- fascist ----
  {
    id: "nor_quisling",
    nameKey: "ww1936.person.nor_quisling",
    country: "NOR",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Vidkun Quisling: Minister of Defence 1931-1933, founder of Nasjonal Samling 1933, Minister-President 1942-1945",
  },
  {
    id: "nor_jonas_lie",
    nameKey: "ww1936.person.nor_jonas_lie",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Jonas Lie (government minister): police officer, Nasjonal Samling Minister of Police 1940-1945",
  },
  {
    id: "nor_hagelin",
    nameKey: "ww1936.person.nor_hagelin",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "fascist",
    source:
      "en.wikipedia Albert Viljam Hagelin: Nasjonal Samling, Minister of the Interior 1940-1944",
  },
  {
    id: "nor_lunde",
    nameKey: "ww1936.person.nor_lunde",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "fascist",
    source:
      "en.wikipedia Gulbrand Lunde: Nasjonal Samling, Minister of Culture and Enlightenment 1940-1942",
  },
  // ---- communist ----
  {
    id: "nor_egede_nissen",
    nameKey: "ww1936.person.nor_egede_nissen",
    country: "NOR",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Adam Egede-Nissen: chairman of the Communist Party of Norway 1934-1946",
  },
  {
    id: "nor_furubotn",
    nameKey: "ww1936.person.nor_furubotn",
    country: "NOR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Peder Furubotn: Communist Party of Norway, led its resistance work from 1941, general secretary 1946-1949",
  },
  // ---- industry and research ----
  {
    id: "nor_aubert",
    nameKey: "ww1936.person.nor_aubert",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Axel Aubert: Director General of Norsk Hydro 1926-1941",
  },
  {
    id: "nor_lorentzen",
    nameKey: "ww1936.person.nor_lorentzen",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Øivind Lorentzen: shipowner, Director of Shipping, head of Nortraship from 1940",
  },
  {
    id: "nor_tronstad",
    nameKey: "ww1936.person.nor_tronstad",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Leif Tronstad: chemist at the Norwegian Institute of Technology, heavy-water expert, planned the Vemork raids",
  },
  // ---- the armed forces ----
  {
    id: "nor_ruge_chief",
    nameKey: "ww1936.person.nor_ruge_chief",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "nor_ruge",
    source:
      "en.wikipedia Otto Ruge: Chief of the General Staff 1933-1938, Commander-in-Chief of the Norwegian Army from April 1940",
  },
  {
    id: "nor_hansteen_staff",
    nameKey: "ww1936.person.nor_hansteen_staff",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    alsoGeneral: "nor_hansteen",
    source:
      "en.wikipedia Wilhelm von Tangen Hansteen: general, Commander-in-Chief of the Norwegian forces in exile from 1942",
  },
  {
    id: "nor_diesen",
    nameKey: "ww1936.person.nor_diesen",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "en.wikipedia Henry Diesen: admiral, Commanding Admiral of the Royal Norwegian Navy 1937-1940",
  },
  {
    id: "nor_riiser_larsen",
    nameKey: "ww1936.person.nor_riiser_larsen",
    country: "NOR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_naval"] },
    source:
      "en.wikipedia Hjalmar Riiser-Larsen: aviator and polar explorer, head of the Norwegian air forces in exile 1941-1946",
  },
];
