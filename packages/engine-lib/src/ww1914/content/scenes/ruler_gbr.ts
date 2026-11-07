import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, memory, role } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  called,
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

const NATION: GwScene["nation"] = ["GBR"];
const self = rulerIs("asquith");
const anyone = rulerIs("asquith", "lloyd_george");
const lg = rulerIs("lloyd_george");
const stage: GwScene["stage"] = ["y1914", "war"];
const margot = { person: "gbr_margot" };
const hankey = { person: "gbr_hankey" };
const seen = (scene: string) => ({ kind: "seen", scene }) as const;
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;

/** Asquith's life. Text in resources/ww1914/ko/GBR.ruler.json. */
export const RULER_GBR: readonly GwScene[] = [
  life({
    id: "gbr_life_table",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war, date("1914-10", "1916-10")),
    cast: { margot },
    tags: ["people", "home"],
    fallback: "let_her",
    options: [
      opt("let_her", [
        ruler("family", 1, "asquith_let_her"),
        ruler("reputation", -1, "asquith_let_her"),
      ]),
      opt("have_a_word", [
        ruler("reputation", 1, "asquith_had_word"),
        ruler("family", -1, "asquith_had_word"),
      ]),
      opt("change_the_guests"),
    ],
  }),
  life({
    id: "gbr_life_donington",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, date("1915-05", "1916-03")),
    cast: { margot },
    tags: ["people", "home"],
    fallback: "go_to_court",
    options: [
      opt("go_to_court", [
        ruler("reputation", 1, "asquith_libel"),
        ruler("family", 1, "asquith_libel"),
        { kind: "gauge", gauge: "morale", delta: -1 },
      ]),
      opt("no_answer", [ruler("reputation", -1, "asquith_no_answer")]),
    ],
  }),
  life({
    id: "gbr_life_weekend",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war),
    cast: {},
    once: false,
    cooldown: 10,
    fallback: "the_wharf",
    options: [
      opt("the_wharf", [
        ruler("health", 1, "asquith_wharf"),
        ruler("reputation", -1, "asquith_wharf"),
      ]),
      opt("stay_in_town", [
        ruler("reputation", 1, "asquith_in_town"),
        ruler("health", -1, "asquith_in_town"),
      ]),
      opt(
        "one_week_off",
        [
          ruler("health", 2, "asquith_week"),
          { kind: "audiences", delta: -1 },
        ],
        memory("k_life_hankey_week"),
      ),
    ],
  }),
  life({
    id: "gbr_life_decanter",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war, low("health", 3)),
    cast: { margot },
    fallback: "water",
    options: [
      opt("water", [
        ruler("health", 1, "asquith_water"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("as_usual", [
        ruler("health", -1, "asquith_decanter"),
        ruler("family", 1, "asquith_decanter"),
      ]),
    ],
  }),
  life({
    id: "gbr_life_letters_after",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, seen("gbr_h_engagement")),
    cast: { margot },
    fallback: "to_margot",
    options: [
      opt("to_margot", [ruler("family", 2, "asquith_to_margot")]),
      opt("another_friend", [
        ruler("health", 1, "asquith_new_letters"),
        ruler("family", -1, "asquith_new_letters"),
      ]),
      opt("no_more_letters", [ruler("conscience", 1, "asquith_no_letters")]),
    ],
  }),
  life({
    id: "gbr_life_sons",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war, date("1915-02", "1916-08")),
    cast: { margot },
    fallback: "leave_him",
    options: [
      opt("leave_him", [
        ruler("reputation", 1, "asquith_son_stays"),
        ruler("family", -1, "asquith_son_stays"),
      ]),
      opt("quiet_word", [
        ruler("family", 1, "asquith_son_staff"),
        ruler("conscience", -1, "asquith_son_staff"),
      ]),
    ],
  }),
  life({
    id: "gbr_life_after_raymond",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, seen("gbr_h_raymond")),
    cast: { margot },
    salience: 7,
    fallback: "cabinet_on_monday",
    options: [
      opt("cabinet_on_monday", [
        ruler("reputation", 1, "asquith_went_back"),
        ruler("health", -1, "asquith_went_back"),
      ]),
      opt("a_week_at_walmer", [
        ruler("family", 1, "asquith_walmer"),
        ruler("health", 1, "asquith_walmer"),
        { kind: "audiences", delta: -1 },
      ]),
    ],
  }),

  called({
    id: "gbr_life_doctors",
    nation: NATION,
    kind: "audience",
    when: anyone,
    cast: { hankey },
    variants: [v("last", lastWarning), v("lg", lg), v("base")],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "gbr_life_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "gbr_life_half_rest")]),
      opt("go_on"),
    ],
  }),
  called({
    id: "gbr_life_shaken",
    nation: NATION,
    kind: "crisis",
    when: anyone,
    cast: { hankey },
    variants: [v("last", lastShaken), v("lg", lg), v("base")],
    fallback: "speak_in_house",
    options: [
      opt("speak_in_house", [
        ruler("reputation", 2, "gbr_life_spoke"),
        ruler("health", -1, "gbr_life_spoke"),
      ]),
      opt("give_ground", [
        ruler("reputation", 1, "gbr_life_gave_ground"),
        { kind: "inst", inst: "opposition", delta: -1 },
      ]),
      opt("wait"),
    ],
  }),
  called({
    id: "gbr_life_broken",
    nation: NATION,
    kind: "audience",
    when: anyone,
    cast: { hankey },
    variants: [v("lg", lg), v("base")],
    fallback: "carry_on",
    options: [
      opt("carry_on"),
      opt("read_something", [ruler("health", 1, "gbr_life_read")]),
      opt("go_home", [ruler("family", 1, "gbr_life_home")]),
    ],
  }),

  summons({
    id: "gbr_life_t_margot",
    nation: NATION,
    person: "gbr_margot",
    when: all(self, war),
    nodes: {
      open: node([
        reply("ask_town", "warm", "ask", "town"),
        reply("ask_sleep", "frank", "ask", "sleep"),
        reply("quiet", "cold", "push", "hurt", [
          ruler("family", -1, "asquith_quieted_her"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      town: node([
        reply("who_says", "cold", "ask", "names"),
        reply("thank", "warm", "deal", "end", [
          ruler("family", 1, "asquith_listened"),
        ]),
      ]),
      names: node([
        reply("thank", "warm", "deal", "end", [
          ruler("family", 1, "asquith_listened"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      sleep: node([
        reply("admit", "frank", "deal", "end", [
          ruler("family", 1, "asquith_listened"),
          ruler("conscience", 1, "asquith_admitted"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      hurt: node([reply("close", "cold", "leave", null)]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
  summons({
    id: "gbr_life_t_hankey",
    nation: NATION,
    person: "gbr_hankey",
    when: all(self, war, low("health", 3)),
    nodes: {
      open: node([
        reply("how_do_i_look", "frank", "ask", "look"),
        reply("how_many_hours", "cold", "ask", "hours"),
        reply("leave", "cold", "leave", null),
      ]),
      look: node([
        reply("what_then", "warm", "deal", "week", [
          { kind: "remember", key: "k_life_hankey_week" },
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      hours: node([
        reply("what_then", "warm", "deal", "week", [
          { kind: "remember", key: "k_life_hankey_week" },
        ]),
        reply("threat", "threat", "push", "stiff", [
          { kind: "person_trust", who: role("who"), delta: -1 },
        ]),
      ]),
      week: node([reply("close", "warm", "leave", null)]),
      stiff: node([reply("close", "cold", "leave", null)]),
    },
  }),
];
