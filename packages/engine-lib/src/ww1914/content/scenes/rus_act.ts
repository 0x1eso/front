// Russia, ww151: the scenes behind what the Tsar starts himself, and the shape
// of the run. RUS_ACT_SCENES are what the schedule plays (entries and aims are in
// content/acts/rus.ts). RUS_STORY_SCENES are the scenes that press on the aim, the
// big scenes with their silent cards, the rival's track, the threads with Willy
// and Georgie, and the first game's opening. Text: resources/ww1914/ko/RUS.act.json.
// The seat stays Nicholas: a scene of his ends with his reign.
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
  GwVariant,
  memory,
  moody,
  not,
  remember,
  rivalAct,
  rivalStage,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

type Ear = "court" | "stavka" | "duma" | "ministers";
type Gauge = "shells" | "bread" | "money" | "morale" | "order";

const ear = (inst: Ear, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const gauge = (g: Gauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const low = (g: Gauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const high = (g: Gauge, min: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  min,
});
const earAt = (inst: Ear, r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst,
  ...r,
});
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const trust = (tag: "DEU" | "GBR" | "FRA" | "SRB" | "AUH" | "BGR", d: number) =>
  ({ kind: "trust", tag, delta: d }) as GwEffect;
const reasonOf = (key: string): GwEffect => ({ kind: "reason", key });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const rumour = (delta: number): GwEffect => ({ kind: "rumour", delta });
const fame = (delta: number, key: string): GwEffect => ({
  kind: "ruler",
  side: "reputation",
  delta,
  key,
});
const home = (delta: number, key: string): GwEffect => ({
  kind: "ruler",
  side: "family",
  delta,
  key,
});
const soul = (delta: number, key: string): GwEffect => ({
  kind: "ruler",
  side: "conscience",
  delta,
  key,
});

const war = world({ is: "war" });
const reign = world({ is: "regime", of: ["tsar", "crown"] });
const inWar = all(war, reign);
const atPeace = all(not(war), reign);
const headed = world({ is: "command" });
const unrest = (min: number) => world({ is: "unrest", min });
const picked = (field: string, ...of: string[]): GwCond => ({
  kind: "picked",
  field,
  of,
});
const fits = (who: string, field?: string): GwCond =>
  field === undefined
    ? { kind: "tone_fits", who: role(who) }
    : { kind: "tone_fits", who: role(who), field };
const aim = (...of: string[]): GwCond => ({ kind: "aim", of });

const moodyEither = (t: "cunning"): GwCond =>
  any(moody(role("a"), t), moody(role("b"), t));

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

type Cast = GwScene["cast"];
type Tag = GwScene["tags"][number];
type More = Partial<GwScene>;

/** A read-only card the schedule plays. */
const report = (
  id: string,
  cast: Cast,
  tags: Tag[],
  variants: GwVariant[],
  more: More = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "report",
  cast,
  salience: 6,
  tags,
  variants,
  scheduledOnly: true,
  ...more,
});

/** A decision the schedule plays; the seat asked for it, so it can't go back. */
const paper = (
  id: string,
  cast: Cast,
  tags: Tag[],
  variants: GwVariant[],
  options: GwOption[],
  more: More = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  cast,
  salience: 6,
  tags,
  variants,
  options,
  fallback: options[0].id,
  noBack: true,
  scheduledOnly: true,
  ...more,
});

// ---- 시찰: what he sees; the entries are in content/acts/rus.ts ----

const VISIT_SCENES: GwScene[] = [
  paper(
    "rus_a_v_putilov_s",
    {},
    ["home", "war"],
    [v("strike", low("order", 2)), v("short", low("shells", 1)), v("base")],
    [
      o("listen", [], []),
      o(
        "wages",
        ["order:+1", "money:-1"],
        [gauge("order", 1), gauge("money", -1)],
      ),
      o(
        "soldiers",
        ["shells:+1", "order:-1", "duma:-1"],
        [gauge("shells", 1), gauge("order", -1), ear("duma", -1)],
      ),
    ],
  ),
  report(
    "rus_a_v_tula_s",
    {},
    ["war"],
    [v("thin", low("shells", 1)), v("base")],
    { stamp: "confirmed" },
  ),
  paper(
    "rus_a_v_northwest_s",
    { cos: { office: "chief_of_staff" } },
    ["war"],
    [
      v(
        "thin",
        all(
          { kind: "strength", tag: "RUS", theatre: "east", max: 2 },
          low("shells", 1),
        ),
      ),
      v("spent", low("shells", 1)),
      v("base"),
    ],
    [
      o(
        "thank",
        ["stavka:+1"],
        [ear("stavka", 1), fame(1, "rus_a_front_seen")],
      ),
      o(
        "ask_truth",
        ["cos:-1", "ministers:+1"],
        [
          trustOf(role("cos"), -1),
          ear("ministers", 1),
          remember("k_a_saw_front"),
        ],
      ),
    ],
  ),
  report(
    "rus_a_v_galicia_s",
    {},
    ["war", "foreign"],
    [v("sour", low("morale", 2)), v("base")],
  ),
  report(
    "rus_a_v_caucasus_s",
    {},
    ["war"],
    [
      v(
        "ahead",
        world({ is: "front", theatre: "caucasus", from: "erzurum", to: "van" }),
      ),
      v("base"),
    ],
  ),
  paper(
    "rus_a_v_sevastopol_s",
    { navy: { office: "navy" } },
    ["war", "foreign"],
    [v("war", war), v("base")],
    [
      o("hear", [], []),
      o(
        "landing",
        ["money:-1", "navy:+1"],
        [
          gauge("money", -1),
          trustOf(role("navy"), 1),
          remember("k_saz_straits"),
        ],
      ),
    ],
  ),
  report(
    "rus_a_v_kronstadt_s",
    {},
    ["home"],
    [v("sullen", low("morale", 2)), v("war", war), v("base")],
  ),
  paper(
    "rus_a_v_hospital_s",
    {},
    ["home", "private"],
    [v("full", world({ is: "casualties", min: 800 })), v("base")],
    [
      o("sit", ["family:+1"], [home(1, "rus_a_ward_sat")]),
      o(
        "beds",
        ["money:-1", "morale:+1"],
        [gauge("money", -1), gauge("morale", 1)],
      ),
    ],
  ),
  paper(
    "rus_a_v_depots_s",
    {},
    ["home", "war"],
    [v("rotten", { kind: "secret", id: "rus_garrison_rotten" }), v("base")],
    [
      o("note", [], []),
      o(
        "split",
        ["stavka:-1", "order:+1"],
        [ear("stavka", -1), gauge("order", 1)],
      ),
    ],
  ),
  paper(
    "rus_a_v_moscow_s",
    {},
    ["home"],
    [v("angry", all(war, low("morale", 2))), v("war", war), v("base")],
    [
      o(
        "bells",
        ["morale:+1", "court:+1"],
        [gauge("morale", 1), ear("court", 1)],
      ),
      o(
        "merchants",
        ["duma:+1", "court:-1"],
        [ear("duma", 1), ear("court", -1), opinion("business", 1)],
      ),
    ],
  ),
  paper(
    "rus_a_v_volga_s",
    { ag: { office: "agriculture" } },
    ["home"],
    [
      v("hoard", all(war, low("bread", 1))),
      v("full", high("bread", 2)),
      v("base"),
    ],
    [
      o("thank_elders", ["morale:+1"], [gauge("morale", 1)]),
      o(
        "buy_here",
        ["bread:+1", "money:-1", "trust:+1"],
        [gauge("bread", 1), gauge("money", -1), trustOf(role("ag"), 1)],
      ),
    ],
  ),
  paper(
    "rus_a_v_archangel_s",
    { war: { office: "war" } },
    ["war", "foreign"],
    [v("rotting", low("shells", 1)), v("base")],
    [
      o("write_down", [], [remember("k_a_saw_crates")]),
      o(
        "clear_port",
        ["shells:+1", "bread:-1", "war:-1"],
        [gauge("shells", 1), gauge("bread", -1), trustOf(role("war"), -1)],
      ),
    ],
  ),
  report(
    "rus_a_v_lavra_s",
    {},
    ["home", "private"],
    [v("war", war), v("base")],
  ),
  paper(
    "rus_a_v_don_s",
    {},
    ["war", "home"],
    [v("thin", world({ is: "manpower", max: 40 })), v("war", war), v("base")],
    [
      o(
        "charter",
        ["morale:+1", "stavka:+1"],
        [gauge("morale", 1), ear("stavka", 1)],
      ),
      o("ask_plain", ["ministers:+1"], [ear("ministers", 1)]),
    ],
  ),
];

