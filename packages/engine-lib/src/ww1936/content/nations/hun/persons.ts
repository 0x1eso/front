// ww229 (design ww227 §7): Hungary's leaders and advisors. Names:
// ww1936.person.<id>. Real people only; the regent is the P0 leader_hun and
// Mihály Károlyi the P0 hun_karolyi (persons/leaders.ts). Dates are deaths
// only (the game's politics is not history's); offices are in the sources.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const HUN_PERSONS: readonly PersonDef[] = [
  // ---- neutral: the regency's men ----
  {
    id: "hun_daranyi",
    nameKey: "ww1936.person.hun_daranyi",
    country: "HUN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    leaderTraits: ["caretaker"],
    ideology: "neutral",
    until: "1939-11-01",
    source:
      "Kálmán Darányi, Prime Minister 1936-10 to 1938-05, Speaker until his death in 1939 (en.wikipedia Kálmán Darányi; worldstatesmen.org Hungary)",
  },
  {
    id: "hun_teleki",
    nameKey: "ww1936.person.hun_teleki",
    country: "HUN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["planner"] },
    leaderTraits: ["reformer"],
    ideology: "neutral",
    until: "1941-04-03",
    source:
      "Pál Teleki, geographer, Prime Minister 1920-21 and 1939-02 to his suicide in 1941-04 (en.wikipedia Pál Teleki; Britannica)",
  },
  {
    id: "hun_kallay",
    nameKey: "ww1936.person.hun_kallay",
    country: "HUN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    leaderTraits: ["peace_negotiator"],
    ideology: "neutral",
    source:
      "Miklós Kállay, Prime Minister 1942-03 to 1944-03, sought a separate peace with the Western Allies (en.wikipedia Miklós Kállay; Britannica)",
  },
  {
    id: "hun_bethlen",
    nameKey: "ww1936.person.hun_bethlen",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["conciliator"] },
    ideology: "neutral",
    source:
      "István Bethlen, Prime Minister 1921-1931, the regent's counsellor in the 1930s and 1940s (en.wikipedia István Bethlen; Britannica)",
  },
  {
    id: "hun_kanya",
    nameKey: "ww1936.person.hun_kanya",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    ideology: "neutral",
    source:
      "Kálmán Kánya, Foreign Minister 1933-02 to 1938-11 (en.wikipedia Kálmán Kánya; hu.wikipedia Kánya Kálmán)",
  },
  {
    id: "hun_csaky",
    nameKey: "ww1936.person.hun_csaky",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    ideology: "neutral",
    until: "1941-01-27",
    source:
      "István Csáky, Foreign Minister 1938-12 to his death in 1941-01, during both Vienna Awards (en.wikipedia István Csáky (politician, born 1894))",
  },
  {
    id: "hun_keresztes_fischer",
    nameKey: "ww1936.person.hun_keresztes_fischer",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    ideology: "neutral",
    source:
      "Ferenc Keresztes-Fischer, Minister of the Interior 1931-1935 and 1938-1944, kept the Arrow Cross in check (en.wikipedia Ferenc Keresztes-Fischer)",
  },
  {
    id: "hun_otto",
    nameKey: "ww1936.person.hun_otto",
    country: "HUN",
    roles: ["leader"],
    leaderTraits: ["monarch"],
    ideology: "neutral",
    source:
      "Otto von Habsburg, crown prince of the last king Charles IV, the legitimists' claimant to the Hungarian throne in exile (en.wikipedia Otto von Habsburg; Britannica)",
  },
  // ---- fascist ----
  {
    id: "hun_szalasi",
    nameKey: "ww1936.person.hun_szalasi",
    country: "HUN",
    roles: ["leader"],
    leaderTraits: ["strongman"],
    ideology: "fascist",
    source:
      "Ferenc Szálasi, founder of the Party of National Will (1935) and the Arrow Cross, jailed 1938-1940, Leader of the Nation 1944-10 to 1945 (en.wikipedia Ferenc Szálasi; Britannica)",
  },
  {
    id: "hun_imredy",
    nameKey: "ww1936.person.hun_imredy",
    country: "HUN",
    roles: ["leader", "advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    leaderTraits: ["party_boss"],
    ideology: "fascist",
    source:
      "Béla Imrédy, president of the National Bank 1935-1938, Prime Minister 1938-05 to 1939-02, founder of the Party of Hungarian Renewal 1940 (en.wikipedia Béla Imrédy)",
  },
  // ---- democratic ----
  {
    id: "hun_bajcsy_zsilinszky",
    nameKey: "ww1936.person.hun_bajcsy_zsilinszky",
    country: "HUN",
    roles: ["leader"],
    leaderTraits: ["war_leader"],
    ideology: "democratic",
    until: "1944-12-24",
    source:
      "Endre Bajcsy-Zsilinszky, Smallholder deputy, head of the Liberation Committee of the national rising, executed 1944-12 (en.wikipedia Endre Bajcsy-Zsilinszky)",
  },
  {
    id: "hun_tildy",
    nameKey: "ww1936.person.hun_tildy",
    country: "HUN",
    roles: ["leader"],
    leaderTraits: ["reformer"],
    ideology: "democratic",
    source:
      "Zoltán Tildy, a founder and from 1940 leader of the Independent Smallholders' Party, President of Hungary 1946-1948 (en.wikipedia Zoltán Tildy)",
  },
  {
    id: "hun_eckhardt",
    nameKey: "ww1936.person.hun_eckhardt",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    ideology: "democratic",
    source:
      "Tibor Eckhardt, leader of the Independent Smallholders' Party 1932-1940, left for the United States in 1941 (en.wikipedia Tibor Eckhardt)",
  },
  // ---- communist ----
  {
    id: "hun_rakosi",
    nameKey: "ww1936.person.hun_rakosi",
    country: "HUN",
    roles: ["leader"],
    leaderTraits: ["party_boss"],
    ideology: "communist",
    source:
      "Mátyás Rákosi, communist leader, jailed in Hungary 1925-1940 and released to Moscow, party leader 1945-1956 (en.wikipedia Mátyás Rákosi; Britannica)",
  },
  {
    id: "hun_gero",
    nameKey: "ww1936.person.hun_gero",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["party_ideologue"] },
    ideology: "communist",
    source:
      "Ernő Gerő, Comintern agent in Spain in the late 1930s, later Rákosi's deputy (en.wikipedia Ernő Gerő)",
  },
  // ---- the services, industry and science ----
  {
    id: "hun_werth",
    nameKey: "ww1936.person.hun_werth",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_offense"] },
    alsoGeneral: "hun_werth",
    source:
      "Henrik Werth, Chief of the General Staff 1938-10 to 1941-09 (en.wikipedia Henrik Werth)",
  },
  {
    id: "hun_szombathelyi",
    nameKey: "ww1936.person.hun_szombathelyi",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "hun_szombathelyi",
    source:
      "Ferenc Szombathelyi, Chief of the General Staff 1941-09 to 1944-04 (en.wikipedia Ferenc Szombathelyi)",
  },
  {
    id: "hun_ujszaszy",
    nameKey: "ww1936.person.hun_ujszaszy",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    source:
      "István Ujszászy, head of military intelligence (2nd Department of the General Staff) 1939-1942 (en.wikipedia István Ujszászy)",
  },
  {
    id: "hun_chorin",
    nameKey: "ww1936.person.hun_chorin",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "Ferenc Chorin, industrialist, head of the Weiss Manfréd works' family concern and of the industrialists' association (en.wikipedia Ferenc Chorin)",
  },
  {
    id: "hun_bay",
    nameKey: "ww1936.person.hun_bay",
    country: "HUN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "Zoltán Bay, physicist, head of the Tungsram research laboratory from 1936, built a Hungarian radar in the war (en.wikipedia Zoltán Bay)",
  },
];
