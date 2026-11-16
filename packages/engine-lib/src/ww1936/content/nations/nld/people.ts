// ww229: the Netherlands' leaders and advisors (names ww1936.person.<id>).
// Hendrikus Colijn is the P0 leader leader_nld (persons/leaders.ts) and is
// not repeated. History is a loose guide: an office holder of 1939-1945 may
// serve from the start. Facts from memory of the en.wikipedia articles named
// in each source.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NLD_PERSONS: readonly PersonDef[] = [
  // ---- democratic ----
  {
    id: "nld_de_geer",
    nameKey: "ww1936.person.nld_de_geer",
    country: "NLD",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia Dirk Jan de Geer: CHU, Prime Minister 1926-1929 and 1939-1940",
  },
  {
    id: "nld_gerbrandy",
    nameKey: "ww1936.person.nld_gerbrandy",
    country: "NLD",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Pieter Sjoerds Gerbrandy: ARP, Prime Minister of the government in exile in London 1940-1945",
  },
  {
    id: "nld_drees",
    nameKey: "ww1936.person.nld_drees",
    country: "NLD",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Willem Drees: SDAP alderman of The Hague, Minister of Social Affairs 1945-1948, Prime Minister 1948-1958",
  },
  {
    id: "nld_van_kleffens",
    nameKey: "ww1936.person.nld_van_kleffens",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    source:
      "en.wikipedia Eelco van Kleffens: Minister of Foreign Affairs 1939-1946",
  },
  {
    id: "nld_tinbergen",
    nameKey: "ww1936.person.nld_tinbergen",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["planner"] },
    ideology: "democratic",
    source:
      "en.wikipedia Jan Tinbergen: economist at the Central Bureau of Statistics, worked on the SDAP's Plan of Labour (1935)",
  },
  // ---- non-aligned (the crown and the Netherlands Union) ----
  {
    id: "nld_wilhelmina",
    nameKey: "ww1936.person.nld_wilhelmina",
    country: "NLD",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source: "en.wikipedia Wilhelmina of the Netherlands: Queen 1890-1948",
  },
  {
    id: "nld_de_quay",
    nameKey: "ww1936.person.nld_de_quay",
    country: "NLD",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["strongman"],
    ideology: "neutral",
    source:
      "en.wikipedia Jan de Quay: one of the triumvirate of the Netherlands Union (Nederlandsche Unie) 1940-1941",
  },
  {
    id: "nld_einthoven",
    nameKey: "ww1936.person.nld_einthoven",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    ideology: "neutral",
    source:
      "en.wikipedia Louis Einthoven: chief of police of Rotterdam, triumvir of the Netherlands Union 1940-1941",
  },
  {
    id: "nld_linthorst_homan",
    nameKey: "ww1936.person.nld_linthorst_homan",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "neutral",
    source:
      "en.wikipedia Johannes Linthorst Homan: Queen's Commissioner of Groningen, triumvir of the Netherlands Union 1940-1941",
  },
  // ---- fascist ----
  {
    id: "nld_mussert",
    nameKey: "ww1936.person.nld_mussert",
    country: "NLD",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "en.wikipedia Anton Mussert: co-founder and leader of the National Socialist Movement (NSB) 1931-1945",
  },
  {
    id: "nld_meijer",
    nameKey: "ww1936.person.nld_meijer",
    country: "NLD",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Arnold Meijer: leader of Zwart Front (Black Front) 1934-1941",
  },
  {
    id: "nld_rost_van_tonningen",
    nameKey: "ww1936.person.nld_rost_van_tonningen",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    ideology: "fascist",
    source:
      "en.wikipedia Meinoud Rost van Tonningen: NSB member of parliament, president of the Netherlands Bank under the occupation",
  },
  {
    id: "nld_van_geelkerken",
    nameKey: "ww1936.person.nld_van_geelkerken",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "fascist",
    source:
      "en.wikipedia Cornelis van Geelkerken: co-founder of the NSB with Mussert, its deputy leader",
  },
  // ---- communist ----
  {
    id: "nld_de_groot",
    nameKey: "ww1936.person.nld_de_groot",
    country: "NLD",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Paul de Groot: general secretary of the Communist Party of the Netherlands (CPN) 1938-1962",
  },
  {
    id: "nld_sneevliet",
    nameKey: "ww1936.person.nld_sneevliet",
    country: "NLD",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    leaderTraits: ["popular_front"],
    ideology: "communist",
    until: "1942-04-13",
    source:
      "en.wikipedia Henk Sneevliet: trade unionist (NAS), founder of the RSAP, member of parliament 1933-1937, executed 1942",
  },
  {
    id: "nld_wijnkoop",
    nameKey: "ww1936.person.nld_wijnkoop",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["party_ideologue"] },
    ideology: "communist",
    source:
      "en.wikipedia David Wijnkoop: founder of the Dutch Communist Party, member of parliament until 1941",
  },
  // ---- industry, research and the forces ----
  {
    id: "nld_anton_philips",
    nameKey: "ww1936.person.nld_anton_philips",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "en.wikipedia Anton Philips: co-founder and head of Philips, Eindhoven",
  },
  {
    id: "nld_van_veen",
    nameKey: "ww1936.person.nld_van_veen",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "en.wikipedia Johan van Veen: Rijkswaterstaat engineer, the father of the Delta Plan",
  },
  {
    id: "nld_fokker",
    nameKey: "ww1936.person.nld_fokker",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    until: "1939-12-23",
    source:
      "en.wikipedia Anthony Fokker: aircraft designer and maker, died in New York in December 1939",
  },
  {
    id: "nld_kramers",
    nameKey: "ww1936.person.nld_kramers",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Hendrik Kramers: theoretical physicist, professor at Leiden from 1934",
  },
  {
    id: "nld_reijnders",
    nameKey: "ww1936.person.nld_reijnders",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    source:
      "en.wikipedia Izaak H. Reijnders: Commander-in-Chief of the Dutch land and sea forces 1939-1940",
  },
  {
    id: "nld_helfrich",
    nameKey: "ww1936.person.nld_helfrich",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_raider"] },
    source:
      "en.wikipedia Conrad Helfrich: commander of the Royal Netherlands Navy in the East Indies 1939-1942, ABDA naval commander",
  },
  {
    id: "nld_doorman",
    nameKey: "ww1936.person.nld_doorman",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    source:
      "en.wikipedia Karel Doorman: rear admiral, led the Allied squadron at the Battle of the Java Sea 1942",
  },
  {
    id: "nld_best",
    nameKey: "ww1936.person.nld_best",
    country: "NLD",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    source:
      "en.wikipedia Battle of the Netherlands: Lieutenant General P.W. Best commanded the army air arm and the air defence in 1940 (from memory)",
  },
];
