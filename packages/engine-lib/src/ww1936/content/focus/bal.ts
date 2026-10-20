// World War 1936 P6 — the Balkan pack `bal` (spec §11.8): Romania, Hungary,
// Yugoslavia, Bulgaria, Greece and Albania keep the generic tree (minus
// gen_pol_claims) and add these 30 focuses. Data only: names and descriptions
// are ww1936.focus.<id> / ww1936.focus_desc.<id>.
//
// Columns (pack grid 20..35): politics and diplomacy 20..25, army 26..29,
// industry, air and navy 30..35. Prerequisites sit on the row above; the two
// late-war focuses without prerequisites sit on row 3.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, gflag, not, T } from "../helpers";

/** The two revisionist kingdoms of the pack (spec §11.8 bal_revisionism). */
const REVISIONIST: Condition = any(
  { kind: "tag", tag: "HUN" },
  { kind: "tag", tag: "BGR" },
);

/** A major of my own faction has lost 70% of the way to its surrender line (80%; Soviet Union 90%). */
const ALLY_MAJOR_FALLING: Condition = any(
  all(
    { kind: "same_faction", of: T("DEU") },
    { kind: "lost_vp_ge", who: T("DEU"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("ITA") },
    { kind: "lost_vp_ge", who: T("ITA"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("JPN") },
    { kind: "lost_vp_ge", who: T("JPN"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("GBR") },
    { kind: "lost_vp_ge", who: T("GBR"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("FRA") },
    { kind: "lost_vp_ge", who: T("FRA"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("USA") },
    { kind: "lost_vp_ge", who: T("USA"), pct: 56 },
  ),
  all(
    { kind: "same_faction", of: T("SUN") },
    { kind: "lost_vp_ge", who: T("SUN"), pct: 63 },
  ),
);

/** Change sides towards the strongest enemy faction (Romania and Bulgaria went to the Soviet side in 1944). */
const SWITCH_SIDES: Effect = {
  kind: "if",
  cond: { kind: "at_war_with", of: T("SUN") },
  then: [{ kind: "switch_sides", to: T("SUN") }],
  else: [
    {
      kind: "if",
      cond: { kind: "at_war_with", of: T("GBR") },
      then: [{ kind: "switch_sides", to: T("GBR") }],
      else: [
        {
          kind: "if",
          cond: { kind: "at_war_with", of: T("USA") },
          then: [{ kind: "switch_sides", to: T("USA") }],
          else: [
            {
              kind: "if",
              cond: { kind: "at_war_with", of: T("DEU") },
              then: [{ kind: "switch_sides", to: T("DEU") }],
              else: [
                {
                  kind: "if",
                  cond: { kind: "at_war_with", of: T("ITA") },
                  then: [{ kind: "switch_sides", to: T("ITA") }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * bal_revisionism: the first group of the claims table (P3 CLAIMS, joined
 * with the P5 rows) the country does not hold yet becomes a claim war goal.
 */
const CLAIM_HUN: Effect = {
  kind: "if",
  cond: not({ kind: "owns_group", group: "south_slovakia" }),
  then: [
    {
      kind: "war_goal",
      on: { ownerOf: "south_slovakia" },
      type: "claim",
      group: "south_slovakia",
    },
  ],
  else: [
    {
      kind: "if",
      cond: not({ kind: "owns_group", group: "carpathian_ruthenia" }),
      then: [
        {
          kind: "war_goal",
          on: { ownerOf: "carpathian_ruthenia" },
          type: "claim",
          group: "carpathian_ruthenia",
        },
      ],
      else: [
        {
          kind: "if",
          cond: not({ kind: "owns_group", group: "north_transylvania" }),
          then: [
            {
              kind: "war_goal",
              on: { ownerOf: "north_transylvania" },
              type: "claim",
              group: "north_transylvania",
            },
          ],
        },
      ],
    },
  ],
};
const CLAIM_BGR: Effect = {
  kind: "if",
  cond: not({ kind: "owns_group", group: "south_dobruja" }),
  then: [
    {
      kind: "war_goal",
      on: { ownerOf: "south_dobruja" },
      type: "claim",
      group: "south_dobruja",
    },
  ],
};
const CLAIM_ROU: Effect = {
  kind: "if",
  cond: not({ kind: "owns_group", group: "north_transylvania" }),
  then: [
    {
      kind: "war_goal",
      on: { ownerOf: "north_transylvania" },
      type: "claim",
      group: "north_transylvania",
    },
  ],
  else: [
    {
      kind: "if",
      cond: not({ kind: "owns_group", group: "bessarabia" }),
      then: [
        {
          kind: "war_goal",
          on: { ownerOf: "bessarabia" },
          type: "claim",
          group: "bessarabia",
        },
      ],
    },
  ],
};
const CLAIM_YUG: Effect = {
  kind: "if",
  cond: not({ kind: "owns_group", group: "istria" }),
  then: [
    {
      kind: "war_goal",
      on: { ownerOf: "istria" },
      type: "claim",
      group: "istria",
    },
  ],
};
const CLAIM_GRC: Effect = {
  kind: "if",
  cond: not({ kind: "owns_group", group: "dodecanese" }),
  then: [
    {
      kind: "war_goal",
      on: { ownerOf: "dodecanese" },
      type: "claim",
      group: "dodecanese",
    },
  ],
};

/** bal_pact: relations +20 both ways with one Entente partner, and a request to guarantee us. */
const PACT_GRC: Effect = {
  kind: "if",
  cond: not({ kind: "tag", tag: "GRC" }),
  then: [
    { kind: "opinion", of: T("GRC"), value: 20, days: 365 },
    { kind: "opinion", who: T("GRC"), of: "self", value: 20, days: 365 },
    { kind: "guarantee", of: T("GRC") },
    { kind: "fire_event", id: "bal_guarantee_request", to: T("GRC") },
  ],
};
const PACT_YUG: Effect = {
  kind: "if",
  cond: not({ kind: "tag", tag: "YUG" }),
  then: [
    { kind: "opinion", of: T("YUG"), value: 20, days: 365 },
    { kind: "opinion", who: T("YUG"), of: "self", value: 20, days: 365 },
    { kind: "guarantee", of: T("YUG") },
    { kind: "fire_event", id: "bal_guarantee_request", to: T("YUG") },
  ],
};
const PACT_ROU: Effect = {
  kind: "if",
  cond: not({ kind: "tag", tag: "ROU" }),
  then: [
    { kind: "opinion", of: T("ROU"), value: 20, days: 365 },
    { kind: "opinion", who: T("ROU"), of: "self", value: 20, days: 365 },
    { kind: "guarantee", of: T("ROU") },
    { kind: "fire_event", id: "bal_guarantee_request", to: T("ROU") },
  ],
};
const PACT_TUR: Effect = {
  kind: "if",
  cond: not({ kind: "tag", tag: "TUR" }),
  then: [
    { kind: "opinion", of: T("TUR"), value: 20, days: 365 },
    { kind: "opinion", who: T("TUR"), of: "self", value: 20, days: 365 },
    { kind: "guarantee", of: T("TUR") },
    { kind: "fire_event", id: "bal_guarantee_request", to: T("TUR") },
  ],
};

/**
 * bal_neutral_bloc: the first Balkan state to get here founds the bloc and
 * invites the rest of the pack; a later one joins the founder's faction.
 */
const BLOC_JOIN: Effect = {
  kind: "if",
  cond: { kind: "flag", who: T("ROU"), flag: "bal_bloc_founder" },
  then: [{ kind: "join_faction", of: T("ROU") }],
  else: [
    {
      kind: "if",
      cond: { kind: "flag", who: T("YUG"), flag: "bal_bloc_founder" },
      then: [{ kind: "join_faction", of: T("YUG") }],
      else: [
        {
          kind: "if",
          cond: { kind: "flag", who: T("GRC"), flag: "bal_bloc_founder" },
          then: [{ kind: "join_faction", of: T("GRC") }],
          else: [
            {
              kind: "if",
              cond: { kind: "flag", who: T("BGR"), flag: "bal_bloc_founder" },
              then: [{ kind: "join_faction", of: T("BGR") }],
              else: [
                {
                  kind: "if",
                  cond: {
                    kind: "flag",
                    who: T("HUN"),
                    flag: "bal_bloc_founder",
                  },
                  then: [{ kind: "join_faction", of: T("HUN") }],
                  else: [
                    {
                      kind: "if",
                      cond: {
                        kind: "flag",
                        who: T("ALB"),
                        flag: "bal_bloc_founder",
                      },
                      then: [{ kind: "join_faction", of: T("ALB") }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const BLOC_FOUND: Effect[] = [
  { kind: "set_flag", flag: "can_create_faction" },
  { kind: "create_faction", name: "balkan_entente" },
  { kind: "set_flag", flag: "bal_bloc_founder" },
  { kind: "set_gflag", flag: "balkan_bloc_formed" },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "ROU" }),
    then: [{ kind: "invite", of: T("ROU") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "YUG" }),
    then: [{ kind: "invite", of: T("YUG") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "GRC" }),
    then: [{ kind: "invite", of: T("GRC") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "BGR" }),
    then: [{ kind: "invite", of: T("BGR") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "HUN" }),
    then: [{ kind: "invite", of: T("HUN") }],
  },
  {
    kind: "if",
    cond: not({ kind: "tag", tag: "ALB" }),
    then: [{ kind: "invite", of: T("ALB") }],
  },
];

/** The P3 Vienna-award request decisions, as their own conditions say (decisions/national.ts). */
const ARBITRATION_1_OPEN: Condition = all(
  gflag("munich_done"),
  { kind: "exists", who: T("DEU") },
  { kind: "exists", who: T("ITA") },
  { kind: "exists", who: T("CSK") },
  { kind: "owns_group", who: T("CSK"), group: "south_slovakia" },
  not({ kind: "at_war_with", of: T("CSK") }),
  not({ kind: "decision_taken", id: "hun_request_arbitration" }),
);
const ROMANIA_LOST_BESSARABIA: Condition = any(
  gflag("bessarabia_lost"),
  not({ kind: "owns_group", who: T("ROU"), group: "bessarabia" }),
);
const ARBITRATION_2_OPEN: Condition = all(
  ROMANIA_LOST_BESSARABIA,
  { kind: "exists", who: T("DEU") },
  { kind: "exists", who: T("ROU") },
  { kind: "owns_group", who: T("ROU"), group: "north_transylvania" },
  { kind: "opinion_ge", who: T("DEU"), of: "self", value: 0 },
  not({ kind: "at_war_with", of: T("ROU") }),
  not({ kind: "decision_taken", id: "hun_request_transylvania" }),
);
const DOBRUJA_OPEN: Condition = all(
  ROMANIA_LOST_BESSARABIA,
  { kind: "exists", who: T("ROU") },
  { kind: "owns_group", who: T("ROU"), group: "south_dobruja" },
  not({ kind: "at_war_with", of: T("ROU") }),
  not({ kind: "decision_taken", id: "bgr_demand_dobruja" }),
);

export const BAL_FOCUSES: readonly FocusDef[] = [
  // ---- politics and diplomacy ----
  {
    id: "bal_pact",
    tree: "bal",
    x: 21,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    exclusive: ["bal_revisionism"],
    effects: [PACT_GRC, PACT_YUG, PACT_ROU, PACT_TUR],
    ai: { base: 10, mods: [{ if: REVISIONIST, factor: 10 }] },
  },
  {
    id: "bal_revisionism",
    tree: "bal",
    x: 23,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "map",
    exclusive: ["bal_pact"],
    effects: [
      {
        kind: "if",
        cond: { kind: "tag", tag: "HUN" },
        then: [CLAIM_HUN],
        else: [
          {
            kind: "if",
            cond: { kind: "tag", tag: "BGR" },
            then: [CLAIM_BGR],
            else: [
              {
                kind: "if",
                cond: { kind: "tag", tag: "ROU" },
                then: [CLAIM_ROU],
                else: [
                  {
                    kind: "if",
                    cond: { kind: "tag", tag: "YUG" },
                    then: [CLAIM_YUG],
                    else: [
                      {
                        kind: "if",
                        cond: { kind: "tag", tag: "GRC" },
                        then: [CLAIM_GRC],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ai: { base: 5, mods: [{ if: REVISIONIST, factor: 400 }] },
  },
  {
    id: "bal_western_tilt",
    tree: "bal",
    x: 20,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    prereq: [["bal_pact"]],
    effects: [
      { kind: "opinion", of: T("GBR"), value: 30, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 365 },
      { kind: "opinion", of: T("FRA"), value: 30, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 30, days: 365 },
      { kind: "fire_event", id: "bal_guarantee_request", to: T("GBR") },
      { kind: "fire_event", id: "bal_guarantee_request", to: T("FRA") },
    ],
    ai: { base: 10 },
  },
  {
    id: "bal_neutral_bloc",
    tree: "bal",
    x: 21,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    prereq: [["bal_pact"]],
    available: not({ kind: "in_faction" }),
    effects: [
      {
        kind: "if",
        cond: gflag("balkan_bloc_formed"),
        then: [BLOC_JOIN],
        else: BLOC_FOUND,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "bal_axis_tilt",
    tree: "bal",
    x: 22,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "eagle_plain",
    prereq: [["bal_revisionism"]],
    effects: [
      { kind: "opinion", of: T("DEU"), value: 30, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 30, days: 365 },
      { kind: "unlock_decision", id: "gen_join_axis" },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "ruling", ideology: "democratic" }, factor: 20 }],
    },
  },
  {
    id: "hun_arbitration",
    tree: "bal",
    countries: ["HUN"],
    x: 23,
    y: 1,
    days: 35,
    branch: "diplomacy",
    icon: "scales",
    prereq: [["bal_revisionism"]],
    effects: [
      {
        kind: "if",
        cond: ARBITRATION_1_OPEN,
        then: [{ kind: "take_decision", id: "hun_request_arbitration" }],
        else: [
          {
            kind: "if",
            cond: ARBITRATION_2_OPEN,
            then: [{ kind: "take_decision", id: "hun_request_transylvania" }],
            else: [
              { kind: "unlock_decision", id: "hun_request_arbitration" },
              { kind: "unlock_decision", id: "hun_request_transylvania" },
            ],
          },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "bgr_dobruja",
    tree: "bal",
    countries: ["BGR"],
    x: 24,
    y: 1,
    days: 35,
    branch: "diplomacy",
    icon: "map",
    prereq: [["bal_revisionism"]],
    effects: [
      {
        kind: "if",
        cond: DOBRUJA_OPEN,
        then: [{ kind: "take_decision", id: "bgr_demand_dobruja" }],
        else: [{ kind: "unlock_decision", id: "bgr_demand_dobruja" }],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "yug_regency",
    tree: "bal",
    countries: ["YUG"],
    x: 25,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "crown",
    effects: [{ kind: "stability", pct: 10 }],
    ai: { base: 10 },
  },
  {
    id: "yug_agreement",
    tree: "bal",
    countries: ["YUG"],
    x: 25,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "document",
    prereq: [["yug_regency"]],
    effects: [
      { kind: "stability", pct: 10 },
      { kind: "pp", amount: 50 },
    ],
    ai: { base: 10 },
  },
  {
    id: "bal_switch_sides",
    tree: "bal",
    x: 22,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    available: all(
      { kind: "at_war" },
      { kind: "in_faction" },
      ALLY_MAJOR_FALLING,
    ),
    effects: [SWITCH_SIDES],
    ai: { base: 50 },
  },
  // ---- army ----
  {
    id: "bal_royal_army",
    tree: "bal",
    x: 26,
    y: 0,
    days: 70,
    branch: "army",
    icon: "star_plain",
    effects: [{ kind: "army_xp", amount: 25 }],
    ai: { base: 10 },
  },
  {
    id: "hun_mobile_corps",
    tree: "bal",
    countries: ["HUN"],
    x: 26,
    y: 1,
    days: 70,
    branch: "army",
    icon: "tank",
    prereq: [["bal_royal_army"]],
    effects: [
      { kind: "unlock_template", template: "hun_mobile_brigade" },
      { kind: "research_bonus", branch: "armour", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "bgr_rearmament",
    tree: "bal",
    countries: ["BGR"],
    x: 27,
    y: 1,
    days: 70,
    branch: "army",
    icon: "chain_broken",
    prereq: [["bal_royal_army"]],
    effects: [{ kind: "law_step", law: "conscription", steps: 1 }],
    ai: { base: 10 },
  },
  {
    id: "bal_arms_imports",
    tree: "bal",
    x: 27,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "document",
    effects: [{ kind: "add_spirit", id: "bal_arms_contracts", days: 720 }],
    ai: { base: 10 },
  },
  {
    id: "bal_mountain_troops",
    tree: "bal",
    x: 28,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    effects: [
      {
        kind: "if",
        cond: not({ kind: "has_tech", tech: "mountaineers" }),
        then: [{ kind: "add_tech", tech: "mountaineers" }],
      },
      { kind: "unlock_template", template: "bal_mountain_division" },
      { kind: "add_spirit", id: "bal_highland_drill" },
    ],
    ai: { base: 10 },
  },
  {
    id: "bal_border_forts",
    tree: "bal",
    x: 28,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["bal_mountain_troops"]],
    effects: [
      { kind: "fort", where: { borderWith: "threat", n: 3 }, amount: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "grc_mountain_war",
    tree: "bal",
    countries: ["GRC"],
    x: 29,
    y: 1,
    days: 70,
    branch: "army",
    icon: "shield",
    prereq: [["bal_mountain_troops"]],
    effects: [{ kind: "add_spirit", id: "grc_mountain_defense" }],
    ai: { base: 10 },
  },
  {
    id: "rou_eastern_line",
    tree: "bal",
    countries: ["ROU"],
    x: 27,
    y: 2,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["bal_border_forts"]],
    effects: [
      { kind: "fort", where: { borderWith: T("SUN"), n: 3 }, amount: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "yug_mountain_redoubt",
    tree: "bal",
    countries: ["YUG"],
    x: 28,
    y: 2,
    days: 70,
    branch: "army",
    icon: "tower",
    prereq: [["bal_border_forts"]],
    effects: [{ kind: "fort", where: { group: "bosnia" }, amount: 2 }],
    ai: { base: 10 },
  },
  {
    id: "grc_metaxas_line",
    tree: "bal",
    countries: ["GRC"],
    x: 29,
    y: 2,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["bal_border_forts"]],
    effects: [{ kind: "fort", where: { group: "greek_macedonia" }, amount: 3 }],
    ai: { base: 10 },
  },
  {
    id: "bal_partisans",
    tree: "bal",
    x: 26,
    y: 3,
    days: 70,
    branch: "army",
    icon: "fist",
    available: not({ kind: "controls_capital_of", of: "self" }),
    effects: [{ kind: "add_spirit", id: "bal_partisan_war" }],
    ai: { base: 30 },
  },
  // ---- industry, air and navy ----
  {
    id: "bal_land_reform",
    tree: "bal",
    x: 30,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "wheat",
    effects: [
      { kind: "stability", pct: 5 },
      { kind: "manpower", recruitablePct: 5 },
    ],
    ai: { base: 10 },
  },
  {
    id: "bal_light_industry",
    tree: "bal",
    x: 30,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    prereq: [["bal_land_reform"]],
    effects: [{ kind: "build", where: { best: 2 }, building: "civ", count: 2 }],
    ai: { base: 10 },
  },
  {
    id: "bal_danube_rail",
    tree: "bal",
    x: 30,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "rail",
    prereq: [["bal_light_industry"]],
    effects: [
      { kind: "infra", where: { best: 3 }, amount: 1 },
      { kind: "rail", where: { best: 3 }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "rou_ploiesti",
    tree: "bal",
    countries: ["ROU"],
    x: 31,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "oil",
    effects: [
      {
        kind: "resource",
        where: { group: "ploiesti" },
        res: "oil",
        amount: 4,
      },
      {
        kind: "build",
        where: { group: "ploiesti" },
        building: "fuel_silo",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "rou_oil_diplomacy",
    tree: "bal",
    countries: ["ROU"],
    x: 31,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["rou_ploiesti"]],
    effects: [
      // The oil buyers of 1936-1939 stand in for "trade partners" (no selector for them).
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("ITA"), of: "self", value: 20, days: 365 },
      { kind: "pp", amount: 50 },
    ],
    ai: { base: 10 },
  },
  {
    id: "rou_aircraft",
    tree: "bal",
    countries: ["ROU"],
    x: 32,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    effects: [{ kind: "equipment", type: "fighter", gen: 1, count: 40 }],
    ai: { base: 10 },
  },
  {
    id: "hun_gyor_program",
    tree: "bal",
    countries: ["HUN"],
    x: 33,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    effects: [{ kind: "build", where: { best: 2 }, building: "mil", count: 2 }],
    ai: { base: 10 },
  },
  {
    id: "grc_merchant_fleet",
    tree: "bal",
    countries: ["GRC"],
    x: 34,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    effects: [{ kind: "convoys", amount: 100 }],
    ai: { base: 10 },
  },
  {
    id: "alb_reforms",
    tree: "bal",
    countries: ["ALB"],
    x: 35,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "crown",
    effects: [
      { kind: "stability", pct: 5 },
      { kind: "build", where: { best: 1 }, building: "civ", count: 1 },
    ],
    ai: { base: 10 },
  },
];

/**
 * The AI's history path: the shared economy and army focuses first, then each
 * country's own in the order of its history. The bal_course choice is left
 * to the weights (Hungary and Bulgaria lean to revisionism, the Entente
 * members to the pact), so one path serves all six kingdoms.
 */
export const BAL_PATH: readonly FocusId[] = [
  "bal_land_reform",
  "bal_royal_army",
  "bal_light_industry",
  "bal_mountain_troops",
  "bal_arms_imports",
  "bal_border_forts",
  "bal_danube_rail",
  "hun_gyor_program",
  "hun_mobile_corps",
  "rou_ploiesti",
  "rou_aircraft",
  "rou_oil_diplomacy",
  "rou_eastern_line",
  "yug_regency",
  "yug_agreement",
  "yug_mountain_redoubt",
  "bgr_rearmament",
  "grc_metaxas_line",
  "grc_merchant_fleet",
  "grc_mountain_war",
  "alb_reforms",
];

export const BAL_BRANCHES: readonly BranchPoint[] = [
  {
    id: "bal_course",
    historical: "bal_pact",
    alternatives: ["bal_revisionism"],
    political: true,
  },
];
