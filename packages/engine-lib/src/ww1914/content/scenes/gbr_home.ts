import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwStage,
  GwTemperament,
  GwTopic,
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
  keepPromise,
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

/**
 * Britain, the share at home: the `gbr_h_` scenes, the summoned talks of Lloyd
 * George, Bonar Law, Henderson and Venetia Stanley, and five visits. Data only;
 * the text is in resources/ww1914/ko/GBR.home.json. Plan: ww135-plan-gbr.md
 * sections 7, 9, 10, 11.
 *
 * Stand-ins, each one definition to swap when the world lane lands:
 * `during`/`since` (`{ is: "date" }`), `body` (the institutions `cabinet`,
 * `commons`, `opposition`, `irish`), `oppHigh` (`inst: "opposition"`),
 * `votes` (`{ is: "votes" }`), `vote` (`{ do: "vote" }`), `revolution`
 * (`{ is: "regime", tag: "RUS" }`).
 */

const NATION: GwScene["nation"] = ["GBR"];
const who = role("who");

const CRISIS: GwStage[] = ["crisis"];
const CRISIS_ON: GwStage[] = ["crisis", "y1914", "war"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const WAR: GwStage[] = ["war"];

const HALVES = [
  "15a",
  "15b",
  "16a",
  "16b",
  "17a",
  "17b",
  "18a",
  "18b",
] as const;
type Half = (typeof HALVES)[number];
const monthly: GwCond = { kind: "span", max: 30 };
const bimonthly: GwCond = { kind: "span", min: 31 };
const fullEnd = (h: Half) => 16 + 6 * HALVES.indexOf(h);
const standardEnd = (h: Half) => 13 + 3 * HALVES.indexOf(h);

/** The plan's half-years on the `full` and `standard` calendars alike. */
const during = (from: Half, to: Half = from): GwCond => {
  const i = HALVES.indexOf(from);
  return any(
    all(monthly, { kind: "chapter", min: 11 + 6 * i, max: fullEnd(to) }),
    all(bimonthly, { kind: "chapter", min: 11 + 3 * i, max: standardEnd(to) }),
  );
};

/** From a chapter of 1914 up to the end of a half-year. */
const since = (chapter: number, to: Half): GwCond =>
  any(
    all(monthly, { kind: "chapter", min: chapter, max: fullEnd(to) }),
    all(bimonthly, { kind: "chapter", min: chapter, max: standardEnd(to) }),
  );
const chapter = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});

const war: GwCond = { kind: "at_war", tag: "DEU" };
/** The chair has gone to Lloyd George: he is the player now. */
const lg = flag("f_pm_lg");
const notLg = not(lg);
const co = flag("f_coalition");
/** Home Rule alive, without suspension. */
const hr = flag("f_home_rule_lives");
const notHr = not(hr);
const labourIn = any(flag("f_gbr_labour_in"), lg);
/** The opposition presses. Becomes `inst: "opposition"`, min 2. */
const oppHigh = any(
  flag("f_gbr_opposition_up_1"),
  flag("f_gbr_opposition_up_2"),
);
/** Russia has had its revolution. Becomes world `regime`. */
const revolution = any(world({ is: "out", tag: "RUS" }), during("17a", "18a"));
/** The House grows short. Becomes `inst: "commons"`, max -1. */
const commonsLow = flag("f_gbr_commons_down_1");
const manLow: GwCond = world({ is: "manpower", max: 55 });
const westBack: GwCond = world({ is: "front", theatre: "west", from: "somme" });
const bigLoss: GwCond = world({ is: "casualties", min: 300 });
const unrestAt = (min: number): GwCond => world({ is: "unrest", min });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const gaugeAt = (gauge: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge,
  max,
});
const pressAt = (topic: GwTopic, min: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
});
const empty = (office: GwOffice): GwCond => ({ kind: "office_empty", office });
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const trusts = (w: GwWho, min: number): GwCond => ({
  kind: "person_trust",
  who: w,
  min,
});
const greyWaits: GwCond = {
  kind: "promise",
  who: byName("gbr_grey"),
  key: "p_grey_rest",
  kept: false,
  broken: false,
};
const broke = (key: string): GwCond => memory(`broke_${key}`);
/** The table would carry this. Becomes world `votes`, min 0. */
const votes = (issue: string): GwCond =>
  any(
    memory(`v_${issue}`),
    flag("f_gbr_cabinet_up_1"),
    flag("f_gbr_cabinet_up_2"),
  );

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const pressure = (topic: GwTopic, delta: number): GwEffect => ({
  kind: "pressure",
  topic,
  delta,
});
const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const pride = (w: { role: string }, delta: number): GwEffect => ({
  kind: "pride",
  who: w,
  delta,
});
const appoint = (person: string, office: GwOffice): GwEffect => ({
  kind: "appoint",
  who: byName(person),
  office,
});
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const authority = (delta: number): GwEffect =>
  doWorld({ do: "authority", delta });
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
/** What was said to this person on an issue: the table counts it. */
const voteOf = (issue: string, weight = 1): GwEffect => ({
  kind: "remember",
  key: `v_${issue}`,
  who,
  weight,
});
const inst = (name: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: name,
  delta,
});

/**
 * The table, the House, the opposition and the Irish: no institutions on this
 * branch, so each move writes a flag and the tell shows the real word.
 */
const body = (name: string, delta: number): GwEffect =>
  setFlag(`f_gbr_${name}_${delta < 0 ? "down" : "up"}_${Math.abs(delta)}`);
const cabinet = (d: number) => body("cabinet", d);
const commons = (d: number) => body("commons", d);
const opposition = (d: number) => body("opposition", d);
const irish = (d: number) => body("irish", d);
/** The table votes. Becomes world `vote`. */
const vote = (issue: string): GwEffect => setFlag(`f_gbr_voted_${issue}`);

/** `gbr_h_vacant`'s list: the office, the first name, the second name. */
const VACANCIES: readonly (readonly [GwOffice, string, string])[] = [
  ["war", "gbr_lloyd_george", "gbr_milner"],
  ["munitions", "gbr_montagu", "gbr_carson"],
  ["navy", "gbr_balfour", "gbr_carson"],
  ["finance", "gbr_mckenna", "gbr_bonar_law"],
  ["foreign", "gbr_balfour", "gbr_haldane"],
  ["interior", "gbr_simon", "gbr_haldane"],
];
const promise_open_king: GwCond = {
  kind: "promise",
  who: byName("gbr_george_v"),
  key: "p_king_warn",
  kept: false,
  broken: false,
};
const anyEmpty = any(...VACANCIES.map(([o]) => empty(o)));
/** Fills the first office on the list that is empty, and no other. */
const fillVacant = (pick: (row: (typeof VACANCIES)[number]) => string) =>
  VACANCIES.map((row, i) =>
    maybe(
      all(empty(row[0]), ...VACANCIES.slice(0, i).map(([o]) => not(empty(o)))),
      appoint(pick(row), row[0]),
    ),
  );

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
  once: s.once ?? s.cooldown === undefined,
});

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
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const mood = (...of: GwTemperament[]): GwCond => moody(who, ...of);
const trust = (min: number): GwCond => trusts(who, min);
/** The door is shut: trust at the floor of what a talk can carry. */
const sour: GwCond = { kind: "person_trust", who, max: -2 };
const when_ = (
  c: GwCond,
  next: string | null,
  ...effects: GwEffect[]
): GwReact => ({ when: c, next, effects });

interface TalkMore {
  /** Chapters before the topic can come again; a once topic has none. */
  cd?: number;
  intro?: GwVariant[];
  /** The person is whoever a broken promise sends back. */
  called?: boolean;
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
  cast: { who: more.called === true ? { called: true as const } : { person } },
  tags: ["people" as const],
  who: "who",
  variants: more.intro ?? [v("base")],
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
  more: TalkMore & { scheduledOnly?: boolean } = {},
): GwScene => ({
  ...talkBase(id, person, stage, when, nodes, more),
  salience,
  ...(more.scheduledOnly === true ? { scheduledOnly: true } : {}),
});

