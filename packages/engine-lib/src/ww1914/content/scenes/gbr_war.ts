import type {
  GwGauge,
  GwInstitution,
  GwStage,
  GwTemperament,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  byName,
  candid,
  chose,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwReact,
  GwReply,
  GwReplyKind,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
  holder,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { period, sinceChapter } from "./period";

/**
 * Britain, the war share: the `gbr_w_` scenes, the summoned talks of Kitchener,
 * Haig, Robertson and Jellicoe, and five visits. Data only; the text is in
 * resources/ww1914/ko/GBR.war.json. Plan: ww135-plan-gbr.md sections 6, 9, 10.
 */

const NATION: GwScene["nation"] = ["GBR"];
const who = role("who");
const cos = role("cos");
const war_ = role("war");
const navy = role("navy");
const lord = role("sea_lord");

const CRISIS_ON: GwStage[] = ["crisis", "y1914", "war"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR: GwStage[] = ["war"];

const during = period;
const since = sinceChapter;

const war: GwCond = { kind: "at_war", tag: "DEU" };
const FORTS_SHORT: GwCond = { kind: "secret", id: "ott_forts_short" };
const known = (...keys: string[]): GwCond => any(...keys.map((k) => memory(k)));
const holds = (
  office: "war" | "sea_lord" | "chief_of_staff",
  person: string,
): GwCond => ({ kind: "holder", office, person });
const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const open = (theatre: GwTheatre): GwCond => world({ is: "open", theatre });
const fighting = (tag: GwTag): GwCond =>
  world({ is: "entered", tag, side: "entente" });
const trusts = (w: GwWho, min: number): GwCond => ({
  kind: "person_trust",
  who: w,
  min,
});

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const army = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "army",
  delta,
});
const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const pride = (w: GwWho, delta: number): GwEffect => ({
  kind: "pride",
  who: w,
  delta,
});
const force = (theatre: GwTheatre, delta: number): GwEffect =>
  doWorld({ do: "force", tag: "GBR", theatre, delta });
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });

/** The table and the opposition. */
const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const cabinet = (d: number) => body("cabinet", d);
const opposition = (d: number) => body("opposition", d);

const signChief: GwEffect[] = [doWorld({ do: "sign_chief" })];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const o = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

/** A desk scene: Britain's, dealt once unless it says otherwise. */
const scene = (
  s: Omit<GwScene, "nation" | "once"> & { once?: boolean },
): GwScene => ({
  nation: NATION,
  ...s,
  once: s.once ?? true,
});

// ---- Talks ----

/** The line said here: one for each temperament named, then the base. */
const moods = (...of: GwTemperament[]): GwVariant[] => [
  ...of.map((t) => v(t, moody(who, t))),
  v("base"),
];
const line = (...ids: (string | [string, GwCond])[]): GwVariant[] =>
  ids.map((x) => (typeof x === "string" ? v(x) : v(x[0], x[1])));

interface ReplyMore {
  tell?: string[];
  effects?: GwEffect[];
  when?: GwCond;
  reacts?: GwReact[];
  gain?: GwEffect[];
  miss?: string | null;
}

const r = (
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  more: ReplyMore = {},
): GwReply => ({
  id,
  stance,
  kind,
  tell: more.tell ?? [],
  effects: more.effects ?? [],
  next,
  ...(more.when === undefined ? {} : { when: more.when }),
  ...(more.reacts === undefined ? {} : { reacts: more.reacts }),
  ...(more.gain === undefined ? {} : { gain: more.gain }),
  ...(more.miss === undefined ? {} : { miss: more.miss }),
});
const bye = (id = "end", stance: GwStance = "cold"): GwReply =>
  r(id, stance, "leave", null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([v("base")], ...replies);

const ifMood = (
  next: string | null,
  effects: GwEffect[],
  ...of: GwTemperament[]
): GwReact => ({ when: moody(who, ...of), next, effects });
const ifTrust = (
  min: number,
  next: string | null,
  effects: GwEffect[],
): GwReact => ({ when: trusts(who, min), next, effects });
const ifCold = (next: string | null, effects: GwEffect[] = []): GwReact => ({
  when: { kind: "person_trust", who, max: -2 },
  next,
  effects,
});

interface TalkMore {
  /** Chapters before the topic can come again; a once topic has none. */
  cd?: number;
}

const talkBase = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore,
) => ({
  id,
  nation: NATION,
  kind: "talk" as const,
  stage,
  when,
  cast: { who: { person } },
  tags: ["people" as const],
  who: "who",
  variants: [v("base")],
  start: "open",
  nodes,
  ...(more.cd === undefined ? { once: true } : { cooldown: more.cd }),
});

/** A topic on the people screen. */
const talk = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, person, stage, when, nodes, more),
  salience: 1,
  summon: true,
});

/** Someone comes to the desk. */
const visit = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  salience: number,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  ...talkBase(id, person, stage, when, nodes, more),
  salience,
});

