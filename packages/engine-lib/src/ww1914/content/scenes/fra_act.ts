// France's story (ww150 shapes): inspections, letters out, orders, speeches,
// back-room moves, send-backs, big scenes, rivals, the opening. Text in
// resources/ww1914/ko/FRA.act.json (story) and FRA.acts.json (schedule papers).
// Lane W8 (ww166-format.md).
//
// The seat is Raymond Poincaré, President of the Republic, for the whole game.
// He can't dismiss a minister and signs nothing alone: what he starts himself
// is going to see, writing, calling people in, and the Council he presides.
// The eight big scenes of the plan are W1-W4's; the opening here is the first
// night of a first game. Options show no results before the pick: no `tell`.
import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  character,
  chose,
  decide,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  holder,
  not,
  reason,
  remember,
  rivalAct,
  rivalStage,
  role,
  schedule,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { period } from "./period";

const NATION: GwScene["nation"] = ["FRA"];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };
const b = [v("base")];

/** A paper the schedule calls. It was the President's own: nobody to send it back to. */
const card = (
  id: string,
  kind: GwScene["kind"],
  cast: GwScene["cast"],
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind,
  cast,
  salience: 6,
  tags: ["home"],
  variants,
  scheduledOnly: true,
  noBack: true,
  ...more,
});
/** What the President saw with his own eyes. */
const seenCard = (
  id: string,
  cast: GwScene["cast"],
  variants: GwVariant[],
  tags: GwScene["tags"] = ["home"],
): GwScene =>
  card(id, "report", cast, variants, {
    stamp: "confirmed",
    source: "own_eyes",
    tags,
  });
/** The note on the desk once a big scene has ended. */
const silent = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["tension_down"],
  variants,
});

const inst = (
  i: "chamber" | "senate" | "countersign" | "army",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});

const war = world({ is: "war" });
const atDeu: GwCond = { kind: "at_war", tag: "DEU" };
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const from = (min: string): GwCond => world({ is: "date", from: min });
const chapters = (min: number, max?: number): GwCond =>
  max === undefined ? { kind: "chapter", min } : { kind: "chapter", min, max };
