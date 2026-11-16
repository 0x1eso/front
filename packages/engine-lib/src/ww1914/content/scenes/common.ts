import type {
  GwTemperament,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwCond,
  GwNode,
  GwScene,
  moody,
  reason,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

// What the engine itself reaches for, in every country. Text is in
// resources/ww1914/ko/common.json, written without a form of address: the
// same line serves an emperor and a prime minister.

const inTrenches: GwCond = { kind: "trench", theatre: "west", min: 1 };
/** The continent is at war and this seat isn't: nothing is quiet but the desk. */
const warElsewhere: GwCond = {
  kind: "all",
  of: [
    { kind: "world", of: { is: "entered", tag: "FRA" } },
    { kind: "not", of: { kind: "at_war", tag: "DEU" } },
    { kind: "not", of: { kind: "at_war", tag: "FRA" } },
  ],
};

/** A quiet chapter's card; the chapter's length picks which. */
function quiet(id: string, span: { min?: number; max?: number }): GwScene {
  return {
    id,
    nation: [...GW_TAGS],
    kind: "wire",
    when: { kind: "span", ...span },
    cast: {},
    salience: 0,
    tags: ["tension_down"],
    quiet: true,
    variants: [
      { id: "abroad", when: warElsewhere },
      { id: "front", when: inTrenches },
      { id: "letters", when: inTrenches },
      { id: "hot", when: { kind: "temp", min: 6 } },
      { id: "post" },
      { id: "still" },
      { id: "base" },
    ],
  };
}

const who = role("who");
const by = (t: GwTemperament) => ({ id: t, when: moody(who, t) });

const answer: GwNode = {
  says: [
    { id: "eased", when: { kind: "mood", min: 1 } },
    { id: "hurt", when: { kind: "mood", max: -1 } },
    { id: "base" },
  ],
  replies: [
    {
      id: "end",
      stance: "warm",
      kind: "leave",
      tell: [],
      effects: [],
      next: null,
    },
  ],
};

/**
 * ww219: the fronts each seat country can plan for, its main first (engine
 * WarPlan; Germany's main is `s.plan`). The paper after the 작전 course "계획을
 * 다시 짠다" asks which road the new plan prepares: one per seat, its other
 * fronts as options (Germany's: both, the one the plan takes greyed), and the
 * staff's own pick. Only engine/ww1914/WarPlan.beginRedraw lays it.
 */
export const GW_PLAN_FRONTS: Readonly<
  Partial<Record<GwTag, readonly GwTheatre[]>>
> = {
  DEU: ["west", "east"],
  FRA: ["west", "straits"],
  RUS: ["east", "caucasus"],
  AUH: ["balkan", "east", "italy"],
  GBR: ["west", "straits", "mesopotamia", "palestine"],
};

/** The roads a seat's redraw can take: Germany's main is `s.plan`, either. */
export function planRoads(tag: GwTag): readonly GwTheatre[] {
  const list = GW_PLAN_FRONTS[tag] ?? [];
  return tag === "DEU" ? list : list.slice(1);
}

/** The ids of those papers, `gw_plan_redraw_<tag>`. */
export const GW_PLAN_REDRAW_SCENES: readonly string[] = Object.keys(
  GW_PLAN_FRONTS,
).map((tag) => `gw_plan_redraw_${tag.toLowerCase()}`);

function planScenes(): GwScene[] {
  return (Object.keys(GW_PLAN_FRONTS) as GwTag[]).map((tag) => {
    const roads = planRoads(tag);
    return {
      id: `gw_plan_redraw_${tag.toLowerCase()}`,
      nation: [tag],
      kind: "proposal",
      when: {
        kind: "any",
        of: roads.map((theatre) => world({ is: "plan_alt_can", theatre })),
      },
      cast: {
        cos: { any_of: [{ office: "chief_of_staff" }, { office: "war" }] },
      },
      salience: 6,
      tags: ["war"],
      scheduledOnly: true,
      variants: [{ id: "base" }],
      fallback: "staff",
      options: [
        ...roads.map((theatre) => ({
          id: theatre,
          when: world({ is: "plan_alt_can", theatre }),
          tell: [],
          effects: [doWorld({ do: "plan_redraw", to: theatre })],
        })),
        {
          id: "staff",
          tell: [],
          effects: [doWorld({ do: "plan_redraw", to: null })],
        },
      ],
    };
  });
}

export const COMMON_SCENES: readonly GwScene[] = [
  quiet("gw_quiet_week", { max: 7 }),
  quiet("gw_quiet_month", { min: 8, max: 31 }),
  quiet("gw_quiet_months", { min: 32 }),
  // Someone a promise was made to, past its date (design §5.6).
  {
    id: "gw_promise_broken",
    nation: [...GW_TAGS],
    kind: "talk",
    cast: { who: { called: true } },
    salience: 5,
    tags: ["people"],
    scheduledOnly: true,
    who: "who",
    // ww190 §2: by who came, an old friend or one long estranged.
    variants: [
      { id: "friend", when: { kind: "person_trust", who, min: 2 } },
      { id: "estranged", when: { kind: "person_trust", who, max: -2 } },
      { id: "base" },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          by("anxious"),
          by("cold"),
          by("arrogant"),
          by("cunning"),
          by("weary"),
          by("stubborn"),
          { id: "base" },
        ],
        replies: [
          {
            id: "sorry",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            gain: [trustOf(who, 1), reason("promise_mended", who)],
            next: "answer",
          },
          {
            id: "explain",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            gain: [trustOf(who, 1), reason("promise_mended", who)],
            next: "answer",
          },
          {
            id: "shrug",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [trustOf(who, -1)],
            next: null,
          },
        ],
      },
      answer,
    },
  },
  ...planScenes(),
];
