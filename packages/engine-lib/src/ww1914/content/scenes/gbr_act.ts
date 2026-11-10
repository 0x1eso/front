import type {
  GwGauge,
  GwInstitution,
  GwOpening,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  byName,
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
  memory,
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

/**
 * 「영국」, ww151: what the Prime Minister starts himself. The scenes of the
 * schedule (entries in ../acts/gbr.ts), the scenes that press on the declared
 * aim, the big scenes and their silent cards, the man at his elbow, the letters
 * of the King's cousins, and the first night of a first game. Text in
 * resources/ww1914/ko/GBR.act.json.
 *
 * The seat is a Prime Minister, not a ruler. A cousin writes to the King, and
 * the King's answer is the Prime Minister's to draft: that is the letters.
 */

const NATION: GwScene["nation"] = ["GBR"];
const CRISIS: GwScene["stage"] = ["crisis"];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

/** A paper the schedule calls. Nobody to send it back to: it was the seat's. */
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
/** What the seat saw with its own eyes. */
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

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const cabinet = (d: number) => inst("cabinet", d);
const commons = (d: number) => inst("commons", d);
const opposition = (d: number) => inst("opposition", d);
const irish = (d: number) => inst("irish", d);
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const ireland = (delta: number): GwEffect => ({
  kind: "pressure",
  topic: "ireland",
  delta,
});
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
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
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});

const war = world({ is: "war" });
const atDeu: GwCond = { kind: "at_war", tag: "DEU" };
const lg = flag("f_pm_lg");
const notLg = not(lg);
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const tempAt = (min: number): GwCond => ({ kind: "temp", min });
const chapters = (min: number, max?: number): GwCond =>
  max === undefined ? { kind: "chapter", min } : { kind: "chapter", min, max };
