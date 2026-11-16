// ww229: Brazil's events. Triggered ones check the situation, never a day;
// the rest are fired by the tree (self = Brazil). Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, flag, not, T } from "../../helpers";

export const BRA_EVENTS: EventDef[] = [
  {
    // Fired by bra_cohen_plan: a forged communist plot, handed to the press.
    id: "bra_ev_cohen_plan",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "stability", pct: 2 },
          { kind: "bop", amount: -50 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by bra_hold_the_election: three candidates for the palace.
    id: "bra_ev_three_candidates",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 4 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "bop", amount: 100 },
        ],
      },
    ],
  },
  {
    // Fired by bra_ban_the_parties: the green shirts storm the palace by night.
    id: "bra_ev_palace_attack",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_flag", flag: "bra_putsch_crushed" },
          { kind: "bop", amount: -150 },
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "popularity", ideology: "fascist", pp: -1 },
          { kind: "opinion", who: T("PRT"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // The green shirts parade in Rio while the movement is still legal.
    id: "bra_ev_green_parade",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      not(flag("bra_aib_banned")),
      { kind: "pop_ge", ideology: "fascist", pct: 15 },
      not({ kind: "ruling", ideology: "fascist" }),
    ),
    mtthDays: 180,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Prestes before the National Security Tribunal.
    id: "bra_ev_prestes_trial",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      after("1936-06-01"),
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 300,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -3 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The warehouses are full and the price keeps falling.
    id: "bra_ev_coffee_glut",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(after("1937-01-01"), not({ kind: "at_war" })),
    mtthDays: 360,
    once: "never",
    cooldownDays: 720,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -20 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Berlin offers arms and machines for coffee and cotton, paid in
    // compensation marks.
    id: "bra_ev_compensation_offer",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      exists("DEU"),
      after("1936-06-01"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("bra_with_usa")),
    ),
    mtthDays: 200,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "pp", amount: 25 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Washington wants free trade and an end to the German barter.
    id: "bra_ev_washington_trade",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      exists("USA"),
      after("1936-09-01"),
      not({ kind: "at_war_with", of: T("USA") }),
      not(flag("bra_axis_course")),
    ),
    mtthDays: 240,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 20 },
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by bra_aranha_mission: the Foreign Minister in Washington.
    id: "bra_ev_aranha_in_washington",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
          { kind: "pp", amount: 15 },
        ],
      },
    ],
  },
  {
    // The Krupp guns are at sea when the blockade closes: the British stop
    // the freighter at Gibraltar.
    id: "bra_ev_arms_ship_seized",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      flag("bra_krupp_order"),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    mtthDays: 90,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "equipment", type: "artillery", gen: 1, count: 40 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -15, days: 365 },
          { kind: "pp", amount: -25 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // U-boats sink Brazilian freighters and liners off the coast.
    id: "bra_ev_ships_sunk",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
      not({ kind: "same_faction", of: T("DEU") }),
      not(flag("bra_axis_course")),
    ),
    mtthDays: 120,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "set_flag", flag: "bra_ships_sunk" },
          { kind: "war_support", pct: 10 },
          { kind: "opinion", of: T("DEU"), value: -40, days: 365 },
          { kind: "opinion", of: T("ITA"), value: -30, days: 365 },
          { kind: "unlock_decision", id: "lat_join_hemisphere" },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // The northeast's drought sends the hungry to the coast.
    id: "bra_ev_northeast_drought",
    kind: "country",
    receivers: ["BRA"],
    trigger: after("1937-01-01"),
    mtthDays: 500,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 55 },
        effects: [
          { kind: "pp", amount: -25 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 45 },
        effects: [
          {
            kind: "resource",
            where: { regions: [1119] },
            res: "rubber",
            amount: 1,
          },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The generals ask for their price when the regime is shaken.
    id: "bra_ev_generals_price",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      not({ kind: "stability_ge", pct: 45 }),
    ),
    mtthDays: 200,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "army_xp", amount: 5 },
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: -30 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
  {
    // The war is being won abroad for democracy; at home the dictatorship
    // looks out of date, and the generals know it.
    id: "bra_ev_generals_turn",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      flag("bra_estado_novo"),
      { kind: "ruling", ideology: "neutral" },
      after("1944-06-01"),
      any(
        { kind: "same_faction", of: T("USA") },
        { kind: "same_faction", of: T("GBR") },
      ),
    ),
    mtthDays: 240,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "remove_spirit", id: "bra_sp_estado_novo" },
          { kind: "clear_flag", flag: "bra_estado_novo" },
          { kind: "popularity", ideology: "democratic", pp: 10 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 5 },
          { kind: "stability", pct: -5 },
          { kind: "bop", amount: -100 },
        ],
      },
    ],
  },
  {
    // Fired by bra_expeditionary_force: "the snake is smoking".
    id: "bra_ev_snake_smokes",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "stability", pct: 2 }],
      },
    ],
  },
  {
    // Fired by bra_restore_the_empire: the crown returns to Rio.
    id: "bra_ev_crown_returns",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "popularity", ideology: "neutral", pp: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // Buenos Aires orders cruisers and destroyers abroad; the navy asks for
    // its answer.
    id: "bra_ev_plate_arms_race",
    kind: "country",
    receivers: ["BRA"],
    trigger: all(
      exists("ARG"),
      after("1937-01-01"),
      not({ kind: "same_faction", of: T("ARG") }),
    ),
    mtthDays: 420,
    picture: "map",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "navy_xp", amount: 5 },
          { kind: "pp", amount: -30 },
          { kind: "opinion", who: T("ARG"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "opinion", who: T("ARG"), of: "self", value: 15, days: 365 },
          { kind: "pp", amount: 15 },
        ],
      },
    ],
  },
  {
    // Fired by bra_abc_pact to Argentina and Chile: Rio asks for a common
    // front of the southern cone.
    id: "bra_ev_abc_invitation",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: {
          base: 50,
          mods: [{ if: { kind: "in_faction" }, factor: 0 }],
        },
        effects: [
          { kind: "opinion", of: T("BRA"), value: 20, days: 365 },
          {
            kind: "if",
            cond: all(not({ kind: "in_faction" }), {
              kind: "in_faction",
              who: T("BRA"),
            }),
            then: [{ kind: "join_faction", of: T("BRA") }],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [{ kind: "opinion", of: T("BRA"), value: -10, days: 365 }],
      },
    ],
  },
];
