// 「독일」 ww151: what the seat starts and what the run is shaped by. The first
// list plays from the schedule (entries in content/acts/deu.ts); the second is
// the story: the opening, the big scenes, the rival, the rulers' letters and the
// scenes that press on the declared aim. Text: resources/ww1914/ko/DEU.act.json.
import type { GwStage } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  character,
  chose,
  decide,
  flag,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  not,
  reason,
  remember,
  rivalAct,
  rivalStage,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

const war = world({ is: "war" });
const gmax = (gauge: "shells" | "bread" | "order", max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (r: string): GwCond => ({ kind: "tone_fits", who: role(r) });
const secret = (id: string): GwCond => ({ kind: "secret", id });
const aim = (...of: string[]): GwCond => ({ kind: "aim", of });
const atWar = (tag: "RUS" | "FRA" | "GBR"): GwCond => ({ kind: "at_war", tag });
const from = (date: string): GwCond => world({ is: "date", from: date });
const opt = (
  id: string,
  effects: GwEffect[] = [],
  tell: string[] = [],
): GwOption => ({ id, tell, effects });
const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const inst = (i: "army" | "reichstag" | "countersign", delta: number) =>
  ({ kind: "inst", inst: i, delta }) as GwEffect;
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const letter = (r: string, tone: "warm" | "cold" | "frank"): GwEffect => ({
  kind: "letter",
  who: role(r),
  tone,
});
const pride = (r: string, delta: number): GwEffect => ({
  kind: "pride",
  who: role(r),
  delta,
});

// ---- ww173: the secret war's helpers ----
const inOffice = (r: string): GwCond => ({ kind: "in_office", who: role(r) });
const READ_TAGS = ["RUS", "FRA", "GBR", "ITA"] as const;
const reading = (tag: (typeof READ_TAGS)[number]): GwCond =>
  world({ is: "spy", can: "reading", tag });
const intelCast = { intel: { office: "intelligence" } } as const;
const SPY_ROWS = ["gw_a_spy_net", "gw_a_spy_sabotage", "gw_a_spy_court"];
const acted = (act: string, within?: number): GwCond =>
  within === undefined
    ? { kind: "acted", act }
    : { kind: "acted", act, within };
const pickedIn = (act: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field: "where",
  of,
  act,
});

type Extra = Partial<Omit<GwScene, "id" | "kind">>;

/** A scene played from the schedule. */
const act = (id: string, kind: GwScene["kind"], x: Extra): GwScene => ({
  id,
  nation: ["DEU"],
  kind,
  scheduledOnly: true,
  cast: {},
  salience: 6,
  tags: ["home"],
  variants: [{ id: "base" }],
  ...x,
});

/** What the eye saw: a report that can't be wrong. */
const seen = (id: string, x: Extra): GwScene =>
  act(id, "report", { stamp: "confirmed", source: "own_eyes", ...x });

const speech = (id: string, variants: GwScene["variants"]): GwScene =>
  act(id, "report", { stamp: "confirmed", source: "press", variants });