const gaugeAt = (g: GwGauge, min?: number, max?: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (r: string): GwCond => ({ kind: "tone_fits", who: role(r) });
const leans = (
  r: string,
  camp: "hard" | "moderate" | "military" | "socialist" | "right",
): GwCond => ({ kind: "leans", who: role(r), camp });
const able = (r: string, field: "war" | "politics" | "admin"): GwCond => ({
  kind: "competence",
  who: role(r),
  field,
  min: 3,
});
const known = (
  id: "fra_toul_verdun" | "fra_rubicon_papers" | "fra_bolo_money",
): GwCond => world({ is: "known", id });
const heavy = world({ is: "casualties", min: 400 });
const entered = (tag: GwTag): GwCond =>
  world({ is: "entered", tag, side: "entente" });
const beaten = all(
  world({
    is: "battle",
    theatre: "west",
    of: ["repelled", "stalemate"],
    by: "seat",
  }),
  gaugeAt("morale", undefined, 2),
);
const union = world({ is: "regime", tag: "FRA", of: ["fra_union"] });
const tiger = flag("f_pm_clemenceau");

// ---- 시찰: where the President goes (entries in ../acts/fra.ts) ----

const VISIT_SCENES: GwScene[] = [
  seenCard(
    "fra_a_verdun_v",
    { war: holder("war") },
    [v("siege", all(war, period("16a", "16b"))), v("war", war), v("base")],
    ["war"],
  ),
  seenCard(
    "fra_a_reims_v",
    {},
    [
      v(
        "close",
        all(war, world({ is: "front", theatre: "west", from: "aisne" })),
      ),
      v("burned", all(war, from("1914-10"))),
      v("base"),
    ],
    ["war"],
  ),
  card(
    "fra_a_creusot_v",
    "proposal",
    { war: holder("war") },
    [
      v("short", all(war, gaugeAt("shells", undefined, 1))),
      v("good", all(war, gaugeAt("shells", 2))),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "note_it",
      options: [
        o("note_it", [trustOf(role("war"), 1)]),
        o(
          "more_shifts",
          [gauge("shells", 1), gauge("money", -1), reason("fra_a_creusot_r1")],
          war,
        ),
      ],
    },
  ),
  card(
    "fra_a_refugees_v",
    "proposal",
    { home: holder("interior") },
    [v("evian", from("1917-01")), v("base")],
    {
      fallback: "note_it",
      options: [
        o("note_it", [trustOf(role("home"), 1)]),
        o("allowance", [
          gauge("money", -1),
          gauge("order", 1),
          opinion("workers", 1),
        ]),
      ],
    },
  ),
  card(
    "fra_a_colonial_v",
    "proposal",
    { war: holder("war") },
    [v("second", from("1916-10")), v("base")],
    {
      tags: ["war"],
      fallback: "note_it",
      options: [
        o("note_it", [trustOf(role("war"), 1)]),
        o("huts", [gauge("money", -1), gauge("morale", 1)]),
      ],
    },
  ),
  seenCard("fra_a_nancy_v", {}, [v("war", war), v("base")]),
  seenCard(
    "fra_a_dunkirk_v",
    {},
    [v("british", entered("GBR")), v("base")],
    ["war"],
  ),
  seenCard("fra_a_barleduc_v", {}, [
    v("road", all(war, period("16a", "16b"))),
    v("war", war),
    v("base"),
  ]),
  seenCard(
    "fra_a_sampigny_v",
    {},
    [v("shelled", all(war, chapters(8))), v("war", war), v("base")],
    ["private"],
  ),
  card(
    "fra_a_thann_v",
    "proposal",
    { home: holder("interior") },
    [v("long", from("1916-01")), v("base")],
    {
      fallback: "note_it",
      options: [
        o("note_it", [trustOf(role("home"), 1)]),
        o("teachers", [opinion("press", 1), gauge("money", -1)]),
      ],
    },
  ),
  card(
    "fra_a_factory_v",
    "proposal",
    { war: holder("war") },
    [
      v("short", gaugeAt("shells", undefined, 1)),
      v("good", gaugeAt("shells", 2)),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "note_it",
      options: [
        o("note_it", [trustOf(role("war"), 1)]),
        o("creche", [gauge("money", -1), gauge("order", 1)]),
      ],
    },
  ),
  seenCard("fra_a_hospital_v", {}, [v("heavy", heavy), v("base")], ["war"]),
  seenCard(
    "fra_a_bordeaux_v",
    {},
    [v("america", entered("USA")), v("base")],
    ["war"],
  ),
  card(
    "fra_a_chantilly_v",
    "proposal",
    { cos: holder("chief_of_staff") },
    [v("beaten", beaten), v("base")],
    {
      tags: ["war"],
      fallback: "listen",
      options: [
        o("listen", [trustOf(role("cos"), 1)]),
        o("ask_numbers", [
          trustOf(role("cos"), -1),
          inst("army", -1),
          reason("fra_a_chantilly_r1"),
        ]),
      ],
    },
  ),
];

// ---- 친서: the answer that comes back ----

const LETTER_SCENES: GwScene[] = [
  card(
    "fra_a_l_georgie_r",
    "proposal",
    { king: { ruler_of: "GBR" } },
    [
      v("solid_fit", all(picked("subject", "solidarity"), fits("king"))),
      v("solid", picked("subject", "solidarity")),
      v("troops", picked("subject", "troops")),
      v("command", picked("subject", "command")),
      v("visit_fit", fits("king")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", []),
        o("show_premier", [
          trust("GBR", 1),
          inst("countersign", 1),
          maybe(picked("subject", "solidarity"), { kind: "temp", delta: 1 }),
        ]),
      ],
    },
  ),
  card(
    "fra_a_l_nicky_r",
    "proposal",
    { tsar: { ruler_of: "RUS" } },
    [
      v("mob_fit", all(picked("subject", "mobilise"), fits("tsar"))),
      v("mob", picked("subject", "mobilise")),
      v(
        "offensive_hard",
        all(
          picked("subject", "offensive"),
          character(role("tsar"), "hardline"),
        ),
      ),
      v("offensive", picked("subject", "offensive")),
      v("rifles", picked("subject", "rifles")),
      v("visit_fit", fits("tsar")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", []),
        o("answer_kindly", [
          trust("RUS", 1),
          maybe(picked("subject", "rifles"), gauge("shells", -1)),
        ]),
      ],
    },
  ),
  card(
    "fra_a_l_wilson_r",
    "proposal",
    { pres: { ruler_of: "USA" } },
    [
      v("loans", picked("subject", "loans")),
      v("ships", picked("subject", "ships")),
      v("peace_fit", all(picked("subject", "peace"), fits("pres"))),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", []),
        o("send_answer", [
          trust("USA", 1),
          maybe(
            fits("pres"),
            doWorld({ do: "readiness", tag: "USA", delta: 1 }),
          ),
        ]),
      ],
    },
  ),
  card(
    "fra_a_l_alfonso_r",
    "proposal",
    { king: { ruler_of: "ESP" } },
    [
      v("prisoners_fit", all(picked("subject", "prisoners"), fits("king"))),
      v("prisoners", picked("subject", "prisoners")),
      v("civilians", picked("subject", "civilians")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", []),
        o("accept_help", [gauge("morale", 1), opinion("press", 1)]),
      ],
    },
  ),
  card(
    "fra_a_l_chief_r",
    "proposal",
    { cos: holder("chief_of_staff") },
    [
      v("deputies_fit", all(picked("subject", "deputies"), fits("cos"))),
      v("deputies", picked("subject", "deputies")),
      v("losses_fit", all(picked("subject", "losses"), fits("cos"))),
      v("losses", picked("subject", "losses")),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "file",
      options: [
        o("file", []),
        o("show_premier", [
          inst("countersign", 1),
          trustOf(role("cos"), -1),
          maybe(picked("subject", "deputies"), inst("chamber", 1)),
        ]),
      ],
    },
  ),
  card(
    "fra_a_l_tiger_r",
    "proposal",
    { tig: { person: "fra_clemenceau" } },
    [
      v("old_fit", all(picked("subject", "old"), fits("tig"))),
      v("old", picked("subject", "old")),
      v("paper", picked("subject", "paper")),
      v("base"),
    ],
    {
      tags: ["people"],
      fallback: "file",
      options: [
        o("file", []),
        o("ask_lunch", [trustOf(role("tig"), 1), inst("senate", 1)]),
      ],
    },
  ),
];