const gaugeAt = (g: GwGauge, min?: number, max?: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});
const irishHeat = (min: number): GwCond => ({
  kind: "pressure",
  topic: "ireland",
  min,
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (r: string): GwCond => ({ kind: "tone_fits", who: role(r) });
const leans = (r: string, camp: "hard" | "liberal" | "military"): GwCond => ({
  kind: "leans",
  who: role(r),
  camp,
});
const able = (r: string, field: "war" | "politics" | "admin"): GwCond => ({
  kind: "competence",
  who: role(r),
  field,
  min: 3,
});
const heavy = world({ is: "casualties", min: 400 });

// ---- 시찰: where the Prime Minister goes ----

const VISITS: GwScene[] = [
  seenCard(
    "gbr_a_fleet_v",
    { navy: holder("navy") },
    [
      v("subs", all(war, world({ is: "uboat", min: 1 }))),
      v("war", war),
      v("base"),
    ],
    ["war"],
  ),
  card(
    "gbr_a_woolwich_v",
    "proposal",
    { fin: holder("finance") },
    [
      v("short", all(war, gaugeAt("shells", undefined, 1))),
      v("good", all(war, gaugeAt("shells", 2))),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "note_it",
      options: [
        o("note_it", [], [trustOf(role("fin"), 1)]),
        o(
          "night_shift",
          ["shells:+1", "money:-1"],
          [gauge("shells", 1), gauge("money", -1), reason("a_woolwich_r1")],
          war,
        ),
      ],
    },
  ),
  card(
    "gbr_a_clyde_v",
    "proposal",
    { home: holder("interior") },
    [
      v(
        "strike",
        all(
          war,
          any(gaugeAt("order", undefined, 2), world({ is: "unrest", min: 1 })),
        ),
      ),
      v("busy", war),
      v("base"),
    ],
    {
      fallback: "yard_only",
      options: [
        o("yard_only", [], [trustOf(role("home"), 1)]),
        o(
          "hear_stewards",
          ["order:+1", "opposition:+1"],
          [gauge("order", 1), opposition(1), opinion("workers", 1)],
        ),
      ],
    },
  ),
  card(
    "gbr_a_gq_v",
    "proposal",
    { cos: holder("chief_of_staff") },
    [
      v(
        "beaten",
        all(
          world({
            is: "battle",
            theatre: "west",
            of: ["repelled", "stalemate"],
            by: "seat",
          }),
          gaugeAt("morale", undefined, 2),
        ),
      ),
      v("trench", { kind: "trench", theatre: "west", min: 2 }),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "with_staff",
      options: [
        o("with_staff", [], [trustOf(role("cos"), 1)]),
        o(
          "to_the_line",
          ["morale:+1", "cos:-1"],
          [gauge("morale", 1), trustOf(role("cos"), -1)],
        ),
      ],
    },
  ),
  seenCard("gbr_a_netley_v", {}, [v("heavy", heavy), v("base")]),
  card(
    "gbr_a_dublin_v",
    "proposal",
    { ire: holder("ireland") },
    [
      v("lives", flag("f_home_rule_lives")),
      v("after", seen("gbr_h_easter")),
      v("hot", irishHeat(3)),
      v("base"),
    ],
    {
      fallback: "castle",
      options: [
        o("castle", [], [trustOf(role("ire"), 1)]),
        o("walk_city", ["ireland:-1", "irish:+1"], [ireland(-1), irish(1)]),
      ],
    },
  ),
  card(
    "gbr_a_belfast_v",
    "proposal",
    { ire: holder("ireland") },
    [v("hot", irishHeat(3)), v("base")],
    {
      fallback: "home_again",
      options: [
        o("home_again", [], []),
        o(
          "see_their_men",
          ["irish:-1"],
          [irish(-1), remember("k_car_clean"), reason("a_belfast_r1")],
        ),
      ],
    },
  ),
  card(
    "gbr_a_city_v",
    "proposal",
    { fin: holder("finance") },
    [
      v("panic", all(crisis, tempAt(6))),
      v("tight", all(war, gaugeAt("money", undefined, 1))),
      v("base"),
    ],
    {
      fallback: "hear_only",
      options: [
        o("hear_only", [], []),
        o(
          "ask_governor",
          ["fin:+1"],
          [
            trustOf(role("fin"), 1),
            remember("k_lg_city"),
            opinion("business", 1),
          ],
        ),
      ],
    },
  ),
  seenCard(
    "gbr_a_room40_v",
    { hall: { person: "gbr_hall" } },
    [
      v(
        "wire",
        all(
          { kind: "secret", id: "deu_zimmermann_wire" },
          world({ is: "date", from: "1917-01" }),
        ),
      ),
      v("base"),
    ],
    ["war"],
  ),
  seenCard(
    "gbr_a_dover_v",
    { navy: holder("navy") },
    [v("loose", world({ is: "uboat", min: 2 })), v("base")],
    ["war"],
  ),
  seenCard(
    "gbr_a_liverpool_v",
    {},
    [
      v(
        "count",
        all(
          { kind: "secret", id: "gbr_sailings_count" },
          world({ is: "date", from: "1917-01" }),
        ),
      ),
      v("short", gaugeAt("bread", undefined, 1)),
      v("base"),
    ],
    ["war"],
  ),
  seenCard(
    "gbr_a_salisbury_v",
    {},
    [
      v("drafted", flag("f_gbr_conscript")),
      v("early", world({ is: "date", to: "1915-03" })),
      v("base"),
    ],
    ["war"],
  ),
  seenCard("gbr_a_gretna_v", {}, [
    v("short", gaugeAt("shells", undefined, 1)),
    v("base"),
  ]),
  seenCard("gbr_a_seat_v", {}, [
    v("lg", lg),
    v("lists", all(notLg, war, heavy)),
    v("war", all(notLg, war)),
    v("base"),
  ]),
];

// ---- 친서: the reply comes later ----

const LETTERS: GwScene[] = [
  card(
    "gbr_a_l_nicky_r",
    "proposal",
    { tsar: { ruler_of: "RUS" } },
    [
      v("mob_fit", all(picked("subject", "mobilise"), fits("tsar"))),
      v("mob", picked("subject", "mobilise")),
      v("straits", picked("subject", "straits")),
      v(
        "shells_hard",
        all(picked("subject", "shells"), character(role("tsar"), "hardline")),
      ),
      v("shells", picked("subject", "shells")),
      v("family_fit", fits("tsar")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "answer_kindly",
          ["rus:+1"],
          [trust("RUS", 1), maybe(fits("tsar"), temp(-1))],
        ),
      ],
    },
  ),
  card(
    "gbr_a_l_willy_r",
    "proposal",
    { kaiser: { ruler_of: "DEU" } },
    [
      v(
        "fleet_cunning",
        all(
          picked("subject", "fleet"),
          character(role("kaiser"), "opportunist"),
        ),
      ),
      v("fleet", picked("subject", "fleet")),
      v(
        "serbia_hard",
        all(picked("subject", "serbia"), character(role("kaiser"), "hardline")),
      ),
      v("serbia_fit", all(picked("subject", "serbia"), fits("kaiser"))),
      v("serbia", picked("subject", "serbia")),
      v("belgium", picked("subject", "belgium")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "show_grey",
          ["fm:+1"],
          [trustOf(byName("gbr_grey"), 1), maybe(crisis, temp(-1))],
        ),
      ],
    },
  ),
  card(
    "gbr_a_l_wilson_r",
    "proposal",
    { pres: { ruler_of: "USA" } },
    [
      v("cotton_fit", all(picked("subject", "cotton"), fits("pres"))),
      v("cotton", picked("subject", "cotton")),
      v("peace_fit", all(picked("subject", "peace"), fits("pres"))),
      v("peace", picked("subject", "peace")),
      v("loans", picked("subject", "loans")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "send_answer",
          ["usa:+1"],
          [
            trust("USA", 1),
            maybe(
              fits("pres"),
              doWorld({ do: "readiness", tag: "USA", delta: 1 }),
            ),
          ],
        ),
      ],
    },
  ),
  card(
    "gbr_a_l_poincare_r",
    "proposal",
    { pres: { ruler_of: "FRA" } },
    [
      v("command", picked("subject", "command")),
      v("divisions_fit", all(picked("subject", "divisions"), fits("pres"))),
      v("divisions", picked("subject", "divisions")),
      v("coast_fit", fits("pres")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "answer_him",
          ["fra:+1", "cabinet:-1"],
          [trust("FRA", 1), cabinet(-1)],
        ),
      ],
    },
  ),
  card(
    "gbr_a_l_redmond_r",
    "proposal",
    { red: { person: "gbr_redmond" } },
    [
      v("amnesty", picked("subject", "amnesty")),
      v("division_fit", all(picked("subject", "division"), fits("red"))),
      v("division", picked("subject", "division")),
      v("counties_fit", fits("red")),
      v("base"),
    ],
    {
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "take_his_word",
          ["irish:+1", "opposition:+1"],
          [
            irish(1),
            opposition(1),
            trustOf(role("red"), 1),
            maybe(picked("subject", "counties"), remember("k_red_counties")),
            maybe(picked("subject", "division"), remember("k_red_division")),
            maybe(picked("subject", "amnesty"), remember("k_red_amnesty")),
          ],
        ),
      ],
    },
  ),
  card(
    "gbr_a_l_carson_r",
    "proposal",
    { car: { person: "gbr_carson" } },
    [
      v("office", picked("subject", "office")),
      v("rifles_fit", all(picked("subject", "rifles"), fits("car"))),
      v("rifles", picked("subject", "rifles")),
      v("line_fit", fits("car")),
      v("base"),
    ],
    {
      fallback: "file",
      options: [
        o("file", [], []),
        o(
          "meet_him",
          ["opposition:-1", "irish:-1"],
          [
            opposition(-1),
            irish(-1),
            trustOf(role("car"), 1),
            maybe(picked("subject", "line"), remember("k_car_clean")),
            maybe(picked("subject", "office"), remember("k_car_office")),
          ],
        ),
      ],
    },
  ),
];

// ---- 칙령과 지시 ----

const pair = { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } };

