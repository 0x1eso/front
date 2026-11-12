// AUH's schedule (원수의 일정) and aims (국가 목표); shapes in GwActs.ts.
// Text in resources/ww1914/ko/AUH.acts.json. The scenes they play are in
// scenes/auh_act.ts, their text in AUH.act.json.
import type {
  GwAct,
  GwActField,
  GwActOption,
  GwAim,
} from "@openfront/engine-api/ww1914/GwActs";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  GwEffect,
  not,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { AUH_HONOURS_KEY } from "../depts/auh";
import {
  able,
  atWar,
  berlinAt,
  ffThrone,
  fits,
  gauge,
  hungaryAt,
  inst,
  inWar,
  italyIn,
  karl,
  maybe,
  nationsAt,
  opinion,
  peace,
  picked,
  reveal,
  trust,
} from "../scenes/auh_act";

export { AUH_ACT_SCENES } from "../scenes/auh_act";

const NATION: GwAct["nation"] = ["AUH"];
const to = role("to");
const e = role("e");

const act = (
  id: string,
  kind: GwAct["kind"],
  scene: string,
  wait: number,
  more: Partial<GwAct> = {},
): GwAct => ({ id, nation: NATION, kind, scene, wait, ...more });

const list = (
  id: string,
  ...options: (string | GwActOption)[]
): GwActField => ({
  id,
  options: options.map((o) => (typeof o === "string" ? { id: o } : o)),
});

const seen = (key: string): GwEffect => ({
  kind: "ruler",
  side: "reputation",
  delta: 1,
  key,
});
const inspect = (
  fact: "force" | "morale" | "shells",
  tag: GwTag,
  theatre?: "east" | "balkan" | "italy",
) =>
  doWorld(
    theatre === undefined
      ? { do: "inspect", fact, tag }
      : { do: "inspect", fact, tag, theatre },
  );

/** A visit steadies the streets where they had stirred (ww169). */
const calmed = maybe(
  world({ is: "unrest", min: 1 }),
  doWorld({ do: "calm", key: "visit_calmed" }),
);
/** A mediator stands ready: the terms can ask a neutral to carry peace. */
const mediator = setFlag("gw_mediator");

const VISITS: GwAct[] = [
  act("auh_a_skoda", "visit", "auh_a_skoda_v", 0, {
    cooldown: 8,
    effects: [inspect("shells", "AUH")],
  }),
  act("auh_a_csepel", "visit", "auh_a_csepel_v", 0, {
    when: inWar,
    cooldown: 8,
    effects: [inspect("shells", "AUH")],
  }),
  act("auh_a_mills", "visit", "auh_a_mills_v", 0, {
    cooldown: 10,
    effects: [reveal("auh_hun_grain_hidden")],
  }),
  act("auh_a_queue", "visit", "auh_a_queue_v", 0, {
    when: all(inWar, world({ is: "war_months", own: true, min: 5 })),
    cooldown: 6,
    effects: [inspect("morale", "AUH"), seen("auh_a_seen_queue")],
  }),
  act("auh_a_prague", "visit", "auh_a_prague_v", 0, {
    cooldown: 10,
    effects: [reveal("auh_czech_regiments_sound"), seen("auh_a_seen_prague")],
  }),
  act("auh_a_hq", "visit", "auh_a_hq_v", 0, {
    trip: true,
    when: inWar,
    cooldown: 6,
    effects: [inspect("force", "AUH", "east")],
  }),
  act("auh_a_przemysl", "visit", "auh_a_przemysl_v", 0, {
    trip: true,
    when: all(atWar("RUS"), world({ is: "war_months", own: true, max: 8 })),
    once: true,
    effects: [inspect("force", "RUS", "east")],
  }),
  act("auh_a_pass", "visit", "auh_a_pass_v", 0, {
    when: all(
      atWar("RUS"),
      world({ is: "war_months", own: true, min: 3, max: 11 }),
    ),
    once: true,
    effects: [inspect("morale", "AUH")],
  }),
  act("auh_a_isonzo", "visit", "auh_a_isonzo_v", 0, {
    trip: true,
    when: italyIn,
    cooldown: 8,
    effects: [inspect("force", "ITA", "italy")],
  }),
  act("auh_a_semlin", "visit", "auh_a_semlin_v", 0, {
    // A crisis with Serbia, July's or a later note's, or the war with it.
    when: any(
      { kind: "crisis", topic: "balkan" },
      world({ is: "ladder", tag: "SRB" }),
      atWar("SRB"),
    ),
    cooldown: 8,
    effects: [inspect("force", "SRB", "balkan")],
  }),
  act("auh_a_pola", "visit", "auh_a_pola_v", 0, {
    cooldown: 10,
    effects: [trustOf(role("navy"), 1), opinion("army", 1), calmed],
  }),
  act("auh_a_ward", "visit", "auh_a_ward_v", 0, {
    when: world({ is: "casualties", min: 50 }),
    cooldown: 6,
    effects: [seen("auh_a_seen_ward")],
  }),
  act("auh_a_barracks", "visit", "auh_a_barracks_v", 0, {
    when: all(atWar("RUS"), world({ is: "war_months", own: true, min: 5 })),
    cooldown: 10,
    effects: [seen("auh_a_seen_barracks")],
  }),
  act("auh_a_bosnia", "visit", "auh_a_bosnia_v", 0, {
    once: true,
    effects: [reveal("srb_officers_plot")],
  }),
];