// ---- 친서: the answer that comes back ----

const willy = role("kaiser");
const georgie = role("king");

const LETTER_SCENES: GwScene[] = [
  paper(
    "rus_a_l_willy_r",
    { kaiser: { ruler_of: "DEU" } },
    ["foreign"],
    [
      v("mob_fits", all(picked("subject", "mobilise"), fits("kaiser"))),
      v("mob", picked("subject", "mobilise")),
      v(
        "hague_hard",
        all(picked("subject", "hague"), character(willy, "hardline")),
      ),
      v("hague", picked("subject", "hague")),
      v("fits", fits("kaiser")),
      v("hard", character(willy, "hardline")),
      v("base"),
    ],
    [o("file", [], []), o("show_fm", ["ministers:+1"], [ear("ministers", 1)])],
    {
      kind: "letter",
      who: "kaiser",
      tags: ["foreign"],
    },
  ),
  paper(
    "rus_a_l_georgie_r",
    { king: { ruler_of: "GBR" } },
    ["foreign"],
    [
      v("persia_fits", all(picked("subject", "persia"), fits("king"))),
      v("persia", picked("subject", "persia")),
      v("guns", picked("subject", "guns")),
      v("fits", fits("king")),
      v("base"),
    ],
    [
      o("file", [], []),
      o(
        "show_court",
        ["gbr:+1", "court:-1"],
        [trust("GBR", 1), ear("court", -1)],
      ),
    ],
    { kind: "letter", who: "king" },
  ),
  paper(
    "rus_a_l_poincare_r",
    { pres: { ruler_of: "FRA" } },
    ["foreign", "war"],
    [
      v("hurry", all(war, picked("subject", "offensive"))),
      v("loan", picked("subject", "loan")),
      v("base"),
    ],
    [
      o("thank", ["fra:+1"], [trust("FRA", 1)]),
      o(
        "press_terms",
        ["fra:-1", "money:+1"],
        [trust("FRA", -1), gauge("money", 1)],
      ),
    ],
    { kind: "letter", who: "pres" },
  ),
  paper(
    "rus_a_l_ferdinand_r",
    { tsar_bg: { ruler_of: "BGR" } },
    ["foreign"],
    [
      v("sly", character(role("tsar_bg"), "opportunist", "cautious")),
      v("base"),
    ],
    [
      o("file", [], []),
      o("offer", ["bgr:+1", "srb:-1"], [trust("BGR", 1), trust("SRB", -1)]),
    ],
    { kind: "letter", who: "tsar_bg" },
  ),
  report(
    "rus_a_l_subject_r",
    { to: { picked: "to" } },
    ["people"],
    [
      v(
        "grudge",
        all(
          { kind: "person_trust", who: role("to"), max: -1 },
          not(fits("to")),
        ),
      ),
      v("moved", all(picked("subject", "thanks"), fits("to"))),
      v("ask_fits", all(picked("subject", "truth"), fits("to"))),
      v("ask_flat", picked("subject", "truth")),
      v("base"),
    ],
  ),
  report(
    "rus_a_l_mother_r",
    {},
    ["home", "private"],
    [
      v("hungry", all(picked("whom", "widow"), low("bread", 1))),
      v("widow", picked("whom", "widow")),
      v("elder", picked("whom", "elder")),
      v("base"),
    ],
  ),
];

// ---- 칙령과 지시 ----

const ORDER_SCENES: GwScene[] = [
  paper(
    "rus_a_o_council_s",
    { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } },
    ["home", "people"],
    [
      v(
        "bread_fight",
        all(picked("agenda", "bread"), {
          kind: "rival_in_office",
          who: role("a"),
        }),
      ),
      v("bread", picked("agenda", "bread")),
      v("shells_low", all(picked("agenda", "shells"), low("shells", 1))),
      v("shells", picked("agenda", "shells")),
      v("duma", picked("agenda", "duma")),
      v("base"),
    ],
    [
      o(
        "side_a",
        ["trust:+1", "trust:-1"],
        [trustOf(role("a"), 1), trustOf(role("b"), -1)],
      ),
      o(
        "side_b",
        ["trust:+1", "trust:-1"],
        [trustOf(role("b"), 1), trustOf(role("a"), -1)],
      ),
      o("both_write", ["ministers:+1"], [ear("ministers", 1)]),
    ],
  ),
  report(
    "rus_a_o_figures_s",
    { war: { office: "war" } },
    ["war", "home"],
    [
      v(
        "lied",
        all(
          picked("subject", "shells"),
          world({ is: "report_wrong", source: "staff" }),
        ),
      ),
      v(
        "notebook",
        all(
          picked("subject", "shells"),
          any(memory("k_a_saw_crates"), memory("k_a_saw_front")),
        ),
      ),
      v("shells_low", all(picked("subject", "shells"), low("shells", 1))),
      v("shells", picked("subject", "shells")),
      v("bread_low", all(picked("subject", "bread"), low("bread", 1))),
      v("bread", picked("subject", "bread")),
      v("rails_low", all(picked("subject", "rails"), low("bread", 1))),
      v("base"),
    ],
    { stamp: "confirmed", source: "own_eyes" },
  ),
  report(
    "rus_a_o_envoy_s",
    { man: { picked: "envoy" } },
    ["foreign"],
    [
      v(
        "good_paris",
        all(picked("where", "paris"), {
          kind: "competence",
          who: role("man"),
          field: "politics",
          min: 2,
        }),
      ),
      v("paris", picked("where", "paris")),
      v(
        "good_london",
        all(picked("where", "london"), {
          kind: "competence",
          who: role("man"),
          field: "politics",
          min: 2,
        }),
      ),
      v("london", picked("where", "london")),
      v(
        "good_bucharest",
        all(picked("where", "bucharest"), {
          kind: "competence",
          who: role("man"),
          field: "politics",
          min: 2,
        }),
      ),
      v("base"),
    ],
  ),
  report(
    "rus_a_o_aide_s",
    {},
    ["war"],
    [
      v("nw_bad", all(picked("front", "northwest"), low("shells", 1))),
      v("nw", picked("front", "northwest")),
      v("sw_bad", all(picked("front", "southwest"), low("morale", 2))),
      v("sw", picked("front", "southwest")),
      v("base"),
    ],
    { stamp: "confirmed", source: "own_eyes" },
  ),
  paper(
    "rus_a_o_family_s",
    { empress: { person: "rus_alexandra" } },
    ["home", "private"],
    [
      v(
        "mother_friend",
        all(picked("guest", "mother"), picked("agenda", "friend")),
      ),
      v("mother", picked("guest", "mother")),
      v("misha", picked("guest", "michael")),
      v(
        "uncle_friend",
        all(picked("guest", "nikolasha"), picked("agenda", "friend")),
      ),
      v("uncle", picked("guest", "nikolasha")),
      v("base"),
    ],
    [
      o(
        "hear_out",
        ["court:-1", "family:-1"],
        [ear("court", -1), home(-1, "rus_a_table_cold")],
      ),
      o("change_subject", ["family:+1"], [home(1, "rus_a_table_warm")]),
    ],
  ),
  paper(
    "rus_a_o_generals_s",
    { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } },
    ["war", "people"],
    [
      v("south_thin", all(picked("agenda", "south"), low("shells", 1))),
      v("south", picked("agenda", "south")),
      v("north", picked("agenda", "north")),
      v("base"),
    ],
    [
      o(
        "back_a",
        ["trust:+1", "trust:-1"],
        [trustOf(role("a"), 1), trustOf(role("b"), -1)],
      ),
      o(
        "back_b",
        ["trust:+1", "trust:-1"],
        [trustOf(role("b"), 1), trustOf(role("a"), -1)],
      ),
      o("leave_to_stavka", ["stavka:+1"], [ear("stavka", 1)]),
    ],
  ),
  report(
    "rus_a_o_pension_s",
    {},
    ["home"],
    [
      v("broke", all(picked("who_pays", "treasury"), low("money", 1))),
      v("treasury", picked("who_pays", "treasury")),
      v("church", picked("who_pays", "church")),
      v("base"),
    ],
  ),
  report(
    "rus_a_o_censor_s",
    {},
    ["home"],
    [
      v("ease_hot", all(picked("order", "ease"), { kind: "rumour", min: 3 })),
      v("ease", picked("order", "ease")),
      v(
        "tight_hot",
        all(picked("order", "tighten"), { kind: "rumour", min: 3 }),
      ),
      v("base"),
    ],
  ),
];