const ORDERS: GwScene[] = [
  card(
    "gbr_a_o_inquiry_r",
    "report",
    {},
    [
      v(
        "shells_bad",
        all(picked("subject", "shells"), gaugeAt("shells", undefined, 1)),
      ),
      v("shells", picked("subject", "shells")),
      v("rifles_hot", all(picked("subject", "rifles"), irishHeat(3))),
      v("rifles", picked("subject", "rifles")),
      v(
        "bread_bad",
        all(picked("subject", "bread"), gaugeAt("bread", undefined, 1)),
      ),
      v("bread", picked("subject", "bread")),
      v(
        "recruits_bad",
        all(picked("subject", "recruits"), world({ is: "manpower", max: 55 })),
      ),
      v("base"),
    ],
    { stamp: "estimate", source: "staff" },
  ),
  card(
    "gbr_a_o_commission_r",
    "proposal",
    { fm: holder("foreign") },
    [
      v("straits", picked("subject", "straits")),
      v("kut", picked("subject", "kut")),
      v("base"),
    ],
    {
      fallback: "shelve",
      options: [
        o("shelve", ["opposition:+1"], [opposition(1)]),
        o(
          "publish",
          ["opposition:-1", "cabinet:-1"],
          [opposition(-1), cabinet(-1), commons(1)],
        ),
      ],
    },
  ),
  card(
    "gbr_a_o_cid_r",
    "proposal",
    pair,
    [
      v(
        "belgium_split",
        all(
          picked("agenda", "belgium"),
          leans("a", "hard"),
          not(leans("b", "hard")),
        ),
      ),
      v("belgium", picked("agenda", "belgium")),
      v("book", picked("agenda", "war_book")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "keep_paper",
      options: [
        o("keep_paper", [], []),
        o(
          "show_table",
          ["cabinet:-1"],
          [cabinet(-1), remember("k_bal_cid"), reason("a_cid_r1")],
        ),
      ],
    },
  ),
  card(
    "gbr_a_o_council_r",
    "proposal",
    pair,
    [
      v("west_soldier", all(picked("agenda", "west"), leans("a", "military"))),
      v("west", picked("agenda", "west")),
      v("east_able", all(picked("agenda", "east"), able("a", "war"))),
      v("east", picked("agenda", "east")),
      v("sea", picked("agenda", "sea")),
      v("base"),
    ],
    {
      tags: ["war"],
      fallback: "note_both",
      options: [
        o("note_both", [], []),
        o(
          "side_with_a",
          ["cabinet:-1"],
          [trustOf(role("a"), 1), trustOf(role("b"), -1), cabinet(-1)],
        ),
        o(
          "side_with_b",
          ["cabinet:-1"],
          [trustOf(role("b"), 1), trustOf(role("a"), -1), cabinet(-1)],
        ),
      ],
    },
  ),
  card(
    "gbr_a_o_dinner_r",
    "proposal",
    pair,
    [
      v(
        "war_worn",
        all(picked("agenda", "war"), gaugeAt("morale", undefined, 2)),
      ),
      v("war", picked("agenda", "war")),
      v("ireland", picked("agenda", "ireland")),
      v("base"),
    ],
    {
      tags: ["people"],
      fallback: "let_talk",
      options: [
        o("let_talk", ["cabinet:+1"], [cabinet(1)]),
        o(
          "make_them_agree",
          ["cabinet:+1", "authority:-1"],
          [
            cabinet(1),
            trustOf(role("a"), 1),
            trustOf(role("b"), 1),
            authority(-1),
          ],
        ),
      ],
    },
  ),
  card(
    "gbr_a_o_envoy_r",
    "proposal",
    { e: { picked: "envoy" } },
    [
      v(
        "able_washington",
        all(picked("where", "washington"), able("e", "politics")),
      ),
      v("washington", picked("where", "washington")),
      v("able_paris", all(picked("where", "paris"), able("e", "politics"))),
      v("paris", picked("where", "paris")),
      v("rome", picked("where", "rome")),
      v("base"),
    ],
    {
      tags: ["foreign"],
      fallback: "take_note",
      options: [
        o("take_note", [], []),
        o(
          "thank_him",
          ["trust:+1"],
          [trustOf(role("e"), 1), maybe(able("e", "politics"), authority(1))],
        ),
      ],
    },
  ),
  card(
    "gbr_a_o_minutes_r",
    "report",
    { sec: { person: "gbr_hankey" } },
    [v("book", picked("how", "book")), v("base")],
    { stamp: "confirmed", source: "own_eyes", tags: ["people"] },
  ),
  card(
    "gbr_a_o_editors_r",
    "report",
    {},
    [
      v("lists_war", all(picked("on", "lists"), heavy)),
      v("lists", picked("on", "lists")),
      v("censor", picked("on", "censor")),
      v("base"),
    ],
    { tags: ["home"] },
  ),
];

// ---- 연설: the scene shows how it was taken ----

const SPEECHES: GwScene[] = [
  card("gbr_a_s_commons_r", "report", {}, [
    v("war_bad", all(picked("on", "war"), gaugeAt("morale", undefined, 2))),
    v("war", picked("on", "war")),
    v("ireland", picked("on", "ireland")),
    v("base"),
  ]),
  card("gbr_a_s_guildhall_r", "report", {}, [
    v("belgium", picked("on", "belgium")),
    v("money", picked("on", "money")),
    v("base"),
  ]),
  card("gbr_a_s_recruit_r", "report", {}, [
    v("dublin", picked("place", "dublin")),
    v("drafted", flag("f_gbr_conscript")),
    v("base"),
  ]),
  card("gbr_a_s_ireland_r", "report", {}, [
    v("belfast", picked("place", "belfast")),
    v("dublin_deal", picked("on", "deal")),
    v("base"),
  ]),
  card("gbr_a_s_seat_r", "report", {}, [
    v("lists", all(picked("on", "lists"), heavy)),
    v("bread", picked("on", "bread")),
    v("base"),
  ]),
  card("gbr_a_s_labour_r", "report", {}, [
    v(
      "clyde_bad",
      all(picked("place", "clyde"), gaugeAt("order", undefined, 2)),
    ),
    v("clyde", picked("place", "clyde")),
    v("draft", picked("on", "draft")),
    v("base"),
  ]),
];

// ---- 뒷공작 ----

const INTRIGUES: GwScene[] = [
  card("gbr_a_i_leak_r", "report", {}, [
    v("carson", picked("what", "carson")),
    v("war_office", picked("what", "war_office")),
    v("base"),
  ]),
  card("gbr_a_i_leak_out", "proposal", {}, [v("base")], {
    salience: 7,
    fallback: "deny",
    options: [
      o("deny", ["opposition:+1"], [opposition(1), reason("a_leak_out_r1")]),
      o("own_up", ["cabinet:-1", "authority:-1"], [cabinet(-1), authority(-1)]),
    ],
  }),
  card(
    "gbr_a_i_set_on_r",
    "report",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    [v("proud", { kind: "pride", who: role("a"), min: 2 }), v("base")],
    { tags: ["people"] },
  ),
  card(
    "gbr_a_i_set_on_out",
    "proposal",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    [v("base")],
    {
      salience: 7,
      tags: ["people"],
      fallback: "say_nothing",
      options: [
        o(
          "say_nothing",
          ["cabinet:-2"],
          [cabinet(-2), trustOf(role("a"), -2), trustOf(role("b"), -2)],
        ),
        o(
          "dine_them",
          ["cabinet:-1", "authority:-1"],
          [
            cabinet(-1),
            trustOf(role("a"), -1),
            trustOf(role("b"), -1),
            authority(-1),
          ],
        ),
      ],
    },
  ),
  card("gbr_a_i_whips_r", "report", {}, [
    v("peerage", picked("offer", "peerage")),
    v("base"),
  ]),
  card("gbr_a_i_whips_out", "proposal", {}, [v("base")], {
    salience: 7,
    fallback: "stand_by",
    options: [
      o("stand_by", ["opposition:+2"], [opposition(2)]),
      o(
        "drop_the_name",
        ["commons:-1", "opposition:+1"],
        [commons(-1), opposition(1), reason("a_whips_out_r1")],
      ),
    ],
  }),
  card(
    "gbr_a_i_agents_r",
    "report",
    {},
    [
      v("geneva", picked("where", "geneva")),
      v("petrograd", picked("where", "petrograd")),
      v("base"),
    ],
    { tags: ["foreign"], stamp: "unconfirmed", source: "agents" },
  ),
  card(
    "gbr_a_i_agents_out",
    "proposal",
    { fm: holder("foreign") },
    [v("base")],
    {
      salience: 7,
      tags: ["foreign"],
      fallback: "recall",
      options: [
        o("recall", ["fm:-1"], [trustOf(role("fm"), -1)]),
        o("disown", ["usa:-1"], [trust("USA", -1), reason("a_agents_out_r1")]),
      ],
    },
  ),
  card(
    "gbr_a_i_castle_r",
    "report",
    {},
    [
      v("hot_belfast", all(picked("where", "belfast"), irishHeat(3))),
      v("belfast", picked("where", "belfast")),
      v("hot_dublin", irishHeat(3)),
      v("base"),
    ],
    { stamp: "unconfirmed", source: "agents" },
  ),
  card(
    "gbr_a_i_castle_out",
    "proposal",
    { ire: holder("ireland") },
    [v("base")],
    {
      salience: 7,
      fallback: "stop_it",
      options: [
        o("stop_it", ["irish:-1"], [irish(-1), ireland(1)]),
        o(
          "defend_it",
          ["irish:-2", "opposition:-1"],
          [irish(-2), ireland(2), opposition(-1)],
        ),
      ],
    },
  ),
  card("gbr_a_i_press_r", "report", {}, [
    v("buy", picked("how", "buy")),
    v("feed", picked("how", "feed")),
    v("base"),
  ]),
  card("gbr_a_i_press_out", "proposal", {}, [v("base")], {
    salience: 7,
    fallback: "ride_it",
    options: [
      o("ride_it", ["opposition:+1"], [opposition(1), opinion("press", -1)]),
      o(
        "see_him",
        ["authority:-1"],
        [authority(-1), remember("k_north_press")],
      ),
    ],
  }),
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
  variants: [v("base")],
  fallback: options[0].id,
  options,
  noBack: true,
});
const aim = (...of: string[]): GwCond => ({ kind: "aim", of });

