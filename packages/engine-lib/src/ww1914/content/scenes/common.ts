import type { GwTemperament } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwCond,
  GwNode,
  GwScene,
  moody,
  reason,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";

// What the engine itself reaches for, in every country. Text is in
// resources/ww1914/ko/common.json, written without a form of address: the
// same line serves an emperor and a prime minister.

const inTrenches: GwCond = { kind: "trench", theatre: "west", min: 1 };

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
    variants: [{ id: "base" }],
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
];
