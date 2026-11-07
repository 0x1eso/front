import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, memory, not } from "@openfront/engine-api/ww1914/SceneDsl";
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
  summons,
  v,
  war,
} from "./ruler_kit";

const NATION: GwScene["nation"] = ["RUS"];
const self = rulerIs("nicholas");
const court = { office: "court" } as const;
const empress = { person: "rus_alexandra" };
const fedorov = { person: "rus_fedorov" };
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;
const chose = (scene: string, pick: string) =>
  ({ kind: "chose", scene, pick }) as const;
const atStavka = any(
  chose("rus_h_heir_stavka", "take_him"),
  chose("rus_h_heir_stavka", "one_week"),
);

/** Nicholas's life. Text in resources/ww1914/ko/RUS.ruler.json. */
export const RULER_RUS: readonly GwScene[] = [
  life({
    id: "rus_life_heir_down",
    nation: NATION,
    kind: "audience",
    when: all(self, low("family", 2)),
    cast: { court, fedorov },
    salience: 7,
    once: false,
    cooldown: 6,
    variants: [v("stavka", atStavka), v("base")],
    fallback: "stay",
    options: [
      opt("stay", [
        ruler("family", 1, "nicholas_stayed"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("to_the_train", [
        { kind: "inst", inst: "stavka", delta: 1 },
        ruler("family", -1, "nicholas_left_bed"),
      ]),
      opt(
        "the_friend",
        [
          ruler("family", 2, "nicholas_called_friend"),
          ruler("reputation", -1, "nicholas_called_friend"),
        ],
        { kind: "memory", key: "k_alex_friend" },
      ),
    ],
  }),
  life({
    id: "rus_life_truth",
    nation: NATION,
    kind: "audience",
    when: all(self, war, memory("k_life_fedorov_asked")),
    cast: { fedorov },
    fallback: "ask_straight",
    options: [
      opt("ask_straight", [
        ruler("family", -1, "nicholas_asked"),
        ruler("conscience", 1, "nicholas_asked"),
        { kind: "remember", key: "k_life_heir_truth" },
      ]),
      opt("not_today"),
    ],
  }),
  life({
    id: "rus_life_diary",
    nation: NATION,
    kind: "audience",
    when: all(self, war, low("conscience", 3)),
    cast: { court },
    once: false,
    cooldown: 12,
    fallback: "the_weather",
    options: [
      opt("the_weather", [ruler("health", 1, "nicholas_diary_weather")]),
      opt("the_day_as_it_was", [
        ruler("conscience", 1, "nicholas_diary_true"),
        ruler("health", -1, "nicholas_diary_true"),
      ]),
    ],
  }),
  life({
    id: "rus_life_nurses",
    nation: NATION,
    kind: "audience",
    when: all(self, war),
    cast: { empress },
    fallback: "let_them",
    options: [
      opt("let_them", [ruler("family", 1, "nicholas_nurses")]),
      opt("ask_her_to_stop", [
        ruler("reputation", 1, "nicholas_stopped_nurses"),
        ruler("family", -1, "nicholas_stopped_nurses"),
      ]),
    ],
  }),
  life({
    id: "rus_life_german_woman",
    nation: NATION,
    kind: "proposal",
    when: all(self, war, date("1915-06", "1917-03")),
    cast: { court, empress },
    tags: ["people", "home"],
    fallback: "say_nothing",
    options: [
      opt("say_nothing", [ruler("reputation", -1, "nicholas_rumour_left")]),
      opt("public_word", [
        ruler("reputation", 1, "nicholas_rumour_answered"),
        ruler("family", -1, "nicholas_rumour_answered"),
      ]),
      opt("take_her_to_moscow", [
        ruler("reputation", 1, "nicholas_moscow"),
        ruler("health", -1, "nicholas_moscow"),
      ]),
    ],
  }),
  life({
    id: "rus_life_her_letter",
    nation: NATION,
    kind: "audience",
    when: all(self, war, { kind: "stage", stage: "war" }),
    cast: { empress },
    once: false,
    cooldown: 10,
    fallback: "warm_answer",
    options: [
      opt("warm_answer", [
        ruler("family", 1, "nicholas_warm_answer"),
        { kind: "inst", inst: "court", delta: 1 },
      ]),
      opt("short_answer", [
        ruler("family", -1, "nicholas_short_answer"),
        { kind: "inst", inst: "ministers", delta: 1 },
      ]),
    ],
  }),
  life({
    id: "rus_life_boy_at_table",
    nation: NATION,
    kind: "audience",
    when: all(self, war, atStavka, not(low("family", 1))),
    cast: { court },
    fallback: "let_him_sit",
    options: [
      opt("let_him_sit", [
        ruler("family", 1, "nicholas_boy_table"),
        ruler("health", 1, "nicholas_boy_table"),
      ]),
      opt("show_him_to_regiment", [
        ruler("reputation", 2, "nicholas_boy_shown"),
        ruler("family", -1, "nicholas_boy_shown"),
      ]),
    ],
  }),
  life({
    id: "rus_life_measles",
    nation: NATION,
    kind: "audience",
    when: all(self, war, date("1917-01", "1917-03")),
    cast: { court, fedorov },
    salience: 7,
    fallback: "stay_a_week",
    options: [
      opt("stay_a_week", [
        ruler("family", 1, "nicholas_measles_stay"),
        { kind: "inst", inst: "stavka", delta: -1 },
      ]),
      opt("to_mogilev", [
        { kind: "inst", inst: "stavka", delta: 1 },
        ruler("family", -1, "nicholas_measles_left"),
      ]),
    ],
  }),

  called({
    id: "rus_life_doctors",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: { fedorov },
    variants: [v("last", lastWarning), v("base")],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "nicholas_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "nicholas_half_rest")]),
      opt("go_on"),
    ],
  }),
  called({
    id: "rus_life_shaken",
    nation: NATION,
    kind: "crisis",
    when: self,
    cast: { court: closeBy },
    variants: [v("last", lastShaken), v("base")],
    fallback: "show_himself",
    options: [
      opt("show_himself", [
        ruler("reputation", 2, "nicholas_showed"),
        ruler("health", -1, "nicholas_showed"),
      ]),
      opt("give_ground", [
        ruler("reputation", 1, "nicholas_gave_ground"),
        { kind: "inst", inst: "duma", delta: 1 },
        { kind: "inst", inst: "court", delta: -1 },
      ]),
      opt("wait"),
    ],
  }),
  called({
    id: "rus_life_broken",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: { empress },
    fallback: "kayak",
    options: [
      opt("kayak", [ruler("health", 1, "nicholas_river")]),
      opt("read_aloud", [ruler("family", 1, "nicholas_read_aloud")]),
      opt("to_the_icon"),
    ],
  }),

  summons({
    id: "rus_life_t_empress",
    nation: NATION,
    person: "rus_alexandra",
    when: all(self, war),
    nodes: {
      open: node([
        reply("ask_boy", "warm", "ask", "boy"),
        reply("ask_her_heart", "frank", "ask", "heart"),
        reply("ask_ministers", "cold", "push", "ministers", [
          { kind: "inst", inst: "court", delta: -1 },
        ]),
        reply("leave", "warm", "leave", null),
      ]),
      boy: node([
        reply("sit_with_her", "warm", "deal", "end", [
          ruler("family", 1, "nicholas_sat_with_her"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      heart: node([
        reply("sit_with_her", "warm", "deal", "end", [
          ruler("family", 1, "nicholas_sat_with_her"),
        ]),
        reply("ask_ministers", "cold", "push", "ministers", [
          { kind: "inst", inst: "court", delta: -1 },
        ]),
      ]),
      ministers: node([reply("close", "cold", "leave", null)]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
  summons({
    id: "rus_life_t_fedorov",
    nation: NATION,
    person: "rus_fedorov",
    when: all(self, low("family", 3), not(memory("k_life_fedorov_asked"))),
    nodes: {
      open: node([
        reply("how_is_he", "warm", "ask", "now"),
        reply("how_long", "frank", "ask", "long", [
          { kind: "remember", key: "k_life_fedorov_asked" },
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      now: node([
        reply("how_long", "frank", "ask", "long", [
          { kind: "remember", key: "k_life_fedorov_asked" },
        ]),
        reply("leave", "warm", "leave", null),
      ]),
      long: node([reply("close", "warm", "leave", null)]),
    },
  }),
];