// ---- 지시: the Council, an inquiry, an envoy, people called in ----

const pair = { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } };

const ORDER_SCENES: GwScene[] = [
  card(
    "fra_a_o_council_r",
    "proposal",
    pair,
    [
      v(
        "law_split",
        all(
          picked("agenda", "army_law"),
          leans("a", "hard"),
          not(leans("b", "hard")),
        ),
      ),
      v("law", picked("agenda", "army_law")),
      v(
        "front_soldier",
        all(picked("agenda", "front"), leans("a", "military")),
      ),
      v("front", picked("agenda", "front")),
      v("bread", picked("agenda", "bread")),
      v("base"),
    ],
    {
      fallback: "note_both",
      options: [
        o("note_both", []),
        o("side_with_a", [
          trustOf(role("a"), 1),
          trustOf(role("b"), -1),
          inst("countersign", -1),
        ]),
        o("side_with_b", [
          trustOf(role("b"), 1),
          trustOf(role("a"), -1),
          inst("countersign", -1),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_inquiry_r",
    "report",
    {},
    [
      v(
        "cipher_found",
        all(picked("subject", "cipher"), known("fra_toul_verdun")),
      ),
      v("cipher", picked("subject", "cipher")),
      v(
        "papers_found",
        all(picked("subject", "papers"), known("fra_bolo_money")),
      ),
      v("papers", picked("subject", "papers")),
      v(
        "shells_bad",
        all(picked("subject", "shells"), gaugeAt("shells", undefined, 1)),
      ),
      v("shells", picked("subject", "shells")),
      v("forts_war", war),
      v("base"),
    ],
    { stamp: "estimate", source: "staff" },
  ),
  card(
    "fra_a_o_envoy_r",
    "proposal",
    { e: { picked: "envoy" } },
    [
      v("able_london", all(picked("where", "london"), able("e", "politics"))),
      v("london", picked("where", "london")),
      v("petrograd", picked("where", "petrograd")),
      v("washington", picked("where", "washington")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "take_note",
      options: [
        o("take_note", []),
        o("thank_him", [
          trustOf(role("e"), 1),
          maybe(able("e", "politics"), authority(1)),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_presidents_r",
    "proposal",
    { des: { person: "fra_deschanel" }, dub: { person: "fra_dubost" } },
    [
      v("secret", picked("agenda", "secret_sitting")),
      v("next", picked("agenda", "next_premier")),
      v("cold", { kind: "inst", inst: "chamber", max: -1 }),
      v("base"),
    ],
    {
      tags: ["people"],
      fallback: "listen",
      options: [
        o("listen", [trustOf(role("des"), 1), trustOf(role("dub"), 1)]),
        o("ask_patience", [
          inst("chamber", 1),
          inst("senate", 1),
          authority(-1),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_mission_r",
    "proposal",
    { cos: holder("chief_of_staff") },
    [v("rapporteur", picked("who", "rapporteur")), v("base")],
    {
      tags: ["war"],
      fallback: "let_go",
      options: [
        o("let_go", [
          inst("chamber", 1),
          inst("army", -1),
          trustOf(role("cos"), -1),
        ]),
        o("call_back", [
          inst("army", 1),
          inst("chamber", -1),
          reason("fra_a_mission_r1"),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_dinner_r",
    "proposal",
    pair,
    [
      v(
        "union_worn",
        all(picked("agenda", "union"), gaugeAt("morale", undefined, 2)),
      ),
      v("union", picked("agenda", "union")),
      v("law", picked("agenda", "law")),
      v("base"),
    ],
    {
      tags: ["people"],
      fallback: "let_talk",
      options: [
        o("let_talk", [inst("countersign", 1)]),
        o("make_them_agree", [
          trustOf(role("a"), 1),
          trustOf(role("b"), 1),
          authority(-1),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_premier_r",
    "proposal",
    { pm: holder("chancellor") },
    [
      v("minister", picked("agenda", "minister")),
      v("front_tiger", all(picked("agenda", "front"), tiger)),
      v("front", picked("agenda", "front")),
      v("base"),
    ],
    {
      tags: ["people"],
      fallback: "hear_him",
      options: [
        o("hear_him", [trustOf(role("pm"), 1)]),
        o("press_him", [
          trustOf(role("pm"), -1),
          inst("countersign", -1),
          authority(1),
          reason("fra_a_premier_r1"),
        ]),
      ],
    },
  ),
  card(
    "fra_a_o_pardons_r",
    "proposal",
    { cos: holder("chief_of_staff") },
    [
      v(
        "commute_hard",
        all(
          picked("how", "commute"),
          from("1917-05"),
          gaugeAt("morale", undefined, 2),
        ),
      ),
      v("commute", picked("how", "commute")),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "sign_reprieves",
      options: [
        o("sign_reprieves", [
          gauge("morale", 1),
          inst("army", -1),
          trustOf(role("cos"), -1),
          reason("fra_a_pardons_r1"),
        ]),
        o("send_back_files", [trustOf(role("cos"), 1)]),
      ],
    },
  ),
];

// ---- 연설: how it was taken ----

const SPEECH_SCENES: GwScene[] = [
  card("fra_a_s_message_r", "report", { pm: holder("chancellor") }, [
    v(
      "union_tired",
      all(picked("on", "union"), gaugeAt("morale", undefined, 2)),
    ),
    v("union", all(picked("on", "union"), union)),
    v("law", picked("on", "army_law")),
    v("senate", picked("place", "senate")),
    v("base"),
  ]),
  card("fra_a_s_july14_r", "report", {}, [
    v("dead", picked("on", "dead")),
    v("army_war", all(picked("on", "army"), war)),
    v("army", picked("on", "army")),
    v("base"),
  ]),
  card("fra_a_s_sorbonne_r", "report", {}, [
    v("allies", picked("on", "allies")),
    v("youth_war", all(picked("on", "youth"), war)),
    v("youth", picked("on", "youth")),
    v("base"),
  ]),
  card("fra_a_s_thann_r", "report", {}, [
    v("belfort", picked("place", "belfort")),
    v("schools", picked("on", "schools")),
    v("base"),
  ]),
  card("fra_a_s_nancy_r", "report", {}, [
    v(
      "endure_bad",
      all(picked("on", "endure"), gaugeAt("morale", undefined, 2)),
    ),
    v("endure", picked("on", "endure")),
    v("bar", picked("place", "bar_le_duc")),
    v("base"),
  ]),
  card("fra_a_s_strasbourg_r", "report", {}, [
    v("metz", picked("place", "metz")),
    v("dead", picked("on", "dead")),
    v("base"),
  ]),
];

// ---- 뒷공작 ----

const caughtCard = (
  id: string,
  cast: GwScene["cast"],
  options: GwOption[],
  tags: GwScene["tags"] = ["home"],
): GwScene =>
  card(id, "proposal", cast, b, {
    salience: 7,
    tags,
    fallback: options[0].id,
    options,
  });

const INTRIGUE_SCENES: GwScene[] = [
  card("fra_a_i_leak_r", "report", {}, [
    v("law", picked("what", "army_law")),
    v("gqg", picked("what", "gqg")),
    v("base"),
  ]),
  caughtCard("fra_a_i_leak_out", { pm: holder("chancellor") }, [
    o("say_nothing", [inst("chamber", -1), rumour(1)]),
    o("own_up", [
      trustOf(role("pm"), -1),
      inst("countersign", -1),
      authority(-1),
      reason("fra_a_leak_out_r1"),
    ]),
  ]),
  card(
    "fra_a_i_police_r",
    "report",
    {},
    [
      v("rubicon", all(picked("who", "caillaux"), known("fra_rubicon_papers"))),
      v("caillaux", picked("who", "caillaux")),
      v("clemenceau", picked("who", "clemenceau")),
      v("base"),
    ],
    { stamp: "unconfirmed", source: "police" },
  ),
  caughtCard("fra_a_i_police_out", { home: holder("interior") }, [
    o("deny", [inst("chamber", -2), opinion("press", -1)]),
    o("blame_police", [
      trustOf(role("home"), -2),
      inst("chamber", -1),
      reason("fra_a_police_out_r1"),
    ]),
  ]),
  card(
    "fra_a_i_set_on_r",
    "report",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    [v("proud", { kind: "pride", who: role("a"), min: 2 }), v("base")],
    { tags: ["people"] },
  ),
  caughtCard(
    "fra_a_i_set_on_out",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    [
      o("say_nothing", [
        trustOf(role("a"), -2),
        trustOf(role("b"), -2),
        inst("countersign", -1),
      ]),
      o("dine_them", [
        trustOf(role("a"), -1),
        trustOf(role("b"), -1),
        authority(-1),
      ]),
    ],
    ["people"],
  ),
  card("fra_a_i_sound_r", "report", {}, [
    v("briand", picked("who", "briand")),
    v("ribot", picked("who", "ribot")),
    v("base"),
  ]),
  caughtCard(
    "fra_a_i_sound_out",
    { pm: holder("chancellor") },
    [
      o("explain", [trustOf(role("pm"), -2), inst("countersign", -1)]),
      o("praise_him", [
        trustOf(role("pm"), -1),
        authority(-1),
        reason("fra_a_sound_out_r1"),
      ]),
    ],
    ["people"],
  ),
  card(
    "fra_a_i_general_r",
    "report",
    {},
    [
      v("castelnau", picked("who", "castelnau")),
      v("foch", picked("who", "foch")),
      v("base"),
    ],
    { tags: ["war"], stamp: "unconfirmed", source: "staff" },
  ),
  caughtCard(
    "fra_a_i_general_out",
    { cos: holder("chief_of_staff") },
    [
      o("stop_letters", [trustOf(role("cos"), -1)]),
      o("keep_writing", [
        trustOf(role("cos"), -2),
        inst("army", -1),
        inst("chamber", 1),
      ]),
    ],
    ["war"],
  ),
  card(
    "fra_a_i_geneva_r",
    "report",
    {},
    [
      v(
        "geneva_found",
        all(picked("where", "geneva"), known("fra_bolo_money")),
      ),
      v("geneva", picked("where", "geneva")),
      v("madrid", picked("where", "madrid")),
      v("base"),
    ],
    { tags: ["foreign"], stamp: "unconfirmed", source: "agents" },
  ),
  caughtCard(
    "fra_a_i_geneva_out",
    { fm: holder("foreign") },
    [
      o("recall", [trustOf(role("fm"), -1)]),
      o("disown", [trust("GBR", -1), reason("fra_a_geneva_out_r1")]),
    ],
    ["foreign"],
  ),
];

/** Scenes the schedule (acts/fra.ts) opens. */
export const FRA_ACT_SCENES: readonly GwScene[] = [
  ...VISIT_SCENES,
  ...LETTER_SCENES,
  ...ORDER_SCENES,
  ...SPEECH_SCENES,
  ...INTRIGUE_SCENES,
];

// ---- What presses on the declared aim ----

const aimScene = (
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  options: GwOption[],
  tags: GwScene["tags"] = ["war"],
): GwScene => ({
  id,
  nation: NATION,
  kind: "proposal",
  stage: ["y1914", "war"],
  when,
  cast,
  once: true,
  salience: 7,
  tags,
  variants: b,
  fallback: options[0].id,
  options,
  noBack: true,
});
const aim = (...of: string[]): GwCond => ({ kind: "aim", of });

const AIM_SCENES: GwScene[] = [
  aimScene(
    "fra_aim_p_alsace",
    all(
      aim("fra_aim_alsace"),
      war,
      world({ is: "war_months", own: true, min: 11, max: 41 }),
      world({ is: "score", max: 0 }),
    ),
    { fm: holder("foreign") },
    [
      o("say_again", [gauge("morale", 1), trust("GBR", -1)]),
      o("soften", [
        inst("chamber", -1),
        trust("GBR", 1),
        reason("fra_aim_alsace_r1"),
      ]),
    ],
    ["foreign"],
  ),
  aimScene(
    "fra_aim_p_rhine",
    all(
      aim("fra_aim_rhine"),
      war,
      world({ is: "war_months", own: true, min: 29 }),
    ),
    { cos: holder("chief_of_staff") },
    [
      o("keep_it", [inst("army", 1), trust("GBR", -1), trust("USA", -1)]),
      o("words_only", [trustOf(role("cos"), -1), reason("fra_aim_rhine_r1")]),
    ],
  ),
  aimScene(
    "fra_aim_p_guarantee",
    all(
      aim("fra_aim_guarantee"),
      war,
      not(entered("USA")),
      world({ is: "war_months", own: true, min: 11 }),
    ),
    { fm: holder("foreign") },
    [
      o("press_washington", [gauge("money", -1), trust("USA", 1)]),
      o("wait_for_them", [inst("chamber", -1)]),
    ],
    ["foreign"],
  ),
  aimScene(
    "fra_aim_p_levant",
    all(
      aim("fra_aim_levant"),
      war,
      world({ is: "entered", tag: "OTT" }),
      world({ is: "war_months", own: true, min: 11 }),
    ),
    { fm: holder("foreign") },
    [
      o("send_a_force", [manpower(-5), trust("GBR", 1)]),
      o("trust_the_map", [trust("GBR", -1), reason("fra_aim_levant_r1")]),
    ],
    ["foreign"],
  ),
  aimScene(
    "fra_aim_p_reparations",
    all(
      aim("fra_aim_reparations"),
      war,
      world({ is: "war_months", own: true, min: 23 }),
    ),
    { fin: holder("finance") },
    [
      o("count_now", [gauge("money", -1), inst("chamber", 1)]),
      o("after_war", [opinion("business", -1)]),
    ],
    ["home"],
  ),
  aimScene(
    "fra_aim_p_peace",
    all(aim("fra_aim_peace"), war, heavy),
    { pm: holder("chancellor") },
    [
      o("hear_them", [inst("chamber", 1), opinion("army", -1)]),
      o("not_now", [
        gauge("morale", 1),
        opinion("workers", -1),
        reason("fra_aim_peace_r1"),
      ]),
    ],
    ["home"],
  ),
];

// ---- A first game: the first night, three people, a weighty choice ----

const go = (
  id: string,
  next: string | null,
  stance: GwStance = "frank",
  kind: GwReply["kind"] = "ask",
): GwReply => ({ id, stance, kind, tell: [], effects: [], next });
const at = (
  who: string,
  says: GwVariant[],
  replies: GwReply[],
  fallback?: string,
): GwNode => ({
  who,
  says,
  replies,
  ...(fallback === undefined ? {} : { fallback }),
});
const opening = (
  ...of: (
    | "sarajevo"
    | "sarajevo_survived"
    | "sarajevo_failed"
    | "sarajevo_delayed"
    | "no_sarajevo"
  )[]
): GwCond => ({
  kind: "opening",
  of,
});

const OPENING_SCENES: GwScene[] = [
  {
    id: "fra_o_first",
    nation: NATION,
    kind: "talk",
    big: true,
    once: true,
    essential: true,
    salience: 9,
    stage: ["crisis"],
    tags: ["home", "tension_up"],
    when: all({ kind: "first_game" }, chapters(0, 0)),
    cast: {
      ch: { person: "fra_viviani" },
      war: { person: "fra_messimy" },
      cos: { person: "fra_joffre" },
    },
    who: "ch",
    start: "n1",
    variants: b,
    nodes: {
      n1: {
        alone: true,
        says: [
          v("survived", opening("sarajevo_survived")),
          v("failed", opening("sarajevo_failed", "sarajevo_delayed")),
          v("none", opening("no_sarajevo")),
          v("base"),
        ],
        replies: [go("call_in", "n2")],
      },
      n2: at("ch", b, [go("ask_law", "n3")]),
      n3: at("war", b, [go("ask_trains", "n4")]),
      n4: at(
        "cos",
        [v("none", opening("no_sarajevo")), v("base")],
        [go("ask_cover", "n5"), go("thanks", "n5", "warm")],
      ),
      n5: at(
        "ch",
        b,
        [
          decide("keep_course", null, [
            trustOf(role("ch"), 1),
            remember("m_fra_first_wait"),
          ]),
          decide("law_price", null, [
            remember("k_viv_bargain"),
            trustOf(role("ch"), -1),
            remember("m_fra_first_law"),
          ]),
          decide("cover_ready", null, [
            remember("k_jof_cover"),
            trustOf(role("cos"), 1),
            inst("army", 1),
            remember("m_fra_first_cover"),
          ]),
          decide("quai_hand", null, [
            remember("k_berth_desk"),
            trustOf(role("ch"), -1),
            remember("m_fra_first_quai"),
          ]),
        ],
        "keep_course",
      ),
    },
    after: [{ scene: "fra_o_first_quiet" }],
  },
  silent("fra_o_first_quiet", [
    v("law", chose("fra_o_first", "law_price")),
    v("cover", chose("fra_o_first", "cover_ready")),
    v("quai", chose("fra_o_first", "quai_hand")),
    v("base"),
  ]),
];

// ---- The man who works against him: nothing here may name him as that ----

const rival_man = { rival_man: true as const };
const him = role("rival_man");
const sign = (id: string, when: GwCond): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  when,
  once: true,
  cast: { rival_man },
  salience: 3,
  tags: ["people"],
  variants: b,
});
const notHeld = not({ kind: "rival_act", of: ["embrace"] });
const closed = (end: "reconciled" | "broken" | "prevailed"): GwEffect => ({
  kind: "rival_end",
  end,
});

const RIVAL_SCENES: GwScene[] = [
  sign("fra_r_sign_note", all(rivalStage(1, 2), notHeld, chapters(1))),
  sign(
    "fra_r_sign_paper",
    all(rivalStage(1, 2), notHeld, chapters(3), seen("fra_r_sign_note")),
  ),
  sign(
    "fra_r_sign_gap",
    all(rivalStage(1, 3), notHeld, chapters(5), seen("fra_r_sign_paper")),
  ),
  {
    id: "fra_r_gather",
    nation: NATION,
    kind: "audience",
    when: all(rivalStage(2, 3), seen("fra_r_sign_paper")),
    once: true,
    cast: { rival_man },
    salience: 7,
    tags: ["people"],
    variants: b,
    noBack: true,
    fallback: "take_in",
    options: [
      o("take_in", [rivalAct("embrace"), trustOf(him, 2), authority(-1)]),
      o("keep_out", [
        rivalAct("push"),
        trustOf(him, -1),
        inst("countersign", 1),
      ]),
      o("move_first", [
        rivalAct("strike"),
        trustOf(him, -2),
        inst("chamber", -1),
        rumour(1),
        reason("fra_r_struck"),
      ]),
    ],
  },
  {
    id: "fra_r_talk",
    nation: NATION,
    kind: "talk",
    when: all(rivalStage(2, 2), seen("fra_r_gather"), {
      kind: "rival_act",
      of: ["push"],
    }),
    once: true,
    cast: { rival_man },
    who: "rival_man",
    start: "open",
    salience: 6,
    tags: ["people"],
    variants: b,
    nodes: {
      open: {
        says: b,
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [rivalAct("embrace"), trustOf(him, 1)],
            next: "taken",
          },
          {
            id: "cold",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [rivalAct("push")],
            next: "stands",
          },
          {
            id: "warn",
            stance: "threat",
            kind: "push",
            tell: [],
            effects: [rivalAct("strike"), trustOf(him, -1)],
            next: "stands",
          },
        ],
      },
      taken: { says: b, replies: [go("end_taken", null, "warm", "leave")] },
      stands: { says: b, replies: [go("end_stands", null, "cold", "leave")] },
    },
  },
  {
    id: "fra_r_embraced",
    nation: NATION,
    kind: "wire",
    when: all({ kind: "rival_act", of: ["embrace"] }, rivalStage(1, 2)),
    once: true,
    cast: { rival_man },
    salience: 4,
    tags: ["people", "tension_down"],
    variants: b,
  },
  {
    id: "fra_r_clash",
    nation: NATION,
    kind: "crisis",
    when: all(rivalStage(3), seen("fra_r_gather")),
    once: true,
    cast: { rival_man },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [v("struck", { kind: "rival_act", of: ["strike"] }), v("base")],
    noBack: true,
    fallback: "make_peace",
    options: [
      o("make_peace", [
        rivalAct("embrace"),
        closed("reconciled"),
        trustOf(him, 2),
        authority(-1),
      ]),
      o("hold_apart", [
        rivalAct("push"),
        trustOf(him, -1),
        inst("countersign", -1),
      ]),
      o("break_him", [
        rivalAct("strike"),
        closed("broken"),
        trustOf(him, -3),
        inst("chamber", -2),
        authority(1),
      ]),
    ],
  },
  {
    id: "fra_r_last",
    nation: NATION,
    kind: "crisis",
    when: all(rivalStage(3), seen("fra_r_clash"), {
      kind: "rival_act",
      of: ["push"],
    }),
    once: true,
    cast: { rival_man },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: b,
    noBack: true,
    fallback: "give_way",
    options: [
      o("give_way", [closed("prevailed"), authority(-2), trustOf(him, 1)]),
      o("last_stand", [
        closed("broken"),
        inst("chamber", -2),
        trustOf(him, -2),
      ]),
    ],
  },
];

// ---- The kings write to the Republic ----

const head = role("other_ruler");
const toHead = (tone: GwStance): GwEffect => ({
  kind: "letter",
  who: head,
  tone,
});
const thread = (
  id: string,
  ruler: GwTag,
  variants: GwVariant[],
  options: GwOption[],
  more: Partial<GwScene>,
): GwScene => ({
  id,
  nation: NATION,
  kind: "letter",
  who: "other_ruler",
  once: true,
  salience: 6,
  tags: ["foreign"],
  cast: { other_ruler: { ruler_of: ruler } },
  variants,
  fallback: options[0].id,
  options,
  noBack: true,
  ...more,
});
const moods = (...more: GwVariant[]): GwVariant[] => [
  ...more,
  v("hard", character(head, "hardline")),
  v("wary", character(head, "cautious")),
  v("sly", character(head, "opportunist")),
  v("base"),
];
const wrote = (min: number): GwCond => ({ kind: "letters", who: head, min });
const notWar = not(war);

const HEAD_LETTERS: GwScene[] = [
  thread(
    "fra_l_george_1",
    "GBR",
    moods(),
    [
      o("reply_warm", [
        toHead("warm"),
        trust("GBR", 1),
        schedule("fra_l_george_2", 2),
      ]),
      o("reply_formal", [toHead("cold"), schedule("fra_l_george_2", 2)]),
    ],
    { when: all(chapters(1, 3), notWar) },
  ),
  thread(
    "fra_l_george_2",
    "GBR",
    moods(v("war", atDeu), v("calm", not(crisis))),
    [
      o("reply_frank", [
        toHead("frank"),
        trust("GBR", 1),
        inst("countersign", -1),
      ]),
      o("reply_formal", [toHead("cold")]),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  thread(
    "fra_l_george_3",
    "GBR",
    moods(v("beaten", beaten)),
    [
      o("reply_thanks", [toHead("warm"), trust("GBR", 1)]),
      o("reply_ask", [toHead("frank"), trust("GBR", -1), gauge("morale", 1)]),
    ],
    {
      when: all(
        wrote(1),
        atDeu,
        entered("GBR"),
        world({ is: "war_months", own: true, min: 5, max: 35 }),
      ),
    },
  ),
  thread(
    "fra_l_george_4",
    "GBR",
    moods(v("done", world({ is: "armistice" }))),
    [
      o("reply_warm", [toHead("warm"), trust("GBR", 1)]),
      o("reply_short", [toHead("cold")]),
    ],
    {
      when: all(wrote(2), any(world({ is: "armistice" }), from("1917-10"))),
    },
  ),
  thread(
    "fra_l_nicky_1",
    "RUS",
    moods(),
    [
      o("reply_warm", [
        toHead("warm"),
        trust("RUS", 1),
        schedule("fra_l_nicky_2", 2),
      ]),
      o("reply_formal", [toHead("cold"), schedule("fra_l_nicky_2", 2)]),
    ],
    { when: all(chapters(1, 2), notWar) },
  ),
  thread(
    "fra_l_nicky_2",
    "RUS",
    moods(v("calm", not(crisis))),
    [
      o("reply_firm", [
        toHead("warm"),
        trust("RUS", 1),
        { kind: "temp", delta: 1 },
      ]),
      o("reply_counsel", [
        toHead("frank"),
        trust("RUS", -1),
        { kind: "temp", delta: -1 },
      ]),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  thread(
    "fra_l_nicky_3",
    "RUS",
    moods(
      v(
        "beaten",
        world({
          is: "battle",
          theatre: "east",
          of: ["repelled", "stalemate"],
          by: "seat",
        }),
      ),
    ),
    [
      o("reply_guns", [toHead("warm"), trust("RUS", 1), gauge("shells", -1)]),
      o("reply_words", [toHead("frank"), trust("RUS", -1)]),
    ],
    {
      when: all(
        wrote(1),
        atDeu,
        entered("RUS"),
        world({ is: "war_months", own: true, min: 5, max: 29 }),
      ),
    },
  ),
  thread(
    "fra_l_nicky_4",
    "RUS",
    moods(v("no_war", notWar)),
    [
      o("reply_warm", [toHead("warm"), trust("RUS", 1)]),
      o("reply_counsel", [
        toHead("frank"),
        trust("RUS", -1),
        remember("m_fra_told_tsar"),
      ]),
    ],
    { when: all(wrote(2), world({ is: "war_months", min: 26 })) },
  ),
  thread(
    "fra_l_wilson_1",
    "USA",
    moods(v("in", entered("USA"))),
    [
      o("reply_warm", [toHead("warm"), trust("USA", 1)]),
      o("reply_numbers", [
        toHead("frank"),
        doWorld({ do: "readiness", tag: "USA", delta: 1 }),
        trust("USA", -1),
      ]),
    ],
    { when: all(atDeu, world({ is: "war_months", own: true, min: 31 })) },
  ),
];

/** Story scenes drawn by state: aims, rivals, letters, the opening. */
export const FRA_STORY_SCENES: readonly GwScene[] = [
  ...AIM_SCENES,
  ...OPENING_SCENES,
  ...RIVAL_SCENES,
  ...HEAD_LETTERS,
];
