import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, memory, not } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  called,
  closeBy,
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

const NATION: GwScene["nation"] = ["AUH"];
const fj = rulerIs("franz_joseph");
const karl = rulerIs("karl");
const heirs = rulerIs("karl", "franz_ferdinand");
const anyone = rulerIs("franz_joseph", "karl", "franz_ferdinand");
const court = { office: "court" } as const;
const zita = { person: "auh_zita" };
const schratt = { person: "auh_schratt" };
const ketterl = { person: "auh_ketterl" };
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;

/** Franz Joseph's life, then Karl's. Text in resources/ww1914/ko/AUH.ruler.json. */
export const RULER_AUH: readonly GwScene[] = [
  life({
    id: "auh_life_half_past_three",
    nation: NATION,
    kind: "audience",
    when: all(fj, low("health", 3)),
    cast: { ketterl },
    once: false,
    cooldown: 12,
    fallback: "as_always",
    options: [
      opt("as_always", [
        ruler("health", -1, "franz_joseph_rose"),
        ruler("reputation", 1, "franz_joseph_rose"),
      ]),
      opt(
        "an_hour_more",
        [
          ruler("health", 2, "franz_joseph_slept"),
          { kind: "audiences", delta: -1 },
        ],
        memory("k_life_ketterl_hour"),
      ),
      opt("fewer_files", [
        ruler("health", 1, "franz_joseph_fewer"),
        { kind: "audiences", delta: -1 },
      ]),
    ],
  }),
  life({
    id: "auh_life_breakfast",
    nation: NATION,
    kind: "audience",
    when: all(fj, war),
    cast: { schratt },
    once: false,
    cooldown: 14,
    fallback: "go",
    options: [
      opt("go", [ruler("family", 1, "franz_joseph_breakfast")]),
      opt("files_first"),
    ],
  }),
  life({
    id: "auh_life_crypt",
    nation: NATION,
    kind: "audience",
    // Mayerling's day, 30 January: the text names it, so the card keeps January.
    when: all(
      fj,
      war,
      { kind: "world", of: { is: "war_months", own: true, min: 5, max: 28 } },
      { kind: "world", of: { is: "month", of: [1] } },
    ),
    cast: { court },
    fallback: "go_down",
    options: [
      opt("go_down", [
        ruler("conscience", 1, "franz_joseph_crypt"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("send_the_wreath"),
    ],
  }),
  life({
    id: "auh_life_is_he_alive",
    nation: NATION,
    kind: "proposal",
    when: all(fj, war, low("reputation", 4)),
    cast: { court },
    tags: ["people", "home"],
    once: false,
    cooldown: 10,
    fallback: "open_carriage",
    options: [
      opt("open_carriage", [
        ruler("reputation", 2, "franz_joseph_drove"),
        ruler("health", -1, "franz_joseph_drove"),
      ]),
      opt("a_photograph", [ruler("reputation", 1, "franz_joseph_picture")]),
      opt("no_answer"),
    ],
  }),
  life({
    id: "auh_life_valerie",
    nation: NATION,
    kind: "audience",
    when: all(fj, low("family", 3), low("health", 2)),
    cast: { court },
    fallback: "let_her_stay",
    options: [
      opt("let_her_stay", [
        ruler("family", 2, "franz_joseph_valerie"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("send_her_home", [ruler("family", -1, "franz_joseph_sent_her")]),
    ],
  }),
  life({
    id: "auh_life_italian",
    nation: NATION,
    kind: "audience",
    when: all(karl, war),
    cast: { zita },
    fallback: "stand_by_her",
    options: [
      opt("stand_by_her", [
        ruler("family", 1, "karl_stood_by"),
        ruler("reputation", -1, "karl_stood_by"),
      ]),
      opt("keep_her_from_table", [
        ruler("reputation", 1, "karl_kept_her_out"),
        ruler("family", -2, "karl_kept_her_out"),
      ]),
    ],
  }),
  life({
    id: "auh_life_train",
    nation: NATION,
    kind: "proposal",
    when: all(karl, war, low("reputation", 3)),
    cast: { court },
    once: false,
    cooldown: 6,
    fallback: "go_to_the_front",
    options: [
      opt("go_to_the_front", [
        ruler("reputation", 2, "karl_at_front"),
        ruler("health", -1, "karl_at_front"),
      ]),
      opt("stay_at_baden", [ruler("family", 1, "karl_at_baden")]),
    ],
  }),

  called({
    id: "auh_life_doctors",
    nation: NATION,
    kind: "audience",
    when: anyone,
    cast: { court: closeBy },
    variants: [
      v("old_last", all(fj, lastWarning)),
      v("old", fj),
      v("last", lastWarning),
      v("base"),
    ],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "auh_life_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "auh_life_half_rest")]),
      opt("go_on", [{ kind: "reason", key: "auh_life_went_on" }]),
    ],
  }),
  called({
    id: "auh_life_shaken",
    nation: NATION,
    kind: "crisis",
    when: heirs,
    cast: { court: closeBy },
    variants: [v("last", lastShaken), v("base")],
    fallback: "show_himself",
    options: [
      opt("show_himself", [
        ruler("reputation", 2, "auh_life_showed"),
        ruler("health", -1, "auh_life_showed"),
      ]),
      opt("give_ground", [
        ruler("reputation", 1, "auh_life_gave_ground"),
        { kind: "inst", inst: "hungary", delta: 1 },
      ]),
      opt("wait", [{ kind: "reason", key: "auh_life_waited" }]),
    ],
  }),
  called({
    id: "auh_life_broken",
    nation: NATION,
    kind: "audience",
    when: anyone,
    cast: { court: closeBy },
    variants: [v("old", fj), v("base")],
    fallback: "next_file",
    options: [
      opt("next_file"),
      opt("mass", [ruler("health", 1, "auh_life_mass")]),
      opt("family_table", [ruler("family", 1, "auh_life_table")]),
    ],
  }),

  summons({
    id: "auh_life_t_schratt",
    nation: NATION,
    person: "auh_schratt",
    when: all(fj, war),
    nodes: {
      open: node([
        reply("ask_vienna", "warm", "ask", "vienna"),
        reply("speak_of_dead", "frank", "push", "dead", [
          ruler("conscience", 1, "franz_joseph_said_it"),
        ]),
        reply("leave", "warm", "leave", null),
      ]),
      vienna: node([
        reply("thank", "warm", "deal", "end", [
          ruler("family", 1, "franz_joseph_breakfast"),
        ]),
        reply("speak_of_dead", "frank", "push", "dead", [
          ruler("conscience", 1, "franz_joseph_said_it"),
        ]),
      ]),
      dead: node([
        reply("thank", "warm", "deal", "end", [
          ruler("family", 1, "franz_joseph_breakfast"),
        ]),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
  summons({
    id: "auh_life_t_ketterl",
    nation: NATION,
    person: "auh_ketterl",
    when: all(fj, low("health", 3), not(memory("k_life_ketterl_hour"))),
    nodes: {
      open: node([
        reply("what_is_it", "cold", "ask", "tell"),
        reply("are_you_tired", "warm", "ask", "tired"),
        reply("leave", "cold", "leave", null),
      ]),
      tell: node([
        reply("half_an_hour", "frank", "deal", "end", [
          { kind: "remember", key: "k_life_ketterl_hour" },
        ]),
        reply("no_change", "cold", "leave", null),
      ]),
      tired: node([
        reply("half_an_hour", "frank", "deal", "end", [
          { kind: "remember", key: "k_life_ketterl_hour" },
        ]),
        reply("no_change", "cold", "leave", null),
      ]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
];
