// World War 1936 P5 (spec §17.6, §19.3): history beats added to the P3 table,
// by date. A beat moves only an AI actor; a human country is never moved.
// Volunteers and lend-lease are effects beats (the amounts are this lane's:
// a month of 3,000 infantry equipment, 1,000 trucks, 100 fighters and 50
// convoys for the United Kingdom in 1941). Decision and effects beats retry
// for 30 days.
//
// Not beats here: the French armistice event (fired by the capitulation),
// the Casablanca, Tehran, Yalta and Potsdam conferences (date events in
// events/endgame.ts, so they also reach human hosts) and the Anglo-Soviet
// entry into Iran (already the P0 lines of 1941-08-25).
//
// P5 Phase B (pre-flight §0-7): an event beat whose event depends on a
// situation carries it as `when` (the event's trigger without its date and
// its human/historical-AI gate): the beat waits for it up to its window,
// then lapses. The events keep their option guards.
import { GRAND_COUNCIL_CRISIS } from "../events/ita";
import { T, all, any, flag, gflag, not } from "../helpers";
import type { HistoryBeat } from "../types";

export const BEATS_P5: HistoryBeat[] = [
  // ---- 1936-1937: Spain and China ----
  {
    id: "b19360801_deu_condor",
    date: "1936-08-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [
        { kind: "volunteers", to: T("ESN"), divisions: 1, planes: 100 },
      ],
    },
    windowDays: 30,
  },
  {
    id: "b19361015_sun_volunteers_esr",
    date: "1936-10-15",
    actor: "SUN",
    act: {
      kind: "effects",
      effects: [{ kind: "volunteers", to: T("ESR"), divisions: 1, planes: 80 }],
    },
    windowDays: 30,
  },
  {
    id: "b19361022_esr_international_brigades",
    date: "1936-10-22",
    actor: "ESR",
    act: { kind: "event", id: "esr_international_brigades" },
  },
  {
    id: "b19361215_ita_ctv",
    date: "1936-12-15",
    actor: "ITA",
    act: {
      kind: "effects",
      effects: [{ kind: "volunteers", to: T("ESN"), divisions: 4 }],
    },
    windowDays: 30,
  },
  {
    id: "b19371101_sun_volunteers_chn",
    date: "1937-11-01",
    actor: "SUN",
    act: {
      kind: "effects",
      effects: [{ kind: "volunteers", to: T("CHN"), planes: 100 }],
    },
    windowDays: 30,
  },

  // ---- 1939 ----
  {
    id: "b19390314_deu_svk_independence",
    date: "1939-03-14",
    actor: "DEU",
    act: { kind: "event", id: "svk_independence" },
  },
  {
    id: "b19391008_deu_annex_west_poland",
    date: "1939-10-08",
    actor: "DEU",
    act: { kind: "event", id: "deu_annex_west_poland" },
  },
  {
    id: "b19391010_sun_vilnius_to_lithuania",
    date: "1939-10-10",
    actor: "SUN",
    act: { kind: "event", id: "sun_vilnius_to_lithuania" },
  },
  {
    id: "b19391101_sun_annex_east_poland",
    date: "1939-11-01",
    actor: "SUN",
    act: { kind: "event", id: "sun_annex_east_poland" },
  },

  // ---- 1940 ----
  {
    id: "b19400330_jpn_nanjing_government",
    date: "1940-03-30",
    actor: "JPN",
    act: { kind: "event", id: "jpn_nanjing_government" },
    when: {
      kind: "occupied_by",
      group: "east_china_occupied",
      of: "self",
    },
  },
  {
    id: "b19400510_gbr_occupy_iceland",
    date: "1940-05-10",
    actor: "GBR",
    act: { kind: "decision", id: "gbr_occupy_iceland" },
    windowDays: 30,
  },
  {
    id: "b19400628_gbr_free_french_recognition",
    date: "1940-06-28",
    actor: "GBR",
    act: { kind: "decision", id: "gbr_free_french_recognition" },
    windowDays: 30,
  },
  {
    id: "b19400703_gbr_mers_el_kebir",
    date: "1940-07-03",
    actor: "GBR",
    act: { kind: "event", id: "gbr_mers_el_kebir" },
    when: all(
      { kind: "country_state", tag: "VIC", state: "active" },
      { kind: "navy_size", who: T("VIC"), min: 1 },
    ),
  },
  {
    id: "b19400826_fra_free_french_africa",
    date: "1940-08-26",
    actor: "FRA",
    act: { kind: "event", id: "fra_free_french_africa" },
    when: all(
      { kind: "is_exile" },
      { kind: "country_state", tag: "VIC", state: "active" },
    ),
  },
  {
    // The decision opens with the focus jpn_indochina_bases, which can finish
    // only after France falls; a 90-day window lets the beat wait for it.
    id: "b19400922_jpn_indochina_access_vic",
    date: "1940-09-22",
    actor: "JPN",
    act: { kind: "decision", id: "jpn_demand_indochina_access", target: "VIC" },
    windowDays: 90,
  },
  {
    id: "b19401128_tha_border_war",
    date: "1940-11-28",
    actor: "THA",
    act: { kind: "event", id: "tha_border_war" },
  },

  // ---- 1941 ----
  {
    // After the Lend-Lease Act (P3 usa_lend_lease_act, the same day).
    id: "b19410311_usa_ll_gbr",
    date: "1941-03-11",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [
        {
          kind: "lend_lease",
          to: T("GBR"),
          item: "infantry_equipment",
          perMonth: 3000,
        },
        { kind: "lend_lease", to: T("GBR"), item: "motorized", perMonth: 1000 },
        { kind: "lend_lease", to: T("GBR"), item: "fighter", perMonth: 100 },
        { kind: "lend_lease", to: T("GBR"), item: "convoy", perMonth: 50 },
      ],
    },
    windowDays: 30,
  },
  {
    id: "b19410401_irq_golden_square",
    date: "1941-04-01",
    actor: "IRQ",
    act: { kind: "event", id: "irq_golden_square" },
  },
  {
    id: "b19410410_deu_croatian_state",
    date: "1941-04-10",
    actor: "DEU",
    act: { kind: "event", id: "deu_croatian_state" },
  },
  {
    // The restoration of Ethiopia (spec §17.6 lists gen_restore_country; the
    // event below applies the same restore_country with its news).
    id: "b19410505_gbr_eth_restoration",
    date: "1941-05-05",
    actor: "GBR",
    act: { kind: "event", id: "eth_restoration" },
  },
  {
    id: "b19410506_usa_ll_chn",
    date: "1941-05-06",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [
        {
          kind: "lend_lease",
          to: T("CHN"),
          item: "infantry_equipment",
          perMonth: 1500,
        },
        { kind: "lend_lease", to: T("CHN"), item: "motorized", perMonth: 300 },
      ],
    },
    windowDays: 30,
  },
  {
    id: "b19410509_vic_tokyo_peace",
    date: "1941-05-09",
    actor: "VIC",
    act: { kind: "event", id: "tha_tokyo_peace" },
  },
  {
    id: "b19410531_irq_armistice",
    date: "1941-05-31",
    actor: "IRQ",
    act: { kind: "event", id: "irq_armistice" },
  },
  {
    id: "b19410608_gbr_levant_intervention",
    date: "1941-06-08",
    actor: "GBR",
    act: { kind: "decision", id: "gbr_levant_intervention" },
    windowDays: 30,
  },
  {
    // The Blue Division leaves Spain for the Eastern Front.
    id: "b19410713_esn_blue_division",
    date: "1941-07-13",
    actor: "ESN",
    act: {
      kind: "effects",
      effects: [{ kind: "volunteers", to: T("DEU"), divisions: 1 }],
    },
    windowDays: 30,
  },
  {
    id: "b19410718_sun_partisan_support",
    date: "1941-07-18",
    actor: "SUN",
    act: { kind: "decision", id: "gen_partisan_support" },
    windowDays: 30,
  },
  {
    id: "b19410726_usa_oil_embargo",
    date: "1941-07-26",
    actor: "USA",
    act: { kind: "decision", id: "usa_oil_embargo" },
    windowDays: 30,
  },
  {
    id: "b19410728_jpn_indochina_access_vic",
    date: "1941-07-28",
    actor: "JPN",
    act: { kind: "decision", id: "jpn_demand_indochina_access", target: "VIC" },
    windowDays: 30,
  },
  {
    // The American Volunteer Group, while the United States is neutral.
    id: "b19410801_usa_volunteers_chn",
    date: "1941-08-01",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [{ kind: "volunteers", to: T("CHN"), planes: 100 }],
    },
    windowDays: 30,
  },
  {
    id: "b19410821_gbr_ll_sun",
    date: "1941-08-21",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [
        { kind: "lend_lease", to: T("SUN"), item: "fighter", perMonth: 50 },
        { kind: "lend_lease", to: T("SUN"), item: "light_tank", perMonth: 100 },
      ],
    },
    windowDays: 30,
  },
  {
    id: "b19410829_irn_armistice",
    date: "1941-08-29",
    actor: "IRN",
    act: { kind: "event", id: "irn_armistice" },
  },
  {
    // The First Moscow Protocol.
    id: "b19411001_usa_ll_sun",
    date: "1941-10-01",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [
        { kind: "lend_lease", to: T("SUN"), item: "motorized", perMonth: 1500 },
        { kind: "lend_lease", to: T("SUN"), item: "fighter", perMonth: 100 },
        {
          kind: "lend_lease",
          to: T("SUN"),
          item: "medium_tank",
          perMonth: 100,
        },
        {
          kind: "lend_lease",
          to: T("SUN"),
          item: "support_equipment",
          perMonth: 300,
        },
      ],
    },
    windowDays: 30,
  },

  // ---- 1942 ----
  {
    id: "b19420101_usa_recognize_exiles",
    date: "1942-01-01",
    actor: "USA",
    act: { kind: "decision", id: "usa_recognize_exiles" },
    windowDays: 30,
  },
  {
    id: "b19421108_vic_torch",
    date: "1942-11-08",
    actor: "VIC",
    act: { kind: "event", id: "vic_torch" },
    when: any(
      {
        kind: "occupied_by",
        group: "french_north_africa",
        of: { factionLeaderOf: T("GBR") },
      },
      { kind: "occupied_by", group: "french_north_africa", of: T("USA") },
    ),
  },
  {
    id: "b19421111_deu_case_anton",
    date: "1942-11-11",
    actor: "DEU",
    act: { kind: "event", id: "deu_case_anton" },
    when: all(gflag("vic_torch_done"), {
      kind: "country_state",
      tag: "VIC",
      state: "active",
    }),
  },

  // ---- 1943 ----
  {
    id: "b19430725_ita_grand_council",
    date: "1943-07-25",
    actor: "ITA",
    act: { kind: "event", id: "ita_grand_council" },
    when: GRAND_COUNCIL_CRISIS,
  },
  {
    id: "b19430801_jpn_burma_state",
    date: "1943-08-01",
    actor: "JPN",
    act: { kind: "event", id: "jpn_burma_state" },
    when: all(
      { kind: "occupied_by", group: "burma", of: "self" },
      { kind: "country_state", tag: "BRM", state: "dormant" },
    ),
  },
  {
    id: "b19430829_deu_denmark_takeover",
    date: "1943-08-29",
    actor: "DEU",
    act: { kind: "event", id: "deu_denmark_takeover" },
  },
  {
    id: "b19430908_ita_armistice",
    date: "1943-09-08",
    actor: "ITA",
    act: { kind: "event", id: "ita_armistice" },
    when: all(
      flag("ita_july_25"),
      { kind: "days_since_flag_ge", flag: "ita_july_25", days: 45 },
      { kind: "same_faction", of: T("DEU") },
    ),
  },
  {
    id: "b19430923_deu_social_republic",
    date: "1943-09-23",
    actor: "DEU",
    act: { kind: "event", id: "deu_social_republic" },
  },
  {
    id: "b19431014_jpn_philippine_republic",
    date: "1943-10-14",
    actor: "JPN",
    act: { kind: "event", id: "jpn_philippine_republic" },
    when: all(
      { kind: "occupied_by", group: "philippines", of: "self" },
      any(
        { kind: "country_state", tag: "PHL", state: "dormant" },
        { kind: "country_state", tag: "PHL", state: "gone" },
      ),
    ),
  },

  // ---- 1944 ----
  {
    id: "b19440319_deu_occupy_hungary",
    date: "1944-03-19",
    actor: "DEU",
    act: { kind: "event", id: "deu_occupy_hungary" },
  },
  {
    id: "b19440801_pol_warsaw_uprising",
    date: "1944-08-01",
    actor: "POL",
    act: { kind: "event", id: "pol_warsaw_uprising" },
  },
  {
    id: "b19440819_fra_paris_uprising",
    date: "1944-08-19",
    actor: "FRA",
    act: { kind: "event", id: "fra_paris_uprising" },
    when: all(
      { kind: "is_exile" },
      not({ kind: "controls_group", group: "paris" }),
    ),
  },
  {
    id: "b19440823_rou_august_coup",
    date: "1944-08-23",
    actor: "ROU",
    act: { kind: "event", id: "rou_august_coup" },
  },
  {
    id: "b19440829_svk_national_uprising",
    date: "1944-08-29",
    actor: "SVK",
    act: { kind: "event", id: "svk_national_uprising" },
  },
  {
    // No P0 line covers it, unlike the Iranian war of 1941-08-25.
    id: "b19440905_sun_declare_bgr",
    date: "1944-09-05",
    actor: "SUN",
    act: { kind: "declare", target: "BGR" },
  },
  {
    id: "b19440909_bgr_fatherland_front",
    date: "1944-09-09",
    actor: "BGR",
    act: { kind: "event", id: "bgr_fatherland_front" },
  },
  {
    id: "b19440919_fin_moscow_armistice",
    date: "1944-09-19",
    actor: "FIN",
    act: { kind: "event", id: "fin_moscow_armistice" },
  },
  {
    id: "b19441015_hun_horthy_armistice",
    date: "1944-10-15",
    actor: "HUN",
    act: { kind: "event", id: "hun_horthy_armistice" },
  },

  // ---- 1945 ----
  {
    id: "b19450810_jpn_surrender_decision",
    date: "1945-08-10",
    actor: "JPN",
    act: { kind: "event", id: "jpn_surrender_decision" },
    when: all(
      { kind: "at_war_with", of: T("SUN") },
      { kind: "at_war_with", of: T("USA") },
      any(
        { kind: "lost_vp_ge", pct: 10 },
        { kind: "lost_vp_ge", who: T("MCK"), pct: 10 },
      ),
    ),
  },
];
