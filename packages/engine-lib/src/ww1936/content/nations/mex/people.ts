// ww229: Mexico's people: leaders for every ideology (with the row's
// Cárdenas) and the advisors. Dates are kept only where they are certain
// (a death).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const MEX_PERSONS: PersonDef[] = [
  // ---- neutral: the Revolution's party ----
  {
    id: "mex_avila_camacho",
    nameKey: "ww1936.person.mex_avila_camacho",
    country: "MEX",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    source:
      "en.wikipedia Manuel Ávila Camacho: Secretary of National Defence 1937-1939, President of Mexico 1940-1946",
  },
  {
    id: "mex_mugica",
    nameKey: "ww1936.person.mex_mugica",
    country: "MEX",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["party_ideologue"] },
    leaderTraits: ["reformer"],
    source:
      "en.wikipedia Francisco José Múgica: Secretary of Communications and Public Works 1935-1939, the radical pre-candidate for the 1940 succession",
  },
  {
    id: "mex_calles",
    nameKey: "ww1936.person.mex_calles",
    country: "MEX",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["strongman"],
    until: "1945-10-19",
    source:
      "en.wikipedia Plutarco Elías Calles: the Jefe Máximo of the Maximato, expelled to the United States in 1936, died 1945-10-19",
  },
  // ---- democratic ----
  {
    id: "mex_gomez_morin",
    nameKey: "ww1936.person.mex_gomez_morin",
    country: "MEX",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Manuel Gómez Morín: founder and first president of the National Action Party (PAN) 1939-1949",
  },
  {
    id: "mex_andreu_almazan",
    nameKey: "ww1936.person.mex_andreu_almazan",
    country: "MEX",
    roles: ["leader"],
    ideology: "democratic",
    alsoGeneral: "mex_almazan",
    source:
      "en.wikipedia Juan Andreu Almazán: candidate of the opposition (PRUN) in the disputed 1940 presidential election",
  },
  {
    id: "mex_padilla",
    nameKey: "ww1936.person.mex_padilla",
    country: "MEX",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Ezequiel Padilla Peñaloza: Secretary of Foreign Affairs 1940-1945, host of the Chapultepec conference, opposition candidate 1946",
  },
  // ---- communist ----
  {
    id: "mex_laborde",
    nameKey: "ww1936.person.mex_laborde",
    country: "MEX",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Hernán Laborde: general secretary of the Mexican Communist Party 1929-1940",
  },
  {
    id: "mex_lombardo",
    nameKey: "ww1936.person.mex_lombardo",
    country: "MEX",
    roles: ["leader", "advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["labour_organizer"] },
    source:
      "en.wikipedia Vicente Lombardo Toledano: Marxist founder and secretary-general of the Confederation of Mexican Workers (CTM) 1936-1941",
  },
  {
    id: "mex_encina",
    nameKey: "ww1936.person.mex_encina",
    country: "MEX",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Dionisio Encina: general secretary of the Mexican Communist Party from 1940",
  },
  // ---- fascist ----
  {
    id: "mex_abascal",
    nameKey: "ww1936.person.mex_abascal",
    country: "MEX",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Salvador Abascal: leader (jefe) of the National Synarchist Union 1940-1941",
  },
  {
    id: "mex_rodriguez_carrasco",
    nameKey: "ww1936.person.mex_rodriguez_carrasco",
    country: "MEX",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Nicolás Rodríguez Carrasco: leader of the Gold Shirts (Acción Revolucionaria Mexicanista), expelled in 1936",
  },
  {
    id: "mex_vasconcelos",
    nameKey: "ww1936.person.mex_vasconcelos",
    country: "MEX",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia José Vasconcelos: former education minister and 1929 candidate, editor of the pro-Axis magazine Timón in 1940",
  },
  // ---- advisors ----
  {
    id: "mex_hay",
    nameKey: "ww1936.person.mex_hay",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en.wikipedia Eduardo Hay: Secretary of Foreign Affairs 1935-1940",
  },
  {
    id: "mex_suarez",
    nameKey: "ww1936.person.mex_suarez",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Eduardo Suárez Aránzolo: Secretary of Finance 1935-1946, negotiated the oil and debt settlements",
  },
  {
    id: "mex_cortes_herrera",
    nameKey: "ww1936.person.mex_cortes_herrera",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "es.wikipedia Vicente Cortés Herrera: first director general of Petróleos Mexicanos 1938-1940",
  },
  {
    id: "mex_buenrostro",
    nameKey: "ww1936.person.mex_buenrostro",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "es.wikipedia Efraín Buenrostro Ochoa: Secretary of National Economy, then director general of Pemex 1940-1946",
  },
  {
    id: "mex_batiz",
    nameKey: "ww1936.person.mex_batiz",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Juan de Dios Bátiz Paredes: co-founder of the National Polytechnic Institute (IPN) in 1936",
  },
  {
    id: "mex_joaquin_amaro",
    nameKey: "ww1936.person.mex_joaquin_amaro",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_training"] },
    alsoGeneral: "mex_amaro",
    source:
      "en.wikipedia Joaquín Amaro Domínguez: reformer of the federal army, director of military education in the 1930s",
  },
  {
    id: "mex_salinas_camina",
    nameKey: "ww1936.person.mex_salinas_camina",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    source:
      "en.wikipedia Gustavo Salinas Camiña: pioneer military aviator, head of the Mexican Air Force in the early 1940s",
  },
  {
    id: "mex_cardenas_rodriguez",
    nameKey: "ww1936.person.mex_cardenas_rodriguez",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "en.wikipedia Antonio Cárdenas Rodríguez: commander of the Mexican Expeditionary Air Force (Escuadrón 201) in the Philippines 1945",
  },
  {
    id: "mex_jara",
    nameKey: "ww1936.person.mex_jara",
    country: "MEX",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_dockyard"] },
    source:
      "en.wikipedia Heriberto Jara Corona: first Secretary of the Navy 1940-1946",
  },
];