export const DEU_ACT_SCENES: readonly GwScene[] = [
  // ---- 시찰 ----
  act("deu_a_krupp_v", "audience", {
    tags: ["home", "war"],
    variants: [
      { id: "peace", when: not(war) },
      { id: "thin", when: all(war, secret("deu_shell_stock_thin")) },
      { id: "short", when: all(war, gmax("shells", 1)) },
      { id: "base" },
    ],
    options: [
      opt(
        "shifts",
        [gauge("shells", 1), gauge("order", -1)],
        ["shells:+1", "order:-1"],
      ),
      opt(
        "thank",
        [gauge("morale", 1), opinion("workers", 1)],
        ["morale:+1", "opinion:+1"],
      ),
      opt("leave"),
    ],
  }),
  seen("deu_a_fleet_v", {
    tags: ["war"],
    variants: [
      {
        id: "plan",
        when: all(secret("deu_fleet_plan_oct"), from("1918-06")),
      },
      { id: "hungry", when: all(war, gmax("bread", 1)) },
      { id: "idle", when: war },
      { id: "base" },
    ],
  }),
  seen("deu_a_west_v", {
    tags: ["war"],
    variants: [
      {
        id: "short",
        when: all(
          gmax("shells", 1),
          world({ is: "era", of: ["material", "depth", "storm"] }),
        ),
      },
      {
        id: "material",
        when: world({ is: "era", of: ["material", "depth", "storm"] }),
      },
      { id: "trench", when: world({ is: "era", of: ["trenches"] }) },
      { id: "base" },
    ],
  }),
  seen("deu_a_east_v", {
    tags: ["war"],
    variants: [
      {
        id: "far",
        when: world({
          is: "front",
          theatre: "east",
          from: "warsaw",
          to: "kiev",
        }),
      },
      {
        id: "home",
        when: world({
          is: "front",
          theatre: "east",
          from: "oder",
          to: "east_prussia",
        }),
      },
      { id: "base" },
    ],
  }),
  act("deu_a_hospital_v", "audience", {
    tags: ["home", "war"],
    variants: [
      { id: "hungry", when: gmax("bread", 1) },
      { id: "many", when: world({ is: "casualties", min: 1000 }) },
      { id: "early", when: world({ is: "war_age", max: 3 }) },
      { id: "base" },
    ],
    options: [
      opt(
        "sit",
        [{ kind: "ruler", side: "conscience", delta: 1, key: "a_bedside" }],
        ["conscience:+1"],
      ),
      opt("medals", [gauge("morale", 1)], ["morale:+1"]),
      opt("list", [
        doWorld({ do: "inspect", fact: "morale", tag: "DEU" }),
        reason("a_ward_list"),
      ]),
    ],
  }),
  act("deu_a_ruhr_v", "audience", {
    tags: ["home"],
    variants: [
      { id: "peace", when: not(war) },
      { id: "short", when: all(war, gmax("order", 2)) },
      { id: "women", when: all(war, world({ is: "manpower", max: 50 })) },
      { id: "base" },
    ],
    options: [
      opt(
        "hear",
        [gauge("order", 1), opinion("business", -1)],
        ["order:+1", "opinion:-1"],
      ),
      opt(
        "owners",
        [opinion("business", 1), opinion("workers", -1)],
        ["opinion:+1", "opinion:-1"],
      ),
      opt("leave"),
    ],
  }),
  seen("deu_a_hamburg_v", {
    variants: [
      { id: "peace", when: not(war) },
      { id: "dead", when: world({ is: "blockade", min: 50 }) },
      { id: "base" },
    ],
  }),
  seen("deu_a_market_v", {
    variants: [
      { id: "books", when: all(secret("deu_food_books"), gmax("bread", 2)) },
      { id: "empty", when: gmax("bread", 1) },
      { id: "thin", when: gmax("bread", 2) },
      { id: "base" },
    ],
  }),
  act("deu_a_alsace_v", "audience", {
    tags: ["home"],
    variants: [
      { id: "war", when: war },
      { id: "unrest", when: world({ is: "thread", id: "alsace_unrest" }) },
      { id: "base" },
    ],
    options: [
      opt(
        "civil",
        [{ kind: "pressure", topic: "alsace", delta: -1 }, inst("army", -1)],
        ["alsace_eases", "army:-1"],
      ),
      opt(
        "garrison",
        [inst("army", 1), { kind: "pressure", topic: "alsace", delta: 1 }],
        ["army:+1"],
      ),
      opt("leave"),
    ],
  }),
  seen("deu_a_prussia_v", {
    variants: [
      {
        id: "overrun",
        when: all(
          atWar("RUS"),
          world({
            is: "front",
            theatre: "east",
            from: "oder",
            to: "east_prussia",
          }),
        ),
      },
      { id: "after", when: war },
      { id: "base" },
    ],
  }),
  seen("deu_a_zeppelin_v", {
    tags: ["war"],
    variants: [
      { id: "late", when: all(war, from("1916-10")) },
      { id: "raids", when: all(war, atWar("GBR")) },
      { id: "base" },
    ],
  }),
  seen("deu_a_staff_v", {
    tags: ["war", "tension_up"],
    variants: [
      { id: "rail", when: secret("rus_rail_ahead") },
      { id: "hot", when: { kind: "temp", min: 4 } },
      { id: "base" },
    ],
  }),
  act("deu_a_heir_v", "audience", {
    tags: ["people", "war"],
    cast: { heir: { person: "deu_heir" } },
    variants: [{ id: "ring", when: secret("deu_heir_ring") }, { id: "base" }],
    options: [
      opt("warn", [trustOf(role("heir"), -1)], ["trust:-1"]),
      opt(
        "praise",
        [trustOf(role("heir"), 1), gauge("morale", 1)],
        ["trust:+1", "morale:+1"],
      ),
      opt("leave"),
    ],
  }),
  act("deu_a_oppau_v", "audience", {
    tags: ["home", "war"],
    variants: [{ id: "late", when: from("1917-01") }, { id: "base" }],
    options: [
      opt(
        "shells_first",
        [gauge("shells", 1), gauge("bread", -1)],
        ["shells:+1", "bread:-1"],
      ),
      opt(
        "fields_first",
        [gauge("bread", 1), gauge("shells", -1)],
        ["bread:+1", "shells:-1"],
      ),
      opt("leave"),
    ],
  }),

  // ---- 친서: the answer is a letter, and the seat can write back ----
  act("deu_a_nicky_r", "letter", {
    who: "other",
    tags: ["foreign"],
    cast: { other: { ruler_of: "RUS" } },
    variants: [
      { id: "war", when: { kind: "at_war_with", who: role("other") } },
      {
        id: "fit_serbia",
        when: all(fits("other"), picked("subject", "serbia")),
      },
      { id: "fit", when: fits("other") },
      { id: "threat", when: picked("tone", "threat") },
      { id: "hard", when: character(role("other"), "hardline") },
      { id: "base" },
    ],
    fallback: "close",
    options: [
      opt(
        "again",
        [letter("other", "warm"), { kind: "trust", tag: "RUS", delta: 1 }],
        ["rus:+1"],
      ),
      opt("close", [letter("other", "cold")]),
    ],
  }),
  act("deu_a_georgie_r", "letter", {
    who: "other",
    tags: ["foreign"],
    cast: { other: { ruler_of: "GBR" } },
    variants: [
      { id: "war", when: { kind: "at_war_with", who: role("other") } },
      { id: "fit_fleet", when: all(fits("other"), picked("subject", "fleet")) },
      { id: "fit", when: fits("other") },
      { id: "threat", when: picked("tone", "threat") },
      { id: "wary", when: character(role("other"), "cautious") },
      { id: "base" },
    ],
    fallback: "close",
    options: [
      opt(
        "again",
        [letter("other", "warm"), { kind: "trust", tag: "GBR", delta: 1 }],
        ["gbr:+1"],
      ),
      opt("close", [letter("other", "cold")]),
    ],
  }),
  act("deu_a_vienna_r", "letter", {
    who: "other",
    tags: ["foreign"],
    cast: { other: { ruler_of: "AUH" } },
    variants: [
      {
        id: "old_rome",
        when: all(
          { kind: "person_active", person: "auh_franz_joseph" },
          picked("subject", "rome"),
        ),
      },
      {
        id: "old",
        when: { kind: "person_active", person: "auh_franz_joseph" },
      },
      { id: "young_peace", when: picked("subject", "peace") },
      { id: "base" },
    ],
    fallback: "close",
    options: [
      opt(
        "again",
        [letter("other", "warm"), { kind: "trust", tag: "AUH", delta: 1 }],
        ["auh:+1"],
      ),
      opt("close", [letter("other", "cold")]),
    ],
  }),
  act("deu_a_wilson_r", "letter", {
    who: "other",
    tags: ["foreign"],
    cast: { other: { ruler_of: "USA" } },
    variants: [
      {
        id: "boats",
        when: all(picked("subject", "uboat"), world({ is: "uboat", min: 1 })),
      },
      { id: "fit", when: fits("other") },
      { id: "threat", when: picked("tone", "threat") },
      { id: "base" },
    ],
    fallback: "close",
    options: [
      opt(
        "again",
        [
          letter("other", "frank"),
          doWorld({ do: "readiness", tag: "USA", delta: -3 }),
        ],
        ["america:-1"],
      ),
      opt("close", [letter("other", "cold")]),
    ],
  }),
  act("deu_a_to_chan_r", "report", {
    tags: ["people"],
    cast: { chan: { office: "chancellor" } },
    variants: [
      { id: "fit_truth", when: all(fits("chan"), picked("subject", "truth")) },
      { id: "fit", when: fits("chan") },
      { id: "truth", when: picked("subject", "truth") },
      { id: "base" },
    ],
  }),
  act("deu_a_to_haase_r", "report", {
    tags: ["people"],
    cast: { left: { person: "deu_haase" } },
    variants: [
      { id: "fit_bread", when: all(fits("left"), picked("subject", "bread")) },
      { id: "fit", when: fits("left") },
      { id: "bread", when: picked("subject", "bread") },
      { id: "base" },
    ],
  }),

  // ---- 칙령과 지시 ----
  act("deu_a_inquiry_r", "report", {
    stamp: "confirmed",
    source: "staff",
    variants: [
      {
        id: "shells_thin",
        when: all(picked("subject", "shells"), secret("deu_shell_stock_thin")),
      },
      { id: "shells", when: picked("subject", "shells") },
      {
        id: "bread_bad",
        when: all(picked("subject", "bread"), secret("deu_food_books")),
      },
      { id: "bread", when: picked("subject", "bread") },
      {
        id: "tonnage_bad",
        when: all(picked("subject", "tonnage"), secret("deu_table_wrong")),
      },
      { id: "tonnage", when: picked("subject", "tonnage") },
      { id: "base" },
    ],
  }),
  act("deu_a_envoy_r", "report", {
    tags: ["foreign"],
    stamp: "unconfirmed",
    source: "attache",
    cast: { envoy: { picked: "envoy" } },
    variants: [
      {
        id: "rome_good",
        when: all(picked("where", "rome"), {
          kind: "competence",
          who: role("envoy"),
          field: "politics",
          min: 3,
        }),
      },
      { id: "rome", when: picked("where", "rome") },
      {
        id: "stamboul_good",
        when: all(picked("where", "stamboul"), {
          kind: "competence",
          who: role("envoy"),
          field: "politics",
          min: 3,
        }),
      },
      { id: "stamboul", when: picked("where", "stamboul") },
      {
        id: "vienna_good",
        when: {
          kind: "competence",
          who: role("envoy"),
          field: "politics",
          min: 3,
        },
      },
      { id: "base" },
    ],
  }),
  act("deu_a_council_r", "dispute", {
    cast: { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } },
    variants: [
      { id: "shells", when: picked("agenda", "shells") },
      { id: "front", when: picked("agenda", "front") },
      { id: "base" },
    ],
    options: [
      opt(
        "back_a",
        [
          trustOf(role("a"), 1),
          trustOf(role("b"), -1),
          {
            kind: "maybe",
            when: picked("agenda", "food"),
            then: [gauge("bread", 1)],
          },
          {
            kind: "maybe",
            when: picked("agenda", "shells"),
            then: [gauge("shells", 1)],
          },
        ],
        ["trust:+1", "trust:-1"],
      ),
      opt(
        "back_b",
        [
          trustOf(role("b"), 1),
          trustOf(role("a"), -1),
          {
            kind: "maybe",
            when: picked("agenda", "food"),
            then: [gauge("order", 1)],
          },
          {
            kind: "maybe",
            when: picked("agenda", "shells"),
            then: [gauge("money", 1)],
          },
        ],
        ["trust:+1", "trust:-1"],
      ),
      opt("adjourn"),
    ],
  }),
  act("deu_a_crown_r", "dispute", {
    tags: ["foreign", "tension_up"],
    cast: {
      a: { picked: "attend" },
      b: { picked: "attend", nth: 1 },
      c: { picked: "attend", nth: 2 },
    },
    variants: [
      { id: "britain", when: picked("agenda", "britain") },
      { id: "base" },
    ],
    options: [
      opt(
        "cool",
        [{ kind: "temp", delta: -1 }, inst("army", -1)],
        ["temp:-1", "army:-1"],
      ),
      opt(
        "stand",
        [{ kind: "temp", delta: 1 }, inst("army", 1)],
        ["temp:+1", "army:+1"],
      ),
      opt("adjourn"),
    ],
  }),
  act("deu_a_aimtalk_r", "report", {
    tags: ["people"],
    cast: { chan: { office: "chancellor" } },
    variants: [
      { id: "met", when: { kind: "aim_met" } },
      { id: "peace", when: all(aim("deu_aim_peace"), war) },
      { id: "home", when: aim("deu_aim_home") },
      { id: "win", when: aim("deu_aim_win", "deu_aim_east") },
      { id: "base" },
    ],
  }),
  act("deu_a_table_r", "report", {
    variants: [{ id: "empty", when: gmax("bread", 1) }, { id: "base" }],
  }),
  act("deu_a_amnesty_r", "report", {
    variants: [
      { id: "strikers", when: picked("who", "strikers") },
      { id: "base" },
    ],
  }),
  act("deu_a_franchise_r", "report", {
    cast: { interior: { office: "interior" } },
    variants: [{ id: "war", when: war }, { id: "base" }],
  }),

  // ---- 연설 ----
  speech("deu_a_sp_balcony_r", [
    { id: "war_peace", when: all(war, picked("on", "peace")) },
    { id: "peace", when: picked("on", "peace") },
    { id: "war", when: war },
    { id: "base" },
  ]),
  speech("deu_a_sp_reichstag_r", [
    { id: "vote", when: picked("on", "vote") },
    { id: "bread", when: picked("on", "bread") },
    { id: "base" },
  ]),
  speech("deu_a_sp_krupp_r", [
    {
      id: "cold",
      when: all(gmax("order", 2), picked("on", "shells", "win")),
    },
    { id: "peace", when: picked("on", "peace") },
    { id: "win", when: picked("on", "win") },
    { id: "base" },
  ]),
  speech("deu_a_sp_troops_r", [
    {
      id: "tired",
      when: all(picked("on", "home"), world({ is: "war_age", min: 18 })),
    },
    { id: "home", when: picked("on", "home") },
    { id: "base" },
  ]),
  speech("deu_a_sp_dom_r", [
    {
      id: "dead_many",
      when: all(picked("on", "dead"), world({ is: "casualties", min: 1000 })),
    },
    { id: "dead", when: picked("on", "dead") },
    { id: "base" },
  ]),
  speech("deu_a_sp_kiel_r", [
    { id: "hungry", when: gmax("bread", 1) },
    { id: "bread", when: picked("on", "bread") },
    { id: "base" },
  ]),

  // ---- 뒷공작 ----
  act("deu_a_leak_r", "report", {
    tags: ["people"],
    stamp: "unconfirmed",
    source: "press",
    cast: { target: { picked: "target" } },
    variants: [
      { id: "proud", when: { kind: "pride", who: role("target"), min: 2 } },
      { id: "base" },
    ],
  }),
  act("deu_a_leak_out", "audience", {
    tags: ["people"],
    cast: { target: { picked: "target" } },
    variants: [{ id: "base" }],
    fallback: "deny",
    options: [
      opt(
        "deny",
        [
          trustOf(role("target"), -2),
          { kind: "rumour", delta: 1 },
          { kind: "ruler", side: "reputation", delta: -1, key: "a_leak_found" },
        ],
        ["trust:-2", "reputation:-1"],
      ),
      opt(
        "own",
        [trustOf(role("target"), -1), pride("target", -1)],
        ["trust:-1"],
      ),
    ],
  }),
  act("deu_a_set_on_r", "report", {
    tags: ["people"],
    cast: { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    variants: [
      {
        id: "cold",
        when: { kind: "temperament", who: role("a"), of: ["cold", "cunning"] },
      },
      { id: "base" },
    ],
  }),
  act("deu_a_set_on_out", "audience", {
    tags: ["people"],
    cast: { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    variants: [{ id: "base" }],
    fallback: "silent",
    options: [
      opt(
        "silent",
        [
          trustOf(role("a"), -1),
          trustOf(role("b"), -1),
          {
            kind: "ruler",
            side: "reputation",
            delta: -1,
            key: "a_set_on_found",
          },
        ],
        ["trust:-1", "trust:-1", "reputation:-1"],
      ),
      opt(
        "dinner",
        [
          trustOf(role("a"), -1),
          trustOf(role("b"), -1),
          inst("countersign", -1),
        ],
        ["trust:-1", "trust:-1", "countersign:-1"],
      ),
    ],
  }),
  act("deu_a_copenhagen_r", "report", {
    tags: ["foreign"],
    stamp: "unconfirmed",
    source: "agents",
    cast: {},
    variants: [
      { id: "cold", when: { kind: "trust", tag: "RUS", max: -2 } },
      { id: "base" },
    ],
  }),
  act("deu_a_copenhagen_out", "audience", {
    tags: ["foreign"],
    cast: { chan: { office: "chancellor" } },
    variants: [{ id: "base" }],
    fallback: "deny",
    options: [
      opt(
        "deny",
        [
          { kind: "trust", tag: "AUH", delta: -1 },
          { kind: "rumour", delta: 1 },
        ],
        ["auh:-1"],
      ),
      opt(
        "tell_vienna",
        [{ kind: "trust", tag: "AUH", delta: -1 }, trustOf(role("chan"), 1)],
        ["auh:-1", "trust:+1"],
      ),
    ],
  }),
  act("deu_a_guelph_r", "report", {
    tags: ["foreign"],
    stamp: "unconfirmed",
    source: "agents",
    variants: [
      { id: "newyork", when: picked("where", "newyork") },
      { id: "base" },
    ],
  }),
  act("deu_a_guelph_out", "wire", {
    tags: ["foreign"],
    variants: [{ id: "base" }],
  }),
  act("deu_a_watch_r", "report", {
    tags: ["people"],
    stamp: "unconfirmed",
    source: "agents",
    cast: { court: { office: "court" } },
    variants: [{ id: "found", when: secret("deu_heir_ring") }, { id: "base" }],
  }),
  act("deu_a_watch_out", "audience", {
    tags: ["people"],
    cast: { heir: { person: "deu_heir" } },
    variants: [{ id: "base" }],
    fallback: "father",
    options: [
      opt(
        "father",
        [trustOf(role("heir"), -1), gauge("order", -1)],
        ["trust:-1", "order:-1"],
      ),
      opt(
        "emperor",
        [trustOf(role("heir"), -2), inst("army", -1)],
        ["trust:-2", "army:-1"],
      ),
    ],
  }),
  act("deu_a_rebels_r", "report", {
    tags: ["foreign", "war"],
    stamp: "unconfirmed",
    source: "agents",
    variants: [
      { id: "russia", when: picked("where", "russia") },
      { id: "ireland", when: picked("where", "ireland") },
      { id: "base" },
    ],
  }),
  act("deu_a_rebels_out", "wire", {
    tags: ["foreign"],
    variants: [{ id: "base" }],
  }),
];

// ---- The story ----

const big = (id: string, stage: GwStage[], x: Extra): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["war", "tension_up"],
  stage,
  cast: {},
  variants: [{ id: "base" }],
  start: "n1",
  ...x,
});