// ---- 연설 ----

const SPEECH_SCENES: GwScene[] = [
  report(
    "rus_a_s_duma_s",
    {},
    ["home"],
    [
      v(
        "rostrum_trust",
        all(picked("place", "rostrum"), picked("on", "trust")),
      ),
      v("rostrum", picked("place", "rostrum")),
      v("hall_cold", all(picked("place", "hall"), earAt("duma", { max: -2 }))),
      v("base"),
    ],
  ),
  report(
    "rus_a_s_kremlin_s",
    {},
    ["home"],
    [
      v("bread_low", all(picked("on", "bread"), low("bread", 1))),
      v("bread", picked("on", "bread")),
      v("long_war", all(picked("on", "war"), low("morale", 2))),
      v("base"),
    ],
  ),
  report(
    "rus_a_s_review_s",
    {},
    ["war"],
    [
      v("thin_ranks", all(picked("place", "reserves"), low("morale", 2))),
      v("reserves", picked("place", "reserves")),
      v(
        "guards_thanks",
        all(picked("place", "guards"), picked("on", "thanks")),
      ),
      v("base"),
    ],
  ),
  report(
    "rus_a_s_workers_s",
    {},
    ["home"],
    [
      v("hostile", low("order", 2)),
      v("wages", picked("on", "wages")),
      v("base"),
    ],
  ),
  report(
    "rus_a_s_zemstvo_s",
    {},
    ["home"],
    [
      v("thanks_cold", all(picked("on", "thanks"), earAt("duma", { max: -1 }))),
      v("thanks", picked("on", "thanks")),
      v("base"),
    ],
  ),
  report(
    "rus_a_s_cathedral_s",
    {},
    ["home"],
    [
      v(
        "dead_many",
        all(picked("on", "dead"), world({ is: "casualties", min: 1000 })),
      ),
      v("dead", picked("on", "dead")),
      v("base"),
    ],
  ),
];

// ---- 뒷공작 ----

const INTRIGUE_SCENES: GwScene[] = [
  report(
    "rus_a_i_mail_s",
    { t: { picked: "who" } },
    ["people"],
    [
      v("dirty", { kind: "person_trust", who: role("t"), max: -1 }),
      v("duma", { kind: "leans", who: role("t"), camp: "duma" }),
      v("base"),
    ],
  ),
  paper(
    "rus_a_i_mail_out",
    { t: { picked: "who" } },
    ["people"],
    [v("base")],
    [
      o(
        "deny",
        ["trust:-1", "court:+1"],
        [trustOf(role("t"), -1), ear("court", 1)],
      ),
      o(
        "own_up",
        ["trust:-2", "ministers:-1", "conscience:+1"],
        [
          trustOf(role("t"), -2),
          ear("ministers", -1),
          soul(1, "rus_a_owned_up"),
        ],
      ),
    ],
    { salience: 7 },
  ),
  report(
    "rus_a_i_set_on_s",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    ["people"],
    [v("cold", moodyEither("cunning")), v("base")],
  ),
  paper(
    "rus_a_i_set_on_out",
    { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    ["people"],
    [v("base")],
    [
      o(
        "hold_it",
        ["trust:-2"],
        [trustOf(role("a"), -1), trustOf(role("b"), -1)],
      ),
      o(
        "blame_clerk",
        ["ministers:-1", "conscience:-1"],
        [ear("ministers", -1), soul(-1, "rus_a_blamed_clerk")],
      ),
    ],
    { salience: 7 },
  ),
  report(
    "rus_a_i_rumour_s",
    {},
    ["home"],
    [
      v("offensive", picked("which", "offensive")),
      v("duma", picked("which", "duma")),
      v("base"),
    ],
  ),
  report("rus_a_i_rumour_out", {}, ["home"], [v("base")], { salience: 7 }),
  report(
    "rus_a_i_agent_s",
    {},
    ["home"],
    [
      v(
        "plot",
        all(picked("where", "club"), { kind: "secret", id: "rus_palace_plot" }),
      ),
      v("club", picked("where", "club")),
      v("factory_bad", all(picked("where", "factory"), low("order", 2))),
      v("factory", picked("where", "factory")),
      v("duma", picked("where", "duma")),
      v("base"),
    ],
  ),
  paper(
    "rus_a_i_agent_out",
    {},
    ["home"],
    [v("base")],
    [
      o("disown", ["duma:-1"], [ear("duma", -1), rumour(1)]),
      o("reward", ["court:+1", "duma:-2"], [ear("court", 1), ear("duma", -2)]),
    ],
    { salience: 7 },
  ),
  report(
    "rus_a_i_paper_s",
    {},
    ["home"],
    [v("thin", low("money", 1)), v("base")],
  ),
  report("rus_a_i_paper_out", {}, ["home"], [v("base")], { salience: 7 }),
  report(
    "rus_a_i_feeler_s",
    {},
    ["foreign"],
    [
      v("there", { kind: "secret", id: "rus_german_feeler" }),
      v("winning", world({ is: "score", min: 10 })),
      v("base"),
    ],
  ),
  paper(
    "rus_a_i_feeler_out",
    {},
    ["foreign"],
    [v("base")],
    [
      o("swear", ["fra:-1", "gbr:-1"], [trust("FRA", -1), trust("GBR", -1)]),
      o(
        "own_it",
        ["fra:-2", "duma:-1", "reputation:-1"],
        [trust("FRA", -2), ear("duma", -1), fame(-1, "rus_a_feeler_owned")],
      ),
    ],
    { salience: 8 },
  ),
];

export const RUS_ACT_SCENES: readonly GwScene[] = [
  ...VISIT_SCENES,
  ...LETTER_SCENES,
  ...ORDER_SCENES,
  ...SPEECH_SCENES,
  ...INTRIGUE_SCENES,
];

// ---- What presses on the aim ----

const pressed = (
  id: string,
  when: GwCond,
  cast: Cast,
  tags: Tag[],
  variants: GwVariant[],
  options: GwOption[],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  when,
  cast,
  salience: 7,
  tags,
  once: true,
  variants,
  options,
  fallback: options[0].id,
});

