// World War 1936 P5 (spec §19.1, §19.2): the endgame events of content lane
// K5 — the 1936-1939 events the endgame systems need, the 1940-1945 history
// events that Italy, Japan and France do not receive, and the six generic
// events the engine fires (gen_*).
//
// Who is who inside an event: self = the receiver, from = the sender (the
// decider, the beat's actor, or the event that fired it). A history beat
// delivers its event without looking at the trigger, so every beat event
// keeps its conditions on the options: the history option is open only when
// the receiver's situation matches, and a last option with no effects catches
// the rest. Collaborationist heads and the Iraqi coup leader appear by title
// only (spec §18.1-3, §19.5). The uprising events state the military facts
// only (spec §19.2, last line).
import { after, all, any, exists, fire, not, T } from "../helpers";
import type { Condition, EventDef } from "../types";

const POL_EXILE: Condition = { kind: "is_exile", who: T("POL") };
const YUG_EXILE: Condition = { kind: "is_exile", who: T("YUG") };
const GRC_EXILE: Condition = { kind: "is_exile", who: T("GRC") };
const FRA_EXILE: Condition = { kind: "is_exile", who: T("FRA") };
const SVK_DORMANT: Condition = {
  kind: "country_state",
  tag: "SVK",
  state: "dormant",
};
const HRV_DORMANT: Condition = {
  kind: "country_state",
  tag: "HRV",
  state: "dormant",
};
const RSI_DORMANT: Condition = {
  kind: "country_state",
  tag: "RSI",
  state: "dormant",
};

