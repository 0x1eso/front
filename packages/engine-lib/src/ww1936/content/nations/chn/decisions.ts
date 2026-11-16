// ww229: Nationalist China's decisions: Soviet credits, the united front,
// the tungsten trade, money and the provincial armies. The balance of the
// provinces keeps its two decisions in decisions/depth.ts
// (chn_central_officers, chn_regional_appeasement); the pack's
// chn_integrate_warlord and chn_request_soviet_aid are opened by this tree.
// Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CHN_DECISIONS: DecisionDef[] = [
  {
    id: "chn_dec_soviet_credit",
    category: "diplomacy",
    for: ["CHN"],
    locked: true,
    available: {
      all: [
        { kind: "exists", who: { tag: "SUN" } },
        { not: { kind: "at_war_with", of: { tag: "SUN" } } },
      ],
    },
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "fire_event", id: "chn_ev_soviet_credit", to: { tag: "SUN" } },
    ],
    ai: {
      base: 15,
      mods: [{ if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 300 }],
    },
  },
  {
    id: "chn_dec_amnesty_red_soldiers",
    category: "military",
    for: ["CHN"],
    locked: true,
    available: { kind: "exists", who: { tag: "CCP" } },
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "popularity", ideology: "communist", pp: -2 },
      { kind: "manpower", amount: 15000 },
      { kind: "opinion", of: { tag: "CCP" }, value: -10, days: 180 },
    ],
    ai: { base: 8 },
  },
  {
    id: "chn_dec_front_conference",
    category: "political",
    for: ["CHN"],
    locked: true,
    available: {
      all: [
        { kind: "exists", who: { tag: "CCP" } },
        {
          any: [
            { kind: "has_spirit", id: "chn_sp_front_uneasy" },
            { kind: "has_spirit", id: "chn_sp_front_broken" },
          ],
        },
      ],
    },
    cost: { pp: 50 },
    cooldownDays: 240,
    effects: [
      {
        kind: "if",
        cond: { kind: "has_spirit", id: "chn_sp_front_broken" },
        then: [
          {
            kind: "swap_spirit",
            from: "chn_sp_front_broken",
            to: "chn_sp_front_uneasy",
          },
        ],
        else: [
          {
            kind: "swap_spirit",
            from: "chn_sp_front_uneasy",
            to: "chn_sp_front_solid",
          },
        ],
      },
      { kind: "opinion", of: { tag: "CCP" }, value: 20, days: 365 },
      { kind: "popularity", ideology: "communist", pp: 1 },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 200 }],
    },
  },
  {
    id: "chn_dec_blockade_border_region",
    category: "military",
    for: ["CHN"],
    available: {
      all: [
        { kind: "exists", who: { tag: "CCP" } },
        // ww229 MA3: a blockade of the united front's Border Region, so only
        // while the front stands (uneasy or working), not in 1936.
        {
          any: [
            { kind: "has_spirit", id: "chn_sp_front_uneasy" },
            { kind: "has_spirit", id: "chn_sp_front_solid" },
          ],
        },
        { kind: "ruling", ideology: "neutral" },
      ],
    },
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      {
        kind: "if",
        cond: { kind: "has_spirit", id: "chn_sp_front_solid" },
        then: [
          {
            kind: "swap_spirit",
            from: "chn_sp_front_solid",
            to: "chn_sp_front_uneasy",
          },
        ],
      },
      { kind: "popularity", ideology: "communist", pp: -2 },
      { kind: "opinion", of: { tag: "CCP" }, value: -20, days: 365 },
      { kind: "bop", amount: -30 },
      { kind: "fire_event", id: "ccp_ev_blockade", to: { tag: "CCP" } },
    ],
    ai: {
      base: 4,
      mods: [{ if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 50 }],
    },
  },
  {
    id: "chn_dec_print_money",
    category: "economy",
    for: ["CHN"],
    available: {
      all: [
        { kind: "at_war" },
        { not: { kind: "has_spirit", id: "chn_sp_inflation" } },
      ],
    },
    cooldownDays: 365,
    effects: [
      { kind: "pp", amount: 60 },
      { kind: "add_spirit", id: "chn_sp_inflation", days: 365 },
    ],
    ai: { base: 5, mods: [{ if: { kind: "pp_ge", amount: 50 }, factor: 0 }] },
  },
  {
    id: "chn_dec_tungsten_to_germany",
    category: "economy",
    for: ["CHN"],
    locked: true,
    available: {
      all: [
        {
          all: [
            { kind: "exists", who: { tag: "DEU" } },
            { not: { kind: "at_war_with", of: { tag: "DEU" } } },
          ],
        },
        { kind: "has_spirit", id: "chn_sp_hapro" },
      ],
    },
    cost: { pp: 25 },
    cooldownDays: 240,
    effects: [
      { kind: "opinion", of: { tag: "DEU" }, value: 15, days: 365 },
      { kind: "equipment", type: "anti_tank", gen: 1, count: 100 },
      { kind: "equipment", type: "artillery", gen: 1, count: 150 },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 200 }],
    },
  },
  {
    id: "chn_dec_tungsten_to_america",
    category: "economy",
    for: ["CHN"],
    available: {
      all: [
        {
          all: [
            { kind: "exists", who: { tag: "USA" } },
            { not: { kind: "at_war_with", of: { tag: "USA" } } },
          ],
        },
        { kind: "focus_done", id: "chn_tungsten_monopoly" },
      ],
    },
    cost: { pp: 25 },
    cooldownDays: 240,
    effects: [
      { kind: "opinion", of: { tag: "USA" }, value: 15, days: 365 },
      { kind: "equipment", type: "motorized", gen: 1, count: 150 },
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 1000 },
    ],
    ai: {
      base: 8,
      mods: [{ if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 200 }],
    },
  },
  {
    id: "chn_dec_provincial_armies",
    category: "military",
    for: ["CHN"],
    available: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "ruling", ideology: "neutral" },
      ],
    },
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "bop", amount: 60 },
      {
        kind: "divisions",
        template: "chn_trained_division",
        count: 2,
        where: "capital",
      },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "bop_range", tag: "CHN", band: 4 }, factor: 0 }],
    },
  },
  {
    id: "chn_dec_new_life_rally",
    category: "political",
    for: ["CHN"],
    available: {
      all: [
        { kind: "focus_done", id: "chn_new_life_drive" },
        { not: { kind: "stability_ge", pct: 55 } },
      ],
    },
    cost: { pp: 40 },
    cooldownDays: 300,
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "war_support", pct: 1 },
    ],
    ai: { base: 8 },
  },
];