const LETTERS: GwAct[] = [
  act("auh_a_l_ferdinand", "letter", "auh_a_l_ferdinand_r", 1, {
    when: world({ is: "neutral", tag: "BGR" }),
    cooldown: 6,
    fields: [
      list("subject", "macedonia", "kin"),
      { id: "tone", tones: ["flatter", "frank", "cold"] },
    ],
    effects: [
      { kind: "letter", who: to },
      maybe(fits(to), doWorld({ do: "readiness", tag: "BGR", delta: 1 })),
    ],
  }),
  act("auh_a_l_pope", "letter", "auh_a_l_pope_r", 2, {
    when: inWar,
    cooldown: 8,
    fields: [
      list(
        "subject",
        { id: "peace", effects: [mediator] },
        { id: "prisoners", effects: [opinion("court", 1)] },
      ),
      { id: "tone", tones: ["warm", "frank"] },
    ],
  }),
  act("auh_a_l_alfonso", "letter", "auh_a_l_alfonso_r", 2, {
    when: inWar,
    cooldown: 8,
    effects: [{ kind: "letter", who: to }],
    fields: [
      list(
        "subject",
        { id: "prisoners", effects: [opinion("press", 1)] },
        { id: "mediate", effects: [mediator] },
      ),
      { id: "tone", tones: ["warm", "frank"] },
    ],
  }),
  act("auh_a_l_pm", "letter", "auh_a_l_pm_r", 1, {
    cooldown: 5,
    fields: [
      list("subject", "grain", "franchise", "romania"),
      { id: "tone", tones: ["warm", "cold", "frank", "threat"] },
    ],
    effects: [maybe(fits(to), inst("hungary", 1), trustOf(to, 1))],
  }),
  act("auh_a_l_chief", "letter", "auh_a_l_chief_r", 1, {
    when: inWar,
    cooldown: 5,
    fields: [
      list("subject", "truth", "shells", "germans"),
      { id: "tone", tones: ["warm", "cold", "frank", "threat"] },
    ],
    effects: [maybe(fits(to), trustOf(to, 1))],
  }),
  act("auh_a_l_heir", "letter", "auh_a_l_heir_r", 1, {
    when: all(not(karl), not(ffThrone)),
    cooldown: 8,
    fields: [
      list("subject", "crown", "peace", "army"),
      { id: "tone", tones: ["warm", "cold", "frank"] },
    ],
    effects: [maybe(fits(to), trustOf(to, 1))],
  }),
];

