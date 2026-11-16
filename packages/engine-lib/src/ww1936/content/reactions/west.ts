// ww229 MR2 (design ww227 §7, "Majors' reactions"): the United Kingdom,
// France, the United States and Japan answer what the minors of the Low
// Countries, Iberia, Latin America, China and Manchukuo and the Dominions
// do with their new national trees (a bloc, a union, a restoration, a turn
// to another ideology, an oil or ore deal), and the minors answer the
// majors' new demands. Data only (ContentPurity); registry.ts joins it after
// the minors' content, so none of it reaches the Imjin War.
//
// World events: a triggered event per minor's act, checked by the majors it
// concerns. The AI picks by the major's government and its situation
// (threat, war, faction); nothing here is the "historical" option: these
// are the games that leave history (hoi-history-as-flavor).
// Answer events: fired by the majors' new decisions (from = the major); the
// AI minor answers by its character (lean) and its situation.
import { all, any, exists, fire, flag, not, T } from "../helpers";
import type { Condition, DecisionDef, Effect, EventDef } from "../types";

// ---- the chooser's government ----
const DEM: Condition = { kind: "ruling", ideology: "democratic" };
const COM: Condition = { kind: "ruling", ideology: "communist" };
const FAS: Condition = { kind: "ruling", ideology: "fascist" };
const NEU: Condition = { kind: "ruling", ideology: "neutral" };

// ---- the minors' acts (their focus ids and flags as they are) ----
const NLD_BENELUX: Condition = {
  kind: "focus_done",
  who: T("NLD"),
  id: "nld_benelux",
};
const BEL_LOWLANDS: Condition = {
  kind: "focus_done",
  who: T("BEL"),
  id: "bel_low_countries_united",
};
const NLD_GREATER: Condition = {
  kind: "focus_done",
  who: T("NLD"),
  id: "nld_greater_netherlands",
};
const PRT_IBERIA: Condition = {
  kind: "focus_done",
  who: T("PRT"),
  id: "prt_iberian_union",
};
const ESN_IBERIA: Condition = {
  kind: "focus_done",
  who: T("ESN"),
  id: "esn_iberian_crown",
};
const ESR_IBERIA: Condition = {
  kind: "focus_done",
  who: T("ESR"),
  id: "esr_iberian_republic",
};
const ESN_GIBRALTAR: Condition = {
  kind: "focus_done",
  who: T("ESN"),
  id: "esn_gibraltar_claim",
};
const WOLFRAM_TO_DEU: Condition = any(
  { kind: "has_spirit", who: T("PRT"), id: "prt_german_contracts" },
  { kind: "decision_taken", who: T("ESN"), id: "esn_wolfram_to_germany" },
);
const ABC_FORMED: Condition = any(
  { kind: "gflag", flag: "bra_abc_pact_formed" },
  { kind: "focus_done", who: T("ARG"), id: "arg_abc_pact" },
);
const BRA_AXIS: Condition = {
  kind: "flag",
  who: T("BRA"),
  flag: "bra_axis_course",
};
const BRA_EMPIRE: Condition = {
  kind: "flag",
  who: T("BRA"),
  flag: "bra_empire_restored",
};
const ARG_FASCIST: Condition = {
  kind: "ruling",
  who: T("ARG"),
  ideology: "fascist",
};
const ARG_MALVINAS: Condition = {
  kind: "focus_done",
  who: T("ARG"),
  id: "arg_malvinas_ultimatum",
};
const MEX_RED: Condition = {
  kind: "ruling",
  who: T("MEX"),
  ideology: "communist",
};
const MEX_OIL_AXIS: Condition = any(
  { kind: "flag", who: T("MEX"), flag: "mex_oil_deu" },
  { kind: "flag", who: T("MEX"), flag: "mex_oil_ita" },
  { kind: "flag", who: T("MEX"), flag: "mex_oil_jpn" },
);
const MEX_ISTHMUS: Condition = {
  kind: "focus_done",
  who: T("MEX"),
  id: "mex_isthmus_league",
};
const MCK_THRONE: Condition = {
  kind: "focus_done",
  who: T("MCK"),
  id: "mck_dragon_throne",
};
const CHN_RED: Condition = {
  kind: "ruling",
  who: T("CHN"),
  ideology: "communist",
};
const CHN_AXIS: Condition = {
  kind: "focus_done",
  who: T("CHN"),
  id: "chn_axis_partner",
};
const ZAF_REPUBLIC: Condition = {
  kind: "focus_done",
  who: T("ZAF"),
  id: "zaf_neu_republic_proclaimed",
};
const AUS_AUSTRALASIA: Condition = {
  kind: "focus_done",
  who: T("AUS"),
  id: "aus_australasia",
};

/** The chooser fears Germany (the democracies' usual reason to act). */
const FEARS_DEU: Condition = { kind: "threat_ge", of: T("DEU"), pct: 30 };
/** The chooser fights Germany. */
const AT_WAR_DEU: Condition = { kind: "at_war_with", of: T("DEU") };

/** The answer option a minor takes to stay out of everything. */
const WATCH: Effect[] = [{ kind: "pp", amount: 10 }];