export const ENDGAME_EVENTS: EventDef[] = [
  // ---- 1936-1939: what the endgame systems need (spec §19.1) ----
  {
    id: "gbr_non_intervention_committee",
    kind: "country",
    picture: "table",
    date: { on: "1936-09-09", to: ["GBR", "FRA"] },
    trigger: { kind: "at_war_with", who: T("ESN"), of: T("ESR") },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "add_spirit", id: "gen_non_intervention", days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          {
            kind: "lend_lease",
            to: T("ESR"),
            item: "infantry_equipment",
            perMonth: 300,
          },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // The 1936-10-22 beat (actor ESR). Three brigades' worth of men and rifles:
    // the DSL has no generic infantry template for the divisions effect.
    id: "esr_international_brigades",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_international_brigades" },
          { kind: "manpower", amount: 30000 },
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1350,
          },
        ],
      },
    ],
  },
  {
    // Whichever side is left standing renames itself (spec §15.6). The P3
    // event esp_civil_war_won also fires and lifts the civil war spirit.
    id: "esp_civil_war_ends",
    kind: "country",
    picture: "crowd",
    receivers: ["ESN", "ESR"],
    trigger: all(
      not({ kind: "capitulated" }),
      any(
        all(
          { kind: "tag", tag: "ESN" },
          any({ kind: "capitulated", who: T("ESR") }, not(exists("ESR"))),
        ),
        all(
          { kind: "tag", tag: "ESR" },
          any({ kind: "capitulated", who: T("ESN") }, not(exists("ESN"))),
        ),
      ),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_esp_civil_war_ends" },
          { kind: "remove_spirit", id: "esp_civil_war_nation" },
          { kind: "stability", pct: 5 },
          {
            kind: "if",
            cond: { kind: "tag", tag: "ESN" },
            then: [{ kind: "set_name", key: "ww1936.rename.spain" }],
            else: [{ kind: "set_name", key: "ww1936.rename.spanish_republic" }],
          },
        ],
      },
    ],
  },
  {
    // The end of the Prague chain (P3 §17.5) and the 1939-03-14 beat.
    id: "svk_independence",
    kind: "country",
    picture: "document",
    receivers: ["DEU"],
    trigger: all({ kind: "owns_group", group: "slovakia" }, SVK_DORMANT),
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        available: all({ kind: "owns_group", group: "slovakia" }, SVK_DORMANT),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_slovak_state" },
          { kind: "release", tag: "SVK", as: "puppet", regions: "slovakia" },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    id: "deu_annex_west_poland",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        available: POL_EXILE,
        ai: { base: 90 },
        effects: [
          { kind: "tension", pct: 2 },
          { kind: "annex_occupied", group: "poland_german_annexed" },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    id: "sun_vilnius_to_lithuania",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "occupied_by", group: "vilnius", of: "self" },
          exists("LTU"),
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_vilnius_to_lithuania" },
          { kind: "access", who: T("LTU"), of: "self" },
          { kind: "annex_occupied", group: "vilnius", to: T("LTU") },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    id: "sun_annex_east_poland",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        available: POL_EXILE,
        ai: { base: 90 },
        effects: [
          { kind: "tension", pct: 2 },
          { kind: "annex_occupied", group: "poland_soviet_zone" },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },

  // ---- 1940 ----
  {
    // Fired by the British decision gbr_occupy_iceland (from = United Kingdom).
    id: "isl_british_occupation",
    kind: "country",
    picture: "column",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_iceland_occupied" },
          { kind: "access", of: "from" },
          { kind: "opinion", of: "from", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", of: "from", value: -40, days: 365 },
          { kind: "war_goal", who: "from", on: "self", type: "conquer" },
        ],
      },
    ],
  },
  {
    // The 1940-11-28 beat (actor Siam). The ceded strip is not a region on
    // the v2 map, so the claim group may be empty (groups.ts).
    id: "tha_border_war",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "country_state", tag: "VIC", state: "active" },
          not({ kind: "at_war_with", of: T("VIC") }),
        ),
        ai: { base: 80 },
        effects: [
          {
            kind: "war_goal",
            on: T("VIC"),
            type: "claim",
            group: "laos_cambodia_west",
          },
          { kind: "declare_war", on: T("VIC"), goal: "claim" },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "stability", pct: 2 }],
      },
    ],
  },

  // ---- 1941 ----
  {
    // The 1941-04-01 beat (actor Iraq). The coup leader is shown by title.
    id: "irq_golden_square",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: not({ kind: "at_war_with", of: T("GBR") }),
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_golden_square" },
          { kind: "set_government", ideology: "fascist" },
          { kind: "set_leader", person: "title:irq_national_defence_head" },
          { kind: "opinion", of: T("GBR"), value: -50, days: 730 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -50, days: 730 },
          { kind: "war_goal", who: T("GBR"), on: "self", type: "topple" },
          fire("gbr_habbaniya", T("GBR"), 31),
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "opinion", of: T("GBR"), value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // 31 days after irq_golden_square (1941-05-02; from = Iraq).
    id: "gbr_habbaniya",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          exists("IRQ"),
          { kind: "ruling", who: "from", ideology: "fascist" },
          not({ kind: "at_war_with", of: "from" }),
        ),
        ai: { base: 90 },
        effects: [{ kind: "declare_war", on: "from", goal: "topple" }],
      },
      {
        id: "b",
        ai: { base: 10 },
        effects: [{ kind: "remove_war_goal", on: "from" }],
      },
    ],
  },
  {
    // The 1941-04-10 beat (actor Germany). The state's head is shown by title.
    id: "deu_croatian_state",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          any(YUG_EXILE, { kind: "capitulated", who: T("YUG") }),
          HRV_DORMANT,
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_croatian_state" },
          {
            kind: "create_state",
            tag: "HRV",
            regions: ["croatia"],
            from: T("YUG"),
            overlord: "self",
            level: "puppet",
            ideology: "fascist",
            leader: "title:hrv_head",
          },
          { kind: "opinion", who: T("ITA"), of: "self", value: 10, days: 365 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // Yugoslavia fights on from exile: each occupier keeps its share.
    id: "yug_occupation_partition",
    kind: "country",
    picture: "map",
    receivers: ["DEU"],
    trigger: all(after("1941-04-01"), YUG_EXILE),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_yugoslavia_partition" },
          { kind: "annex_occupied", group: "slovenia_north" },
          { kind: "annex_occupied", who: T("ITA"), group: "ljubljana" },
          { kind: "annex_occupied", who: T("ITA"), group: "dalmatia" },
          { kind: "annex_occupied", who: T("HUN"), group: "backa_baranja" },
          { kind: "annex_occupied", who: T("BGR"), group: "vardar_macedonia" },
        ],
      },
    ],
  },
  {
    // A Yugoslav rump left as a German subject after a conference takes the
    // name Serbia (spec §3.5).
    id: "yug_rump_serbia",
    kind: "country",
    picture: "document",
    receivers: ["YUG"],
    trigger: all(
      not({ kind: "is_exile" }),
      { kind: "subject_of", of: T("DEU") },
      not({ kind: "owns_group", group: "croatia" }),
    ),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "set_name", key: "ww1936.rename.serbia" }],
      },
    ],
  },
  {
    id: "bgr_greek_thrace",
    kind: "country",
    picture: "map",
    receivers: ["BGR"],
    trigger: all(GRC_EXILE, {
      kind: "occupied_by",
      group: "greek_thrace",
      of: "self",
    }),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_greek_thrace" },
          { kind: "annex_occupied", group: "greek_thrace" },
        ],
      },
    ],
  },
  {
    // The 1941-05-05 beat (actor United Kingdom): the emperor returns to
    // Addis Ababa. restore_country checks spec §10.6 itself.
    id: "eth_restoration",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "controls_group", group: "addis_ababa" },
          { kind: "country_state", tag: "ETH", state: "gone" },
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_ethiopia_restored" },
          { kind: "restore_country", tag: "ETH" },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1941-05-09 beat (actor Vichy France).
    id: "tha_tokyo_peace",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "at_war_with", of: T("THA") },
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_tokyo_peace" },
          {
            kind: "transfer_regions",
            group: "laos_cambodia_west",
            to: T("THA"),
          },
          { kind: "end_war", of: T("THA") },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1941-05-31 beat (actor Iraq).
    id: "irq_armistice",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "at_war_with", of: T("GBR") },
          { kind: "war_days_ge", days: 25 },
        ),
        ai: { base: 80 },
        effects: [
          { kind: "end_war", of: T("GBR") },
          { kind: "set_government", ideology: "neutral" },
          { kind: "set_leader", person: "title:irq_regent" },
          { kind: "access", of: T("GBR") },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "war_support", pct: 3 }],
      },
    ],
  },
  {
    // Fired by the British decision gbr_levant_intervention.
    id: "gbr_levant_campaign",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "country_state", tag: "VIC", state: "active" },
          not({ kind: "at_war_with", of: T("VIC") }),
        ),
        ai: { base: 90 },
        effects: [
          { kind: "war_goal", on: T("VIC"), type: "claim", group: "levant" },
          { kind: "declare_war", on: T("VIC"), goal: "claim" },
          {
            kind: "if",
            cond: all(FRA_EXILE, { kind: "is_ai", who: T("FRA") }),
            then: [{ kind: "join_war", who: T("FRA"), of: T("VIC") }],
          },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // Fired by the American focus usa_iceland_garrison (from = United States).
    id: "isl_us_garrison",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_iceland_us_garrison" },
          { kind: "access", of: "from" },
          { kind: "opinion", of: "from", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // The 1941-08-29 beat (actor Iran). The war ends first, which hands the
    // occupied regions back; the two zones then take control again.
    id: "irn_armistice",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "at_war_with", of: T("GBR") },
          { kind: "at_war_with", of: T("SUN") },
        ),
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_iran_armistice" },
          { kind: "end_war", of: T("GBR") },
          { kind: "end_war", of: T("SUN") },
          {
            kind: "occupation_zone",
            group: "iran_south",
            holder: T("GBR"),
            seize: true,
          },
          {
            kind: "occupation_zone",
            group: "iran_north",
            holder: T("SUN"),
            seize: true,
          },
          { kind: "access", of: T("GBR") },
          { kind: "access", of: T("SUN") },
          fire("irn_new_shah", "self", 18),
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "war_support", pct: 5 }],
      },
    ],
  },
  {
    // 18 days after irn_armistice (1941-09-16).
    id: "irn_new_shah",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_new_shah" },
          { kind: "set_leader", person: "irn_mohammad_reza" },
        ],
      },
    ],
  },

  // ---- 1943 ----
  {
    // One card for the conference; the effects reach both countries.
    id: "casablanca_conference",
    kind: "country",
    picture: "table",
    date: { on: "1943-01-24", to: ["USA"] },
    trigger: all(
      exists("GBR"),
      { kind: "at_war_with", of: T("DEU") },
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_casablanca" },
          { kind: "set_gflag", flag: "unconditional_surrender" },
          { kind: "war_support", pct: 5 },
          { kind: "war_support", who: T("GBR"), pct: 5 },
        ],
      },
    ],
  },
  {
    // The 1943-08-29 beat (actor Germany).
    id: "deu_denmark_takeover",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          exists("DNK"),
          any(
            { kind: "subject_of", who: T("DNK"), of: "self" },
            { kind: "occupied_by", group: "denmark", of: "self" },
          ),
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_denmark_takeover" },
          {
            kind: "if",
            cond: { kind: "subject_of", who: T("DNK"), of: "self" },
            then: [
              { kind: "make_subject", target: T("DNK"), level: "integrated" },
            ],
          },
          { kind: "resistance", group: "denmark", pct: 15 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // Fired by the Italian event ita_armistice a day later (from = Italy).
    id: "deu_italy_betrayal",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: all(exists("ITA"), not({ kind: "at_war_with", of: "from" })),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_italy_occupied" },
          { kind: "declare_war", on: "from", goal: "conquer" },
          { kind: "occupation_zone", group: "italy_north", seize: true },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1943-09-23 beat (actor Germany).
    id: "deu_social_republic",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: all({ kind: "at_war_with", of: T("ITA") }, RSI_DORMANT),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_social_republic" },
          {
            kind: "create_state",
            tag: "RSI",
            regions: ["italy_north"],
            from: T("ITA"),
            overlord: "self",
            level: "puppet",
            ideology: "fascist",
            leader: "leader_ita",
          },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // One card for the conference, held at the Soviet embassy in Tehran.
    id: "tehran_conference",
    kind: "country",
    picture: "table",
    date: { on: "1943-11-28", to: ["SUN"] },
    trigger: all(exists("USA"), exists("GBR"), {
      kind: "at_war_with",
      of: T("DEU"),
    }),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_tehran" },
          { kind: "set_gflag", flag: "second_front_agreed" },
          { kind: "opinion", of: T("USA"), value: 20, days: 365 },
          { kind: "opinion", of: T("GBR"), value: 20, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
          {
            kind: "opinion",
            who: T("USA"),
            of: T("GBR"),
            value: 20,
            days: 365,
          },
          {
            kind: "opinion",
            who: T("GBR"),
            of: T("USA"),
            value: 20,
            days: 365,
          },
        ],
      },
    ],
  },

  // ---- 1944 ----
  {
    // The 1944-03-19 beat (actor Germany).
    id: "deu_occupy_hungary",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          exists("HUN"),
          { kind: "same_faction", of: T("HUN") },
          { kind: "at_war_with", who: T("HUN"), of: T("SUN") },
          not({ kind: "subject_of", who: T("HUN"), of: "self" }),
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_hungary_occupied" },
          { kind: "make_subject", target: T("HUN"), level: "puppet" },
          { kind: "stability", who: T("HUN"), pct: -10 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1944-08-01 beat (actor Poland in exile).
    id: "pol_warsaw_uprising",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "is_exile" },
          { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
        ),
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_warsaw_uprising" },
          { kind: "uprising", group: "warsaw" },
          { kind: "exile_legitimacy", pct: 10 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "exile_legitimacy", pct: -5 }],
      },
    ],
  },
  {
    // The 1944-08-23 beat (actor Romania).
    id: "rou_august_coup",
    kind: "country",
    picture: "crowd",
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        available: all(
          exists("SUN"),
          { kind: "at_war_with", of: T("SUN") },
          { kind: "lost_vp_ge", pct: 5 },
        ),
        ai: { base: 70 },
        effects: [
          { kind: "news", id: "news_romania_switches" },
          { kind: "set_government", ideology: "neutral" },
          { kind: "set_leader", person: "rou_michael" },
          { kind: "switch_sides", to: T("SUN") },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "war_support", pct: -10 }],
      },
    ],
  },
  {
    // The 1944-08-29 beat (actor Slovakia).
    id: "svk_national_uprising",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "subject_of", of: T("DEU") },
          { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
        ),
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_slovak_uprising" },
          { kind: "stability", pct: -20 },
          {
            kind: "occupation_zone",
            group: "central_slovakia",
            holder: T("DEU"),
            seize: true,
          },
          { kind: "resistance", group: "central_slovakia", pct: 30 },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1944-09-09 beat (actor Bulgaria), after the Soviet declaration of
    // 1944-09-05.
    id: "bgr_fatherland_front",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "at_war_with", of: T("SUN") },
        ai: { base: 90 },
        effects: [
          { kind: "news", id: "news_fatherland_front" },
          { kind: "set_government", ideology: "communist" },
          { kind: "switch_sides", to: T("SUN") },
        ],
      },
      { id: "b", ai: { base: 10 }, effects: [] },
    ],
  },
  {
    // The 1944-09-19 beat (actor Finland). Salla is the same map region as
    // Petsamo, so the cession lists petsamo only.
    id: "fin_moscow_armistice",
    kind: "country",
    picture: "table",
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "at_war_with", of: T("SUN") },
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_moscow_armistice" },
          { kind: "separate_peace", with: "all" },
          { kind: "transfer_regions", group: "petsamo", to: T("SUN") },
          { kind: "transfer_regions", group: "karelian_isthmus", to: T("SUN") },
          { kind: "transfer_regions", group: "ladoga_karelia", to: T("SUN") },
          {
            kind: "occupation_zone",
            group: "porkkala",
            holder: T("SUN"),
            seize: true,
          },
          { kind: "reparations", to: T("SUN"), k: 4, days: 730 },
          {
            kind: "if",
            cond: exists("DEU"),
            then: [{ kind: "declare_war", on: T("DEU") }],
          },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "war_support", pct: 5 }],
      },
    ],
  },
  {
    // The 1944-10-15 beat (actor Hungary).
    id: "hun_horthy_armistice",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "at_war_with", of: T("SUN") },
          { kind: "lost_vp_ge", pct: 5 },
        ),
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_horthy_armistice" },
          fire("deu_hungary_coup", T("DEU")),
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "war_support", pct: -5 }],
      },
    ],
  },
  {
    // Fired by hun_horthy_armistice (from = Hungary). The leader installed in
    // Budapest is shown by title.
    id: "deu_hungary_coup",
    kind: "country",
    picture: "column",
    historyPct: 90,
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "same_faction", of: "from" },
        ai: { base: 80 },
        effects: [
          { kind: "news", id: "news_hungary_coup" },
          { kind: "set_government", who: "from", ideology: "fascist" },
          {
            kind: "set_leader",
            who: "from",
            person: "title:hun_nation_leader",
          },
          { kind: "make_subject", target: "from", level: "integrated" },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [{ kind: "separate_peace", who: "from", with: "all" }],
      },
    ],
  },
  {
    // The Commonwealth's president dies in office (1944-08-01, spec §3.2).
    id: "phl_osmena_succeeds",
    kind: "country",
    picture: "document",
    date: { on: "1944-08-01", to: ["PHL"] },
    trigger: { kind: "leader", person: "phl_quezon" },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "set_leader", person: "phl_osmena" }],
      },
    ],
  },

  // ---- 1945 ----
  {
    // One card for the conference, held at Yalta in the Crimea.
    id: "yalta_conference",
    kind: "country",
    picture: "table",
    date: { on: "1945-02-04", to: ["SUN"] },
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_yalta" },
          { kind: "set_gflag", flag: "yalta_zones" },
          { kind: "set_flag", who: T("SUN"), flag: "pledged_vs_japan" },
        ],
      },
    ],
  },
  {
    // One card for the conference; the declaration to Japan follows on
    // 1945-07-26.
    id: "potsdam_conference",
    kind: "country",
    picture: "table",
    date: { on: "1945-07-17", to: ["USA"] },
    trigger: all(
      exists("GBR"),
      exists("SUN"),
      any({ kind: "capitulated", who: T("DEU") }, not(exists("DEU"))),
    ),
    once: "game",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "news", id: "news_potsdam" },
          { kind: "set_gflag", flag: "potsdam_lines" },
          {
            kind: "if",
            cond: { kind: "at_war_with", of: T("JPN") },
            then: [fire("jpn_potsdam_declaration", T("JPN"), 9)],
          },
        ],
      },
    ],
  },

  // ---- generic events the engine fires (spec §19.2, last list) ----
  {
    // Fired by gen_request_autonomy: self = the overlord, from = the subject.
    id: "gen_subject_upgrade",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: {
          base: 70,
          mods: [{ if: { kind: "at_war" }, factor: 129 }],
        },
        effects: [{ kind: "make_subject", target: "from", level: "up" }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "set_flag", who: "from", flag: "independence_denied" },
          { kind: "opinion", who: "from", of: "self", value: -50, days: 365 },
          { kind: "war_goal", who: "from", on: "self", type: "topple" },
        ],
      },
    ],
  },
  {
    // A lend-lease request: the engine reads the chosen option and keeps or
    // drops the contract it prepared (plan Task 6 Step 1).
    id: "gen_diplo_lend_lease",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 20,
    options: [
      { id: "a", ai: { base: 50 }, effects: [] },
      { id: "b", ai: { base: 50 }, effects: [] },
    ],
  },
  {
    id: "gen_exile_formed",
    kind: "news",
    picture: "newspaper",
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    id: "gen_uprising",
    kind: "news",
    picture: "crowd",
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    id: "gen_peace_conference",
    kind: "news",
    picture: "table",
    once: "never",
    options: [{ id: "a", ai: { base: 1 }, effects: [] }],
  },
  {
    // Fired to the receiving country when volunteers arrive (from = sender).
    id: "gen_volunteers_arrive",
    kind: "news",
    picture: "column",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [{ kind: "opinion", of: "from", value: 20, days: 365 }],
      },
    ],
  },
];
