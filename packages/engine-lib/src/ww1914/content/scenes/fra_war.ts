// France: the war 1915-18 (war orders in engine/ww1914/Tables GW_WAR_ORDERS). Text in resources/ww1914/ko/FRA.war.json.
// Lane W2 (ww166-format.md).
import type {
  GwGauge,
  GwInstitution,
  GwOffice,
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
  decide,
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
import { period } from "./period";

/**
 * France, the war share (plan ww166-plan-fra-scenes.md §6, §9 W2, §10 W2,
 * §12 nos. 4-6): the `fra_w_` scenes, the big scenes of Verdun, Joffre's fall
 * and the mutinies, the summoned talks of Joffre, Gallieni, Foch and Pétain,
 * and five visits. The President commands nobody: he signs, asks, presides
 * and pardons. No option shows its result before the pick (`tell` is empty).
 * The mutinies' big scene only ever lessens: leave, food, rest, commutation,
 * silence, a visit. Data only; the text is in resources/ww1914/ko/FRA.war.json.
 */

const NATION: GwScene["nation"] = ["FRA"];
const who = role("who");
const cos = role("cos");

const CRISIS_ON: GwStage[] = ["crisis", "y1914", "war"];
const Y14_ON: GwStage[] = ["y1914", "war"];

const during = period;

// ---- Conditions ----

const war: GwCond = { kind: "at_war", tag: "DEU" };
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const chapters = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
/** Joffre's free hand, while he still holds it. */
const joffreFree: GwCond = all(
  flag("f_joffre_free"),
  not(flag("f_joffre_fallen")),
);
const fallen = flag("f_joffre_fallen");
const tiger = flag("f_pm_clemenceau");
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const trench = (min: number): GwCond => ({
  kind: "trench",
  theatre: "west",
  min,
});
const fighting = (tag: GwTag): GwCond =>
  world({ is: "entered", tag, side: "entente" });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const open = (theatre: GwTheatre): GwCond => world({ is: "open", theatre });
/** The enemy came on in the west, whatever came of it. */
const westHit: GwCond = world({
  is: "battle",
  theatre: "west",
  of: ["break", "advance", "stalemate", "repelled"],
  by: "foe",
});
/** The line gave in the west. */
const westBack: GwCond = world({
  is: "battle",
  theatre: "west",
  of: ["break", "advance"],
  by: "foe",
});
const westFwd: GwCond = world({
  is: "battle",
  theatre: "west",
  of: ["break", "advance"],
  by: "seat",
});
const refusalsKnown: GwCond = world({ is: "known", id: "fra_army_refusals" });

// ---- Effects ----

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const army = (d: number) => inst("army", d);
const chamber = (d: number) => inst("chamber", d);
const senate = (d: number) => inst("senate", d);
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const force = (theatre: GwTheatre, delta: number): GwEffect =>
  doWorld({ do: "force", tag: "FRA", theatre, delta });
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const command = (person: string): GwEffect =>
  doWorld({ do: "command", who: { person }, theatre: "west" });
const appoint = (person: string, office: GwOffice): GwEffect => ({
  kind: "appoint",
  who: byName(person),
  office,
});
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const signChief: GwEffect[] = [doWorld({ do: "sign_chief" })];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const o = (
  id: string,
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };

/** A desk scene: France's, dealt once unless it says otherwise. */
const scene = (
  s: Omit<GwScene, "nation" | "once"> & { once?: boolean },
): GwScene => ({
  nation: NATION,
  ...s,
  once: s.once ?? true,
});

/** A record card: a date, a place, a number. No option, no price. */
const record = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  stamp: GwScene["stamp"],
  more: Partial<GwScene> = {},
): GwScene =>
  scene({
    id,
    kind: "report",
    stage: Y14_ON,
    when,
    cast: {},
    salience: 6,
    tags: ["war"],
    stamp,
    source: "staff",
    variants,
    ...more,
  });

// ---- Big scenes ----

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
  speaker: string,
  says: GwVariant[],
  replies: GwReply[],
  fallback?: string,
): GwNode => ({
  who: speaker,
  says,
  replies,
  ...(fallback === undefined ? {} : { fallback }),
});
const go = (
  id: string,
  next: string | null,
  stance: GwStance = "frank",
): GwReply => ({ id, stance, kind: "ask", tell: [], effects: [], next });
const closedDecide = (
  id: string,
  effects: GwEffect[],
  when: GwCond,
): GwReply => ({ ...decide(id, null, effects), when });

const big = (
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  speaker: string,
  nodes: Record<string, GwNode>,
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["war", "tension_up"],
  stage: Y14_ON,
  when,
  cast,
  who: speaker,
  start: "n1",
  variants: [v("base")],
  nodes,
  after: [{ scene: `${id}_quiet` }],
  ...more,
});

