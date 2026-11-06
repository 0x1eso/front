import {
  GwScene,
  holder,
  inst_,
  memory,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  GwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { COMMON_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/common";
import { WORLD_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/world";

/**
 * One decision and one talk that opens its option, on the real cast and the
 * game's own common scenes. Tests of the clock and the orders run on this, so
 * they don't move when the writers' scenes do. Text isn't needed: the engine
 * never reads a pack.
 */
const SCENES: readonly GwScene[] = [
  {
    id: "fx_envoy",
    nation: ["DEU"],
    kind: "proposal",
    stage: ["crisis"],
    cast: { chancellor: holder("chancellor"), cos: holder("chief_of_staff") },
    salience: 5,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [
      { id: "heard_chancellor", when: memory("heard_chancellor") },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      {
        id: "back_vienna",
        tell: ["army:+1", "temp:+2"],
        effects: [
          inst_("army", 1),
          { kind: "temp", delta: 2 },
          setFlag("fx_backed"),
        ],
      },
      {
        id: "term_limit",
        when: memory("heard_chancellor"),
        tell: ["temp:+1"],
        effects: [{ kind: "temp", delta: 1 }, setFlag("fx_backed")],
      },
      {
        id: "wait",
        tell: ["army:-1"],
        effects: [inst_("army", -1), { kind: "reason", key: "fx_waited" }],
      },
    ],
  },
  {
    id: "fx_talk",
    nation: ["DEU"],
    kind: "talk",
    stage: ["crisis", "y1914"],
    cast: { chancellor: holder("chancellor") },
    salience: 1,
    tags: ["people"],
    cooldown: 1,
    summon: true,
    who: "chancellor",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [{ id: "worn", when: { kind: "temp", min: 5 } }, { id: "base" }],
        replies: [
          {
            id: "ask_vienna",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [remember("heard_chancellor")],
            next: "vienna",
          },
          {
            id: "press",
            stance: "threat",
            kind: "push",
            tell: ["trust:-1"],
            effects: [trustOf(role("chancellor"), -1)],
            next: null,
            reacts: [
              {
                when: {
                  kind: "temperament",
                  who: role("chancellor"),
                  of: ["anxious"],
                },
                next: "vienna",
                effects: [remember("heard_chancellor")],
              },
            ],
          },
          {
            id: "leave",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      vienna: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "thank",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [trustOf(role("chancellor"), 1)],
            next: null,
          },
        ],
      },
    },
  },
];

export const FOUNDATION_CONTENT: GwContent = {
  scenes: [...COMMON_SCENES, ...WORLD_SCENES, ...SCENES],
  people: GW_CONTENT.people,
};