const AIM_SCENES: GwScene[] = [
  pressed(
    "rus_ap_peace_hour",
    all(aim("rus_aim_peace"), { kind: "temp", min: 5 }, not(war)),
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    ["foreign", "tension_up"],
    [v("hot", { kind: "temp", min: 7 }), v("base")],
    [
      o("hold_word", ["stavka:-1", "temp:-1"], [ear("stavka", -1), temp(-1)]),
      o(
        "bend",
        ["stavka:+1", "conscience:-1"],
        [ear("stavka", 1), soul(-1, "rus_ap_word_bent")],
      ),
    ],
  ),
  pressed(
    "rus_ap_serbia_falls",
    all(
      aim("rus_aim_serbia"),
      inWar,
      world({ is: "front", theatre: "balkan", from: "nis", to: "salonika" }),
    ),
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    ["war", "foreign"],
    [v("gone", world({ is: "out", tag: "SRB" })), v("base")],
    [
      o(
        "send_guns",
        ["shells:-1", "srb:+2"],
        [gauge("shells", -1), trust("SRB", 2)],
      ),
      o(
        "words_only",
        ["srb:-1", "stavka:+1"],
        [trust("SRB", -1), ear("stavka", 1)],
      ),
    ],
  ),
  pressed(
    "rus_ap_tsargrad_corps",
    all(
      aim("rus_aim_tsargrad"),
      inWar,
      world({ is: "war_months", own: true, min: 6 }),
    ),
    { fm: { office: "foreign" }, cos: { office: "chief_of_staff" } },
    ["war", "foreign"],
    [v("thin", low("shells", 1)), v("base")],
    [
      o(
        "take_corps",
        ["stavka:-2", "cos:-1"],
        [
          ear("stavka", -2),
          trustOf(role("cos"), -1),
          setFlag("f_bosporus_division"),
        ],
      ),
      o(
        "paper_first",
        ["gbr:-1", "duma:+1"],
        [trust("GBR", -1), ear("duma", 1), remember("k_saz_straits")],
      ),
      o("wait_year", ["ministers:-1"], [ear("ministers", -1)]),
    ],
  ),
  pressed(
    "rus_ap_throne_men",
    all(aim("rus_aim_throne"), reign, world({ is: "war_months", min: 10 })),
    { ch: { office: "chancellor" }, ag: { office: "agriculture" } },
    ["home", "people"],
    [v("war", war), v("base")],
    [
      o(
        "not_a_word",
        ["court:+1", "duma:-2"],
        [ear("court", 1), ear("duma", -2)],
      ),
      o(
        "small_step",
        ["ministers:+1", "court:-1"],
        [ear("ministers", 1), ear("court", -1)],
      ),
    ],
  ),
  pressed(
    "rus_ap_trust_her",
    all(aim("rus_aim_trust"), reign, world({ is: "war_months", min: 5 })),
    { empress: { person: "rus_alexandra" } },
    ["home", "people"],
    [v("hard", earAt("court", { max: -1 })), v("base")],
    [
      o(
        "go_on",
        ["duma:+1", "family:-1"],
        [ear("duma", 1), home(-1, "rus_ap_her_alone")],
      ),
      o(
        "slow_down",
        ["court:+1", "duma:-1"],
        [ear("court", 1), ear("duma", -1)],
      ),
    ],
  ),
  pressed(
    "rus_ap_bread_wagons",
    all(aim("rus_aim_bread"), inWar, low("bread", 2)),
    { cos: { office: "chief_of_staff" }, ag: { office: "agriculture" } },
    ["home", "war"],
    [v("hungry", low("bread", 1)), v("base")],
    [
      o(
        "bread_trains",
        ["bread:+1", "stavka:-2"],
        [gauge("bread", 1), ear("stavka", -2)],
      ),
      o(
        "army_trains",
        ["stavka:+1", "order:-1"],
        [ear("stavka", 1), gauge("order", -1)],
      ),
    ],
  ),
  {
    id: "rus_ap_changed",
    nation: ["RUS"],
    kind: "wire",
    when: all({ kind: "aim_changed", min: 1 }, reign),
    cast: { court: { office: "court" } },
    salience: 5,
    tags: ["home"],
    once: true,
    variants: [v("twice", { kind: "aim_changed", min: 2 }), v("base")],
  },
];

// ---- 고비: the moments that decide a run ----

type Node = NonNullable<GwScene["nodes"]>[string];
const says = (...variants: GwVariant[]) => variants;

/** A big scene; `nodes` each say who speaks. */
const big = (
  id: string,
  when: GwCond,
  cast: Cast,
  who: string,
  tags: Tag[],
  nodes: Record<string, Node>,
  after: GwScene["after"],
  more: More = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags,
  when,
  cast,
  who,
  start: "n1",
  variants: [v("base")],
  after,
  nodes,
  ...more,
});

const silent = (id: string, variants: GwVariant[] = [v("base")]): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast: {},
  salience: 0,
  tags: ["tension_down"],
  variants,
});

const ask = (id: string, next: string | null) => ({
  id,
  stance: "frank" as const,
  kind: "ask" as const,
  tell: [],
  effects: [],
  next,
});

const mobilise = [
  doWorld({ do: "mobilize", tag: "RUS", level: 2 }),
  temp(3),
  ear("stavka", 2),
  trust("DEU", -2),
  trust("FRA", 1),
  setFlag("f_rus_general"),
  { kind: "drop_card", scene: "rus_c_general_mob" } as GwEffect,
];

/** The paper of a trusted cabinet comes, unless it has been. */
const trustPaper: GwEffect = {
  kind: "maybe",
  when: not({ kind: "seen", scene: "rus_r_trust" }),
  then: [schedule("rus_r_trust", 1)],
};