const ORDERS: GwAct[] = [
  act("auh_a_o_council", "order", "auh_a_o_council_bread", 1, {
    cooldown: 5,
    fields: [
      list(
        "agenda",
        "bread",
        { id: "germans", scene: "auh_a_o_council_germans", when: inWar },
        { id: "end", scene: "auh_a_o_council_end", when: inWar },
      ),
      { id: "attend", people: "cabinet", count: 2 },
    ],
  }),
  act("auh_a_o_rail", "order", "auh_a_o_rail_r", 1, {
    // Before the war, or in its first months: while the tables still matter.
    when: any(peace, world({ is: "war_months", own: true, max: 5 })),
    once: true,
    fields: [list("subject", "north", "south")],
    effects: [reveal("auh_rail_muddle")],
  }),
  // ww193: the inquiry is a commission now: the foreign office's task row
  // auh_task_inquiry (content/depts/auh.ts) brings auh_a_o_inquiry_r.
  act("auh_a_o_redl", "order", "auh_a_o_redl_r", 1, {
    once: true,
    effects: [reveal("auh_redl_plans")],
  }),
  act("auh_a_o_envoy", "order", "auh_a_o_envoy_r", 2, {
    cooldown: 6,
    fields: [
      { id: "envoy", people: "own" },
      list(
        "where",
        { id: "rome", when: world({ is: "neutral", tag: "ITA" }) },
        { id: "bucharest", when: world({ is: "neutral", tag: "ROU" }) },
        "constantinople",
      ),
    ],
    effects: [
      maybe(all(picked("where", "rome"), able(e, 3)), reveal("ita_price_list")),
      maybe(
        all(picked("where", "bucharest"), able(e, 3)),
        reveal("rou_treaty_dead"),
      ),
    ],
  }),
  act("auh_a_o_berlin", "order", "auh_a_o_berlin_r", 1, {
    when: inWar,
    cooldown: 6,
    fields: [
      { id: "envoy", people: "own" },
      list(
        "ask",
        { id: "divisions", effects: [inst("berlin", 1)] },
        { id: "grain", effects: [gauge("bread", 1), inst("berlin", 1)] },
        "aims",
      ),
    ],
    effects: [trust("DEU", 1)],
  }),
  act("auh_a_o_nations", "order", "auh_a_o_nations_m", 1, {
    cooldown: 8,
    fields: [
      list("agenda", "language", "schools", "prisoners"),
      list("delegation", "czech", "south_slav", "pole"),
    ],
  }),
  act("auh_a_o_premiers", "order", "auh_a_o_premiers_m", 1, {
    cooldown: 6,
    fields: [list("agenda", "quota", "grain", "franchise")],
  }),
];

/** Where a speech is heard: what that moves. */
const place = (id: string, ...effects: GwEffect[]): GwActOption => ({
  id,
  effects,
});
const spoken = seen("auh_a_seen_speech");

