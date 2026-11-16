// ww229: Sweden's leaders and advisors (names ww1936.person.<id>). Per
// Albin Hansson is the P0 leader leader_swe (persons/leaders.ts) and is not
// repeated. No dates beyond what the game needs: history is a loose guide
// here, so an office holder of 1939-1945 may serve from the start. The
// generals of the same people are CORE_SWE rows (alsoGeneral).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SWE_PERSONS: readonly PersonDef[] = [
  // ---- democratic ----
  {
    id: "swe_pehrsson_bramstorp",
    nameKey: "ww1936.person.swe_pehrsson_bramstorp",
    country: "SWE",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia Axel Pehrsson-Bramstorp: Farmers' League leader 1934-1949, Prime Minister in the summer of 1936, Minister of Agriculture 1936-1945",
  },
  {
    id: "swe_ohlin",
    nameKey: "ww1936.person.swe_ohlin",
    country: "SWE",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Bertil Ohlin: economist, leader of the Liberal People's Party 1944-1967, Minister of Trade 1944-1945",
  },
  {
    id: "swe_wigforss",
    nameKey: "ww1936.person.swe_wigforss",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "democratic",
    source:
      "en.wikipedia Ernst Wigforss: Minister for Finance 1932-1949 (out in the summer of 1936)",
  },
  {
    id: "swe_moller",
    nameKey: "ww1936.person.swe_moller",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "democratic",
    source: "en.wikipedia Gustav Möller: Minister for Social Affairs 1932-1951",
  },
  {
    id: "swe_sandler",
    nameKey: "ww1936.person.swe_sandler",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    source:
      "en.wikipedia Rickard Sandler: Minister for Foreign Affairs 1932-1939, resigned over the Åland question",
  },
  {
    id: "swe_skold",
    nameKey: "ww1936.person.swe_skold",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    ideology: "democratic",
    source: "en.wikipedia Per Edvin Sköld: Minister of Defence 1938-1945",
  },
  // ---- non-aligned (the crown and the right) ----
  {
    id: "swe_gustaf_v",
    nameKey: "ww1936.person.swe_gustaf_v",
    country: "SWE",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Gustaf V of Sweden: King 1907-1950; the Courtyard Speech of 1914",
  },
  {
    id: "swe_bagge",
    nameKey: "ww1936.person.swe_bagge",
    country: "SWE",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    source:
      "en.wikipedia Gösta Bagge: leader of the Rightist Party 1935-1944, Minister of Education 1939-1944",
  },
  {
    id: "swe_gunther",
    nameKey: "ww1936.person.swe_gunther",
    country: "SWE",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["peace_negotiator"],
    ideology: "neutral",
    source:
      "en.wikipedia Christian Günther: non-party Minister for Foreign Affairs 1939-1945",
  },
  // ---- fascist ----
  {
    id: "swe_lindholm",
    nameKey: "ww1936.person.swe_lindholm",
    country: "SWE",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "en.wikipedia Sven Olov Lindholm: leader of the National Socialist Workers' Party / Swedish Socialist Unity 1933-1950",
  },
  {
    id: "swe_engdahl",
    nameKey: "ww1936.person.swe_engdahl",
    country: "SWE",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Per Engdahl: founder and leader of the New Swedish Movement from the 1930s",
  },
  // ---- communist ----
  {
    id: "swe_linderot",
    nameKey: "ww1936.person.swe_linderot",
    country: "SWE",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Sven Linderot: chairman of the Communist Party of Sweden 1929-1951",
  },
  {
    id: "swe_hagberg",
    nameKey: "ww1936.person.swe_hagberg",
    country: "SWE",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Hilding Hagberg: communist member of the Riksdag from 1933, party chairman 1951-1964",
  },
  // ---- industry and research ----
  {
    id: "swe_wenner_gren",
    nameKey: "ww1936.person.swe_wenner_gren",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Axel Wenner-Gren: founder of Electrolux, owner of Bofors in the late 1930s",
  },
  {
    id: "swe_wallenberg",
    nameKey: "ww1936.person.swe_wallenberg",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Marcus Wallenberg (1899-1982): Stockholms Enskilda Bank, Sweden's wartime trade negotiator with Britain",
  },
  {
    id: "swe_siegbahn",
    nameKey: "ww1936.person.swe_siegbahn",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Manne Siegbahn: Nobel Prize in Physics 1924, head of the Nobel Institute for Physics from 1937",
  },
  // ---- the armed forces ----
  {
    id: "swe_olof_thornell",
    nameKey: "ww1936.person.swe_olof_thornell",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "swe_thornell",
    source:
      "en.wikipedia Olof Thörnell: Supreme Commander of the Swedish Armed Forces 1939-1944",
  },
  {
    id: "swe_ca_ehrensvard",
    nameKey: "ww1936.person.swe_ca_ehrensvard",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    alsoGeneral: "swe_ehrensvard",
    source:
      "en.wikipedia Carl August Ehrensvärd: Chief of the Defence Staff 1940-1947",
  },
  {
    id: "swe_tamm",
    nameKey: "ww1936.person.swe_tamm",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "en.wikipedia Fabian Tamm: vice admiral, Commander-in-Chief of the Swedish Navy 1939-1945",
  },
  {
    id: "swe_nordenskiold",
    nameKey: "ww1936.person.swe_nordenskiold",
    country: "SWE",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "en.wikipedia Bengt Nordenskiöld: Chief of the Swedish Air Force 1942-1954",
  },
];
