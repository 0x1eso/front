// ww229 (design ww227 §3, §7): Czechoslovakia's spirits, leaders and
// advisors. People are real; dates and offices from en.wikipedia and
// cs.wikipedia (from memory, no exact dates in any text). Stats use the
// WwStats keys: stability in bp (100 = 1%p), consumer goods + is worse.
import type {
  PersonDef,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CSK_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // Škoda, ČKD and Zbrojovka Brno: the arsenal of central Europe.
  {
    id: "csk_skoda_arsenal",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, rsArtilleryPct: 10 },
  },
  // Three million Germans, Hungarians, Ruthenians, Slovaks who want home
  // rule: a state of many peoples run from Prague.
  {
    id: "csk_nationalities",
    icon: "chain_broken",
    stats: { stabilityBp: -800, driftFasBp: 3 },
  },
  // The last parliamentary democracy east of the Rhine.
  {
    id: "csk_island_of_democracy",
    icon: "ballot",
    stats: { coupResistPct: 20, ppGainPct: 5, warSupportBp: -500 },
  },
  // ---- the nationalities ----
  {
    id: "csk_nationalities_eased",
    icon: "scales",
    stats: { stabilityBp: -300, driftFasBp: 1 },
  },
  {
    id: "csk_slovak_autonomy",
    icon: "flag",
    stats: { stabilityBp: 500, ppGainPct: -5 },
  },
  {
    id: "csk_centralism",
    icon: "document",
    stats: { ppGainPct: 10, stabilityBp: -300 },
  },
  // ---- the border fortifications (the mechanism: three levels) ----
  {
    id: "csk_forts_1",
    icon: "fort",
    stats: { fortConstructionPct: 15, defensePct: 3 },
  },
  {
    id: "csk_forts_2",
    icon: "fort",
    stats: { fortConstructionPct: 20, defensePct: 5, enemyJustifyTimePct: 15 },
  },
  {
    id: "csk_forts_3",
    icon: "fort",
    stats: {
      fortConstructionPct: 25,
      defensePct: 7,
      enemyJustifyTimePct: 25,
      entrenchMax: 5,
    },
  },
  {
    id: "csk_fortress_gunners",
    icon: "artillery",
    stats: { defensePct: 3, artillerySoftPct: 5 },
  },
  // ---- state and army ----
  {
    id: "csk_state_defence",
    icon: "shield",
    stats: { warSupportBp: 500, recruitablePct: 2 },
  },
  {
    id: "csk_border_guard",
    icon: "tower",
    stats: { defensePct: 2, coupResistPct: 10 },
  },
  { id: "csk_general_staff", icon: "compass", stats: { planSpeedPct: 10 } },
  {
    id: "csk_mobilisation_plans",
    icon: "infantry",
    stats: { recruitablePct: 2, warSupportBp: 300 },
  },
  {
    id: "csk_partial_mobilisation",
    icon: "infantry",
    stats: { warSupportBp: 800, recruitablePct: 3 },
  },
  {
    id: "csk_mobilised",
    icon: "megaphone",
    stats: { recruitablePct: 5, consumerGoodsPp: 5, warSupportBp: 500 },
  },
  {
    id: "csk_defiance",
    icon: "shield",
    stats: { defensePct: 5, warSupportBp: 500 },
  },
  // ---- industry and science ----
  {
    id: "csk_arms_programme",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, outputPct: 5 },
  },
  { id: "csk_export_orders", icon: "globe", stats: { outputPct: 5 } },
  { id: "csk_czech_science", icon: "research", stats: { researchPct: 5 } },
  { id: "csk_aviation_pride", icon: "plane", stats: { rsAirPct: 10 } },
  { id: "csk_air_watch", icon: "tower", stats: { aaPct: 10 } },
  // ---- governments ----
  {
    id: "csk_democratic_defence",
    icon: "ballot",
    stats: { coupResistPct: 25, stabilityBp: 300 },
  },
  {
    id: "csk_second_republic",
    icon: "document",
    stats: { ppGainPct: 10, driftNeuBp: 5, warSupportBp: -500 },
  },
  {
    id: "csk_army_rule",
    icon: "medal",
    stats: { coupResistPct: 30, warSupportBp: 500, ppGainPct: -5 },
  },
  {
    id: "csk_national_front",
    icon: "fist",
    stats: { driftComBp: 5, stabilityBp: 500 },
  },
  {
    id: "csk_corporate_state",
    icon: "eagle_plain",
    stats: { driftFasBp: 5, outputPct: 5, stabilityBp: -300 },
  },
  // ---- the Danube and the war ----
  { id: "csk_danube_trade", icon: "ship", stats: { tradeCostPct: 10 } },
  {
    id: "csk_federal_union",
    icon: "globe",
    stats: { stabilityBp: -500, ppGainPct: 10, nonCoreManpowerPp: 10 },
  },
  {
    id: "csk_exile_government",
    icon: "radio",
    stats: { stabilityBp: 500, ppGainPct: 5 },
  },
];