const SPEECHES: GwAct[] = [
  act("auh_a_s_peoples", "speech", "auh_a_s_peoples_r", 0, {
    once: true,
    when: inWar,
    fields: [
      list(
        "place",
        place("walls", opinion("press", 1)),
        place("pulpits", opinion("court", 1)),
      ),
      list("on", "duty", "peace"),
    ],
    effects: [spoken],
  }),
  act("auh_a_s_budapest", "speech", "auh_a_s_budapest_r", 0, {
    cooldown: 10,
    fields: [
      list(
        "place",
        place("diet", opinion("parliament", 1)),
        place("buda", opinion("court", 1)),
      ),
      list("on", "crown", "bread"),
    ],
    effects: [spoken],
  }),
  act("auh_a_s_prague", "speech", "auh_a_s_prague_r", 0, {
    cooldown: 10,
    fields: [
      list(
        "place",
        place("castle", opinion("court", 1)),
        place("town", opinion("parliament", 1)),
      ),
      list("on", "language", "loyalty"),
    ],
    effects: [spoken],
  }),
  act("auh_a_s_army", "speech", "auh_a_s_army_r", 0, {
    when: inWar,
    cooldown: 8,
    fields: [
      list(
        "place",
        place("order", opinion("army", 1)),
        place("parade", opinion("army", 1), opinion("press", 1)),
      ),
      list("on", "thanks", "tongues"),
    ],
  }),
  act("auh_a_s_vienna", "speech", "auh_a_s_vienna_r", 0, {
    when: world({ is: "war_months", min: 1 }),
    cooldown: 8,
    fields: [
      list(
        "place",
        place("cathedral", opinion("court", 1)),
        place("rathaus", opinion("workers", 1)),
      ),
      list("on", "dead", "bread"),
    ],
    effects: [spoken],
  }),
  act("auh_a_s_house", "speech", "auh_a_s_house_r", 0, {
    when: world({ is: "war_months", min: 5 }),
    once: true,
    fields: [
      list(
        "place",
        place("reichsrat", opinion("parliament", 1), opinion("workers", 1)),
        place("delegations", opinion("parliament", 1)),
      ),
      list("on", "nations", "war"),
    ],
  }),
];

const INTRIGUES: GwAct[] = [
  act("auh_a_i_pair", "intrigue", "auh_a_i_pair_r", 1, {
    cooldown: 6,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [doWorld({ do: "authority", delta: 3 }), inst("council", -1)],
    caught: { pct: 30, scene: "auh_a_i_pair_out", wait: 2 },
  }),
  act("auh_a_i_rumour", "intrigue", "auh_a_i_rumour_r", 1, {
    cooldown: 6,
    fields: [list("story", "hoarders", "berlin_grain", "generals")],
    effects: [{ kind: "rumour", delta: 1 }],
    caught: { pct: 25, scene: "auh_a_i_rumour_out", wait: 2 },
  }),
  act("auh_a_i_agent", "intrigue", "auh_a_i_agent_r", 2, {
    cooldown: 8,
    fields: [
      list(
        "where",
        { id: "bucharest", when: world({ is: "neutral", tag: "ROU" }) },
        { id: "rome", when: world({ is: "neutral", tag: "ITA" }) },
        "salonika",
      ),
    ],
    effects: [
      maybe(picked("where", "bucharest"), reveal("rou_shell_gap")),
      maybe(picked("where", "rome"), reveal("ita_fra_understanding")),
    ],
    caught: { pct: 35, scene: "auh_a_i_agent_out", wait: 2 },
  }),
  act("auh_a_i_swiss", "intrigue", "auh_a_i_swiss_r", 2, {
    when: all(inWar, world({ is: "war_months", own: true, min: 17 })),
    cooldown: 10,
    fields: [list("through", "banker", "prince")],
    effects: [
      mediator,
      doWorld({ do: "report", fact: "morale", tag: "FRA", source: "agents" }),
    ],
    caught: { pct: 40, scene: "auh_a_i_swiss_out", wait: 3 },
  }),
  act("auh_a_i_cipher", "intrigue", "auh_a_i_cipher_r", 1, {
    when: inWar,
    cooldown: 8,
    fields: [
      list(
        "whose",
        {
          id: "rome",
          effects: [doWorld({ do: "inspect", fact: "lean", tag: "ITA" })],
        },
        {
          id: "berlin",
          effects: [inspect("force", "DEU", "east")],
        },
      ),
    ],
    caught: { pct: 25, scene: "auh_a_i_cipher_out", wait: 2 },
  }),
  act("auh_a_i_opposition", "intrigue", "auh_a_i_opposition_r", 1, {
    cooldown: 10,
    effects: [
      { kind: "pride", who: role("pm"), delta: -1 },
      inst("hungary", 1),
    ],
    caught: { pct: 35, scene: "auh_a_i_opposition_out", wait: 2 },
  }),
];

const ceremonyMade = (key: string): GwEffect => ({
  kind: "ruler",
  side: "reputation",
  delta: 1,
  key,
});

