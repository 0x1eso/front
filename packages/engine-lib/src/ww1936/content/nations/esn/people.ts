// ww229 (design ww227 §7): Nationalist Spain's people. Real people only,
// each with the office that puts them here. The start leaders stay in the
// base content (leader_esn, esn_juan_de_borbon); these add a leader for the
// routes the base left to a title, and the advisors. Advisors marked
// `locked` come with the focus that names them. Data only (ContentPurity).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ESN_PERSONS: PersonDef[] = [
  // ---- leaders ----
  {
    id: "esn_gil_robles",
    nameKey: "ww1936.person.esn_gil_robles",
    country: "ESN",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia José María Gil-Robles: leader of the CEDA (largest party in the 1933 Cortes), in exile in Portugal from 1936, later on the Count of Barcelona's privy council",
  },
  {
    id: "esn_monzon",
    nameKey: "ww1936.person.esn_monzon",
    country: "ESN",
    roles: ["leader"],
    ideology: "communist",
    source:
      "es.wikipedia Jesús Monzón Repáraz: led the PCE organisation in occupied France, organiser of the Unión Nacional Española and the Val d'Aran incursion of 1944",
  },
  {
    id: "esn_javier_borbon_parma",
    nameKey: "ww1936.person.esn_javier_borbon_parma",
    country: "ESN",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "en.wikipedia Prince Xavier of Bourbon-Parma: named regent of the Carlist Communion in 1936, Carlist claimant from 1952",
  },
  {
    id: "esn_serrano_suner",
    nameKey: "ww1936.person.esn_serrano_suner",
    country: "ESN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["party_ideologue"] },
    ideology: "fascist",
    locked: true,
    source:
      "en.wikipedia Ramón Serrano Súñer: minister of the interior 1938-40, president of the FET political junta, foreign minister 1940-42",
  },
  {
    id: "esn_fal_conde",
    nameKey: "ww1936.person.esn_fal_conde",
    country: "ESN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["propagandist"] },
    ideology: "neutral",
    source:
      "en.wikipedia Manuel Fal Conde: delegate head of the Carlist Traditionalist Communion 1934-55, sent into exile in Portugal in 1936-37",
  },
  // ---- advisors ----
  {
    id: "esn_gomez_jordana",
    nameKey: "ww1936.person.esn_gomez_jordana",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "neutral",
    locked: true,
    source:
      "en.wikipedia Francisco Gómez-Jordana Sousa: vice-president and foreign minister 1938-39, foreign minister again 1942-44",
  },
  {
    id: "esn_carrero_blanco",
    nameKey: "ww1936.person.esn_carrero_blanco",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "neutral",
    source:
      "en.wikipedia Luis Carrero Blanco: naval officer, undersecretary of the presidency of the government from 1941",
  },
  {
    id: "esn_hedilla",
    nameKey: "ww1936.person.esn_hedilla",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    ideology: "fascist",
    locked: true,
    source:
      "en.wikipedia Manuel Hedilla: national chief of the Falange 1936-37, arrested after he refused the Decree of Unification in 1937",
  },
  {
    id: "esn_suanzes",
    nameKey: "ww1936.person.esn_suanzes",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    ideology: "neutral",
    locked: true,
    source:
      "en.wikipedia Juan Antonio Suanzes: minister of industry and commerce 1938-39, first president of the National Institute of Industry (INI) 1941-63",
  },
  {
    id: "esn_carceller",
    nameKey: "ww1936.person.esn_carceller",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    ideology: "fascist",
    source:
      "es.wikipedia Demetrio Carceller Segura: minister of industry and commerce 1940-45",
  },
  {
    id: "esn_ibanez_martin",
    nameKey: "ww1936.person.esn_ibanez_martin",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    ideology: "neutral",
    locked: true,
    source:
      "en.wikipedia José Ibáñez Martín: minister of national education 1939-51, first president of the CSIC (founded 1939)",
  },
  {
    id: "esn_davila_chief",
    nameKey: "ww1936.person.esn_davila_chief",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "esn_davila",
    ideology: "neutral",
    source:
      "en.wikipedia Fidel Dávila Arrondo: president of the Junta Técnica del Estado 1936-37, commander of the Army of the North 1937-38, minister of the army 1945-51",
  },
  {
    id: "esn_vigon",
    nameKey: "ww1936.person.esn_vigon",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    ideology: "neutral",
    locked: true,
    source:
      "es.wikipedia Juan Vigón Suero-Díaz: chief of staff of the Army of the North 1937-39, chief of the central general staff 1939-40, air minister 1940-45",
  },
  {
    id: "esn_kindelan",
    nameKey: "ww1936.person.esn_kindelan",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    ideology: "neutral",
    locked: true,
    source:
      "en.wikipedia Alfredo Kindelán: commander of the Nationalist air force 1936-39, a leading monarchist general",
  },
  {
    id: "esn_moreno",
    nameKey: "ww1936.person.esn_moreno",
    country: "ESN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    ideology: "neutral",
    source:
      "es.wikipedia Francisco Moreno Fernández: commanded the Nationalist fleet's blockade of the Mediterranean coast 1936-39, minister of the navy 1945-51",
  },
];
