// ww229 (design ww227 §7): Republican Spain's people. Real people only,
// each with the office that puts them here. The start leaders stay in the
// base content (leader_esr, esr_diaz); these add leaders for the routes and
// the advisors. Advisors marked `locked` come with the focus that names
// them. The fascist route keeps the base title: no real Republican figure
// fits it. Data only (ContentPurity).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ESR_PERSONS: PersonDef[] = [
  // ---- leaders ----
  {
    id: "esr_negrin",
    nameKey: "ww1936.person.esr_negrin",
    country: "ESR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    source:
      "en.wikipedia Juan Negrín: PSOE, finance minister 1936-37 (sent the gold to Moscow), prime minister 1937-39 ('to resist is to win')",
  },
  {
    id: "esr_prieto",
    nameKey: "ww1936.person.esr_prieto",
    country: "ESR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["planner"] },
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia Indalecio Prieto: PSOE, minister of the navy and air 1936-37, minister of national defence 1937-38",
  },
  {
    id: "esr_ibarruri",
    nameKey: "ww1936.person.esr_ibarruri",
    country: "ESR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Dolores Ibárruri (La Pasionaria): PCE deputy for Asturias 1936, the party's best-known speaker, general secretary from 1942",
  },
  {
    id: "esr_garcia_oliver",
    nameKey: "ww1936.person.esr_garcia_oliver",
    country: "ESR",
    roles: ["leader"],
    leaderTraits: ["popular_front"],
    ideology: "communist",
    source:
      "en.wikipedia Juan García Oliver: FAI and CNT leader in Barcelona, organiser of the Antifascist Militias Committee, minister of justice 1936-37",
  },
  {
    id: "esr_casado",
    nameKey: "ww1936.person.esr_casado",
    country: "ESR",
    roles: ["leader"],
    leaderTraits: ["peace_negotiator"],
    ideology: "neutral",
    source:
      "en.wikipedia Segismundo Casado: commander of the Army of the Centre, led the National Defence Council's coup against Negrín in 1939",
  },
  {
    id: "esr_besteiro",
    nameKey: "ww1936.person.esr_besteiro",
    country: "ESR",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    source:
      "en.wikipedia Julián Besteiro: PSOE moderate, president of the Cortes 1931-33, envoy to the coronation in London 1937, member of the National Defence Council 1939",
  },
  // ---- advisors ----
  {
    id: "esr_largo_caballero",
    nameKey: "ww1936.person.esr_largo_caballero",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "democratic",
    source:
      "en.wikipedia Francisco Largo Caballero: UGT general secretary, prime minister and minister of war 1936-37",
  },
  {
    id: "esr_montseny",
    nameKey: "ww1936.person.esr_montseny",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "communist",
    source:
      "en.wikipedia Federica Montseny: CNT-FAI writer and speaker, minister of health 1936-37, the first woman minister in Spain",
  },
  {
    id: "esr_alvarez_del_vayo",
    nameKey: "ww1936.person.esr_alvarez_del_vayo",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    source:
      "en.wikipedia Julio Álvarez del Vayo: PSOE, foreign minister 1936-37 and 1938-39, the Republic's voice at the League of Nations",
  },
  {
    id: "esr_tarradellas",
    nameKey: "ww1936.person.esr_tarradellas",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Josep Tarradellas: ERC, Generalitat councillor of finance 1936-39, set up the Catalan War Industries Commission",
  },
  {
    id: "esr_herrera",
    nameKey: "ww1936.person.esr_herrera",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Emilio Herrera Linares: aeronautical engineer, founder of the Cuatro Vientos aerodynamics laboratory, head of the Republic's air force technical services",
  },
  {
    id: "esr_rojo_chief",
    nameKey: "ww1936.person.esr_rojo_chief",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "esr_rojo",
    ideology: "neutral",
    locked: true,
    source:
      "en.wikipedia Vicente Rojo Lluch: chief of the general staff of the Republican army 1937-39",
  },
  {
    id: "esr_matallana",
    nameKey: "ww1936.person.esr_matallana",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    ideology: "neutral",
    source:
      "es.wikipedia Manuel Matallana Gómez: chief of staff of the Army of the Centre and of the Central Region Army Group 1937-39",
  },
  {
    id: "esr_cordon",
    nameKey: "ww1936.person.esr_cordon",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    ideology: "communist",
    source:
      "en.wikipedia Antonio Cordón García: PCE artillery officer, technical secretary and undersecretary of the army 1937-39",
  },
  {
    id: "esr_hidalgo_de_cisneros",
    nameKey: "ww1936.person.esr_hidalgo_de_cisneros",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    ideology: "communist",
    source:
      "en.wikipedia Ignacio Hidalgo de Cisneros: commander of the Republican air force 1936-39",
  },
  {
    id: "esr_buiza",
    nameKey: "ww1936.person.esr_buiza",
    country: "ESR",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_raider"] },
    ideology: "democratic",
    source:
      "es.wikipedia Miguel Buiza Fernández-Palacios: commander of the Republican fleet 1938-39 at the battle of Cape Palos",
  },
];
