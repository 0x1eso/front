// Great War 1914 (ww190 §10-11): Austria-Hungary after the conference, and
// after a peace of its own. Data only; the text is in
// resources/ww1914/ko/AUH.after.json. Aftermath.ts lays auh_aft_ratify
// and auh_sep_on; neither is drawn.
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  card,
  gauge,
  inst,
  office,
  opinion,
  pick,
  trust,
  w,
} from "./auh_years";

const FM = office("foreign");
const HUN = office("hun_pm");
const WAR = office("war");
const PM = office("chancellor");

const side = (...of: ("won" | "lost" | "even")[]): GwCond =>
  w({ is: "peace_side", of });
const afterFor = (min: number): GwCond => w({ is: "after_months", min });

export const AUH_AFTER_SCENES: readonly GwScene[] = [
  card({
    id: "auh_aft_delegation",
    when: w({ is: "armistice" }),
    stage: ["conference"],
    cast: { fm: FM, hun: HUN },
    vs: [["won", side("won")], ["lost", side("lost")], ["base"]],
    picks: [
      pick("minister", inst("council", 1)),
      pick("both_halves", inst("hungary", 1), inst("council", -1)),
    ],
    salience: 7,
    tags: ["foreign"],
    once: true,
  }),
  {
    ...card({
      id: "auh_aft_ratify",
      when: all(
        not(w({ is: "ratified" })),
        not(w({ is: "ratified", no: true })),
      ),
      stage: ["aftermath"],
      cast: { fm: FM, hun: HUN },
      vs: [["lost", side("lost")], ["won", side("won")], ["base"]],
      picks: [
        pick("sign", doWorld({ do: "ratify", yes: true })),
        pick(
          "refuse",
          doWorld({ do: "ratify", yes: false }),
          opinion("army", 1),
        ),
      ],
      salience: 9,
      tags: ["foreign"],
      once: true,
    }),
    scheduledOnly: true,
  },
  card({
    id: "auh_aft_demob",
    when: w({ is: "demob", max: 0 }),
    stage: ["aftermath"],
    cast: { war: WAR },
    vs: [["unrest", w({ is: "unrest", min: 2 })], ["base"]],
    picks: [
      pick("classes", doWorld({ do: "demob", level: 1 })),
      pick("all", doWorld({ do: "demob", level: 2 })),
      pick("hold", doWorld({ do: "demob", level: 0 }), gauge("morale", -1)),
    ],
    salience: 8,
    tags: ["home"],
    once: true,
  }),
  card({
    id: "auh_aft_home",
    when: afterFor(1),
    stage: ["aftermath"],
    cast: { war: WAR },
    vs: [
      ["russia", w({ is: "prisoners", held: "theirs", tag: "RUS", min: 1 })],
      ["base"],
    ],
    picks: [
      pick("quarantine", gauge("order", 1), gauge("morale", -1)),
      pick("home", gauge("morale", 1), gauge("order", -1)),
    ],
    once: true,
  }),
  card({
    id: "auh_aft_year",
    when: afterFor(2),
    stage: ["aftermath"],
    cast: { pm: PM },
    vs: [["won", side("won")], ["lost", side("lost")], ["base"]],
    once: true,
  }),
  // ---- After a peace of its own (ww190 §11) ----
  {
    ...card({
      id: "auh_sep_on",
      when: all(
        w({ is: "out", tag: "AUH" }),
        not(w({ is: "beaten", tag: "AUH" })),
        not(w({ is: "left_war" })),
        not(w({ is: "armistice" })),
        w({ is: "unrest", max: 2 }),
      ),
      cast: { fm: FM },
      vs: [["base"]],
      picks: [
        pick("on", doWorld({ do: "play_on", on: true })),
        pick("close", doWorld({ do: "play_on", on: false })),
      ],
      salience: 9,
      tags: ["foreign"],
      once: true,
    }),
    scheduledOnly: true,
  },
  card({
    id: "auh_sep_home",
    when: w({ is: "left_war", min: 1 }),
    cast: { fm: FM, war: WAR },
    vs: [["berlin_cold", { kind: "trust", tag: "DEU", max: -2 }], ["base"]],
    picks: [
      pick("berlin", trust("DEU", 1), gauge("money", -1)),
      pick("own", trust("DEU", -1), gauge("morale", 1)),
    ],
    tags: ["foreign", "home"],
    once: true,
  }),
];