export const CSK_PERSONS: PersonDef[] = [
  // ---- leaders (Beneš is the start leader, leader_csk) ----
  {
    id: "csk_hodza",
    nameKey: "ww1936.person.csk_hodza",
    country: "CSK",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    source:
      "en.wikipedia Milan Hodža: Agrarian, prime minister 1935-1938, author of a Danubian federation plan",
  },
  {
    id: "csk_sramek",
    nameKey: "ww1936.person.csk_sramek",
    country: "CSK",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["caretaker"],
    source:
      "en.wikipedia Jan Šrámek: leader of the People's Party, prime minister of the government in exile 1940-1945",
  },
  {
    id: "csk_beran",
    nameKey: "ww1936.person.csk_beran",
    country: "CSK",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["party_boss"],
    source:
      "en.wikipedia Rudolf Beran: Agrarian chairman, prime minister of the Second Republic 1938-1939, Party of National Unity",
  },
  {
    id: "csk_hacha",
    nameKey: "ww1936.person.csk_hacha",
    country: "CSK",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["caretaker"],
    source:
      "en.wikipedia Emil Hácha: president of the Supreme Administrative Court, president of the Republic 1938-1939",
  },
  {
    id: "csk_syrovy_p",
    nameKey: "ww1936.person.csk_syrovy_p",
    country: "CSK",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["generalissimo"],
    alsoGeneral: "csk_syrovy",
    source:
      "en.wikipedia Jan Syrový: general, prime minister of the government of national defence in the autumn of 1938",
  },
  {
    id: "csk_gottwald",
    nameKey: "ww1936.person.csk_gottwald",
    country: "CSK",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "en.wikipedia Klement Gottwald: general secretary of the Communist Party of Czechoslovakia from 1929",
  },
  {
    id: "csk_zapotocky",
    nameKey: "ww1936.person.csk_zapotocky",
    country: "CSK",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["popular_front"],
    source:
      "en.wikipedia Antonín Zápotocký: communist trade-union leader, deputy and senator in the First Republic",
  },
  {
    id: "csk_gajda",
    nameKey: "ww1936.person.csk_gajda",
    country: "CSK",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    source:
      "en.wikipedia Radola Gajda: legion general, leader of the National Fascist Community (NOF)",
  },
  {
    id: "csk_stribrny",
    nameKey: "ww1936.person.csk_stribrny",
    country: "CSK",
    roles: ["leader"],
    ideology: "fascist",
    leaderTraits: ["party_boss"],
    source:
      "en.wikipedia Jiří Stříbrný: founder of the National League, allied with Gajda's NOF in the 1930s",
  },
  // ---- advisors ----
  {
    id: "csk_krofta",
    nameKey: "ww1936.person.csk_krofta",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source: "en.wikipedia Kamil Krofta: historian, foreign minister 1936-1938",
  },
  {
    id: "csk_jan_masaryk",
    nameKey: "ww1936.person.csk_jan_masaryk",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["orator"] },
    source:
      "en.wikipedia Jan Masaryk: envoy in London 1925-1938, wartime BBC broadcaster and foreign minister in exile",
  },
  {
    id: "csk_machnik",
    nameKey: "ww1936.person.csk_machnik",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["hawk"] },
    source:
      "cs.wikipedia František Machník: Agrarian, minister of national defence 1935-1938",
  },
  {
    id: "csk_englis",
    nameKey: "ww1936.person.csk_englis",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Karel Engliš: economist, finance minister in the 1920s, governor of the National Bank 1934-1939",
  },
  {
    id: "csk_moravec",
    nameKey: "ww1936.person.csk_moravec",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    source:
      "en.wikipedia František Moravec: head of military intelligence from 1937, ran agent A-54 (Paul Thümmel)",
  },
  {
    id: "csk_krejci_adv",
    nameKey: "ww1936.person.csk_krejci_adv",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "csk_krejci",
    source: "en.wikipedia Ludvík Krejčí: Chief of the General Staff 1933-1939",
  },
  {
    id: "csk_husarek",
    nameKey: "ww1936.person.csk_husarek",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_construction"] },
    source:
      "cs.wikipedia Karel Husárek: general, headed the Fortification Works Directorate (ŘOP) from 1935",
  },
  {
    id: "csk_loevenstein",
    nameKey: "ww1936.person.csk_loevenstein",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source:
      "cs.wikipedia Karel Loevenstein: general director of the Škoda Works until his death in 1938",
  },
  {
    id: "csk_bata",
    nameKey: "ww1936.person.csk_bata",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    source:
      "en.wikipedia Jan Antonín Baťa: head of the Baťa company in Zlín from 1932",
  },
  {
    id: "csk_heyrovsky",
    nameKey: "ww1936.person.csk_heyrovsky",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Jaroslav Heyrovský: physical chemist at Charles University, inventor of polarography",
  },
  {
    id: "csk_fajfr",
    nameKey: "ww1936.person.csk_fajfr",
    country: "CSK",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_superiority"] },
    source:
      "cs.wikipedia Jaroslav Fajfr: general, commander of the Czechoslovak air force in the late 1930s",
  },
];
