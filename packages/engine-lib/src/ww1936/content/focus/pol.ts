// World War 1936 P6 — the Polish pack `pol` (spec §11.6, 22 focuses). Poland
// keeps the generic tree except gen_pol_claims (content/packs.ts); the pack's
// Zaolzie focus opens the P3 decision instead. Columns: industry 20–23, army
// 24–27, the Cipher Bureau 29, diplomacy 31–33, and below them (rows 3–5) the
// focuses of the government in exile. Facts only: no occupation crimes are
// focuses (§24). Region groups sandomierz, polish_silesia and gdynia are K5
// requests (lane report); warsaw is the P5 group. Data only (ContentPurity).
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, done, fire, not } from "../helpers";

export const POL_FOCUSES: FocusDef[] = [
  // ---- industry ----
  {
    id: "pol_central_district",
    tree: "pol",
    x: 20,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "industry",
    effects: [
      {
        kind: "build",
        where: { best: 2, of: "sandomierz" },
        building: "civ",
        count: 2,
      },
      {
        kind: "build",
        where: { best: 1, of: "sandomierz" },
        building: "mil",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_steelworks",
    tree: "pol",
    x: 20,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "steel",
    prereq: [["pol_central_district"]],
    effects: [
      {
        kind: "build",
        where: { best: 2, of: "sandomierz" },
        building: "mil",
        count: 2,
      },
      {
        kind: "resource",
        where: { best: 1, of: "sandomierz" },
        res: "steel",
        amount: 2,
      },
    ],
    ai: { base: 10 },
  },
  {
    // The Silesia–Gdynia coal line.
    id: "pol_coal_trunk",
    tree: "pol",
    x: 21,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "rail",
    prereq: [["pol_central_district"]],
    effects: [
      { kind: "rail", where: { group: "polish_silesia" }, amount: 1 },
      { kind: "rail", where: { group: "gdynia" }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_defense_fund",
    tree: "pol",
    x: 22,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    prereq: [["pol_central_district"]],
    effects: [
      { kind: "pp", amount: 50 },
      { kind: "war_support", pct: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_gdynia",
    tree: "pol",
    x: 22,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    effects: [
      {
        kind: "build",
        where: { group: "gdynia" },
        building: "naval_base",
        count: 1,
      },
      { kind: "build", where: { group: "gdynia" }, building: "dock", count: 1 },
      { kind: "add_spirit", id: "pol_gdynia_trade" },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_aviation",
    tree: "pol",
    x: 23,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    effects: [
      { kind: "equipment", type: "fighter", gen: 1, count: 60 },
      { kind: "research_bonus", branch: "air", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },

  // ---- army ----
  {
    id: "pol_six_year_plan",
    tree: "pol",
    x: 25,
    y: 0,
    days: 70,
    branch: "army",
    icon: "document",
    effects: [
      { kind: "army_xp", amount: 30 },
      { kind: "research_bonus", branch: "infantry", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // Poland built light tanks from 1935; without light_tank_1 the P2 template
    // check would refuse the brigade, so the focus grants it (lane report).
    id: "pol_armored_brigades",
    tree: "pol",
    x: 24,
    y: 1,
    days: 70,
    branch: "army",
    icon: "tank",
    prereq: [["pol_six_year_plan"]],
    effects: [
      { kind: "research_bonus", branch: "armour", pct: 100, uses: 1 },
      { kind: "add_tech", tech: "light_tank_1" },
      { kind: "unlock_template", template: "pol_armored_cavalry" },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_cavalry",
    tree: "pol",
    x: 25,
    y: 1,
    days: 35,
    branch: "army",
    icon: "sword",
    prereq: [["pol_six_year_plan"]],
    effects: [{ kind: "add_spirit", id: "pol_cavalry_drill" }],
    ai: { base: 10 },
  },
  {
    id: "pol_west_wall",
    tree: "pol",
    x: 26,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["pol_six_year_plan"]],
    effects: [
      { kind: "fort", where: { borderWith: T("DEU"), n: 4 }, amount: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_east_wall",
    tree: "pol",
    x: 27,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["pol_six_year_plan"]],
    effects: [
      { kind: "fort", where: { borderWith: T("SUN"), n: 3 }, amount: 2 },
    ],
    ai: { base: 10 },
  },

  // ---- the Cipher Bureau ----
  {
    id: "pol_cipher_bureau",
    tree: "pol",
    x: 29,
    y: 0,
    days: 70,
    branch: "research",
    icon: "radio",
    effects: [
      { kind: "agency", upgrade: "ag_crypto_1" },
      { kind: "decrypt", on: T("DEU"), pm: 300 },
    ],
    ai: { base: 10 },
  },
  {
    // The hidden spirit pol_enigma_shared marks the sharing, so the 1939
    // event pol_pyry_meeting and this focus never give it twice.
    id: "pol_share_enigma",
    tree: "pol",
    x: 29,
    y: 1,
    days: 35,
    branch: "diplomacy",
    icon: "radio",
    prereq: [["pol_cipher_bureau"]],
    available: all(
      { kind: "guaranteed_by", of: T("GBR") },
      { kind: "guaranteed_by", of: T("FRA") },
    ),
    bypass: { kind: "has_spirit", id: "pol_enigma_shared" },
    effects: [
      { kind: "add_spirit", id: "pol_enigma_shared" },
      { kind: "decrypt", who: T("GBR"), on: T("DEU"), pm: 300 },
      { kind: "decrypt", who: T("FRA"), on: T("DEU"), pm: 300 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 30, days: 365 },
    ],
    ai: { base: 10 },
  },

  // ---- diplomacy ----
  {
    // Keeps the two non-aggression pacts of 1932 and 1934: a lapsed one is
    // offered again.
    id: "pol_balance",
    tree: "pol",
    x: 31,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "scales",
    exclusive: ["pol_intermarium"],
    effects: [
      {
        kind: "if",
        cond: all(
          { kind: "exists", who: T("DEU") },
          not({ kind: "nap_with", of: T("DEU") }),
          not({ kind: "at_war_with", of: T("DEU") }),
        ),
        then: [fire("gen_diplo_nap", T("DEU"))],
      },
      {
        kind: "if",
        cond: all(
          { kind: "exists", who: T("SUN") },
          not({ kind: "nap_with", of: T("SUN") }),
          not({ kind: "at_war_with", of: T("SUN") }),
        ),
        then: [fire("gen_diplo_nap", T("SUN"))],
      },
      { kind: "add_spirit", id: "pol_balanced_course" },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_intermarium",
    tree: "pol",
    x: 33,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    exclusive: ["pol_balance"],
    available: not({ kind: "in_faction" }),
    effects: [
      { kind: "set_flag", flag: "can_create_faction" },
      { kind: "create_faction", name: "intermarium" },
      { kind: "invite", of: T("ROU") },
      { kind: "invite", of: T("HUN") },
      { kind: "invite", of: T("EST") },
      { kind: "invite", of: T("LVA") },
      { kind: "invite", of: T("LTU") },
      { kind: "invite", of: T("YUG") },
    ],
    ai: { base: 5 },
  },
  {
    // "British and French guarantee events weigh double": the British
    // guarantee decision (P3) opens for London at once, and both capitals
    // warm to Warsaw (lane report, approximations).
    id: "pol_seek_guarantees",
    tree: "pol",
    x: 32,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "document",
    prereq: [["pol_balance", "pol_intermarium"]],
    effects: [
      { kind: "unlock_decision", who: T("GBR"), id: "gbr_guarantee_poland" },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 20, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_zaolzie",
    tree: "pol",
    x: 31,
    y: 1,
    days: 35,
    branch: "diplomacy",
    icon: "map",
    prereq: [["pol_balance"]],
    effects: [{ kind: "unlock_decision", id: "pol_zaolzie_ultimatum" }],
    ai: { base: 10 },
  },

  // ---- the government in exile ----
  {
    id: "pol_forces_west",
    tree: "pol",
    x: 33,
    y: 3,
    days: 70,
    branch: "army",
    icon: "flag",
    available: { kind: "is_exile" },
    effects: [
      { kind: "manpower", amount: 20000 },
      {
        kind: "divisions",
        template: "pol_exile_infantry",
        count: 4,
        where: "capital",
      },
      { kind: "equipment", type: "fighter", gen: 1, count: 40 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_home_army",
    tree: "pol",
    x: 32,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "shield",
    prereq: [["pol_forces_west"]],
    effects: [
      { kind: "add_spirit", id: "pol_home_army_support" },
      {
        kind: "if",
        cond: { kind: "occupied_by", group: "warsaw", of: T("DEU") },
        then: [{ kind: "intel_network", on: T("DEU"), pm: 300 }],
      },
      {
        kind: "if",
        cond: { kind: "occupied_by", group: "warsaw", of: T("SUN") },
        then: [{ kind: "intel_network", on: T("SUN"), pm: 300 }],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_uprising",
    tree: "pol",
    x: 32,
    y: 5,
    days: 70,
    branch: "army",
    icon: "fist",
    prereq: [["pol_home_army"]],
    effects: [{ kind: "unlock_decision", id: "pol_uprising" }],
    ai: { base: 10 },
  },
  {
    id: "pol_eastern_army",
    tree: "pol",
    x: 34,
    y: 4,
    days: 70,
    branch: "army",
    icon: "infantry",
    prereq: [["pol_forces_west"]],
    available: { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
    effects: [
      {
        kind: "divisions",
        template: "pol_exile_infantry",
        count: 3,
        where: "capital",
      },
    ],
    ai: { base: 10 },
  },
  {
    // "The capital is back": Warsaw's region held again after the exile.
    id: "pol_restoration",
    tree: "pol",
    x: 34,
    y: 3,
    days: 105,
    branch: "politics",
    icon: "flag",
    available: all(done("pol_forces_west"), not({ kind: "is_exile" }), {
      kind: "controls_capital_of",
      of: "self",
    }),
    effects: [
      { kind: "stability", pct: 15 },
      { kind: "build", where: { best: 2 }, building: "civ", count: 2 },
    ],
    ai: { base: 10 },
  },
];

/**
 * The history path (spec §11.1): the Central Industrial District and the army
 * plan first, the Cipher Bureau, the balance between Berlin and Moscow with
 * Zaolzie and the Western guarantees, the generic tree around them (its own
 * ideology focus, no regional league), and the exile focuses, which wait
 * until Poland is a government in exile (the focus AI skips what it cannot
 * take).
 */
export const POL_PATH: FocusId[] = [
  "pol_central_district",
  "pol_six_year_plan",
  "pol_balance",
  "pol_cipher_bureau",
  "gen_ind_survey",
  "pol_gdynia",
  "pol_steelworks",
  "pol_armored_brigades",
  "gen_ind_civ_1",
  "pol_zaolzie",
  "pol_aviation",
  "pol_cavalry",
  "pol_defense_fund",
  "pol_seek_guarantees",
  "pol_share_enigma",
  "pol_west_wall",
  "pol_coal_trunk",
  "pol_forces_west",
  "pol_home_army",
  "pol_eastern_army",
  "pol_uprising",
  "pol_restoration",
  "gen_ind_mil_1",
  "gen_ind_infra",
  "gen_pol_unity",
  "@ideo",
  "gen_rs_1",
  "gen_army_reform",
  "gen_ind_civ_2",
  "gen_ind_mil_2",
  "gen_army_infantry",
  "gen_army_artillery",
  "pol_east_wall",
  "gen_ind_resources",
  "gen_pol_admin",
  "gen_army_doctrine",
  "gen_army_fort",
  "gen_rs_2",
  "gen_pol_defence_spirit",
  "gen_army_staff",
  "gen_air_force",
  "gen_navy_yards",
  "gen_air_bases",
  "gen_navy_coast",
];

export const POL_BRANCHES: BranchPoint[] = [
  {
    id: "pol_course",
    historical: "pol_balance",
    alternatives: ["pol_intermarium"],
    political: true,
  },
];
