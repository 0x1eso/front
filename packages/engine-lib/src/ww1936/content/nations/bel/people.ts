// ww229: Belgium's people. Leopold III is the P0 leader_bel (democratic,
// persons/leaders.ts); the leaders below cover every ideology, and the
// advisors without an ideology serve any government. A person with an
// ideology is an advisor only under that ideology. Dates: `from` inclusive,
// `until` exclusive; where a date is from memory the source says so.
// Data only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BEL_PERSONS: PersonDef[] = [
  // ---- democratic ----
  {
    id: "bel_van_zeeland",
    nameKey: "ww1936.person.bel_van_zeeland",
    country: "BEL",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["conciliator"] },
    leaderTraits: ["reformer"],
    source:
      "Prime Minister 1935-1937 (Catholic, economist of the National Bank), led the devaluation and the three-party government: en.wikipedia Paul van Zeeland",
  },
  {
    id: "bel_spaak",
    nameKey: "ww1936.person.bel_spaak",
    country: "BEL",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["diplomat"] },
    leaderTraits: ["peace_negotiator"],
    source:
      "Socialist; Foreign Minister from 1936, Prime Minister 1938-1939, Foreign Minister of the London government: en.wikipedia Paul-Henri Spaak",
  },
  {
    id: "bel_pierlot",
    nameKey: "ww1936.person.bel_pierlot",
    country: "BEL",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["war_leader"],
    source:
      "Catholic; Prime Minister from 1939, head of the government in exile in London: en.wikipedia Hubert Pierlot",
  },
  {
    id: "bel_huysmans",
    nameKey: "ww1936.person.bel_huysmans",
    country: "BEL",
    roles: ["advisor"],
    ideology: "democratic",
    advisor: { slot: "political", traits: ["orator"] },
    source:
      "Socialist, mayor of Antwerp in the 1930s and President of the Chamber in the late 1930s: en.wikipedia Camille Huysmans",
  },
  // ---- fascist ----
  {
    id: "bel_degrelle",
    nameKey: "ww1936.person.bel_degrelle",
    country: "BEL",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "Founder and leader of Rex, 21 seats in the 1936 election, lost the 1937 Brussels by-election to van Zeeland: en.wikipedia Léon Degrelle; Rexism",
  },
  {
    id: "bel_de_clercq",
    nameKey: "ww1936.person.bel_de_clercq",
    country: "BEL",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["party_boss"],
    until: "1942-10-23",
    source:
      "Founder and leader of the Flemish National Union (VNV) from 1933 until his death in October 1942 (day from memory): en.wikipedia Staf De Clercq",
  },
  {
    id: "bel_van_severen",
    nameKey: "ww1936.person.bel_van_severen",
    country: "BEL",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    until: "1940-05-20",
    source:
      "Leader of Verdinaso, killed at Abbeville in May 1940 after his arrest as a suspect: en.wikipedia Joris Van Severen",
  },
  {
    id: "bel_borms",
    nameKey: "ww1936.person.bel_borms",
    country: "BEL",
    roles: ["advisor"],
    ideology: "fascist",
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "Flemish activist of the First World War, condemned and released in 1929, a symbol of the amnesty campaign: en.wikipedia August Borms",
  },
  // ---- communist ----
  {
    id: "bel_lahaut",
    nameKey: "ww1936.person.bel_lahaut",
    country: "BEL",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["popular_front"],
    source:
      "Communist deputy for Liège from 1932, strike leader, later party chairman: en.wikipedia Julien Lahaut",
  },
  {
    id: "bel_lalmand",
    nameKey: "ww1936.person.bel_lalmand",
    country: "BEL",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "Communist Party of Belgium organiser, its secretary-general during and after the occupation: en.wikipedia Edgar Lalmand",
  },
  // ---- non-aligned ----
  {
    id: "bel_leopold_iii",
    nameKey: "ww1936.person.bel_leopold_iii",
    country: "BEL",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch", "strongman"],
    source:
      "King of the Belgians from 1934; the personal policy and the royal question (here as a government of the King): en.wikipedia Leopold III of Belgium",
  },
  {
    id: "bel_de_man",
    nameKey: "ww1936.person.bel_de_man",
    country: "BEL",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    advisor: { slot: "political", traits: ["planner"] },
    leaderTraits: ["reformer"],
    source:
      "Author of the Plan of Labour, minister of public works and finance 1935-1938, party president from 1939, dissolved the party in 1940: en.wikipedia Hendrik de Man",
  },
  // ---- any government ----
  {
    id: "bel_gutt",
    nameKey: "ww1936.person.bel_gutt",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "Finance minister in 1934-1935 and again from 1939, saved the reserves for the London government: en.wikipedia Camille Gutt",
  },
  {
    id: "bel_van_den_bergen",
    nameKey: "ww1936.person.bel_van_den_bergen",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "bel_gen_van_den_bergen",
    until: "1940-02-01",
    source:
      "Chief of the General Staff from 1935, dismissed after the Mechelen incident early in 1940 (day from memory): fr.wikipedia Édouard Van den Bergen; en.wikipedia Mechelen incident",
  },
  {
    id: "bel_michiels",
    nameKey: "ww1936.person.bel_michiels",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    alsoGeneral: "bel_gen_michiels",
    source:
      "Lieutenant-general, Chief of the General Staff after Van den Bergen in 1940: fr.wikipedia Oscar Michiels; en.wikipedia Battle of Belgium",
  },
  {
    id: "bel_van_overstraeten",
    nameKey: "ww1936.person.bel_van_overstraeten",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    alsoGeneral: "bel_gen_van_overstraeten",
    source:
      "The King's military adviser, the author of the defence plans of 1939-1940: fr.wikipedia Raoul Van Overstraeten; en.wikipedia Battle of Belgium",
  },
  {
    id: "bel_denis",
    nameKey: "ww1936.person.bel_denis",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_logistics"] },
    source:
      "Lieutenant-general, Minister of National Defence from 1936 to 1940: fr.wikipedia Henri Denis (militaire)",
  },
  {
    id: "bel_galopin",
    nameKey: "ww1936.person.bel_galopin",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    until: "1944-02-28",
    source:
      "Governor of the Société Générale de Belgique from 1935, assassinated in February 1944: en.wikipedia Alexandre Galopin",
  },
  {
    id: "bel_sengier",
    nameKey: "ww1936.person.bel_sengier",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "Director of the Union Minière du Haut-Katanga, shipped the Shinkolobwe uranium ore to New York in 1940: en.wikipedia Edgar Sengier",
  },
  {
    id: "bel_lemaitre",
    nameKey: "ww1936.person.bel_lemaitre",
    country: "BEL",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Priest and physicist, professor at the Catholic University of Leuven, author of the expanding-universe theory: en.wikipedia Georges Lemaître",
  },
];