/** A card with no chrome, laid after a big scene. */
const silent = (
  id: string,
  variants: GwScene["variants"] = [{ id: "base" }],
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["tension_down"],
  variants,
});

const said = (id = "base", when?: GwCond) =>
  when === undefined ? { id } : { id, when };
const ask = (id: string, next: string | null) => ({
  id,
  stance: "frank" as const,
  kind: "ask" as const,
  tell: [],
  effects: [],
  next,
});

const OPENED: GwCond = {
  kind: "opening",
  of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
};
const survived: GwCond = { kind: "opening", of: ["sarajevo_survived"] };
const failed: GwCond = { kind: "opening", of: ["sarajevo_failed"] };
const chanBig = { office: "chancellor" } as const;

/** Whichever way 「첫 겨울」 goes, the aim was said aloud. */
const WIN_AIMS = aim("deu_aim_win", "deu_aim_east", "deu_aim_mitteleuropa");

const rivalCast = { rival_man: { rival_man: true } } as const;

/** A rival's answer: the same three everywhere, the words by scene. */
const embrace = (extra: GwEffect[] = []) =>
  opt(
    "embrace",
    [
      rivalAct("embrace"),
      trustOf(role("rival_man"), 2),
      reason("rival_taken_in", role("rival_man")),
      ...extra,
    ],
    ["trust:+2"],
  );