export const REACTION_EVENTS_WEST: EventDef[] = [
  // ---- the Low Countries ----
  {
    // A Benelux or a Low Countries union, whichever of the two made it.
    id: "mr_lowlands_united",
    kind: "country",
    receivers: ["GBR", "FRA", "DEU"],
    trigger: all(
      any(NLD_BENELUX, BEL_LOWLANDS),
      any(exists("NLD"), exists("BEL")),
    ),
    picture: "map",
    options: [
      {
        id: "a",
        effects: [
          {
            kind: "if",
            cond: NLD_BENELUX,
            then: [
              { kind: "guarantee", of: T("NLD") },
              { kind: "opinion", of: T("NLD"), value: 20, days: 730 },
            ],
            else: [
              { kind: "guarantee", of: T("BEL") },
              { kind: "opinion", of: T("BEL"), value: 20, days: 730 },
            ],
          },
        ],
        ai: {
          base: 40,
          mods: [
            { if: FEARS_DEU, factor: 200 },
            { if: FAS, factor: 5 },
            { if: COM, factor: 30 },
          ],
        },
      },
      {
        id: "b",
        effects: [
          {
            kind: "if",
            cond: NLD_BENELUX,
            then: [
              {
                kind: "send_equipment",
                to: T("NLD"),
                type: "infantry_equipment",
                count: 800,
              },
              {
                kind: "research_bonus",
                who: T("NLD"),
                branch: "infantry",
                pct: 50,
                uses: 1,
              },
              { kind: "opinion", of: T("NLD"), value: 15, days: 730 },
            ],
            else: [
              {
                kind: "send_equipment",
                to: T("BEL"),
                type: "infantry_equipment",
                count: 800,
              },
              {
                kind: "research_bonus",
                who: T("BEL"),
                branch: "infantry",
                pct: 50,
                uses: 1,
              },
              { kind: "opinion", of: T("BEL"), value: 15, days: 730 },
            ],
          },
        ],
        ai: { base: 30, mods: [{ if: FAS, factor: 50 }] },
      },
      {
        id: "c",
        effects: [
          {
            kind: "if",
            cond: NLD_BENELUX,
            then: [
              { kind: "war_goal", on: T("NLD"), type: "conquer" },
              { kind: "opinion", of: T("NLD"), value: -30, days: 730 },
            ],
            else: [
              { kind: "war_goal", on: T("BEL"), type: "conquer" },
              { kind: "opinion", of: T("BEL"), value: -30, days: 730 },
            ],
          },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 2,
          mods: [
            { if: FAS, factor: 1500 },
            { if: { kind: "tag", tag: "DEU" }, factor: 200 },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // A fascist Netherlands takes Flanders: Belgium is the next victim.
    id: "mr_greater_netherlands",
    kind: "country",
    receivers: ["GBR", "FRA", "DEU"],
    trigger: all(NLD_GREATER, exists("NLD")),
    picture: "border",
    options: [
      {
        id: "a",
        effects: [
          { kind: "guarantee", of: T("BEL") },
          { kind: "war_goal", on: T("NLD"), type: "topple" },
          { kind: "opinion", of: T("NLD"), value: -40, days: 1095 },
        ],
        ai: {
          base: 30,
          mods: [
            { if: DEM, factor: 200 },
            { if: FAS, factor: 0 },
          ],
        },
      },
      {
        id: "b",
        effects: [
          {
            kind: "send_equipment",
            to: T("BEL"),
            type: "infantry_equipment",
            count: 1000,
          },
          { kind: "opinion", of: T("BEL"), value: 20, days: 730 },
          { kind: "opinion", of: T("NLD"), value: -20, days: 730 },
        ],
        ai: { base: 30, mods: [{ if: FAS, factor: 0 }] },
      },
      {
        id: "c",
        effects: [
          { kind: "opinion", of: T("NLD"), value: 30, days: 1095 },
          { kind: "invite", of: T("NLD") },
        ],
        ai: {
          base: 2,
          mods: [{ if: FAS, factor: 2000 }],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  // ---- Iberia ----
  {
    // One crown or one republic for the whole peninsula, whoever made it.
    id: "mr_iberian_union",
    kind: "country",
    receivers: ["GBR", "FRA", "ITA", "DEU", "SUN"],
    trigger: any(
      all(PRT_IBERIA, exists("PRT")),
      all(ESN_IBERIA, exists("ESN")),
      all(ESR_IBERIA, exists("ESR")),
    ),
    picture: "map",
    options: [
      {
        // Recognise the new state and court it.
        id: "a",
        effects: [
          {
            kind: "if",
            cond: PRT_IBERIA,
            then: [
              { kind: "opinion", of: T("PRT"), value: 25, days: 1095 },
              {
                kind: "send_equipment",
                to: T("PRT"),
                type: "infantry_equipment",
                count: 600,
              },
            ],
            else: [
              {
                kind: "if",
                cond: ESN_IBERIA,
                then: [
                  { kind: "opinion", of: T("ESN"), value: 25, days: 1095 },
                  {
                    kind: "send_equipment",
                    to: T("ESN"),
                    type: "infantry_equipment",
                    count: 600,
                  },
                ],
                else: [
                  { kind: "opinion", of: T("ESR"), value: 25, days: 1095 },
                  {
                    kind: "send_equipment",
                    to: T("ESR"),
                    type: "infantry_equipment",
                    count: 600,
                  },
                ],
              },
            ],
          },
        ],
        ai: {
          base: 20,
          mods: [
            { if: all(DEM, PRT_IBERIA), factor: 300 },
            { if: all(FAS, ESN_IBERIA), factor: 400 },
            { if: all(COM, ESR_IBERIA), factor: 400 },
          ],
        },
      },
      {
        // Guarantee it against its neighbours and its rivals.
        id: "b",
        effects: [
          {
            kind: "if",
            cond: PRT_IBERIA,
            then: [{ kind: "guarantee", of: T("PRT") }],
            else: [
              {
                kind: "if",
                cond: ESN_IBERIA,
                then: [{ kind: "guarantee", of: T("ESN") }],
                else: [{ kind: "guarantee", of: T("ESR") }],
              },
            ],
          },
        ],
        ai: {
          base: 10,
          mods: [
            { if: all(DEM, PRT_IBERIA), factor: 300 },
            { if: all(FAS, ESN_IBERIA), factor: 200 },
            { if: all(COM, ESR_IBERIA), factor: 200 },
          ],
        },
      },
      {
        // Oppose it: a war goal to bring its government down.
        id: "c",
        effects: [
          {
            kind: "if",
            cond: PRT_IBERIA,
            then: [{ kind: "war_goal", on: T("PRT"), type: "topple" }],
            else: [
              {
                kind: "if",
                cond: ESN_IBERIA,
                then: [{ kind: "war_goal", on: T("ESN"), type: "topple" }],
                else: [{ kind: "war_goal", on: T("ESR"), type: "topple" }],
              },
            ],
          },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 3,
          mods: [
            { if: all(FAS, ESR_IBERIA), factor: 1000 },
            { if: all(COM, ESN_IBERIA), factor: 600 },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // Spain names Gibraltar as its goal: London answers on the Rock.
    id: "mr_gibraltar_pressed",
    kind: "country",
    receivers: ["GBR"],
    trigger: all(
      ESN_GIBRALTAR,
      exists("ESN"),
      not({ kind: "at_war_with", of: T("ESN") }),
    ),
    picture: "border",
    options: [
      {
        id: "a",
        effects: [
          { kind: "fort", where: { group: "gibraltar" }, amount: 2 },
          { kind: "war_support", pct: 3 },
        ],
        ai: { base: 40, mods: [{ if: { kind: "at_war" }, factor: 150 }] },
      },
      {
        // Buy its neutrality with oil and wheat.
        id: "b",
        effects: [
          { kind: "fuel", who: T("ESN"), amount: 4000 },
          { kind: "pp", amount: -25 },
          { kind: "opinion", who: T("ESN"), of: "self", value: 25, days: 730 },
          { kind: "opinion", of: T("ESN"), value: 10, days: 730 },
        ],
        ai: { base: 40, mods: [{ if: AT_WAR_DEU, factor: 200 }] },
      },
      {
        id: "c",
        effects: [
          { kind: "war_goal", on: T("ESN"), type: "topple" },
          { kind: "opinion", of: T("ESN"), value: -30, days: 730 },
        ],
        ai: {
          base: 5,
          mods: [
            { if: AT_WAR_DEU, factor: 50 },
            {
              if: { kind: "strength_ratio_ge", vs: T("ESN"), permille: 3000 },
              factor: 200,
            },
          ],
        },
      },
    ],
  },
  {
    // Lisbon or Madrid sells its wolfram to Germany.
    id: "mr_wolfram_to_germany",
    kind: "country",
    receivers: ["GBR", "USA"],
    trigger: all(WOLFRAM_TO_DEU, not(FAS)),
    picture: "factory",
    options: [
      {
        // Pre-emptive buying: outbid Berlin at any price.
        id: "a",
        effects: [
          { kind: "pp", amount: -30 },
          { kind: "remove_spirit", who: T("PRT"), id: "prt_german_contracts" },
          { kind: "opinion", who: T("PRT"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("ESN"), of: "self", value: 10, days: 365 },
        ],
        ai: {
          base: 30,
          mods: [
            { if: AT_WAR_DEU, factor: 300 },
            { if: { kind: "pp_ge", amount: 60 }, factor: 150 },
          ],
        },
      },
      {
        // Squeeze them: no oil through our blockade while it lasts.
        id: "b",
        effects: [
          { kind: "opinion", of: T("PRT"), value: -15, days: 365 },
          { kind: "opinion", of: T("ESN"), value: -15, days: 365 },
          { kind: "opinion", who: T("PRT"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("ESN"), of: "self", value: -15, days: 365 },
          { kind: "fuel", who: T("ESN"), amount: -2000 },
        ],
        ai: { base: 20, mods: [{ if: AT_WAR_DEU, factor: 200 }] },
      },
      { id: "c", effects: WATCH, ai: { base: 30 } },
    ],
  },
  // ---- Latin America ----
  {
    // Brazil and Argentina form the ABC bloc.
    id: "mr_abc_bloc",
    kind: "country",
    receivers: ["USA", "GBR", "DEU"],
    trigger: all(ABC_FORMED, any(exists("BRA"), exists("ARG"))),
    picture: "table",
    options: [
      {
        // Welcome it as a partner of the hemisphere's defence.
        id: "a",
        effects: [
          { kind: "opinion", of: T("BRA"), value: 20, days: 730 },
          { kind: "opinion", of: T("ARG"), value: 20, days: 730 },
          { kind: "opinion", who: T("BRA"), of: "self", value: 15, days: 730 },
          { kind: "opinion", who: T("ARG"), of: "self", value: 15, days: 730 },
          {
            kind: "research_bonus",
            who: T("BRA"),
            branch: "industry",
            pct: 50,
            uses: 1,
          },
        ],
        ai: {
          base: 30,
          mods: [
            { if: { kind: "tag", tag: "USA" }, factor: 200 },
            { if: FAS, factor: 50 },
          ],
        },
      },
      {
        // Court Brazil and split the bloc.
        id: "b",
        effects: [
          { kind: "opinion", of: T("BRA"), value: 30, days: 730 },
          { kind: "opinion", who: T("BRA"), of: "self", value: 20, days: 730 },
          { kind: "opinion", of: T("ARG"), value: -15, days: 730 },
          {
            kind: "send_equipment",
            to: T("BRA"),
            type: "infantry_equipment",
            count: 800,
          },
        ],
        ai: { base: 25 },
      },
      {
        // A rival bloc in our sphere: freeze its trade.
        id: "c",
        effects: [
          { kind: "embargo", on: T("ARG") },
          { kind: "opinion", of: T("ARG"), value: -25, days: 730 },
          { kind: "opinion", of: T("BRA"), value: -15, days: 730 },
          { kind: "tension", pct: 1 },
        ],
        ai: {
          base: 5,
          mods: [
            {
              if: { kind: "ruling", who: T("ARG"), ideology: "fascist" },
              factor: 400,
            },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  {
    // Rio leans to Berlin: the Good Neighbour is tested.
    id: "mr_brazil_axis_course",
    kind: "country",
    receivers: ["USA", "GBR"],
    trigger: all(
      BRA_AXIS,
      exists("BRA"),
      not({ kind: "same_faction", of: T("BRA") }),
    ),
    picture: "newspaper",
    options: [
      {
        // Outbid Berlin: a steel loan and arms.
        id: "a",
        effects: [
          {
            kind: "research_bonus",
            who: T("BRA"),
            branch: "industry",
            pct: 100,
            uses: 1,
          },
          {
            kind: "send_equipment",
            to: T("BRA"),
            type: "infantry_equipment",
            count: 1000,
          },
          { kind: "opinion", who: T("BRA"), of: "self", value: 30, days: 1095 },
          {
            kind: "opinion",
            who: T("BRA"),
            of: T("DEU"),
            value: -15,
            days: 730,
          },
        ],
        ai: { base: 50, mods: [{ if: FAS, factor: 0 }] },
      },
      {
        id: "b",
        effects: [
          { kind: "embargo", on: T("BRA") },
          { kind: "opinion", of: T("BRA"), value: -25, days: 730 },
        ],
        ai: { base: 15, mods: [{ if: AT_WAR_DEU, factor: 200 }] },
      },
      {
        id: "c",
        effects: [
          { kind: "war_goal", on: T("BRA"), type: "topple" },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 2,
          mods: [
            {
              if: all(AT_WAR_DEU, {
                kind: "same_faction",
                who: T("BRA"),
                of: T("DEU"),
              }),
              factor: 2500,
            },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  {
    // A Brazilian emperor again.
    id: "mr_brazil_empire",
    kind: "country",
    receivers: ["USA", "GBR", "FRA"],
    trigger: all(BRA_EMPIRE, exists("BRA")),
    picture: "crowd",
    options: [
      {
        id: "a",
        effects: [
          { kind: "opinion", of: T("BRA"), value: 15, days: 730 },
          { kind: "opinion", who: T("BRA"), of: "self", value: 15, days: 730 },
        ],
        ai: { base: 40, mods: [{ if: COM, factor: 0 }] },
      },
      {
        // Withhold recognition until it holds elections.
        id: "b",
        effects: [
          { kind: "opinion", of: T("BRA"), value: -15, days: 730 },
          { kind: "opinion", who: T("BRA"), of: "self", value: -15, days: 730 },
          { kind: "popularity", who: T("BRA"), ideology: "democratic", pp: 3 },
        ],
        ai: { base: 25, mods: [{ if: DEM, factor: 150 }] },
      },
      { id: "c", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // Buenos Aires turns fascist (the GOU, the Nacionalistas or a war).
    id: "mr_argentina_fascist",
    kind: "country",
    receivers: ["USA", "GBR"],
    trigger: all(ARG_FASCIST, exists("ARG"), not(FAS)),
    picture: "crowd",
    options: [
      {
        // Recognise it; the beef and the grain matter more.
        id: "a",
        effects: [
          { kind: "opinion", who: T("ARG"), of: "self", value: 10, days: 730 },
          { kind: "pp", amount: 10 },
        ],
        ai: {
          base: 30,
          mods: [
            { if: { kind: "tag", tag: "GBR" }, factor: 200 },
            { if: AT_WAR_DEU, factor: 30 },
          ],
        },
      },
      {
        // Freeze its gold and its trade.
        id: "b",
        effects: [
          { kind: "embargo", on: T("ARG") },
          { kind: "opinion", of: T("ARG"), value: -30, days: 1095 },
        ],
        ai: {
          base: 20,
          mods: [
            { if: { kind: "tag", tag: "USA" }, factor: 200 },
            { if: AT_WAR_DEU, factor: 200 },
          ],
        },
      },
      {
        // Arm its neighbour instead.
        id: "c",
        effects: [
          { kind: "guarantee", of: T("BRA") },
          {
            kind: "send_equipment",
            to: T("BRA"),
            type: "infantry_equipment",
            count: 800,
          },
          { kind: "opinion", of: T("BRA"), value: 20, days: 730 },
        ],
        ai: {
          base: 15,
          mods: [
            {
              if: { kind: "ruling", who: T("BRA"), ideology: "fascist" },
              factor: 0,
            },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 15 } },
    ],
  },
  {
    // Britain's Falklands are claimed with a war goal.
    id: "mr_malvinas_ultimatum",
    kind: "country",
    receivers: ["GBR"],
    trigger: all(
      ARG_MALVINAS,
      exists("ARG"),
      not({ kind: "at_war_with", of: T("ARG") }),
    ),
    picture: "border",
    options: [
      {
        // Send the fleet south and answer in kind.
        id: "a",
        effects: [
          { kind: "war_goal", on: T("ARG"), type: "conquer" },
          { kind: "war_support", pct: 5 },
          { kind: "opinion", of: T("ARG"), value: -40, days: 1095 },
        ],
        ai: {
          base: 40,
          mods: [
            { if: { kind: "at_war" }, factor: 30 },
            { if: { kind: "navy_size", min: 20 }, factor: 150 },
          ],
        },
      },
      {
        // Talk: a joint commission on the islands.
        id: "b",
        effects: [
          { kind: "opinion", who: T("ARG"), of: "self", value: 20, days: 730 },
          { kind: "stability", pct: -3 },
        ],
        ai: { base: 25, mods: [{ if: { kind: "at_war" }, factor: 300 }] },
      },
      {
        // Ask Washington to mediate under the Monroe Doctrine.
        id: "c",
        effects: [
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 730 },
          {
            kind: "opinion",
            who: T("USA"),
            of: T("ARG"),
            value: -15,
            days: 730,
          },
          { kind: "opinion", of: T("ARG"), value: -10, days: 730 },
        ],
        ai: {
          base: 25,
          mods: [{ if: { kind: "exists", who: T("USA") }, factor: 100 }],
        },
      },
    ],
  },
  {
    // Mexico City goes red.
    id: "mr_mexico_red",
    kind: "country",
    receivers: ["USA", "GBR", "SUN"],
    trigger: all(MEX_RED, exists("MEX"), not(COM)),
    picture: "crowd",
    options: [
      {
        // Live with it: the Good Neighbour does not land Marines.
        id: "a",
        effects: [
          { kind: "opinion", who: T("MEX"), of: "self", value: 15, days: 730 },
          { kind: "stability", pct: -2 },
        ],
        ai: { base: 40, mods: [{ if: FAS, factor: 20 }] },
      },
      {
        id: "b",
        effects: [
          { kind: "embargo", on: T("MEX") },
          { kind: "opinion", of: T("MEX"), value: -30, days: 1095 },
        ],
        ai: { base: 25 },
      },
      {
        id: "c",
        effects: [
          { kind: "war_goal", on: T("MEX"), type: "topple" },
          { kind: "tension", pct: 3 },
        ],
        ai: {
          base: 3,
          mods: [
            { if: FAS, factor: 1000 },
            { if: { kind: "tag", tag: "USA" }, factor: 200 },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  {
    // A red Mexico as Moscow sees it (and every communist major).
    id: "mr_mexico_red_comrades",
    kind: "country",
    receivers: ["SUN", "USA", "GBR", "FRA"],
    trigger: all(MEX_RED, exists("MEX"), COM),
    picture: "crowd",
    options: [
      {
        // Volunteers, arms and advisers.
        id: "a",
        effects: [
          { kind: "opinion", of: T("MEX"), value: 40, days: 1095 },
          {
            kind: "send_equipment",
            to: T("MEX"),
            type: "infantry_equipment",
            count: 1000,
          },
          {
            kind: "research_bonus",
            who: T("MEX"),
            branch: "doctrine",
            pct: 50,
            uses: 1,
          },
        ],
        ai: { base: 50 },
      },
      {
        id: "b",
        effects: [{ kind: "opinion", of: T("MEX"), value: 20, days: 730 }],
        ai: { base: 30 },
      },
    ],
  },
  {
    // Mexican oil goes to the Axis.
    id: "mr_mexican_oil_axis",
    kind: "country",
    receivers: ["USA", "GBR"],
    trigger: all(MEX_OIL_AXIS, exists("MEX"), not(FAS)),
    picture: "factory",
    options: [
      {
        // Buy it ourselves at the Axis price.
        id: "a",
        effects: [
          { kind: "pp", amount: -25 },
          { kind: "fuel", amount: 10_000 },
          { kind: "opinion", who: T("MEX"), of: "self", value: 20, days: 730 },
        ],
        ai: { base: 40, mods: [{ if: AT_WAR_DEU, factor: 200 }] },
      },
      {
        id: "b",
        effects: [
          { kind: "embargo", on: T("MEX") },
          { kind: "opinion", of: T("MEX"), value: -25, days: 730 },
        ],
        ai: { base: 25 },
      },
      { id: "c", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // Mexico leads a league of the isthmus.
    id: "mr_isthmus_league",
    kind: "country",
    receivers: ["USA", "GBR"],
    trigger: all(MEX_ISTHMUS, exists("MEX")),
    picture: "map",
    options: [
      {
        // Guarantee Panama and the canal.
        id: "a",
        effects: [
          { kind: "guarantee", of: T("PAN") },
          { kind: "opinion", of: T("PAN"), value: 20, days: 730 },
        ],
        ai: {
          base: 30,
          mods: [{ if: { kind: "tag", tag: "USA" }, factor: 200 }],
        },
      },
      {
        // Court Mexico: a partner, not a rival.
        id: "b",
        effects: [
          { kind: "opinion", of: T("MEX"), value: 20, days: 730 },
          { kind: "opinion", who: T("MEX"), of: "self", value: 20, days: 730 },
        ],
        ai: {
          base: 30,
          mods: [
            {
              if: { kind: "ruling", who: T("MEX"), ideology: "communist" },
              factor: 30,
            },
          ],
        },
      },
      {
        id: "c",
        effects: [
          { kind: "war_goal", on: T("MEX"), type: "topple" },
          { kind: "tension", pct: 2 },
        ],
        ai: { base: 2, mods: [{ if: FAS, factor: 1000 }] },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  // ---- China and Manchukuo ----
  {
    // Puyi sits on the dragon throne of a Great Qing.
    id: "mr_qing_throne",
    kind: "country",
    receivers: ["JPN", "USA", "GBR", "SUN"],
    trigger: all(MCK_THRONE, exists("MCK")),
    picture: "crowd",
    options: [
      {
        // Endorse the emperor.
        id: "a",
        effects: [
          { kind: "opinion", of: T("MCK"), value: 30, days: 1095 },
          { kind: "opinion", who: T("MCK"), of: "self", value: 20, days: 1095 },
          { kind: "stability", who: T("MCK"), pct: 5 },
        ],
        ai: {
          base: 5,
          mods: [
            {
              if: { kind: "subject_of", who: T("MCK"), of: "self" },
              factor: 1000,
            },
            { if: FAS, factor: 200 },
          ],
        },
      },
      {
        // Refuse to recognise a throne Japan set up.
        id: "b",
        effects: [
          { kind: "opinion", of: T("MCK"), value: -30, days: 1095 },
          { kind: "opinion", of: T("CHN"), value: 15, days: 730 },
          { kind: "opinion", who: T("CHN"), of: "self", value: 15, days: 730 },
        ],
        ai: {
          base: 40,
          mods: [
            {
              if: { kind: "subject_of", who: T("MCK"), of: "self" },
              factor: 0,
            },
          ],
        },
      },
      {
        id: "c",
        effects: [
          { kind: "war_goal", on: T("MCK"), type: "topple" },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 2,
          mods: [
            { if: COM, factor: 1000 },
            {
              if: { kind: "subject_of", who: T("MCK"), of: "self" },
              factor: 0,
            },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // Nanjing becomes a people's republic.
    id: "mr_china_red",
    kind: "country",
    receivers: ["USA", "GBR", "JPN", "SUN", "FRA"],
    trigger: all(CHN_RED, exists("CHN")),
    picture: "crowd",
    options: [
      {
        // Back it: arms and advisers for the new China.
        id: "a",
        effects: [
          { kind: "opinion", of: T("CHN"), value: 30, days: 1095 },
          {
            kind: "send_equipment",
            to: T("CHN"),
            type: "infantry_equipment",
            count: 1500,
          },
        ],
        ai: {
          base: 5,
          mods: [
            { if: COM, factor: 1500 },
            {
              if: { kind: "at_war_with", who: T("CHN"), of: T("JPN") },
              factor: 300,
            },
            { if: { kind: "tag", tag: "JPN" }, factor: 0 },
          ],
        },
      },
      {
        // Cut the credits and the arms.
        id: "b",
        effects: [
          { kind: "embargo", on: T("CHN") },
          { kind: "opinion", of: T("CHN"), value: -30, days: 1095 },
        ],
        ai: { base: 20, mods: [{ if: COM, factor: 0 }] },
      },
      {
        // Bring the red government down.
        id: "c",
        effects: [
          { kind: "war_goal", on: T("CHN"), type: "topple" },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 3,
          mods: [
            { if: { kind: "tag", tag: "JPN" }, factor: 1500 },
            { if: COM, factor: 0 },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 25 } },
    ],
  },
  {
    // Chiang (or whoever rules Nanjing) joins the Axis's side.
    id: "mr_china_axis",
    kind: "country",
    receivers: ["USA", "GBR", "JPN", "SUN"],
    trigger: all(CHN_AXIS, exists("CHN")),
    picture: "table",
    options: [
      {
        // Win it back with credits and arms.
        id: "a",
        effects: [
          { kind: "opinion", who: T("CHN"), of: "self", value: 20, days: 730 },
          {
            kind: "send_equipment",
            to: T("CHN"),
            type: "infantry_equipment",
            count: 1000,
          },
        ],
        ai: {
          base: 20,
          mods: [
            { if: DEM, factor: 200 },
            { if: { kind: "tag", tag: "JPN" }, factor: 0 },
          ],
        },
      },
      {
        // Cut the aid it no longer deserves.
        id: "b",
        effects: [
          { kind: "embargo", on: T("CHN") },
          { kind: "opinion", of: T("CHN"), value: -30, days: 1095 },
        ],
        ai: {
          base: 25,
          mods: [{ if: { kind: "tag", tag: "JPN" }, factor: 0 }],
        },
      },
      {
        // Welcome China into the camp, and end the war with it.
        id: "c",
        effects: [
          { kind: "opinion", of: T("CHN"), value: 30, days: 1095 },
          {
            kind: "if",
            cond: { kind: "at_war_with", of: T("CHN") },
            then: [{ kind: "end_war", of: T("CHN") }],
          },
        ],
        ai: {
          base: 3,
          mods: [
            { if: FAS, factor: 1500 },
            {
              if: { kind: "same_faction", who: T("CHN"), of: "self" },
              factor: 300,
            },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  // ---- the Dominions ----
  {
    // South Africa leaves the Crown and becomes a republic.
    id: "mr_cape_republic",
    kind: "country",
    receivers: ["GBR", "USA"],
    trigger: all(ZAF_REPUBLIC, exists("ZAF")),
    picture: "crowd",
    options: [
      {
        // Let it go in peace.
        id: "a",
        effects: [
          { kind: "opinion", who: T("ZAF"), of: "self", value: 15, days: 730 },
          { kind: "stability", pct: -3 },
        ],
        ai: { base: 40 },
      },
      {
        // Keep it close with gold and trade.
        id: "b",
        effects: [
          { kind: "pp", amount: -25 },
          { kind: "opinion", who: T("ZAF"), of: "self", value: 25, days: 1095 },
          { kind: "popularity", who: T("ZAF"), ideology: "democratic", pp: 3 },
        ],
        ai: {
          base: 30,
          mods: [{ if: { kind: "tag", tag: "GBR" }, factor: 150 }],
        },
      },
      {
        // Restore the Crown by force.
        id: "c",
        effects: [
          { kind: "war_goal", on: T("ZAF"), type: "topple" },
          { kind: "opinion", of: T("ZAF"), value: -40, days: 1095 },
        ],
        ai: {
          base: 2,
          mods: [
            {
              if: { kind: "same_faction", who: T("ZAF"), of: T("DEU") },
              factor: 3000,
            },
            { if: { kind: "tag", tag: "USA" }, factor: 0 },
          ],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 15 } },
    ],
  },
  {
    // Australia takes New Zealand into an Australasia.
    id: "mr_australasia",
    kind: "country",
    receivers: ["GBR", "USA", "JPN"],
    trigger: all(AUS_AUSTRALASIA, exists("AUS")),
    picture: "map",
    options: [
      {
        id: "a",
        effects: [
          { kind: "opinion", of: T("AUS"), value: 20, days: 730 },
          { kind: "opinion", who: T("AUS"), of: "self", value: 15, days: 730 },
        ],
        ai: {
          base: 40,
          mods: [{ if: { kind: "tag", tag: "JPN" }, factor: 20 }],
        },
      },
      {
        // Guarantee the new power in the South Pacific.
        id: "b",
        effects: [{ kind: "guarantee", of: T("AUS") }],
        ai: {
          base: 20,
          mods: [
            { if: { kind: "threat_ge", of: T("JPN"), pct: 30 }, factor: 300 },
            { if: { kind: "tag", tag: "JPN" }, factor: 0 },
          ],
        },
      },
      {
        // A rival across the southern sea: a war goal.
        id: "c",
        effects: [
          { kind: "war_goal", on: T("AUS"), type: "conquer" },
          { kind: "tension", pct: 2 },
        ],
        ai: {
          base: 2,
          mods: [{ if: { kind: "tag", tag: "JPN" }, factor: 1500 }],
        },
      },
      { id: "d", effects: WATCH, ai: { base: 20 } },
    ],
  },
  // ---- the minors' answers to the majors' new demands (from = the major) ----
  {
    // gbr_mr_navicerts: oil and wheat for staying out of the war.
    id: "mr_navicerts_offer",
    kind: "country",
    picture: "document",
    options: [
      {
        // Take the oil and stay out.
        id: "a",
        effects: [
          { kind: "fuel", amount: 4000 },
          { kind: "opinion", of: "from", value: 20, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: 15, days: 730 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
        ai: {
          base: 40,
          mods: [
            { if: { kind: "character", is: "neutral" }, factor: 200 },
            { if: flag("esn_axis_course"), factor: 30 },
            { if: { kind: "same_faction", of: T("DEU") }, factor: 0 },
          ],
        },
      },
      {
        // Take the oil, promise nothing.
        id: "b",
        effects: [
          { kind: "fuel", amount: 2000 },
          { kind: "opinion", who: "from", of: "self", value: -5, days: 365 },
        ],
        ai: {
          base: 30,
          mods: [{ if: { kind: "character", is: "opportunist" }, factor: 200 }],
        },
      },
      {
        // Refuse: Spain is no British client.
        id: "c",
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: "from", value: -20, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 730 },
        ],
        ai: {
          base: 10,
          mods: [
            { if: flag("esn_axis_course"), factor: 400 },
            { if: { kind: "character", is: "revisionist" }, factor: 300 },
          ],
        },
      },
    ],
  },
  {
    // fra_mr_belgian_alliance: Paris asks Brussels back into the alliance.
    id: "mr_belgian_alliance_offer",
    kind: "country",
    picture: "table",
    options: [
      {
        // Return to the French alliance.
        id: "a",
        effects: [
          { kind: "join_faction", of: "from" },
          { kind: "opinion", of: "from", value: 25, days: 1095 },
          { kind: "opinion", who: "from", of: "self", value: 25, days: 1095 },
        ],
        ai: {
          base: 15,
          mods: [
            {
              if: { kind: "at_war_with", who: T("DEU"), of: "from" },
              factor: 300,
            },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 50 }, factor: 200 },
            { if: { kind: "character", is: "neutral" }, factor: 60 },
          ],
        },
      },
      {
        // Keep the policy of independence.
        id: "b",
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
        ai: {
          base: 40,
          mods: [{ if: { kind: "character", is: "neutral" }, factor: 150 }],
        },
      },
      {
        // Secret staff talks, and the border open if the Germans come.
        id: "c",
        effects: [
          { kind: "access", of: "from" },
          { kind: "opinion", of: "from", value: 10, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: 10, days: 730 },
        ],
        ai: {
          base: 25,
          mods: [
            { if: { kind: "threat_ge", of: T("DEU"), pct: 30 }, factor: 200 },
          ],
        },
      },
    ],
  },
  {
    // usa_mr_hemisphere_aid: Washington offers arms, credits and bases.
    id: "mr_hemisphere_aid_offer",
    kind: "country",
    picture: "table",
    options: [
      {
        // Take the aid and open the bases.
        id: "a",
        effects: [
          { kind: "access", of: "from" },
          {
            kind: "send_equipment",
            who: "from",
            to: "self",
            type: "infantry_equipment",
            count: 1000,
          },
          { kind: "research_bonus", branch: "industry", pct: 50, uses: 1 },
          { kind: "opinion", of: "from", value: 20, days: 1095 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 1095 },
        ],
        ai: {
          base: 30,
          mods: [
            { if: { kind: "character", is: "client" }, factor: 300 },
            { if: { kind: "at_war_with", of: T("DEU") }, factor: 300 },
            { if: FAS, factor: 10 },
            { if: { kind: "character", is: "revisionist" }, factor: 30 },
          ],
        },
      },
      {
        // Take the arms, keep the bases and the neutrality.
        id: "b",
        effects: [
          {
            kind: "send_equipment",
            who: "from",
            to: "self",
            type: "infantry_equipment",
            count: 500,
          },
          { kind: "opinion", of: "from", value: 5, days: 730 },
        ],
        ai: {
          base: 30,
          mods: [
            { if: { kind: "character", is: "opportunist" }, factor: 200 },
            { if: { kind: "character", is: "neutral" }, factor: 150 },
          ],
        },
      },
      {
        // Refuse Yankee tutelage.
        id: "c",
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "opinion", of: "from", value: -15, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: -15, days: 730 },
        ],
        ai: {
          base: 10,
          mods: [
            { if: { kind: "character", is: "revisionist" }, factor: 400 },
            { if: FAS, factor: 400 },
            { if: COM, factor: 300 },
            { if: flag("bra_axis_course"), factor: 300 },
          ],
        },
      },
    ],
  },
  {
    // jpn_mr_demand_indies_oil: Tokyo asks the Indies for an oil quota.
    id: "mr_indies_oil_demand",
    kind: "country",
    picture: "document",
    options: [
      {
        // Sell a limited quota.
        id: "a",
        effects: [
          { kind: "add_spirit", id: "nld_oil_for_yen", days: 365 },
          { kind: "fuel", who: "from", amount: 20_000 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
        ],
        ai: {
          base: 40,
          mods: [
            { if: { kind: "same_faction", of: T("GBR") }, factor: 0 },
            { if: { kind: "same_faction", of: T("USA") }, factor: 0 },
            { if: flag("nld_assets_frozen"), factor: 0 },
            { if: { kind: "character", is: "neutral" }, factor: 150 },
          ],
        },
      },
      {
        // Refuse and freeze Japan's assets.
        id: "b",
        effects: [
          { kind: "set_flag", flag: "nld_assets_frozen" },
          { kind: "embargo", on: "from" },
          { kind: "opinion", of: "from", value: -30, days: 1095 },
          { kind: "opinion", who: "from", of: "self", value: -30, days: 1095 },
        ],
        ai: {
          base: 15,
          mods: [
            { if: { kind: "same_faction", of: T("GBR") }, factor: 400 },
            {
              if: { kind: "at_war_with", who: T("GBR"), of: "from" },
              factor: 400,
            },
          ],
        },
      },
      {
        // Stall, and call London and Washington.
        id: "c",
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 730 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 730 },
        ],
        ai: { base: 35 },
      },
    ],
  },
  {
    // jpn_mr_demand_north_china: autonomy for the northern provinces.
    id: "mr_north_china_demand",
    kind: "country",
    picture: "document",
    options: [
      {
        // Yield, to buy time.
        id: "a",
        effects: [
          { kind: "stability", pct: -8 },
          { kind: "war_support", pct: -5 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 730 },
          { kind: "pp", who: "from", amount: 50 },
        ],
        ai: {
          base: 25,
          mods: [
            {
              if: { kind: "strength_ratio_ge", vs: "from", permille: 600 },
              factor: 50,
            },
            { if: { kind: "character", is: "client" }, factor: 300 },
          ],
        },
      },
      {
        // Refuse: not one more province.
        id: "b",
        effects: [
          { kind: "war_support", pct: 8 },
          { kind: "opinion", of: "from", value: -30, days: 1095 },
          { kind: "war_goal", who: "from", on: "self", type: "conquer" },
        ],
        ai: {
          base: 35,
          mods: [
            { if: { kind: "stability_ge", pct: 50 }, factor: 150 },
            { if: { kind: "nap_with", of: T("CCP") }, factor: 150 },
          ],
        },
      },
      {
        // Appeal to the League and the powers.
        id: "c",
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 730 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 730 },
          { kind: "opinion", who: T("USA"), of: "from", value: -10, days: 730 },
        ],
        ai: {
          base: 30,
          mods: [{ if: { kind: "character", is: "status_quo" }, factor: 150 }],
        },
      },
    ],
  },
];

export const REACTION_DECISIONS_WEST: DecisionDef[] = [
  {
    id: "gbr_mr_navicerts",
    category: "diplomacy",
    for: ["GBR"],
    locked: true,
    available: all(
      exists("ESN"),
      not({ kind: "at_war_with", of: T("ESN") }),
      not({ kind: "same_faction", of: T("ESN") }),
      not({ kind: "in_faction", who: T("ESN") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [fire("mr_navicerts_offer", T("ESN"))],
    ai: {
      base: 10,
      mods: [
        { if: AT_WAR_DEU, factor: 300 },
        {
          if: { kind: "flag", who: T("ESN"), flag: "esn_axis_course" },
          factor: 200,
        },
      ],
    },
  },
  {
    id: "fra_mr_belgian_alliance",
    category: "diplomacy",
    for: ["FRA"],
    locked: true,
    available: all(
      exists("BEL"),
      { kind: "in_faction" },
      not({ kind: "at_war_with", of: T("BEL") }),
      not({ kind: "in_faction", who: T("BEL") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [fire("mr_belgian_alliance_offer", T("BEL"))],
    ai: { base: 10, mods: [{ if: FEARS_DEU, factor: 300 }] },
  },
  {
    id: "usa_mr_hemisphere_aid",
    category: "diplomacy",
    for: ["USA"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "BRA" },
          { kind: "tag", tag: "ARG" },
          { kind: "tag", tag: "MEX" },
          { kind: "tag", tag: "CHL" },
          { kind: "tag", tag: "COL" },
          { kind: "tag", tag: "VEN" },
          { kind: "tag", tag: "PER" },
          { kind: "tag", tag: "CUB" },
        ),
        not({ kind: "at_war_with", of: "self" }),
        not({ kind: "same_faction", of: "self" }),
      ),
    },
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [fire("mr_hemisphere_aid_offer", "target")],
    ai: {
      base: 10,
      mods: [
        { if: FEARS_DEU, factor: 200 },
        { if: AT_WAR_DEU, factor: 200 },
        { if: FAS, factor: 0 },
      ],
    },
  },
  {
    id: "jpn_mr_demand_indies_oil",
    category: "diplomacy",
    for: ["JPN"],
    locked: true,
    available: all(
      exists("NLD"),
      not({ kind: "at_war_with", of: T("NLD") }),
      not({ kind: "flag", who: T("NLD"), flag: "nld_assets_frozen" }),
    ),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [fire("mr_indies_oil_demand", T("NLD"))],
    ai: {
      base: 10,
      mods: [{ if: { kind: "fuel_ratio_below", pct: 50 }, factor: 300 }],
    },
  },
  {
    id: "jpn_mr_demand_north_china",
    category: "annexation",
    for: ["JPN"],
    locked: true,
    available: all(
      exists("CHN"),
      not({ kind: "at_war_with", of: T("CHN") }),
      not(DEM),
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [fire("mr_north_china_demand", T("CHN"))],
    ai: {
      base: 10,
      mods: [
        {
          if: { kind: "strength_ratio_ge", vs: T("CHN"), permille: 1500 },
          factor: 200,
        },
      ],
    },
  },
];
