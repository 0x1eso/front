import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  dw,
  gauge,
  held,
  inst,
  o,
  opinion,
  rusScene,
  trust,
  v,
  w,
} from "./rus_years";

/**
 * RUS's scenes: the conference and after (ww190 §10, `rus_aft_*`: the
 * delegation, ratification, demobilisation, the men home, the year after) and
 * after a separate peace (§11, `rus_sep_*`: the card itself, the men home and
 * the old ally's anger). The ratification and the separate-peace card are
 * also dealt by state, so they stand without S1's scheduling. Text:
 * resources/ww1914/ko/RUS.after.json.
 */

const after = (min: number): GwCond => w({ is: "after_months", min });
const side = (of: ("won" | "lost" | "even")[]): GwCond =>
  w({ is: "peace_side", of });

const FOREIGN = { foreign: held("foreign") };
const WAR = { war: held("war") };
const PM = { pm: held("chancellor") };

const AFTER: GwScene[] = [
  rusScene("rus_aft_delegation", {
    kind: "proposal",
    stage: ["conference"],
    when: w({ is: "armistice" }),
    cast: { ...FOREIGN },
    salience: 7,
    tags: ["foreign"],
    once: true,
    variants: [
      v(
        "won",
        all(side(["won"]), w({ is: "entered", tag: "RUS", side: "entente" })),
      ),
      v("lost", side(["lost"])),
      v("base"),
    ],
    options: [
      o("firm", [opinion("press", 1), trust("GBR", -1), trust("FRA", -1)]),
      o("bend", [trust("GBR", 1), trust("FRA", 1), opinion("press", -1)]),
      o("home_first", [gauge("order", 1), opinion("army", -1)]),
    ],
  }),
  rusScene("rus_aft_ratify", {
    kind: "proposal",
    stage: ["aftermath"],
    when: all(
      after(0),
      not(w({ is: "ratified", tag: "RUS" })),
      not(w({ is: "ratified", tag: "RUS", no: true })),
    ),
    cast: { ...PM, ...FOREIGN },
    salience: 8,
    tags: ["foreign", "home"],
    once: true,
    variants: [v("lost", side(["lost"])), v("base")],
    options: [
      o("yes", [dw({ do: "ratify", yes: true })]),
      o("no", [dw({ do: "ratify", yes: false }), opinion("press", 1)]),
    ],
    fallback: "yes",
  }),
  rusScene("rus_aft_demob", {
    kind: "proposal",
    stage: ["aftermath"],
    when: after(0),
    cast: { ...WAR },
    salience: 7,
    tags: ["home", "war"],
    once: true,
    variants: [v("base")],
    options: [
      o("by_classes", [dw({ do: "demob", level: 1 })]),
      o("all_at_once", [dw({ do: "demob", level: 2 })]),
      o("hold", [dw({ do: "demob", level: 0 }), inst("stavka", 1)]),
    ],
    fallback: "by_classes",
  }),
  rusScene("rus_aft_home", {
    kind: "wire",
    stage: ["aftermath"],
    when: after(1),
    cast: { ...WAR },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      v("all", w({ is: "demob", min: 2 })),
      v("held", w({ is: "demob", max: 0 })),
      v("base"),
    ],
  }),
  rusScene("rus_aft_year", {
    kind: "proposal",
    stage: ["aftermath"],
    when: after(2),
    cast: { ...PM },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [v("won", side(["won"])), v("base")],
    options: [
      o("land", [gauge("bread", 1), inst("court", -1)]),
      o("rails", [gauge("money", -1), gauge("morale", 1)]),
      o("army", [inst("stavka", 1), gauge("money", -1)]),
    ],
  }),
];

const SEPARATE: GwScene[] = [
  rusScene("rus_sep_on", {
    kind: "proposal",
    when: all(
      w({ is: "out", tag: "RUS" }),
      not(w({ is: "beaten", tag: "RUS" })),
      not(w({ is: "left_war" })),
    ),
    cast: { ...PM },
    salience: 9,
    tags: ["home", "foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("on", [dw({ do: "play_on", on: true })]),
      o("close", [dw({ do: "play_on", on: false })]),
    ],
    fallback: "close",
  }),
  rusScene("rus_sep_home", {
    kind: "proposal",
    when: w({ is: "left_war", min: 1 }),
    cast: { ...FOREIGN, ...WAR },
    salience: 7,
    tags: ["home", "foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("pay", [gauge("money", -1), trust("FRA", 1)]),
      o("explain", [trust("FRA", -1), opinion("press", 1)]),
      o("ignore", [trust("FRA", -1), trust("GBR", -1), gauge("order", 1)]),
    ],
  }),
];

export const RUS_AFTER_SCENES: readonly GwScene[] = [...AFTER, ...SEPARATE];
