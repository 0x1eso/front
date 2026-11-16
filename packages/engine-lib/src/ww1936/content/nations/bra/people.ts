// ww229: Brazil's people: leaders for every ideology (2-3 each with the row's
// Vargas, Salgado and Prestes, base persons) and the advisors. No dates are
// kept: none is needed to gate them.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BRA_PERSONS: PersonDef[] = [
  // ---- neutral: the Estado Novo and the crown ----
  {
    id: "bra_dutra",
    nameKey: "ww1936.person.bra_dutra",
    country: "BRA",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "bra_gen_dutra",
    source:
      "en.wikipedia Eurico Gaspar Dutra: Minister of War 1936-1945, elected President 1945, in office 1946-1951",
  },
  {
    id: "bra_pedro_henrique",
    nameKey: "ww1936.person.bra_pedro_henrique",
    country: "BRA",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "en.wikipedia Prince Pedro Henrique of Orléans-Braganza: head of the Imperial House of Brazil from 1921, claimant to the throne",
  },
  // ---- democratic ----
  {
    id: "bra_armando_sales",
    nameKey: "ww1936.person.bra_armando_sales",
    country: "BRA",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Armando de Sales Oliveira: governor of São Paulo 1933-1936, opposition candidate for the 1938 election cancelled by the Estado Novo, exiled",
  },
  {
    id: "bra_eduardo_gomes",
    nameKey: "ww1936.person.bra_eduardo_gomes",
    country: "BRA",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "en.wikipedia Eduardo Gomes: survivor of the 1922 Copacabana revolt, air force brigadier in the war, UDN presidential candidate 1945",
  },
  {
    id: "bra_jose_americo",
    nameKey: "ww1936.person.bra_jose_americo",
    country: "BRA",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia José Américo de Almeida: novelist and minister, the government's candidate for the cancelled 1938 election",
  },
  // ---- fascist ----
  {
    id: "bra_gustavo_barroso",
    nameKey: "ww1936.person.bra_gustavo_barroso",
    country: "BRA",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Gustavo Barroso: writer, commander of the Integralist militia and the movement's most radical voice",
  },
  {
    id: "bra_miguel_reale",
    nameKey: "ww1936.person.bra_miguel_reale",
    country: "BRA",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Miguel Reale: jurist, Integralist Action's national secretary for doctrine in the 1930s",
  },
  // ---- communist ----
  {
    id: "bra_agildo_barata",
    nameKey: "ww1936.person.bra_agildo_barata",
    country: "BRA",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Agildo Barata: army captain who led the 1935 rising of the 3rd Infantry Regiment in Rio, jailed until 1945",
  },
  {
    id: "bra_marighella",
    nameKey: "ww1936.person.bra_marighella",
    country: "BRA",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Carlos Marighella: Communist Party organiser, jailed under Vargas in 1936-1937 and 1939-1945",
  },
  // ---- advisors ----
  {
    id: "bra_aranha",
    nameKey: "ww1936.person.bra_aranha",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Oswaldo Aranha: ambassador in Washington 1934-1937, Foreign Minister 1938-1944, steered Brazil to the Allies",
  },
  {
    id: "bra_francisco_campos",
    nameKey: "ww1936.person.bra_francisco_campos",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    source:
      "en.wikipedia Francisco Campos: Minister of Justice 1937-1942, author of the 1937 constitution",
  },
  {
    id: "bra_filinto_muller",
    nameKey: "ww1936.person.bra_filinto_muller",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    source:
      "en.wikipedia Filinto Müller: chief of the Federal District police 1933-1942, the regime's political police",
  },
  {
    id: "bra_lourival_fontes",
    nameKey: "ww1936.person.bra_lourival_fontes",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "en.wikipedia Lourival Fontes: head of the Department of Press and Propaganda (DIP) 1939-1942",
  },
  {
    id: "bra_souza_costa",
    nameKey: "ww1936.person.bra_souza_costa",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Artur de Sousa Costa: Minister of Finance 1934-1945, negotiated the trade and loan agreements with the United States",
  },
  {
    id: "bra_goes_monteiro",
    nameKey: "ww1936.person.bra_goes_monteiro",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "bra_gen_goes_monteiro",
    source:
      "en.wikipedia Pedro Aurélio de Góis Monteiro: Chief of the Army Staff 1937-1943, one of the makers of the Estado Novo",
  },
  {
    id: "bra_guinle",
    nameKey: "ww1936.person.bra_guinle",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "en.wikipedia Guilherme Guinle: industrialist, chaired the steel commission and was the first president of the Companhia Siderúrgica Nacional",
  },
  {
    id: "bra_macedo_soares",
    nameKey: "ww1936.person.bra_macedo_soares",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Edmundo de Macedo Soares: army engineer, technical director of the Volta Redonda steelworks",
  },
  {
    id: "bra_simonsen",
    nameKey: "ww1936.person.bra_simonsen",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Roberto Simonsen: São Paulo industrialist and economist, advocate of planned industrialisation",
  },
  {
    id: "bra_capanema",
    nameKey: "ww1936.person.bra_capanema",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Gustavo Capanema: Minister of Education and Health 1934-1945, built the national university and technical schools",
  },
  {
    id: "bra_salgado_filho",
    nameKey: "ww1936.person.bra_salgado_filho",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_naval"] },
    source:
      "en.wikipedia Joaquim Pedro Salgado Filho: first Minister of Aeronautics 1941-1945, founded the Brazilian Air Force",
  },
  {
    id: "bra_guilhem",
    nameKey: "ww1936.person.bra_guilhem",
    country: "BRA",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "en.wikipedia Henrique Aristides Guilhem: admiral, Minister of the Navy 1935-1945, ran the convoy war in the South Atlantic",
  },
];
