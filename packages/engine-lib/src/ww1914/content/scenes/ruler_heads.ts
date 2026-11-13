// ww208, decision 1B: the three warnings of a head's card (GW_HEAD_SCENES in
// RulerRows), one set for every head a utopia brings: Ebert, Henderson,
// Lammasch, Renner, Lvov, Kerensky, the Duke of Orléans. Lane P. Text in
// resources/ww1914/ko/common.head.json; it names no one and uses no form of
// address, so it serves each of them.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_HEAD_SCENES, GW_RULERS } from "../../RulerRows";
import { called, opt, ruler, rulerIs, seniorBy, v } from "./ruler_kit";

const HEADS = Object.values(GW_RULERS)
  .flat()
  .filter((r) => r.head === true)
  .map((r) => r.id);
const NATION: GwScene["nation"] = ["DEU", "GBR", "FRA", "RUS", "AUH"];
const self = rulerIs(...HEADS);
const lastWarning = { kind: "ruler_failing", min: 2 } as const;
const lastShaken = { kind: "ruler_shaken", min: 2 } as const;
const near = { who: seniorBy };

/** A head's card. Text in resources/ww1914/ko/common.head.json. */
export const RULER_HEADS: readonly GwScene[] = [
  called({
    id: GW_HEAD_SCENES.doctors,
    nation: NATION,
    kind: "audience",
    when: self,
    cast: near,
    variants: [v("last", lastWarning), v("base")],
    fallback: "rest",
    options: [
      opt("rest", [
        ruler("health", 2, "gw_head_rested"),
        { kind: "audiences", delta: -1 },
      ]),
      opt("half", [ruler("health", 1, "gw_head_half_rest")]),
      opt("go_on", [{ kind: "reason", key: "gw_head_went_on" }]),
    ],
  }),
  called({
    id: GW_HEAD_SCENES.shaken,
    nation: NATION,
    kind: "crisis",
    when: self,
    cast: near,
    variants: [v("last", lastShaken), v("base")],
    fallback: "speak",
    options: [
      opt("speak", [
        ruler("reputation", 2, "gw_head_spoke"),
        ruler("health", -1, "gw_head_spoke"),
      ]),
      opt("friends", [
        ruler("reputation", 1, "gw_head_friends"),
        ruler("family", -1, "gw_head_friends"),
      ]),
      opt("wait", [{ kind: "reason", key: "gw_head_waited" }]),
    ],
  }),
  called({
    id: GW_HEAD_SCENES.broken,
    nation: NATION,
    kind: "audience",
    when: self,
    cast: near,
    fallback: "carry_on",
    options: [
      opt("carry_on"),
      opt("walk", [ruler("health", 1, "gw_head_walked")]),
      opt("write_names", [ruler("conscience", 1, "gw_head_names")]),
    ],
  }),
];
