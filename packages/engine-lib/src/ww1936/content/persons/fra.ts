// World War 1936 P5 — French advisors and the leaders French focuses
// install (spec §19.5). Léon Blum and Édouard Daladier are P3 leader persons
// (persons/leaders.ts) and are not repeated here. Dates: `from` inclusive,
// `until` exclusive (the first day the person no longer holds the office).
// Third Republic offices end when the armistice government takes over in
// June 1940: no one here serves Vichy, and Vichy's heads of state and of
// government are titles only (spec §19.5, collaboration rule).
//
// Exclusion check (spec §8.4): nobody below was convicted at Nuremberg or
// Tokyo, at a later war-crimes trial or by a French court for
// collaboration. Camille Chautemps (spec "conciliator") was sentenced in
// absentia in 1947 for collaboration (en.wikipedia "Camille Chautemps";
// Stanford Hoover/OAC finding aid of his papers), so his office is the title
// card title_fra_vice_premier. Maxime Weygand was cleared (non-lieu, 1948);
// Georges Bonnet's post-war proceedings were dropped; the Riom trial of
// Gamelin and Daladier was suspended in 1942 without a verdict.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_FRA: PersonDef[] = [
  // ---- politics ----
  // source: Minister of Finance 1938-11-01, President of the Council
  // 1940-03-21 to 1940-06-16 (en.wikipedia "Paul Reynaud"; herodote.net
  // biography; vikidia "Paul Reynaud"). Interned by Vichy, never tried.
  // Leads the national union branch (fra_national_union).
  {
    id: "fra_reynaud",
    nameKey: "ww1936.person.fra_reynaud",
    country: "FRA",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "Minister of Finance from 1938-11, President of the Council 1940-03-21..1940-06-16: en.wikipedia Paul Reynaud; herodote.net biography",
  },
  // source: Minister of Colonies 1938-04-10 to 1940-05-18, Minister of the
  // Interior 1940-05-18 to 1940-06-16; killed on 1944-07-07 (en.wikipedia
  // "Georges Mandel"; Britannica "Georges Mandel"). Never tried.
  {
    id: "fra_mandel",
    nameKey: "ww1936.person.fra_mandel",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    ideology: "democratic",
    until: "1944-07-07",
    source:
      "Minister of Colonies 1938-04-10, Interior 1940-05-18..06-16, died 1944-07-07: en.wikipedia Georges Mandel; Britannica",
  },
  // source: Foreign Minister 1936-06-04 to 1938-03-13, the minister of
  // non-intervention in Spain (en.wikipedia "Yvon Delbos"; Presses de
  // l'Université de Montréal, "Principaux acteurs du drame").
  {
    id: "fra_delbos",
    nameKey: "ww1936.person.fra_delbos",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    from: "1936-06-04",
    until: "1938-03-13",
    source:
      "Foreign Minister 1936-06-04..1938-03-13: en.wikipedia Yvon Delbos; books.openedition.org/pum/17713",
  },
  // source: Foreign Minister 1938-04-10 to 1939-09-13 (en.wikipedia "Georges
  // Bonnet"; Britannica "Georges Bonnet": April 1938 to September 1939;
  // post-war proceedings dropped).
  {
    id: "fra_bonnet",
    nameKey: "ww1936.person.fra_bonnet",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "democratic",
    from: "1938-04-10",
    until: "1939-09-13",
    source:
      "Foreign Minister 1938-04-10..1939-09-13: en.wikipedia Georges Bonnet; Britannica (proceedings dropped after the war)",
  },
  // source: the office Camille Chautemps held under Daladier and Reynaud,
  // shown as a title (see the file header).
  {
    id: "title_fra_vice_premier",
    nameKey: "ww1936.title.fra_vice_premier",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "title card (spec §19.5): Chautemps convicted in absentia 1947 for collaboration (en.wikipedia Camille Chautemps; OAC finding aid of the Chautemps papers)",
  },
  // ---- army chief ----
  // source: Chief of the General Staff of National Defence, dismissed on
  // 1940-05-19 (en.wikipedia "Maurice Gamelin"; Larousse "Maxime Weygand":
  // succeeds Gamelin in May 1940). Riom trial suspended without a verdict.
  {
    id: "fra_gamelin",
    nameKey: "ww1936.person.fra_gamelin",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    until: "1940-05-19",
    alsoGeneral: "gamelin",
    source:
      "Chief of the General Staff of National Defence, dismissed 1940-05-19: en.wikipedia Maurice Gamelin; Larousse Maxime Weygand",
  },
  // source: Commander-in-Chief from 1940-05-19; Minister of National
  // Defence in the armistice government from 1940-06-17, which this game
  // does not use (en.wikipedia "Maxime Weygand"; theatrum-belli.com in
  // memoriam; non-lieu 1948).
  {
    id: "fra_weygand",
    nameKey: "ww1936.person.fra_weygand",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    from: "1940-05-19",
    until: "1940-06-17",
    source:
      "Commander-in-Chief from 1940-05-19, armistice government from 1940-06-17 (not used): en.wikipedia Maxime Weygand; theatrum-belli.com",
  },
  // ---- industry and research ----
  // source: Minister of Armament 1939-09-20 to 1940-06-16 (en.wikipedia
  // "Raoul Dautry"; techno-science.net; en.wikipedia "Minister of Armaments
  // (France)" gives 1939-09-13 for the ministry: the later day is used).
  {
    id: "fra_dautry",
    nameKey: "ww1936.person.fra_dautry",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    from: "1939-09-20",
    until: "1940-06-16",
    source:
      "Minister of Armament 1939-09-20..1940-06-16: en.wikipedia Raoul Dautry; techno-science.net Raoul Dautry",
  },
  // source: Collège de France physicist, 1935 Nobel laureate, stayed in
  // France in 1940 (en.wikipedia "Frédéric Joliot-Curie"; Atomic Heritage
  // Foundation "French Nuclear Program"). No dates: fra_heavy_water
  // proposes him.
  {
    id: "fra_joliot_curie",
    nameKey: "ww1936.person.fra_joliot_curie",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Collège de France, Nobel 1935, stayed in France 1940: en.wikipedia Frédéric Joliot-Curie; ahf.nuclearmuseum.org French nuclear program",
  },
  // source: Under-Secretary for Scientific Research under the Popular Front;
  // left Paris at the occupation in June 1940, reached New York in 1941,
  // died 1942-04-17 (Encyclopaedia Universalis "Jean Perrin"; Académie des
  // sciences notice; Wilson College exhibit).
  {
    id: "fra_perrin",
    nameKey: "ww1936.person.fra_perrin",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    until: "1940-06-14",
    source:
      "Under-Secretary for Scientific Research (Popular Front), left Paris June 1940: Universalis Jean Perrin; Académie des sciences notice",
  },
  // ---- navy and air chiefs ----
  // source: Chief of Staff of the Navy from 1937-01-01; Minister of Marine
  // in the armistice government from 1940-06-16, which this game does not
  // use (en.wikipedia "François Darlan"; Larousse; encyclopedia.com).
  {
    id: "fra_darlan",
    nameKey: "ww1936.person.fra_darlan",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    from: "1937-01-01",
    until: "1940-06-16",
    source:
      "Chief of Staff of the Navy 1937-01-01..1940-06-16 (Vichy offices not used, spec §19.5): en.wikipedia François Darlan; Larousse",
  },
  // source: Chief of Staff of the Air Force from 1938-02-22 (one list says
  // 1938-02-18: the later day is used) until the armistice took effect
  // (en.wikipedia "Joseph Vuillemin"; techno-science.net "Chef d'état-major
  // de l'armée de l'air").
  {
    id: "fra_vuillemin",
    nameKey: "ww1936.person.fra_vuillemin",
    country: "FRA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    from: "1938-02-22",
    until: "1940-06-25",
    source:
      "Chief of Staff of the Air Force 1938-02-22..armistice 1940-06-25: en.wikipedia Joseph Vuillemin; techno-science.net list of chiefs",
  },
  // ---- leaders ----
  // source: Under-Secretary of State for War in June 1940, the appeal of
  // 1940-06-18 from London, leader of Free France and of the Provisional
  // Government in 1944 (en.wikipedia "Charles de Gaulle"; Britannica
  // "Charles de Gaulle"). fra_june_appeal makes him the exile's leader; he
  // then leaves the P2 general roster (P3 alsoGeneral rule).
  {
    id: "fra_de_gaulle",
    nameKey: "ww1936.person.fra_de_gaulle",
    country: "FRA",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["war_leader"],
    alsoGeneral: "de_gaulle",
    source:
      "Leader of Free France from the appeal of 1940-06-18: en.wikipedia Charles de Gaulle; Britannica Charles de Gaulle",
  },
];