/** The card laid when a big scene ends: a few lines, no chrome. */
const quiet = (id: string, variants: GwVariant[]): GwScene => ({
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

// ---- Talks ----

interface ReplyMore {
  effects?: GwEffect[];
  when?: GwCond;
  reacts?: GwReact[];
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
  tell: [],
  effects: more.effects ?? [],
  next,
  ...(more.when === undefined ? {} : { when: more.when }),
  ...(more.reacts === undefined ? {} : { reacts: more.reacts }),
  ...(more.miss === undefined ? {} : { miss: more.miss }),
});
const bye = (id = "end", stance: GwStance = "cold"): GwReply =>
  r(id, stance, "leave", null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([v("base")], ...replies);
const moods = (...of: GwTemperament[]): GwVariant[] => [
  ...of.map((t) => v(t, moody(who, t))),
  v("base"),
];
const ifMood = (
  next: string | null,
  effects: GwEffect[],
  ...of: GwTemperament[]
): GwReact => ({ when: moody(who, ...of), next, effects });

interface TalkMore {
  /** Chapters before the topic can come again; a once topic has none. */
  cd?: number;
  /** A visit: the desk deals it at this salience. */
  visit?: number;
}

const conversation = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  nodes: Record<string, GwNode>,
  more: TalkMore = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  stage,
  when,
  cast: { who: { person } },
  tags: ["people"],
  who: "who",
  variants: [v("base")],
  start: "open",
  nodes,
  ...(more.cd === undefined ? { once: true } : { cooldown: more.cd }),
  ...(more.visit === undefined
    ? { salience: 1, summon: true }
    : { salience: more.visit }),
});

interface Topic {
  /** The person's temperament that colours the first line. */
  mood: GwTemperament;
  /** What the talk gives once it lands: a key, a promise, a find. */
  give: GwEffect[];
  /** The temperament a push only angers. */
  bristles?: GwTemperament;
  /** The `more` node has a straight answer for a candid person. */
  straight?: boolean;
}

/**
 * The usual shape: ask, push, deal, leave. Asking or pushing leads to the
 * matter (`more`), dealing to an offer (`offer`); both can give what the talk
 * holds. A push that lands badly shuts the door.
 */
const topicNodes = (t: Topic): Record<string, GwNode> => ({
  open: node(
    moods(t.mood),
    r("ask", "frank", "ask", "more"),
    r("push", "cold", "push", "more", {
      effects: [trustOf(who, -1)],
      miss: "shut",
      ...(t.bristles === undefined
        ? {}
        : { reacts: [ifMood("shut", [], t.bristles)] }),
    }),
    r("deal", "warm", "deal", "offer"),
    bye("later", "warm"),
  ),
  more: node(
    t.straight === true ? [v("straight", candid(who)), v("base")] : [v("base")],
    r("take", "frank", "deal", null, { effects: t.give }),
    bye("end"),
  ),
  offer: plain(
    r("agree", "warm", "deal", null, {
      effects: [...t.give, trustOf(who, 1)],
    }),
    bye("end"),
  ),
  shut: plain(bye("end")),
});

const talk = (
  id: string,
  person: string,
  stage: GwStage[],
  when: GwCond,
  t: Topic,
  more: TalkMore = {},
): GwScene => conversation(id, person, stage, when, topicNodes(t), more);

/** A find: the secret is revealed if this game has it. */
const reveal = (
  id: "fra_offensive_doctrine" | "fra_army_refusals",
): GwEffect => ({
  kind: "maybe",
  when: { kind: "secret", id },
  then: [doWorld({ do: "reveal", id })],
});

// ---- The desk ----

