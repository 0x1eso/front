// ww229: South Africa's people: leaders for every ideology (with the row's
// Hertzog and the base content's Smuts) and the advisors. Data only.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ZAF_PERSONS: PersonDef[] = [
  {
    id: "zaf_hofmeyr",
    nameKey: "ww1936.person.zaf_hofmeyr",
    country: "ZAF",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["administrator"],
    },
    ideology: "democratic",
    source:
      "en.wikipedia Jan Hendrik Hofmeyr (1894-1948): Minister of the Interior, Education and Public Health 1933-1938, Minister of Finance 1939-1948, Deputy Prime Minister",
  },
  {
    id: "zaf_reitz",
    nameKey: "ww1936.person.zaf_reitz",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["conciliator"],
    },
    ideology: "democratic",
    source:
      "en.wikipedia Deneys Reitz: cabinet minister (Lands, Mines, Native Affairs) 1933-1943, Deputy Prime Minister 1939-1943",
  },
  {
    id: "zaf_te_water",
    nameKey: "ww1936.person.zaf_te_water",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "political",
      traits: ["diplomat"],
    },
    source:
      "en.wikipedia Charles te Water: High Commissioner in London 1929-1939, President of the League of Nations Assembly 1933",
  },
  {
    id: "zaf_malan",
    nameKey: "ww1936.person.zaf_malan",
    country: "ZAF",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "en.wikipedia D. F. Malan: leader of the Purified National Party from 1934 and of the Reunited National Party from 1940, Prime Minister 1948-1954",
  },
  {
    id: "zaf_havenga",
    nameKey: "ww1936.person.zaf_havenga",
    country: "ZAF",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["fiscal_hawk"],
    },
    ideology: "neutral",
    source:
      "en.wikipedia Nicolaas Havenga: Minister of Finance 1924-1939, leader of the Afrikaner Party from 1941",
  },
  {
    id: "zaf_strijdom",
    nameKey: "ww1936.person.zaf_strijdom",
    country: "ZAF",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "en.wikipedia J. G. Strijdom: Transvaal leader of the National Party from 1934, Prime Minister 1954-1958",
  },
  {
    id: "zaf_van_rensburg",
    nameKey: "ww1936.person.zaf_van_rensburg",
    country: "ZAF",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Hans van Rensburg: Administrator of the Orange Free State 1936-1940, Commandant-General of the Ossewabrandwag 1941-1952",
  },
  {
    id: "zaf_pirow",
    nameKey: "ww1936.person.zaf_pirow",
    country: "ZAF",
    roles: ["leader", "advisor"],
    advisor: {
      slot: "political",
      traits: ["hawk"],
    },
    ideology: "fascist",
    source:
      "en.wikipedia Oswald Pirow: Minister of Defence 1933-1939, founder of the New Order movement in 1940",
  },
  {
    id: "zaf_weichardt",
    nameKey: "ww1936.person.zaf_weichardt",
    country: "ZAF",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "en.wikipedia Louis Weichardt: founder and leader of the South African Gentile National Socialist Movement (the Greyshirts) from 1933",
  },
  {
    id: "zaf_kotane",
    nameKey: "ww1936.person.zaf_kotane",
    country: "ZAF",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Moses Kotane: general secretary of the Communist Party of South Africa from 1939",
  },
  {
    id: "zaf_andrews",
    nameKey: "ww1936.person.zaf_andrews",
    country: "ZAF",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Bill Andrews (South African politician): founding chairman of the Communist Party of South Africa in 1921, later its chairman again",
  },
  {
    id: "zaf_dadoo",
    nameKey: "ww1936.person.zaf_dadoo",
    country: "ZAF",
    roles: ["leader"],
    ideology: "communist",
    source:
      "en.wikipedia Yusuf Dadoo: leader of the Non-European United Front from 1939, Communist Party member, president of the Transvaal Indian Congress from 1945",
  },
  {
    id: "zaf_van_der_bijl",
    nameKey: "ww1936.person.zaf_van_der_bijl",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_production"],
    },
    source:
      "en.wikipedia Hendrik van der Bijl: founder of ESCOM (1923) and ISCOR (1928), Director-General of War Supplies 1940-1945",
  },
  {
    id: "zaf_oppenheimer",
    nameKey: "ww1936.person.zaf_oppenheimer",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "industry",
      traits: ["ind_resources"],
    },
    source:
      "en.wikipedia Ernest Oppenheimer: founder and chairman of Anglo American (1917), chairman of De Beers from 1929",
  },
  {
    id: "zaf_schonland",
    nameKey: "ww1936.person.zaf_schonland",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "research",
      traits: ["rs_science"],
    },
    source:
      "en.wikipedia Basil Schonland: director of the Bernard Price Institute of Geophysics from 1938, led South Africa's wartime radar work (Special Signals Services)",
  },
  {
    id: "zaf_van_ryneveld",
    nameKey: "ww1936.person.zaf_van_ryneveld",
    country: "ZAF",
    roles: ["advisor"],
    advisor: {
      slot: "army_chief",
      traits: ["chief_organizer"],
    },
    source:
      "en.wikipedia Pierre van Ryneveld: founder of the South African Air Force (1920), Chief of the General Staff 1933-1949",
  },
];
