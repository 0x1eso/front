// Great War 1914 (ww173 phase B): DEU's scenes of its great offensives:
// the plan laid out (`deu_w_off_prep`), each round's result
// (`deu_w_off_result`), an enemy offensive met (`deu_w_off_defended`), the
// army's refusal (`deu_w_off_mutiny`). Owned by the DEU writer lane; shapes
// and conditions in /home/eser/dev/ww173-formatb.md. Text in
// resources/ww1914/ko/DEU.offensive.json.
//
// The state calls every variant, never a date: a long bombardment in the west
// reads like Verdun, a surprise in the storm era like March 1918, a blow in
// the east like Gorlice. A variant's weight is the number of conditions it
// names (SceneRun.specificity), so `off` splits each field into its own
// condition: the narrower variant wins over the plain result.
import type {
  GwEra,
  GwOffMethod,
  GwOffResult,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  any,
  type GwCond,
  type GwEffect,
  type GwScene,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

interface Off {
  side?: "ours" | "foe";
  theatre?: GwTheatre[];
  method?: GwOffMethod[];
  result?: GwOffResult[];
  min?: number;
  max?: number;
}

/** The latest offensive, one condition per field it names. */
function off(x: Off): GwCond {
  const side = x.side === undefined ? {} : { side: x.side };
  const parts: GwCond[] = [world({ is: "offensive", ...side })];
  if (x.theatre !== undefined) {
    parts.push(world({ is: "offensive", ...side, theatre: x.theatre }));
  }
  if (x.method !== undefined) {
    parts.push(world({ is: "offensive", ...side, method: x.method }));
  }
  if (x.result !== undefined) {
    parts.push(world({ is: "offensive", ...side, result: x.result }));
  }
  if (x.min !== undefined || x.max !== undefined) {
    const range = {
      ...(x.min === undefined ? {} : { min: x.min }),
      ...(x.max === undefined ? {} : { max: x.max }),
    };
    parts.push(world({ is: "offensive", ...side, ...range }));
  }
  return parts.length === 1 ? parts[0] : all(...parts);
}

const foe = (x: Omit<Off, "side">): GwCond => off({ ...x, side: "foe" });
const era = (...of: GwEra[]): GwCond => world({ is: "era", of });
const gauge = (g: "morale" | "order", delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});

const HELD: GwOffResult[] = ["attrition", "repulsed"];
const GAVE: GwOffResult[] = ["bite", "break"];
const cos = { cos: { office: "chief_of_staff" } } as const;

type Called = Omit<GwScene, "nation" | "scheduledOnly" | "tags">;
/** A scene the engine calls (Offensives.callScene), never drawn. */
const called = (x: Called): GwScene => ({
  nation: ["DEU"],
  scheduledOnly: true,
  tags: ["war"],
  ...x,
});

