// Great War 1914 (ww190 §5): FRA's home front. Owned by the W-FRA lane; conds
// and effects in /home/eser/dev/ww190-interfaces.md. Text in
// resources/ww1914/ko/FRA.homefront.json.
import {
  all,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  atWar,
  fin,
  fm,
  gauge,
  home,
  men,
  opinion,
  paper,
  pm,
  ranged,
  trust,
  v,
  warMin,
  warMonths,
} from "./fra_years";

/**
 * The war at home, by state: women at work, prisoners on both sides, the
 * refugees of the north, the wounded through Switzerland, the flu, bread.
 * Eight cards, cooldown 4.
 */

const women = (min: number): GwCond => ranged({ is: "women_work" }, min);
const theirs = (min: number): GwCond =>
  ranged({ is: "prisoners", held: "theirs", tag: "DEU" }, min);
const ours = (min: number): GwCond =>
  ranged({ is: "prisoners", held: "ours", tag: "DEU" }, min);
const refugees = (min: number): GwCond => ranged({ is: "refugees" }, min);
const flu = (min: number): GwCond => ranged({ is: "flu" }, min);
const hunger = (min: number): GwCond => ranged({ is: "hunger" }, min);
const readiness = (delta: number): GwEffect =>
  doWorld({ do: "readiness", tag: "USA", delta });

const HF = { cooldown: 4, tags: ["home", "war"] } as Partial<GwScene>;

export const FRA_HOMEFRONT_SCENES: readonly GwScene[] = [
  paper(
    "fra_hf_women_fields",
    all(atWar, women(1)),
    [v("harvest", world({ is: "month", of: [7, 8, 9] })), v("base")],
    [
      ["allowance", [gauge("money", -1), gauge("morale", 1)]],
      ["soldiers", [men(-1), gauge("bread", 1)]],
      ["appeal", [opinion("press", 1)]],
    ],
    { ...HF, cast: { pm } },
  ),
  paper(
    "fra_hf_munitions",
    all(atWar, women(2)),
    [v("strike", { kind: "gauge", gauge: "order", max: 2 }), v("base")],
    [
      ["pay", [gauge("money", -1), gauge("order", 1)]],
      ["nurseries", [gauge("money", -1), opinion("workers", 1)]],
      ["hold", [gauge("shells", 1), opinion("workers", -1)]],
    ],
    { ...HF, cast: { pm, fin } },
  ),
  paper(
    "fra_hf_swiss",
    all(atWar, theirs(10)),
    [v("many", theirs(100)), v("base")],
    [
      ["exchange", [doWorld({ do: "exchange", tag: "DEU" }), trust("DEU", 1)]],
      ["parcels", [gauge("money", -1), gauge("morale", 1)]],
      ["wait", [opinion("army", 1)]],
    ],
    { ...HF, cast: { fm } },
  ),
  paper(
    "fra_hf_reprisal",
    all(atWar, theirs(20), ours(20), warMonths(12)),
    [v("long", warMonths(30)), v("base")],
    [
      [
        "reprisal",
        [doWorld({ do: "reprisal", tag: "DEU" }), gauge("morale", 1)],
      ],
      ["red_cross", [doWorld({ do: "exchange", tag: "DEU" })]],
      ["protest", [readiness(1), opinion("press", 1)]],
    ],
    { ...HF, cast: { fm, pm } },
  ),
  paper(
    "fra_hf_refugees",
    all(atWar, refugees(1)),
    [v("many", refugees(2)), v("base")],
    [
      ["allowance", [gauge("money", -1), gauge("order", 1)]],
      ["houses", [gauge("order", 1), opinion("business", -1)]],
      ["work", [men(1), opinion("workers", -1)]],
    ],
    { ...HF, cast: { home } },
  ),
  paper(
    "fra_hf_wounded",
    all(atWar, warMonths(6), theirs(5)),
    [v("long", warMonths(24)), v("base")],
    [
      ["welcome", [gauge("morale", 1), opinion("press", 1)]],
      ["quiet", [gauge("order", 1)]],
      ["hospitals", [gauge("money", -1), men(1)]],
    ],
    { ...HF, cast: { war: warMin } },
  ),
  paper(
    "fra_hf_flu",
    flu(1),
    [v("again", flu(2)), v("base")],
    [
      ["close", [gauge("morale", -1), men(1)]],
      ["silence", [gauge("morale", 1), opinion("press", -1)]],
      ["doctors", [men(-1), gauge("order", 1)]],
    ],
    { ...HF, tags: ["home"], cast: { home } },
  ),
  paper(
    "fra_hf_bread",
    all(atWar, hunger(1)),
    [v("ships", ranged({ is: "shipping" }, 6)), v("base")],
    [
      ["card", [gauge("bread", 1), gauge("order", -1)]],
      ["national", [gauge("bread", 1), gauge("morale", -1)]],
      ["imports", [gauge("money", -1), gauge("bread", 1)]],
    ],
    { ...HF, cast: { fin, home } },
  ),
];