const AIM_SCENES: GwScene[] = [
  aimScene(
    "gbr_aim_p_belgium",
    all(
      aim("gbr_aim_belgium"),
      war,
      world({ is: "war_months", own: true, min: 5, max: 41 }),
      world({ is: "score", max: 0 }),
    ),
    { fm: holder("foreign") },
    [
      o(
        "say_again",
        ["morale:+1", "cabinet:-1"],
        [gauge("morale", 1), cabinet(-1), trust("FRA", 1)],
      ),
      o(
        "soften",
        ["cabinet:+1"],
        [cabinet(1), trust("FRA", -1), reason("aim_belgium_r1")],
      ),
    ],
  ),
  aimScene(
    "gbr_aim_p_win",
    all(aim("gbr_aim_win"), war, heavy),
    { cos: holder("chief_of_staff") },
    [
      o(
        "no_talks",
        ["morale:+1", "opposition:-1"],
        [gauge("morale", 1), opposition(-1), opinion("workers", -1)],
      ),
      o(
        "hear_them",
        ["cabinet:+1", "opposition:+1"],
        [cabinet(1), opposition(1)],
      ),
    ],
  ),
  aimScene(
    "gbr_aim_p_sea",
    all(
      aim("gbr_aim_sea"),
      war,
      world({ is: "war_months", own: true, min: 11, max: 47 }),
    ),
    { navy: holder("navy") },
    [
      o(
        "ships_first",
        ["shipping:+1", "manpower:-5"],
        [
          doWorld({ do: "shipping", delta: 1 }),
          doWorld({ do: "manpower", delta: -5 }),
        ],
      ),
      o(
        "army_first",
        ["navy:-1"],
        [trustOf(role("navy"), -1), reason("aim_sea_r1")],
      ),
    ],
  ),
  aimScene(
    "gbr_aim_p_peace",
    all(
      aim("gbr_aim_peace"),
      world({ is: "neutral", tag: "GBR" }),
      world({ is: "entered", tag: "FRA" }),
    ),
    { fm: holder("foreign") },
    [
      o("hold_on", ["fra:-1", "commons:+1"], [trust("FRA", -1), commons(1)]),
      o(
        "arm_quietly",
        ["money:-1", "opposition:-1"],
        [gauge("money", -1), opposition(-1)],
      ),
    ],
    ["foreign"],
  ),
  aimScene(
    "gbr_aim_p_ireland",
    all(
      aim("gbr_aim_ireland"),
      not(flag("f_home_rule_lives")),
      not(flag("f_ireland_settled")),
    ),
    { ire: holder("ireland") },
    [
      o(
        "spend_it",
        ["ireland:-1", "cabinet:-1"],
        [ireland(-1), cabinet(-1), irish(1)],
      ),
      o("after_war", ["irish:-1"], [irish(-1), reason("aim_ireland_r1")]),
    ],
    ["home"],
  ),
  aimScene(
    "gbr_aim_p_liberal",
    all(
      aim("gbr_aim_liberal"),
      war,
      world({ is: "war_months", own: true, min: 11, max: 29 }),
      world({ is: "manpower", max: 55 }),
    ),
    { home: holder("interior") },
    [
      o(
        "hold_the_door",
        ["cabinet:+1", "opposition:+1"],
        [cabinet(1), opposition(1)],
      ),
      o(
        "open_register",
        ["opposition:-1", "cabinet:-1"],
        [opposition(-1), cabinet(-1), doWorld({ do: "manpower", delta: 5 })],
      ),
    ],
    ["home"],
  ),
];

// ---- 고비: the big scenes ----

const alone = (
  says: GwVariant[],
  replies: GwReply[],
  fallback?: string,
): GwNode => ({
  alone: true,
  says,
  replies,
  ...(fallback === undefined ? {} : { fallback }),
});
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
const go = (
  id: string,
  next: string | null,
  stance: GwStance = "frank",
  kind: GwReply["kind"] = "ask",
): GwReply => ({
  id,
  stance,
  kind,
  tell: [],
  effects: [],
  next,
});

