// World War 1936 P3 — events the Soviet Union receives (spec §19.6 rows
// 10, 17, 26, 28, 40, 41, 45, 49, 67, 74; lane K4). The purge chain runs
// only on the purge path (flag purge_path from sun_great_purge) and stops
// once sun_purge_ends is done. Its texts state the trials as history; no
// option turns a sentence or a camp into a choice or a reward.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  after,
  all,
  done,
  exists,
  fire,
  flag,
  gflag,
  not,
  T,
} from "../helpers";

/** The purge is running: the focus was taken and not yet wound down. */
const PURGE_ON = all(flag("purge_path"), not(done("sun_purge_ends")));
/**
 * Days since the purge began, so that a purge started late still spaces
 * its stages out; on the historical path the dates come first.
 */
const PURGE_DAYS_30 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 30,
} as const;
const PURGE_DAYS_120 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 120,
} as const;
const PURGE_DAYS_160 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 160,
} as const;
const PURGE_DAYS_180 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 180,
} as const;
const PURGE_DAYS_240 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 240,
} as const;
const PURGE_DAYS_360 = {
  kind: "days_since_flag_ge",
  flag: "purge_path",
  days: 360,
} as const;
const NOT_AT_WAR_WITH_JAPAN = not({ kind: "at_war_with", of: T("JPN") });

