// ww229: Greece's people: leaders for every ideology (2-3 each, with the
// row's King George II and Sofoulis) and the advisors. Dates are kept only
// where they are certain (a death).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const GRC_PERSONS: PersonDef[] = [
  // ---- neutral: the Fourth of August regime ----
  {
    id: "grc_metaxas",
    nameKey: "ww1936.person.grc_metaxas",
    country: "GRC",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["administrator"] },
    until: "1941-01-29",
    source:
      "en.wikipedia Ioannis Metaxas: Prime Minister from 1936, ruled the Fourth of August regime, died in office 1941-01-29",
  },
  {
    id: "grc_koryzis",
    nameKey: "ww1936.person.grc_koryzis",
    country: "GRC",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    until: "1941-04-18",
    source:
      "en.wikipedia Alexandros Koryzis: governor of the National Bank of Greece, Prime Minister after Metaxas, died 1941-04-18",
  },
  // ---- democratic ----
  {
    id: "grc_papandreou",
    nameKey: "ww1936.person.grc_papandreou",
    country: "GRC",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Georgios Papandreou: Venizelist minister, exiled by the Metaxas regime, Prime Minister of the government of national unity 1944",
  },
  {
    id: "grc_tsouderos",
    nameKey: "ww1936.person.grc_tsouderos",
    country: "GRC",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Emmanouil Tsouderos: Governor of the Bank of Greece 1931-1939, Prime Minister in exile 1941-1944",
  },
  {
    id: "grc_plastiras",
    nameKey: "ww1936.person.grc_plastiras",
    country: "GRC",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Nikolaos Plastiras: led the 1922 revolution and the failed 1933 coup, in exile in France, Prime Minister 1945",
  },
  {
    id: "grc_kanellopoulos",
    nameKey: "ww1936.person.grc_kanellopoulos",
    country: "GRC",
    roles: ["advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["orator"] },
    source:
      "en.wikipedia Panagiotis Kanellopoulos: founder of the National Unionist Party 1935, exiled by the Metaxas regime, minister in exile 1942",
  },
  // ---- fascist ----
  {
    id: "grc_merkouris",
    nameKey: "ww1936.person.grc_merkouris",
    country: "GRC",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Georgios Merkouris: founder of the Greek National Socialist Party, governor of the Bank of Greece under the occupation",
  },
  {
    id: "grc_tsolakoglou_pm",
    nameKey: "ww1936.person.grc_tsolakoglou_pm",
    country: "GRC",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Georgios Tsolakoglou: general, first Prime Minister of the collaborationist Hellenic State 1941-1942",
  },
  {
    id: "grc_logothetopoulos",
    nameKey: "ww1936.person.grc_logothetopoulos",
    country: "GRC",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Konstantinos Logothetopoulos: physician, Prime Minister of the collaborationist Hellenic State 1942-1943",
  },
  // ---- communist ----
  {
    id: "grc_zachariadis",
    nameKey: "ww1936.person.grc_zachariadis",
    country: "GRC",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Nikos Zachariadis: General Secretary of the Communist Party of Greece from 1931, jailed by the Metaxas regime from 1936",
  },
  {
    id: "grc_siantos",
    nameKey: "ww1936.person.grc_siantos",
    country: "GRC",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Georgios Siantos: acting General Secretary of the Communist Party of Greece 1942-1945, a founder of EAM",
  },
  {
    id: "grc_glinos",
    nameKey: "ww1936.person.grc_glinos",
    country: "GRC",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["party_ideologue"] },
    source:
      "en.wikipedia Dimitrios Glinos: educator and language reformer, exiled to the islands under Metaxas, wrote EAM's founding programme",
  },
  // ---- advisors of the regime and the state ----
  {
    id: "grc_maniadakis",
    nameKey: "ww1936.person.grc_maniadakis",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    source:
      "en.wikipedia Konstantinos Maniadakis: Minister of Public Security under Metaxas 1936-1941, ran the security police and the island exiles",
  },
  {
    id: "grc_nikoloudis",
    nameKey: "ww1936.person.grc_nikoloudis",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "en.wikipedia Theologos Nikoloudis: Under-Secretary for Press and Tourism of the Metaxas regime, its censorship and propaganda",
  },
  {
    id: "grc_politis",
    nameKey: "ww1936.person.grc_politis",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    until: "1942-03-04",
    source:
      "en.wikipedia Nikolaos Politis: jurist, Greek minister in Paris and League of Nations delegate, died 1942-03-04",
  },
  {
    id: "grc_varvaressos",
    nameKey: "ww1936.person.grc_varvaressos",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Kyriakos Varvaressos: economist, Governor of the Bank of Greece from 1939, finance minister in exile",
  },
  {
    id: "grc_bodosakis",
    nameKey: "ww1936.person.grc_bodosakis",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Prodromos Bodosakis-Athanasiadis: industrialist, owner of the Greek Powder and Cartridge Company (Pyrkal), arms exporter",
  },
  {
    id: "grc_papagos_chief",
    nameKey: "ww1936.person.grc_papagos_chief",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "papagos",
    source:
      "en.wikipedia Alexandros Papagos: Chief of the Army General Staff from 1936, Commander-in-Chief 1940-1941",
  },
  {
    id: "grc_sakellariou",
    nameKey: "ww1936.person.grc_sakellariou",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    source:
      "en.wikipedia Alexandros Sakellariou: admiral, Chief of the Navy General Staff in 1940-1941, took the fleet to Alexandria in 1941",
  },
  {
    id: "grc_zervas_chemist",
    nameKey: "ww1936.person.grc_zervas_chemist",
    country: "GRC",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Leonidas Zervas: organic chemist (Bergmann-Zervas peptide synthesis), professor at Thessaloniki and Athens from 1937",
  },
];