const big = (
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  who: string,
  nodes: Record<string, GwNode>,
  after: string,
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["war", "tension_up"],
  when,
  cast,
  who,
  start: "n1",
  variants: [v("base")],
  nodes,
  after: [{ scene: after }],
  ...more,
});

const b = [v("base")];
const opening = (...of: GwOpening[]): GwCond => ({ kind: "opening", of });

/** Two big scenes in two weeks: the draw's spacing would hold this one back. */
const toSunday = schedule("gbr_big_sunday", 1);

const BIG_SCENES: GwScene[] = [
  big(
    "gbr_big_first",
    all({ kind: "first_game" }, chapters(0, 0)),
    {
      fm: { person: "gbr_grey" },
      fin: { person: "gbr_lloyd_george" },
      navy: { person: "gbr_churchill" },
    },
    "fin",
    {
      n1: alone(b, [decide("sit", "n2")]),
      n2: at("fin", b, [go("ask_count", "n3")]),
      n3: at("navy", b, [go("ask_ships", "n4")]),
      n4: at(
        "fm",
        [
          v("survived", opening("sarajevo_survived")),
          v("failed", opening("sarajevo_failed", "sarajevo_delayed")),
          v("none", opening("no_sarajevo")),
          v("base"),
        ],
        [go("ask_vienna", "n4b"), go("later", "n5", "cold")],
      ),
      n4b: at("fm", b, [go("thanks", "n5", "warm")]),
      n5: at(
        "fin",
        b,
        [
          decide("wait_lords", null, [
            cabinet(1),
            remember("m_gbr_first_wait"),
          ]),
          decide(
            "ships",
            null,
            [
              irish(1),
              opposition(1),
              ireland(1),
              trustOf(role("navy"), 1),
              remember("m_gbr_first_ships"),
            ],
            ["irish:+1", "opposition:+1", "ireland:+1"],
          ),
          decide(
            "word_carson",
            null,
            [
              irish(-1),
              ireland(-1),
              trustOf(role("fin"), 1),
              remember("k_car_clean"),
              remember("m_gbr_first_carson"),
            ],
            ["irish:-1", "ireland:-1"],
          ),
          decide(
            "word_redmond",
            null,
            [
              irish(1),
              cabinet(-1),
              remember("k_red_counties"),
              remember("m_gbr_first_redmond"),
            ],
            ["irish:+1", "cabinet:-1"],
          ),
        ],
        "wait_lords",
      ),
    },
    "gbr_big_first_quiet",
    { stage: CRISIS, tags: ["home", "tension_up"], essential: true },
  ),
  big(
    "gbr_big_nicky",
    all(
      crisis,
      tempAt(5),
      world({ is: "chain", short: false, min: 4, max: 4 }),
      not(atDeu),
    ),
    { fm: holder("foreign"), king: { person: "gbr_george_v" } },
    "fm",
    {
      n1: alone(b, [decide("open_it", "n2")]),
      n2: at(
        "fm",
        b,
        [
          decide(
            "clear_up",
            "n3",
            [temp(-1), trust("RUS", 1), remember("m_gbr_nicky_clear")],
            ["temp:-1", "rus:+1"],
          ),
          decide(
            "warn_tsar",
            "n3",
            [trust("RUS", -1), cabinet(1), remember("m_gbr_nicky_warn")],
            ["rus:-1", "cabinet:+1"],
          ),
          decide(
            "stand_by",
            "n3",
            [
              trust("RUS", 2),
              trust("FRA", 1),
              cabinet(-2),
              temp(1),
              remember("m_gbr_nicky_stand"),
            ],
            ["rus:+2", "fra:+1", "cabinet:-2", "temp:+1"],
          ),
        ],
        "clear_up",
      ),
      n3: alone(b, [decide("drive_on", "n4")]),
      n4: at(
        "king",
        [
          v("stand", memory("m_gbr_nicky_stand")),
          v("warn", memory("m_gbr_nicky_warn")),
          v("base"),
        ],
        [go("yes_sir", "n5", "warm")],
      ),
      n5: at(
        "king",
        b,
        [
          decide("only_nicky", "n6", [trustOf(role("king"), 1)], ["king:+1"]),
          decide(
            "willy_too",
            "n6",
            [temp(-1), cabinet(-1), trustOf(role("king"), 1), trust("DEU", 1)],
            ["temp:-1", "cabinet:-1", "deu:+1"],
          ),
        ],
        "only_nicky",
      ),
      n6: alone(b, [
        decide("read_cabinet", null, [cabinet(1), toSunday], ["cabinet:+1"]),
        decide(
          "keep_it",
          null,
          [authority(1), cabinet(-1), remember("m_gbr_nicky_kept"), toSunday],
          ["authority:+1", "cabinet:-1"],
        ),
      ]),
    },
    "gbr_big_nicky_quiet",
    { stage: CRISIS, tags: ["foreign", "tension_up"] },
  ),
  big(
    "gbr_big_sunday",
    all(
      crisis,
      tempAt(6),
      world({ is: "chain", short: false, min: 5, max: 5 }),
      not(atDeu),
    ),
    {
      fm: holder("foreign"),
      fin: holder("finance"),
      lich: { person: "deu_lichnowsky" },
      morley: { person: "gbr_morley" },
      law: { person: "gbr_bonar_law" },
    },
    "lich",
    {
      n1: alone(b, [decide("breakfast", "n2")]),
      n2: at(
        "lich",
        b,
        [
          decide("hear_lich", "n3", [remember("k_lich_last")], []),
          decide("send_lich", "n3", [trust("DEU", -1)], ["deu:-1"]),
        ],
        "hear_lich",
      ),
      n3: at(
        "law",
        b,
        [
          decide(
            "answer_law",
            "n4",
            [remember("k_law_letter"), opposition(-1)],
            ["opposition:-1"],
          ),
          decide("leave_law", "n4", [opposition(1)], ["opposition:+1"]),
        ],
        "leave_law",
      ),
      n4: at(
        "morley",
        b,
        [
          decide("beg_morley", "n5", [remember("k_morley_stay")], []),
          decide("let_morley", "n5", [cabinet(-1)], ["cabinet:-1"]),
        ],
        "beg_morley",
      ),
      n5: at(
        "fin",
        b,
        [
          decide(
            "belgium_line",
            "n6",
            [remember("k_lg_belgium"), remember("v_entry", role("fin"))],
            [],
          ),
          decide("no_line", "n6", [trustOf(role("fin"), -1)], ["fin:-1"]),
        ],
        "belgium_line",
      ),
      n6: at("fm", b, [decide("to_table", null)]),
      c1: alone(b, [decide("rest", null)]),
    },
    "gbr_big_sunday_quiet",
    {
      stage: CRISIS,
      tags: ["foreign", "tension_up"],
      variants: [v("calm", not(crisis)), v("base")],
      starts: { calm: "c1" },
    },
  ),
  big(
    "gbr_big_aside",
    all(
      world({ is: "neutral", tag: "GBR" }),
      world({ is: "entered", tag: "FRA" }),
      // France's first months: its fleet is south, its coast open.
      world({ is: "war_months", max: 4 }),
    ),
    {
      fm: holder("foreign"),
      navy: holder("navy"),
      amb: { person: "fra_paul_cambon" },
    },
    "amb",
    {
      n1: alone(b, [decide("receive", "n2")]),
      n2: at(
        "amb",
        b,
        [
          decide("no_answer", "n3", [trust("FRA", -1)], ["fra:-1"]),
          decide(
            "coast_word",
            "n3",
            [trust("FRA", 1), trust("DEU", -1), cabinet(-1)],
            ["fra:+1", "deu:-1", "cabinet:-1"],
          ),
        ],
        "no_answer",
      ),
      n3: at("fm", b, [go("hear_fm", "n4")]),
      n4: at(
        "navy",
        b,
        [
          decide(
            "keep_mobilised",
            "n5",
            [gauge("money", -1), opposition(-1)],
            ["money:-1", "opposition:-1"],
          ),
          decide(
            "stand_down",
            "n5",
            [gauge("money", 1), trustOf(role("navy"), -1)],
            ["money:+1", "navy:-1"],
          ),
        ],
        "keep_mobilised",
      ),
      n5: alone(b, [
        decide(
          "offer_london",
          null,
          [commons(1), remember("m_gbr_aside_london")],
          ["commons:+1"],
        ),
        decide("say_nothing", null, []),
      ]),
    },
    "gbr_big_aside_quiet",
    { stage: ["crisis", "y1914", "war"], tags: ["foreign", "tension_up"] },
  ),
  big(
    "gbr_big_may",
    all(
      atDeu,
      notLg,
      world({ is: "war_months", own: true, min: 7, max: 14 }),
      any(
        seen("gbr_w_fisher_out"),
        chose("gbr_h_shells"),
        gaugeAt("shells", undefined, 1),
      ),
    ),
    {
      fin: holder("finance"),
      war: { any_of: [{ office: "war" }, { office: "foreign" }] },
      law: { person: "gbr_bonar_law" },
    },
    "war",
    {
      n1: alone(b, [decide("read_times", "n2")]),
      n2: at(
        "war",
        b,
        [
          decide(
            "stand_by_war",
            "n3",
            [trustOf(role("war"), 1), opposition(1)],
            ["opposition:+1"],
          ),
          decide(
            "press_war",
            "n3",
            [trustOf(role("war"), -1), remember("k_kit_shells")],
            [],
          ),
        ],
        "stand_by_war",
      ),
      n3: alone(
        [v("letter", seen("gbr_h_engagement")), v("base")],
        [decide("on_alone", "n4")],
      ),
      n4: at("fin", b, [go("hear_fin", "n5")]),
      n5: at(
        "law",
        b,
        [
          decide(
            "terms_first",
            null,
            [remember("k_law_coalition"), opposition(-1)],
            ["opposition:-1"],
          ),
          decide(
            "no_terms",
            null,
            [opposition(1), commons(1)],
            ["opposition:+1", "commons:+1"],
          ),
        ],
        "terms_first",
      ),
    },
    "gbr_big_may_quiet",
    { stage: ["war"], tags: ["home", "tension_up"] },
  ),
  big(
    "gbr_big_dublin",
    all(
      seen("gbr_h_easter"),
      notLg,
      world({ is: "war_months", min: 20, max: 26 }),
    ),
    { red: { person: "gbr_redmond" }, law: { person: "gbr_bonar_law" } },
    "red",
    {
      n1: alone(b, [decide("land", "n2")]),
      n2: alone(b, [
        decide(
          "speak_prisoners",
          "n3",
          [ireland(-1), remember("m_gbr_dublin_spoke")],
          ["ireland:-1"],
        ),
        decide("keep_castle", "n3", []),
      ]),
      n3: at("red", b, [go("hear_red", "n4", "warm")]),
      n4: alone(
        b,
        [
          decide(
            "hand_talks",
            "n5",
            [
              remember("k_car_lastword"),
              remember("k_red_convention"),
              trustOf(role("red"), 1),
              cabinet(-1),
            ],
            ["redmond:+1", "cabinet:-1"],
          ),
          decide(
            "wait_war",
            "n5",
            [irish(-1), ireland(1)],
            ["irish:-1", "ireland:+1"],
          ),
        ],
        "hand_talks",
      ),
      n5: at("law", b, [decide("go_home", null)]),
    },
    "gbr_big_dublin_quiet",
    { stage: ["war"], tags: ["home", "tension_down"] },
  ),
  big(
    "gbr_big_december",
    all(
      atDeu,
      notLg,
      world({ is: "war_months", own: true, min: 23, max: 29 }),
      any(flag("f_coalition"), { kind: "inst", inst: "opposition", min: 2 }),
    ),
    {
      lg: { person: "gbr_lloyd_george" },
      law: { person: "gbr_bonar_law" },
      mck: { person: "gbr_mckenna" },
    },
    "law",
    {
      n1: alone(
        [v("raymond", seen("gbr_h_raymond")), v("base")],
        [decide("read_leader", "n2")],
      ),
      n2: at(
        "law",
        b,
        [
          decide("ask_law", "n3", [remember("k_law_december")], []),
          decide("cold_law", "n3", [trustOf(role("law"), -1)], ["trust:-1"]),
        ],
        "ask_law",
      ),
      n3: at(
        "lg",
        b,
        [
          decide(
            "keep_chair_in",
            "n4",
            [remember("k_han_minutes"), trustOf(role("lg"), 1)],
            [],
          ),
          decide(
            "offer_chair",
            "n4",
            [remember("k_lg_committee"), authority(-1)],
            ["authority:-1"],
          ),
        ],
        "keep_chair_in",
      ),
      n4: at(
        "mck",
        b,
        [
          decide("hold_fast", "n5", [remember("k_mck_stand")], []),
          decide("no_counting", "n5", [cabinet(1)], ["cabinet:+1"]),
        ],
        "hold_fast",
      ),
      n5: alone(b, [decide("to_bed", null)]),
    },
    "gbr_big_december_quiet",
    { stage: ["war"], tags: ["home", "tension_up"] },
  ),
  big(
    "gbr_big_wheat",
    all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 41 }),
      any(world({ is: "uboat", min: 2 }), gaugeAt("bread", undefined, 1)),
    ),
    {
      navy: holder("navy"),
      lord: holder("sea_lord"),
      sec: { person: "gbr_hankey" },
    },
    "sec",
    {
      n1: alone(b, [decide("read_table", "n2")]),
      n2: at("lord", b, [go("ask_lord", "n3")]),
      n3: at(
        "sec",
        b,
        [
          decide("take_paper", "n4", [remember("k_han_convoy")], []),
          decide("leave_paper", "n4", []),
        ],
        "take_paper",
      ),
      n4: alone(
        b,
        [
          decide("ask_figures", "n5", [remember("k_jel_figures")], []),
          decide(
            "trust_figures",
            "n5",
            [trustOf(role("lord"), 1)],
            ["trust:+1"],
          ),
        ],
        "ask_figures",
      ),
      n5: at(
        "navy",
        b,
        [
          decide(
            "ration_soon",
            null,
            [gauge("bread", 1), opinion("business", -1)],
            ["bread:+1"],
          ),
          decide("no_ration", null, [gauge("morale", 1)], ["morale:+1"]),
        ],
        "ration_soon",
      ),
    },
    "gbr_big_wheat_quiet",
    { stage: ["war"], tags: ["war", "tension_up"] },
  ),
  big(
    "gbr_big_march",
    all(
      atDeu,
      // Russia is out, the east's divisions came west, and they broke us.
      world({ is: "out", tag: "RUS" }),
      world({
        is: "battle",
        theatre: "west",
        of: ["break", "advance"],
        by: "foe",
      }),
      world({ is: "war_months", own: true, min: 12 }),
    ),
    {
      cos: holder("chief_of_staff"),
      war: { any_of: [{ office: "war" }, { office: "foreign" }] },
      king: { person: "gbr_george_v" },
    },
    "cos",
    {
      n1: alone(b, [decide("open_wire", "n2")]),
      n2: at(
        "cos",
        b,
        [
          decide(
            "send_all",
            "n3",
            [
              doWorld({ do: "force", tag: "GBR", theatre: "west", delta: 1 }),
              gauge("order", -1),
            ],
            ["order:-1"],
          ),
          decide("hold_some", "n3", [remember("m_gbr_march_held")], []),
        ],
        "send_all",
      ),
      n3: at("war", b, [go("hear_war", "n4")]),
      n4: alone(
        b,
        [
          decide(
            "one_commander",
            "n5",
            [remember("k_milner_foch"), trust("FRA", 1)],
            ["fra:+1"],
          ),
          decide(
            "own_commander",
            "n5",
            [trust("FRA", -1), gauge("morale", 1)],
            ["fra:-1", "morale:+1"],
          ),
        ],
        "one_commander",
      ),
      n5: at("king", b, [decide("go_on", null)]),
    },
    "gbr_big_march_quiet",
    { stage: ["war"], tags: ["war", "tension_up"] },
  ),
];

