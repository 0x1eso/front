// ww229: Canada's leaders and advisors (names ww1936.person.<id>). Mackenzie
// King is the P0 leader leader_can (persons/leaders.ts) and is not repeated.
// No dates beyond what the game needs: history is a loose guide, so an office
// holder of the war years may serve from the start. A `locked` advisor comes
// only from the focus or event that names him. Sources are en.wikipedia
// articles, recalled, not re-read for this lane.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CAN_PERSONS: readonly PersonDef[] = [
  // ---- democratic: Liberals, Conservatives, the CCF ----
  {
    id: "can_bennett",
    nameKey: "ww1936.person.can_bennett",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["new_dealer"],
    ideology: "democratic",
    source:
      "en.wikipedia R. B. Bennett: Prime Minister 1930-1935, Conservative leader to 1938; his 1935 'New Deal' broadcasts",
  },
  {
    id: "can_manion",
    nameKey: "ww1936.person.can_manion",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["caretaker"],
    ideology: "democratic",
    source:
      "en.wikipedia Robert Manion: leader of the Conservative Party 1938-1940, lost the 1940 election",
  },
  {
    id: "can_woodsworth",
    nameKey: "ww1936.person.can_woodsworth",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia J. S. Woodsworth: founding leader of the Co-operative Commonwealth Federation 1932-1942, pacifist",
  },
  {
    id: "can_coldwell",
    nameKey: "ww1936.person.can_coldwell",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "en.wikipedia M. J. Coldwell: leader of the Co-operative Commonwealth Federation 1942-1960",
  },
  {
    id: "can_lapointe",
    nameKey: "ww1936.person.can_lapointe",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Ernest Lapointe: Minister of Justice 1935-1941, Mackenzie King's Quebec lieutenant",
  },
  {
    id: "can_st_laurent",
    nameKey: "ww1936.person.can_st_laurent",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Louis St. Laurent: Minister of Justice from 1941, Secretary of State for External Affairs 1946-1948",
  },
  {
    id: "can_ralston",
    nameKey: "ww1936.person.can_ralston",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    ideology: "democratic",
    source:
      "en.wikipedia J. L. Ralston: Minister of National Defence 1940-1944, dismissed in the 1944 conscription crisis",
  },
  {
    id: "can_power",
    nameKey: "ww1936.person.can_power",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    ideology: "democratic",
    source:
      "en.wikipedia Chubby Power: Minister of National Defence for Air 1940-1944, resigned over overseas conscription",
  },
  {
    id: "can_skelton",
    nameKey: "ww1936.person.can_skelton",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia O. D. Skelton: Under-Secretary of State for External Affairs 1925-1941",
  },
  {
    id: "can_ilsley",
    nameKey: "ww1936.person.can_ilsley",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    ideology: "democratic",
    source: "en.wikipedia James Lorimer Ilsley: Minister of Finance 1940-1946",
  },
  {
    id: "can_towers",
    nameKey: "ww1936.person.can_towers",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Graham Towers: first Governor of the Bank of Canada 1934-1954",
  },
  {
    id: "can_mcnaughton_minister",
    nameKey: "ww1936.person.can_mcnaughton_minister",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Andrew McNaughton: Minister of National Defence 1944-1945, after Ralston; tried to raise volunteers first",
  },
  {
    id: "can_howe",
    nameKey: "ww1936.person.can_howe",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia C. D. Howe: Minister of Munitions and Supply 1940-1945",
  },
  {
    id: "can_cj_mackenzie",
    nameKey: "ww1936.person.can_cj_mackenzie",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia C. J. Mackenzie: acting, then president of the National Research Council 1939-1952",
  },
  {
    id: "can_banting",
    nameKey: "ww1936.person.can_banting",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_aircraft"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Frederick Banting: led aviation medicine research (the Franks flying suit) until his death in 1941",
  },
  {
    id: "can_stuart",
    nameKey: "ww1936.person.can_stuart",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    ideology: "democratic",
    source:
      "en.wikipedia Kenneth Stuart: Chief of the General Staff 1941-1943, then Chief of Staff at the Canadian Military Headquarters in London",
  },
  {
    id: "can_nelles",
    nameKey: "ww1936.person.can_nelles",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_dockyard"] },
    ideology: "democratic",
    source: "en.wikipedia Percy W. Nelles: Chief of the Naval Staff 1934-1944",
  },
  {
    id: "can_murray",
    nameKey: "ww1936.person.can_murray",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Leonard W. Murray: commanded the Newfoundland Escort Force, then the Northwest Atlantic Command 1943-1945",
  },
  {
    id: "can_breadner",
    nameKey: "ww1936.person.can_breadner",
    country: "CAN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_bomber"] },
    ideology: "democratic",
    locked: true,
    source:
      "en.wikipedia Lloyd Samuel Breadner: Chief of the Air Staff 1940-1943, then Air Officer Commanding-in-Chief RCAF Overseas",
  },
  // ---- non-aligned: the provinces' strong men ----
  {
    id: "can_duplessis",
    nameKey: "ww1936.person.can_duplessis",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "neutral",
    source:
      "en.wikipedia Maurice Duplessis: Union Nationale, Premier of Quebec 1936-1939 and 1944-1959; the Padlock Law",
  },
  {
    id: "can_aberhart",
    nameKey: "ww1936.person.can_aberhart",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "neutral",
    source:
      "en.wikipedia William Aberhart: Social Credit Premier of Alberta 1935-1943, radio evangelist",
  },
  // ---- fascist ----
  {
    id: "can_arcand",
    nameKey: "ww1936.person.can_arcand",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "en.wikipedia Adrien Arcand: leader of the National Social Christian Party and the National Unity Party of Canada (1938), interned 1940-1945",
  },
  {
    id: "can_whittaker",
    nameKey: "ww1936.person.can_whittaker",
    country: "CAN",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Canadian Nationalist Party: William Whittaker's Winnipeg party, merged into the National Unity Party in 1938",
  },
  // ---- communist ----
  {
    id: "can_tim_buck",
    nameKey: "ww1936.person.can_tim_buck",
    country: "CAN",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "en.wikipedia Tim Buck: General Secretary of the Communist Party of Canada 1929-1962",
  },
  {
    id: "can_fred_rose",
    nameKey: "ww1936.person.can_fred_rose",
    country: "CAN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["labour_organizer"] },
    ideology: "communist",
    locked: true,
    source:
      "en.wikipedia Fred Rose: Labor-Progressive MP for Montreal-Cartier 1943-1947",
  },
];
