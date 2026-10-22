// World War 1936 P6 (spec §11.2): the Nationalist government pack, 30
// focuses in the spec table's order, on the pack columns 20-35. Grid,
// left to right: army (20-22), the united-front question (24-25), the
// regional cliques (26-28), the economy (29-30), the move inland and
// foreign aid (31-33), air and river (34-35).
//
// Region groups: jiangsu_zhejiang, yangtze_estuary, china_east_coast,
// sichuan, yunnan, canton_hankou_line and the five clique groups (guangxi,
// yunnan, shanxi_suiyuan, ma_northwest, xinjiang) are requested from K5
// (lane K1 report); manchuria and kwantung are P5's. No line targets or
// draws on a region of Korea or Taiwan (spec §24-3).
//
// chn_unification counts the cliques China holds through owns_group (a flag
// holds no number): any three of the five clique groups.
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, fire, not, T } from "../helpers";

const OWNS_GXC: Condition = { kind: "owns_group", group: "guangxi" };
const OWNS_YUN: Condition = { kind: "owns_group", group: "yunnan" };
const OWNS_SXI: Condition = { kind: "owns_group", group: "shanxi_suiyuan" };
const OWNS_XBM: Condition = { kind: "owns_group", group: "ma_northwest" };
const OWNS_SIK: Condition = { kind: "owns_group", group: "xinjiang" };
/** Three or more of the five cliques are China's (the ten triples). */
const THREE_CLIQUES_HELD: Condition = any(
  all(OWNS_GXC, OWNS_YUN, OWNS_SXI),
  all(OWNS_GXC, OWNS_YUN, OWNS_XBM),
  all(OWNS_GXC, OWNS_YUN, OWNS_SIK),
  all(OWNS_GXC, OWNS_SXI, OWNS_XBM),
  all(OWNS_GXC, OWNS_SXI, OWNS_SIK),
  all(OWNS_GXC, OWNS_XBM, OWNS_SIK),
  all(OWNS_YUN, OWNS_SXI, OWNS_XBM),
  all(OWNS_YUN, OWNS_SXI, OWNS_SIK),
  all(OWNS_YUN, OWNS_XBM, OWNS_SIK),
  all(OWNS_SXI, OWNS_XBM, OWNS_SIK),
);

