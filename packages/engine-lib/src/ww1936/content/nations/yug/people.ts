// ww229 (design ww227 §3, §5, §7): Yugoslavia's spirits (start, focus and
// the five balance-of-power bands), people, the mountain division and the
// region groups its claims name. Real people only, each with a source.
// Data only (ContentPurity).
import type {
  PersonDef,
  RegionGroupDef,
  SpiritDef,
  TemplateUnlockDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const YUG_SPIRITS: SpiritDef[] = [
  // ---- start ----
  {
    id: "yug_regency_council",
    icon: "crown",
    stats: { stabilityBp: 300, ppGainPct: -10 },
  },
  {
    id: "yug_croat_discontent",
    icon: "chain_broken",
    stats: { stabilityBp: -800, warSupportBp: -500 },
  },
  {
    id: "yug_peasant_economy",
    icon: "wheat",
    stats: { civConstructionPct: -10, manpowerGrowthPct: 10 },
  },
  {
    id: "yug_salonika_veterans",
    icon: "medal",
    stats: { infDefensePct: 5, divXpGainPct: 5 },
  },
  // ---- the balance of power (Serb centralism − … + Croat autonomy) ----
  {
    id: "bop_yug_serb_hegemony",
    icon: "shield",
    stats: { stabilityBp: -1000, warSupportBp: 500, coupResistPct: 10 },
  },
  {
    id: "bop_yug_centralism",
    icon: "shield",
    stats: { stabilityBp: -400, ppGainPct: 5 },
  },
  {
    id: "bop_yug_concessions",
    icon: "handshake",
    stats: { stabilityBp: 400, warSupportBp: -300 },
  },
  {
    id: "bop_yug_federal_kingdom",
    icon: "scales",
    stats: { stabilityBp: 800, warSupportBp: -800, coupResistPct: -10 },
  },
  // ---- focuses, events and decisions ----
  { id: "yug_jrz_machine", icon: "ballot", stats: { ppGainPct: 10 } },
  {
    id: "yug_prudent_regency",
    icon: "scales",
    stats: { stabilityWeeklyBp: 20, enemyJustifyTimePct: 10 },
  },
  { id: "yug_zbor_guard", icon: "flag", stats: { driftFasBp: 10 } },
  { id: "yug_opposition_bloc", icon: "ballot", stats: { driftDemBp: 10 } },
  { id: "yug_kpj_cells", icon: "fist", stats: { driftComBp: 10 } },
  {
    id: "yug_sporazum_spirit",
    icon: "handshake",
    stats: { stabilityBp: 500, recruitablePct: 5 },
  },
  {
    id: "yug_federal_compromise",
    icon: "scales",
    stats: { stabilityBp: 500, ppGainPct: 5 },
  },
  {
    id: "yug_gendarmerie",
    icon: "shield",
    stats: { coupResistPct: 15, stabilityBp: -300, resistanceTargetPct: -10 },
  },
  {
    id: "yug_neutral_kingdom",
    icon: "dove",
    stats: { enemyJustifyTimePct: 25, warSupportBp: -300 },
  },
  {
    id: "yug_investment_drive",
    icon: "industry",
    stats: { civConstructionPct: 10, milConstructionPct: 10 },
  },
  {
    id: "yug_chetnik_detachments",
    icon: "sword",
    stats: { forestDefensePct: 10, infAttackPct: 3, recoveryPct: 5 },
  },
  {
    id: "yug_redoubt_spirit",
    icon: "tower",
    stats: { fortDefPerLevelBp: 200, infDefensePct: 5 },
  },
  {
    id: "yug_guerrilla_war",
    icon: "sword",
    stats: { infDefensePct: 5, supplyUsePct: -10, warSupportBp: 500 },
  },
  {
    id: "yug_clearing_trade",
    icon: "rail",
    stats: { tradeCostPct: -15, consumerGoodsPp: 1 },
  },
  {
    id: "yug_copper_exports",
    icon: "mine",
    stats: { ppGainPct: 5, outputPct: 3 },
  },
  {
    id: "yug_bauxite_exports",
    icon: "mine",
    stats: { tradeCostPct: -10, ppGainPct: 3 },
  },
];

export const YUG_PERSONS: PersonDef[] = [
  // ---- leaders and advisors ----
  {
    id: "yug_stojadinovic",
    nameKey: "ww1936.person.yug_stojadinovic",
    country: "YUG",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    leaderTraits: ["strongman"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source:
      "en.wikipedia Milan Stojadinović: Prime Minister 1935-1939, leader of the Yugoslav Radical Union, an economist",
  },
  {
    id: "yug_cvetkovic",
    nameKey: "ww1936.person.yug_cvetkovic",
    country: "YUG",
    roles: ["leader", "advisor"],
    ideology: "neutral",
    leaderTraits: ["caretaker"],
    advisor: { slot: "political", traits: ["conciliator"] },
    source:
      "en.wikipedia Dragiša Cvetković: Prime Minister 1939-1941, signed the Cvetković-Maček Agreement",
  },
  {
    id: "yug_subasic",
    nameKey: "ww1936.person.yug_subasic",
    country: "YUG",
    roles: ["leader", "advisor"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    advisor: { slot: "political", traits: ["administrator"] },
    source:
      "en.wikipedia Ivan Šubašić: Croatian Peasant Party, Ban of Croatia 1939-1941, Prime Minister in exile 1944",
  },
  {
    id: "yug_grol",
    nameKey: "ww1936.person.yug_grol",
    country: "YUG",
    roles: ["leader"],
    ideology: "democratic",
    leaderTraits: ["reformer"],
    source:
      "en.wikipedia Milan Grol: leader of the Democratic Party in the united opposition of the late 1930s",
  },
  {
    id: "yug_tito",
    nameKey: "ww1936.person.yug_tito",
    country: "YUG",
    roles: ["leader"],
    ideology: "communist",
    leaderTraits: ["party_boss"],
    source:
      "en.wikipedia Josip Broz Tito: led the Communist Party of Yugoslavia from 1937 (general secretary 1939)",
  },
  {
    id: "yug_kardelj",
    nameKey: "ww1936.person.yug_kardelj",
    country: "YUG",
    roles: ["advisor"],
    ideology: "communist",
    advisor: { slot: "political", traits: ["party_ideologue"] },
    source:
      "en.wikipedia Edvard Kardelj: Slovene communist, member of the party leadership from 1937",
  },
  {
    id: "yug_ljotic",
    nameKey: "ww1936.person.yug_ljotic",
    country: "YUG",
    roles: ["leader", "advisor"],
    ideology: "fascist",
    leaderTraits: ["strongman"],
    advisor: { slot: "political", traits: ["propagandist"] },
    source:
      "en.wikipedia Dimitrije Ljotić: founded the Yugoslav National Movement (Zbor) in 1935, minister of justice 1931",
  },
  // ---- advisors ----
  {
    id: "yug_korosec",
    nameKey: "ww1936.person.yug_korosec",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["administrator"] },
    until: "1940-12-14",
    source:
      "en.wikipedia Anton Korošec: Slovene People's Party leader, Minister of the Interior 1935-1938; died December 1940",
  },
  {
    id: "yug_cincar_markovic",
    nameKey: "ww1936.person.yug_cincar_markovic",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source:
      "en.wikipedia Aleksandar Cincar-Marković: Minister of Foreign Affairs 1939-1941, minister in Berlin before that",
  },
  {
    id: "yug_acimovic",
    nameKey: "ww1936.person.yug_acimovic",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["security_chief"] },
    source:
      "en.wikipedia Milan Aćimović: chief of the Belgrade police, Minister of the Interior 1938-1939",
  },
  {
    id: "yug_vajfert",
    nameKey: "ww1936.person.yug_vajfert",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_resources"] },
    until: "1937-09-12",
    source:
      "en.wikipedia Đorđe Vajfert: industrialist (mines, Pančevo brewery), governor of the National Bank; died 1937",
  },
  {
    id: "yug_milankovic",
    nameKey: "ww1936.person.yug_milankovic",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source:
      "en.wikipedia Milutin Milanković: mathematician and climate scientist, professor at the University of Belgrade",
  },
  {
    id: "yug_nedic_adv",
    nameKey: "ww1936.person.yug_nedic_adv",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_defense"] },
    alsoGeneral: "yug_nedic",
    source:
      "en.wikipedia Milan Nedić: Chief of the General Staff 1934-1935, Minister of the Army and Navy 1939-1940",
  },
  {
    id: "yug_pesic_adv",
    nameKey: "ww1936.person.yug_pesic_adv",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    alsoGeneral: "yug_pesic",
    source:
      "en.wikipedia Petar Pešić: Chief of the General Staff, Minister of the Army and Navy 1940-1941",
  },
  {
    id: "yug_simovic_adv",
    nameKey: "ww1936.person.yug_simovic_adv",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_air_defense"] },
    alsoGeneral: "simovic",
    source:
      "en.wikipedia Dušan Simović: commander of the Royal Yugoslav Air Force from 1936, Prime Minister after the March 1941 coup",
  },
  {
    id: "yug_polic",
    nameKey: "ww1936.person.yug_polic",
    country: "YUG",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_escort"] },
    source:
      "en.wikipedia Royal Yugoslav Navy: Vice Admiral Marijan Polić, its commander in the April War",
  },
];

export const YUG_TEMPLATES: TemplateUnlockDef[] = [
  // yug_mountain_warfare: six mountain battalions and two mountain-gun
  // battalions, like the Royal Army's mountain brigades (width 18).
  {
    id: "yug_mountain_division",
    country: "YUG",
    battalions: [
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "mountain",
      "artillery",
      "artillery",
    ],
    support: [],
  },
];

export const YUG_GROUPS: RegionGroupDef[] = [
  // regions: Zara (the Italian enclave on the Dalmatian coast)
  { id: "yug_zara", regions: [534], owner1936: "ITA" },
  // regions: Kentriki Makedonia (Salonika, the outlet to the Aegean)
  { id: "yug_salonika", regions: [614], owner1936: "GRC" },
  // regions: Tiranë (all of Albania on the map)
  { id: "yug_albania", regions: [577], owner1936: "ALB" },
  // regions: Kärnten (Carinthia, on the Karawanks border)
  { id: "yug_carinthia", regions: [434], owner1936: "AUT" },
];