const push = (extra: GwEffect[] = []) =>
  opt(
    "push",
    [
      rivalAct("push"),
      trustOf(role("rival_man"), -1),
      reason("rival_held_off", role("rival_man")),
      ...extra,
    ],
    ["trust:-1"],
  );
const strike = (extra: GwEffect[] = []) =>
  opt(
    "strike",
    [
      rivalAct("strike"),
      trustOf(role("rival_man"), -3),
      reason("rival_struck", role("rival_man")),
      ...extra,
    ],
    ["trust:-3"],
  );

const nickyWar = { kind: "at_war_with", who: role("other") } as const;
const other = role("other");
const ruler = (id: string, x: Extra, tag: "RUS" | "GBR"): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "letter",
  who: "other",
  once: true,
  salience: 6,
  tags: ["foreign"],
  cast: { other: { ruler_of: tag } },
  variants: [{ id: "base" }],
  fallback: "reply_cold",
  ...x,
});
const answers = (tag: "RUS" | "GBR", next: string | null): GwOption[] => [
  opt(
    "reply_warm",
    [
      letter("other", "warm"),
      { kind: "trust", tag, delta: 1 },
      ...(next === null ? [] : [schedule(next, 3)]),
    ],
    [`${tag.toLowerCase()}:+1`],
  ),
  opt("reply_cold", [letter("other", "cold")]),
];

const press = (id: string, of: string, x: Extra): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "proposal",
  once: true,
  salience: 7,
  tags: ["people"],
  cast: { chan: chanBig },
  variants: [{ id: "base" }],
  ...x,
  when: x.when === undefined ? aim(of) : all(aim(of), x.when),
});

