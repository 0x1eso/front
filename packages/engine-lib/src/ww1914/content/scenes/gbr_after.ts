import type { GwStage } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCastRule,
  GwCond,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GBR, gauge, inst, opinion, pick, press, trust } from "./gbr_years";

/**
 * GBR's scenes: after the conference (ww190 §10), and after a separate peace
 * (§11). `gbr_aft_ratify` and `gbr_sep_on` are the cards Aftermath.ts lays;
 * each is also gated so it can come only at its own moment, once. Data only;
 * the text is in resources/ww1914/ko/GBR.after.json.
 */

const AFTER: GwStage[] = ["aftermath"];
const after = (min: number, max?: number): GwCond =>
  world({
    is: "after_months",
    min,
    ...(max === undefined ? {} : { max }),
  });
const side = (of: ("won" | "lost" | "even")[]): GwCond =>
  world({ is: "peace_side", of });
const bodies = [
  { id: "won", when: side(["won"]) },
  { id: "lost", when: side(["lost"]) },
  { id: "base" },
];

const fm: GwCastRule = { office: "foreign" };
const home: GwCastRule = { office: "interior" };
const war: GwCastRule = {
  any_of: [{ office: "war" }, { office: "chief_of_staff" }],
};

export const GBR_AFTER_SCENES: readonly GwScene[] = [
  // ---- After the conference ----
  {
    id: "gbr_aft_delegation",
    nation: GBR,
    kind: "proposal",
    stage: AFTER,
    when: after(0, 1),
    cast: { fm },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: bodies,
    fallback: "honest",
    options: [
      pick("gbr_aft_delegation", "triumph", [
        opinion("press", 1),
        gauge("morale", 1),
        trust("FRA", -1),
      ]),
      pick("gbr_aft_delegation", "honest", [gauge("order", 1)]),
      pick("gbr_aft_delegation", "blame", [
        opinion("press", 1),
        trust("FRA", -1),
        trust("USA", -1),
      ]),
    ],
  },
  {
    id: "gbr_aft_ratify",
    nation: GBR,
    kind: "proposal",
    stage: AFTER,
    when: all(
      after(0, 2),
      not(world({ is: "ratified" })),
      not(world({ is: "ratified", no: true })),
    ),
    cast: { fm, court: { office: "court" } },
    salience: 9,
    tags: ["foreign"],
    once: true,
    variants: bodies,
    fallback: "ratify",
    options: [
      pick("gbr_aft_ratify", "ratify", [doWorld({ do: "ratify", yes: true })]),
      pick("gbr_aft_ratify", "refuse", [
        doWorld({ do: "ratify", yes: false }),
        opinion("press", 1),
      ]),
    ],
  },
  {
    id: "gbr_aft_demob",
    nation: GBR,
    kind: "dispute",
    stage: AFTER,
    when: all(after(0), world({ is: "demob", max: 0 })),
    cast: { war, home },
    salience: 8,
    tags: ["home", "war"],
    once: true,
    variants: [
      { id: "unrest", when: { kind: "gauge", gauge: "order", max: 2 } },
      { id: "base" },
    ],
    fallback: "classes",
    options: [
      pick("gbr_aft_demob", "classes", [doWorld({ do: "demob", level: 1 })]),
      pick("gbr_aft_demob", "all_home", [doWorld({ do: "demob", level: 2 })]),
      pick("gbr_aft_demob", "hold", [
        doWorld({ do: "demob", level: 0 }),
        gauge("morale", -1),
      ]),
    ],
  },
  {
    id: "gbr_aft_men_home",
    nation: GBR,
    kind: "dispute",
    stage: AFTER,
    when: all(after(1), world({ is: "demob", min: 1 })),
    cast: { war, home },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      { id: "all_at_once", when: world({ is: "demob", min: 2 }) },
      { id: "base" },
    ],
    fallback: "ships",
    options: [
      pick("gbr_aft_men_home", "ships", [
        gauge("money", -1),
        gauge("order", 1),
      ]),
      pick("gbr_aft_men_home", "courts", [
        gauge("order", 1),
        gauge("morale", -1),
        opinion("workers", -1),
      ]),
      pick("gbr_aft_men_home", "homes", [
        gauge("money", -1),
        gauge("morale", 1),
        opinion("workers", 1),
      ]),
    ],
  },
  {
    id: "gbr_aft_year",
    nation: GBR,
    kind: "proposal",
    stage: AFTER,
    when: after(2),
    cast: {
      home,
      irl: { any_of: [{ office: "ireland" }, { office: "interior" }] },
    },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      { id: "ireland", when: { kind: "pressure", topic: "ireland", min: 4 } },
      { id: "base" },
    ],
    fallback: "let_be",
    options: [
      pick("gbr_aft_year", "talks", [press("ireland", -1), inst("irish", 1)]),
      pick("gbr_aft_year", "firm", [
        gauge("order", 1),
        press("ireland", 1),
        inst("irish", -1),
      ]),
      pick("gbr_aft_year", "let_be", [gauge("order", -1)]),
    ],
  },

  // ---- After a separate peace ----
  {
    id: "gbr_sep_on",
    nation: GBR,
    kind: "proposal",
    when: all(
      world({ is: "war" }),
      world({ is: "out", tag: "GBR" }),
      not(world({ is: "beaten", tag: "GBR" })),
      not(world({ is: "left_war", min: 0 })),
    ),
    cast: { fm },
    salience: 9,
    tags: ["foreign", "home"],
    once: true,
    variants: [{ id: "base" }],
    fallback: "go_on",
    options: [
      pick("gbr_sep_on", "go_on", [doWorld({ do: "play_on", on: true })]),
      pick("gbr_sep_on", "close", [doWorld({ do: "play_on", on: false })]),
    ],
  },
  {
    id: "gbr_sep_anger",
    nation: GBR,
    kind: "dispute",
    when: world({ is: "left_war", min: 1 }),
    cast: { fm, war },
    salience: 7,
    tags: ["foreign", "home"],
    once: true,
    variants: [
      { id: "paris_fights", when: world({ is: "entered", tag: "FRA" }) },
      { id: "base" },
    ],
    fallback: "welcome",
    options: [
      pick("gbr_sep_anger", "welcome", [gauge("morale", 1), trust("FRA", -1)]),
      pick("gbr_sep_anger", "paris", [trust("FRA", 1), gauge("money", -1)]),
      pick("gbr_sep_anger", "trade", [
        doWorld({ do: "budget_item", item: "treasury", pct: 5 }),
        trust("FRA", -1),
        trust("DEU", 1),
      ]),
    ],
  },
];
