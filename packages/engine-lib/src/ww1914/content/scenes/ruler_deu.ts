import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  memory,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  called,
  closeBy,
  date,
  life,
  low,
  node,
  opt,
  reply,
  ruler,
  rulerIs,
  seniorBy,
  summons,
  v,
  war,
} from "./ruler_kit";

const NATION: GwScene["nation"] = ["DEU"];
const self = rulerIs("wilhelm");
const court = { office: "court" } as const;
const chancellor = { office: "chancellor" } as const;
const stage: GwScene["stage"] = ["y1914", "war"];
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;
const pair = flag("f_third_ohl");

/** Wilhelm's life. Text in resources/ww1914/ko/DEU.ruler.json. */
export const RULER_DEU: readonly GwScene[] = [
  life({
    id: "deu_life_photograph",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war),
    cast: { court },
    tags: ["people", "home"],
    fallback: "hilt",
    options: [
      opt("hilt", [ruler("reputation", 1, "wilhelm_photo_hilt")]),
      opt("plain", [
        ruler("reputation", -1, "wilhelm_photo_plain"),
        ruler("conscience", 1, "wilhelm_photo_plain"),
      ]),
      opt("no_picture"),
    ],
  }),
  life({
    id: "deu_life_arm",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, low("health", 3)),
    cast: { court },
    once: false,
    cooldown: 12,
    variants: [v("pair", pair), v("base")],
    fallback: "homburg",
    options: [
      opt("homburg", [
        ruler("health", 1, "wilhelm_homburg"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("ride", [
        ruler("health", -1, "wilhelm_rode"),
        ruler("reputation", 1, "wilhelm_rode"),
      ]),
      opt("say_nothing"),
    ],
  }),
  life({
    id: "deu_life_garter",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(
      self,
      { kind: "at_war", tag: "GBR" },
      { kind: "world", of: { is: "war_months", own: true, min: 9, max: 15 } },
    ),
    cast: { court },
    tags: ["people", "foreign"],
    fallback: "say_nothing",
    options: [
      opt("say_nothing", [ruler("family", 1, "wilhelm_garter_quiet")]),
      opt("answer_in_kind", [
        ruler("reputation", 1, "wilhelm_garter_answered"),
        ruler("family", -1, "wilhelm_garter_answered"),
      ]),
    ],
  }),
  life({
    id: "deu_life_osborne",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, { kind: "at_war", tag: "GBR" }, low("family", 3)),
    cast: { court, empress: { person: "deu_empress" } },
    fallback: "private_room",
    options: [
      opt("leave_it", [
        ruler("family", 1, "wilhelm_portrait_kept"),
        ruler("reputation", -1, "wilhelm_portrait_kept"),
      ]),
      opt("private_room", [ruler("family", 1, "wilhelm_portrait_moved")]),
      opt("take_down", [
        ruler("reputation", 1, "wilhelm_portrait_down"),
        ruler("family", -2, "wilhelm_portrait_down"),
      ]),
    ],
  }),
  life({
    id: "deu_life_front",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, low("reputation", 3)),
    cast: { court },
    once: false,
    cooldown: 7,
    variants: [v("pair", pair), v("base")],
    fallback: "with_camera",
    options: [
      opt("with_camera", [
        ruler("reputation", 2, "wilhelm_seen"),
        ruler("health", -1, "wilhelm_seen"),
      ]),
      opt("unannounced", [
        ruler("reputation", 1, "wilhelm_unannounced"),
        ruler("conscience", 1, "wilhelm_unannounced"),
        ruler("health", -1, "wilhelm_unannounced"),
      ]),
      opt("stay"),
    ],
  }),
  life({
    id: "deu_life_shadow",
    nation: NATION,
    kind: "dispute",
    stage,
    when: all(self, pair),
    cast: { court },
    tags: ["people", "war"],
    fallback: "take_walk",
    options: [
      opt("take_walk", [
        ruler("health", 1, "wilhelm_walked"),
        ruler("reputation", -1, "wilhelm_walked"),
      ]),
      opt("demand_map", [
        { kind: "inst", inst: "army", delta: -1 },
        ruler("reputation", 1, "wilhelm_map"),
      ]),
      opt(
        "plain_question",
        [
          ruler("reputation", 1, "wilhelm_asked"),
          ruler("conscience", 1, "wilhelm_asked"),
        ],
        memory("k_life_muller_told"),
      ),
    ],
  }),
  life({
    id: "deu_life_sons",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, {
      kind: "world",
      of: { is: "war_months", own: true, min: 1, max: 23 },
    }),
    cast: { empress: { person: "deu_empress" } },
    fallback: "leave_them",
    options: [
      opt("leave_them", [
        ruler("reputation", 1, "wilhelm_sons_stay"),
        ruler("family", -1, "wilhelm_sons_stay"),
      ]),
      opt("bring_one_back", [
        ruler("family", 1, "wilhelm_son_back"),
        ruler("reputation", -1, "wilhelm_son_back"),
      ]),
    ],
  }),
  life({
    id: "deu_life_windsor",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(
      self,
      { kind: "at_war", tag: "GBR" },
      { kind: "world", of: { is: "war_months", own: true, min: 35, max: 41 } },
    ),
    cast: { court },
    fallback: "joke",
    options: [
      opt("joke", [ruler("reputation", 1, "wilhelm_joke")]),
      opt("no_joke", [ruler("family", 1, "wilhelm_no_joke")]),
    ],
  }),
  life({
    id: "deu_life_essen",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, {
      kind: "world",
      of: { is: "war_months", own: true, min: 45 },
    }),
    cast: { court, chancellor },
    tags: ["people", "home"],
    variants: [v("hungry", low("reputation", 2)), v("base")],
    fallback: "stay_away",
    options: [
      opt("stay_away"),
      opt("go_to_essen", [
        ruler("health", -1, "wilhelm_essen"),
        ruler("reputation", 2, "wilhelm_essen"),
      ]),
      opt("send_a_message", [ruler("reputation", 1, "wilhelm_message")]),
    ],
  }),

  called({
    id: "deu_life_doctors",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: { court: closeBy },
    variants: [v("last", lastWarning), v("base")],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "wilhelm_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "wilhelm_half_rest")]),
      opt("go_on", [{ kind: "reason", key: "wilhelm_went_on" }]),
    ],
  }),
  called({
    id: "deu_life_shaken",
    nation: NATION,
    kind: "crisis",
    when: self,
    cast: { court: closeBy, chancellor: seniorBy },
    variants: [v("last", lastShaken), v("base")],
    fallback: "show_himself",
    options: [
      opt("show_himself", [
        ruler("reputation", 2, "wilhelm_stood_up"),
        ruler("health", -1, "wilhelm_stood_up"),
      ]),
      opt("give_way", [
        ruler("reputation", 1, "wilhelm_gave_way"),
        { kind: "inst", inst: "reichstag", delta: 1 },
        { kind: "inst", inst: "army", delta: -1 },
      ]),
      opt("wait", [{ kind: "reason", key: "wilhelm_waited" }]),
    ],
  }),
  called({
    id: "deu_life_broken",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: { empress: { person: "deu_empress" } },
    fallback: "sign_on",
    options: [
      opt("sign_on"),
      opt("tell_her", [ruler("family", 1, "wilhelm_told_her")]),
      opt("church", [ruler("reputation", 1, "wilhelm_church")]),
    ],
  }),

  summons({
    id: "deu_life_t_empress",
    nation: NATION,
    person: "deu_empress",
    when: all(self, war, low("conscience", 3), not({ kind: "ruler_broken" })),
    nodes: {
      open: node([
        reply("ask_sons", "warm", "ask", "sons"),
        reply("tell_lists", "frank", "push", "lists", [
          ruler("conscience", 1, "wilhelm_said_it"),
        ]),
        reply("ask_nerve", "cold", "ask", "nerve"),
        reply("leave", "cold", "leave", null),
      ]),
      sons: node([
        reply("promise_letter", "warm", "deal", "end", [
          ruler("family", 1, "wilhelm_wrote_sons"),
        ]),
        reply("back_to_lists", "frank", "push", "lists", [
          ruler("conscience", 1, "wilhelm_said_it"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      lists: node([
        reply("kneel", "frank", "deal", "end", [
          ruler("family", 1, "wilhelm_prayed"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      nerve: node([
        reply("back_to_lists", "frank", "push", "lists", [
          ruler("conscience", 1, "wilhelm_said_it"),
        ]),
        reply("rest_word", "warm", "deal", "end", [
          ruler("health", 1, "wilhelm_slept"),
        ]),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
  summons({
    id: "deu_life_t_muller",
    nation: NATION,
    person: "deu_muller",
    when: all(self, any(pair, date("1916-09", "1918-11"))),
    nodes: {
      open: node([
        reply("who_knew", "cold", "ask", "knew"),
        reply("how_long", "frank", "ask", "long", [
          { kind: "remember", key: "k_life_muller_told" },
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      knew: node([
        reply("how_long", "frank", "ask", "long", [
          { kind: "remember", key: "k_life_muller_told" },
        ]),
        reply("threat", "threat", "push", "stiff", [
          { kind: "person_trust", who: role("who"), delta: -1 },
        ]),
      ]),
      long: node([
        reply("thank", "warm", "deal", "end", [
          { kind: "person_trust", who: role("who"), delta: 1 },
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      stiff: node([reply("close", "cold", "leave", null)]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
];
