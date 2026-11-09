// The President's card (GW_RULERS.FRA, id "poincare"): fra_life_doctors,
// fra_life_shaken, fra_life_broken and the front-visit rhythm. Words in
// ./ruler_kit.ts. Text in resources/ww1914/ko/FRA.ruler.json. Lane W5.
//
// The card keeps to the office: the front, the hospitals, the lists, the
// nights, the attacks in the papers. His wife, his brother, the house at
// Sampigny and the diary are the private share's (W9), not here.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, flag, memory, role } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
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

const NATION: GwScene["nation"] = ["FRA"];
const self = rulerIs("poincare");
const stage: GwScene["stage"] = ["y1914", "war"];
const tiger = flag("f_pm_clemenceau");
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;
const near = { who: closeBy };

/** Poincaré's card. Text in resources/ww1914/ko/FRA.ruler.json. */
export const RULER_FRA: readonly GwScene[] = [
  // The rhythm of the office: the Élysée, then Bar-le-Duc, then Verdun.
  life({
    id: "fra_life_front",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war),
    cast: near,
    once: false,
    cooldown: 5,
    tags: ["people", "war"],
    variants: [v("tiger", tiger), v("base")],
    fallback: "go_front",
    options: [
      opt("go_front", [
        ruler("reputation", 1, "poincare_front"),
        ruler("health", -1, "poincare_front"),
      ]),
      opt("hospitals", [
        ruler("conscience", 1, "poincare_wards"),
        ruler("health", -1, "poincare_wards"),
      ]),
      opt("stay_paris", [ruler("health", 1, "poincare_stayed")]),
      opt(
        "a_week_off",
        [
          ruler("health", 2, "poincare_week_off"),
          { kind: "audiences", delta: -1 },
        ],
        memory("k_life_bourgeois_rest"),
      ),
    ],
  }),
  life({
    id: "fra_life_wards",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war, world({ is: "casualties", min: 300 })),
    cast: near,
    fallback: "every_bed",
    options: [
      opt("every_bed", [
        ruler("conscience", 1, "poincare_every_bed"),
        ruler("health", -1, "poincare_every_bed"),
      ]),
      opt("decorations", [
        ruler("reputation", 1, "poincare_decorated"),
        ruler("conscience", -1, "poincare_decorated"),
      ]),
    ],
  }),
  life({
    id: "fra_life_lists",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, date("1914-09", "1916-12")),
    cast: near,
    fallback: "read_all",
    options: [
      opt("read_all", [
        ruler("conscience", 1, "poincare_read_lists"),
        ruler("health", -1, "poincare_read_lists"),
      ]),
      opt("meuse_only", [ruler("conscience", -1, "poincare_meuse_only")]),
      opt("letters_home", [
        ruler("conscience", 1, "poincare_wrote_home"),
        { kind: "audiences", delta: -1 },
      ]),
    ],
  }),
  life({
    id: "fra_life_nights",
    nation: NATION,
    kind: "audience",
    stage,
    when: all(self, war, low("health", 3)),
    cast: near,
    fallback: "sleep",
    options: [
      opt("sleep", [
        ruler("health", 1, "poincare_slept"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("papers_till_two", [
        ruler("health", -1, "poincare_papers_at_night"),
        ruler("reputation", 1, "poincare_papers_at_night"),
      ]),
    ],
  }),
  life({
    id: "fra_life_tiger_pen",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, date("1914-10", "1917-10")),
    cast: near,
    fallback: "no_answer",
    options: [
      opt("no_answer", [ruler("reputation", -1, "poincare_no_answer")]),
      opt("friend_answers", [
        ruler("reputation", 1, "poincare_friend_answered"),
        ruler("health", -1, "poincare_friend_answered"),
      ]),
      opt("invite_him", [
        ruler("reputation", 1, "poincare_invited_tiger"),
        ruler("conscience", -1, "poincare_invited_tiger"),
      ]),
    ],
  }),
  life({
    id: "fra_life_unsent",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, date("1915-01", "1918-11")),
    cast: near,
    variants: [v("tiger", tiger), v("base")],
    fallback: "drawer",
    options: [
      opt("drawer", [ruler("health", -1, "poincare_drawer")]),
      opt("send_it", [
        ruler("conscience", 1, "poincare_sent_letter"),
        { kind: "inst", inst: "countersign", delta: -1 },
      ]),
      opt("tear_it", [ruler("health", 1, "poincare_tore_letter")]),
    ],
  }),
  life({
    id: "fra_life_meuse",
    nation: NATION,
    kind: "proposal",
    stage,
    when: all(self, war, date("1916-02", "1916-12")),
    cast: near,
    salience: 7,
    fallback: "go_bar",
    options: [
      opt("go_bar", [
        ruler("reputation", 1, "poincare_went_meuse"),
        ruler("health", -1, "poincare_went_meuse"),
      ]),
      opt("refugees", [
        ruler("conscience", 1, "poincare_meuse_refugees"),
        { kind: "gauge", gauge: "money", delta: -1 },
      ]),
      opt("no_favour", [ruler("reputation", 1, "poincare_no_favour")]),
    ],
  }),

  called({
    id: "fra_life_doctors",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: near,
    variants: [v("last", lastWarning), v("tiger", tiger), v("base")],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "fra_life_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "fra_life_half_rest")]),
      opt("go_on", [{ kind: "reason", key: "fra_life_went_on" }]),
    ],
  }),
  called({
    id: "fra_life_shaken",
    nation: NATION,
    kind: "crisis",
    when: self,
    cast: near,
    variants: [v("last", lastShaken), v("tiger", tiger), v("base")],
    fallback: "message",
    options: [
      opt("message", [
        ruler("reputation", 2, "fra_life_message"),
        ruler("health", -1, "fra_life_message"),
      ]),
      opt("leaders", [
        ruler("reputation", 1, "fra_life_leaders"),
        { kind: "inst", inst: "chamber", delta: 1 },
      ]),
      opt("wait", [{ kind: "reason", key: "fra_life_waited" }]),
    ],
  }),
  called({
    id: "fra_life_broken",
    nation: NATION,
    kind: "audience",
    when: self,
    cast: near,
    variants: [v("tiger", tiger), v("base")],
    fallback: "carry_on",
    options: [
      opt("carry_on"),
      opt("walk", [ruler("health", 1, "fra_life_walked")]),
      opt("write_names", [ruler("conscience", 1, "fra_life_names")]),
    ],
  }),

  summons({
    id: "fra_life_t_barthou",
    nation: NATION,
    person: "fra_barthou",
    when: all(self, war),
    nodes: {
      open: node([
        reply("ask_paris", "warm", "ask", "paris"),
        reply("ask_me", "frank", "ask", "me"),
        reply("busy", "cold", "push", "cool", [
          { kind: "person_trust", who: role("who"), delta: -1 },
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      paris: node([
        reply("who_says", "cold", "ask", "names"),
        reply("thank", "warm", "deal", "end", [
          ruler("reputation", 1, "poincare_heard_barthou"),
        ]),
      ]),
      names: node([
        reply("thank", "warm", "deal", "end", [
          ruler("reputation", 1, "poincare_heard_barthou"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      me: node([
        reply("admit", "frank", "deal", "end", [
          ruler("health", 1, "poincare_admitted"),
          ruler("conscience", 1, "poincare_admitted"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      cool: node([reply("close", "cold", "leave", null)]),
      end: node([reply("close", "warm", "leave", null)]),
    },
  }),
  summons({
    id: "fra_life_t_bourgeois",
    nation: NATION,
    person: "fra_bourgeois",
    when: all(self, war, low("health", 3)),
    nodes: {
      open: node([
        reply("how_long", "frank", "ask", "long"),
        reply("after_war", "warm", "ask", "after"),
        reply("leave", "cold", "leave", null),
      ]),
      long: node([
        reply("what_then", "warm", "deal", "rest", [
          { kind: "remember", key: "k_life_bourgeois_rest" },
        ]),
        reply("threat", "threat", "push", "stiff", [
          { kind: "person_trust", who: role("who"), delta: -1 },
        ]),
      ]),
      after: node([
        reply("what_then", "warm", "deal", "rest", [
          { kind: "remember", key: "k_life_bourgeois_rest" },
          ruler("conscience", 1, "poincare_after_war"),
        ]),
        reply("leave", "cold", "leave", null),
      ]),
      rest: node([reply("close", "warm", "leave", null)]),
      stiff: node([reply("close", "cold", "leave", null)]),
    },
  }),
];
