// World War 1936 P3 (spec §6.5, §15.2, §19.10): the politics of all 79
// countries on 1936-01-01, the claims and the faction names (lane K6).
//
// - One row per country in COUNTRY_TAGS order. popularity = democratic /
//   communist / fascist / neutral in percent (sums to 100); stability and
//   warSupport are the base values in percent (spec §6.5).
// - The majors use the spec §6.5 table. Every other row writes the spec §19.10
//   defaults out as numbers: democratic 65/4/8/23 (the other 35 split in the
//   neutral default ratio 10:20:55), stability 55, war support 20; neutral
//   15/10/20/55, 50, 30; communist 6/65/8/21 (same rule), 50, 35. The spec
//   gives no fascist default: fascist rows use 7/4/65/24 (same rule), 50, 35.
// - Ruling ideology on 1936-01-01, checked against en.wikipedia (each
//   government article and "List of state leaders in 1936") and
//   worldstatesmen.org / archontology.org. Deviations from the spec §19.10
//   list are noted on their rows (URY, DZG).
// - leaders: all four ideologies written out. "title:leader_<ideology>" is the
//   generic titled leader (key ww1936.title.leader_<ideology>, Task 9); the
//   other "title:" ids are this lane's (ww1936.title.<id>).
// - govNames: ww1936.gov.<TAG>.<ideology>; the rest falls back to
//   ww1936.gov.generic.<ideology> (Task 9). Minor countries name only their
//   1936 government and the ideologies that have a real alternative leader.
import type {
  ClaimDef,
  CountryPoliticsDef,
  FactionNameDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const COUNTRY_POLITICS: readonly CountryPoliticsDef[] = [
  // ---- majors (spec §6.5) ----
  // Germany: NSDAP one-party state since 1933-07-14.
  {
    tag: "DEU",
    ruling: "fascist",
    popularity: [5, 2, 80, 13],
    stability: 60,
    warSupport: 50,
    tree: "DEU",
    spirits: ["deu_rhineland_dmz", "deu_rearmament"],
    leaders: {
      democratic: "deu_goerdeler",
      communist: "title:leader_communist",
      fascist: "leader_deu",
      neutral: "deu_beck",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // Italy: Fascist single-party state since 1928.
  {
    tag: "ITA",
    ruling: "fascist",
    popularity: [5, 2, 78, 15],
    stability: 55,
    warSupport: 65,
    // P5 (P5 spec §18.1-5): its own tree.
    tree: "ITA",
    spirits: ["ita_abyssinia", "ita_sanctions"],
    // P5 (K1): the non-aligned government is the 1943 Marshal-Premier's, the
    // democratic one the President of the Council (titles, persons/ita.ts).
    leaders: {
      democratic: "title:ita_council_president",
      communist: "title:leader_communist",
      fascist: "leader_ita",
      neutral: "title:ita_military_premier",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // Japan: neutral (spec §6.5). Every leader after 1936-02-26 is a title (spec §5.7).
  {
    tag: "JPN",
    ruling: "neutral",
    popularity: [15, 2, 33, 50],
    stability: 50,
    warSupport: 55,
    // P5 (P5 spec §18.1-5): its own tree.
    tree: "JPN",
    spirits: ["jpn_service_rivalry"],
    // Pre-flight R7: Okada (leader_jpn) leads at the start only; after the
    // 26 February incident Japan shows the title (spec §5.7).
    startLeader: "leader_jpn",
    leaders: {
      democratic: "title:jpn_prime_minister",
      communist: "title:leader_communist",
      fascist: "title:jpn_prime_minister",
      neutral: "title:jpn_prime_minister",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // United Kingdom: the National Government (1931-1940). Parliament elected 1935-11-14.
  {
    tag: "GBR",
    ruling: "democratic",
    popularity: [75, 3, 4, 18],
    stability: 65,
    warSupport: 20,
    tree: "GBR",
    firstElection: "1940-11-14",
    spirits: ["gbr_peace_mood", "gbr_empire"],
    leaders: {
      democratic: "leader_gbr",
      communist: "gbr_pollitt",
      fascist: "gbr_mosley",
      neutral: "gbr_edward_viii",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // France: Third Republic; legislative election 1936-04-26 (first round).
  {
    tag: "FRA",
    ruling: "democratic",
    popularity: [60, 15, 10, 15],
    stability: 45,
    warSupport: 25,
    // P5 (P5 spec §18.1-5): its own tree.
    tree: "FRA",
    firstElection: "1936-04-26",
    spirits: ["fra_divided", "fra_defensive_mind", "fra_hollow_years"],
    leaders: {
      democratic: "leader_fra",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:fra_chief_of_state",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // United States: presidential election 1936-11-03.
  {
    tag: "USA",
    ruling: "democratic",
    popularity: [80, 2, 3, 15],
    stability: 60,
    warSupport: 15,
    // P5 (P5 spec §18.1-5): its own tree.
    tree: "USA",
    firstElection: "1936-11-03",
    spirits: ["usa_depression", "usa_isolation"],
    leaders: {
      democratic: "leader_usa",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },
  // Soviet Union: alternative leaders are titles (spec §19.10).
  {
    tag: "SUN",
    ruling: "communist",
    popularity: [2, 85, 1, 12],
    stability: 55,
    warSupport: 40,
    tree: "SUN",
    spirits: ["sun_five_year_plans"],
    leaders: {
      democratic: "title:sun_provisional_head",
      communist: "leader_sun",
      fascist: "title:sun_national_head",
      neutral: "title:sun_supreme_ruler",
    },
    govNames: ["democratic", "communist", "fascist", "neutral"],
  },

  // ---- Europe ----
  // Poland: Sanation regime under the April Constitution of 1935.
  {
    tag: "POL",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    spirits: ["pol_between"],
    leaders: {
      democratic: "pol_witos",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_pol",
    },
    govNames: ["democratic", "neutral"],
  },
  // Czechoslovakia: parliamentary republic. The next Chamber election was due in 1941 and never
  // took place, so there is no fixed first election (hashed day, spec §5.4).
  {
    tag: "CSK",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_csk",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Austria: the Federal State, one-party Fatherland Front (authoritarian, not fascist here).
  {
    tag: "AUT",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "aut_renner",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_aut",
    },
  },
  // Hungary: regency; Party of National Unity government. The Arrow Cross leader is excluded (spec §8.4).
  {
    tag: "HUN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "hun_karolyi",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_hun",
    },
    govNames: ["democratic", "neutral"],
  },
  // Romania: kingdom of Carol II, National Liberal government. Fascist leader by title only (spec §5.7).
  {
    tag: "ROU",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "rou_maniu",
      communist: "title:leader_communist",
      fascist: "title:rou_conducator",
      neutral: "leader_rou",
    },
    govNames: ["democratic", "neutral"],
  },
  // Yugoslavia: regency, Yugoslav Radical Union government.
  {
    tag: "YUG",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "yug_macek",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_yug",
    },
    govNames: ["democratic", "neutral"],
  },
  // Bulgaria: personal rule of Boris III since 1935.
  {
    tag: "BGR",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_bgr",
    },
  },
  // Greece: monarchy restored by the 1935-10-10 coup and the 1935-11-03 plebiscite; caretaker
  // cabinet, then the 4th of August regime from 1936-08-04.
  {
    tag: "GRC",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "grc_sofoulis",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_grc",
    },
  },
  // Albania: kingdom of Zog I.
  {
    tag: "ALB",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_alb",
    },
  },
  // Turkey: Republican People's Party single-party state.
  {
    tag: "TUR",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_tur",
    },
    govNames: ["neutral"],
  },
  // Belgium: constitutional monarchy, van Zeeland government.
  {
    tag: "BEL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_bel",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Netherlands: Colijn government.
  {
    tag: "NLD",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_nld",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Luxembourg: Bech government.
  {
    tag: "LUX",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_lux",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Switzerland: federal council.
  {
    tag: "CHE",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    spirits: ["gen_armed_neutrality"],
    leaders: {
      democratic: "leader_che",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Spanish Republic: parliamentary republic (Popular Front won the 1936-02-16 election).
  {
    tag: "ESR",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    spirits: ["esp_civil_war_nation"],
    leaders: {
      democratic: "leader_esr",
      communist: "esr_diaz",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
    govNames: ["democratic", "communist"],
  },
  // Nationalist Spain: fascist per spec §19.10 (single party FET y de las JONS from 1937-04-19).
  {
    tag: "ESN",
    ruling: "fascist",
    popularity: [7, 4, 65, 24],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    spirits: ["esp_civil_war_nation"],
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "leader_esn",
      neutral: "esn_juan_de_borbon",
    },
    govNames: ["fascist", "neutral"],
  },
  // Portugal: Estado Novo under the 1933 constitution.
  {
    tag: "PRT",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "prt_rolao_preto",
      neutral: "leader_prt",
    },
  },
  // Ireland: Irish Free State, Fianna Fail government.
  {
    tag: "IRL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_irl",
      communist: "title:leader_communist",
      fascist: "irl_oduffy",
      neutral: "title:leader_neutral",
    },
  },
  // Denmark: Stauning government.
  {
    tag: "DNK",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_dnk",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Iceland: Kingdom of Iceland, parliamentary.
  {
    tag: "ISL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_isl",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Norway: Labour government from 1935-03-20.
  {
    tag: "NOR",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_nor",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Sweden: Social Democratic government.
  {
    tag: "SWE",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    spirits: ["gen_armed_neutrality"],
    leaders: {
      democratic: "leader_swe",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Finland: parliamentary republic.
  {
    tag: "FIN",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_fin",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
    govNames: ["democratic"],
  },
  // Estonia: authoritarian rule by decree since 1934-03-12.
  {
    tag: "EST",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_est",
    },
  },
  // Latvia: authoritarian rule since the 1934-05-15 coup.
  {
    tag: "LVA",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_lva",
    },
  },
  // Lithuania: authoritarian presidency since the 1926 coup.
  {
    tag: "LTU",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_ltu",
    },
  },
  // Danzig: DEVIATION from the spec §19.10 list (non-aligned). The NSDAP has held the Senate since
  // 1933-06-20 and won 59.3% in the Volkstag election of 1935-04-07 (en.wikipedia 1935 Free City
  // of Danzig parliamentary election; archontology.org Danzig senate presidents). The leader is a
  // title card by controller ruling: the 1936 Senate President was convicted of war crimes (spec §8.4).
  {
    tag: "DZG",
    ruling: "fascist",
    popularity: [7, 4, 65, 24],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:dzg_senate_president",
      neutral: "title:leader_neutral",
    },
  },

  // ---- Middle East and Asia ----
  // Iraq: kingdom.
  {
    tag: "IRQ",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_irq",
    },
  },
  // Iran: Pahlavi monarchy.
  {
    tag: "IRN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_irn",
    },
  },
  // Saudi Arabia: absolute monarchy.
  {
    tag: "SAU",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_sau",
    },
  },
  // Yemen: imamate.
  {
    tag: "YEM",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_yem",
    },
  },
  // Afghanistan: kingdom.
  {
    tag: "AFG",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_afg",
    },
  },
  // China: Nationalist Government, Kuomintang political tutelage.
  {
    tag: "CHN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    spirits: ["chn_warlords"],
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_chn",
    },
    govNames: ["neutral"],
  },
  // Chinese Communists: Shaanbei base after the Long March.
  {
    tag: "CCP",
    ruling: "communist",
    popularity: [6, 65, 8, 21],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "leader_ccp",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Guangxi clique.
  {
    tag: "GXC",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_gxc",
    },
  },
  // Shanxi clique.
  {
    tag: "SXI",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_sxi",
    },
  },
  // Yunnan clique.
  {
    tag: "YUN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_yun",
    },
  },
  // Ma clique.
  {
    tag: "XBM",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_xbm",
    },
  },
  // Xinjiang: Soviet-backed provincial rule, neutral in 1936.
  {
    tag: "SIK",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_sik",
    },
  },
  // Tibet: regency.
  {
    tag: "TIB",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_tib",
    },
  },
  // Manchukuo: fascist per spec §19.10 (Axis member at start, spec §6.5).
  {
    tag: "MCK",
    ruling: "fascist",
    popularity: [7, 4, 65, 24],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "leader_mck",
      neutral: "title:leader_neutral",
    },
  },
  // Mongolia: Mongolian People's Republic.
  {
    tag: "MNG",
    ruling: "communist",
    popularity: [6, 65, 8, 21],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "leader_mng",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Tannu Tuva: Tuvan People's Republic.
  {
    tag: "TTU",
    ruling: "communist",
    popularity: [6, 65, 8, 21],
    stability: 50,
    warSupport: 35,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "leader_ttu",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Siam: constitutional monarchy run by the People's Party since 1932.
  {
    tag: "THA",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "tha_pridi",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_tha",
    },
  },
  // Nepal: Rana prime ministers.
  {
    tag: "NPL",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_npl",
    },
  },
  // British Raj: viceroyalty.
  {
    tag: "RAJ",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_raj",
    },
  },

  // ---- Africa ----
  // Ethiopia: empire.
  {
    tag: "ETH",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_eth",
    },
  },
  // Liberia: True Whig Party rule.
  {
    tag: "LBR",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_lbr",
    },
  },
  // South Africa: Union parliament, United Party government.
  {
    tag: "ZAF",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_zaf",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },

  // ---- Americas ----
  // Canada: Liberal government from 1935-10-23.
  {
    tag: "CAN",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_can",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Mexico: one-party rule of the National Revolutionary Party.
  {
    tag: "MEX",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_mex",
    },
  },
  // Guatemala: Ubico dictatorship.
  {
    tag: "GTM",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_gtm",
    },
  },
  // Honduras: Carias dictatorship.
  {
    tag: "HND",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_hnd",
    },
  },
  // El Salvador: military rule.
  {
    tag: "SLV",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_slv",
    },
  },
  // Nicaragua: elected president, but the National Guard holds power (coup 1936-06).
  {
    tag: "NIC",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_nic",
    },
  },
  // Costa Rica: constitutional republic.
  {
    tag: "CRI",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_cri",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Panama: president who came in with the 1931 Accion Comunal coup.
  {
    tag: "PAN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_pan",
    },
  },
  // Cuba: army-backed interim presidency.
  {
    tag: "CUB",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_cub",
    },
  },
  // Haiti: Vincent presidency, ruling by plebiscite.
  {
    tag: "HTI",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_hti",
    },
  },
  // Dominican Republic: Trujillo dictatorship.
  {
    tag: "DOM",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_dom",
    },
  },
  // Colombia: Liberal Republic.
  {
    tag: "COL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_col",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Venezuela: post-Gomez transition under military rule.
  {
    tag: "VEN",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_ven",
    },
  },
  // Ecuador: Supreme Chief appointed by the army.
  {
    tag: "ECU",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_ecu",
    },
  },
  // Peru: Benavides presidency.
  {
    tag: "PER",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_per",
    },
  },
  // Bolivia: presidency installed after the 1934 Villamontes coup.
  {
    tag: "BOL",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_bol",
    },
  },
  // Brazil: Vargas presidency under a state of siege since the 1935 rising.
  {
    tag: "BRA",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "bra_prestes",
      fascist: "bra_salgado",
      neutral: "leader_bra",
    },
  },
  // Paraguay: Liberal presidency (overthrown 1936-02-17).
  {
    tag: "PRY",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_pry",
    },
  },
  // Uruguay: DEVIATION from the spec §19.10 democratic list, as the K6 brief asks: Terra has ruled by
  // decree since his self-coup of 1933-03-31 ("March dictatorship", to 1938) (en.wikipedia Gabriel
  // Terra; countrystudies.us Uruguay).
  {
    tag: "URY",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "title:leader_democratic",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_ury",
    },
  },
  // Argentina: Concordancia, elections managed by fraud.
  {
    tag: "ARG",
    ruling: "neutral",
    popularity: [15, 10, 20, 55],
    stability: 50,
    warSupport: 30,
    tree: "generic",
    leaders: {
      democratic: "arg_alvear",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "leader_arg",
    },
  },
  // Chile: constitutional presidency.
  {
    tag: "CHL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_chl",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },

  // ---- Oceania ----
  // Australia: Lyons government.
  {
    tag: "AUS",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_aus",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
  // Dominion of NZ: Labour government from 1935-12-06.
  {
    tag: "NZL",
    ruling: "democratic",
    popularity: [65, 4, 8, 23],
    stability: 55,
    warSupport: 20,
    tree: "generic",
    leaders: {
      democratic: "leader_nzl",
      communist: "title:leader_communist",
      fascist: "title:leader_fascist",
      neutral: "title:leader_neutral",
    },
  },
];