export const DEU_OFFENSIVE_SCENES: readonly GwScene[] = [
  // The chapter after the seat signed "대공세를 준비한다": the plan laid out.
  called({
    id: "deu_w_off_prep",
    kind: "report",
    stamp: "confirmed",
    source: "staff",
    salience: 7,
    cast: cos,
    variants: [
      {
        id: "michael",
        when: all(
          off({ method: ["surprise"], theatre: ["west"] }),
          era("storm"),
        ),
      },
      {
        id: "verdun",
        when: all(
          off({ method: ["long"], theatre: ["west"] }),
          era("material", "depth", "storm"),
        ),
      },
      { id: "italy", when: off({ method: ["surprise"], theatre: ["italy"] }) },
      { id: "riga", when: off({ method: ["surprise"], theatre: ["east"] }) },
      { id: "west_long", when: off({ method: ["long"], theatre: ["west"] }) },
      { id: "west", when: off({ theatre: ["west"] }) },
      { id: "east", when: off({ theatre: ["east"] }) },
      { id: "balkan", when: off({ theatre: ["balkan", "danube"] }) },
      { id: "surprise", when: off({ method: ["surprise"] }) },
      { id: "broad", when: off({ method: ["broad"] }) },
      { id: "base" },
    ],
  }),

  // After each round of our offensive (rounds 1-4): the day in words.
  called({
    id: "deu_w_off_result",
    kind: "report",
    stamp: "confirmed",
    source: "staff",
    salience: 8,
    cast: cos,
    variants: [
      {
        id: "michael_break",
        when: all(
          off({ method: ["surprise"], theatre: ["west"], result: ["break"] }),
          era("storm"),
        ),
      },
      {
        id: "michael_stall",
        when: all(
          off({
            method: ["surprise"],
            theatre: ["west"],
            result: HELD,
            min: 2,
          }),
          era("storm"),
        ),
      },
      {
        id: "verdun_first",
        when: off({
          method: ["long"],
          theatre: ["west"],
          result: ["bite"],
          max: 1,
        }),
      },
      {
        id: "verdun_mill",
        when: off({
          method: ["long"],
          theatre: ["west"],
          result: ["attrition"],
          min: 2,
        }),
      },
      { id: "italy_break", when: off({ theatre: ["italy"], result: GAVE }) },
      { id: "east_break", when: off({ theatre: ["east"], result: ["break"] }) },
      {
        id: "surprise_failed",
        when: off({ method: ["surprise"], result: ["repulsed"] }),
      },
      { id: "break_first", when: off({ result: ["break"], max: 1 }) },
      { id: "break", when: off({ result: ["break"], min: 2 }) },
      { id: "bite_first", when: off({ result: ["bite"], max: 1 }) },
      { id: "bite", when: off({ result: ["bite"], min: 2 }) },
      { id: "attrition_first", when: off({ result: ["attrition"], max: 1 }) },
      { id: "attrition", when: off({ result: ["attrition"], min: 2 }) },
      { id: "repulsed_first", when: off({ result: ["repulsed"], max: 1 }) },
      { id: "repulsed", when: off({ result: ["repulsed"], min: 2 }) },
      { id: "base" },
    ],
  }),

  // After each round of an enemy offensive on our front.
  called({
    id: "deu_w_off_defended",
    kind: "report",
    stamp: "confirmed",
    source: "staff",
    salience: 7,
    cast: cos,
    variants: [
      {
        id: "black_day",
        when: all(foe({ theatre: ["west"], result: ["break"] }), era("storm")),
      },
      {
        id: "somme_first",
        when: foe({
          method: ["long"],
          theatre: ["west"],
          result: HELD,
          max: 1,
        }),
      },
      {
        id: "somme",
        when: foe({
          method: ["long"],
          theatre: ["west"],
          result: ["attrition"],
          min: 2,
        }),
      },
      {
        id: "tanks",
        when: all(
          foe({ method: ["surprise"], theatre: ["west"], result: GAVE }),
          any(
            world({ is: "tech", id: "tanks", tag: "GBR" }),
            world({ is: "tech", id: "tanks", tag: "FRA" }),
          ),
        ),
      },
      {
        id: "east_broad",
        when: foe({ method: ["broad"], theatre: ["east"], result: GAVE }),
      },
      { id: "broke", when: foe({ result: ["break"] }) },
      { id: "gave_first", when: foe({ result: ["bite"], max: 1 }) },
      { id: "gave", when: foe({ result: ["bite"], min: 2 }) },
      { id: "held_first", when: foe({ result: HELD, max: 1 }) },
      { id: "held", when: foe({ result: HELD, min: 2 }) },
      // ww190: a second body for the commonest round, taking turns with it.
      { id: "held_again", when: foe({ result: HELD, min: 2 }) },
      { id: "quiet_front" },
      { id: "base" },
    ],
  }),

  // Our repulsed army will not go again (strain high, morale low).
  called({
    id: "deu_w_off_mutiny",
    kind: "proposal",
    salience: 8,
    cast: cos,
    author: "cos",
    variants: [
      { id: "strike", when: all(off({ theatre: ["west"] }), era("storm")) },
      { id: "east", when: off({ theatre: ["east"] }) },
      { id: "base" },
    ],
    fallback: "hush",
    options: [
      {
        id: "courts",
        tell: ["order:+1", "morale:-1"],
        effects: [
          gauge("order", 1),
          gauge("morale", -1),
          reason("deu_off_courts"),
          remember("m_deu_army_courts"),
        ],
      },
      {
        id: "rest",
        tell: ["morale:+1", "trust:-1"],
        effects: [
          gauge("morale", 1),
          trustOf(role("cos"), -1),
          reason("deu_off_rest"),
        ],
      },
      {
        id: "hush",
        tell: ["censor:+1"],
        effects: [{ kind: "censor", delta: 1 }, reason("deu_off_hush")],
      },
    ],
  }),
];
