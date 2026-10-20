// World War 1936 P3 (spec §5.7, §19.9, §19.10; plan decision 27): every
// leader person (lane K6). The 79 starting leaders keep the P0 name keys
// ww1936.leader.<TAG>; the replacement and alternative leaders use
// ww1936.person.<id>. Titled leaders are not persons: they are "title:<id>"
// strings in COUNTRY_POLITICS (countries.ts).
//
// Offices on 1936-01-01 for the starting leaders were checked against
// en.wikipedia "List of state leaders in 1936" and worldstatesmen.org.
// Spec §5.7 keeps the P0 starting leaders as P0 decided; every person added
// here was checked against the spec §8.4 exclusion rule (no conviction at
// Nuremberg, Tokyo, the later trials or a national war-crimes court; no
// SS/Gestapo/NKVD chief; no leader of massacres, deportations or purge
// trials; no governor of Korea or Taiwan).
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_LEADERS: readonly PersonDef[] = [
  // ---- the 79 starting leaders, COUNTRY_TAGS order ----
  // source: Fuehrer und Reichskanzler from 1934-08-02; en.wikipedia, worldstatesmen.org
  {
    id: "leader_deu",
    nameKey: "ww1936.leader.DEU",
    country: "DEU",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Fuehrer and Reich Chancellor (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Head of Government from 1922-10-31; en.wikipedia, worldstatesmen.org
  {
    id: "leader_ita",
    nameKey: "ww1936.leader.ITA",
    country: "ITA",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Head of Government (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1934-07-08 to 1936-03-09; after 1936-02-26 Japan shows titles only (spec §5.7)
  {
    id: "leader_jpn",
    nameKey: "ww1936.leader.JPN",
    country: "JPN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (Okada cabinet, to 1936-03-09) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1935-06-07 to 1937-05-28 (National Government); en.wikipedia, gov.uk past PMs
  {
    id: "leader_gbr",
    nameKey: "ww1936.leader.GBR",
    country: "GBR",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["caretaker"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President of the Council 1935-06-07 to 1936-01-24; en.wikipedia, worldstatesmen.org.
  // Note for the controller: convicted of treason by the High Court of Justice in 1945; kept per spec §5.7 and the K6 brief.
  {
    id: "leader_fra",
    nameKey: "ww1936.leader.FRA",
    country: "FRA",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["caretaker"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President of the Council (to 1936-01-24) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1933-03-04 to 1945-04-12; en.wikipedia, whitehouse.gov
  {
    id: "leader_usa",
    nameKey: "ww1936.leader.USA",
    country: "USA",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["new_dealer"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: General Secretary of the party from 1922; en.wikipedia, worldstatesmen.org
  {
    id: "leader_sun",
    nameKey: "ww1936.leader.SUN",
    country: "SUN",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: General Secretary of the Communist Party (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1926-1939
  {
    id: "leader_pol",
    nameKey: "ww1936.leader.POL",
    country: "POL",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President from 1935-12-18
  {
    id: "leader_csk",
    nameKey: "ww1936.leader.CSK",
    country: "CSK",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (from 1935-12-18) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Federal Chancellor 1934-07-29 to 1938-03-11
  {
    id: "leader_aut",
    nameKey: "ww1936.leader.AUT",
    country: "AUT",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Federal Chancellor (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Regent 1920-1944
  {
    id: "leader_hun",
    nameKey: "ww1936.leader.HUN",
    country: "HUN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Regent (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1930-1940
  {
    id: "leader_rou",
    nameKey: "ww1936.leader.ROU",
    country: "ROU",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: First Regent for Peter II 1934-1941
  {
    id: "leader_yug",
    nameKey: "ww1936.leader.YUG",
    country: "YUG",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["caretaker"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: First Regent (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Tsar 1918-1943
  {
    id: "leader_bgr",
    nameKey: "ww1936.leader.BGR",
    country: "BGR",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Tsar (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King, restored 1935-11-25
  {
    id: "leader_grc",
    nameKey: "ww1936.leader.GRC",
    country: "GRC",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (restored 1935-11-25) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1928-1939
  {
    id: "leader_alb",
    nameKey: "ww1936.leader.ALB",
    country: "ALB",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1923-10-29 to 1938-11-10
  {
    id: "leader_tur",
    nameKey: "ww1936.leader.TUR",
    country: "TUR",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["reformer"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1934-1951
  {
    id: "leader_bel",
    nameKey: "ww1936.leader.BEL",
    country: "BEL",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1933-1939
  {
    id: "leader_nld",
    nameKey: "ww1936.leader.NLD",
    country: "NLD",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1926-1937
  {
    id: "leader_lux",
    nameKey: "ww1936.leader.LUX",
    country: "LUX",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President of the Confederation for 1936
  {
    id: "leader_che",
    nameKey: "ww1936.leader.CHE",
    country: "CHE",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President of the Confederation (1936) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister from 1936-02-19, President from 1936-05-11 (on 1936-01-01 he led the opposition: P0 choice)
  {
    id: "leader_esr",
    nameKey: "ww1936.leader.ESR",
    country: "ESR",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: none; Prime Minister from 1936-02-19, President from 1936-05-11 (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Nationalist head of state from 1936-10-01 (the Nationalist side did not exist on 1936-01-01: P0 choice)
  {
    id: "leader_esn",
    nameKey: "ww1936.leader.ESN",
    country: "ESN",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: none; Nationalist head of state from 1936-10-01 (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President of the Council 1932-1968
  {
    id: "leader_prt",
    nameKey: "ww1936.leader.PRT",
    country: "PRT",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President of the Council (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President of the Executive Council 1932-1937
  {
    id: "leader_irl",
    nameKey: "ww1936.leader.IRL",
    country: "IRL",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President of the Executive Council (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1929-1942
  {
    id: "leader_dnk",
    nameKey: "ww1936.leader.DNK",
    country: "DNK",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1934-1942
  {
    id: "leader_isl",
    nameKey: "ww1936.leader.ISL",
    country: "ISL",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1935-1945
  {
    id: "leader_nor",
    nameKey: "ww1936.leader.NOR",
    country: "NOR",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1932-1946 (out of office 1936-06-19 to 1936-09-28)
  {
    id: "leader_swe",
    nameKey: "ww1936.leader.SWE",
    country: "SWE",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1931-1937
  {
    id: "leader_fin",
    nameKey: "ww1936.leader.FIN",
    country: "FIN",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: State Elder, ruling by decree since 1934-03-12
  {
    id: "leader_est",
    nameKey: "ww1936.leader.EST",
    country: "EST",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: State Elder (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister since the 1934-05-15 coup, also President from 1936-04-11
  {
    id: "leader_lva",
    nameKey: "ww1936.leader.LVA",
    country: "LVA",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1926-1940
  {
    id: "leader_ltu",
    nameKey: "ww1936.leader.LTU",
    country: "LTU",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President of the Senate 1934-11-28 to 1939 (archontology.org Danzig; en.wikipedia Arthur Greiser).
  // Note for the controller: sentenced to death by the Polish Supreme National Tribunal on 1946-07-09; kept only because spec §5.7 keeps P0 leaders.
  {
    id: "leader_dzg",
    nameKey: "ww1936.leader.DZG",
    country: "DZG",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President of the Senate (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1933-1939
  {
    id: "leader_irq",
    nameKey: "ww1936.leader.IRQ",
    country: "IRQ",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Shah 1925-1941
  {
    id: "leader_irn",
    nameKey: "ww1936.leader.IRN",
    country: "IRN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Shah (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1932-1953
  {
    id: "leader_sau",
    nameKey: "ww1936.leader.SAU",
    country: "SAU",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Imam and King 1918-1948
  {
    id: "leader_yem",
    nameKey: "ww1936.leader.YEM",
    country: "YEM",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Imam and King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: King 1933-1973
  {
    id: "leader_afg",
    nameKey: "ww1936.leader.AFG",
    country: "AFG",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: King (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Premier of the Executive Yuan from 1935-12; chairman Lin Sen was head of state
  {
    id: "leader_chn",
    nameKey: "ww1936.leader.CHN",
    country: "CHN",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["generalissimo"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Premier and Chairman of the Military Affairs Commission (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: party leader after the Zunyi conference (1935-01)
  {
    id: "leader_ccp",
    nameKey: "ww1936.leader.CCP",
    country: "CCP",
    roles: ["leader"],
    ideology: "communist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: leading member of the party after Zunyi (1935-01) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: head of the Guangxi clique
  {
    id: "leader_gxc",
    nameKey: "ww1936.leader.GXC",
    country: "GXC",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: head of the Guangxi clique (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: ruler of Shanxi
  {
    id: "leader_sxi",
    nameKey: "ww1936.leader.SXI",
    country: "SXI",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: ruler of Shanxi (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Chairman of Yunnan 1928-1945
  {
    id: "leader_yun",
    nameKey: "ww1936.leader.YUN",
    country: "YUN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Chairman of Yunnan (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: military ruler of Qinghai
  {
    id: "leader_xbm",
    nameKey: "ww1936.leader.XBM",
    country: "XBM",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: military ruler of Qinghai (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Border Defence Commissioner of Xinjiang 1933-1944
  {
    id: "leader_sik",
    nameKey: "ww1936.leader.SIK",
    country: "SIK",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Border Defence Commissioner (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Regent 1934-1941
  {
    id: "leader_tib",
    nameKey: "ww1936.leader.TIB",
    country: "TIB",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Regent (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Emperor 1934-1945 (prime minister Zhang Jinghui)
  {
    id: "leader_mck",
    nameKey: "ww1936.leader.MCK",
    country: "MCK",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Emperor (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1932 to 1936-03-02
  {
    id: "leader_mng",
    nameKey: "ww1936.leader.MNG",
    country: "MNG",
    roles: ["leader"],
    ideology: "communist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: General Secretary of the party 1932-1973
  {
    id: "leader_ttu",
    nameKey: "ww1936.leader.TTU",
    country: "TTU",
    roles: ["leader"],
    ideology: "communist",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: General Secretary of the party (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1933-1938
  {
    id: "leader_tha",
    nameKey: "ww1936.leader.THA",
    country: "THA",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1932-1945
  {
    id: "leader_npl",
    nameKey: "ww1936.leader.NPL",
    country: "NPL",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Viceroy 1931-04-18 to 1936-04-18
  {
    id: "leader_raj",
    nameKey: "ww1936.leader.RAJ",
    country: "RAJ",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Viceroy (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Emperor 1930-1974
  {
    id: "leader_eth",
    nameKey: "ww1936.leader.ETH",
    country: "ETH",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Emperor (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1930-1944
  {
    id: "leader_lbr",
    nameKey: "ww1936.leader.LBR",
    country: "LBR",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1924 to 1939-09-05
  {
    id: "leader_zaf",
    nameKey: "ww1936.leader.ZAF",
    country: "ZAF",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister from 1935-10-23
  {
    id: "leader_can",
    nameKey: "ww1936.leader.CAN",
    country: "CAN",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1934-1940
  {
    id: "leader_mex",
    nameKey: "ww1936.leader.MEX",
    country: "MEX",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["reformer"],
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1931-1944
  {
    id: "leader_gtm",
    nameKey: "ww1936.leader.GTM",
    country: "GTM",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1933-1949
  {
    id: "leader_hnd",
    nameKey: "ww1936.leader.HND",
    country: "HND",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1935-1944.
  // Note for the controller: he led the 1932 La Matanza killings; kept only because spec §5.7 keeps P0 leaders.
  {
    id: "leader_slv",
    nameKey: "ww1936.leader.SLV",
    country: "SLV",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1933 to 1936-06
  {
    id: "leader_nic",
    nameKey: "ww1936.leader.NIC",
    country: "NIC",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1932 to 1936-05-08
  {
    id: "leader_cri",
    nameKey: "ww1936.leader.CRI",
    country: "CRI",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1932 to 1936-10-01
  {
    id: "leader_pan",
    nameKey: "ww1936.leader.PAN",
    country: "PAN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Army chief of staff, the power behind interim president Jose A. Barnet
  {
    id: "leader_cub",
    nameKey: "ww1936.leader.CUB",
    country: "CUB",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Army chief of staff (interim president Jose A. Barnet) (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1930-1941
  {
    id: "leader_hti",
    nameKey: "ww1936.leader.HTI",
    country: "HTI",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1930-1938.
  // Note for the controller: he ordered the 1937 Parsley massacre; kept only because spec §5.7 keeps P0 leaders.
  {
    id: "leader_dom",
    nameKey: "ww1936.leader.DOM",
    country: "DOM",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1934-1938
  {
    id: "leader_col",
    nameKey: "ww1936.leader.COL",
    country: "COL",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President from 1935-12
  {
    id: "leader_ven",
    nameKey: "ww1936.leader.VEN",
    country: "VEN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Supreme Chief 1935-1937
  {
    id: "leader_ecu",
    nameKey: "ww1936.leader.ECU",
    country: "ECU",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Supreme Chief (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1933-1939
  {
    id: "leader_per",
    nameKey: "ww1936.leader.PER",
    country: "PER",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1934 to 1936-05-17
  {
    id: "leader_bol",
    nameKey: "ww1936.leader.BOL",
    country: "BOL",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1930-1945
  {
    id: "leader_bra",
    nameKey: "ww1936.leader.BRA",
    country: "BRA",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1932 to 1936-02-17
  {
    id: "leader_pry",
    nameKey: "ww1936.leader.PRY",
    country: "PRY",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1931-1938, ruling by decree since his 1933-03-31 self-coup
  {
    id: "leader_ury",
    nameKey: "ww1936.leader.URY",
    country: "URY",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1932-1938
  {
    id: "leader_arg",
    nameKey: "ww1936.leader.ARG",
    country: "ARG",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: President 1932-1938
  {
    id: "leader_chl",
    nameKey: "ww1936.leader.CHL",
    country: "CHL",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: President (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister 1932-1939
  {
    id: "leader_aus",
    nameKey: "ww1936.leader.AUS",
    country: "AUS",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },
  // source: Prime Minister from 1935-12-06
  {
    id: "leader_nzl",
    nameKey: "ww1936.leader.NZL",
    country: "NZL",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "P0 starting leader (spec §5.7), office on 1936-01-01: Prime Minister (en.wikipedia List of state leaders in 1936; worldstatesmen.org)",
  },

  // ---- replacement leaders (events set them: spec §19.9) ----
  // source: President of the Council 1936-06-04 to 1937-06-22 and 1938-03-13 to 04-10 (en.wikipedia Leon Blum; DHM LeMO). No conviction.
  {
    id: "fra_blum",
    nameKey: "ww1936.person.fra_blum",
    country: "FRA",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["popular_front"],
    source:
      "President of the Council from 1936-06-04 (en.wikipedia Leon Blum; DHM LeMO biography)",
  },
  // source: President of the Council 1938-04-10 to 1940-03-21 (en.wikipedia Edouard Daladier; USHMM). Riom trial never reached a verdict.
  {
    id: "fra_daladier",
    nameKey: "ww1936.person.fra_daladier",
    country: "FRA",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "President of the Council from 1938-04-10 (en.wikipedia Edouard Daladier; USHMM collections)",
  },
  // source: President from 1945-04-12 (en.wikipedia Harry S. Truman; trumanlibrary.gov)
  {
    id: "usa_truman",
    nameKey: "ww1936.person.usa_truman",
    country: "USA",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "President from 1945-04-12 (en.wikipedia Harry S. Truman; trumanlibrary.gov)",
  },
  // source: Prime Minister from 1939-09-05 after the 80-67 vote of 1939-09-04 (en.wikipedia 1939 in South Africa; sahistory.org.za)
  {
    id: "zaf_smuts",
    nameKey: "ww1936.person.zaf_smuts",
    country: "ZAF",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["war_leader"],
    source:
      "Prime Minister from 1939-09-05 (en.wikipedia 1939 in South Africa; sahistory.org.za)",
  },
  // source: President from 1938-11-11, elected 348-0 (en.wikipedia 1938 Turkish presidential election; Britannica).
  // Note for the controller: Prime Minister when the Dersim operations began (1937); never tried. Required by the K6 brief.
  {
    id: "tur_inonu",
    nameKey: "ww1936.person.tur_inonu",
    country: "TUR",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "President from 1938-11-11 (en.wikipedia 1938 Turkish presidential election; Britannica Ismet Inonu)",
  },
  // source: declared of age by the 1941-03-27 coup (en.wikipedia Yugoslav coup d'etat; royalfamily.org)
  {
    id: "yug_peter_ii",
    nameKey: "ww1936.person.yug_peter_ii",
    country: "YUG",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "King in his own right from 1941-03-27 (en.wikipedia Peter II of Yugoslavia; royalfamily.org)",
  },

  // ---- alternative-ideology leaders (spec §19.10: real people, never invented) ----
  // source: chancellor-designate of the 20 July plotters; arrested 1944-08-12, hanged 1945-02-02 (en.wikipedia; History of War 2019)
  {
    id: "deu_goerdeler",
    nameKey: "ww1936.person.deu_goerdeler",
    country: "DEU",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    until: "1944-08-12",
    source:
      "chancellor-designate of the 1944 plot (en.wikipedia Carl Friedrich Goerdeler; History of War 2019)",
  },
  // source: leader of the British Union of Fascists from 1932; interned 1940-05-23 to 1943-11 without charge (archives.shef.ac.uk; TNA discovery)
  {
    id: "gbr_mosley",
    nameKey: "ww1936.person.gbr_mosley",
    country: "GBR",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "BUF leader from 1932, interned without charge 1940-1943 (Sheffield University archives; The National Archives)",
  },
  // source: General Secretary of the CPGB 1929-1939 and 1941-1956 (en.wikipedia; Britannica; Archives Hub)
  {
    id: "gbr_pollitt",
    nameKey: "ww1936.person.gbr_pollitt",
    country: "GBR",
    roles: ["leader"],
    ideology: "communist",
    source:
      "General Secretary of the CPGB 1929-1939, 1941-1956 (en.wikipedia Harry Pollitt; Britannica)",
  },
  // source: King 1936-01-20 to 1936-12-11 (The National Archives education; The Gazette)
  {
    id: "gbr_edward_viii",
    nameKey: "ww1936.person.gbr_edward_viii",
    country: "GBR",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    source:
      "King 1936-01-20 to 1936-12-11 (The National Archives; The Gazette)",
  },
  // source: leader of the People's Party, convicted only in the 1932 Brest political trials (annulled 2023), exile 1933-1939; died 1945-10-31 (en.wikipedia; IPN)
  {
    id: "pol_witos",
    nameKey: "ww1936.person.pol_witos",
    country: "POL",
    roles: ["leader"],
    ideology: "democratic",
    until: "1945-10-31",
    source:
      "People's Party leader in exile 1933-1939 (en.wikipedia Wincenty Witos; IPN Brest trials)",
  },
  // source: Social Democrat, Chancellor 1918-1920, President 1945-1950; never charged (en.wikipedia Karl Renner; biografiasyvidas.com)
  {
    id: "aut_renner",
    nameKey: "ww1936.person.aut_renner",
    country: "AUT",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "Social Democrat, Chancellor 1918-1920 (en.wikipedia Karl Renner; biografiasyvidas.com)",
  },
  // source: President of the first Hungarian republic 1918-11-16 to 1919-03-21, in exile 1919-1946 (en.wikipedia; Britannica)
  {
    id: "hun_karolyi",
    nameKey: "ww1936.person.hun_karolyi",
    country: "HUN",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "President 1918-1919, in exile to 1946 (en.wikipedia Mihaly Karolyi; Britannica)",
  },
  // source: leader of the National Peasants' Party from 1937-12; his 1947 conviction was a communist political trial (en.wikipedia; memorialsighet.ro)
  {
    id: "rou_maniu",
    nameKey: "ww1936.person.rou_maniu",
    country: "ROU",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "National Peasants' Party leader, Prime Minister 1928-1930, 1932-1933 (en.wikipedia Iuliu Maniu; memorialsighet.ro)",
  },
  // source: leader of the Croatian Peasant Party, Deputy Prime Minister 1939-08 to 1941-04 (en.wikipedia; Britannica)
  {
    id: "yug_macek",
    nameKey: "ww1936.person.yug_macek",
    country: "YUG",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "Croatian Peasant Party leader, Deputy Prime Minister 1939-1941 (en.wikipedia Vladko Macek; Britannica)",
  },
  // source: Liberal Party leader, Prime Minister 1924, 1945-1946, 1947-1949 (en.wikipedia Themistoklis Sofoulis; grandlodge.gr)
  {
    id: "grc_sofoulis",
    nameKey: "ww1936.person.grc_sofoulis",
    country: "GRC",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "Liberal Party leader, Prime Minister 1945-1946, 1947-1949 (en.wikipedia; grandlodge.gr)",
  },
  // source: General Secretary of the PCE 1932-1942, died 1942-03-19 (en.wikipedia; Real Academia de la Historia DB~e)
  {
    id: "esr_diaz",
    nameKey: "ww1936.person.esr_diaz",
    country: "ESR",
    roles: ["leader"],
    ideology: "communist",
    until: "1942-03-19",
    source:
      "PCE General Secretary 1932-1942 (en.wikipedia Jose Diaz; dbe.rah.es)",
  },
  // source: heir of Alfonso XIII, head of the royal house from 1941-01-15 (en.wikipedia Infante Juan, Count of Barcelona; unofficialroyalty.com)
  {
    id: "esn_juan_de_borbon",
    nameKey: "ww1936.person.esn_juan_de_borbon",
    country: "ESN",
    roles: ["leader"],
    ideology: "neutral",
    source:
      "heir to the Spanish throne, head of the royal house from 1941 (en.wikipedia; unofficialroyalty.com)",
  },
  // source: founder of the National Syndicalists, exiled 1934; later an opponent of Salazar (en.wikipedia; Costa Pinto, The Blue Shirts)
  {
    id: "prt_rolao_preto",
    nameKey: "ww1936.person.prt_rolao_preto",
    country: "PRT",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "National Syndicalist leader, exiled 1934 (en.wikipedia Francisco Rolao Preto; Costa Pinto, The Blue Shirts)",
  },
  // source: Blueshirt leader from 1933, National Corporate Party 1935; died 1944-11-30 (en.wikipedia; Mount Merrion Historical Society)
  {
    id: "irl_oduffy",
    nameKey: "ww1936.person.irl_oduffy",
    country: "IRL",
    roles: ["leader"],
    ideology: "fascist",
    until: "1944-11-30",
    source:
      "Blueshirt and National Corporate Party leader (en.wikipedia Eoin O'Duffy; mountmerrionhistorical.com)",
  },
  // source: leader of Brazilian Integralist Action 1932-1937 (infoescola.com; Goncalves 2017 biography)
  {
    id: "bra_salgado",
    nameKey: "ww1936.person.bra_salgado",
    country: "BRA",
    roles: ["leader"],
    ideology: "fascist",
    source:
      "Integralist Action leader 1932-1937 (infoescola.com; Goncalves, Plinio Salgado 2017)",
  },
  // source: communist leader, jailed 1936-03 to 1945-04-19 amnesty (sites.usp.br Portal Latinoamericano; fpabramo.org.br)
  {
    id: "bra_prestes",
    nameKey: "ww1936.person.bra_prestes",
    country: "BRA",
    roles: ["leader"],
    ideology: "communist",
    source:
      "communist leader, jailed 1936-1945 (USP Portal Latinoamericano; Fundacao Perseu Abramo)",
  },
  // source: President 1922-1928, Radical Civic Union leader in the 1930s, died 1942-03-23 (en.wikipedia 1937 Argentine election; Infobae 2022)
  {
    id: "arg_alvear",
    nameKey: "ww1936.person.arg_alvear",
    country: "ARG",
    roles: ["leader"],
    ideology: "democratic",
    until: "1942-03-23",
    source:
      "Radical Civic Union leader, 1937 candidate (en.wikipedia 1937 Argentine presidential election; Infobae)",
  },
  // source: civilian leader of the 1932 revolution, minister 1934-1941, Regent 1941-1945; never tried (en.wikipedia; Britannica)
  {
    id: "tha_pridi",
    nameKey: "ww1936.person.tha_pridi",
    country: "THA",
    roles: ["leader"],
    ideology: "democratic",
    source:
      "minister 1934-1941, Regent 1941-1945, Prime Minister 1946 (en.wikipedia Pridi Banomyong; Britannica)",
  },
];