const DESK: GwScene[] = [
  // The campaign's accounts, every three chapters: the same form on purpose.
  scene({
    id: "fra_w_ledger",
    kind: "ledger",
    stage: Y14_ON,
    when: war,
    cast: { cos: holder("chief_of_staff") },
    salience: 9,
    tags: ["war"],
    once: false,
    cooldown: 3,
    variants: [
      v("won", all(world({ is: "score", min: 40 }), during("18b"))),
      v("free", joffreFree),
      v("tiger", tiger),
      v("thin", gaugeAt("shells", 1)),
      v("trench", trench(2)),
      v("first", world({ is: "war_age", max: 2 })),
      v("base"),
    ],
    fallback: "sign_chief",
    options: [
      o("sign_chief", [...signChief, trustOf(cos, 1)]),
      {
        ...o(
          "return_chief",
          [trustOf(cos, -1), army(-1), remember("m_fra_returned_plan")],
          not(joffreFree),
        ),
        screen: "fronts",
      },
    ],
  }),

  // ---- 1915: where to strike ----
  scene({
    id: "fra_w_plan_1915",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 11 }),
      trench(2),
    ),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("orient_paper", memory("k_gal_salonika")),
      v("thin", gaugeAt("shells", 1)),
      v("free", joffreFree),
      v("base"),
    ],
    fallback: "west",
    options: [
      o("west", [force("west", 1), army(1), setFlag("f_west_1915")]),
      o(
        "wait_shells",
        [
          gauge("shells", 1),
          army(-1),
          trustOf(cos, -1),
          remember("m_fra_waited_shells"),
          reason("fra_w_waited_shells"),
        ],
        memory("k_tho_shells"),
      ),
      o(
        "orient",
        [
          force("balkan", 1),
          force("west", -1),
          army(-1),
          trustOf(cos, -1),
          setFlag("f_orient_chosen"),
          reason("fra_w_orient_chosen"),
        ],
        memory("k_gal_salonika"),
      ),
    ],
  }),

  scene({
    id: "fra_w_deputies_front",
    kind: "dispute",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 11 }),
      joffreFree,
    ),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("promised", memory("k_jof_deputies")),
      v("ferry", memory("k_fer_front")),
      v("base"),
    ],
    fallback: "back_joffre",
    options: [
      o("back_joffre", [army(1), chamber(-1), trustOf(cos, 1)]),
      o(
        "commissions_visit",
        [
          chamber(2),
          senate(1),
          army(-1),
          trustOf(cos, -1),
          setFlag("f_commissions_front"),
          reason("fra_w_commissions_front"),
        ],
        memory("k_fer_front"),
      ),
      o("president_goes", [
        chamber(1),
        trustOf(cos, -1),
        remember("m_fra_president_front"),
        reason("fra_w_president_front"),
      ]),
    ],
  }),

  scene({
    id: "fra_w_dardanelles",
    kind: "proposal",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 11 }),
      open("straits"),
    ),
    cast: { navy: holder("navy") },
    salience: 7,
    tags: ["war"],
    variants: [v("orient", flag("f_orient_chosen")), v("base")],
    fallback: "squadron",
    options: [
      o("squadron", [nation("GBR", 1), force("straits", 1)]),
      o("add_division", [
        nation("GBR", 2),
        force("straits", 1),
        force("west", -1),
        army(-1),
        men(-1),
        setFlag("f_fra_straits_division"),
      ]),
      o("refuse", [nation("GBR", -1), army(1)]),
    ],
  }),

  // The first cloud: Germany has the heavy gas, its army is in Belgium, and
  // France's war is some months old.
  record(
    "fra_w_gas",
    all(
      war,
      world({ is: "tech", id: "gas_heavy", tag: "DEU" }),
      world({ is: "front", theatre: "west", from: "liege" }),
      world({ is: "in_war", min: 4 }),
    ),
    [v("british", fighting("GBR")), v("base")],
    "confirmed",
  ),

  scene({
    id: "fra_w_champagne",
    kind: "crisis",
    stage: Y14_ON,
    when: all(war, world({ is: "war_months", own: true, min: 11, max: 17 })),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("guns", memory("k_pet_guns")),
      v("thin", gaugeAt("shells", 1)),
      v("base"),
    ],
    fallback: "approve",
    options: [
      o("approve", [
        army(1),
        gauge("shells", -1),
        force("west", 1),
        men(-4),
        setFlag("f_champagne"),
      ]),
      o(
        "smaller",
        [
          force("west", 1),
          men(-2),
          army(-1),
          reason("fra_w_champagne_smaller"),
        ],
        memory("k_pet_guns"),
      ),
      o("delay", [
        army(-2),
        trustOf(cos, -1),
        nation("RUS", -1),
        remember("m_fra_champagne_delayed"),
      ]),
    ],
  }),

  scene({
    id: "fra_w_salonika",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 11, max: 23 }),
      world({ is: "entered", tag: "BGR", side: "central" }),
    ),
    cast: { war: holder("war"), foreign: holder("foreign") },
    salience: 8,
    tags: ["war", "foreign"],
    variants: [
      v("serbia_falls", world({ is: "front", theatre: "balkan", from: "nis" })),
      v("orient_said", flag("f_orient_chosen")),
      v("base"),
    ],
    fallback: "send_sarrail",
    options: [
      o("send_sarrail", [
        force("balkan", 1),
        army(-1),
        nation("SRB", 1),
        nation("GBR", -1),
        setFlag("f_orient_army"),
        reason("fra_w_orient_army"),
      ]),
      o("small_force", [nation("SRB", 1), men(-1), force("balkan", 1)]),
      o(
        "no_orient",
        [army(1), nation("SRB", -2), trustOf(byName("fra_joffre"), 1)],
        memory("k_jof_west"),
      ),
    ],
  }),

  scene({
    id: "fra_w_sarrail_case",
    kind: "audience",
    stage: Y14_ON,
    when: all(war, world({ is: "war_months", own: true, min: 11, max: 17 }), {
      kind: "person_active",
      person: "fra_sarrail",
    }),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["people", "home"],
    variants: [
      v("orient", flag("f_orient_army")),
      v("friends", memory("k_sar_friends")),
      v("base"),
    ],
    fallback: "accept",
    options: [
      o("accept", [army(1), chamber(-1), trustOf(byName("fra_sarrail"), -1)]),
      o(
        "give_orient",
        [
          chamber(1),
          army(-1),
          trustOf(byName("fra_sarrail"), 1),
          setFlag("f_sarrail_orient"),
          reason("fra_w_sarrail_orient"),
        ],
        memory("k_sar_friends"),
      ),
      o("inquiry", [chamber(1), army(-1), trustOf(cos, -1)]),
    ],
  }),

  scene({
    id: "fra_w_verdun_warning",
    kind: "report",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 11, max: 23 }),
      not(seen("fra_big_verdun")),
    ),
    cast: {},
    salience: 7,
    tags: ["war"],
    stamp: "unconfirmed",
    variants: [v("gallieni", memory("k_gal_verdun")), v("base")],
  }),

  scene({
    id: "fra_w_noria",
    kind: "proposal",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 17, max: 29 }),
      seen("fra_big_verdun"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 6,
    tags: ["war"],
    variants: [v("petain", flag("f_petain_verdun")), v("base")],
    fallback: "rotate",
    options: [
      o("rotate", [
        army(-1),
        trustOf(cos, -1),
        gauge("morale", 1),
        trustOf(byName("fra_petain"), 1),
        setFlag("f_noria"),
      ]),
      o("hold_divisions", [army(1), trustOf(cos, 1), gauge("morale", -1)]),
    ],
  }),

  scene({
    id: "fra_w_somme",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 23, max: 29 }),
      fighting("GBR"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 8,
    tags: ["war", "foreign"],
    variants: [
      v("verdun", seen("fra_big_verdun")),
      v("fallen", fallen),
      v("base"),
    ],
    fallback: "joint_attack",
    options: [
      o("joint_attack", [nation("GBR", 1), men(-3), force("west", 1)]),
      o("less_french", [nation("GBR", -1), men(-1)]),
      o("ask_british_more", [nation("GBR", -2), army(1), trustOf(cos, 1)]),
    ],
  }),

  record(
    "fra_w_douaumont",
    // Verdun held, and a French attack in the west went forward.
    all(war, seen("fra_big_verdun"), flag("f_verdun_held"), westFwd),
    [v("petain", flag("f_petain_verdun")), v("base")],
    "confirmed",
  ),

  // ---- The successor: comes as soon as Joffre is out ----
  scene({
    id: "fra_w_successor",
    kind: "audience",
    stage: Y14_ON,
    when: all(war, fallen),
    cast: { pm: holder("chancellor") },
    salience: 8,
    essential: true,
    tags: ["people", "war"],
    variants: [
      v("both", all(memory("k_pet_doubt"), memory("k_foc_rest"))),
      v("doubt", memory("k_pet_doubt")),
      v("base"),
    ],
    fallback: "nivelle",
    options: [
      o("nivelle", [
        appoint("fra_nivelle", "chief_of_staff"),
        trustOf(byName("fra_nivelle"), 1),
        chamber(1),
        reason("fra_w_nivelle_in"),
      ]),
      o(
        "petain",
        [
          appoint("fra_petain", "chief_of_staff"),
          trustOf(byName("fra_petain"), 1),
          army(1),
          reason("fra_w_petain_in"),
        ],
        memory("k_pet_doubt"),
      ),
      o(
        "foch",
        [
          appoint("fra_foch", "chief_of_staff"),
          trustOf(byName("fra_foch"), 1),
          army(1),
          chamber(-1),
          reason("fra_w_foch_in"),
        ],
        memory("k_foc_rest"),
      ),
      o("castelnau", [
        appoint("fra_castelnau", "chief_of_staff"),
        trustOf(byName("fra_castelnau"), 1),
        army(1),
        chamber(-2),
        reason("fra_w_castelnau_in"),
      ]),
    ],
  }),

  // ---- 1917 ----
  scene({
    id: "fra_w_calais",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 35 }),
      holds("chief_of_staff", "fra_nivelle"),
      fighting("GBR"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["foreign", "war"],
    variants: [
      v("cold", { kind: "trust", tag: "GBR", max: -1 }),
      v("plan", memory("k_niv_plan")),
      v("base"),
    ],
    fallback: "sign",
    options: [
      o("sign", [nation("GBR", -2), trustOf(cos, 1), setFlag("f_calais")]),
      o("one_battle", [
        nation("GBR", -1),
        trustOf(cos, 1),
        setFlag("f_calais"),
      ]),
      o("drop", [nation("GBR", 1), trustOf(cos, -1)]),
    ],
  }),

  scene({
    id: "fra_w_nivelle_doubts",
    kind: "crisis",
    stage: Y14_ON,
    when: all(war, holds("chief_of_staff", "fra_nivelle")),
    cast: { cos: holder("chief_of_staff"), war: holder("war") },
    salience: 9,
    essential: true,
    tags: ["war", "tension_up"],
    variants: [
      v("refusals", refusalsKnown),
      v("calais", flag("f_calais")),
      v("plan", memory("k_niv_plan")),
      v("base"),
    ],
    fallback: "let_him_go",
    options: [
      o("let_him_go", [
        army(1),
        trustOf(cos, 1),
        men(-6),
        setFlag("f_nivelle_goes"),
      ]),
      o(
        "cancel",
        [
          appoint("fra_petain", "chief_of_staff"),
          trustOf(byName("fra_nivelle"), -2),
          army(-2),
          setFlag("f_nivelle_cancelled"),
          reason("fra_w_nivelle_cancelled"),
        ],
        memory("k_pet_doubt"),
      ),
      o(
        "limit",
        [
          trustOf(cos, -1),
          men(-3),
          setFlag("f_nivelle_goes"),
          setFlag("f_nivelle_limited"),
          reason("fra_w_nivelle_limited"),
        ],
        memory("k_pai_doubt"),
      ),
    ],
  }),

  record(
    "fra_w_chemin_record",
    all(
      war,
      world({ is: "war_months", own: true, min: 32, max: 41 }),
      flag("f_nivelle_goes"),
    ),
    [v("limited", flag("f_nivelle_limited")), v("base")],
    "confirmed",
    { salience: 7 },
  ),

  scene({
    id: "fra_w_mutiny_record",
    kind: "report",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 47 }),
      seen("fra_big_mutiny"),
    ),
    cast: {},
    salience: 7,
    tags: ["war"],
    stamp: "estimate",
    source: "staff",
    variants: [
      v("known", refusalsKnown),
      v("pardons", chose("fra_big_mutiny", "review_pardons")),
      v("base"),
    ],
  }),

  scene({
    id: "fra_w_americans",
    kind: "proposal",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 35, max: 47 }),
      fighting("USA"),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["foreign", "war"],
    variants: [
      v("russia_out", world({ is: "out", tag: "RUS" })),
      v("petain", holds("chief_of_staff", "fra_petain")),
      v("base"),
    ],
    fallback: "own_army",
    options: [
      o("own_army", [nation("USA", 2)]),
      o("ask_amalgam", [nation("USA", -2), army(1), men(2)]),
      o("quiet_sector", [nation("USA", 1), trustOf(cos, 1)]),
    ],
  }),

  scene({
    id: "fra_w_caporetto",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 35, max: 47 }),
      fighting("ITA"),
      any(
        world({ is: "front", theatre: "italy", from: "piave" }),
        world({ is: "battle", theatre: "italy", of: ["break"], by: "foe" }),
      ),
    ),
    cast: { cos: holder("chief_of_staff") },
    salience: 7,
    tags: ["war", "foreign"],
    variants: [v("thin", world({ is: "manpower", max: 50 })), v("base")],
    fallback: "send",
    options: [
      o("send", [nation("ITA", 2), force("italy", 1), force("west", -1)]),
      o("guns_only", [nation("ITA", 1), gauge("shells", -1)]),
      o("keep", [nation("ITA", -2), army(1)]),
    ],
  }),

  scene({
    id: "fra_w_supreme_council",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 35, max: 47 }),
      fighting("GBR"),
    ),
    cast: { pm: holder("chancellor") },
    salience: 7,
    tags: ["foreign"],
    variants: [v("tiger", tiger), v("base")],
    fallback: "join",
    options: [
      o("join", [nation("GBR", 1), army(-1), setFlag("f_supreme_council")]),
      o("delay", [nation("GBR", -1), army(1)]),
    ],
  }),

  // ---- 1918 ----
  scene({
    id: "fra_w_paris_gun",
    kind: "report",
    stage: Y14_ON,
    // The long gun: the Germans in the north with the guns of the storm.
    when: all(
      war,
      world({ is: "front", theatre: "west", from: "hindenburg" }),
      any(
        world({ is: "tech", id: "predicted_fire", tag: "DEU" }),
        world({ is: "era", of: ["storm"] }),
      ),
    ),
    cast: {},
    salience: 7,
    tags: ["home", "tension_up"],
    stamp: "confirmed",
    source: "press",
    variants: [v("bordeaux", flag("f_gov_bordeaux")), v("base")],
  }),

  scene({
    id: "fra_w_doullens",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 41, max: 47 }),
      any(westBack, world({ is: "out", tag: "RUS" })),
    ),
    cast: { cos: holder("chief_of_staff"), pm: holder("chancellor") },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      v("unity", memory("k_foc_unity")),
      v("paris", memory("k_pet_paris")),
      v("tiger", tiger),
      v("base"),
    ],
    fallback: "joint_board",
    options: [
      o(
        "foch",
        [
          command("fra_foch"),
          trustOf(byName("fra_foch"), 1),
          nation("GBR", 1),
          setFlag("f_foch_over_all"),
          reason("fra_w_foch_over_all"),
        ],
        any(memory("k_foc_unity"), tiger),
      ),
      o("joint_board", [nation("GBR", 1), trustOf(cos, 1)]),
      o("wait", [army(1), nation("GBR", -1)]),
    ],
  }),

  scene({
    id: "fra_w_second_marne",
    kind: "crisis",
    stage: Y14_ON,
    when: all(
      war,
      world({ is: "war_months", own: true, min: 41 }),
      seen("fra_w_doullens"),
      world({ is: "front", theatre: "west", from: "aisne" }),
    ),
    cast: { cos: holder("chief_of_staff"), pm: holder("chancellor") },
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("attack", memory("k_foc_attack")),
      v("bordeaux", flag("f_gov_bordeaux")),
      v("base"),
    ],
    fallback: "stay_paris",
    options: [
      o("stay_paris", [gauge("morale", 1), chamber(1)]),
      o("prepare_move", [
        gauge("morale", -1),
        chamber(-1),
        remember("m_fra_move_ready"),
      ]),
      o(
        "counterattack",
        [
          men(-3),
          army(1),
          setFlag("f_marne_counter"),
          reason("fra_w_marne_counter"),
        ],
        memory("k_foc_attack"),
      ),
    ],
  }),

  record(
    "fra_w_hundred_days",
    // The last advance: the line goes forward once the Americans are in or
    // the storm's year has come.
    all(
      war,
      westFwd,
      world({ is: "front", theatre: "west", from: "hindenburg" }),
      any(
        world({ is: "entered", tag: "USA", side: "entente" }),
        world({ is: "era", of: ["storm"] }),
      ),
    ),
    [v("foch", flag("f_foch_over_all")), v("base")],
    "confirmed",
    { salience: 7 },
  ),

  record(
    "fra_w_colonial_front",
    all(war, world({ is: "war_months", own: true, min: 17 })),
    [v("verdun", seen("fra_big_verdun")), v("base")],
    "confirmed",
    { salience: 5, once: false, cooldown: 8 },
  ),
];