/** Spec §17 / Task 15 Step 4: region groups a country may justify a claim on (REGION_GROUPS, K5). */
export const CLAIMS: readonly ClaimDef[] = [
  { tag: "POL", groups: ["zaolzie"] },
  {
    tag: "HUN",
    groups: ["south_slovakia", "carpathian_ruthenia", "north_transylvania"],
  },
  { tag: "BGR", groups: ["south_dobruja"] },
  { tag: "TUR", groups: ["hatay"] },
  { tag: "LTU", groups: ["vilnius"] },
];

/**
 * Spec §15.2: names of factions created in play (ww1936.faction_name.<id>).
 * The first row whose creators hold the founder wins; Japan has none (P5).
 */
export const FACTION_NAMES: readonly FactionNameDef[] = [
  // Czechoslovakia, Romania, Yugoslavia, 1920-1938.
  { id: "little_entente", creators: ["CSK", "ROU", "YUG"] },
  // Balkan Pact of 1934-02-09.
  { id: "balkan_entente", creators: ["GRC", "TUR", "ROU", "YUG"] },
  // Treaty of Geneva, 1934-09-12.
  { id: "baltic_entente", creators: ["EST", "LVA", "LTU"] },
  { id: "nordic_defence", creators: ["SWE", "NOR", "DNK", "FIN"] },
  // Only when the United States founds a faction outside the Allies. P5
  // (K4's hemisphere invites): members of any ideology may join.
  { id: "pan_american", creators: ["USA"], anyIdeology: true },
];