/** ww193 의식: the schedule's ceremonies; their scenes are in content/depts. */
const CEREMONIES: GwAct[] = [
  // The Maria Theresa Order to the names the military chancellery listed.
  act("auh_a_c_investiture", "ceremony", "auh_d_c_investiture", 0, {
    when: { kind: "memory", key: AUH_HONOURS_KEY, within: 8 },
    cooldown: 8,
    effects: [opinion("army", 1), ceremonyMade("auh_d_invested")],
  }),
  // The old emperor's funeral, soon after the new reign begins.
  act("auh_a_c_funeral", "ceremony", "auh_d_c_funeral", 0, {
    when: any(
      { kind: "chose", scene: "auh_k_succession", within: 3 },
      { kind: "chose", scene: "auh_k_ff_throne", within: 3 },
    ),
    once: true,
    effects: [opinion("court", 1), ceremonyMade("auh_d_mourned")],
  }),
  act("auh_a_c_review", "ceremony", "auh_d_c_review", 0, {
    when: inWar,
    cooldown: 8,
    effects: [opinion("army", 1), trustOf(role("war"), 1)],
  }),
  act("auh_a_c_service", "ceremony", "auh_d_c_service", 0, {
    when: world({ is: "war_months", min: 2 }),
    cooldown: 10,
    effects: [opinion("court", 1), ceremonyMade("auh_d_prayed")],
  }),
];

export const AUH_ACTS: readonly GwAct[] = [
  ...VISITS,
  ...LETTERS,
  ...ORDERS,
  ...SPEECHES,
  ...INTRIGUES,
  ...CEREMONIES,
];

const noWarLeft = any(peace, world({ is: "armistice" }));
const notLost = not(world({ is: "peace_side", of: ["lost"] }));

export const AUH_AIMS: readonly GwAim[] = [
  {
    id: "auh_aim_serbia",
    nation: NATION,
    met: all(
      world({
        is: "front",
        theatre: "balkan",
        from: "belgrade",
        to: "salonika",
      }),
      notLost,
    ),
    tasks: ["auh_serbia_punished", "auh_galicia_held", "auh_romania_stays_out"],
    dropped: [inst("army", -1)],
  },
  {
    id: "auh_aim_crown",
    nation: NATION,
    when: not(any(karl, ffThrone)),
    met: all(
      any(karl, ffThrone),
      not(world({ is: "out", tag: "AUH" })),
      hungaryAt({ min: 0 }),
    ),
    tasks: ["auh_crown_handed_on", "auh_hungary_with_you", "auh_tisza_stays"],
    dropped: [inst("hungary", -1)],
  },
  {
    id: "auh_aim_peace",
    nation: NATION,
    met: all(noWarLeft, notLost, world({ is: "casualties", max: 1500 })),
    tasks: ["auh_small_lists", "auh_no_third_front", "auh_romania_stays_out"],
    dropped: [gauge("morale", -1)],
  },
  {
    id: "auh_aim_own",
    nation: NATION,
    met: berlinAt({ max: 1 }),
    tasks: ["auh_own_commander", "auh_galicia_held", "auh_no_third_front"],
    dropped: [trust("DEU", 1), inst("army", -1)],
  },
  {
    id: "auh_aim_nations",
    nation: NATION,
    met: all(nationsAt({ min: 1 }), world({ is: "unrest", max: 1 })),
    tasks: [
      "auh_nations_in_the_house",
      "auh_quiet_streets",
      "auh_crown_handed_on",
    ],
    dropped: [inst("nations", -1)],
  },
  {
    id: "auh_aim_bread",
    nation: NATION,
    met: all({ kind: "gauge", gauge: "bread", min: 1 }, hungaryAt({ min: 0 })),
    tasks: [
      "auh_bread_for_vienna",
      "auh_hungary_with_you",
      "auh_quiet_streets",
    ],
    dropped: [gauge("order", -1)],
  },
];
