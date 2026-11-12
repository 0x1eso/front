// Great War 1914 (ww190 §3): FRA ruling German land, and the north under
// German rule. Owned by the W-FRA lane; conds and effects in
// /home/eser/dev/ww190-interfaces.md. Text in resources/ww1914/ko/FRA.rule.json.
import type { GwRulePolicy } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPlaceGroup } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  all,
  not,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  fm,
  gauge,
  home,
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
 * The ruler's side: one governing card for German land once France has held
 * it three months and rules it, then cards by how hard it rules and how the
 * land answers. The ruled side: the north under German rule, its deportations,
 * hostages and the relief. Cooldown 4; the state calls each.
 */

// ---- Conditions ----

const takenFrom = (min: number, group?: GwPlaceGroup[]): GwCond =>
  ranged(
    group === undefined
      ? { is: "land_taken", from: "DEU" }
      : { is: "land_taken", from: "DEU", group },
    min,
  );
const ruleDeu = (min?: number, max?: number): GwCond =>
  ranged({ is: "rule", of: "DEU" }, min, max);
const resist = (min: number): GwCond =>
  ranged({ is: "resist", of: "DEU" }, min);
const ruled = (min?: number): GwCond => ranged({ is: "ruled", by: "DEU" }, min);
const usNeutral = world({ is: "neutral", tag: "USA" });

// ---- Effects ----

const rule = (
  policy: GwRulePolicy | null,
  hard: number,
  relief?: boolean,
): GwEffect =>
  doWorld({
    do: "rule",
    of: "DEU",
    ...(policy === null ? {} : { policy }),
    ...(hard === 0 ? {} : { hard }),
    ...(relief === undefined ? {} : { relief }),
  });
const readiness = (delta: number): GwEffect =>
  doWorld({ do: "readiness", tag: "USA", delta });

// ---- The ruler ----

const RULER: GwScene[] = [
  paper(
    "fra_oc_govern",
    all(takenFrom(3), ruleDeu()),
    [
      v("alsace", takenFrom(3, ["alsace_lorraine"])),
      v("rhine", takenFrom(3, ["rhineland", "germany"])),
      v("colony", takenFrom(3, ["colonies"])),
      v("base"),
    ],
    [
      ["army", [rule("army", 1), opinion("army", 1)]],
      ["civil", [rule("civil", 0), opinion("parliament", 1)]],
      ["sort", [rule("civil", 1), opinion("press", 1)]],
    ],
    {
      cast: { war: warMin, home },
      once: true,
      salience: 8,
      tags: ["war", "home"],
    },
  ),
  paper(
    "fra_oc_requisition",
    ruleDeu(1),
    [v("coal", takenFrom(3, ["rhineland"])), v("base")],
    [
      ["harder", [rule(null, 1)]],
      ["keep", [gauge("order", 1)]],
      ["ease", [rule(null, -1)]],
    ],
    { cast: { war: warMin }, cooldown: 4, tags: ["war", "home"] },
  ),
  paper(
    "fra_oc_resist",
    resist(2),
    [v("rising", resist(3)), v("base")],
    [
      ["hostages", [rule(null, 1), opinion("army", 1)]],
      ["amnesty", [rule(null, -1), opinion("parliament", 1)]],
      ["mayors", [rule("civil", 0)]],
    ],
    { cast: { war: warMin, home }, cooldown: 4, tags: ["war", "home"] },
  ),
  paper(
    "fra_oc_relief",
    all(ruleDeu(2), not(world({ is: "relief", of: "DEU" })), usNeutral),
    [v("hard", ruleDeu(3)), v("base")],
    [
      ["let_in", [rule(null, 0, true), trust("USA", 1)]],
      ["own_bread", [gauge("bread", -1), rule(null, -1)]],
      ["refuse", [opinion("army", 1)]],
    ],
    { cast: { fm }, cooldown: 4, tags: ["war", "foreign"] },
  ),
];

// ---- The ruled ----

const RULED: GwScene[] = [
  paper(
    "fra_oc_lille",
    ruled(2),
    [
      v("lille", ranged({ is: "land_lost", to: "DEU", place: ["lille"] }, 3)),
      v("base"),
    ],
    [
      ["neutrals", [readiness(2), opinion("press", 1)]],
      [
        "reprisal",
        [doWorld({ do: "reprisal", tag: "DEU" }), gauge("morale", 1)],
      ],
      ["silence", [gauge("order", 1)]],
    ],
    { cast: { fm, home }, cooldown: 4, salience: 7, tags: ["war", "home"] },
  ),
  paper(
    "fra_oc_hostages",
    all(ruled(1), warMonths(12)),
    [v("hard", ruled(3)), v("base")],
    [
      ["reprisal", [doWorld({ do: "reprisal", tag: "DEU" })]],
      ["swap", [doWorld({ do: "exchange", tag: "DEU" }), trust("DEU", 1)]],
      ["wait", [gauge("morale", -1)]],
    ],
    { cast: { fm, pm }, cooldown: 4, tags: ["war", "home"] },
  ),
  paper(
    "fra_oc_relief_north",
    ruled(0),
    [v("in", world({ is: "relief" })), v("base")],
    [
      ["fund", [gauge("money", -1), gauge("morale", 1)]],
      ["america", [readiness(1), trust("USA", 1)]],
      ["leave", [gauge("order", 1)]],
    ],
    { cast: { fm }, cooldown: 4, tags: ["war", "home"] },
  ),
];

export const FRA_RULE_SCENES: readonly GwScene[] = [...RULER, ...RULED];