export const GBR_WAR_SCENES: readonly GwScene[] = [
  // ---- Bones: the war's accounts, every three chapters ----
  scene({
    id: "gbr_w_ledger",
    kind: "ledger",
    stage: Y14_ON,
    when: all(war, since(6, "18b")),
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war"],
    once: false,
    cooldown: 3,
    variants: [
      v("won", all(world({ is: "score", min: 40 }), during("18b"))),
      v("kit_lives", all(holds("war", "gbr_kitchener"), during("17a", "18b"))),
      v("thin", gaugeAt("shells", 1)),
      v("trench", { kind: "trench", theatre: "west", min: 2 }),
      v("first", world({ is: "war_age", max: 2 })),
      v("base"),
    ],
    fallback: "sign_chief",
    options: [
      o("sign_chief", ["trust:+1"], [...signChief, trustOf(cos, 1)]),
      o(
        "return_chief",
        ["trust:-1", "army:-1"],
        [trustOf(cos, -1), army(-1), remember("m_returned_plan")],
      ),
    ],
  }),

  // ---- 1915: where to strike ----
  scene({
    id: "gbr_w_council",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("15a"), { kind: "trench", theatre: "west", min: 2 }),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      navy: holder("navy"),
    },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("lg_paper", memory("k_lg_balkans")),
      v("no_ott", not(world({ is: "entered", tag: "OTT" }))),
      v("kit_holds", holds("war", "gbr_kitchener")),
      v("base"),
    ],
    fallback: "west",
    options: [
      o(
        "west",
        ["army:+1", "trust:-1"],
        [force("west", 1), army(1), trustOf(navy, -1)],
      ),
      o(
        "straits",
        ["cabinet:-1", "army:-1", "rus:+1"],
        [
          force("straits", 1),
          force("west", -1),
          cabinet(-1),
          army(-1),
          nation("RUS", 1),
          setFlag("f_straits_chosen"),
          reason("gbr_w_straits_chosen"),
        ],
        all(
          known("k_han_boxing", "k_chu_straits"),
          world({ is: "entered", tag: "OTT" }),
        ),
      ),
      o(
        "salonika",
        ["army:-2", "cabinet:-1"],
        [force("balkan", 1), force("west", -1), army(-2), cabinet(-1)],
        memory("k_lg_balkans"),
      ),
      o(
        "north_sea",
        ["trust:+1", "army:-1"],
        [force("sea", 1), trustOf(navy, 1), army(-1)],
      ),
    ],
  }),

  // ---- 1915: the man at the head in France ----
  scene({
    id: "gbr_w_french_out",
    kind: "audience",
    stage: WAR,
    when: all(
      war,
      during("15b", "16a"),
      not(flag("f_french_gone")),
      not(chose("gbr_w_french_out", "keep_french")),
      any(
        world({ is: "losses", who: byName("gbr_french"), min: 2 }),
        world({ is: "battle", theatre: "west", of: ["repelled", "stalemate"] }),
      ),
    ),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "foreign" }] },
      cos: holder("chief_of_staff"),
    },
    salience: 8,
    tags: ["people", "war"],
    once: false,
    cooldown: 1,
    variants: [
      v("asked", chose("gbr_w_french_out", "ask_king")),
      v("king_knows", memory("k_king_letters")),
      v("base"),
    ],
    fallback: "keep_french",
    options: [
      o(
        "keep_french",
        ["army:-1", "trust:+1"],
        [army(-1), trustOf(byName("gbr_french"), 1)],
      ),
      o(
        "haig",
        ["army:+1", "authority:-5"],
        [
          doWorld({ do: "command", who: byName("gbr_haig"), theatre: "west" }),
          army(1),
          authority(-5),
          trustOf(byName("gbr_french"), -2),
          trustOf(byName("gbr_haig"), 1),
          setFlag("f_french_gone"),
          remember("m_haig_in_france"),
          reason("gbr_w_haig_in"),
        ],
        known("k_haig_on_french", "k_king_letters"),
      ),
      o(
        "robertson_terms",
        ["army:+2", "authority:-5", "trust:-1"],
        [
          doWorld({ do: "command", who: byName("gbr_haig"), theatre: "west" }),
          {
            kind: "appoint",
            who: byName("gbr_robertson"),
            office: "chief_of_staff",
          },
          army(2),
          authority(-5),
          trustOf(war_, -1),
          pride(war_, -1),
          setFlag("f_french_gone"),
          remember("m_robertson_terms"),
          reason("gbr_w_robertson_terms"),
        ],
        memory("k_rob_terms"),
      ),
      o(
        "ask_king",
        ["delay"],
        [remember("k_king_letters"), schedule("gbr_w_french_out", 1)],
      ),
    ],
  }),

  // ---- 1916: the big push ----
  scene({
    id: "gbr_w_somme_first",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("16b"),
      any(world({ is: "main", of: ["west"] }), {
        kind: "nation_gauge",
        tag: "FRA",
        gauge: "morale",
        max: 2,
      }),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("france_bleeds", {
        kind: "nation_gauge",
        tag: "FRA",
        gauge: "morale",
        max: 2,
      }),
      v("no_ground", world({ is: "front", theatre: "west", to: "hindenburg" })),
      v("lg", flag("f_pm_lg")),
      v("base"),
    ],
    fallback: "agreed_date",
    options: [
      o(
        "agreed_date",
        ["fra:+2", "shells:-1", "casualties_high"],
        [
          nation("FRA", 2),
          gauge("shells", -1),
          force("west", 1),
          men(-4),
          setFlag("f_push_1916"),
        ],
      ),
      o(
        "later_date",
        ["fra:-2", "army:+1"],
        [nation("FRA", -2), army(1), force("west", 1), setFlag("f_push_1916")],
        memory("k_haig_wait"),
      ),
      o(
        "new_weapon",
        ["shells:-1", "money:-1", "casualties_low"],
        [
          gauge("shells", -1),
          gauge("money", -1),
          force("west", 2),
          men(-2),
          setFlag("f_push_1916"),
          setFlag("f_tanks_used"),
          reason("gbr_w_tanks_sent"),
        ],
        known("k_haig_tanks", "k_han_landship"),
      ),
      o(
        "cut_scale",
        ["fra:-1", "army:-1", "casualties_low"],
        [nation("FRA", -1), army(-1), men(-1), cabinet(1)],
      ),
    ],
  }),

  scene({
    id: "gbr_w_lists",
    kind: "report",
    stage: WAR,
    when: all(war, during("16b", "18b"), world({ is: "casualties", min: 150 })),
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    once: false,
    cooldown: 6,
    stamp: "confirmed",
    source: "press",
    variants: [
      v("long", world({ is: "casualties", min: 500 })),
      v("pals", flag("f_push_1916")),
      v("base"),
    ],
  }),

  // ---- 1917: wheat and ships ----
  scene({
    id: "gbr_w_shipping",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("17a", "17b"),
      any(
        world({ is: "uboat", min: 2 }),
        gaugeAt("bread", 1),
        world({ is: "war_age", min: 18 }),
      ),
    ),
    cast: { navy: holder("navy"), sea_lord: holder("sea_lord") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("bread_gone", gaugeAt("bread", 0)),
      v("lg", flag("f_pm_lg")),
      v("uboat", world({ is: "uboat", min: 2 })),
      v("base"),
    ],
    fallback: "more_patrols",
    options: [
      o(
        "more_patrols",
        ["trust:+1", "bread:-1"],
        [trustOf(lord, 1), gauge("bread", -1)],
      ),
      o(
        "shipping_ministry",
        ["money:-1", "trust:-1"],
        [
          gauge("money", -1),
          trustOf(navy, -1),
          setFlag("f_shipping_controller"),
        ],
      ),
      o(
        "jellicoe_home",
        ["trust:+1", "morale:+1"],
        [
          { kind: "appoint", who: byName("gbr_jellicoe"), office: "sea_lord" },
          trustOf(byName("gbr_jellicoe"), 1),
          gauge("morale", 1),
          reason("gbr_w_jellicoe_home"),
        ],
        all(memory("k_jel_sealord"), not(holds("sea_lord", "gbr_jellicoe"))),
      ),
    ],
  }),

  scene({
    id: "gbr_w_convoy",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("17a", "18a"), {
      kind: "seen",
      scene: "gbr_w_shipping",
    }),
    cast: { navy: holder("navy"), sea_lord: holder("sea_lord") },
    salience: 9,
    tags: ["war"],
    variants: [
      v("figures", memory("k_jel_figures")),
      v("young_man", memory("k_han_convoy")),
      v("lg", flag("f_pm_lg")),
      v("base"),
    ],
    fallback: "no_convoy",
    options: [
      o(
        "no_convoy",
        ["trust:+1", "bread:-1"],
        [trustOf(lord, 1), gauge("bread", -1)],
      ),
      o(
        "trial_convoy",
        ["bread:+1", "trust:-1"],
        [
          gauge("bread", 1),
          trustOf(lord, -1),
          setFlag("f_convoy"),
          doWorld({ do: "uboat", level: 1 }),
          reason("gbr_w_convoy_on"),
        ],
        memory("k_han_convoy"),
      ),
      o(
        "count_again",
        ["bread:+1", "trust:+1"],
        [
          gauge("bread", 1),
          trustOf(lord, 1),
          setFlag("f_convoy"),
          doWorld({ do: "uboat", level: 1 }),
          reason("gbr_w_convoy_counted"),
        ],
        memory("k_jel_figures"),
      ),
      o(
        "walk_in_admiralty",
        ["bread:+1", "trust:-2", "cabinet:+1"],
        [
          gauge("bread", 1),
          trustOf(lord, -2),
          trustOf(navy, -1),
          cabinet(1),
          setFlag("f_convoy"),
          doWorld({ do: "uboat", level: 1 }),
          reason("gbr_w_convoy_walked"),
        ],
      ),
    ],
  }),

  scene({
    id: "gbr_w_flanders",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("17a", "17b"), world({ is: "main", of: ["west"] })),
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("mutiny_known", memory("k_bertie_paris")),
      v(
        "rain",
        all(chose("gbr_w_somme_first", "agreed_date"), not(flag("f_pm_lg"))),
      ),
      v("lg", flag("f_pm_lg")),
      v("base"),
    ],
    fallback: "approve",
    options: [
      o(
        "approve",
        ["army:+1", "shells:-1", "casualties_high"],
        [
          army(1),
          gauge("shells", -1),
          force("west", 1),
          men(-6),
          setFlag("f_flanders"),
        ],
      ),
      o(
        "small_bites",
        ["army:-1", "casualties_low"],
        [army(-1), force("west", 1), men(-2), setFlag("f_flanders_steps")],
        memory("k_haig_flanders"),
      ),
      o(
        "wait_americans",
        ["army:-2", "fra:-1", "morale:-1"],
        [
          army(-2),
          nation("FRA", -1),
          gauge("morale", -1),
          remember("m_waited_americans"),
        ],
        all(memory("k_rob_men"), fighting("USA")),
      ),
      o(
        "france_cannot",
        ["fra:+1", "army:-1", "casualties_low"],
        [nation("FRA", 1), army(-1), force("west", 1), men(-3)],
        memory("k_bertie_paris"),
      ),
      o(
        "italy_instead",
        ["army:-2", "shells:-1", "trust:-1"],
        [
          force("italy", 1),
          force("west", -1),
          army(-2),
          gauge("shells", -1),
          trustOf(cos, -1),
          remember("m_italy_guns"),
        ],
      ),
    ],
  }),

  // ---- 1917-18: men ----
  scene({
    id: "gbr_w_manpower",
    kind: "proposal",
    stage: WAR,
    when: all(
      war,
      during("17b", "18a"),
      any(world({ is: "manpower", max: 50 }), during("18a")),
    ),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "foreign" }] },
      cos: holder("chief_of_staff"),
    },
    salience: 7,
    tags: ["war"],
    variants: [
      v("russia_out", world({ is: "out", tag: "RUS" })),
      v("flanders_bill", flag("f_flanders")),
      v("base"),
    ],
    fallback: "send_them",
    options: [
      o(
        "send_them",
        ["army:+1", "order:-1"],
        [army(1), gauge("order", -1), force("west", 1), men(-3)],
      ),
      o(
        "hold_home",
        ["army:-2", "trust:-1"],
        [
          army(-2),
          trustOf(cos, -1),
          force("west", -1),
          men(2),
          setFlag("f_men_held_home"),
        ],
      ),
      o(
        "pull_salonika",
        ["fra:-1", "army:+1"],
        [nation("FRA", -1), army(1), force("balkan", -1), force("west", 1)],
        memory("k_rob_salonika"),
      ),
      o(
        "comb_out",
        ["order:-1", "shells:-1", "trust:+1"],
        [gauge("order", -1), gauge("shells", -1), trustOf(cos, 1), men(4)],
        memory("k_rob_men"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_march",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("18a"),
      any(
        all(
          world({ is: "battle", theatre: "west", of: ["break", "advance"] }),
          world({ is: "front", theatre: "west", from: "somme" }),
        ),
        world({ is: "out", tag: "RUS" }),
      ),
    ),
    cast: {
      cos: holder("chief_of_staff"),
      war: { any_of: [{ office: "war" }, { office: "foreign" }] },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("held_home", flag("f_men_held_home")),
      v("thin_line", flag("f_flanders")),
      v("lg", flag("f_pm_lg")),
      v("base"),
    ],
    fallback: "send_all",
    options: [
      o(
        "send_all",
        ["army:+1", "order:-1"],
        [
          army(1),
          gauge("order", -1),
          force("west", 2),
          men(-3),
          setFlag("f_march_sent"),
        ],
      ),
      o(
        "hold_channel",
        ["fra:-3", "army:-1"],
        [
          nation("FRA", -3),
          army(-1),
          force("west", -1),
          remember("m_channel_first"),
        ],
      ),
      o(
        "boys_of_18",
        ["morale:-1", "order:-1", "army:+1"],
        [
          gauge("morale", -1),
          gauge("order", -1),
          army(1),
          force("west", 2),
          men(3),
          setFlag("f_march_sent"),
          remember("m_boys_sent"),
          reason("gbr_w_boys_sent"),
        ],
      ),
    ],
  }),

  scene({
    id: "gbr_w_doullens",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("18a", "18b"), {
      kind: "seen",
      scene: "gbr_w_march",
    }),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["war"],
    variants: [
      v("channel_said", memory("m_channel_first")),
      v(
        "calais",
        any(
          chose("gbr_w_nivelle", "sign_it"),
          chose("gbr_w_nivelle", "for_one_battle"),
        ),
      ),
      v("base"),
    ],
    fallback: "wait",
    options: [
      o("wait", ["army:+1", "fra:-1"], [army(1), nation("FRA", -1)]),
      o(
        "foch",
        ["fra:+2", "army:-1"],
        [
          nation("FRA", 2),
          army(-1),
          force("west", 1),
          setFlag("f_foch_over_all"),
          reason("gbr_w_foch"),
        ],
        known("k_haig_foch", "k_milner_foch"),
      ),
      o(
        "joint_board",
        ["fra:+1", "trust:+1"],
        [nation("FRA", 1), trustOf(cos, 1)],
      ),
    ],
  }),

  // ---- 1915: the Straits line ----
  scene({
    id: "gbr_w_new_armies",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a")),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
    },
    salience: 6,
    tags: ["war"],
    variants: [v("straits_said", flag("f_straits_chosen")), v("base")],
    fallback: "to_france",
    options: [
      o(
        "to_france",
        ["fra:+1", "army:+1"],
        [nation("FRA", 1), army(1), force("west", 1)],
      ),
      o(
        "to_straits",
        ["fra:-1", "army:-1"],
        [nation("FRA", -1), army(-1), force("straits", 1)],
        open("straits"),
      ),
      o(
        "hold_home",
        ["fra:-1", "trust:+1"],
        [
          nation("FRA", -1),
          trustOf(war_, 1),
          men(2),
          remember("m_new_armies_held"),
        ],
        memory("k_kit_long"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_naval_only",
    kind: "dispute",
    stage: WAR,
    when: all(war, during("15a"), flag("f_straits_chosen"), open("straits")),
    cast: { navy: holder("navy"), sea_lord: holder("sea_lord") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("fisher_writes", memory("k_fisher_no")),
      v("fisher_sits", holds("sea_lord", "gbr_fisher")),
      v("base"),
    ],
    fallback: "ships_only",
    options: [
      o(
        "ships_only",
        ["trust:+1", "cabinet:+1"],
        [trustOf(navy, 1), cabinet(1)],
      ),
      o(
        "wait_troops",
        ["trust:-1", "delay"],
        [trustOf(navy, -1), force("straits", 1), remember("m_troops_first")],
        memory("k_kit_29th"),
      ),
      o(
        "hear_fisher",
        ["trust:-1", "cabinet:-1"],
        [
          trustOf(navy, -1),
          trustOf(lord, 1),
          cabinet(-1),
          force("sea", 1),
          remember("m_fisher_heard"),
        ],
        memory("k_fisher_no"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_narrows",
    kind: "report",
    stage: WAR,
    when: all(
      war,
      during("15a", "15b"),
      open("straits"),
      { kind: "seen", scene: "gbr_w_naval_only" },
      not(chose("gbr_w_naval_only", "hear_fisher")),
    ),
    cast: {},
    salience: 7,
    tags: ["war"],
    stamp: "confirmed",
    source: "staff",
    variants: [
      v(
        "forts_short",
        all(chose("gbr_w_naval_only", "ships_only"), FORTS_SHORT),
      ),
      v("ships", chose("gbr_w_naval_only", "ships_only")),
      v("base"),
    ],
  }),

  scene({
    id: "gbr_w_landing",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("15a", "15b"), {
      kind: "seen",
      scene: "gbr_w_narrows",
    }),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      navy: holder("navy"),
    },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("forts_rumour", FORTS_SHORT),
      v("waited", memory("m_troops_first")),
      v("base"),
    ],
    fallback: "land",
    options: [
      o(
        "land",
        ["army:+1", "shells:-1", "casualties_high"],
        [
          army(1),
          gauge("shells", -1),
          force("straits", 1),
          men(-3),
          setFlag("f_landed"),
        ],
      ),
      o(
        "call_off",
        ["trust:-2", "rus:-1", "morale:-1"],
        [
          trustOf(navy, -2),
          nation("RUS", -1),
          gauge("morale", -1),
          setFlag("f_straits_left"),
        ],
      ),
      o(
        "more_men",
        ["army:-1", "fra:-1", "casualties_high"],
        [
          army(-1),
          nation("FRA", -1),
          force("straits", 2),
          force("west", -1),
          men(-4),
          setFlag("f_landed"),
        ],
        memory("k_kit_29th"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_fisher_out",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("15a", "15b"),
      holds("sea_lord", "gbr_fisher"),
      open("straits"),
    ),
    cast: { navy: holder("navy"), sea_lord: holder("sea_lord") },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [
      v("heard_him", memory("m_fisher_heard")),
      v("landed", flag("f_landed")),
      v("base"),
    ],
    fallback: "hold_churchill",
    options: [
      o(
        "hold_churchill",
        ["trust:+1", "opposition:+2", "leaves"],
        [
          trustOf(navy, 1),
          opposition(2),
          doWorld({ do: "leave", who: lord }),
          reason("gbr_w_fisher_gone"),
        ],
      ),
      o(
        "move_churchill",
        ["opposition:-1", "leaves", "trust:-2"],
        [
          opposition(-1),
          trustOf(navy, -2),
          doWorld({ do: "leave", who: lord }),
          { kind: "dismiss", who: navy },
          remember("m_churchill_moved"),
          reason("gbr_w_churchill_moved"),
        ],
        memory("k_chu_fisher"),
      ),
      o(
        "beg_fisher",
        ["trust:-1", "authority:-5"],
        [
          trustOf(navy, -1),
          authority(-5),
          pride(lord, 1),
          remember("m_begged_fisher"),
        ],
      ),
    ],
  }),

  scene({
    id: "gbr_w_gates",
    kind: "proposal",
    stage: WAR,
    when: all(
      war,
      during("15a", "16a"),
      world({ is: "front", theatre: "straits", from: "narrows" }),
    ),
    cast: { foreign: holder("foreign"), navy: holder("navy") },
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [v("promised", memory("m_russia_straits")), v("base")],
    fallback: "wait_russia",
    options: [
      o(
        "wait_russia",
        ["rus:+2", "trust:-1"],
        [nation("RUS", 2), trustOf(navy, -1)],
      ),
      o(
        "enter_first",
        ["rus:-3", "morale:+2", "fra:-1"],
        [
          nation("RUS", -3),
          nation("FRA", -1),
          gauge("morale", 2),
          force("straits", 1),
        ],
      ),
      o(
        "offer_ottoman",
        ["rus:-2", "cabinet:+1"],
        [
          nation("RUS", -2),
          cabinet(1),
          doWorld({ do: "offer", tag: "OTT", value: 3 }),
          remember("m_ottoman_offered"),
        ],
      ),
    ],
  }),

  scene({
    id: "gbr_w_evacuate",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("15b", "16a"),
      open("straits"),
      flag("f_landed"),
      not(flag("f_straits_left")),
      world({
        is: "battle",
        theatre: "straits",
        of: ["stalemate", "repelled"],
      }),
    ),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      navy: holder("navy"),
    },
    salience: 8,
    tags: ["war", "tension_down"],
    once: false,
    cooldown: 2,
    variants: [
      v("minister_back", memory("m_minister_went")),
      v("winter", during("16a")),
      v("base"),
    ],
    fallback: "stay",
    options: [
      o("stay", ["casualties_high", "trust:+1"], [men(-2), trustOf(navy, 1)]),
      o(
        "evacuate",
        ["morale:-1", "army:+1"],
        [
          gauge("morale", -1),
          army(1),
          force("straits", -2),
          force("west", 1),
          setFlag("f_straits_left"),
          reason("gbr_w_evacuated"),
        ],
        memory("v_evacuate"),
      ),
      o(
        "send_war_minister",
        ["delay", "cabinet:+1"],
        [
          cabinet(1),
          remember("m_minister_went"),
          remember("v_evacuate"),
          schedule("gbr_w_evacuate", 1),
        ],
      ),
      o(
        "west_first",
        ["army:+2", "morale:-1", "trust:-1"],
        [
          army(2),
          gauge("morale", -1),
          trustOf(navy, -1),
          force("straits", -2),
          force("west", 2),
          setFlag("f_straits_left"),
          reason("gbr_w_evacuated"),
        ],
        memory("k_rob_west"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_salonika",
    kind: "dispute",
    stage: WAR,
    when: all(
      war,
      during("15b"),
      world({ is: "entered", tag: "BGR", side: "central" }),
    ),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      foreign: holder("foreign"),
    },
    salience: 7,
    tags: ["war", "foreign"],
    variants: [
      v("serbia_falls", world({ is: "front", theatre: "balkan", from: "nis" })),
      v("greek_door", memory("k_lg_balkans")),
      v("base"),
    ],
    fallback: "words_only",
    options: [
      o("words_only", ["fra:-1", "army:+1"], [nation("FRA", -1), army(1)]),
      o(
        "send_division",
        ["fra:+1", "army:-1"],
        [
          nation("FRA", 1),
          army(-1),
          force("balkan", 1),
          setFlag("f_salonika_held"),
        ],
      ),
      o(
        "hear_carson",
        ["fra:+2", "army:-2", "cabinet:+1"],
        [
          nation("FRA", 2),
          army(-2),
          cabinet(1),
          force("balkan", 2),
          force("west", -1),
          setFlag("f_salonika_held"),
          remember("m_carson_heard"),
        ],
        memory("k_car_serbia"),
      ),
    ],
  }),

  // ---- Mesopotamia ----
  scene({
    id: "gbr_w_baghdad_road",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15b"), open("mesopotamia")),
    cast: { war: { any_of: [{ office: "war" }, { office: "foreign" }] } },
    salience: 6,
    tags: ["war"],
    variants: [v("straits_bad", flag("f_landed")), v("base")],
    fallback: "hold_kut",
    options: [
      o(
        "hold_kut",
        ["morale:-1", "trust:+1"],
        [gauge("morale", -1), trustOf(war_, 1)],
      ),
      o(
        "push_baghdad",
        ["morale:+1", "casualties_low"],
        [
          gauge("morale", 1),
          force("mesopotamia", 1),
          men(-1),
          setFlag("f_baghdad_push"),
        ],
      ),
      o(
        "ask_india",
        ["delay", "cabinet:+1"],
        [
          cabinet(1),
          force("mesopotamia", -1),
          setFlag("f_baghdad_push"),
          remember("m_india_asked"),
        ],
      ),
    ],
  }),

  scene({
    id: "gbr_w_kut",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("15b", "16a"),
      flag("f_baghdad_push"),
      world({
        is: "battle",
        theatre: "mesopotamia",
        of: ["repelled", "stalemate"],
      }),
    ),
    cast: {
      war: { any_of: [{ office: "war" }, { office: "chief_of_staff" }] },
      foreign: holder("foreign"),
    },
    salience: 7,
    tags: ["war", "tension_up"],
    variants: [
      v("india_said", memory("m_india_asked")),
      v("hunger", during("16a")),
      v("base"),
    ],
    fallback: "relief",
    options: [
      o(
        "relief",
        ["casualties_high", "morale:+1"],
        [men(-3), gauge("morale", 1), force("mesopotamia", 1)],
      ),
      o(
        "buy_way_out",
        ["money:-1", "morale:-1"],
        [
          gauge("money", -1),
          gauge("morale", -1),
          remember("m_kut_ransom"),
          reason("gbr_w_kut_ransom"),
        ],
      ),
      o(
        "leave_it",
        ["morale:-2", "opposition:+1"],
        [gauge("morale", -2), opposition(1), force("mesopotamia", -1)],
      ),
    ],
  }),

  // ---- 1916: the fleet, and the sea north of Orkney ----
  scene({
    id: "gbr_w_jutland",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("16a", "16b"),
      any(
        world({
          is: "battle",
          theatre: "sea",
          of: ["break", "advance", "stalemate", "repelled"],
        }),
        world({ is: "war_age", min: 20 }),
      ),
    ),
    cast: { navy: holder("navy") },
    salience: 7,
    tags: ["war"],
    variants: [
      v("sea_lost", world({ is: "front", theatre: "sea", from: "channel" })),
      v("room40", memory("k_hall_room40")),
      v("base"),
    ],
    fallback: "plain_communique",
    options: [
      o(
        "plain_communique",
        ["morale:-1", "trust:+1"],
        [gauge("morale", -1), trustOf(byName("gbr_jellicoe"), 1)],
      ),
      o(
        "better_words",
        ["morale:+1", "trust:-1"],
        [
          gauge("morale", 1),
          trustOf(navy, -1),
          remember("m_second_communique"),
        ],
        memory("k_bal_communique"),
      ),
      o(
        "read_intercepts",
        ["trust:-1"],
        [
          trustOf(navy, -1),
          remember("m_room40_opened"),
          force("sea", 1),
          reason("gbr_w_room40_opened"),
        ],
        memory("k_hall_room40"),
      ),
      o(
        "no_blame",
        ["trust:+2", "opposition:+1"],
        [trustOf(byName("gbr_jellicoe"), 2), opposition(1)],
        known("k_jel_risk", "k_jel_jutland"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_kitchener_lost",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("16a", "16b"),
      chose("gbr_f_russia_mission", "send"),
      holds("war", "gbr_kitchener"),
      not(flag("f_pm_lg")),
    ),
    cast: { foreign: holder("foreign") },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [v("coalition", flag("f_coalition")), v("base")],
    fallback: "lloyd_george",
    options: [
      o(
        "lloyd_george",
        ["cabinet:-1", "morale:+1", "leaves"],
        [
          doWorld({ do: "leave", who: byName("gbr_kitchener") }),
          { kind: "appoint", who: byName("gbr_lloyd_george"), office: "war" },
          cabinet(-1),
          gauge("morale", 1),
          remember("m_kitchener_lost"),
        ],
      ),
      o(
        "bonar_law",
        ["opposition:-1", "leaves", "trust:+1"],
        [
          doWorld({ do: "leave", who: byName("gbr_kitchener") }),
          { kind: "appoint", who: byName("gbr_bonar_law"), office: "war" },
          opposition(-1),
          trustOf(byName("gbr_bonar_law"), 1),
          remember("m_kitchener_lost"),
        ],
      ),
      o(
        "take_it_myself",
        ["cabinet:-2", "authority:-5", "leaves"],
        [
          doWorld({ do: "leave", who: byName("gbr_kitchener") }),
          cabinet(-2),
          authority(-5),
          remember("m_kitchener_lost"),
          remember("m_held_war_office"),
        ],
      ),
    ],
  }),

  // ---- 1917: papers and people ----
  scene({
    id: "gbr_w_nivelle",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("17a"),
      fighting("FRA"),
      not(world({ is: "out", tag: "FRA" })),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["war", "foreign"],
    variants: [
      v("lg", flag("f_pm_lg")),
      v("bad_year", world({ is: "casualties", min: 400 })),
      v("base"),
    ],
    fallback: "refuse",
    options: [
      o(
        "refuse",
        ["fra:-1", "army:+1"],
        [nation("FRA", -1), army(1), trustOf(cos, 1)],
      ),
      o(
        "sign_it",
        ["fra:+2", "army:-3", "trust:-2"],
        [
          nation("FRA", 2),
          army(-3),
          trustOf(cos, -2),
          trustOf(byName("gbr_haig"), -2),
          remember("m_under_nivelle"),
        ],
      ),
      o(
        "for_one_battle",
        ["fra:+1", "army:-1", "trust:-1"],
        [nation("FRA", 1), army(-1), trustOf(byName("gbr_haig"), -1)],
      ),
    ],
  }),

  scene({
    id: "gbr_w_air_raids",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17a", "17b")),
    cast: { war: { any_of: [{ office: "war" }, { office: "foreign" }] } },
    salience: 6,
    tags: ["home", "tension_up"],
    variants: [v("school", gaugeAt("morale", 2)), v("base")],
    fallback: "more_guns",
    options: [
      o(
        "more_guns",
        ["shells:-1", "order:+1"],
        [gauge("shells", -1), gauge("order", 1)],
      ),
      o(
        "air_ministry",
        ["money:-1", "army:-1", "morale:+1"],
        [
          gauge("money", -1),
          army(-1),
          gauge("morale", 1),
          setFlag("f_air_ministry"),
        ],
      ),
      o(
        "bring_squadrons",
        ["army:-1", "morale:+1"],
        [army(-1), gauge("morale", 1), force("west", -1)],
      ),
    ],
  }),

  scene({
    id: "gbr_w_jellicoe_out",
    kind: "audience",
    stage: WAR,
    when: all(war, during("17b"), holds("sea_lord", "gbr_jellicoe")),
    cast: { navy: holder("navy") },
    salience: 6,
    tags: ["people"],
    variants: [v("convoy_late", not(flag("f_convoy"))), v("base")],
    fallback: "keep_him",
    options: [
      o(
        "keep_him",
        ["trust:+1", "cabinet:-1"],
        [trustOf(byName("gbr_jellicoe"), 1), cabinet(-1)],
      ),
      o(
        "replace",
        ["trust:-3", "morale:-1", "cabinet:+1", "leaves"],
        [
          trustOf(byName("gbr_jellicoe"), -3),
          gauge("morale", -1),
          cabinet(1),
          { kind: "dismiss", who: byName("gbr_jellicoe") },
          reason("gbr_w_jellicoe_dismissed"),
        ],
      ),
      o(
        "rest_him",
        ["trust:+1", "leaves"],
        [
          trustOf(byName("gbr_jellicoe"), 1),
          doWorld({ do: "leave", who: byName("gbr_jellicoe") }),
          remember("m_jellicoe_rested"),
        ],
        memory("k_jel_tired"),
      ),
    ],
  }),

  scene({
    id: "gbr_w_jerusalem",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17b"), open("palestine")),
    cast: { war: { any_of: [{ office: "war" }, { office: "foreign" }] } },
    salience: 6,
    tags: ["war", "tension_down"],
    variants: [
      v(
        "gaza_past",
        world({ is: "front", theatre: "palestine", from: "jerusalem" }),
      ),
      v("base"),
    ],
    fallback: "hold",
    options: [
      o("hold", ["army:+1", "morale:-1"], [army(1), gauge("morale", -1)]),
      o(
        "give_divisions",
        ["army:-2", "morale:+2"],
        [
          army(-2),
          gauge("morale", 2),
          force("palestine", 2),
          force("west", -1),
        ],
      ),
      o(
        "leave_to_cairo",
        ["morale:+1", "trust:-1"],
        [gauge("morale", 1), trustOf(war_, -1), force("palestine", 1)],
      ),
    ],
  }),

  // ---- 1918: the chief of staff ----
  scene({
    id: "gbr_w_versailles",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      during("17b", "18a"),
      holds("chief_of_staff", "gbr_robertson"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["people", "tension_up"],
    variants: [
      v("russia_out", world({ is: "out", tag: "RUS" })),
      v("lg", flag("f_pm_lg")),
      v("base"),
    ],
    fallback: "keep_chief",
    options: [
      o(
        "keep_chief",
        ["army:+1", "fra:-1"],
        [army(1), nation("FRA", -1), trustOf(cos, 1)],
      ),
      o(
        "replace_wilson",
        ["army:-2", "fra:+2", "opposition:+1", "leaves"],
        [
          army(-2),
          nation("FRA", 2),
          opposition(1),
          {
            kind: "appoint",
            who: byName("gbr_wilson"),
            office: "chief_of_staff",
          },
          reason("gbr_w_wilson_in"),
        ],
        memory("k_wilson_versailles"),
      ),
      o(
        "offer_versailles",
        ["army:-1", "fra:+1", "trust:-1"],
        [
          army(-1),
          nation("FRA", 1),
          trustOf(cos, -1),
          doWorld({ do: "letter", who: cos }),
          remember("m_versailles_offered"),
        ],
        memory("k_rob_versailles"),
      ),
    ],
  }),

  // ---- Kitchener ----
  talk(
    "gbr_t_kitchener_long",
    "gbr_kitchener",
    ["crisis", "y1914"],
    all(war, { kind: "chapter", min: 5, max: 7 }),
    {
      open: node(
        moods("cold", "arrogant"),
        r("why_three", "frank", "ask", "count", {
          reacts: [ifCold("shut", [])],
        }),
        r("six_months", "cold", "push", "count", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        r("million", "warm", "deal", "million", {
          tell: ["money:-1"],
          effects: [gauge("money", -1)],
        }),
        bye("later", "warm"),
      ),
      count: plain(
        r("write_it", "frank", "deal", null, {
          tell: ["trust:+1"],
          effects: [remember("k_kit_long"), trustOf(who, 1)],
        }),
        r("tell_table", "frank", "push", "table", { miss: "shut" }),
        bye("noted"),
      ),
      million: plain(
        r("yours", "warm", "deal", null, {
          effects: [remember("k_kit_long")],
        }),
        bye("too_many"),
      ),
      shut: plain(bye("end")),
      table: node(
        moods("arrogant"),
        r("i_will", "warm", "deal", null, {
          tell: ["trust:+1"],
          effects: [remember("k_kit_long"), trustOf(who, 1)],
        }),
        bye("end"),
      ),
    },
  ),

  talk(
    "gbr_t_kitchener_paris",
    "gbr_kitchener",
    ["crisis", "y1914"],
    all(
      war,
      { kind: "chapter", min: 6, max: 7 },
      holds("war", "gbr_kitchener"),
    ),
    {
      open: node(
        moods("cold", "arrogant"),
        r("go_yourself", "frank", "push", "go", {
          tell: ["trust:-1"],
          effects: [pride(who, 1)],
          miss: "cross",
        }),
        r("read_it", "cold", "ask", "letter"),
        r("leave_it", "warm", "leave", null),
      ),
      letter: plain(
        r("what_do", "frank", "ask", "go"),
        r("joffre", "cold", "ask", "joffre"),
        bye("enough"),
      ),
      go: plain(
        r("uniform", "frank", "deal", null, {
          tell: ["army:-1"],
          effects: [army(-1), remember("k_kit_paris")],
        }),
        r("not_uniform", "warm", "deal", null, {
          effects: [remember("k_kit_paris")],
          reacts: [
            ifMood(null, [remember("k_kit_paris"), pride(who, 1)], "arrogant"),
          ],
        }),
      ),
      cross: plain(r("sorry", "warm", "ask", "go"), bye("end")),
      joffre: plain(r("go_now", "frank", "ask", "go"), bye("end")),
    },
  ),

  talk(
    "gbr_t_kitchener_shells",
    "gbr_kitchener",
    Y14_ON,
    all(since(9, "15a"), holds("war", "gbr_kitchener")),
    {
      open: node(
        line(
          ["thin", gaugeAt("shells", 1)],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("factories", "warm", "deal", "factories", {
          tell: ["money:-1", "shells:+1"],
          effects: [gauge("money", -1), gauge("shells", 1)],
        }),
        r("number", "cold", "ask", "number", {
          reacts: [ifCold("no_number", [])],
        }),
        r("french_says", "frank", "push", "french", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "no_number",
        }),
        bye("later", "warm"),
      ),
      number: node(
        line(["straight", candid(who)], "base"),
        r("shown", "frank", "deal", null, {
          effects: [remember("k_kit_shells")],
        }),
        bye("end"),
      ),
      french: plain(r("whose", "cold", "ask", "number"), bye("end")),
      factories: plain(
        r("mine", "frank", "deal", null, {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1), remember("k_kit_shells")],
        }),
        r("lg_asks", "frank", "ask", "minister"),
        bye("end", "warm"),
      ),
      no_number: plain(bye("end")),
      minister: node(
        moods("arrogant"),
        r("half", "warm", "deal", null, {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1), remember("k_kit_shells")],
        }),
        bye("end", "warm"),
      ),
    },
  ),

  talk(
    "gbr_t_kitchener_men",
    "gbr_kitchener",
    WAR,
    all(during("15a"), open("straits")),
    {
      open: node(
        moods("cold", "arrogant"),
        r("which", "cold", "ask", "which"),
        r("churchill_says", "threat", "push", "storm", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("which", [], "cold")],
          miss: "storm",
        }),
        r("flatter_east", "flatter", "ask", "east", {
          reacts: [ifMood("which", [], "stubborn")],
        }),
        bye("leave", "warm"),
      ),
      which: plain(
        r("get_it", "frank", "deal", null, {
          tell: ["army:-1", "fra:-1"],
          effects: [
            army(-1),
            nation("FRA", -1),
            remember("k_kit_29th"),
            remember("v_straits", who),
          ],
        }),
        r("fleet_first", "cold", "ask", "navy_first"),
        bye("end"),
      ),
      east: plain(
        r("so_release", "flatter", "deal", null, {
          tell: ["army:-1"],
          effects: [
            army(-1),
            remember("k_kit_29th"),
            remember("v_straits", who),
          ],
          miss: "storm",
        }),
        bye("end"),
      ),
      storm: plain(bye("end")),
      navy_first: plain(
        r("take_order", "frank", "deal", null, {
          tell: ["army:-1", "fra:-1"],
          effects: [
            army(-1),
            nation("FRA", -1),
            remember("k_kit_29th"),
            remember("v_straits", who),
          ],
        }),
        bye("end"),
      ),
    },
  ),

  talk(
    "gbr_t_kitchener_silence",
    "gbr_kitchener",
    WAR,
    all(during("15a", "16a"), holds("war", "gbr_kitchener")),
    {
      open: node(
        line(
          ["blamed", memory("k_kit_shells")],
          ["straits", flag("f_landed")],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("table_asks", "frank", "push", "table", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "wall",
        }),
        r("just_me", "frank", "deal", "only_you", {
          tell: ["promise"],
          effects: [
            promise(who, "p_kit_tell", 6, {
              keep: chose("gbr_h_shells", "kitchener_answers"),
            }),
          ],
        }),
        r("why_silent", "warm", "ask", "map", {
          reacts: [ifTrust(2, "map", [{ kind: "mood", delta: 1 }])],
        }),
        bye("leave", "warm"),
      ),
      map: node(
        line(["straight", candid(who)], "base"),
        r("noted", "frank", "ask", "only_you"),
        r("whose_mouth", "cold", "ask", "mouths", {
          reacts: [ifMood("wall", [], "arrogant")],
        }),
        bye("end", "warm"),
      ),
      table: plain(r("thank", "cold", "leave", null)),
      only_you: plain(bye("end", "warm")),
      wall: plain(bye("end")),
      mouths: node(line(["straight", candid(who)], "base"), bye("end", "warm")),
    },
    { cd: 8 },
  ),

  talk(
    "gbr_t_kitchener_russia",
    "gbr_kitchener",
    WAR,
    all(during("16a"), holds("war", "gbr_kitchener")),
    {
      open: node(
        moods("cold", "arrogant"),
        r("want_go", "warm", "ask", "go"),
        r("others", "frank", "deal", "other", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1), remember("k_kit_russia")],
          reacts: [
            ifMood(
              "sting",
              [remember("k_kit_russia"), pride(who, -1)],
              "arrogant",
            ),
          ],
        }),
        bye("later", "warm"),
      ),
      go: plain(
        r("stay_then", "frank", "push", "other", {
          effects: [remember("k_kit_russia")],
          miss: "sting",
        }),
        r("after_trip", "warm", "ask", "after"),
        bye("think"),
      ),
      other: plain(bye("end", "warm")),
      sting: plain(bye("end")),
      after: plain(
        r("yes_seat", "warm", "deal", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_kit_russia")],
        }),
        bye("end"),
      ),
    },
  ),

  // ---- Haig ----
  talk(
    "gbr_t_haig_corps",
    "gbr_haig",
    Y14_ON,
    all(war, since(6, "15b")),
    {
      open: node(
        line(
          ["trenches", { kind: "trench", theatre: "west", min: 2 }],
          ["shells", gaugeAt("shells", 1)],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("ask_chief", "cold", "ask", "chief", {
          reacts: [ifCold("shut", [])],
        }),
        r("ask_men", "warm", "ask", "morale"),
        r("say_it", "frank", "push", "chief", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        bye("later", "warm"),
      ),
      chief: node(
        line(["straight", candid(who)], "base"),
        r("write_me", "frank", "deal", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("m_haig_wrote")],
        }),
        r("who_next", "cold", "ask", "next", {
          reacts: [ifMood("next", [{ kind: "mood", delta: 1 }], "stubborn")],
        }),
        bye("end"),
      ),
      morale: plain(
        r("report", "cold", "ask", null, {
          effects: [
            doWorld({
              do: "report",
              fact: "morale",
              tag: "DEU",
              theatre: "west",
              source: "staff",
            }),
          ],
        }),
        bye("end", "warm"),
      ),
      shut: plain(bye("end")),
      next: plain(bye("end")),
    },
    { cd: 8 },
  ),

  talk(
    "gbr_t_haig_french",
    "gbr_haig",
    WAR,
    all(war, during("15b"), not(flag("f_french_gone"))),
    {
      open: node(
        moods("cold"),
        r("flatter", "flatter", "ask", "duty", {
          reacts: [ifMood("reserves", [], "stubborn")],
        }),
        r("offer", "warm", "deal", "duty", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
        r("how_see", "frank", "ask", "reserves", {
          reacts: [ifCold("shut", [])],
        }),
        bye("leave", "warm"),
      ),
      reserves: plain(
        r("key", "cold", "deal", null, {
          effects: [remember("k_haig_on_french")],
        }),
        bye("end"),
      ),
      duty: plain(
        r("king_too", "frank", "ask", "reserves"),
        r("take_it", "frank", "ask", "if_you"),
        bye("end", "warm"),
      ),
      shut: plain(bye("end")),
      if_you: plain(
        r("noted", "frank", "deal", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_haig_on_french")],
        }),
        bye("end"),
      ),
    },
  ),

  talk("gbr_t_haig_wait", "gbr_haig", WAR, all(war, during("16a")), {
    open: node(
      moods("cold"),
      r("give_time", "warm", "deal", "august", {
        tell: ["trust:+1", "fra:-1"],
        effects: [trustOf(who, 1), nation("FRA", -1), remember("k_haig_wait")],
      }),
      r("when", "cold", "ask", "august"),
      r("paris_says", "frank", "push", "august", {
        tell: ["fra:-1"],
        effects: [nation("FRA", -1)],
        miss: "stiff",
      }),
      bye("later", "warm"),
    ),
    august: plain(
      r("understood", "cold", "deal", null, {
        effects: [remember("k_haig_wait")],
      }),
      r("joffre_rage", "frank", "ask", "joffre"),
      bye("end"),
    ),
    stiff: plain(r("ask_again", "warm", "ask", "august"), bye("end")),
    joffre: plain(
      r("mine", "frank", "deal", null, {
        tell: ["fra:-1"],
        effects: [nation("FRA", -1), remember("k_haig_wait")],
      }),
      bye("end"),
    ),
  }),

  talk("gbr_t_haig_tanks", "gbr_haig", WAR, all(war, during("16a", "16b")), {
    open: node(
      moods("cold"),
      r("what_thing", "cold", "ask", "machine"),
      r("too_few", "frank", "push", "few", {
        reacts: [ifTrust(2, "machine", [])],
        miss: "few",
      }),
      r("order_more", "warm", "deal", "machine", {
        tell: ["money:-1"],
        effects: [gauge("money", -1), remember("k_haig_tanks")],
      }),
      bye("later", "warm"),
    ),
    machine: plain(
      r("use_them", "frank", "deal", null, {
        effects: [remember("k_haig_tanks")],
      }),
      r("surprise", "cold", "ask", "secret"),
      bye("end"),
    ),
    few: plain(r("wait_more", "warm", "ask", "machine"), bye("end")),
    secret: plain(bye("end")),
  }),

  talk("gbr_t_haig_flanders", "gbr_haig", WAR, all(war, during("17a")), {
    open: node(
      line(
        ["paris", memory("k_bertie_paris")],
        ["cold", moody(who, "cold")],
        "base",
      ),
      r("the_mud", "frank", "push", "mud", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1), remember("v_flanders", who)],
        miss: "stiff",
      }),
      r("count_votes", "warm", "deal", "bites", {
        tell: ["promise", "trust:+1"],
        effects: [
          trustOf(who, 1),
          promise(who, "p_haig_votes", 8, {
            keep: any(
              chose("gbr_w_flanders", "approve"),
              chose("gbr_w_flanders", "small_bites"),
            ),
          }),
        ],
      }),
      r("how_far", "cold", "ask", "bites"),
      bye("later", "warm"),
    ),
    bites: plain(
      r("understood", "frank", "deal", null, {
        effects: [remember("k_haig_flanders"), remember("v_flanders", who)],
      }),
      r("ask_table", "frank", "ask", "frock"),
      bye("end"),
    ),
    mud: plain(r("still", "cold", "ask", "bites"), bye("end")),
    stiff: plain(bye("end")),
    frock: node(line(["lg", flag("f_pm_lg")], "base"), bye("end")),
  }),

  talk("gbr_t_haig_reserve", "gbr_haig", WAR, all(war, during("18a")), {
    open: node(
      line(
        ["after", { kind: "seen", scene: "gbr_w_march" }],
        ["cold", moody(who, "cold")],
        "base",
      ),
      r("mine_to_ask", "warm", "deal", "foch", {
        tell: ["trust:+1"],
        effects: [trustOf(who, 1)],
      }),
      r("no_reserve", "frank", "ask", "foch"),
      r("your_fault", "threat", "push", "stiff", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1)],
        miss: "stiff",
      }),
      bye("later", "warm"),
    ),
    foch: plain(
      r("write_foch", "frank", "deal", null, {
        effects: [remember("k_haig_foch")],
      }),
      r("petain", "cold", "ask", "petain"),
      bye("end"),
    ),
    stiff: plain(r("pardon", "warm", "ask", "foch"), bye("end")),
    petain: plain(bye("end")),
  }),

  // ---- Robertson ----
  talk("gbr_t_robertson_terms", "gbr_robertson", WAR, all(war, during("15b")), {
    open: node(
      moods("cold"),
      r("read_terms", "cold", "ask", "paper"),
      r("too_much", "frank", "push", "paper", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1)],
        miss: "out",
      }),
      r("accept", "frank", "deal", "yes", {
        tell: ["promise", "army:+1"],
        effects: [
          army(1),
          remember("k_rob_terms"),
          promise(who, "p_rob_sole", 8, {
            keep: chose("gbr_w_french_out", "robertson_terms"),
          }),
        ],
      }),
      bye("later", "warm"),
    ),
    paper: plain(
      r("kitchener", "cold", "ask", "war_minister"),
      r("agreed", "frank", "deal", null, {
        effects: [remember("k_rob_terms")],
      }),
      r("why_you", "frank", "ask", "why_you"),
      bye("end"),
    ),
    war_minister: plain(
      r("agreed", "frank", "deal", null, {
        effects: [remember("k_rob_terms")],
      }),
      bye("end"),
    ),
    yes: plain(bye("end", "warm")),
    out: plain(bye("end")),
    why_you: plain(
      r("agreed", "frank", "deal", null, {
        effects: [remember("k_rob_terms")],
      }),
      bye("end"),
    ),
  }),

  talk(
    "gbr_t_robertson_west",
    "gbr_robertson",
    WAR,
    all(war, during("15b", "16a")),
    {
      open: node(
        line(["evac", flag("f_landed")], ["cold", moody(who, "cold")], "base"),
        r("east_door", "cold", "push", "heard", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "heard",
        }),
        r("back_you", "warm", "deal", "good", {
          tell: ["trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_rob_west"),
            remember("v_evacuate", who),
          ],
        }),
        r("why_west", "frank", "ask", "why"),
        bye("later", "warm"),
      ),
      why: plain(
        r("noted", "frank", "deal", null, {
          effects: [remember("k_rob_west"), remember("v_evacuate", who)],
        }),
        r("who_chose", "cold", "ask", "chose"),
        bye("end"),
      ),
      heard: plain(r("try_again", "frank", "ask", "why"), bye("end")),
      good: plain(bye("end", "warm")),
      chose: plain(bye("end")),
    },
  ),

  talk(
    "gbr_t_robertson_frocks",
    "gbr_robertson",
    WAR,
    all(war, during("16a", "17b")),
    {
      open: node(
        line(
          ["lg", flag("f_pm_lg")],
          ["after_push", flag("f_push_1916")],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("stand_with", "warm", "deal", "stand", {
          tell: ["trust:+1", "cabinet:-1"],
          effects: [trustOf(who, 1), cabinet(-1)],
        }),
        r("who_talks", "cold", "ask", "leaks", {
          reacts: [ifCold("shut", [])],
        }),
        r("you_too", "frank", "push", "leaks", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        bye("later", "warm"),
      ),
      leaks: node(
        line(["straight", candid(who)], "base"),
        r("thanks", "frank", "ask", null, {
          effects: [remember("m_rob_named_leaks")],
        }),
        r("wilson_too", "cold", "ask", "wilson"),
        bye("end"),
      ),
      stand: plain(bye("end", "warm")),
      shut: plain(bye("end")),
      wilson: plain(bye("end")),
    },
    { cd: 8 },
  ),

  talk(
    "gbr_t_robertson_salonika",
    "gbr_robertson",
    WAR,
    all(war, during("17a", "17b")),
    {
      open: node(
        line(
          ["held", flag("f_salonika_held")],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("count", "cold", "ask", "count"),
        r("paris_wants", "frank", "push", "paris", {
          miss: "paris",
        }),
        r("pull", "frank", "deal", "good", {
          tell: ["fra:-1"],
          effects: [nation("FRA", -1), remember("k_rob_salonika")],
        }),
        bye("later", "warm"),
      ),
      count: plain(
        r("key", "cold", "deal", null, {
          effects: [remember("k_rob_salonika")],
        }),
        r("who_holds", "frank", "ask", "general"),
        bye("end"),
      ),
      paris: plain(r("how_many", "cold", "ask", "count"), bye("end")),
      good: plain(bye("end", "warm")),
      general: plain(
        r("key", "frank", "deal", null, {
          effects: [remember("k_rob_salonika")],
        }),
        bye("end"),
      ),
    },
  ),

  talk(
    "gbr_t_robertson_men",
    "gbr_robertson",
    WAR,
    all(war, during("17a", "17b")),
    {
      open: node(
        line(
          ["thin", world({ is: "manpower", max: 40 })],
          ["cold", moody(who, "cold")],
          "base",
        ),
        r("where_gone", "threat", "push", "stiff", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("number", [], "cold")],
          miss: "stiff",
        }),
        r("send", "frank", "deal", "number", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            promise(who, "p_rob_men", 8, {
              keep: chose("gbr_w_manpower", "send_them"),
            }),
          ],
        }),
        r("how_many", "cold", "ask", "number"),
        bye("later", "warm"),
      ),
      number: plain(
        r("comb", "frank", "deal", null, {
          effects: [remember("k_rob_men"), remember("v_flanders", who)],
        }),
        r("factories", "cold", "ask", "works"),
        bye("end"),
      ),
      stiff: plain(r("how_many", "cold", "ask", "number"), bye("end")),
      works: plain(bye("end")),
    },
  ),

  talk(
    "gbr_t_robertson_versailles",
    "gbr_robertson",
    WAR,
    all(war, during("17b", "18a"), holds("chief_of_staff", "gbr_robertson")),
    {
      open: node(
        moods("cold"),
        r("two_heads", "frank", "ask", "heads"),
        r("would_go", "warm", "ask", "versailles"),
        r("must_bend", "threat", "push", "out", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [ifMood("versailles", [], "cold")],
          miss: "out",
        }),
        bye("later", "warm"),
      ),
      versailles: plain(
        r("key", "frank", "deal", null, {
          effects: [remember("k_rob_versailles")],
        }),
        bye("end"),
      ),
      heads: plain(
        r("offer", "warm", "deal", "versailles", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
        }),
        r("wilson", "cold", "ask", "wilson"),
        bye("end"),
      ),
      out: plain(bye("end")),
      wilson: plain(bye("end")),
    },
  ),

  // ---- Jellicoe ----
  talk("gbr_t_jellicoe_risk", "gbr_jellicoe", CRISIS_ON, since(3, "15a"), {
    open: node(
      moods("anxious", "weary"),
      r("what_lose", "warm", "ask", "count", {
        reacts: [ifMood("count", [{ kind: "mood", delta: 1 }], "anxious")],
      }),
      r("nelson", "cold", "push", "nelson", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1)],
        miss: "nelson",
      }),
      r("no_blame", "warm", "deal", "promise", {
        tell: ["promise", "trust:+1"],
        effects: [
          trustOf(who, 1),
          remember("k_jel_risk"),
          promise(who, "p_jel_no_blame", 30, {
            keep: chose("gbr_w_jutland", "no_blame"),
          }),
        ],
      }),
      bye("later", "warm"),
    ),
    count: plain(
      r("understood", "frank", "deal", null, {
        effects: [remember("k_jel_risk")],
      }),
      r("chu_knows", "cold", "ask", "first_lord"),
      bye("end"),
    ),
    nelson: plain(r("go_on", "frank", "ask", "count"), bye("end")),
    promise: plain(bye("end", "warm")),
    first_lord: node(moods("anxious"), bye("end")),
  }),

  talk(
    "gbr_t_jellicoe_scapa",
    "gbr_jellicoe",
    Y14_ON,
    all(war, since(6, "15a")),
    {
      open: node(
        line(
          ["first_year", { kind: "chapter", max: 10 }],
          ["anxious", moody(who, "anxious")],
          ["weary", moody(who, "weary")],
          "base",
        ),
        r("afraid", "frank", "ask", "fear", {
          reacts: [ifCold("shut", [])],
        }),
        r("give_nets", "warm", "deal", "thanks", {
          tell: ["money:-1", "trust:+1"],
          effects: [gauge("money", -1), trustOf(who, 1), force("sea", 1)],
        }),
        r("nets", "cold", "ask", "nets"),
        bye("later", "warm"),
      ),
      nets: plain(
        r("fear_too", "warm", "ask", "fear"),
        r("blame", "frank", "ask", "before"),
        bye("end"),
      ),
      fear: node(line(["straight", candid(who)], "base"), bye("end", "warm")),
      thanks: plain(bye("end", "warm")),
      shut: plain(bye("end")),
      before: plain(bye("end")),
    },
    { cd: 8 },
  ),

  talk(
    "gbr_t_jellicoe_jutland",
    "gbr_jellicoe",
    WAR,
    all(during("16a", "16b"), { kind: "seen", scene: "gbr_w_jutland" }),
    {
      open: node(
        moods("anxious", "weary"),
        r("fleet_held", "flatter", "deal", "evening", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_jel_jutland")],
        }),
        r("that_evening", "warm", "ask", "evening"),
        r("why_turned", "cold", "push", "turned", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "turned",
        }),
        bye("later", "warm"),
      ),
      evening: plain(
        r("understood", "frank", "deal", null, {
          effects: [remember("k_jel_jutland")],
        }),
        r("beatty", "cold", "ask", "beatty"),
        bye("end", "warm"),
      ),
      turned: plain(r("forgive", "warm", "ask", "evening"), bye("end")),
      beatty: node(moods("anxious", "weary"), bye("end", "warm")),
    },
  ),

  talk(
    "gbr_t_jellicoe_sealord",
    "gbr_jellicoe",
    WAR,
    all(war, during("16b"), not(holds("sea_lord", "gbr_jellicoe"))),
    {
      open: node(
        line(
          ["after_jutland", memory("k_jel_jutland")],
          ["anxious", moody(who, "anxious")],
          ["weary", moody(who, "weary")],
          "base",
        ),
        r("come", "warm", "deal", "terms", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_jel_sealord")],
        }),
        r("fleet_who", "cold", "ask", "fleet"),
        r("must", "threat", "push", "fleet", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1), remember("k_jel_sealord")],
          miss: "fleet",
        }),
        bye("later", "warm"),
      ),
      fleet: plain(
        r("still_come", "frank", "deal", "terms", {
          effects: [remember("k_jel_sealord")],
        }),
        r("ask_admiralty", "cold", "ask", "admiralty"),
        bye("end"),
      ),
      terms: plain(bye("end", "warm")),
      admiralty: plain(bye("end")),
    },
  ),

  talk(
    "gbr_t_jellicoe_figures",
    "gbr_jellicoe",
    WAR,
    all(war, during("17a", "17b"), holds("sea_lord", "gbr_jellicoe")),
    {
      open: node(
        moods("anxious", "weary"),
        r("hankey_says", "frank", "push", "table", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        r("no_shame", "warm", "deal", "table", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
        r("which_ships", "cold", "ask", "table", {
          reacts: [ifCold("shut", [])],
        }),
        bye("later", "warm"),
      ),
      table: plain(
        r("recount", "frank", "deal", null, {
          effects: [
            remember("k_jel_figures"),
            doWorld({ do: "reveal", id: "gbr_sailings_count" }),
          ],
        }),
        r("who_counted", "cold", "ask", "young"),
        bye("end"),
      ),
      shut: plain(bye("end")),
      young: plain(
        r("protect", "warm", "deal", null, {
          tell: ["trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_jel_figures"),
            doWorld({ do: "reveal", id: "gbr_sailings_count" }),
          ],
        }),
        bye("end"),
      ),
    },
  ),

  talk(
    "gbr_t_jellicoe_tired",
    "gbr_jellicoe",
    WAR,
    all(during("17a", "17b"), holds("sea_lord", "gbr_jellicoe")),
    {
      open: node(
        line(
          ["worn", { kind: "health", who, max: 1 }],
          ["anxious", moody(who, "anxious")],
          ["weary", moody(who, "weary")],
          "base",
        ),
        r("rest_soon", "warm", "deal", "rest", {
          tell: ["promise", "trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_jel_tired"),
            promise(who, "p_jel_rest", 6, {
              keep: chose("gbr_w_jellicoe_out", "rest_him"),
            }),
          ],
        }),
        r("sleep", "warm", "ask", "sleep"),
        r("delegate", "frank", "push", "desk", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "desk",
        }),
        bye("later", "warm"),
      ),
      sleep: node(
        line(["straight", candid(who)], "base"),
        r("noted", "frank", "deal", null, {
          effects: [remember("k_jel_tired")],
        }),
        bye("end", "warm"),
      ),
      desk: plain(
        r("sorry", "warm", "ask", "sleep"),
        r("first_lord", "cold", "ask", "first_lord"),
        bye("end"),
      ),
      rest: plain(bye("end", "warm")),
      first_lord: plain(bye("end")),
    },
  ),

  // ---- Visits ----
  visit("gbr_v_french_home", "gbr_french", WAR, all(war, during("15a")), 6, {
    open: node(
      moods("anxious", "arrogant"),
      r("how_many", "cold", "ask", "number", {
        reacts: [ifMood("rage", [], "arrogant")],
      }),
      r("kitchener", "warm", "ask", "rage"),
      r("quiet_word", "frank", "deal", "deal", {
        tell: ["trust:+1"],
        effects: [trustOf(who, 1)],
      }),
      bye("later", "warm"),
    ),
    number: plain(
      r("keep", "frank", "deal", null, {
        effects: [remember("k_french_shells")],
      }),
      bye("end"),
    ),
    rage: plain(r("the_number", "cold", "ask", "number"), bye("end")),
    deal: plain(
      r("understood", "cold", "deal", null, {
        effects: [remember("k_french_shells")],
      }),
      r("attack", "cold", "ask", "attack"),
      bye("end", "warm"),
    ),
    attack: plain(bye("end")),
  }),

  visit(
    "gbr_v_fisher_storm",
    "gbr_fisher",
    WAR,
    all(during("15a"), holds("sea_lord", "gbr_fisher")),
    6,
    {
      open: node(
        moods("arrogant", "cunning"),
        r("sit_down", "threat", "push", "threat", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "threat",
        }),
        r("flatter", "flatter", "ask", "baltic", {
          tell: ["trust:+1"],
          gain: [trustOf(who, 1)],
          reacts: [ifMood("threat", [], "cunning")],
        }),
        r("say_it", "frank", "ask", "baltic"),
        bye("later", "warm"),
      ),
      baltic: plain(
        r("hear_you", "frank", "deal", null, {
          tell: ["promise"],
          effects: [
            remember("k_fisher_no"),
            promise(who, "p_fisher_heard", 4, {
              keep: chose("gbr_w_naval_only", "hear_fisher"),
            }),
          ],
        }),
        r("noted", "cold", "ask", null, {
          effects: [remember("k_fisher_no")],
        }),
        r("churchill", "warm", "ask", "love"),
      ),
      threat: plain(r("calm", "warm", "ask", "baltic"), bye("end")),
      love: node(
        moods("cunning"),
        r("hear_too", "frank", "deal", null, {
          effects: [remember("k_fisher_no")],
        }),
      ),
    },
  ),

  visit(
    "gbr_v_wilson_gossip",
    "gbr_wilson",
    WAR,
    all(war, during("15b", "17b")),
    5,
    {
      open: node(
        line(
          ["after_rob", holds("chief_of_staff", "gbr_robertson")],
          ["cunning", moody(who, "cunning")],
          "base",
        ),
        r("what_want", "frank", "deal", "place", {
          tell: ["promise"],
          effects: [
            remember("k_wilson_versailles"),
            promise(who, "p_wilson_place", 30, {
              keep: chose("gbr_w_versailles", "replace_wilson"),
            }),
          ],
        }),
        r("who_told", "cold", "ask", "dinner"),
        r("arm_off", "threat", "push", "laugh", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "laugh",
        }),
        bye("later", "warm"),
      ),
      dinner: plain(
        r("understood", "cold", "ask", null, {
          effects: [
            doWorld({ do: "reveal", id: "gbr_wilson_leaks" }),
            remember("k_wilson_versailles"),
          ],
        }),
        r("foch_too", "cold", "ask", "france"),
        bye("end"),
      ),
      laugh: plain(r("again", "cold", "ask", "dinner"), bye("end")),
      place: plain(bye("end", "warm")),
      france: plain(bye("end")),
    },
    { cd: 10 },
  ),

  visit("gbr_v_hall_codes", "gbr_hall", Y14_ON, all(war, since(8, "15a")), 5, {
    open: node(
      moods("cunning", "cold"),
      r("what_room", "cold", "ask", "room"),
      r("who_knows", "frank", "ask", "who", {
        reacts: [ifMood("room", [], "cold")],
      }),
      r("use_it", "warm", "deal", "use", {
        tell: ["trust:+1"],
        effects: [trustOf(who, 1), remember("k_hall_room40")],
      }),
      bye("later", "warm"),
    ),
    room: plain(
      r("key", "frank", "deal", null, {
        effects: [remember("k_hall_room40")],
      }),
      r("fo", "frank", "ask", "fo"),
      bye("end"),
    ),
    who: plain(
      r("key", "frank", "deal", null, {
        effects: [remember("k_hall_room40")],
      }),
      bye("end"),
    ),
    use: plain(bye("end", "warm")),
    fo: plain(bye("end")),
  }),

  visit(
    "gbr_v_hall_wire",
    "gbr_hall",
    WAR,
    all(
      war,
      during("16b", "17a"),
      memory("k_hall_room40"),
      not(fighting("USA")),
    ),
    7,
    {
      open: node(
        moods("cunning", "cold"),
        r("whose_wire", "cold", "ask", "wire", {
          reacts: [ifMood("wait", [], "cunning")],
        }),
        r("foreign_office", "warm", "deal", "wait", {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
        r("show_it", "frank", "ask", "wire"),
        bye("later", "warm"),
      ),
      wire: plain(
        r("how_out", "frank", "deal", null, {
          effects: [remember("k_hall_wire")],
        }),
        r("page", "frank", "ask", "page"),
        bye("end"),
      ),
      wait: plain(r("now", "frank", "ask", "wire"), bye("end")),
      page: plain(
        r("how_out", "frank", "deal", null, {
          effects: [remember("k_hall_wire")],
        }),
        bye("end"),
      ),
    },
  ),
];