const BIG_SCENES: GwScene[] = [
  big(
    "rus_b_peterhof",
    all(
      world({ is: "chain", short: false, min: 3 }),
      { kind: "crisis", topic: "balkan" },
      { kind: "temp", min: 5 },
      flag("w_ultimatum_out"),
      not(flag("f_rus_general")),
    ),
    {
      fm: { office: "foreign" },
      cos: { office: "chief_of_staff" },
      war: { office: "war" },
    },
    "cos",
    ["war", "tension_up"],
    {
      n1: {
        alone: true,
        says: says(
          v("recalled", chose("rus_c_cancel_night", "recall_order")),
          v("base"),
        ),
        replies: [ask("get_up", "n2")],
      },
      n2: {
        who: "cos",
        says: says(v("base")),
        replies: [ask("how_long", "n3")],
      },
      n3: {
        who: "war",
        says: says(v("base")),
        replies: [decide("let_fm", "n5"), decide("no_one", "n4")],
      },
      n4: {
        alone: true,
        says: says(v("base")),
        replies: [decide("let_fm_late", "n5")],
      },
      n5: {
        who: "fm",
        says: says(v("late", chose("rus_b_peterhof", "no_one")), v("base")),
        replies: [ask("the_dead", "n6")],
      },
      n6: {
        who: "fm",
        fallback: "hold",
        says: says(v("base")),
        replies: [
          decide("sign", "n7", mobilise, [
            "temp:+3",
            "stavka:+2",
            "deu:-2",
            "fra:+1",
          ]),
          decide(
            "hold",
            "n8",
            [ear("stavka", -2), { kind: "delay", days: 1 }],
            ["delay:1", "stavka:-2"],
          ),
        ],
      },
      n7: {
        who: "fm",
        says: says(v("base")),
        replies: [ask("go", null)],
      },
      n8: {
        who: "cos",
        says: says(v("base")),
        replies: [ask("stay", null)],
      },
    },
    [
      { scene: "rus_b_peterhof_signed", when: chose("rus_b_peterhof", "sign") },
      { scene: "rus_b_peterhof_held" },
    ],
  ),
  silent("rus_b_peterhof_signed"),
  silent("rus_b_peterhof_held"),

  big(
    "rus_b_narew",
    all(
      inWar,
      world({ is: "war_months", own: true, max: 7 }),
      world({
        is: "battle",
        theatre: "east",
        of: ["break", "advance"],
        by: "foe",
      }),
    ),
    {
      cos: { office: "chief_of_staff" },
      war: { office: "war" },
      amb: { person: "fra_paleologue" },
    },
    "cos",
    ["war"],
    {
      n1: { alone: true, says: says(v("base")), replies: [ask("read", "n2")] },
      n2: {
        who: "cos",
        says: says(v("base")),
        replies: [ask("who_failed", "n3")],
      },
      n3: {
        who: "war",
        says: says(v("base")),
        replies: [ask("how_many", "n4")],
      },
      n4: {
        who: "amb",
        says: says(v("base")),
        replies: [ask("what_paris", "n5")],
      },
      n5: {
        alone: true,
        fallback: "plain",
        says: says(v("base")),
        replies: [
          decide(
            "plain",
            "n6",
            [ear("duma", 1), ear("stavka", -1), gauge("morale", -1)],
            ["duma:+1", "stavka:-1", "morale:-1"],
          ),
          decide(
            "thin",
            "n6",
            [ear("stavka", 1), rumour(2), soul(-1, "rus_b_narew_hid")],
            ["stavka:+1", "conscience:-1"],
          ),
        ],
      },
      n6: {
        who: "amb",
        fallback: "for_paris",
        says: says(v("base")),
        replies: [
          decide(
            "for_paris",
            null,
            [trust("FRA", 2), gauge("shells", -1), ear("stavka", -1)],
            ["fra:+2", "shells:-1", "stavka:-1"],
          ),
          decide(
            "for_ourselves",
            null,
            [trust("FRA", -2), ear("stavka", 1)],
            ["fra:-2", "stavka:+1"],
          ),
        ],
      },
    },
    [
      { scene: "rus_b_narew_after_hid", when: chose("rus_b_narew", "thin") },
      { scene: "rus_b_narew_after" },
    ],
  ),
  silent("rus_b_narew_after"),
  silent("rus_b_narew_after_hid"),

  big(
    "rus_b_lemberg",
    all(
      inWar,
      world({ is: "war_months", own: true, max: 10 }),
      world({ is: "front", theatre: "east", from: "oder", to: "east_prussia" }),
      high("morale", 3),
      world({
        is: "battle",
        theatre: "east",
        of: ["break", "advance"],
        by: "seat",
      }),
    ),
    {
      fm: { office: "foreign" },
      ch: { office: "chancellor" },
      empress: { person: "rus_alexandra" },
    },
    "fm",
    ["war", "tension_down"],
    {
      n1: {
        alone: true,
        says: says(v("base")),
        replies: [ask("the_bells", "n2")],
      },
      n2: {
        who: "fm",
        says: says(v("base")),
        replies: [ask("what_next", "n3")],
      },
      n3: { who: "ch", says: says(v("base")), replies: [ask("and_you", "n4")] },
      n4: {
        who: "empress",
        says: says(v("base")),
        replies: [ask("sit", "n5")],
      },
      n5: {
        alone: true,
        fallback: "te_deum",
        says: says(v("base")),
        replies: [
          decide(
            "te_deum",
            null,
            [
              gauge("morale", 1),
              ear("court", 1),
              fame(1, "rus_b_lemberg_bells"),
            ],
            ["morale:+1", "court:+1", "reputation:+1"],
          ),
          decide(
            "amnesty",
            null,
            [ear("duma", 2), ear("court", -1), gauge("order", 1)],
            ["duma:+2", "court:-1", "order:+1"],
          ),
          decide(
            "to_front",
            null,
            [
              ear("stavka", 1),
              gauge("morale", 1),
              home(-1, "rus_b_lemberg_left"),
            ],
            ["stavka:+1", "morale:+1", "family:-1"],
          ),
        ],
      },
    },
    [
      {
        scene: "rus_b_lemberg_amnesty",
        when: chose("rus_b_lemberg", "amnesty"),
      },
      { scene: "rus_b_lemberg_after" },
    ],
  ),
  silent("rus_b_lemberg_after"),
  silent("rus_b_lemberg_amnesty"),

  big(
    "rus_b_august",
    all(
      inWar,
      world({ is: "war_months", own: true, min: 9, max: 23 }),
      any(
        world({ is: "front", theatre: "east", from: "warsaw", to: "kiev" }),
        world({ is: "flag_now", flag: "w_warsaw_lost" }),
      ),
      not(headed),
      not({ kind: "seen", scene: "rus_w_command" }),
    ),
    {
      ch: { office: "chancellor" },
      fm: { office: "foreign" },
      ag: { office: "agriculture" },
      empress: { person: "rus_alexandra" },
    },
    "ag",
    ["war", "people"],
    {
      n1: { alone: true, says: says(v("base")), replies: [ask("open", "n2")] },
      n2: { who: "ag", says: says(v("base")), replies: [ask("say_it", "n3")] },
      n3: { who: "fm", says: says(v("base")), replies: [ask("why", "n4")] },
      n4: { who: "ch", says: says(v("base")), replies: [ask("you_too", "n5")] },
      n5: {
        who: "empress",
        says: says(v("base")),
        replies: [ask("go_on", "n6")],
      },
      n6: {
        alone: true,
        fallback: "ministers_heard",
        says: says(v("base")),
        replies: [
          decide(
            "ministers_heard",
            null,
            [ear("ministers", 2), ear("court", -1)],
            ["ministers:+2", "court:-1"],
          ),
          decide(
            "her_heard",
            null,
            [ear("court", 2), ear("ministers", -2)],
            ["court:+2", "ministers:-2"],
          ),
          decide(
            "own_mind",
            null,
            [soul(1, "rus_b_august_alone")],
            ["conscience:+1"],
          ),
        ],
      },
    },
    [{ scene: "rus_b_august_after" }],
    { essential: true },
  ),
  silent("rus_b_august_after"),

  big(
    "rus_b_lutsk",
    all(
      reign,
      war,
      any(
        { kind: "seen", scene: "rus_w_lutsk" },
        // Our own push in the east broke the Austrian line, after a year and
        // more of reports of retreat.
        all(
          world({ is: "war_months", own: true, min: 12 }),
          { kind: "at_war", tag: "AUH" },
          world({
            is: "battle",
            theatre: "east",
            of: ["break", "advance"],
            by: "seat",
          }),
        ),
      ),
    ),
    {
      cos: { office: "chief_of_staff" },
      brus: { person: "rus_brusilov" },
      empress: { person: "rus_alexandra" },
    },
    "cos",
    ["war", "tension_down"],
    {
      n1: {
        alone: true,
        says: says(v("command", headed), v("base")),
        replies: [ask("again", "n2")],
      },
      n2: {
        who: "cos",
        says: says(v("base")),
        replies: [ask("how_far", "n3")],
      },
      n3: {
        who: "brus",
        says: says(v("base")),
        replies: [ask("what_you_need", "n4")],
      },
      n4: {
        who: "empress",
        says: says(v("base")),
        replies: [ask("not_tonight", "n5")],
      },
      n5: {
        who: "cos",
        fallback: "reserves_south",
        says: says(v("base")),
        replies: [
          decide(
            "reserves_south",
            "n6",
            [
              ear("stavka", -1),
              gauge("morale", 1),
              doWorld({ do: "force", tag: "RUS", theatre: "east", delta: 1 }),
            ],
            ["morale:+1", "stavka:-1"],
          ),
          decide("keep_plan", "n6", [ear("stavka", 1)], ["stavka:+1"]),
        ],
      },
      n6: {
        alone: true,
        fallback: "honour",
        says: says(v("base")),
        replies: [
          decide(
            "honour",
            null,
            [fame(1, "rus_b_lutsk_named"), opinion("army", 1)],
            ["reputation:+1", "opinion:+1"],
          ),
          decide("the_army", null, [ear("stavka", 1)], ["stavka:+1"]),
        ],
      },
    },
    [{ scene: "rus_b_lutsk_after" }],
  ),
  silent("rus_b_lutsk_after"),

  big(
    "rus_b_winter",
    all(
      world({ is: "regime", of: ["tsar"] }),
      war,
      world({ is: "war_months", own: true, min: 27, max: 33 }),
      any(low("order", 3), earAt("duma", { max: 0 })),
    ),
    {
      amb: { person: "gbr_buchanan" },
      duma: { person: "rus_rodzianko" },
      empress: { person: "rus_alexandra" },
    },
    "amb",
    ["home", "tension_up"],
    {
      n1: {
        alone: true,
        says: says(v("base")),
        replies: [ask("let_him", "n2")],
      },
      n2: {
        who: "amb",
        says: says(v("base")),
        replies: [ask("barrier", "n3")],
      },
      n3: {
        who: "amb",
        says: says(v("base")),
        replies: [
          {
            id: "whose_trust",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "n4",
          },
          {
            id: "go_on",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "n4",
          },
        ],
      },
      n4: {
        who: "duma",
        says: says(v("base")),
        replies: [ask("enough", "n5")],
      },
      n5: {
        who: "empress",
        says: says(v("base")),
        replies: [ask("the_boy", "n6")],
      },
      n6: {
        alone: true,
        fallback: "stand",
        says: says(v("base")),
        replies: [
          decide(
            "stand",
            null,
            [ear("court", 1), ear("duma", -2), trust("GBR", -1)],
            ["court:+1", "duma:-2", "gbr:-1"],
          ),
          decide(
            "call_krivoshein",
            null,
            [
              ear("duma", 2),
              ear("court", -2),
              doWorld({ do: "calm" }),
              trustPaper,
            ],
            ["duma:+2", "court:-2"],
          ),
          decide(
            "to_mogilev",
            null,
            [
              ear("stavka", 1),
              gauge("order", -1),
              home(-1, "rus_b_winter_left"),
            ],
            ["stavka:+1", "order:-1", "family:-1"],
          ),
        ],
      },
    },
    [
      {
        scene: "rus_b_winter_after_trust",
        when: chose("rus_b_winter", "call_krivoshein"),
      },
      { scene: "rus_b_winter_after" },
    ],
  ),
  silent("rus_b_winter_after"),
  silent("rus_b_winter_after_trust"),

  big(
    "rus_b_last_night",
    all(
      world({ is: "regime", of: ["tsar"] }),
      war,
      world({ is: "war_months", own: true, min: 18 }),
      unrest(2),
      not({ kind: "seen", scene: "rus_r_train" }),
    ),
    {
      cos: { office: "chief_of_staff" },
      court: { office: "court" },
      duma: { person: "rus_rodzianko" },
    },
    "cos",
    ["home", "tension_up"],
    {
      n1: {
        alone: true,
        says: says(v("base")),
        replies: [ask("read_it", "n2")],
      },
      n2: {
        who: "duma",
        says: says(v("base")),
        replies: [ask("put_it_by", "n3")],
      },
      n3: {
        who: "cos",
        says: says(v("base")),
        replies: [ask("what_regiments", "n4")],
      },
      n4: {
        who: "court",
        says: says(v("base")),
        replies: [ask("her_wire", "n5")],
      },
      n5: {
        alone: true,
        fallback: "general",
        says: says(v("base")),
        replies: [
          decide(
            "general",
            null,
            [ear("stavka", 1), ear("duma", -2)],
            ["stavka:+1", "duma:-2"],
          ),
          decide(
            "cabinet",
            null,
            [
              ear("duma", 3),
              ear("court", -2),
              doWorld({ do: "calm" }),
              trustPaper,
            ],
            ["duma:+3", "court:-2"],
          ),
          decide(
            "home_to_her",
            null,
            [home(1, "rus_b_home_went"), ear("stavka", -2)],
            ["family:+1", "stavka:-2"],
          ),
        ],
      },
    },
    [{ scene: "rus_b_last_night_after" }],
    { essential: true },
  ),
  silent("rus_b_last_night_after"),

  big(
    "rus_b_quiet_year",
    all(atPeace, world({ is: "peace_months", min: 5, max: 23 }), {
      kind: "temp",
      max: 5,
    }),
    {
      fm: { office: "foreign" },
      war: { office: "war" },
      ag: { office: "agriculture" },
      empress: { person: "rus_alexandra" },
    },
    "ag",
    ["home", "tension_down"],
    {
      n1: { alone: true, says: says(v("base")), replies: [ask("sit", "n2")] },
      n2: {
        who: "war",
        says: says(v("base")),
        replies: [ask("and_then", "n3")],
      },
      n3: {
        who: "fm",
        says: says(v("base")),
        replies: [ask("the_straits", "n4")],
      },
      n4: {
        who: "ag",
        says: says(v("base")),
        replies: [ask("the_land", "n5")],
      },
      n5: {
        who: "empress",
        says: says(v("base")),
        replies: [ask("what_for", "n6")],
      },
      n6: {
        alone: true,
        fallback: "guns",
        says: says(v("base")),
        replies: [
          decide(
            "guns",
            null,
            [ear("stavka", 2), gauge("money", -1), temp(1)],
            ["stavka:+2", "money:-1", "temp:+1"],
          ),
          decide(
            "land",
            null,
            [ear("ministers", 2), gauge("order", 1), gauge("money", -1)],
            ["ministers:+2", "order:+1", "money:-1"],
          ),
          decide(
            "duma",
            null,
            [ear("duma", 2), ear("court", -2)],
            ["duma:+2", "court:-2"],
          ),
        ],
      },
    },
    [{ scene: "rus_b_quiet_year_after" }],
  ),
  silent("rus_b_quiet_year_after"),
];