// ---- 고비: Verdun, Joffre's fall, the mutinies ----

const b = [v("base")];

const BIG: GwScene[] = [
  big(
    "fra_big_verdun",
    all(
      war,
      world({ is: "war_months", own: true, min: 17, max: 23 }),
      any(westHit, trench(2)),
    ),
    { cos: holder("chief_of_staff"), war: holder("war") },
    "cos",
    {
      n1: at(
        "cos",
        [v("free", joffreFree), v("base")],
        [go("ask_forts", "n2"), go("ask_men", "n2", "cold")],
      ),
      n2: alone(
        [v("castelnau", memory("k_cas_verdun")), v("base")],
        [decide("listen", "n3")],
      ),
      n3: at(
        "war",
        [v("warned", memory("k_gal_verdun")), v("base")],
        [
          decide("hold", null, [
            army(1),
            men(-4),
            setFlag("f_verdun_held"),
            reason("fra_w_verdun_held"),
          ]),
          closedDecide(
            "give_petain",
            [
              command("fra_petain"),
              trustOf(byName("fra_petain"), 1),
              men(-2),
              setFlag("f_verdun_held"),
              setFlag("f_petain_verdun"),
              reason("fra_w_petain_verdun"),
            ],
            memory("k_cas_verdun"),
          ),
          decide("fall_back", null, [
            army(-2),
            gauge("morale", -1),
            chamber(-2),
            setFlag("f_verdun_left"),
            reason("fra_w_verdun_left"),
          ]),
        ],
        "hold",
      ),
    },
  ),
  quiet("fra_big_verdun_quiet", [
    v("petain", flag("f_petain_verdun")),
    v("left", flag("f_verdun_left")),
    v("base"),
  ]),

  big(
    "fra_big_joffre",
    all(
      war,
      world({ is: "war_months", own: true, min: 23, max: 35 }),
      not(fallen),
      any(
        flag("f_secret_committee"),
        world({
          is: "battle",
          theatre: "west",
          of: ["stalemate", "repelled"],
        }),
      ),
    ),
    { cos: holder("chief_of_staff"), pm: holder("chancellor") },
    "pm",
    {
      n1: alone([v("free", joffreFree), v("base")], [decide("read", "n2")]),
      n2: at(
        "pm",
        [v("secret", flag("f_secret_committee")), v("base")],
        [go("ask_who", "n3"), go("ask_chamber", "n3", "cold")],
      ),
      n3: at(
        "cos",
        [v("lunch", memory("k_jof_mind")), v("base")],
        [
          decide("marshal_out", null, [
            setFlag("f_joffre_fallen"),
            unflag("f_joffre_free"),
            schedule("fra_w_successor", 1),
            chamber(2),
            army(-1),
            trustOf(cos, -1),
            reason("fra_w_joffre_marshal"),
          ]),
          decide("adviser_title", null, [
            setFlag("f_joffre_fallen"),
            unflag("f_joffre_free"),
            schedule("fra_w_successor", 1),
            chamber(1),
            trustOf(cos, -2),
            reason("fra_w_joffre_adviser"),
          ]),
          decide("keep_joffre", null, [
            chamber(-2),
            army(1),
            trustOf(cos, 1),
            doWorld({ do: "gov_heat", id: "fra_chamber", delta: 2 }),
            remember("m_fra_kept_joffre"),
            reason("fra_w_joffre_kept"),
          ]),
        ],
        "marshal_out",
      ),
    },
    { tags: ["people", "tension_up"] },
  ),
  quiet("fra_big_joffre_quiet", [
    v("kept", chose("fra_big_joffre", "keep_joffre")),
    v("base"),
  ]),

  big(
    "fra_big_mutiny",
    all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 41 }),
      any({ kind: "inst", inst: "army", max: -2 }, seen("fra_w_chemin_record")),
    ),
    { cos: holder("chief_of_staff"), war: holder("war") },
    "cos",
    {
      n1: alone(
        [v("known", refusalsKnown), v("base")],
        [decide("open_files", "n2")],
      ),
      n2: at("cos", b, [go("ask_why", "n3"), go("ask_where", "n3", "cold")]),
      n3: at(
        "war",
        b,
        [
          decide("petain_cure", null, [
            {
              kind: "maybe",
              when: not(holds("chief_of_staff", "fra_petain")),
              then: [appoint("fra_petain", "chief_of_staff")],
            },
            army(1),
            gauge("morale", 1),
            setFlag("f_mutiny_eased"),
            reason("fra_w_mutiny_eased"),
          ]),
          closedDecide(
            "review_pardons",
            [
              gauge("morale", 1),
              army(-1),
              chamber(1),
              setFlag("f_pardons_reviewed"),
              reason("fra_w_pardons_reviewed"),
            ],
            memory("k_pet_letters"),
          ),
          decide("silence_press", null, [
            { kind: "censor", delta: 1 },
            chamber(-1),
            setFlag("f_mutiny_silenced"),
            reason("fra_w_mutiny_silenced"),
          ]),
          decide("visit_lines", null, [
            gauge("morale", 1),
            authority(-5),
            remember("m_fra_visited_lines"),
            reason("fra_w_lines_visited"),
          ]),
        ],
        "petain_cure",
      ),
    },
  ),
  quiet("fra_big_mutiny_quiet", [
    v("pardons", chose("fra_big_mutiny", "review_pardons")),
    v("lines", chose("fra_big_mutiny", "visit_lines")),
    v("base"),
  ]),
];

