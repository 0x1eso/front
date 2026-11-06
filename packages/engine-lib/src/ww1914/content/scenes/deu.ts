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

/**
 * The format's two examples: one decision, one conversation. Text is in
 * resources/ww1914/ko/DEU.json. The German content lane replaces them.
 */
export const DEU_SCENES: readonly GwScene[] = [
  {
    id: "deu_sample_envoy",
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
          setFlag("deu_sample_backed"),
        ],
      },
      {
        id: "term_limit",
        when: memory("heard_chancellor"),
        tell: ["temp:+1"],
        effects: [{ kind: "temp", delta: 1 }, setFlag("deu_sample_backed")],
      },
      {
        id: "wait",
        tell: ["army:-1"],
        effects: [inst_("army", -1), { kind: "reason", key: "sample_waited" }],
      },
    ],
  },
  {
    id: "deu_sample_talk",
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
        says: [
          { id: "worn", when: { kind: "temp", min: 5 } },
          { id: "base" },
        ],
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