export const CHN_FOCUSES: FocusDef[] = [
  {
    id: "chn_central_army",
    tree: "chn",
    x: 21,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    effects: [
      { kind: "army_xp", amount: 25 },
      { kind: "unlock_template", template: "chn_trained_division" },
    ],
    ai: { base: 10 },
  },
  {
    // The German advisory mission left in mid-1938; at war with Germany
    // there is no one to send it.
    id: "chn_foreign_advisors",
    tree: "chn",
    x: 20,
    y: 1,
    days: 70,
    branch: "army",
    icon: "compass",
    prereq: [["chn_central_army"]],
    bypass: { kind: "at_war_with", of: T("DEU") },
    effects: [{ kind: "add_spirit", id: "chn_advisor_training", days: 720 }],
    ai: { base: 10 },
  },
  {
    id: "chn_yangtze_line",
    tree: "chn",
    x: 21,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["chn_central_army"]],
    effects: [
      { kind: "fort", where: { group: "jiangsu_zhejiang" }, amount: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_currency",
    tree: "chn",
    x: 27,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "scales",
    effects: [
      { kind: "pp", amount: 50 },
      { kind: "stability", pct: 5 },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_new_life",
    tree: "chn",
    x: 24,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    prereq: [["chn_currency"]],
    effects: [
      { kind: "stability", pct: 5 },
      { kind: "war_support", pct: 5 },
    ],
    ai: { base: 10 },
  },
  {
    // Ends a running war with the Communists first, then the pact; the
    // Communists answer through chn_united_front_offer.
    id: "chn_united_front",
    tree: "chn",
    x: 24,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "handshake",
    prereq: [["chn_new_life"]],
    exclusive: ["chn_bandit_suppression"],
    bypass: not(exists("CCP")),
    effects: [
      {
        kind: "if",
        cond: { kind: "at_war_with", of: T("CCP") },
        then: [{ kind: "end_war", of: T("CCP") }],
      },
      { kind: "nap", of: T("CCP") },
      { kind: "add_spirit", id: "chn_anti_japan_solidarity" },
      fire("chn_united_front_offer", T("CCP")),
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_bandit_suppression",
    tree: "chn",
    x: 25,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "sword",
    prereq: [["chn_new_life"]],
    exclusive: ["chn_united_front"],
    bypass: not(exists("CCP")),
    effects: [
      { kind: "war_goal", on: T("CCP"), type: "conquer" },
      { kind: "army_xp", amount: 20 },
    ],
    ai: { base: 5 },
  },
  {
    // Each integration focus opens the same targeted decision and marks its
    // clique as a target (the decision reads focus_done of the decider).
    id: "chn_integrate_guangxi",
    tree: "chn",
    x: 27,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "flag",
    prereq: [["chn_currency"]],
    bypass: not(exists("GXC")),
    effects: [{ kind: "unlock_decision", id: "chn_integrate_warlord" }],
    ai: { base: 10 },
  },
  {
    id: "chn_integrate_yunnan",
    tree: "chn",
    x: 26,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "flag",
    prereq: [["chn_integrate_guangxi"]],
    bypass: not(exists("YUN")),
    effects: [{ kind: "unlock_decision", id: "chn_integrate_warlord" }],
    ai: { base: 10 },
  },
  {
    id: "chn_integrate_shanxi",
    tree: "chn",
    x: 28,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "flag",
    prereq: [["chn_integrate_guangxi"]],
    bypass: not(exists("SXI")),
    effects: [{ kind: "unlock_decision", id: "chn_integrate_warlord" }],
    ai: { base: 10 },
  },
  {
    id: "chn_integrate_northwest",
    tree: "chn",
    x: 27,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "flag",
    prereq: [["chn_integrate_yunnan"], ["chn_integrate_shanxi"]],
    bypass: not(any(exists("XBM"), exists("SIK"))),
    effects: [{ kind: "unlock_decision", id: "chn_integrate_warlord" }],
    ai: { base: 10 },
  },
  {
    // The coast holds three civilian factories and one arsenal in 1936
    // (Shanghai, Jiangsu, Guangdong; Shandong): "four factories".
    id: "chn_inland_move",
    tree: "chn",
    x: 32,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    effects: [
      {
        kind: "move_buildings",
        from: { group: "china_east_coast" },
        to: { group: "sichuan" },
        building: "civ",
        count: 3,
      },
      {
        kind: "move_buildings",
        from: { group: "china_east_coast" },
        to: { group: "sichuan" },
        building: "mil",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_chongqing",
    tree: "chn",
    x: 31,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "tower",
    prereq: [["chn_inland_move"]],
    effects: [
      { kind: "add_spirit", id: "chn_provisional_capital" },
      { kind: "infra", where: { group: "sichuan" }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // The road reaches Burma through Yunnan; the P5 land route of
    // lend-lease already runs through any country not at war, so the road
    // needs no route effect of its own.
    id: "chn_burma_road",
    tree: "chn",
    x: 32,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "road",
    prereq: [["chn_inland_move"]],
    effects: [
      { kind: "infra", where: { group: "yunnan" }, amount: 2 },
      { kind: "opinion", of: T("GBR"), value: 20, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    // Two arsenals in Sichuan; the third in Yunnan when China holds it,
    // otherwise in Sichuan too.
    id: "chn_arsenals",
    tree: "chn",
    x: 33,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    prereq: [["chn_inland_move"]],
    effects: [
      {
        kind: "build",
        where: { best: 2, of: "sichuan" },
        building: "mil",
        count: 2,
      },
      {
        kind: "if",
        cond: { kind: "controls_group", group: "yunnan" },
        then: [
          {
            kind: "build",
            where: { best: 1, of: "yunnan" },
            building: "mil",
            count: 1,
          },
        ],
        else: [
          {
            kind: "build",
            where: { best: 1, of: "sichuan" },
            building: "mil",
            count: 1,
          },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_light_industry",
    tree: "chn",
    x: 29,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    prereq: [["chn_currency"]],
    effects: [{ kind: "build", where: { best: 2 }, building: "civ", count: 2 }],
    ai: { base: 10 },
  },
  {
    id: "chn_canton_hankou",
    tree: "chn",
    x: 29,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "rail",
    prereq: [["chn_light_industry"]],
    effects: [
      { kind: "rail", where: { group: "canton_hankou_line" }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // The pact goes through the P3 offer (the Soviet Union answers).
    id: "chn_soviet_aid",
    tree: "chn",
    x: 24,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["chn_united_front"]],
    effects: [
      {
        kind: "if",
        cond: not({ kind: "nap_with", of: T("SUN") }),
        then: [fire("gen_diplo_nap", T("SUN"))],
      },
      { kind: "unlock_decision", id: "chn_request_soviet_aid" },
      { kind: "equipment", type: "fighter", gen: 1, count: 100 },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_us_aid",
    tree: "chn",
    x: 32,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    prereq: [["chn_burma_road"]],
    available: exists("USA"),
    effects: [
      fire("gen_diplo_lend_lease", T("USA")),
      fire("chn_flying_tigers", T("USA")),
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_trade_space",
    tree: "chn",
    x: 21,
    y: 2,
    days: 70,
    branch: "army",
    icon: "shield",
    prereq: [["chn_yangtze_line"]],
    effects: [{ kind: "add_spirit", id: "chn_protracted_war" }],
    ai: { base: 10 },
  },
  {
    id: "chn_guerrilla_zones",
    tree: "chn",
    x: 21,
    y: 3,
    days: 70,
    branch: "army",
    icon: "map",
    prereq: [["chn_trade_space"]],
    effects: [
      { kind: "add_spirit", id: "chn_occupied_resistance" },
      { kind: "intel_network", on: T("JPN"), pm: 200 },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_expeditionary",
    tree: "chn",
    x: 33,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    prereq: [["chn_us_aid"]],
    effects: [
      { kind: "unlock_template", template: "chn_expeditionary_division" },
      {
        kind: "divisions",
        template: "chn_expeditionary_division",
        count: 6,
        where: "capital",
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_air_commission",
    tree: "chn",
    x: 34,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    effects: [
      { kind: "research_bonus", branch: "air", pct: 100, uses: 1 },
      {
        kind: "build",
        where: { group: "sichuan" },
        building: "air_base",
        count: 2,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_river_fleet",
    tree: "chn",
    x: 35,
    y: 0,
    days: 35,
    branch: "navy",
    icon: "ship",
    effects: [
      {
        kind: "build",
        where: { group: "yangtze_estuary" },
        building: "coastal_fort",
        count: 2,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_officer_academy",
    tree: "chn",
    x: 22,
    y: 1,
    days: 70,
    branch: "army",
    icon: "medal",
    prereq: [["chn_central_army"]],
    effects: [
      { kind: "add_general" },
      { kind: "add_general" },
      { kind: "add_spirit", id: "chn_officer_corps" },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_conscription",
    tree: "chn",
    x: 22,
    y: 2,
    days: 70,
    branch: "army",
    icon: "document",
    prereq: [["chn_officer_academy"]],
    effects: [{ kind: "law_step", law: "conscription", steps: 1 }],
    ai: { base: 10 },
  },
  {
    // "The Allied joining decision without the tension condition": the P3
    // decision gen_join_allies opens, and the request goes out at once
    // (its own condition would wait for world tension 20%).
    id: "chn_great_power",
    tree: "chn",
    x: 32,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "star_plain",
    prereq: [["chn_us_aid"], ["chn_expeditionary"]],
    effects: [
      { kind: "unlock_decision", id: "gen_join_allies" },
      {
        kind: "if",
        cond: all(not({ kind: "in_faction" }), {
          kind: "in_faction",
          who: T("GBR"),
        }),
        then: [
          fire("gen_diplo_faction_request", { factionLeaderOf: T("GBR") }),
        ],
      },
      { kind: "pp", amount: 100 },
      { kind: "stability", pct: 10 },
    ],
    ai: { base: 10 },
  },
  {
    // China's claims on both groups are P5's (claims.ts).
    id: "chn_recover_northeast",
    tree: "chn",
    x: 32,
    y: 5,
    days: 35,
    branch: "diplomacy",
    icon: "map",
    prereq: [["chn_great_power"]],
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "manchuria" },
        type: "claim",
        group: "manchuria",
      },
      {
        kind: "war_goal",
        on: { ownerOf: "kwantung" },
        type: "claim",
        group: "kwantung",
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "chn_war_tax",
    tree: "chn",
    x: 30,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "scales",
    prereq: [["chn_currency"]],
    effects: [{ kind: "add_spirit", id: "chn_war_finance" }],
    ai: { base: 10 },
  },
  {
    // "Cores on the annexed regions": the mode has no add-core effect, so
    // each held clique group is handed to China itself with core: true
    // (P3 transfer_regions -> P5 setLegalOwner(core) -> addCore).
    id: "chn_unification",
    tree: "chn",
    x: 27,
    y: 4,
    days: 105,
    branch: "politics",
    icon: "star_plain",
    prereq: [["chn_integrate_northwest"]],
    available: THREE_CLIQUES_HELD,
    effects: [
      { kind: "stability", pct: 10 },
      {
        kind: "if",
        cond: OWNS_GXC,
        then: [
          {
            kind: "transfer_regions",
            group: "guangxi",
            to: "self",
            core: true,
          },
        ],
      },
      {
        kind: "if",
        cond: OWNS_YUN,
        then: [
          { kind: "transfer_regions", group: "yunnan", to: "self", core: true },
        ],
      },
      {
        kind: "if",
        cond: OWNS_SXI,
        then: [
          {
            kind: "transfer_regions",
            group: "shanxi_suiyuan",
            to: "self",
            core: true,
          },
        ],
      },
      {
        kind: "if",
        cond: OWNS_XBM,
        then: [
          {
            kind: "transfer_regions",
            group: "ma_northwest",
            to: "self",
            core: true,
          },
        ],
      },
      {
        kind: "if",
        cond: OWNS_SIK,
        then: [
          {
            kind: "transfer_regions",
            group: "xinjiang",
            to: "self",
            core: true,
          },
        ],
      },
    ],
    ai: { base: 10 },
  },
];

/** The historical order (spec §11.2; P6 plan Task 16 Step 5). */
export const CHN_PATH: FocusId[] = [
  "chn_central_army",
  "chn_currency",
  "chn_new_life",
  "chn_united_front",
  "chn_inland_move",
  "chn_chongqing",
  "chn_burma_road",
  "chn_us_aid",
  "chn_soviet_aid",
  "chn_yangtze_line",
  "chn_trade_space",
  "chn_officer_academy",
  "chn_conscription",
  "chn_arsenals",
  "chn_light_industry",
  "chn_canton_hankou",
  "chn_war_tax",
  "chn_air_commission",
  "chn_guerrilla_zones",
  "chn_expeditionary",
  "chn_great_power",
  "chn_foreign_advisors",
  "chn_river_fleet",
  "chn_integrate_guangxi",
  "chn_integrate_yunnan",
  "chn_integrate_shanxi",
  "chn_integrate_northwest",
  "chn_unification",
  "chn_recover_northeast",
];

export const CHN_BRANCHES: BranchPoint[] = [
  {
    id: "chn_front",
    historical: "chn_united_front",
    alternatives: ["chn_bandit_suppression"],
    political: true,
  },
];
