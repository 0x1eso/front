// ww229: Portugal's leaders and advisors (names ww1936.person.<id>).
// Salazar is the P0 leader leader_prt and Rolão Preto the fascist leader
// prt_rolao_preto (persons/leaders.ts); neither is repeated. An advisor with
// an ideology serves only a government of it. History is a loose guide, so
// an office holder of the war years may serve from the start; deaths are
// kept as `until`. The generals are CORE_PRT rows (alsoGeneral).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PRT_PERSONS: readonly PersonDef[] = [
  // ---- non-aligned: the New State and the crown ----
  {
    id: "prt_carmona",
    nameKey: "ww1936.person.prt_carmona",
    country: "PRT",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    alsoGeneral: "prt_g_carmona",
    source:
      "en.wikipedia Óscar Carmona: general, President of the Republic 1926-1951, marshal 1947; died 1951",
  },
  {
    id: "prt_duarte_nuno",
    nameKey: "ww1936.person.prt_duarte_nuno",
    country: "PRT",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Duarte Nuno, Duke of Braganza: claimant to the Portuguese throne from 1920, both lines united behind him in 1932",
  },
  {
    id: "prt_santos_costa",
    nameKey: "ww1936.person.prt_santos_costa",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    ideology: "neutral",
    source:
      "en.wikipedia Fernando dos Santos Costa: Under-Secretary of State for War from 1936, Minister of War 1944-1950; the army reform of 1937",
  },
  {
    id: "prt_ferro",
    nameKey: "ww1936.person.prt_ferro",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "neutral",
    source:
      "en.wikipedia António Ferro: head of the Secretariat of National Propaganda 1933-1949, organiser of the 1940 Portuguese World Exhibition",
  },
  {
    id: "prt_duarte_pacheco",
    nameKey: "ww1936.person.prt_duarte_pacheco",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    ideology: "neutral",
    until: "1943-11-16",
    source:
      "en.wikipedia Duarte Pacheco: Minister of Public Works 1932-1936 and 1938-1943, killed in a car crash in 1943",
  },
  {
    id: "prt_alfredo_da_silva",
    nameKey: "ww1936.person.prt_alfredo_da_silva",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    until: "1942-08-22",
    source:
      "en.wikipedia Alfredo da Silva: founder of the CUF industrial group and its Barreiro works; died 1942",
  },
  {
    id: "prt_lourenco",
    nameKey: "ww1936.person.prt_lourenco",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    ideology: "neutral",
    source:
      "en.wikipedia Agostinho Lourenço: director of the PVDE political police 1933-1945",
  },
  {
    id: "prt_armindo_monteiro",
    nameKey: "ww1936.person.prt_armindo_monteiro",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "neutral",
    source:
      "en.wikipedia Armindo Monteiro: Minister for Foreign Affairs 1935-1936, ambassador in London 1936-1943",
  },
  {
    id: "prt_teotonio_pereira",
    nameKey: "ww1936.person.prt_teotonio_pereira",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "neutral",
    source:
      "en.wikipedia Pedro Teotónio Pereira: Under-Secretary for Corporations 1933-1936, envoy and ambassador to Franco's Spain 1938-1945",
  },
  {
    id: "prt_caetano",
    nameKey: "ww1936.person.prt_caetano",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "neutral",
    source:
      "en.wikipedia Marcelo Caetano: law professor, commissioner of the Portuguese Youth 1940-1944, Minister of the Colonies 1944-1947",
  },
  {
    id: "prt_ortins_bettencourt",
    nameKey: "ww1936.person.prt_ortins_bettencourt",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    ideology: "neutral",
    source:
      "en.wikipedia Manuel Ortins de Bettencourt: naval officer, Minister of the Navy 1936-1944",
  },
  {
    id: "prt_delgado",
    nameKey: "ww1936.person.prt_delgado",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_naval"] },
    alsoGeneral: "prt_g_delgado",
    source:
      "en.wikipedia Humberto Delgado: air force officer, negotiated the Azores air bases with the Allies 1943-1944; opposition presidential candidate 1958",
  },
  {
    id: "prt_egas_moniz",
    nameKey: "ww1936.person.prt_egas_moniz",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Egas Moniz: neurologist at the University of Lisbon, pioneer of cerebral angiography, Nobel Prize 1949",
  },
  // ---- fascist: the national syndicalists ----
  {
    id: "prt_monsaraz",
    nameKey: "ww1936.person.prt_monsaraz",
    country: "PRT",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["party_ideologue"] },
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "en.wikipedia National Syndicalism (Portugal): Alberto de Monsaraz, Integralist and secretary-general of the movement beside Rolão Preto, exiled with him in 1934",
  },
  // ---- democratic: the republican opposition ----
  {
    id: "prt_norton_de_matos",
    nameKey: "ww1936.person.prt_norton_de_matos",
    country: "PRT",
    roles: ["leader"],
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    alsoGeneral: "prt_g_norton_de_matos",
    source:
      "en.wikipedia José Norton de Matos: general, Minister of War 1915-1917, High Commissioner of Angola; opposition presidential candidate 1949",
  },
  {
    id: "prt_bernardino_machado",
    nameKey: "ww1936.person.prt_bernardino_machado",
    country: "PRT",
    roles: ["leader"],
    leaderTraits: ["peace_negotiator"],
    ideology: "democratic",
    until: "1944-04-29",
    source:
      "en.wikipedia Bernardino Machado: President of the Republic 1915-1917 and 1925-1926, in exile against the dictatorship; died 1944",
  },
  {
    id: "prt_antonio_sergio",
    nameKey: "ww1936.person.prt_antonio_sergio",
    country: "PRT",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "democratic",
    source:
      "en.wikipedia António Sérgio: essayist of the Seara Nova group, Minister of Education 1923-1924, democratic opponent of the regime",
  },
  // ---- communist: the clandestine party ----
  {
    id: "prt_bento_goncalves",
    nameKey: "ww1936.person.prt_bento_goncalves",
    country: "PRT",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    until: "1942-09-11",
    source:
      "en.wikipedia Bento Gonçalves: general secretary of the Portuguese Communist Party 1929-1942, died in the Tarrafal camp",
  },
  {
    id: "prt_cunhal",
    nameKey: "ww1936.person.prt_cunhal",
    country: "PRT",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Álvaro Cunhal: leader of the party's reorganisation of 1940-1941, general secretary 1961-1992",
  },
];