export const DEU_STORY_SCENES: readonly GwScene[] = [
  // ---- The opening: a first game of Germany starts on the water ----
  big("deu_big_kiel", ["crisis"], {
    tags: ["foreign", "tension_up"],
    when: all(
      { kind: "first_game" },
      { kind: "chapter", min: 0, max: 0 },
      OPENED,
    ),
    cast: {
      chan: chanBig,
      fm: { office: "foreign" },
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
    },
    who: "court",
    after: [
      { scene: "deu_big_kiel_rail", when: flag("f_went_vienna") },
      { scene: "deu_big_kiel_quiet" },
    ],
    nodes: {
      n1: {
        alone: true,
        fallback: "sails",
        says: [said("survived", survived), said("failed", failed), said()],
        replies: [
          decide("sails", "n2", [remember("k_kiel_sails")]),
          decide("finish", "n2", [remember("k_kiel_finish")]),
        ],
      },
      n2: {
        says: [said("survived", survived), said("failed", failed), said()],
        replies: [ask("what", "n3")],
      },
      n3: {
        who: "chan",
        says: [said("failed", failed), said()],
        replies: [ask("russia", "n4")],
      },
      n4: {
        who: "fm",
        says: [said()],
        replies: [ask("army", "n5")],
      },
      n5: {
        who: "cos",
        says: [said()],
        replies: [ask("decide_now", "n6")],
      },
      n6: {
        who: "chan",
        fallback: "condole",
        says: [said("survived", survived), said("failed", failed), said()],
        replies: [
          decide("condole", null, [reason("c_first_words_r1")]),
          decide(
            "go_vienna",
            null,
            [
              { kind: "trust", tag: "AUH", delta: 1 },
              { kind: "temp", delta: 1 },
              inst("countersign", -1),
              setFlag("f_went_vienna"),
              trustOf(role("chan"), -1),
            ],
            ["auh:+1", "temp:+1", "countersign:-1", "chancellor:-1"],
          ),
          decide(
            "send_prince",
            null,
            [{ kind: "trust", tag: "AUH", delta: 1 }, setFlag("f_sent_prince")],
            ["auh:+1"],
          ),
        ],
      },
    },
  }),
  silent("deu_big_kiel_rail"),
  silent("deu_big_kiel_quiet"),

  // ---- 8월의 밤: the chapter after the mobilisation paper ----
  big("deu_big_aug", ["crisis"], {
    when: all({ kind: "chapter", min: 5, max: 5 }, flag("f_west_plan")),
    cast: {
      chan: chanBig,
      cos: { office: "chief_of_staff" },
      navy: { office: "navy" },
      court: { office: "court" },
    },
    who: "chan",
    after: [
      { scene: "deu_big_aug_letter", when: flag("f_aug_wrote") },
      { scene: "deu_big_aug_dawn" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [said()],
        replies: [ask("sign", "n2")],
      },
      n2: {
        says: [said()],
        replies: [ask("who_first", "n3")],
      },
      n3: {
        who: "navy",
        fallback: "wait_shot",
        says: [said()],
        replies: [
          decide(
            "wait_shot",
            "n4",
            [
              inst("reichstag", 1),
              opinion("workers", 1),
              setFlag("f_aug_defence"),
            ],
            ["reichstag:+1", "opinion:+1"],
          ),
          decide(
            "declare_first",
            "n4",
            [inst("army", 1), { kind: "trust", tag: "GBR", delta: -1 }],
            ["army:+1", "gbr:-1"],
          ),
        ],
      },
      n4: {
        who: "cos",
        fallback: "lux_wait",
        says: [said("halted", flag("f_halted_west")), said()],
        replies: [
          decide(
            "lux_tonight",
            "n5",
            [
              inst("army", 1),
              { kind: "trust", tag: "GBR", delta: -1 },
              trustOf(role("cos"), 1),
            ],
            ["army:+1", "gbr:-1", "trust:+1"],
          ),
          decide(
            "lux_wait",
            "n5",
            [trustOf(role("cos"), -1), { kind: "delay", days: 1 }],
            ["trust:-1", "delay:1"],
          ),
        ],
      },
      n5: {
        who: "court",
        says: [said()],
        replies: [
          decide(
            "balcony",
            "n6",
            [gauge("morale", 1), opinion("press", 1)],
            ["morale:+1", "opinion:+1"],
          ),
          decide("stay_in", "n6", [remember("k_aug_stayed_in")]),
        ],
      },
      n6: {
        alone: true,
        fallback: "bed",
        says: [said()],
        replies: [
          decide("write", null, [setFlag("f_aug_wrote")]),
          decide("bed", null),
        ],
      },
    },
  }),
  silent("deu_big_aug_letter"),
  silent("deu_big_aug_dawn"),

  // ---- 첫 겨울: the staff says it can't be finished this way ----
  big("deu_big_winter", ["y1914", "war"], {
    tags: ["war"],
    // The summer war's first Christmas (a calendar scene).
    when: all(
      world({ is: "war_months", own: true, min: 2, max: 5 }),
      world({ is: "month", of: [12] }),
      any(atWar("RUS"), atWar("FRA")),
      flag("w_summer_war"),
    ),
    cast: {
      chan: chanBig,
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
    },
    who: "cos",
    after: [
      { scene: "deu_big_winter_card", when: flag("f_winter_truth") },
      { scene: "deu_big_winter_tree" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [
          // ww187: "the front near the Vistula": the east line there.
          {
            ...said("east", flag("f_east_first")),
            assumes: { line: { east: ["east_prussia", "warsaw"] } },
          },
          said(),
        ],
        replies: [ask("hear", "n2")],
      },
      n2: {
        fallback: "ask_rest",
        says: [said("aim", WIN_AIMS), said()],
        replies: [ask("ask_rest", "n3")],
      },
      n3: {
        who: "chan",
        fallback: "keep_going",
        says: [said()],
        replies: [
          decide(
            "open_channel",
            "n4",
            [
              setFlag("f_sounding_russia"),
              setFlag("f_winter_channel"),
              inst("army", -1),
            ],
            ["army:-1"],
          ),
          decide("keep_going", "n4", [inst("army", 1)], ["army:+1"]),
        ],
      },
      n4: {
        who: "court",
        fallback: "bulletin",
        says: [said()],
        replies: [
          decide(
            "truth",
            "n5",
            [
              setFlag("f_winter_truth"),
              gauge("morale", -1),
              inst("reichstag", 1),
              opinion("press", 1),
            ],
            ["morale:-1", "reichstag:+1", "opinion:+1"],
          ),
          decide("bulletin", "n5", [{ kind: "rumour", delta: 1 }]),
        ],
      },
      n5: {
        alone: true,
        says: [said()],
        replies: [
          decide(
            "ward",
            null,
            [
              {
                kind: "ruler",
                side: "conscience",
                delta: 1,
                key: "a_winter_ward",
              },
            ],
            ["conscience:+1"],
          ),
          decide("table", null, [gauge("morale", 1)], ["morale:+1"]),
        ],
      },
    },
  }),
  silent("deu_big_winter_card"),
  silent("deu_big_winter_tree"),

  // ---- 플레스의 밤: the day after the U-boat paper ----
  big("deu_big_pless", ["war"], {
    when: chose("deu_s_pless"),
    cast: {
      chan: chanBig,
      navy: { any_of: [{ person: "deu_holtzendorff" }, { office: "navy" }] },
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
    },
    who: "chan",
    variants: [{ id: "base" }],
    after: [
      { scene: "deu_big_pless_empty", when: flag("f_pless_lost_chan") },
      { scene: "deu_big_pless_sea" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [said("no", flag("f_pless_refused")), said()],
        replies: [ask("in", "n2")],
      },
      n2: {
        fallback: "stay",
        says: [said("no", flag("f_pless_refused")), said()],
        replies: [
          decide(
            "stay",
            "n3",
            [
              trustOf(role("chan"), 1),
              inst("countersign", 1),
              remember("k_pless_kept"),
            ],
            ["trust:+1", "countersign:+1"],
          ),
          decide(
            "let_him_think",
            "n3",
            [trustOf(role("chan"), -1), setFlag("f_pless_lost_chan")],
            ["trust:-1"],
          ),
        ],
      },
      n3: {
        who: "navy",
        fallback: "take_word",
        says: [said("no", flag("f_pless_refused")), said()],
        replies: [
          decide("take_word", "n4", [trustOf(role("navy"), 1)], ["trust:+1"]),
          decide(
            "show_sums",
            "n4",
            [
              {
                kind: "maybe",
                when: secret("deu_table_wrong"),
                then: [doWorld({ do: "reveal", id: "deu_table_wrong" })],
              },
              trustOf(role("navy"), -1),
            ],
            ["trust:-1"],
          ),
        ],
      },
      n4: {
        who: "court",
        fallback: "no_word",
        says: [said()],
        replies: [
          decide(
            "word_wilson",
            "n5",
            [
              doWorld({ do: "readiness", tag: "USA", delta: -5 }),
              inst("army", -1),
            ],
            ["america:-1", "army:-1"],
          ),
          decide("no_word", "n5"),
        ],
      },
      n5: {
        alone: true,
        says: [said("no", flag("f_pless_refused")), said()],
        replies: [decide("end", null)],
      },
    },
  }),
  silent("deu_big_pless_empty"),
  silent("deu_big_pless_sea"),

  // ---- 칠월의 사직: the chapter after the chancellor's question closed ----
  big("deu_big_july", ["war"], {
    tags: ["people", "tension_up"],
    when: all(flag("f_july_done"), {
      kind: "person_active",
      person: "deu_bethmann",
    }),
    cast: {
      beth: { person: "deu_bethmann" },
      heir: { person: "deu_heir" },
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
    },
    who: "beth",
    after: [
      {
        scene: "deu_big_july_desk",
        when: not({
          kind: "holder",
          office: "chancellor",
          person: "deu_bethmann",
        }),
      },
      { scene: "deu_big_july_stayed" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [
          said("kept", {
            kind: "holder",
            office: "chancellor",
            person: "deu_bethmann",
          }),
          said(),
        ],
        replies: [ask("in", "n2")],
      },
      n2: {
        who: "heir",
        fallback: "son_out",
        says: [said()],
        replies: [
          decide(
            "son_out",
            "n3",
            [
              trustOf(role("heir"), -1),
              {
                kind: "ruler",
                side: "family",
                delta: -1,
                key: "a_son_sent_out",
              },
            ],
            ["trust:-1", "family:-1"],
          ),
          decide(
            "son_hear",
            "n3",
            [trustOf(role("heir"), 1), inst("army", 1)],
            ["trust:+1", "army:+1"],
          ),
        ],
      },
      n3: {
        who: "cos",
        says: [said()],
        replies: [ask("to_beth", "n4")],
      },
      n4: {
        fallback: "ask_nothing",
        says: [
          said("kept", {
            kind: "holder",
            office: "chancellor",
            person: "deu_bethmann",
          }),
          said(),
        ],
        replies: [
          decide(
            "easter",
            "n5",
            [
              setFlag("f_july_pledge"),
              inst("reichstag", 1),
              inst("army", -1),
              opinion("workers", 1),
            ],
            ["reichstag:+1", "army:-1", "opinion:+1"],
          ),
          decide("ask_nothing", "n5"),
        ],
      },
      n5: {
        who: "court",
        says: [said()],
        replies: [decide("end", null)],
      },
    },
  }),
  silent("deu_big_july_desk"),
  silent("deu_big_july_stayed"),

  // ---- 스파의 하루: the chapter after the staff asks for an armistice ----
  big("deu_big_spa", ["war"], {
    when: all(chose("deu_k_spa"), not(world({ is: "armistice" }))),
    cast: {
      chan: chanBig,
      lud: {
        any_of: [{ person: "deu_ludendorff" }, { office: "chief_of_staff" }],
      },
      fm: { office: "foreign" },
      court: { office: "court" },
    },
    who: "lud",
    after: [
      { scene: "deu_big_spa_named", when: flag("f_spa_army_says") },
      { scene: "deu_big_spa_lamp" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [said("held", chose("deu_k_spa", "one_more_line")), said()],
        replies: [ask("in", "n2")],
      },
      n2: {
        says: [said("held", chose("deu_k_spa", "one_more_line")), said()],
        replies: [ask("how_long", "n3")],
      },
      n3: {
        who: "fm",
        says: [said()],
        replies: [ask("who_tells", "n4")],
      },
      n4: {
        who: "chan",
        fallback: "deputies_told",
        says: [said()],
        replies: [
          decide(
            "army_says",
            "n5",
            [
              setFlag("f_spa_army_says"),
              inst("army", -1),
              inst("reichstag", 1),
            ],
            ["army:-1", "reichstag:+1"],
          ),
          decide(
            "deputies_told",
            "n5",
            [inst("reichstag", -1), { kind: "rumour", delta: 1 }],
            ["reichstag:-1"],
          ),
        ],
      },
      n5: {
        who: "court",
        fallback: "stay_spa",
        says: [said()],
        replies: [
          decide(
            "to_berlin",
            "n6",
            [gauge("order", 1), inst("army", -1)],
            ["order:+1", "army:-1"],
          ),
          decide(
            "stay_spa",
            "n6",
            [gauge("order", -1), inst("army", 1)],
            ["order:-1", "army:+1"],
          ),
        ],
      },
      n6: {
        alone: true,
        says: [said()],
        replies: [decide("end", null)],
      },
    },
  }),
  silent("deu_big_spa_named"),
  silent("deu_big_spa_lamp"),

  // ---- 마지막 날: the same chapter as the abdication paper, before it ----
  big("deu_big_last", ["war"], {
    tags: ["people", "tension_up"],
    when: all(
      any(flag("f_note_1"), flag("f_paris_line")),
      any(world({ is: "unrest", min: 3 }), world({ is: "score", max: -25 })),
      not(world({ is: "armistice" })),
    ),
    cast: {
      cos: { office: "chief_of_staff" },
      groener: { any_of: [{ person: "deu_groener" }, { office: "war" }] },
      chan: chanBig,
      court: { office: "court" },
    },
    who: "groener",
    after: [{ scene: "deu_big_last_fog" }],
    nodes: {
      n1: {
        alone: true,
        says: [said()],
        replies: [ask("in", "n2")],
      },
      n2: {
        fallback: "poll",
        says: [said()],
        replies: [
          decide(
            "poll",
            "n3",
            [remember("k_last_poll"), inst("army", -1)],
            ["army:-1"],
          ),
          decide(
            "no_poll",
            "n3",
            [inst("army", 1), trustOf(role("groener"), -1)],
            ["army:+1", "trust:-1"],
          ),
        ],
      },
      n3: {
        who: "chan",
        says: [said()],
        replies: [ask("line", "n4")],
      },
      n4: {
        who: "cos",
        says: [said("poll", { kind: "memory", key: "k_last_poll" }), said()],
        replies: [ask("old_man", "n5")],
      },
      n5: {
        who: "court",
        fallback: "alone",
        says: [said()],
        replies: [
          decide(
            "alone",
            null,
            [
              {
                kind: "ruler",
                side: "conscience",
                delta: 1,
                key: "a_last_alone",
              },
            ],
            ["conscience:+1"],
          ),
          decide(
            "empress",
            null,
            [
              {
                kind: "ruler",
                side: "family",
                delta: 1,
                key: "a_last_empress",
              },
            ],
            ["family:+1"],
          ),
        ],
      },
    },
  }),
  silent("deu_big_last_fog"),

  // ---- 전쟁 없는 새해: the crisis passed and there is a whole new year ----
  big("deu_big_peace", ["war"], {
    tags: ["home", "tension_down"],
    salience: 8,
    // The first new year after a crisis closed without a war (a calendar
    // scene: snow and the new year's banquet).
    when: all(
      not(war),
      world({ is: "peace_months", min: 4 }),
      world({ is: "month", of: [1, 2, 3] }),
    ),
    cast: {
      chan: chanBig,
      cos: { office: "chief_of_staff" },
      navy: { office: "navy" },
      heir: { person: "deu_heir" },
    },
    who: "chan",
    after: [
      { scene: "deu_big_peace_paper", when: flag("f_peace_bill") },
      { scene: "deu_big_peace_snow" },
    ],
    nodes: {
      n1: {
        alone: true,
        says: [said("aim", aim("deu_aim_peace")), said()],
        replies: [ask("in", "n2")],
      },
      n2: {
        who: "cos",
        fallback: "file_it",
        says: [said()],
        replies: [
          decide(
            "army_bill",
            "n3",
            [inst("army", 1), gauge("money", -1), { kind: "temp", delta: 1 }],
            ["army:+1", "money:-1", "temp:+1"],
          ),
          decide("file_it", "n3", [trustOf(role("cos"), -1)], ["trust:-1"]),
        ],
      },
      n3: {
        who: "navy",
        fallback: "keep_law",
        says: [said()],
        replies: [
          decide(
            "talk_london",
            "n4",
            [
              { kind: "trust", tag: "GBR", delta: 1 },
              trustOf(role("navy"), -2),
              gauge("money", 1),
            ],
            ["gbr:+1", "trust:-2", "money:+1"],
          ),
          decide("keep_law", "n4", [trustOf(role("navy"), 1)], ["trust:+1"]),
        ],
      },
      n4: {
        who: "heir",
        says: [said()],
        replies: [ask("to_chan", "n5")],
      },
      n5: {
        fallback: "not_yet",
        says: [said()],
        replies: [
          decide(
            "bill",
            null,
            [
              setFlag("f_peace_bill"),
              setFlag("f_franchise_word"),
              inst("reichstag", 1),
              opinion("court", -1),
            ],
            ["reichstag:+1", "opinion:-1"],
          ),
          decide("not_yet", null),
        ],
      },
    },
  }),
  silent("deu_big_peace_paper"),
  silent("deu_big_peace_snow"),

  // ---- The rival. Never named as one before the memoir ----
  {
    id: "deu_r_sign_note",
    nation: ["DEU"],
    kind: "report",
    when: rivalStage(1, 1),
    once: true,
    salience: 3,
    tags: ["people"],
    stamp: "unconfirmed",
    source: "press",
    cast: rivalCast,
    variants: [{ id: "base" }],
  },
  {
    id: "deu_r_sign_table",
    nation: ["DEU"],
    kind: "wire",
    when: all(rivalStage(1, 1), { kind: "chapter", min: 2 }),
    once: true,
    salience: 3,
    tags: ["people"],
    cast: { ...rivalCast, court: { office: "court" } },
    variants: [{ id: "base" }],
  },
  {
    id: "deu_r_gather_dinner",
    nation: ["DEU"],
    kind: "audience",
    when: rivalStage(2, 2),
    once: true,
    salience: 7,
    tags: ["people"],
    cast: { ...rivalCast, court: { office: "court" } },
    author: "court",
    noBack: true,
    variants: [{ id: "base" }],
    fallback: "push",
    options: [embrace(), push(), strike()],
  },
  {
    id: "deu_r_gather_paper",
    nation: ["DEU"],
    kind: "audience",
    when: all(rivalStage(2, 2), { kind: "seen", scene: "deu_r_gather_dinner" }),
    once: true,
    salience: 7,
    tags: ["people"],
    cast: rivalCast,
    noBack: true,
    variants: [
      { id: "held", when: { kind: "rival_act", of: ["embrace"] } },
      { id: "base" },
    ],
    fallback: "push",
    options: [
      embrace([inst("countersign", -1)]),
      push(),
      strike([{ kind: "rumour", delta: 1 }]),
    ],
  },
  {
    id: "deu_r_clash",
    nation: ["DEU"],
    kind: "talk",
    big: true,
    once: true,
    salience: 8,
    tags: ["people", "tension_up"],
    when: rivalStage(3, 3),
    cast: { ...rivalCast, court: { office: "court" } },
    who: "rival_man",
    variants: [{ id: "base" }],
    start: "n1",
    after: [
      {
        scene: "deu_r_clash_gone",
        when: { kind: "rival_end", of: ["broken"] },
      },
      {
        scene: "deu_r_clash_lost",
        when: { kind: "rival_end", of: ["prevailed"] },
      },
      { scene: "deu_r_clash_hand" },
    ],
    nodes: {
      n1: {
        who: "court",
        says: [said("struck", { kind: "rival_act", of: ["strike"] }), said()],
        replies: [ask("in", "n2")],
      },
      n2: {
        says: [said()],
        replies: [ask("what_want", "n3")],
      },
      n3: {
        says: [said()],
        replies: [ask("if_not", "n4")],
      },
      n4: {
        alone: true,
        fallback: "yield",
        says: [said()],
        replies: [
          decide(
            "reconcile",
            null,
            [
              trustOf(role("rival_man"), 2),
              inst("army", 1),
              { kind: "rival_end", end: "reconciled" },
              reason("rival_reconciled", role("rival_man")),
            ],
            ["trust:+2", "army:+1"],
          ),
          decide(
            "break",
            null,
            [
              trustOf(role("rival_man"), -3),
              inst("army", -1),
              { kind: "rumour", delta: 1 },
              { kind: "rival_end", end: "broken" },
              reason("rival_broken", role("rival_man")),
              { kind: "dismiss", who: role("rival_man") },
            ],
            ["trust:-3", "army:-1", "leaves"],
          ),
          decide(
            "yield",
            null,
            [
              doWorld({ do: "authority", delta: -10 }),
              { kind: "rival_end", end: "prevailed" },
              reason("rival_prevailed", role("rival_man")),
            ],
            ["authority:-10"],
          ),
        ],
      },
    },
  },
  silent("deu_r_clash_gone"),
  silent("deu_r_clash_lost"),
  silent("deu_r_clash_hand"),

  // ---- 사촌들의 편지: Nicky ----
  ruler(
    "deu_l_nicky_1",
    {
      when: all({ kind: "chapter", min: 1, max: 3 }, not(war)),
      variants: [
        { id: "hard", when: character(other, "hardline") },
        { id: "wary", when: character(other, "cautious") },
        { id: "sly", when: character(other, "opportunist") },
        { id: "base" },
      ],
      options: answers("RUS", null),
    },
    "RUS",
  ),
  ruler(
    "deu_l_nicky_2",
    {
      salience: 7,
      when: all({ kind: "chapter", min: 3, max: 5 }, { kind: "temp", min: 4 }),
      variants: [
        {
          id: "cold",
          when: all(character(other, "hardline"), {
            kind: "letters",
            who: other,
            tone: "cold",
          }),
        },
        { id: "hard", when: character(other, "hardline") },
        { id: "wary", when: character(other, "cautious") },
        { id: "base" },
      ],
      options: answers("RUS", null),
    },
    "RUS",
  ),
  ruler(
    "deu_l_nicky_3",
    {
      when: all(nickyWar, world({ is: "war_months", own: true, min: 3 }), {
        kind: "letters",
        who: other,
        min: 1,
      }),
      variants: [
        { id: "hard", when: character(other, "hardline") },
        { id: "warm", when: { kind: "letters", who: other, tone: "warm" } },
        { id: "base" },
      ],
      options: answers("RUS", "deu_l_nicky_4"),
    },
    "RUS",
  ),
  ruler(
    "deu_l_nicky_4",
    {
      scheduledOnly: true,
      variants: [
        { id: "peace", when: not(nickyWar) },
        {
          id: "lost",
          when: world({
            is: "front",
            theatre: "east",
            from: "warsaw",
            to: "kiev",
          }),
        },
        { id: "base" },
      ],
      options: answers("RUS", null),
    },
    "RUS",
  ),
  {
    id: "deu_l_nicky_gone",
    nation: ["DEU"],
    kind: "wire",
    when: all(not(world({ is: "regime", tag: "RUS", of: ["tsar", "crown"] })), {
      kind: "letters",
      who: { person: "rus_nicholas" },
      min: 1,
    }),
    once: true,
    salience: 5,
    tags: ["foreign", "tension_down"],
    cast: {},
    variants: [{ id: "base" }],
  },

  // ---- 사촌들의 편지: George ----
  ruler(
    "deu_l_georgie_1",
    {
      when: all({ kind: "chapter", min: 1, max: 3 }, not(war)),
      variants: [
        { id: "hard", when: character(other, "hardline") },
        { id: "wary", when: character(other, "cautious") },
        { id: "base" },
      ],
      options: answers("GBR", null),
    },
    "GBR",
  ),
  ruler(
    "deu_l_georgie_2",
    {
      salience: 7,
      when: all({ kind: "chapter", min: 3, max: 5 }, { kind: "temp", min: 4 }),
      variants: [
        { id: "hard", when: character(other, "hardline", "principled") },
        { id: "warm", when: { kind: "letters", who: other, tone: "warm" } },
        { id: "base" },
      ],
      options: answers("GBR", null),
    },
    "GBR",
  ),
  ruler(
    "deu_l_georgie_3",
    {
      when: all(nickyWar, world({ is: "war_months", own: true, min: 3 }), {
        kind: "letters",
        who: other,
        min: 1,
      }),
      variants: [
        { id: "windsor", when: from("1917-07") },
        { id: "warm", when: { kind: "letters", who: other, tone: "warm" } },
        { id: "base" },
      ],
      options: answers("GBR", "deu_l_georgie_4"),
    },
    "GBR",
  ),
  ruler(
    "deu_l_georgie_4",
    {
      scheduledOnly: true,
      variants: [{ id: "after", when: not(nickyWar) }, { id: "base" }],
      options: answers("GBR", null),
    },
    "GBR",
  ),

  // ---- Scenes that press on the declared aim ----
  press("deu_m_peace_hot", "deu_aim_peace", {
    when: all({ kind: "temp", min: 5 }, not(war)),
    tags: ["foreign", "tension_up"],
    options: [
      opt(
        "say_again",
        [{ kind: "temp", delta: -1 }, inst("army", -1)],
        ["temp:-1", "army:-1"],
      ),
      opt("hold_tongue", [inst("army", 1)], ["army:+1"]),
    ],
  }),
  press("deu_m_win_stopped", "deu_aim_win", {
    when: all(war, flag("w_marne_stopped")),
    tags: ["war"],
    options: [
      opt(
        "hold_to_it",
        [gauge("morale", 1), inst("reichstag", -1)],
        ["morale:+1", "reichstag:-1"],
      ),
      opt(
        "soften",
        [inst("reichstag", 1), opinion("army", -1)],
        ["reichstag:+1", "opinion:-1"],
      ),
    ],
  }),
  press("deu_m_mittel_vienna", "deu_aim_mitteleuropa", {
    when: all(war, world({ is: "war_months", own: true, min: 11 })),
    tags: ["foreign"],
    options: [
      opt(
        "customs",
        [{ kind: "trust", tag: "AUH", delta: -1 }, opinion("business", 1)],
        ["auh:-1", "opinion:+1"],
      ),
      opt(
        "equal",
        [{ kind: "trust", tag: "AUH", delta: 1 }, opinion("business", -1)],
        ["auh:+1", "opinion:-1"],
      ),
    ],
  }),
  press("deu_m_east_poles", "deu_aim_east", {
    when: all(
      war,
      world({ is: "front", theatre: "east", from: "warsaw", to: "kiev" }),
    ),
    tags: ["foreign", "war"],
    options: [
      opt(
        "strip",
        [inst("army", 1), { kind: "trust", tag: "AUH", delta: -1 }],
        ["army:+1", "auh:-1"],
      ),
      opt(
        "no_strip",
        [inst("army", -1), inst("reichstag", 1)],
        ["army:-1", "reichstag:+1"],
      ),
    ],
  }),
  press("deu_m_sea_boats", "deu_aim_sea", {
    when: all(
      war,
      atWar("GBR"),
      world({ is: "war_months", own: true, min: 11 }),
    ),
    tags: ["war"],
    cast: { chan: chanBig, navy: { office: "navy" } },
    options: [
      opt(
        "stand",
        [trustOf(role("navy"), -1), { kind: "trust", tag: "GBR", delta: 1 }],
        ["trust:-1", "gbr:+1"],
      ),
      opt(
        "bend",
        [trustOf(role("navy"), 1), inst("army", 1)],
        ["trust:+1", "army:+1"],
      ),
    ],
  }),
  press("deu_m_home_lords", "deu_aim_home", {
    when: any(
      world({ is: "war_months", own: true, min: 2 }),
      world({ is: "peace_months", min: 2 }),
    ),
    tags: ["home"],
    options: [
      opt(
        "press_on",
        [inst("reichstag", 1), opinion("court", -1), opinion("workers", 1)],
        ["reichstag:+1", "opinion:-1", "opinion:+1"],
      ),
      opt(
        "wait_peace",
        [opinion("court", 1), opinion("workers", -1)],
        ["opinion:+1", "opinion:-1"],
      ),
    ],
  }),
  press("deu_m_crown_staff", "deu_aim_crown", {
    when: all(war, { kind: "inst", inst: "army", min: 3 }),
    tags: ["people"],
    cast: { court: { office: "court" } },
    options: [
      opt(
        "take_paper",
        [inst("army", -1), doWorld({ do: "authority", delta: 5 })],
        ["army:-1", "authority:+1"],
      ),
      opt("let_pass", [inst("army", 1)], ["army:+1"]),
    ],
  }),
  {
    id: "deu_m_changed",
    nation: ["DEU"],
    kind: "wire",
    when: { kind: "aim_changed", min: 1 },
    once: true,
    salience: 5,
    tags: ["people"],
    cast: {},
    variants: [{ id: "base" }],
  },
  // ---- ww173: the secret war, in Germany's voice (formatc 1-3) ----
  // The head of IIIb (whoever holds `intelligence`) brings the codes we read:
  // act on them, or hide them so the enemy never learns why we knew.
  {
    id: "deu_spy_read",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["war"],
    when: all(war, inOffice("intel"), any(...READ_TAGS.map(reading))),
    cooldown: 5,
    salience: 7,
    tags: ["war"],
    cast: intelCast,
    author: "intel",
    variants: [
      {
        id: "rus_plain",
        when: all(reading("RUS"), world({ is: "era", of: ["movement"] })),
      },
      { id: "rus", when: reading("RUS") },
      { id: "fra", when: reading("FRA") },
      { id: "gbr", when: reading("GBR") },
      { id: "ita", when: reading("ITA") },
      { id: "base" },
    ],
    fallback: "hide",
    options: [
      opt(
        "use",
        [
          trustOf(role("intel"), 1),
          remember("m_deu_read"),
          remember("m_deu_read_used"),
        ],
        ["trust:+1"],
      ),
      opt("hide", [
        doWorld({ do: "spy", act: "hide" }),
        remember("m_deu_read"),
      ]),
    ],
  },
  // The enemy changed his codes after a read we had: told by the same man.
  {
    id: "deu_spy_code_lost",
    nation: ["DEU"],
    kind: "report",
    stage: ["war"],
    stamp: "confirmed",
    source: "staff",
    when: all(
      war,
      inOffice("intel"),
      { kind: "memory", key: "m_deu_read", within: 8 },
      not(any(...READ_TAGS.map(reading))),
    ),
    cooldown: 8,
    salience: 6,
    tags: ["war"],
    cast: intelCast,
    variants: [
      {
        id: "used",
        when: { kind: "memory", key: "m_deu_read_used", within: 8 },
      },
      { id: "base" },
    ],
  },
  // One of our operations abroad was found out (Spies.expose): the sender's
  // side of it. Papen and Boy-Ed, Black Tom: the neutral's anger.
  {
    id: "deu_spy_exposed",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["war"],
    when: all(
      world({ is: "spy", can: "out" }),
      any(...SPY_ROWS.map((a) => acted(a, 2))),
    ),
    cooldown: 4,
    salience: 7,
    tags: ["foreign", "war"],
    cast: { fm: { office: "foreign" }, intel: { office: "intelligence" } },
    author: "fm",
    variants: [
      {
        id: "usa_blast",
        when: all(
          acted("gw_a_spy_sabotage", 2),
          pickedIn("gw_a_spy_sabotage", "usa"),
          world({ is: "spy", can: "ok" }),
        ),
      },
      {
        id: "usa_court",
        when: all(
          acted("gw_a_spy_court", 2),
          pickedIn("gw_a_spy_court", "usa"),
        ),
      },
      { id: "neutral", when: acted("gw_a_spy_court", 2) },
      { id: "blast", when: acted("gw_a_spy_sabotage", 2) },
      { id: "base" },
    ],
    fallback: "deny",
    options: [
      opt("deny", [reason("deu_spy_denied")]),
      opt(
        "recall",
        [trustOf(role("intel"), -1), reason("deu_spy_recalled")],
        ["trust:-1"],
      ),
      opt(
        "again",
        [trustOf(role("intel"), 1), remember("m_deu_spy_again")],
        ["trust:+1"],
      ),
    ],
  },
  // The sealed train, some months on: what the fire did over there.
  {
    id: "deu_spy_lenin_fire",
    nation: ["DEU"],
    kind: "report",
    stage: ["war"],
    stamp: "unconfirmed",
    source: "agents",
    when: all(acted("deu_a_spy_lenin"), not(acted("deu_a_spy_lenin", 3))),
    once: true,
    salience: 6,
    tags: ["foreign", "war"],
    cast: { fm: { office: "foreign" } },
    variants: [
      {
        id: "burning",
        when: { kind: "nation_gauge", tag: "RUS", gauge: "order", max: 1 },
      },
      { id: "base" },
    ],
  },
  // The Irish arms ship was read and taken: the man who went with it.
  {
    id: "deu_spy_casement",
    nation: ["DEU"],
    kind: "wire",
    stage: ["war"],
    when: all(world({ is: "spy", can: "ship" }), acted("deu_a_spy_ireland")),
    once: true,
    salience: 5,
    tags: ["foreign"],
    cast: {},
    variants: [{ id: "base" }],
  },
];
