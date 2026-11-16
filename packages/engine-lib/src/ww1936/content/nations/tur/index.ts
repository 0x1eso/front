// ww229 (design ww227): TUR's national content, tier A. How:
// /home/eser/dev/ww229-format.md. The tree is in focuses.ts, the rest in
// this folder's files; all data only. The old pack `tur` (focus/tur.ts) is
// rebuilt here under new ids; its events, spirits and the P3 Hatay decision
// still play.
import type { NationDef } from "../types";
import { TUR_DECISIONS } from "./decisions";
import { TUR_EVENTS } from "./events";
import { TUR_BRANCH_POINTS, TUR_FOCUSES, TUR_PATH } from "./focuses";
import { TUR_PERSONS } from "./persons";
import { TUR_SPIRITS } from "./spirits";

export const NATION_TUR: NationDef = {
  tag: "TUR",
  tier: "A",
  sheet: {
    situation:
      "A young republic of the single Republican People's Party under its founder, rebuilt by state-led plans after twelve years of war. It holds the Straits, asks to fortify them again, wants the Sanjak of Alexandretta from French Syria, and fears both the Soviet Union and Italy in the Dodecanese.",
    startSpirits: [
      "tur_kemalist_revolution",
      "tur_scars_of_war",
      "tur_eastern_unrest",
      "tur_ottoman_arsenal",
    ],
    dilemmas: [
      {
        branchPoint: "tur_bp_course",
        note: "Keep the single party, open to a liberal opposition, turn to a nationalist party-state or let the left in; history kept the single party until 1946.",
      },
      {
        branchPoint: "tur_bp_right",
        note: "Peker's party-state by law or the Turanist circles in the street; Peker was dismissed in 1936 and the Turanists tried in 1944.",
      },
      {
        branchPoint: "tur_bp_alignment",
        note: "The Anglo-French treaty or friendship with Germany; Turkey signed the treaty of 1939, then a friendship pact with Germany in 1941, and stayed out.",
      },
      {
        branchPoint: "tur_bp_frontiers",
        note: "Accept the frontiers or revive the National Pact's claims (Mosul, Aleppo, Western Thrace, the Dodecanese); history took only Hatay.",
      },
      {
        branchPoint: "tur_bp_doctrine",
        note: "A deep defensive army or the bayonet; the army prepared to defend Thrace and the Caucasus.",
      },
    ],
    mechanism:
      "The Straits under Montreux: refortify them, close them to belligerents' warships, levy dues or fortify the Dardanelles further, while the belligerents court Ankara; the Sanjak question (joint garrison, then the P3 cession); chromium sold to Britain or Germany.",
    patrons: ["GBR", "FRA"],
    rivals: ["ITA", "SUN"],
    unions: [],
    claims: [
      "hatay",
      "tur_mosul",
      "tur_aleppo",
      "tur_western_thrace",
      "tur_dodecanese",
      "tur_azerbaijan",
    ],
    people: [
      "tur_saydam",
      "tur_saracoglu",
      "tur_aras",
      "tur_menemencioglu",
      "tur_kaya",
      "tur_cakmak",
      "tur_gunduz",
      "tur_yucel",
      "tur_demirag",
      "tur_bayar",
      "tur_menderes",
      "tur_okyar",
      "tur_koprulu",
      "tur_peker",
      "tur_atsiz",
      "tur_sefik_husnu",
      "tur_kivilcimli",
      "tur_nazim_hikmet",
      "tur_omurtak",
      "tur_gurman",
      "tur_calislar",
      "tur_muglali",
      "tur_toydemir",
    ],
    equipment: [
      "tur_m1938_mauser",
      "tur_kayseri_p24",
      "tur_yavuz",
      "tur_hamidiye",
      "tur_kocatepe_class",
      "tur_demirhisar_class",
      "sun_t26_33",
    ],
  },
  // Design §8: neutral, London and Paris first; a nationalist turn is the
  // likeliest way out of history, the liberal one next.
  character: {
    lean: "neutral",
    patrons: ["GBR", "FRA"],
    routeBias: { fascist: 1, democratic: 2, communist: 1, neutral: 1 },
  },
  politics: {
    spirits: [
      "tur_kemalist_revolution",
      "tur_scars_of_war",
      "tur_eastern_unrest",
      "tur_ottoman_arsenal",
    ],
    leaders: {
      democratic: "tur_bayar",
      communist: "tur_sefik_husnu",
      fascist: "tur_peker",
      neutral: "leader_tur",
    },
  },
  focuses: TUR_FOCUSES,
  path: TUR_PATH,
  branchPoints: TUR_BRANCH_POINTS,
  events: TUR_EVENTS,
  decisions: TUR_DECISIONS,
  spirits: TUR_SPIRITS,
  persons: TUR_PERSONS,
  flags: [
    "tur_straits_sovereign",
    "tur_hatay_raised",
    "tur_hatay_garrisoned",
    "tur_balkan_partner",
    "tur_chromium_trade_open",
  ],
  groups: [
    // regions: Ninawa (Mosul), claimed by the National Pact of 1920
    { id: "tur_mosul", regions: [737], owner1936: "IRQ" },
    // regions: Aleppo
    { id: "tur_aleppo", regions: [729], owner1936: "FRA" },
    // regions: Anatoliki Makedonia kai Thraki (Western Thrace)
    { id: "tur_western_thrace", regions: [606], owner1936: "GRC" },
    // regions: Rhodes, Leros (the Italian Dodecanese)
    { id: "tur_dodecanese", regions: [1362, 1363], owner1936: "ITA" },
    // regions: Şəki, Bakı, Kəlbəcər, Salyan (Soviet Azerbaijan)
    { id: "tur_azerbaijan", regions: [602, 603, 645, 657], owner1936: "SUN" },
  ],
  claims: [],
  templates: [
    // The eastern mountain division: the frontier troops of Kars and
    // Erzurum, mountain infantry with pack artillery.
    {
      id: "tur_eastern_mountain_division",
      country: "TUR",
      battalions: ["mountain", "mountain", "mountain", "mountain", "artillery"],
      support: ["engineer", "recon"],
    },
  ],
  aliases: {},
  dropped: [],
};