export const SUN_EVENTS = [
  // ---- The purge chain (purge path only) ----
  {
    // 1936-08-19..24: the trial of the sixteen.
    id: "sun_first_moscow_trial",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1936-08-19"), PURGE_DAYS_30),
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "pp", amount: 25 }],
      },
    ],
  },
  {
    // 1937-02-27: arrested at the February–March plenum.
    id: "sun_bukharin_arrest",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1937-02-27"), PURGE_DAYS_120),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "remove_advisor", person: "sun_bukharin" }],
      },
    ],
  },
  {
    // 1937-05-10: Yegorov leaves the General Staff, Shaposhnikov takes it.
    id: "sun_yegorov_replaced",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1937-05-10"), PURGE_DAYS_160),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "remove_advisor", person: "sun_yegorov" }],
      },
    ],
  },
  {
    // 1937-06-11: the closed military trial of Tukhachevsky and seven others.
    id: "sun_military_trial",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1937-06-11"), PURGE_DAYS_180, {
      kind: "has_spirit",
      id: "sun_purge_1",
    }),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "swap_spirit", from: "sun_purge_1", to: "sun_purge_2" },
          { kind: "remove_general", general: "tukhachevsky" },
          { kind: "remove_general", general: "yakir" },
          { kind: "remove_general", general: "uborevich" },
          { kind: "remove_advisor", person: "sun_tukhachevsky" },
          // 1937-06-11 + 67 days = 1937-08-17, Rokossovsky's arrest.
          fire("sun_rokossovsky_arrest", undefined, 67),
        ],
      },
    ],
  },
  {
    id: "sun_rokossovsky_arrest",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_general", general: "rokossovsky" },
          // 1937-08-17 + 948 days = 1940-03-22, his release (pre-flight R20).
          fire("sun_rokossovsky_release", undefined, 948),
        ],
      },
    ],
  },
  {
    id: "sun_rokossovsky_release",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "restore_general", general: "rokossovsky" }],
      },
    ],
  },
  {
    // 1937-10-21: Tupolev and his engineers arrested.
    id: "sun_tupolev_arrest",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1937-10-21"), PURGE_DAYS_240),
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_advisor", person: "sun_tupolev" },
          { kind: "set_flag", flag: "sun_tupolev_held" },
        ],
      },
    ],
  },
  {
    // 1938-03-02..13: the trial of the twenty-one.
    id: "sun_third_moscow_trial",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(PURGE_ON, after("1938-03-13"), PURGE_DAYS_360, {
      kind: "has_spirit",
      id: "sun_purge_2",
    }),
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "swap_spirit", from: "sun_purge_2", to: "sun_purge_3" },
          // 1938-03-13 + 223 days = 1938-10-22, Blyukher's arrest.
          fire("sun_blyukher_arrest", undefined, 223),
        ],
      },
    ],
  },
  {
    id: "sun_blyukher_arrest",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "remove_general", general: "blyukher" }],
      },
    ],
  },

  // ---- Border wars and diplomacy ----
  {
    id: "sun_lake_khasan",
    kind: "country",
    date: { on: "1938-07-29", to: ["SUN"] },
    trigger: all(exists("JPN"), NOT_AT_WAR_WITH_JAPAN),
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "army_xp", amount: 10 },
          { kind: "war_support", who: T("JPN"), pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by sun_new_course (and the 1939-05-03 beat, K5).
    id: "sun_litvinov_dismissed",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "remove_advisor", person: "sun_litvinov" },
          { kind: "person_trait", person: "sun_molotov", trait: "diplomat" },
          { kind: "opinion", of: T("DEU"), value: 20, days: 365 },
        ],
      },
    ],
  },
  {
    id: "sun_khalkhin_gol",
    kind: "country",
    date: { on: "1939-05-11", to: ["SUN", "MNG"] },
    trigger: all(exists("JPN"), exists("MNG"), NOT_AT_WAR_WITH_JAPAN),
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "army_xp", amount: 20 },
          // Japan's AI weighs a war on the Soviet Union at 20% from here on.
          { kind: "set_flag", who: T("JPN"), flag: "northern_road_closed" },
        ],
      },
    ],
  },
  {
    // Fired by the German decision deu_soviet_pact_proposal ("from" = Germany).
    id: "sun_mr_pact_offer",
    kind: "country",
    timeoutSec: 30,
    historyPct: 95,
    aiDelayDays: [3, 3],
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "nap", of: "from" },
          { kind: "set_gflag", flag: "mr_secret_protocol" },
          { kind: "tension", pct: 3 },
          { kind: "news", id: "news_mr_pact" },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [fire("gbr_soviet_alliance_offer", T("GBR"))],
      },
    ],
  },
  {
    // 1939-09-17: the Red Army crosses into eastern Poland (news only; the
    // declaration itself is the P0 safety beat).
    id: "sun_poland",
    kind: "news",
    receivers: ["SUN"],
    trigger: all(gflag("mr_secret_protocol"), {
      kind: "at_war_with",
      of: T("POL"),
    }),
    once: "game",
    picture: "map",
    options: [{ id: "a", ai: { base: 10 }, effects: [] }],
  },
  {
    // 1941-06-22: whenever Germany and the Soviet Union go to war.
    id: "sun_barbarossa",
    kind: "country",
    receivers: ["SUN"],
    trigger: { kind: "at_war_with", of: T("DEU") },
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "add_spirit", id: "sun_surprise_shock", days: 90 }],
      },
    ],
  },
  {
    id: "sun_renounce_japan_pact",
    kind: "country",
    date: { on: "1945-04-05", to: ["SUN"] },
    trigger: { kind: "nap_with", of: T("JPN") },
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "opinion", of: T("JPN"), value: -30, days: 365 },
          // 1945-04-05 + 124 days = 1945-08-07, the eve of the 08-08 beat.
          fire("sun_japan_pact_lapses", undefined, 124),
        ],
      },
    ],
  },
  {
    id: "sun_japan_pact_lapses",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "break_nap", of: T("JPN") }],
      },
    ],
  },

  // ---- Advisors who come and go by date (spec §19.9) ----
  {
    id: "sun_shaposhnikov_returns",
    kind: "country",
    date: { on: "1941-07-29", to: ["SUN"] },
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "add_advisor_candidate", person: "sun_shaposhnikov" },
        ],
      },
    ],
  },
  {
    id: "sun_shaposhnikov_steps_down",
    kind: "country",
    date: { on: "1942-05-11", to: ["SUN"] },
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [{ kind: "remove_advisor", person: "sun_shaposhnikov" }],
      },
    ],
  },
  {
    id: "sun_tupolev_released",
    kind: "country",
    receivers: ["SUN"],
    trigger: all(flag("sun_tupolev_held"), after("1941-07-19")),
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 10 },
        effects: [
          { kind: "add_advisor_candidate", person: "sun_tupolev" },
          { kind: "clear_flag", flag: "sun_tupolev_held" },
        ],
      },
    ],
  },
] satisfies EventDef[];