export const GBR_HOME_SCENES: readonly GwScene[] = [
  scene({
    id: "gbr_h_shells",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("15a"), gaugeAt("shells", 1)),
    cast: { sec: holder("war"), finance: holder("finance") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("aubers", world({ is: "battle", theatre: "west", of: ["repelled"] })),
      v("known", memory("k_french_shells")),
      v("warned", memory("k_kit_shells")),
      v("dry", gaugeAt("shells", 0)),
      v("base"),
    ],
    fallback: "deny",
    options: [
      o(
        "deny",
        ["opposition:+1"],
        [opposition(1), remember("m_shells_denied"), reason("shells_denied")],
      ),
      o(
        "kitchener_answers",
        ["shells:+1", "trust:-1"],
        [
          gauge("shells", 1),
          trustOf(byName("gbr_kitchener"), -1),
          keepPromise(byName("gbr_kitchener"), "p_kit_tell"),
        ],
        memory("k_kit_shells"),
      ),
      o(
        "new_ministry",
        ["shells:+1", "cabinet:-1"],
        [
          gauge("shells", 1),
          cabinet(-1),
          setFlag("f_gbr_munitions_ministry"),
          appoint("gbr_lloyd_george", "munitions"),
          appoint("gbr_mckenna", "finance"),
          trustOf(byName("gbr_kitchener"), -1),
        ],
        memory("k_lg_munitions"),
      ),
      o(
        "union_deal",
        ["shells:+1", "money:-1"],
        [
          gauge("shells", 1),
          gauge("money", -1),
          setFlag("f_gbr_union_deal"),
          trustOf(byName("gbr_henderson"), 1),
        ],
        memory("k_hen_truce"),
      ),
      o(
        "known_leak",
        ["opposition:-1", "trust:-1"],
        [
          opposition(-1),
          trustOf(byName("gbr_french"), -2),
          reason("leak_named"),
        ],
        memory("k_french_shells"),
      ),
      o(
        "ask_soldiers",
        ["morale:+1", "opposition:-1"],
        [gauge("morale", 1), opposition(-1)],
        memory("k_ven_wards"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_coalition",
    kind: "crisis",
    stage: WAR,
    when: all(
      war,
      notLg,
      during("15a", "15b"),
      any(oppHigh, seen("gbr_w_fisher_out"), chose("gbr_h_shells")),
    ),
    cast: {
      fm: holder("foreign"),
      finance: holder("finance"),
      law: { person: "gbr_bonar_law" },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("fisher", seen("gbr_w_fisher_out")),
      v("truce", memory("k_law_truce")),
      v("shells", chose("gbr_h_shells")),
      v(
        "lost",
        world({ is: "battle", theatre: "west", of: ["repelled", "stalemate"] }),
      ),
      v("base"),
    ],
    fallback: "coalition",
    options: [
      o(
        "coalition",
        ["opposition:-2", "cabinet:-1", "commons:+1"],
        [setFlag("f_coalition"), opposition(-2), cabinet(-1), commons(1)],
      ),
      o(
        "own_terms",
        ["opposition:-2", "authority:+1"],
        [
          setFlag("f_coalition"),
          opposition(-2),
          authority(1),
          remember("m_coalition_terms"),
        ],
        memory("k_law_coalition"),
      ),
      o(
        "fight_commons",
        ["opposition:+1", "cabinet:+1", "commons:-1"],
        [
          opposition(1),
          cabinet(1),
          commons(-1),
          setFlag("f_gbr_fought_commons"),
        ],
      ),
      o(
        "keep_truce",
        ["opposition:-1"],
        [opposition(-1), setFlag("f_gbr_truce_kept")],
        memory("k_law_truce"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_seats",
    kind: "proposal",
    stage: WAR,
    when: all(co, notLg, during("15a", "15b")),
    cast: { fm: holder("foreign"), law: { person: "gbr_bonar_law" } },
    salience: 8,
    tags: ["people"],
    variants: [
      v("terms", chose("gbr_h_coalition", "own_terms")),
      v("shells_done", chose("gbr_h_shells", "new_ministry")),
      v("carson_asks", memory("k_car_office")),
      v("base"),
    ],
    fallback: "give_churchill",
    options: [
      o(
        "give_churchill",
        ["opposition:-1", "trust:-1"],
        [
          opposition(-1),
          appoint("gbr_balfour", "navy"),
          trustOf(byName("gbr_churchill"), -2),
          remember("m_churchill_out"),
        ],
      ),
      o(
        "law_exchequer",
        ["cabinet:-1", "money:+1"],
        [
          cabinet(-1),
          gauge("money", 1),
          appoint("gbr_bonar_law", "finance"),
          trustOf(byName("gbr_mckenna"), -2),
        ],
      ),
      o(
        "carson_in",
        ["irish:-2", "opposition:-1"],
        [
          irish(-2),
          opposition(-1),
          setFlag("f_gbr_carson_in"),
          trustOf(byName("gbr_carson"), 1),
          trustOf(byName("gbr_redmond"), -1),
          pressure("ireland", 1),
        ],
        memory("k_car_office"),
      ),
      o(
        "labour_in",
        ["order:+1", "opposition:-1"],
        [
          gauge("order", 1),
          setFlag("f_gbr_labour_in"),
          trustOf(byName("gbr_henderson"), 1),
        ],
        memory("k_hen_cabinet"),
      ),
      o(
        "balfour_admiralty",
        ["cabinet:+1"],
        [
          cabinet(1),
          appoint("gbr_balfour", "navy"),
          remember("m_churchill_stays_table"),
        ],
        memory("k_bal_admiralty"),
      ),
      o(
        "montagu_munitions",
        ["shells:+1", "cabinet:+1"],
        [
          gauge("shells", 1),
          cabinet(1),
          appoint("gbr_montagu", "munitions"),
          trustOf(byName("gbr_lloyd_george"), -1),
        ],
        all(memory("k_montagu_help"), empty("munitions")),
      ),
    ],
  }),
  scene({
    id: "gbr_h_conscription",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("15b", "16a"), any(manLow, during("16a"))),
    cast: { sec: holder("war"), home: holder("interior") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("simon_door", memory("k_simon_stays")),
      v("lg_threat", all(notLg, flag("f_gbr_munitions_ministry"))),
      v("irish_first", pressAt("ireland", 3)),
      v("base"),
    ],
    fallback: "voluntary",
    options: [
      o(
        "voluntary",
        ["cabinet:+1", "manpower:-5"],
        [
          setFlag("f_gbr_voluntary"),
          cabinet(1),
          men(-5),
          remember("m_voluntary_kept"),
        ],
      ),
      o(
        "single_men",
        ["manpower:+10", "cabinet:-1", "order:-1", "vote"],
        [
          setFlag("f_gbr_conscript"),
          men(10),
          cabinet(-1),
          gauge("order", -1),
          vote("conscription"),
          trustOf(byName("gbr_simon"), -2),
        ],
        votes("conscription"),
      ),
      o(
        "all_men",
        ["manpower:+20", "cabinet:-2", "order:-1", "vote"],
        [
          setFlag("f_gbr_conscript"),
          men(20),
          cabinet(-2),
          gauge("order", -1),
          vote("conscription"),
          trustOf(byName("gbr_henderson"), 1),
        ],
        all(memory("k_hen_cons"), votes("conscription")),
      ),
      o(
        "money_first",
        ["money:+1", "manpower:+5"],
        [gauge("money", 1), men(5), setFlag("f_gbr_army_capped")],
        memory("k_mck_army"),
      ),
      o(
        "keep_simon",
        ["manpower:+10", "cabinet:+1", "order:-1", "vote"],
        [
          setFlag("f_gbr_conscript"),
          men(10),
          cabinet(1),
          gauge("order", -1),
          vote("conscription"),
          trustOf(byName("gbr_simon"), 1),
        ],
        memory("k_simon_stays"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_easter",
    kind: "crisis",
    stage: WAR,
    when: all(war, notHr, during("16a"), pressAt("ireland", 3)),
    cast: { ireland: holder("ireland"), sec: holder("war") },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("known_ship", memory("k_hall_room40")),
      v("warned", memory("k_birrell_dublin")),
      v("badge", broke("p_redmond_badge")),
      v("base"),
    ],
    fallback: "send_troops",
    options: [
      o(
        "send_troops",
        ["irish:-2", "order:-1"],
        [
          irish(-2),
          gauge("order", -1),
          pressure("ireland", 2),
          setFlag("f_gbr_rising"),
          men(-3),
        ],
      ),
      o(
        "castle_ready",
        ["irish:-1"],
        [
          irish(-1),
          pressure("ireland", 1),
          setFlag("f_gbr_rising"),
          maybe(memory("k_hall_room40"), pressure("ireland", -1)),
        ],
        memory("k_birrell_dublin"),
      ),
      o(
        "ask_redmond",
        ["irish:+1", "order:-1"],
        [
          irish(1),
          gauge("order", -1),
          pressure("ireland", 1),
          setFlag("f_gbr_rising"),
          trustOf(byName("gbr_redmond"), 1),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_ireland_talks",
    kind: "proposal",
    stage: WAR,
    when: all(war, notHr, during("16a", "17b")),
    cast: { ireland: holder("ireland") },
    salience: 7,
    tags: ["home"],
    variants: [
      v("after_easter", all(seen("gbr_h_easter"), notLg)),
      v("broken", broke("p_redmond_badge")),
      v("base"),
    ],
    fallback: "hold",
    options: [
      o("hold", ["irish:-1"], [irish(-1), pressure("ireland", 1)]),
      o(
        "lloyd_george_terms",
        ["irish:+1", "opposition:+1"],
        [
          irish(1),
          opposition(1),
          setFlag("f_ireland_settled"),
          pressure("ireland", -2),
          remember("m_two_sided_terms"),
        ],
        memory("k_car_lastword"),
      ),
      o(
        "convention",
        ["irish:+1"],
        [
          irish(1),
          pressure("ireland", -1),
          setFlag("f_gbr_convention"),
          maybe(memory("k_car_lastword"), setFlag("f_ireland_settled")),
        ],
        memory("k_red_convention"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_committee",
    kind: "crisis",
    stage: WAR,
    when: all(war, notLg, during("16b"), any(oppHigh, co)),
    cast: {
      lg: { person: "gbr_lloyd_george" },
      law: { person: "gbr_bonar_law" },
      carson: { person: "gbr_carson" },
    },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [
      v("known", memory("k_law_december")),
      v("press", memory("k_north_press")),
      v("raymond", seen("gbr_h_raymond")),
      v("base"),
    ],
    fallback: "refuse",
    options: [
      o(
        "refuse",
        ["cabinet:+1", "temp"],
        [cabinet(1), vote("committee"), remember("m_committee_refused")],
      ),
      o(
        "chair_it",
        ["cabinet:+1", "authority:-1", "vote"],
        [
          cabinet(1),
          authority(-1),
          vote("committee"),
          setFlag("f_gbr_chair_committee"),
          setFlag("f_gbr_minutes"),
        ],
        memory("k_han_minutes"),
      ),
      o(
        "take_it",
        ["authority:-2", "opposition:-1"],
        [
          authority(-2),
          opposition(-1),
          setFlag("f_gbr_committee_lg"),
          trustOf(byName("gbr_lloyd_george"), 1),
        ],
        any(memory("k_lg_committee"), memory("k_law_december")),
      ),
      o(
        "fight_back",
        ["cabinet:-2", "opposition:+2", "vote"],
        [
          cabinet(-2),
          opposition(2),
          vote("committee"),
          { kind: "dismiss", who: byName("gbr_lloyd_george") },
          setFlag("f_gbr_fought_lg"),
        ],
        all(memory("k_mck_stand"), votes("committee")),
      ),
      o(
        "press_deal",
        ["opposition:-1", "authority:-1"],
        [
          opposition(-1),
          authority(-1),
          setFlag("f_gbr_press_deal"),
          trustOf(byName("gbr_northcliffe"), 1),
        ],
        memory("k_north_press"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_food",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17a", "18a"), gaugeAt("bread", 1)),
    cast: { home: holder("interior") },
    salience: 7,
    tags: ["home"],
    variants: [v("lg_seat", lg), v("queues", unrestAt(1)), v("base")],
    fallback: "price_cap",
    options: [
      o(
        "price_cap",
        ["money:-1", "order:+1"],
        [gauge("money", -1), gauge("order", 1), setFlag("f_gbr_bread_subsidy")],
      ),
      o(
        "ration_cards",
        ["bread:+1", "order:+1", "money:-1"],
        [
          gauge("bread", 1),
          gauge("order", 1),
          gauge("money", -1),
          setFlag("f_gbr_rationing"),
        ],
      ),
      o(
        "leave_market",
        ["order:-1", "money:+1"],
        [gauge("order", -1), gauge("money", 1), remember("m_food_left")],
      ),
    ],
  }),
  scene({
    id: "gbr_h_coupon",
    kind: "proposal",
    stage: WAR,
    when: all(during("18b"), world({ is: "war_age", min: 1 })),
    cast: { law: { person: "gbr_bonar_law" } },
    salience: 7,
    tags: ["home"],
    variants: [v("lg_seat", lg), v("co_seat", co), v("base")],
    fallback: "coalition_ticket",
    options: [
      o(
        "coalition_ticket",
        ["opposition:-2", "commons:+2"],
        [opposition(-2), commons(2), setFlag("f_gbr_coupon")],
      ),
      o(
        "party_alone",
        ["cabinet:-2", "commons:-1"],
        [cabinet(-2), commons(-1), setFlag("f_gbr_party_alone")],
      ),
      o(
        "wait",
        ["authority:-1", "commons:-1"],
        [authority(-1), commons(-1), setFlag("f_gbr_election_waits")],
      ),
    ],
  }),
  talk(
    "gbr_t_lg_budget",
    "gbr_lloyd_george",
    CRISIS,
    all(chapter(0, 2), notLg),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "plan", {
          reacts: [
            when_(sour, "shut", reason("lg_slipped")),
            when_(trust(1), "plan", remember("k_lg_budget")),
          ],
        }),
        r("press", "cold", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cunning"), "plan", remember("k_lg_budget"))],
        }),
        r("stand", "warm", "deal", "plan", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_lg_budget"), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null),
      ),
      plan: node(
        [v("base")],
        r("fine", "warm", "leave", null),
        r("why", "frank", "ask", "moved"),
      ),
      moved: node(
        [v("base")],
        r("thanks", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
        r("enough", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_lg_belgium",
    "gbr_lloyd_george",
    CRISIS,
    all(chapter(3, 5), notLg, { kind: "crisis", topic: "balkan" }),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "cond", {
          reacts: [
            when_(sour, "shut", reason("lg_slipped")),
            when_(not(trust(0)), "hedge"),
          ],
        }),
        r("push", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cunning"), "cond", remember("k_lg_belgium"))],
        }),
        r("flatter", "flatter", "ask", "cond", {
          reacts: [when_(mood("cunning"), "hedge", reason("lg_slipped"))],
        }),
        r("deal", "warm", "deal", "cond", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), voteOf("entry", 1), remember("k_lg_belgium")],
        }),
        r("later", "cold", "leave", null),
      ),
      hedge: node(
        [v("base")],
        r("again", "frank", "ask", "cond", {
          reacts: [when_(mood("cunning"), null, reason("lg_slipped"))],
        }),
        r("bye", "cold", "leave", null),
      ),
      cond: node(
        [v("base")],
        r("noted", "cold", "ask", "count", {
          effects: [remember("k_lg_belgium")],
        }),
        r("hold", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_lg_belgium")],
        }),
      ),
      count: node(
        [v("base")],
        r("end", "warm", "leave", null, { effects: [voteOf("entry", 1)] }),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_lg_city",
    "gbr_lloyd_george",
    CRISIS,
    all(chapter(4, 5), notLg, { kind: "temp", min: 6 }),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "plan", { reacts: [when_(sour, "shut")] }),
        r("press", "cold", "push", "plan", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("arrogant"), "shut")],
        }),
        r("flatter", "flatter", "deal", "plan", {
          tell: ["money:-1"],
          effects: [gauge("money", -1), remember("k_lg_city")],
        }),
        r("later", "cold", "leave", null),
      ),
      plan: node(
        [v("base")],
        r("fine", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_lg_city")],
        }),
        r("hold", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_lg_balkans",
    "gbr_lloyd_george",
    Y14_ON,
    all(war, notLg, since(10, "15a")),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "detail", { reacts: [when_(sour, "shut")] }),
        r("push", "cold", "push", "detail", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("arrogant"), "shut", reason("lg_slipped"))],
        }),
        r("deal", "warm", "deal", "detail", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_lg_balkans")],
        }),
        r("later", "cold", "leave", null),
      ),
      detail: node(
        [v("base")],
        r("keep", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_lg_balkans")],
        }),
        r("doubt", "frank", "ask", "doubt"),
      ),
      doubt: node(
        [v("base")],
        r("note", "cold", "leave", null, {
          effects: [remember("k_lg_balkans")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_lg_munitions",
    "gbr_lloyd_george",
    WAR,
    all(war, notLg, during("15a")),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "plan", {
          reacts: [when_(sour, "shut"), when_(mood("cunning"), "hedge")],
        }),
        r("flatter", "flatter", "deal", "plan", {
          tell: ["cabinet:-1"],
          effects: [
            cabinet(-1),
            remember("k_lg_munitions"),
            trustOf(byName("gbr_kitchener"), -1),
          ],
        }),
        r("push", "cold", "push", "plan", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("arrogant"), "shut")],
        }),
        r("later", "warm", "leave", null),
      ),
      hedge: node(
        [v("base")],
        r("again", "frank", "ask", "plan"),
        r("end", "cold", "leave", null),
      ),
      plan: node(
        [v("base")],
        r("yes", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_lg_munitions")],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_lg_ambition",
    "gbr_lloyd_george",
    WAR,
    all(war, notLg, during("15b", "16b")),
    {
      open: node(
        [
          v("cunning", mood("cunning")),
          v("arrogant", mood("arrogant")),
          v("base"),
        ],
        r("ask", "frank", "ask", "who", {
          reacts: [
            when_(sour, "shut", reason("lg_slipped")),
            when_(mood("cunning"), "evade", reason("lg_slipped")),
          ],
        }),
        r("push", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(trust(2), "who", remember("m_lg_meets"))],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["authority:-1"],
          effects: [authority(-1), remember("k_lg_committee")],
        }),
        r("later", "warm", "leave", null),
      ),
      evade: node(
        [v("base")],
        r("again", "cold", "ask", "who", {
          reacts: [when_(mood("cunning"), null)],
        }),
        r("end", "cold", "leave", null),
      ),
      who: node(
        [
          v("competent", {
            kind: "competence",
            who,
            field: "politics",
            min: 3,
          }),
          v("base"),
        ],
        r("hear", "frank", "ask", "terms", {
          effects: [remember("m_lg_meets")],
        }),
        r("enough", "cold", "leave", null, {
          effects: [remember("m_lg_meets")],
        }),
      ),
      terms: node(
        [v("base")],
        r("mark", "cold", "leave", null, {
          effects: [remember("k_lg_committee")],
        }),
        r("bye", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_lg_committee")],
        }),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
    { cd: 8 },
  ),
  talk(
    "gbr_t_law_letter",
    "gbr_bonar_law",
    CRISIS,
    all(chapter(4, 5), { kind: "temp", min: 5 }),
    {
      open: node(
        [v("cold", mood("cold")), v("weary", mood("weary")), v("base")],
        r("ask", "cold", "ask", "terms", {
          reacts: [when_(sour, "shut", reason("law_shut"))],
        }),
        r("warn", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("weary"), "terms", remember("k_law_letter"))],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["opposition:-1"],
          effects: [opposition(-1), remember("k_law_letter"), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("take", "frank", "leave", null, {
          effects: [remember("k_law_letter")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_law_truce",
    "gbr_bonar_law",
    Y14_ON,
    all(war, notLg, since(6, "15a")),
    {
      open: node(
        [v("cold", mood("cold")), v("stubborn", mood("stubborn")), v("base")],
        r("ask", "frank", "ask", "price", {
          reacts: [when_(sour, "shut", reason("law_shut"))],
        }),
        r("offer", "warm", "deal", "price", {
          tell: ["opposition:-1"],
          effects: [opposition(-1), remember("k_law_truce"), trustOf(who, 1)],
        }),
        r("push", "cold", "push", "price", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut")],
        }),
        r("later", "cold", "leave", null),
      ),
      price: node(
        [v("base")],
        r("yes", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_law_truce")],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_law_shells",
    "gbr_bonar_law",
    WAR,
    all(war, notLg, during("15a")),
    {
      open: node(
        [v("cold", mood("cold")), v("weary", mood("weary")), v("base")],
        r("ask", "cold", "ask", "terms", {
          reacts: [
            when_(sour, "shut", reason("law_shut")),
            when_(not(trust(0)), "hedge"),
          ],
        }),
        r("press", "cold", "push", "terms", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("law_shut"))],
        }),
        r("deal", "frank", "deal", "terms", {
          tell: ["opposition:-1", "cabinet:-1"],
          effects: [opposition(-1), cabinet(-1), remember("k_law_coalition")],
        }),
        r("later", "cold", "leave", null),
      ),
      hedge: node(
        [v("base")],
        r("again", "frank", "ask", "terms"),
        r("end", "cold", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("k_law_coalition")],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_law_backbench",
    "gbr_bonar_law",
    WAR,
    all(war, co, notLg, during("15b", "16b")),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("weary", mood("weary")),
          v("stubborn", mood("stubborn")),
          v("base"),
        ],
        r("ask", "frank", "ask", "deep", {
          reacts: [
            when_(sour, "shut", reason("law_shut")),
            when_(not(trust(1)), "hedge"),
          ],
        }),
        r("press", "threat", "push", "hedge", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cold", "weary"), "shut", reason("law_shut"))],
        }),
        r("deal", "warm", "deal", "deep", {
          tell: ["opposition:-1"],
          effects: [opposition(-1), voteOf("committee", 1), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      hedge: node([v("base")], r("end", "cold", "leave", null)),
      deep: node(
        [v("known", memory("m_wilson_leaks")), v("base")],
        r("thanks", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("m_law_shaking")],
        }),
        r("end", "cold", "leave", null, {
          effects: [remember("m_law_shaking")],
        }),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
    { cd: 8 },
  ),
  talk(
    "gbr_t_law_december",
    "gbr_bonar_law",
    WAR,
    all(war, co, notLg, during("16b")),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("weary", mood("weary")),
          v("stubborn", mood("stubborn")),
          v("base"),
        ],
        r("ask", "frank", "ask", "terms", {
          effects: [remember("k_law_december")],
          reacts: [when_(sour, "shut", reason("law_shut"))],
        }),
        r("push", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("weary"), "terms", remember("k_law_december"))],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["authority:-1"],
          effects: [
            authority(-1),
            remember("k_law_december"),
            voteOf("committee", 1),
            trustOf(who, 1),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("hold", "frank", "leave", null, {
          effects: [remember("k_law_december")],
        }),
        r("why", "warm", "ask", "last"),
      ),
      last: node(
        [v("base")],
        r("end", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_law_december")],
        }),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk("gbr_t_law_loan", "gbr_bonar_law", WAR, all(war, during("16b", "17a")), {
    open: node(
      [v("cold", mood("cold")), v("stubborn", mood("stubborn")), v("base")],
      r("ask", "frank", "ask", "plan", {
        reacts: [when_(sour, "shut", reason("law_shut"))],
      }),
      r("push", "cold", "push", "plan", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1)],
        reacts: [when_(mood("stubborn"), "shut")],
      }),
      r("deal", "warm", "deal", "plan", {
        tell: ["money:-1"],
        effects: [gauge("money", -1), remember("k_law_loan"), trustOf(who, 1)],
      }),
      r("later", "cold", "leave", null),
    ),
    plan: node(
      [v("base")],
      r("yes", "frank", "leave", null, { effects: [remember("k_law_loan")] }),
      r("no", "cold", "leave", null),
    ),
    shut: node([v("base")], r("end", "cold", "leave", null)),
  }),
  talk(
    "gbr_t_henderson_truce",
    "gbr_henderson",
    Y14_ON,
    all(war, since(9, "15a")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "terms", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("push", "cold", "push", "terms", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["money:-1"],
          effects: [
            gauge("money", -1),
            remember("k_hen_truce"),
            trustOf(who, 1),
          ],
        }),
        r("later", "cold", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("yes", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_hen_truce")],
        }),
        r("again", "cold", "ask", "writing"),
      ),
      writing: node(
        [v("base")],
        r("note", "warm", "leave", null, {
          effects: [remember("k_hen_truce"), reason("hen_wrote_it_down")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_henderson_cabinet",
    "gbr_henderson",
    WAR,
    all(war, notLg, during("15a")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "think", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("flatter", "flatter", "push", "think", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "think", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_hen_cabinet"), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null),
      ),
      think: node(
        [v("base")],
        r("yes", "frank", "leave", null, {
          effects: [remember("k_hen_cabinet")],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_henderson_dilution",
    "gbr_henderson",
    WAR,
    all(war, during("15b")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "rent", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("push", "cold", "push", "rent", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "rent", {
          tell: ["money:-1"],
          effects: [gauge("money", -1), remember("k_hen_dilution")],
        }),
        r("later", "cold", "leave", null),
      ),
      rent: node(
        [v("base")],
        r("hear", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_hen_dilution")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node(
        [v("base")],
        r("end", "cold", "leave", null, {
          effects: [reason("hen_wrote_it_down")],
        }),
      ),
    },
  ),
  talk(
    "gbr_t_henderson_cons",
    "gbr_henderson",
    WAR,
    all(war, during("15b", "16a")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "terms", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("push", "cold", "push", "terms", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["cabinet:-1"],
          effects: [
            cabinet(-1),
            remember("k_hen_cons"),
            voteOf("conscription", 1),
          ],
        }),
        r("later", "warm", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("yes", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [
            trustOf(who, 1),
            remember("k_hen_cons"),
            voteOf("conscription", 1),
          ],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_henderson_russia",
    "gbr_henderson",
    WAR,
    all(war, during("17a", "17b"), revolution),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "truth", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("push", "cold", "push", "truth", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "truth", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_hen_russia")],
        }),
        r("later", "cold", "leave", null),
      ),
      truth: node(
        [v("base")],
        r("note", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_hen_russia")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_henderson_after",
    "gbr_henderson",
    WAR,
    all(war, during("17b", "18a")),
    {
      open: node(
        [v("stubborn", mood("stubborn")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "votes", {
          reacts: [when_(sour, "shut", reason("hen_rose"))],
        }),
        r("push", "cold", "push", "votes", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("stubborn"), "shut", reason("hen_rose"))],
        }),
        r("deal", "warm", "deal", "votes", {
          effects: [
            promise(who, "p_hen_franchise", 12, {
              keep: any(
                chose("gbr_h_franchise", "women_thirty"),
                chose("gbr_h_franchise", "women_equal"),
              ),
            }),
            remember("k_hen_after"),
            trustOf(who, 1),
          ],
        }),
        r("later", "warm", "leave", null),
      ),
      votes: node(
        [v("base")],
        r("note", "frank", "leave", null, {
          effects: [remember("k_hen_after"), reason("hen_kept_word")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
    {
      cd: 8,
      intro: [
        v(
          "door",
          any(
            chose("gbr_h_stockholm", "refuse"),
            chose("gbr_h_stockholm", "leave_him_outside"),
          ),
        ),
        v("base"),
      ],
    },
  ),
  talk(
    "gbr_t_venetia_friday",
    "gbr_venetia",
    CRISIS_ON,
    all(since(0, "15a"), notLg, not(seen("gbr_h_engagement"))),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("cunning", mood("cunning")),
          v("weary", mood("weary")),
          v("base"),
        ],
        r("ask", "frank", "ask", "count", {
          reacts: [
            when_(sour, "joke", reason("ven_laughed")),
            when_(not(trust(0)), "joke", reason("ven_laughed")),
          ],
        }),
        r("press", "cold", "push", "joke", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cold"), "count")],
        }),
        r("deal", "warm", "deal", "count", {
          effects: [remember("m_ven_told_all"), trustOf(who, 1)],
        }),
        r("quiet", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
      ),
      joke: node([v("base")], r("end", "warm", "leave", null)),
      count: node(
        [v("war_time", war), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_ven_counted"), reason("ven_counted")],
        }),
        r("laugh", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
      ),
    },
    { cd: 4, intro: [v("war_on", war), v("base")] },
  ),
  talk("gbr_t_venetia_franchise", "gbr_venetia", CRISIS, chapter(0, 2), {
    open: node(
      [
        v("cold", mood("cold")),
        v("cunning", mood("cunning")),
        v("weary", mood("weary")),
        v("base"),
      ],
      r("ask", "frank", "ask", "read", {
        reacts: [when_(sour, "joke", reason("ven_laughed"))],
      }),
      r("press", "cold", "push", "read", {
        tell: ["trust:-1"],
        effects: [trustOf(who, -1)],
        reacts: [when_(mood("cunning"), "joke", reason("ven_laughed"))],
      }),
      r("deal", "warm", "deal", "read", {
        effects: [remember("k_ven_franchise"), trustOf(who, 1)],
      }),
      r("later", "warm", "leave", null),
    ),
    read: node(
      [v("base")],
      r("mark", "frank", "leave", null, {
        effects: [remember("k_ven_franchise")],
      }),
      r("end", "warm", "leave", null),
    ),
    joke: node([v("base")], r("end", "warm", "leave", null)),
  }),
  talk(
    "gbr_t_venetia_wards",
    "gbr_venetia",
    WAR,
    all(war, during("15a"), not(seen("gbr_h_engagement"))),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("cunning", mood("cunning")),
          v("weary", mood("weary")),
        ],
        r("ask", "frank", "ask", "said", {
          reacts: [when_(sour, "joke", reason("ven_laughed"))],
        }),
        r("press", "cold", "push", "said", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cunning"), "joke", reason("ven_laughed"))],
        }),
        r("deal", "warm", "deal", "said", {
          effects: [remember("k_ven_wards"), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      said: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("k_ven_wards")],
        }),
        r("end", "warm", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1)],
        }),
      ),
      joke: node([v("base")], r("end", "warm", "leave", null)),
    },
  ),
  talk(
    "gbr_t_venetia_letters",
    "gbr_venetia",
    Y14_ON,
    all(war, since(7, "15a"), not(seen("gbr_h_engagement"))),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("cunning", mood("cunning")),
          v("weary", mood("weary")),
        ],
        r("ask", "frank", "ask", "what", {
          reacts: [when_(sour, "joke", reason("ven_laughed"))],
        }),
        r("press", "cold", "push", "what", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cunning"), "joke", reason("ven_laughed"))],
        }),
        r("deal", "warm", "deal", "stop", {
          tell: ["trust:+1"],
          effects: [
            trustOf(who, 1),
            promise(who, "p_ven_quiet", 4, {
              keep: all(
                not({ kind: "memory", key: "m_ven_quiet_on", within: 3 }),
                not({
                  kind: "chose",
                  scene: "gbr_t_venetia_friday",
                  within: 4,
                }),
              ),
            }),
            remember("m_ven_quiet_on"),
          ],
        }),
        r("later", "warm", "leave", null),
      ),
      what: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_ven_letters_read")],
        }),
        r("end", "warm", "leave", null),
      ),
      stop: node([v("base")], r("end", "warm", "leave", null)),
      joke: node([v("base")], r("end", "warm", "leave", null)),
    },
  ),
  talk(
    "gbr_t_venetia_montagu",
    "gbr_venetia",
    WAR,
    all(during("15a"), not(seen("gbr_h_engagement"))),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("cunning", mood("cunning")),
          v("weary", mood("weary")),
        ],
        r("ask", "frank", "ask", "her", {
          reacts: [when_(sour, "joke", reason("ven_laughed"))],
        }),
        r("press", "cold", "push", "joke", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cold"), "her")],
        }),
        r("deal", "warm", "deal", "her", {
          effects: [schedule("gbr_v_montagu_asks", 1), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      her: node(
        [v("yes", candid(who)), v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_ven_might_go")],
        }),
        r("end", "warm", "leave", null),
      ),
      joke: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  talk(
    "gbr_t_venetia_after",
    "gbr_venetia",
    WAR,
    all(seen("gbr_h_engagement"), notLg, during("16b", "18b")),
    {
      open: node(
        [
          v("cold", mood("cold")),
          v("cunning", mood("cunning")),
          v("weary", mood("weary")),
        ],
        r("ask", "frank", "ask", "old", {
          reacts: [when_(sour, null, reason("ven_laughed"))],
        }),
        r("push", "cold", "push", "old", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("cold"), null)],
        }),
        r("deal", "warm", "deal", "old", {
          effects: [remember("k_ven_after"), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      old: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_ven_after")],
        }),
        r("end", "warm", "leave", null),
      ),
    },
  ),
  visit(
    "gbr_v_montagu_asks",
    "gbr_montagu",
    WAR,
    all(during("15a"), notLg),
    5,
    {
      open: node(
        [
          v("anxious", mood("anxious")),
          v("cunning", mood("cunning")),
          v("base"),
        ],
        r("ask", "frank", "ask", "offer", { reacts: [when_(sour, "shut")] }),
        r("push", "cold", "push", "offer", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("anxious"), "shut")],
        }),
        r("deal", "warm", "deal", "offer", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_montagu_help"), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      offer: node(
        [v("base")],
        r("mark", "frank", "ask", "more", {
          effects: [remember("k_montagu_help")],
        }),
        r("end", "cold", "leave", null),
      ),
      more: node([v("base")], r("end", "warm", "leave", null)),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  visit(
    "gbr_v_simon_resign",
    "gbr_simon",
    WAR,
    all(during("15b", "16a"), not(seen("gbr_h_conscription"))),
    6,
    {
      open: node(
        [v("cold", mood("cold")), v("anxious", mood("anxious")), v("base")],
        r("ask", "frank", "ask", "terms", { reacts: [when_(sour, "shut")] }),
        r("push", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("anxious"), "terms")],
        }),
        r("deal", "warm", "deal", "terms", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_simon_stays"), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null),
      ),
      terms: node(
        [v("base")],
        r("yes", "frank", "leave", null, {
          effects: [remember("k_simon_stays"), reason("simon_filed")],
        }),
        r("no", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
  ),
  visit(
    "gbr_v_northcliffe_call",
    "gbr_northcliffe",
    WAR,
    all(war, notLg, during("15a", "16b"), oppHigh),
    5,
    {
      open: node(
        [
          v("arrogant", mood("arrogant")),
          v("cunning", mood("cunning")),
          v("anxious", mood("anxious")),
        ],
        r("ask", "cold", "ask", "price", {
          reacts: [when_(sour, "shut", reason("north_hung_up"))],
        }),
        r("push", "threat", "push", "shut", {
          tell: ["opposition:+1"],
          effects: [opposition(1)],
          reacts: [when_(mood("anxious"), "price")],
        }),
        r("deal", "flatter", "deal", "price", {
          tell: ["authority:-1"],
          effects: [authority(-1), remember("k_north_press"), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null),
      ),
      price: node(
        [v("base")],
        r("mark", "cold", "leave", null, {
          effects: [remember("k_north_press")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node(
        [v("base")],
        r("end", "cold", "leave", null, { effects: [reason("north_hung_up")] }),
      ),
    },
    { cd: 8 },
  ),
  visit(
    "gbr_v_asquith_old",
    "gbr_asquith",
    WAR,
    all(lg, during("17a", "18a")),
    6,
    {
      open: node(
        [v("cold", mood("cold")), v("weary", mood("weary")), v("base")],
        r("ask", "frank", "ask", "day", {
          reacts: [when_(sour, "shut", reason("asquith_cold"))],
        }),
        r("push", "threat", "push", "shut", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          reacts: [when_(mood("weary"), "day")],
        }),
        r("deal", "warm", "deal", "day", {
          tell: ["cabinet:-1"],
          effects: [cabinet(-1), remember("k_asq_return"), trustOf(who, 1)],
        }),
        r("later", "warm", "leave", null),
      ),
      day: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          tell: ["trust:+1"],
          effects: [trustOf(who, 1), remember("k_asq_return")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node([v("base")], r("end", "cold", "leave", null)),
    },
    { cd: 10 },
  ),
  visit(
    "gbr_v_redmond_badge",
    "gbr_redmond",
    WAR,
    war,
    6,
    {
      open: node(
        [
          v("weary", mood("weary")),
          v("stubborn", mood("stubborn")),
          v("anxious", mood("anxious")),
          v("base"),
        ],
        r("ask", "frank", "ask", "left", {
          reacts: [when_(sour, "shut", reason("redmond_stayed"))],
        }),
        r("push", "cold", "push", "shut", {
          tell: ["irish:-1"],
          effects: [irish(-1)],
          reacts: [when_(mood("weary"), "left")],
        }),
        r("deal", "warm", "deal", "left", {
          tell: ["irish:+1", "cabinet:-1"],
          effects: [irish(1), cabinet(-1), trustOf(who, 1)],
        }),
        r("later", "cold", "leave", null, {
          tell: ["irish:-1"],
          effects: [irish(-1), reason("redmond_stayed")],
        }),
      ),
      left: node(
        [v("base")],
        r("mark", "frank", "leave", null, {
          effects: [remember("m_redmond_asked")],
        }),
        r("end", "cold", "leave", null),
      ),
      shut: node(
        [v("base")],
        r("end", "cold", "leave", null, {
          effects: [reason("redmond_stayed")],
        }),
      ),
    },
    { scheduledOnly: true, called: true },
  ),
  scene({
    id: "gbr_h_pledge",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a")),
    cast: { finance: holder("finance"), court: holder("court") },
    salience: 5,
    tags: ["home", "tension_down"],
    variants: [v("lg_drink", holds("finance", "gbr_lloyd_george")), v("base")],
    fallback: "pub_hours",
    options: [
      o(
        "pub_hours",
        ["shells:+1", "order:-1"],
        [gauge("shells", 1), gauge("order", -1), setFlag("f_gbr_pub_hours")],
      ),
      o(
        "duty_up",
        ["money:+1", "opposition:+1"],
        [gauge("money", 1), opposition(1)],
      ),
      o(
        "follow_king",
        ["morale:+1", "trust:+1"],
        [
          gauge("morale", 1),
          trustOf(byName("gbr_george_v"), 1),
          remember("m_pm_pledged"),
        ],
        memory("k_king_pledge"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_engagement",
    kind: "wire",
    stage: WAR,
    when: all(
      notLg,
      any(
        seen("gbr_h_shells"),
        all({ kind: "span", max: 30 }, chapter(15, 16)),
        all({ kind: "span", min: 31 }, chapter(13, 13)),
      ),
    ),
    cast: {},
    salience: 7,
    tags: ["people"],
    variants: [
      v("told", memory("m_ven_might_go")),
      v("quiet", {
        kind: "promise",
        who: byName("gbr_venetia"),
        key: "p_ven_quiet",
        kept: true,
      }),
      v("base"),
    ],
  }),
  scene({
    id: "gbr_h_rents",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15b"), gaugeAt("order", 3)),
    cast: {
      home: holder("interior"),
      mun: { any_of: [{ office: "munitions" }, { office: "finance" }] },
    },
    salience: 6,
    tags: ["home", "tension_up"],
    variants: [v("court_day", memory("k_hen_dilution")), v("base")],
    fallback: "wait",
    options: [
      o("wait", ["order:-1"], [gauge("order", -1), remember("m_rents_waited")]),
      o(
        "rent_freeze",
        ["order:+1", "shells:+1", "money:-1"],
        [
          gauge("order", 1),
          gauge("shells", 1),
          gauge("money", -1),
          setFlag("f_gbr_rent_act"),
          trustOf(byName("gbr_henderson"), 1),
        ],
        memory("k_hen_dilution"),
      ),
      o(
        "send_police",
        ["order:-2", "shells:-1"],
        [
          gauge("order", -2),
          gauge("shells", -1),
          trustOf(byName("gbr_henderson"), -1),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_election_due",
    kind: "proposal",
    stage: WAR,
    when: all(war, notLg, during("15b", "16b"), commonsLow),
    cast: { fm: holder("foreign") },
    salience: 6,
    tags: ["home"],
    variants: [
      v("soldiers", { kind: "gauge", gauge: "morale", max: 2 }),
      v("base"),
    ],
    fallback: "extend",
    options: [
      o(
        "extend",
        ["commons:+1"],
        [commons(1), setFlag("f_gbr_parliament_extended")],
      ),
      o(
        "short_extend",
        ["opposition:-1"],
        [opposition(-1), setFlag("f_gbr_parliament_extended")],
      ),
      o(
        "call_election",
        ["commons:+2", "cabinet:-2", "order:-1"],
        [
          commons(2),
          cabinet(-2),
          gauge("order", -1),
          setFlag("f_gbr_war_election"),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_irish_division",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("15a", "15b"), {
      kind: "promise",
      who: byName("gbr_redmond"),
      key: "p_redmond_badge",
      kept: false,
      broken: false,
    }),
    cast: { sec: holder("war") },
    salience: 6,
    tags: ["home"],
    variants: [v("kitchener", holds("war", "gbr_kitchener")), v("base")],
    fallback: "as_army_says",
    options: [
      o("as_army_says", ["irish:-1"], [irish(-1), pressure("ireland", 1)]),
      o(
        "half_word",
        ["irish:+1", "trust:-1"],
        [
          irish(1),
          trustOf(byName("gbr_kitchener"), -1),
          pressure("ireland", -1),
          remember("m_badge_half"),
        ],
      ),
      o(
        "keep_word",
        ["irish:+2", "trust:-2"],
        [
          irish(2),
          trustOf(byName("gbr_kitchener"), -2),
          pressure("ireland", -1),
          keepPromise(byName("gbr_redmond"), "p_redmond_badge"),
          trustOf(byName("gbr_redmond"), 1),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_stop",
    kind: "crisis",
    stage: WAR,
    when: seen("gbr_h_easter"),
    cast: { ireland: holder("ireland"), sec: holder("war") },
    salience: 8,
    tags: ["home", "tension_down"],
    variants: [
      v("redmond", memory("k_red_amnesty")),
      v("maxwell", holds("war", "gbr_kitchener")),
      v("base"),
    ],
    fallback: "wire_stop",
    options: [
      o(
        "wire_stop",
        ["irish:+1", "trust:-1"],
        [irish(1), pressure("ireland", -1), setFlag("f_gbr_courts_stopped")],
      ),
      o(
        "go_to_dublin",
        ["irish:+1", "authority:+1"],
        [
          irish(1),
          authority(1),
          pressure("ireland", -1),
          setFlag("f_gbr_courts_stopped"),
          setFlag("f_gbr_pm_dublin"),
        ],
      ),
      o(
        "amnesty_word",
        ["irish:+2", "opposition:+1"],
        [
          irish(2),
          opposition(1),
          pressure("ireland", -2),
          setFlag("f_gbr_courts_stopped"),
          trustOf(byName("gbr_redmond"), 1),
        ],
        memory("k_red_amnesty"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_dublin_record",
    kind: "report",
    stage: WAR,
    when: seen("gbr_h_easter"),
    cast: {},
    salience: 7,
    tags: ["home"],
    stamp: "confirmed",
    source: "press",
    variants: [v("closed", chose("gbr_h_stop")), v("base")],
  }),
  scene({
    id: "gbr_h_home_rule_lives",
    kind: "proposal",
    stage: WAR,
    when: all(hr, during("15a", "18a")),
    cast: { ireland: holder("ireland") },
    salience: 8,
    tags: ["home", "tension_down"],
    variants: [v("hard", gaugeAt("order", 2)), v("base")],
    fallback: "hands_off",
    options: [
      o("hands_off", ["irish:+1"], [irish(1), pressure("ireland", -1)]),
      o(
        "loan_army",
        ["irish:+1", "money:-1"],
        [irish(1), gauge("money", -1), men(3), pressure("ireland", -1)],
      ),
      o(
        "ask_for_men",
        ["manpower:+8", "irish:-1"],
        [men(8), irish(-1), pressure("ireland", 1)],
      ),
    ],
  }),
  scene({
    id: "gbr_h_raymond",
    kind: "wire",
    stage: WAR,
    when: all(
      notLg,
      war,
      during("16b"),
      any(seen("gbr_w_somme_first"), world({ is: "main", of: ["west"] })),
    ),
    cast: {},
    salience: 5,
    tags: ["people"],
    variants: [v("base")],
  }),
  scene({
    id: "gbr_h_palace_call",
    kind: "crisis",
    stage: WAR,
    when: all(
      notLg,
      during("16b"),
      any(chose("gbr_h_committee", "refuse"), flag("f_gbr_cabinet_down_2")),
    ),
    cast: {
      king: { person: "gbr_george_v" },
      law: { person: "gbr_bonar_law" },
      court: holder("court"),
    },
    salience: 9,
    tags: ["home"],
    variants: [
      v("refused", chose("gbr_h_committee", "refuse")),
      v("law_first", {
        kind: "person_trust",
        who: byName("gbr_george_v"),
        max: -1,
      }),
      v("base"),
    ],
    fallback: "resign",
    options: [
      o(
        "resign",
        ["trust:+1"],
        [
          maybe(
            promise_open_king,
            keepPromise(byName("gbr_george_v"), "p_king_warn"),
          ),
          trustOf(byName("gbr_george_v"), 1),
          setFlag("f_gbr_resigned"),
        ],
      ),
      o(
        "serve_under",
        ["cabinet:+2", "authority:-2"],
        [
          maybe(
            promise_open_king,
            keepPromise(byName("gbr_george_v"), "p_king_warn"),
          ),
          cabinet(2),
          authority(-2),
          setFlag("f_gbr_under_law"),
          setFlag("f_gbr_resigned"),
        ],
      ),
      o(
        "stay_and_fight",
        ["opposition:+2", "cabinet:-2"],
        [opposition(2), cabinet(-2), authority(1), setFlag("f_gbr_stayed_on")],
      ),
    ],
  }),
  scene({
    id: "gbr_h_new_chair",
    kind: "crisis",
    stage: WAR,
    when: chose("gbr_h_palace_call"),
    cast: { court: holder("court") },
    salience: 9,
    tags: ["people"],
    variants: [v("under_law", flag("f_gbr_under_law")), v("base")],
    fallback: "continue_lg",
    options: [
      o(
        "continue_lg",
        [],
        [
          setFlag("f_pm_lg"),
          appoint("gbr_lloyd_george", "chancellor"),
          appoint("gbr_bonar_law", "finance"),
          maybe(empty("munitions"), appoint("gbr_montagu", "munitions")),
        ],
      ),
      o(
        "end_memoir",
        ["ends_game"],
        [setFlag("f_gbr_memoir"), { kind: "end", ending: "home_collapse" }],
      ),
      o(
        "old_friend",
        ["authority:+1"],
        [
          setFlag("f_pm_lg"),
          appoint("gbr_lloyd_george", "chancellor"),
          appoint("gbr_bonar_law", "finance"),
          authority(1),
          remember("m_old_friend_visit"),
        ],
        memory("k_ven_after"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_stockholm",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("17b"), labourIn, revolution, {
      kind: "person_trust",
      who: byName("gbr_henderson"),
      min: -2,
    }),
    cast: { fm: holder("foreign"), hen: { person: "gbr_henderson" } },
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [v("heard", memory("k_hen_russia")), v("lg_seat", lg), v("base")],
    fallback: "refuse",
    options: [
      o(
        "refuse",
        ["order:-1", "ally:+1"],
        [
          gauge("order", -1),
          nation("FRA", 1),
          trustOf(byName("gbr_henderson"), -1),
          setFlag("f_gbr_stockholm_no"),
          setFlag("f_gbr_henderson_out"),
        ],
      ),
      o(
        "let_go",
        ["order:+1", "ally:-1"],
        [
          gauge("order", 1),
          nation("FRA", -1),
          trustOf(byName("gbr_henderson"), 1),
          opposition(1),
        ],
        memory("k_hen_russia"),
      ),
      o(
        "leave_him_outside",
        ["cabinet:+1", "order:-2"],
        [
          cabinet(1),
          gauge("order", -2),
          trustOf(byName("gbr_henderson"), -3),
          setFlag("f_gbr_henderson_out"),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_franchise",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17a", "18a")),
    cast: { home: holder("interior") },
    salience: 6,
    tags: ["home", "tension_down"],
    variants: [
      v("word_given", chose("gbr_c_deputation", "word_on_vote")),
      v("base"),
    ],
    fallback: "soldiers_only",
    options: [
      o(
        "soldiers_only",
        ["morale:+1", "order:-1"],
        [
          gauge("morale", 1),
          gauge("order", -1),
          setFlag("f_gbr_soldiers_vote"),
        ],
      ),
      o(
        "women_thirty",
        ["order:+1", "opposition:+1"],
        [
          gauge("order", 1),
          opposition(1),
          setFlag("f_gbr_women_thirty"),
          keepPromise(byName("gbr_henderson"), "p_hen_franchise"),
        ],
        memory("k_hen_after"),
      ),
      o(
        "women_equal",
        ["order:+2", "opposition:+2", "cabinet:-1"],
        [
          gauge("order", 2),
          opposition(2),
          cabinet(-1),
          setFlag("f_gbr_women_equal"),
          keepPromise(byName("gbr_henderson"), "p_hen_franchise"),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_lansdowne",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17b"), bigLoss),
    cast: { fm: holder("foreign") },
    salience: 7,
    tags: ["foreign", "tension_down"],
    variants: [v("lg_seat", lg), v("base")],
    fallback: "disown",
    options: [
      o(
        "disown",
        ["morale:+1", "order:-1"],
        [
          gauge("morale", 1),
          gauge("order", -1),
          remember("m_lansdowne_disowned"),
        ],
      ),
      o("stay_silent", [], [remember("m_lansdowne_silent")]),
      o(
        "open_talks",
        ["order:+1", "morale:-1", "ally:-1"],
        [
          gauge("order", 1),
          gauge("morale", -1),
          nation("FRA", -1),
          setFlag("f_gbr_peace_aims"),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_irish_draft",
    kind: "crisis",
    stage: WAR,
    when: all(war, during("18a"), any(seen("gbr_w_march"), manLow)),
    cast: { ireland: holder("ireland"), sec: holder("war") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("march", seen("gbr_w_march")),
      v("convention", flag("f_gbr_convention")),
      v("base"),
    ],
    fallback: "no_draft",
    options: [
      o(
        "no_draft",
        ["irish:+1", "opposition:+1"],
        [irish(1), opposition(1), pressure("ireland", -1)],
      ),
      o(
        "draft_with_home_rule",
        ["manpower:+5", "irish:-1", "opposition:-1"],
        [
          men(5),
          irish(-1),
          opposition(-1),
          pressure("ireland", 2),
          setFlag("f_gbr_irish_draft"),
        ],
        memory("k_red_convention"),
      ),
      o(
        "draft_alone",
        ["manpower:+10", "irish:-3", "order:-1"],
        [
          men(10),
          irish(-3),
          gauge("order", -1),
          pressure("ireland", 3),
          setFlag("f_gbr_irish_draft"),
        ],
      ),
    ],
  }),
  scene({
    id: "gbr_h_maurice",
    kind: "crisis",
    stage: WAR,
    when: all(any(co, lg), during("18a"), westBack),
    cast: { sec: holder("war") },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [
      v("lg_seat", lg),
      v("asq_warned", memory("k_asq_return")),
      v("base"),
    ],
    fallback: "inquiry",
    options: [
      o(
        "inquiry",
        ["cabinet:+1", "opposition:+1"],
        [cabinet(1), opposition(1), remember("m_maurice_inquiry")],
      ),
      o(
        "debate_it",
        ["commons:+1", "opposition:-1", "cabinet:-1"],
        [
          commons(1),
          opposition(-1),
          cabinet(-1),
          setFlag("f_gbr_maurice_debate"),
        ],
      ),
      o(
        "asquith_talk",
        ["cabinet:+2", "opposition:-1"],
        [cabinet(2), opposition(-1), remember("m_maurice_settled")],
        all(lg, memory("k_asq_return")),
      ),
    ],
  }),
  scene({
    id: "gbr_h_vacant",
    kind: "audience",
    stage: Y14_ON,
    when: all(since(6, "18b"), any(anyEmpty, greyWaits)),
    cast: {
      fm: {
        any_of: [
          { office: "foreign" },
          { office: "finance" },
          { office: "court" },
        ],
      },
    },
    salience: 7,
    tags: ["people"],
    cooldown: 4,
    variants: [
      v("war_seat", empty("war")),
      v("munitions", empty("munitions")),
      v("navy", empty("navy")),
      v("finance", empty("finance")),
      v("foreign", empty("foreign")),
      v("grey_rest", greyWaits),
      v("base"),
    ],
    fallback: "first_name",
    options: [
      o("first_name", [], [...fillVacant((row) => row[1])]),
      o(
        "second_name",
        [],
        [
          ...fillVacant((row) => row[2]),
          maybe(
            all(not(anyEmpty), greyWaits),
            appoint("gbr_balfour", "foreign"),
            keepPromise(byName("gbr_grey"), "p_grey_rest"),
          ),
        ],
      ),
      o(
        "churchill_back",
        ["opposition:+1", "trust:+1"],
        [
          opposition(1),
          trustOf(byName("gbr_churchill"), 1),
          ...fillVacant(() => "gbr_churchill"),
          keepPromise(byName("gbr_churchill"), "p_chu_back"),
        ],
        memory("k_chu_back"),
      ),
    ],
  }),
  scene({
    id: "gbr_h_unions",
    kind: "proposal",
    stage: WAR,
    when: all(war, during("17a", "18a"), unrestAt(1)),
    cast: { mun: { any_of: [{ office: "munitions" }, { office: "finance" }] } },
    salience: 6,
    tags: ["home", "tension_up"],
    variants: [v("rochdale", during("17a")), v("base")],
    fallback: "hear_them",
    options: [
      o(
        "hear_them",
        ["order:+1", "manpower:-5"],
        [gauge("order", 1), men(-5), doWorld({ do: "calm" })],
      ),
      o(
        "inquiry",
        ["order:+1", "money:-1"],
        [
          gauge("order", 1),
          gauge("money", -1),
          setFlag("f_gbr_unrest_inquiry"),
        ],
      ),
      o(
        "hold_line",
        ["order:-2", "manpower:+8"],
        [gauge("order", -2), men(8), remember("m_unions_held")],
      ),
    ],
  }),
];