// ---- Talks: Joffre, Gallieni, Foch, Pétain ----

const TALKS: GwScene[] = [
  // Joffre
  talk(
    "fra_t_joffre_cover",
    "fra_joffre",
    CRISIS_ON,
    all(crisis, world({ is: "chain", short: false, min: 3, max: 5 })),
    { mood: "stubborn", give: [remember("k_jof_cover")] },
  ),
  talk("fra_t_joffre_plan", "fra_joffre", CRISIS_ON, chapters(0, 5), {
    mood: "cold",
    give: [reveal("fra_offensive_doctrine"), remember("k_jof_plan")],
    straight: true,
  }),
  talk(
    "fra_t_joffre_lunch",
    "fra_joffre",
    Y14_ON,
    all(
      war,
      all(
        world({ is: "war_months", own: true, min: 2 }),
        world({ is: "war_months", own: true, max: 29 }),
      ),
      not(fallen),
    ),
    { mood: "stubborn", give: [remember("k_jof_mind")], straight: true },
    { cd: 8 },
  ),
  talk(
    "fra_t_joffre_west",
    "fra_joffre",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 17 }),
      not(fallen),
    ),
    { mood: "stubborn", give: [remember("k_jof_west")], bristles: "stubborn" },
  ),
  conversation(
    "fra_t_joffre_deputies",
    "fra_joffre",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 23 }),
      joffreFree,
    ),
    {
      open: node(
        moods("cold"),
        r("ask", "frank", "ask", "more"),
        r("push", "threat", "push", "more", {
          effects: [trustOf(who, -1)],
          miss: "shut",
          reacts: [ifMood("shut", [], "stubborn")],
        }),
        r("deal", "warm", "deal", "offer"),
        bye("later", "warm"),
      ),
      more: plain(
        r("take", "frank", "deal", null, {
          effects: [remember("k_jof_deputies")],
        }),
        bye("end"),
      ),
      offer: plain(
        r("agree", "warm", "deal", null, {
          effects: [
            remember("k_jof_deputies"),
            trustOf(who, 1),
            promise(who, "p_jof_visits", 4, {
              keep: chose("fra_w_deputies_front", "back_joffre"),
            }),
          ],
        }),
        bye("end"),
      ),
      shut: plain(bye("end")),
    },
  ),
  talk(
    "fra_t_joffre_end",
    "fra_joffre",
    Y14_ON,
    all(fallen, world({ is: "war_months", min: 23 })),
    { mood: "cold", give: [remember("k_jof_after")] },
  ),

  // Gallieni
  talk(
    "fra_t_gallieni_paris",
    "fra_gallieni",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, max: 2 })),
    { mood: "cold", give: [remember("k_gal_paris")] },
  ),
  talk(
    "fra_t_gallieni_taxis",
    "fra_gallieni",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 1, max: 3 }),
      seen("fra_big_marne"),
    ),
    { mood: "cold", give: [remember("k_gal_marne")], straight: true },
  ),
  talk(
    "fra_t_gallieni_salonika",
    "fra_gallieni",
    Y14_ON,
    all(
      war,
      all(
        world({ is: "war_months", own: true, min: 4 }),
        world({ is: "war_months", own: true, max: 11 }),
      ),
    ),
    { mood: "stubborn", give: [remember("k_gal_salonika")] },
  ),
  talk(
    "fra_t_gallieni_joffre",
    "fra_gallieni",
    Y14_ON,
    all(
      world({ is: "war_months", min: 11, max: 23 }),
      holds("war", "fra_gallieni"),
    ),
    { mood: "cold", give: [remember("k_gal_verdun")], bristles: "stubborn" },
  ),
  conversation(
    "fra_t_gallieni_health",
    "fra_gallieni",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 11, max: 23 })),
    {
      open: node(
        moods("stubborn"),
        r("ask", "warm", "ask", "more"),
        r("push", "frank", "push", "more", {
          miss: "shut",
          reacts: [ifMood("shut", [], "stubborn")],
        }),
        r("deal", "warm", "deal", "offer"),
        bye("later", "warm"),
      ),
      more: node(
        [
          v("ill", { kind: "health", who, max: 1 }),
          v("straight", candid(who)),
          v("base"),
        ],
        r("take", "warm", "deal", null, {
          effects: [remember("k_gal_health")],
        }),
        bye("end", "warm"),
      ),
      offer: plain(
        r("agree", "warm", "deal", null, {
          effects: [trustOf(who, 1), remember("k_gal_health")],
        }),
        bye("end", "warm"),
      ),
      shut: plain(bye("end", "warm")),
    },
    { cd: 6 },
  ),
  talk(
    "fra_t_gallieni_minister",
    "fra_gallieni",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 5, max: 17 }),
      not(holds("war", "fra_gallieni")),
    ),
    { mood: "cold", give: [remember("k_gal_minister")], bristles: "stubborn" },
  ),

  // Foch
  talk(
    "fra_t_foch_north",
    "fra_foch",
    Y14_ON,
    all(
      war,
      all(
        world({ is: "war_months", own: true, min: 2 }),
        world({ is: "war_months", own: true, max: 11 }),
      ),
    ),
    {
      mood: "arrogant",
      give: [remember("k_foc_north")],
      straight: true,
    },
  ),
  talk(
    "fra_t_foch_attack",
    "fra_foch",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 5, max: 47 })),
    { mood: "arrogant", give: [remember("k_foc_attack")] },
    { cd: 8 },
  ),
  talk(
    "fra_t_foch_rest",
    "fra_foch",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 23, max: 35 }),
      not(holds("chief_of_staff", "fra_foch")),
    ),
    { mood: "stubborn", give: [remember("k_foc_rest")], bristles: "arrogant" },
  ),
  talk(
    "fra_t_foch_unity",
    "fra_foch",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 35, max: 47 })),
    {
      mood: "arrogant",
      give: [remember("k_foc_unity")],
    },
  ),
  talk(
    "fra_t_foch_rhine",
    "fra_foch",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 47 })),
    {
      mood: "stubborn",
      give: [remember("k_foc_rhine")],
    },
  ),
  conversation(
    "fra_t_foch_son",
    "fra_foch",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 1, max: 3 })),
    {
      open: node(
        moods("stubborn"),
        r("ask", "warm", "ask", "more"),
        r("push", "frank", "push", "work", { miss: "work" }),
        r("deal", "warm", "deal", "work"),
        bye("later", "warm"),
      ),
      more: plain(
        r("take", "warm", "deal", null, { effects: [trustOf(who, 1)] }),
        bye("end", "warm"),
      ),
      work: plain(bye("end", "warm")),
    },
  ),

  // Pétain
  talk(
    "fra_t_petain_guns",
    "fra_petain",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 5, max: 17 })),
    { mood: "cold", give: [remember("k_pet_guns")] },
  ),
  talk(
    "fra_t_petain_verdun",
    "fra_petain",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 17, max: 29 }),
      seen("fra_big_verdun"),
    ),
    { mood: "cold", give: [remember("k_pet_road")] },
  ),
  talk(
    "fra_t_petain_doubt",
    "fra_petain",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 23, max: 35 })),
    { mood: "weary", give: [remember("k_pet_doubt")], straight: true },
  ),
  talk(
    "fra_t_petain_letters",
    "fra_petain",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 41 }),
      any(seen("fra_w_chemin_record"), { kind: "inst", inst: "army", max: -1 }),
    ),
    { mood: "cold", give: [remember("k_pet_letters")] },
  ),
  talk(
    "fra_t_petain_wait",
    "fra_petain",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 35, max: 47 })),
    {
      mood: "weary",
      give: [reveal("fra_army_refusals"), remember("k_pet_wait")],
      straight: true,
    },
    { cd: 8 },
  ),
  talk(
    "fra_t_petain_retreat",
    "fra_petain",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 41, max: 47 }),
      westBack,
    ),
    { mood: "weary", give: [remember("k_pet_paris")], bristles: "cold" },
  ),
];

