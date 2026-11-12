// Great War 1914 (ww190 §10-11): FRA after the conference, and after a peace
// of its own. Owned by the W-FRA lane; conds and effects in
// /home/eser/dev/ww190-interfaces.md. Text in resources/ww1914/ko/FRA.after.json.
import {
  all,
  flag,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  fm,
  gauge,
  inst,
  men,
  opinion,
  paper,
  pm,
  ranged,
  trust,
  v,
  warMin,
} from "./fra_years";

/**
 * After the table: the delegation home, the ratification (scheduled by
 * Aftermath.ts in the first aftermath chapter), the demobilisation, the men
 * home, the year after. After a separate peace: the card that asks whether to
 * play on (scheduled the chapter after it), and the men home with the old
 * allies' anger.
 */

/** Laid only by the world's code (Aftermath.ts), never drawn. */
const called = flag("gw_world_called_only");
const after = (min: number): GwCond => ranged({ is: "after_months" }, min);
const side = (...of: ("won" | "lost" | "even")[]): GwCond =>
  world({ is: "peace_side", of });
const demob = (min: number, max?: number): GwCond =>
  ranged({ is: "demob" }, min, max);
const leftWar = (min: number): GwCond => ranged({ is: "left_war" }, min);
const ratify = (yes: boolean): GwEffect => doWorld({ do: "ratify", yes });
const demobTo = (level: number): GwEffect => doWorld({ do: "demob", level });
const playOn = (on: boolean): GwEffect => doWorld({ do: "play_on", on });

const AFT = {
  once: true,
  stage: ["aftermath"],
  tags: ["home", "tension_down"],
} as Partial<GwScene>;

const AFTER: GwScene[] = [
  paper(
    "fra_aft_delegation",
    after(0),
    [v("won", side("won")), v("lost", side("lost")), v("base")],
    [
      ["station", [gauge("morale", 1), opinion("press", 1)]],
      ["report", [inst("chamber", 1)]],
      ["quiet", [gauge("order", 1)]],
    ],
    { ...AFT, cast: { pm, fm }, salience: 7 },
  ),
  paper(
    "fra_aft_ratify",
    called,
    [v("won", side("won")), v("lost", side("lost")), v("base")],
    [
      ["sign", [ratify(true)]],
      ["refuse", [ratify(false), opinion("army", 1)]],
    ],
    {
      ...AFT,
      stage: undefined,
      cast: { pm },
      salience: 9,
      tags: ["foreign", "tension_down"],
      fallback: "sign",
    },
  ),
  paper(
    "fra_aft_demob",
    all(after(0), demob(0, 0)),
    [v("won", side("won")), v("base")],
    [
      ["classes", [demobTo(1)]],
      ["all", [demobTo(2)]],
      ["hold", [demobTo(0), inst("army", 1)]],
    ],
    { ...AFT, cast: { war: warMin }, salience: 8, fallback: "classes" },
  ),
  paper(
    "fra_aft_men_home",
    after(2),
    [v("demob", demob(1)), v("base")],
    [
      ["parade", [gauge("morale", 1), gauge("money", -1)]],
      ["jobs", [gauge("order", 1), opinion("business", -1)]],
      ["pensions", [gauge("money", -1), opinion("workers", 1)]],
    ],
    { ...AFT, cast: { pm } },
  ),
  paper(
    "fra_aft_year_after",
    after(3),
    [
      v("unratified", world({ is: "ratified", no: true })),
      v("won", side("won")),
      v("base"),
    ],
    [
      ["rebuild", [gauge("money", -1), gauge("order", 1)]],
      ["monuments", [gauge("morale", 1)]],
      ["debts", [trust("USA", 1), opinion("press", -1)]],
    ],
    { ...AFT, cast: { pm } },
  ),
];

const SEPARATE: GwScene[] = [
  paper(
    "fra_sep_on",
    called,
    [v("base")],
    [
      ["play_on", [playOn(true)]],
      ["memoir", [playOn(false)]],
    ],
    {
      once: true,
      salience: 9,
      cast: { pm },
      tags: ["home", "tension_down"],
      fallback: "memoir",
    },
  ),
  paper(
    "fra_sep_home",
    leftWar(1),
    [v("bitter", { kind: "trust", tag: "GBR", max: -2 }), v("base")],
    [
      ["envoy", [trust("GBR", 1), trust("RUS", 1)]],
      ["men_home", [men(2), gauge("morale", 1)]],
      ["silence", [gauge("order", 1)]],
    ],
    { once: true, salience: 7, cast: { fm }, tags: ["foreign", "home"] },
  ),
];

export const FRA_AFTER_SCENES: readonly GwScene[] = [...AFTER, ...SEPARATE];
