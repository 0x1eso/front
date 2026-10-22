// World War 1936 P6 — the Nordic pack `nor` (spec §11.9): Sweden, Norway,
// Denmark, Finland and Iceland keep the whole generic tree and add these 26
// focuses. Data only: names and descriptions are ww1936.focus.<id> /
// ww1936.focus_desc.<id>.
//
// Columns (pack grid 20..35): politics and diplomacy 20..25, army 26..29,
// navy 30..31, industry and research 32..35. Prerequisites sit on the row
// above.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, gflag, not, T } from "../helpers";

/**
 * nor_defense_union: the first Nordic state to get here founds the union and
 * invites the others; a later one joins the founder's faction.
 */
const UNION_JOIN: Effect = {
  kind: "if",
  cond: { kind: "flag", who: T("SWE"), flag: "nor_union_founder" },
  then: [{ kind: "join_faction", of: T("SWE") }],
  else: [
    {
      kind: "if",
      cond: { kind: "flag", who: T("NOR"), flag: "nor_union_founder" },
      then: [{ kind: "join_faction", of: T("NOR") }],
      else: [
        {
          kind: "if",
          cond: { kind: "flag", who: T("FIN"), flag: "nor_union_founder" },
          then: [{ kind: "join_faction", of: T("FIN") }],
          else: [
            {
              kind: "if",
              cond: { kind: "flag", who: T("DNK"), flag: "nor_union_founder" },
              then: [{ kind: "join_faction", of: T("DNK") }],
              else: [
                {
                  kind: "if",
                  cond: {
                    kind: "flag",
                    who: T("ISL"),
                    flag: "nor_union_founder",
                  },
                  then: [{ kind: "join_faction", of: T("ISL") }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const UNION_FOUND: Effect[] = [
  { kind: "set_flag", flag: "can_create_faction" },
  { kind: "create_faction", name: "nordic_defence" },
  { kind: "set_flag", flag: "nor_union_founder" },
  { kind: "set_gflag", flag: "nordic_union_formed" },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "SWE" }),
    then: [{ kind: "invite", of: T("SWE") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "NOR" }),
    then: [{ kind: "invite", of: T("NOR") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "FIN" }),
    then: [{ kind: "invite", of: T("FIN") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "DNK" }),
    then: [{ kind: "invite", of: T("DNK") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "ISL" }),
    then: [{ kind: "invite", of: T("ISL") }],
  },
];

export const NOR_FOCUSES: readonly FocusDef[] = [
  // ---- politics and diplomacy ----
  {
    id: "nor_neutrality",
    tree: "nor",
    x: 21,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "dove",
    effects: [{ kind: "add_spirit", id: "nor_neutrality_spirit" }],
    ai: { base: 10 },
  },
  {
    id: "nor_defense_union",
    tree: "nor",
    x: 20,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    prereq: [["nor_neutrality"]],
    exclusive: ["nor_western_ties"],
    available: not({ kind: "in_faction" }),
    effects: [
      {
        kind: "if",
        cond: gflag("nordic_union_formed"),
        then: [UNION_JOIN],
        else: UNION_FOUND,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_western_ties",
    tree: "nor",
    x: 22,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["nor_neutrality"]],
    exclusive: ["nor_defense_union"],
    effects: [
      { kind: "opinion", of: T("GBR"), value: 30, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 365 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "at_war_with", of: T("DEU") }, factor: 400 }],
    },
  },
  {
    id: "nor_nordic_cooperation",
    tree: "nor",
    x: 20,
    y: 2,
    days: 105,
    branch: "research",
    icon: "research",
    prereq: [["nor_defense_union"]],
    // The faction rule is an order: the W3 AI reads this flag on a faction
    // leader and turns fr_shared_research on; a human leader does it on screen.
    effects: [{ kind: "set_flag", flag: "nordic_shared_research" }],
    ai: { base: 10 },
  },
  {
    id: "isl_island_neutrality",
    tree: "nor",
    countries: ["ISL"],
    x: 23,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "globe",
    effects: [{ kind: "stability", pct: 10 }],
    ai: { base: 10 },
  },
  {
    id: "swe_transit",
    tree: "nor",
    countries: ["SWE"],
    x: 24,
    y: 0,
    days: 35,
    branch: "diplomacy",
    icon: "rail",
    available: { kind: "controls_capital_of", who: T("DEU"), of: T("NOR") },
    effects: [
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", of: T("DEU"), value: 20, days: 365 },
      { kind: "stability", pct: -5 },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_resistance",
    tree: "nor",
    countries: ["NOR"],
    x: 25,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "fist",
    available: { kind: "is_exile" },
    effects: [{ kind: "add_spirit", id: "nor_home_front" }],
    ai: { base: 30 },
  },
  // ---- army ----
  {
    id: "nor_winter_training",
    tree: "nor",
    x: 26,
    y: 0,
    days: 70,
    branch: "army",
    icon: "compass",
    effects: [{ kind: "add_spirit", id: "nor_winter_warfare" }],
    ai: { base: 10 },
  },
  {
    id: "nor_ski_troops",
    tree: "nor",
    x: 26,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    prereq: [["nor_winter_training"]],
    effects: [
      // Mountain battalions need the mountaineers tech; without it the template would not unlock.
      {
        kind: "if",
        cond: not({ kind: "has_tech", tech: "mountaineers" }),
        then: [{ kind: "add_tech", tech: "mountaineers" }],
      },
      { kind: "unlock_template", template: "nor_ski_division" },
      { kind: "add_spirit", id: "nor_ski_warfare" },
    ],
    ai: { base: 10 },
  },
  {
    id: "fin_motti",
    tree: "nor",
    countries: ["FIN"],
    x: 26,
    y: 2,
    days: 70,
    branch: "army",
    icon: "sword",
    prereq: [["nor_ski_troops"]],
    effects: [{ kind: "add_spirit", id: "fin_motti_tactics" }],
    ai: { base: 10 },
  },
  {
    id: "nor_air_defense",
    tree: "nor",
    x: 27,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    effects: [
      { kind: "build", where: "capital", building: "anti_air", count: 1 },
      { kind: "equipment", type: "fighter", gen: 1, count: 30 },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_home_guard",
    tree: "nor",
    x: 27,
    y: 1,
    days: 70,
    branch: "army",
    icon: "shield",
    prereq: [["nor_winter_training"]],
    effects: [{ kind: "add_spirit", id: "nor_home_guard_spirit" }],
    ai: { base: 10 },
  },
  {
    id: "fin_mannerheim_line",
    tree: "nor",
    countries: ["FIN"],
    x: 28,
    y: 0,
    days: 70,
    branch: "army",
    icon: "fort",
    effects: [
      { kind: "fort", where: { group: "karelian_isthmus" }, amount: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "fin_continuation",
    tree: "nor",
    countries: ["FIN"],
    x: 28,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    prereq: [["fin_mannerheim_line"]],
    available: { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
    // Nothing was lost in 1940 (no Winter War or no Moscow peace): nothing to win back.
    bypass: all(
      { kind: "owns_group", group: "karelian_isthmus" },
      { kind: "owns_group", group: "ladoga_karelia" },
    ),
    effects: [
      {
        kind: "if",
        cond: not({ kind: "owns_group", group: "karelian_isthmus" }),
        then: [
          {
            kind: "war_goal",
            on: { ownerOf: "karelian_isthmus" },
            type: "claim",
            group: "karelian_isthmus",
          },
        ],
        else: [
          {
            kind: "war_goal",
            on: { ownerOf: "ladoga_karelia" },
            type: "claim",
            group: "ladoga_karelia",
          },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "fin_civil_guard",
    tree: "nor",
    countries: ["FIN"],
    x: 29,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    effects: [{ kind: "add_spirit", id: "fin_civil_guard_spirit" }],
    ai: { base: 10 },
  },
  // ---- navy ----
  {
    id: "nor_coastal_defense",
    tree: "nor",
    x: 30,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "tower",
    effects: [
      {
        kind: "build",
        where: { coastal: true, n: 3 },
        building: "coastal_fort",
        count: 3,
      },
      {
        kind: "build",
        where: { coastal: true, n: 1 },
        building: "naval_base",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "dnk_coastal_artillery",
    tree: "nor",
    countries: ["DNK"],
    x: 30,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "artillery",
    prereq: [["nor_coastal_defense"]],
    effects: [
      {
        kind: "build",
        where: { group: "zealand" },
        building: "coastal_fort",
        count: 2,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_merchant_marine",
    tree: "nor",
    x: 31,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    effects: [{ kind: "convoys", amount: 80 }],
    ai: { base: 10 },
  },
  {
    id: "nor_fleet_abroad",
    tree: "nor",
    countries: ["NOR"],
    x: 31,
    y: 1,
    days: 35,
    branch: "navy",
    icon: "ship",
    prereq: [["nor_merchant_marine"]],
    available: { kind: "at_war" },
    // Half the merchant fleet sails for Britain. P6 keeps convoys out of
    // lend-lease (NON_TRANSFERABLE), so the ships go once from the stockpile;
    // a short stock sends what it has.
    effects: [
      { kind: "send_equipment", to: T("GBR"), type: "convoy", count: 60 },
    ],
    ai: { base: 10 },
  },
  // ---- industry and research ----
  {
    id: "nor_hydropower",
    tree: "nor",
    x: 32,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "industry",
    effects: [
      { kind: "energy", amount: 12 },
      { kind: "build", where: { best: 1 }, building: "civ", count: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_heavy_water",
    tree: "nor",
    countries: ["NOR"],
    x: 32,
    y: 1,
    days: 70,
    branch: "research",
    icon: "flask",
    prereq: [["nor_hydropower"]],
    // The Vemork bonus goes to whoever controls Telemark, so the flag is set
    // both on Norway and as a world flag (lane S reads either).
    effects: [
      { kind: "set_flag", flag: "nor_heavy_water" },
      { kind: "set_gflag", flag: "nor_heavy_water" },
    ],
    ai: { base: 10 },
  },
  {
    id: "swe_iron_ore",
    tree: "nor",
    countries: ["SWE"],
    x: 33,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "mine",
    effects: [
      {
        kind: "resource",
        where: { group: "norrbotten" },
        res: "steel",
        amount: 4,
      },
      { kind: "add_spirit", id: "swe_ore_exports" },
    ],
    ai: { base: 10 },
  },
  {
    id: "dnk_agriculture",
    tree: "nor",
    countries: ["DNK"],
    x: 33,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "wheat",
    effects: [
      { kind: "pp", amount: 50 },
      { kind: "add_spirit", id: "dnk_farm_exports" },
    ],
    ai: { base: 10 },
  },
  {
    id: "swe_arms_industry",
    tree: "nor",
    countries: ["SWE"],
    x: 34,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      {
        kind: "if",
        cond: not({ kind: "has_tech", tech: "anti_air_1" }),
        then: [
          { kind: "research_bonus", tech: "anti_air_1", pct: 50, uses: 1 },
        ],
        else: [
          { kind: "research_bonus", tech: "anti_air_2", pct: 50, uses: 1 },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "swe_armed_neutrality",
    tree: "nor",
    countries: ["SWE"],
    x: 34,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "tower",
    prereq: [["swe_arms_industry"]],
    // Replaces the starting gen_armed_neutrality (defence +10%, others justify
    // 50% slower) with a firmer one, so the defence does not count twice.
    effects: [
      {
        kind: "swap_spirit",
        from: "gen_armed_neutrality",
        to: "swe_armed_neutrality_spirit",
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "fin_state_arsenal",
    tree: "nor",
    countries: ["FIN"],
    x: 35,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "research_bonus", branch: "infantry", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
];

/**
 * The AI's history path: the shared neutrality, defence and economy focuses
 * first, then each country's own. nor_course keeps the Nordic defence talks
 * of 1939-1940 as the historical line.
 */
export const NOR_PATH: readonly FocusId[] = [
  "nor_neutrality",
  "nor_hydropower",
  "nor_winter_training",
  "nor_coastal_defense",
  "nor_merchant_marine",
  "nor_defense_union",
  "nor_air_defense",
  "nor_home_guard",
  "nor_ski_troops",
  "nor_nordic_cooperation",
  "swe_iron_ore",
  "swe_arms_industry",
  "swe_armed_neutrality",
  "swe_transit",
  "fin_mannerheim_line",
  "fin_state_arsenal",
  "fin_civil_guard",
  "fin_motti",
  "fin_continuation",
  "nor_heavy_water",
  "nor_fleet_abroad",
  "nor_resistance",
  "dnk_agriculture",
  "dnk_coastal_artillery",
  "isl_island_neutrality",
];

export const NOR_BRANCHES: readonly BranchPoint[] = [
  {
    id: "nor_course",
    historical: "nor_defense_union",
    alternatives: ["nor_western_ties"],
    political: false,
  },
];