// ---- The rival: one person, by the seed; all he says is in the pack by person ----

const rivalCast: Cast = { rival_man: { rival_man: true } };
const him = role("rival_man");

/**
 * The opening weeks by chapter; past them, months of war or of peace (the
 * censor's summaries come monthly).
 */
const after = (chapter: number): GwCond =>
  chapter <= 5
    ? { kind: "chapter", min: chapter }
    : any(
        world({ is: "war_months", own: true, min: chapter - 6 }),
        world({ is: "peace_months", min: chapter - 6 }),
      );
const sign = (id: string, min: number): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "report",
  when: all(rivalStage(1, 1), reign, after(min)),
  cast: rivalCast,
  salience: 4,
  tags: ["people"],
  once: true,
  variants: [v("base")],
});

const afterAct = (id: string, a: "embrace" | "push" | "strike"): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "report",
  when: all({ kind: "rival_act", of: [a] }, rivalStage(1), reign),
  cast: rivalCast,
  salience: 5,
  tags: ["people"],
  once: true,
  variants: [v("base")],
});

const RIVAL_SCENES: GwScene[] = [
  sign("rus_rv_sign_a", 2),
  sign("rus_rv_sign_b", 5),
  sign("rus_rv_sign_c", 8),
  {
    id: "rus_rv_gather_sign",
    nation: ["RUS"],
    kind: "report",
    when: all(rivalStage(2, 2), reign),
    cast: rivalCast,
    salience: 6,
    tags: ["people"],
    once: true,
    variants: [v("base")],
  },
  {
    id: "rus_rv_gather",
    nation: ["RUS"],
    kind: "audience",
    when: all(rivalStage(2, 2), reign, {
      kind: "seen",
      scene: "rus_rv_gather_sign",
    }),
    cast: rivalCast,
    salience: 7,
    tags: ["people"],
    once: true,
    noBack: true,
    variants: [v("base")],
    fallback: "take_in",
    options: [
      o(
        "take_in",
        ["court:-1"],
        [
          rivalAct("embrace"),
          trustOf(him, 2),
          ear("court", -1),
          reasonOf("rus_rv_taken_in"),
        ],
      ),
      o(
        "cool",
        ["ministers:+1"],
        [
          rivalAct("push"),
          trustOf(him, -1),
          ear("ministers", 1),
          reasonOf("rus_rv_cooled"),
        ],
      ),
      o(
        "strike",
        ["reputation:-1"],
        [
          rivalAct("strike"),
          trustOf(him, -2),
          fame(-1, "rus_rv_struck"),
          reasonOf("rus_rv_struck"),
        ],
      ),
    ],
  },
  afterAct("rus_rv_after_embrace", "embrace"),
  afterAct("rus_rv_after_push", "push"),
  afterAct("rus_rv_after_strike", "strike"),
  {
    id: "rus_rv_clash",
    nation: ["RUS"],
    kind: "crisis",
    when: all(rivalStage(3, 3), reign),
    cast: rivalCast,
    salience: 9,
    tags: ["people", "tension_up"],
    once: true,
    essential: true,
    variants: [
      v("embraced", { kind: "rival_act", of: ["embrace"] }),
      v("struck", { kind: "rival_act", of: ["strike"] }),
      v("base"),
    ],
    fallback: "give_way",
    options: [
      o(
        "give_way",
        ["authority:-5", "duma:+1"],
        [
          { kind: "rival_end", end: "reconciled" },
          trustOf(him, 2),
          doWorld({ do: "authority", delta: -5 }),
          ear("duma", 1),
        ],
      ),
      o(
        "send_away",
        ["stavka:-1", "duma:-1"],
        [
          { kind: "rival_end", end: "broken" },
          { kind: "dismiss", who: him },
          ear("stavka", -1),
          ear("duma", -1),
        ],
      ),
      o(
        "outlast",
        ["authority:+5", "reputation:-1"],
        [
          { kind: "rival_end", end: "prevailed" },
          doWorld({ do: "authority", delta: 5 }),
          fame(-1, "rus_rv_outlasted"),
        ],
      ),
    ],
  },
];

