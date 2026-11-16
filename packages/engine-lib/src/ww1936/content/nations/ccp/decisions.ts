// ww229: the Chinese Communists' decisions. The mechanism is the base-area
// network behind the enemy's lines: four bases (Shanxi-Chahar-Hebei, the
// Taihang mountains, Shandong, central China), opened by
// ccp_into_the_mountains, each taken once while the occupier holds part of
// its land. Each stirs the land up and raises the network's stage spirit
// (ccp_sp_bases_1..4). The P6 pack's ccp_new_base_area (repeatable) is
// opened by the same focus. The Kwantung arsenals hand over the Japanese
// arms whose designs the party holds from the start (core.ts). Data only.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, done, flag, not } from "../../helpers";

/** One more base: the network's stage spirit goes up by one. */
const NEXT_STAGE: Effect = {
  kind: "if",
  cond: { kind: "has_spirit", id: "ccp_sp_bases_3" },
  then: [{ kind: "swap_spirit", from: "ccp_sp_bases_3", to: "ccp_sp_bases_4" }],
  else: [
    {
      kind: "if",
      cond: { kind: "has_spirit", id: "ccp_sp_bases_2" },
      then: [
        { kind: "swap_spirit", from: "ccp_sp_bases_2", to: "ccp_sp_bases_3" },
      ],
      else: [
        {
          kind: "if",
          cond: { kind: "has_spirit", id: "ccp_sp_bases_1" },
          then: [
            {
              kind: "swap_spirit",
              from: "ccp_sp_bases_1",
              to: "ccp_sp_bases_2",
            },
          ],
          else: [{ kind: "add_spirit", id: "ccp_sp_bases_1" }],
        },
      ],
    },
  ],
};

const WAR_JPN: Condition = { kind: "at_war_with", of: T("JPN") };