const QUIET_CARDS: GwScene[] = [
  silent("gbr_big_first_quiet", [
    v("ships", chose("gbr_big_first", "ships")),
    v("carson", chose("gbr_big_first", "word_carson")),
    v("redmond", chose("gbr_big_first", "word_redmond")),
    v("base"),
  ]),
  silent("gbr_big_nicky_quiet", [
    v("willy", chose("gbr_big_nicky", "willy_too")),
    v("base"),
  ]),
  silent("gbr_big_sunday_quiet", [v("calm", not(crisis)), v("base")]),
  silent("gbr_big_aside_quiet", [
    v("london", chose("gbr_big_aside", "offer_london")),
    v("base"),
  ]),
  silent("gbr_big_may_quiet", [
    v("terms", chose("gbr_big_may", "terms_first")),
    v("base"),
  ]),
  silent("gbr_big_dublin_quiet", [
    v("spoke", chose("gbr_big_dublin", "speak_prisoners")),
    v("base"),
  ]),
  silent("gbr_big_december_quiet", [
    v("raymond", seen("gbr_h_raymond")),
    v("base"),
  ]),
  silent("gbr_big_wheat_quiet", [
    v("paper", chose("gbr_big_wheat", "take_paper")),
    v("base"),
  ]),
  silent("gbr_big_march_quiet", [
    v("one", chose("gbr_big_march", "one_commander")),
    v("base"),
  ]),
];