// ---- 윌리, 조지: the threads ----

const letter = (
  id: string,
  who: string,
  tag: "DEU" | "GBR",
  when: GwCond | undefined,
  variants: GwVariant[],
  options: GwOption[],
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "letter",
  who,
  ...(when === undefined ? { scheduledOnly: true } : { when }),
  once: true,
  salience: 6,
  tags: ["foreign"],
  cast: { [who]: { ruler_of: tag } },
  variants,
  fallback: options[0].id,
  noBack: true,
  options,
});

const wrote = (who: string, tone: "warm" | "cold" | "frank"): GwEffect => ({
  kind: "letter",
  who: role(who),
  tone,
});

const hardKaiser = character(willy, "hardline");
const slyKaiser = character(willy, "opportunist");
const wary = character(willy, "cautious");
const atWarKaiser: GwCond = { kind: "at_war_with", who: willy };
const shot: GwCond = {
  kind: "opening",
  of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
};

const THREAD_SCENES: GwScene[] = [
  letter(
    "rus_lt_willy_1",
    "kaiser",
    "DEU",
    all(reign, { kind: "chapter", min: 1, max: 3 }),
    [
      v("hard", all(shot, hardKaiser)),
      v("sly", slyKaiser),
      v("wary", all(shot, wary)),
      v("base"),
    ],
    [
      o(
        "reply_warm",
        ["deu:+1"],
        [
          wrote("kaiser", "warm"),
          trust("DEU", 1),
          schedule("rus_lt_willy_2", 2),
        ],
      ),
      o(
        "reply_cold",
        ["deu:-1"],
        [
          wrote("kaiser", "cold"),
          trust("DEU", -1),
          schedule("rus_lt_willy_2", 2),
        ],
      ),
    ],
  ),
  letter(
    "rus_lt_willy_2",
    "kaiser",
    "DEU",
    undefined,
    [
      v("war", atWarKaiser),
      v(
        "cold_hard",
        all(hardKaiser, { kind: "letters", who: willy, tone: "cold" }),
      ),
      v("quiet", { kind: "temp", max: 3 }),
      v("hard", hardKaiser),
      v("sly", slyKaiser),
      v("wary", wary),
      v("base"),
    ],
    [
      o("reply_warm", ["temp:-1"], [wrote("kaiser", "warm"), temp(-1)]),
      o(
        "reply_frank",
        ["stavka:+1"],
        [wrote("kaiser", "frank"), ear("stavka", 1)],
      ),
    ],
  ),
  letter(
    "rus_lt_willy_3",
    "kaiser",
    "DEU",
    all(atWarKaiser, reign, world({ is: "war_months", own: true, min: 5 })),
    [v("sly", slyKaiser), v("hard", hardKaiser), v("base")],
    [
      o("burn", ["fra:+1"], [trust("FRA", 1)]),
      o(
        "keep_it",
        ["conscience:-1"],
        [wrote("kaiser", "frank"), soul(-1, "rus_lt_kept_line")],
      ),
    ],
  ),
  letter(
    "rus_lt_willy_4",
    "kaiser",
    "DEU",
    all(reign, world({ is: "armistice" })),
    [
      v("won", world({ is: "peace_side", of: ["won"] })),
      v("lost", world({ is: "peace_side", of: ["lost"] })),
      v("base"),
    ],
    [o("answer", [], [wrote("kaiser", "frank")]), o("no_answer", [], [])],
  ),
  letter(
    "rus_lt_georgie_1",
    "king",
    "GBR",
    all(reign, { kind: "chapter", min: 2, max: 4 }),
    [
      v("ulster", all(shot, { kind: "chapter", min: 3 })),
      v("firm", character(georgie, "hardline", "principled")),
      v("shy", character(georgie, "cautious")),
      v("base"),
    ],
    [
      o(
        "reply_warm",
        ["gbr:+1"],
        [
          wrote("king", "warm"),
          trust("GBR", 1),
          schedule("rus_lt_georgie_2", 2),
        ],
      ),
      o(
        "reply_short",
        [],
        [wrote("king", "cold"), schedule("rus_lt_georgie_2", 2)],
      ),
    ],
  ),
  letter(
    "rus_lt_georgie_2",
    "king",
    "GBR",
    undefined,
    [
      v("war_joined", world({ is: "entered", tag: "GBR", side: "entente" })),
      v("war_alone", war),
      v("quiet", { kind: "temp", max: 3 }),
      v("base"),
    ],
    [
      o("reply_warm", ["gbr:+1"], [wrote("king", "warm"), trust("GBR", 1)]),
      o("reply_frank", ["duma:+1"], [wrote("king", "frank"), ear("duma", 1)]),
    ],
  ),
  letter(
    "rus_lt_georgie_3",
    "king",
    "GBR",
    all(
      inWar,
      world({ is: "war_months", own: true, min: 7 }),
      world({ is: "entered", tag: "GBR" }),
    ),
    [
      v("shells", low("shells", 1)),
      v("straits", { kind: "chose", scene: "rus_h_straits_note" }),
      v("base"),
    ],
    [
      o("reply_warm", ["gbr:+1"], [wrote("king", "warm"), trust("GBR", 1)]),
      o(
        "ask_guns",
        ["shells:+1", "money:-1"],
        [wrote("king", "frank"), gauge("shells", 1), gauge("money", -1)],
      ),
    ],
  ),
  letter(
    "rus_lt_georgie_4",
    "king",
    "GBR",
    all(
      reign,
      any(unrest(2), world({ is: "armistice" })),
      world({ is: "war_months", min: 22 }),
    ),
    [v("peace", world({ is: "armistice" })), v("base")],
    [
      o("reply_warm", ["gbr:+1"], [wrote("king", "warm"), trust("GBR", 1)]),
      o("no_answer", ["gbr:-1"], [trust("GBR", -1)]),
    ],
  ),
];

// ---- A first game: the event itself, three people, a weighty choice ----

const OPENING_SCENES: GwScene[] = [
  big(
    "rus_o_first",
    all(
      { kind: "first_game" },
      { kind: "chapter", min: 0, max: 0 },
      {
        kind: "opening",
        of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
      },
    ),
    {
      fm: { office: "foreign" },
      war: { office: "war" },
      ch: { office: "chancellor" },
    },
    "fm",
    ["foreign", "tension_up"],
    {
      n1: {
        alone: true,
        says: says(
          v("lived", { kind: "opening", of: ["sarajevo_survived"] }),
          v("missed", { kind: "opening", of: ["sarajevo_failed"] }),
          v("base"),
        ),
        replies: [ask("call_fm", "n2")],
      },
      n2: {
        who: "fm",
        says: says(v("base")),
        replies: [ask("what_serbia", "n3")],
      },
      n3: {
        who: "war",
        says: says(v("base")),
        replies: [ask("is_it_true", "n4")],
      },
      n4: {
        who: "ch",
        fallback: "wait",
        says: says(v("base")),
        replies: [
          decide(
            "warn_vienna",
            null,
            [
              temp(1),
              trust("AUH", -1),
              trust("SRB", 1),
              ear("stavka", 1),
              setFlag("f_o_warned"),
              schedule("rus_o_answer", 2),
            ],
            ["temp:+1", "auh:-1", "srb:+1", "stavka:+1"],
          ),
          decide(
            "counsel_belgrade",
            null,
            [
              temp(-1),
              trust("SRB", -1),
              ear("ministers", 1),
              setFlag("f_o_counselled"),
              schedule("rus_o_answer", 2),
            ],
            ["temp:-1", "srb:-1", "ministers:+1"],
          ),
          decide(
            "wait",
            null,
            [ear("court", 1), ear("duma", -1), schedule("rus_o_answer", 2)],
            ["court:+1", "duma:-1"],
          ),
        ],
      },
    },
    [
      {
        scene: "rus_o_first_warned",
        when: chose("rus_o_first", "warn_vienna"),
      },
      {
        scene: "rus_o_first_counselled",
        when: chose("rus_o_first", "counsel_belgrade"),
      },
      { scene: "rus_o_first_waited" },
    ],
  ),
  silent("rus_o_first_warned"),
  silent("rus_o_first_counselled"),
  silent("rus_o_first_waited"),
  {
    id: "rus_o_answer",
    nation: ["RUS"],
    kind: "wire",
    scheduledOnly: true,
    cast: { fm: { office: "foreign" } },
    salience: 8,
    tags: ["foreign"],
    once: true,
    variants: [
      v("warned", flag("f_o_warned")),
      v("counselled", flag("f_o_counselled")),
      v("base"),
    ],
  },
];