export const CCP_DECISIONS: DecisionDef[] = [
  // ---- the base areas ----
  {
    id: "ccp_dec_base_jin_cha_ji",
    category: "national",
    for: ["CCP"],
    locked: true,
    available: all(WAR_JPN, {
      kind: "occupied_by",
      group: "ccp_jin_cha_ji",
      of: T("JPN"),
    }),
    cost: { pp: 50 },
    effects: [
      { kind: "resistance", group: "ccp_jin_cha_ji", pct: 15 },
      { kind: "compliance", group: "ccp_jin_cha_ji", pct: -10 },
      { kind: "manpower", amount: 6000 },
      { kind: "set_flag", flag: "ccp_base_jin_cha_ji" },
      NEXT_STAGE,
    ],
    ai: { base: 40 },
  },
  {
    id: "ccp_dec_base_taihang",
    category: "national",
    for: ["CCP"],
    locked: true,
    available: all(WAR_JPN, {
      kind: "occupied_by",
      group: "shanxi_suiyuan",
      of: T("JPN"),
    }),
    cost: { pp: 50 },
    effects: [
      { kind: "resistance", group: "shanxi_suiyuan", pct: 15 },
      { kind: "compliance", group: "shanxi_suiyuan", pct: -10 },
      { kind: "manpower", amount: 5000 },
      { kind: "set_flag", flag: "ccp_base_taihang" },
      NEXT_STAGE,
    ],
    ai: { base: 40 },
  },
  {
    id: "ccp_dec_base_shandong",
    category: "national",
    for: ["CCP"],
    locked: true,
    available: all(WAR_JPN, {
      kind: "occupied_by",
      group: "ccp_shandong",
      of: T("JPN"),
    }),
    cost: { pp: 50 },
    effects: [
      { kind: "resistance", group: "ccp_shandong", pct: 15 },
      { kind: "compliance", group: "ccp_shandong", pct: -10 },
      { kind: "manpower", amount: 5000 },
      { kind: "set_flag", flag: "ccp_base_shandong" },
      NEXT_STAGE,
    ],
    ai: { base: 35 },
  },
  {
    id: "ccp_dec_base_central_china",
    category: "national",
    for: ["CCP"],
    locked: true,
    available: all(
      WAR_JPN,
      { kind: "occupied_by", group: "ccp_central_china", of: T("JPN") },
      done("ccp_new_fourth_army"),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "resistance", group: "ccp_central_china", pct: 15 },
      { kind: "compliance", group: "ccp_central_china", pct: -10 },
      { kind: "manpower", amount: 5000 },
      { kind: "set_flag", flag: "ccp_base_central_china" },
      NEXT_STAGE,
    ],
    ai: { base: 35 },
  },
  {
    // The bases' own campaign: rent cuts, schools and the militia's call.
    id: "ccp_dec_rouse_the_bases",
    category: "national",
    for: ["CCP"],
    available: any(
      { kind: "has_spirit", id: "ccp_sp_bases_2" },
      { kind: "has_spirit", id: "ccp_sp_bases_3" },
      { kind: "has_spirit", id: "ccp_sp_bases_4" },
    ),
    cost: { pp: 40 },
    cooldownDays: 180,
    effects: [
      { kind: "manpower", amount: 8000 },
      { kind: "resistance", group: "east_china_occupied", pct: 5 },
      { kind: "war_support", pct: 1 },
    ],
    ai: { base: 20 },
  },

  // ---- the party ----
  {
    id: "ccp_dec_militia_drive",
    category: "military",
    for: ["CCP"],
    available: done("ccp_self_defence_corps"),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "manpower", amount: 4000 },
      { kind: "war_support", pct: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "ccp_dec_study_sessions",
    category: "political",
    for: ["CCP"],
    available: all(
      { kind: "ruling", ideology: "communist" },
      any(done("ccp_rectification"), done("ccp_soviet_advisers")),
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "popularity", ideology: "communist", pp: 2 },
    ],
    ai: {
      base: 6,
      mods: [{ if: { kind: "stability_ge", pct: 60 }, factor: 20 }],
    },
  },

  // ---- the economy ----
  {
    id: "ccp_dec_harvest_drive",
    category: "economy",
    for: ["CCP"],
    available: done("ccp_great_production"),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [{ kind: "add_spirit", id: "ccp_sp_harvest_drive", days: 180 }],
    ai: { base: 10 },
  },
  {
    id: "ccp_dec_run_the_blockade",
    category: "economy",
    for: ["CCP"],
    available: { kind: "has_spirit", id: "ccp_sp_blockade" },
    cost: { pp: 60 },
    effects: [
      { kind: "remove_spirit", id: "ccp_sp_blockade" },
      { kind: "opinion", of: T("CHN"), value: -10, days: 365 },
    ],
    ai: { base: 15 },
  },

  // ---- the north ----
  {
    id: "ccp_dec_kwantung_arsenals",
    category: "military",
    for: ["CCP"],
    locked: true,
    available: any(
      { kind: "capitulated", who: T("JPN") },
      { kind: "occupied_by", group: "manchuria", of: T("SUN") },
      { kind: "controls_group", group: "manchuria" },
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 3000 },
      { kind: "equipment", type: "artillery", gen: 1, count: 150 },
      { kind: "equipment", type: "medium_tank", gen: 1, count: 20 },
      { kind: "equipment", type: "fighter", gen: 2, count: 12 },
      { kind: "set_flag", flag: "ccp_kwantung_arms" },
    ],
    ai: { base: 50 },
  },
  {
    id: "ccp_dec_recruit_the_northeast",
    category: "military",
    for: ["CCP"],
    available: all(flag("ccp_kwantung_arms"), not({ kind: "capitulated" })),
    cost: { pp: 40 },
    cooldownDays: 180,
    effects: [
      { kind: "manpower", amount: 12000 },
      { kind: "army_xp", amount: 3 },
    ],
    ai: { base: 15 },
  },
];