// ---- Visits ----

const VISITS: GwScene[] = [
  talk(
    "fra_v_castelnau_sons",
    "fra_castelnau",
    Y14_ON,
    all(
      war,
      all(
        world({ is: "war_months", own: true, min: 1 }),
        world({ is: "war_months", own: true, max: 23 }),
      ),
    ),
    { mood: "stubborn", give: [remember("k_cas_verdun")] },
    { visit: 6 },
  ),
  talk(
    "fra_v_sarrail_friends",
    "fra_sarrail",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 5, max: 17 })),
    {
      mood: "cunning",
      give: [remember("k_sar_friends")],
      bristles: "arrogant",
    },
    { visit: 6 },
  ),
  talk(
    "fra_v_mangin_force",
    "fra_mangin",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 5, max: 35 })),
    { mood: "arrogant", give: [remember("k_man_force")] },
    { visit: 5 },
  ),
  talk(
    "fra_v_nivelle_plan",
    "fra_nivelle",
    Y14_ON,
    all(war, world({ is: "war_months", own: true, min: 23, max: 35 })),
    { mood: "arrogant", give: [remember("k_niv_plan")], bristles: "arrogant" },
    { visit: 6 },
  ),
  talk(
    "fra_v_painleve_doubt",
    "fra_painleve",
    Y14_ON,
    all(
      war,
      world({ is: "war_months", own: true, min: 29, max: 35 }),
      holds("chief_of_staff", "fra_nivelle"),
    ),
    { mood: "anxious", give: [remember("k_pai_doubt")], straight: true },
    { visit: 7 },
  ),
];

export const FRA_WAR_SCENES: readonly GwScene[] = [
  ...DESK,
  ...BIG,
  ...TALKS,
  ...VISITS,
];
