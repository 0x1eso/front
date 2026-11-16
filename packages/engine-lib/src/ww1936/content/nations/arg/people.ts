// ww229: Argentina's people: leaders for every ideology (with the row's
// Justo and Alvear) and the advisors. Dates are kept only where they are
// certain (a death); none is gated otherwise. Data only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ARG_PERSONS: PersonDef[] = [
  // ---- neutral: the Concordancia's presidents ----
  {
    id: "arg_ortiz",
    nameKey: "ww1936.person.arg_ortiz",
    country: "ARG",
    roles: ["leader"],
    ideology: "neutral",
    until: "1942-07-15",
    source:
      "en.wikipedia Roberto Marcelino Ortiz: Concordancia (Antipersonalist Radical) President 1938-1942, tried to end electoral fraud; died 1942-07-15",
  },
  {
    id: "arg_castillo",
    nameKey: "ww1936.person.arg_castillo",
    country: "ARG",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "en.wikipedia Ramón Castillo: National Democrat, Vice President from 1938, acting and then President 1940-1943, overthrown by the army in 1943",
  },
  // ---- democratic ----
  {
    id: "arg_sabattini",
    nameKey: "ww1936.person.arg_sabattini",
    country: "ARG",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Amadeo Sabattini: Radical Civic Union, Governor of Córdoba 1936-1940, leader of the party's intransigent wing",
  },
  {
    id: "arg_palacios",
    nameKey: "ww1936.person.arg_palacios",
    country: "ARG",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Alfredo Palacios: Socialist Party, senator for the capital 1932-1943, the first socialist deputy in the Americas",
  },
  // ---- fascist (the nationalists and the officers' lodge) ----
  {
    id: "arg_fresco",
    nameKey: "ww1936.person.arg_fresco",
    country: "ARG",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Manuel Fresco: Governor of Buenos Aires Province 1936-1940, open admirer of Mussolini's corporate state",
  },
  {
    id: "arg_ramirez",
    nameKey: "ww1936.person.arg_ramirez",
    country: "ARG",
    roles: ["leader"],
    ideology: "fascist",
    alsoGeneral: "arg_ramirez",
    source:
      "en.wikipedia Pedro Pablo Ramírez: general, Minister of War 1942-1943, President of the military government 1943-1944",
  },
  {
    id: "arg_peron",
    nameKey: "ww1936.person.arg_peron",
    country: "ARG",
    roles: ["leader", "advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["labour_organizer"] },
    alsoGeneral: "arg_peron",
    locked: true,
    source:
      "en.wikipedia Juan Perón: colonel of the GOU lodge, Secretary of Labour 1943-1945, Vice President 1944-1945, elected President 1946",
  },
  // ---- communist ----
  {
    id: "arg_codovilla",
    nameKey: "ww1936.person.arg_codovilla",
    country: "ARG",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Victorio Codovilla: leader of the Communist Party of Argentina, Comintern delegate in Spain 1936-1939",
  },
  {
    id: "arg_ghioldi",
    nameKey: "ww1936.person.arg_ghioldi",
    country: "ARG",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Rodolfo Ghioldi: founder and leading member of the Communist Party of Argentina, jailed after the 1935 Brazilian rising",
  },
  // ---- advisors ----
  {
    id: "arg_pinedo",
    nameKey: "ww1936.person.arg_pinedo",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Federico Pinedo: Finance Minister 1933-1935 and 1940-1941, author of the 1940 Plan Pinedo for industry",
  },
  {
    id: "arg_saavedra_lamas",
    nameKey: "ww1936.person.arg_saavedra_lamas",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Carlos Saavedra Lamas: Foreign Minister 1932-1938, mediated the end of the Chaco War, Nobel Peace Prize 1936",
  },
  {
    id: "arg_ruiz_guinazu",
    nameKey: "ww1936.person.arg_ruiz_guinazu",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en.wikipedia Enrique Ruiz Guiñazú: Foreign Minister 1941-1943, defended neutrality at the Rio conference of 1942",
  },
  {
    id: "arg_prebisch",
    nameKey: "ww1936.person.arg_prebisch",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Raúl Prebisch: first general manager of the Central Bank of Argentina 1935-1943",
  },
  {
    id: "arg_mosconi",
    nameKey: "ww1936.person.arg_mosconi",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    until: "1940-06-04",
    source:
      "en.wikipedia Enrique Mosconi: general, first director of YPF 1922-1930, champion of state oil; died 1940-06-04",
  },
  {
    id: "arg_pistarini",
    nameKey: "ww1936.person.arg_pistarini",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "en.wikipedia Juan Pistarini: general, Minister of Public Works from 1944, built Ezeiza airport",
  },
  {
    id: "arg_savio_adv",
    nameKey: "ww1936.person.arg_savio_adv",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    alsoGeneral: "arg_savio",
    source:
      "en.wikipedia Manuel Savio: military engineer, founder of the Dirección General de Fabricaciones Militares (1941) and the steel plan",
  },
  {
    id: "arg_farrell_adv",
    nameKey: "ww1936.person.arg_farrell_adv",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "arg_farrell",
    source:
      "en.wikipedia Edelmiro Julián Farrell: general, commander of the mountain troops, Minister of War 1943, President 1944-1946",
  },
  {
    id: "arg_storni",
    nameKey: "ww1936.person.arg_storni",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    source:
      "en.wikipedia Segundo Storni: admiral and naval writer on Argentina's interests at sea, Foreign Minister 1943",
  },
  {
    id: "arg_de_la_colina",
    nameKey: "ww1936.person.arg_de_la_colina",
    country: "ARG",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "es.wikipedia Bartolomé de la Colina: military aviator, first Secretary of Aeronautics 1945 and head of the new air force",
  },
];