// ---- ww173: the secret war, in Russia's voice (Spies.ts) ----
// The service head (office `intelligence`, Batyushin in 1914) brings what the
// codes say, the codebook from the Baltic, the plain radio, the spy hunt, the
// nets in Galicia and the courting of the Balkan neutrals. Each pick does what
// the 뒷공작 rows do (doWorld spy) or something small; none shows how it goes.

const CHIEF: Cast = { chief: { office: "intelligence" } };
const reading = (tag: "DEU" | "AUH"): GwCond =>
  world({ is: "spy", can: "reading", tag });
const spyCan = (
  can: "net" | "sabotage" | "court",
  tag: "DEU" | "AUH" | "ROU" | "BGR",
): GwCond => world({ is: "spy", can, tag });
const spy = (
  act: "net" | "sabotage" | "court" | "blame" | "hide",
  tag?: "DEU" | "AUH" | "ROU" | "BGR",
): GwEffect =>
  doWorld(tag === undefined ? { do: "spy", act } : { do: "spy", act, tag });
const britainIn = world({ is: "entered", tag: "GBR", side: "entente" });

/** A desk paper the service head brings himself. */
const desk = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  options: GwOption[],
  more: More = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "proposal",
  stage: ["war"],
  when,
  cast: CHIEF,
  salience: 6,
  tags: ["war", "foreign"],
  variants,
  options,
  fallback: options[0].id,
  cooldown: 8,
  ...more,
});

const SPY_SCENES: GwScene[] = [
  // We read their codes: use it, or play dumb so they never change them.
  desk(
    "rus_spy_read",
    all(inWar, any(reading("DEU"), reading("AUH"))),
    [v("deu", reading("DEU")), v("auh", reading("AUH")), v("base")],
    [
      o("use", [], [ear("stavka", 1), remember("k_spy_reading")]),
      o(
        "hide",
        [],
        [spy("hide"), ear("stavka", -1), remember("k_spy_reading")],
      ),
    ],
  ),
  // The Baltic codebook (Spies.eventsStep's Magdeburg mark).
  desk(
    "rus_spy_codebook",
    all(inWar, world({ is: "spy", can: "codebook" })),
    [v("allied", britainIn), v("base")],
    [
      o("keep", [], [ear("stavka", 1), remember("k_spy_book_kept")]),
      o(
        "share",
        [],
        [trust("GBR", 1), remember("k_spy_book_shared")],
        britainIn,
      ),
    ],
    { once: true, salience: 7 },
  ),
  // They changed their codes: the window shut.
  desk(
    "rus_spy_code_lost",
    all(
      inWar,
      memory("k_spy_reading"),
      not(reading("DEU")),
      not(reading("AUH")),
    ),
    [v("used", chose("rus_spy_read", "use")), v("base")],
    [
      o("rebuild", [], [gauge("money", -1), trustOf(role("chief"), 1)]),
      o("scold", [], [trustOf(role("chief"), -1), ear("stavka", 1)]),
    ],
    { once: true },
  ),
  // Our own radio talks in the clear; the enemy listens.
  desk(
    "rus_spy_plain",
    all(inWar, world({ is: "war_months", max: 3 })),
    [
      v(
        "beaten",
        world({
          is: "battle",
          theatre: "east",
          of: ["advance", "break"],
          by: "foe",
        }),
      ),
      v("base"),
    ],
    [
      o("cipher", [], [ear("stavka", -1), remember("k_spy_cipher")]),
      o("leave", [], [ear("stavka", 1)]),
    ],
    { once: true, salience: 7 },
  ),
  // One of our operations was found out: the foreign ministry must answer.
  desk(
    "rus_spy_found_out",
    all(
      inWar,
      world({ is: "spy", can: "out" }),
      any(
        { kind: "acted", act: "gw_a_spy_net", within: 2 },
        { kind: "acted", act: "gw_a_spy_sabotage", within: 2 },
        { kind: "acted", act: "gw_a_spy_court", within: 2 },
        { kind: "memory", key: "k_spy_op", within: 2 },
      ),
    ),
    [v("base")],
    [
      o("deny", [], [ear("ministers", -1), remember("k_spy_denied")]),
      o("recall", [], [ear("stavka", -1), ear("ministers", 1)]),
    ],
    {
      cast: { ...CHIEF, fm: { office: "foreign" } },
      cooldown: 12,
    },
  ),
  // After a defeat the service wants a traitor: Myasoedov's way.
  desk(
    "rus_spy_hunt",
    all(inWar, world({ is: "spy", can: "blame" })),
    [
      v("again", chose("rus_spy_hunt", "sign")),
      v("court", unrest(2)),
      v("base"),
    ],
    [
      o("sign", [], [spy("blame"), remember("k_spy_hunt")]),
      o("refuse", [], [trustOf(role("chief"), -1), ear("court", 1)]),
    ],
    { cooldown: 10, tags: ["war", "home"] },
  ),
  // A net among the enemy's own Slavs, or in Germany itself.
  desk(
    "rus_spy_galicia",
    all(inWar, any(spyCan("net", "AUH"), spyCan("net", "DEU"))),
    [v("deu", not(spyCan("net", "AUH"))), v("base")],
    [
      o("wait", [], []),
      o(
        "auh",
        [],
        [gauge("money", -1), spy("net", "AUH"), remember("k_spy_op")],
        spyCan("net", "AUH"),
      ),
      o(
        "deu",
        [],
        [gauge("money", -1), spy("net", "DEU"), remember("k_spy_op")],
        spyCan("net", "DEU"),
      ),
    ],
    { cooldown: 12 },
  ),
  // Where a net works: the railway behind their front.
  desk(
    "rus_spy_rail",
    all(inWar, any(spyCan("sabotage", "AUH"), spyCan("sabotage", "DEU"))),
    [v("base")],
    [
      o("wait", [], []),
      o(
        "auh",
        [],
        [gauge("money", -1), spy("sabotage", "AUH"), remember("k_spy_op")],
        spyCan("sabotage", "AUH"),
      ),
      o(
        "deu",
        [],
        [gauge("money", -1), spy("sabotage", "DEU"), remember("k_spy_op")],
        spyCan("sabotage", "DEU"),
      ),
    ],
    { cooldown: 12 },
  ),
  // The Balkan neutrals: money for the papers in Bucharest or Sofia.
  desk(
    "rus_spy_neutral",
    all(inWar, any(spyCan("court", "ROU"), spyCan("court", "BGR"))),
    [
      v("rou", spyCan("court", "ROU")),
      v("bgr", spyCan("court", "BGR")),
      v("base"),
    ],
    [
      o("wait", [], []),
      o(
        "rou",
        [],
        [gauge("money", -1), spy("court", "ROU"), remember("k_spy_op")],
        spyCan("court", "ROU"),
      ),
      o(
        "bgr",
        [],
        [gauge("money", -1), spy("court", "BGR"), remember("k_spy_op")],
        spyCan("court", "BGR"),
      ),
    ],
    { cooldown: 12, tags: ["foreign"] },
  ),
];

export const RUS_STORY_SCENES: readonly GwScene[] = [
  ...AIM_SCENES,
  ...BIG_SCENES,
  ...RIVAL_SCENES,
  ...THREAD_SCENES,
  ...OPENING_SCENES,
  ...SPY_SCENES,
];
