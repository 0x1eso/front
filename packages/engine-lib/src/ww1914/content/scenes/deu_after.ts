// Great War 1914 (ww190 §10-11): Germany after the conference, and Germany
// after a peace of its own while the great war goes on. Owned by the DEU
// writer lane. The texts don't name the head of state: the empire may have
// become a republic by then. Text in resources/ww1914/ko/DEU.after.json.
//
// `deu_aft_ratify` and `deu_sep_on` are S1's scheduled cards (ww190
// interfaces). They are drawn here too, once, by their own state, so they
// pass the content check before the merge lists them as called.
import type {
  GwCond,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  act,
  bondBy,
  card,
  gauge,
  holder,
  inst,
  opinion,
  treasury,
  trust,
  trusts,
  v,
  w,
  worldWar,
} from "./deu_years";

const chancellor = holder("chancellor");
const foreign = holder("foreign");
const war = holder("war");
const cos = holder("chief_of_staff");
const interior = holder("interior");

const AFTER: GwScene["stage"] = ["aftermath"];
const TAGS: GwScene["tags"] = ["home", "foreign"];

const side = (...of: ("won" | "lost" | "even")[]): GwCond =>
  w({ is: "peace_side", of });
/** The treaty, as Germany came out of it. */
const bySide: GwVariant[] = [
  v("won", side("won")),
  v("lost", side("lost")),
  v("base"),
];

const AFTERMATH: GwScene[] = [
  card({
    id: "deu_aft_delegation",
    stage: AFTER,
    when: w({ is: "after_months", max: 1 }),
    cast: { foreign, chancellor },
    salience: 8,
    tags: TAGS,
    once: true,
    variants: bySide,
    options: (p) => [
      p("quiet", gauge("order", 1)),
      p("praise", gauge("morale", 1), opinion("press", 1), gauge("money", -1)),
      p("blame", trusts("foreign", -2), opinion("army", 1)),
    ],
  }),
  card({
    id: "deu_aft_ratify",
    stage: AFTER,
    when: all(not(w({ is: "ratified" })), not(w({ is: "ratified", no: true }))),
    cast: { chancellor, foreign },
    salience: 9,
    tags: TAGS,
    once: true,
    variants: bySide,
    options: (p) => [
      p("yes", act({ do: "ratify", yes: true })),
      p("no", act({ do: "ratify", yes: false }), opinion("army", 1)),
    ],
  }),
  card({
    id: "deu_aft_demob",
    stage: AFTER,
    when: w({ is: "demob", max: 0 }),
    cast: { war, cos },
    salience: 8,
    tags: ["home", "war"],
    once: true,
    variants: [v("lost", side("lost")), v("base")],
    options: (p) => [
      p("classes", act({ do: "demob", level: 1 })),
      p("all", act({ do: "demob", level: 2 })),
      p(
        "hold",
        act({ do: "demob", level: 0 }),
        inst("army", 1),
        gauge("money", -1),
      ),
    ],
  }),
  card({
    id: "deu_aft_home",
    stage: AFTER,
    when: w({ is: "after_months", min: 1 }),
    cast: { interior, war },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: bySide,
    options: (p) => [
      p("quiet", opinion("army", -1)),
      p("parade", gauge("morale", 1), gauge("money", -1)),
      p("jobs", gauge("money", -1), gauge("order", 1)),
    ],
  }),
  card({
    id: "deu_aft_year",
    stage: AFTER,
    when: w({ is: "after_months", min: 2 }),
    cast: { interior, chancellor },
    salience: 8,
    tags: ["home"],
    once: true,
    variants: [
      v("unrest", w({ is: "unrest", min: 2 })),
      v("lost", side("lost")),
      v("base"),
    ],
    options: (p) => [
      p("wait", gauge("order", -1)),
      p("order", gauge("order", 1), inst("army", 1), opinion("workers", -1)),
      p(
        "reform",
        opinion("parliament", 1),
        opinion("workers", 1),
        inst("army", -1),
      ),
    ],
  }),
];

/** Germany left the war by its own peace, unbeaten, while the war goes on. */
const leftAlone: GwCond = all(
  w({ is: "out", tag: "DEU" }),
  not(w({ is: "beaten", tag: "DEU" })),
  not(w({ is: "armistice" })),
  worldWar,
  w({ is: "unrest", max: 2 }),
  not(w({ is: "left_war" })),
);

const SEPARATE: GwScene[] = [
  card({
    id: "deu_sep_on",
    when: leftAlone,
    cast: { chancellor, foreign },
    salience: 9,
    tags: ["foreign", "home"],
    once: true,
    options: (p) => [
      p("go_on", act({ do: "play_on", on: true })),
      p("close", act({ do: "play_on", on: false })),
    ],
  }),
  card({
    id: "deu_sep_home",
    when: w({ is: "left_war", min: 1 }),
    cast: { foreign, war },
    salience: 7,
    tags: ["foreign", "home"],
    once: true,
    variants: [v("base")],
    options: (p) => [
      p("soothe", bondBy("AUH", 1), gauge("money", -1)),
      p("trade", treasury(3), bondBy("AUH", -1)),
      p("turn", trust("GBR", 1), trust("FRA", 1), bondBy("AUH", -2)),
    ],
  }),
];

export const DEU_AFTER_SCENES: readonly GwScene[] = [...AFTERMATH, ...SEPARATE];
