// World War 1936 P3 (spec §13.3, §17.5, §19.7): the national decisions that
// open the annexation chains, pacts and guarantees (content lane K5). The
// German, Soviet and British ones start locked and their focuses open them
// (unlock_decision); Hungary, Bulgaria, Turkey and Poland use the generic
// tree, so theirs are gated by conditions instead. AI timing comes from the
// history beats in history.ts.
import { after, all, any, exists, fire, gflag, not, T } from "../helpers";
import type { Condition, DecisionDef } from "../types";

/** Romania has lost Bessarabia (by the ultimatum or in a war). */
const ROMANIA_LOST_BESSARABIA: Condition = any(
  gflag("bessarabia_lost"),
  not({ kind: "owns_group", who: T("ROU"), group: "bessarabia" }),
);

export const NATIONAL_DECISIONS: DecisionDef[] = [
  // ---- Germany ----
  {
    id: "deu_demand_austria",
    category: "annexation",
    for: ["DEU"],
    locked: true,
    available: all(
      exists("AUT"),
      not({ kind: "in_faction", who: T("AUT") }),
      not({ kind: "at_war", who: T("AUT") }),
    ),
    cost: { pp: 75 },
    effects: [fire("aut_berlin_ultimatum", T("AUT"))],
    ai: { base: 20 },
  },
  {
    id: "deu_demand_sudeten",
    category: "annexation",
    for: ["DEU"],
    locked: true,
    available: all(
      exists("CSK"),
      { kind: "owns_group", who: T("CSK"), group: "sudetenland" },
      not({ kind: "at_war_with", of: T("CSK") }),
    ),
    cost: { pp: 100 },
    // The Allied leader hosts the conference; with no Allies, a major that
    // guarantees Czechoslovakia does; with neither, Prague hears the terms alone.
    effects: [
      {
        kind: "if",
        cond: all(
          { kind: "exists", who: { factionLeaderOf: T("GBR") } },
          not({
            kind: "same_faction",
            who: { factionLeaderOf: T("GBR") },
            of: "self",
          }),
        ),
        then: [fire("gen_munich_conference", { factionLeaderOf: T("GBR") })],
        else: [
          {
            kind: "if",
            cond: { kind: "guaranteed_by", who: T("CSK"), of: T("GBR") },
            then: [fire("gen_munich_conference", T("GBR"))],
            else: [
              {
                kind: "if",
                cond: { kind: "guaranteed_by", who: T("CSK"), of: T("FRA") },
                then: [fire("gen_munich_conference", T("FRA"))],
                else: [
                  {
                    kind: "if",
                    cond: {
                      kind: "guaranteed_by",
                      who: T("CSK"),
                      of: T("SUN"),
                    },
                    then: [fire("gen_munich_conference", T("SUN"))],
                    else: [
                      {
                        kind: "if",
                        cond: {
                          kind: "guaranteed_by",
                          who: T("CSK"),
                          of: T("ITA"),
                        },
                        then: [fire("gen_munich_conference", T("ITA"))],
                        else: [
                          {
                            kind: "if",
                            cond: {
                              kind: "guaranteed_by",
                              who: T("CSK"),
                              of: T("USA"),
                            },
                            then: [fire("gen_munich_conference", T("USA"))],
                            else: [
                              {
                                kind: "if",
                                cond: {
                                  kind: "guaranteed_by",
                                  who: T("CSK"),
                                  of: T("JPN"),
                                },
                                then: [fire("gen_munich_conference", T("JPN"))],
                                else: [fire("csk_munich_dictate", T("CSK"))],
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
          },
        ],
      },
    ],
    ai: { base: 20 },
  },
  {
    id: "deu_demand_bohemia",
    category: "annexation",
    for: ["DEU"],
    locked: true,
    available: all(
      gflag("munich_done"),
      exists("CSK"),
      not({ kind: "at_war_with", of: T("CSK") }),
    ),
    cost: { pp: 100 },
    effects: [fire("csk_prague_ultimatum", T("CSK"))],
    ai: { base: 15 },
  },
  {
    id: "deu_demand_memel",
    category: "annexation",
    for: ["DEU"],
    locked: true,
    available: all(
      exists("LTU"),
      { kind: "owns_group", who: T("LTU"), group: "memel" },
      not({ kind: "at_war_with", of: T("LTU") }),
    ),
    cost: { pp: 50 },
    effects: [fire("ltu_memel_ultimatum", T("LTU"))],
    ai: { base: 15 },
  },
  {
    id: "deu_demand_danzig",
    category: "annexation",
    for: ["DEU"],
    locked: true,
    available: all(
      exists("POL"),
      exists("DZG"),
      not({ kind: "at_war_with", of: T("POL") }),
    ),
    cost: { pp: 50 },
    effects: [fire("pol_danzig_demand", T("POL"))],
    ai: { base: 10 },
  },
  {
    id: "deu_soviet_pact_proposal",
    category: "diplomacy",
    for: ["DEU"],
    locked: true,
    available: all(
      exists("SUN"),
      not(gflag("mr_secret_protocol")),
      not({ kind: "nap_with", of: T("SUN") }),
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    cost: { pp: 50 },
    effects: [fire("sun_mr_pact_offer", T("SUN"))],
    ai: { base: 10 },
  },
  {
    id: "deu_sign_tripartite",
    category: "diplomacy",
    for: ["DEU"],
    locked: true,
    available: all(exists("ITA"), exists("JPN"), not(gflag("tripartite"))),
    cost: { pp: 50 },
    effects: [
      fire("deu_tripartite_signing", T("ITA")),
      fire("deu_tripartite_signing", T("JPN")),
    ],
    ai: { base: 15 },
  },
  {
    // One card per Balkan candidate; Yugoslavia answers with its own event.
    id: "deu_invite_balkans",
    category: "diplomacy",
    for: ["DEU"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "HUN" },
          { kind: "tag", tag: "ROU" },
          { kind: "tag", tag: "BGR" },
          { kind: "tag", tag: "YUG" },
        ),
        not({ kind: "in_faction" }),
        not({ kind: "ruling", ideology: "democratic" }),
        not({ kind: "ruling", ideology: "communist" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    available: { kind: "in_faction" },
    cost: { pp: 25 },
    effects: [
      {
        kind: "if",
        cond: { kind: "tag", who: "target", tag: "YUG" },
        then: [fire("yug_tripartite", "target")],
        else: [fire("gen_diplo_faction_invite", "target")],
      },
    ],
    ai: { base: 10 },
  },
  // ---- Soviet Union ----
  {
    id: "sun_propose_pact",
    category: "diplomacy",
    for: ["SUN"],
    locked: true,
    available: all(
      exists("DEU"),
      not(gflag("mr_secret_protocol")),
      not({ kind: "nap_with", of: T("DEU") }),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    cost: { pp: 50 },
    effects: [fire("deu_mr_pact_offer", T("DEU"))],
    ai: { base: 5 },
  },
  {
    id: "sun_baltic_bases",
    category: "diplomacy",
    for: ["SUN"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "EST" },
          { kind: "tag", tag: "LVA" },
          { kind: "tag", tag: "LTU" },
        ),
        not({ kind: "in_faction" }),
        not({ kind: "at_war_with", of: "from" }),
        not({ kind: "has_access_from", who: "from", of: "self" }),
      ),
    },
    available: gflag("mr_secret_protocol"),
    cost: { pp: 25 },
    effects: [fire("bal_mutual_assistance", "target")],
    ai: { base: 10 },
  },
  {
    id: "sun_baltic_ultimatum",
    category: "annexation",
    for: ["SUN"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "EST" },
          { kind: "tag", tag: "LVA" },
          { kind: "tag", tag: "LTU" },
        ),
        not({ kind: "in_faction" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    available: all(
      gflag("mr_secret_protocol"),
      any({ kind: "capitulated", who: T("FRA") }, after("1940-06-01")),
    ),
    cost: { pp: 50 },
    effects: [fire("bal_soviet_ultimatum", "target")],
    ai: { base: 10 },
  },
  {
    id: "sun_demand_bessarabia",
    category: "annexation",
    for: ["SUN"],
    locked: true,
    available: all(
      exists("ROU"),
      { kind: "owns_group", who: T("ROU"), group: "bessarabia" },
      not({ kind: "at_war_with", of: T("ROU") }),
    ),
    cost: { pp: 50 },
    effects: [fire("rou_bessarabia_ultimatum", T("ROU"))],
    ai: { base: 10 },
  },
  {
    id: "sun_demand_karelia",
    category: "annexation",
    for: ["SUN"],
    locked: true,
    available: all(
      gflag("mr_secret_protocol"),
      exists("FIN"),
      { kind: "owns_group", who: T("FIN"), group: "karelian_isthmus" },
      not({ kind: "at_war_with", of: T("FIN") }),
    ),
    cost: { pp: 50 },
    effects: [fire("fin_soviet_demands", T("FIN"))],
    ai: { base: 10 },
  },
  {
    // Opened by fin_winter_war_flag when the Winter War starts.
    id: "sun_offer_finnish_peace",
    category: "diplomacy",
    for: ["SUN"],
    locked: true,
    available: all(
      { kind: "at_war_with", of: T("FIN") },
      { kind: "days_since_flag_ge", flag: "winter_war_fought", days: 90 },
      { kind: "controls_group", group: "karelian_isthmus" },
    ),
    cost: { pp: 25 },
    effects: [fire("fin_moscow_peace", T("FIN"))],
    ai: { base: 20 },
  },
  {
    id: "sun_aid_spain",
    category: "military",
    for: ["SUN"],
    locked: true,
    available: all(exists("ESR"), { kind: "at_war", who: T("ESR") }),
    cost: { pp: 50 },
    effects: [
      {
        kind: "send_equipment",
        to: T("ESR"),
        type: "infantry_equipment",
        count: 3000,
      },
      { kind: "send_equipment", to: T("ESR"), type: "artillery", count: 200 },
      { kind: "opinion", of: T("ESR"), value: 30, days: 1095 },
      { kind: "opinion", who: T("ESR"), of: "self", value: 30, days: 1095 },
    ],
    ai: { base: 10 },
  },
  // ---- United Kingdom ----
  {
    id: "gbr_guarantee_poland",
    category: "diplomacy",
    for: ["GBR"],
    locked: true,
    available: all(
      exists("POL"),
      not({ kind: "guarantees", of: T("POL") }),
      not({ kind: "at_war_with", of: T("POL") }),
    ),
    effects: [
      { kind: "guarantee", of: T("POL") },
      fire("fra_joins_guarantee", T("FRA")),
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_guarantee_romania_greece",
    category: "diplomacy",
    for: ["GBR"],
    locked: true,
    available: any(exists("ROU"), exists("GRC")),
    effects: [
      { kind: "guarantee", of: T("ROU") },
      { kind: "guarantee", of: T("GRC") },
      fire("fra_joins_guarantee", T("FRA")),
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_destroyers_for_bases",
    category: "national",
    for: ["GBR"],
    locked: true,
    available: all(
      exists("USA"),
      { kind: "at_war" },
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    cost: { pp: 25 },
    effects: [fire("usa_destroyers_for_bases", T("USA"))],
    ai: { base: 10 },
  },
  // ---- Generic-tree countries (no lock; conditions only) ----
  {
    id: "hun_request_arbitration",
    category: "annexation",
    for: ["HUN"],
    visible: gflag("munich_done"),
    available: all(
      gflag("munich_done"),
      exists("DEU"),
      exists("ITA"),
      exists("CSK"),
      { kind: "owns_group", who: T("CSK"), group: "south_slovakia" },
      not({ kind: "at_war_with", of: T("CSK") }),
    ),
    cost: { pp: 50 },
    effects: [fire("deu_vienna_award_1", T("DEU"))],
    ai: { base: 10 },
  },
  {
    id: "hun_request_transylvania",
    category: "annexation",
    for: ["HUN"],
    visible: ROMANIA_LOST_BESSARABIA,
    available: all(
      ROMANIA_LOST_BESSARABIA,
      exists("DEU"),
      exists("ROU"),
      { kind: "owns_group", who: T("ROU"), group: "north_transylvania" },
      { kind: "opinion_ge", who: T("DEU"), of: "self", value: 0 },
      not({ kind: "at_war_with", of: T("ROU") }),
    ),
    cost: { pp: 50 },
    effects: [fire("deu_vienna_award_2", T("DEU"))],
    ai: { base: 10 },
  },
  {
    id: "bgr_demand_dobruja",
    category: "annexation",
    for: ["BGR"],
    visible: ROMANIA_LOST_BESSARABIA,
    available: all(
      ROMANIA_LOST_BESSARABIA,
      exists("ROU"),
      { kind: "owns_group", who: T("ROU"), group: "south_dobruja" },
      not({ kind: "at_war_with", of: T("ROU") }),
    ),
    cost: { pp: 50 },
    effects: [fire("rou_dobruja", T("ROU"))],
    ai: { base: 10 },
  },
  {
    id: "tur_hatay_question",
    category: "annexation",
    for: ["TUR"],
    available: all(
      exists("FRA"),
      { kind: "owns_group", who: T("FRA"), group: "hatay" },
      not({ kind: "at_war_with", of: T("FRA") }),
    ),
    cost: { pp: 50 },
    effects: [fire("fra_hatay_cession", T("FRA"))],
    ai: { base: 10 },
  },
  {
    id: "pol_zaolzie_ultimatum",
    category: "annexation",
    for: ["POL"],
    visible: gflag("munich_done"),
    available: all(
      gflag("munich_done"),
      exists("CSK"),
      { kind: "owns_group", who: T("CSK"), group: "zaolzie" },
      not({ kind: "at_war_with", of: T("CSK") }),
    ),
    cost: { pp: 25 },
    effects: [fire("csk_zaolzie_ultimatum", T("CSK"))],
    ai: { base: 10 },
  },
];
