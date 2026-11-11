// Great War 1914 (ww173 phase B): FRA's scenes of its great offensives:
// the plan laid out (`fra_w_off_prep`), each round's result
// (`fra_w_off_result`), an enemy offensive met (`fra_w_off_defended`), the
// army's refusal (`fra_w_off_mutiny`). Owned by the FRA writer lane; shapes
// and conditions in /home/eser/dev/ww173-formatb.md. Text in
// resources/ww1914/ko/FRA.offensive.json.
//
// The seat is Poincaré, President of the Republic: he signs, asks, presides
// and pardons, and commands nobody. These scenes never start, stop, press or
// move an offensive; their effects are a person's trust, a gauge by one, a
// remembered question. Variants by method, front, result, era and the man
// who holds the chief of staff's office; history is flavour, the state calls
// them, and no line names a date.
//
// The engine lays them (Offensives.callScene, `seat.scheduled`; listed in
// GW_OFFENSIVE_CALLED), so they are `scheduledOnly` and the deal never draws
// them.
import type {
  GwGauge,
  GwOffice,
  GwOffMethod,
  GwOffResult,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  holder,
  memory,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["FRA"];
const cos = role("cos");

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const o = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});

// ---- Conditions ----

interface OffCond {
  side?: "ours" | "foe";
  theatre?: ("west" | "balkan" | "straits")[];
  method?: GwOffMethod[];
  result?: GwOffResult[];
  min?: number;
  max?: number;
}
/** Our latest great offensive, or (side foe) the latest against us. */
const off = (c: OffCond = {}): GwCond => world({ is: "offensive", ...c });
const foe = (c: OffCond = {}): GwCond => off({ side: "foe", ...c });
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const chief = (person: string): GwCond => holds("chief_of_staff", person);
const era = (...of: ("trenches" | "material" | "depth" | "storm")[]): GwCond =>
  world({ is: "era", of });
const tanks: GwCond = world({ is: "tech", id: "tanks" });
const open = (theatre: "balkan" | "straits"): GwCond =>
  world({ is: "open", theatre });
const WEST: OffCond["theatre"] = ["west"];
/** The question the President asked of the plan, remembered. */
const ASKED = "m_fra_off_cost_asked";

/** A card the engine lays: never drawn. */
const called = (
  id: string,
  kind: "report" | "proposal",
  salience: number,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: NATION,
  kind,
  scheduledOnly: true,
  cast: { cos: holder("chief_of_staff") },
  salience,
  tags: ["war"],
  variants,
  noBack: true,
  ...more,
});

/** One result word, the first round or a later one: exclusive pairs. */
const byRound = (
  prefix: string,
  side: "ours" | "foe",
  result: GwOffResult,
): GwVariant[] => [
  v(`${prefix}_first`, off({ side, result: [result], max: 1 })),
  v(`${prefix}_more`, off({ side, result: [result], min: 2 })),
];

export const FRA_OFFENSIVE_SCENES: readonly GwScene[] = [
  // The chief's plan, the chapter after the President signed it.
  called(
    "fra_w_off_prep",
    "proposal",
    8,
    [
      // The 1918 way: tanks out of a forest, no long bombardment first.
      v(
        "mangin",
        all(off({ theatre: WEST, method: ["surprise"] }), era("storm"), tanks),
      ),
      v(
        "joffre",
        all(off({ theatre: WEST, method: ["long"] }), chief("fra_joffre")),
      ),
      v(
        "nivelle",
        all(
          off({ theatre: WEST, method: ["long", "surprise"] }),
          chief("fra_nivelle"),
        ),
      ),
      v("petain", all(off({ theatre: WEST }), chief("fra_petain"))),
      v("foch", all(off({ theatre: WEST }), chief("fra_foch"))),
      v("orient", all(off({ theatre: ["balkan"] }), open("balkan"))),
      v("straits", all(off({ theatre: ["straits"] }), open("straits"))),
      v("long", off({ method: ["long"] })),
      v("broad", off({ method: ["broad"] })),
      v("surprise", off({ method: ["surprise"] })),
      v("base"),
    ],
    {
      fallback: "leave_it",
      options: [
        o("leave_it", [trustOf(cos, 1)]),
        o("commission", [
          { kind: "inst", inst: "chamber", delta: 1 },
          trustOf(cos, -1),
        ]),
        o("ask_cost", [trustOf(cos, -1), remember(ASKED)]),
      ],
    },
  ),

  // Each round of our offensive, the chapter after.
  called(
    "fra_w_off_result",
    "report",
    7,
    [
      v(
        "mangin_won",
        all(
          off({
            theatre: WEST,
            method: ["surprise"],
            result: ["break", "bite"],
          }),
          era("storm"),
          tanks,
        ),
      ),
      v(
        "nivelle_failed",
        all(
          off({ theatre: WEST, result: ["attrition", "repulsed"], max: 1 }),
          chief("fra_nivelle"),
        ),
      ),
      v(
        "orient_break",
        all(off({ theatre: ["balkan"], result: ["break"] }), open("balkan")),
      ),
      ...byRound("break", "ours", "break"),
      ...byRound("bite", "ours", "bite"),
      ...byRound("attrition", "ours", "attrition"),
      ...byRound("repulsed", "ours", "repulsed"),
      v("base"),
    ],
    { stamp: "confirmed", source: "staff" },
  ),

  // Each round of an enemy offensive on our front, the chapter after.
  called(
    "fra_w_off_defended",
    "report",
    7,
    [
      v(
        "storm_broke",
        all(foe({ theatre: WEST, result: ["break"] }), era("storm")),
      ),
      v(
        "long_held",
        all(
          foe({
            theatre: WEST,
            method: ["long"],
            result: ["attrition", "repulsed"],
          }),
          era("material", "trenches"),
        ),
      ),
      ...byRound("gave_break", "foe", "break"),
      ...byRound("gave_bite", "foe", "bite"),
      ...byRound("held_attrition", "foe", "attrition"),
      ...byRound("held_repulsed", "foe", "repulsed"),
      v("base"),
    ],
    { stamp: "confirmed", source: "staff" },
  ),

  // Our repulsed army will not go again (strain high, morale low).
  called(
    "fra_w_off_mutiny",
    "proposal",
    8,
    [
      v(
        "again",
        all(
          { kind: "seen", scene: "fra_big_mutiny" },
          off({ result: ["repulsed"] }),
        ),
      ),
      v("nivelle", all(chief("fra_nivelle"), off({ result: ["repulsed"] }))),
      v("asked", memory(ASKED)),
      v("base"),
    ],
    {
      tags: ["war", "home"],
      fallback: "leave_food",
      options: [
        o("leave_food", [gauge("morale", 1), gauge("money", -1)]),
        o("courts", [gauge("order", 1), gauge("morale", -1)]),
        o("go_see", [gauge("morale", 1), trustOf(cos, -1)]),
        o("silence", [
          gauge("order", 1),
          { kind: "opinion", bloc: "press", delta: -1 },
        ]),
      ],
    },
  ),
];