// ---- The man at the elbow: nothing here may name him as that ----

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
  variants: [v("base")],
});
const notHeld = not({ kind: "rival_act", of: ["embrace"] });
const closed = (end: "reconciled" | "broken" | "prevailed"): GwEffect => ({
  kind: "rival_end",
  end,
});

const RIVAL_SCENES: GwScene[] = [
  sign("gbr_r_sign_dinner", all(rivalStage(1, 2), notHeld, chapters(1))),
  sign(
    "gbr_r_sign_paper",
    all(rivalStage(1, 2), notHeld, chapters(2), seen("gbr_r_sign_dinner")),
  ),
  sign(
    "gbr_r_sign_joke",
    all(rivalStage(1, 3), notHeld, chapters(4), seen("gbr_r_sign_paper")),
  ),
  {
    id: "gbr_r_gather",
    nation: NATION,
    kind: "audience",
    when: all(rivalStage(2, 3), seen("gbr_r_sign_paper")),
    once: true,
    cast: { rival_man, whip: holder("foreign") },
    author: "whip",
    salience: 7,
    tags: ["people"],
    variants: [v("base")],
    fallback: "take_in",
    options: [
      o(
        "take_in",
        ["authority:-1"],
        [rivalAct("embrace"), trustOf(him, 2), authority(-1)],
      ),
      o(
        "keep_out",
        ["cabinet:+1"],
        [rivalAct("push"), trustOf(him, -1), cabinet(1)],
      ),
      o(
        "move_first",
        ["cabinet:-1", "opposition:+1"],
        [
          rivalAct("strike"),
          trustOf(him, -2),
          cabinet(-1),
          opposition(1),
          reason("r_struck"),
        ],
      ),
    ],
  },
  {
    id: "gbr_r_talk",
    nation: NATION,
    kind: "talk",
    when: all(rivalStage(2, 2), seen("gbr_r_gather"), {
      kind: "rival_act",
      of: ["push"],
    }),
    once: true,
    cast: { rival_man },
    who: "rival_man",
    start: "open",
    salience: 6,
    tags: ["people"],
    variants: [v("base")],
    nodes: {
      open: {
        says: b,
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
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
            tell: ["trust:-1"],
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
    id: "gbr_r_embraced",
    nation: NATION,
    kind: "wire",
    when: all({ kind: "rival_act", of: ["embrace"] }, rivalStage(1, 2)),
    once: true,
    cast: { rival_man },
    salience: 4,
    tags: ["people", "tension_down"],
    variants: [v("base")],
  },
  {
    id: "gbr_r_clash",
    nation: NATION,
    kind: "crisis",
    when: all(rivalStage(3), seen("gbr_r_gather")),
    once: true,
    cast: { rival_man },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [v("struck", { kind: "rival_act", of: ["strike"] }), v("base")],
    fallback: "make_peace",
    options: [
      o(
        "make_peace",
        ["authority:-1", "cabinet:+1"],
        [
          rivalAct("embrace"),
          closed("reconciled"),
          trustOf(him, 2),
          authority(-1),
          cabinet(1),
        ],
      ),
      o(
        "hold_apart",
        ["cabinet:-1"],
        [rivalAct("push"), trustOf(him, -1), cabinet(-1)],
      ),
      o(
        "break_him",
        ["cabinet:-2", "opposition:+1"],
        [
          rivalAct("strike"),
          closed("broken"),
          trustOf(him, -3),
          cabinet(-2),
          opposition(1),
          authority(1),
        ],
      ),
    ],
  },
  {
    id: "gbr_r_last",
    nation: NATION,
    kind: "crisis",
    when: all(rivalStage(3), seen("gbr_r_clash"), {
      kind: "rival_act",
      of: ["push"],
    }),
    once: true,
    cast: { rival_man },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [v("base")],
    fallback: "give_way",
    options: [
      o(
        "give_way",
        ["authority:-2"],
        [closed("prevailed"), authority(-2), trustOf(him, 1)],
      ),
      o(
        "last_stand",
        ["cabinet:-2"],
        [closed("broken"), cabinet(-2), trustOf(him, -2)],
      ),
    ],
  },
];

// ---- The King's cousins ----

const cousin = role("other_ruler");
const toCousin = (tone: GwStance): GwEffect => ({
  kind: "letter",
  who: cousin,
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
  v("hard", character(cousin, "hardline")),
  v("wary", character(cousin, "cautious")),
  v("sly", character(cousin, "opportunist")),
  v("base"),
];
const atWarHim: GwCond = { kind: "at_war_with", who: cousin };
const wrote = (min: number): GwCond => ({ kind: "letters", who: cousin, min });

const COUSIN_LETTERS: GwScene[] = [
  thread(
    "gbr_l_willy_1",
    "DEU",
    moods(),
    [
      o(
        "reply_warm",
        ["deu:+1"],
        [toCousin("warm"), trust("DEU", 1), schedule("gbr_l_willy_2", 2)],
      ),
      o("reply_cold", [], [toCousin("cold"), schedule("gbr_l_willy_2", 2)]),
    ],
    { when: all(chapters(1, 2), not(atDeu)) },
  ),
  thread(
    "gbr_l_willy_2",
    "DEU",
    moods(v("calm", not(crisis))),
    [
      o(
        "reply_frank",
        ["temp:-1", "cabinet:-1"],
        [toCousin("frank"), temp(-1), cabinet(-1)],
      ),
      o("reply_cold", ["deu:-1"], [toCousin("cold"), trust("DEU", -1)]),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  thread(
    "gbr_l_willy_3",
    "DEU",
    moods(),
    [
      o("reply_none", [], [toCousin("cold")]),
      o(
        "reply_prisoners",
        ["morale:-1", "deu:+1"],
        [toCousin("frank"), gauge("morale", -1), trust("DEU", 1)],
      ),
    ],
    { when: all(atWarHim, wrote(1), world({ is: "war_age", min: 6 })) },
  ),
  thread(
    "gbr_l_willy_4",
    "DEU",
    moods(v("war_done", world({ is: "armistice" }))),
    [
      o("reply_short", [], [toCousin("cold")]),
      o(
        "reply_warm",
        ["deu:+1", "opposition:+1"],
        [toCousin("warm"), trust("DEU", 1), opposition(1)],
      ),
    ],
    {
      when: all(
        wrote(1),
        any(
          world({ is: "armistice" }),
          all(
            not(atWarHim),
            not(crisis),
            world({ is: "peace_months", min: 5 }),
          ),
        ),
      ),
    },
  ),
  thread(
    "gbr_l_nicky_1",
    "RUS",
    moods(),
    [
      o(
        "reply_warm",
        ["rus:+1"],
        [toCousin("warm"), trust("RUS", 1), schedule("gbr_l_nicky_2", 2)],
      ),
      o("reply_cold", [], [toCousin("cold"), schedule("gbr_l_nicky_2", 2)]),
    ],
    { when: all(chapters(0, 2), seen("gbr_c_roster")) },
  ),
  thread(
    "gbr_l_nicky_2",
    "RUS",
    moods(v("calm", not(crisis))),
    [
      o(
        "reply_frank",
        ["temp:-1", "rus:-1"],
        [toCousin("frank"), temp(-1), trust("RUS", -1)],
      ),
      o(
        "reply_warm",
        ["rus:+1", "temp:+1"],
        [toCousin("warm"), trust("RUS", 1), temp(1)],
      ),
    ],
    { scheduledOnly: true, salience: 7 },
  ),
  thread(
    "gbr_l_nicky_3",
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
      o(
        "reply_shells",
        ["rus:+1", "shells:-1"],
        [toCousin("warm"), trust("RUS", 1), gauge("shells", -1)],
      ),
      o("reply_words", ["rus:-1"], [toCousin("frank"), trust("RUS", -1)]),
    ],
    {
      when: all(
        wrote(1),
        atDeu,
        world({ is: "entered", tag: "RUS", side: "entente" }),
        world({ is: "war_months", own: true, min: 5, max: 29 }),
      ),
    },
  ),
  thread(
    "gbr_l_nicky_4",
    "RUS",
    moods(v("no_war", not(war))),
    [
      o("reply_warm", ["rus:+1"], [toCousin("warm"), trust("RUS", 1)]),
      o(
        "reply_counsel",
        ["rus:-1", "order:+1"],
        [toCousin("frank"), trust("RUS", -1), gauge("order", 1)],
      ),
    ],
    {
      when: all(
        wrote(2),
        any(
          world({ is: "war_months", min: 26 }),
          world({ is: "peace_months", min: 26 }),
          world({ is: "armistice" }),
        ),
      ),
    },
  ),
];

export const GBR_ACT_SCENES: readonly GwScene[] = [
  ...VISITS,
  ...LETTERS,
  ...ORDERS,
  ...SPEECHES,
  ...INTRIGUES,
  ...AIM_SCENES,
  ...BIG_SCENES,
  ...QUIET_CARDS,
  ...RIVAL_SCENES,
  ...COUSIN_LETTERS,
];
